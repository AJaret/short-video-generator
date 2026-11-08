// Muestrario del kit de motion graphics: cada pieza de la plantilla por separado, en el pulso de
// la música, para revisarlas antes de usarlas en un episodio. Composición "muestrario".
//
// Las piezas viven en la plantilla (@canal): fondos.ts, transiciones.ts, graficos.ts, cinetica.ts
// las entradas de <DatoImpacto> y el motor 3D (tres.ts). Aquí solo se combinan; la línea de tiempo está en linea.ts.
import React from 'react';
import {AbsoluteFill, Html5Audio, useCurrentFrame, useVideoConfig} from 'remotion';
import {
  cobertura,
  cubo,
  curva3D,
  dibujar3D,
  entradaSalidaCubica,
  giroAlPulso,
  mezclar,
  nudoToroidal,
  puntos3D,
  puntosEsfera,
  superficie,
  toro,
  type Camara,
  DatoImpacto,
  DURACION_PORTADA,
  enCirculo,
  enEspiral,
  enNegativo,
  enRejilla,
  estallido,
  fondoTinta,
  fuente,
  golpe,
  GuiaZonasSeguras,
  marcasRegistro,
  nubeParticulas,
  Numeracion,
  ondas,
  ORDEN,
  Portada,
  resolverTintas,
  RisoFilter,
  rotulo,
  salidaRebote,
  textoBarrido,
  textoLetras,
  TITULAR,
  tramo,
  Transiciones,
  trazarCirculoIrregular,
  trazarEstrella,
  trazarPoligonoIrregular,
  UTIL,
  useDibujo,
  type Capas,
} from '../canal';
import {
  ARMADO,
  ANILLOS_TORO,
  BARRIDO,
  GIROS_DESDE,
  LADOS_TORO,
  LEVANTAR,
  NUDO,
  CONFIG,
  DURACION_VUELO,
  ESTALLIDOS,
  escena,
  FORMAS,
  LETRAS,
  NEGRA,
  PULSO,
  ROTULOS,
  compas,
  TRANSICIONES,
  VUELOS,
} from './linea';

// Mezcla generada por scripts/sonido_muestrario.mjs (no se versiona); sin ella, el muestrario va mudo
const archivos = require.context('./', false, /^\.\/mezcla\.wav$/);
const cargada = archivos.keys().length ? (archivos(archivos.keys()[0]) as {default?: string} | string) : null;
const MEZCLA = cargada === null ? null : typeof cargada === 'string' ? cargada : (cargada.default ?? null);

const CX = UTIL.x + UTIL.w / 2;
const CY = 860;
const Y_ROTULO = UTIL.y + 120; // por debajo de la numeración

/** Rótulo de cada pieza: entra al empezar su escena. */
function rotuloEscena(capas: Capas, t: number, texto: string, desde: number, tinta: 'a' | 'b' = 'a') {
  rotulo(capas, texto, UTIL.x + 10, Y_ROTULO, tramo(t, desde, 0.4), {tam: 34, tinta});
}

