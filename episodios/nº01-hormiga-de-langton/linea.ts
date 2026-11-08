// nº01 · Línea de tiempo: qué se ve en cada segundo, por escenas.
// Módulo PURO (sin React ni Remotion): lo usan la animación (Sketch.tsx) y el sonido (sonido.ts),
// así imagen y sonido salen siempre de la misma cuenta. Todo va en la rejilla de pulso de la música
// y los cortes de escena caen en un tiempo.
//
//   principal (portada → "¿pasa siempre?")   la hormiga en el tablero en blanco: reglas, caos, autopista
//   tableros  ("¿pasa siempre?")              4 dibujos de partida distintos, cada uno acaba en autopista
//   cuadro    ("lo que sí está demostrado")   un cuadro alrededor de la hormiga: siempre se sale
//   cinta     ("y lo más raro")               esquema: la hormiga como cabezal que cuenta en binario
//   final     ("así que no hay atajo")        vuelve la hormiga principal; termina en el estado de portada
import {DURACION_PORTADA} from '@canal/diseno';
import {cuantizar, type Pulso} from '@canal/pulso';
import {tiempoDeAncla} from '@canal/tiempos';
import type {Tiempos} from '@canal/tipos';

export const PASOS_FINAL = 12000;
/** Paso en que empieza la autopista con el tablero en blanco (verificado con la simulación). */
export const INICIO_AUTOPISTA = 9977;

/**
 * Dibujos de partida de los 4 tableros: casillas negras al azar (semilla) en un cuadrado de
 * (2·RADIO+1)² alrededor de la hormiga. Verificado con verificar.mjs (396 de 400 semillas
 * acaban en autopista antes de 40 000 pasos): `autopista` es el paso en que empieza la de cada uno.
 * Una por cada dirección en que puede salir la autopista.
 */
export const RADIO_DIBUJO = 3;
export const DENSIDAD_DIBUJO = 0.45;
export const TABLEROS = [
  {semilla: 2, autopista: 730},
  {semilla: 3, autopista: 1519},
  {semilla: 4, autopista: 5777},
  {semilla: 6, autopista: 11715},
];
/** Pasos que sigue cada tablero tras empezar su autopista (y ahí se queda). */
export const EXTRA_AUTOPISTA = 1200;
/** Pasos que da la hormiga en la escena del cuadro. */
export const PASOS_CUADRO = 2600;
/** Bits de la cinta de la escena de la computadora. */
export const BITS = 5;

export type Escenas = {
  principal: [number, number][];
  tTableros: number;
  tCuadro: number;
  tCinta: number;
  tFinal: number;
  /** La hormiga principal camina hasta aquí en la escena final; luego, quieta (= portada). */
  tQuieta: number;
  negra: number;
  compas: number;
};

/**
 * Tiempos de las escenas (anclados a la voz y llevados al pulso) y puntos (segundo, paso) de la
 * hormiga principal. Índices de `principal`: 0 inicio lento · 1 fin lento · 2 mil · 3 cinco mil ·
 * 4 revelación · 5 autopista · 6 fin de la escena.
 */
export function escenas(tiempos: Tiempos | null, duracionS: number, pulso: Pulso): Escenas {
  const t = (ancla: string, defecto: number) => tiempoDeAncla(tiempos, ancla) ?? defecto;
  const q = (s: number) => cuantizar(s, pulso);
  const t0 = cuantizar(Math.max(DURACION_PORTADA + 0.3, t('si pisa blanco', 3.2)), pulso, 1, 'siguiente');
  const lentos = Math.max(2, Math.round((Math.max(t0 + 1, t('fácil verdad', 12)) - t0) / pulso.negra));
  const tFacil = t0 + lentos * pulso.negra; // un paso por tiempo, exacto
  const tMil = Math.max(tFacil + 0.5, t('mil pasos', tFacil + 2.5));
  const tCinco = Math.max(tMil + 0.5, t('cinco mil', tMil + 1.5));
  const tDiezMil = Math.max(tCinco + 1, q(t('paso diez mil', tCinco + 4)));
  const tAutopista = Math.max(tDiezMil + 0.5, t('una autopista', tDiezMil + 1.5));
  const tTableros = Math.max(tAutopista + 2, q(t('pasa siempre', tAutopista + 5)));
  const tCuadro = Math.max(tTableros + 4, q(t('lo que sí está demostrado', tTableros + 12)));
  const tCinta = Math.max(tCuadro + 4, q(t('y lo más raro', tCuadro + 10)));
  const tFinal = Math.max(tCinta + 4, q(t('así que no hay atajo', tCinta + 12)));
  const tQuieta = Math.min(duracionS - 1, Math.max(tFinal + 1, q(t('ni siquiera', tFinal + 4))));
  return {
    principal: [
      [t0, 0],
      [tFacil, lentos],
      [tMil, 1000],
      [tCinco, 5000],
      [tDiezMil, INICIO_AUTOPISTA],
      [tAutopista, 10500],
      [tTableros, 11000],
    ],
    tTableros,
    tCuadro,
    tCinta,
    tFinal,
    tQuieta,
    negra: pulso.negra,
    compas: pulso.compas,
  };
}

