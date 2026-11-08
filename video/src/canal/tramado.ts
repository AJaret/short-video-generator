// Filtro riso por CPU: lo que antes hacía el shader WebGL, ahora en JavaScript sobre los píxeles.
// Módulo PURO (sin React): recibe los píxeles de las seis capas y escribe el fotograma final.
//
// Por qué por CPU: en Docker no hay GPU y Chrome la emula (SwiftShader) en UN proceso compartido
// por todas las pestañas del render. Con WebGL, más hilos no aceleraban nada (~3,5 fotogramas/s).
// Sin WebGL, cada pestaña filtra por su cuenta y el render aprovecha todos los núcleos.
//
// Mismo algoritmo que el shader (los píxeles coinciden salvo el grano, que es aleatorio):
//   · cobertura = alfa × (1 − luminancia)
//   · capas tramadas: el fotograma se parte en celdas de `punto` px (desplazadas con el registro
//     de su tinta); cada celda toma la cobertura de su píxel central y se trama con Bayer 4×4 a
//     4 niveles (0, 1/3, 2/3, 1)
//   · capas sólidas: umbral al 50 %, píxel a píxel, con el mismo desajuste que su tinta
//   · tinta = máx(tramada, sólida); color = papel × mezcla(1, tinta A, a) × … (multiply)
//   · grano de papel estático (fibra fina + grumos) tirando al negro riso
import {hexARgb} from './paleta';

export type EntradaTramado = {
  ancho: number;
  alto: number;
  /** Píxeles RGBA de las capas: tramadas a, b, k y sólidas a, b, k. */
  tramadas: [Uint8ClampedArray, Uint8ClampedArray, Uint8ClampedArray];
  solidas: [Uint8ClampedArray, Uint8ClampedArray, Uint8ClampedArray];
  /** Desajuste de registro (px) de cada tinta: a, b, k. */
  desajustes: [[number, number], [number, number], [number, number]];
  colores: {a: string; b: string; k: string; papel: string};
  punto: number;
  grano: number;
  /** Fotograma final RGBA (se sobrescribe). */
  salida: Uint8ClampedArray;
};

const NIVELES_GRANO = 32;

/** Bayer 4×4 como en el shader: (4·b2(c mod 2) + b2(⌊c/2⌋ mod 2) + 0,5) / 16, con mod siempre positivo. */
const mod = (x: number, m: number) => x - m * Math.floor(x / m);
const bayer2 = (px: number, py: number) => mod(2 * px + 3 * py, 4);
function bayer4(cx: number, cy: number): number {
  const b1 = bayer2(mod(cx, 2), mod(cy, 2));
  const b2 = bayer2(mod(Math.floor(cx / 2), 2), mod(Math.floor(cy / 2), 2));
  return (4 * b1 + b2 + 0.5) / 16;
}

/** Cobertura (0…1) del píxel i de una capa RGBA. */
function cobertura(d: Uint8ClampedArray, i: number): number {
  const a = d[i + 3];
  if (a === 0) return 0;
  const luma = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
  return (a / 255) * (1 - luma);
}

// ── Cachés (se reutilizan entre fotogramas) ──────────────────────────────────────────────────

let cacheGrano: {clave: string; g: Uint8Array} | null = null;

/** Grano estático por píxel, cuantizado a NIVELES_GRANO (mismo ruido "fract(sin(…))" que el shader). */
function granoDe(ancho: number, alto: number): Uint8Array {
  const clave = `${ancho}x${alto}`;
  if (cacheGrano?.clave === clave) return cacheGrano.g;
  const azar = (x: number, y: number) => {
    const v = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };
  const g = new Uint8Array(ancho * alto);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const v = azar(x, y) * 0.7 + azar(Math.floor(x / 3) + 17, Math.floor(y / 3) + 17) * 0.3;
      g[y * ancho + x] = Math.min(NIVELES_GRANO - 1, Math.floor(v * NIVELES_GRANO));
    }
  }
  cacheGrano = {clave, g};
  return g;
}

let cacheColores: {clave: string; lut: Uint32Array} | null = null;

/** Tabla de colores finales: 4 niveles de A × 4 de B × 4 de K × NIVELES_GRANO, empaquetados RGBA. */
function tablaColores(colores: EntradaTramado['colores'], grano: number): Uint32Array {
  const clave = `${colores.a}${colores.b}${colores.k}${colores.papel}${grano}`;
  if (cacheColores?.clave === clave) return cacheColores.lut;
  const [ca, cb, ck, cp] = [colores.a, colores.b, colores.k, colores.papel].map(hexARgb);
  const lut = new Uint32Array(64 * NIVELES_GRANO);
  for (let ia = 0; ia < 4; ia++) {
    for (let ib = 0; ib < 4; ib++) {
      for (let ik = 0; ik < 4; ik++) {
        const [a, b, k] = [ia / 3, ib / 3, ik / 3];
        const base = [0, 1, 2].map((c) => cp[c] * (1 + (ca[c] - 1) * a) * (1 + (cb[c] - 1) * b) * (1 + (ck[c] - 1) * k));
        for (let ig = 0; ig < NIVELES_GRANO; ig++) {
          const g = grano * ((ig + 0.5) / NIVELES_GRANO);
          const [r, v, z] = [0, 1, 2].map((c) => Math.round(255 * (base[c] * (1 - g) + ck[c] * g)));
          lut[((ia * 4 + ib) * 4 + ik) * NIVELES_GRANO + ig] = (255 << 24) | (z << 16) | (v << 8) | r;
        }
      }
    }
  }
  cacheColores = {clave, lut};
  return lut;
}