// ── 01 · Fondo de tinta llena, formas y texto en negativo ─────────────────────────────────────
function fondos(capas: Capas, t: number) {
  fondoTinta(capas, 'b');
  rotuloEscena(capas, t, '01 · fondo de tinta llena', compas(1));
  // Titular en papel recortado sobre la tinta
  enNegativo(capas, (ctx) => {
    ctx.font = fuente(TITULAR, 200);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('TINTA', CX, 620);
    ctx.fillText('LLENA', CX, 820);
  });
  // Seis formas, una por tiempo, cayendo con rebote
  const pos: [number, number][] = [[CX - 290, 1060], [CX, 1060], [CX + 290, 1060], [CX - 290, 1330], [CX, 1330], [CX + 290, 1330]];
  FORMAS.forEach((t0, i) => {
    const q = tramo(t, t0, 0.3);
    if (q <= 0) return;
    // Aparece ya grande en el tiempo (el golpe visual cae en el tiempo, no dos fotogramas después)
    const s = 0.6 + 0.4 * salidaRebote(q, 2.2);
    const [x, y] = pos[i];
    const r = 105 * s;
    const giro = (1 - s) * 0.6;
    if (i === 4) {
      // Sobreimpresión: un círculo de tinta A sobre la B sale del multiply (#002284)
      capas.a.fillStyle = cobertura(1);
      trazarCirculoIrregular(capas.a, x, y, r, 40 + i);
      capas.a.fill();
      return;
    }
    enNegativo(capas, (ctx) => {
      if (i === 0) trazarCirculoIrregular(ctx, x, y, r, 40 + i);
      else if (i === 1) trazarPoligonoIrregular(ctx, x, y, r * 1.2, 4, 40 + i, Math.PI / 4 + giro);
      else if (i === 2) trazarPoligonoIrregular(ctx, x, y + r * 0.15, r * 1.25, 3, 40 + i, giro);
      else if (i === 3) trazarEstrella(ctx, x, y, r * 1.2, 8, 40 + i, giro);
      if (i === 5) {
        ctx.lineWidth = 26;
        trazarCirculoIrregular(ctx, x, y, r * 0.85, 40 + i);
        ctx.stroke();
      } else ctx.fill();
    });
  });
}

// ── 02 · Gráficos que laten ───────────────────────────────────────────────────────────────────
function graficos(capas: Capas, t: number) {
  rotuloEscena(capas, t, '02 · gráficos que laten', compas(3));
  ondas(capas.solido.b, CX, CY, t, PULSO, {radioMax: 560, grosor: 18, desde: compas(3), vida: 2.5});
  ESTALLIDOS.forEach((t0, k) => estallido(capas.solido.a, CX, CY, 430, tramo(t, t0, NEGRA * 1.6), {rayos: 14, semilla: 60 + k, giro: k * 0.2}));
  // Un núcleo que late en cada tiempo (más fuerte en el compás)
  const r = 95 * (1 + 0.16 * golpe(t, PULSO, 1, 0.12) + 0.12 * golpe(t, PULSO, 4, 0.2));
  capas.k.fillStyle = cobertura(1);
  trazarCirculoIrregular(capas.k, CX, CY, r, 70);
  capas.k.fill();
  // Estrellas pequeñas que se encienden a contratiempo
  const lugares: [number, number][] = [[CX - 330, CY - 420], [CX + 320, CY - 330], [CX - 300, CY + 380], [CX + 340, CY + 430]];
  const j = Math.floor((t - NEGRA / 2) / NEGRA); // contratiempo vigente
  const q = tramo(t, j * NEGRA + NEGRA / 2, NEGRA * 0.6);
  lugares.forEach(([x, y], i) => {
    if (((j % 4) + 4) % 4 !== i) return;
    capas.solido.a.fillStyle = cobertura(1);
    trazarEstrella(capas.solido.a, x, y, 46 * salidaRebote(Math.min(1, q * 2), 2) * (1 - q * 0.6), 5, 80 + i, q);
    capas.solido.a.fill();
  });
}

// ── 03 · Tipografía cinética ──────────────────────────────────────────────────────────────────
function tipografia(capas: Capas, t: number) {
  rotuloEscena(capas, t, '03 · tipografía cinética', compas(5));
  const k = capas.solido.k;
  k.font = fuente(TITULAR, 150);
  k.textAlign = 'center';
  k.textBaseline = 'middle';
  const semi = NEGRA / 4;
  textoLetras(k, 'LETRA', CX, 520, t, LETRAS.inicio, PULSO);
  textoLetras(k, 'A LETRA', CX, 680, t, LETRAS.inicio + 5 * semi, PULSO);
  k.font = fuente(TITULAR, 150);
  const ancho = k.measureText(BARRIDO.texto).width;
  textoBarrido(capas, k, BARRIDO.texto, CX - ancho / 2, 900, tramo(t, BARRIDO.inicio, NEGRA), {alto: 150, tinta: 'a'});
  ROTULOS.forEach((r, i) => rotulo(capas, r.texto, i % 2 ? UTIL.x + 300 : UTIL.x + 20, 1110 + i * 110, tramo(t, r.t, 0.45), {desde: i % 2 ? 'derecha' : 'izquierda', tinta: 'b', semilla: 90 + i}));
}

