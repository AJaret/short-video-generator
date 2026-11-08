// nº02 · El juego del caos.
//
// Tres esquinas y un dado: tira, salta a medio camino de la esquina que salió, marca el punto y
// vuelve a tirar. Del puro azar sale el triángulo de Sierpinski. Con un cuadrado sale ruido… salvo con
// una regla extra. Y con cuatro esquinas en el espacio, un tetraedro que visto de frente es un cuadrado.
//
// Escenas (linea.ts), en el pulso de la música, con transiciones del kit:
//   triángulo → (barrido) cuadrado → (iris) tetraedro 3D → (trama) final = portada
//
// Tintas: puntos → tinta B · punto que salta, dado y copias del esquema → tinta A · esquinas,
// etiquetas y aristas → negro riso.
import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {
  ANCHO,
  ALTO,
  cobertura,
  enNegativo,
  fuente,
  giroAlPulso,
  MONO,
  ORDEN,
  proyectar,
  pulsoDe,
  rotulo,
  salidaExpo,
  SEGURA,
  tramo,
  transformar,
  Transiciones,
  trazarCirculoIrregular,
  trazarLineaIrregular,
  trazarRectIrregular,
  UTIL,
  useDibujo,
  type Camara,
  type Capas,
  type ContextoSketch,
  type DatosPanel,
  type PropsSketch,
  type Pulso,
  type Rect,
  type Vec3,
} from '@canal';
import {DURACION_PORTADA} from '@canal/diseno';
import {
  escenaEn,
  indiceCuadrado,
  linea,
  PUNTOS_PORTADA,
  saltoVisible,
  semicorcheasCuadrado,
  tiradaFinal,
  tiradasCuadrado,
  tiradasTetraedro,
  tiradasTriangulo,
  transiciones,
  zoomEn,
  type Linea,
} from './linea';
import {
  conteoCaras,
  CUADRADO,
  enHuecoCentral,
  INICIO_TRIANGULO,
  JUEGO_COPO,
  JUEGO_CUADRADO,
  JUEGO_TETRAEDRO,
  JUEGO_TRIANGULO,
  TETRAEDRO,
  TRIANGULO,
  type Juego,
} from './simulacion';

const H = Math.sqrt(3) / 2;
const TAM_PUNTO = 4; // px de cada punto impreso

// ───────────────────────────── Encuadre ─────────────────────────────

function region(area: Rect): Rect {
  const arriba = Math.max(area.y, SEGURA.arriba) + 90; // sitio para la numeración y el dado
  const abajo = Math.min(area.y + area.h, UTIL.y + UTIL.h) - 30;
  return {x: UTIL.x, y: arriba, w: UTIL.w, h: Math.max(100, abajo - arriba)};
}

/** Mapa lineal de coordenadas del juego (y hacia arriba) a pantalla: X = ox + x·sx, Y = oy + y·sy. */
type Mapa = {ox: number; oy: number; sx: number; sy: number};

/** Encaja una figura de `ancho` × `alto` (unidades del juego) en la región, apoyada en su centro. */
function encajar(r: Rect, ancho: number, alto: number, margen = 0.9): Mapa {
  const s = Math.min((r.w * margen) / ancho, (r.h * margen) / alto);
  return {ox: r.x + (r.w - ancho * s) / 2, oy: r.y + (r.h + alto * s) / 2, sx: s, sy: -s};
}

const aPantalla = (m: Mapa, x: number, y: number): [number, number] => [m.ox + x * m.sx, m.oy + y * m.sy];

/** Mismo mapa, escalado `k` veces alrededor del punto (x, y) del juego (para zoom y copias a la mitad). */
function escalarEn(m: Mapa, x: number, y: number, k: number): Mapa {
  const [px, py] = aPantalla(m, x, y);
  return {ox: px + (m.ox - px) * k, oy: py + (m.oy - py) * k, sx: m.sx * k, sy: m.sy * k};
}

/** La copia de la figura encogida a la mitad (factor `k`) hacia la esquina (vx, vy): p' = v + (p − v)·k. */
function copiaHacia(m: Mapa, vx: number, vy: number, k: number): Mapa {
  return {ox: m.ox + vx * (1 - k) * m.sx, oy: m.oy + vy * (1 - k) * m.sy, sx: m.sx * k, sy: m.sy * k};
}

