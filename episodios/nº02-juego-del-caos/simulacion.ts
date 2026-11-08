// nº02 · El juego del caos, precalculado. Módulo PURO (sin React ni Remotion): lo usan la animación
// (Sketch.tsx) y el sonido (sonido.ts). Todo sale de una semilla: el fotograma N es siempre igual.
//
// Regla: tira el dado y salta a medio camino de la esquina que salió. Comprobado con
// verificar.py (200 000 puntos):
//   · triángulo: ni un punto en el hueco central desde el primer salto (un salto hacia una esquina
//     cae siempre dentro de la copia a la mitad de esa esquina);
//   · cuadrado sin regla: lo llena todo (ruido); con "no repetir la misma esquina": un fractal;
//   · tetraedro: Sierpinski en 3D, de dimensión 2; visto a lo largo del eje Z (el que une los puntos
//     medios de dos aristas opuestas) su sombra es un cuadrado lleno, sin huecos.
import {mulberry32} from '@canal/prng';

export type Juego = {
  /** Coordenadas de cada punto tras cada salto (x, y[, z]). */
  x: Float32Array;
  y: Float32Array;
  z: Float32Array | null;
  /** Esquina elegida en cada tirada. */
  esquina: Uint8Array;
  /** Cara del dado en cada tirada (1…6; en el cuadrado, 1…4). */
  cara: Uint8Array;
  n: number;
};

/** Triángulo equilátero de lado 1, apoyado abajo (y hacia arriba). Esquinas: 1·2, 3·4 y 5·6. */
export const TRIANGULO: [number, number][] = [
  [0, 0],
  [1, 0],
  [0.5, Math.sqrt(3) / 2],
];
/** Cuadrado de lado 1. Esquinas 1, 2, 3 y 4 en sentido antihorario desde abajo a la izquierda. */
export const CUADRADO: [number, number][] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];
/** Tetraedro regular inscrito en el cubo [−1, 1]³ (sus proyecciones en X, Y o Z son cuadrados). */
export const TETRAEDRO: [number, number, number][] = [
  [1, 1, 1],
  [1, -1, -1],
  [-1, 1, -1],
  [-1, -1, 1],
];

/**
 * Juega `n` tiradas. Con `calentamiento`, antes da esos saltos sin guardarlos: cada salto reduce a la
 * mitad la distancia al fractal, así que tras 40 el punto ya está sobre él (a 2⁻⁴⁰) y ningún punto
 * guardado cae en un hueco. Si se empieza fuera del fractal y sin calentar, los primeros saltos caen
 * en huecos cada vez más pequeños y se ven como puntos sueltos en el centro de los triángulos.
 */
function jugar(esquinas: number[][], n: number, semilla: number, dado: number, regla: (k: number, previa: number) => boolean, inicio: number[], calentamiento = 0): Juego {
  const azar = mulberry32(semilla);
  const dims = esquinas[0].length;
  const j: Juego = {x: new Float32Array(n), y: new Float32Array(n), z: dims === 3 ? new Float32Array(n) : null, esquina: new Uint8Array(n), cara: new Uint8Array(n), n};
  const p = [...inicio];
  let previa = -1;
  const porCara = dado / esquinas.length;
  for (let i = -calentamiento; i < n; i++) {
    let cara = 0;
    let k = 0;
    do {
      cara = 1 + Math.floor(azar() * dado);
      k = Math.floor((cara - 1) / porCara);
    } while (!regla(k, previa));
    for (let d = 0; d < dims; d++) p[d] = (p[d] + esquinas[k][d]) / 2;
    previa = k;
    if (i < 0) continue;
    j.x[i] = p[0];
    j.y[i] = p[1];
    if (j.z) j.z[i] = p[2];
    j.esquina[i] = k;
    j.cara[i] = cara;
  }
  return j;
}

const libre = () => true;

/**
 * Punto de partida: la esquina de arriba. Una esquina ya es parte del triángulo de Sierpinski, y un
 * salto a medio camino de otra esquina lleva un punto del fractal a otro punto del fractal: así
 * TODOS los puntos caen exactamente sobre él y quedan vacíos los huecos de todos los tamaños.
 * (Antes empezaba en el centro: el primer salto ya evitaba el hueco grande, pero los primeros
 * caían en huecos pequeños y se veían puntos sueltos dentro de los triángulos.)
 */
export const INICIO_TRIANGULO: [number, number] = [0.5, Math.sqrt(3) / 2];

export const TRIANGULO_N = 160_000;
export const CUADRADO_N = 24_000;
export const TETRAEDRO_N = 60_000; // de frente debe verse lleno: con 14 000 quedaban huecos de muestreo

/** El triángulo (dado de 6 caras: 1–2, 3–4, 5–6). */
export const JUEGO_TRIANGULO = jugar(TRIANGULO, TRIANGULO_N, 1988, 6, libre, INICIO_TRIANGULO);
/** El cuadrado sin regla (dado de 4). */
export const JUEGO_CUADRADO = jugar(CUADRADO, CUADRADO_N, 1989, 4, libre, [0.5, 0.5]);
/** El cuadrado con la regla "no repetir la misma esquina dos veces seguidas". */
export const JUEGO_COPO = jugar(CUADRADO, CUADRADO_N, 1990, 4, (k, previa) => k !== previa, [0.5, 0.5], 40);
/** El tetraedro en 3D (dado de 4). Empieza en una esquina, que ya es parte del fractal (como el triángulo). */
export const JUEGO_TETRAEDRO = jugar(TETRAEDRO, TETRAEDRO_N, 1991, 4, libre, TETRAEDRO[0]);

/** Cuántas veces salió cada cara en las primeras `n` tiradas. */
export function conteoCaras(j: Juego, n: number, caras: number): number[] {
  const c = new Array(caras).fill(0);
  for (let i = 0; i < Math.min(n, j.n); i++) c[j.cara[i] - 1]++;
  return c;
}

/**
 * ¿Está (x, y) DENTRO del hueco central del triángulo (el triángulo invertido del medio)?
 * El borde del hueco es parte del triángulo de Sierpinski y muchos puntos caen justo encima: con la
 * precisión de float32 parecerían entrar, así que se deja un margen de 1e-4.
 */
export function enHuecoCentral(x: number, y: number): boolean {
  const h = Math.sqrt(3) / 2;
  // Hueco: y > 0 por encima de la base media… en baricéntricas, las tres coordenadas < 1/2
  const l3 = y / h; // peso de la esquina de arriba
  const l2 = x - 0.5 * l3; // peso de la esquina derecha
  const l1 = 1 - l2 - l3;
  const e = 1e-4;
  return l1 < 0.5 - e && l2 < 0.5 - e && l3 < 0.5 - e;
}
