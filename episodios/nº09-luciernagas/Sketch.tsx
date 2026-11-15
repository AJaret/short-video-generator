// nº09 · ¿Quién las dirige? Luciérnagas que parpadean a la vez (Buck y Buck, 1968) y el modelo que
// lo explica (Mirollo y Strogatz, 1990).
//
// Escenas y momentos en linea.ts; el modelo en simulacion.ts. Con nº08b como estándar:
//   · Bosque en maqueta 3D (tres.ts): árboles con volumen tramado en negro dentro de un panel de noche
//     (tinta azul) que deja papel abajo. La cámara viaja despacio con la voz y vuelve a la portada.
//   · La luz de cada luciérnaga: un núcleo de papel con un halo rosa tramado (rosa + azul = morado).
//   · Gráfico de destellos: cada fila es una luciérnaga y cada punto un destello; al sincronizarse,
//     los puntos se alinean en columnas. Sale de la misma simulación.
//   · Relojes: las dos luciérnagas en 3D (alas azules, linterna rosa) con su reloj debajo.
//   · Revelación: plancha rosa a sangre con el bosque en papel. Sensores: maqueta de nodos.
// Movimiento calmado: lo que late es el tema (un destello cada dos tiempos), no la cámara.
// El primer y el último fotograma son el mismo destello de la portada (loop).
import React, {useMemo} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {
  cilindro,
  cobertura,
  cubo,
  dibujar3D,
  enNegativo,
  entradaSalidaCubica,
  esfera,
  fondoTinta,
  fuente,
  fuenteEnPantalla,
  lectura,
  MONO,
  mulberry32,
  ORDEN,
  proyectar,
  pulsoDe,
  recortarPapel,
  rotulo,
  sacudirRegistro,
  salidaCubica,
  TITULAR,
  todasLasCapas,
  trazarCirculoIrregular,
  trazarEstrella,
  useDibujo,
  type Camara,
  type Capas,
  type Material,
  type Objeto3D,
  type PropsSketch,
  type Vec3,
} from '@canal';
import {desdeDestello, desdeDestelloArbol, fase, linea, parpado, type Escena, type Linea} from './linea';
import {fasesEn, gruposEn} from './simulacion';

const N = 120;
/** Cuánto dura la luz de un destello (constante de caída, s). */
const CAIDA = 0.26;
const brillo = (dt: number) => (dt < 0 ? 0 : Math.exp(-dt / CAIDA));
/** El suelo del bosque (y del mundo). */
const SUELO = -3.6;

const CILINDRO = cilindro(12);
const ESFERA = esfera(10, 16);
const BOLA = esfera(6, 10);
const CUBO = cubo();

/** Árboles del fondo: posición en el suelo y tamaño. El principal está en el origen. */
const FONDO: {x: number; z: number; s: number}[] = [
  {x: -7.5, z: -6, s: 0.8},
  {x: 7, z: -7.5, s: 0.9},
  {x: -11, z: -1.5, s: 0.62},
  {x: 10.5, z: -0.5, s: 0.66},
  {x: -3.5, z: -12, s: 0.72},
  {x: 3.5, z: -13, s: 0.78},
];

// ── Cámara ────────────────────────────────────────────────────────────────────────────────────

/** Una toma: `escala` = px por unidad a la distancia del objetivo; `horizonte` = fin del panel de noche. */
type Toma = {objetivo: Vec3; distancia: number; azimut: number; elevacion: number; escala: number; centro: [number, number]; horizonte: number};
type Plano = {desde: number; toma: Toma; viaje?: number; quieta?: boolean};

const aCamara = (c: Toma): Camara => ({
  objetivo: c.objetivo,
  distancia: c.distancia,
  azimut: c.azimut,
  elevacion: c.elevacion,
  fov: 2 * Math.atan(540 / (c.escala * c.distancia)),
  centro: c.centro,
  vista: 1080,
});

function mezclar(a: Toma, b: Toma, f: number): Toma {
  const m = (x: number, y: number) => x + (y - x) * f;
  return {
    objetivo: [m(a.objetivo[0], b.objetivo[0]), m(a.objetivo[1], b.objetivo[1]), m(a.objetivo[2], b.objetivo[2])],
    distancia: m(a.distancia, b.distancia),
    azimut: m(a.azimut, b.azimut),
    elevacion: m(a.elevacion, b.elevacion),
    escala: m(a.escala, b.escala),
    centro: [m(a.centro[0], b.centro[0]), m(a.centro[1], b.centro[1])],
    horizonte: m(a.horizonte, b.horizonte),
  };
}

