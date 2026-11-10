// nº05 · ¿Quién cuenta las semillas? El girasol del modelo de Vogel y el ángulo de oro.
//
// Escenas y momentos en linea.ts (compartido con sonido.ts). Tintas: semillas en negro (trama), las
// 34 espirales en rosa (tinta A), las 55 en azul (tinta B): donde se cruzan sale el morado del multiply.
// Con cámara (planos con la voz, acercamientos lentos, sin zoom con rebote) y recortado al visor.
import React from 'react';
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
  recortarA,
  rotulo,
  sacudirRegistro,
  salidaCubica,
  tomaEn,
  useDibujo,
  VISOR,
  type Capas,
  type Plano,
  type PropsSketch,
  type Toma,
} from '@canal';
import {DURACION_PORTADA} from '@canal/diseno';
import {
  anguloEn,
  cortes,
  crecimiento,
  DESDE_ESPIRAL,
  enPortadaEn,
  espirales,
  ESTUDIO,
  fase,
  linea,
  momentosEstudio,
  semillasEn,
  SEMILLAS,
  type Linea,
} from './linea';

// ── Geometría ─────────────────────────────────────────────────────────────────────────────────

type Vista = {cx: number; cy: number; c: number};
/** El girasol grande: radio 420 px con 400 semillas (c·√400). */
const VISTA: Vista = {cx: 505, cy: 790, c: 21};
/** Portada y final: más pequeño y más arriba, por encima del título. */
const VISTA_PORTADA: Vista = {cx: 505, cy: 610, c: 16};

const RAD = Math.PI / 180;
const posicion = (n: number, angulo: number, v: Vista, giro = 0): [number, number] => {
  const a = n * angulo * RAD + giro;
  const r = v.c * Math.sqrt(n);
  return [v.cx + r * Math.cos(a), v.cy + r * Math.sin(a)];
};

