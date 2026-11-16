// nº10 · ¿Quién elige la casa? Un enjambre de abejas elige casa por votación (Seeley y Buhrman 2001;
// Seeley y Visscher 2004; Seeley, Honeybee Democracy, 2010).
//
// Escenas y momentos en linea.ts; el esquema del mecanismo en simulacion.ts. Con nº08b y nº09 como
// estándar, en riso y con movimiento calmado:
//   · Maqueta 3D: el enjambre (una nube tramada en negro con sombra rosa) colgado de una rama, y la
//     isla con cinco cajas con volumen: la buena en rosa, las regulares en azul.
//   · El baile, sobre papel: dos panales con su bailarina; el ocho del baile y los circuitos de cada
//     vuelta en barras.
//   · La votación: la isla arriba y, abajo, las exploradoras en cada caja (la simulación) hasta la
//     línea del quórum.
//   · Revelación: plancha rosa a sangre con «4 DE 5» en papel.
// El primer y el último fotograma son el mismo (loop): la portada.
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
  hash01,
  lectura,
  mira,
  MONO,
  ORDEN,
  proyectar,
  pulsoDe,
  recortarPapel,
  rotulo,
  sacudirRegistro,
  salidaCubica,
  TITULAR,
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
import {circuitos, fase, linea, rondaEn, type Linea} from './linea';
import {BUENA, CAJAS, PARAMS} from './simulacion';

const SUELO = -3;
const ESFERA = esfera(16, 24);
const CILINDRO = cilindro(12);
const CUBO = cubo();
/** Cajas alrededor del enjambre, en el suelo de la isla. */
const POS_CAJAS: Vec3[] = CAJAS.map((_, j) => {
  const a = -Math.PI / 2 + ((j - 2) / 5) * Math.PI * 1.25 + Math.PI;
  return [Math.cos(a) * 6.2, SUELO + 0.65, Math.sin(a) * 4.2 - 1];
});
/** Abejas de adorno que revolotean alrededor del enjambre. */
const ABEJAS = 70;

// ── Cámara ────────────────────────────────────────────────────────────────────────────────────

type Toma = {objetivo: Vec3; distancia: number; azimut: number; elevacion: number; escala: number; centro: [number, number]};
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
  };
}

const conDeriva = (p: Plano, t: number): Toma =>
  p.quieta ? p.toma : {...p.toma, azimut: p.toma.azimut + 0.012 * (t - p.desde), escala: p.toma.escala * (1 + 0.004 * (t - p.desde))};

function tomaEn(t: number, planos: Plano[]): Toma {
  let i = 0;
  while (i + 1 < planos.length && t >= planos[i + 1].desde) i++;
  const actual = conDeriva(planos[i], t);
  const viaje = planos[i].viaje ?? 0;
  if (i === 0 || viaje <= 0 || t >= planos[i].desde + viaje) return actual;
  return mezclar(conDeriva(planos[i - 1], t), actual, entradaSalidaCubica((t - planos[i].desde) / viaje));
}

const PORTADA: Toma = {objetivo: [0, 0.2, 0], distancia: 16, azimut: 0, elevacion: 0.1, escala: 150, centro: [540, 560]};
const ENJAMBRE: Toma = {objetivo: [0, 0, 0], distancia: 16, azimut: 0.25, elevacion: 0.12, escala: 200, centro: [540, 760]};
const REINA: Toma = {objetivo: [0.2, -0.4, 0.6], distancia: 12, azimut: 0.35, elevacion: 0.1, escala: 330, centro: [540, 820]};
const ISLA: Toma = {objetivo: [0, -1.4, -1], distancia: 26, azimut: 0.1, elevacion: 0.6, escala: 74, centro: [540, 800]};
const ISLA_VOTO: Toma = {...ISLA, escala: 58, centro: [540, 560], azimut: 0.2};
const ISLA_CAJAS: Toma = {...ISLA, azimut: -0.25, elevacion: 0.5, escala: 78, centro: [540, 820]};

