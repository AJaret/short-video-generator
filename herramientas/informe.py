"""Informe de un MP4 del canal: stills, hoja de contactos, sonoridad y (opcional) sincronía con el pulso.

Lo llama producir.py después de cada render; corre en el servicio `voz`, que tiene ffmpeg completo,
numpy, PIL, pyloudnorm y librosa (el ffmpeg de Remotion viene recortado, sin filtros de análisis):

    docker compose run --rm voz python herramientas/informe.py episodios/<ep>/<ep>.mp4 \\
        --carpeta episodios/<ep>/stills --still portada=0 --still panel=16.2 --hoja hoja.png --bpm 92 --pulso

Escribe en --carpeta los stills (PNG a tamaño completo), la hoja de contactos (24 fotogramas
repartidos con su segundo) e informe.txt con lo mismo que imprime.
"""

from __future__ import annotations

import argparse
import subprocess
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

INICIO = 2.6  # salida de la portada: la sincronía se mide después
FPS = 30


def fotograma(mp4: str, t: float, escala: tuple[int, int] | None = None) -> Image.Image:
    """Fotograma en el segundo t (búsqueda exacta: -ss antes de -i descodifica hasta ese punto)."""
    filtro = ["-vf", f"scale={escala[0]}:{escala[1]}"] if escala else []
    png = subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-ss", f"{t:.3f}", "-i", mp4, "-frames:v", "1", *filtro, "-f", "image2pipe", "-vcodec", "png", "-"],
        capture_output=True,
        check=True,
    ).stdout
    return Image.open(BytesIO(png)).convert("RGB")


def duracion_de(mp4: str) -> float:
    salida = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", mp4],
        capture_output=True, text=True, check=True,
    ).stdout
    return float(salida.strip())


def hoja(mp4: str, destino: Path, n: int = 24, columnas: int = 6, desde: float = 0.0) -> list[float]:
    """Hoja de contactos con n fotogramas repartidos por todo el video, cada uno con su segundo."""
    dur = duracion_de(mp4)
    W, H = 270, 480
    momentos = [(i + 0.5) * dur / n for i in range(n)]
    filas = (n + columnas - 1) // columnas
    lienzo = Image.new("RGB", (columnas * W, filas * (H + 24)), (40, 40, 40))
    d = ImageDraw.Draw(lienzo)
    for i, t in enumerate(momentos):
        x, y = (i % columnas) * W, (i // columnas) * (H + 24)
        lienzo.paste(fotograma(mp4, t, (W, H)), (x, y + 24))
        d.text((x + 6, y + 6), f"{desde + t:.2f} s", fill=(255, 255, 255))
    lienzo.save(destino)
    return [desde + t for t in momentos]


def sonoridad(wav: str) -> list[str]:
    import pyloudnorm as pyln
    import soundfile as sf

    a, sr = sf.read(wav, dtype="float32")
    lufs = pyln.Meter(sr).integrated_loudness(a)
    pico = 20 * np.log10(max(1e-9, float(np.abs(a).max())))
    # True peak (BS.1770, con sobremuestreo) con ebur128 de ffmpeg
    texto = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", wav, "-af", "ebur128=peak=true", "-f", "null", "-"],
        capture_output=True, text=True,
    ).stderr
    tp = next((l.split(":")[1].strip() for l in reversed(texto.splitlines()) if l.strip().startswith("Peak:")), "?")
    return [f"audio: {len(a) / sr:.2f} s · {lufs:.1f} LUFS (objetivo −14) · pico {pico:.2f} dBFS · true peak {tp}"]


def desfase(ts: np.ndarray, rejilla: float) -> np.ndarray:
    d = (ts / rejilla) - np.round(ts / rejilla)
    return np.abs(d * rejilla)


