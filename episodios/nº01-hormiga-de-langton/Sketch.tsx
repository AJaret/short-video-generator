// nº01 · La hormiga de Langton.
//
// Reglas: en casilla blanca gira a la derecha, en negra a la izquierda; invierte la casilla y avanza.
// Tras ~10 000 pasos de caos (exactamente desde el paso 9977) repite un ciclo de 104 pasos para
// siempre y avanza en diagonal: la "autopista".
//
// Tintas: casillas negras → negro riso · hormiga → tinta A · rastro reciente y autopista → tinta B.
// La animación se sincroniza con la voz mediante anclas del guion (tiempoDeAncla).
import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {
  cobertura,
  DURACION_PORTADA,
  ORDEN,
  recortarPapel,
  SEGURA,
  tiempoDeAncla,
  UTIL,
  useDibujo,
  type ContextoSketch,
  type DatosPanel,
  type PropsSketch,
  type Rect,
  type Tiempos,
} from '@canal';

const PASOS_FINAL = 12000;
const INICIO_AUTOPISTA = 9977;
const SEG_POR_PASO = 0.45; // ritmo de los primeros pasos, para que se entiendan las reglas
const MIN_CELDAS = 11; // casillas visibles en el primer plano
const MARGEN_CELDAS = 4;
const SUAVIZADO = 10; // fotogramas que promedia la cámara

// ───────────────────────────── Simulación (se calcula una vez) ─────────────────────────────

const LADO = 256;
const MITAD = LADO / 2;
// Direcciones en coordenadas de pantalla (y hacia abajo): 0 arriba, 1 derecha, 2 abajo, 3 izquierda
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

type Simulacion = {
  x: Int16Array; // posición tras k pasos (k = 0 … PASOS_FINAL)
  y: Int16Array;
  dir: Uint8Array;
  minX: Int16Array; // caja de lo visitado hasta el paso k
  maxX: Int16Array;
  minY: Int16Array;
  maxY: Int16Array;
};

function simular(): Simulacion {
  const n = PASOS_FINAL + 1;
  const s: Simulacion = {
    x: new Int16Array(n), y: new Int16Array(n), dir: new Uint8Array(n),
    minX: new Int16Array(n), maxX: new Int16Array(n), minY: new Int16Array(n), maxY: new Int16Array(n),
  };
  const negra = new Uint8Array(LADO * LADO);
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
  }
  return s;
}

const SIM = simular();

type Estado = {negra: Uint8Array; ultima: Int32Array; negras: number};
let memo: {pasos: number; estado: Estado} | null = null;

/** Cuadrícula tras `pasos` pasos, reconstruida desde el paso 0 (determinista). */
function estadoEn(pasos: number): Estado {
  if (memo && memo.pasos === pasos) return memo.estado;
  const negra = new Uint8Array(LADO * LADO);
  const ultima = new Int32Array(LADO * LADO).fill(-1);
  let negras = 0;
  for (let k = 0; k < pasos; k++) {
    const i = (SIM.y[k] + MITAD) * LADO + (SIM.x[k] + MITAD);
    negra[i] ^= 1;
    negras += negra[i] ? 1 : -1;
    ultima[i] = k;
  }
  const estado = {negra, ultima, negras};
  memo = {pasos, estado};
  return estado;
}

// ───────────────────────────── Línea de tiempo (anclada a la voz) ─────────────────────────────

/** Puntos (segundo, paso) por los que pasa la animación. Sin voz se usan tiempos aproximados. */
function claves(tiempos: Tiempos | null, duracionS: number): [number, number][] {
  const t = (ancla: string, defecto: number) => tiempoDeAncla(tiempos, ancla) ?? defecto;
  const t0 = Math.max(DURACION_PORTADA + 0.3, t('si pisa blanco', 3.2));
  const tFacil = Math.max(t0 + 1, t('fácil verdad', 12));
  const lentos = Math.floor((tFacil - t0) / SEG_POR_PASO);
  const tMil = Math.max(tFacil + 0.5, t('mil pasos', tFacil + 2.5));
  const tCinco = Math.max(tMil + 0.5, t('cinco mil', tMil + 1.5));
  const tDiezMil = Math.max(tCinco + 1, t('paso diez mil', tCinco + 4));
  const tAutopista = Math.max(tDiezMil + 0.5, t('una autopista', tDiezMil + 1.5));
  const tCiento = Math.max(tAutopista + 0.5, t('ciento cuatro', tAutopista + 2));
  const tFin = Math.max(tCiento + 1, duracionS - 1.2); // el último segundo queda quieto (= portada)
  return [
    [t0, 0],
    [tFacil, lentos],
    [tMil, 1000],
    [tCinco, 5000],
    [tDiezMil, INICIO_AUTOPISTA],
    [tAutopista, 10500],
    [tCiento, 11000],
    [tFin, PASOS_FINAL],
  ];
}

