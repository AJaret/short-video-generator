// nº04 · Línea de tiempo. Módulo PURO (sin React): lo usan la animación (Sketch.tsx) y el sonido
// (sonido.ts), así los cambios de lóbulo suenan cuando se ven.
//
//   portada (0–2,6 s)        la mariposa completa con los dos puntos en lóbulos opuestos (= último fotograma)
//   línea (→ "vamos al principio")       las dos curvas van pegadas y cruzan de lóbulo; se abren al final
//   rebobinado (→ "desde aquí")          la línea vuelve hasta el punto de partida
//   esquema (→ "y cada punto sigue")     ampliación del inicio, campo de flechas y las dos flechas
//   curvas (→ "alejemos la cámara")      el tramo en que se separan, se reacercan y cruzan de lado
//   atractor (→ "una vuelta más")        la figura completa, girando
//   final (→ fin)                        "una vuelta más": la cámara vuelve a la mariposa de la portada (loop)
import {DURACION_PORTADA} from '@canal/diseno';
import {cuantizar, type Pulso} from '@canal/pulso';
import {normalizar, tiempoDeAncla} from '@canal/tiempos';
import type {Tiempos} from '@canal/tipos';
import datos from './trayectorias.json';

export type Linea = {
  inicio: number;
  /** "Desde aquí": termina el rebobinado y empieza la ampliación del inicio. */
  rebobina: number;
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
    rebobina: a('desde aquí parecen', 9.04),
    mapa: a('en cada lugar hay', 16.08),
    dos: a('mira las dos', 20.12),
    // Guion corto (2026-11-09): sin los tres pasos. En "y cada punto sigue la suya" se corta directo a
    // las curvas (cada una por su camino), así que la escena de pasos no se ve (pasos = casi).
    pasos: a('y cada punto sigue', 24.56),
    casi: a('y cada punto sigue', 24.56),
    rosa: a('mira la rosa', 26.68),
    abre: a('alejemos la cámara', 32.72),
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
  // "Vamos al principio": la línea se rebobina hasta el punto de partida (frena al llegar)
  if (t < l.rebobina) return Math.floor(LINEA_HASTA * (1 - Math.sin((Math.PI / 2) * fase(t, l.inicio, l.rebobina))));
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

/**
 * Inicio de la ÚLTIMA palabra de la primera aparición de `frase` (los golpes caen en la palabra que
 * pesa: "un solo PUNTO"). Si no está, `defecto`.
 */
export function palabraFinal(tiempos: Tiempos | null, frase: string, defecto: number): number {
  const inicio = tiempoDeAncla(tiempos, frase);
  if (inicio === null || !tiempos) return defecto;
  const n = normalizar(frase).split(/\s+/).filter(Boolean).length;
  const i = tiempos.palabras.findIndex((p) => p.inicio === inicio);
  return tiempos.palabras[i + n - 1]?.inicio ?? defecto;
}

/**
 * Momentos de la cámara y del sonido (prueba de dinamismo, 2026-11-08), en la rejilla de corcheas.
 *   · cortes: cambios de escena (barrido de aire que llega al corte, impresora y sacudida de registro)
 *   · el resto, con nombre, para los planos y los detalles del sketch
 */
export function momentosDe(tiempos: Tiempos | null, l: Linea, pulso: Pulso) {
  const q = (s: number) => cuantizar(s, pulso, 0.5);
  const p = (frase: string, defecto: number) => q(palabraFinal(tiempos, frase, defecto));
  const a = (frase: string, defecto: number) => q(tiempoDeAncla(tiempos, frase) ?? defecto);
  const m = {
    rosa: p('una rosa', 3.72),
    azul: p('una azul', 4.74),
    alcanzas: a('alcanzas a ver', 5.58),
    separan: p('se separan', 7.0),
    solo: a('un solo punto', 10.36),
    punto: p('un solo punto', 10.98),
    acercamos: a('nos acercamos', 12.22),
    diminuto: p('espacio diminuto', 13.96),
    entreLosDos: p('entre los dos', 15.28),
    // El marco se cierra sobre el hueco en cuanto la voz dice "entre los dos"
    queImporta: a('entre los dos', 14.84),
    flechas: p('mira las dos', 20.54),
    casiApuntan: a('casi apuntan', 21.3),
    casi: p('verdad casi', 23.62),
    rosaRev: q(l.rosa),
    izquierda: p('cruzó a la izquierda', 28.6),
    azulTodavia: a('la azul todavía', 29.66),
    derecha: p('por la derecha', 31.82),
    atractor: a('atractor de lorenz', 34.8),
    reglas: a('las reglas', 36.18),
    loQueCambia: a('lo que cambia', 38.14),
    error: a('aquel error diminuto', 40.04),
    alPrincipio: a('al comienzo', 41.66),
    predecir: p('puedes predecirlo', 42.64),
    varias: a('unas vueltas', 43.86),
    siquiera: p('ni siquiera', 45.56),
    lado: p('qué lado', 46.58),
  };
  const cortes = [l.inicio, l.rebobina, l.mapa, l.dos, l.casi, l.abre];
  return {...m, cortes};
}
export type Momentos = ReturnType<typeof momentosDe>;
