"""nº02 · Comprobaciones del juego del caos (rigor: lo que afirma el guion, simulado).

    docker compose run --rm voz python "episodios/nº02-juego-del-caos/verificar.py"
"""

import numpy as np

rng = np.random.default_rng(2)
N = 200_000

# ── 1. Triángulo, salto a la mitad ──
V = np.array([[0.0, 0.0], [1.0, 0.0], [0.5, np.sqrt(3) / 2]])
p = np.array([0.4, 0.3])  # dentro del triángulo
pts = np.empty((N, 2))
for i in range(N):
    p = (p + V[rng.integers(3)]) / 2
    pts[i] = p


def bary(q):
    # coordenadas baricéntricas respecto a V
    a, b, c = V
    m = np.array([[b[0] - a[0], c[0] - a[0]], [b[1] - a[1], c[1] - a[1]]])
    l = np.linalg.solve(m, (q - a).T).T
    return np.c_[1 - l.sum(1), l]


def en_hueco(lam, nivel):
    """¿Está el punto en algún hueco de nivel <= nivel? (en baricéntricas, el hueco central es todas < 1/2)"""
    lam = lam.copy()
    dentro = np.zeros(len(lam), bool)
    for _ in range(nivel):
        h = (lam < 0.5).all(1)
        dentro |= h
        # pasar a la sub-copia de la esquina con mayor coordenada
        k = lam.argmax(1)
        lam = lam * 2
        lam[np.arange(len(lam)), k] -= 1
    return dentro


lam = bary(pts)
print("1. Triángulo")
print("   puntos en el hueco central desde el salto 1:", int(en_hueco(lam, 1).sum()), "de", N)
print("   puntos en huecos de nivel <= 6 desde el salto 6:", int(en_hueco(lam[5:], 6).sum()))
print("   distancia máxima al atractor tras 10 saltos <= 2^-10 =", 2**-10)

# ── 2. Cuadrado, salto a la mitad: se llena sin forma ──
C = np.array([[0, 0], [1, 0], [1, 1], [0, 1]], float)


def juego(vertices, regla=None, n=N, r=0.5):
    p = vertices.mean(0)
    previo = -1
    out = np.empty((n, vertices.shape[1]))
    for i in range(n):
        while True:
            k = int(rng.integers(len(vertices)))
            if regla is None or regla(k, previo):
                break
        p = p + (vertices[k] - p) * r
        previo = k
        out[i] = p
    return out[20:]


def ocupacion(q, g=128):
    h, _, _ = np.histogram2d(q[:, 0], q[:, 1], bins=g, range=[[0, 1], [0, 1]])
    return (h > 0).mean(), h


oc, h = ocupacion(juego(C))
print("2. Cuadrado sin regla: celdas ocupadas (128x128):", f"{oc:.1%}", " min/media:", f"{h.min() / h.mean():.2f}")
for nombre, regla in [
    ("no repetir el mismo vértice", lambda k, prev: k != prev),
    ("no elegir el vértice siguiente (antihorario) al anterior", lambda k, prev: prev < 0 or k != (prev + 1) % 4),
    ("no elegir el vértice opuesto al anterior", lambda k, prev: prev < 0 or k != (prev + 2) % 4),
]:
    oc, _ = ocupacion(juego(C, regla))
    print(f"   regla «{nombre}»: celdas ocupadas {oc:.1%}")

# ── 3. Tetraedro: Sierpinski 3D; dimensión 2; una proyección es un cuadrado lleno ──
T = np.array([[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]], float)
q = juego(T, n=400_000)
# Proyección a lo largo del eje Z (que une los puntos medios de dos aristas opuestas en este tetraedro)
xy = (q[:, :2] + 1) / 2
for g in (64, 256, 512):
    oc, _ = ocupacion(xy, g)
    print(f"3. Tetraedro visto a lo largo de Z, celdas ocupadas ({g}x{g}): {oc:.2%}")
# Visto de otra forma (diagonal) sí tiene huecos
d = q @ np.array([[1, 0], [0, 1], [0.0, 0.0]]) @ np.array([[np.cos(0.6), -np.sin(0.6)], [np.sin(0.6), np.cos(0.6)]])
ang = np.array([[1, 0, 0], [0, np.cos(0.7), -np.sin(0.7)], [0, np.sin(0.7), np.cos(0.7)]])
r = (q @ ang.T)[:, :2]
r = (r - r.min(0)) / (r.max(0) - r.min(0))
oc, _ = ocupacion(r, 256)
print(f"   visto en diagonal (256x256): {oc:.2%} (la figura no llena su caja)")
# Dimensión por conteo de cajas
for s in (8, 16, 32, 64):
    cajas = len(np.unique(np.floor((q + 1) / 2 * s).astype(int), axis=0))
    print(f"   cajas ocupadas con lado 1/{s}: {cajas}  (4^k si fuera dimensión 2: {s * s})")
