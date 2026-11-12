// nº06 · ¿Llega al otro lado? El bosque que arde o no (percolación).
//
// Escenas y momentos en linea.ts (compartido con sonido.ts). Tintas: árboles en azul (pinos de dos
// tonos), fuego en rosa (llamas que parpadean), ceniza en negro a 1/3. Con cámara (planos con la voz,
// sin zoom con rebote) y recortado al visor.
import React, {useMemo} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {
  cobertura,
  conCamara,
  fuente,
  hash01,
  lectura,
  mira,
  MONO,
  ORDEN,
  pulsoDe,
  recortarPapel,
  rotulo,
  sacudirRegistro,
  salidaCubica,
  tomaEn,
  useDibujo,
  type Capas,
  type Plano,
  type PropsSketch,
} from '@canal';
import {DURACION_PORTADA} from '@canal/diseno';
import {
  ALTO,
  ANCHO,
  bosqueDe,
  cortes,
  curvas,
  densidadFinal,
  enPortadaEn,
  fase,
  gemelos,
  linea,
  pasoEn,
  pasoGemelos,
  type Bosque,
  type Linea,
} from './linea';

// ── Geometría ─────────────────────────────────────────────────────────────────────────────────

type Vista = {x0: number; y0: number; cel: number};
/**
 * Sin recuadro de visor (el usuario, 2026-11-11): el bosque centrado en la pantalla (x = 540) y lo más
 * grande que cabe sobre los subtítulos: 56×72 casillas de 16 px (896×1152). La esquina de abajo a la
 * derecha roza la columna de botones de la app, pero ahí solo hay árboles, nada que leer.
 */
const VISTA: Vista = {x0: 540 - (ANCHO * 16) / 2, y0: 230, cel: 16};
/** Portada y final: más pequeño y más arriba, por encima del título. */
const VISTA_PORTADA: Vista = {x0: 540 - (ANCHO * 10) / 2, y0: 200, cel: 10};

/** Llamas que siguen ardiendo (pasos) detrás del frente. */
const ARDE = 4;

/**
 * Dibuja un bosque en el paso `paso` del fuego: pinos azules de dos tonos (cuerpo a 2/3 y su mitad
 * izquierda a tinta llena), llamas rosas que parpadean (gota hacia arriba) y ceniza negra a 1/3.
 */
function bosque(c: Capas, b: Bosque, paso: number, v: Vista, frame: number, op: {chispas?: boolean} = {}) {
  const {cel} = v;
  const pinos: [number, number][] = [];
  const llamas: [number, number, number][] = [];
  const ceniza: [number, number][] = [];
  for (let i = 0; i < b.arbol.length; i++) {
    if (!b.arbol[i]) continue;
    const x = v.x0 + (i % b.ancho) * cel + cel / 2;
    const y = v.y0 + Math.floor(i / b.ancho) * cel + cel / 2;
    const p = b.pasos[i];
    const chispa = op.chispas && Math.floor(i / b.ancho) === b.alto - 1 && hash01(i, Math.floor(frame / 3)) < 0.35;
    if (chispa || (p >= 0 && p <= paso && p > paso - ARDE)) llamas.push([x, y, 0.8 + 0.4 * hash01(i, frame, 3)]);
    else if (p >= 0 && p <= paso) ceniza.push([x, y]);
    else pinos.push([x, y]);
  }
  // Pinos: triángulo a 2/3 y su mitad izquierda llena (el volumen, sin degradados)
  const w = cel * 0.42;
  const h = cel * 0.5;
  c.b.fillStyle = cobertura(0.67);
  c.b.beginPath();
  for (const [x, y] of pinos) {
    c.b.moveTo(x, y - h);
    c.b.lineTo(x + w, y + h * 0.8);
    c.b.lineTo(x - w, y + h * 0.8);
    c.b.closePath();
  }
  c.b.fill();
  c.b.fillStyle = cobertura(1);
  c.b.beginPath();
  for (const [x, y] of pinos) {
    c.b.moveTo(x, y - h);
    c.b.lineTo(x, y + h * 0.8);
    c.b.lineTo(x - w, y + h * 0.8);
    c.b.closePath();
  }
  c.b.fill();
  // Ceniza
  c.k.fillStyle = cobertura(0.4);
  c.k.beginPath();
  for (const [x, y] of ceniza) {
    c.k.moveTo(x + cel * 0.22, y);
    c.k.arc(x, y, cel * 0.22, 0, Math.PI * 2);
  }
  c.k.fill();
  // Llamas: gota hacia arriba, tamaño que parpadea
  const a = c.solido.a;
  a.fillStyle = cobertura(1);
  a.beginPath();
  for (const [x, y, s] of llamas) {
    const r = cel * 0.34 * s;
    a.moveTo(x, y - r * 2.1);
    a.quadraticCurveTo(x + r * 1.3, y - r * 0.2, x, y + r);
    a.quadraticCurveTo(x - r * 1.3, y - r * 0.2, x, y - r * 2.1);
  }
  a.fill();
}

