"""Informe de un MP4 del canal: stills, hoja de contactos, sonoridad y (opcional) sincronía con el pulso.

Lo llama producir.py después de cada render; corre en el servicio `analisis` (la imagen de voz, con
ffmpeg completo, numpy, PIL, pyloudnorm y librosa, pero sin reservar la GPU; el ffmpeg de Remotion
viene recortado, sin filtros de análisis):

    docker compose run --rm analisis python herramientas/informe.py episodios/<ep>/<ep>.mp4 \\
        --carpeta episodios/<ep>/stills --still portada=0 --still panel=16.2 --hoja hoja.png --bpm 92 --pulso

Escribe en --carpeta los stills (PNG a tamaño completo), la hoja de contactos (24 fotogramas
repartidos con su segundo) y el informe (--informe, informe.txt por defecto) con lo mismo que imprime.
En un video completo comprueba también el loop: el último fotograma debe coincidir con el primero.
Siempre mide el dinamismo: avisa si la imagen se queda casi quieta más de 4 s seguidos.
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

# Loop: % de píxeles (a 270×480) que cambian más de UMBRAL_PIXEL entre el primer y el último fotograma.
# Hasta nº03 el primer fotograma llevaba encima el título de la portada y el último no: con loops
# correctos eso daba un 7 %; en nº00, que no hace loop, un 28 %. Desde nº04 el título entra después del
# fotograma 0 y un loop correcto da ~0 %.
UMBRAL_PIXEL = 48  # de 255, en el canal que más cambia: deja fuera el grano y el temblor del registro
UMBRAL_LOOP = 0.15

# Dinamismo (2026-11-08, tras comparar con los reels de referencia): cambio medio entre fotogramas a
# 96×96 en gris. Calibrado en nº04: una imagen quieta de verdad da ≤ 0,001 (el AAC deja algo de ruido)
# y el acercamiento de cámara más lento sobre líneas finas ya da 0,009–0,02; por eso QUIETO = 0,005.
# MOVIMIENTO (cambio fuerte) sirve para compararse con las referencias: 49 % y 75 % de fotogramas por
# encima de 1,0; nº04 antes de la prueba de dinamismo, 1 %.
QUIETO = 0.005
MOVIMIENTO = 1.0
UMBRAL_QUIETO_S = 4.0


def fotograma(mp4: str, t: float, escala: tuple[int, int] | None = None) -> Image.Image:
    """Fotograma en el segundo t (búsqueda exacta: -ss antes de -i descodifica hasta ese punto)."""
    filtro = ["-vf", f"scale={escala[0]}:{escala[1]}"] if escala else []
    png = subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-ss", f"{t:.3f}", "-i", mp4, "-frames:v", "1", *filtro, "-f", "image2pipe", "-vcodec", "png", "-"],
        capture_output=True,
        check=True,
    ).stdout
    return Image.open(BytesIO(png)).convert("RGB")


def fotogramas_de(mp4: str) -> int:
    salida = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "stream=nb_frames", "-select_streams", "v:0", "-of", "default=nw=1:nk=1", mp4],
        capture_output=True, text=True, check=True,
    ).stdout
    return int(salida.strip())


def hoja(mp4: str, destino: Path, n: int = 24, columnas: int = 6, desde: float = 0.0) -> list[float]:
    """Hoja de contactos con n fotogramas repartidos por todo el video, cada uno con su segundo."""
    total = fotogramas_de(mp4)
    n = min(n, total)
    columnas = min(columnas, n)
    W, H = 270, 480
    momentos = [int((i + 0.5) * total / n) / FPS for i in range(n)]
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
    lufs = (f"{pyln.Meter(sr).integrated_loudness(a):.1f} LUFS (objetivo −14)"
            if len(a) >= 0.4 * sr else "LUFS: duración insuficiente")
    pico = 20 * np.log10(max(1e-9, float(np.abs(a).max())))
    # True peak (BS.1770, con sobremuestreo) con ebur128 de ffmpeg
    texto = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", wav, "-af", "ebur128=peak=true", "-f", "null", "-"],
        capture_output=True, text=True,
    ).stderr
    tp = next((l.split(":")[1].strip() for l in reversed(texto.splitlines()) if l.strip().startswith("Peak:")), "?")
    return [f"audio: {len(a) / sr:.2f} s · {lufs} · pico {pico:.2f} dBFS · true peak {tp}"]


def desfase(ts: np.ndarray, rejilla: float) -> np.ndarray:
    d = (ts / rejilla) - np.round(ts / rejilla)
    return np.abs(d * rejilla)


def pulso(mp4: str, wav: str, bpm: float, desde: float = 0.0) -> list[str]:
    """¿Laten juntas la música y la imagen? Ataques de audio y picos de cambio visual frente a la rejilla.

    `desde`: segundo del episodio en que empieza el MP4 (tramos). La rejilla del pulso está anclada al
    segundo 0 del episodio, así que los tiempos del MP4 se pasan a tiempos del episodio antes de
    filtrar y medir; si no, un tramo que empieza a mitad de un tiempo saldría entero "fuera de la
    rejilla", y la portada (INICIO) se descontaría de un tramo que no la tiene.
    """
    import librosa
    import soundfile as sf

    negra = 60 / bpm
    a, sr = sf.read(wav, dtype="float32")
    y = a.mean(1) if a.ndim > 1 else a
    if len(y) < sr * 0.4:
        return ["pulso: duración insuficiente"]
    _, perc = librosa.effects.hpss(y)
    ataques = librosa.onset.onset_detect(y=perc, sr=sr, units="time", backtrack=False) + desde
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
    t_dif = (np.arange(len(dif)) + 1) / FPS + desde  # en segundos del episodio
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


def tramos_quietos(dif: np.ndarray, fps: float = FPS, umbral: float = QUIETO) -> list[tuple[float, float]]:
    """Tramos (inicio, fin en s) en que el cambio entre fotogramas no pasa de `umbral`."""
    tramos = []
    inicio = None
    for i, d in enumerate(list(dif) + [np.inf]):
        if d < umbral and inicio is None:
            inicio = i
        elif d >= umbral and inicio is not None:
            tramos.append(((inicio + 1) / fps, (i + 1) / fps))
            inicio = None
    return tramos


def dinamismo(mp4: str, desde: float = 0.0) -> list[str]:
    """¿Se queda la imagen quieta mucho rato? Fotogramas en movimiento y el tramo quieto más largo."""
    w = h = 96
    crudo = subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", mp4, "-vf", f"scale={w}:{h},format=gray", "-f", "rawvideo", "-"],
        capture_output=True, check=True,
    ).stdout
    fotos = np.frombuffer(crudo, np.uint8).reshape(-1, h, w).astype(np.float32)
    if len(fotos) < 2:
        return ["dinamismo: video demasiado corto"]
    dif = np.abs(np.diff(fotos, axis=0)).mean(axis=(1, 2))
    tramos = tramos_quietos(dif)
    largo = max(tramos, key=lambda x: x[1] - x[0], default=(0.0, 0.0))
    lineas = [f"dinamismo: {np.mean(dif > MOVIMIENTO):.0%} de fotogramas con cambio fuerte (referencias: 49–75 %) · {np.mean(dif < QUIETO):.0%} quietos"
              f" · tramo quieto más largo {largo[1] - largo[0]:.1f} s (aviso desde {UMBRAL_QUIETO_S:.0f} s)"]
    largos = [(a + desde, b + desde) for a, b in tramos if b - a > UMBRAL_QUIETO_S]
    if largos:
        lineas.append("  ⚠ IMAGEN QUIETA demasiado rato (s): " + " · ".join(f"{a:.1f}–{b:.1f}" for a, b in largos))
    return lineas


def fotogramas_extremos(mp4: str, w: int = 270, h: int = 480) -> tuple[np.ndarray, np.ndarray]:
    """Primer y último fotograma, reducidos (la reducción por área suaviza el punto de la trama)."""
    def leer(antes: list[str], despues: list[str]) -> np.ndarray:
        crudo = subprocess.run(
            ["ffmpeg", "-hide_banner", "-loglevel", "error", *antes, "-i", mp4, *despues,
             "-vf", f"scale={w}:{h}:flags=area", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
            capture_output=True, check=True,
        ).stdout
        return np.frombuffer(crudo, np.uint8).reshape(-1, h, w, 3).astype(np.float32)

    # El último: se descodifica solo el último medio segundo (-sseof) y se queda el que sale al final
    return leer([], ["-frames:v", "1"])[0], leer(["-sseof", "-0.5"], [])[-1]


def loop(mp4: str) -> list[str]:
    """¿El último fotograma enlaza con el primero? (CLAUDE.md: el video debe poder repetirse en bucle)."""
    a, b = fotogramas_extremos(mp4)
    dif = np.abs(a - b).max(axis=2)
    distintos = float(np.mean(dif > UMBRAL_PIXEL))
    lineas = [f"loop: primer y último fotograma · diferencia media {dif.mean():.1f}/255 · {distintos:.0%} de píxeles"
              f" distintos (aviso desde {UMBRAL_LOOP:.0%}; con título fijo en el fotograma 0, ~7 % es normal)"]
    if distintos > UMBRAL_LOOP:
        lineas.append("  ⚠ EL LOOP NO CIERRA: el último fotograma no coincide con el primero. El sketch debe dibujar"
                      " en la portada el mismo estado que al final, y el panel bajar antes (`hasta`).")
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
    ap.add_argument("--informe", default="informe.txt", help="nombre del informe de texto, dentro de --carpeta")
    ap.add_argument("--sin-loop", action="store_true", help="no comprobar el loop (un tramo no tiene portada ni final)")
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
    if not args.sin_loop:
        lineas += loop(args.mp4)
    lineas += dinamismo(args.mp4, args.desde)
    if args.pulso:
        lineas += pulso(args.mp4, wav, args.bpm, args.desde)

    texto = "\n".join(lineas)
    print(texto)
    # El nombre lo decide quien llama (producir.py: informe_tramo.txt en tramos), no `desde`: un tramo
    # que empieza en 0 pisaba informe.txt.
    (carpeta / args.informe).write_text(texto + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