/** Deriva: órbita y acercamiento muy lentos dentro del plano (salvo en los planos quietos). */
const conDeriva = (p: Plano, t: number): Toma => {
  if (p.quieta) return p.toma;
  const dt = t - p.desde;
  return {...p.toma, azimut: p.toma.azimut + 0.012 * dt, escala: p.toma.escala * (1 + 0.004 * dt)};
};

function tomaEn(t: number, planos: Plano[]): Toma {
  let i = 0;
  while (i + 1 < planos.length && t >= planos[i + 1].desde) i++;
  const actual = conDeriva(planos[i], t);
  const viaje = planos[i].viaje ?? 0;
  if (i === 0 || viaje <= 0 || t >= planos[i].desde + viaje) return actual;
  return mezclar(conDeriva(planos[i - 1], t), actual, entradaSalidaCubica((t - planos[i].desde) / viaje));
}

const PORTADA: Toma = {objetivo: [0, -0.5, 0], distancia: 24, azimut: 0, elevacion: 0.13, escala: 96, centro: [540, 520], horizonte: 970};
const ARBOL: Toma = {objetivo: [0, -0.5, 0], distancia: 22, azimut: 0.14, elevacion: 0.15, escala: 112, centro: [540, 600], horizonte: 1180};
const BOSQUE: Toma = {objetivo: [0, -1, -4], distancia: 28, azimut: -0.32, elevacion: 0.24, escala: 64, centro: [540, 620], horizonte: 1180};
const ENJAMBRE: Toma = {objetivo: [0, -0.6, 0], distancia: 22, azimut: 0.3, elevacion: 0.16, escala: 78, centro: [540, 470], horizonte: 880};

function planosDe(l: Linea): Plano[] {
  return [
    {desde: -1, toma: PORTADA, quieta: true},
    // "Mira este árbol": la cámara se acerca y el panel de noche baja
    {desde: l.mapa, toma: ARBOL, viaje: 1.6},
    // "En Tailandia hay árboles enteros…": se abre al bosque
    {desde: l.tailandia, toma: BOSQUE, viaje: 1.8},
    // El enjambre (corte, viene de los relojes): el árbol arriba, el gráfico abajo
    {desde: l.sinJefe, toma: ENJAMBRE},
    // Cierre (corte, viene de los sensores): el árbol y vuelta a la portada
    {desde: l.bicho, toma: ARBOL},
    {desde: l.bicho + 0.01, toma: PORTADA, viaje: Math.max(0.5, l.fin - 0.5 - l.bicho), quieta: true},
  ];
}

// ── Componente ────────────────────────────────────────────────────────────────────────────────