/** Camino estrecho por el que cruzó el fuego: de una casilla de arriba bajando por pasos decrecientes. */
function camino(b: Bosque): number[] {
  let mejor = -1;
  for (let x = 0; x < b.ancho; x++) if (b.pasos[x] >= 0 && (mejor < 0 || b.pasos[x] < b.pasos[mejor])) mejor = x;
  if (mejor < 0) return [];
  const ruta = [mejor];
  let i = mejor;
  while (b.pasos[i] > 0) {
    const y = Math.floor(i / b.ancho);
    const x = i % b.ancho;
    const sig = [[1, 0], [0, -1], [0, 1], [-1, 0]]
      .map(([dy, dx]) => [y + dy, x + dx])
      .filter(([ny, nx]) => ny >= 0 && ny < b.alto && nx >= 0 && nx < b.ancho)
      .map(([ny, nx]) => ny * b.ancho + nx)
      .find((j) => b.pasos[j] === b.pasos[i] - 1);
    if (sig === undefined) break;
    ruta.push(sig);
    i = sig;
  }
  return ruta;
}

// ── Cámara ────────────────────────────────────────────────────────────────────────────────────

function planosDe(l: Linea): Plano[] {
  const neutra = {zoom: 1};
  return [
    {desde: DURACION_PORTADA, toma: neutra, deriva: 0.04},
    {desde: l.incendio, toma: {zoom: 1.15, px: 540, py: 1300}, entrada: 'suave', viaje: 0.9, deriva: 0.05},
    // De cerca: el fuego salta de vecino en vecino (la fila de abajo, a media pantalla)
    {desde: l.vecino, toma: {zoom: 3, px: 540, py: 1300, dy: -350}, entrada: 'suave', viaje: 0.8, deriva: 0.06},
    {desde: l.con55, toma: neutra, entrada: 'suave', viaje: 1.4, deriva: 0.05},
    {desde: l.con65, toma: neutra, deriva: 0.08},
    {desde: l.medio, toma: neutra, deriva: 0.05},
    {desde: l.justo, toma: neutra, deriva: 0.06},
    {desde: l.enPie - 0.6, toma: {zoom: 1.2, px: 540, py: 800}, entrada: 'suave', viaje: 0.8, deriva: 0.04},
    {desde: l.fisicos, toma: neutra, deriva: 0.05},
    {desde: l.entonces, toma: neutra, deriva: 0},
  ];
}

// ── Gráfica ───────────────────────────────────────────────────────────────────────────────────

const G = {x0: 170, x1: 940, y0: 1300, y1: 620};
const gx = (p: number) => G.x0 + ((p - 0.5) / 0.2) * (G.x1 - G.x0);
const gy = (q: number) => G.y0 + q * (G.y1 - G.y0);

// ── Componente ────────────────────────────────────────────────────────────────────────────────

