// nº09 · Línea de tiempo. Módulo PURO (sin React): lo usan la animación (Sketch.tsx) y la música
// (sonido.ts → partitura).
//
// El parpadeo es el tema, así que aquí el ritmo sí hace falta: un árbol sincronizado da un destello
// cada DOS tiempos de la música (1,3 s a 92 BPM; el real es cada 0,56 s, pero molestaría).
//
//   árbol     0 → "el truco"     el árbol entero parpadea a la vez (portada incluida); en 1917, los
//                                párpados; "en Tailandia…"
//   relojes   → "sin jefe"       sobre papel: un reloj que se carga y destella; luego dos, y la regla
//   enjambre  → "con ese truco"  el árbol desordenado se va juntando; revelación en "todas juntas"
//   sensores  → "lo inventó"     sobre papel: una red de sensores que se pone en hora sola
//   árbol     → cierre           el árbol, sincronizado; el último fotograma es un destello (loop)
//
// Las tres sincronías (relojes, enjambre, sensores) son simulaciones de verdad (simulacion.ts): aquí
// se elige, para cada una, el arranque al azar que tarda justo lo que dura su escena.
import {DURACION_PORTADA} from '@canal/diseno';
import {cuantizar, type Pulso} from '@canal/pulso';
import {tiempoDeAncla} from '@canal/tiempos';
import type {Tiempos} from '@canal/tipos';
import {destellosPorReloj, fasesAlAzar, simular, type Historia} from './simulacion';

export const fase = (t: number, a: number, b: number) => Math.max(0, Math.min(1, (t - a) / Math.max(0.01, b - a)));

/** Una sincronía simulada, colocada en el tiempo del video. */
export type Escena = {
  n: number;
  eps: number;
  fases0: number[];
  /** Segundo del video en que empieza la simulación (su instante 0). */
  inicio: number;
  /** Segundo del video del primer destello con todos juntos. */
  juntas: number;
  historia: Historia;
  /** Instantes de destello de cada reloj, en segundos del video. */
  porReloj: number[][];
};

export type Linea = {
  negra: number;
  /** Periodo del destello sincronizado (dos tiempos). */
  T: number;
  mapa: number;
  laurent: number;
  parpadeaba: number;
  parpados: number;
  miraba: number;
  noEran: number;
  tailandia: number;
  truco: number;
  regla: number;
  /** "Si ve un destello": aparece el rótulo de la regla. */
  siVe: number;
  sinJefe: number;
  sinMetronomo: number;
  demostraron: number;
  /** Empieza el tiempo de silencio antes de la revelación. */
  pausa: number;
  revelacion: number;
  sensores: number;
  bicho: number;
  fin: number;
  relojes: Escena;
  enjambre: Escena;
  nodos: Escena;
};

/**
 * Busca, entre `intentos` arranques al azar, el que se sincroniza más cerca de `ciclos` ciclos, y
 * coloca la simulación para que su primer destello conjunto caiga en `juntas`.
 */
function escena(n: number, eps: number, juntas: number, ciclos: number, T: number, semilla: number, intentos: number, hasta: number): Escena {
  let mejor: {fases0: number[]; historia: Historia; error: number} | null = null;
  for (let k = 0; k < intentos; k++) {
    const fases0 = fasesAlAzar(n, semilla + k);
    const historia = simular(fases0, ciclos + 6, {eps});
    if (historia.sincronia === null) continue;
    const error = Math.abs(historia.sincronia - ciclos);
    if (!mejor || error < mejor.error) mejor = {fases0, historia, error};
  }
  if (!mejor) throw new Error(`Ningún arranque de ${n} relojes se sincronizó en ${ciclos + 6} ciclos (ε = ${eps}).`);
  const inicio = juntas - (mejor.historia.sincronia as number) * T;
  // Historia completa hasta el final de la escena (tras la sincronía, un destello por ciclo)
  const historia = simular(mejor.fases0, (hasta - inicio) / T + 1, {eps});
  return {
    n,
    eps,
    fases0: mejor.fases0,
    inicio,
    juntas,
    historia,
    porReloj: destellosPorReloj(historia, n).map((lista) => lista.map((c) => inicio + c * T)),
  };
}

