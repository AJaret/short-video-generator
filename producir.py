"""Orquestador del canal: un comando produce el episodio completo.

    python producir.py episodios/nº03-lorenz              # voz + tiempos + render
    python producir.py episodios/nº03-lorenz --solo-voz
    python producir.py episodios/nº03-lorenz --solo-video
    python producir.py episodios/nº03-lorenz --stills     # además, fotogramas de verificación
    python producir.py nº03-lorenz --borrador             # 1 toma de voz por bloque (3× más rápido)

Se ejecuta en Windows con Python básico (solo librería estándar) y coordina los contenedores:
  1. Comprueba el episodio (guion.md, config.json, Sketch.tsx).
  2. Libera la GPU si la interfaz de voz está abierta.
  3. Voz: docker compose run --rm voz python voz/generar.py …   (se salta si el guion no cambió)
  4. Video: docker compose run --rm video npx remotion render <id> …
  5. Deja el MP4 en episodios/<ep>/<ep>.mp4.
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


def renderizar(ep: Path) -> Path:
    titulo("Video")
    if not (ep / "tiempos.json").exists():
        avisar("⚠ No hay tiempos.json: se renderiza sin voz ni subtítulos (15 s). Usa sin --solo-video para generar la voz.")
    salida = ep / f"{ep.name}.mp4"
    destino = "../" + ruta_contenedor(salida)  # el servicio video trabaja en /repo/video
    if docker("compose", "run", "--rm", "video", "npx", "remotion", "render", id_composicion(ep.name), destino).returncode != 0:
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


def generar_stills(ep: Path, config: dict) -> list[Path]:
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
    args = p.parse_args()

    ep = resolver_episodio(args.episodio)
    config = comprobar_episodio(ep, args.solo_video, args.solo_voz)
    comprobar_docker()
    avisar(f"Episodio {ep.name} · composición {id_composicion(ep.name)} · «{config['titulo']}»")
    inicio = time.time()

    if not args.solo_video:
        liberar_gpu()
        generar_voz(ep, args.forzar_voz, args.borrador)
    mp4 = None
    if not args.solo_voz:
        mp4 = renderizar(ep)
    stills = generar_stills(ep, config) if args.stills else []

    titulo("Listo")
    if (ep / "tiempos.json").exists():
        t = json.loads((ep / "tiempos.json").read_text(encoding="utf-8"))
        avisar(f"  voz: {t['duracion']:.1f} s · {len(t['palabras'])} palabras")
    if mp4:
        avisar(f"  video: {mp4.relative_to(RAIZ).as_posix()} ({mp4.stat().st_size / 1e6:.1f} MB)")
    for s in stills:
        avisar(f"  still: {s.relative_to(RAIZ).as_posix()}")
    avisar(f"  tiempo total: {(time.time() - inicio) / 60:.1f} min")


if __name__ == "__main__":
    main()
