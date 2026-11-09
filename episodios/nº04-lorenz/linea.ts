// nº04 · Línea de tiempo. Módulo PURO (sin React): lo usan la animación (Sketch.tsx) y el sonido
// (sonido.ts), así los cambios de lóbulo suenan cuando se ven.
//
//   portada (0–2,6 s)        la mariposa completa con los dos puntos en lóbulos opuestos (= último fotograma)
//   línea (→ "vamos al principio")       las dos curvas van pegadas y cruzan de lóbulo; se abren al final
//   rebobinado (→ "desde aquí")          la línea vuelve hasta el punto de partida
//   esquema (→ "en algunas vueltas")     ampliación del inicio, campo de flechas y dos pasos
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
 *   · golpes: empujón de cámara + golpe corto en la música, en la palabra que pesa de cada frase
 *   · cortes: cambios de escena (barrido de aire que llega al corte, impresora y sacudida de registro)
 *   · el resto, con nombre, para los planos y los detalles del sketch
 */
export function momentosDe(tiempos: Tiempos | null, l: Linea, pulso: Pulso) {
  const q = (s: number) => cuantizar(s, pulso, 0.5);
  const p = (frase: string, defecto: number) => q(palabraFinal(tiempos, frase, defecto));
  const a = (frase: string, defecto: number) => q(tiempoDeAncla(tiempos, frase) ?? defecto);
  const m = {
    rosa: p('una rosa', 3.56),
    azul: p('una azul', 4.42),
    alcanzas: a('alcanzas a ver', 5.28),
    separan: p('se separan', 6.62),
    solo: a('un solo punto', 9.9),
    punto: p('un solo punto', 10.42),
    acercamos: a('nos acercamos', 11.8),
    diminuto: p('espacio diminuto', 13.42),
    entreLosDos: p('entre los dos', 14.66),
    queImporta: a('por qué importa', 15.64),
    espacio: p('ese espacio', 16.6),
    punta: p('la punta', 20.58),
    largo: p('el largo', 23.16),
    flechas: p('las dos flechas', 26.12),
    casiApuntan: a('casi apuntan', 27.3),
    casi: p('verdad casi', 29.36),
    comoPuntos: a('como los puntos', 30.32),
    cadaUno: a('cada uno sigue', 33.48),
    avanzan: a('avanzan cambia la flecha', 36.8),
    cambia: p('avanzan cambia', 37.86),
    otraVez: a('avanzan otra vez', 39.16),
    curioso: p('detalle curioso', 41.58),
    acercarse: p('a acercarse', 45.34),
    rosaRev: q(l.rosa),
    izquierda: p('cruzó a la izquierda', 48.26),
    azulTodavia: a('la azul todavía', 49.34),
    derecha: p('por la derecha', 51.46),
    atractor: a('atractor de lorenz', 55.58),
    reglas: a('las reglas', 57.28),
    vuelta: p('cada vuelta', 58.92),
    loQueCambia: a('lo que cambia', 59.78),
    error: p('pequeño error', 62.3),
    alPrincipio: a('al principio con', 65.52),
    predecir: p('para predecir', 68.08),
    varias: a('varias vueltas', 69.82),
    siquiera: p('ni siquiera', 71.76),
    lado: p('qué lado', 73.42),
  };
  const golpes = [
    m.rosa, m.azul, m.separan, m.punto, m.diminuto, m.espacio, m.punta, m.largo, m.casi,
    m.avanzan, m.cambia, m.otraVez, m.curioso, m.acercarse, m.izquierda, m.derecha,
    m.atractor, m.vuelta, m.error, m.siquiera,
  ];
  const cortes = [l.inicio, l.rebobina, l.mapa, l.dos, l.casi, l.abre];
  return {...m, golpes, cortes};
}
export type Momentos = ReturnType<typeof momentosDe>;
