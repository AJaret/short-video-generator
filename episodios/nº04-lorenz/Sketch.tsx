// nº04 · ¿Cuándo se separan? Dos puntos que empiezan a 0,001 de distancia en el sistema de Lorenz.
//
// Trayectorias integradas con RK4 (h = 0,01) en verificar.py → trayectorias.json. Escenas (linea.ts):
// portada (la mariposa) · la línea que son dos · esquema (ampliación, campo de flechas, dos pasos) ·
// las curvas que se separan, se reacercan y cruzan · el atractor completo · "una vuelta más" (= portada).
// Tintas: rosa → tinta A · azul → tinta B (donde se solapan sale el morado del multiply) · flechas → negro.
import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {cobertura, MONO, fuente, ORDEN, pulsoDe, rotulo, salidaCubica, tiempoDeAncla, useDibujo, type PropsSketch} from '@canal';
import {DURACION_PORTADA} from '@canal/diseno';
import datos from './trayectorias.json';
import {fase, indiceEn, linea, type Linea} from './linea';

type P3 = number[];

function flecha(c: CanvasRenderingContext2D, x: number, y: number, dx: number, dy: number, grosor = 5) {
  const ang = Math.atan2(dy, dx);
  const l = Math.hypot(dx, dy);
  if (l < 1) return;
  c.save();
  c.translate(x, y);
  c.rotate(ang);
  c.lineWidth = grosor;
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(l, 0);
  c.stroke();
  c.beginPath();
  c.moveTo(l, 0);
  c.lineTo(l - 12, -7);
  c.lineTo(l - 12, 7);
  c.closePath();
  c.fill();
  c.restore();
}

// ── Encuadres ─────────────────────────────────────────────────────────────────────────────────

/** Vista de las curvas: escala (px por unidad), centro vertical y giro alrededor del eje z. */
type Vista = {escala: number; cy: number; ang: number};
const VISTA_CURVAS: Vista = {escala: 19, cy: 850, ang: 0};
/** La mariposa de la portada y del final: más pequeña y más arriba, por encima del título. */
const VISTA_PORTADA: Vista = {escala: 13, cy: 690, ang: 0};
/** El atractor completo al alejar la cámara (cabe con el giro de ±0,6 rad). */
const ESCALA_ATRACTOR = 14;

const proyectar = (p: P3, v: Vista): [number, number] => [
  500 + (p[0] * Math.cos(v.ang) + p[1] * Math.sin(v.ang)) * v.escala,
  v.cy - (p[2] - 25) * v.escala + (p[1] * Math.cos(v.ang) - p[0] * Math.sin(v.ang)) * Math.sin(v.ang) * 4,
];

function vistaEn(t: number, l: Linea): Vista {
  if (t < DURACION_PORTADA) return VISTA_PORTADA;
  const giro = (s: number) => (s >= l.abre ? 0.6 * Math.sin((s - l.abre) * 0.25) * fase(s, l.abre, l.abre + 2) : 0);
  // "Alejemos la cámara": de 19 a 14 px por unidad. Con el giro (±0,6 rad) la figura abre hasta
  // |x| ≈ 30: a 19 se salía por los dos lados (−68…1068 px); a 14 queda en 82…918, dentro de las zonas seguras.
  const lejos = (s: number) => VISTA_CURVAS.escala + (ESCALA_ATRACTOR - VISTA_CURVAS.escala) * salidaCubica(fase(s, l.abre, l.abre + 2));
  if (t < l.cierre) return {...VISTA_CURVAS, escala: lejos(t), ang: giro(t)};
  // "Una vuelta más": la cámara vuelve al encuadre de la portada
  const k = salidaCubica(fase(t, l.cierre, l.cierre + 0.8));
  const e0 = lejos(l.cierre);
  return {escala: e0 + (VISTA_PORTADA.escala - e0) * k, cy: 850 + (VISTA_PORTADA.cy - 850) * k, ang: giro(l.cierre) * (1 - k)};
}

