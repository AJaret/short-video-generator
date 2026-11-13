// nº07 · Línea de tiempo y autómata de la Regla 30. Módulo PURO (sin React): lo usan la animación
// (Sketch.tsx) y el sonido (sonido.ts), así cada fila, cada caso y cada bit suenan cuando se ven.
//
//   portada (0–2,6 s)             la concha (esquema); una línea rosa la recorre de arriba abajo
//   concha (→ "el caracol crece") triángulos que parecen al azar
//   borde (→ "ahora mira")        la concha se vuelve a pintar fila a fila, con el borde en rosa
//   regla (→ "empezamos")         una fila de casillas grandes: cada casilla nueva mira tres; los 8
//                                 casos; 00011110 = 30
//   punto (→ "su columna")        desde un solo punto negro, fila a fila; la cámara se aleja: triángulos
//   columna (→ "y hay un premio") la columna del centro en rosa; sus bits, de ocho en ocho, son números
//   premio (→ "y el caracol")     la cámara baja por la columna mil filas: nunca se repite (que se sepa)
//   final (→ fin)                 la concha de la portada (loop)
import {DURACION_PORTADA} from '@canal/diseno';
import {cuantizar, type Pulso} from '@canal/pulso';
import {tiempoDeAncla} from '@canal/tiempos';
import type {Tiempos} from '@canal/tipos';
import {mulberry32} from '@canal/prng';

export const fase = (t: number, a: number, b: number) => Math.max(0, Math.min(1, (t - a) / Math.max(0.01, b - a)));
const suave = (x: number) => 1 - (1 - Math.max(0, Math.min(1, x))) ** 3;

export type Linea = {
  triangulos: number;
  quien: number;
  borde: number;
  otra: number;
  cada: number;
  ella: number;
  ocho: number;
  esa: number;
  empezamos: number;
  salen: number;
  conchaDos: number;
  columna: number;
  azar: number;
  premio: number;
  sigue: number;
  caracol: number;
  biologos: number;
  fin: number;
};

export function linea(tiempos: Tiempos | null, fin: number): Linea {
  const a = (s: string, d: number) => tiempoDeAncla(tiempos, s) ?? d;
  return {
    triangulos: a('sus triángulos parecen', 4.3),
    quien: a('quién los pinta', 6.96),
    borde: a('el caracol crece', 8.26),
    otra: a('ahora mira esta otra', 12.48),
    cada: a('cada casilla nueva', 14.46),
    ella: a('ella y sus dos vecinas', 17.34),
    ocho: a('ocho casos', 19.58),
    esa: a('esa es la regla', 22.14),
    empezamos: a('empezamos con un solo', 23.94),
    salen: a('y salen triángulos', 26.3),
    conchaDos: a('como los de la concha', 27.52),
    columna: a('su columna del centro', 28.68),
    azar: a('sacar números al azar', 32.42),
    premio: a('y hay un premio', 34.12),
    sigue: a('sigue sin demostrarse', 39.0),
    caracol: a('y el caracol', 40.76),
    biologos: a('los biólogos', 42.9),
    fin,
  };
}

// ── La Regla 30 ───────────────────────────────────────────────────────────────────────────────

/** Casos en el orden de la tabla (111 … 000) y la respuesta de la Regla 30: 0 0 0 1 1 1 1 0. */
export const CASOS = ['111', '110', '101', '100', '011', '010', '001', '000'];
export const RESPUESTAS = CASOS.map((_, i) => (30 >> (7 - i)) & 1);

/** Nueva casilla: izquierda XOR (centro OR derecha) — es lo mismo que la tabla (verificar.py). */
export const regla30 = (izq: number, cen: number, der: number) => izq ^ (cen | der);

export type Campo = {celdas: Uint8Array; ancho: number; alto: number};

/** Filas de la Regla 30 a partir de `primera` (bordes en blanco). */
export function evolucionar(primera: Uint8Array, alto: number): Campo {
  const ancho = primera.length;
  const celdas = new Uint8Array(ancho * alto);
  celdas.set(primera);
  for (let y = 1; y < alto; y++) {
    const o = (y - 1) * ancho;
    const d = y * ancho;
    for (let x = 0; x < ancho; x++) {
      const izq = x > 0 ? celdas[o + x - 1] : 0;
      const der = x < ancho - 1 ? celdas[o + x + 1] : 0;
      celdas[d + x] = regla30(izq, celdas[o + x], der);
    }
  }
  return {celdas, ancho, alto};
}

