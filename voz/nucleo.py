"""Núcleo del estudio de voz del canal.

Cadena: guion.md → frases + pausas → voz con Chatterbox Multilingual (GPU) → se libera la GPU
        → Whisper analiza cada frase: dónde acaba, si Chatterbox repitió algo al final y los
          tiempos por palabra del guion original → se regeneran las frases ilegibles
        → se recortan las frases y se montan con sus silencios exactos.

Regla de la VRAM (6 GB): nunca hay dos modelos cargados a la vez. Cada modelo se carga,
se usa y se libera antes de cargar el siguiente.
"""

from __future__ import annotations

import difflib
import gc
import hashlib
import json
import re
import unicodedata
from dataclasses import asdict, dataclass
from importlib import metadata
from pathlib import Path

import numpy as np

RAIZ = Path(__file__).resolve().parent.parent
REFERENCIA = RAIZ / "assets" / "voz_canal.wav"
IDIOMA = "es"
# Súbelo cuando cambie la lógica de generación, para que se regeneren las voces guardadas.
VERSION_CADENA = "2"
LUFS_OBJETIVO = -16.0


@dataclass
class Ajustes:
    """Parámetros de la voz. Los valores por defecto buscan el tono de documental nocturno."""

    exageracion: float = 0.5  # emoción: 0.25 sobria … 1.0 teatral
    cfg: float = 0.4  # más bajo = ritmo más pausado
    temperatura: float = 0.7
    semilla: int = 0
    pausa_frase: float = 0.30  # entre frases de un mismo bloque
    pausa: float = 0.60  # [pausa]
    pausa_larga: float = 1.20  # [pausa larga]
    pausa_parrafo: float = 0.70  # entre párrafos
    modelo_whisper: str = "small"


@dataclass
class Segmento:
    """Una frase que se genera de una vez, y el silencio que va después."""

    texto: str
    silencio_despues: float


# ───────────────────────────── Guion ─────────────────────────────

_ANIMACION = re.compile(r"\[\s*animaci[oó]n\s*:[^\]]*\]", re.IGNORECASE)
_PAUSA = re.compile(r"\[\s*(pausa larga|pausa)\s*\]", re.IGNORECASE)
_OTRA_MARCA = re.compile(r"\[[^\]]*\]")
_FIN_FRASE = re.compile(r"(?<=[.!?…])\s+")
_MAX_CARACTERES = 260


def _partir_largas(frase: str) -> list[str]:
    """Chatterbox se vuelve inestable con textos muy largos: parte en comas si hace falta."""
    if len(frase) <= _MAX_CARACTERES:
        return [frase]
    partes, actual = [], ""
    for trozo in re.split(r"(?<=[,;:])\s+", frase):
        if actual and len(actual) + len(trozo) + 1 > _MAX_CARACTERES:
            partes.append(actual)
            actual = trozo
        else:
            actual = f"{actual} {trozo}".strip()
    if actual:
        partes.append(actual)
    return partes


def leer_guion(texto: str, ajustes: Ajustes) -> list[Segmento]:
    """Convierte el guion en frases con su silencio posterior.

    - Se ignoran los títulos (# …) y las indicaciones [Animación: …] (no se leen).
    - [pausa] y [pausa larga] se convierten en silencios exactos.
    """
    lineas = [l for l in texto.splitlines() if not l.lstrip().startswith("#")]
    limpio = _ANIMACION.sub(" ", "\n".join(lineas))
    limpio = re.sub(r"[*_`]", "", limpio)
    parrafos = [p.strip() for p in re.split(r"\n\s*\n", limpio) if p.strip()]

    segmentos: list[Segmento] = []
    for parrafo in parrafos:
        parrafo = " ".join(parrafo.split())
        # Trozos separados por marcas de pausa: [(texto, marca_que_lo_sigue)]
        trozos, inicio = [], 0
        for m in _PAUSA.finditer(parrafo):
            trozos.append((parrafo[inicio : m.start()], m.group(1).lower()))
            inicio = m.end()
        trozos.append((parrafo[inicio:], None))

        for texto_trozo, marca in trozos:
            texto_trozo = _OTRA_MARCA.sub(" ", texto_trozo)
            frases = [f.strip() for f in _FIN_FRASE.split(texto_trozo) if f.strip()]
            frases = [p for f in frases for p in _partir_largas(f)]
            if not frases:
                # Pausa sin texto delante: se suma al silencio anterior
                if marca and segmentos:
                    segmentos[-1].silencio_despues += _silencio_de(marca, ajustes)
                continue
            for i, frase in enumerate(frases):
                ultima = i == len(frases) - 1
                silencio = _silencio_de(marca, ajustes) if (ultima and marca) else ajustes.pausa_frase
                segmentos.append(Segmento(frase, silencio))
        if segmentos:
            segmentos[-1].silencio_despues = max(segmentos[-1].silencio_despues, ajustes.pausa_parrafo)
    if segmentos:
        segmentos[-1].silencio_despues = 0.0
    return segmentos