def pulso(mp4: str, wav: str, bpm: float) -> list[str]:
    """¿Laten juntas la música y la imagen? Ataques de audio y picos de cambio visual frente a la rejilla."""
    import librosa
    import soundfile as sf

    negra = 60 / bpm
    a, sr = sf.read(wav, dtype="float32")
    y = a.mean(1) if a.ndim > 1 else a
    _, perc = librosa.effects.hpss(y)
    ataques = librosa.onset.onset_detect(y=perc, sr=sr, units="time", backtrack=False)
    ataques = ataques[ataques > INICIO]
    da = desfase(ataques, negra / 4)
    lineas = [f"ataques de audio en la rejilla de semicorcheas: {np.mean(da < 0.035):.0%} a < 35 ms (la voz también genera ataques)"]

    w, h = 108, 192
    crudo = subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", mp4, "-vf", f"scale={w}:{h}", "-f", "rawvideo", "-pix_fmt", "gray", "-"],
        capture_output=True, check=True,
    ).stdout
    fotos = np.frombuffer(crudo, np.uint8).reshape(-1, h, w).astype(np.float32)
    dif = np.abs(np.diff(fotos, axis=0)).mean(axis=(1, 2))
    t_dif = (np.arange(len(dif)) + 1) / FPS
    # Picos fuertes: cambios claramente mayores que su vecindario (golpes, cortes, sellos, saltos)
    picos = []
    for i in range(2, len(dif) - 2):
        if t_dif[i] <= INICIO + 0.05:
            continue
        vecinos = np.r_[dif[i - 2:i], dif[i + 1:i + 3]]
        if dif[i] > 1.8 * np.median(vecinos) and dif[i] > max(np.percentile(dif, 60), 1.0) and dif[i] == dif[i - 2:i + 3].max():
            picos.append(t_dif[i])
    p = np.array(picos)
    if len(p):
        lineas.append(
            f"picos visuales fuertes: {len(p)} · a ≤ 2 fotogramas de un tiempo: {np.mean(desfase(p, negra) <= 0.067):.0%}"
            f" · de una semicorchea: {np.mean(desfase(p, negra / 4) <= 0.067):.0%}"
        )
        fuera = [t for t in p if desfase(np.array([t]), negra / 4)[0] > 0.067]
        if fuera:
            lineas.append("  fuera de la rejilla (s): " + " ".join(f"{t:.2f}" for t in fuera[:12]))
    return lineas


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("mp4")
    ap.add_argument("--carpeta", required=True, help="dónde dejar stills, hoja e informe.txt")
    ap.add_argument("--still", action="append", default=[], metavar="NOMBRE=SEGUNDO")
    ap.add_argument("--hoja", default="hoja.png", help="nombre de la hoja de contactos")
    ap.add_argument("--desde", type=float, default=0.0, help="segundo del episodio en que empieza el MP4 (tramos)")
    ap.add_argument("--bpm", type=float, default=92)
    ap.add_argument("--pulso", action="store_true", help="medir también la sincronía imagen/música (~1 min)")
    args = ap.parse_args()

    carpeta = Path(args.carpeta)
    carpeta.mkdir(parents=True, exist_ok=True)
    lineas: list[str] = []
    for item in args.still:
        nombre, seg = item.split("=")
        fotograma(args.mp4, float(seg)).save(carpeta / f"{nombre}.png")
        lineas.append(f"still {nombre}: {float(seg):.2f} s")
    hoja(args.mp4, carpeta / args.hoja, desde=args.desde)
    lineas.append(f"hoja de contactos: {(carpeta / args.hoja).as_posix()}")

    wav = "/tmp/informe.wav"
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", args.mp4, "-vn", "-ar", "48000", wav], check=True)
    lineas += sonoridad(wav)
    if args.pulso:
        lineas += pulso(args.mp4, wav, args.bpm)

    texto = "\n".join(lineas)
    print(texto)
    (carpeta / ("informe.txt" if args.desde == 0 else "informe_tramo.txt")).write_text(texto + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
