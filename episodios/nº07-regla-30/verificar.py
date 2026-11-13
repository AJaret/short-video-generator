"""nº07 · Verificación de la Regla 30. Python estándar, sin paquetes.

Autómata celular elemental: una fila de casillas blancas o negras; cada casilla de la fila siguiente
mira tres de la anterior (ella y sus dos vecinas) y decide su color según una tabla de 8 casos. La
Regla 30 es la tabla cuyas respuestas, leídas de 111 a 000, forman 00011110 en binario = 30.

Comprueba lo que dirá el guion:
  1. La tabla de la Regla 30 (8 casos → 8 respuestas) y que equivale a izquierda XOR (centro OR derecha).
  2. Desde un solo punto negro salen triángulos de todos los tamaños (se cuentan los huecos blancos
     triangulares por tamaño en las primeras filas).
  3. La columna del centro "parece azar": proporción de negros ≈ 1/2 y ningún periodo corto en las
     primeras 20 000 filas (no demuestra nada: el problema sigue abierto, ver NOTAS.md).

Uso: python "episodios/nº07-regla-30/verificar.py"
"""
from collections import Counter

REGLA = 30
CASOS = ['111', '110', '101', '100', '011', '010', '001', '000']


def tabla(regla=REGLA):
    return {caso: (regla >> (7 - i)) & 1 for i, caso in enumerate(CASOS)}


def filas(n, ancho=None, regla=REGLA):
    """Filas (listas de 0/1) desde un solo punto negro en el centro."""
    ancho = ancho or 2 * n + 1
    fila = [0] * ancho
    fila[ancho // 2] = 1
    t = tabla(regla)
    out = [fila]
    for _ in range(n - 1):
        fila = [t[f'{fila[i - 1] if i else 0}{fila[i]}{fila[i + 1] if i + 1 < ancho else 0}'] for i in range(ancho)]
        out.append(fila)
    return out


def columna_central(n):
    """La columna del centro de n filas, con enteros como bits (rápido): nueva = izq XOR (centro OR der)."""
    x = 1 << n  # el punto negro en la posición n (hay sitio a ambos lados)
    col = []
    for _ in range(n):
        col.append((x >> n) & 1)
        x = (x << 1) ^ (x | (x >> 1))
    return col


def triangulos(f):
    """Huecos blancos triangulares (apoyados en una fila de negros): tamaño = filas que dura el hueco."""
    tam = Counter()
    alto = len(f)
    for y in range(1, alto):
        x = 0
        fila = f[y]
        while x < len(fila):
            # Un hueco nace cuando en la fila de arriba hay negro y aquí empieza un tramo blanco cerrado
            if fila[x] == 0 and x > 0 and fila[x - 1] == 1 and f[y - 1][x] == 1:
                fin = x
                while fin < len(fila) and fila[fin] == 0:
                    fin += 1
                if fin < len(fila) and fin - x >= 2:
                    tam[(fin - x + 1) // 2] += 1
                x = fin
            x += 1
    return tam


if __name__ == '__main__':
    t = tabla()
    print('1. Tabla de la Regla 30:', ' '.join(f'{c}→{t[c]}' for c in CASOS))
    assert ''.join(str(t[c]) for c in CASOS) == '00011110' and int('00011110', 2) == 30
    for c in CASOS:
        izq, cen, der = map(int, c)
        assert t[c] == izq ^ (cen | der)

    f = filas(200)
    tam = triangulos(f)
    print('2. Triángulos blancos (tamaño: cuántos) en 200 filas:', ', '.join(f'{k}: {v}' for k, v in sorted(tam.items())[:12]), '…')
    assert len(tam) >= 7 and max(tam) >= 7, 'debe haber triángulos de muchos tamaños'
    assert all(tam[k] >= tam[k + 1] for k in range(1, 7)), 'los grandes son más raros'

    n = 20000
    col = columna_central(n)
    assert col[:len(f)] == [fila[len(fila) // 2] for fila in f], 'la versión rápida coincide con la tabla'
    negros = sum(col) / n
    print(f'3. Columna central, {n} filas: {negros:.2%} negros')
    assert abs(negros - 0.5) < 0.01
    # Sin periodo corto: ningún p ≤ 2000 hace que la segunda mitad se repita cada p
    mitad = col[n // 2:]
    periodicos = [p for p in range(1, 2001) if all(mitad[i] == mitad[i + p] for i in range(len(mitad) - p))]
    print(f'   periodos ≤ 2000 en la segunda mitad: {periodicos or "ninguno"}')
    assert not periodicos
    print('   primeros 32 del centro:', ''.join(map(str, col[:32])))
    print('OK')