def _silencio_de(marca: str | None, ajustes: Ajustes) -> float:
    if marca == "pausa larga":
        return ajustes.pausa_larga
    if marca == "pausa":
        return ajustes.pausa
    return ajustes.pausa_frase


def normalizar(palabra: str) -> str:
    """Minúsculas, sin acentos ni puntuación: para comparar palabras."""
    p = unicodedata.normalize("NFD", palabra.lower())
    p = "".join(c for c in p if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]", "", p)


# ───────────────────────────── GPU ─────────────────────────────


def exigir_cuda():
    """Este proyecto exige GPU: si PyTorch ve solo CPU, es un error de instalación."""
    import torch

    if not torch.cuda.is_available():
        raise RuntimeError(
            "PyTorch no ve la GPU (CUDA). Revisa que el contenedor arranque con la GPU "
            "(docker compose run --rm voz …) y que Docker Desktop muestre la RTX 2060."
        )
    return torch


def liberar_gpu() -> None:
    import torch

    gc.collect()
    torch.cuda.empty_cache()


def vram_usada_gb() -> float:
    import torch

    return torch.cuda.max_memory_allocated() / 1024**3


# ───────────────────────────── Voz (TTS) ─────────────────────────────


class Voz:
    """Chatterbox Multilingual con la voz del canal como referencia."""

    def __init__(self, referencia: Path = REFERENCIA):
        torch = exigir_cuda()
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS

        self._torch = torch
        self.modelo = ChatterboxMultilingualTTS.from_pretrained(device="cuda")
        self.sr: int = self.modelo.sr
        self._referencia: tuple[str, float] | None = None
        self.referencia = referencia

    def _preparar(self, exageracion: float) -> None:
        clave = (str(self.referencia), exageracion)
        if self._referencia != clave:
            self.modelo.prepare_conditionals(str(self.referencia), exaggeration=exageracion)
            self._referencia = clave

    def decir(self, texto: str, ajustes: Ajustes, indice: int = 0) -> np.ndarray:
        """Genera una frase y le recorta el silencio de los bordes."""
        import librosa

        self._preparar(ajustes.exageracion)
        self._torch.manual_seed(ajustes.semilla * 1000 + indice)
        with self._torch.inference_mode():
            wav = self.modelo.generate(
                texto,
                language_id=IDIOMA,
                exaggeration=ajustes.exageracion,
                cfg_weight=ajustes.cfg,
                temperature=ajustes.temperatura,
            )
        audio = wav.squeeze(0).detach().cpu().numpy().astype(np.float32)
        recortado, _ = librosa.effects.trim(audio, top_db=40)
        margen = np.zeros(int(0.04 * self.sr), dtype=np.float32)
        return np.concatenate([margen, recortado, margen])

    def cerrar(self) -> None:
        del self.modelo
        liberar_gpu()


def normalizar_volumen(audio: np.ndarray, sr: int) -> np.ndarray:
    """Lleva la voz a −16 LUFS sin pasar de −1 dB de pico."""
    import pyloudnorm

    medidor = pyloudnorm.Meter(sr)
    actual = medidor.integrated_loudness(audio)
    if np.isfinite(actual):
        audio = pyloudnorm.normalize.loudness(audio, actual, LUFS_OBJETIVO)
    pico = float(np.max(np.abs(audio))) or 1.0
    techo = 10 ** (-1 / 20)
    if pico > techo:
        audio = audio * (techo / pico)
    return audio.astype(np.float32)