// ───────────────────────────── Puntos (rápido) ─────────────────────────────

let lienzo: {ctx: CanvasRenderingContext2D; img: ImageData} | null = null;

/**
 * Impresión rápida: cuadraditos escritos directamente en un ImageData (cientos de miles de puntos
 * por fotograma sin problema). `empezar` lo limpia, `cuadrito` marca uno y `volcar` lo pasa a la capa.
 */
function empezar(): Uint8ClampedArray {
  if (!lienzo) {
    const c = document.createElement('canvas');
    c.width = ANCHO;
    c.height = ALTO;
    const ctx = c.getContext('2d') as CanvasRenderingContext2D;
    lienzo = {ctx, img: ctx.createImageData(ANCHO, ALTO)};
  }
  lienzo.img.data.fill(0);
  return lienzo.img.data;
}

function cuadrito(d: Uint8ClampedArray, cx: number, cy: number, tam: number, x0 = 0, y0 = 0, x1 = ANCHO, y1 = ALTO) {
  const X = Math.round(cx - tam / 2);
  const Y = Math.round(cy - tam / 2);
  if (X < Math.max(0, x0) || Y < Math.max(0, y0) || X >= Math.min(ANCHO - tam, x1) || Y >= Math.min(ALTO - tam, y1)) return;
  for (let dy = 0; dy < tam; dy++) {
    let k = ((Y + dy) * ANCHO + X) * 4 + 3;
    for (let dx = 0; dx < tam; dx++, k += 4) d[k] = 255;
  }
}

function volcar(destino: CanvasRenderingContext2D) {
  if (!lienzo) return;
  lienzo.ctx.putImageData(lienzo.img, 0, 0);
  destino.drawImage(lienzo.ctx.canvas, 0, 0);
}

/** Imprime los puntos [desde, hasta) del juego como cuadraditos de `tam` px en `destino`. */
function pintarPuntos(destino: CanvasRenderingContext2D, j: Juego, desde: number, hasta: number, m: Mapa, recorte?: Rect, tam = TAM_PUNTO) {
  if (hasta <= desde) return;
  const d = empezar();
  const [x0, y0, x1, y1] = recorte ? [recorte.x, recorte.y, recorte.x + recorte.w, recorte.y + recorte.h] : [0, 0, ANCHO, ALTO];
  for (let i = desde; i < Math.min(hasta, j.n); i++) cuadrito(d, m.ox + j.x[i] * m.sx, m.oy + j.y[i] * m.sy, tam, x0, y0, x1, y1);
  volcar(destino);
}

// ───────────────────────────── Piezas ─────────────────────────────

const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

/** El dado: tinta A con los puntos en papel. Al tirar da un giro seco y se asienta. */
function dado(capas: Capas, x: number, y: number, tam: number, cara: number, desde: number, t: number) {
  const q = tramo(t, desde, 0.22);
  const giro = (1 - salidaExpo(q)) * (Math.PI / 2);
  const escala = 1 + 0.18 * (1 - salidaExpo(q));
  const a = capas.solido.a;
  const forma = (ctx: CanvasRenderingContext2D) => {
    ctx.translate(x, y);
    ctx.rotate(giro);
    ctx.scale(escala, escala);
  };
  a.save();
  forma(a);
  a.fillStyle = cobertura(1);
  trazarRectIrregular(a, {x: -tam / 2, y: -tam / 2, w: tam, h: tam}, 300 + cara, 2.5);
  a.fill();
  a.restore();
  enNegativo(capas, (ctx) => {
    forma(ctx);
    ctx.beginPath();
    for (const [px, py] of PIPS[cara] ?? []) {
      const cx = px * tam * 0.26;
      const cy = py * tam * 0.26;
      ctx.moveTo(cx + tam * 0.09, cy);
      ctx.arc(cx, cy, tam * 0.09, 0, Math.PI * 2);
    }
    ctx.fill();
  });
}

