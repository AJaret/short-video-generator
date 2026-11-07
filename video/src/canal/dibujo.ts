// Ayudas de dibujo con "bordes imperfectos" (prohibidos los bordes perfectos).
import {hash01} from './prng';
import type {Rect} from './diseno';

/**
 * Traza (sin rellenar) un rectángulo con bordes temblorosos y deterministas.
 * `semilla` fija la forma; cambiarla cada pocos fotogramas da un temblor leve.
 */
export function trazarRectIrregular(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  semilla: number,
  amplitud = 3,
  paso = 28,
): void {
  const puntos: [number, number][] = [];
  const lado = (x0: number, y0: number, x1: number, y1: number, ladoId: number) => {
    const largo = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(2, Math.round(largo / paso));
    // normal hacia fuera
    const nx = (y1 - y0) / largo;
    const ny = -(x1 - x0) / largo;
    for (let i = 0; i < n; i++) {
      const f = i / n;
      const d = (hash01(semilla, ladoId, i) - 0.5) * 2 * amplitud;
      puntos.push([x0 + (x1 - x0) * f + nx * d, y0 + (y1 - y0) * f + ny * d]);
    }
  };
  lado(r.x, r.y, r.x + r.w, r.y, 0);
  lado(r.x + r.w, r.y, r.x + r.w, r.y + r.h, 1);
  lado(r.x + r.w, r.y + r.h, r.x, r.y + r.h, 2);
  lado(r.x, r.y + r.h, r.x, r.y, 3);
  ctx.beginPath();
  puntos.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
}

/** Línea temblorosa (para marcos y ejes). */
export function trazarLineaIrregular(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  semilla: number,
  amplitud = 1.5,
  paso = 24,
): void {
  const largo = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(2, Math.round(largo / paso));
  const nx = (y1 - y0) / largo;
  const ny = -(x1 - x0) / largo;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const d = i === 0 || i === n ? 0 : (hash01(semilla, i) - 0.5) * 2 * amplitud;
    const x = x0 + (x1 - x0) * f + nx * d;
    const y = y0 + (y1 - y0) * f + ny * d;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
}

/** Parte un texto en líneas que caben en `maxAncho` con la fuente actual de ctx. */
export function envolverTexto(ctx: CanvasRenderingContext2D, texto: string, maxAncho: number): string[] {
  const palabras = texto.split(/\s+/).filter(Boolean);
  const lineas: string[] = [];
  let actual = '';
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p;
    if (ctx.measureText(prueba).width <= maxAncho || !actual) actual = prueba;
    else {
      lineas.push(actual);
      actual = p;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

/**
 * Busca el mayor tamaño de fuente (entre max y min) con el que el texto cabe en
 * `maxAncho` y en como mucho `maxLineas` líneas.
 */
export function ajustarTexto(
  ctx: CanvasRenderingContext2D,
  texto: string,
  familia: string,
  maxAncho: number,
  maxLineas: number,
  tamMax: number,
  tamMin: number,
): {tamano: number; lineas: string[]} {
  for (let t = tamMax; t >= tamMin; t -= 4) {
    ctx.font = `400 ${t}px ${familia}`;
    const lineas = envolverTexto(ctx, texto, maxAncho);
    const cabe = lineas.length <= maxLineas && lineas.every((l) => ctx.measureText(l).width <= maxAncho);
    if (cabe) return {tamano: t, lineas};
  }
  ctx.font = `400 ${tamMin}px ${familia}`;
  return {tamano: tamMin, lineas: envolverTexto(ctx, texto, maxAncho)};
}

/** Interpolación lineal. */
export const mezclar = (a: number, b: number, f: number) => a + (b - a) * f;