# ───────────────────────────── Alineación (Whisper) ─────────────────────────────


@dataclass
class Analisis:
    """Lo que Whisper encontró en una frase generada (tiempos relativos al inicio de la frase)."""

    tiempos: list[tuple[float, float]]  # una pareja por palabra del guion
    corte: float  # segundo donde termina la frase (lo de después se descarta)
    proporcion: float  # palabras del guion que Whisper reconoció
    sobrantes: int  # palabras que Whisper oyó después del final del guion (repeticiones)


MARGEN_CORTE = 0.18  # aire tras la última palabra
MIN_EMPATADAS = 0.6  # por debajo, la frase se regenera


class Oido:
    """Whisper cargado en la GPU para analizar frases."""

    def __init__(self, modelo: str = "small"):
        import whisper

        exigir_cuda()
        self.modelo = whisper.load_model(modelo, device="cuda")

    def analizar(self, audio: np.ndarray, sr: int, texto: str) -> Analisis:
        import librosa

        audio16 = librosa.resample(audio, orig_sr=sr, target_sr=16000).astype(np.float32)
        # Sin initial_prompt: con el texto exacto como prompt, Whisper tiende a "darlo por dicho"
        # y alucina otra cosa.
        resultado = self.modelo.transcribe(
            audio16,
            language=IDIOMA,
            word_timestamps=True,
            condition_on_previous_text=False,
            temperature=0.0,
            fp16=True,
        )
        reconocidas = [
            (w["word"].strip(), float(w["start"]), float(w["end"]))
            for s in resultado.get("segments", [])
            for w in s.get("words", [])
            if normalizar(w["word"])
        ]
        return _analizar(texto.split(), reconocidas, len(audio) / sr)

    def cerrar(self) -> None:
        del self.modelo
        liberar_gpu()


def _analizar(fichas: list[str], reconocidas: list[tuple[str, float, float]], duracion: float) -> Analisis:
    """Empata lo oído con el guion, detecta repeticiones al final y decide dónde cortar."""
    guion = [normalizar(f) for f in fichas]
    oido = [normalizar(w) for w, _, _ in reconocidas]
    emp = difflib.SequenceMatcher(a=guion, b=oido, autojunk=False)

    # Palabras oídas DESPUÉS de terminar el guion = repetición o balbuceo: se cortan
    fin_util = len(oido)
    for tag, i1, _, j1, _ in reversed(emp.get_opcodes()):
        if tag == "insert" and i1 == len(guion):
            fin_util = j1
        else:
            break
    sobrantes = len(oido) - fin_util
    if fin_util > 0:
        corte = reconocidas[fin_util - 1][2] + MARGEN_CORTE
        if sobrantes:
            corte = min(corte, reconocidas[fin_util][1] - 0.02)
    else:
        corte = duracion
    corte = min(max(corte, 0.2), duracion)

    tiempos, n = _empatar(fichas, reconocidas[:fin_util], 0.0, corte)
    return Analisis(tiempos, corte, n / len(fichas) if fichas else 1.0, sobrantes)


