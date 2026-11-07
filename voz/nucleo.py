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
VERSION_CADENA = "5"
LUFS_OBJETIVO = -16.0


@dataclass
class Ajustes:
    """Parámetros de la voz. Los valores por defecto buscan el tono de documental nocturno."""

    exageracion: float = 0.8  # emoción: 0.25 sobria … 1.0 teatral
    cfg: float = 0.5  # más bajo = ritmo más pausado
    temperatura: float = 0.8  # más alta = más variación, pero articula peor (>0.9: "gida", microcortes)
    tomas: int = 3  # tomas por bloque; se queda la mejor (ver puntuar_toma)
    min_p: float = 0.05  # descarta tokens de sonido improbables (más alto = menos artefactos)
    top_p: float = 1.0
    semilla: int = 0
    compuerta_db: float = -18.0  # atenuación de respiraciones y murmullos entre palabras (0 = sin puerta)
    pausa_frase: float = 0.25  # solo cuando un bloque muy largo se parte en dos
    pausa: float = 0.45  # [pausa]
    pausa_larga: float = 0.90  # [pausa larga]
    pausa_parrafo: float = 0.50  # entre párrafos
    tono_sala_db: float = -66.0  # ruido de fondo en los silencios (0 = silencio digital)
    modelo_whisper: str = "small"


@dataclass
class Segmento:
    """Un bloque de texto que se genera de una vez (una o varias frases) y el silencio de después.

    Generar varias frases juntas deja que el modelo ponga la entonación y las pausas entre ellas:
    generarlas por separado suena a frases sueltas pegadas (robótico).
    """

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


def _agrupar(frases: list[str]) -> list[str]:
    """Junta frases consecutivas en bloques de hasta _MAX_CARACTERES."""
    bloques: list[str] = []
    for frase in frases:
        if bloques and len(bloques[-1]) + 1 + len(frase) <= _MAX_CARACTERES:
            bloques[-1] = f"{bloques[-1]} {frase}"
        else:
            bloques.append(frase)
    return bloques