/** Curvas y puntos. Con `completa`, desde el principio de la trayectoria; si no, una estela. */
function curvas(c: Parameters<Parameters<typeof useDibujo>[1]>[0], indice: number, v: Vista, completa: number) {
  for (const [curva, ctx] of [[datos.azul, c.solido.b], [datos.rosa, c.solido.a]] as const) {
    const estela = Math.max(0, indice - 170);
    const desde = Math.floor(estela * (1 - completa));
    ctx.strokeStyle = ctx.fillStyle = cobertura(1);
    ctx.lineWidth = completa > 0.5 ? 2.5 : 5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = desde; i <= indice; i++) {
      const [x, y] = proyectar(curva[i], v);
      if (i === desde) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    const [x, y] = proyectar(curva[indice], v);
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Flecha del campo de Lorenz en un punto, proyectada en x-z (dx = 10(y − x), dz = xy − 8z/3), en px.
 * La dirección es exacta; el largo crece con la rapidez pero comprimido (log), para que las flechas
 * lentas se vean (antes, a 4 px por unidad, la del inicio medía 7 px y no se veía).
 */
function flechaLorenz(p: P3): [number, number] {
  const vx = 10 * (p[1] - p[0]);
  const vz = p[0] * p[1] - (8 * p[2]) / 3;
  const v = Math.hypot(vx, vz) || 1;
  const largo = 70 + 45 * Math.log1p(v);
  return [(vx / v) * largo, -(vz / v) * largo];
}

// ── Campo de flechas (esquema) ────────────────────────────────────────────────────────────────

/** Corte del campo de Lorenz en el plano x-z con y = 1: dx = 10(1 − x), dz = x − 8z/3. */
const vector = (x: number, z: number): [number, number] => [10 * (1 - x), x - 8 * z / 3];
const aPantalla = (x: number, z: number): [number, number] => [500 + ((x - 1) / 0.45) * 106, 850 - ((z - 1) / 0.8) * 118];

/** Un punto que sigue las flechas (RK4 en el corte), desde arriba a la izquierda. Determinista. */
function recorrido(tiempo: number): [number, number][] {
  const pasos = Math.min(400, Math.floor(tiempo / 0.002));
  let x = -0.35;
  let z = 2.6;
  const out: [number, number][] = [[x, z]];
  const h = 0.002;
  for (let k = 0; k < pasos; k++) {
    const [a1, b1] = vector(x, z);
    const [a2, b2] = vector(x + (h / 2) * a1, z + (h / 2) * b1);
    const [a3, b3] = vector(x + (h / 2) * a2, z + (h / 2) * b2);
    const [a4, b4] = vector(x + h * a3, z + h * b3);
    x += (h / 6) * (a1 + 2 * a2 + 2 * a3 + a4);
    z += (h / 6) * (b1 + 2 * b2 + 2 * b3 + b4);
    out.push([x, z]);
  }
  return out;
}

// ── Componente ────────────────────────────────────────────────────────────────────────────────

const Sketch: React.FC<PropsSketch> = ({tiempos, config}) => {
  const f = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const t = f / fps;
  const l = linea(tiempos, (durationInFrames - 1) / fps);
  const pulso = pulsoDe(config);

  useDibujo(ORDEN.sketch, (c) => {
    const papel = c.solido.k;
    const esquema = t >= l.inicio && t < l.casi;
    if (esquema) {
      const escala = 1 + fase(t, l.inicio, l.mapa) * 159999;
      // El desplazamiento inicial es de 0,001 en x. Ampliamos ambas muestras con la misma escala.
      if (t < l.mapa) {
        for (const [j, ctx] of [c.solido.b, c.solido.a].entries()) {
          ctx.fillStyle = cobertura(1);
          ctx.beginPath();
          ctx.arc(500 + (j ? -0.5 : 0.5) * 0.001 * escala, 845, 15, 0, Math.PI * 2);
          ctx.fill();
        }
        rotulo(c, 'inicio / diferencia: 0.001', 95, 470, 1, {tinta: 'a', tam: 31});
        return;
      }
      papel.strokeStyle = papel.fillStyle = cobertura(1);
      if (t < l.dos) {
        // Las flechas entran columna a columna, una por semicorchea
        for (let i = -3; i <= 3; i++) {
          const q = salidaCubica(fase(t, l.mapa + (i + 3) * (pulso.negra / 4), l.mapa + (i + 3) * (pulso.negra / 4) + 0.25));
          if (q <= 0) continue;
          for (let j = -2; j <= 2; j++) {
            const [dx, dz] = vector(1 + i * 0.45, 1 + j * 0.8);
            flecha(papel, 500 + i * 106, 850 - j * 118, dx * 4 * q, -dz * 4 * q);
          }
        }
        // Un punto rosa que se deja llevar por las flechas: va rápido donde son largas y frena donde son cortas
        const arranque = l.mapa + 7 * (pulso.negra / 4) + 0.3;
        if (t > arranque) {
          const r = recorrido((t - arranque) * 0.12);
          const a = c.solido.a;
          a.strokeStyle = a.fillStyle = cobertura(1);
          a.lineWidth = 4;
          a.setLineDash([8, 10]);
          a.beginPath();
          r.forEach(([x, z], k) => {
            const [px, py] = aPantalla(x, z);
            if (k) a.lineTo(px, py);
            else a.moveTo(px, py);
          });
          a.stroke();
          a.setLineDash([]);
          const [px, py] = aPantalla(...r[r.length - 1]);
          a.beginPath();
          a.arc(px, py, 14, 0, Math.PI * 2);
          a.fill();
        }
        rotulo(c, 'esquema · campo en un corte x-z', 90, 465, 1, {tam: 32, tinta: 'b'});
        return;
      }
      const marcas = [l.pasos, tiempoAncla(tiempos, 'cambia la flecha', l.pasos + 1), tiempoAncla(tiempos, 'avanzan otra vez', l.pasos + 2)];
      const paso = t < marcas[1] ? 0 : t < marcas[2] ? 1 : 2;
      const u = t < l.pasos ? 0 : paso + fase(t, marcas[paso], Math.min(marcas[paso] + 0.5, marcas[paso + 1] ?? l.casi));
      // "Casi apuntan al mismo sitio": las flechas se juntan en el centro para compararlas; vuelven en "como los puntos…"
      const tJuntas = tiempoAncla(tiempos, 'casi apuntan', l.dos + 1.5);
      const tSeparan = tiempoAncla(tiempos, 'como los puntos', tJuntas + 3.7);
      const juntas = t < l.pasos ? salidaCubica(fase(t, tJuntas, tJuntas + 0.5)) * (1 - salidaCubica(fase(t, tSeparan, tSeparan + 0.5))) : 0;
      const entra = t < l.pasos ? salidaCubica(fase(t, l.dos + 0.2, l.dos + 0.6)) : 1;
      for (const [j, ctx] of [c.solido.b, c.solido.a].entries()) {
        const xx = j ? 1 : 1.001;
        const idx = Math.min(50, Math.round(u * 4));
        const curva = j ? datos.rosa : datos.azul;
        const pt = curva[idx];
        // Dos ampliaciones contiguas conservan la misma escala y el mismo eje vertical.
        const x = 260 + 440 * j + (pt[0] - xx) * 25;
        const y = 850 - (pt[2] - 1) * 25;
        ctx.fillStyle = ctx.strokeStyle = cobertura(1);
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.fill();
        const [dx, dz] = flechaLorenz(pt);
        const ox = x + (500 - x) * juntas;
        const oy = y + (700 - y) * juntas;
        flecha(ctx, ox, oy, dx * entra, dz * entra, 6);
        ctx.font = fuente(MONO, 27, 700);
        ctx.fillText(j ? 'ROSA' : 'AZUL', 210 + 470 * j, 1030);
      }
      if (juntas > 0.5) {
        // La diferencia de verdad, medida con las dos flechas del inicio
        const [ax, az] = flechaLorenz(datos.azul[0]);
        const [bx, bz] = flechaLorenz(datos.rosa[0]);
        const grados = (Math.abs(Math.atan2(az, ax) - Math.atan2(bz, bx)) * 180) / Math.PI;
        rotulo(c, `ángulo entre las dos: ${grados.toFixed(2).replace('.', ',')}°`, 270, 1180, salidaCubica(fase(t, tJuntas + 0.3, tJuntas + 0.7)), {tam: 30, tinta: 'b'});
      }
      rotulo(c, t < l.pasos ? 'misma escala / dos inicios' : 'movimiento / paso ' + (paso + 1), 90, 465, 1, {tam: 32, tinta: 'a'});
      return;
    }

    const indice = indiceEn(t, l);
    const v = vistaEn(t, l);
    // La figura completa: en la portada, al alejar la cámara y en el final
    const completa = t < DURACION_PORTADA || t >= l.cierre ? 1 : t >= l.abre ? fase(t, l.abre, l.abre + 2) : 0;
    curvas(c, indice, v, completa);
    if (t >= l.casi && t < l.abre) {
      // La distancia entre los dos puntos, como una línea punteada
      const a = proyectar(datos.rosa[indice], v);
      const b = proyectar(datos.azul[indice], v);
      papel.strokeStyle = cobertura(1);
      papel.lineWidth = 2;
      papel.setLineDash([6, 9]);
      papel.beginPath();
      papel.moveTo(a[0], a[1]);
      papel.lineTo(b[0], b[1]);
      papel.stroke();
      papel.setLineDash([]);
    }
    if (t >= l.abre && t < l.cierre) rotulo(c, 'atractor de Lorenz', 90, 420, 1, {tam: 32, tinta: 'b'});
  });
  return null;
};

/** tiempoDeAncla con valor por defecto (para las marcas de la escena de pasos). */
function tiempoAncla(tiempos: PropsSketch['tiempos'], ancla: string, defecto: number): number {
  return tiempoDeAncla(tiempos, ancla) ?? defecto;
}

export default Sketch;
