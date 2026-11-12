// nº06 · ¿Llega al otro lado? El bosque que arde o no (percolación).
//
// Escenas y momentos en linea.ts (compartido con sonido.ts). Tintas: árboles en azul (pinos de dos
// tonos), fuego en rosa (llamas grandes con una franja de calor a medio tono delante), troncos
// quemados en negro. Centrado en x = 540 y a pantalla casi completa (sin recuadro de visor).
//
// Para que llame la atención (pedido del usuario, 2026-11-11):
//   · gancho: en la portada el fuego ya sube a toda velocidad;
//   · meta punteada arriba y un medidor de altura al costado: se ve si "llega";
//   · un deslizador grande con la densidad (el dato clave), que se mueve entre escenas y al final
//     ("¿cuántos plantarías?") se mueve solo con el bosque;
//   · en la gráfica, bosques miniatura que arden en 57 % y en 61 %.
import React, {useMemo} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {
  cobertura,
  conCamara,
  fuente,
  hash01,
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
} from '@canal';
import {DURACION_PORTADA} from '@canal/diseno';
import {
  ANCHO,
  ARDOR_MINIS,
  bosqueDe,
  cortes,
  curvas,
  densidadFinal,
  enPortadaEn,
  fase,
  gemelos,
  linea,
  minis,
  pasoEn,
  pasoGemelos,
  pasoPortada,
  type Bosque,
  type Linea,
} from './linea';

// ── Geometría ─────────────────────────────────────────────────────────────────────────────────

type Vista = {x0: number; y0: number; cel: number};
/**
 * El bosque, centrado (x = 540): 56×72 casillas de 15 px (840×1080), de y = 300 a 1380, sobre los
 * subtítulos. Arriba queda la franja del deslizador; a la izquierda, el medidor de altura.
 */
const VISTA: Vista = {x0: 540 - (ANCHO * 15) / 2, y0: 300, cel: 15};
/** Portada y final: más pequeño y más arriba, por encima del título. */
const VISTA_PORTADA: Vista = {x0: 540 - (ANCHO * 10) / 2, y0: 200, cel: 10};

/** Llamas que siguen ardiendo (pasos) detrás del frente. */
const ARDE = 4;

/**
 * Un bosque en el paso `paso` del fuego. Detrás de cada llama, una franja de calor rosa a 1/3 de
 * trama (sin degradados); pinos azules de dos tonos; llamas rosas grandes que parpadean; troncos
 * quemados en negro.
 */
function bosque(c: Capas, b: Bosque, paso: number, v: Vista, frame: number) {
  const {cel} = v;
  const pinos: [number, number][] = [];
  const llamas: [number, number, number][] = [];
  const troncos: [number, number][] = [];
  for (let i = 0; i < b.arbol.length; i++) {
    if (!b.arbol[i]) continue;
    const x = v.x0 + (i % b.ancho) * cel + cel / 2;
    const y = v.y0 + Math.floor(i / b.ancho) * cel + cel / 2;
    const p = b.pasos[i];
    if (p >= 0 && p <= paso && p > paso - ARDE) llamas.push([x, y, 0.8 + 0.45 * hash01(i, frame, 3)]);
    else if (p >= 0 && p <= paso) troncos.push([x, y]);
    else pinos.push([x, y]);
  }
  // Calor: medio tono rosa alrededor de cada llama
  c.a.fillStyle = cobertura(0.34);
  c.a.beginPath();
  for (const [x, y] of llamas) {
    c.a.moveTo(x + cel * 1.25, y);
    c.a.arc(x, y, cel * 1.25, 0, Math.PI * 2);
  }
  c.a.fill();
  // Pinos: triángulo a 2/3 y su mitad izquierda llena
  const w = cel * 0.42;
  const h = cel * 0.5;
  for (const [cob, mitad] of [[0.67, false], [1, true]] as const) {
    c.b.fillStyle = cobertura(cob);
    c.b.beginPath();
    for (const [x, y] of pinos) {
      c.b.moveTo(x, y - h);
      c.b.lineTo(mitad ? x : x + w, y + h * 0.8);
      c.b.lineTo(x - w, y + h * 0.8);
      c.b.closePath();
    }
    c.b.fill();
  }
  // Troncos quemados: un palo negro
  c.k.fillStyle = cobertura(0.85);
  c.k.beginPath();
  for (const [x, y] of troncos) c.k.rect(x - cel * 0.09, y - cel * 0.3, cel * 0.18, cel * 0.6);
  c.k.fill();
  // Llamas: gota hacia arriba, grande, que parpadea
  const a = c.solido.a;
  a.fillStyle = cobertura(1);
  a.beginPath();
  for (const [x, y, s] of llamas) {
    const r = cel * 0.46 * s;
    a.moveTo(x, y - r * 2.2);
    a.quadraticCurveTo(x + r * 1.35, y - r * 0.2, x, y + r);
    a.quadraticCurveTo(x - r * 1.35, y - r * 0.2, x, y - r * 2.2);
  }
  a.fill();
}

