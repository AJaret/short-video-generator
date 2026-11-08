// Muestrario del kit de motion graphics: cada pieza de la plantilla por separado, en el pulso de
// la música, para revisarlas antes de usarlas en un episodio. Composición "muestrario".
//
// Las piezas viven en la plantilla (@canal): fondos.ts, transiciones.ts, graficos.ts, cinetica.ts
// y las entradas de <DatoImpacto>. Aquí solo se combinan; la línea de tiempo está en linea.ts.
import React from 'react';
import {AbsoluteFill, Html5Audio, useCurrentFrame, useVideoConfig} from 'remotion';
import {
  cobertura,
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
  BARRIDO,
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
    else impactos(capas, t);
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