type Plancha = {
  /** Nivel de trama (0…3) por celda; `hayTrama` = false si la capa tramada está vacía. */
  niveles: Uint8Array;
  hayTrama: boolean;
  celdaX: Int32Array; // celda (ya desplazada al origen de `niveles`) de cada columna
  celdaY: Int32Array;
  anchoCeldas: number;
  /** Máscara sólida (0/1) por píxel; `haySolido` = false si la capa sólida está vacía. */
  solida: Uint8Array;
  haySolido: boolean;
  pixX: Int32Array; // columna de la capa sólida que se lee para cada columna de salida
  pixY: Int32Array;
};

/** Búferes por tinta, reservados una vez (el tamaño del lienzo no cambia entre fotogramas). */
const planchas: Plancha[] = [];

function plancha(indice: number, ancho: number, alto: number, punto: number): Plancha {
  const p = planchas[indice];
  if (p && p.celdaX.length === ancho && p.celdaY.length === alto) return p;
  const celdas = (Math.ceil(ancho / punto) + 2) * (Math.ceil(alto / punto) + 2);
  planchas[indice] = {
    niveles: new Uint8Array(celdas),
    hayTrama: false,
    celdaX: new Int32Array(ancho),
    celdaY: new Int32Array(alto),
    anchoCeldas: 0,
    solida: new Uint8Array(ancho * alto),
    haySolido: false,
    pixX: new Int32Array(ancho),
    pixY: new Int32Array(alto),
  };
  return planchas[indice];
}

function preparar(indice: number, tramada: Uint8ClampedArray, solida: Uint8ClampedArray, [dx, dy]: [number, number], ancho: number, alto: number, punto: number): Plancha {
  const p = plancha(indice, ancho, alto, punto);

  // Celdas de trama desplazadas por el registro: celda = ⌊(x + 0,5 − dx) / punto⌋
  const cx0 = Math.floor((0.5 - dx) / punto);
  const cy0 = Math.floor((0.5 - dy) / punto);
  const anchoCeldas = Math.floor((ancho - 0.5 - dx) / punto) - cx0 + 1;
  const altoCeldas = Math.floor((alto - 0.5 - dy) / punto) - cy0 + 1;
  p.anchoCeldas = anchoCeldas;
  for (let x = 0; x < ancho; x++) {
    p.celdaX[x] = Math.floor((x + 0.5 - dx) / punto) - cx0;
    p.pixX[x] = Math.min(ancho - 1, Math.max(0, Math.floor(x + 0.5 - dx)));
  }
  for (let y = 0; y < alto; y++) {
    p.celdaY[y] = Math.floor((y + 0.5 - dy) / punto) - cy0;
    p.pixY[y] = Math.min(alto - 1, Math.max(0, Math.floor(y + 0.5 - dy)));
  }

  // Niveles por celda: cobertura del píxel central de la celda, tramada con Bayer
  p.hayTrama = false;
  const centro = Math.floor(punto / 2);
  for (let j = 0; j < altoCeldas; j++) {
    const cy = cy0 + j;
    const sy = Math.min(alto - 1, Math.max(0, cy * punto + centro));
    for (let i = 0; i < anchoCeldas; i++) {
      const cx = cx0 + i;
      const sx = Math.min(ancho - 1, Math.max(0, cx * punto + centro));
      const v = cobertura(tramada, (sy * ancho + sx) * 4);
      const n = v <= 0 ? 0 : Math.max(0, Math.min(3, Math.floor(v * 3 + bayer4(cx, cy))));
      p.niveles[j * anchoCeldas + i] = n;
      if (n) p.hayTrama = true;
    }
  }

  // Máscara sólida (umbral al 50 %)
  p.haySolido = false;
  for (let q = 0, i = 3; q < ancho * alto; q++, i += 4) {
    const m = solida[i] !== 0 && cobertura(solida, i - 3) >= 0.5 ? 1 : 0;
    p.solida[q] = m;
    if (m) p.haySolido = true;
  }
  return p;
}

/** Nivel (0…3) de una tinta en el píxel (x, y). */
function nivel(p: Plancha, x: number, y: number, ancho: number): number {
  if (p.haySolido && p.solida[p.pixY[y] * ancho + p.pixX[x]]) return 3;
  return p.hayTrama ? p.niveles[p.celdaY[y] * p.anchoCeldas + p.celdaX[x]] : 0;
}

/** Tramado completo del fotograma. */
export function tramar(e: EntradaTramado): void {
  const {ancho, alto} = e;
  const listas = [0, 1, 2].map((i) => preparar(i, e.tramadas[i], e.solidas[i], e.desajustes[i], ancho, alto, e.punto));
  const g = granoDe(ancho, alto);
  const lut = tablaColores(e.colores, e.grano);
  const salida = new Uint32Array(e.salida.buffer, e.salida.byteOffset, ancho * alto);
  const [pa, pb, pk] = listas;
  for (let y = 0; y < alto; y++) {
    const fila = y * ancho;
    for (let x = 0; x < ancho; x++) {
      const indice = (nivel(pa, x, y, ancho) * 4 + nivel(pb, x, y, ancho)) * 4 + nivel(pk, x, y, ancho);
      salida[fila + x] = lut[indice * NIVELES_GRANO + g[fila + x]];
    }
  }
}