/** Fila más alta que alcanzó el fuego (0 = arriba del todo), o el alto si aún no hay fuego. */
function altura(b: Bosque, paso: number): number {
  for (let i = 0; i < b.pasos.length; i++) if (b.pasos[i] >= 0 && b.pasos[i] <= paso) return Math.floor(i / b.ancho);
  return b.alto;
}

/** La meta punteada arriba y el medidor de altura a la izquierda (en el mundo, se mueven con la cámara). */
function metaYMedidor(c: Capas, b: Bosque, paso: number, v: Vista) {
  const ancho = b.ancho * v.cel;
  const alto = b.alto * v.cel;
  const a = c.solido.a;
  a.strokeStyle = a.fillStyle = cobertura(1);
  a.lineWidth = 5;
  a.setLineDash([16, 12]);
  a.beginPath();
  a.moveTo(v.x0, v.y0 - 8);
  a.lineTo(v.x0 + ancho, v.y0 - 8);
  a.stroke();
  a.setLineDash([]);
  // Medidor: la altura máxima que alcanzó el fuego
  const x = v.x0 - 34;
  const fila = altura(b, paso);
  const llena = ((b.alto - fila) / b.alto) * alto;
  c.solido.k.strokeStyle = cobertura(1);
  c.solido.k.lineWidth = 3;
  c.solido.k.strokeRect(x, v.y0, 18, alto);
  if (llena > 0) a.fillRect(x + 4, v.y0 + alto - llena, 10, llena);
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

/** Bosque miniatura (1 px por casilla): árboles azules, fuego rosa, lo quemado queda en papel. */
function mini(c: Capas, b: Bosque, paso: number, x0: number, y0: number, escala: number) {
  c.solido.b.fillStyle = c.solido.a.fillStyle = cobertura(1);
  c.solido.b.beginPath();
  c.solido.a.beginPath();
  for (let i = 0; i < b.arbol.length; i++) {
    if (!b.arbol[i]) continue;
    const p = b.pasos[i];
    if (p >= 0 && p <= paso - ARDE) continue;
    const ctx = p >= 0 && p <= paso ? c.solido.a : c.solido.b;
    ctx.rect(x0 + (i % b.ancho) * escala, y0 + Math.floor(i / b.ancho) * escala, escala, escala);
  }
  c.solido.b.fill();
  c.solido.a.fill();
}

// ── Deslizador de densidad ────────────────────────────────────────────────────────────────────

/** Densidad que muestra el deslizador en `t` (se desliza de una escena a la siguiente). */
function densidadEn(t: number, l: Linea): number {
  const marcas: [number, number][] = [
    [0, 0.55],
    [l.con65, 0.65],
    [l.medio, 0.6],
    [l.c57, 0.57],
    [l.c61, 0.61],
    [l.c59, 0.59],
  ];
  let v = marcas[0][1];
  for (let i = 1; i < marcas.length; i++) {
    const [desde, valor] = marcas[i];
    if (t >= desde) v += (valor - v) * salidaCubica(fase(t, desde, desde + 0.6));
  }
  return v;
}

/**
 * El deslizador: una barra de 50 % a 70 % con su tirador y el número grande a la derecha (a la
 * izquierda chocaba con la numeración «nº 06»), en una tira de papel.
 */
function deslizador(c: Capas, p: number, y: number) {
  recortarPapel(c, (ctx) => {
    ctx.beginPath();
    ctx.rect(70, y, 940, 88);
  });
  const k = c.solido.k;
  k.fillStyle = cobertura(1);
  k.font = fuente(TITULAR, 62);
  k.textBaseline = 'alphabetic';
  k.textAlign = 'right';
  k.fillText(`${Math.round(p * 100)} %`, 995, y + 70);
  k.textAlign = 'left';
  const x0 = 250;
  const x1 = 740;
  const xp = x0 + ((p - 0.5) / 0.2) * (x1 - x0);
  const yb = y + 38;
  k.lineWidth = 4;
  k.strokeStyle = cobertura(1);
  k.beginPath();
  k.moveTo(x0, yb);
  k.lineTo(x1, yb);
  k.stroke();
  k.font = fuente(MONO, 20, 700);
  k.textAlign = 'center';
  for (const m of [0.5, 0.55, 0.6, 0.65, 0.7]) {
    const x = x0 + ((m - 0.5) / 0.2) * (x1 - x0);
    k.fillRect(x - 1.5, yb - 8, 3, 16);
    k.fillText(`${Math.round(m * 100)}`, x, y + 80);
  }
  k.textAlign = 'left';
  const a = c.solido.a;
  a.fillStyle = cobertura(1);
  a.fillRect(x0, yb - 5, xp - x0, 10);
  a.beginPath();
  a.arc(xp, yb, 17, 0, Math.PI * 2);
  a.fill();
  k.lineWidth = 3;
  k.beginPath();
  k.arc(xp, yb, 17, 0, Math.PI * 2);
  k.stroke();
  k.font = fuente(MONO, 18, 400);
  k.fillText('árboles de cada cien', 250, y + 20);
}

// ── Cámara ────────────────────────────────────────────────────────────────────────────────────

function planosDe(l: Linea): Plano[] {
  const neutra = {zoom: 1};
  return [
    {desde: DURACION_PORTADA, toma: neutra, deriva: 0.04},
    {desde: l.incendio, toma: {zoom: 1.12, px: 540, py: 1300}, entrada: 'suave', viaje: 0.9, deriva: 0.05},
    // De cerca: el fuego salta de vecino en vecino (la fila de abajo, a media pantalla)
    {desde: l.vecino, toma: {zoom: 3, px: 540, py: 1300, dy: -350}, entrada: 'suave', viaje: 0.8, deriva: 0.06},
    {desde: l.con55, toma: neutra, entrada: 'suave', viaje: 1.4, deriva: 0.04},
    {desde: l.con65, toma: neutra, deriva: 0.06},
    {desde: l.medio, toma: neutra, deriva: 0.04},
    {desde: l.justo, toma: neutra, deriva: 0.05},
    {desde: l.enPie - 0.6, toma: {zoom: 1.15, px: 540, py: 840}, entrada: 'suave', viaje: 0.8, deriva: 0.04},
    {desde: l.fisicos, toma: neutra, deriva: 0.05},
    {desde: l.entonces, toma: neutra, deriva: 0},
  ];
}

// ── Gráfica ───────────────────────────────────────────────────────────────────────────────────

const G = {x0: 170, x1: 940, y0: 1320, y1: 820};
const gx = (p: number) => G.x0 + ((p - 0.5) / 0.2) * (G.x1 - G.x0);
const gy = (q: number) => G.y0 + q * (G.y1 - G.y0);
/** Filas de bosques miniatura sobre la gráfica (6 por fila, 100×100 a 1 px). */
const MINIS = {x0: 215, paso: 118, y57: 500, y61: 640, escala: 1};

// ── Componente ────────────────────────────────────────────────────────────────────────────────

const Sketch: React.FC<PropsSketch> = ({tiempos, config}) => {
  const f = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const t = f / fps;
  const l = linea(tiempos, (durationInFrames - 1) / fps);
  const pulso = pulsoDe(config);
  const gem = useMemo(() => gemelos(), []);
  const mb = useMemo(() => minis(), []);
  const listaCortes = cortes(l);

  useDibujo(ORDEN.sketch, (c) => {
    const hud: (() => void)[] = [];
    if (enPortadaEn(t, l)) escenaPortada(c);
    else conCamara(c, tomaEn(t, planosDe(l)), () => escena(c, hud));
    hud.forEach((h) => h());
    sacudirRegistro(c, t, listaCortes, 8, 0.1);
  });

  /** Portada: el fuego ya sube (gancho). Final: el deslizador se mueve solo y el bosque cambia con él. */
  function escenaPortada(c: Capas) {
    if (t < DURACION_PORTADA) {
      bosque(c, bosqueDe('59'), Math.floor(pasoPortada(t)), VISTA_PORTADA, f);
      return;
    }
    const p = densidadFinal(t, l);
    bosque(c, bosqueDe('59', p), -1, VISTA_PORTADA, f);
    if (t < l.fin - 0.4) deslizador(c, p, 980);
  }

  function escena(c: Capas, hud: (() => void)[]) {
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
        k.font = fuente(TITULAR, 56);
        k.textAlign = 'center';
        k.fillText(nombre, x0 + 235, y0 - 30);
        if (paso >= b.total && paso >= 0) {
          const ctx = b.cruza ? c.solido.a : c.solido.k;
          ctx.fillStyle = cobertura(1);
          ctx.font = fuente(MONO, 40, 700);
          ctx.textAlign = 'center';
          ctx.fillText(b.cruza ? 'cruza' : 'se apaga', x0 + 235, y0 + 535);
          ctx.textAlign = 'left';
        }
        k.textAlign = 'left';
      });
      hud.push(() => rotulo(c, 'esquema · el mismo bosque, 100×100', 90, 430, fase(t, l.fisicos, l.fisicos + 0.4), {tam: 28, tinta: 'b'}));
      return;
    }

    // ── Gráfica: probabilidad de cruzar (medida en verificar.py) + bosques miniatura ──
    if (t >= l.medio && t < l.justo) {
      grafica(c);
      // Seis bosques de 100×100 arden en 57 % y los mismos con 61 %: de ahí sale cada punto
      for (const [lista, y, momento, nombre] of [[mb.b57, MINIS.y57, l.c57, '57 %'], [mb.b61, MINIS.y61, l.c61, '61 %']] as const) {
        // (la cuenta "n de 6 cruzan" va bajo el porcentaje, a la izquierda)
        if (t < momento) continue;
        const avance = fase(t, momento, momento + ARDOR_MINIS);
        lista.forEach((b, k) => {
          const x = MINIS.x0 + k * MINIS.paso;
          mini(c, b, Math.floor(b.total * avance), x, y, MINIS.escala);
          if (avance >= 1 && b.cruza) marcoEsquinas(c.solido.a, {x: x - 6, y: y - 6, w: 112, h: 112}, fase(t, momento + ARDOR_MINIS, momento + ARDOR_MINIS + 0.35), {grosor: 4, largo: 18, desde: 30});
        });
        const k = c.solido.k;
        k.fillStyle = cobertura(1);
        k.font = fuente(MONO, 28, 700);
        k.fillText(nombre, 90, y + 60);
        if (avance >= 1) {
          const cruzan = lista.filter((b) => b.cruza).length;
          k.font = fuente(MONO, 22, 700);
          k.fillText(`${cruzan} de 6`, 90, y + 92);
        }
      }
      hud.push(() => {
        rotulo(c, 'medido · ¿cuántas veces cruza el fuego?', 90, 400, fase(t, l.medio, l.medio + 0.4), {tam: 28, tinta: 'b'});
        deslizador(c, densidadEn(t, l), 205);
      });
      return;
    }

    // ── Los tres bosques ──
    const nombre = t < l.con65 ? '55' : t < l.medio ? '65' : '59';
    const b = bosqueDe(nombre);
    const paso = Math.floor(pasoEn(t, l, pulso, nombre));
    bosque(c, b, paso, VISTA, f);
    metaYMedidor(c, b, paso, VISTA);
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
    const enPie = nombre === '59' && t >= l.enPie - 0.6;
    hud.push(() => {
      deslizador(c, densidadEn(t, l), 205);
      if (enPie) {
        const total = b.arbol.reduce((s, v) => s + v, 0);
        let q = 0;
        for (let i = 0; i < b.pasos.length; i++) if (b.pasos[i] >= 0 && b.pasos[i] <= paso) q++;
        rotulo(c, `en pie: ${Math.round(((total - q) / total) * 100)} % del bosque`, 560, 360, fase(t, l.enPie - 0.6, l.enPie - 0.2), {tam: 30, tinta: 'b', desde: 'derecha'});
      }
    });
  }

  function grafica(c: Capas) {
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
    // Curvas: la del bosque del video (azul) y la del grande (rosa), que se dibujan de izquierda a derecha
    const trazo = (ctx: CanvasRenderingContext2D, datos: number[], desde: number, grosor: number) => {
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
    trazo(c.solido.b, curvas.video, l.medio, 4);
    trazo(c.solido.a, curvas.grande, l.grande, 6);
    for (const [ctx, texto, y, desde] of [[c.solido.b, 'el bosque del video', G.y0 - 110, l.medio], [c.solido.a, 'un bosque grande (200×200)', G.y0 - 60, l.grande]] as const) {
      if (t < desde) continue;
      ctx.fillStyle = cobertura(1);
      ctx.font = fuente(MONO, 26, 700);
      ctx.textAlign = 'right';
      ctx.fillText(texto, G.x1, y);
      ctx.textAlign = 'left';
    }
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
  }

  return null;
};

export default Sketch;
