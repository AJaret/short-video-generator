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
  recortarPapel,
  trazarCirculoIrregular,
  hash01,
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
/** Portada y final: más pequeño y más arriba, por encima del título (con los pétalos, cabe). */
const VISTA_PORTADA: Vista = {cx: 505, cy: 620, c: 13};

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

/**
 * El girasol "impreso" (el usuario lo veía plano, 2026-11-10): cada semilla es una gota orientada
 * hacia el centro, con cuerpo a 2/3 de trama, sombra abajo a la derecha a tinta llena, un brillo de
 * papel arriba a la izquierda y un contorno de papel que la separa del disco. Más pequeñas en el
 * centro y grandes afuera, como en un girasol de verdad. Debajo, el disco a 1/3 de trama, y alrededor
 * una corona de 34 pétalos rosas en dos capas (1/3 detrás, 2/3 delante) que se mecen un poco.
 * Nada de degradados: los tonos son los niveles de la trama.
 */
function girasol(
  c: Capas,
  N: number,
  angulo: number,
  v: Vista,
  t: number,
  op: {escala?: (n: number) => number; barrido?: number | null; petalos?: (i: number) => number; fondo?: boolean; vaiven?: number} = {},
) {
  const R = v.c * Math.sqrt(Math.max(1, N));
  const vaiven = op.vaiven ?? 1;
  // Pétalos: dos coronas de 34 (un número de Fibonacci), la de atrás girada media posición
  if (op.petalos) {
    for (const [capa, cob, desfase, largo] of [[0, 0.34, 0.5, 1.5], [1, 0.67, 0, 1.38]] as const) {
      const ctx = c.a;
      ctx.fillStyle = cobertura(cob);
      ctx.beginPath();
      for (let i = 0; i < 34; i++) {
        const e = op.petalos(i);
        if (e <= 0.02) continue;
        const a = ((i + desfase) / 34) * Math.PI * 2 + Math.sin(t * 1.3 + i * 0.7 + capa) * 0.025 * vaiven;
        const r0 = v.c * 20 * 0.9;
        const r1 = r0 + v.c * 20 * (largo - 0.9 + 0.1 * hash01(i, capa, 5)) * e;
        const w = v.c * 20 * 0.12 * (0.6 + 0.4 * e);
        const ux = Math.cos(a);
        const uy = Math.sin(a);
        const m = (r0 + r1) / 2;
        ctx.moveTo(v.cx + ux * r0 - uy * w * 0.4, v.cy + uy * r0 + ux * w * 0.4);
        ctx.quadraticCurveTo(v.cx + ux * m - uy * w * 1.6, v.cy + uy * m + ux * w * 1.6, v.cx + ux * r1, v.cy + uy * r1);
        ctx.quadraticCurveTo(v.cx + ux * m + uy * w * 1.6, v.cy + uy * m - ux * w * 1.6, v.cx + ux * r0 + uy * w * 0.4, v.cy + uy * r0 - ux * w * 0.4);
        ctx.closePath();
      }
      ctx.fill();
    }
  }
  // Disco de fondo a 1/3 (crece con las semillas)
  if (op.fondo) {
    c.k.fillStyle = cobertura(0.34);
    trazarCirculoIrregular(c.k, v.cx, v.cy, R + v.c * 0.9, 5);
    c.k.fill();
  }
  // Semillas
  type S = {x: number; y: number; a: number; s: number; rosa: boolean};
  const lista: S[] = [];
  for (let n = 1; n <= Math.ceil(N); n++) {
    const e = op.escala ? op.escala(n) : 1;
    if (e <= 0.02) continue;
    const [x, y] = posicion(n, angulo, v);
    const a = Math.atan2(y - v.cy, x - v.cx);
    let rosa = false;
    if (op.barrido !== undefined && op.barrido !== null) {
      const d = (((a - op.barrido) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      rosa = d > 2 * Math.PI - 0.7;
    }
    lista.push({x, y, a, s: 0.42 * v.c * (0.6 + 0.55 * Math.sqrt(n / SEMILLAS)) * e, rosa});
  }
  const elipse = (ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, a: number) => {
    ctx.moveTo(x + rx * Math.cos(a), y + rx * Math.sin(a));
    ctx.ellipse(x, y, rx, ry, a, 0, Math.PI * 2);
  };
  // Contorno de papel (separa cada semilla del disco y de los pétalos)
  recortarPapel(c, (ctx) => {
    ctx.beginPath();
    for (const q of lista) elipse(ctx, q.x, q.y, q.s * 1.15 + 2.5, q.s * 0.85 + 2.5, q.a);
  });
  for (const rosa of [false, true]) {
    const ctx = rosa ? c.a : c.k;
    // Cuerpo a 2/3
    ctx.fillStyle = cobertura(0.67);
    ctx.beginPath();
    for (const q of lista) if (q.rosa === rosa) elipse(ctx, q.x, q.y, q.s * 1.15, q.s * 0.85, q.a);
    ctx.fill();
    // Sombra (abajo a la derecha), a tinta llena
    ctx.fillStyle = cobertura(1);
    ctx.beginPath();
    for (const q of lista) if (q.rosa === rosa) elipse(ctx, q.x + q.s * 0.28, q.y + q.s * 0.3, q.s * 0.66, q.s * 0.48, q.a);
    ctx.fill();
  }
  // Brillo de papel (arriba a la izquierda), solo si la semilla es grande para notarse
  recortarPapel(c, (ctx) => {
    ctx.beginPath();
    for (const q of lista) {
      if (q.s < 4.5) continue;
      ctx.moveTo(q.x - q.s * 0.36 + q.s * 0.22, q.y - q.s * 0.38);
      ctx.arc(q.x - q.s * 0.36, q.y - q.s * 0.38, q.s * 0.22, 0, Math.PI * 2);
    }
  });
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
    // El vaivén de los pétalos empieza y termina en cero: el primer y el último fotograma son iguales
    const vaiven = Math.min(1, t / 0.6, Math.max(0, l.fin - t) / 0.6);
    girasol(c, SEMILLAS, anguloEn(0, l), VISTA_PORTADA, t, {barrido, petalos: () => 1, fondo: true, vaiven});
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
    // Pétalos: con el girasol entero (se recogen en "nadie" y vuelven, uno por fusa, cuando las
    // espirales "aparecen solas"); en el crecimiento y en la prueba de ángulos no hay (es el modelo)
    const petalos =
      t < l.nadie
        ? () => 1 - salidaCubica(fase(t, l.nadie, l.nadie + 0.45))
        : t >= esp.otraVez
          ? (i: number) => salidaCubica(fase(t, esp.otraVez + i * esp.fusa * 0.5, esp.otraVez + i * esp.fusa * 0.5 + 0.4))
          : undefined;
    // Disco de fondo: con el girasol entero y mientras crece (en la prueba de ángulos, los huecos son papel)
    const fondo = t < l.nadie + 0.45 || (t >= cr.inicio && t < l.redondo) || t >= esp.otraVez;
    girasol(c, N, angulo, VISTA, t, {escala, petalos, fondo});

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
        const total = anchos.reduce((a, b) => a + b, 0);
        let x = 505 - total / 2;
        // Tira de papel detrás (sobre los pétalos rosas, el 34 rosa no se leía); crece con la fila
        const visibles = numeros.filter((_, i) => t >= desde + i * (pulso.negra / 4)).length;
        const largo = anchos.slice(0, visibles).reduce((a, b) => a + b, 0);
        if (visibles > 0) {
          recortarPapel(c, (ctx) => {
            ctx.beginPath();
            ctx.rect(x - 22, 1300 - tam - 8, largo + 24, tam + 30);
          });
        }
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
