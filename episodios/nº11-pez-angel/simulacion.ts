// nº11 · Simulaciones de reacción-difusión. Módulo PURO: lo usan la animación, el sonido y verificar.mjs.
//
// La receta de Turing («The chemical basis of morphogenesis», Phil. Trans. R. Soc. B 237, 37–72, 1952),
// en la forma de activador e inhibidor (Kondo y Miura, Science 329, 1616, 2010): dos sustancias que se
// esparcen por la piel; una se activa a sí misma, la otra la frena, y la que frena se esparce más rápido.
//
//   · `piel1D`: una franja de piel que CRECE (el cuerpo del pez, de la cabeza a la cola). Modelo de
//     Schnakenberg. Al crecer, entre dos rayas cabe otra y aparece: el número de rayas sube y la
//     separación se mantiene (lo que vieron Kondo y Asai, Nature 376, 765, 1995).
//   · `parche2D`: la misma clase de receta en un cuadro de piel (Gray-Scott), para enseñar que con
//     dos ingredientes salen manchas o laberintos según las cantidades.
// Son ESQUEMAS: parámetros nuestros. Deterministas: el ruido inicial sale de mulberry32.
import {mulberry32} from '@canal/prng';

// ── Franja que crece (1D) ─────────────────────────────────────────────────────────────────────

export const PIEL = {
  /** Puntos de la franja (fijos: al crecer, cada punto representa más piel). */
  n: 150,
  /** Largo inicial y final (unidades de la simulación). */
  L0: 30,
  crece: 4,
  /** Difusión del activador y del inhibidor (el inhibidor, más rápido). */
  Du: 1,
  Dv: 22,
  /** Schnakenberg: f = a − u + u²v, g = b − u²v. */
  a: 0.1,
  b: 0.9,
  /** Tiempo de una duplicación del largo. */
  duplica: 260,
  /** Tiempo para que salgan las primeras rayas antes de crecer. */
  previo: 120,
};

export type Piel = {
  /** Largo en cada instantánea. */
  L: number[];
  /** Activador u (normalizado 0…1) en cada instantánea. */
  u: Float32Array[];
  /** Inhibidor v (normalizado 0…1) en cada instantánea. */
  v: Float32Array[];
  /** Activador e inhibidor SIN normalizar (para enseñar que el patrón crece desde un ruido mínimo). */
  ur: Float32Array[];
  vr: Float32Array[];
  /** Tiempo de la simulación de cada instantánea. */
  t: number[];
};

/** Simula la franja: `previo` sin crecer y luego dos duplicaciones. Devuelve `fotos` instantáneas. */
export function piel1D(semilla: number, fotos = 240, p = PIEL): Piel {
  const azar = mulberry32(semilla * 17 + 5);
  const n = p.n;
  const u0 = p.a + p.b;
  const v0 = p.b / (u0 * u0);
  let u = new Float64Array(n);
  let v = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    u[i] = u0 * (1 + 0.04 * (azar() - 0.5));
    v[i] = v0 * (1 + 0.04 * (azar() - 0.5));
  }
  const r = Math.log(2) / p.duplica;
  const total = p.previo + p.duplica * Math.log2(p.crece);
  const salida: Piel = {L: [], u: [], v: [], ur: [], vr: [], t: []};
  let un = new Float64Array(n);
  let vn = new Float64Array(n);
  const largo = (tt: number) => (tt < p.previo ? p.L0 : p.L0 * Math.exp(r * (tt - p.previo)));
  const foto = (tt: number) => {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < n; i++) {
      if (u[i] < min) min = u[i];
      if (u[i] > max) max = u[i];
    }
    salida.L.push(largo(tt));
    salida.t.push(tt);
    salida.u.push(Float32Array.from(u, (x) => (x - min) / Math.max(1e-9, max - min)));
    let vmin = Infinity;
    let vmax = -Infinity;
    for (let i = 0; i < n; i++) {
      if (v[i] < vmin) vmin = v[i];
      if (v[i] > vmax) vmax = v[i];
    }
    salida.v.push(Float32Array.from(v, (x) => (x - vmin) / Math.max(1e-9, vmax - vmin)));
    salida.ur.push(Float32Array.from(u));
    salida.vr.push(Float32Array.from(v));
  };
  let tt = 0;
  let siguiente = 0;
  while (tt <= total) {
    if (tt >= siguiente - 1e-9) {
      foto(tt);
      siguiente += total / (fotos - 1);
    }
    const L = largo(tt);
    const crecimiento = tt < p.previo ? 0 : r;
    const dx = L / (n - 1);
    const k = 1 / (dx * dx);
    // Paso estable para la piel de ahora (al crecer, cada punto es más piel y el paso puede crecer)
    const dt = Math.min(0.05, (0.22 * dx * dx) / p.Dv);
    for (let i = 0; i < n; i++) {
      const izq = i > 0 ? i - 1 : 1;
      const der = i < n - 1 ? i + 1 : n - 2;
      const lu = (u[izq] - 2 * u[i] + u[der]) * k;
      const lv = (v[izq] - 2 * v[i] + v[der]) * k;
      const uuv = u[i] * u[i] * v[i];
      // Crecer diluye un poco (la misma sustancia en más piel)
      un[i] = u[i] + dt * (p.Du * lu + p.a - u[i] + uuv - crecimiento * u[i]);
      vn[i] = v[i] + dt * (p.Dv * lv + p.b - uuv - crecimiento * v[i]);
    }
    [u, un] = [un, u];
    [v, vn] = [vn, v];
    tt += dt;
  }
  while (salida.u.length < fotos) foto(total);
  return salida;
}

