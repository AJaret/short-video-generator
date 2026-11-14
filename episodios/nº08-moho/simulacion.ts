// nº08 · Simulación del moho. Módulo PURO: lo usan la animación (Sketch.tsx), el sonido y verificar.mjs.
//
// El modelo matemático del propio artículo (Tero y otros, Science 327, 2010): el moho es una red de
// tubos. En cada paso, una ciudad (comida) al azar es la fuente y las demás reparten el flujo; el
// flujo por cada tubo sigue Hagen-Poiseuille (Q = D/L · Δp, se resuelve la red como un circuito) y la
// conductividad de cada tubo cambia como dD/dt = f(|Q|) − D, con f(Q) = Q^γ/(1 + Q^γ) y γ = 1,8: el
// tubo que lleva mucho flujo se engrosa y el que no, se adelgaza hasta desaparecer.
//
// La red de partida es una malla fina que cubre el terreno alrededor de las ciudades (el moho "lo
// cubrió todo"); la bahía de Tokio es agua. Es un ESQUEMA: posiciones de las ciudades aproximadas,
// malla propia y parámetros nuestros (en el artículo, I0 de 0,2 a 7,19 con γ = 1,8).
// Determinista: mulberry32 con semilla.
import {mulberry32} from '@canal/prng';

/** 36 ciudades alrededor de Tokio (posición aproximada, latitud/longitud). Tokio es la primera. */
export const CIUDADES: [string, number, number][] = [
  ['Tokio', 35.68, 139.76], ['Yokohama', 35.44, 139.64], ['Kawasaki', 35.53, 139.7], ['Saitama', 35.91, 139.62],
  ['Chiba', 35.61, 140.12], ['Funabashi', 35.69, 139.98], ['Kashiwa', 35.87, 139.98], ['Matsudo', 35.79, 139.9],
  ['Narita', 35.78, 140.32], ['Ichihara', 35.5, 140.12], ['Kisarazu', 35.38, 139.92], ['Hachioji', 35.66, 139.32],
  ['Tachikawa', 35.7, 139.41], ['Machida', 35.55, 139.45], ['Sagamihara', 35.57, 139.37], ['Fujisawa', 35.34, 139.49],
  ['Kamakura', 35.32, 139.55], ['Yokosuka', 35.28, 139.67], ['Hiratsuka', 35.33, 139.35], ['Odawara', 35.26, 139.16],
  ['Atsugi', 35.44, 139.36], ['Chigasaki', 35.33, 139.4], ['Kawagoe', 35.93, 139.49], ['Tokorozawa', 35.8, 139.47],
  ['Ome', 35.79, 139.28], ['Hanno', 35.86, 139.33], ['Kumagaya', 36.15, 139.39], ['Koshigaya', 35.89, 139.79],
  ['Kasukabe', 35.98, 139.75], ['Tsukuba', 36.08, 140.11], ['Toride', 35.91, 140.05], ['Abiko', 35.86, 140.03],
  ['Fuchu', 35.67, 139.48], ['Mitaka', 35.68, 139.56], ['Urayasu', 35.65, 139.9], ['Sakura', 35.72, 140.22],
];

/** De latitud/longitud a px de pantalla (1 grado de latitud ≈ 1,23 de longitud a 35,7° N). */
export const aPantalla = (lat: number, lon: number): [number, number] => [88 + (lon - 139.12) * 730, 330 + (36.2 - lat) * 898];

/** Bahía de Tokio (aproximada): agua. */
export const BAHIA: [number, number][] = [
  [35.63, 139.79], [35.64, 139.95], [35.58, 140.07], [35.47, 140.05], [35.37, 139.9], [35.24, 139.78],
  [35.24, 139.72], [35.3, 139.69], [35.42, 139.67], [35.52, 139.76],
];
export const bahiaEnPantalla = () => BAHIA.map(([lat, lon]) => aPantalla(lat, lon));

export const PARAMS = {separacion: 30, gamma: 1.8, flujo: 0.6, dt: 0.25, pasos: 500};

export type Red = {
  /** Nodos: x, y en px. Los primeros 36 son las ciudades (Tokio = 0). */
  x: Float64Array;
  y: Float64Array;
  /** Tubos: extremos y largo. */
  a: Int32Array;
  b: Int32Array;
  largo: Float64Array;
  /** Distancia (en saltos) desde Tokio por la malla: el orden en que el moho la cubre. */
  saltos: Int32Array;
  maxSaltos: number;
};

