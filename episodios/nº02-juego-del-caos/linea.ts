// nº02 · Línea de tiempo: qué se ve en cada segundo. Módulo PURO (sin React ni Remotion): lo usan la
// animación (Sketch.tsx) y el sonido (sonido.ts). Todo anclado a la voz y llevado a la rejilla de
// pulso; los cortes de escena caen en un tiempo.
//
//   triángulo (portada → "¿y con cuatro esquinas?")
//     · lento: una tirada por tiempo (el punto salta a medio camino y deja su marca)
//     · aceleración: una tirada por semicorchea en pantalla, mientras el contador pasa por 100, 1000, 10 000
//       (solo se ve el rastro reciente: parece ruido)
//     · revelación: en el golpe se imprimen todos los puntos de una vez → Sierpinski
//     · zoom ×2 y ×2 hacia una esquina: es igual a sí mismo
//     · esquema: una copia se encoge a la mitad hacia una esquina; luego las tres copias; el hueco
//   cuadrado ("¿y con cuatro esquinas?") ruido → regla nueva → el copo se imprime en "vuelve el orden"
//   tetraedro 3D ("con cuatro puntos en el espacio") se construye, gira a saltos y queda de frente: un cuadrado
//   final ("el azar no dibuja nada") vuelve el triángulo; acaba en el estado de portada (loop)
import {DURACION_PORTADA} from '@canal/diseno';
import {cuantizar, type Pulso} from '@canal/pulso';
import {tiempoDeAncla} from '@canal/tiempos';
import type {Tiempos} from '@canal/tipos';
import type {Transicion} from '@canal/transiciones';

/** Puntos impresos en la revelación y en la portada. */
export const PUNTOS_REVELACION = 10_000;
export const PUNTOS_PORTADA = 40_000;
/** Tiradas que se ven en el zoom (más tiradas = más detalle al acercarse). */
export const PUNTOS_ZOOM = 160_000;
/** Tiradas del cuadrado (ruido) y del copo. */
export const PUNTOS_CUADRADO = 20_000;

export type Linea = {
  negra: number;
  compas: number;
  // Triángulo
  tTira: number;
  lentos: number;
  tAcelera: number;
  tCien: number;
  tMil: number;
  tDiezMil: number;
  tRevela: number;
  tZoom: number;
  tSuerte: number;
  tEncoge: number;
  tCopias: number;
  tPorEso: number;
  tHueco: number;
  // Cuadrado
  tCuadrado: number;
  tRuido: number;
  tSoloRuido: number;
  tRegla: number;
  tNoRepetir: number;
  tOrden: number;
  // 3D
  t3D: number;
  tConstruye: number;
  tTetra: number;
  tGira: number;
  tVisto: number;
  // Final
  tFinal: number;
  tTiraOtra: number;
  duracion: number;
};

