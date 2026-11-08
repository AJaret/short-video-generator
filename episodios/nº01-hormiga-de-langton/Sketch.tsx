// nº01 · La hormiga de Langton.
//
// Reglas: en casilla blanca gira a la derecha, en negra a la izquierda; invierte la casilla y avanza.
// Con el tablero en blanco, tras ~10 000 pasos de caos (exactamente desde el paso 9977) repite un
// ciclo de 104 pasos para siempre y avanza en diagonal: la "autopista".
//
// Escenas (linea.ts), todas en el pulso de la música y con cortes secos en un tiempo:
//   principal · tableros (4 dibujos de partida) · cuadro (nunca se queda encerrada) ·
//   cinta (esquema: cuenta en binario) · final (vuelve la principal; acaba en el estado de portada)
//
// Tintas: casillas negras → negro riso · hormiga → tinta A · rastro reciente y autopista → tinta B ·
// cuadro de la escena "encerrada" → tinta B.
import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {
  cobertura,
  cuantizar,
  fuente,
  MONO,
  ORDEN,
  pulsoDe,
  recortarPapel,
  SEGURA,
  tiempoDeAncla,
  todasLasCapas,
  trazarRectIrregular,
  UTIL,
  useDibujo,
  type Capas,
  type ContextoSketch,
  type DatosPanel,
  type PropsSketch,
  type Pulso,
  type Rect,
  type Tiempos,
} from '@canal';
import {DURACION_PORTADA} from '@canal/diseno';
import {
  BITS,
  cinta,
  enTramoLento,
  escenaEn,
  escenas,
  PASOS_FINAL,
  pasoCuadro,
  pasoPrincipal,
  pasoTableros,
  TABLEROS,
  EXTRA_AUTOPISTA,
  type Escenas,
} from './linea';
import {cuadroEn, estadoEn, LADO, MITAD, SIM, SIM_TABLEROS, type Simulacion} from './simulacion';

const MIN_CELDAS = 11; // casillas visibles en el primer plano
const MARGEN_CELDAS = 4;
const CAMARA_EN = 0.25; // s que tarda la cámara en llegar a su nuevo encuadre en cada tiempo
const DESLIZ = 0.35; // fracción del tiempo musical que tarda la hormiga en pasar de casilla

// ───────────────────────────── Cámara ─────────────────────────────

type Camara = {cx: number; cy: number; celda: number};

function region(area: Rect): Rect {
  const arriba = Math.max(area.y, SEGURA.arriba) + 70; // deja sitio a la numeración
  const abajo = Math.min(area.y + area.h, UTIL.y + UTIL.h) - 20;
  return {x: UTIL.x, y: arriba, w: UTIL.w, h: Math.max(100, abajo - arriba)};
}

function camaraPara(sim: Simulacion, pasos: number, r: Rect, minCeldas = MIN_CELDAS): Camara {
  const k = Math.max(0, Math.min(sim.pasos, Math.floor(pasos)));
  // Con dibujo de partida, la caja incluye el dibujo
  const extra = sim.inicial ? 3 : 0;
  const minX = Math.min(sim.minX[k], -extra), maxX = Math.max(sim.maxX[k], extra);
  const minY = Math.min(sim.minY[k], -extra), maxY = Math.max(sim.maxY[k], extra);
  const ancho = Math.max(minCeldas, maxX - minX + 1 + MARGEN_CELDAS * 2);
  const alto = Math.max(minCeldas, maxY - minY + 1 + MARGEN_CELDAS * 2);
  return {cx: (minX + maxX + 1) / 2, cy: (minY + maxY + 1) / 2, celda: Math.min(r.w / ancho, r.h / alto)};
}

/**
 * Cámara a saltos, en el pulso: al empezar cada tiempo va (en CAMARA_EN s, con frenada) al encuadre
 * que necesitará al final de ese tiempo; entre tanto, quieta. `desde` = inicio de la escena.
 */
function camaraEnPulso(sim: Simulacion, paso: (t: number) => number, t: number, pulso: Pulso, r: Rect, desde: number, minCeldas = MIN_CELDAS): Camara {
  const tb = Math.max(desde, cuantizar(t, pulso, 1, 'anterior'));
  const a = camaraPara(sim, paso(tb), r, minCeldas);
  const b = camaraPara(sim, paso(tb + pulso.negra), r, minCeldas);
  const e = 1 - (1 - Math.min(1, (t - tb) / CAMARA_EN)) ** 3;
  return {cx: a.cx + (b.cx - a.cx) * e, cy: a.cy + (b.cy - a.cy) * e, celda: a.celda + (b.celda - a.celda) * e};
}

