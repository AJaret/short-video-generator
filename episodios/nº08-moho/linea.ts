// nº08 · Línea de tiempo. Módulo PURO (sin React): lo usan la animación (Sketch.tsx) y el sonido.
//
//   portada (0–2,6 s)               el mapa con la red final del moho (= último fotograma)
//   mapa (→ "en dos mil diez")      aparecen las 36 ciudades; "¿cómo las unirías?": trazos desde Tokio
//   avena (→ "primero lo cubrió")   avena en cada ciudad; el moho en Tokio; sin cerebro, planos ni ingenieros
//   cubre (→ "después")             la malla crece desde Tokio hasta cubrirlo todo
//   poda (→ "y su red se parecía")  el modelo de tubos la poda hasta unos cuantos tubos gruesos
//   cifras (→ "el truco")           costo, eficiencia y fallos (Tero y otros, 2010); se rompe un tubo
//   truco (→ "los ingenieros")      de cerca: el flujo engrosa unos tubos y los demás desaparecen
//   final (→ fin)                   "poco más de un día" y vuelve la portada
import {DURACION_PORTADA} from '@canal/diseno';
import {cuantizar, type Pulso} from '@canal/pulso';
import {tiempoDeAncla} from '@canal/tiempos';
import type {Tiempos} from '@canal/tipos';

export const fase = (t: number, a: number, b: number) => Math.max(0, Math.min(1, (t - a) / Math.max(0.01, b - a)));

export type Linea = {
  son36: number;
  unirias: number;
  dosMil: number;
  avena: number;
  soltaron: number;
  celula: number;
  sinCerebro: number;
  sinPlanos: number;
  sinIngenieros: number;
  primero: number;
  despues: number;
  gruesos: number;
  parecia: number;
  costo: number;
  eficiencia: number;
  soloEn: number;
  rompe: number;
  truco: number;
  engrosa: number;
  desaparece: number;
  decadas: number;
  dia: number;
  fin: number;
};

export function linea(tiempos: Tiempos | null, fin: number): Linea {
  const a = (s: string, d: number) => tiempoDeAncla(tiempos, s) ?? d;
  return {
    son36: a('son treinta y seis', 1.62),
    unirias: a('cómo las unirías', 4.74),
    dosMil: a('en dos mil diez', 6.84),
    avena: a('pusieron avena', 8.96),
    soltaron: a('y en tokio soltaron', 11.34),
    celula: a('una sola célula', 13.86),
    sinCerebro: a('sin cerebro', 15.68),
    sinPlanos: a('sin planos', 16.82),
    sinIngenieros: a('sin ingenieros', 17.76),
    primero: a('primero lo cubrió', 18.98),
    despues: a('después fue soltando', 20.84),
    gruesos: a('tubos gruesos', 25.64),
    parecia: a('y su red se parecía', 26.98),
    costo: a('casi el mismo costo', 29.18),
    eficiencia: a('la misma eficiencia', 31.18),
    soloEn: a('solo en una cosa', 32.82),
    rompe: a('si se rompe una vía', 35.48),
    truco: a('el truco', 38.88),
    engrosa: a('se engrosa', 41.58),
    desaparece: a('desaparece', 43.4),
    decadas: a('los ingenieros tardaron', 44.78),
    dia: a('el moho poco más', 47.26),
    fin,
  };
}

/** Las 36 ciudades aparecen una por fusa desde "son treinta y seis". */
export function momentosCiudades(l: Linea, pulso: Pulso): number[] {
  const desde = Math.max(DURACION_PORTADA, cuantizar(l.son36, pulso, 0.125, 'siguiente'));
  const paso = Math.min(pulso.negra / 8, (l.unirias - desde) / 36);
  return Array.from({length: 36}, (_, i) => desde + i * paso);
}

/** "Lo cubrió todo": la malla crece desde Tokio, salto a salto (0…1 del máximo de saltos). */
export const crecida = (t: number, l: Linea) => fase(t, l.primero, l.despues - 0.1);

/** Paso del modelo de tubos que se ve: la poda corre de "después" a "tubos gruesos" (y la final después). */
export function pasoPoda(t: number, l: Linea, pasos: number): number {
  if (t < l.despues) return 0;
  const x = fase(t, l.despues, l.gruesos + 0.5);
  return Math.round(pasos * (1 - (1 - x) ** 2));
}

/** En "el truco" la poda se repite deprisa, de cerca. */
export function pasoTruco(t: number, l: Linea, pasos: number): number {
  return Math.round(pasos * fase(t, l.truco + 0.3, l.desaparece + 0.3));
}

export const enPortadaEn = (t: number, l: Linea) => t < DURACION_PORTADA || t >= l.dia;
export const cortes = (l: Linea) => [l.dosMil, l.primero, l.parecia, l.truco, l.decadas];
