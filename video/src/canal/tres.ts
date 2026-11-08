// Motor 3D mínimo del canal, dibujado en las capas riso. Módulo PURO (sin React), determinista.
//
// La idea: un objeto 3D iluminado da grises, y la trama de <RisoFilter> los convierte en puntos.
// Es "volumen con trama, nunca degradados" llevado a 3D. No hay WebGL aquí: se proyecta a 2D y se
// pinta con el algoritmo del pintor (de lo más lejano a lo más cercano).
//
//   · Mallas: cubo, esfera, toro, cilindro, cono, superficie z = f(x, y).
//   · Cámara en órbita (azimut, elevación, distancia) con perspectiva; Y hacia arriba.
//   · Sombreado: luz fija respecto a la cámara (como en motion graphics: el objeto gira, la luz no).
//     La luz de cada cara → cobertura de su tinta (capa tramada). Con `sombra`, la parte más oscura
//     se imprime además con la otra tinta (el solape sale #002284). Aristas en la capa sólida.
//   · Oclusión: cada cara se pinta opaca en las tres capas tramadas (con "blanco" en las tintas que
//     no lleva) y recorta las capas sólidas: lo de delante tapa lo de detrás, también entre tintas.
//   · Curvas 3D con cruces legibles (un halo de papel bajo cada tramo cercano) y nubes de puntos.
//   · Giros al pulso: saltan en cada tiempo y frenan (giroAlPulso).
import type {Capas} from './capas';
import {salidaExpo} from './curvas';
import {ALTO, ANCHO} from './diseno';
import type {NombreTinta} from './fondos';
import type {Pulso} from './pulso';

export type Vec3 = [number, number, number];

const sumar = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const restar = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const por = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const punto = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cruz = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalizar = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

// ── Mallas ────────────────────────────────────────────────────────────────────────────────────

export type Malla = {
  v: Vec3[];
  /** Índices de vértices de cada cara, en sentido antihorario visto desde fuera. */
  caras: number[][];
  /** Superficie abierta: se ve por los dos lados (sin descartar caras traseras). */
  abierta?: boolean;
};

/** Normal de una cara (método de Newell: robusto con caras degeneradas en los polos). */
function normalCara(v: Vec3[]): Vec3 {
  let x = 0, y = 0, z = 0;
  for (let i = 0; i < v.length; i++) {
    const a = v[i];
    const b = v[(i + 1) % v.length];
    x += (a[1] - b[1]) * (a[2] + b[2]);
    y += (a[2] - b[2]) * (a[0] + b[0]);
    z += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return normalizar([x, y, z]);
}

const centroDe = (v: Vec3[]): Vec3 => por(v.reduce((s, p) => sumar(s, p), [0, 0, 0] as Vec3), 1 / v.length);

/** Pone todas las caras mirando hacia fuera según `fuera(centroCara)` (dirección hacia fuera). */
function orientar(m: Malla, fuera: (c: Vec3) => Vec3): Malla {
  m.caras = m.caras.map((cara) => {
    const pts = cara.map((i) => m.v[i]);
    return punto(normalCara(pts), fuera(centroDe(pts))) < 0 ? [...cara].reverse() : cara;
  });
  return m;
}

/** Cubo de lado 2 centrado en el origen. */
export function cubo(): Malla {
  const v: Vec3[] = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) v.push([x, y, z]);
  const i = (x: number, y: number, z: number) => (x > 0 ? 4 : 0) + (y > 0 ? 2 : 0) + (z > 0 ? 1 : 0);
  const caras = [
    [i(-1, -1, 1), i(1, -1, 1), i(1, 1, 1), i(-1, 1, 1)],
    [i(1, -1, -1), i(-1, -1, -1), i(-1, 1, -1), i(1, 1, -1)],
    [i(1, -1, 1), i(1, -1, -1), i(1, 1, -1), i(1, 1, 1)],
    [i(-1, -1, -1), i(-1, -1, 1), i(-1, 1, 1), i(-1, 1, -1)],
    [i(-1, 1, 1), i(1, 1, 1), i(1, 1, -1), i(-1, 1, -1)],
    [i(-1, -1, -1), i(1, -1, -1), i(1, -1, 1), i(-1, -1, 1)],
  ];
  return orientar({v, caras}, (c) => c);
}