// ───────────────────────────── Un tablero ─────────────────────────────

type OpcionesTablero = {
  sim: Simulacion;
  /** Pasos con decimales (los decimales mueven la hormiga en el tramo lento). */
  pasoReal: number;
  lento: boolean;
  r: Rect;
  cam: Camara;
  /** Pasos que dura el rastro azul. */
  ventana: number;
  /** Recortar todo al rectángulo (mini tableros). */
  recortar?: boolean;
  hormigaMin?: number;
};

/** Dibuja rejilla (de cerca), rastro y autopista (B), casillas negras (K) y la hormiga (A). */
function dibujarTablero(capas: Capas, o: OpcionesTablero): {px: (x: number) => number; py: (y: number) => number} {
  const {a, b, k} = capas;
  const {sim, r, cam, lento} = o;
  const pasos = Math.min(sim.pasos, Math.floor(o.pasoReal));
  const estado = estadoEn(sim, lento ? pasos + 1 : pasos);
  const {celda} = cam;
  const ox = r.x + r.w / 2 - cam.cx * celda;
  const oy = r.y + r.h / 2 - cam.cy * celda;
  const px = (x: number) => ox + x * celda;
  const py = (y: number) => oy + y * celda;
  const x0 = Math.max(-MITAD, Math.floor((r.x - ox) / celda) - 1), x1 = Math.min(MITAD - 1, Math.ceil((r.x + r.w - ox) / celda) + 1);
  const y0 = Math.max(-MITAD, Math.floor((r.y - oy) / celda) - 1), y1 = Math.min(MITAD - 1, Math.ceil((r.y + r.h - oy) / celda) + 1);

  const lista = todasLasCapas(capas);
  if (o.recortar) {
    for (const ctx of lista) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(r.x, r.y, r.w, r.h);
      ctx.clip();
    }
  }

  // 1. Rejilla (solo de cerca), alineada a la trama de 3 px
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
  const hueco = celda > 8 ? Math.max(1, celda * 0.08) : 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const u = estado.ultima[(y + MITAD) * LADO + (x + MITAD)];
      if (u < 0) continue;
      const edad = pasos - u;
      let cob = edad < o.ventana ? 0.2 + 0.55 * (1 - edad / o.ventana) : 0;
      if (pasos > sim.autopista && u >= sim.autopista) cob = Math.max(cob, 0.5);
      if (cob > 0) {
        b.fillStyle = cobertura(cob);
        b.fillRect(px(x) + hueco, py(y) + hueco, celda - 2 * hueco, celda - 2 * hueco);
      }
    }
  }

  // 3. Casillas negras
  k.fillStyle = cobertura(1);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (estado.negra[(y + MITAD) * LADO + (x + MITAD)]) k.fillRect(px(x) + hueco, py(y) + hueco, celda - 2 * hueco, celda - 2 * hueco);
    }
  }

  // 4. La hormiga: en el tramo lento salta de casilla al empezar cada tiempo (frenando) y espera
  const f = lento ? o.pasoReal - pasos : 0;
  const suave = 1 - (1 - Math.min(1, f / DESLIZ)) ** 3;
  const siguiente = Math.min(sim.pasos, pasos + 1);
  const hx = sim.x[pasos] + (lento ? (sim.x[siguiente] - sim.x[pasos]) * suave : 0) + 0.5;
  const hy = sim.y[pasos] + (lento ? (sim.y[siguiente] - sim.y[pasos]) * suave : 0) + 0.5;
  const dir = sim.dir[lento && suave > 0.5 ? siguiente : pasos];
  dibujarHormiga(capas, px(hx), py(hy), dir, Math.max(o.hormigaMin ?? 26, celda * 0.75));

  if (o.recortar) for (const ctx of lista) ctx.restore();
  return {px, py};
}

