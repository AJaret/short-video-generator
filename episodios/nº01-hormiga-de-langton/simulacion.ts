// nº01 · Simulación de la hormiga de Langton. Módulo PURO (sin React ni Remotion): lo usan la
// animación (Sketch.tsx) y el sonido (sonido.ts). Todo determinista.
//
// Reglas: en casilla blanca gira a la derecha, en negra a la izquierda; invierte la casilla y avanza.
import {mulberry32} from '@canal/prng';
import {
  DENSIDAD_DIBUJO,
  EXTRA_AUTOPISTA,
  INICIO_AUTOPISTA,
  PASOS_FINAL,
  RADIO_DIBUJO,
  TABLEROS,
  pasoCuadro,
  type Escenas,
} from './linea';

export const LADO = 256;
export const MITAD = LADO / 2;
// Direcciones en coordenadas de pantalla (y hacia abajo): 0 arriba, 1 derecha, 2 abajo, 3 izquierda
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

export type Simulacion = {
  /** Posición, dirección y caja de lo visitado tras k pasos (k = 0 … pasos). */
  x: Int16Array;
  y: Int16Array;
  dir: Uint8Array;
  minX: Int16Array;
  maxX: Int16Array;
  minY: Int16Array;
  maxY: Int16Array;
  pasos: number;
  /** Casillas negras al empezar (null = tablero en blanco). */
  inicial: Uint8Array | null;
  /** Paso en que empieza la autopista. */
  autopista: number;
};

/** Dibujo de partida al azar (mismo generador que out/buscar_tableros.mjs). */
export function dibujoInicial(semilla: number): Uint8Array {
  const azar = mulberry32(semilla);
  const negra = new Uint8Array(LADO * LADO);
  for (let y = -RADIO_DIBUJO; y <= RADIO_DIBUJO; y++) {
    for (let x = -RADIO_DIBUJO; x <= RADIO_DIBUJO; x++) {
      if (azar() < DENSIDAD_DIBUJO) negra[(y + MITAD) * LADO + x + MITAD] = 1;
    }
  }
  return negra;
}

export function simular(pasos: number, inicial: Uint8Array | null, autopista: number): Simulacion {
  const n = pasos + 1;
  const s: Simulacion = {
    x: new Int16Array(n), y: new Int16Array(n), dir: new Uint8Array(n),
    minX: new Int16Array(n), maxX: new Int16Array(n), minY: new Int16Array(n), maxY: new Int16Array(n),
    pasos, inicial, autopista,
  };
  const negra = inicial ? Uint8Array.from(inicial) : new Uint8Array(LADO * LADO);
  let x = 0, y = 0, d = 0;
  let a = 0, b = 0, c = 0, e = 0;
  for (let k = 0; k < n; k++) {
    s.x[k] = x; s.y[k] = y; s.dir[k] = d;
    a = Math.min(a, x); b = Math.max(b, x); c = Math.min(c, y); e = Math.max(e, y);
    s.minX[k] = a; s.maxX[k] = b; s.minY[k] = c; s.maxY[k] = e;
    const i = (y + MITAD) * LADO + (x + MITAD);
    d = negra[i] ? (d + 3) % 4 : (d + 1) % 4; // negra → izquierda, blanca → derecha
    negra[i] ^= 1;
    x += DX[d];
    y += DY[d];
    if (Math.abs(x) >= MITAD - 1 || Math.abs(y) >= MITAD - 1) throw new Error('La hormiga se sale de la cuadrícula simulada: agranda LADO.');
  }
  return s;
}

/** El tablero en blanco (la hormiga principal y la del cuadro). */
export const SIM = simular(PASOS_FINAL, null, INICIO_AUTOPISTA);
/** Los 4 tableros con dibujo de partida. */
export const SIM_TABLEROS = TABLEROS.map((t) => simular(t.autopista + EXTRA_AUTOPISTA, dibujoInicial(t.semilla), t.autopista));

export type Estado = {negra: Uint8Array; ultima: Int32Array; negras: number};
const memos = new Map<Simulacion, {pasos: number; estado: Estado}>();

/** Cuadrícula tras `pasos` pasos, reconstruida desde el paso 0 (determinista). */
export function estadoEn(sim: Simulacion, pasos: number): Estado {
  const memo = memos.get(sim);
  if (memo && memo.pasos === pasos) return memo.estado;
  const negra = sim.inicial ? Uint8Array.from(sim.inicial) : new Uint8Array(LADO * LADO);
  const ultima = new Int32Array(LADO * LADO).fill(-1);
  let negras = 0;
  if (sim.inicial) for (let i = 0; i < negra.length; i++) negras += negra[i];
  const hasta = Math.min(pasos, sim.pasos);
  for (let k = 0; k < hasta; k++) {
    const i = (sim.y[k] + MITAD) * LADO + (sim.x[k] + MITAD);
    negra[i] ^= 1;
    negras += negra[i] ? 1 : -1;
    ultima[i] = k;
  }
  const estado = {negra, ultima, negras};
  memos.set(sim, {pasos, estado});
  return estado;
}

export type Caja = {minX: number; maxX: number; minY: number; maxY: number};

/**
 * Escena del cuadro: en cada corchea de la música se mira si la hormiga se salió del cuadro (justo la
 * caja de lo que ha recorrido); si se salió, el cuadro crece para volver a encerrarla… y ella vuelve a salirse.
 * Devuelve el cuadro vigente en `t`, cuántas veces se salió y en qué segundos.
 */
export function cuadroEn(t: number, e: Escenas): {caja: Caja; salidas: number; momentos: number[]} {
  let caja: Caja = {minX: 0, maxX: 0, minY: 0, maxY: 0};
  const momentos: number[] = [];
  for (let tb = e.tCuadro + e.negra; tb <= t + 1e-6; tb += e.negra / 2) {
    const s = Math.min(SIM.pasos, Math.floor(pasoCuadro(tb, e)));
    const fuera = SIM.x[s] < caja.minX || SIM.x[s] > caja.maxX || SIM.y[s] < caja.minY || SIM.y[s] > caja.maxY;
    if (fuera) {
      caja = {minX: SIM.minX[s], maxX: SIM.maxX[s], minY: SIM.minY[s], maxY: SIM.maxY[s]};
      momentos.push(tb);
    }
  }
  return {caja, salidas: momentos.length, momentos};
}
