// nº07 · ¿Quién pinta la concha? La Regla 30 y el caracol cono textil.
//
// Escenas y momentos en linea.ts (compartido con sonido.ts). Tintas: el pigmento y las casillas
// negras en azul (B); la concha tiene un fondo rosa a 1/3 de trama, así el pigmento sale en el azul
// oscuro del solape; la columna del centro y el borde que crece, en rosa (A). Centrado en x = 540,
// sin recuadro.
import React, {useMemo} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {
  cobertura,
  conCamara,
  fuente,
  lectura,
  marcoEsquinas,
  mira,
  MONO,
  ORDEN,
  pulsoDe,
  recortarPapel,
  rotulo,
  sacudirRegistro,
  salidaCubica,
  TITULAR,
  tomaEn,
  useDibujo,
  type Capas,
  type Plano,
  type PropsSketch,
  type Toma,
} from '@canal';
import {DURACION_PORTADA} from '@canal/diseno';
import {
  barridoConcha,
  CASILLAS_FILA,
  CASOS,
  columnaCentral,
  cortes,
  desdePunto,
  enPortadaEn,
  escaneo,
  fase,
  filaBajada,
  FILAS_BAJADA,
  FILAS_PUNTO,
  filasPunto,
  linea,
  momentosBits,
  momentosCasos,
  patronConcha,
  RESPUESTAS,
  zoomPunto,
  type Campo,
  type Linea,
} from './linea';

// ── La concha (esquema) ───────────────────────────────────────────────────────────────────────

/** Silueta de un cono: espira baja arriba, hombros anchos y el cuerpo que se afila hacia abajo. */
function trazarConcha(ctx: CanvasRenderingContext2D) {
  ctx.moveTo(230, 470);
  ctx.lineTo(395, 438);
  ctx.quadraticCurveTo(470, 360, 540, 325);
  ctx.quadraticCurveTo(610, 360, 685, 438);
  ctx.lineTo(850, 470);
  ctx.quadraticCurveTo(820, 1000, 548, 1385);
  ctx.quadraticCurveTo(270, 1000, 230, 470);
  ctx.closePath();
}
const CONCHA = {x0: 226, y0: 320, cel: 9, cols: 72, filas: 120};

/** La concha con su patrón hasta la fila `filas` (todas por defecto) y, si hay, una línea rosa en `linea` (0…1). */
function concha(c: Capas, patron: Campo, op: {filas?: number; linea?: number | null} = {}) {
  const lista = [c.a, c.b, c.k, c.solido.a, c.solido.b, c.solido.k];
  for (const ctx of lista) {
    ctx.save();
    ctx.beginPath();
    trazarConcha(ctx);
    ctx.clip();
  }
  const hasta = op.filas ?? CONCHA.filas;
  // Fondo de la concha: rosa a 1/3 (lo ya pintado) y una banda de sombra a la derecha
  const yHasta = CONCHA.y0 + hasta * CONCHA.cel;
  c.a.fillStyle = cobertura(0.34);
  c.a.fillRect(CONCHA.x0, CONCHA.y0, CONCHA.cols * CONCHA.cel, yHasta - CONCHA.y0);
  c.k.fillStyle = cobertura(0.34);
  c.k.fillRect(700, CONCHA.y0, 160, yHasta - CONCHA.y0);
  // Pigmento: las casillas negras de la Regla 30 (desde una fila al azar)
  c.solido.b.fillStyle = cobertura(1);
  c.solido.b.beginPath();
  for (let y = 0; y < Math.min(hasta, patron.alto); y++) {
    for (let x = 0; x < patron.ancho; x++) {
      if (patron.celdas[y * patron.ancho + x]) c.solido.b.rect(CONCHA.x0 + x * CONCHA.cel, CONCHA.y0 + y * CONCHA.cel, CONCHA.cel, CONCHA.cel);
    }
  }
  c.solido.b.fill();
  // El borde que crece: una línea rosa
  const pos = op.linea ?? (op.filas !== undefined && op.filas < CONCHA.filas ? op.filas / CONCHA.filas : null);
  if (pos !== null && pos !== undefined) {
    c.solido.a.fillStyle = cobertura(1);
    c.solido.a.fillRect(CONCHA.x0, CONCHA.y0 + pos * CONCHA.filas * CONCHA.cel - 5, CONCHA.cols * CONCHA.cel, 10);
  }
  for (const ctx of lista) ctx.restore();
  c.solido.k.strokeStyle = cobertura(1);
  c.solido.k.lineWidth = 5;
  c.solido.k.lineJoin = 'round';
  c.solido.k.beginPath();
  trazarConcha(c.solido.k);
  c.solido.k.stroke();
}

