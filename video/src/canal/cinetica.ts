// Tipografía cinética, en el pulso. Funciones de dibujo puras (sin React).
//
//   · textoLetras(): el texto aparece letra a letra, una por división del pulso (semicorchea por
//     defecto), cada letra como un sello pequeño. momentosLetras() da los mismos instantes al sonido.
//   · textoBarrido(): una barra de tinta crece sobre el texto y, al retirarse, lo deja descubierto.
//   · rotulo(): etiqueta en Space Mono sobre una tira de papel que entra deslizándose y rebota.
import {cobertura, recortarPapel, type Capas} from './capas';
import {entradaSalidaCubica, limitar01, salidaRebote, tramo} from './curvas';
import {mezclar, trazarRectIrregular} from './dibujo';
import type {NombreTinta} from './fondos';
import {ANCHO} from './diseno';
import {fuente, MONO} from './fuentes';
import type {Pulso} from './pulso';

/** Segundos que tarda cada letra en asentarse. */
const ASIENTO = 0.1;

/** Instantes en que aparece cada letra visible (los espacios no cuentan). */
export function momentosLetras(texto: string, inicio: number, pulso: Pulso, division = 0.25): number[] {
  const paso = pulso.negra * division;
  const momentos: number[] = [];
  let k = 0;
  for (const c of texto) {
    if (c.trim()) momentos.push(inicio + k * paso);
    k += c.trim() ? 1 : 0;
  }
  return momentos;
}

/**
 * Dibuja el texto letra a letra con la fuente actual de `ctx`, alineado como `ctx.textAlign`
 * ('left' o 'center') y con la línea base actual. Cada letra entra con un leve sobretamaño.
 */
export function textoLetras(
  ctx: CanvasRenderingContext2D,
  texto: string,
  x: number,
  y: number,
  t: number,
  inicio: number,
  pulso: Pulso,
  division = 0.25,
): void {
  const momentos = momentosLetras(texto, inicio, pulso, division);
  const total = ctx.measureText(texto).width;
  const izquierda = ctx.textAlign === 'center' ? x - total / 2 : x;
  const alinear = ctx.textAlign;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.fillStyle = cobertura(1);
  let k = 0;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (!c.trim()) continue;
    const m = momentos[k++];
    if (t < m) break;
    const q = tramo(t, m, ASIENTO);
    const escala = mezclar(1.35, 1, salidaRebote(q, 2.4));
    const xi = izquierda + ctx.measureText(texto.slice(0, i)).width;
    const wi = ctx.measureText(c).width;
    ctx.save();
    ctx.translate(xi + wi / 2, y);
    ctx.scale(escala, escala);
    ctx.fillText(c, -wi / 2, 0);
    ctx.restore();
  }
  ctx.restore();
  ctx.textAlign = alinear;
}

/**
 * Descubre el texto con una barra de tinta: en la primera mitad de `p` la barra crece de izquierda
 * a derecha tapando el hueco; en la segunda se retira hacia la derecha y deja el texto impreso.
 * El texto va con la fuente actual de `ctxTexto` (alineado a la izquierda en x, centrado en y).
 */
export function textoBarrido(
  capas: Capas,
  ctxTexto: CanvasRenderingContext2D,
  texto: string,
  x: number,
  y: number,
  p: number,
  op: {tinta?: NombreTinta; alto?: number; semilla?: number; margen?: number} = {},
): void {
  if (p <= 0) return;
  const ancho = ctxTexto.measureText(texto).width;
  const margen = op.margen ?? 16;
  const alto = op.alto ?? 120;
  const x0 = x - margen;
  const w = ancho + margen * 2;
  const frente = x0 + w * entradaSalidaCubica(limitar01(p * 2));
  const cola = x0 + w * entradaSalidaCubica(limitar01(p * 2 - 1));
  // Texto: solo a la izquierda de la cola (lo ya descubierto)
  if (cola > x0) {
    ctxTexto.save();
    ctxTexto.beginPath();
    ctxTexto.rect(x0 - 4, y - alto, cola - x0 + 4, alto * 2);
    ctxTexto.clip();
    ctxTexto.textAlign = 'left';
    ctxTexto.textBaseline = 'middle';
    ctxTexto.fillStyle = cobertura(1);
    ctxTexto.fillText(texto, x, y);
    ctxTexto.restore();
  }
  // Barra (en la capa sólida: borde nítido que corta la letra)
  if (frente - cola > 2) {
    const barra = {x: cola, y: y - alto / 2, w: frente - cola, h: alto};
    const semilla = op.semilla ?? 21;
    recortarPapel(capas, (c) => trazarRectIrregular(c, barra, semilla, 2));
    const ctx = capas.solido[op.tinta ?? 'a'];
    ctx.fillStyle = cobertura(1);
    trazarRectIrregular(ctx, barra, semilla, 2);
    ctx.fill();
  }
}

/**
 * Rótulo: texto en Space Mono sobre una tira de papel con un cuadrito de tinta, que entra desde
 * un lado con rebote. `p` (0…1) es la entrada; `salida` (0…1) lo devuelve por donde vino.
 */
export function rotulo(
  capas: Capas,
  texto: string,
  x: number,
  y: number,
  p: number,
  op: {tam?: number; desde?: 'izquierda' | 'derecha'; tinta?: NombreTinta; salida?: number; semilla?: number} = {},
): void {
  const k = capas.solido.k;
  const tam = op.tam ?? 38;
  k.font = fuente(MONO, tam, 700);
  const ancho = k.measureText(texto).width;
  const caja = tam * 0.62;
  const w = ancho + caja + tam * 1.4;
  const h = tam * 1.7;
  const lado = op.desde === 'derecha' ? 1 : -1;
  const fuera = lado < 0 ? -(x + w + 40) : ANCHO - x + 40;
  const avance = salidaRebote(p, 1.2) - entradaSalidaCubica(op.salida ?? 0);
  const dx = fuera * (1 - avance);
  const semilla = op.semilla ?? 31;
  const tira = {x: x + dx, y: y - h / 2, w, h};
  recortarPapel(capas, (c) => trazarRectIrregular(c, tira, semilla, 2));
  // Marco fino en negro y cuadrito de tinta
  k.lineWidth = 3;
  k.strokeStyle = cobertura(1);
  trazarRectIrregular(k, tira, semilla + 1, 2);
  k.stroke();
  const tinta = capas.solido[op.tinta ?? 'a'];
  tinta.fillStyle = cobertura(1);
  trazarRectIrregular(tinta, {x: tira.x + tam * 0.5, y: y - caja / 2, w: caja, h: caja}, semilla + 2, 1.5);
  tinta.fill();
  k.fillStyle = cobertura(1);
  k.textAlign = 'left';
  k.textBaseline = 'middle';
  k.fillText(texto, tira.x + tam * 0.9 + caja, y + 2);
}
