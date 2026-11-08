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
  4. Sonido: mezcla.wav = voz + música lo-fi + efectos (video/scripts/sonido.mjs, unos segundos)
  5. Video: docker compose run --rm video npx remotion render <id> …
  6. Deja el MP4 en episodios/<ep>/<ep>.mp4.
  7. Informe (herramientas/informe.py, servicio voz): hoja de contactos y sonoridad en
     episodios/<ep>/stills/; con --stills, los fotogramas de verificación sacados del MP4.
"""

from __future__ import annotations

import argparse
import json
import re
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
DURACION_IMPACTO = 1.6  # DatoImpacto.tsx
COLA_POR_DEFECTO = 1.5  # Root.tsx
FPS = 30


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
    palabras = [normalizar(p["texto"]) for p in tiempos["palabras"]]
    for i in range(len(palabras) - len(buscada) + 1):
        if palabras[i : i + len(buscada)] == buscada:
            return tiempos["palabras"][i]["inicio"]
    return None


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
    for viejo in ep.glob("voz_externa.*"):
        viejo.unlink()
    destino = ep / f"voz_externa{ruta.suffix.lower()}"
    shutil.copy2(ruta, destino)
    avisar(f"Voz externa importada: {ruta.name} → {destino.relative_to(RAIZ).as_posix()}")


def generar_sonido(ep: Path) -> None:
    """mezcla.wav = voz + música lo-fi + efectos (plantilla y episodio). Tarda unos segundos."""
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


def renderizar(ep: Path, tramo: tuple[float, float] | None = None) -> Path:
    titulo("Video" + (f" · tramo {tramo[0]:g}–{tramo[1]:g} s" if tramo else ""))
    if not (ep / "tiempos.json").exists():
        avisar("⚠ No hay tiempos.json: se renderiza sin voz ni subtítulos (15 s). Usa sin --solo-video para generar la voz.")
    salida = ep / (f"{ep.name}.tramo.mp4" if tramo else f"{ep.name}.mp4")
    destino = "../" + ruta_contenedor(salida)  # el servicio video trabaja en /repo/video
    extra = [f"--frames={int(tramo[0] * FPS)}-{int(tramo[1] * FPS) - 1}"] if tramo else []
    if docker("compose", "run", "--rm", "video", "npx", "remotion", "render", id_composicion(ep.name), destino, *extra).returncode != 0:
        fallar("Falló el render (mira el error de arriba).")
    if not salida.exists():
        fallar(f"Remotion terminó pero no aparece {salida}.")
    return salida


def momentos_de_verificacion(ep: Path, config: dict) -> dict[str, int]:
    """Fotogramas para revisar a ojo: portada, subtítulo normal, dato de impacto y panel."""
    tiempos = None
    if (ep / "tiempos.json").exists():
        tiempos = json.loads((ep / "tiempos.json").read_text(encoding="utf-8"))
    momentos: dict[str, float] = {"portada": 0.0}
    duracion = (tiempos["duracion"] + config.get("cola", COLA_POR_DEFECTO)) if tiempos else 15.0

    impactos: list[tuple[float, float]] = []
    for imp in config.get("impactos", []):
        inicio = imp.get("desde")
        if inicio is None and imp.get("ancla"):
            inicio = tiempo_de_ancla(tiempos, imp["ancla"])
        if inicio is not None:
            impactos.append((inicio, inicio + imp.get("duracion", DURACION_IMPACTO)))
    if impactos:
        momentos["impacto"] = impactos[0][0] + 0.4

    # Igual que resolverPanel() en video/src/canal/tiempos.ts
    panel = config.get("panel")
    panel_desde = None
    if panel:
        panel_desde = panel.get("desde")
        if panel_desde is None and panel.get("ancla"):
            panel_desde = tiempo_de_ancla(tiempos, panel["ancla"])
        if panel_desde is None:
            panel_desde = 5.0
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
    return {k: min(int(round(v * FPS)), int(duracion * FPS) - 1) for k, v in momentos.items()}


def informe(ep: Path, config: dict, mp4: Path, stills: bool, medir_pulso: bool, desde: float = 0.0) -> list[Path]:
    """Hoja de contactos + sonoridad (+ stills sacados del MP4, + sincronía) con herramientas/informe.py."""
    titulo("Informe")
    carpeta = ep / "stills"
    momentos = momentos_de_verificacion(ep, config) if stills else {}
    if momentos:
        avisar("  stills: " + ", ".join(f"{n} ({f / FPS:.2f} s)" for n, f in momentos.items()))
    bpm = (config.get("ritmo") or {}).get("bpm", 92)
    orden = ["compose", "run", "--rm", "voz", "python", "herramientas/informe.py", ruta_contenedor(mp4),
             "--carpeta", ruta_contenedor(carpeta), "--bpm", str(bpm), "--desde", str(desde),
             "--hoja", "hoja_tramo.png" if desde or mp4.name.endswith(".tramo.mp4") else "hoja.png"]
    for nombre, frame in momentos.items():
        orden += ["--still", f"{nombre}={frame / FPS:.3f}"]
    if medir_pulso:
        orden.append("--pulso")
    if docker(*orden).returncode != 0:
        avisar("⚠ Falló el informe (el MP4 está bien; mira el error de arriba).")
        return []
    return [carpeta / f"{n}.png" for n in momentos]


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
    mp4 = None
    stills: list[Path] = []
    if not args.solo_voz:
        generar_sonido(ep)
        mp4 = renderizar(ep, tramo)
        # Los stills salen del MP4 completo (segundos); en un tramo no tienen sentido
        stills = informe(ep, config, mp4, args.stills and not tramo, args.pulso, tramo[0] if tramo else 0.0)
    elif args.stills:
        stills = generar_stills(ep, config)

    titulo("Listo")
    if (ep / "tiempos.json").exists():
        t = json.loads((ep / "tiempos.json").read_text(encoding="utf-8"))
        avisar(f"  voz: {t['duracion']:.1f} s · {len(t['palabras'])} palabras")
    if mp4:
        avisar(f"  video: {mp4.relative_to(RAIZ).as_posix()} ({mp4.stat().st_size / 1e6:.1f} MB)")
    for s in stills:
        avisar(f"  still: {s.relative_to(RAIZ).as_posix()}")
    if mp4:
        nombre = "informe_tramo.txt" if tramo else "informe.txt"
        avisar(f"  informe: {(ep / 'stills' / nombre).relative_to(RAIZ).as_posix()} (+ hoja de contactos)")
    avisar(f"  tiempo total: {(time.time() - inicio) / 60:.1f} min")


if __name__ == "__main__":
    main()