/** Esquinas del polígono en negro, con su etiqueta del dado. */
function esquinas(capas: Capas, m: Mapa, vertices: [number, number][], etiquetas: string[], activa: number | null) {
  const k = capas.solido.k;
  vertices.forEach(([vx, vy], i) => {
    const [x, y] = aPantalla(m, vx, vy);
    k.fillStyle = cobertura(1);
    trazarCirculoIrregular(k, x, y, i === activa ? 18 : 13, 400 + i);
    k.fill();
    k.font = fuente(MONO, 32, 700);
    k.textBaseline = 'middle';
    const arriba = vy > 0.5;
    const derecha = vx > 0.5;
    k.textAlign = vx === 0.5 ? 'center' : derecha ? 'left' : 'right';
    const dx = vx === 0.5 ? 0 : derecha ? 26 : -26;
    k.fillText(etiquetas[i], x + dx, y + (arriba ? -42 : 42));
  });
}

/** Contorno fino del polígono (guía), en negro. */
function contorno(capas: Capas, m: Mapa, vertices: [number, number][], semilla: number) {
  const k = capas.solido.k;
  k.lineWidth = 2;
  k.strokeStyle = cobertura(1);
  vertices.forEach(([ax, ay], i) => {
    const [bx, by] = vertices[(i + 1) % vertices.length];
    const [x0, y0] = aPantalla(m, ax, ay);
    const [x1, y1] = aPantalla(m, bx, by);
    k.setLineDash([6, 12]);
    trazarLineaIrregular(k, x0, y0, x1, y1, semilla + i, 0.8);
    k.stroke();
  });
  k.setLineDash([]);
}

/**
 * Un salto: el punto viaja de la posición anterior a medio camino de la esquina, con una línea
 * punteada hasta la esquina. `desde` = instante de la tirada.
 */
function salto(capas: Capas, m: Mapa, j: Juego, indice: number, vertices: number[][], desde: number, t: number, inicio: number[], grande = true) {
  const prev = indice > 0 ? [j.x[indice - 1], j.y[indice - 1]] : inicio;
  const v = vertices[j.esquina[indice]];
  const q = salidaExpo(tramo(t, desde, 0.28));
  const x = prev[0] + (j.x[indice] - prev[0]) * q;
  const y = prev[1] + (j.y[indice] - prev[1]) * q;
  const [px, py] = aPantalla(m, prev[0], prev[1]);
  const [vx, vy] = aPantalla(m, v[0], v[1]);
  const [cx, cy] = aPantalla(m, x, y);
  const k = capas.solido.k;
  if (grande) {
    k.lineWidth = 3;
    k.strokeStyle = cobertura(1);
    k.setLineDash([10, 10]);
    k.beginPath();
    k.moveTo(px, py);
    k.lineTo(vx, vy);
    k.stroke();
    k.setLineDash([]);
  }
  const a = capas.solido.a;
  a.fillStyle = cobertura(1);
  trazarCirculoIrregular(a, cx, cy, grande ? 14 : 9, 500 + (indice % 7));
  a.fill();
}

/** Marcas grandes de las tiradas lentas ("marca dónde caíste"). */
function marcas(capas: Capas, m: Mapa, j: Juego, hasta: number) {
  const b = capas.solido.b;
  b.fillStyle = cobertura(1);
  for (let i = 0; i < hasta; i++) {
    const [x, y] = aPantalla(m, j.x[i], j.y[i]);
    trazarCirculoIrregular(b, x, y, 9, 600 + i);
    b.fill();
  }
}

/** Rastro: las últimas posiciones visibles, encogiéndose (lo único que se ve durante la aceleración). */
function rastro(capas: Capas, m: Mapa, j: Juego, indices: number[]) {
  const a = capas.solido.a;
  a.fillStyle = cobertura(1);
  indices.forEach((i, n) => {
    const [x, y] = aPantalla(m, j.x[i], j.y[i]);
    const r = 3 + 6 * (n / Math.max(1, indices.length - 1));
    a.beginPath();
    a.arc(x, y, r, 0, Math.PI * 2);
    a.fill();
  });
}

const ETIQUETAS_TRI = ['1·2', '3·4', '5·6'];
const ETIQUETAS_CUAD = ['1', '2', '3', '4'];

