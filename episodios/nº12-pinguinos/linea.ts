// nº12 · Línea de tiempo. Módulo PURO (sin React): lo usan la animación (Sketch.tsx) y la música
// (sonido.ts → partitura).
//
//   portada   0 → "invierno"         el grupo en 3D sobre el hielo, con la ventisca (= último fotograma)
//   frío      → "nadie se ofrece"    de cerca: un macho con el huevo sobre las patas
//   borde     → "se apiñan"          el grupo desde arriba: ¿a quién le toca el borde?
//   regla     → "con esa regla"      la simulación vista desde arriba: el más expuesto rodea el grupo
//   reparto   → revelación           el frío acumulado de cada uno: sin moverse vs con la regla
//   ola       → "miles de"           plancha azul: el grupo en papel y la ola de pasitos (12 cm/s)
//   remate    → cierre               vuelta al grupo de la portada (loop)
import {DURACION_PORTADA} from '@canal/diseno';
import {cuantizar, type Pulso} from '@canal/pulso';
import {tiempoDeAncla} from '@canal/tiempos';
import type {Tiempos} from '@canal/tipos';

export const fase = (t: number, a: number, b: number) => Math.max(0, Math.min(1, (t - a) / Math.max(0.01, b - a)));

/** Rondas de la simulación que se ven en la escena de la regla, y en el reparto (el total). */
export const RONDAS_REGLA = 90;
export const RONDAS_TOTAL = 1500;

export type Linea = {
  negra: number;
  mapa: number;
  invierno: number;
  machos: number;
  borde: number;
  nadie: number;
  apinan: number;
  viento: number;
  avanza: number;
  regla: number;
  pausa: number;
  revelacion: number;
  ola: number;
  remate: number;
  fin: number;
};

export function linea(tiempos: Tiempos | null, fin: number, pulso: Pulso): Linea {
  const negra = pulso.negra;
  const corchea = negra / 2;
  const ancla = (s: string, d: number) => tiempoDeAncla(tiempos, s) ?? d;
  const q = (t: number, tras = -1) => Math.max(cuantizar(t, pulso, 0.5), tras + corchea);

  const mapa = cuantizar(DURACION_PORTADA, pulso);
  const invierno = ancla('invierno en la antártida', 1.4);
  const machos = q(ancla('y los machos cuidan', 5.0), mapa + corchea);
  const borde = q(ancla('a quién le toca', 10.0), machos + 2 * corchea);
  const nadie = ancla('nadie se ofrece', 11.6);
  const apinan = q(ancla('se apiñan', 14.0), borde + 2 * corchea);
  const viento = ancla('el que recibe el viento', 17.6);
  const avanza = ancla('el grupo entero avanza', 22.6);
  const regla = q(ancla('con esa regla egoísta', 25.0), apinan + 4 * corchea);
  const revelacion = Math.max(cuantizar(ancla('y al filmar un grupo', 30.5), pulso), regla + 4 * negra);
  const pausa = revelacion - negra;
  const ola = ancla('como una ola', 35.5);
  const remate = q(ancla('miles de pingüinos', 39.5), revelacion + 4 * corchea);
  return {negra, mapa, invierno, machos, borde, nadie, apinan, viento, avanza, regla, pausa, revelacion, ola, remate, fin};
}

/** Cortes de verdad: llevan golpe en la música. */
export const cortes = (l: Linea) => [l.machos, l.borde, l.regla, l.revelacion, l.remate];

/** Ronda de la simulación que se ve en el segundo `t` de la escena de la regla (con decimales). */
export const rondaRegla = (t: number, l: Linea) => RONDAS_REGLA * fase(t, l.apinan + 0.3, l.regla - 0.2);

/** Frente de la ola de pasitos en la revelación: posición 0…1 a lo largo del grupo (de atrás a delante). */
export const frenteOla = (t: number, l: Linea) => fase(t, l.ola - 0.6, l.remate - 0.4);