def _empatar(
    fichas: list[str], reconocidas: list[tuple[str, float, float]], ini: float, fin: float
) -> tuple[list[tuple[float, float]], int]:
    """Asigna tiempos a las fichas del guion a partir de las palabras reconocidas."""
    guion = [normalizar(f) for f in fichas]
    oido = [normalizar(w) for w, _, _ in reconocidas]
    tiempos: list[tuple[float, float] | None] = [None] * len(fichas)
    emp = difflib.SequenceMatcher(a=guion, b=oido, autojunk=False)
    for bloque in emp.get_matching_blocks():
        for k in range(bloque.size):
            _, a, b = reconocidas[bloque.b + k]
            tiempos[bloque.a + k] = (a, b)
    n_empatadas = sum(t is not None for t in tiempos)

    # Rellenar huecos repartiendo el tiempo disponible según la longitud de cada palabra
    i = 0
    while i < len(fichas):
        if tiempos[i] is not None:
            i += 1
            continue
        j = i
        while j < len(fichas) and tiempos[j] is None:
            j += 1
        desde = tiempos[i - 1][1] if i > 0 else ini + 0.04
        hasta = tiempos[j][0] if j < len(fichas) else fin - 0.04
        if hasta <= desde:
            hasta = desde + 0.12 * (j - i)
        pesos = [max(1, len(guion[k])) for k in range(i, j)]
        suma = sum(pesos)
        t = desde
        for k, peso in zip(range(i, j), pesos):
            d = (hasta - desde) * peso / suma
            tiempos[k] = (t, t + d)
            t += d
        i = j

    # Monótonos, con duración mínima y dentro de la frase
    resultado: list[tuple[float, float]] = []
    previo = ini
    for a, b in tiempos:  # type: ignore[misc]
        a = min(max(a, previo), fin)
        b = min(max(b, a + 0.06), max(fin, a + 0.06))
        resultado.append((a, b))
        previo = a
    return resultado, n_empatadas


def recortar(audio: np.ndarray, sr: int, corte: float) -> np.ndarray:
    """Corta la frase en `corte` con un fundido de 30 ms (sin clics)."""
    fin = min(len(audio), int(corte * sr))
    trozo = audio[:fin].copy()
    n = min(len(trozo), int(0.03 * sr))
    if n > 0:
        trozo[-n:] *= np.linspace(1.0, 0.0, n, dtype=np.float32)
    return trozo


# ───────────────────────────── Episodio completo ─────────────────────────────