/** Tiempos de la voz (anclas) llevados al pulso. Los valores por defecto son los de la toma actual. */
export function linea(tiempos: Tiempos | null, duracion: number, pulso: Pulso): Linea {
  const a = (ancla: string, defecto: number) => tiempoDeAncla(tiempos, ancla) ?? defecto;
  const q = (s: number) => cuantizar(s, pulso);
  const negra = pulso.negra;
  const tTira = cuantizar(Math.max(DURACION_PORTADA + 0.3, a('tira el dado', 3.58)), pulso, 1, 'siguiente');
  const tSigue = a('sigue tirando', 14.32);
  const lentos = Math.max(4, Math.floor((tSigue - tTira) / negra));
  const tAcelera = tTira + lentos * negra;
  const tRevela = Math.max(tAcelera + 2 * negra, q(a('triángulo de sierpinski', 18.32)));
  const tCuadrado = q(a('con cuatro esquinas', 38.88));
  const tRegla = q(a('pero agrega', 42.24));
  const t3D = q(a('con cuatro puntos', 48.48));
  const tGira = q(a('gíralo', 54.7));
  const tFinal = q(a('el azar no dibuja', 60.2));
  return {
    negra,
    compas: pulso.compas,
    tTira,
    lentos,
    tAcelera,
    tCien: Math.max(tAcelera + 0.2, a('cien veces', 15.02)),
    tMil: Math.max(tAcelera + 0.4, a('mil', 16.6)),
    tDiezMil: Math.min(tRevela - negra, Math.max(tAcelera + 0.6, a('diez mil', 16.88))),
    tRevela,
    tZoom: q(a('hecho de triángulos', 22.2)),
    tSuerte: q(a('no es suerte', 24.52)),
    tEncoge: q(a('encoge', 26.5)),
    tCopias: q(a('tres copias', 31.04)),
    tPorEso: q(a('por eso', 33.74)),
    tHueco: q(a('ni un solo punto', 35.9)),
    tCuadrado,
    tRuido: tCuadrado + negra,
    tSoloRuido: Math.max(tCuadrado + 2 * negra, a('solo ruido', 41.2) + 0.6),
    tRegla,
    tNoRepetir: Math.max(tRegla + 2 * negra, q(a('no repetir', 43.86))),
    tOrden: q(a('vuelve el orden', 47.32)),
    t3D,
    tConstruye: Math.max(t3D + negra, q(a('construye', 50.7))),
    tTetra: q(a('un tetraedro', 52.18)),
    tGira,
    tVisto: Math.max(tGira + negra, q(a('visto desde aquí', 55.68))),
    tFinal,
    tTiraOtra: Math.min(duracion - negra, Math.max(tFinal + negra, q(a('tira otra vez', 64.04)))),
    duracion,
  };
}

export type Escena = 'triangulo' | 'cuadrado' | 'tetraedro' | 'final';

/** Transiciones entre escenas (empiezan un tiempo antes del corte, que cae en el ancla). */
export function transiciones(l: Linea): Transicion[] {
  return [
    {t: l.tCuadrado - l.negra, tipo: 'barrido', tinta: 'b', angulo: 90, semilla: 21},
    {t: l.tRegla, tipo: 'barrido', tinta: 'a', angulo: 0, semilla: 22},
    {t: l.t3D - l.negra, tipo: 'iris', tinta: 'b', centro: [540, 820], semilla: 23},
    {t: l.tFinal - l.negra, tipo: 'trama', tinta: 'a', centro: [1080, 1920], semilla: 24},
  ];
}

export function escenaEn(t: number, l: Linea): Escena {
  if (t >= l.tFinal) return 'final';
  if (t >= l.t3D) return 'tetraedro';
  if (t >= l.tCuadrado) return 'cuadrado';
  return 'triangulo';
}

/** Interpolación geométrica (para contadores que crecen 10×, 10×…). */
function geo(t: number, puntos: [number, number][]): number {
  if (t <= puntos[0][0]) return puntos[0][1];
  for (let i = 1; i < puntos.length; i++) {
    const [t0, v0] = puntos[i - 1];
    const [t1, v1] = puntos[i];
    if (t <= t1) {
      const f = (t - t0) / Math.max(1e-6, t1 - t0);
      return Math.exp(Math.log(Math.max(1, v0)) + (Math.log(v1) - Math.log(Math.max(1, v0))) * f);
    }
  }
  return puntos[puntos.length - 1][1];
}

/**
 * Tiradas hechas en el segundo `t` del triángulo. Lento: una por tiempo (la primera en tTira).
 * Aceleración: el contador sube a 100, 1000 y 10 000 con la voz; luego, hasta PUNTOS_ZOOM en el zoom.
 */
export function tiradasTriangulo(t: number, l: Linea): number {
  if (t < l.tTira) return 0;
  if (t < l.tAcelera) return Math.floor((t - l.tTira) / l.negra + 1e-9) + 1;
  return Math.floor(
    geo(t, [
      [l.tAcelera, l.lentos],
      [l.tCien, 100],
      [l.tMil, 1000],
      [l.tDiezMil, PUNTOS_REVELACION],
      [l.tZoom, PUNTOS_REVELACION],
      [l.tZoom + 2 * l.negra, PUNTOS_ZOOM],
    ]),
  );
}

