"""Descarga y prepara las muestras de instrumentos reales de la música (licencia CC0).

Fuente: VCSL, Versilian Community Sample Library (https://github.com/sgossner/VCSL), CC0 1.0.
Se baja solo lo que usa la música, desde una versión FIJA del banco (COMMIT), y se guarda recortado
en video/src/sonido/muestras/ (mono, 44,1 kHz, 16 bits, sin silencio inicial, con fundido final),
junto con muestras.json (instrumento → archivo, nota MIDI y capa de intensidad).

Las muestras procesadas se versionan (~7 MB): este script solo hace falta para regenerarlas o
añadir instrumentos. Uso (en el servicio analisis, que tiene numpy, soundfile y librosa):

    docker compose run --rm analisis python herramientas/muestras.py
"""
import json
import os
import re
import sys
import urllib.parse
import urllib.request

import numpy as np
import soundfile as sf

COMMIT = 'c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e'
BASE = f'https://raw.githubusercontent.com/sgossner/VCSL/{COMMIT}/'
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DESTINO = os.path.join(RAIZ, 'video', 'src', 'sonido', 'muestras')
CACHE = os.path.join(RAIZ, 'out', 'vcsl')  # descargas originales (no se versionan)
SR = 44100

PERCUSION = 'Idiophones/Struck Idiophones/'
MEMBRANAS = 'Membranophones/Struck Membranophones/'

# instrumento: (lista de (ruta en VCSL, nota o None, capa), duración máxima en s)
NOTAS_MARIMBA = ['F1', 'C2', 'G2', 'B2', 'F3', 'C4', 'G4', 'B4', 'F5', 'C6']
NOTAS_VIBRAFONO = ['F2', 'A2', 'C3', 'E3', 'G3', 'B3', 'D4', 'F4', 'A4', 'C5', 'E5']
NOTAS_GLOCK = ['G4', 'C5', 'G5', 'C6', 'G6', 'C7']

INSTRUMENTOS = {
    'marimba': (
        [(f'{PERCUSION}Marimba/Marimba_hit_Outrigger_{n}_{capa}_01.wav', n, capa) for n in NOTAS_MARIMBA for capa in ('med', 'loud')],
        1.6,
    ),
    'vibrafono': (
        [(f'{PERCUSION}Vibraphone/Hard Mallets/Vibes_hard_{n}_v3_rr1_Main.wav', n, 'loud') for n in NOTAS_VIBRAFONO],
        2.4,
    ),
    'glock': ([(f'{PERCUSION}Glockenspiel/glock_medium_{n}_01.wav', n, 'med') for n in NOTAS_GLOCK], 1.8),
    'palmada': ([(f'{PERCUSION}Claps/Clap_rr{i}.wav', None, f'rr{i}') for i in range(1, 5)], 0.5),
    'hat': ([(f'{PERCUSION}Hi-Hat Cymbal/HiHat_HitC_v{v}_rr{r}_Mid.wav', None, f'v{v}rr{r}') for v in (2, 3) for r in (1, 2)], 0.35),
    'hatAbierto': ([(f'{PERCUSION}Hi-Hat Cymbal/HiHat_HitO_rr1_Mid.wav', None, 'rr1')], 1.0),
    'caja': ([(f'{MEMBRANAS}Snare Drum, Modern 1/Snare2_HitSN_v{v}_rr{r}_Mid.wav', None, f'v{v}rr{r}') for v in (5, 6) for r in (1, 2)], 0.6),
    'shaker': ([(f'{PERCUSION}Shaker, Small/Mid_ShakerHighFaster_{d}_rr{r}.wav', None, f'{d}{r}') for d in ('Down', 'Up') for r in (1, 2)], 0.3),
    'pandero': ([(f'{PERCUSION}Tambourine 1/Tamb1_Hit_v{v}_rr1_Mid.wav', None, f'v{v}') for v in (1, 2)], 0.6),
}

NOMBRES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def midi(nota: str) -> int:
    m = re.fullmatch(r'([A-G])(#?)(-?\d)', nota)
    assert m, nota
    return 12 * (int(m.group(3)) + 1) + NOMBRES[m.group(1)] + (1 if m.group(2) else 0)


def bajar(ruta: str) -> str:
    local = os.path.join(CACHE, ruta)
    if not os.path.exists(local):
        os.makedirs(os.path.dirname(local), exist_ok=True)
        url = BASE + urllib.parse.quote(ruta)
        with urllib.request.urlopen(url, timeout=60) as r, open(local + '.parcial', 'wb') as f:
            f.write(r.read())
        os.replace(local + '.parcial', local)
    return local


def preparar(origen: str, maximo: float) -> np.ndarray:
    datos, sr = sf.read(origen, always_2d=True)
    x = datos.mean(axis=1)
    if sr != SR:
        import librosa
        x = librosa.resample(x, orig_sr=sr, target_sr=SR)
    pico = np.max(np.abs(x)) or 1.0
    # Sin silencio inicial (2 ms antes del primer golpe) ni cola por debajo de −60 dB
    inicio = max(0, int(np.argmax(np.abs(x) > pico * 10 ** (-40 / 20))) - int(0.002 * SR))
    x = x[inicio:]
    sobre = np.nonzero(np.abs(x) > pico * 10 ** (-60 / 20))[0]
    x = x[: min(len(x), int(maximo * SR), (sobre[-1] + 1) if len(sobre) else len(x))]
    fundido = min(len(x), int(0.04 * SR))
    x[len(x) - fundido:] *= np.linspace(1, 0, fundido) ** 2
    return (x / pico * 10 ** (-1 / 20)).astype(np.float32)


def main() -> int:
    manifiesto: dict[str, list[dict]] = {}
    total = 0
    for nombre, (lista, maximo) in INSTRUMENTOS.items():
        carpeta = os.path.join(DESTINO, nombre)
        os.makedirs(carpeta, exist_ok=True)
        manifiesto[nombre] = []
        for ruta, nota, capa in lista:
            x = preparar(bajar(ruta), maximo)
            archivo = f'{nombre}/{(nota or "golpe").replace("#", "s")}_{capa}.wav'
            sf.write(os.path.join(DESTINO, archivo), x, SR, subtype='PCM_16')
            total += os.path.getsize(os.path.join(DESTINO, archivo))
            # VCSL nombra estas notas una octava por debajo de como suenan: medido con la FFT, su
            # "C4" da 523 Hz (do5) en marimba, vibráfono y glockenspiel. Se guarda la nota real.
            real = midi(nota) + 12 if nota else None
            manifiesto[nombre].append({'archivo': archivo, 'midi': real, 'capa': capa, 'origen': ruta})
        print(f'{nombre}: {len(lista)} muestras')
    with open(os.path.join(DESTINO, 'muestras.json'), 'w', encoding='utf-8') as f:
        json.dump({'fuente': 'VCSL (Versilian Community Sample Library), CC0 1.0', 'commit': COMMIT, 'sr': SR, 'instrumentos': manifiesto}, f, ensure_ascii=False, indent=1)
    print(f'Listo: {total / 1e6:.1f} MB en video/src/sonido/muestras/')
    return 0


if __name__ == '__main__':
    sys.exit(main())
