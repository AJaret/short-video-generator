// Rejilla de pulso: el reloj musical que comparten la animación, la plantilla y la banda sonora.
// Módulo PURO (sin React ni Remotion). El tiempo 0 del video es el primer tiempo del compás 0.
//
// A 92 BPM un compás dura 2,609 s: la salida de la portada (2,6 s) cae en el primer tiempo del
// compás 1. Si se cambia el tempo de un episodio, la portada sigue saliendo a 2,6 s (casi nunca
// coincidirá exactamente con un compás, pero sí con el tiempo más cercano a ±media negra).
import type {ConfigEpisodio} from './tipos';

export const BPM_POR_DEFECTO = 92;
export const TIEMPOS_POR_COMPAS = 4;

export type Pulso = {
  bpm: number;
  /** Segundos de una negra (un tiempo). */
  negra: number;
  /** Segundos de un compás. */
  compas: number;
  /** ¿Se ve el "golpe riso" en cada tiempo? */
  /** Golpe riso: true = registro en cada tiempo + escala en cada compás; 'compas' = solo la escala. */
  golpeVisual: boolean | 'compas';
};

export function pulsoDe(config: ConfigEpisodio): Pulso {
  const bpm = config.ritmo?.bpm ?? BPM_POR_DEFECTO;
  const negra = 60 / bpm;
  return {bpm, negra, compas: negra * TIEMPOS_POR_COMPAS, golpeVisual: config.ritmo?.golpeVisual ?? true};
}

/** Tiempo (negra) en el segundo `t`, con decimales. */
export const tiempoEn = (t: number, p: Pulso) => t / p.negra;

/** Compás en el segundo `t`, con decimales. */
export const compasEn = (t: number, p: Pulso) => t / p.compas;

/**
 * Lleva `t` a la rejilla. `division` en negras (1 = negra, 0.5 = corchea, 4 = compás).
 * `modo`: 'cercano' (por defecto), 'siguiente' (≥ t) o 'anterior' (≤ t).
 */
export function cuantizar(t: number, p: Pulso, division = 1, modo: 'cercano' | 'siguiente' | 'anterior' = 'cercano'): number {
  const paso = p.negra * division;
  const k = t / paso;
  const n = modo === 'siguiente' ? Math.ceil(k - 1e-9) : modo === 'anterior' ? Math.floor(k + 1e-9) : Math.round(k);
  return n * paso;
}

/**
 * Envolvente de "golpe": 1 justo en cada tiempo (o división) y cae exponencialmente.
 * Útil para pulsos visuales (registro, escala, brillo) que laten con la música.
 */
export function golpe(t: number, p: Pulso, division = 1, caida = 0.12): number {
  if (t < 0) return 0;
  const paso = p.negra * division;
  const desde = t - Math.floor(t / paso + 1e-9) * paso;
  return Math.exp(-desde / caida);
}

/** Fracción (0…1) recorrida dentro del tiempo/división actual. */
export function faseEn(t: number, p: Pulso, division = 1): number {
  const paso = p.negra * division;
  return (t / paso) - Math.floor(t / paso + 1e-9);
}
