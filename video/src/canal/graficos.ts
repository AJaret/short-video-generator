// Gráficos que laten con la música. Funciones de dibujo puras (sin React): el sketch decide en qué
// capa van y cuándo; el tiempo siempre sale del pulso.
//
//   · estallido():     rayos que salen disparados de un punto y se recogen (en un golpe).
//   · trazarEstrella(): estrella de puntas irregulares (para sellos y destellos).
//   · ondas():         un anillo nace en cada tiempo y se expande adelgazando.
//   · marcasRegistro(): las cruces de registro de la imprenta, impresas en las tres planchas: el
//     desajuste de registro las separa en tres colores y saltan con el golpe riso.
//   · nubeParticulas(): puntos dispersos que vuelan a formar una figura.
import {cobertura, type Capas} from './capas';
import {limitar01, salidaCubica, salidaExpo, entradaCubica} from './curvas';
import {trazarCirculoIrregular, trazarLineaIrregular, trazarPoligonoIrregular} from './dibujo';
import {ALTO, ANCHO, SEGURA} from './diseno';
import {hash01} from './prng';
import type {Pulso} from './pulso';

/**
 * Estallido de rayos en (cx, cy). `p` es la vida del estallido (0…1): los rayos salen muy rápido,
 * y la base los alcanza al final (se recogen hacia fuera). Dibuja en `ctx` con cobertura 1.
 */
export function estallido(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radio: number,
  p: number,
  op: {rayos?: number; semilla?: number; grosor?: number; giro?: number} = {},
): void {
  if (p <= 0 || p >= 1) return;
  const rayos = op.rayos ?? 12;
  const semilla = op.semilla ?? 1;
  const grosor = op.grosor ?? radio * 0.09;
  const punta = salidaExpo(p * 1.4);
  const base = entradaCubica(p);
  ctx.fillStyle = cobertura(1);
  ctx.beginPath();
  for (let i = 0; i < rayos; i++) {
    const largo = 0.7 + 0.3 * hash01(semilla, i);
    const ang = (op.giro ?? 0) + (i / rayos) * Math.PI * 2 + (hash01(semilla, i, 7) - 0.5) * 0.25;
    const r1 = radio * largo * (0.25 + 0.75 * punta);
    const r0 = Math.min(r1, radio * largo * (0.18 + 0.82 * base));
    if (r1 - r0 < 2) continue;
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    const w0 = (grosor * (1 - base * 0.5)) / 2;
    const w1 = w0 * 0.35;
    ctx.moveTo(cx + ux * r0 - uy * w0, cy + uy * r0 + ux * w0);
    ctx.lineTo(cx + ux * r1 - uy * w1, cy + uy * r1 + ux * w1);
    ctx.lineTo(cx + ux * r1 + uy * w1, cy + uy * r1 - ux * w1);
    ctx.lineTo(cx + ux * r0 + uy * w0, cy + uy * r0 - ux * w0);
    ctx.closePath();
  }
  ctx.fill();
}

/** Traza (sin rellenar) una estrella de `puntas` puntas con vértices temblorosos. */
export function trazarEstrella(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radio: number,
  puntas: number,
  semilla: number,
  giro = 0,
  interior = 0.55,
): void {
  trazarPoligonoIrregular(ctx, cx, cy, radio, puntas, semilla, giro, interior, radio * 0.06);
}

/**
 * Ondas concéntricas: en cada tiempo (desde `desde`) nace un anillo en (cx, cy) que crece hasta
 * `radioMax` en `vida` negras, adelgazando. Trazo en `ctx` (mejor una capa sólida).
 */
export function ondas(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  t: number,
  pulso: Pulso,
  op: {radioMax?: number; vida?: number; grosor?: number; desde?: number; hasta?: number; division?: number; semilla?: number} = {},
): void {
  const radioMax = op.radioMax ?? 600;
  const vida = (op.vida ?? 2) * pulso.negra;
  const grosor = op.grosor ?? 14;
  const paso = (op.division ?? 1) * pulso.negra;
  const desde = op.desde ?? 0;
  const hasta = op.hasta ?? Infinity;
  const primero = Math.max(Math.ceil((desde - 1e-6) / paso), Math.ceil((t - vida) / paso));
  for (let k = primero; k * paso <= Math.min(t, hasta) + 1e-6; k++) {
    const edad = (t - k * paso) / vida;
    if (edad < 0 || edad >= 1) continue;
    const r = 24 + (radioMax - 24) * salidaCubica(edad);
    const w = grosor * (1 - edad);
    if (w < 2) continue;
    ctx.lineWidth = w;
    ctx.strokeStyle = cobertura(1);
    trazarCirculoIrregular(ctx, cx, cy, r, (op.semilla ?? 1) + k, 3);
    ctx.stroke();
  }
}

