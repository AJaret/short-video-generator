// Muestrario · banda sonora: la música del canal y los efectos de cada pieza, en el pulso.
// Sin voz (se pasa silencio a construirBanda). La genera scripts/sonido_muestrario.mjs.
//
//   · 01 formas: un tic por forma, subiendo por la pentatónica de La menor.
//   · Transiciones: papel en los barridos, tic grave en el iris, Shepard en la trama; impresora en cada corte.
//   · 02 gráficos: tic grave suave en cada onda, campanita en cada estallido.
//   · 03 tipografía: un tic por letra (sube), papel en el barrido, tics en los rótulos.
//   · 04 partículas: escalera de Shepard en semicorcheas durante cada vuelo.
//   · 05 impactos: el sello lo pone la plantilla; tics por letra en el impacto "letras", papel en el barrido.
//   · 06 plano 3D: tic grave en cada salto de las ondas; Shepard en corcheas mientras se levanta.
//   · 07 sólidos: un tic por pieza al armarse (sube); golpe grave en cada giro del cubo, más agudo en el del toro.
//   · 08 curvas: Shepard en corcheas mientras se traza el nudo; un tic en cada salto de giro.
import {momentosLetras} from '../canal/cinetica';
import {corteDe, duracionTransicion} from '../canal/transiciones';
import {construirBanda, type EventoSonoro} from '../sonido/banda';
import {hz} from '../sonido/sintesis';
import {ARMADO, GIROS_DESDE, LEVANTAR, NUDO, BARRIDO, compas, CONFIG, DURACION, DURACION_VUELO, ESTALLIDOS, FORMAS, LETRAS, NEGRA, PULSO, ROTULOS, TIEMPOS, TRANSICIONES, VUELOS} from './linea';

const PENTATONICA = [0, 3, 5, 7, 10];
const grado = (k: number) => PENTATONICA[k % 5] + 12 * Math.floor(k / 5);

function eventos(): EventoSonoro[] {
  const lista: EventoSonoro[] = [];
  FORMAS.forEach((t, i) => lista.push({t, frecuencia: hz(grado(i)), volumenDb: -4, duracion: 0.22, brillo: 0.5, pan: i % 2 ? 0.3 : -0.3}));

  for (const tr of TRANSICIONES) {
    if (tr.tipo === 'barrido') lista.push({t: tr.t, frecuencia: 0, volumenDb: -6, efecto: 'papel'});
    if (tr.tipo === 'iris') lista.push({t: tr.t, frecuencia: hz(-12), volumenDb: -6, duracion: 0.5, brillo: 0.2});
    if (tr.tipo === 'trama') {
      const d = duracionTransicion(tr, PULSO);
      for (let k = 0; k * NEGRA * 0.25 < d - 1e-6; k++) lista.push({t: tr.t + k * NEGRA * 0.25, frecuencia: k, volumenDb: -14 + k, duracion: 0.08, shepard: true});
    }
    lista.push({t: corteDe(tr, PULSO) - 0.05, frecuencia: 0, volumenDb: -8, efecto: 'impresora'});
  }

  for (let t = compas(3); t < compas(5) - NEGRA - 1e-6; t += NEGRA) lista.push({t, frecuencia: hz(-17), volumenDb: -10, duracion: 0.3, brillo: 0.15});
  ESTALLIDOS.forEach((t) => lista.push({t, frecuencia: hz(15), volumenDb: -6, duracion: 0.5, brillo: 0.8}));

  momentosLetras(LETRAS.texto, LETRAS.inicio, PULSO).forEach((t, i) => lista.push({t, frecuencia: hz(grado(i)), volumenDb: -8, duracion: 0.08, brillo: 0.4}));
  lista.push({t: BARRIDO.inicio, frecuencia: 0, volumenDb: -6, efecto: 'papel'});
  ROTULOS.forEach((r, i) => lista.push({t: r.t, frecuencia: hz(i ? 10 : 7), volumenDb: -8, duracion: 0.12, brillo: 0.5, pan: i ? 0.4 : -0.4}));

  VUELOS.forEach((t0) => {
    for (let k = 0; k * NEGRA * 0.25 < DURACION_VUELO - 1e-6; k++) lista.push({t: t0 + k * NEGRA * 0.25, frecuencia: k * 2, volumenDb: -12, duracion: 0.08, shepard: true});
  });

  const [, letras, barrido] = CONFIG.impactos ?? [];
  if (letras?.desde !== undefined) {
    momentosLetras(letras.texto.toUpperCase(), letras.desde, PULSO).forEach((t, i) => lista.push({t, frecuencia: hz(grado(i + 3)), volumenDb: -8, duracion: 0.08, brillo: 0.4}));
  }
  if (barrido?.desde !== undefined) lista.push({t: barrido.desde, frecuencia: 0, volumenDb: -6, efecto: 'papel'});

  // 06 · Plano 3D
  for (let t = compas(12); t < compas(14) - NEGRA - 1e-6; t += NEGRA) lista.push({t, frecuencia: hz(-17), volumenDb: -10, duracion: 0.3, brillo: 0.15});
  for (let k = 0, t = LEVANTAR.desde; t < LEVANTAR.hasta - 1e-6; k++, t += NEGRA / 2) lista.push({t, frecuencia: k, volumenDb: -14 + k * 0.6, duracion: 0.09, shepard: true});

  // 07 · Sólidos
  for (let i = 0; i < 6; i++) lista.push({t: ARMADO.cubo + i * ARMADO.semi, frecuencia: hz(grado(i + 2)), volumenDb: -8, duracion: 0.08, brillo: 0.45});
  for (let k = 0; k < 8; k++) lista.push({t: ARMADO.toro + k * ARMADO.semi, frecuencia: hz(grado(k + 5)), volumenDb: -10, duracion: 0.08, brillo: 0.5, pan: k % 2 ? 0.3 : -0.3});
  for (let b = 0, t = GIROS_DESDE; t < compas(16) - 1e-6; b++, t += NEGRA) {
    const compasEntero = b % 4 === 0;
    lista.push({t, frecuencia: hz(compasEntero ? -5 : -12), volumenDb: compasEntero ? -5 : -9, duracion: 0.25, brillo: compasEntero ? 0.5 : 0.2});
  }

  // 08 · Curvas y puntos
  for (let k = 0, t = NUDO.desde; t < NUDO.desde + NUDO.traza - 1e-6; k++, t += NEGRA / 2) lista.push({t, frecuencia: k * 2, volumenDb: -13, duracion: 0.08, shepard: true});
  for (let t = NUDO.giros; t < compas(18) - 1e-6; t += NEGRA * 2) lista.push({t, frecuencia: hz(7), volumenDb: -9, duracion: 0.2, brillo: 0.5});
  return lista;
}

export function bandaMuestrario() {
  const sr = 24000;
  const voz = {sr, datos: new Float32Array(Math.ceil(sr * DURACION))};
  return construirBanda({config: CONFIG, tiempos: TIEMPOS, voz, eventos});
}