function posDado(r: Rect): [number, number, number] {
  return [r.x + r.w - 80, r.y - 10, 104];
}

// ───────────────────────────── Escenas ─────────────────────────────

function escenaTriangulo(capas: Capas, t: number, l: Linea, r: Rect) {
  const base = encajar(r, 1, H, 0.86);
  const zoom = zoomEn(t, l);
  const m = escalarEn(base, 0, 0, zoom);
  const [dx, dy, dt] = posDado(r);
  const j = JUEGO_TRIANGULO;
  const n = tiradasTriangulo(t, l);
  const visible = saltoVisible(t, l);

  if (t < l.tRevela) {
    // Antes del golpe: marcas lentas + el punto que salta (+ puntos finos y rastro en la aceleración)
    contorno(capas, m, TRIANGULO, 10);
    esquinas(capas, m, TRIANGULO, ETIQUETAS_TRI, visible ? j.esquina[visible.indice] : null);
    marcas(capas, m, j, Math.min(n, l.lentos) - (t < l.tAcelera ? 1 : 0));
    // Las tiradas de la aceleración se acumulan finas: la forma va saliendo mientras se cuenta
    if (t >= l.tAcelera) pintarPuntos(capas.solido.b, j, l.lentos, n, m, r, 2);
    if (visible) {
      if (t >= l.tAcelera) {
        const semi = l.negra / 4;
        const previos: number[] = [];
        for (let k = 12; k >= 1; k--) {
          const s = visible.desde - k * semi;
          if (s >= l.tAcelera) previos.push(Math.max(l.lentos, tiradasTriangulo(s, l) - 1));
        }
        rastro(capas, m, j, previos);
      }
      salto(capas, m, j, visible.indice, TRIANGULO, visible.desde, t, INICIO_TRIANGULO, t < l.tAcelera);
      dado(capas, dx, dy, dt, j.cara[visible.indice], visible.desde, t);
    } else {
      dado(capas, dx, dy, dt, 6, -1, t);
    }
    return;
  }

  // Desde la revelación: todos los puntos, impresos gruesos (el golpe)
  pintarPuntos(capas.solido.b, j, 0, n, m, r);
  if (t < l.tSuerte && zoom > 1.01) {
    rotulo(capas, `zoom ×${zoom < 1.5 ? 1 : zoom < 3 ? 2 : 4}`, r.x + 10, r.y + 20, tramo(t, l.tZoom, 0.3), {tam: 30, tinta: 'a'});
  }

  // Esquema: una copia se encoge a la mitad hacia la esquina de arriba; luego las tres copias
  if (t >= l.tEncoge && t < l.tPorEso) {
    const copias = 10_000;
    rotulo(capas, 'esquema', r.x + 10, r.y + 20, tramo(t, l.tEncoge, 0.3), {tam: 30, tinta: 'a'});
    if (t < l.tCopias) {
      const k = 1 - 0.5 * salidaExpo(tramo(t, l.tEncoge, 0.45));
      pintarPuntos(capas.solido.a, j, 0, copias, copiaHacia(base, TRIANGULO[2][0], TRIANGULO[2][1], k), r, 3);
    } else {
      TRIANGULO.forEach(([vx, vy], i) => {
        if (t >= l.tCopias + i * l.negra) pintarPuntos(capas.solido.a, j, 0, copias, copiaHacia(base, vx, vy, 0.5), r, 3);
      });
    }
  }
  // El hueco del centro: contorno rosa (nunca cae un punto ahí)
  if (t >= l.tHueco) {
    const medios = [[0.5, 0], [0.75, H / 2], [0.25, H / 2]].map(([x, y]) => aPantalla(base, x, y));
    const a = capas.solido.a;
    a.lineWidth = 8;
    a.strokeStyle = cobertura(1);
    a.setLineDash([18, 12]);
    a.beginPath();
    medios.forEach(([x, y], i) => (i ? a.lineTo(x, y) : a.moveTo(x, y)));
    a.closePath();
    a.stroke();
    a.setLineDash([]);
  }
}

