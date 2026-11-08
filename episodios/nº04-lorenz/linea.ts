// nº04 · Línea de tiempo. Módulo PURO (sin React): lo usan la animación (Sketch.tsx) y el sonido
// (sonido.ts), así los cambios de lóbulo suenan cuando se ven.
//
//   portada (0–2,6 s)        la mariposa completa con los dos puntos en lóbulos opuestos (= último fotograma)
//   línea (→ "vamos al principio")       las dos curvas van pegadas y cruzan de lóbulo; se abren al final
//   esquema (→ "en algunas vueltas")     ampliación del inicio, campo de flechas y dos pasos
//   curvas (→ "alejemos la cámara")      el tramo en que se separan, se reacercan y cruzan de lado
//   atractor (→ "una vuelta más")        la figura completa, girando
//   final (→ fin)                        "una vuelta más": la cámara vuelve a la mariposa de la portada (loop)
import {DURACION_PORTADA} from '@canal/diseno';
import {tiempoDeAncla} from '@canal/tiempos';
import type {Tiempos} from '@canal/tipos';
import datos from './trayectorias.json';

export type Linea = {
  inicio: number;
  mapa: number;
  dos: number;
  pasos: number;
  casi: number;
  rosa: number;
  abre: number;
  cierre: number;
  fin: number;
};

/** Tramo de las trayectorias en la escena de la línea (índices de trayectorias.json). */
export const LINEA_DESDE = 1200;
export const LINEA_HASTA = 1880;

export const fase = (t: number, a: number, b: number) => Math.max(0, Math.min(1, (t - a) / Math.max(0.01, b - a)));

/** `fin` = segundo del último fotograma. Los valores por defecto son los de la toma actual. */
export function linea(tiempos: Tiempos | null, fin: number): Linea {
  const a = (s: string, d: number) => tiempoDeAncla(tiempos, s) ?? d;
  return {
    inicio: a('vamos al principio', 7.6),
    mapa: a('imagina que en cada lugar', 17.7),
    dos: a('ahora mira las dos flechas', 25.1),
    pasos: a('avanzan cambia la flecha', 36.8),
    casi: a('en algunas vueltas', 42.6),
    rosa: a('mira la rosa', 46.4),
    abre: a('alejemos la cámara', 51.9),
    cierre: a('una vuelta más', fin - 4),
    fin,
  };
}

/**
 * Índice de las trayectorias que se ve en `t` (fuera de las escenas de esquema). Desde "mira la rosa"
 * avanza del cruce a `datos.fin` (la vuelta extra de la azul por la derecha) y ahí se queda: la
 * portada y el último fotograma muestran ese mismo instante, con los puntos en lóbulos opuestos.
 */
export function indiceEn(t: number, l: Linea): number {
  if (t < DURACION_PORTADA) return datos.fin;
  // "Fíjate en esta línea": un tramo largo que cruza de un lóbulo al otro con las dos curvas pegadas;
  // se abren (de ~2 px a ~100 px) justo después de "¿cuándo se separan?". Antes era 420→720, solo
  // vueltas cerradas en el lóbulo izquierdo: se veía como un óvalo girando.
  if (t < l.inicio) return Math.floor(LINEA_DESDE + fase(t, DURACION_PORTADA, l.inicio) * (LINEA_HASTA - LINEA_DESDE));
  if (t < l.rosa) return Math.floor(2700 + fase(t, l.casi, l.rosa) * (datos.cruce - 2700));
  if (t < l.abre) return Math.floor(datos.cruce + fase(t, l.rosa, l.abre) * (datos.fin - datos.cruce));
  return datos.fin;
}

/**
 * Cambios de lóbulo (la x cambia de signo) que se ven mientras las curvas avanzan: segundo del video,
 * curva y lado al que llega (−1 izquierda, 1 derecha). Recorre el video fotograma a fotograma con la
 * misma indiceEn() que la animación.
 */
export function cambiosDeLobulo(l: Linea, fps = 30): {t: number; curva: 'rosa' | 'azul'; lado: number}[] {
  const out: {t: number; curva: 'rosa' | 'azul'; lado: number}[] = [];
  const tramos: [number, number][] = [[DURACION_PORTADA, l.inicio], [l.casi, l.abre]];
  for (const [desde, hasta] of tramos) {
    let previo = indiceEn(desde, l);
    for (let f = Math.ceil(desde * fps) + 1; f / fps < hasta; f++) {
      const t = f / fps;
      const k = indiceEn(t, l);
      for (const curva of ['rosa', 'azul'] as const) {
        const c = datos[curva];
        for (let i = Math.max(1, previo + 1); i <= k; i++) {
          if (Math.sign(c[i][0]) !== Math.sign(c[i - 1][0])) out.push({t, curva, lado: Math.sign(c[i][0])});
        }
      }
      previo = Math.max(previo, k);
    }
  }
  return out;
}
