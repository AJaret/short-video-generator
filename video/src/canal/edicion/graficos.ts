// Gráficos del estilo "edición" (color directo): la capa técnica de las referencias. Funciones puras
// de dibujo sobre un Canvas 2D; el tiempo siempre llega de fuera (del pulso).
import {SEGURA, SUBTITULO_Y, UTIL} from '../diseno';
import {fuente, MONO, TITULAR} from '../fuentes';
import {hash01} from '../prng';
import {grupoEn, palabraActiva, type Grupo} from '../tiempos';
import {AMBAR, BLANCO, NEGRO, type Tema} from './paleta';

/** Fondo de un color a sangre con cuadrícula de plano técnico (fina + líneas maestras dobles). */
export function fondoRejilla(ctx: CanvasRenderingContext2D, tema: Tema, op: {paso?: number; dx?: number; dy?: number; maestras?: boolean} = {}): void {
  const {width: w, height: h} = ctx.canvas;
  ctx.fillStyle = tema.fondo;
  ctx.fillRect(0, 0, w, h);
  const paso = op.paso ?? 54;
  const dx = (((op.dx ?? 0) % paso) + paso) % paso;
  const dy = (((op.dy ?? 0) % paso) + paso) % paso;
  ctx.lineWidth = 1;
  ctx.strokeStyle = tema.rejilla;
  ctx.beginPath();
  for (let x = dx; x <= w; x += paso) {
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, h);
  }
  for (let y = dy; y <= h; y += paso) {
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(w, Math.round(y) + 0.5);
  }
  ctx.stroke();
  if (op.maestras === false) return;
  // Líneas maestras: una doble cada 5 celdas, como los paneles del plano de la referencia
  const gordo = paso * 5;
  ctx.strokeStyle = tema.rejillaFuerte;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = (((op.dx ?? 0) % gordo) + gordo) % gordo; x <= w; x += gordo) {
    for (const d of [-5, 5]) {
      ctx.moveTo(Math.round(x) + d, 0);
      ctx.lineTo(Math.round(x) + d, h);
    }
  }
  for (let y = (((op.dy ?? 0) % gordo) + gordo) % gordo; y <= h; y += gordo) {
    for (const d of [-5, 5]) {
      ctx.moveTo(0, Math.round(y) + d);
      ctx.lineTo(w, Math.round(y) + d);
    }
  }
  ctx.stroke();
}

/** Destello: estrella de rayos finos y desiguales con un núcleo, como los de la referencia. */
export function destello(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, giro: number, color: string, semilla = 1): void {
  if (r <= 0.5) return;
  const rayos = 9;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < rayos * 2; i++) {
    const ang = giro + (i / (rayos * 2)) * Math.PI * 2;
    const largo = i % 2 === 0 ? r * (0.55 + 0.45 * hash01(semilla, i)) : r * 0.1;
    const px = x + Math.cos(ang) * largo;
    const py = y + Math.sin(ang) * largo;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.16, 0, Math.PI * 2);
  ctx.fill();
}

/** Marco de selección: rectángulo fino con asas cuadradas en las esquinas. */
export function marco(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, grosor = 2, asas = 0): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = grosor;
  ctx.strokeRect(x, y, w, h);
  if (asas > 0) {
    ctx.fillStyle = color;
    for (const [ax, ay] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) ctx.fillRect(ax - asas / 2, ay - asas / 2, asas, asas);
  }
}

/** Etiqueta en caja: texto Space Mono sobre un rectángulo del color contrario. Entra con `p` (0…1). */
export function etiqueta(
  ctx: CanvasRenderingContext2D,
  texto: string,
  x: number,
  y: number,
  p: number,
  op: {tam?: number; fondo?: string; color?: string; marca?: string; alinear?: 'izquierda' | 'derecha'} = {},
): void {
  if (p <= 0) return;
  const tam = op.tam ?? 26;
  ctx.font = fuente(MONO, tam, 700);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const ancho = ctx.measureText(texto).width;
  const margen = tam * 0.5;
  const marca = op.marca ? tam * 0.9 : 0;
  const total = ancho + margen * 2 + marca;
  const alto = tam * 1.7;
  const x0 = op.alinear === 'derecha' ? x - total : x;
  // Se descubre de izquierda a derecha (recorte), sin fundidos
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y - alto / 2 - 1, total * Math.min(1, p) + 1, alto + 2);
  ctx.clip();
  ctx.fillStyle = op.fondo ?? NEGRO;
  ctx.fillRect(x0, y - alto / 2, total, alto);
  if (op.marca) {
    ctx.fillStyle = op.marca;
    ctx.fillRect(x0 + margen, y - tam * 0.3, tam * 0.6, tam * 0.6);
  }
  ctx.fillStyle = op.color ?? BLANCO;
  ctx.fillText(texto, x0 + margen + marca, y + 1);
  ctx.restore();
}

/** Texto Archivo Black solo con contorno (los numerales grandes de la referencia). */
export function textoContorno(ctx: CanvasRenderingContext2D, texto: string, x: number, y: number, tam: number, color: string, grosor = 3): void {
  ctx.font = fuente(TITULAR, tam);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.lineWidth = grosor;
  ctx.strokeText(texto, x, y);
}

/**
 * Subtítulo del estilo "edición": 2–3 palabras en Space Mono sobre una banda negra, palabra activa en
 * ámbar. Misma posición y mismos grupos que el subtítulo riso (tiempos.ts).
 */
export function subtituloEdicion(ctx: CanvasRenderingContext2D, grupos: Grupo[], t: number): void {
  const grupo = grupoEn(grupos, t);
  if (!grupo) return;
  const activa = palabraActiva(grupo, t);
  ctx.font = fuente(MONO, 44, 700);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const espacio = ctx.measureText(' ').width;
  const anchos = grupo.palabras.map((p) => ctx.measureText(p.texto).width);
  const total = anchos.reduce((s, w) => s + w, 0) + espacio * (anchos.length - 1);
  const x0 = UTIL.x + (UTIL.w - total) / 2;
  const cy = SUBTITULO_Y;
  ctx.fillStyle = NEGRO;
  ctx.fillRect(x0 - 26, cy - 40, total + 52, 80);
  ctx.strokeStyle = BLANCO;
  ctx.lineWidth = 2;
  ctx.strokeRect(x0 - 26, cy - 40, total + 52, 80);
  let x = x0;
  grupo.palabras.forEach((p, i) => {
    ctx.fillStyle = i === activa ? AMBAR : BLANCO;
    ctx.fillText(p.texto, x, cy + 2);
    x += anchos[i] + espacio;
  });
}

/** Numeración del canal y, debajo, la fuente oficial (obligatoria cuando la voz habla de un estudio). */
export function cabecera(ctx: CanvasRenderingContext2D, tema: Tema, numero: string, fuenteTexto: string | null, p = 1): void {
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = tema.texto;
  ctx.font = fuente(MONO, 28, 700);
  ctx.fillText(numero, SEGURA.izquierda, SEGURA.arriba + 36);
  if (fuenteTexto && p > 0) etiqueta(ctx, `fuente ${fuenteTexto}`, SEGURA.izquierda, SEGURA.arriba + 78, p, {tam: 22, fondo: tema.texto, color: tema.fondo});
}