// ── 04 · Nube de partículas ───────────────────────────────────────────────────────────────────
const N = 89;
const circulo = enCirculo(CX, CY + 40, 320);
const rejilla = enRejilla(CX, CY + 40, 9, 66);
const espiral = enEspiral(CX, CY + 40, 36);

function particulas(capas: Capas, t: number) {
  fondoTinta(capas, 'a');
  rotuloEscena(capas, t, '04 · nube de partículas', compas(7), 'b');
  const tam = 18 + 8 * golpe(t, PULSO, 1, 0.1);
  const ctx = capas.solido.b;
  const p = (i: number) => tramo(t, VUELOS[i], DURACION_VUELO);
  if (t < VUELOS[1]) nubeParticulas(ctx, N, p(0), circulo, {tam, semilla: 7});
  else if (t < VUELOS[2]) nubeParticulas(ctx, N, p(1), rejilla, {tam, semilla: 7, desde: circulo});
  else nubeParticulas(ctx, N, p(2), espiral, {tam, semilla: 7, desde: rejilla});
}

// ── 05 · Datos de impacto (los dibuja <DatoImpacto>); fondo de medio tono ─────────────────────
function impactos(capas: Capas, t: number) {
  fondoTinta(capas, 'b', {trama: true, cobertura: 0.34});
  rotuloEscena(capas, t, '05 · datos de impacto', compas(9));
}

// ── 06 · 3D: un plano que se levanta ──────────────────────────────────────────────────────────
const RAD = Math.PI / 180;

function plano3D(capas: Capas, t: number) {
  rotuloEscena(capas, t, '06 · 3D: de plano a volumen', compas(12));
  const k = entradaSalidaCubica(tramo(t, LEVANTAR.desde, LEVANTAR.hasta - LEVANTAR.desde));
  // Las ondas avanzan un cuarto de vuelta en cada tiempo (a saltos, en el pulso)
  const fase = giroAlPulso(t, PULSO, {desde: compas(12), frenado: 0.35});
  const alto = mezclar(0.55, 1, k);
  const malla = superficie((x, z) => {
    const r = Math.hypot(x, z);
    return alto * 0.17 * Math.cos(9 * r - fase) * Math.exp(-1.2 * r);
  }, 34);
  const camara: Camara = {distancia: 9, azimut: mezclar(0, 0.65, k), elevacion: mezclar(89, 27, k) * RAD, fov: 30 * RAD, centro: [CX, CY + 60]};
  dibujar3D(capas, [{malla, tr: {escala: 2}, material: {tinta: 'b', sombra: 'a', tonos: [0.2, 1]}}], camara, {
    // Luz rasante desde la izquierda: las ondas se leen por su sombra, también vistas desde arriba
    luz: [-0.85, 0.45, -0.3],
    ambiente: 0.1,
    niebla: 0.3,
  });
}

// ── 07 · 3D: sólidos que se arman y giran al pulso ────────────────────────────────────────────
const CUBO = cubo();
const TORO = toro(1, 0.38, ANILLOS_TORO, LADOS_TORO);

function solidos3D(capas: Capas, t: number) {
  rotuloEscena(capas, t, '07 · sólidos al pulso', compas(14));
  const giroCubo = giroAlPulso(t, PULSO, {desde: GIROS_DESDE});
  const giroToro = giroAlPulso(t, PULSO, {desde: GIROS_DESDE, division: 4, frenado: 0.45});
  const camara: Camara = {distancia: 8.5, azimut: 0.35 + 0.06 * (t - compas(14)), elevacion: 0.28, centro: [CX, CY + 40]};
  dibujar3D(
    capas,
    [
      {
        malla: TORO,
        tr: {pos: [0, -1.25, 0], rot: [0.95 + giroToro, 0.3 * (t - compas(14)), 0], escala: 1.05},
        material: {tinta: 'a', sombra: 'b', tonos: [0.1, 1]},
        armado: (i) => tramo(t, ARMADO.toro + Math.floor(i / LADOS_TORO / ARMADO.anillosPorPaso) * ARMADO.semi, 0.25),
      },
      {
        malla: CUBO,
        tr: {pos: [0, 1.2, 0], rot: [0.55, giroCubo + 0.4, 0], escala: 0.72},
        material: {tinta: 'b', sombra: 'a', aristas: true},
        armado: (i) => tramo(t, ARMADO.cubo + i * ARMADO.semi, 0.22),
      },
    ],
    camara,
  );
}