/** Esfera de radio 1 con `paralelos` × `meridianos` caras. */
export function esfera(paralelos = 14, meridianos = 24): Malla {
  const v: Vec3[] = [];
  for (let i = 0; i <= paralelos; i++) {
    const lat = Math.PI * (i / paralelos) - Math.PI / 2;
    for (let j = 0; j < meridianos; j++) {
      const lon = (2 * Math.PI * j) / meridianos;
      v.push([Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)]);
    }
  }
  const caras: number[][] = [];
  for (let i = 0; i < paralelos; i++) {
    for (let j = 0; j < meridianos; j++) {
      const a = i * meridianos + j;
      const b = i * meridianos + ((j + 1) % meridianos);
      caras.push([a, b, b + meridianos, a + meridianos]);
    }
  }
  return orientar({v, caras}, (c) => c);
}

/** Toro en el plano XZ: radio mayor R, radio del tubo r. */
export function toro(R = 1, r = 0.4, segmentos = 32, lados = 14): Malla {
  const v: Vec3[] = [];
  for (let i = 0; i < segmentos; i++) {
    const u = (2 * Math.PI * i) / segmentos;
    for (let j = 0; j < lados; j++) {
      const w = (2 * Math.PI * j) / lados;
      const d = R + r * Math.cos(w);
      v.push([d * Math.cos(u), r * Math.sin(w), d * Math.sin(u)]);
    }
  }
  const caras: number[][] = [];
  for (let i = 0; i < segmentos; i++) {
    for (let j = 0; j < lados; j++) {
      const a = i * lados + j;
      const b = ((i + 1) % segmentos) * lados + j;
      const c = ((i + 1) % segmentos) * lados + ((j + 1) % lados);
      const d = i * lados + ((j + 1) % lados);
      caras.push([a, b, c, d]);
    }
  }
  return orientar({v, caras}, (c) => {
    const ang = Math.atan2(c[2], c[0]);
    return restar(c, [R * Math.cos(ang), 0, R * Math.sin(ang)]);
  });
}

/** Cilindro (o cono si `radioArriba` = 0) de altura 2 sobre el eje Y. */
export function cilindro(lados = 24, radioArriba = 1, radioAbajo = 1): Malla {
  const v: Vec3[] = [];
  for (let j = 0; j < lados; j++) {
    const a = (2 * Math.PI * j) / lados;
    v.push([radioAbajo * Math.cos(a), -1, radioAbajo * Math.sin(a)]);
    v.push([radioArriba * Math.cos(a), 1, radioArriba * Math.sin(a)]);
  }
  const caras: number[][] = [];
  for (let j = 0; j < lados; j++) {
    const k = (j + 1) % lados;
    caras.push([2 * j, 2 * k, 2 * k + 1, 2 * j + 1]);
  }
  caras.push(Array.from({length: lados}, (_, j) => 2 * j));
  if (radioArriba > 0) caras.push(Array.from({length: lados}, (_, j) => 2 * j + 1));
  return orientar({v, caras}, (c) => (Math.abs(c[1]) > 0.999 && Math.hypot(c[0], c[2]) < 0.2 ? [0, c[1], 0] : [c[0], 0, c[2]]));
}

export const cono = (lados = 24) => cilindro(lados, 0, 1);

/**
 * Superficie y = f(x, z) sobre el cuadrado [−1, 1]², con `n` × `n` caras. Se ve por los dos lados.
 * `f` recibe (x, z) y devuelve la altura.
 */
