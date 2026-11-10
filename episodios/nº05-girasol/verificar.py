"""nº05 · Verificación del girasol (modelo de Vogel, 1979): la semilla n está en el ángulo n·α y a la
distancia c·√n del centro. Comprueba lo que dirá el guion, con Python estándar (sin paquetes):

  1. El ángulo de oro: α = 360° · (1 − 1/φ) ≈ 137,508°.
  2. Con ese ángulo, las espirales visibles (parastiquias) son números de Fibonacci seguidos, y
     cuántas se cuentan depende de cuántas semillas hay (más semillas → pareja más alta).
  3. Con 137° o 138° el patrón se rompe: aparecen rayos y huecos (el reparto pierde uniformidad).
  4. Ángulos "redondos" (120°, 135°, 144°) dan rayos rectos: 3, 8 y 5 brazos.

Uso: docker compose run --rm analisis python "episodios/nº05-girasol/verificar.py"
(o python en Windows: no necesita paquetes).
"""
from math import cos, pi, sin, sqrt
from collections import Counter

PHI = (1 + 5 ** 0.5) / 2
ORO = 360 * (1 - 1 / PHI)
FIB = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233]


def semillas(alfa, n):
    return [(sqrt(k) * cos(k * alfa * pi / 180), sqrt(k) * sin(k * alfa * pi / 180)) for k in range(1, n + 1)]


def vecinos(puntos, desde, k=4):
    """Para cada semilla de la corona exterior, diferencias de índice con sus k vecinas más cercanas."""
    dif = Counter()
    n = len(puntos)
    for i in range(desde, n):
        xi, yi = puntos[i]
        # Solo vecinas con radio parecido (la corona): basta mirar índices cercanos en √n
        cand = []
        for j in range(max(0, i - 300), min(n, i + 300)):
            if j == i:
                continue
            xj, yj = puntos[j]
            cand.append(((xi - xj) ** 2 + (yi - yj) ** 2, abs(i - j)))
        cand.sort()
        for _, d in cand[:k]:
            dif[d] += 1
    return dif


def uniformidad(puntos, desde):
    """Coeficiente de variación de la distancia a la vecina más cercana (0 = reparto perfecto)."""
    ds = []
    n = len(puntos)
    for i in range(desde, n):
        xi, yi = puntos[i]
        ds.append(min(((xi - puntos[j][0]) ** 2 + (yi - puntos[j][1]) ** 2) ** 0.5 for j in range(max(0, i - 300), min(n, i + 300)) if j != i))
    m = sum(ds) / len(ds)
    return (sum((d - m) ** 2 for d in ds) / len(ds)) ** 0.5 / m


def brazos(alfa, n=400):
    """Rayos rectos: cuántas direcciones distintas ocupan las semillas (redondeo a 1°)."""
    return len({round((k * alfa) % 360) % 360 for k in range(1, n + 1)})


if __name__ == '__main__':
    print(f'1. Ángulo de oro: {ORO:.4f}°  (360/phi^2 = {360 / PHI ** 2:.4f}°)')
    assert abs(ORO - 137.5078) < 1e-3

    print('2. Espirales con el ángulo de oro (las dos diferencias de índice más comunes entre vecinas):')
    for n in (150, 400, 1000, 2500):
        p = semillas(ORO, n)
        comunes = [d for d, _ in vecinos(p, int(n * 0.85), k=2).most_common(2)]
        print(f'   {n:5d} semillas → espirales {sorted(comunes)}  (Fibonacci: {all(d in FIB for d in comunes)})')
        assert all(d in FIB for d in comunes)

    print('3. Uniformidad del reparto (coef. de variación de la distancia a la vecina; menor = más parejo):')
    n = 1000
    cv = {}
    for alfa in (137.0, 137.3, ORO, 137.7, 138.0):
        cv[alfa] = uniformidad(semillas(alfa, n), int(n * 0.5))
        print(f'   {alfa:8.3f}° → {cv[alfa]:.3f}')
    assert cv[ORO] < min(cv[137.0], cv[138.0]) / 2, 'con 137° y 138° el reparto debe ser mucho peor'

    print('4. Ángulos redondos → rayos rectos (direcciones ocupadas por 400 semillas):')
    for alfa, esperado in ((120, 3), (135, 8), (144, 5)):
        b = brazos(alfa)
        print(f'   {alfa}° → {b} brazos')
        assert b == esperado
    print(f'   ángulo de oro → {brazos(ORO)} direcciones (nunca repite)')

    # 5. El remate muestra un girasol "que no dio Fibonacci" con un patrón que el estudio de 2016 sí
    #    encontró: espirales de Lucas (1, 3, 4, 7, 11, 18, 29, 47…). En el modelo salen con el ángulo de
    #    Lucas, 360° / (3 + 1/φ) ≈ 99,502°.
    LUCAS = [1, 3, 4, 7, 11, 18, 29, 47, 76, 123]
    angulo_lucas = 360 / (3 + 1 / PHI)  # = 99,5016°
    p = semillas(angulo_lucas, 400)
    comunes = sorted(d for d, _ in vecinos(p, int(400 * 0.85), k=2).most_common(2))
    print(f'5. Ángulo de Lucas {angulo_lucas:.3f}° con 400 semillas → espirales {comunes} (Lucas: {all(d in LUCAS for d in comunes)})')
    assert all(d in LUCAS for d in comunes)
    print('OK')
