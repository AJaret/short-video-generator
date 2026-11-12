// nº06 · Línea de tiempo y modelo del bosque. Módulo PURO (sin React): lo usan la animación
// (Sketch.tsx) y el sonido (sonido.ts), así el fuego suena cuando avanza.
//
//   portada (0–2,6 s)            el gancho: el fuego sube a toda velocidad por el bosque de 59 % (el
//                                fotograma 0 lo muestra intacto, igual que el último)
//   55 % (→ "con sesenta y…")    el fuego empieza abajo, de cerca salta vecino a vecino, y se ahoga
//   65 % (→ "y en medio")        cruza todo, rápido
//   gráfica (→ "justo ahí")      probabilidad de cruzar medida (video y grande); bosques miniatura que
//                                arden en 57 % y en 61 %; el salto en 59 %
//   59 % (→ "los físicos")       cruza por un camino estrecho y deja casi la mitad en pie
//   57 % vs 61 % (→ "entonces")  el mismo bosque con 4 árboles más de cada 100: uno se apaga, el otro cruza
//   final (→ fin)                el bosque de la portada; la densidad sube y baja ("¿cuántos plantarías?")
//
// Datos: bosques.json (verificar.py): los tres bosques, su campo de azar y las curvas medidas.
import {DURACION_PORTADA} from '@canal/diseno';
import {cuantizar, type Pulso} from '@canal/pulso';
import {tiempoDeAncla} from '@canal/tiempos';
import type {Tiempos} from '@canal/tipos';
import {mulberry32} from '@canal/prng';
import datos from './bosques.json';

export const ANCHO = datos.ancho;
export const ALTO = datos.alto;
export type Nombre = '55' | '59' | '65';

export const fase = (t: number, a: number, b: number) => Math.max(0, Math.min(1, (t - a) / Math.max(0.01, b - a)));
const suave = (x: number) => 1 - (1 - Math.max(0, Math.min(1, x))) ** 3;

export type Linea = {
  azar: number;
  incendio: number;
  vecino: number;
  noHay: number;
  con55: number;
  ahoga: number;
  con65: number;
  medio: number;
  grande: number;
  c57: number;
  c61: number;
  c59: number;
  justo: number;
  estrechito: number;
  enPie: number;
  fisicos: number;
  cambio: number;
  golpe: number;
  entonces: number;
  fin: number;
};

export function linea(tiempos: Tiempos | null, fin: number): Linea {
  const a = (s: string, d: number) => tiempoDeAncla(tiempos, s) ?? d;
  return {
    azar: a('puestos al azar', 2.64),
    incendio: a('empieza un incendio', 4.92),
    vecino: a('el fuego solo salta', 8.26),
    noHay: a('si no hay vecino', 11.2),
    con55: a('con cincuenta y cinco', 13.4),
    ahoga: a('se ahoga solo', 19.06),
    con65: a('con sesenta y cinco', 20.38),
    medio: a('y en medio', 23.42),
    grande: a('en un bosque grande', 24.6),
    c57: a('cincuenta y siete', 26.12),
    c61: a('sesenta y uno', 29.3),
    c59: a('cincuenta y nueve', 32.92),
    justo: a('justo ahí', 34.26),
    estrechito: a('camino estrechito', 36.38),
    enPie: a('en pie', 39.74),
    fisicos: a('los físicos', 40.64),
    cambio: a('un cambio pequeñito', 43.74),
    golpe: a('todo cambia de golpe', 45.2),
    entonces: a('entonces', 47.04),
    fin,
  };
}

// ── El fuego ──────────────────────────────────────────────────────────────────────────────────

export type Bosque = {arbol: Uint8Array; pasos: Int16Array; total: number; cruza: boolean; ancho: number; alto: number};

/** Incendio desde la fila de abajo, vecinos en cruz (el mismo modelo que verificar.py). */
export function quemar(arbol: Uint8Array, ancho: number, alto: number): Bosque {
  const pasos = new Int16Array(ancho * alto).fill(-1);
  const cola: number[] = [];
  for (let x = 0; x < ancho; x++) {
    const i = (alto - 1) * ancho + x;
    if (arbol[i]) {
      pasos[i] = 0;
      cola.push(i);
    }
  }
  let total = 0;
  for (let k = 0; k < cola.length; k++) {
    const i = cola[k];
    const y = Math.floor(i / ancho);
    const x = i % ancho;
    for (const [dy, dx] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ny = y + dy;
      const nx = x + dx;
      if (ny < 0 || ny >= alto || nx < 0 || nx >= ancho) continue;
      const j = ny * ancho + nx;
      if (arbol[j] && pasos[j] < 0) {
        pasos[j] = pasos[i] + 1;
        total = Math.max(total, pasos[j]);
        cola.push(j);
      }
    }
  }
  let cruza = false;
  for (let x = 0; x < ancho; x++) if (pasos[x] >= 0) cruza = true;
  return {arbol, pasos, total, cruza, ancho, alto};
}

