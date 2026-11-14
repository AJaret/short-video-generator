// nº09 · Simulación de la sincronía. Módulo PURO: lo usan la animación, el sonido y verificar.mjs.
//
// El modelo de Mirollo y Strogatz (SIAM J. Appl. Math. 50, 1645–1662, 1990), que parte del de Peskin
// para las células marcapasos del corazón:
//   · Cada luciérnaga es un reloj idéntico. Su "carga" x sube de 0 a 1 siguiendo una curva cóncava
//     (sube rápido al principio y cada vez más despacio): x = f(φ), con φ la fase (0…1) del ciclo.
//   · Al llegar a 1 dispara (destello) y vuelve a 0.
//   · Cada destello empuja la carga de TODAS las demás un poco (ε). Si con el empujón una llega a 1,
//     dispara en ese mismo instante y desde entonces va pegada a la que la empujó.
// El teorema: con relojes iguales, todos viéndose entre sí, curva cóncava y ε > 0, la población
// acaba disparando a la vez para casi cualquier arranque (salvo casos de probabilidad cero).
//
// Es un ESQUEMA de las luciérnagas reales: en el campo cada una solo ve a sus vecinas y no todas son
// iguales. La simulación es exacta (por eventos, sin paso de tiempo). Determinista: mulberry32.
import {mulberry32} from '@canal/prng';

export const PARAMS = {
  /** Luciérnagas. */
  n: 120,
  /** Curvatura de la carga (b > 0: cóncava). */
  b: 3,
  /** Empujón que da cada destello a la carga de las demás (pequeño: tardan ~11 ciclos en juntarse). */
  eps: 0.001,
};

/** Carga x de un reloj en la fase φ (0…1): cóncava, f(0) = 0 y f(1) = 1. */
export const carga = (fase: number, b = PARAMS.b) => Math.log(1 + (Math.exp(b) - 1) * fase) / b;
/** Fase que corresponde a una carga x (la inversa de `carga`). */
export const faseDe = (x: number, b = PARAMS.b) => (Math.exp(b * x) - 1) / (Math.exp(b) - 1);

/** Fases de partida al azar (cada luciérnaga, a su aire). */
export function fasesAlAzar(n: number, semilla: number): number[] {
  const azar = mulberry32(semilla * 131 + 9);
  return Array.from({length: n}, () => azar());
}

/** Un destello: en el instante `t` (en ciclos; un reloj solo tarda 1 ciclo) disparan `quienes`. */
export type Destello = {t: number; quienes: number[]};

export type Historia = {
  destellos: Destello[];
  /** Instante del primer destello en que disparan todas a la vez (null si no llegó). */
  sincronia: number | null;
};

/**
 * Simula `ciclos` ciclos desde las fases `fases0`. Con `eps` = 0 no hay empujón: cada una sigue a
 * su ritmo para siempre. Tras la sincronía, todas disparan juntas una vez por ciclo, exacto.
 */
export function simular(fases0: number[], ciclos: number, op: {b?: number; eps?: number} = {}): Historia {
  const b = op.b ?? PARAMS.b;
  const eps = op.eps ?? PARAMS.eps;
  const n = fases0.length;
  const fase = Float64Array.from(fases0);
  const destellos: Destello[] = [];
  let sincronia: number | null = null;
  let t = 0;
  while (t < ciclos) {
    // Avanzar hasta que dispare la más adelantada
    let max = 0;
    for (let i = 0; i < n; i++) if (fase[i] > max) max = fase[i];
    const dt = 1 - max;
    t += dt;
    if (t > ciclos) break;
    const disparada = new Uint8Array(n);
    const cola: number[] = [];
    for (let i = 0; i < n; i++) {
      fase[i] += dt;
      if (fase[i] >= 1 - 1e-12) {
        disparada[i] = 1;
        cola.push(i);
      }
    }
    // Cada disparo empuja a las que aún no han disparado; las que llegan a 1 disparan también
    for (let k = 0; k < cola.length && eps > 0; k++) {
      for (let j = 0; j < n; j++) {
        if (disparada[j]) continue;
        const x = carga(fase[j], b) + eps;
        if (x >= 1) {
          disparada[j] = 1;
          cola.push(j);
        } else fase[j] = faseDe(x, b);
      }
    }
    for (const i of cola) fase[i] = 0;
    destellos.push({t, quienes: cola.slice().sort((p, q) => p - q)});
    if (cola.length === n) {
      if (sincronia === null) sincronia = t;
      // Ya van todas juntas: el resto son destellos idénticos, uno por ciclo
      for (let s = t + 1; s <= ciclos; s += 1) destellos.push({t: s, quienes: cola.slice().sort((p, q) => p - q)});
      break;
    }
  }
  return {destellos, sincronia};
}

/** Grupos distintos que disparan durante el ciclo que termina en `t` (n al principio, 1 al final). */
export function gruposEn(h: Historia, t: number): number {
  let grupos = 0;
  for (const d of h.destellos) if (d.t > t - 1 && d.t <= t) grupos++;
  return grupos;
}