function escenaCuadrado(capas: Capas, t: number, l: Linea, r: Rect) {
  const m = encajar(r, 1, 1, 0.78);
  const [dx, dy, dt] = posDado(r);
  const {ruido, copo} = tiradasCuadrado(t, l);
  const conRegla = t >= l.tRegla + l.negra; // tras el barrido
  const j = conRegla ? JUEGO_COPO : JUEGO_CUADRADO;
  const {ruido: semRuido, copo: semCopo} = semicorcheasCuadrado(l);
  const sem = conRegla ? semCopo : semRuido;
  const ultima = [...sem].reverse().find((s) => s <= t);
  const enLlenado = ultima !== undefined && t < (conRegla ? l.tOrden : l.tSoloRuido + l.negra);

  contorno(capas, m, CUADRADO, 20);
  if (!conRegla) pintarPuntos(capas.solido.b, j, 0, ruido, m, r);
  else if (t >= l.tOrden) pintarPuntos(capas.solido.b, j, 0, copo, m, r);
  else if (ultima !== undefined) {
    // El copo se acumula fino y se imprime grueso en el golpe de "vuelve el orden"
    pintarPuntos(capas.solido.b, j, 0, copo, m, r, 2);
    const semi = l.negra / 4;
    const previos: number[] = [];
    for (let k = 12; k >= 1; k--) {
      const s = ultima - k * semi;
      if (s >= l.tNoRepetir) previos.push(indiceCuadrado(s, l, true));
    }
    rastro(capas, m, j, previos);
  }
  // La misma tirada (y esquina) que suena en esa semicorchea (sonido.ts usa indiceCuadrado también)
  const indice = ultima !== undefined ? indiceCuadrado(ultima, l, conRegla) : -1;
  esquinas(capas, m, CUADRADO, ETIQUETAS_CUAD, enLlenado && indice >= 0 ? j.esquina[indice] : null);
  if (enLlenado && indice >= 0) {
    salto(capas, m, j, indice, CUADRADO, ultima!, t, [0.5, 0.5], false);
    dado(capas, dx, dy, dt, j.cara[indice], ultima!, t);
  } else {
    dado(capas, dx, dy, dt, indice >= 0 ? j.cara[indice] : 4, -1, t);
  }
  if (conRegla) {
    rotulo(capas, 'regla: no repetir esquina', r.x + 10, r.y + 20, tramo(t, l.tRegla + l.negra, 0.4), {tam: 30, tinta: 'a'});
  }
}

const PUNTOS_TETRA: Vec3[] = Array.from({length: JUEGO_TETRAEDRO.n}, (_, i) => [JUEGO_TETRAEDRO.x[i], JUEGO_TETRAEDRO.y[i], JUEGO_TETRAEDRO.z![i]]);
const RAD = Math.PI / 180;

/** Ángulo reducido a (−π, π]. */
const reducir = (a: number) => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));

function giroTetraedro(t: number, l: Linea, pulso: Pulso): [number, number] {
  const libre = (s: number): [number, number] => [0.55 + 0.35 * (s - l.t3D), 0.8 + 0.6 * (s - l.t3D)];
  if (t < l.tGira) return libre(t);
  const [a, b] = libre(l.tGira);
  const pasos = Math.max(1, Math.round((l.tVisto - l.tGira) / l.negra));
  const p = Math.min(1, giroAlPulso(t, pulso, {desde: l.tGira, paso: 1 / pasos, frenado: 0.3}));
  return [reducir(a) * (1 - p), reducir(b) * (1 - p)];
}