/** Desde un solo punto negro en el centro (ancho 2·alto + 1: el patrón nunca toca los bordes). */
export function desdePunto(alto: number): Campo {
  const primera = new Uint8Array(2 * alto + 1);
  primera[alto] = 1;
  return evolucionar(primera, alto);
}

/**
 * El dibujo de la concha (esquema): la Regla 30 desde una fila al azar (con semilla). Se calcula con
 * `alto` casillas de más a cada lado y se recorta el centro: junto a un borde blanco la regla se
 * vuelve regular (rayas) y esa zona avanza una casilla por fila; así nunca entra en la concha.
 */
export function patronConcha(ancho: number, alto: number, semilla: number): Campo {
  const azar = mulberry32(semilla * 977 + 3);
  const total = ancho + 2 * alto;
  const primera = new Uint8Array(total);
  for (let x = 0; x < total; x++) primera[x] = azar() < 0.5 ? 1 : 0;
  const todo = evolucionar(primera, alto);
  const celdas = new Uint8Array(ancho * alto);
  for (let y = 0; y < alto; y++) celdas.set(todo.celdas.subarray(y * total + alto, y * total + alto + ancho), y * ancho);
  return {celdas, ancho, alto};
}

/** La columna del centro (los "números al azar"): los primeros `n` bits. */
export function columnaCentral(campo: Campo, n: number): number[] {
  const c = Math.floor(campo.ancho / 2);
  return Array.from({length: Math.min(n, campo.alto)}, (_, y) => campo.celdas[y * campo.ancho + c]);
}

// ── Ritmos de la animación ────────────────────────────────────────────────────────────────────

/** "Cada casilla nueva solo mira tres": la fila de abajo se llena casilla a casilla, una por semicorchea. */
export const CASILLAS_FILA = 15;
export function escaneo(l: Linea, pulso: Pulso) {
  const semi = pulso.negra / 4;
  const desde = cuantizar(l.cada + 0.9, pulso, 0.25, 'siguiente');
  return {desde, semi, momento: (i: number) => desde + i * semi};
}

/** Los 8 casos entran uno por corchea desde "ocho casos". */
export function momentosCasos(l: Linea, pulso: Pulso): number[] {
  const desde = cuantizar(l.ocho, pulso, 0.5, 'siguiente');
  return CASOS.map((_, i) => desde + i * (pulso.negra / 2));
}

/** Filas visibles desde un punto: una por corchea hasta "y salen triángulos"; luego cientos. */
export const FILAS_PUNTO = 240;
export function filasPunto(t: number, l: Linea, pulso: Pulso): number {
  const desde = cuantizar(l.empezamos, pulso, 0.5, 'siguiente');
  if (t < desde) return 0;
  const corchea = pulso.negra / 2;
  const lentas = Math.max(1, Math.floor((l.salen - desde) / corchea));
  if (t < l.salen) return Math.min(lentas, 1 + Math.floor((t - desde) / corchea));
  return lentas + (FILAS_PUNTO - lentas) * suave(fase(t, l.salen, l.conchaDos + 0.2));
}
/** Zoom de la cámara en la escena del punto: de casillas de 48 px a 4 px mientras salen los triángulos. */
export function zoomPunto(t: number, l: Linea): number {
  return 12 * (1 / 12) ** suave(fase(t, l.salen, l.conchaDos + 0.2));
}

/** Bits de la columna, de ocho en ocho: un byte por negra desde "su columna del centro". */
export function momentosBits(l: Linea, pulso: Pulso) {
  const desde = cuantizar(l.columna + 0.5, pulso, 0.25, 'siguiente');
  const semi = pulso.negra / 4;
  const n = Math.max(8, Math.floor((l.premio - 0.3 - desde) / semi));
  return {desde, semi, n};
}

/** "Nunca se repite": la cámara baja por la columna (fila del centro de la pantalla). */
export const FILAS_BAJADA = 1100;
export function filaBajada(t: number, l: Linea): number {
  return 120 + (FILAS_BAJADA - 220) * suave(fase(t, l.premio + 0.4, l.caracol - 0.2));
}

/** Portada y final: una línea rosa recorre la concha (no en el fotograma 0 ni en el último). */
export function barridoConcha(t: number, l: Linea): number | null {
  if (t > 0.05 && t < DURACION_PORTADA) return fase(t, 0.05, DURACION_PORTADA);
  if (t >= l.caracol && t < l.fin - 0.3) return fase(t, l.caracol, l.fin - 0.3);
  return null;
}

export const enPortadaEn = (t: number, l: Linea) => t < DURACION_PORTADA || t >= l.caracol;
export const cortes = (l: Linea) => [l.borde, l.otra, l.empezamos, l.columna, l.premio, l.caracol];