export function linea(tiempos: Tiempos | null, fin: number, pulso: Pulso, semilla = 1990): Linea {
  const negra = pulso.negra;
  const corchea = negra / 2;
  const T = negra * 2;
  const ancla = (s: string, d: number) => tiempoDeAncla(tiempos, s) ?? d;
  const q = (t: number, tras = -1) => Math.max(cuantizar(t, pulso, 0.5), tras + corchea);

  const mapa = cuantizar(DURACION_PORTADA, pulso);
  const laurent = q(ancla('en mil novecientos diecisiete', 7.34), mapa + corchea);
  const parpadeaba = ancla('que lo que parpadeaba', 12.38);
  const parpados = ancla('los párpados del que', 13.82);
  const miraba = ancla('miraba', 15.0);
  const noEran = ancla('no eran los párpados', 16.08);
  const tailandia = q(ancla('en tailandia', 18.0), laurent + corchea);
  const truco = q(ancla('el truco', 22.36), tailandia + 2 * corchea);
  const regla = q(ancla('y una sola regla', 25.78), truco + 2 * corchea);
  const siVe = ancla('si ve un destello', 27.18);
  const sinJefe = q(ancla('sin jefe', 30.32), regla + 4 * corchea);
  const sinMetronomo = q(ancla('sin metrónomo', 31.34), sinJefe + corchea);
  const demostraron = q(ancla('y dos matemáticos', 32.62), sinMetronomo + corchea);
  // La revelación va al tiempo (negra) más cercano: es el golpe grande de la música
  const revelacion = Math.max(cuantizar(ancla('todas juntas', 37.24), pulso), demostraron + 2 * negra);
  const pausa = revelacion - negra;
  const sensores = q(ancla('con ese truco', 38.76), revelacion + 2 * corchea);
  // El árbol vuelve justo en un destello de la rejilla que empezó en la revelación
  const bicho = revelacion + Math.max(2, Math.round((ancla('lo inventó', 42.3) - revelacion) / T)) * T;

  // Los dos relojes se juntan en el primer tiempo después de "ajusta el suyo"
  const juntosRelojes = Math.min(cuantizar(ancla('ajusta el suyo', 28.98), pulso, 1, 'siguiente'), sinJefe - negra);
  const relojes = escena(2, 0.12, juntosRelojes, (juntosRelojes - regla) / T, T, semilla + 7000, 80, sinJefe);
  const enjambre = escena(120, 0.002, revelacion, (revelacion - sinJefe) / T, T, semilla, 60, sensores);
  // Los sensores: su primer destello conjunto, en la rejilla de la revelación, a mitad de escena
  const juntosNodos = revelacion + Math.max(1, Math.round((sensores + 1.7 * T - revelacion) / T)) * T;
  const nodos = escena(20, 0.008, juntosNodos, (juntosNodos - sensores) / T, T, semilla + 3000, 120, bicho);

  return {
    negra, T, mapa, laurent, parpadeaba, parpados, miraba, noEran, tailandia, truco, regla, siVe, sinJefe, sinMetronomo, demostraron, pausa,
    revelacion, sensores, bicho, fin, relojes, enjambre, nodos,
  };
}

/** Cortes de verdad (cambia el fondo de golpe): llevan golpe en la música. */
export const cortes = (l: Linea) => [l.truco, l.sinJefe, l.revelacion, l.sensores, l.bicho];

/**
 * Segundos desde el último destello del árbol SINCRONIZADO (o un número grande si no toca):
 *   · al principio, cada T desde el segundo 0 (el fotograma 0 es un destello);
 *   · tras la revelación, cada T desde ella;
 *   · en el cierre, cada T contando hacia atrás desde el último fotograma (que es un destello: loop).
 */
export function desdeDestelloArbol(t: number, l: Linea): number {
  const resto = (x: number) => x - Math.floor(x / l.T + 1e-9) * l.T;
  if (t < l.truco) return resto(t);
  if (t >= l.bicho) return resto(t - l.fin + 64 * l.T);
  if (t >= l.revelacion) return resto(t - l.revelacion);
  return 99;
}

/** Instantes de esos destellos conjuntos, para el sonido: [segundo, tramo]. */
export function destellosArbol(l: Linea): number[] {
  const lista: number[] = [];
  for (let s = 0; s < l.truco - 0.05; s += l.T) lista.push(s);
  for (let s = l.revelacion; s < l.sensores - 0.05; s += l.T) lista.push(s);
  for (let s = l.fin; s > l.bicho - 0.05; s -= l.T) lista.push(s);
  return lista.sort((a, b) => a - b);
}

/** Segundos desde el último destello del reloj `i` de una escena simulada (antes de empezar, va libre). */
export function desdeDestello(e: Escena, i: number, t: number, T: number): number {
  const lista = e.porReloj[i];
  if (!lista.length || t < lista[0]) {
    // Antes del primer destello simulado: el reloj corre libre desde su fase de partida
    const ciclos = (t - e.inicio) / T + e.fases0[i];
    return (ciclos - Math.floor(ciclos)) * T;
  }
  let k = lista.length - 1;
  while (k > 0 && lista[k] > t) k--;
  return t - lista[k];
}

/** Abertura de los párpados (px de media altura): enorme = no se ven; 0 = cerrados. */
export function parpado(t: number, l: Linea): number {
  const ABIERTO = 760;
  const OJO = 330;
  if (t < l.parpadeaba || t >= l.noEran + 0.6) return ABIERTO;
  if (t >= l.noEran) return OJO + (ABIERTO - OJO) * fase(t, l.noEran, l.noEran + 0.6) ** 2;
  let h = ABIERTO + (OJO - ABIERTO) * (1 - (1 - fase(t, l.parpadeaba, l.parpadeaba + 0.7)) ** 3);
  // Dos parpadeos: se cierra en 0,14 s, aguanta 0,08 y se abre en 0,22
  for (const p of [l.parpados, l.miraba]) {
    const d = t - p;
    if (d < 0 || d > 0.44) continue;
    const cerrado = d < 0.14 ? d / 0.14 : d < 0.22 ? 1 : 1 - (d - 0.22) / 0.22;
    h *= 1 - cerrado;
  }
  return h;
}