function planosDe(l: Linea): Plano[] {
  return [
    {desde: -1, toma: PORTADA, quieta: true},
    {desde: l.mapa, toma: ENJAMBRE, viaje: 1.6},
    {desde: l.reina, toma: REINA, viaje: 1.2},
    // "Unos cientos de exploradoras salen a buscar": corte a la isla (un viaje atravesaba una caja)
    {desde: l.exploradoras, toma: ISLA},
    {desde: l.asi, toma: ISLA_VOTO},
    {desde: l.isla, toma: ISLA_CAJAS},
    {desde: l.remate, toma: ENJAMBRE},
    {desde: l.remate + 0.01, toma: PORTADA, viaje: Math.max(0.5, l.fin - 0.6 - l.remate), quieta: true},
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

  // ── Piezas 3D ───────────────────────────────────────────────────────────────────────────────

  /** El enjambre: una nube colgante de esferas (negro tramado con la sombra en rosa). */
  function enjambre(): Objeto3D[] {
    const mat: Material = {tinta: 'k', sombra: 'a', tonos: [0.4, 1]};
    const bolas: [number, number, number, number][] = [
      [0, 0.9, 0, 0.95],
      [-0.55, 0.45, 0.2, 0.75],
      [0.6, 0.5, -0.1, 0.78],
      [0, 0.1, 0.35, 0.85],
      [-0.3, -0.45, -0.1, 0.7],
      [0.35, -0.4, 0.15, 0.68],
      [0, -0.95, 0, 0.5],
    ];
    return bolas.map(([x, y, z, r]) => ({malla: ESFERA, tr: {escala: [r, r * 0.95, r], pos: [x, y, z] as Vec3}, material: mat}));
  }

  /** La rama de la que cuelga (y un poste que la sostiene en la isla). */
  function rama(conPoste: boolean): Objeto3D[] {
    const mat: Material = {tinta: 'k', tonos: [0.5, 1]};
    const objetos: Objeto3D[] = [{malla: CILINDRO, tr: {escala: [0.13, 3.2, 0.13], rot: [0, 0, Math.PI / 2], pos: [0, 1.9, 0]}, material: mat}];
    if (conPoste) objetos.push({malla: CILINDRO, tr: {escala: [0.12, (1.9 - SUELO) / 2, 0.12], pos: [2.6, (1.9 + SUELO) / 2, 0]}, material: mat});
    return objetos;
  }

  /** Las cinco cajas: la buena en rosa, las regulares en azul. */
  function cajas(): Objeto3D[] {
    return POS_CAJAS.map((p, j) => ({
      malla: CUBO,
      tr: {escala: [0.62, 0.62, 0.62], pos: p},
      material: {tinta: j === BUENA ? 'a' : 'b', tonos: [0.25, 0.9], aristas: true} as Material,
    }));
  }

  /** Abejas de adorno: puntitos que revolotean alrededor del enjambre (cierran el loop exacto). */
  function abejas(c: Capas, cam: Camara) {
    const k = c.solido.k;
    k.fillStyle = cobertura(1);
    k.beginPath();
    for (let i = 0; i < ABEJAS; i++) {
      const vueltas = 2 + Math.floor(hash01(i, 3) * 4);
      const ang = hash01(i, 1) * Math.PI * 2 + (2 * Math.PI * vueltas * t) / l.fin;
      const R = 1.3 + hash01(i, 2) * 1.2;
      const y = -1 + hash01(i, 4) * 2.4 + 0.25 * Math.sin(ang * 3);
      const q = proyectar([Math.cos(ang) * R, y, Math.sin(ang) * R], cam);
      if (!q) continue;
      const r = Math.min(6, Math.max(2.5, 0.05 * q[3]));
      k.moveTo(q[0] + r * 1.4, q[1]);
      k.ellipse(q[0], q[1], r * 1.4, r, ang, 0, Math.PI * 2);
    }
    k.fill();
  }

  /** Retícula de la isla: cruces azules en el suelo. */
  function reticula(c: Capas, cam: Camara) {
    const b = c.solido.b;
    b.strokeStyle = cobertura(1);
    b.lineWidth = 2.5;
    b.beginPath();
    for (let i = -6; i <= 6; i++) for (let j = -5; j <= 4; j++) {
      const q = proyectar([i * 1.6, SUELO, j * 1.6], cam);
      if (!q) continue;
      const s = Math.max(4, Math.min(10, q[3] * 0.1));
      b.moveTo(q[0] - s, q[1]);
      b.lineTo(q[0] + s, q[1]);
      b.moveTo(q[0], q[1] - s * 0.6);
      b.lineTo(q[0], q[1] + s * 0.6);
    }
    b.stroke();
  }

  /** Letra de cada caja y su agujero de entrada. */
  function rotulosCajas(c: Capas, cam: Camara, conCalidad: boolean) {
    const k = c.solido.k;
    POS_CAJAS.forEach((p, j) => {
      const q = proyectar([p[0], p[1] + 0.95, p[2]], cam);
      if (!q) return;
      k.font = fuente(MONO, conCalidad ? 26 : 30, 700);
      k.textAlign = 'center';
      k.textBaseline = 'alphabetic';
      k.fillStyle = cobertura(1);
      k.fillText(conCalidad ? (j === BUENA ? 'buena' : 'regular') : CAJAS[j].nombre, q[0], q[1]);
    });
    k.textAlign = 'left';
  }

  /** Exploradoras en vuelo entre el enjambre y las cajas. `cuantas(j)` por caja. */
  function vuelos(c: Capas, cam: Camara, cuantas: (j: number) => number, rastro: boolean) {
    const k = c.solido.k;
    const origen: Vec3 = [0, 0, 0];
    if (rastro) {
      k.strokeStyle = cobertura(1);
      k.lineWidth = 2;
      k.setLineDash([5, 9]);
      k.beginPath();
      POS_CAJAS.forEach((p, j) => {
        if (cuantas(j) < 1) return;
        for (let s = 0; s <= 1.0001; s += 0.1) {
          const q = proyectar(arco(origen, p, s), cam);
          if (!q) continue;
          if (s === 0) k.moveTo(q[0], q[1]);
          else k.lineTo(q[0], q[1]);
        }
      });
      k.stroke();
      k.setLineDash([]);
    }
    k.fillStyle = cobertura(1);
    k.beginPath();
    POS_CAJAS.forEach((p, j) => {
      const n = Math.min(14, Math.round(cuantas(j)));
      for (let i = 0; i < n; i++) {
        const u = (t * 0.32 + hash01(j, i, 7)) % 1;
        const s = u < 0.5 ? u * 2 : 2 - u * 2; // ida y vuelta
        const q = proyectar(arco(origen, p, s), cam);
        if (!q) continue;
        const r = Math.min(6, Math.max(3, 0.06 * q[3]));
        k.moveTo(q[0] + r * 1.4, q[1]);
        k.ellipse(q[0], q[1], r * 1.4, r, 0, 0, Math.PI * 2);
      }
    });
    k.fill();
  }
  const arco = (a: Vec3, b: Vec3, s: number): Vec3 => [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s + Math.sin(Math.PI * s) * 1.6, a[2] + (b[2] - a[2]) * s];

  /** Escena 3D: enjambre (y la isla con sus cajas si `isla`). */
  function escena3D(c: Capas, toma: Toma, isla: boolean) {
    const cam = aCamara(toma);
    if (isla) reticula(c, cam);
    dibujar3D(c, [...rama(isla), ...enjambre(), ...(isla ? cajas() : [])], cam, {ambiente: 0.3});
    abejas(c, cam);
    return cam;
  }

  // ── El baile, sobre papel ───────────────────────────────────────────────────────────────────

  /** Panal: un círculo de celdas hexagonales finas. */
  function panal(c: Capas, cx: number, cy: number, R: number) {
    c.k.fillStyle = cobertura(0.12);
    trazarCirculoIrregular(c.k, cx, cy, R, 91);
    c.k.fill();
    const k = c.solido.k;
    k.save();
    trazarCirculoIrregular(k, cx, cy, R, 91);
    k.clip();
    k.strokeStyle = cobertura(1);
    k.lineWidth = 1.5;
    k.beginPath();
    const s = 26;
    for (let fila = -10; fila <= 10; fila++) for (let col = -10; col <= 10; col++) {
      const x = cx + col * s * 1.5;
      const y = cy + fila * s * Math.sqrt(3) + (col % 2 ? (s * Math.sqrt(3)) / 2 : 0);
      for (let v = 0; v <= 6; v++) {
        const a = (v / 6) * Math.PI * 2;
        const px = x + Math.cos(a) * s * 0.92;
        const py = y + Math.sin(a) * s * 0.92;
        if (v === 0) k.moveTo(px, py);
        else k.lineTo(px, py);
      }
    }
    k.stroke();
    k.restore();
    k.lineWidth = 4;
    k.strokeStyle = cobertura(1);
    trazarCirculoIrregular(k, cx, cy, R, 91);
    k.stroke();
  }

  /** Punto del ocho del baile en `s` (0…2: dos circuitos, el retorno alterna de lado). */
  function ocho(cx: number, cy: number, largo: number, ang: number, s: number): [number, number] {
    const u = s % 1;
    const lado = Math.floor(s) % 2 ? 1 : -1;
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    const x0 = cx - (ux * largo) / 2;
    const y0 = cy - (uy * largo) / 2;
    if (u < 0.45) {
      // Carrera de meneo: recta, con zigzag
      const v = u / 0.45;
      const zig = Math.sin(v * Math.PI * 14) * 9;
      return [x0 + ux * largo * v - uy * zig, y0 + uy * largo * v + ux * zig];
    }
    // Retorno en semicírculo desde la punta hasta el principio, una vez por cada lado
    const v = (u - 0.45) / 0.55;
    const a = ang + lado * Math.PI * v;
    return [cx + Math.cos(a) * (largo / 2), cy + Math.sin(a) * (largo / 2)];
  }

  /** Una bailarina: su ocho (trazado) y la abeja recorriéndolo. */
  function bailarina(c: Capas, cx: number, cy: number, tinta: 'a' | 'b', activa: number, velocidad: number) {
    const largo = 230;
    const ang = -Math.PI / 3;
    const s = c.solido[tinta];
    s.strokeStyle = cobertura(1);
    s.lineWidth = 6;
    s.setLineDash([5, 7]);
    s.beginPath();
    for (let i = 0; i <= 120; i++) {
      const [x, y] = ocho(cx, cy, largo, ang, (i / 120) * 2);
      if (i === 0) s.moveTo(x, y);
      else s.lineTo(x, y);
    }
    s.stroke();
    s.setLineDash([]);
    if (activa <= 0) return;
    const [x, y] = ocho(cx, cy, largo, ang, (t * velocidad) % 2);
    c[tinta].fillStyle = cobertura(1);
    c[tinta].beginPath();
    c[tinta].ellipse(x, y, 24, 15, ang, 0, Math.PI * 2);
    c[tinta].fill();
    const k = c.solido.k;
    k.lineWidth = 3;
    k.strokeStyle = cobertura(1);
    k.beginPath();
    k.ellipse(x, y, 24, 15, ang, 0, Math.PI * 2);
    k.stroke();
  }

  function escenaBaile(c: Capas) {
    const k = c.solido.k;
    const lados: [number, 'a' | 'b', string, number, number][] = [
      [300, 'a', 'caja C · buena', 1, l.bueno],
      [780, 'b', 'caja A · regular', CAJAS[0].calidad, l.regular],
    ];
    rotulo(c, 'esquema · el baile de las exploradoras', 90, 360, fase(t, l.baile, l.baile + 0.4), {tam: 26, tinta: 'b'});
    for (const [cx, tinta, nombre, calidad, desde] of lados) {
      panal(c, cx, 720, 205);
      const activa = salidaCubica(fase(t, desde - 0.3, desde + 0.2));
      // La regular baila a ratos (pocos circuitos); la buena, sin parar
      const pausa = tinta === 'b' && (t * 0.55) % 1 > 0.45 ? 0 : 1;
      bailarina(c, cx, 720, tinta, activa * pausa, tinta === 'a' ? 1.1 : 0.9);
      k.font = fuente(MONO, 28, 700);
      k.textAlign = 'center';
      k.textBaseline = 'alphabetic';
      k.fillStyle = cobertura(1);
      k.fillText(nombre, cx, 980);
      // Circuitos de esta vuelta: barra y lectura
      if (t >= desde - 0.3) {
        const {vuelta, valor} = circuitos(t, l, calidad);
        const ancho = (valor / 90) * 360 * activa;
        const barra = c.solido[tinta];
        barra.fillStyle = cobertura(1);
        barra.fillRect(cx - 180, 1030, ancho, 30);
        k.lineWidth = 3;
        k.strokeRect(cx - 180, 1030, 360, 30);
        k.textAlign = 'left';
        lectura(k, `vuelta ${vuelta} · circuitos`, String(valor), cx - 180, 1150, {tam: 46});
      }
    }
    k.textAlign = 'left';
  }

  // ── La votación: la isla arriba y las exploradoras en cada caja abajo ───────────────────────

  function escenaVoto(c: Capas) {
    const R = rondaEn(t, l);
    const r0 = Math.min(l.sim.rondas.length - 1, Math.floor(R));
    const r1 = Math.min(l.sim.rondas.length - 1, r0 + 1);
    const u = R - Math.floor(R);
    const val = (campo: 'comprometidas' | 'enCaja', j: number) => l.sim.rondas[r0][campo][j] * (1 - u) + l.sim.rondas[r1][campo][j] * u;
    const decidido = R >= (l.sim.ronda ?? Infinity) - 1e-6;
    const cam = escena3D(c, tomaEn(t, planos), true);
    vuelos(c, cam, (j) => val('comprometidas', j) / 4, true);
    rotulosCajas(c, cam, false);
    // Gráfico: exploradoras en cada caja, con la línea del quórum
    const k = c.solido.k;
    const y0 = 1340;
    const alto = 300;
    const tope = 22;
    const Y = (v: number) => y0 - (v / tope) * alto;
    recortarPapel(c, (ctx) => {
      ctx.beginPath();
      ctx.rect(40, y0 - alto - 60, 1000, alto + 120);
    });
    CAJAS.forEach((caja, j) => {
      const x = 170 + j * 170;
      const v = Math.min(tope, val('enCaja', j));
      const barra = c[j === BUENA ? 'a' : 'b'];
      barra.fillStyle = cobertura(decidido && j === BUENA ? 1 : 0.67);
      barra.fillRect(x - 45, Y(v), 90, y0 - Y(v));
      k.font = fuente(MONO, 28, 700);
      k.textAlign = 'center';
      k.textBaseline = 'alphabetic';
      k.fillStyle = cobertura(1);
      k.fillText(caja.nombre, x, y0 + 40);
    });
    k.strokeStyle = cobertura(1);
    k.lineWidth = 3;
    k.beginPath();
    k.moveTo(80, y0);
    k.lineTo(1000, y0);
    k.stroke();
    // Quórum
    const a = c.solido.a;
    a.strokeStyle = cobertura(1);
    a.lineWidth = 4;
    a.setLineDash([14, 10]);
    a.beginPath();
    a.moveTo(80, Y(PARAMS.quorum));
    a.lineTo(1000, Y(PARAMS.quorum));
    a.stroke();
    a.setLineDash([]);
    k.textAlign = 'left';
    k.font = fuente(MONO, 24, 700);
    k.fillText('exploradoras en cada caja', 80, y0 - alto - 22);
    a.font = fuente(MONO, 24, 700);
    a.fillStyle = cobertura(1);
    a.textAlign = 'right';
    a.fillText(`quórum: ${PARAMS.quorum}`, 1000, Y(PARAMS.quorum) - 12);
    a.textAlign = 'left';
    if (decidido) rotulo(c, 'quórum en C: se mudan', 480, y0 - alto - 110, fase(t, l.votacion - 0.3, l.votacion + 0.1), {tam: 30, tinta: 'a', desde: 'derecha', semilla: 44});
    rotulo(c, 'esquema · simulación de la votación', 90, 360, fase(t, l.asi, l.asi + 0.4), {tam: 26, tinta: 'b'});
  }

  // ── La revelación: plancha rosa con «4 DE 5» ────────────────────────────────────────────────

  function revelacion(c: Capas) {
    const tr = t - l.revelacion;
    fondoTinta(c, 'a');
    const e = salidaCubica(fase(tr, 0, 0.35));
    enNegativo(c, (ctx) => {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.font = fuente(TITULAR, 330);
      ctx.fillText('4', 70, 900);
      ctx.font = fuente(TITULAR, 130);
      ctx.fillText('DE 5', 330, 900);
      ctx.font = fuente(MONO, 34, 700);
      ctx.fillText('enjambres eligieron', 80, 990);
      ctx.fillText('la caja buena', 80, 1040);
      // Cinco cajas: cuatro marcadas
      for (let j = 0; j < 5; j++) {
        const x = 150 + j * 190;
        const y = 1210;
        ctx.lineWidth = 6;
        ctx.strokeRect(x - 55, y - 55, 110, 110);
        if (j < 4 && tr > 0.2 + j * 0.12) {
          ctx.beginPath();
          ctx.moveTo(x - 30, y);
          ctx.lineTo(x - 8, y + 25);
          ctx.lineTo(x + 35, y - 30);
          ctx.lineWidth = 12;
          ctx.stroke();
        }
      }
    });
    if (e > 0) {
      enNegativo(c, (ctx) => {
        trazarEstrella(ctx, 900, 560, 110 * e, 8, 5, 0.2, 0.22);
        ctx.fill();
      });
    }
    fuenteEnPantalla(c, 'Seeley y Buhrman, Behav. Ecol. Sociobiol. 49, 416 (2001)', 1);
  }

  useDibujo(ORDEN.sketch, (c) => {
    const k = c.solido.k;
    if (t >= l.baile && t < l.asi) escenaBaile(c);
    else if (t >= l.asi && t < l.isla) escenaVoto(c);
    else if (t >= l.revelacion && t < l.remate) revelacion(c);
    else {
      const toma = tomaEn(t, planos);
      const isla = t >= l.exploradoras && t < l.remate;
      const cam = escena3D(c, toma, isla);
      if (t >= l.exploradoras && t < l.baile) {
        // Las exploradoras salen a buscar: pocas al principio, hacia todas las cajas
        vuelos(c, cam, () => 2 + 6 * fase(t, l.exploradoras, l.baile), true);
        rotulosCajas(c, cam, false);
        lectura(k, 'exploradoras', 'unos cientos', 70, 1340, {tam: 56});
        rotulo(c, 'esquema · cinco huecos posibles', 90, 360, fase(t, l.exploradoras, l.exploradoras + 0.4), {tam: 26, tinta: 'b'});
      }
      if (t >= l.isla && t < l.revelacion) {
        // El experimento real: una caja buena y cuatro regulares
        vuelos(c, cam, (j) => (j === BUENA ? 8 : 2), false);
        rotulosCajas(c, cam, t >= l.cajas);
        fuenteEnPantalla(c, 'Seeley y Buhrman, Behav. Ecol. Sociobiol. 49, 416 (2001)', fase(t, l.isla, l.isla + 0.4));
        rotulo(c, 'Appledore, Maine · casi sin árboles', 90, 1150, fase(t, l.isla + 0.2, l.isla + 0.6), {tam: 30, tinta: 'b', semilla: 43});
      }
      if (t >= l.reina && t < l.exploradoras) {
        // La reina, dentro del enjambre: no decide
        const q = proyectar([0.15, -0.2, 0.95], cam);
        if (q) {
          c.a.fillStyle = cobertura(1);
          c.a.beginPath();
          c.a.ellipse(q[0], q[1], 0.3 * q[3], 0.16 * q[3], -0.3, 0, Math.PI * 2);
          c.a.fill();
          mira(k, q[0], q[1], 0.6 * q[3], fase(t, l.reina, l.reina + 0.45), t * 0.25, 4);
          rotulo(c, 'la reina: no decide', 560, 1180, fase(t, l.reina + 0.2, l.reina + 0.6), {tam: 32, tinta: 'a', desde: 'derecha', semilla: 33});
        }
      }
      if (t >= l.mapa && t < l.reina) {
        rotulo(c, 'esquema · un enjambre de unas 10 000 abejas', 90, 360, fase(t, l.mapa, l.mapa + 0.4), {tam: 26, tinta: 'b'});
      }
    }
    // El golpe de registro, solo en la revelación
    sacudirRegistro(c, t, [l.revelacion], 9, 0.12);
  });

  return null;
};

export default Sketch;