const Sketch: React.FC<PropsSketch> = ({tiempos, config}) => {
  const f = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const t = f / fps;
  const fin = (durationInFrames - 1) / fps;
  const pulso = useMemo(() => pulsoDe(config), [config]);
  const l = useMemo(() => linea(tiempos, fin, pulso, config.semilla), [tiempos, fin, pulso, config.semilla]);
  const planos = useMemo(() => planosDe(l), [l]);

  // Luciérnagas: 120 en la copa del árbol principal (las de la simulación) y unas pocas de adorno en
  // cada árbol del fondo (laten con el árbol sincronizado)
  const {copa, adorno} = useMemo(() => {
    const azar = mulberry32(config.semilla + 5);
    const enCopa = (cx: number, cy: number, cz: number, rx: number, ry: number): Vec3 => {
      for (;;) {
        const p: Vec3 = [azar() * 2 - 1, azar() * 2 - 1, azar() * 2 - 1];
        if (p[0] ** 2 + p[1] ** 2 + p[2] ** 2 <= 1) return [cx + p[0] * rx, cy + p[1] * ry, cz + p[2] * rx];
      }
    };
    const copa = Array.from({length: N}, () => enCopa(0, 0, 0, 3.3, 2.7));
    const adorno: Vec3[] = [];
    for (const a of FONDO) {
      const cy = SUELO + a.s * 4.6;
      for (let k = 0; k < 16; k++) adorno.push(enCopa(a.x, cy, a.z, 3 * a.s, 2.4 * a.s));
    }
    return {copa, adorno};
  }, [config.semilla]);

  // ── El bosque de noche ──────────────────────────────────────────────────────────────────────

  /** Los árboles en 3D: troncos y copas con volumen tramado en negro. */
  function arboles(): Objeto3D[] {
    const copaMat: Material = {tinta: 'k', tonos: [0.22, 0.78]};
    const troncoMat: Material = {tinta: 'k', tonos: [0.55, 1]};
    const objetos: Objeto3D[] = [
      // Suelo: un disco algo más oscuro que la noche
      {malla: CILINDRO, tr: {escala: [16, 0.02, 16], pos: [0, SUELO - 0.02, -3]}, material: {tinta: 'k', tonos: [0.18, 0.3]}},
      {malla: CILINDRO, tr: {escala: [0.36, 1.1, 0.36], pos: [0, SUELO + 1.1, 0]}, material: troncoMat},
      {malla: ESFERA, tr: {escala: [2.8, 2.3, 2.8], pos: [0, 0, 0]}, material: copaMat},
    ];
    for (const a of FONDO) {
      const cy = SUELO + a.s * 4.6;
      objetos.push(
        {malla: CILINDRO, tr: {escala: [0.3 * a.s, a.s * 1.2, 0.3 * a.s], pos: [a.x, SUELO + a.s * 1.2, a.z]}, material: troncoMat},
        {malla: ESFERA, tr: {escala: [2.6 * a.s, 2.1 * a.s, 2.6 * a.s], pos: [a.x, cy, a.z]}, material: copaMat},
      );
    }
    return objetos;
  }

  /**
   * Luciérnagas como luz: núcleo de papel y halo rosa tramado, por niveles de brillo (pocas pasadas).
   * `puntos` = [x, y, radio, brillo].
   */
  function luces(c: Capas, puntos: [number, number, number, number][]) {
    const k = c.solido.k;
    k.fillStyle = cobertura(1);
    k.beginPath();
    for (const [x, y, r, b] of puntos) {
      if (b >= 0.1) continue;
      k.moveTo(x + r * 0.45, y);
      k.arc(x, y, r * 0.45, 0, Math.PI * 2);
    }
    k.fill();
    const niveles: [number, number, number][][] = [[], [], [], []];
    for (const [x, y, r, b] of puntos) if (b >= 0.1) niveles[Math.min(3, Math.floor(b * 4))].push([x, y, r * (0.6 + 0.4 * b)]);
    const circulos = (ctx: CanvasRenderingContext2D, lista: [number, number, number][], factor: number) => {
      ctx.beginPath();
      for (const [x, y, r] of lista) {
        ctx.moveTo(x + r * factor, y);
        ctx.arc(x, y, r * factor, 0, Math.PI * 2);
      }
    };
    niveles.forEach((lista, nivel) => {
      if (!lista.length) return;
      const q = (nivel + 1) / 4;
      // Halo: aclara la noche y pone rosa encima (rosa + lo que queda de azul = morado)
      recortarPapel(c, (ctx) => circulos(ctx, lista, 2.6), 0.55 * q);
      c.a.fillStyle = cobertura(0.45 * q);
      circulos(c.a, lista, 2.6);
      c.a.fill();
      recortarPapel(c, (ctx) => circulos(ctx, lista, 1.6), 0.85 * q);
      c.a.fillStyle = cobertura(0.34 * q);
      circulos(c.a, lista, 1.6);
      c.a.fill();
      // Núcleo de papel limpio
      recortarPapel(c, (ctx) => circulos(ctx, lista, 1), 1);
    });
  }

  /** El panel de noche con el bosque y sus luciérnagas. `luz(i)` brillo de la i-ésima del árbol principal. */
  function bosque(c: Capas, toma: Toma, luz: (i: number) => number, luzAdorno: number) {
    const cam = aCamara(toma);
    const panel = (ctx: CanvasRenderingContext2D) => {
      ctx.beginPath();
      ctx.rect(-40, -40, 1160, toma.horizonte - 4 + 40);
    };
    // Todo el 3D queda dentro del panel de noche: nada asoma sobre el papel
    const capas = todasLasCapas(c);
    for (const ctx of capas) {
      ctx.save();
      panel(ctx);
      ctx.clip();
    }
    // Cruces de retícula en el suelo (las tapa lo que está delante)
    const k = c.solido.k;
    k.strokeStyle = cobertura(1);
    k.lineWidth = 2;
    k.beginPath();
    for (let i = -7; i <= 7; i++) {
      for (let j = -8; j <= 4; j++) {
        const q = proyectar([i * 2, SUELO, j * 2], cam);
        if (!q) continue;
        const s = Math.max(3, Math.min(9, q[3] * 0.09));
        k.moveTo(q[0] - s, q[1]);
        k.lineTo(q[0] + s, q[1]);
        k.moveTo(q[0], q[1] - s * 0.5);
        k.lineTo(q[0], q[1] + s * 0.5);
      }
    }
    k.stroke();
    dibujar3D(c, arboles(), cam, {ambiente: 0.3, luz: [-0.6, 0.6, -0.5]});
    // La noche: tinta azul sobre todo el panel (también sobre los árboles, que quedan azul oscuro)
    fondoTinta(c, 'b', {trama: true, rect: {x: -24, y: -24, w: 1128, h: toma.horizonte + 24}, semilla: 3});
    for (const ctx of capas) ctx.restore();
    // El borde del panel, irregular: lo recorta el papel
    recortarPapel(c, (ctx) => {
      ctx.beginPath();
      ctx.rect(-40, toma.horizonte, 1160, 1200);
    });
    fondoTinta(c, 'b', {trama: true, rect: {x: -24, y: toma.horizonte - 40, w: 1128, h: 44}, semilla: 3});
    // Luciérnagas
    const puntos: [number, number, number, number][] = [];
    copa.forEach((p, i) => {
      const q = proyectar(p, cam);
      if (q && q[1] < toma.horizonte - 8) puntos.push([q[0], q[1], Math.max(3, 0.09 * q[3]), luz(i)]);
    });
    adorno.forEach((p) => {
      const q = proyectar(p, cam);
      if (q && q[1] < toma.horizonte - 8) puntos.push([q[0], q[1], Math.max(2.5, 0.09 * q[3]), luzAdorno]);
    });
    luces(c, puntos);
    return cam;
  }

  /** Los párpados de 1917: papel que se cierra sobre la noche, con el borde del ojo en negro. */
  function parpados(c: Capas, toma: Toma) {
    const h = parpado(t, l);
    if (h >= 740) return;
    const cy = toma.centro[1];
    const ojo = (ctx: CanvasRenderingContext2D) => {
      ctx.moveTo(-10, cy);
      ctx.quadraticCurveTo(540, cy - 2 * h, 1090, cy);
      ctx.quadraticCurveTo(540, cy + 2 * h, -10, cy);
      ctx.closePath();
    };
    recortarPapel(c, (ctx) => {
      ctx.beginPath();
      ctx.rect(-40, -40, 1160, toma.horizonte + 140);
      ojo(ctx);
    }, 1, 'evenodd');
    const k = c.solido.k;
    k.strokeStyle = cobertura(1);
    k.lineWidth = 7;
    k.lineJoin = 'round';
    k.beginPath();
    ojo(k);
    k.stroke();
  }

  /**
   * Gráfico de destellos (bajo el panel de noche): cada fila es una luciérnaga y cada punto un
   * destello, de "sin jefe" a ahora. Desordenado al principio; columnas cuando se sincronizan.
   */
  function grafico(c: Capas, e: Escena, toma: Toma) {
    const x0 = 120;
    const x1 = 1000;
    const y0 = toma.horizonte + 70;
    const filas = 40;
    const alto = 9;
    const desde = l.sinJefe;
    const hasta = l.revelacion + 0.3;
    const X = (s: number) => x0 + ((s - desde) / (hasta - desde)) * (x1 - x0);
    const k = c.solido.k;
    // Ejes
    k.strokeStyle = cobertura(1);
    k.lineWidth = 3;
    k.beginPath();
    k.moveTo(x0 - 14, y0 - 10);
    k.lineTo(x0 - 14, y0 + filas * alto + 6);
    k.lineTo(x1, y0 + filas * alto + 6);
    k.stroke();
    // Columnas de sincronía: rosa tramado bajo los destellos en que dispara al menos la mitad
    for (const d of e.historia.destellos) {
      const s = e.inicio + d.t * l.T;
      if (s < desde || s > t || d.quienes.length < e.n / 2) continue;
      c.a.fillStyle = cobertura(0.34 + 0.33 * (d.quienes.length / e.n));
      c.a.fillRect(X(s) - 6, y0 - 8, 12, filas * alto + 12);
    }
    // Puntos
    k.fillStyle = cobertura(1);
    k.beginPath();
    for (let fila = 0; fila < filas; fila++) {
      const i = fila * 3;
      for (const s of e.porReloj[i]) {
        if (s < desde || s > t) continue;
        k.rect(X(s) - 2.5, y0 + fila * alto, 5, alto - 3);
      }
    }
    k.fill();
    // Cabezal
    const xa = X(t);
    c.solido.a.fillStyle = cobertura(1);
    c.solido.a.fillRect(xa - 1.5, y0 - 14, 3, filas * alto + 22);
    // Rótulos
    k.font = fuente(MONO, 22, 700);
    k.textAlign = 'left';
    k.textBaseline = 'alphabetic';
    k.fillText('cada fila, una luciérnaga · cada punto, un destello', x0 - 14, y0 - 22);
    k.textAlign = 'right';
    k.fillText('tiempo', x1, y0 + filas * alto + 34);
    const ciclos = (t - e.inicio) / l.T;
    k.textAlign = 'left';
    k.fillText(`destellos distintos por ciclo: ${ciclos < 1 ? e.n : gruposEn(e.historia, ciclos)}`, x0 - 14, y0 + filas * alto + 34);
  }

  // ── Los relojes: dos luciérnagas en 3D, con su reloj debajo ─────────────────────────────────

  const angulo = (fa: number) => -Math.PI / 2 + 2 * Math.PI * fa;

  /** Una luciérnaga en 3D en `pos`, mirando hacia `giro`. `luz` (0…1) enciende la linterna. */
  function luciernaga3D(pos: Vec3, giro: number, escala: number, luz: number): Objeto3D[] {
    const g = (x: number, y: number, z: number): Vec3 => [
      pos[0] + (x * Math.cos(giro) + z * Math.sin(giro)) * escala,
      pos[1] + y * escala,
      pos[2] + (-x * Math.sin(giro) + z * Math.cos(giro)) * escala,
    ];
    const cuerpo: Material = {tinta: 'k', tonos: [0.3, 0.95]};
    const linterna: Material = luz > 0.15 ? {tinta: 'a', tonos: [0.35 + 0.5 * luz, 1]} : {tinta: 'k', tonos: [0.06, 0.3]};
    const E = (v: Vec3): Vec3 => [v[0] * escala, v[1] * escala, v[2] * escala];
    return [
      {malla: BOLA, tr: {escala: E([0.22, 0.2, 0.2]), pos: g(1.0, 0.05, 0)}, material: cuerpo},
      {malla: BOLA, tr: {escala: E([0.34, 0.26, 0.3]), rot: [0, giro, 0], pos: g(0.58, 0, 0)}, material: cuerpo},
      {malla: BOLA, tr: {escala: E([0.62, 0.28, 0.34]), rot: [0, giro, 0], pos: g(-0.12, -0.02, 0)}, material: cuerpo},
      {malla: BOLA, tr: {escala: E([0.34, 0.26, 0.3]), rot: [0, giro, 0], pos: g(-0.82, -0.06, 0)}, material: linterna},
      // Élitros: placas azules
      {malla: CUBO, tr: {escala: E([0.6, 0.025, 0.2]), rot: [0.4, giro, 0], pos: g(-0.05, 0.3, 0.24)}, material: {tinta: 'b', tonos: [0.2, 0.7]}},
      {malla: CUBO, tr: {escala: E([0.6, 0.025, 0.2]), rot: [-0.4, giro, 0], pos: g(-0.05, 0.3, -0.24)}, material: {tinta: 'b', tonos: [0.2, 0.7]}},
    ];
  }

  /** Un reloj: se carga (sector rosa a medio tono), y al llegar arriba destella (rosa lleno). */
  function reloj(c: Capas, cx: number, cy: number, R: number, fa: number, luz: number, nombre: string, salto: {desde: number; hasta: number} | null) {
    if (R < 4) return;
    const a = c.a;
    if (luz > 0.08) {
      a.fillStyle = cobertura(Math.min(1, 0.2 + 0.8 * luz));
      a.beginPath();
      a.arc(cx, cy, R * 0.97, 0, Math.PI * 2);
      a.fill();
    }
    a.fillStyle = cobertura(0.34);
    a.beginPath();
    a.moveTo(cx, cy);
    a.arc(cx, cy, R * 0.97, -Math.PI / 2, angulo(fa));
    a.closePath();
    a.fill();
    const k = c.solido.k;
    k.strokeStyle = cobertura(1);
    k.fillStyle = cobertura(1);
    k.lineWidth = 5;
    trazarCirculoIrregular(k, cx, cy, R, 17);
    k.stroke();
    k.beginPath();
    for (let i = 0; i < 12; i++) {
      const ang = angulo(i / 12);
      const r0 = i === 0 ? R * 0.74 : R * 0.88;
      k.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
      k.lineTo(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R);
    }
    k.stroke();
    k.lineWidth = 8;
    k.lineCap = 'round';
    k.beginPath();
    k.moveTo(cx, cy);
    k.lineTo(cx + Math.cos(angulo(fa)) * R * 0.8, cy + Math.sin(angulo(fa)) * R * 0.8);
    k.stroke();
    k.beginPath();
    k.arc(cx, cy, 10, 0, Math.PI * 2);
    k.fill();
    if (salto) {
      const s = c.solido.a;
      s.strokeStyle = cobertura(1);
      s.lineWidth = 16;
      s.lineCap = 'butt';
      s.beginPath();
      s.arc(cx, cy, R + 22, angulo(salto.desde), angulo(salto.hasta));
      s.stroke();
    }
    k.font = fuente(MONO, 30, 700);
    k.textAlign = 'center';
    k.textBaseline = 'alphabetic';
    k.fillText(nombre, cx, cy + R + 70);
    k.textAlign = 'left';
  }

  function escenaRelojes(c: Capas) {
    const e = l.relojes;
    const ciclos = (t - e.inicio) / l.T;
    const libre = (i: number) => {
      const x = e.fases0[i] + ciclos;
      return x - Math.floor(x);
    };
    const fases = ciclos < 0 ? [libre(0), libre(1)] : Array.from(fasesEn(e.fases0, ciclos, {eps: e.eps}));
    let salto: {quien: number; desde: number; hasta: number} | null = null;
    for (const d of e.historia.destellos) {
      if (d.t > ciclos) break;
      if (d.quienes.length !== 1 || (ciclos - d.t) * l.T > 0.45) continue;
      const otra = 1 - d.quienes[0];
      const antes = fasesEn(e.fases0, d.t - 1e-7, {eps: e.eps})[otra];
      const despues = fasesEn(e.fases0, d.t + 1e-7, {eps: e.eps})[otra];
      salto = {quien: otra, desde: antes, hasta: despues > antes ? despues : 1};
    }
    const dos = salidaCubica(fase(t, l.regla - 0.1, l.regla + 0.45));
    const luzA = brillo(desdeDestello(e, 0, t, l.T));
    const luzB = brillo(desdeDestello(e, 1, t, l.T)) * dos;
    // Las luciérnagas en 3D, arriba; la cámara gira muy despacio
    const cam = aCamara({objetivo: [0, 0, 0], distancia: 12, azimut: 0.25 + 0.04 * (t - l.truco), elevacion: 0.42, escala: 118, centro: [540, 560], horizonte: 0});
    const xa = -2.25 * dos;
    const objetos = luciernaga3D([xa, 0, 0], 0.5, 1, luzA);
    if (dos > 0.02) objetos.push(...luciernaga3D([-xa, 0, 0], Math.PI - 0.5, dos, luzB));
    // Sombra en el papel (un óvalo tramado bajo cada una: las apoya en el suelo)
    for (const [x, s] of [[xa, 1], [-xa, dos]] as const) {
      if (s < 0.02) continue;
      const q = proyectar([x, -0.9, 0], cam);
      if (!q) continue;
      c.k.fillStyle = cobertura(0.2);
      c.k.beginPath();
      c.k.ellipse(q[0], q[1], 1.3 * q[3] * s, 0.32 * q[3] * s, 0, 0, Math.PI * 2);
      c.k.fill();
    }
    dibujar3D(c, objetos, cam, {ambiente: 0.25});
    // Halo rosa de la linterna al destellar
    for (const [x, g, s, luz] of [[xa, 0.5, 1, luzA], [-xa, Math.PI - 0.5, dos, luzB]] as const) {
      if (luz < 0.12 || s < 0.02) continue;
      const q = proyectar([x + -0.82 * Math.cos(g) * s, -0.06 * s, 0.82 * Math.sin(g) * s], cam);
      if (!q) continue;
      for (const [factor, cob] of [[2.4, 0.34], [1.6, 0.67]] as const) {
        c.a.fillStyle = cobertura(cob * luz);
        c.a.beginPath();
        c.a.arc(q[0], q[1], 0.34 * q[3] * s * factor, 0, Math.PI * 2);
        c.a.fill();
      }
    }
    // Los relojes, debajo de cada una
    const ra = proyectar([xa, 0, 0], cam);
    const rb = proyectar([-xa, 0, 0], cam);
    reloj(c, ra ? ra[0] : 540, 930, 130, fases[0], luzA, 'luciérnaga A', salto?.quien === 0 ? salto : null);
    if (rb && dos > 0.02) reloj(c, rb[0], 930, 130 * dos, fases[1], luzB, 'luciérnaga B', salto?.quien === 1 ? salto : null);
    if (t >= l.regla - 0.1) {
      const desfase = Math.abs(fases[0] - fases[1]);
      const valor = Math.min(desfase, 1 - desfase);
      lectura(c.solido.k, 'desfase entre las dos', `${valor.toFixed(2).replace('.', ',')} de ciclo`, 70, 1340, {tam: 56});
    }
    rotulo(c, 'esquema · modelo de Mirollo y Strogatz', 90, 360, fase(t, l.truco, l.truco + 0.4), {tam: 26, tinta: 'b'});
    if (t >= l.siVe - 0.2) rotulo(c, 've un destello: adelanta su reloj', 90, 1200, fase(t, l.siVe - 0.2, l.siVe + 0.2), {tam: 30, tinta: 'a', semilla: 41});
  }

  // ── La revelación: plancha rosa con el bosque en papel ──────────────────────────────────────

  function estrella(c: Capas, x: number, y: number, r: number, semilla: number) {
    if (r < 2) return;
    enNegativo(c, (ctx) => {
      trazarEstrella(ctx, x, y, r, 8, semilla, 0.2, 0.22);
      ctx.fill();
    });
  }

  function revelacion(c: Capas) {
    const tr = t - l.revelacion;
    const cam = aCamara({...ENJAMBRE, escala: 64, centro: [540, 650], azimut: 0.3 + 0.012 * tr});
    fondoTinta(c, 'a');
    const luz = brillo(desdeDestelloArbol(t, l));
    const e = salidaCubica(fase(tr, 0, 0.35));
    enNegativo(c, (ctx) => {
      // Las copas, en contorno; el tronco principal en dos líneas
      ctx.lineWidth = 5;
      ctx.lineJoin = 'round';
      for (const [x, cy, z, rx] of [[0, 0, 0, 2.8], ...FONDO.map((a) => [a.x, SUELO + a.s * 4.6, a.z, 2.6 * a.s])]) {
        const q = proyectar([x, cy, z], cam);
        if (!q) continue;
        trazarCirculoIrregular(ctx, q[0], q[1], rx * q[3], 7 + Math.round(x), 4, 40);
        ctx.stroke();
      }
      // Las luciérnagas, todas a la vez
      ctx.beginPath();
      for (const p of [...copa, ...adorno]) {
        const q = proyectar(p, cam);
        if (!q) continue;
        const r = Math.max(3, 0.09 * q[3]) * (0.7 + 0.6 * luz);
        ctx.moveTo(q[0] + r, q[1]);
        ctx.arc(q[0], q[1], r, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeRect(90, 390, 900, 620);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.font = fuente(MONO, 32, 700);
      ctx.fillText('destellos distintos por ciclo', 96, 1110);
      ctx.font = fuente(TITULAR, 250);
      ctx.fillText('1', 82, 1340);
      ctx.font = fuente(MONO, 32, 700);
      ctx.fillText('de 120 a uno solo', 270, 1330);
    });
    estrella(c, 90, 390, 96 * e, 3);
    estrella(c, 990, 1010, 80 * e, 8);
    fuenteEnPantalla(c, 'Mirollo y Strogatz, SIAM J. Appl. Math. 50, 1645 (1990)', 1);
  }

  // ── Los sensores: maqueta de nodos ──────────────────────────────────────────────────────────

  function escenaSensores(c: Capas) {
    const e: Escena = l.nodos;
    const cam = aCamara({objetivo: [0, 0, 0], distancia: 14, azimut: 0.55 + 0.03 * (t - l.sensores), elevacion: 0.82, escala: 104, centro: [540, 790], horizonte: 0});
    const pos = (i: number): Vec3 => [((i % 4) - 1.5) * 1.75, 0, (Math.floor(i / 4) - 2) * 1.55];
    // Retícula del suelo
    const k = c.solido.k;
    k.strokeStyle = cobertura(1);
    k.lineWidth = 2;
    k.beginPath();
    for (let i = -3; i <= 3; i++) {
      for (let j = -4; j <= 4; j++) {
        const q = proyectar([i * 1.75 - 0.875, 0, j * 1.55 - 0.775], cam);
        if (!q) continue;
        k.moveTo(q[0] - 7, q[1]);
        k.lineTo(q[0] + 7, q[1]);
        k.moveTo(q[0], q[1] - 4);
        k.lineTo(q[0], q[1] + 4);
      }
    }
    k.stroke();
    // Enlaces de radio, en azul punteado
    const b = c.solido.b;
    b.strokeStyle = cobertura(1);
    b.lineWidth = 3;
    b.setLineDash([7, 9]);
    b.beginPath();
    for (let i = 0; i < e.n; i++) {
      for (const j of [i % 4 < 3 ? i + 1 : -1, i + 4 < e.n ? i + 4 : -1]) {
        if (j < 0) continue;
        const p = proyectar(pos(i), cam);
        const q = proyectar(pos(j), cam);
        if (!p || !q) continue;
        b.moveTo(p[0], p[1]);
        b.lineTo(q[0], q[1]);
      }
    }
    b.stroke();
    b.setLineDash([]);
    // Nodos con volumen: base, LED (rosa al destellar)
    const luces = Array.from({length: e.n}, (_, i) => brillo(desdeDestello(e, i, t, l.T)));
    const objetos: Objeto3D[] = [];
    for (let i = 0; i < e.n; i++) {
      const [x, , z] = pos(i);
      objetos.push(
        {malla: CILINDRO, tr: {escala: [0.34, 0.2, 0.34], pos: [x, 0.2, z]}, material: {tinta: 'k', tonos: [0.25, 0.9]}},
        {malla: CUBO, tr: {escala: [0.17, 0.1, 0.17], pos: [x, 0.5, z]}, material: luces[i] > 0.15 ? {tinta: 'a', tonos: [0.35 + 0.5 * luces[i], 1]} : {tinta: 'k', tonos: [0.06, 0.3]}},
      );
    }
    dibujar3D(c, objetos, cam, {ambiente: 0.3});
    // Antenas y halo de los LED encendidos
    k.lineWidth = 3;
    for (let i = 0; i < e.n; i++) {
      const [x, , z] = pos(i);
      const a0 = proyectar([x + 0.22, 0.4, z], cam);
      const a1 = proyectar([x + 0.22, 1.05, z], cam);
      if (a0 && a1) {
        k.beginPath();
        k.moveTo(a0[0], a0[1]);
        k.lineTo(a1[0], a1[1]);
        k.stroke();
        k.beginPath();
        k.arc(a1[0], a1[1], 5, 0, Math.PI * 2);
        k.fill();
      }
      if (luces[i] < 0.12) continue;
      const q = proyectar([x, 0.6, z], cam);
      if (!q) continue;
      c.a.fillStyle = cobertura(0.34 * luces[i]);
      c.a.beginPath();
      c.a.arc(q[0], q[1], 0.5 * q[3], 0, Math.PI * 2);
      c.a.fill();
    }
    fuenteEnPantalla(c, 'Werner-Allen y otros, SenSys (2005)', fase(t, l.sensores, l.sensores + 0.4));
    rotulo(c, 'esquema · red de sensores sin reloj central', 90, 360, fase(t, l.sensores, l.sensores + 0.4), {tam: 26, tinta: 'b'});
    if (t >= e.juntas) lectura(k, 'error medido en la red real', '0,0001 s', 70, 1340, {tam: 56});
  }

  // ── Fotograma ───────────────────────────────────────────────────────────────────────────────

  useDibujo(ORDEN.sketch, (c) => {
    const k = c.solido.k;
    if (t >= l.truco && t < l.sinJefe) escenaRelojes(c);
    else if (t >= l.revelacion && t < l.sensores) revelacion(c);
    else if (t >= l.sensores && t < l.bicho) escenaSensores(c);
    else if (t >= l.sinJefe && t < l.revelacion) {
      // El enjambre: arranca desordenado y se va juntando (la simulación de verdad)
      const e = l.enjambre;
      const toma = tomaEn(t, planos);
      bosque(c, toma, (i) => brillo(desdeDestello(e, i, t, l.T)), 0);
      grafico(c, e, toma);
      rotulo(c, 'esquema · relojes iguales que se ven todos', 90, 360, fase(t, l.sinJefe, l.sinJefe + 0.4), {tam: 26, tinta: 'b'});
      const sale = fase(t, l.demostraron - 0.1, l.demostraron + 0.3);
      rotulo(c, 'sin jefe', 640, 690, fase(t, l.sinJefe, l.sinJefe + 0.3), {tam: 34, tinta: 'a', desde: 'derecha', salida: sale, semilla: 31});
      if (t >= l.sinMetronomo) rotulo(c, 'sin metrónomo', 640, 762, fase(t, l.sinMetronomo, l.sinMetronomo + 0.3), {tam: 34, tinta: 'a', desde: 'derecha', salida: sale, semilla: 32});
      if (t >= l.demostraron) fuenteEnPantalla(c, 'Mirollo y Strogatz, SIAM J. Appl. Math. 50, 1645 (1990)', fase(t, l.demostraron, l.demostraron + 0.4));
    } else {
      // El bosque sincronizado: al principio y en el cierre
      const toma = tomaEn(t, planos);
      const luz = brillo(desdeDestelloArbol(t, l));
      bosque(c, toma, () => luz, luz);
      parpados(c, toma);
      if (t >= l.laurent && t < l.noEran + 0.6) fuenteEnPantalla(c, 'P. Laurent, Science 45, 44 (1917)', fase(t, l.laurent, l.laurent + 0.4));
      if (t >= l.tailandia && t < l.truco) {
        fuenteEnPantalla(c, 'Buck y Buck, Science 159, 1319 (1968)', fase(t, l.tailandia, l.tailandia + 0.4));
        rotulo(c, 'esquema · aquí parpadean más lento', 90, 360, fase(t, l.tailandia, l.tailandia + 0.4), {tam: 26, tinta: 'b'});
        rotulo(c, 'Pteroptyx malaccae · Tailandia', 90, 1110, fase(t, l.tailandia + 0.2, l.tailandia + 0.6), {tam: 30, tinta: 'b', semilla: 43});
        lectura(k, 'en el árbol real, un destello cada', '0,56 s', 70, 1340, {tam: 60});
      } else if (t >= l.mapa && t < l.laurent) {
        rotulo(c, 'esquema · un árbol de luciérnagas', 90, 360, fase(t, l.mapa, l.mapa + 0.4), {tam: 26, tinta: 'b'});
      }
    }
    // El glitch riso, solo en la revelación
    sacudirRegistro(c, t, [l.revelacion], 9, 0.12);
  });

  return null;
};

export default Sketch;