def leer_guion(texto: str, ajustes: Ajustes) -> list[Segmento]:
    """Convierte el guion en bloques con su silencio posterior.

    - Se ignoran los títulos (# …) y las indicaciones [Animación: …] (no se leen).
    - Un bloque es todo el texto entre dos marcas de pausa o cambios de párrafo.
    - [pausa] y [pausa larga] se convierten en silencios de duración fija.
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
            frases = _agrupar([p for f in frases for p in _partir_largas(f)])
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
        """Genera un bloque. Solo se recorta el silencio del INICIO (con 40 ms de aire).

        La cola no se toca aquí: dónde acaba de verdad la voz se decide después, midiendo la
        energía (ver fin_natural), para no comerse la caída de la última sílaba.
        """
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
                min_p=ajustes.min_p,
                top_p=ajustes.top_p,
            )
        audio = wav.squeeze(0).detach().cpu().numpy().astype(np.float32)
        _, (inicio, _) = librosa.effects.trim(audio, top_db=50)
        inicio = max(0, inicio - int(0.04 * self.sr))
        return audio[inicio:]

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


MIN_EMPATADAS = 0.6  # por debajo, el bloque se regenera
CAIDA_DB = 30.0  # la voz "terminó" cuando cae esto por debajo de su nivel
SILENCIO_MIN = 0.12  # … durante al menos este tiempo
EXTENSION_MAX = 0.45  # máximo que se alarga la cola tras el final que marca Whisper
AIRE_FINAL = 0.06  # aire que se deja tras el final real
FUNDIDO_SALIDA = 0.08
FUNDIDO_ENTRADA = 0.01


def _db(x: np.ndarray) -> float:
    return 20 * float(np.log10(np.sqrt(np.mean(x**2)) + 1e-9)) if len(x) else -180.0


def fin_natural(audio: np.ndarray, sr: int, desde: float, limite: float) -> float:
    """Dónde se apaga de verdad la voz después de `desde` (final aproximado según Whisper).

    Whisper suele marcar el fin de la última palabra antes de tiempo: si se corta ahí, se pierde
    la caída de la voz. Aquí se sigue la energía en ventanas de 10 ms hasta que cae CAIDA_DB por
    debajo del nivel de la voz y se queda así SILENCIO_MIN. Nunca pasa de `limite` (inicio de
    una repetición) ni se alarga más de EXTENSION_MAX (respiraciones y ruidos del modelo).
    """
    limite = min(limite, desde + EXTENSION_MAX, len(audio) / sr)
    i0, i1 = int(desde * sr), int(limite * sr)
    if i1 <= i0:
        return limite
    nivel = _db(audio[max(0, i0 - int(0.5 * sr)) : i0])
    umbral = nivel - CAIDA_DB
    marco = max(1, int(0.01 * sr))
    necesarios = int(SILENCIO_MIN / 0.01)
    seguidos = 0
    for k in range(i0, i1, marco):
        if _db(audio[k : k + marco]) < umbral:
            seguidos += 1
            if seguidos >= necesarios:
                inicio_silencio = k - (necesarios - 1) * marco
                return min(inicio_silencio / sr + AIRE_FINAL, limite)
        else:
            seguidos = 0
    return limite


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
        return _analizar(texto.split(), reconocidas, audio, sr)

    def cerrar(self) -> None:
        del self.modelo
        liberar_gpu()


def _analizar(fichas: list[str], reconocidas: list[tuple[str, float, float]], audio: np.ndarray, sr: int) -> Analisis:
    """Empata lo oído con el guion, detecta repeticiones al final y decide dónde cortar."""
    duracion = len(audio) / sr
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
        limite = reconocidas[fin_util][1] - 0.02 if sobrantes else duracion
        corte = fin_natural(audio, sr, reconocidas[fin_util - 1][2], limite)
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
    """Corta el bloque en `corte`: fundido de entrada de 10 ms y de salida de 80 ms (sin clics).

    El fundido de salida cae sobre el aire que deja fin_natural, no sobre la voz.
    """
    fin = min(len(audio), int(corte * sr))
    trozo = audio[:fin].copy()
    entrada = min(int(FUNDIDO_ENTRADA * sr), len(trozo))
    salida = min(int(FUNDIDO_SALIDA * sr), len(trozo))
    if entrada > 0:
        trozo[:entrada] *= np.linspace(0.0, 1.0, entrada, dtype=np.float32)
    if salida > 0:
        trozo[-salida:] *= np.linspace(1.0, 0.0, salida, dtype=np.float32) ** 2
    return trozo


def atenuar_huecos(audio: np.ndarray, sr: int, tiempos: list[tuple[float, float]], compuerta_db: float) -> np.ndarray:
    """Puerta de ruido: baja `compuerta_db` lo que no es voz (respiraciones, murmullos, chasquidos).

    Se considera voz: cada palabra según Whisper (−50 ms / +150 ms, porque Whisper marca el final
    antes de tiempo) y, por seguridad, cualquier zona con energía a menos de 22 dB del nivel de la
    voz (por si Whisper ubicó mal una palabra). La ganancia cambia con rampas de 40 ms.
    """
    if compuerta_db >= 0 or len(audio) == 0:
        return audio
    marco = max(1, int(0.01 * sr))
    n = int(np.ceil(len(audio) / marco))
    abierta = np.zeros(n, dtype=bool)
    for a, b in tiempos:
        abierta[max(0, int((a - 0.05) / 0.01)) : min(n, int((b + 0.15) / 0.01) + 1)] = True
    energia = np.array([_db(audio[i * marco : (i + 1) * marco]) for i in range(n)])
    nivel = np.percentile(energia, 90)
    abierta |= energia > nivel - 22
    ganancia = np.where(abierta, 1.0, 10 ** (compuerta_db / 20))
    # Suavizado: media móvil de 40 ms para que la puerta no "chasquee"
    ventana = 4
    ganancia = np.convolve(np.pad(ganancia, ventana, mode="edge"), np.ones(ventana) / ventana, mode="same")[ventana:-ventana]
    por_muestra = np.repeat(ganancia, marco)[: len(audio)]
    return (audio * por_muestra).astype(np.float32)


def microcortes(audio: np.ndarray, sr: int, tiempos: list[tuple[float, float]]) -> int:
    """Caídas bruscas de energía (>18 dB durante 20–60 ms) DENTRO de las palabras.

    Son los "saltos" que hacen sonar la voz entrecortada (más frecuentes con temperatura alta).
    """
    marco = max(1, sr // 100)
    cuenta = 0
    for a, b in tiempos:
        e = np.array([_db(audio[i : i + marco]) for i in range(int(a * sr), int(b * sr), marco)])
        if len(e) < 5:
            continue
        bajo = e < np.percentile(e, 75) - 18
        k = 1
        while k < len(e) - 1:
            if bajo[k] and not bajo[k - 1]:
                j = k
                while j < len(e) and bajo[j]:
                    j += 1
                if 2 <= j - k <= 6 and j < len(e):
                    cuenta += 1
                k = j
            k += 1
    return cuenta


def cierre_semitonos(audio: np.ndarray, sr: int, fin: float) -> float:
    """Cómo se mueve el tono en los últimos ~350 ms antes de `fin` (semitonos; <0 baja, >0 sube)."""
    import librosa

    trozo = audio[int(max(0.0, fin - 0.35) * sr) : int((fin + 0.05) * sr)]
    if len(trozo) < sr // 10:
        return float("nan")
    f0, sonoro, _ = librosa.pyin(trozo, fmin=110, fmax=400, sr=sr, frame_length=1024, hop_length=120)
    f0 = f0[sonoro]
    if len(f0) < 4:
        return float("nan")
    tercio = max(1, len(f0) // 3)
    return float(12 * np.log2(np.median(f0[-tercio:]) / np.median(f0[:tercio])))


def puntuar_toma(audio: np.ndarray, sr: int, an: "Analisis", texto: str) -> float:
    """Nota de una toma: más alta = mejor. Sirve para elegir entre varias tomas del mismo bloque.

    + palabras del guion que Whisper entiende (nitidez / articulación): lo que más pesa
    − microcortes dentro de las palabras (voz entrecortada). Peso bajo: las oclusivas (p, t, k)
      también hacen silencios cortos, así que la cuenta tiene ruido
    − palabras sobrantes al final (repeticiones)
    − cierre que SUBE en un bloque que termina en punto o exclamación (suena a frase sin terminar)
    """
    nota = 200 * an.proporcion - 1.5 * microcortes(audio, sr, an.tiempos) - 10 * an.sobrantes
    if texto.rstrip().endswith((".", "!", "…")) and an.tiempos:
        cierre = cierre_semitonos(audio, sr, an.tiempos[-1][1])
        if np.isfinite(cierre) and cierre > 1.5:
            nota -= 15
    return nota


def limpiar_bloque(audio: np.ndarray, sr: int, an: "Analisis", ajustes: Ajustes) -> np.ndarray:
    """Puerta de ruido entre palabras + corte del final natural con fundidos."""
    return recortar(atenuar_huecos(audio, sr, an.tiempos, ajustes.compuerta_db), sr, an.corte)


def tono_de_sala(n: int, sr: int, db: float, semilla: int) -> np.ndarray:
    """Ruido de fondo muy suave y determinista (rosa aproximado), para que los silencios no sean
    "vacío digital": el oído nota mucho el salto de la voz a cero absoluto."""
    if db >= 0 or n <= 0:
        return np.zeros(n, dtype=np.float32)
    from scipy.signal import lfilter

    blanco = np.random.default_rng(semilla).standard_normal(n)
    # Filtro de un polo: quita el siseo agudo del ruido blanco
    rosa = lfilter([0.03], [1.0, -0.97], blanco)
    rosa /= np.sqrt(np.mean(rosa**2)) + 1e-9
    return (rosa * (10 ** (db / 20))).astype(np.float32)


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

    1. Chatterbox genera `ajustes.tomas` tomas de cada bloque (semillas distintas) → se libera.
    2. Whisper analiza cada toma y se elige la mejor por bloque (ver puntuar_toma) → se libera.
    3. Si la mejor toma de un bloque sigue siendo ilegible, se repite el ciclo para ese bloque.
    4. Se limpia cada bloque, se une con sus silencios y se normaliza el volumen.
    Nunca hay dos modelos en la GPU a la vez. Devuelve {"audio", "sr", "tiempos", "resumen"}.
    """
    import torch

    segmentos = leer_guion(texto_guion, ajustes)
    if not segmentos:
        raise ValueError("El guion no tiene texto para leer.")

    tomas = max(1, ajustes.tomas)
    fragmentos: list[np.ndarray] = [np.zeros(0, dtype=np.float32)] * len(segmentos)
    analisis: list[Analisis | None] = [None] * len(segmentos)
    puntos: list[float] = [-1e9] * len(segmentos)
    pendientes = list(range(len(segmentos)))
    regeneradas: list[int] = []
    vram_tts = vram_whisper = 0.0
    sr = 0

    for ronda in range(reintentos + 1):
        # 1) Síntesis: varias tomas de cada bloque pendiente
        voz = voz or Voz(referencia)
        sr = voz.sr
        torch.cuda.reset_peak_memory_stats()
        crudas: dict[tuple[int, int], np.ndarray] = {}
        for i in pendientes:
            nota = " (reintento)" if ronda else ""
            avisar(f"  voz {i + 1}/{len(segmentos)}{nota} · {tomas} toma(s): {segmentos[i].texto[:60]}")
            for k in range(tomas):
                crudas[(i, k)] = voz.decir(segmentos[i].texto, ajustes, i + 100 * k + 1000 * ronda)
        vram_tts = max(vram_tts, vram_usada_gb())
        voz.cerrar()
        voz = None

        # 2) Whisper analiza todas las tomas y se queda con la mejor de cada bloque
        avisar(f"  analizando {len(crudas)} toma(s) con Whisper ({ajustes.modelo_whisper})…")
        torch.cuda.reset_peak_memory_stats()
        oido = Oido(ajustes.modelo_whisper)
        try:
            for (i, k), audio in crudas.items():
                an = oido.analizar(audio, sr, segmentos[i].texto)
                p = puntuar_toma(audio, sr, an, segmentos[i].texto)
                if p > puntos[i]:
                    fragmentos[i], analisis[i], puntos[i] = audio, an, p
        finally:
            oido.cerrar()
        vram_whisper = max(vram_whisper, vram_usada_gb())

        # 3) ¿Algún bloque sigue ilegible incluso en su mejor toma?
        malas = [i for i in pendientes if analisis[i].proporcion < MIN_EMPATADAS]  # type: ignore[union-attr]
        if not malas or ronda == reintentos:
            break
        avisar(f"  {len(malas)} bloque(s) poco legibles, se regeneran: {[i + 1 for i in malas]}")
        regeneradas.extend(malas)
        pendientes = malas

    # 4) Recortar, montar y normalizar
    partes, palabras, tramos, t = [], [], [], 0.0
    for seg, audio, an in zip(segmentos, fragmentos, analisis):
        assert an is not None
        trozo = limpiar_bloque(audio, sr, an, ajustes)
        duracion = len(trozo) / sr
        for ficha, (a, b) in zip(seg.texto.split(), an.tiempos):
            palabras.append({"texto": ficha, "inicio": round(t + a, 3), "fin": round(t + min(b, duracion), 3)})
        tramos.append((t, t + duracion))
        silencio = np.zeros(int(round(seg.silencio_despues * sr)), dtype=np.float32)
        partes += [trozo, silencio]
        t += duracion + len(silencio) / sr
    audio = normalizar_volumen(np.concatenate(partes), sr)
    # Tono de sala bajo toda la pista (después de normalizar, para que su nivel sea el pedido)
    audio = audio + tono_de_sala(len(audio), sr, ajustes.tono_sala_db, ajustes.semilla)

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
                    "puntuacion": round(p, 1),
                }
                for s, (a, b), an, p in zip(segmentos, tramos, lista, puntos)
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
        "tomas_por_bloque": tomas,
        "puntuacion_media": round(float(np.mean(puntos)), 1),
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
