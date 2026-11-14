// nº08b · Línea de tiempo. Módulo PURO (sin React): lo usan la animación (Sketch.tsx) y la música
// (sonido.ts → partitura). Es el mismo guion y la misma voz que nº08; cambia el montaje.
//
// Cada corte de escena y cada gesto cae en una CORCHEA de la música (92 BPM): la música se compone a
// partir de esta misma lista, así que imagen y sonido no pueden desajustarse.
//
//   portada   0 → 2,6          plancha azul, la red final desde arriba y el título palabra a palabra
//   mapa      → "en dos mil"   las 36 ciudades (dos por fusa); "¿cómo las unirías?": el mapa se inclina a 3D
//   avena     → "y en Tokio"   plancha blanca: caen los 36 copos de avena
//   moho      → "sin cerebro"  plancha negra, de cerca: el moho cae en Tokio; "una sola célula"
//   sin ×3    → "primero"      tres carteles: sin cerebro / sin planos / sin ingenieros
//   cubre     → "después"      plancha azul: la malla crece desde Tokio
//   poda      → "y su red"     plancha blanca: el modelo de tubos la poda; un tiempo de silencio antes de…
//   cifras    → "el truco"     …la revelación: las cifras del artículo; "si se rompe una vía"
//   truco     → "los ingen."   plancha negra, a ras de suelo: el flujo engrosa unos tubos y los demás desaparecen
//   décadas   → "el moho"      cartel blanco
//   día       → cierre         "26 HORAS"; el último compás vuelve a la portada (loop)
import {DURACION_PORTADA} from '@canal/diseno';
import {cuantizar, type Pulso} from '@canal/pulso';
import {tiempoDeAncla} from '@canal/tiempos';
import type {Tiempos} from '@canal/tipos';

export const fase = (t: number, a: number, b: number) => Math.max(0, Math.min(1, (t - a) / Math.max(0.01, b - a)));

export const CARTELES = ['CEREBRO', 'PLANOS', 'INGENIEROS'] as const;

export type Linea = {
  negra: number;
  /** Cortes y gestos, ya en la rejilla (segundos). */
  mapa: number;
  unir: number;
  avena: number;
  caen: number;
  moho: number;
  celula: number;
  sin: [number, number, number];
  cubre: number;
  poda: number;
  gruesos: number;
  /** Empieza el tiempo de silencio (imagen congelada) antes de la revelación. */
  pausa: number;
  revelacion: number;
  costo: number;
  eficiencia: number;
  solo: number;
  rompe: number;
  truco: number;
  engrosa: number;
  desaparece: number;
  decadas: number;
  dia: number;
  loop: number;
  fin: number;
};