function escenaTetraedro(capas: Capas, t: number, l: Linea, r: Rect, pulso: Pulso) {
  const [rx, ry] = giroTetraedro(t, l, pulso);
  // Al quedar de frente, la cámara se aleja y cierra el ángulo: casi ortográfica (la sombra exacta)
  const f = salidaExpo(tramo(t, l.tVisto, 0.5));
  // 0,4°: prácticamente ortográfica (con perspectiva, las esquinas cercanas crecen y el cuadrado sale torcido)
  const fov = (35 - 34.6 * f) * RAD;
  const distancia = (6 * Math.tan(17.5 * RAD)) / Math.tan(fov / 2);
  const camara: Camara = {distancia, azimut: 0, elevacion: 0, fov, centro: [r.x + r.w / 2, r.y + r.h / 2]};
  const tr = {rot: [rx, ry, 0] as Vec3, escala: 1.25};
  const n = tiradasTetraedro(t, l, PUNTOS_TETRA.length);
  const deFrente = t >= l.tVisto;

  // Aristas (se van al quedar de frente)
  if (!deFrente) {
    const k = capas.solido.k;
    k.lineWidth = 2;
    k.strokeStyle = cobertura(1);
    k.setLineDash([6, 10]);
    const v = TETRAEDRO.map((p) => proyectar(transformar(p, tr), camara));
    for (let i = 0; i < 4; i++) {
      for (let jx = i + 1; jx < 4; jx++) {
        const a = v[i];
        const b = v[jx];
        if (!a || !b) continue;
        k.beginPath();
        k.moveTo(a[0], a[1]);
        k.lineTo(b[0], b[1]);
        k.stroke();
      }
    }
    k.setLineDash([]);
    v.forEach((p) => {
      if (!p) return;
      k.fillStyle = cobertura(1);
      trazarCirculoIrregular(k, p[0], p[1], 13, 700);
      k.fill();
    });
  }
  // Vista desmontada: cada punto pertenece a la copia de la última esquina que eligió.
  const apertura = salidaExpo(tramo(t, l.tTetra, l.negra * 0.65));
  const cierre = salidaExpo(tramo(t, l.tGira - l.negra, l.negra * 0.8));
  const separacion = 0.22 * apertura * (1 - cierre);
  const encuadre = {...tr, escala: tr.escala / (1 + 2.5 * separacion)};
  pintarTetraedro(capas, n, encuadre, camara, deFrente, separacion);
  if (separacion > 0.03) rotulo(capas, 'esquema: 4 copias', r.x + 10, r.y + 20, apertura, {tam: 30, tinta: 'a'});
}

const PX = new Float32Array(JUEGO_TETRAEDRO.n);
const PY = new Float32Array(JUEGO_TETRAEDRO.n);
const PZ = new Float32Array(JUEGO_TETRAEDRO.n);
const PK = new Float32Array(JUEGO_TETRAEDRO.n);
const TAM_TETRA = 0.03; // tamaño de cada punto en unidades del mundo

/**
 * Los puntos del tetraedro proyectados con la cámara 3D e impresos rápido: los cercanos en tinta A y
 * los lejanos en B (de frente, todos en B). El tamaño depende de la profundidad.
 */
function pintarTetraedro(capas: Capas, n: number, tr: {rot: Vec3; escala: number}, camara: Camara, deFrente: boolean, separacion: number) {
  let zMin = Infinity;
  let zMax = -Infinity;
  let m = 0;
  for (let i = 0; i < n; i++) {
    const punto = PUNTOS_TETRA[i];
    const v = TETRAEDRO[JUEGO_TETRAEDRO.esquina[i]];
    const separado: Vec3 = separacion > 0
      ? [punto[0] + separacion * v[0], punto[1] + separacion * v[1], punto[2] + separacion * v[2]]
      : punto;
    const p = proyectar(transformar(separado, tr), camara);
    if (!p) continue;
    PX[m] = p[0];
    PY[m] = p[1];
    PZ[m] = p[2];
    PK[m] = p[3];
    zMin = Math.min(zMin, p[2]);
    zMax = Math.max(zMax, p[2]);
    m++;
  }
  const medio = (zMin + zMax) / 2;
  for (const [ctx, cerca] of [[capas.solido.b, false], [capas.solido.a, true]] as const) {
    if (cerca && deFrente) continue;
    const d = empezar();
    for (let i = 0; i < m; i++) {
      if (!deFrente && (PZ[i] < medio) !== cerca) continue;
      cuadrito(d, PX[i], PY[i], Math.max(3, Math.round(TAM_TETRA * PK[i])));
    }
    volcar(ctx);
  }
}

