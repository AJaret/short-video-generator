// Fondos de tinta llena y dibujo "en negativo" (papel recortado sobre la tinta).
//
// La traducción riso del azul eléctrico con formas blancas de los reels de referencia: una plancha
// entera de tinta, y las formas y el texto quedan en papel. Una plancha sólida sí es riso; el grano
// del papel y el desajuste de registro le dan la textura.
//
// Por defecto la plancha va en la capa SÓLIDA de la tinta: así el texto recortado sale nítido (en la
// capa tramada, el punto de 3 px escalonaría los bordes de la letra). Con `trama: true` va en la capa
// tramada, para fondos de medio tono (cobertura < 1).
import {cobertura, recortarPapel, todasLasCapas, type Capas} from './capas';
import {trazarRectIrregular} from './dibujo';
import {ALTO, ANCHO, type Rect} from './diseno';

export type NombreTinta = 'a' | 'b' | 'k';

/** La capa de una tinta: tramada (volumen, tonos) o sólida (texto, líneas, planchas nítidas). */
export const capaDe = (capas: Capas, tinta: NombreTinta, trama = false): CanvasRenderingContext2D =>
  trama ? capas[tinta] : capas.solido[tinta];

/** Todo el lienzo y un margen (la irregularidad del borde queda fuera de cuadro). */
const SANGRADO: Rect = {x: -24, y: -24, w: ANCHO + 48, h: ALTO + 48};

export type OpcionesFondo = {
  /** Capa tramada en lugar de sólida (para medios tonos). */
  trama?: boolean;
  /** Cobertura de tinta (0…1). En la capa sólida, por debajo de 0,5 no imprime. */
  cobertura?: number;
  /** Solo esta región (con bordes irregulares); por defecto, a sangre. */
  rect?: Rect;
  semilla?: number;
  /** Quitar antes lo que hay debajo (para tapar la escena); por defecto no. */
  tapar?: boolean;
};

/** Plancha de tinta llena, a sangre o en una región. */
export function fondoTinta(capas: Capas, tinta: NombreTinta, op: OpcionesFondo = {}): void {
  const ctx = capaDe(capas, tinta, op.trama);
  const trazar = (c: CanvasRenderingContext2D) => {
    if (op.rect) trazarRectIrregular(c, op.rect, op.semilla ?? 1, 3);
    else {
      c.beginPath();
      c.rect(SANGRADO.x, SANGRADO.y, SANGRADO.w, SANGRADO.h);
    }
  };
  if (op.tapar) recortarPapel(capas, trazar);
  ctx.fillStyle = cobertura(op.cobertura ?? 1);
  trazar(ctx);
  ctx.fill();
}

/**
 * Deja papel con lo que pinte `pintar` (rellenos, fillText, trazos…) en las seis capas.
 * Es la versión general de recortarPapel(): sirve para texto y para varias formas de una vez.
 * `pintar` recibe el contexto ya preparado (destination-out y relleno/trazo listos).
 */
export function enNegativo(capas: Capas, pintar: (ctx: CanvasRenderingContext2D) => void, fuerza = 1): void {
  for (const ctx of todasLasCapas(capas)) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = cobertura(fuerza);
    ctx.strokeStyle = cobertura(fuerza);
    pintar(ctx);
    ctx.restore();
  }
}