export function linea(tiempos: Tiempos | null, fin: number, pulso: Pulso): Linea {
  const corchea = pulso.negra / 2;
  const ancla = (s: string, d: number) => tiempoDeAncla(tiempos, s) ?? d;
  /** A la corchea más cercana, y nunca antes de `tras` + una corchea. */
  const q = (t: number, tras = -1) => Math.max(cuantizar(t, pulso, 0.5), tras + corchea);

  const mapa = cuantizar(DURACION_PORTADA, pulso);
  const unir = q(ancla('cómo las unirías', 4.74), mapa + 4 * corchea);
  const avena = q(ancla('en dos mil diez', 6.84), unir + 2 * corchea);
  const caen = q(ancla('pusieron avena', 8.96), avena + corchea);
  const moho = q(ancla('y en tokio soltaron', 11.34), caen + 4 * corchea);
  const celula = q(ancla('una sola célula', 13.86), moho + 2 * corchea);
  const sin0 = q(ancla('sin cerebro', 15.68), celula + 2 * corchea);
  const sin1 = q(ancla('sin planos', 16.82), sin0 + corchea);
  const sin2 = q(ancla('sin ingenieros', 17.76), sin1 + corchea);
  const cubre = q(ancla('primero lo cubrió', 18.98), sin2 + corchea);
  const poda = q(ancla('después fue soltando', 20.84), cubre + 2 * corchea);
  // La revelación va al tiempo (negra) más cercano: es el golpe grande de la música
  const revelacion = Math.max(cuantizar(ancla('y su red se parecía', 26.98), pulso), poda + 4 * pulso.negra);
  const pausa = revelacion - pulso.negra;
  const gruesos = Math.min(q(ancla('tubos gruesos', 25.64), poda + 2 * corchea), pausa - corchea);
  const costo = q(ancla('casi el mismo costo', 29.18), revelacion + 2 * corchea);
  const eficiencia = q(ancla('la misma eficiencia', 31.18), costo + 2 * corchea);
  const solo = q(ancla('solo en una cosa', 32.82), eficiencia + 2 * corchea);
  const rompe = q(ancla('si se rompe una vía', 35.48), solo + 2 * corchea);
  const truco = q(ancla('el truco', 38.88), rompe + 4 * corchea);
  const engrosa = q(ancla('se engrosa', 41.58), truco + 2 * corchea);
  const desaparece = q(ancla('desaparece', 43.4), engrosa + 2 * corchea);
  const decadas = q(ancla('los ingenieros tardaron', 44.78), desaparece + 2 * corchea);
  const dia = q(ancla('el moho poco más', 47.26), decadas + 4 * corchea);
  // El último compás (o lo que quepa) vuelve a la portada: el último fotograma es igual al primero
  const loop = Math.max(dia + 4 * corchea, cuantizar(fin - pulso.negra * 1.5, pulso, 0.5, 'anterior'));
  return {
    negra: pulso.negra, mapa, unir, avena, caen, moho, celula, sin: [sin0, sin1, sin2], cubre, poda, gruesos, pausa,
    revelacion, costo, eficiencia, solo, rompe, truco, engrosa, desaparece, decadas, dia, loop, fin,
  };
}

/** Cortes de escena (cambio de plancha): cada uno lleva golpe en la música y glitch en la imagen. */
export const cortes = (l: Linea) => [l.mapa, l.avena, l.moho, ...l.sin, l.cubre, l.poda, l.revelacion, l.truco, l.decadas, l.dia, l.loop];

/** Las 36 ciudades: Tokio en el corte y las demás de dos en dos, una pareja por fusa. */
export function momentosCiudades(l: Linea): number[] {
  const fusa = l.negra / 8;
  return Array.from({length: 36}, (_, i) => (i === 0 ? l.mapa : l.mapa + l.negra / 4 + Math.floor((i - 1) / 2) * fusa));
}

/** Los copos de avena aterrizan de dos en dos, una pareja por fusa, desde "pusieron avena". */
export function momentosAvena(l: Linea): number[] {
  const fusa = l.negra / 8;
  return Array.from({length: 36}, (_, i) => l.caen + Math.floor(i / 2) * fusa);
}

/** "Lo cubrió todo": la malla crece desde Tokio, salto a salto (0…1 del máximo de saltos). */
export const crecida = (t: number, l: Linea) => fase(t, l.cubre, l.poda - l.negra / 4);

/** Paso del modelo de tubos durante la poda (se congela en el silencio previo a la revelación). */
export function pasoPoda(t: number, l: Linea, pasos: number): number {
  const x = fase(Math.min(t, l.pausa), l.poda, l.pausa);
  return Math.round(pasos * (1 - (1 - x) ** 2));
}

/**
 * En "el truco" la poda se repite deprisa, de cerca. Empieza con la malla ya algo adelgazada: en el
 * paso 0 todos los tubos son gruesos y, a ras de suelo, se funden en una mancha.
 */
export function pasoTruco(t: number, l: Linea, pasos: number): number {
  return Math.round(pasos * (0.05 + 0.95 * fase(t, l.truco + l.negra / 2, l.desaparece + l.negra)));
}

/** Estado de portada: al principio y en el cierre (loop). */
export const enPortadaEn = (t: number, l: Linea) => t < l.mapa || t >= l.loop;