/** Semillas 1…⌈N⌉ en negro; `escala(n)` (0…1) para las que están saliendo; `barrido` las pinta en rosa. */
function semillas(
  c: Capas,
  N: number,
  angulo: number,
  v: Vista,
  op: {escala?: (n: number) => number; barrido?: number | null; giro?: number; solido?: boolean; minimo?: number} = {},
) {
  const tam = 0.42 * v.c;
  const negro = op.solido ? c.solido.k : c.k;
  for (const ctx of [negro, c.a]) {
    ctx.fillStyle = cobertura(1);
    ctx.beginPath();
  }
  for (let n = 1; n <= Math.ceil(N); n++) {
    const e = op.escala ? op.escala(n) : 1;
    if (e <= 0.02) continue;
    const [x, y] = posicion(n, angulo, v, op.giro);
    let ctx = negro;
    if (op.barrido !== undefined && op.barrido !== null) {
      // El barrido de la portada: una cuña que gira; sus semillas, en rosa
      const d = (((Math.atan2(y - v.cy, x - v.cx) - op.barrido) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      if (d > 2 * Math.PI - 0.7) ctx = c.a;
    }
    const r = Math.max(op.minimo ?? 0, tam * (0.75 + 0.25 * Math.sqrt(n / SEMILLAS))) * e;
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }
  negro.fill();
  c.a.fill();
}

/** Las primeras `k` espirales de la familia `paso` (34 o 55): une cada semilla con la de n + paso. */
function familia(ctx: CanvasRenderingContext2D, paso: number, k: number, angulo: number, v: Vista, desde: number, grosor: number) {
  ctx.strokeStyle = cobertura(1);
  ctx.lineWidth = grosor;
  ctx.lineJoin = 'round';
  for (let r = 0; r < Math.min(k, paso); r++) {
    let n = desde + ((((r - desde) % paso) + paso) % paso);
    ctx.beginPath();
    const [x0, y0] = posicion(n, angulo, v);
    ctx.moveTo(x0, y0);
    for (n += paso; n <= SEMILLAS; n += paso) {
      const [x, y] = posicion(n, angulo, v);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

/** "137,5°": coma decimal. */
const grados = (a: number) => `${a.toFixed(1).replace('.', ',')}°`;

// ── Cámara ────────────────────────────────────────────────────────────────────────────────────

function planosDe(l: Linea, inicioCrecimiento: number, finCrecimiento: number): Plano[] {
  const neutra = {zoom: 1};
  const centro = {px: VISTA.cx, py: VISTA.cy};
  // Hueco entre dos rayos con 135° (los rayos van cada 45°): a 22,5° y a 260 px del centro
  const hueco = {px: VISTA.cx + 260 * Math.cos(22.5 * RAD), py: VISTA.cy + 260 * Math.sin(22.5 * RAD)};
  const zona = {px: VISTA.cx - 230, py: VISTA.cy + 120};
  return [
    {desde: DURACION_PORTADA, toma: neutra, deriva: 0.05},
    {desde: l.treinta, toma: {zoom: 1.12, ...centro}, entrada: 'suave', viaje: 0.8, deriva: 0.05},
    {desde: l.fibonacci, toma: neutra, entrada: 'suave', viaje: 0.8, deriva: 0.04},
    // Crecimiento: muy cerca del centro, y la cámara se aleja mientras salen cientos
    {desde: inicioCrecimiento, toma: {zoom: 3.2, ...centro}, deriva: 0.08},
    {desde: l.regla, toma: {zoom: 1, ...centro}, entrada: 'suave', viaje: Math.max(0.8, finCrecimiento - l.regla), deriva: 0},
    {desde: l.redondo, toma: neutra, deriva: 0.05},
    {desde: l.rayos, toma: {zoom: 1.7, ...hueco}, entrada: 'suave', viaje: 0.7, deriva: 0.06},
    {desde: l.ciento37, toma: neutra, entrada: 'suave', viaje: 0.7, deriva: 0.05},
    {desde: l.oro, toma: neutra, deriva: 0.07, giro: 0.05},
    {desde: l.sinHuecos, toma: {zoom: 1.6, ...zona}, entrada: 'suave', viaje: 0.7, deriva: 0.06},
    {desde: l.espirales, toma: neutra, entrada: 'suave', viaje: 0.8, deriva: 0.04},
    {desde: l.aunque, toma: neutra, deriva: 0.05},
    // Final: sin cámara, como la portada (loop)
    {desde: l.equivocaron, toma: neutra, deriva: 0},
  ];
}

// ── Componente ────────────────────────────────────────────────────────────────────────────────

const Sketch: React.FC<PropsSketch> = ({tiempos, config}) => {
  const f = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const t = f / fps;
  const l = linea(tiempos, (durationInFrames - 1) / fps);
  const pulso = pulsoDe(config);
  const cr = crecimiento(l, pulso);
  const esp = espirales(l, pulso);
  const listaCortes = cortes(l, pulso);

  useDibujo(ORDEN.sketch, (c) => {
    const hud: (() => void)[] = [];
    const enPortada = enPortadaEn(t, l);
    const toma = tomaEn(t, planosDe(l, cr.inicio, cr.rapidoHasta));
    if (enPortada) escenaPortada(c);
    else recortarA(c, VISOR, () => conCamara(c, toma, () => escena(c, toma, hud)));

    if (!enPortada) {
      const corte = Math.max(DURACION_PORTADA, ...listaCortes.filter((x) => x <= t));
      marcoEsquinas(c.solido.k, VISOR, fase(t, corte, corte + 0.45), {grosor: 4, largo: 40});
    }
    hud.forEach((h) => h());
    sacudirRegistro(c, t, listaCortes, 8, 0.1);
  });

  /** Portada y final: el girasol de oro; un barrido rosa gira (no en el fotograma 0 ni en el último). */
  function escenaPortada(c: Capas) {
    const barrido = t > 0.05 && t < DURACION_PORTADA ? t * 2.4 : t >= l.equivocaron && t < l.fin - 0.3 ? (t - l.equivocaron) * 2.4 + 1 : null;
    semillas(c, SEMILLAS, anguloEn(0, l), VISTA_PORTADA, {barrido});
  }

  function escena(c: Capas, toma: Toma, hud: (() => void)[]) {
    const lecturas = (e1: string, v1: string, e2: string, v2: string) =>
      hud.push(() => {
        lectura(c.solido.k, e1, v1, 112, 345, {tam: 30});
        lectura(c.solido.k, e2, v2, 898, 345, {tam: 30, alinear: 'right'});
      });

    // ── Estudio de 2016: cuatro girasoles (esquema) ──
    if (t >= l.aunque) {
      const momentos = momentosEstudio(l, pulso);
      const sitios: [number, number][] = [[300, 620], [710, 620], [300, 1040], [710, 1040]];
      ESTUDIO.forEach((g, i) => {
        const e = salidaCubica(fase(t, momentos[i], momentos[i] + 0.3));
        if (e <= 0) return;
        const [cx, cy] = sitios[i];
        const v = {cx, cy, c: (150 * e) / Math.sqrt(g.n)};
        semillas(c, g.n, g.angulo, v, {giro: (t - l.aunque) * 0.15, solido: true, minimo: 2.6 * e});
        const k = g.fibonacci ? c.solido.k : c.solido.a;
        k.fillStyle = cobertura(1);
        k.font = fuente(MONO, 30, 700);
        k.textAlign = 'center';
        k.fillText(g.espirales, cx, cy + 195);
        k.textAlign = 'left';
        if (!g.fibonacci) {
          const p = fase(t, l.unaDeCada, l.unaDeCada + 0.45);
          marcoEsquinas(c.solido.a, {x: cx - 175, y: cy - 175, w: 350, h: 410}, p, {grosor: 5, largo: 34, desde: 50});
          if (p > 0) {
            c.solido.a.font = fuente(MONO, 26, 700);
            c.solido.a.textAlign = 'center';
            c.solido.a.fillText('no Fibonacci', cx, cy + 228);
            c.solido.a.textAlign = 'left';
          }
        }
      });
      hud.push(() => rotulo(c, 'esquema · estudio de 2016: 657 girasoles', 90, 430, fase(t, l.aunque, l.aunque + 0.4), {tam: 28, tinta: 'b'}));
      return;
    }

    const angulo = anguloEn(t, l);
    const N = semillasEn(t, l, pulso);
    const creciendo = t >= cr.inicio && t < cr.rapidoHasta;
    const escala = creciendo ? (n: number) => salidaCubica((t - cr.momento(n)) / 0.12) : undefined;
    semillas(c, N, angulo, VISTA, {escala});

    // ── Las espirales: 34 rosas y 55 azules, una por fusa; vuelven "solas" con el ángulo de oro ──
    if (t < l.nadie) {
      const rosas = Math.floor((t - esp.rosa) / esp.fusa) + 1;
      const azules = Math.floor((t - esp.azul) / esp.fusa) + 1;
      if (rosas > 0) familia(c.solido.a, 34, rosas, angulo, VISTA, DESDE_ESPIRAL, 5);
      if (azules > 0) familia(c.solido.b, 55, azules, angulo, VISTA, DESDE_ESPIRAL + 50, 5);
      lecturas('espirales rosas', String(Math.max(0, Math.min(34, rosas))), 'azules', String(Math.max(0, Math.min(55, azules))));
      mira(c.solido.k, VISTA.cx, VISTA.cy, 70, fase(t, l.quien, l.quien + 0.4), t * 0.8);
      // "Dos números de Fibonacci, seguiditos": la sucesión entra número a número
      const desde = l.fibonacci;
      hud.push(() => {
        const numeros = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
        const tam = 40;
        c.solido.k.font = fuente(MONO, tam, 700);
        const textos = numeros.map(String);
        const anchos = textos.map((s) => c.solido.k.measureText(s + '  ').width);
        let x = 505 - anchos.reduce((a, b) => a + b, 0) / 2;
        textos.forEach((s, i) => {
          if (t >= desde + i * (pulso.negra / 4)) {
            const ctx = numeros[i] === 34 ? c.solido.a : numeros[i] === 55 ? c.solido.b : c.solido.k;
            ctx.font = fuente(MONO, tam, 700);
            ctx.fillStyle = cobertura(1);
            ctx.fillText(s, x, 1300);
          }
          x += anchos[i];
        });
      });
      return;
    }

    if (t >= esp.otraVez) {
      const k = Math.floor((t - esp.otraVez) / (esp.fusa / 2)) + 1;
      familia(c.solido.a, 34, k, angulo, VISTA, DESDE_ESPIRAL, 5);
      familia(c.solido.b, 55, Math.floor(k * 1.6), angulo, VISTA, DESDE_ESPIRAL + 50, 5);
    }

    // ── Crecimiento de cerca: el giro entre la semilla nueva y la anterior ──
    if (t >= cr.inicio && t < l.regla + 0.6 && N >= 2) {
      const n = Math.floor(N);
      const [ax, ay] = posicion(n - 1, angulo, VISTA);
      const [bx, by] = posicion(n, angulo, VISTA);
      const k = c.solido.k;
      k.strokeStyle = cobertura(1);
      k.lineWidth = 3 / toma.zoom;
      k.setLineDash([8 / toma.zoom, 8 / toma.zoom]);
      k.beginPath();
      k.moveTo(ax, ay);
      k.lineTo(VISTA.cx, VISTA.cy);
      k.lineTo(bx, by);
      k.stroke();
      k.setLineDash([]);
      const a0 = Math.atan2(ay - VISTA.cy, ax - VISTA.cx);
      k.beginPath();
      k.arc(VISTA.cx, VISTA.cy, 22, a0, a0 + angulo * RAD);
      k.stroke();
      for (const [ctx, [x, y]] of [[c.solido.b, [ax, ay]], [c.solido.a, [bx, by]]] as const) {
        ctx.fillStyle = cobertura(1);
        ctx.beginPath();
        ctx.arc(x, y, 0.42 * VISTA.c * 0.85, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ── Lecturas ──
    // El valor no se dice hasta que la voz prueba 135°: antes, el 137,5 adelantaría la revelación
    const giro = t < l.ciento35 - 0.3 ? 'siempre igual' : grados(angulo);
    lecturas('semillas', String(Math.floor(N)), 'giro', giro);
  }

  return null;
};

export default Sketch;