export function superficie(f: (x: number, z: number) => number, n = 30): Malla {
  const v: Vec3[] = [];
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      const x = (j / n) * 2 - 1;
      const z = (i / n) * 2 - 1;
      v.push([x, f(x, z), z]);
    }
  }
  const caras: number[][] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const a = i * (n + 1) + j;
      caras.push([a, a + n + 1, a + n + 2, a + 1]);
    }
  }
  return {v, caras, abierta: true};
}

// ── Transformaciones ──────────────────────────────────────────────────────────────────────────

export type Transformacion = {
  /** Traslación. */
  pos?: Vec3;
  /** Giro en radianes alrededor de X, Y y Z (en ese orden). */
  rot?: Vec3;
  /** Escala uniforme o por eje. */
  escala?: number | Vec3;
};

export function transformar(p: Vec3, tr: Transformacion = {}): Vec3 {
  const e = tr.escala ?? 1;
  let [x, y, z] = typeof e === 'number' ? por(p, e) : [p[0] * e[0], p[1] * e[1], p[2] * e[2]];
  const [rx, ry, rz] = tr.rot ?? [0, 0, 0];
  if (rx) [y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)];
  if (ry) [x, z] = [x * Math.cos(ry) + z * Math.sin(ry), -x * Math.sin(ry) + z * Math.cos(ry)];
  if (rz) [x, y] = [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz)];
  const pos = tr.pos ?? [0, 0, 0];
  return [x + pos[0], y + pos[1], z + pos[2]];
}

// ── Cámara ────────────────────────────────────────────────────────────────────────────────────

export type Camara = {
  /** Punto al que mira (por defecto el origen). */
  objetivo?: Vec3;
  distancia: number;
  /** Giro alrededor del eje Y, en radianes (0 = mirando desde +Z). */
  azimut: number;
  /** Altura sobre el horizonte, en radianes (se limita a ±89°). */
  elevacion: number;
  /** Campo de visión vertical en radianes (por defecto 35°). Pequeño = casi ortográfico. */
  fov?: number;
  /** Centro de la imagen en pantalla (por defecto el centro del lienzo). */
  centro?: [number, number];
  /** Alto de pantalla que cubre el campo de visión, en px (por defecto 1080). */
  vista?: number;
};

type Vista = {pos: Vec3; r: Vec3; u: Vec3; f: Vec3; foco: number; cx: number; cy: number};

function vistaDe(c: Camara): Vista {
  const obj = c.objetivo ?? [0, 0, 0];
  const el = Math.max(-1.553, Math.min(1.553, c.elevacion));
  const pos = sumar(obj, por([Math.cos(el) * Math.sin(c.azimut), Math.sin(el), Math.cos(el) * Math.cos(c.azimut)], c.distancia));
  const f = normalizar(restar(obj, pos));
  const r = normalizar(cruz(f, [0, 1, 0]));
  const u = cruz(r, f);
  const fov = c.fov ?? (35 * Math.PI) / 180;
  const [cx, cy] = c.centro ?? [ANCHO / 2, ALTO / 2];
  return {pos, r, u, f, foco: (c.vista ?? 1080) / 2 / Math.tan(fov / 2), cx, cy};
}

/** Coordenadas de vista: x a la derecha, y arriba, z = profundidad (positiva delante). */
const aVista = (p: Vec3, v: Vista): Vec3 => {
  const d = restar(p, v.pos);
  return [punto(d, v.r), punto(d, v.u), punto(d, v.f)];
};

const CERCA = 0.05;

/** Proyecta un punto del mundo a pantalla: [x, y, profundidad, escala px por unidad] o null si está detrás. */
export function proyectar(p: Vec3, camara: Camara): [number, number, number, number] | null {
  const v = vistaDe(camara);
  return proyectarCon(p, v);
}

