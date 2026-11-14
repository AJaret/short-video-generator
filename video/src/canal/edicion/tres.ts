// 3D del estilo "edición": caras planas a color (luz → mezcla entre dos colores), pintadas de lejos a
// cerca. Reutiliza las mallas y transformaciones del motor riso (../tres.ts); lo único nuevo es que
// pinta directo en un Canvas 2D a color en vez de en las capas de tinta. Módulo PURO.
import {transformar, type Malla, type Transformacion, type Vec3} from '../tres';
import {mezclarColor} from './paleta';

/**
 * Cámara en órbita. `escala` = px por unidad de mundo a la distancia del objetivo: la perspectiva se
 * regula con `distancia` (grande = casi ortográfica) sin que cambie el tamaño en pantalla.
 * Con elevación π/2 y azimut 0 mira desde arriba con +X a la derecha y +Z hacia abajo (un mapa).
 */
export type Camara3 = {
  objetivo: Vec3;
  distancia: number;
  azimut: number;
  elevacion: number;
  escala: number;
  centro: [number, number];
};

export type Vista3 = {pos: Vec3; r: Vec3; u: Vec3; f: Vec3; foco: number; cx: number; cy: number};

const resta = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const punto = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cruz = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unidad = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

export function vistaDe(c: Camara3): Vista3 {
  const el = Math.max(0.02, Math.min(Math.PI / 2, c.elevacion));
  const d: Vec3 = [Math.cos(el) * Math.sin(c.azimut), Math.sin(el), Math.cos(el) * Math.cos(c.azimut)];
  const pos: Vec3 = [c.objetivo[0] + d[0] * c.distancia, c.objetivo[1] + d[1] * c.distancia, c.objetivo[2] + d[2] * c.distancia];
  const f: Vec3 = [-d[0], -d[1], -d[2]];
  // Derecha siempre horizontal: no degenera al mirar desde arriba
  const r: Vec3 = [Math.cos(c.azimut), 0, -Math.sin(c.azimut)];
  return {pos, r, u: cruz(r, f), f, foco: c.escala * c.distancia, cx: c.centro[0], cy: c.centro[1]};
}

/** Punto del mundo → [x, y, profundidad, px por unidad], o null si queda detrás de la cámara. */
export function proyectar(p: Vec3, v: Vista3): [number, number, number, number] | null {
  const d = resta(p, v.pos);
  const z = punto(d, v.f);
  if (z < 0.05) return null;
  const k = v.foco / z;
  return [v.cx + punto(d, v.r) * k, v.cy - punto(d, v.u) * k, z, k];
}

export type Material3 = {
  luz: string;
  sombra: string;
  /** Aristas (color) y su grosor en px. */
  borde?: string;
  grosor?: number;
};

/** `i` = índice de la cara en su malla (para recolorear una en concreto, p. ej. la tapa de un cilindro). */
export type Cara3 = {pts: [number, number][]; z: number; relleno: string; borde?: string; grosor?: number; i: number};

/** Luz fija en el mundo: arriba, un poco de frente y de lado. La tapa de un sólido queda la más clara. */
const LUZ: Vec3 = unidad([-0.45, 0.8, 0.4]);

function normalCara(v: Vec3[]): Vec3 {
  let x = 0, y = 0, z = 0;
  for (let i = 0; i < v.length; i++) {
    const a = v[i];
    const b = v[(i + 1) % v.length];
    x += (a[1] - b[1]) * (a[2] + b[2]);
    y += (a[2] - b[2]) * (a[0] + b[0]);
    z += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return unidad([x, y, z]);
}

/** Caras visibles de una malla, ya proyectadas y sombreadas (sin pintar: se ordenan con las demás). */
export function carasDe(malla: Malla, tr: Transformacion | undefined, v: Vista3, mat: Material3, ambiente = 0.25): Cara3[] {
  const mundo = malla.v.map((p) => transformar(p, tr));
  const lista: Cara3[] = [];
  malla.caras.forEach((cara, i) => {
    const pts = cara.map((k) => mundo[k]);
    const n = normalCara(pts);
    const centro: Vec3 = [0, 0, 0];
    for (const p of pts) {
      centro[0] += p[0] / pts.length;
      centro[1] += p[1] / pts.length;
      centro[2] += p[2] / pts.length;
    }
    if (punto(n, resta(v.pos, centro)) <= 0) return; // cara trasera
    const proy = pts.map((p) => proyectar(p, v));
    if (proy.some((p) => p === null)) return;
    const luz = ambiente + (1 - ambiente) * Math.max(0, punto(n, LUZ));
    lista.push({
      pts: proy.map((p) => [p![0], p![1]]),
      z: proy.reduce((s, p) => s + p![2], 0) / proy.length,
      relleno: mezclarColor(mat.sombra, mat.luz, luz),
      borde: mat.borde,
      grosor: mat.grosor,
      i,
    });
  });
  return lista;
}

/** Pinta las caras de lejos a cerca (algoritmo del pintor). */
export function pintarCaras(ctx: CanvasRenderingContext2D, caras: Cara3[]): void {
  caras.sort((a, b) => b.z - a.z);
  ctx.lineJoin = 'round';
  for (const c of caras) {
    ctx.beginPath();
    c.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = c.relleno;
    ctx.fill();
    // Un trazo del mismo color tapa la rendija entre caras vecinas
    ctx.strokeStyle = c.borde ?? c.relleno;
    ctx.lineWidth = c.borde ? (c.grosor ?? 2) : 1;
    ctx.stroke();
  }
}

/** Mezcla dos cámaras (para los viajes dentro de una escena). */
export function mezclarCamaras(a: Camara3, b: Camara3, f: number): Camara3 {
  const m = (x: number, y: number) => x + (y - x) * f;
  return {
    objetivo: [m(a.objetivo[0], b.objetivo[0]), m(a.objetivo[1], b.objetivo[1]), m(a.objetivo[2], b.objetivo[2])],
    distancia: m(a.distancia, b.distancia),
    azimut: m(a.azimut, b.azimut),
    elevacion: m(a.elevacion, b.elevacion),
    escala: m(a.escala, b.escala),
    centro: [m(a.centro[0], b.centro[0]), m(a.centro[1], b.centro[1])],
  };
}