const cache = new Map<string, Bosque>();
/** Bosque del video con densidad `p` sobre el campo de azar de `nombre` (con p = la suya, el de verificar.py). */
export function bosqueDe(nombre: Nombre, p = datos[nombre].p): Bosque {
  const clave = `${nombre}:${p.toFixed(4)}`;
  const hecho = cache.get(clave);
  if (hecho) return hecho;
  const campo = datos[nombre].campo as number[];
  const arbol = new Uint8Array(campo.length);
  for (let i = 0; i < campo.length; i++) arbol[i] = campo[i] < p * 10000 ? 1 : 0;
  const b = quemar(arbol, ANCHO, ALTO);
  if (cache.size > 64) cache.clear();
  cache.set(clave, b);
  return b;
}

/**
 * Los dos bosques del final de la explicación: el MISMO campo de azar de 100×100 con 57 % y con 61 %
 * (el segundo solo añade árboles). Se busca la primera semilla con la que el de 57 % se apaga y el de
 * 61 % cruza (determinista).
 */
export function gemelos(): {b57: Bosque; b61: Bosque; semilla: number} {
  const n = 100;
  for (let semilla = 1; semilla < 500; semilla++) {
    const azar = mulberry32(semilla * 7919);
    const campo = new Float64Array(n * n);
    for (let i = 0; i < campo.length; i++) campo[i] = azar();
    const a = new Uint8Array(n * n);
    const b = new Uint8Array(n * n);
    for (let i = 0; i < campo.length; i++) {
      a[i] = campo[i] < 0.57 ? 1 : 0;
      b[i] = campo[i] < 0.61 ? 1 : 0;
    }
    const b57 = quemar(a, n, n);
    const b61 = quemar(b, n, n);
    if (!b57.cruza && b61.cruza) return {b57, b61, semilla};
  }
  throw new Error('Sin gemelos');
}

/**
 * Paso del fuego que se ve en `t`, por escena (−1 = aún no hay fuego). En el de 55 %: chispas desde
 * "empieza un incendio", un paso por corchea de cerca ("salta de un árbol a su vecino") y luego se
 * acelera hasta ahogarse justo en "se ahoga solo".
 */
export function pasoEn(t: number, l: Linea, pulso: Pulso, nombre: Nombre): number {
  const corchea = pulso.negra / 2;
  if (nombre === '55') {
    const total = bosqueDe('55').total;
    if (t < l.incendio) return -1;
    const lento = cuantizar(l.vecino, pulso, 0.5, 'siguiente');
    if (t < lento) return 0;
    const lentos = Math.floor((l.con55 - lento) / corchea);
    if (t < l.con55) return Math.min(lentos, Math.floor((t - lento) / corchea));
    return lentos + (total - lentos) * suave(fase(t, l.con55, l.ahoga + 0.3));
  }
  if (nombre === '65') return t < l.con65 ? -1 : bosqueDe('65').total * fase(t, l.con65 + 0.1, l.medio - 0.3);
  // 59: cruza justo en "estrechito"
  return t < l.justo ? -1 : bosqueDe('59').total * fase(t, l.justo + 0.1, l.estrechito + 0.4);
}

/** Los gemelos arden a la vez: el de 61 % cruza justo en "todo cambia de golpe". */
export function pasoGemelos(t: number, l: Linea, total61: number): number {
  return t < l.fisicos + 0.6 ? -1 : total61 * fase(t, l.fisicos + 0.6, l.golpe + 0.2);
}

/** Densidad del final: sube y baja ("¿cuántos plantarías?") y vuelve al 59 % de la portada. */
export function densidadFinal(t: number, l: Linea): number {
  const x = fase(t, l.entonces + 0.3, l.fin - 0.4);
  return 0.59 + 0.13 * Math.sin(x * Math.PI * 2) * Math.sin(x * Math.PI);
}

/** Portada: el fuego sube a toda velocidad por el bosque de 59 % (−1 en el fotograma 0). */
export function pasoPortada(t: number): number {
  return t < 0.12 ? -1 : bosqueDe('59').total * fase(t, 0.12, DURACION_PORTADA - 0.15);
}

/**
 * Bosques miniatura de la gráfica: seis campos de 100×100 con 57 % y los MISMOS con 61 % (deterministas).
 * Arden a la vez cuando la voz dice cada número; casi todos los de 57 % se apagan y los de 61 % cruzan.
 */
export function minis(): {b57: Bosque[]; b61: Bosque[]} {
  const n = 100;
  const b57: Bosque[] = [];
  const b61: Bosque[] = [];
  for (let k = 0; k < 6; k++) {
    const azar = mulberry32(9001 + k * 131);
    const a = new Uint8Array(n * n);
    const b = new Uint8Array(n * n);
    for (let i = 0; i < n * n; i++) {
      const v = azar();
      a[i] = v < 0.57 ? 1 : 0;
      b[i] = v < 0.61 ? 1 : 0;
    }
    b57.push(quemar(a, n, n));
    b61.push(quemar(b, n, n));
  }
  return {b57, b61};
}
/** Duración del ardor de cada fila de miniaturas (s). */
export const ARDOR_MINIS = 1.4;

export const enPortadaEn = (t: number, l: Linea) => t < DURACION_PORTADA || t >= l.entonces;
export const cortes = (l: Linea) => [l.con65, l.medio, l.justo, l.fisicos, l.entonces];
export const curvas = datos.curvas as {video: number[]; grande: number[]};