function proyectarCon(p: Vec3, v: Vista): [number, number, number, number] | null {
  const [x, y, z] = aVista(p, v);
  if (z < CERCA) return null;
  const k = v.foco / z;
  return [v.cx + x * k, v.cy - y * k, z, k];
}

// ── Escena: objetos sombreados ────────────────────────────────────────────────────────────────

export type Material = {
  /** Tinta del objeto. */
  tinta: NombreTinta;
  /** Tinta extra en la parte más oscura (sombra a dos tintas). */
  sombra?: NombreTinta;
  /** Aristas en la capa sólida de esta tinta (true = negro). */
  aristas?: boolean | NombreTinta;
  /** Solo aristas (alambre), sin caras. */
  alambre?: boolean;
  /** Cobertura con luz plena y en sombra total (por defecto 0,15 y 1). */
  tonos?: [number, number];
};

export type Objeto3D = {
  malla: Malla;
  tr?: Transformacion;
  material: Material;
  /**
   * Armado: progreso (0…1) de la cara i de n. Con < 1 la cara llega volando desde fuera a lo largo
   * de su normal y creciendo; con 0 no se dibuja. Para que la figura se arme pieza a pieza al pulso.
   */
  armado?: (i: number, n: number) => number;
};

export type OpcionesEscena = {
  /** Dirección hacia la luz en coordenadas de vista (por defecto arriba a la izquierda, hacia la cámara). */
  luz?: Vec3;
  /** Luz ambiente (0…1, por defecto 0,2). */
  ambiente?: number;
  /** Menos tinta con la distancia (0…1): profundidad sin degradado (lo hace la trama). */
  niebla?: number;
  /** Grosor de las aristas en px (por defecto 2,5). */
  grosorAristas?: number;
};

type CaraLista = {pts: [number, number][]; z: number; cobertura: number; material: Material};

const LUZ: Vec3 = normalizar([-0.5, 0.65, -0.6]);

/** Dibuja objetos 3D sombreados en las capas, con oclusión entre ellos. */
export function dibujar3D(capas: Capas, objetos: Objeto3D[], camara: Camara, op: OpcionesEscena = {}): void {
  const vista = vistaDe(camara);
  const luz = normalizar(op.luz ?? LUZ);
  const ambiente = op.ambiente ?? 0.2;
  const lista: CaraLista[] = [];

  for (const obj of objetos) {
    const mundo = obj.malla.v.map((p) => transformar(p, obj.tr));
    const n = obj.malla.caras.length;
    obj.malla.caras.forEach((cara, i) => {
      let pts = cara.map((k) => mundo[k]);
      let normal = normalCara(pts);
      const centro = centroDe(pts);
      const haciaCamara = restar(vista.pos, centro);
      if (punto(normal, haciaCamara) <= 0) {
        if (!obj.malla.abierta) return; // cara trasera de un sólido cerrado
        normal = por(normal, -1);
      }
      if (obj.armado) {
        const q = obj.armado(i, n);
        if (q <= 0) return;
        if (q < 1) {
          const s = 0.3 + 0.7 * q;
          const fuera = por(normal, (1 - q) * 2.5);
          pts = pts.map((p) => sumar(sumar(centro, por(restar(p, centro), s)), fuera));
        }
      }
      const proy = pts.map((p) => proyectarCon(p, vista));
      if (proy.some((p) => p === null)) return;
      const nv: Vec3 = [punto(normal, vista.r), punto(normal, vista.u), punto(normal, vista.f)];
      const luzCara = ambiente + (1 - ambiente) * Math.max(0, punto(nv, luz));
      const [t0, t1] = obj.material.tonos ?? [0.15, 1];
      lista.push({
        pts: proy.map((p) => [p![0], p![1]]),
        z: proy.reduce((s, p) => s + p![2], 0) / proy.length,
        cobertura: t0 + (t1 - t0) * (1 - luzCara),
        material: obj.material,
      });
    });
  }
  if (!lista.length) return;
  lista.sort((x, y) => y.z - x.z);

  const zMin = lista[lista.length - 1].z;
  const zMax = lista[0].z;
  const grosor = op.grosorAristas ?? 2.5;
  const tramadas = {a: capas.a, b: capas.b, k: capas.k};
  const solidas = [capas.solido.a, capas.solido.b, capas.solido.k];

  for (const cara of lista) {
    const trazar = (ctx: CanvasRenderingContext2D) => {
      ctx.beginPath();
      cara.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
    };
    const m = cara.material;
    const lejania = zMax > zMin ? (cara.z - zMin) / (zMax - zMin) : 0;
    const cob = cara.cobertura * (1 - (op.niebla ?? 0) * lejania);
    if (!m.alambre) {
      const sombra = m.sombra ? Math.max(0, Math.min(1, (cob - 0.55) / 0.45)) * 0.9 : 0;
      for (const nombre of ['a', 'b', 'k'] as NombreTinta[]) {
        const valor = nombre === m.tinta ? cob : nombre === m.sombra ? sombra : 0;
        const ctx = tramadas[nombre];
        // Opaco: tapa lo de detrás en esta capa (gris = tinta, "blanco" = sin tinta)
        const g = Math.round(255 * (1 - valor));
        ctx.fillStyle = ctx.strokeStyle = `rgb(${g},${g},${g})`;
        ctx.lineWidth = 1.2; // cierra las rendijas entre caras vecinas
        ctx.lineJoin = 'round';
        trazar(ctx);
        ctx.fill();
        ctx.stroke();
      }
      for (const ctx of solidas) {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = '#000';
        trazar(ctx);
        ctx.fill();
        ctx.restore();
      }
    }
    if (m.aristas || m.alambre) {
      const tinta: NombreTinta = typeof m.aristas === 'string' ? m.aristas : m.alambre && !m.aristas ? m.tinta : 'k';
      const ctx = capas.solido[tinta];
      ctx.lineWidth = grosor;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      trazar(ctx);
      ctx.stroke();
    }
  }
}