/**
 * Tirada "en pantalla" durante la aceleración: el punto visible salta en cada semicorchea (y suena),
 * aunque el contador vaya más rápido. Devuelve el índice de la tirada mostrada y el instante del salto.
 */
export function saltoVisible(t: number, l: Linea): {indice: number; desde: number} | null {
  if (t < l.tTira) return null;
  if (t < l.tAcelera) {
    const k = Math.floor((t - l.tTira) / l.negra + 1e-9);
    return {indice: k, desde: l.tTira + k * l.negra};
  }
  const semi = l.negra / 4;
  const k = Math.floor((t - l.tAcelera) / semi + 1e-9);
  const desde = l.tAcelera + k * semi;
  return {indice: Math.max(l.lentos, tiradasTriangulo(desde, l) - 1), desde};
}

/** Semicorcheas de la aceleración (callan un tiempo antes de la revelación, como la música). */
export function semicorcheasAceleracion(l: Linea): number[] {
  const out: number[] = [];
  for (let s = l.tAcelera; s < l.tRevela - l.negra - 1e-6; s += l.negra / 4) out.push(s);
  return out;
}

/** Zoom hacia la esquina de abajo a la izquierda: ×2 en tZoom, ×2 otra vez un tiempo después; vuelve en tSuerte. */
export function zoomEn(t: number, l: Linea): number {
  const salto = (t0: number, dur = 0.3) => (t < t0 ? 0 : Math.min(1, 1 - 2 ** (-10 * ((t - t0) / dur))));
  if (t >= l.tSuerte) return 4 ** (1 - salto(l.tSuerte, 0.45)) ;
  return 2 ** (salto(l.tZoom) + salto(l.tZoom + l.negra));
}

/** Tiradas del cuadrado: el ruido se llena hasta "solo ruido"; el copo, desde "no repetir" hasta "vuelve el orden". */
export function tiradasCuadrado(t: number, l: Linea): {ruido: number; copo: number} {
  const ruido = Math.floor(geo(t, [[l.tRuido, 1], [l.tRuido + l.negra, 60], [l.tSoloRuido, PUNTOS_CUADRADO]]));
  const copo = t < l.tNoRepetir ? 0 : Math.floor(geo(t, [[l.tNoRepetir, 1], [l.tOrden, PUNTOS_CUADRADO]]));
  return {ruido: t < l.tRuido ? 0 : ruido, copo};
}

/** Semicorcheas en que suena (y se ve) un salto en el cuadrado: llenado de ruido y llenado del copo. */
export function semicorcheasCuadrado(l: Linea): {ruido: number[]; copo: number[]} {
  const paso = l.negra / 4;
  const ruido: number[] = [];
  for (let s = l.tRuido; s < l.tSoloRuido - 1e-6; s += paso) ruido.push(s);
  const copo: number[] = [];
  for (let s = l.tNoRepetir; s < l.tOrden - l.negra - 1e-6; s += paso) copo.push(s);
  return {ruido, copo};
}

/** Puntos del tetraedro construidos en `t`. */
export function tiradasTetraedro(t: number, l: Linea, total: number): number {
  if (t < l.tConstruye) return 0;
  return Math.floor(geo(t, [[l.tConstruye, 4], [l.tTetra + l.negra * 2, total]]));
}

/** Tiradas que se ven en la escena final: una por tiempo; la última (en tTiraOtra) es la de portada. */
export function tiradaFinal(t: number, l: Linea): number {
  const k = Math.round((l.tTiraOtra - l.tFinal) / l.negra);
  const hecho = Math.min(k, Math.floor((t - l.tFinal) / l.negra + 1e-9));
  return PUNTOS_PORTADA - k + Math.max(0, hecho);
}
