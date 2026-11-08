// Muestrario del kit de motion graphics · línea de tiempo. Módulo PURO (sin React): lo comparten la
// animación (Muestrario.tsx) y el sonido (banda.ts).
//
// Todo cae en compases de la música (92 BPM: un compás = 2,609 s). Cada pieza ocupa dos compases y
// se pasa a la siguiente con una transición distinta cuyo corte cae en el primer tiempo del compás:
//
//   compás 0       portada                     → corte seco (el de la plantilla)
//   compases 1–2   01 · fondo de tinta llena    → barrido (tinta A, sube)
//   compases 3–4   02 · gráficos que laten      → iris (tinta B)
//   compases 5–6   03 · tipografía cinética     → disolución en trama (tinta B)
//   compases 7–8   04 · nube de partículas      → barrido en diagonal (tinta B)
//   compases 9–11  05 · datos de impacto: sello, letras y barrido
import {pulsoDe} from '../canal/pulso';
import type {ConfigEpisodio, Tiempos} from '../canal/tipos';
import type {Transicion} from '../canal/transiciones';

const BPM = 92;
const COMPAS = (60 / BPM) * 4;
const NEGRA = 60 / BPM;
/** Segundo en que empieza el compás `c`. */
export const compas = (c: number) => c * COMPAS;

export const CONFIG: ConfigEpisodio = {
  numero: 0,
  tema: 'muestrario',
  titulo: 'Kit de movimiento',
  semilla: 92,
  ritmo: {bpm: BPM},
  impactos: [
    {texto: 'Sello', desde: compas(9), duracion: COMPAS - 0.3, entrada: 'sello'},
    {texto: 'Paso a paso', desde: compas(10), duracion: COMPAS - 0.3, entrada: 'letras'},
    {texto: 'Barrido', desde: compas(11), duracion: COMPAS - 0.3, entrada: 'barrido'},
  ],
  cola: 1.2,
  audio: {
    // Sin voz, la música puede ir mucho más arriba que en un episodio
    musicaDb: -6,
    // La revelación (caída + golpe) cuando la nube de partículas se forma; otro golpe al entrar los impactos
    revelacion: compas(7),
    golpes: [compas(9)],
    remate: compas(12),
  },
};

export const PULSO = pulsoDe(CONFIG);

/** Sin voz: tiempos vacíos con la duración del muestrario (lo que dura la última pieza). */
export const TIEMPOS: Tiempos = {palabras: [], duracion: compas(12)};
export const DURACION = TIEMPOS.duracion + (CONFIG.cola ?? 0);

/** Transiciones: empiezan un tiempo antes del compás para que el corte caiga en el compás. */
export const TRANSICIONES: Transicion[] = [
  {t: compas(3) - NEGRA, tipo: 'barrido', tinta: 'a', angulo: 0, semilla: 4},
  {t: compas(5) - NEGRA, tipo: 'iris', tinta: 'b', centro: [480, 860], semilla: 6},
  {t: compas(7) - NEGRA, tipo: 'trama', tinta: 'b', centro: [0, 1920], semilla: 8},
  {t: compas(9) - NEGRA, tipo: 'barrido', tinta: 'b', angulo: 120, semilla: 10},
];

/** Escena vigente: 0 portada, 1 fondos, 2 gráficos, 3 tipografía, 4 partículas, 5 impactos. */
export function escena(t: number): number {
  if (t < compas(1)) return 0;
  if (t < compas(3)) return 1;
  if (t < compas(5)) return 2;
  if (t < compas(7)) return 3;
  if (t < compas(9)) return 4;
  return 5;
}

export {NEGRA, COMPAS};

// ── Momentos de cada pieza (los usan la imagen y el sonido) ───────────────────────────────────

/** 01 · Formas de papel que aparecen sobre la tinta, una por tiempo desde el segundo tiempo. */
export const FORMAS = [0, 1, 2, 3, 4, 5].map((i) => compas(1) + NEGRA * (i + 1));

/** 02 · Estallido en el primer tiempo de cada compás; ondas en cada tiempo. */
export const ESTALLIDOS = [compas(3), compas(4)];

/** 03 · Letra a letra (desde el segundo tiempo), barrido y rótulos. */
export const LETRAS = {texto: 'LETRA A LETRA', inicio: compas(5) + NEGRA};
export const BARRIDO = {texto: 'BARRIDO', inicio: compas(6)};
export const ROTULOS = [
  {texto: 'tempo · 92 bpm', t: compas(6) + NEGRA * 2},
  {texto: 'compás · 2,6 s', t: compas(6) + NEGRA * 3},
];

/** 04 · Vuelos de la nube: de dispersa a círculo, de círculo a rejilla y de rejilla a espiral. */
export const VUELOS = [compas(7), compas(7) + NEGRA * 2, compas(8)];
export const DURACION_VUELO = NEGRA * 2;