// ── Curvas y puntos ───────────────────────────────────────────────────────────────────────────

/**
 * Curva 3D (polilínea) con grosor según la profundidad. Los tramos cercanos van en la tinta
 * `cerca` y los lejanos en `lejos`; cada tramo deja debajo un halo de papel, así que en los cruces
 * se lee qué pasa por delante (como en los diagramas de nudos). `hasta` (0…1) la dibuja en parte.
 */
export function curva3D(
  capas: Capas,
  puntos: Vec3[],
  camara: Camara,
  op: {tr?: Transformacion; grosor?: number; cerca?: NombreTinta; lejos?: NombreTinta; halo?: number; hasta?: number; cerrada?: boolean} = {},
): void {
  const vista = vistaDe(camara);
  const n = Math.max(0, Math.min(puntos.length, Math.round(puntos.length * (op.hasta ?? 1))));
  const proy = puntos.slice(0, n).map((p) => proyectarCon(transformar(p, op.tr), vista));
  const tramos: {a: number[]; b: number[]; z: number; k: number}[] = [];
  const total = op.cerrada && n === puntos.length ? n : n - 1;
  for (let i = 0; i < total; i++) {
    const a = proy[i];
    const b = proy[(i + 1) % n];
    if (!a || !b) continue;
    tramos.push({a, b, z: (a[2] + b[2]) / 2, k: (a[3] + b[3]) / 2});
  }
  if (!tramos.length) return;
  tramos.sort((x, y) => y.z - x.z);
  const zs = tramos.map((t) => t.z);
  const zMin = Math.min(...zs);
  const zMax = Math.max(...zs);
  const grosor = op.grosor ?? 0.06;
  const halo = op.halo ?? 10;
  const todas = [capas.a, capas.b, capas.k, capas.solido.a, capas.solido.b, capas.solido.k];
  for (const t of tramos) {
    const w = Math.max(2, grosor * t.k);
    const lejania = zMax > zMin ? (t.z - zMin) / (zMax - zMin) : 0;
    for (const ctx of todas) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      // Extremos rectos: el halo no muerde el tramo vecino de la misma curva (solo lo que cruza)
      ctx.lineCap = 'butt';
      ctx.lineWidth = w + halo;
      ctx.strokeStyle = '#000';
      ctx.beginPath();
      ctx.moveTo(t.a[0], t.a[1]);
      ctx.lineTo(t.b[0], t.b[1]);
      ctx.stroke();
      ctx.restore();
    }
    const ctx = capas.solido[lejania > 0.5 ? (op.lejos ?? 'b') : (op.cerca ?? 'a')];
    ctx.lineCap = 'round';
    ctx.lineWidth = w;
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.beginPath();
    ctx.moveTo(t.a[0], t.a[1]);
    ctx.lineTo(t.b[0], t.b[1]);
    ctx.stroke();
  }
}