/** Hormiga: triángulo en tinta A sobre una pastilla de papel. `dir`: 0 arriba, 1 derecha… */
function dibujarHormiga(capas: Capas, x: number, y: number, dir: number, tam: number): void {
  const triangulo = (ctx: CanvasRenderingContext2D, escala: number) => {
    const t = tam * escala;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((dir * Math.PI) / 2 - Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(t * 0.6, 0);
    ctx.lineTo(-t * 0.45, t * 0.42);
    ctx.lineTo(-t * 0.45, -t * 0.42);
    ctx.closePath();
    ctx.restore();
  };
  recortarPapel(capas, (ctx) => triangulo(ctx, 1.45));
  capas.a.fillStyle = cobertura(1);
  triangulo(capas.a, 1);
  capas.a.fill();
}

/** Texto pequeño (Space Mono, capa sólida). */
function rotulo(ctx: CanvasRenderingContext2D, texto: string, x: number, y: number, tam = 24, alineacion: CanvasTextAlign = 'left'): void {
  ctx.font = fuente(MONO, tam, 700);
  ctx.fillStyle = cobertura(1);
  ctx.textBaseline = 'top';
  ctx.textAlign = alineacion;
  ctx.fillText(texto, x, y);
}

// ───────────────────────────── Escenas ─────────────────────────────

function escenaPrincipal(capas: Capas, t: number, e: Escenas, pulso: Pulso, r: Rect): void {
  const paso = (s: number) => pasoPrincipal(s, e);
  const desde = t >= e.tFinal ? e.tFinal : DURACION_PORTADA;
  const cam = t < DURACION_PORTADA ? camaraPara(SIM, PASOS_FINAL, r) : camaraEnPulso(SIM, paso, t, pulso, r, desde);
  const porSegundo = Math.max(1, paso(t + 0.5) - paso(t - 0.5));
  dibujarTablero(capas, {
    sim: SIM,
    pasoReal: paso(t),
    lento: enTramoLento(t, e),
    r,
    cam,
    ventana: Math.min(600, Math.max(6, porSegundo * 0.6)),
  });
}

function escenaTableros(capas: Capas, t: number, e: Escenas, pulso: Pulso, r: Rect): void {
  const hueco = 26;
  const w = (r.w - hueco) / 2;
  const h = (r.h - hueco) / 2;
  SIM_TABLEROS.forEach((sim, i) => {
    const rect: Rect = {x: r.x + (i % 2) * (w + hueco), y: r.y + Math.floor(i / 2) * (h + hueco) + 34, w, h: h - 34};
    const final = TABLEROS[i].autopista + EXTRA_AUTOPISTA;
    const paso = (s: number) => Math.min(final, pasoTableros(s, e));
    const cam = camaraEnPulso(sim, paso, t, pulso, rect, e.tTableros, 9);
    dibujarTablero(capas, {sim, pasoReal: paso(t), lento: false, r: rect, cam, ventana: 80, recortar: true, hormigaMin: 16});
    // Marco tembloroso y rótulo
    capas.solido.k.strokeStyle = cobertura(1);
    capas.solido.k.lineWidth = 3;
    trazarRectIrregular(capas.solido.k, rect, 300 + i, 1.2);
    capas.solido.k.stroke();
    rotulo(capas.solido.k, `dibujo ${i + 1}`, rect.x, rect.y - 32);
    if (paso(t) >= TABLEROS[i].autopista) rotulo(capas.solido.a, 'autopista', rect.x + rect.w, rect.y - 32, 24, 'right');
  });
}

function escenaCuadro(capas: Capas, t: number, e: Escenas, pulso: Pulso, r: Rect): void {
  const paso = (s: number) => pasoCuadro(s, e);
  const cam = camaraEnPulso(SIM, paso, t, pulso, r, e.tCuadro, 15);
  const {px, py} = dibujarTablero(capas, {sim: SIM, pasoReal: paso(t), lento: false, r, cam, ventana: 60});
  const {caja} = cuadroEn(t, e);
  const b = capas.solido.b;
  b.save();
  b.strokeStyle = cobertura(1);
  b.lineWidth = 6;
  b.setLineDash([18, 12]);
  b.strokeRect(px(caja.minX), py(caja.minY), px(caja.maxX + 1) - px(caja.minX), py(caja.maxY + 1) - py(caja.minY));
  b.restore();
}

function escenaCinta(capas: Capas, t: number, e: Escenas, r: Rect): void {
  const movs = cinta(e);
  let i = 0;
  while (i + 1 < movs.length && movs[i + 1].t <= t) i++;
  const mov = movs[i];
  const previo = movs[Math.max(0, i - 1)];
  const tam = Math.min(140, r.w / (BITS + 1));
  const x0 = r.x + (r.w - tam * BITS) / 2;
  const cy = r.y + r.h * 0.45;
  const {k, solido} = capas;
  for (let b = 0; b < BITS; b++) {
    const celda: Rect = {x: x0 + b * tam + 8, y: cy - tam / 2 + 8, w: tam - 16, h: tam - 16};
    solido.k.strokeStyle = cobertura(1);
    solido.k.lineWidth = 4;
    trazarRectIrregular(solido.k, celda, 400 + b, 1.5);
    solido.k.stroke();
    if (mov.bits[b]) {
      k.fillStyle = cobertura(1);
      trazarRectIrregular(k, celda, 500 + b, 1.5);
      k.fill();
    }
    rotulo(solido.k, String(mov.bits[b]), celda.x + celda.w / 2, celda.y + celda.h + 18, 40, 'center');
  }
  // Cabezal (la hormiga) encima de la casilla que lee; se desliza al moverse
  const f = Math.min(1, (t - mov.t) / ((e.negra / 4) * 0.7));
  const suave = 1 - (1 - f) ** 3;
  const pos = previo.pos + (mov.pos - previo.pos) * suave;
  dibujarHormiga(capas, x0 + (pos + 0.5) * tam, cy - tam / 2 - 40, 2, 46);
  rotulo(solido.k, `= ${mov.numero}`, r.x + r.w / 2, cy + tam / 2 + 90, 72, 'center');
  rotulo(solido.k, 'esquema: una máquina que cuenta en binario', r.x + r.w / 2, r.y + 10, 24, 'center');
}

// ───────────────────────────── Componente ─────────────────────────────

const Sketch: React.FC<PropsSketch> = ({area, tiempos, config}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();

  useDibujo(ORDEN.sketch, (capas) => {
    const pulso = pulsoDe(config);
    const t = frame / fps;
    const e = escenas(tiempos, durationInFrames / fps, pulso);
    const r = region(area);
    switch (escenaEn(t, e)) {
      case 'tableros':
        return escenaTableros(capas, t, e, pulso, r);
      case 'cuadro':
        return escenaCuadro(capas, t, e, pulso, r);
      case 'cinta':
        return escenaCinta(capas, t, e, r);
      default:
        return escenaPrincipal(capas, t, e, pulso, r);
    }
  });

  return null;
};

export default Sketch;

// ───────────────────────────── Panel ─────────────────────────────

const conMiles = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const DISTANCIA_MAX = 90; // distancia (Manhattan) al origen en el paso final ≈ 88

/** Lista de comprobación: lo que se sabe, revelado a medida que la voz lo dice. */
function comprobacion(t: number, tiempos: Tiempos | null) {
  const ya = (ancla: string) => (tiempoDeAncla(tiempos, ancla) ?? Infinity) <= t;
  return [
    {etiqueta: '¿siempre?', valor: ya('nadie lo ha demostrado') ? '?' : '…'},
    {etiqueta: '¿encerrada?', valor: ya('nunca se queda encerrada') ? 'NO' : '…'},
    {etiqueta: '¿calcula?', valor: ya('cualquier cálculo') ? 'SÍ' : '…'},
  ];
}

export function panel(frame: number, {fps, duracion, tiempos, config}: ContextoSketch): DatosPanel {
  const t = frame / fps;
  const e = escenas(tiempos, duracion / fps, pulsoDe(config));
  const escena = escenaEn(t, e);
  if (escena === 'principal') {
    const pasos = Math.min(PASOS_FINAL, Math.floor(pasoPrincipal(t, e)));
    const barras = 28;
    return {
      contadores: [
        {etiqueta: 'pasos', valor: conMiles(pasos)},
        {etiqueta: 'casillas negras', valor: conMiles(estadoEn(SIM, pasos).negras)},
      ],
      formula: 'blanco: derecha · negro: izquierda',
      // Distancia al origen a lo largo del recorrido: plana en el caos, se dispara con la autopista
      grafico: Array.from({length: barras}, (_, i) => {
        const s = Math.floor((pasos * (i + 1)) / barras);
        return Math.min(1, (Math.abs(SIM.x[s]) + Math.abs(SIM.y[s])) / DISTANCIA_MAX);
      }),
    };
  }
  let formula = 'demostrado: 1992 y 2002';
  if (escena === 'tableros') {
    const n = TABLEROS.filter((tb) => Math.min(tb.autopista + EXTRA_AUTOPISTA, pasoTableros(t, e)) >= tb.autopista).length;
    formula = `autopista: ${n} de 4 dibujos`;
  } else if (escena === 'cuadro') {
    const n = cuadroEn(t, e).salidas;
    formula = `se salió del cuadro: ${n} ${n === 1 ? "vez" : "veces"}`;
  } else if (escena === 'cinta') {
    const movs = cinta(e);
    const mov = [...movs].reverse().find((m) => m.t <= t) ?? movs[0];
    formula = `cuenta: ${mov.numero} (en binario: ${mov.numero.toString(2).padStart(BITS, '0')})`;
  }
  return {contadores: comprobacion(t, tiempos), formula};
}