// ── Casillas ──────────────────────────────────────────────────────────────────────────────────

/** Una casilla grande: negra (azul lleno) o blanca (solo el contorno). */
function casilla(c: Capas, x: number, y: number, s: number, negra: number, rosa = false) {
  if (negra) {
    const ctx = rosa ? c.solido.a : c.solido.b;
    ctx.fillStyle = cobertura(1);
    ctx.fillRect(x + 2, y + 2, s - 4, s - 4);
  }
  c.solido.k.strokeStyle = cobertura(1);
  c.solido.k.lineWidth = 3;
  c.solido.k.strokeRect(x + 2, y + 2, s - 4, s - 4);
}

/**
 * Un campo de la Regla 30 en el mundo (casillas de `cel` px; la columna central en x = 540 y la fila
 * 0 en y = y0), filas [desde, hasta). Solo dibuja lo que cabe en pantalla con esa toma.
 */
function campo(c: Capas, cmp: Campo, desde: number, hasta: number, cel: number, y0: number, toma: Toma, op: {centroRosa?: boolean} = {}) {
  const centro = Math.floor(cmp.ancho / 2);
  const medio = 540 / (cel * toma.zoom) + 2;
  const x0 = Math.max(0, Math.floor(centro - medio));
  const x1 = Math.min(cmp.ancho, Math.ceil(centro + medio));
  // Filas visibles con esta toma
  const yPant = (y: number) => toma.py + toma.dy + (y - toma.py) * toma.zoom;
  let f0 = desde;
  let f1 = hasta;
  while (f0 < f1 && yPant(y0 + (f0 + 1) * cel) < 0) f0++;
  while (f1 > f0 && yPant(y0 + (f1 - 1) * cel) > 1920) f1--;
  const b = c.solido.b;
  const a = c.solido.a;
  b.fillStyle = a.fillStyle = cobertura(1);
  b.beginPath();
  a.beginPath();
  for (let y = f0; y < Math.min(f1, cmp.alto); y++) {
    const o = y * cmp.ancho;
    for (let x = x0; x < x1; x++) {
      if (!cmp.celdas[o + x]) continue;
      const ctx = op.centroRosa && x === centro ? a : b;
      ctx.rect(540 + (x - centro - 0.5) * cel, y0 + y * cel, cel, cel);
    }
  }
  b.fill();
  a.fill();
}

// ── Cámara ────────────────────────────────────────────────────────────────────────────────────

function planosDe(l: Linea): Plano[] {
  const neutra = {zoom: 1};
  return [
    {desde: DURACION_PORTADA, toma: neutra, deriva: 0.06},
    {desde: l.triangulos, toma: {zoom: 1.6, px: 470, py: 820}, entrada: 'suave', viaje: 0.9, deriva: 0.06},
    {desde: l.quien, toma: neutra, entrada: 'suave', viaje: 0.8, deriva: 0.04},
    {desde: l.borde, toma: neutra, deriva: 0.05},
    {desde: l.otra, toma: neutra, deriva: 0.04},
    {desde: l.ocho, toma: neutra, deriva: 0.04},
    {desde: l.caracol, toma: neutra, deriva: 0},
  ];
}

const Y_PUNTO = 430; // fila 0 del campo desde un punto
const CEL = 4;

// ── Componente ────────────────────────────────────────────────────────────────────────────────