/**
 * Nube de puntos 3D: cada punto es un círculo cuyo tamaño depende de la profundidad. Los cercanos
 * en la tinta `cerca`, los lejanos en `lejos` (por defecto la misma).
 */
export function puntos3D(
  capas: Capas,
  puntos: Vec3[],
  camara: Camara,
  op: {tr?: Transformacion; tam?: number; cerca?: NombreTinta; lejos?: NombreTinta} = {},
): void {
  const vista = vistaDe(camara);
  const proy = puntos
    .map((p) => proyectarCon(transformar(p, op.tr), vista))
    .filter((p): p is [number, number, number, number] => p !== null)
    .sort((x, y) => y[2] - x[2]);
  if (!proy.length) return;
  const zMin = proy[proy.length - 1][2];
  const zMax = proy[0][2];
  const tam = op.tam ?? 0.05;
  for (const [x, y, z, k] of proy) {
    const lejania = zMax > zMin ? (z - zMin) / (zMax - zMin) : 0;
    const ctx = capas.solido[lejania > 0.5 ? (op.lejos ?? op.cerca ?? 'b') : (op.cerca ?? 'b')];
    const r = Math.max(2, (tam * k) / 2);
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** `n` puntos repartidos por igual sobre una esfera de radio 1 (espiral de Fibonacci). */
export function puntosEsfera(n: number): Vec3[] {
  return Array.from({length: n}, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(1 - y * y);
    const a = i * 2.399963229728653;
    return [Math.cos(a) * r, y, Math.sin(a) * r] as Vec3;
  });
}

/** Nudo toroidal (p, q): una curva cerrada que se enrolla p veces alrededor del eje y q por el tubo. */
export function nudoToroidal(p = 2, q = 3, n = 360, R = 1, r = 0.42): Vec3[] {
  return Array.from({length: n}, (_, i) => {
    const t = (2 * Math.PI * i) / n;
    const d = R + r * Math.cos(q * t);
    return [d * Math.cos(p * t), r * Math.sin(q * t), d * Math.sin(p * t)] as Vec3;
  });
}

// ── Movimiento al pulso ───────────────────────────────────────────────────────────────────────

/**
 * Ángulo que avanza a saltos: en cada tiempo (o `division` en negras) gira `paso` radianes de golpe
 * y frena en `frenado` segundos. Antes de `desde`, 0. Es el giro "motion graphics" de un objeto 3D.
 */
export function giroAlPulso(t: number, pulso: Pulso, op: {paso?: number; division?: number; desde?: number; frenado?: number} = {}): number {
  const desde = op.desde ?? 0;
  if (t < desde) return 0;
  const periodo = (op.division ?? 1) * pulso.negra;
  const k = Math.floor((t - desde) / periodo + 1e-9);
  const dentro = t - desde - k * periodo;
  return (op.paso ?? Math.PI / 2) * (k + salidaExpo(dentro / (op.frenado ?? 0.3)));
}
