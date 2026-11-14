// Detalles que acompañan a la cámara y al pulso (la capa "técnica" de los reels de referencia:
// cuadrículas, miras, marcos de encuadre, lecturas de datos que cambian, golpes de registro).
// Funciones de dibujo puras; el sketch decide capa y momento.
//
//   · cuadricula():  cruces de una retícula en el MUNDO (dentro de conCamara): al moverse la cámara
//                    se mueve el papel, y eso hace legible un zoom aunque el dibujo sea fino.
//   · mira():        círculo partido con cuatro marcas, que entra con rebote y gira despacio.
//   · marcoEsquinas(): las cuatro esquinas de un visor que se cierran sobre lo importante.
//   · lectura():     un dato en Space Mono (etiqueta + valor) para contadores que no paran.
//   · sacudirRegistro(): desajuste exagerado de las tintas durante ~3 fotogramas (el "glitch" riso).
//   · fuenteEnPantalla(): la fuente oficial de lo que cuenta la voz (un estudio, un dato), arriba.
import {cobertura, recortarPapel, type Capas} from './capas';
import {limitar01, salidaCubica, salidaRebote} from './curvas';
import {ANCHO, ALTO, type Rect} from './diseno';
import {MONO, fuente} from './fuentes';
import type {Toma} from './camara';

/**
 * Cruces de retícula cada `paso` px del dibujo, solo en lo que se ve con la toma. Se llama DENTRO
 * de conCamara(): el grosor y el tamaño se corrigen por el zoom para que en pantalla midan igual.
 */
export function cuadricula(
  ctx: CanvasRenderingContext2D,
  toma: Toma,
  op: {paso?: number; tam?: number; grosor?: number; margen?: number} = {},
): void {
  const paso = op.paso ?? 120;
  const tam = (op.tam ?? 9) / toma.zoom;
  // Esquinas visibles en coordenadas del dibujo (sin giro: el margen cubre giros pequeños)
  const margen = (op.margen ?? 200) / toma.zoom;
  const x0 = toma.px - (toma.px + toma.dx) / toma.zoom - margen;
  const x1 = toma.px + (ANCHO - toma.px - toma.dx) / toma.zoom + margen;
  const y0 = toma.py - (toma.py + toma.dy) / toma.zoom - margen;
  const y1 = toma.py + (ALTO - toma.py - toma.dy) / toma.zoom + margen;
  ctx.save();
  ctx.strokeStyle = cobertura(1);
  ctx.lineWidth = (op.grosor ?? 2.5) / toma.zoom;
  ctx.beginPath();
  for (let x = Math.ceil(x0 / paso) * paso; x <= x1; x += paso) {
    for (let y = Math.ceil(y0 / paso) * paso; y <= y1; y += paso) {
      ctx.moveTo(x - tam, y);
      ctx.lineTo(x + tam, y);
      ctx.moveTo(x, y - tam);
      ctx.lineTo(x, y + tam);
    }
  }
  ctx.stroke();
  ctx.restore();
}

/** Mira en (x, y): `p` (0…1) es su entrada, con rebote; `giro` en rad. Trazo en `ctx` (capa sólida). */
export function mira(ctx: CanvasRenderingContext2D, x: number, y: number, radio: number, p: number, giro = 0, grosor = 3): void {
  if (p <= 0) return;
  const r = radio * (0.4 + 0.6 * salidaRebote(p));
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(giro);
  ctx.strokeStyle = cobertura(1);
  ctx.lineWidth = grosor;
  ctx.beginPath();
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    ctx.moveTo(Math.cos(a + 0.22) * r, Math.sin(a + 0.22) * r);
    ctx.arc(0, 0, r, a + 0.22, a + Math.PI / 2 - 0.22);
    ctx.moveTo(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78);
    ctx.lineTo(Math.cos(a) * r * 1.22, Math.sin(a) * r * 1.22);
  }
  ctx.stroke();
  ctx.restore();
}