/** Paso (con decimales) en el segundo `t`. Durante la portada: el estado final (miniatura y loop). */
function pasoEn(t: number, puntos: [number, number][]): number {
  if (t < DURACION_PORTADA) return PASOS_FINAL;
  if (t <= puntos[0][0]) return 0;
  for (let i = 0; i < puntos.length - 1; i++) {
    const [ta, pa] = puntos[i];
    const [tb, pb] = puntos[i + 1];
    if (t <= tb) {
      const f = (t - ta) / (tb - ta);
      // Primer tramo lineal (un paso cada SEG_POR_PASO); el resto, exponencial
      if (i === 0) return pa + (pb - pa) * f;
      return Math.exp(Math.log(pa + 1) + (Math.log(pb + 1) - Math.log(pa + 1)) * f) - 1;
    }
  }
  return PASOS_FINAL;
}

// ───────────────────────────── Cámara ─────────────────────────────

type Camara = {cx: number; cy: number; celda: number};

function region(area: Rect): Rect {
  const arriba = Math.max(area.y, SEGURA.arriba) + 70; // deja sitio a la numeración
  const abajo = Math.min(area.y + area.h, UTIL.y + UTIL.h) - 20;
  return {x: UTIL.x, y: arriba, w: UTIL.w, h: Math.max(100, abajo - arriba)};
}

function camaraPara(pasos: number, r: Rect): Camara {
  const k = Math.min(PASOS_FINAL, Math.floor(pasos));
  const ancho = Math.max(MIN_CELDAS, SIM.maxX[k] - SIM.minX[k] + 1 + MARGEN_CELDAS * 2);
  const alto = Math.max(MIN_CELDAS, SIM.maxY[k] - SIM.minY[k] + 1 + MARGEN_CELDAS * 2);
  return {
    cx: (SIM.minX[k] + SIM.maxX[k] + 1) / 2,
    cy: (SIM.minY[k] + SIM.maxY[k] + 1) / 2,
    celda: Math.min(r.w / ancho, r.h / alto),
  };
}

// ───────────────────────────── Dibujo ─────────────────────────────

