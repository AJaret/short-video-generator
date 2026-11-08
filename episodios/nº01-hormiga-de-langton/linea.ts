// nº01 · Línea de tiempo de la hormiga: qué paso se ve en cada segundo.
// Módulo PURO (sin React ni Remotion): lo usan la animación (Sketch.tsx) y el sonido (sonido.ts),
// así imagen y sonido salen siempre de la misma cuenta. Va en la rejilla de pulso de la música:
//   · pasos lentos: uno por tiempo (negra), empezando en un tiempo
//   · revelación (inicio de la autopista): en el tiempo más cercano a "paso diez mil"
import {DURACION_PORTADA} from '@canal/diseno';
import {cuantizar, type Pulso} from '@canal/pulso';
import {tiempoDeAncla} from '@canal/tiempos';
import type {Tiempos} from '@canal/tipos';

export const PASOS_FINAL = 12000;
/** Paso en que empieza la autopista (verificado con la simulación). */
export const INICIO_AUTOPISTA = 9977;

/**
 * Puntos (segundo, paso) por los que pasa la animación. Sin voz se usan tiempos aproximados.
 * Índices: 0 inicio lento · 1 fin lento · 2 mil · 3 cinco mil · 4 revelación · 5 autopista ·
 * 6 ciento cuatro · 7 fin.
 */
export function claves(tiempos: Tiempos | null, duracionS: number, pulso: Pulso): [number, number][] {
  const t = (ancla: string, defecto: number) => tiempoDeAncla(tiempos, ancla) ?? defecto;
  const t0 = cuantizar(Math.max(DURACION_PORTADA + 0.3, t('si pisa blanco', 3.2)), pulso, 1, 'siguiente');
  const lentos = Math.max(2, Math.round((Math.max(t0 + 1, t('fácil verdad', 12)) - t0) / pulso.negra));
  const tFacil = t0 + lentos * pulso.negra; // un paso por tiempo, exacto
  const tMil = Math.max(tFacil + 0.5, t('mil pasos', tFacil + 2.5));
  const tCinco = Math.max(tMil + 0.5, t('cinco mil', tMil + 1.5));
  const tDiezMil = Math.max(tCinco + 1, cuantizar(t('paso diez mil', tCinco + 4), pulso));
  const tAutopista = Math.max(tDiezMil + 0.5, t('una autopista', tDiezMil + 1.5));
  const tCiento = Math.max(tAutopista + 0.5, t('ciento cuatro', tAutopista + 2));
  const tFin = Math.max(tCiento + 1, cuantizar(duracionS - 1.2, pulso, 1, 'anterior')); // luego, quieto (= portada)
  return [
    [t0, 0],
    [tFacil, lentos],
    [tMil, 1000],
    [tCinco, 5000],
    [tDiezMil, INICIO_AUTOPISTA],
    [tAutopista, 10500],
    [tCiento, 11000],
    [tFin, PASOS_FINAL],
  ];
}

/**
 * Paso (con decimales) en el segundo `t`. En el tramo lento, la parte entera es el paso y los
 * decimales la fracción del tiempo musical ya recorrida. Durante la portada: el estado final.
 */
export function pasoEn(t: number, puntos: [number, number][]): number {
  if (t < DURACION_PORTADA) return PASOS_FINAL;
  if (t <= puntos[0][0]) return 0;
  for (let i = 0; i < puntos.length - 1; i++) {
    const [ta, pa] = puntos[i];
    const [tb, pb] = puntos[i + 1];
    if (t <= tb) {
      const f = (t - ta) / (tb - ta);
      if (i === 0) return pa + (pb - pa) * f; // lineal: un paso por tiempo
      return Math.exp(Math.log(pa + 1) + (Math.log(pb + 1) - Math.log(pa + 1)) * f) - 1;
    }
  }
  return PASOS_FINAL;
}

/** ¿Está en el tramo lento (un paso por tiempo)? */
export const enTramoLento = (t: number, puntos: [number, number][]) =>
  t >= DURACION_PORTADA && t >= puntos[0][0] && t < puntos[1][0];