/** Una cruz de registro (círculo + cruz) en las tres planchas sólidas. */
export function marcaRegistro(capas: Capas, x: number, y: number, tam = 46, grosor = 4): void {
  for (const ctx of [capas.solido.a, capas.solido.b, capas.solido.k]) {
    ctx.save();
    ctx.lineWidth = grosor;
    ctx.strokeStyle = cobertura(1);
    trazarCirculoIrregular(ctx, x, y, tam * 0.32, 0, 0.6);
    ctx.stroke();
    trazarLineaIrregular(ctx, x - tam / 2, y, x + tam / 2, y, 1, 0.4);
    ctx.stroke();
    trazarLineaIrregular(ctx, x, y - tam / 2, x, y + tam / 2, 2, 0.4);
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * Las cuatro cruces de registro, en las esquinas (dentro de las zonas seguras: son decoración y
 * no importa si la interfaz de la red social las tapa).
 */
export function marcasRegistro(capas: Capas, tam = 46): void {
  const x0 = 70;
  const x1 = ANCHO - 70;
  const y0 = SEGURA.arriba - 70;
  const y1 = ALTO - SEGURA.abajo + 70;
  for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) marcaRegistro(capas, x, y, tam);
}

export type Punto = [number, number];

/** Destinos para nubeParticulas(): `n` puntos repartidos en un círculo (contorno). */
export const enCirculo = (cx: number, cy: number, r: number) => (i: number, n: number): Punto => {
  const a = (i / n) * Math.PI * 2 - Math.PI / 2;
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
};

/** Destinos para nubeParticulas(): rejilla de `columnas` columnas centrada en (cx, cy). */
export const enRejilla = (cx: number, cy: number, columnas: number, separacion: number) => (i: number, n: number): Punto => {
  const filas = Math.ceil(n / columnas);
  const c = i % columnas;
  const f = Math.floor(i / columnas);
  return [cx + (c - (columnas - 1) / 2) * separacion, cy + (f - (filas - 1) / 2) * separacion];
};

/**
 * Nube de partículas: `n` puntos salen de posiciones dispersas (en la región `origen`) y vuelan a
 * `destino(i, n)`. `p` (0…1) es el avance del vuelo; cada partícula sale con un pequeño retraso.
 * Con `desde` (otra función de destino) vuela de una figura a otra.
 */
export function nubeParticulas(
  ctx: CanvasRenderingContext2D,
  n: number,
  p: number,
  destino: (i: number, n: number) => Punto,
  op: {semilla?: number; tam?: number; desde?: (i: number, n: number) => Punto; origen?: {x: number; y: number; w: number; h: number}} = {},
): void {
  const semilla = op.semilla ?? 1;
  const tam = op.tam ?? 12;
  const origen = op.origen ?? {x: 0, y: SEGURA.arriba, w: ANCHO, h: ALTO - SEGURA.arriba - SEGURA.abajo};
  ctx.fillStyle = cobertura(1);
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const [x0, y0] = op.desde ? op.desde(i, n) : [origen.x + hash01(semilla, i, 1) * origen.w, origen.y + hash01(semilla, i, 2) * origen.h];
    const [x1, y1] = destino(i, n);
    const retraso = hash01(semilla, i, 3) * 0.35;
    const q = salidaCubica(limitar01((p - retraso) / 0.65));
    const x = x0 + (x1 - x0) * q;
    const y = y0 + (y1 - y0) * q;
    const r = (tam / 2) * (0.8 + 0.4 * hash01(semilla, i, 4));
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }
  ctx.fill();
}

/** Destinos para nubeParticulas(): espiral de girasol (ángulo áureo, 137,5°), radio = escala·√i. */
export const enEspiral = (cx: number, cy: number, escala: number) => (i: number): Punto => {
  const a = i * 2.399963229728653;
  const r = escala * Math.sqrt(i + 0.5);
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
};