const Sketch: React.FC<PropsSketch> = ({area, tiempos}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();

  useDibujo(ORDEN.sketch, (capas) => {
    const {a, b, k} = capas;
    const puntos = claves(tiempos, durationInFrames / fps);
    const pasoReal = pasoEn(frame / fps, puntos);
    const pasos = Math.min(PASOS_FINAL, Math.floor(pasoReal));
    const estado = estadoEn(pasos);
    const r = region(area);

    // Cámara suavizada: promedio de los últimos fotogramas (sin saltar a través de la portada)
    let cx = 0, cy = 0, celda = 0, n = 0;
    for (let i = 0; i < SUAVIZADO; i++) {
      const f = frame - i;
      if (f < 0 || (frame / fps >= DURACION_PORTADA && f / fps < DURACION_PORTADA)) break;
      const c = camaraPara(pasoEn(f / fps, puntos), r);
      cx += c.cx; cy += c.cy; celda += c.celda; n++;
    }
    cx /= n; cy /= n; celda /= n;
    const ox = r.x + r.w / 2 - cx * celda;
    const oy = r.y + r.h / 2 - cy * celda;
    const px = (x: number) => ox + x * celda;
    const py = (y: number) => oy + y * celda;

    // Casillas a recorrer: lo visible
    const x0 = Math.floor((r.x - ox) / celda) - 1, x1 = Math.ceil((r.x + r.w - ox) / celda) + 1;
    const y0 = Math.floor((r.y - oy) / celda) - 1, y1 = Math.ceil((r.y + r.h - oy) / celda) + 1;

    // 1. Rejilla (solo de cerca): líneas tramadas en negro, recortadas a la región y alineadas
    //    a la trama de 3 px para que todas salgan con el mismo punteado
    if (celda >= 28) {
      const al3 = (v: number) => Math.round(v / 3) * 3 + 1.5;
      k.save();
      k.beginPath();
      k.rect(r.x, r.y, r.w, r.h);
      k.clip();
      k.strokeStyle = cobertura(Math.min(0.45, 0.2 + (celda - 28) / 120));
      k.lineWidth = 3;
      k.beginPath();
      for (let x = x0; x <= x1; x++) { k.moveTo(al3(px(x)), r.y); k.lineTo(al3(px(x)), r.y + r.h); }
      for (let y = y0; y <= y1; y++) { k.moveTo(r.x, al3(py(y))); k.lineTo(r.x + r.w, al3(py(y))); }
      k.stroke();
      k.restore();
    }

    // 2. Tinta B: rastro reciente (se apaga) y autopista
    const pasosPorSegundo = Math.max(1, pasoEn((frame + 15) / fps, puntos) - pasoEn((frame - 15) / fps, puntos));
    const ventana = Math.min(600, Math.max(6, pasosPorSegundo * 0.6));
    const hueco = celda > 8 ? Math.max(1, celda * 0.08) : 0;
    for (let y = Math.max(y0, -MITAD); y <= Math.min(y1, MITAD - 1); y++) {
      for (let x = Math.max(x0, -MITAD); x <= Math.min(x1, MITAD - 1); x++) {
        const i = (y + MITAD) * LADO + (x + MITAD);
        const u = estado.ultima[i];
        if (u < 0) continue;
        const edad = pasos - u;
        let cob = edad < ventana ? 0.2 + 0.55 * (1 - edad / ventana) : 0;
        if (pasos > INICIO_AUTOPISTA && u >= INICIO_AUTOPISTA) cob = Math.max(cob, 0.5);
        if (cob > 0) {
          b.fillStyle = cobertura(cob);
          b.fillRect(px(x) + hueco, py(y) + hueco, celda - 2 * hueco, celda - 2 * hueco);
        }
      }
    }

    // 3. Casillas negras: negro riso
    k.fillStyle = cobertura(1);
    for (let y = Math.max(y0, -MITAD); y <= Math.min(y1, MITAD - 1); y++) {
      for (let x = Math.max(x0, -MITAD); x <= Math.min(x1, MITAD - 1); x++) {
        if (estado.negra[(y + MITAD) * LADO + (x + MITAD)]) {
          k.fillRect(px(x) + hueco, py(y) + hueco, celda - 2 * hueco, celda - 2 * hueco);
        }
      }
    }

    // 4. La hormiga (tinta A), sobre una pastilla de papel para que se distinga del negro.
    //    En los pasos lentos se desliza de una casilla a la siguiente.
    const lento = pasosPorSegundo < 6 && pasos < PASOS_FINAL;
    const f = lento ? pasoReal - pasos : 0;
    const suave = f * f * (3 - 2 * f);
    const hx = SIM.x[pasos] + (lento ? (SIM.x[pasos + 1] - SIM.x[pasos]) * suave : 0) + 0.5;
    const hy = SIM.y[pasos] + (lento ? (SIM.y[pasos + 1] - SIM.y[pasos]) * suave : 0) + 0.5;
    const dir = SIM.dir[Math.min(PASOS_FINAL, pasos + (lento && suave > 0.5 ? 1 : 0))];
    const tam = Math.max(26, celda * 0.75);
    const triangulo = (ctx: CanvasRenderingContext2D, escala: number) => {
      const ang = (dir * Math.PI) / 2 - Math.PI / 2; // 0 = arriba
      const t = tam * escala;
      ctx.save();
      ctx.translate(px(hx), py(hy));
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(t * 0.6, 0);
      ctx.lineTo(-t * 0.45, t * 0.42);
      ctx.lineTo(-t * 0.45, -t * 0.42);
      ctx.closePath();
      ctx.restore();
    };
    recortarPapel(capas, (ctx) => triangulo(ctx, 1.45));
    a.fillStyle = cobertura(1);
    triangulo(a, 1);
    a.fill();
  });

  return null;
};

export default Sketch;

// ───────────────────────────── Panel ─────────────────────────────

const conMiles = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const DISTANCIA_MAX = 90; // distancia (Manhattan) al origen en el paso final ≈ 88

export function panel(frame: number, {fps, duracion, tiempos}: ContextoSketch): DatosPanel {
  const puntos = claves(tiempos, duracion / fps);
  const pasos = Math.min(PASOS_FINAL, Math.floor(pasoEn(frame / fps, puntos)));
  const barras = 28;
  return {
    contadores: [
      {etiqueta: 'pasos', valor: conMiles(pasos)},
      {etiqueta: 'casillas negras', valor: conMiles(estadoEn(pasos).negras)},
    ],
    formula: 'blanco: derecha · negro: izquierda',
    // Distancia al origen a lo largo del recorrido: plana en el caos, se dispara con la autopista
    grafico: Array.from({length: barras}, (_, i) => {
      const s = Math.floor((pasos * (i + 1)) / barras);
      return Math.min(1, (Math.abs(SIM.x[s]) + Math.abs(SIM.y[s])) / DISTANCIA_MAX);
    }),
  };
}