// ── 08 · 3D: curvas y nubes de puntos ─────────────────────────────────────────────────────────
const NUDO_23 = nudoToroidal(2, 3, 420, 1.2, 0.5);
const ESFERA_PUNTOS = puntosEsfera(240);

function curvas3D(capas: Capas, t: number) {
  rotuloEscena(capas, t, '08 · curvas y puntos 3D', compas(16));
  const salto = giroAlPulso(t, PULSO, {desde: NUDO.giros, division: 2, paso: Math.PI / 3, frenado: 0.4});
  const lento = 0.35 * (t - NUDO.desde);
  const camara: Camara = {distancia: 8, azimut: 0, elevacion: 0.3, centro: [CX, CY + 40]};
  puntos3D(capas, ESFERA_PUNTOS, camara, {tr: {rot: [0.3, -lento - salto / 2, 0], escala: 2.3}, tam: 0.07, cerca: 'k', lejos: 'b'});
  curva3D(capas, NUDO_23, camara, {
    tr: {rot: [1.0, lento + salto, 0.2]},
    grosor: 0.1,
    cerca: 'a',
    lejos: 'b',
    hasta: tramo(t, NUDO.desde, NUDO.traza),
    cerrada: true,
  });
}

// ── Portada: fotograma clave ──────────────────────────────────────────────────────────────────
function portada(capas: Capas) {
  estallido(capas.solido.a, CX, CY - 40, 470, 0.42, {rayos: 14, semilla: 61});
  capas.b.fillStyle = cobertura(1);
  trazarEstrella(capas.b, CX, CY - 40, 230, 8, 12, 0.2);
  capas.b.fill();
  capas.k.fillStyle = cobertura(1);
  trazarCirculoIrregular(capas.k, CX, CY - 40, 80, 70);
  capas.k.fill();
}

const Lienzo: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  useDibujo(ORDEN.sketch, (capas) => {
    const t = frame / fps;
    const e = escena(t);
    if (e === 0) portada(capas);
    else if (e === 1) fondos(capas, t);
    else if (e === 2) graficos(capas, t);
    else if (e === 3) tipografia(capas, t);
    else if (e === 4) particulas(capas, t);
    else if (e === 5) impactos(capas, t);
    else if (e === 6) plano3D(capas, t);
    else if (e === 7) solidos3D(capas, t);
    else curvas3D(capas, t);
    if (e >= 2 || t < DURACION_PORTADA) marcasRegistro(capas);
  });
  return null;
};

const TINTAS = resolverTintas(CONFIG.tintas);

export const Muestrario: React.FC<{guias: boolean}> = ({guias}) => (
  <AbsoluteFill>
    <RisoFilter tintas={TINTAS} semilla={CONFIG.semilla} pulso={PULSO}>
      <Lienzo />
      <Transiciones lista={TRANSICIONES} pulso={PULSO} />
      <DatoImpacto impactos={CONFIG.impactos ?? []} tiempos={null} progresoPanel={0} pulso={PULSO} />
      <Numeracion numero={CONFIG.numero} desde={DURACION_PORTADA} />
      <Portada numero={CONFIG.numero} tema={CONFIG.tema} titulo={CONFIG.titulo} />
    </RisoFilter>
    <GuiaZonasSeguras visible={guias} />
    {MEZCLA ? <Html5Audio src={MEZCLA} /> : null}
  </AbsoluteFill>
);