/** Final y portada: el triángulo completo, el dado tirando una vez por tiempo. */
function escenaFinal(capas: Capas, t: number, l: Linea, area: Rect, esPortada: boolean) {
  // Encima del título de la portada (el final usa el mismo encuadre: el último fotograma = el primero)
  const r0 = region(area);
  const r = {...r0, h: Math.min(r0.h, 1080 - r0.y)};
  const m = encajar(r, 1, H, 0.86);
  const [dx, dy, dt] = posDado(r);
  const j = JUEGO_TRIANGULO;
  const n = esPortada ? PUNTOS_PORTADA : tiradaFinal(t, l);
  const desde = esPortada ? -1 : l.tFinal + (n - (PUNTOS_PORTADA - Math.round((l.tTiraOtra - l.tFinal) / l.negra))) * l.negra;
  pintarPuntos(capas.solido.b, j, 0, n, m, r);
  esquinas(capas, m, TRIANGULO, ETIQUETAS_TRI, j.esquina[n - 1]);
  salto(capas, m, j, n - 1, TRIANGULO, esPortada ? -1 : desde, t, INICIO_TRIANGULO, false);
  dado(capas, dx, dy, dt, j.cara[n - 1], esPortada ? -1 : desde, t);
}

// ───────────────────────────── Componente ─────────────────────────────

const Sketch: React.FC<PropsSketch> = ({area, tiempos, config}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const pulso = pulsoDe(config);
  const l = linea(tiempos, durationInFrames / fps, pulso);

  useDibujo(ORDEN.sketch, (capas) => {
    const t = frame / fps;
    // La portada es el último fotograma (loop)
    if (t < DURACION_PORTADA) return escenaFinal(capas, t, l, area, true);
    const r = region(area);
    switch (escenaEn(t, l)) {
      case 'cuadrado':
        return escenaCuadrado(capas, t, l, r);
      case 'tetraedro':
        return escenaTetraedro(capas, t, l, r, pulso);
      case 'final':
        return escenaFinal(capas, t, l, area, false);
      default:
        return escenaTriangulo(capas, t, l, r);
    }
  });

  return <Transiciones lista={transiciones(l)} pulso={pulso} />;
};

export default Sketch;

// ───────────────────────────── Panel ─────────────────────────────

const conMiles = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Puntos en el hueco central entre las primeras n tiradas (cuenta real: siempre 0). */
const EN_HUECO = (() => {
  const acumulado = new Int32Array(JUEGO_TRIANGULO.n + 1);
  for (let i = 0; i < JUEGO_TRIANGULO.n; i++) acumulado[i + 1] = acumulado[i] + (enHuecoCentral(JUEGO_TRIANGULO.x[i], JUEGO_TRIANGULO.y[i]) ? 1 : 0);
  return acumulado;
})();

export function panel(frame: number, {fps, duracion, tiempos, config}: ContextoSketch): DatosPanel {
  const t = frame / fps;
  const pulso = pulsoDe(config);
  const l = linea(tiempos, duracion / fps, pulso);
  // Desde el cuadrado (también mientras el panel baja en el 3D), los datos del cuadrado
  if (escenaEn(t, l) !== 'triangulo') {
    const {ruido, copo} = tiradasCuadrado(t, l);
    const conRegla = t >= l.tRegla + l.negra;
    const n = conRegla ? copo : ruido;
    const caras = conteoCaras(conRegla ? JUEGO_COPO : JUEGO_CUADRADO, n, 4);
    const max = Math.max(1, ...caras);
    return {
      contadores: [
        {etiqueta: 'tiradas', valor: conMiles(n)},
        {etiqueta: 'regla', valor: conRegla ? 'no repetir' : 'ninguna'},
      ],
      formula: 'p = (p + esquina) / 2',
      grafico: caras.map((c) => c / max),
    };
  }
  const n = Math.min(JUEGO_TRIANGULO.n, tiradasTriangulo(t, l));
  const caras = conteoCaras(JUEGO_TRIANGULO, n, 6);
  const max = Math.max(1, ...caras);
  return {
    contadores: [
      {etiqueta: 'tiradas', valor: conMiles(n)},
      {etiqueta: 'en el hueco', valor: String(EN_HUECO[n])},
    ],
    formula: 'p = (p + esquina) / 2',
    grafico: caras.map((c) => c / max),
  };
}
