// nº10 · Línea de tiempo. Módulo PURO (sin React): lo usan la animación (Sketch.tsx) y la música
// (sonido.ts → partitura).
//
//   portada   0 → "fíjate"        el enjambre colgado de la rama; el título (plantilla)
//   enjambre  → "unos cientos"    la cámara se acerca; "la reina no": la reina, con una mira
//   isla      → "al volver"       se abre a la isla: cinco cajas y exploradoras que salen a buscar
//   baile     → "así los buenos"  sobre papel: dos bailarinas (caja buena y caja regular) y sus circuitos
//   votación  → "en una isla"     la isla y la simulación: exploradoras en cada caja hasta el quórum
//   cajas     → revelación        el experimento real: una caja buena y cuatro regulares
//   revelación → "diez mil"       plancha rosa: 4 de 5
//   remate    → cierre            el enjambre y vuelta a la portada (loop)
import {DURACION_PORTADA} from '@canal/diseno';
import {cuantizar, type Pulso} from '@canal/pulso';
import {tiempoDeAncla} from '@canal/tiempos';
import type {Tiempos} from '@canal/tipos';
import {BUENA, simular, type Historia} from './simulacion';

export const fase = (t: number, a: number, b: number) => Math.max(0, Math.min(1, (t - a) / Math.max(0.01, b - a)));

export type Linea = {
  negra: number;
  mapa: number;
  reina: number;
  exploradoras: number;
  baile: number;
  bueno: number;
  regular: number;
  cadaVuelta: number;
  asi: number;
  quince: number;
  votacion: number;
  isla: number;
  cajas: number;
  pausa: number;
  revelacion: number;
  remate: number;
  fin: number;
  /** La simulación que se ve en la votación (un enjambre que elige la caja buena). */
  sim: Historia;
};

/** Busca, desde `semilla`, un enjambre simulado que elige la caja buena en un número de rondas cómodo. */
function elegirEnjambre(semilla: number): Historia {
  for (let s = semilla; s < semilla + 400; s++) {
    const h = simular(s, 200);
    if (h.eleccion === BUENA && h.ronda !== null && h.ronda >= 26 && h.ronda <= 46) return h;
  }
  throw new Error('Ningún enjambre simulado eligió la caja buena en 26–46 rondas.');
}

export function linea(tiempos: Tiempos | null, fin: number, pulso: Pulso, semilla = 2001): Linea {
  const negra = pulso.negra;
  const corchea = negra / 2;
  const ancla = (s: string, d: number) => tiempoDeAncla(tiempos, s) ?? d;
  const q = (t: number, tras = -1) => Math.max(cuantizar(t, pulso, 0.5), tras + corchea);

  const mapa = cuantizar(DURACION_PORTADA, pulso);
  const reina = q(ancla('la reina no', 8.2), mapa + corchea);
  const exploradoras = q(ancla('unos cientos de exploradoras', 11.28), reina + 2 * corchea);
  const baile = q(ancla('al volver', 14.46), exploradoras + 2 * corchea);
  const bueno = ancla('si el sitio es bueno', 18.2);
  const regular = ancla('si es regular', 20.5);
  const cadaVuelta = ancla('y en cada vuelta', 22.5);
  const asi = q(ancla('así los buenos sitios', 25.0), baile + 4 * corchea);
  const quince = ancla('cuando unas quince', 28.96);
  const votacion = q(ancla('se acaba la votación', 33.18), asi + 4 * corchea);
  const isla = q(ancla('en una isla sin árboles', 34.86), votacion + 2 * corchea);
  const cajas = ancla('les puso cinco cajas', 37.32);
  const revelacion = Math.max(cuantizar(ancla('en cuatro de cinco', 41.5), pulso), isla + 4 * negra);
  const pausa = revelacion - negra;
  const remate = q(ancla('diez mil votantes', 44.34), revelacion + 2 * corchea);
  return {negra, mapa, reina, exploradoras, baile, bueno, regular, cadaVuelta, asi, quince, votacion, isla, cajas, pausa, revelacion, remate, fin, sim: elegirEnjambre(semilla)};
}

/** Cortes de verdad (cambia la escena de golpe): llevan golpe en la música. */
export const cortes = (l: Linea) => [l.exploradoras, l.baile, l.asi, l.votacion, l.isla, l.revelacion, l.remate];

/** Ronda de la simulación (con decimales) que se ve en el segundo `t` de la votación. */
export function rondaEn(t: number, l: Linea): number {
  const R = l.sim.ronda ?? l.sim.rondas.length - 1;
  // Llega al quórum un poco antes de «se acaba la votación»
  return R * fase(t, l.asi + 0.2, l.votacion - 0.3);
}

/** Circuitos de cada bailarina en la escena del baile: vuelta 1, y 15 menos en cada vuelta. */
export function circuitos(t: number, l: Linea, calidad: number): {vuelta: number; valor: number} {
  const vuelta = t < l.cadaVuelta ? 1 : t < l.cadaVuelta + 0.9 ? 2 : 3;
  return {vuelta, valor: Math.max(0, Math.round(90 * calidad) - 15 * (vuelta - 1))};
}