const Sketch: React.FC<PropsSketch> = ({tiempos, config}) => {
  const f = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const t = f / fps;
  const l = linea(tiempos, (durationInFrames - 1) / fps);
  const pulso = pulsoDe(config);
  const gem = useMemo(() => gemelos(), []);
  const listaCortes = cortes(l);

  useDibujo(ORDEN.sketch, (c) => {
    const hud: (() => void)[] = [];
    const enPortada = enPortadaEn(t, l);
    if (enPortada) escenaPortada(c);
    // Sin recorte ni marco: la animación usa toda la pantalla
    else conCamara(c, tomaEn(t, planosDe(l)), () => escena(c, hud));
    hud.forEach((h) => h());
    sacudirRegistro(c, t, listaCortes, 8, 0.1);
  });

  /** Portada y final: el bosque de 59 %. Chispas abajo en la portada; al final la densidad sube y baja. */
  function escenaPortada(c: Capas) {
    if (t < DURACION_PORTADA) {
      bosque(c, bosqueDe('59'), -1, VISTA_PORTADA, f, {chispas: t > 0.05});
      return;
    }
    const p = densidadFinal(t, l);
    bosque(c, bosqueDe('59', p), -1, VISTA_PORTADA, f);
    // "¿Cuántos árboles plantarías tú?": la densidad, grande, mientras cambia (se va antes del final)
    if (t < l.fin - 0.4) {
      const k = c.solido.k;
      k.fillStyle = cobertura(1);
      k.font = fuente(MONO, 54, 700);
      k.textAlign = 'center';
      k.fillText(`${Math.round(p * 100)} % árboles`, 540, 1030);
      k.textAlign = 'left';
    }
  }

  function escena(c: Capas, hud: (() => void)[]) {
    const lecturas = (e1: string, v1: string, e2: string, v2: string) =>
      hud.push(() => {
        // Sobre el bosque: cada lectura en su tira de papel
        recortarPapel(c, (ctx) => {
          ctx.beginPath();
          ctx.rect(96, 300, 250, 62);
          ctx.rect(734, 300, 250, 62);
        });
        lectura(c.solido.k, e1, v1, 112, 350, {tam: 30});
        lectura(c.solido.k, e2, v2, 968, 350, {tam: 30, alinear: 'right'});
      });
    const quemados = (b: Bosque, paso: number) => {
      let n = 0;
      for (let i = 0; i < b.pasos.length; i++) if (b.pasos[i] >= 0 && b.pasos[i] <= paso) n++;
      return n;
    };
    const arboles = (b: Bosque) => b.arbol.reduce((s, v) => s + v, 0);

    // ── 57 % y 61 %: el mismo bosque, cuatro árboles más de cada cien ──
    if (t >= l.fisicos) {
      const paso = pasoGemelos(t, l, gem.b61.total);
      const cel = 4.7;
      ([[gem.b57, 60, '57 %'], [gem.b61, 550, '61 %']] as const).forEach(([b, x0, nombre]) => {
        const y0 = 620;
        const capas = {pino: c.solido.b, llama: c.solido.a, ceniza: c.k};
        capas.pino.fillStyle = capas.llama.fillStyle = cobertura(1);
        capas.ceniza.fillStyle = cobertura(0.5);
        for (const ctx of [capas.pino, capas.llama, capas.ceniza]) ctx.beginPath();
        for (let i = 0; i < b.arbol.length; i++) {
          if (!b.arbol[i]) continue;
          const x = x0 + (i % b.ancho) * cel;
          const y = y0 + Math.floor(i / b.ancho) * cel;
          const p = b.pasos[i];
          const ctx = p >= 0 && p <= paso ? (p > paso - ARDE ? capas.llama : capas.ceniza) : capas.pino;
          ctx.rect(x, y, cel - 1, cel - 1);
        }
        for (const ctx of [capas.pino, capas.llama, capas.ceniza]) ctx.fill();
        const k = c.solido.k;
        k.fillStyle = cobertura(1);
        k.font = fuente(MONO, 44, 700);
        k.textAlign = 'center';
        k.fillText(nombre, x0 + 235, y0 - 30);
        if (paso >= b.total && paso >= 0) {
          const ctx = b.cruza ? c.solido.a : c.solido.k;
          ctx.fillStyle = cobertura(1);
          ctx.font = fuente(MONO, 36, 700);
          ctx.textAlign = 'center';
          ctx.fillText(b.cruza ? 'cruza' : 'se apaga', x0 + 235, y0 + 530);
          ctx.textAlign = 'left';
        }
        k.textAlign = 'left';
      });
      hud.push(() => rotulo(c, 'esquema · el mismo bosque, 100×100', 90, 430, fase(t, l.fisicos, l.fisicos + 0.4), {tam: 28, tinta: 'b'}));
      return;
    }

    // ── Gráfica: probabilidad de cruzar (medida en verificar.py) ──
    if (t >= l.medio && t < l.justo) {
      const k = c.solido.k;
      k.strokeStyle = k.fillStyle = cobertura(1);
      k.lineWidth = 3;
      k.beginPath();
      k.moveTo(G.x0, G.y1 - 20);
      k.lineTo(G.x0, G.y0);
      k.lineTo(G.x1 + 20, G.y0);
      k.stroke();
      k.font = fuente(MONO, 26, 700);
      k.textAlign = 'center';
      for (const p of [0.5, 0.55, 0.6, 0.65, 0.7]) {
        k.fillText(`${Math.round(p * 100)} %`, gx(p), G.y0 + 44);
        k.fillRect(gx(p) - 1.5, G.y0, 3, 12);
      }
      k.textAlign = 'right';
      for (const q of [0, 0.5, 1]) k.fillText(`${Math.round(q * 100)} %`, G.x0 - 14, gy(q) + 9);
      k.textAlign = 'left';
      k.font = fuente(MONO, 24, 400);
      k.fillText('árboles de cada cien', G.x1 - 290, G.y0 + 84);
      // Curvas: la del bosque del video (azul) y la del grande (rosa), que se dibujan de izquierda a derecha
      const linea2 = (ctx: CanvasRenderingContext2D, datos: number[], desde: number, grosor: number) => {
        const p = salidaCubica(fase(t, desde, desde + 1.4));
        if (p <= 0) return;
        const n = Math.max(2, Math.ceil(p * datos.length));
        ctx.strokeStyle = ctx.fillStyle = cobertura(1);
        ctx.lineWidth = grosor;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        datos.slice(0, n).forEach((q, i) => (i ? ctx.lineTo(gx(0.5 + i / 100), gy(q)) : ctx.moveTo(gx(0.5), gy(q))));
        ctx.stroke();
        ctx.beginPath();
        datos.slice(0, n).forEach((q, i) => {
          ctx.moveTo(gx(0.5 + i / 100) + grosor * 1.4, gy(q));
          ctx.arc(gx(0.5 + i / 100), gy(q), grosor * 1.4, 0, Math.PI * 2);
        });
        ctx.fill();
      };
      linea2(c.solido.b, curvas.video, l.medio, 4);
      linea2(c.solido.a, curvas.grande, l.grande, 6);
      // Leyenda
      for (const [ctx, texto, y, desde] of [[c.solido.b, 'el bosque del video', 660, l.medio], [c.solido.a, 'un bosque grande (200×200)', 710, l.grande]] as const) {
        if (t < desde) continue;
        ctx.fillStyle = cobertura(1);
        ctx.font = fuente(MONO, 26, 700);
        ctx.fillText(texto, G.x0 + 30, y);
      }
      // Marcas: 57 % → 1 %, 61 % → 96 % (bosque grande), y la línea del salto en 59 %
      for (const [p, momento, q] of [[0.57, l.c57, curvas.grande[7]], [0.61, l.c61, curvas.grande[11]]] as const) {
        const e = fase(t, momento, momento + 0.4);
        if (e <= 0) continue;
        mira(c.solido.a, gx(p), gy(q), 30, e, t);
        c.solido.a.font = fuente(MONO, 30, 700);
        c.solido.a.fillText(`${Math.round(q * 100)} %`, gx(p) + 30, gy(q) - 36);
      }
      if (t >= l.c59) {
        const a = c.solido.a;
        a.strokeStyle = cobertura(1);
        a.lineWidth = 6;
        a.setLineDash([14, 10]);
        a.beginPath();
        a.moveTo(gx(0.5927), G.y0);
        a.lineTo(gx(0.5927), G.y0 - (G.y0 - G.y1) * salidaCubica(fase(t, l.c59, l.c59 + 0.5)));
        a.stroke();
        a.setLineDash([]);
      }
      hud.push(() => rotulo(c, 'medido · ¿cuántas veces cruza el fuego?', 90, 430, fase(t, l.medio, l.medio + 0.4), {tam: 28, tinta: 'b'}));
      return;
    }

    // ── Los tres bosques ──
    const nombre = t < l.con65 ? '55' : t < l.medio ? '65' : '59';
    const b = bosqueDe(nombre);
    const paso = Math.floor(pasoEn(t, l, pulso, nombre));
    bosque(c, b, paso, VISTA, f);
    if (nombre === '55' && t >= l.noHay && t < l.con55) {
      // "Si no hay vecino, se apaga": una llama del frente sin vecinos libres
      const i = b.pasos.findIndex((p, j) => p === Math.max(0, paso - 1) && [[-1, 0], [0, -1], [0, 1]].every(([dy, dx]) => {
        const y = Math.floor(j / ANCHO) + dy;
        const x = (j % ANCHO) + dx;
        return y < 0 || x < 0 || x >= ANCHO || !b.arbol[y * ANCHO + x];
      }));
      if (i >= 0) mira(c.solido.k, VISTA.x0 + (i % ANCHO) * VISTA.cel + VISTA.cel / 2, VISTA.y0 + Math.floor(i / ANCHO) * VISTA.cel + VISTA.cel / 2, 18, fase(t, l.noHay, l.noHay + 0.4), t);
    }
    if (nombre === '59' && paso >= b.total) {
      // El camino estrecho por el que cruzó, en rosa
      const ruta = camino(b);
      const e = salidaCubica(fase(t, l.estrechito + 0.4, l.estrechito + 1.4));
      const a = c.solido.a;
      a.strokeStyle = cobertura(1);
      a.lineWidth = 7;
      a.lineJoin = 'round';
      a.beginPath();
      const hasta = Math.max(2, Math.ceil(ruta.length * e));
      ruta.slice(ruta.length - hasta).reverse().forEach((i, k) => {
        const x = VISTA.x0 + (i % ANCHO) * VISTA.cel + VISTA.cel / 2;
        const y = VISTA.y0 + Math.floor(i / ANCHO) * VISTA.cel + VISTA.cel / 2;
        if (k) a.lineTo(x, y);
        else a.moveTo(x, y);
      });
      a.stroke();
    }
    const total = arboles(b);
    const q = Math.max(0, quemados(b, paso));
    const enPie = nombre === '59' && t >= l.enPie - 0.6;
    lecturas('árboles', `${Math.round((total / (ANCHO * ALTO)) * 100)} %`, enPie ? 'en pie' : 'quemados', enPie ? `${Math.round(((total - q) / total) * 100)} %` : String(q));
  }

  return null;
};

export default Sketch;
