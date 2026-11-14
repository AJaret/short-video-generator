// Glitch del estilo "edición": los 2–3 fotogramas de los cortes de las referencias (mosaico de
// píxeles gordos, canales RGB separados, franjas desplazadas, negativo). Módulo PURO: trabaja sobre
// los píxeles RGBA del fotograma ya dibujado y es determinista (hash por franja y semilla).
import {hash01} from '../prng';

export type Post = {
  /** Separación de los canales rojo y azul, en px (0 = nada). */
  rgb?: number;
  /** Tamaño del bloque del mosaico, en px (≤ 1 = nada). */
  pixel?: number;
  /** Franjas horizontales desplazadas: fuerza 0…1. */
  bandas?: number;
  /** Negativo del fotograma. */
  invertir?: boolean;
  /** Cambia el dibujo de las franjas (p. ej. el número de fotograma). */
  semilla?: number;
};

export const sinPost = (p: Post | void | null): boolean => !p || (!p.rgb && !(p.pixel && p.pixel > 1) && !p.bandas && !p.invertir);

export function aplicarPost(d: Uint8ClampedArray, w: number, h: number, p: Post): void {
  const semilla = p.semilla ?? 0;

  if (p.bandas && p.bandas > 0) {
    const copia = new Uint8ClampedArray(d);
    let y = 0;
    let i = 0;
    while (y < h) {
      const alto = 12 + Math.floor(hash01(semilla, i, 1) * 150);
      const activa = hash01(semilla, i, 2) < 0.2 + 0.5 * p.bandas;
      const dx = activa ? Math.round((hash01(semilla, i, 3) - 0.5) * 2 * 260 * p.bandas) : 0;
      if (dx !== 0) {
        for (let yy = y; yy < Math.min(h, y + alto); yy++) {
          const fila = yy * w * 4;
          for (let x = 0; x < w; x++) {
            const o = fila + (((x - dx) % w + w) % w) * 4;
            const q = fila + x * 4;
            d[q] = copia[o];
            d[q + 1] = copia[o + 1];
            d[q + 2] = copia[o + 2];
          }
        }
      }
      y += alto;
      i++;
    }
  }

  if (p.pixel && p.pixel > 1) {
    const s = Math.round(p.pixel);
    for (let by = 0; by < h; by += s) {
      const cy = Math.min(h - 1, by + (s >> 1));
      for (let bx = 0; bx < w; bx += s) {
        const o = (cy * w + Math.min(w - 1, bx + (s >> 1))) * 4;
        const r = d[o], g = d[o + 1], b = d[o + 2];
        for (let y = by; y < Math.min(h, by + s); y++) {
          let q = (y * w + bx) * 4;
          for (let x = bx; x < Math.min(w, bx + s); x++, q += 4) {
            d[q] = r;
            d[q + 1] = g;
            d[q + 2] = b;
          }
        }
      }
    }
  }

  if (p.rgb) {
    const dx = Math.round(p.rgb);
    const copia = new Uint8ClampedArray(d);
    for (let y = 0; y < h; y++) {
      const fila = y * w * 4;
      for (let x = 0; x < w; x++) {
        const q = fila + x * 4;
        d[q] = copia[fila + Math.max(0, Math.min(w - 1, x - dx)) * 4];
        d[q + 2] = copia[fila + Math.max(0, Math.min(w - 1, x + dx)) * 4 + 2];
      }
    }
  }

  if (p.invertir) {
    for (let q = 0; q < d.length; q += 4) {
      d[q] = 255 - d[q];
      d[q + 1] = 255 - d[q + 1];
      d[q + 2] = 255 - d[q + 2];
    }
  }
}

/**
 * Glitch de un corte: fuerte en el fotograma del corte y se apaga en `fotogramas`. `desde` es el
 * número de fotogramas transcurridos desde el corte (0 = el del corte); fuera de rango, nada.
 */
export function glitchDeCorte(desde: number, frame: number, fuerza = 1, fotogramas = 3): Post | null {
  if (desde < 0 || desde >= fotogramas) return null;
  const k = (1 - desde / fotogramas) * fuerza;
  return {
    rgb: Math.round(22 * k),
    pixel: desde === 0 ? Math.round(36 * fuerza) : desde === 1 ? Math.round(14 * fuerza) : 0,
    bandas: 0.9 * k,
    semilla: frame,
  };
}
