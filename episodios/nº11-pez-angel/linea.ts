// nº11 · Línea de tiempo. Módulo PURO (sin React): lo usan la animación (Sketch.tsx) y la música
// (sonido.ts → partitura).
//
//   portada   0 → "de joven"      el pez ángel juvenil en 3D, con tres rayas (= último fotograma)
//   crece     → "en mil…"         el pez crece y le salen rayas nuevas entre las viejas: 3, 6, 12
//   turing    → "dos sustancias"  la ficha del artículo de 1952
//   receta    → "con solo eso"    sobre papel: activador (rosa) e inhibidor (azul) a lo largo de la piel
//   recetas   → "turing murió"    tres cuadros de piel: manchas, laberinto, rayas
//   1954      → revelación        la ficha, con 1954
//   revelación → "dos ingred."    plancha azul: el pez en papel, sus rayas se reacomodan (90 días)
//   remate    → cierre            vuelta al pez de la portada (loop)
import {DURACION_PORTADA} from '@canal/diseno';
import {cuantizar, type Pulso} from '@canal/pulso';
import {tiempoDeAncla} from '@canal/tiempos';
import type {Tiempos} from '@canal/tipos';

export const fase = (t: number, a: number, b: number) => Math.max(0, Math.min(1, (t - a) / Math.max(0.01, b - a)));

export type Linea = {
  negra: number;
  mapa: number;
  joven: number;
  crece: number;
  tres: number;
  seis: number;
  doce: number;
  quien: number;
  turing: number;
  dos: number;
  activa: number;
  frena: number;
  corre: number;
  recetas: number;
  manchas: number;
  laberintos: number;
  rayas: number;
  murio: number;
  pausa: number;
  revelacion: number;
  meses: number;
  remate: number;
  fin: number;
};

export function linea(tiempos: Tiempos | null, fin: number, pulso: Pulso): Linea {
  const negra = pulso.negra;
  const corchea = negra / 2;
  const ancla = (s: string, d: number) => tiempoDeAncla(tiempos, s) ?? d;
  const q = (t: number, tras = -1) => Math.max(cuantizar(t, pulso, 0.5), tras + corchea);

  const mapa = cuantizar(DURACION_PORTADA, pulso);
  const joven = ancla('de joven tiene', 1.6);
  const crece = q(ancla('crece', 4.2), mapa);
  const tres = ancla('tres seis doce', 8.0);
  const seis = ancla('seis doce', 8.6);
  const doce = ancla('doce quién', 9.2);
  const quien = ancla('quién se las pinta', 9.9);
  const turing = q(ancla('en mil novecientos cincuenta', 11.4), crece + 4 * corchea);
  const dos = q(ancla('dos sustancias que', 16.8), turing + 2 * corchea);
  const activa = ancla('una se activa', 19.4);
  const frena = ancla('la otra la frena', 21.0);
  const corre = ancla('y la que frena', 22.4);
  const recetas = q(ancla('con solo eso', 24.6), dos + 4 * corchea);
  const manchas = ancla('manchas', 27.0);
  const laberintos = ancla('laberintos', 27.7);
  const rayas = ancla('o rayas', 28.5);
  const murio = q(ancla('turing murió', 29.8), recetas + 4 * corchea);
  const revelacion = Math.max(cuantizar(ancla('en mil novecientos noventa', 33.5), pulso), murio + 4 * negra);
  const pausa = revelacion - negra;
  const meses = ancla('durante tres meses', 38.0);
  const remate = q(ancla('dos ingredientes una piel', 43.6), revelacion + 4 * corchea);
  return {negra, mapa, joven, crece, tres, seis, doce, quien, turing, dos, activa, frena, corre, recetas, manchas, laberintos, rayas, murio, pausa, revelacion, meses, remate, fin};
}

/** Cortes de verdad: llevan golpe en la música. */
export const cortes = (l: Linea) => [l.turing, l.dos, l.recetas, l.murio, l.revelacion, l.remate];

/**
 * Rayas del pez en la escena «crece» (como el pez real: 3 → 6 → 12): posiciones (0…1 del cuerpo) y
 * el grosor de cada una (0…1: las nuevas nacen finas y engordan). Las viejas no se estiran: el cuerpo
 * crece y las nuevas aparecen entre ellas.
 */
export function rayasReales(t: number, l: Linea): {pos: number; grosor: number}[] {
  const lista: {pos: number; grosor: number}[] = [];
  const nivel = (k: number) => {
    const n = 3 * 2 ** k;
    // Las nuevas nacen justo cuando la voz dice «seis» y «doce»
    const desde = k === 0 ? -Infinity : k === 1 ? l.seis - 0.15 : l.doce - 0.15;
    const g = k === 0 ? 1 : fase(t, desde, desde + 0.3);
    return {n, g};
  };
  for (let k = 0; k < 3; k++) {
    const {n, g} = nivel(k);
    if (g <= 0) continue;
    for (let i = 0; i < n; i++) {
      // Las del nivel k que no estaban en el anterior: las impares (entre dos viejas)
      if (k > 0 && i % 2 === 0) continue;
      lista.push({pos: (i + 0.5) / n, grosor: g});
    }
  }
  return lista.sort((a, b) => a.pos - b.pos);
}

/** Crecimiento del pez en la escena «crece» (1 → 2,2 de tamaño). */
export const tamanoPez = (t: number, l: Linea) => 1 + 1.2 * fase(t, l.crece, l.quien);