export type NombreEscena = 'principal' | 'tableros' | 'cuadro' | 'cinta' | 'final';

export function escenaEn(t: number, e: Escenas): NombreEscena {
  if (t < e.tTableros) return 'principal';
  if (t < e.tCuadro) return 'tableros';
  if (t < e.tCinta) return 'cuadro';
  if (t < e.tFinal) return 'cinta';
  return 'final';
}

/** Interpolación exponencial de pasos (de `a` a `b`) entre dos segundos. */
function exponencial(t: number, ta: number, tb: number, a: number, b: number): number {
  const f = Math.min(1, Math.max(0, (t - ta) / (tb - ta)));
  return Math.exp(Math.log(a + 1) + (Math.log(b + 1) - Math.log(a + 1)) * f) - 1;
}

/**
 * Paso (con decimales) de la hormiga principal en el segundo `t`. En el tramo lento la parte entera
 * es el paso y los decimales la fracción del tiempo musical recorrida. Portada y final: estado final.
 */
export function pasoPrincipal(t: number, e: Escenas): number {
  const p = e.principal;
  if (t < DURACION_PORTADA) return PASOS_FINAL;
  if (t >= e.tFinal) return exponencial(t, e.tFinal + e.negra, e.tQuieta, p[p.length - 1][1], PASOS_FINAL);
  if (t <= p[0][0]) return 0;
  for (let i = 0; i < p.length - 1; i++) {
    const [ta, pa] = p[i];
    const [tb, pb] = p[i + 1];
    if (t <= tb) {
      if (i === 0) return pa + ((pb - pa) * (t - ta)) / (tb - ta); // lineal: un paso por tiempo
      return exponencial(t, ta, tb, pa, pb);
    }
  }
  return p[p.length - 1][1];
}

/** ¿Tramo lento (un paso por tiempo)? */
export const enTramoLento = (t: number, e: Escenas) =>
  t >= DURACION_PORTADA && t >= e.principal[0][0] && t < e.principal[1][0];

const MAX_TABLEROS = Math.max(...TABLEROS.map((x) => x.autopista + EXTRA_AUTOPISTA));
const inicioTableros = (e: Escenas) => e.tTableros + e.negra;
const finTableros = (e: Escenas) => e.tCuadro - e.compas;

/** Pasos de un reloj común a los 4 tableros (cada tablero se detiene al llegar a su final). */
export const pasoTableros = (t: number, e: Escenas) => exponencial(t, inicioTableros(e), finTableros(e), 0, MAX_TABLEROS);

/** Segundo en que empieza la autopista del tablero `k`. */
export function tAutopistaTablero(k: number, e: Escenas): number {
  const a = Math.log(1), b = Math.log(MAX_TABLEROS + 1);
  const f = (Math.log(TABLEROS[k].autopista + 1) - a) / (b - a);
  return inicioTableros(e) + f * (finTableros(e) - inicioTableros(e));
}

/** Pasos de la hormiga en la escena del cuadro (tablero en blanco desde cero). */
export const pasoCuadro = (t: number, e: Escenas) => exponencial(t, e.tCuadro + e.negra, e.tCinta - e.negra, 0, PASOS_CUADRO);

/** Un instante de la cinta: posición del cabezal, bits y número tras ese movimiento. */
export type MovCinta = {t: number; pos: number; bits: number[]; numero: number; tipo: 'sube' | 'baja' | 'mueve'};

/**
 * Esquema de "la hormiga como computadora": un cabezal que suma 1 en binario una y otra vez
 * (va a la derecha del todo; mientras lee 1 lo cambia a 0 y va a la izquierda; cambia el 0 a 1;
 * vuelve). Un movimiento por semicorchea, desde un tiempo después del corte hasta un tiempo antes
 * del siguiente.
 */
export function cinta(e: Escenas): MovCinta[] {
  const paso = e.negra / 4;
  const fin = e.tFinal - e.negra;
  const bits = new Array(BITS).fill(0);
  let pos = BITS - 1;
  let numero = 0;
  let t = e.tCinta + e.negra;
  const lista: MovCinta[] = [{t: e.tCinta, pos, bits: [...bits], numero, tipo: 'mueve'}];
  const anotar = (tipo: MovCinta['tipo']) => {
    lista.push({t, pos, bits: [...bits], numero, tipo});
    t += paso;
  };
  while (t < fin) {
    while (bits[pos] === 1 && t < fin) {
      bits[pos] = 0;
      anotar('baja');
      if (pos > 0) {
        pos--;
        anotar('mueve');
      }
    }
    if (t >= fin) break;
    bits[pos] = 1;
    numero = parseInt(bits.join(''), 2);
    anotar('sube');
    while (pos < BITS - 1 && t < fin) {
      pos++;
      anotar('mueve');
    }
    t += paso; // respiro entre sumas
  }
  return lista;
}