const enPoligono = (x: number, y: number, pol: [number, number][]) => {
  let dentro = false;
  for (let i = 0, j = pol.length - 1; i < pol.length; j = i++) {
    const [xi, yi] = pol[i];
    const [xj, yj] = pol[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
};

/** Cierre convexo (Andrew) de las ciudades, ensanchado desde su centro. */
function terreno(): [number, number][] {
  const pts = CIUDADES.map(([, lat, lon]) => aPantalla(lat, lon)).sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cruz = (o: number[], p: number[], q: number[]) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  const abajo: [number, number][] = [];
  for (const p of pts) {
    while (abajo.length >= 2 && cruz(abajo[abajo.length - 2], abajo[abajo.length - 1], p) <= 0) abajo.pop();
    abajo.push(p);
  }
  const arriba: [number, number][] = [];
  for (const p of [...pts].reverse()) {
    while (arriba.length >= 2 && cruz(arriba[arriba.length - 2], arriba[arriba.length - 1], p) <= 0) arriba.pop();
    arriba.push(p);
  }
  const casco = [...abajo.slice(0, -1), ...arriba.slice(0, -1)];
  const cx = casco.reduce((s, p) => s + p[0], 0) / casco.length;
  const cy = casco.reduce((s, p) => s + p[1], 0) / casco.length;
  return casco.map(([x, y]) => [cx + (x - cx) * 1.1, cy + (y - cy) * 1.1]);
}

/** La malla de partida: rejilla triangular dentro del terreno, sin agua, más las 36 ciudades. */
export function crearRed(semilla: number): Red {
  const azar = mulberry32(semilla);
  const s = PARAMS.separacion;
  const tierra = terreno();
  const bahia = bahiaEnPantalla();
  const xs: number[] = [];
  const ys: number[] = [];
  for (const [, lat, lon] of CIUDADES) {
    const [x, y] = aPantalla(lat, lon);
    xs.push(x);
    ys.push(y);
  }
  const nCiudades = xs.length;
  for (let fila = 0; fila < 80; fila++) {
    for (let col = 0; col < 50; col++) {
      // Un poco de desorden: la malla no es perfecta
      const x = col * s + (fila % 2 ? s / 2 : 0) + (azar() - 0.5) * s * 0.3;
      const y = 200 + fila * s * 0.866 + (azar() - 0.5) * s * 0.3;
      if (!enPoligono(x, y, tierra) || enPoligono(x, y, bahia)) continue;
      if (xs.slice(0, nCiudades).some((cx, k) => Math.hypot(cx - x, ys[k] - y) < s * 0.55)) continue;
      xs.push(x);
      ys.push(y);
    }
  }
  const n = xs.length;
  const aa: number[] = [];
  const bb: number[] = [];
  const ll: number[] = [];
  const cruzaAgua = (i: number, j: number) => {
    for (const f of [0.25, 0.5, 0.75]) if (enPoligono(xs[i] + (xs[j] - xs[i]) * f, ys[i] + (ys[j] - ys[i]) * f, bahia)) return true;
    return false;
  };
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = Math.hypot(xs[i] - xs[j], ys[i] - ys[j]);
      if (d < s * 1.25 && !cruzaAgua(i, j)) {
        aa.push(i);
        bb.push(j);
        ll.push(d);
      }
    }
  }
  // Saltos desde Tokio (búsqueda en anchura)
  const vecinos: number[][] = Array.from({length: n}, () => []);
  aa.forEach((a, k) => {
    vecinos[a].push(bb[k]);
    vecinos[bb[k]].push(a);
  });
  const saltos = new Int32Array(n).fill(-1);
  saltos[0] = 0;
  const cola = [0];
  for (let k = 0; k < cola.length; k++) for (const v of vecinos[cola[k]]) if (saltos[v] < 0) {
    saltos[v] = saltos[cola[k]] + 1;
    cola.push(v);
  }
  return {
    x: Float64Array.from(xs),
    y: Float64Array.from(ys),
    a: Int32Array.from(aa),
    b: Int32Array.from(bb),
    largo: Float64Array.from(ll),
    saltos,
    maxSaltos: Math.max(...saltos),
  };
}

/**
 * Historia de las conductividades: `historia[p]` es D de cada tubo tras p pasos (p = 0: la malla
 * entera, todos los tubos iguales con un poco de azar).
 */
