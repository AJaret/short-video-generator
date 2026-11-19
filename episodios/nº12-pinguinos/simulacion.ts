// nº12 · Simulación del grupo apiñado. Módulo PURO: lo usan la animación, el sonido y verificar.mjs.
//
// Un ESQUEMA en la línea del modelo de Waters, Blanchette y Kim («Modeling huddling penguins»,
// PLoS ONE 7, e50277, 2012): el viento sopla de un lado; los pingüinos del borde que más viento
// reciben se van, rodeando el grupo, al hueco más resguardado del otro lado; los de dentro no se mueven.
// Cada uno solo busca no pasar frío y, aun así, el frío se reparte casi por igual. De paso, el grupo
// entero avanza poco a poco a favor del viento.
//
// Retícula triangular (cada pingüino tiene 6 vecinos). Viento hacia +x. Determinista: mulberry32.
import {mulberry32} from '@canal/prng';

export const PARAMS = {
  /** Pingüinos. */
  n: 140,
  /** Movimientos por ronda (los más expuestos del borde). */
  porRonda: 1,
  /** Ruido al elegir a quién mover y a dónde (como la incertidumbre del modelo de Waters y otros). */
  ruido: 0.6,
};

/** Celda de la retícula triangular: (i, j) con fila j desplazada media celda si es impar. */
export type Celda = [number, number];
export const clave = (i: number, j: number) => `${i},${j}`;

/** Posición en el plano (x a favor del viento, y de lado), con separación 1. */
export const aPlano = ([i, j]: Celda): [number, number] => [i + (j & 1 ? 0.5 : 0), j * 0.866];

/** Los 6 vecinos de una celda. */
export function vecinos([i, j]: Celda): Celda[] {
  const d = j & 1 ? 0 : -1;
  return [
    [i - 1, j],
    [i + 1, j],
    [i + d, j - 1],
    [i + d + 1, j - 1],
    [i + d, j + 1],
    [i + d + 1, j + 1],
  ];
}

/** Viento que recibe una celda: vecinos libres del lado de barlovento (de donde viene, −x). */
export function exposicion(c: Celda, ocupado: Set<string>): number {
  const [x] = aPlano(c);
  let e = 0;
  for (const v of vecinos(c)) {
    if (ocupado.has(clave(...v))) continue;
    const [vx] = aPlano(v);
    // Hueco a barlovento: pesa mucho; de lado: algo; a sotavento: casi nada
    e += vx < x - 0.1 ? 1 : vx < x + 0.1 ? 0.35 : 0.05;
  }
  return e;
}

export type Ronda = {
  /** Celda de cada pingüino. */
  celdas: Celda[];
  /** Quién se movió en esta ronda (−1 si nadie) y de dónde a dónde. */
  movido: number;
  desde: Celda | null;
  hasta: Celda | null;
};

export type Historia = {
  rondas: Ronda[];
  /** Frío acumulado de cada pingüino (suma de su exposición en cada ronda). */
  frio: number[][];
};

/** Disposición de partida: un grupo redondo y compacto (las n celdas más cercanas al centro). */
export function inicial(n: number): Celda[] {
  const todas: [number, Celda][] = [];
  for (let j = -20; j <= 20; j++) for (let i = -20; i <= 20; i++) {
    const [x, y] = aPlano([i, j]);
    // Un desempate fijo para que el borde no salga en escalones regulares
    todas.push([Math.hypot(x, y) + 0.001 * ((i * 7 + j * 13) % 5), [i, j]]);
  }
  todas.sort((a, b) => a[0] - b[0]);
  return todas.slice(0, n).map(([, c]) => c);
}

/** Simula `rondas` rondas. Con `mover = false`, nadie se mueve (el control). */
export function simular(semilla: number, rondas: number, op: {mover?: boolean} = {}, p = PARAMS): Historia {
  const azar = mulberry32(semilla * 613 + 7);
  const celdas = inicial(p.n);
  const ocupado = new Set(celdas.map((c) => clave(...c)));
  const frioAcum = new Array(p.n).fill(0);
  const historia: Historia = {rondas: [], frio: []};
  for (let r = 0; r < rondas; r++) {
    let movido = -1;
    let desde: Celda | null = null;
    let hasta: Celda | null = null;
    if (op.mover !== false) {
      for (let m = 0; m < p.porRonda; m++) {
        // El más expuesto (con un poco de ruido)
        let mejor = -1;
        let peor = -Infinity;
        celdas.forEach((c, k) => {
          const e = exposicion(c, ocupado) + p.ruido * azar();
          if (e > peor) {
            peor = e;
            mejor = k;
          }
        });
        // Su destino: el hueco libre del borde, junto al grupo, más resguardado (y algo a sotavento)
        const huecos = new Map<string, Celda>();
        for (const c of celdas) for (const v of vecinos(c)) {
          const k = clave(...v);
          if (!ocupado.has(k)) huecos.set(k, v);
        }
        ocupado.delete(clave(...celdas[mejor]));
        let destino: Celda | null = null;
        let mejorValor = Infinity;
        for (const h of huecos.values()) {
          const pegados = vecinos(h).filter((v) => ocupado.has(clave(...v))).length;
          if (pegados < 2) continue;
          const valor = exposicion(h, ocupado) - 0.15 * pegados + p.ruido * 0.5 * azar();
          if (valor < mejorValor) {
            mejorValor = valor;
            destino = h;
          }
        }
        if (destino) {
          movido = mejor;
          desde = celdas[mejor];
          hasta = destino;
          celdas[mejor] = destino;
        }
        ocupado.add(clave(...celdas[mejor]));
      }
    }
    celdas.forEach((c, k) => (frioAcum[k] += exposicion(c, ocupado)));
    historia.rondas.push({celdas: celdas.map((c) => [c[0], c[1]] as Celda), movido, desde, hasta});
    historia.frio.push(frioAcum.slice());
  }
  return historia;
}

/** Desigualdad del frío acumulado: cociente entre el más castigado y la media (1 = todos igual). */
export function desigualdad(frio: number[]): number {
  const media = frio.reduce((s, v) => s + v, 0) / frio.length;
  return Math.max(...frio) / Math.max(1e-9, media);
}

/** Fracción de pingüinos que nunca pasaron frío (frío acumulado casi nulo). */
export const nuncaFrio = (frio: number[]) => frio.filter((v) => v < 0.5).length / frio.length;

/** Centro del grupo en el plano. */
export function centro(celdas: Celda[]): [number, number] {
  let x = 0;
  let y = 0;
  for (const c of celdas) {
    const [a, b] = aPlano(c);
    x += a / celdas.length;
    y += b / celdas.length;
  }
  return [x, y];
}