def huella(texto_guion: str, ajustes: Ajustes, referencia: Path) -> str:
    """Hash de todo lo que influye en la voz: si no cambia, no hace falta regenerar."""
    datos = {
        "guion": texto_guion,
        "ajustes": asdict(ajustes),
        "referencia": hashlib.sha256(referencia.read_bytes()).hexdigest(),
        "cadena": VERSION_CADENA,
        "chatterbox": metadata.version("chatterbox-tts"),
        "whisper": metadata.version("openai-whisper"),
    }
    return hashlib.sha256(json.dumps(datos, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def producir_voz(
    texto_guion: str,
    ajustes: Ajustes,
    referencia: Path = REFERENCIA,
    voz: Voz | None = None,
    avisar=print,
    reintentos: int = 1,
) -> dict:
    """Genera la voz completa y sus tiempos.

    1. Chatterbox genera todas las frases → se libera.
    2. Whisper analiza cada frase (dónde acaba, qué se repitió, qué tan legible es) → se libera.
    3. Las frases ilegibles se regeneran con otra semilla (hasta `reintentos` rondas de 1 y 2).
    4. Se recorta cada frase, se une con sus silencios y se normaliza el volumen.
    Nunca hay dos modelos en la GPU a la vez. Devuelve {"audio", "sr", "tiempos", "resumen"}.
    """
    import torch

    segmentos = leer_guion(texto_guion, ajustes)
    if not segmentos:
        raise ValueError("El guion no tiene texto para leer.")

    fragmentos: list[np.ndarray] = [np.zeros(0, dtype=np.float32)] * len(segmentos)
    analisis: list[Analisis | None] = [None] * len(segmentos)
    pendientes = list(range(len(segmentos)))
    regeneradas: list[int] = []
    vram_tts = vram_whisper = 0.0
    sr = 0

    for ronda in range(reintentos + 1):
        # 1) Síntesis de las frases pendientes
        voz = voz or Voz(referencia)
        sr = voz.sr
        torch.cuda.reset_peak_memory_stats()
        for i in pendientes:
            nota = " (reintento)" if ronda else ""
            avisar(f"  voz {i + 1}/{len(segmentos)}{nota}: {segmentos[i].texto[:60]}")
            fragmentos[i] = voz.decir(segmentos[i].texto, ajustes, i + 1000 * ronda)
        vram_tts = max(vram_tts, vram_usada_gb())
        voz.cerrar()
        voz = None

        # 2) Análisis con Whisper (la GPU ya está libre)
        avisar(f"  analizando {len(pendientes)} frase(s) con Whisper ({ajustes.modelo_whisper})…")
        torch.cuda.reset_peak_memory_stats()
        oido = Oido(ajustes.modelo_whisper)
        try:
            for i in pendientes:
                analisis[i] = oido.analizar(fragmentos[i], sr, segmentos[i].texto)
        finally:
            oido.cerrar()
        vram_whisper = max(vram_whisper, vram_usada_gb())

        # 3) ¿Alguna frase ilegible?
        malas = [i for i in pendientes if analisis[i].proporcion < MIN_EMPATADAS]  # type: ignore[union-attr]
        if not malas or ronda == reintentos:
            break
        avisar(f"  {len(malas)} frase(s) poco legibles, se regeneran: {[i + 1 for i in malas]}")
        regeneradas.extend(malas)
        pendientes = malas

    # 4) Recortar, montar y normalizar
    partes, palabras, tramos, t = [], [], [], 0.0
    for seg, audio, an in zip(segmentos, fragmentos, analisis):
        assert an is not None
        trozo = recortar(audio, sr, an.corte)
        duracion = len(trozo) / sr
        for ficha, (a, b) in zip(seg.texto.split(), an.tiempos):
            palabras.append({"texto": ficha, "inicio": round(t + a, 3), "fin": round(t + min(b, duracion), 3)})
        tramos.append((t, t + duracion))
        silencio = np.zeros(int(round(seg.silencio_despues * sr)), dtype=np.float32)
        partes += [trozo, silencio]
        t += duracion + len(silencio) / sr
    audio = normalizar_volumen(np.concatenate(partes), sr)

    lista = [an for an in analisis if an is not None]
    duracion = len(audio) / sr
    habla = sum(b - a for a, b in tramos)
    proporcion = sum(an.proporcion * len(s.texto.split()) for s, an in zip(segmentos, lista)) / len(palabras)
    tiempos = {
        "palabras": palabras,
        "duracion": round(duracion, 3),
        "meta": {
            "segmentos": [
                {
                    "texto": s.texto,
                    "inicio": round(a, 3),
                    "fin": round(b, 3),
                    "empatadas": round(an.proporcion, 2),
                    "sobrantes": an.sobrantes,
                }
                for s, (a, b), an in zip(segmentos, tramos, lista)
            ],
            "palabras_por_minuto": round(len(palabras) / (duracion / 60), 1),
            "empatadas_whisper": round(proporcion, 3),
        },
    }
    resumen = {
        "duracion_s": round(duracion, 2),
        "palabras": len(palabras),
        "frases": len(segmentos),
        "palabras_por_minuto": tiempos["meta"]["palabras_por_minuto"],
        "palabras_por_minuto_hablando": round(len(palabras) / (habla / 60), 1),
        "empatadas_whisper": f"{proporcion:.0%}",
        "palabras_sobrantes_cortadas": sum(an.sobrantes for an in lista),
        "frases_regeneradas": [i + 1 for i in regeneradas],
        "vram_tts_gb": round(vram_tts, 2),
        "vram_whisper_gb": round(vram_whisper, 2),
    }
    return {"audio": audio, "sr": sr, "tiempos": tiempos, "resumen": resumen}


def guardar(resultado: dict, salida: Path, huella_actual: str | None = None) -> None:
    import soundfile

    salida.mkdir(parents=True, exist_ok=True)
    soundfile.write(salida / "voz.wav", resultado["audio"], resultado["sr"], subtype="PCM_16")
    (salida / "tiempos.json").write_text(json.dumps(resultado["tiempos"], ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    if huella_actual:
        (salida / ".hash_voz").write_text(huella_actual + "\n", encoding="utf-8")


def ajustes_de_episodio(carpeta: Path) -> Ajustes:
    """Ajustes por defecto + semilla y bloque "voz" del config.json del episodio, si existen."""
    ajustes = Ajustes()
    config = carpeta / "config.json"
    if config.exists():
        datos = json.loads(config.read_text(encoding="utf-8"))
        ajustes.semilla = int(datos.get("semilla", 0)) % 2**31
        for clave, valor in (datos.get("voz") or {}).items():
            if hasattr(ajustes, clave):
                setattr(ajustes, clave, type(getattr(ajustes, clave))(valor))
    return ajustes
