"""nº06 · Verificación de la percolación (el bosque que arde o no). Python estándar, sin paquetes.

Modelo: rejilla cuadrada; cada casilla tiene un árbol con probabilidad p (al azar, con semilla). El
fuego empieza en todos los árboles de la fila de abajo y salta solo a los vecinos de arriba, abajo,
izquierda y derecha. ¿Llega a la fila de arriba?

Comprueba lo que dirá el guion:
  1. En la rejilla del video, con 55 % casi nunca cruza y con 65 % casi siempre.
  2. El salto está cerca del 59 % y es más brusco cuanto más grande es el bosque: en uno de 200×200,
     con 57 % casi nunca cruza y con 61 % casi siempre (en el del video, 62 % solo cruza ~4 de 5).
  3. Elige los tres bosques del video (55 %, 59 % y 65 %) y los guarda en bosques.json, con cuántos
     pasos tarda el fuego en apagarse o en cruzar.

Uso: python "episodios/nº06-bosque/verificar.py"
"""
from collections import deque
import json
from pathlib import Path

ANCHO, ALTO = 56, 72  # la rejilla del video (15 px por casilla dentro del visor)


def mulberry32(a):
    """El mismo generador que el kit (prng.ts), para que el sketch pueda reproducir lo que haga falta."""
    a &= 0xFFFFFFFF

    def siguiente():
        nonlocal a
        a = (a + 0x6D2B79F5) & 0xFFFFFFFF
        t = a
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
        t ^= (t + (((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296

    return siguiente


def campo(semilla, ancho=ANCHO, alto=ALTO):
    """El azar de cada casilla (0…9999): hay árbol si campo < p·10000. Con el mismo campo, subir p solo
    añade árboles: el final del video barre la densidad sobre el mismo bosque."""
    azar = mulberry32(semilla)
    return [[int(azar() * 10000) for _ in range(ancho)] for _ in range(alto)]


def bosque(p, semilla, ancho=ANCHO, alto=ALTO):
    azar = mulberry32(semilla)
    return [[azar() < p for _ in range(ancho)] for _ in range(alto)]


def incendio(b):
    """Pasos desde la fila de abajo (fila alto−1) por casilla (−1 = no arde). Devuelve (pasos, cruza, último paso)."""
    alto, ancho = len(b), len(b[0])
    pasos = [[-1] * ancho for _ in range(alto)]
    cola = deque()
    for x in range(ancho):
        if b[alto - 1][x]:
            pasos[alto - 1][x] = 0
            cola.append((alto - 1, x))
    ultimo = 0
    while cola:
        y, x = cola.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < alto and 0 <= nx < ancho and b[ny][nx] and pasos[ny][nx] < 0:
                pasos[ny][nx] = pasos[y][x] + 1
                ultimo = max(ultimo, pasos[ny][nx])
                cola.append((ny, nx))
    cruza = any(pasos[0][x] >= 0 for x in range(ancho))
    return pasos, cruza, ultimo


def probabilidad(p, ancho, alto, pruebas):
    return sum(incendio(bosque(p, 1000 + k, ancho, alto))[1] for k in range(pruebas)) / pruebas


if __name__ == '__main__':
    print('1–2. Probabilidad de que el fuego cruce, según la densidad y el tamaño del bosque:')
    tabla = {}
    for (ancho, alto, pruebas) in ((ANCHO, ALTO, 400), (200, 200, 120)):
        fila = []
        for p in (0.55, 0.57, 0.59, 0.61, 0.62, 0.65):
            q = probabilidad(p, ancho, alto, pruebas)
            tabla[(ancho, p)] = q
            fila.append(f'{p:.0%}: {q:.0%}')
        print(f'   {ancho}×{alto} ({pruebas} bosques)  ' + ' · '.join(fila))
    assert tabla[(ANCHO, 0.55)] < 0.05 and tabla[(ANCHO, 0.65)] > 0.95, 'en la rejilla del video'
    assert tabla[(200, 0.57)] < 0.05 and tabla[(200, 0.61)] > 0.9, 'en un bosque grande'
    # Más brusco cuanto más grande: entre 57 % y 61 % cambia más en el bosque grande
    assert tabla[(200, 0.61)] - tabla[(200, 0.57)] > tabla[(ANCHO, 0.61)] - tabla[(ANCHO, 0.57)]

    print('3. Bosques del video:')
    elegidos = {}
    # 55 %: que avance un trecho y se ahogue; 65 %: que cruce; 59 %: que cruce por poco (camino
    # estrecho), para la frase del umbral
    for nombre, p, quiere in (('55', 0.55, False), ('65', 0.65, True), ('59', 0.59, True)):
        for semilla in range(1, 5000):
            b = bosque(p, semilla)
            pasos, cruza, ultimo = incendio(b)
            if cruza != quiere:
                continue
            quemados = sum(v >= 0 for fila in pasos for v in fila)
            arboles = sum(sum(fila) for fila in b)
            alcanzado = min((y for y in range(ALTO) for x in range(ANCHO) if pasos[y][x] >= 0), default=ALTO)
            if nombre == '55' and not (ALTO * 0.45 < alcanzado < ALTO * 0.7):
                continue  # que avance un buen trecho antes de ahogarse (más suspenso)
            if nombre == '59' and not (quemados / arboles < 0.55):
                continue  # cruza, pero quemando menos de la mitad: el camino es estrecho
            densidad = arboles / (ANCHO * ALTO)
            if abs(densidad - p) > 0.006:
                continue  # que la densidad real sea la que dice la voz
            elegidos[nombre] = dict(p=p, semilla=semilla, densidad=round(densidad, 4), cruza=cruza, pasos=ultimo,
                                    quemados=quemados, arboles=arboles,
                                    filas=[''.join('1' if c else '0' for c in fila) for fila in b],
                                    campo=[v for fila in campo(semilla) for v in fila])
            assert all((v < p * 10000) == c for v, c in zip(elegidos[nombre]['campo'], (c for fila in b for c in fila)))
            print(f'   {nombre} %: semilla {semilla} · densidad {densidad:.1%} · cruza {cruza} · {ultimo} pasos ·'
                  f' {quemados}/{arboles} árboles quemados · llega a la fila {ALTO - alcanzado} de {ALTO}')
            break
        assert nombre in elegidos, nombre
    # 4. Curvas medidas para la gráfica del video (probabilidad de cruzar de 50 % a 70 %)
    print('4. Curvas de 50 % a 70 % (para la gráfica):')
    curvas = {}
    for nombre, (ancho, alto, pruebas) in (('video', (ANCHO, ALTO, 300)), ('grande', (200, 200, 80))):
        curvas[nombre] = [round(probabilidad(k / 100, ancho, alto, pruebas), 3) for k in range(50, 71)]
        print(f'   {nombre}: ' + ' '.join(f'{v:.0%}' for v in curvas[nombre]))
    Path(__file__).with_name('bosques.json').write_text(json.dumps(dict(ancho=ANCHO, alto=ALTO, curvas=curvas, **elegidos), separators=(',', ':')))
    print('OK')
