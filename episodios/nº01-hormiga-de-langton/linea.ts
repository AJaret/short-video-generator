// nº01 · Línea de tiempo de la hormiga: qué paso se ve en cada segundo.
// Módulo PURO (sin React ni Remotion): lo usan la animación (Sketch.tsx) y el sonido (sonido.ts),
// así imagen y sonido salen siempre de la misma cuenta.
import {DURACION_PORTADA} from '@canal/diseno';
import {tiempoDeAncla} from '@canal/tiempos';
import type {Tiempos} from '@canal/tipos';

export const PASOS_FINAL = 12000;
/** Paso en que empieza la autopista (verificado con la simulación). */
export const INICIO_AUTOPISTA = 9977;
/** Ritmo de los primeros pasos, para que se entiendan las reglas. */
export const SEG_POR_PASO = 0.45;

/** Puntos (segundo, paso) por los que pasa la animación. Sin voz se usan tiempos aproximados. */
export function claves(tiempos: Tiempos | null, duracionS: number): [number, number][] {
  const t = (ancla: string, defecto: number) => tiempoDeAncla(tiempos, ancla) ?? defecto;
  const t0 = Math.max(DURACION_PORTADA + 0.3, t('si pisa blanco', 3.2));
  const tFacil = Math.max(t0 + 1, t('fácil verdad', 12));
  const lentos = Math.floor((tFacil - t0) / SEG_POR_PASO);
  const tMil = Math.max(tFacil + 0.5, t('mil pasos', tFacil + 2.5));
  const tCinco = Math.max(tMil + 0.5, t('cinco mil', tMil + 1.5));
  const tDiezMil = Math.max(tCinco + 1, t('paso diez mil', tCinco + 4));
  const tAutopista = Math.max(tDiezMil + 0.5, t('una autopista', tDiezMil + 1.5));
  const tCiento = Math.max(tAutopista + 0.5, t('ciento cuatro', tAutopista + 2));
  const tFin = Math.max(tCiento + 1, duracionS - 1.2); // el último segundo queda quieto (= portada)
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

/** Paso (con decimales) en el segundo `t`. Durante la portada: el estado final (miniatura y loop). */
export function pasoEn(t: number, puntos: [number, number][]): number {
  if (t < DURACION_PORTADA) return PASOS_FINAL;
  if (t <= puntos[0][0]) return 0;
  for (let i = 0; i < puntos.length - 1; i++) {
    const [ta, pa] = puntos[i];
    const [tb, pb] = puntos[i + 1];
    if (t <= tb) {
      const f = (t - ta) / (tb - ta);
      // Primer tramo lineal (un paso cada SEG_POR_PASO); el resto, exponencial
      if (i === 0) return pa + (pb - pa) * f;
      return Math.exp(Math.log(pa + 1) + (Math.log(pb + 1) - Math.log(pa + 1)) * f) - 1;
    }
  }
  return PASOS_FINAL;
}