const Sketch: React.FC<PropsSketch> = ({tiempos, config}) => {
  const f = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const t = f / fps;
  const l = linea(tiempos, (durationInFrames - 1) / fps);
  const pulso = pulsoDe(config);
  const patron = useMemo(() => patronConcha(CONCHA.cols, CONCHA.filas, config.semilla), [config.semilla]);
  const punto = useMemo(() => desdePunto(FILAS_PUNTO + 20), []);
  const grande = useMemo(() => desdePunto(FILAS_BAJADA), []);
  const bits = useMemo(() => columnaCentral(grande, 200), [grande]);
  const listaCortes = cortes(l);

  useDibujo(ORDEN.sketch, (c) => {
    const hud: (() => void)[] = [];
    if (enPortadaEn(t, l)) {
      // Portada y final: la concha, más pequeña y arriba (por encima del título); una línea rosa la recorre
      const toma: Toma = {zoom: 0.62, px: 540, py: 325, dx: 0, dy: -115, giro: 0};
      conCamara(c, toma, () => concha(c, patron, {linea: barridoConcha(t, l)}));
    } else {
      escena(c, hud);
    }
    hud.forEach((h) => h());
    sacudirRegistro(c, t, listaCortes, 8, 0.1);
  });

  function escena(c: Capas, hud: (() => void)[]) {
    // ── La concha y el borde que crece ──
    if (t < l.otra) {
      const toma = tomaEn(t, planosDe(l));
      const filas = t >= l.borde ? Math.floor(CONCHA.filas * fase(t, l.borde + 0.2, l.otra - 0.4)) : undefined;
      conCamara(c, toma, () => {
        concha(c, patron, {filas});
        // "Sus triángulos parecen puestos al azar": miras sobre tres triángulos blancos
        if (t >= l.triangulos && t < l.borde) {
          for (const [k, [x, y]] of ([[0, [420, 700]], [1, [600, 880]], [2, [470, 1010]]] as const)) {
            mira(c.solido.k, x, y, 34, fase(t, l.triangulos + k * 0.25, l.triangulos + k * 0.25 + 0.4), t * (k % 2 ? -0.8 : 0.8));
          }
        }
      });
      hud.push(() => rotulo(c, 'esquema · caracol cono textil', 90, 1450 - 1040, fase(t, DURACION_PORTADA, DURACION_PORTADA + 0.4), {tam: 28, tinta: 'b'}));
      return;
    }

    // ── La regla: casillas grandes y los 8 casos ──
    if (t < l.empezamos) {
      const s = 56;
      const x0 = 540 - (CASILLAS_FILA * s) / 2;
      const yArriba = 520;
      const yAbajo = yArriba + s + 24;
      const muestra = desdePunto(20);
      const centro = Math.floor(muestra.ancho / 2);
      const filaArriba = Array.from({length: CASILLAS_FILA}, (_, i) => muestra.celdas[7 * muestra.ancho + centro - 7 + i]);
      const filaAbajo = Array.from({length: CASILLAS_FILA}, (_, i) => muestra.celdas[8 * muestra.ancho + centro - 7 + i]);
      const esc = escaneo(l, pulso);
      const llenas = t < esc.desde ? 0 : Math.min(CASILLAS_FILA, 1 + Math.floor((t - esc.desde) / esc.semi));
      const entra = salidaCubica(fase(t, l.otra, l.otra + 0.5));
      filaArriba.forEach((v, i) => casilla(c, x0 + i * s, yArriba - (1 - entra) * 80, s, v));
      if (t >= l.cada) {
        for (let i = 0; i < CASILLAS_FILA; i++) {
          if (i < llenas) casilla(c, x0 + i * s, yAbajo, s, filaAbajo[i], i === llenas - 1);
          else casilla(c, x0 + i * s, yAbajo, s, 0);
        }
        // El trío que mira la casilla nueva, y la flecha hacia ella
        const i = Math.max(0, Math.min(CASILLAS_FILA - 1, (llenas || 1) - 1));
        if (t < l.ocho) {
          marcoEsquinas(c.solido.a, {x: x0 + (i - 1) * s - 6, y: yArriba - 6, w: 3 * s + 12, h: s + 12}, fase(t, l.cada, l.cada + 0.4), {grosor: 5, largo: 22, desde: 30});
          const a = c.solido.a;
          a.strokeStyle = a.fillStyle = cobertura(1);
          a.lineWidth = 5;
          a.beginPath();
          a.moveTo(x0 + i * s + s / 2, yArriba + s + 2);
          a.lineTo(x0 + i * s + s / 2, yAbajo + 6);
          a.stroke();
        }
      }
      // Los 8 casos: tres arriba, la respuesta abajo
      const momentos = momentosCasos(l, pulso);
      CASOS.forEach((caso, k) => {
        if (t < momentos[k]) return;
        const cs = 44;
        const cx = 165 + (k % 4) * 250;
        const cy = 780 + Math.floor(k / 4) * 250;
        const e = salidaCubica(fase(t, momentos[k], momentos[k] + 0.25));
        const dy = (1 - e) * 40;
        for (let j = 0; j < 3; j++) casilla(c, cx - 1.5 * cs + j * cs, cy + dy, cs, Number(caso[j]));
        casilla(c, cx - cs / 2, cy + cs + 14 + dy, cs, RESPUESTAS[k]);
        if (t >= l.esa) {
          const k2 = c.solido.k;
          k2.fillStyle = cobertura(1);
          k2.font = fuente(MONO, 34, 700);
          k2.textAlign = 'center';
          k2.fillText(String(RESPUESTAS[k]), cx, cy + 2 * cs + 58);
          k2.textAlign = 'left';
        }
      });
      if (t >= l.esa) {
        const e = salidaCubica(fase(t, l.esa, l.esa + 0.4));
        const k2 = c.solido.k;
        k2.fillStyle = cobertura(1);
        k2.font = fuente(TITULAR, 110);
        k2.textAlign = 'center';
        k2.fillText('REGLA 30', 540, 1360 + (1 - e) * 60);
        k2.font = fuente(MONO, 30, 700);
        k2.fillText('00011110 en binario = 30', 540, 1250);
        k2.textAlign = 'left';
      }
      return;
    }

    // ── Desde un punto: fila a fila, y la cámara se aleja ──
    if (t < l.columna) {
      const z = zoomPunto(t, l);
      const toma: Toma = {zoom: z, px: 540, py: Y_PUNTO, dx: 0, dy: 0, giro: 0};
      const filas = Math.floor(filasPunto(t, l, pulso));
      conCamara(c, toma, () => campo(c, punto, 0, filas, CEL, Y_PUNTO, toma));
      // "Como los de la concha": el campo se recorta con la silueta de la concha
      if (t >= l.conchaDos + 0.25) {
        recortarPapel(c, (ctx) => {
          ctx.beginPath();
          ctx.rect(-10, 300, 1100, 1300);
          trazarConcha(ctx);
        }, 1, 'evenodd');
        c.solido.k.strokeStyle = cobertura(1);
        c.solido.k.lineWidth = 5;
        c.solido.k.beginPath();
        trazarConcha(c.solido.k);
        c.solido.k.stroke();
      }
      hud.push(() => {
        recortarPapel(c, (ctx) => {
          ctx.beginPath();
          ctx.rect(96, 300, 260, 62);
        });
        lectura(c.solido.k, 'filas', String(filas), 112, 350, {tam: 30});
      });
      return;
    }

    // ── La columna del centro: bits y números ──
    if (t < l.premio) {
      const toma: Toma = {zoom: 1, px: 540, py: Y_PUNTO, dx: 0, dy: 0, giro: 0};
      const mb = momentosBits(l, pulso);
      const n = t < mb.desde ? 0 : Math.min(mb.n, 1 + Math.floor((t - mb.desde) / mb.semi));
      conCamara(c, toma, () => {
        campo(c, punto, 0, FILAS_PUNTO, CEL, Y_PUNTO, toma, {centroRosa: true});
        // Cursor en la fila del bit que se lee
        if (n > 0) {
          c.solido.k.strokeStyle = cobertura(1);
          c.solido.k.lineWidth = 3;
          c.solido.k.strokeRect(540 - 14, Y_PUNTO + (n - 1) * CEL - 10, 28, CEL + 20);
        }
      });
      hud.push(() => {
        recortarPapel(c, (ctx) => {
          ctx.beginPath();
          ctx.rect(70, 1060, 940, 300);
        });
        const k = c.solido.k;
        k.fillStyle = cobertura(1);
        k.font = fuente(MONO, 26, 700);
        k.fillText('columna del centro, de ocho en ocho', 100, 1110);
        const leidos = bits.slice(0, n);
        const bytes: string[] = [];
        for (let i = 0; i + 8 <= leidos.length; i += 8) bytes.push(leidos.slice(i, i + 8).join(''));
        const resto = leidos.slice(bytes.length * 8).join('');
        k.font = fuente(MONO, 34, 700);
        bytes.slice(-3).forEach((b, i) => {
          k.fillText(b, 100, 1170 + i * 52);
          if (t >= l.azar) {
            c.solido.a.fillStyle = cobertura(1);
            c.solido.a.font = fuente(TITULAR, 40);
            c.solido.a.fillText(`= ${parseInt(b, 2)}`, 330, 1170 + i * 52);
          }
        });
        if (resto) k.fillText(resto, 100, 1170 + Math.min(3, bytes.length) * 52);
      });
      return;
    }

    // ── "Nunca se repite": la cámara baja por la columna ──
    const fila = filaBajada(t, l);
    const Y = Y_PUNTO + fila * CEL;
    const toma: Toma = {zoom: 1, px: 540, py: Y, dx: 0, dy: 880 - Y, giro: 0};
    conCamara(c, toma, () => campo(c, grande, 0, FILAS_BAJADA, CEL, Y_PUNTO, toma, {centroRosa: true}));
    if (t >= l.sigue) mira(c.solido.k, 540, 880, 46, fase(t, l.sigue, l.sigue + 0.4), t);
    hud.push(() => {
      recortarPapel(c, (ctx) => {
        ctx.beginPath();
        ctx.rect(96, 300, 280, 62);
      });
      lectura(c.solido.k, 'fila', String(Math.round(fila)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '), 112, 350, {tam: 30});
      rotulo(c, 'premio: ¿se repite alguna vez?', 90, 440, fase(t, l.premio, l.premio + 0.4), {tam: 28, tinta: 'a'});
    });
  }

  return null;
};

export default Sketch;