export function simular(red: Red, semilla: number, pasos = PARAMS.pasos): Float32Array[] {
  const azar = mulberry32(semilla * 31 + 7);
  const n = red.x.length;
  const m = red.a.length;
  const nC = CIUDADES.length;
  let D = new Float64Array(m);
  for (let k = 0; k < m; k++) D[k] = 0.5 + azar() * 0.5;
  const historia = [Float32Array.from(D)];
  const p = new Float64Array(n);
  const r = new Float64Array(n);
  const z = new Float64Array(n);
  const d = new Float64Array(n);
  const Ap = new Float64Array(n);
  const diag = new Float64Array(n);
  const b = new Float64Array(n);
  for (let paso = 0; paso < pasos; paso++) {
    // Fuente al azar; las demás ciudades se reparten el flujo
    const fuente = Math.floor(azar() * nC);
    b.fill(0);
    for (let c = 0; c < nC; c++) b[c] = c === fuente ? PARAMS.flujo : -PARAMS.flujo / (nC - 1);
    // Laplaciano con conductancias g = D/L (más un pequeño término para fijar la presión)
    diag.fill(1e-6);
    for (let k = 0; k < m; k++) {
      const g = D[k] / red.largo[k];
      diag[red.a[k]] += g;
      diag[red.b[k]] += g;
    }
    const mult = (v: Float64Array, out: Float64Array) => {
      for (let i = 0; i < n; i++) out[i] = diag[i] * v[i];
      for (let k = 0; k < m; k++) {
        const g = D[k] / red.largo[k];
        const i = red.a[k];
        const j = red.b[k];
        out[i] -= g * v[j];
        out[j] -= g * v[i];
      }
    };
    // Gradiente conjugado con precondicionador de Jacobi (parte de la presión del paso anterior)
    mult(p, Ap);
    for (let i = 0; i < n; i++) {
      r[i] = b[i] - Ap[i];
      z[i] = r[i] / diag[i];
      d[i] = z[i];
    }
    let rz = 0;
    for (let i = 0; i < n; i++) rz += r[i] * z[i];
    for (let it = 0; it < 400 && rz > 1e-14; it++) {
      mult(d, Ap);
      let dAd = 0;
      for (let i = 0; i < n; i++) dAd += d[i] * Ap[i];
      const alfa = rz / dAd;
      let nuevo = 0;
      for (let i = 0; i < n; i++) {
        p[i] += alfa * d[i];
        r[i] -= alfa * Ap[i];
        z[i] = r[i] / diag[i];
        nuevo += r[i] * z[i];
      }
      const beta = nuevo / rz;
      rz = nuevo;
      for (let i = 0; i < n; i++) d[i] = z[i] + beta * d[i];
    }
    // dD/dt = f(|Q|) − D
    const Dn = new Float64Array(m);
    for (let k = 0; k < m; k++) {
      const q = Math.abs((D[k] / red.largo[k]) * (p[red.a[k]] - p[red.b[k]])) * PARAMS.separacion;
      const f = q ** PARAMS.gamma / (1 + q ** PARAMS.gamma);
      Dn[k] = Math.max(0, D[k] + PARAMS.dt * (f - D[k]));
    }
    D = Dn;
    historia.push(Float32Array.from(D));
  }
  return historia;
}

/** Tubos que quedan (D por encima de `umbral`). */
export const vivos = (D: Float32Array, umbral = 0.05) => [...D].map((v, k) => (v > umbral ? k : -1)).filter((k) => k >= 0);

/** ¿Están las 36 ciudades conectadas con Tokio por tubos vivos? */
export function conectadas(red: Red, D: Float32Array, umbral = 0.05): boolean[] {
  const n = red.x.length;
  const vecinos: number[][] = Array.from({length: n}, () => []);
  for (const k of vivos(D, umbral)) {
    vecinos[red.a[k]].push(red.b[k]);
    vecinos[red.b[k]].push(red.a[k]);
  }
  const visto = new Uint8Array(n);
  visto[0] = 1;
  const cola = [0];
  for (let k = 0; k < cola.length; k++) for (const v of vecinos[cola[k]]) if (!visto[v]) {
    visto[v] = 1;
    cola.push(v);
  }
  return CIUDADES.map((_, c) => Boolean(visto[c]));
}

/** Largo total de los tubos vivos y el del árbol mínimo que une las 36 ciudades en línea recta (Prim). */
export function costos(red: Red, D: Float32Array, umbral = 0.05) {
  const total = vivos(D, umbral).reduce((s, k) => s + red.largo[k], 0);
  const nC = CIUDADES.length;
  const en = new Uint8Array(nC);
  const mejor = new Float64Array(nC).fill(Infinity);
  mejor[0] = 0;
  let arbol = 0;
  for (let it = 0; it < nC; it++) {
    let u = -1;
    for (let i = 0; i < nC; i++) if (!en[i] && (u < 0 || mejor[i] < mejor[u])) u = i;
    en[u] = 1;
    arbol += mejor[u];
    for (let v = 0; v < nC; v++) if (!en[v]) mejor[v] = Math.min(mejor[v], Math.hypot(red.x[u] - red.x[v], red.y[u] - red.y[v]));
  }
  return {total, arbol, malla: red.largo.reduce((s, v) => s + v, 0)};
}
