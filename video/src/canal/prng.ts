// Aleatoriedad determinista. Prohibido Math.random(): todo sale de una semilla.

/** PRNG mulberry32: devuelve una función que produce números en [0, 1). */
export function mulberry32(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash entero sin estado → [0, 1). Útil para "ruido" por fotograma o por índice. */
export function hash01(...valores: number[]): number {
  let h = 0x811c9dc5;
  for (const v of valores) {
    h = Math.imul(h ^ (Math.floor(v) | 0), 0x01000193);
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
  }
  return (h >>> 0) / 4294967296;
}

/** Ruido de valor 1D suave (interpolación coseno entre puntos de hash). */
export function ruido1d(x: number, semilla: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = (1 - Math.cos(f * Math.PI)) / 2;
  return hash01(i, semilla) * (1 - u) + hash01(i + 1, semilla) * u;
}