/** Rayas (máximos del activador por encima de la media) de una instantánea, con su posición (0…1). */
export function rayas(u: Float32Array): number[] {
  const n = u.length;
  let media = 0;
  for (let i = 0; i < n; i++) media += u[i] / n;
  const pos: number[] = [];
  for (let i = 0; i < n; i++) {
    const izq = i > 0 ? u[i - 1] : -1;
    const der = i < n - 1 ? u[i + 1] : -1;
    if (u[i] > media + 0.15 && u[i] >= izq && u[i] > der) pos.push(i / (n - 1));
  }
  return pos;
}

// ── Parche de piel (2D) ───────────────────────────────────────────────────────────────────────

/** Gray-Scott: manchas o laberintos según la alimentación F y la retirada k. */
export const RECETAS = {
  manchas: {F: 0.035, k: 0.065},
  laberinto: {F: 0.029, k: 0.057},
} as const;

/** Simula un cuadro de `lado`×`lado` y devuelve `fotos` instantáneas del inhibidor v (0…1). */
export function parche2D(semilla: number, receta: {F: number; k: number}, lado = 96, pasos = 7000, fotos = 40): Float32Array[] {
  const azar = mulberry32(semilla * 29 + 11);
  const n = lado * lado;
  let u = new Float32Array(n).fill(1);
  let v = new Float32Array(n);
  // Unas cuantas semillas de inhibidor al azar
  for (let s = 0; s < 18; s++) {
    const cx = Math.floor(azar() * lado);
    const cy = Math.floor(azar() * lado);
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const x = (cx + dx + lado) % lado;
      const y = (cy + dy + lado) % lado;
      u[y * lado + x] = 0.5;
      v[y * lado + x] = 0.25 + 0.1 * azar();
    }
  }
  let un = new Float32Array(n);
  let vn = new Float32Array(n);
  const Du = 0.16;
  const Dv = 0.08;
  const salida: Float32Array[] = [];
  const cada = Math.floor(pasos / fotos);
  for (let s = 0; s < pasos; s++) {
    for (let y = 0; y < lado; y++) {
      const ya = ((y - 1 + lado) % lado) * lado;
      const yb = ((y + 1) % lado) * lado;
      const yy = y * lado;
      for (let x = 0; x < lado; x++) {
        const xa = (x - 1 + lado) % lado;
        const xb = (x + 1) % lado;
        const i = yy + x;
        const lu = u[ya + x] + u[yb + x] + u[yy + xa] + u[yy + xb] - 4 * u[i];
        const lv = v[ya + x] + v[yb + x] + v[yy + xa] + v[yy + xb] - 4 * v[i];
        const uvv = u[i] * v[i] * v[i];
        un[i] = u[i] + Du * lu - uvv + receta.F * (1 - u[i]);
        vn[i] = v[i] + Dv * lv + uvv - (receta.F + receta.k) * v[i];
      }
    }
    [u, un] = [un, u];
    [v, vn] = [vn, v];
    if ((s + 1) % cada === 0) {
      let max = 0;
      for (let i = 0; i < n; i++) if (v[i] > max) max = v[i];
      salida.push(Float32Array.from(v, (x) => x / Math.max(1e-9, max)));
    }
  }
  return salida;
}
