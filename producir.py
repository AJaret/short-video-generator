"""Orquestador del canal: un comando produce el episodio completo.

    python producir.py episodios/nº03-lorenz              # voz + tiempos + render
    python producir.py episodios/nº03-lorenz --solo-voz
    python producir.py episodios/nº03-lorenz --solo-video
    python producir.py episodios/nº03-lorenz --stills     # además, fotogramas de verificación
    python producir.py nº03-lorenz --borrador             # 1 toma de voz por bloque (3× más rápido)
    python producir.py nº03-lorenz --voz-externa toma.mp3 # usar un audio externo (ElevenLabs…) como voz
    python producir.py nº03-lorenz --solo-video --tramo 40-60   # solo ese tramo (s) → <ep>.tramo.mp4
    python producir.py nº03-lorenz --solo-video --pulso   # además, medir la sincronía imagen/música

Se ejecuta en Windows con Python básico (solo librería estándar) y coordina los contenedores:
  1. Comprueba el episodio (guion.md, config.json, Sketch.tsx).
  2. Libera la GPU si la interfaz de voz está abierta.
  3. Voz: docker compose run --rm voz python voz/generar.py …   (se salta si el guion no cambió)
  4. Sonido: mezcla.wav = voz + música misterio con guiño + efectos (video/scripts/sonido.mjs, unos segundos)
  5. Video: docker compose run --rm video npx remotion render <id> …
  6. Deja el MP4 en episodios/<ep>/<ep>.mp4.
  7. Informe (herramientas/informe.py, servicio analisis: la imagen de voz sin GPU): hoja de
     contactos, sonoridad y loop en episodios/<ep>/stills/; con --stills, los fotogramas de
     verificación sacados del MP4.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import tempfile
import shutil
import subprocess
import sys
import time
import unicodedata
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
EPISODIOS = RAIZ / "episodios"

# Constantes compartidas con la plantilla de video (video/src/canal). Si cambian allí, cambian aquí.
DURACION_PORTADA = 2.6  # Portada.tsx
DURACION_IMPACTO = 1.6  # diseno.ts
COLA_POR_DEFECTO = 1.5  # Root.tsx
DURACION_SIN_VOZ = 15.0  # Root.tsx
BPM_POR_DEFECTO = 92  # pulso.ts
FPS = 30
# Entrada de los impactos (DatoImpacto.tsx, cinetica.ts y finImpacto() en tiempos.ts)
ASIENTO_LETRA = 0.1  # lo que tarda cada letra de 'letras' en asentarse
LECTURA_IMPACTO = 0.6  # tiempo mínimo con el texto completo antes de la salida
SALIDA_IMPACTO = 6  # fotogramas del fundido de salida


# ───────────────────────────── Utilidades ─────────────────────────────


def avisar(texto: str) -> None:
    print(texto, flush=True)


def titulo(texto: str) -> None:
    avisar(f"\n── {texto} " + "─" * max(0, 60 - len(texto)))


def fallar(texto: str) -> None:
    print(f"\n✗ {texto}", file=sys.stderr, flush=True)
    sys.exit(1)


def id_composicion(carpeta: str) -> str:
    """Misma regla que video/src/episodios.ts: "nº03-lorenz" → "ep03-lorenz"."""
    return re.sub(r"[^a-zA-Z0-9-]", "", re.sub(r"^nº", "ep", carpeta))


def normalizar(palabra: str) -> str:
    """Misma regla que video/src/canal/tiempos.ts (para encontrar las anclas de impacto)."""
    p = unicodedata.normalize("NFD", palabra.lower())
    p = "".join(c for c in p if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9ñ\s]", "", p).strip()


def tiempo_de_ancla(tiempos: dict | None, ancla: str) -> float | None:
    """Segundo en que la voz empieza a decir `ancla` (igual que tiempoDeAncla en tiempos.ts)."""
    if not tiempos:
        return None
    buscada = normalizar(ancla).split()
    if not buscada:
        return None
    palabras = [normalizar(p["texto"]) for p in tiempos["palabras"]]
    for i in range(len(palabras) - len(buscada) + 1):
        if palabras[i : i + len(buscada)] == buscada:
            return tiempos["palabras"][i]["inicio"]
    return None


def leer_tiempos(ep: Path) -> dict | None:
    ruta = ep / "tiempos.json"
    return json.loads(ruta.read_text(encoding="utf-8")) if ruta.exists() else None


def negra_de(config: dict) -> float:
    """Segundos de una negra con el tempo del episodio (pulsoDe() en pulso.ts)."""
    return 60 / ((config.get("ritmo") or {}).get("bpm") or BPM_POR_DEFECTO)


def cuantizar(t: float, negra: float) -> float:
    """Tiempo de la música más cercano (cuantizar() en pulso.ts). Math.round de JS, no el round()
    de Python, que redondea los .5 al par."""
    return math.floor(t / negra + 0.5) * negra


def fotogramas_totales(tiempos: dict | None, config: dict) -> int:
    """Duración de la composición en fotogramas, igual que calculateMetadata en Root.tsx."""
    segundos = tiempos["duracion"] + config.get("cola", COLA_POR_DEFECTO) if tiempos else DURACION_SIN_VOZ
    return math.ceil(segundos * FPS)


def fin_impacto(imp: dict, inicio: float, negra: float) -> float:
    """Fin real de un impacto (finImpacto() en tiempos.ts): con 'letras' se alarga hasta que la
    última letra se asienta, se lee y sale."""
    fin = inicio + imp.get("duracion", DURACION_IMPACTO)
    if imp.get("entrada", "sello") != "letras":
        return fin
    letras = len(re.sub(r"\s", "", imp.get("texto", "")))
    ultima = inicio + max(0, letras - 1) * negra / 4
    return max(fin, ultima + ASIENTO_LETRA + LECTURA_IMPACTO + SALIDA_IMPACTO / FPS)


def entrada_completa(imp: dict, negra: float) -> float:
    """Segundos desde que entra un impacto hasta que su texto se ve entero (DatoImpacto.tsx)."""
    entrada = imp.get("entrada", "sello")
    if entrada == "barrido":
        return negra + 0.15  # la barra cruza en una negra y la cola termina de destapar
    if entrada == "letras":
        letras = len(re.sub(r"\s", "", imp.get("texto", "")))
        return max(0, letras - 1) * negra / 4 + 0.3  # última letra (semicorcheas) + su rebote
    return 0.4  # sello: el sobretamaño se asienta en 4 fotogramas


def anclas_perdidas(config: dict, tiempos: dict) -> list[str]:
    """Anclas de config.json (texto) que la voz no dice: lo que dependa de ellas no aparecerá
    (impacto, panel) o caerá en su valor por defecto (panel a los 5 s, música sin revelación…)."""
    revisar: list[tuple[str, object]] = []
    for i, imp in enumerate(config.get("impactos", [])):
        if imp.get("desde") is None:
            revisar.append((f"impactos[{i}].ancla", imp.get("ancla")))
    panel = config.get("panel") or {}
    if panel.get("desde") is None and "ancla" in panel:
        revisar.append(("panel.ancla", panel["ancla"]))
    revisar.append(("panel.hasta", panel.get("hasta")))
    audio = config.get("audio") or {}
    revisar += [("audio.revelacion", audio.get("revelacion")), ("audio.remate", audio.get("remate"))]
    revisar += [(f"audio.golpes[{i}]", g) for i, g in enumerate(audio.get("golpes", []))]
    # Solo los textos son anclas: los números son segundos y no hace falta buscarlos
    return [f"{campo} «{valor}»" for campo, valor in revisar
            if isinstance(valor, str) and tiempo_de_ancla(tiempos, valor) is None]


def docker(*args: str, capturar: bool = False) -> subprocess.CompletedProcess:
    """Ejecuta `docker …` desde la raíz del repo. Sin capturar, la salida se ve en vivo."""
    return subprocess.run(
        ["docker", *args],
        cwd=RAIZ,
        text=True,
        encoding="utf-8",
        errors="replace",
        capture_output=capturar,
    )


def ruta_contenedor(ruta: Path) -> str:
    """Ruta relativa a la raíz del repo con barras normales (así la ven los contenedores en /repo)."""
    return ruta.relative_to(RAIZ).as_posix()


# ───────────────────────────── Pasos ─────────────────────────────


def resolver_episodio(entrada: str) -> Path:
    candidato = Path(entrada)
    for ruta in (candidato, RAIZ / candidato, EPISODIOS / candidato):
        if ruta.is_dir():
            ruta = ruta.resolve()
            if ruta.parent != EPISODIOS:
                fallar(f"El episodio debe estar dentro de episodios/: {ruta}")
            return ruta
    fallar(f"No existe el episodio «{entrada}». Episodios disponibles: {', '.join(p.name for p in sorted(EPISODIOS.iterdir()) if p.is_dir())}")
    raise AssertionError


def comprobar_episodio(ep: Path, solo_video: bool, solo_voz: bool) -> dict:
    necesarios = ["config.json"]
    if not solo_video:
        necesarios.append("guion.md")
    if not solo_voz:
        necesarios.append("Sketch.tsx")  # la voz se puede generar antes de escribir el sketch
    faltan = [f for f in necesarios if not (ep / f).exists()]
    if faltan:
        fallar(f"A {ep.name} le faltan: {', '.join(faltan)}")
    try:
        config = json.loads((ep / "config.json").read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        fallar(f"config.json no es JSON válido: {e}")
    for campo in ("numero", "tema", "titulo", "semilla"):
        if campo not in config:
            fallar(f"config.json necesita el campo «{campo}».")
    if len(config.get("impactos", [])) > 3:
        fallar("Máximo 3 datos de impacto por video (config.json → impactos).")
    return config


def comprobar_docker() -> None:
    if not shutil.which("docker"):
        fallar("No encuentro el comando docker. ¿Está Docker Desktop instalado y abierto?")
    if docker("info", "--format", "{{.ServerVersion}}", capturar=True).returncode != 0:
        fallar("Docker no responde. Abre Docker Desktop y espera a «Engine running».")


def liberar_gpu() -> None:
    """La interfaz de voz (docker compose up voz) puede tener un modelo cargado en la GPU."""
    activos = docker("compose", "ps", "--status", "running", "--services", capturar=True).stdout.split()
    if "voz" in activos:
        avisar("La interfaz de voz está abierta y puede ocupar la GPU: se detiene (docker compose stop voz).")
        docker("compose", "stop", "voz", capturar=True)


def generar_voz(ep: Path, forzar: bool, borrador: bool) -> None:
    titulo("Voz")
    args = ["compose", "run", "--rm", "voz", "python", "voz/generar.py",
            "--guion", ruta_contenedor(ep / "guion.md"), "--salida", ruta_contenedor(ep) + "/"]
    if forzar:
        args.append("--forzar")
    if borrador:
        args += ["--tomas", "1"]
    if docker(*args).returncode != 0:
        fallar("Falló la generación de voz (mira el error de arriba).")
    if not (ep / "tiempos.json").exists():
        fallar("generar.py terminó pero no hay tiempos.json.")


FORMATOS_AUDIO = {".mp3", ".wav", ".m4a", ".flac", ".ogg"}


def importar_voz_externa(ep: Path, origen: str) -> None:
    """Copia un audio externo (ElevenLabs, locución real…) al episodio como voz_externa.<ext>.

    Desde ese momento generar.py usa ese audio (solo lo alinea) en lugar de Chatterbox, también en
    las siguientes ejecuciones. Para volver a Chatterbox, borra episodios/<ep>/voz_externa.*.
    """
    ruta = Path(origen).expanduser()
    if not ruta.is_file():
        fallar(f"No existe el audio externo: {ruta}")
    if ruta.suffix.lower() not in FORMATOS_AUDIO:
        fallar(f"Formato no admitido ({ruta.suffix}). Usa uno de: {', '.join(sorted(FORMATOS_AUDIO))}")
    destino = ep / f"voz_externa{ruta.suffix.lower()}"
    if not (destino.exists() and ruta.samefile(destino)):
        with tempfile.NamedTemporaryFile(dir=ep, delete=False) as archivo:
            temporal = Path(archivo.name)
        try:
            shutil.copy2(ruta, temporal)
            temporal.replace(destino)
        finally:
            temporal.unlink(missing_ok=True)
    for viejo in ep.glob("voz_externa.*"):
        if viejo != destino and viejo.suffix.lower() in FORMATOS_AUDIO:
            viejo.unlink()
    avisar(f"Voz externa importada: {ruta.name} → {destino.relative_to(RAIZ).as_posix()}")


def generar_sonido(ep: Path) -> None:
    """mezcla.wav = voz + música misterio con guiño + efectos (plantilla y episodio). Tarda unos segundos."""
    titulo("Sonido")
    if not ((ep / "voz.wav").exists() and (ep / "tiempos.json").exists()):
        avisar("⚠ Sin voz todavía: no hay banda sonora (se renderiza mudo o solo con lo que exista).")
        return
    if docker("compose", "run", "--rm", "video", "node", "scripts/sonido.mjs", ep.name).returncode != 0:
        fallar("Falló la banda sonora (mira el error de arriba).")


def leer_tramo(texto: str) -> tuple[float, float]:
    """"40-60" → (40.0, 60.0) en segundos."""
    m = re.fullmatch(r"\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*", texto)
    if not m or float(m.group(1)) >= float(m.group(2)):
        fallar(f"--tramo debe ser DESDE-HASTA en segundos (p. ej. 40-60), no «{texto}».")
    return float(m.group(1)), float(m.group(2))


def fotogramas_de_tramo(tramo: tuple[float, float], total: int) -> tuple[int, int]:
    """Tramo en segundos → fotogramas [primero, último] dentro de la composición (0 … total − 1).

    Se valida antes de mezclar y empaquetar: Remotion rechaza un rango que pase del final, pero solo
    después de esos pasos. round() y no int(): int(4.1 · 30) da 122 por el error de coma flotante.
    """
    primero, fin = round(tramo[0] * FPS), round(tramo[1] * FPS)
    if primero >= total:
        fallar(f"--tramo empieza en {tramo[0]:g} s, pero el episodio dura {total / FPS:.2f} s ({total} fotogramas).")
    if fin > total:
        avisar(f"⚠ --tramo {tramo[0]:g}-{tramo[1]:g} pasa del final: se recorta a {primero / FPS:g}–{total / FPS:.2f} s.")
        fin = total
    if fin <= primero:
        fallar(f"--tramo {tramo[0]:g}-{tramo[1]:g} no llega a un fotograma (1/{FPS} s).")
    return primero, fin - 1


def renderizar(ep: Path, fotogramas: tuple[int, int] | None = None) -> Path:
    titulo("Video" + (f" · tramo {fotogramas[0] / FPS:g}–{(fotogramas[1] + 1) / FPS:g} s" if fotogramas else ""))
    if not (ep / "tiempos.json").exists():
        avisar("⚠ No hay tiempos.json: se renderiza sin voz ni subtítulos (15 s). Usa sin --solo-video para generar la voz.")
    salida = ep / (f"{ep.name}.tramo.mp4" if fotogramas else f"{ep.name}.mp4")
    destino = "../" + ruta_contenedor(salida)  # el servicio video trabaja en /repo/video
    extra = [f"--frames={fotogramas[0]}-{fotogramas[1]}"] if fotogramas else []
    if docker("compose", "run", "--rm", "video", "npx", "remotion", "render", id_composicion(ep.name), destino, *extra).returncode != 0:
        fallar("Falló el render (mira el error de arriba).")
    if not salida.exists():
        fallar(f"Remotion terminó pero no aparece {salida}.")
    return salida


def momentos_de_verificacion(ep: Path, config: dict) -> dict[str, int]:
    """Fotogramas para revisar a ojo: portada, subtítulo normal, dato de impacto y panel."""
    tiempos = leer_tiempos(ep)
    momentos: dict[str, float] = {"portada": 0.0}
    total = fotogramas_totales(tiempos, config)
    duracion = total / FPS
    negra = negra_de(config)

    # Igual que tramosImpacto() en DatoImpacto.tsx: el ancla se lleva al tiempo de la música más
    # cercano (el sello cae en el pulso) y el fin es el real (finImpacto)
    impactos: list[tuple[float, float]] = []
    for imp in config.get("impactos", []):
        inicio = imp.get("desde")
        if inicio is None and imp.get("ancla"):
            inicio = tiempo_de_ancla(tiempos, imp["ancla"])
        if inicio is not None:
            inicio = cuantizar(inicio, negra)
            impactos.append((inicio, fin_impacto(imp, inicio, negra)))
            if "impacto" not in momentos:
                # Cuando el texto ya se ve entero (antes salía con la barra o las letras a medias),
                # sin pasar del comienzo del fundido de salida
                visto = inicio + entrada_completa(imp, negra)
                momentos["impacto"] = min(visto, impactos[-1][1] - SALIDA_IMPACTO / FPS - 1 / FPS)

    # Igual que resolverPanel() en video/src/canal/tiempos.ts
    panel = config.get("panel")
    panel_desde = None
    if panel:
        panel_desde = panel.get("desde")
        if panel_desde is None and panel.get("ancla"):
            panel_desde = tiempo_de_ancla(tiempos, panel["ancla"])
        if panel_desde is None:
            panel_desde = 5.0
        panel_desde = cuantizar(panel_desde, negra)
    if tiempos:
        def libre(t: float) -> bool:
            sin_impacto = all(not (a - 0.2 <= t <= b + 0.2) for a, b in impactos)
            sin_panel = panel_desde is None or t < panel_desde - 0.2
            return t > DURACION_PORTADA + 0.3 and sin_impacto and sin_panel

        for p in tiempos["palabras"]:
            if libre(p["inicio"] + 0.1):
                momentos["subtitulo"] = p["inicio"] + 0.1
                break
    if panel_desde is not None:
        momentos["panel"] = min(panel_desde + 1.5, duracion - 0.5)
    return {k: min(int(round(v * FPS)), total - 1) for k, v in momentos.items()}


def informe(ep: Path, config: dict, mp4: Path, stills: bool, medir_pulso: bool, desde: float | None = None) -> list[Path] | None:
    """Hoja de contactos + sonoridad + loop (+ stills sacados del MP4, + sincronía) con herramientas/informe.py.

    `desde`: segundo del episodio en que empieza el MP4 si es un tramo (None = episodio completo).
    Corre en el servicio analisis: la imagen de voz sin reserva de GPU, porque no carga modelos.
    Devuelve los stills escritos, o None si el informe falló.
    """
    titulo("Informe")
    carpeta = ep / "stills"
    momentos = momentos_de_verificacion(ep, config) if stills else {}
    if momentos:
        avisar("  stills: " + ", ".join(f"{n} ({f / FPS:.2f} s)" for n, f in momentos.items()))
    bpm = (config.get("ritmo") or {}).get("bpm") or BPM_POR_DEFECTO
    es_tramo = desde is not None
    orden = ["compose", "run", "--rm", "analisis", "python", "herramientas/informe.py", ruta_contenedor(mp4),
             "--carpeta", ruta_contenedor(carpeta), "--bpm", str(bpm), "--desde", f"{desde or 0.0:.6f}",
             *(NOMBRES_TRAMO if es_tramo else NOMBRES_COMPLETO)]
    if es_tramo:
        orden.append("--sin-loop")  # un tramo no tiene ni portada ni final con los que cerrar el loop
    for nombre, frame in momentos.items():
        orden += ["--still", f"{nombre}={frame / FPS:.3f}"]
    if medir_pulso:
        orden.append("--pulso")
    if docker(*orden).returncode != 0:
        avisar("⚠ Falló el informe (el MP4 está bien; mira el error de arriba).")
        return None
    return [carpeta / f"{n}.png" for n in momentos]


# Archivos del informe en episodios/<ep>/stills/: el de un tramo nunca pisa el del episodio completo
NOMBRES_COMPLETO = ["--hoja", "hoja.png", "--informe", "informe.txt"]
NOMBRES_TRAMO = ["--hoja", "hoja_tramo.png", "--informe", "informe_tramo.txt"]


def generar_stills(ep: Path, config: dict) -> list[Path]:
    """Stills renderizados con Remotion (solo cuando no hay MP4 completo del que sacarlos)."""
    titulo("Fotogramas de verificación")
    carpeta = ep / "stills"
    carpeta.mkdir(exist_ok=True)
    momentos = momentos_de_verificacion(ep, config)
    ident = id_composicion(ep.name)
    ordenes = [
        f'npx remotion still {ident} "../{ruta_contenedor(carpeta)}/{nombre}.png" --frame={frame}'
        for nombre, frame in momentos.items()
    ]
    avisar("  " + ", ".join(f"{n} (fotograma {f})" for n, f in momentos.items()))
    if docker("compose", "run", "--rm", "video", "sh", "-c", " && ".join(ordenes)).returncode != 0:
        fallar("Falló la generación de fotogramas.")
    return [carpeta / f"{n}.png" for n in momentos]


# ───────────────────────────── Principal ─────────────────────────────


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")

    p = argparse.ArgumentParser(description="Produce un episodio del canal: voz + tiempos + MP4.")
    p.add_argument("episodio", help="carpeta del episodio (episodios/nº03-lorenz o nº03-lorenz)")
    modo = p.add_mutually_exclusive_group()
    modo.add_argument("--solo-voz", action="store_true", help="solo voz.wav y tiempos.json")
    modo.add_argument("--solo-video", action="store_true", help="solo el render (usa la voz que ya exista)")
    p.add_argument("--forzar-voz", action="store_true", help="regenerar la voz aunque el guion no haya cambiado")
    p.add_argument("--borrador", action="store_true", help="1 toma de voz por bloque en vez de 3 (más rápido)")
    p.add_argument("--stills", action="store_true", help="renderizar también los fotogramas de verificación")
    p.add_argument("--voz-externa", metavar="AUDIO", help="usar este audio (p. ej. un MP3 de ElevenLabs) como voz del episodio")
    p.add_argument("--tramo", metavar="DESDE-HASTA", help="renderizar solo ese tramo, en segundos (p. ej. 40-60), a <ep>.tramo.mp4")
    p.add_argument("--pulso", action="store_true", help="en el informe, medir también la sincronía imagen/música (~1 min)")
    args = p.parse_args()
    tramo = leer_tramo(args.tramo) if args.tramo else None
    if args.voz_externa and args.solo_video:
        fallar("--voz-externa necesita el paso de voz: no se puede combinar con --solo-video.")

    ep = resolver_episodio(args.episodio)
    config = comprobar_episodio(ep, args.solo_video, args.solo_voz)
    comprobar_docker()
    avisar(f"Episodio {ep.name} · composición {id_composicion(ep.name)} · «{config['titulo']}»")
    inicio = time.time()

    if args.voz_externa:
        importar_voz_externa(ep, args.voz_externa)
    elif any(ep.glob("voz_externa.*")):
        avisar("El episodio usa una voz externa (voz_externa.*): no se genera con Chatterbox.")
    if not args.solo_video:
        liberar_gpu()
        generar_voz(ep, args.forzar_voz, args.borrador)
    tiempos = leer_tiempos(ep)
    if tiempos:
        perdidas = anclas_perdidas(config, tiempos)
        if perdidas:
            titulo("Anclas")
            for a in perdidas:
                avisar(f"⚠ ANCLA NO ENCONTRADA en tiempos.json: {a}. Lo que dependa de ella no saldrá donde esperas.")
    # Antes de mezclar y empaquetar: un tramo fuera del episodio fallaría en Remotion, ya tarde
    fotogramas = fotogramas_de_tramo(tramo, fotogramas_totales(tiempos, config)) if tramo else None
    mp4 = None
    stills: list[Path] = []
    informe_ok = True
    if args.solo_voz:
        # mezcla.wav lleva la voz: si se queda la vieja, Remotion Studio reproduce la voz anterior
        # con los subtítulos y anclas de la nueva
        generar_sonido(ep)
        if args.stills:
            stills = generar_stills(ep, config)
    else:
        generar_sonido(ep)
        mp4 = renderizar(ep, fotogramas)
        # Los stills salen del MP4 completo (segundos); en un tramo no tienen sentido
        desde = fotogramas[0] / FPS if fotogramas else None  # el de verdad, ya en fotogramas
        resultado = informe(ep, config, mp4, args.stills and not tramo, args.pulso, desde)
        informe_ok = resultado is not None
        stills = resultado or []

    titulo("Listo")
    if tiempos:
        avisar(f"  voz: {tiempos['duracion']:.1f} s · {len(tiempos['palabras'])} palabras")
    if mp4:
        avisar(f"  video: {mp4.relative_to(RAIZ).as_posix()} ({mp4.stat().st_size / 1e6:.1f} MB)")
    for s in stills:
        avisar(f"  still: {s.relative_to(RAIZ).as_posix()}")
    if mp4 and informe_ok:
        nombres = NOMBRES_TRAMO if tramo else NOMBRES_COMPLETO
        carpeta = (ep / "stills").relative_to(RAIZ).as_posix()
        avisar(f"  informe: {carpeta}/{nombres[3]} (+ hoja de contactos {carpeta}/{nombres[1]})")
    avisar(f"  tiempo total: {(time.time() - inicio) / 60:.1f} min")
    if not informe_ok:
        # Los archivos de stills/ son de una pasada anterior: no se anuncian. El MP4 sí es nuevo.
        print("\n✗ El informe falló: el MP4 es nuevo, pero el informe, la hoja y los stills de stills/ son de "
              "una pasada anterior (o no existen). Código de salida 2.", file=sys.stderr, flush=True)
        sys.exit(2)


if __name__ == "__main__":
    main()
