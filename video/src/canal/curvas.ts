// Curvas de movimiento (easing) y tramos de tiempo. Módulo PURO.
// Todo lo que se mueve en el kit de motion graphics pasa por aquí: arranques secos y frenadas
// suaves, como en los reels de referencia.

/** Lleva `v` a [0, 1]. */
export const limitar01 = (v: number) => Math.max(0, Math.min(1, v));

/** Progreso (0…1) de `t` dentro del tramo [inicio, inicio + duracion]. */
export const tramo = (t: number, inicio: number, duracion: number) => limitar01((t - inicio) / Math.max(1e-6, duracion));

export const salidaCubica = (x: number) => 1 - (1 - limitar01(x)) ** 3;
export const entradaCubica = (x: number) => limitar01(x) ** 3;
export const entradaSalidaCubica = (x: number) => {
  const v = limitar01(x);
  return v < 0.5 ? 4 * v ** 3 : 1 - (-2 * v + 2) ** 3 / 2;
};
/** Frenada rápida (exponencial): llega casi al final en el primer cuarto del tramo. */
export const salidaExpo = (x: number) => {
  const v = limitar01(x);
  return v >= 1 ? 1 : 1 - 2 ** (-10 * v);
};
/** Se pasa un poco y vuelve: para sellos, rótulos y formas que "caen" en el tiempo. */
export const salidaRebote = (x: number, fuerza = 1.70158) => {
  const v = limitar01(x) - 1;
  return 1 + (fuerza + 1) * v ** 3 + fuerza * v ** 2;
};