/** Esquinas de visor alrededor de `rect`: entran desde fuera (`p` 0…1, con rebote). */
export function marcoEsquinas(ctx: CanvasRenderingContext2D, rect: Rect, p: number, op: {largo?: number; grosor?: number; desde?: number} = {}): void {
  if (p <= 0) return;
  const largo = op.largo ?? 46;
  const fuera = (op.desde ?? 90) * (1 - salidaRebote(limitar01(p)));
  ctx.save();
  ctx.strokeStyle = cobertura(1);
  ctx.lineWidth = op.grosor ?? 5;
  ctx.lineCap = 'square';
  ctx.beginPath();
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const x = rect.x + (sx > 0 ? rect.w : 0) + sx * fuera;
    const y = rect.y + (sy > 0 ? rect.h : 0) + sy * fuera;
    ctx.moveTo(x - sx * largo, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y - sy * largo);
  }
  ctx.stroke();
  ctx.restore();
}

/** Lectura de un dato: etiqueta pequeña y valor (Space Mono). `alinear` como textAlign. */
export function lectura(
  ctx: CanvasRenderingContext2D,
  etiqueta: string,
  valor: string,
  x: number,
  y: number,
  op: {tam?: number; alinear?: CanvasTextAlign} = {},
): void {
  const tam = op.tam ?? 30;
  ctx.save();
  ctx.fillStyle = cobertura(1);
  ctx.textAlign = op.alinear ?? 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = fuente(MONO, Math.round(tam * 0.62), 400);
  ctx.fillText(etiqueta, x, y - tam * 1.05);
  ctx.font = fuente(MONO, tam, 700);
  ctx.fillText(valor, x, y);
  ctx.restore();
}

/**
 * Golpe de registro: durante `duracion` s tras cada momento, las tintas A y B se separan `px` más
 * (en sus sentidos fijos) y vuelven. Lo aplica <RisoFilter> después de dibujar.
 */
export function sacudirRegistro(capas: Capas, t: number, momentos: number[], px = 9, duracion = 0.1): void {
  for (const m of momentos) {
    const d = t - m;
    if (d >= 0 && d < duracion) capas.golpeRegistro = Math.max(capas.golpeRegistro ?? 0, px * (1 - d / duracion));
  }
}

/**
 * La fuente oficial de lo que cuenta la voz ("unos investigadores…", un dato, un premio), en pantalla
 * aunque la voz no la diga (pedido del usuario, 2026-11-13). Una línea en Space Mono sobre una tira de
 * papel, arriba a la izquierda, justo debajo de la numeración ("nº XX"), dentro de las zonas seguras.
 * `p` (0…1) es su entrada: se desliza desde la izquierda. Ejemplo:
 *   fuenteEnPantalla(capas, 'Tero y otros, Science 327, 439 (2010)', fase(t, desde, desde + 0.4))
 */
export function fuenteEnPantalla(capas: Capas, texto: string, p: number): void {
  if (p <= 0) return;
  const k = capas.solido.k;
  const a = capas.solido.a;
  // Guarda y restaura el estado del texto: si no, el textBaseline 'top' se queda puesto y desplaza
  // todo el texto que se dibuje después en esas capas (pasó en las cifras de nº08)
  k.save();
  a.save();
  const tam = 24;
  k.font = fuente(MONO, tam, 700);
  const etiqueta = 'fuente ';
  const anchoEtiqueta = k.measureText(etiqueta).width;
  const ancho = anchoEtiqueta + k.measureText(texto).width;
  const x = 60;
  const y = 284;
  const dx = -(1 - salidaCubica(p)) * (x + ancho + 40);
  recortarPapel(capas, (ctx) => {
    ctx.beginPath();
    ctx.rect(x - 12 + dx, y - 8, ancho + 24, tam + 18);
  });
  k.fillStyle = cobertura(1);
  k.textBaseline = 'top';
  k.fillText(texto, x + anchoEtiqueta + dx, y);
  a.font = fuente(MONO, tam, 700);
  a.fillStyle = cobertura(1);
  a.textBaseline = 'top';
  a.fillText(etiqueta, x + dx, y);
  k.restore();
  a.restore();
}
