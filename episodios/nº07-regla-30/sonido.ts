// nº07 · Sonido propio, con la misma línea de tiempo que la animación (linea.ts). Las notas suman
// `tono` (la tonalidad de la música del episodio) y van en la pentatónica menor.
//   · La concha se vuelve a pintar: impresora riso (el borde que crece).
//   · Cada casilla nueva que se decide: una nota (aguda si sale negra, grave si sale blanca).
//   · Los 8 casos: una nota por caso, la altura según su respuesta; "Regla 30": acorde.
//   · Desde un punto: una nota por fila lenta y una escalera de Shepard cuando salen cientos.
//   · La columna del centro: cada bit se oye, 1 agudo y 0 grave (el "azar" suena).
//   · Bajando por la columna: Shepard hacia abajo.
//   · Cortes de escena: aire que llega al corte e impresora riso.
import type {ContextoSonido, EventoSonoro} from '@sonido/banda';
import {cuantizar} from '@canal/pulso';
import {hz} from '@sonido/sintesis';
import {
  CASILLAS_FILA,
  columnaCentral,
  cortes,
  desdePunto,
  escaneo,
  filasPunto,
  linea,
  momentosBits,
  momentosCasos,
  RESPUESTAS,
} from './linea';

const FPS = 30;
const PENTA = [0, 3, 5, 7, 10];
const penta = (k: number) => 12 * Math.floor(k / 5) + PENTA[((k % 5) + 5) % 5];

export function eventos({tiempos, duracion, pulso, tono}: ContextoSonido): EventoSonoro[] {
  const notas: EventoSonoro[] = [];
  const fin = (Math.ceil(duracion * FPS) - 1) / FPS;
  const l = linea(tiempos, fin);
  const semi = pulso.negra / 4;
  const muestra = desdePunto(20);
  const centro = Math.floor(muestra.ancho / 2);

  // La concha se pinta de nuevo, fila a fila
  notas.push({t: l.borde + 0.2, frecuencia: 0, volumenDb: -13, efecto: 'impresora'});

  // Cada casilla nueva
  const esc = escaneo(l, pulso);
  for (let i = 0; i < CASILLAS_FILA; i++) {
    const negra = muestra.celdas[8 * muestra.ancho + centro - 7 + i];
    notas.push({t: esc.momento(i), frecuencia: hz(tono + (negra ? 12 : 0) + PENTA[i % 5]), volumenDb: -13, duracion: 0.1, brillo: negra ? 0.6 : 0.3, pan: (i / (CASILLAS_FILA - 1) - 0.5) * 1.2});
  }
  // Los 8 casos
  momentosCasos(l, pulso).forEach((t, k) => {
    notas.push({t, frecuencia: hz(tono + (RESPUESTAS[k] ? 12 + penta(k) : penta(k))), volumenDb: -12, duracion: 0.16, brillo: 0.5, pan: ((k % 4) / 3 - 0.5) * 1.2});
  });
  // "Esa es la Regla treinta"
  const esa = cuantizar(l.esa + 0.6, pulso, 0.5);
  [12, 15, 19].forEach((n, i) => notas.push({t: esa + i * 0.03, frecuencia: hz(tono + n), volumenDb: -12, duracion: 0.35, brillo: 0.55, pan: (i - 1) * 0.4}));

  // Desde un punto: una nota por fila lenta; Shepard cuando salen cientos
  let previo = 0;
  for (let f = Math.ceil(l.empezamos * FPS); f < l.salen * FPS; f++) {
    const n = Math.floor(filasPunto(f / FPS, l, pulso));
    if (n > previo) notas.push({t: f / FPS, frecuencia: hz(tono - 12 + penta(n)), volumenDb: -11, duracion: 0.14, brillo: 0.45});
    previo = Math.max(previo, n);
  }
  for (let k = 0, s = cuantizar(l.salen, pulso, 0.25, 'siguiente'); s < l.conchaDos + 0.2; k++, s += semi) {
    notas.push({t: s, frecuencia: tono + penta(k), shepard: true, volumenDb: -16, duracion: 0.08});
  }

  // La columna del centro: se oyen los bits
  const mb = momentosBits(l, pulso);
  const bits = columnaCentral(desdePunto(mb.n + 2), mb.n);
  bits.forEach((b, i) => {
    notas.push({t: mb.desde + i * mb.semi, frecuencia: hz(tono + (b ? 19 : 7)), volumenDb: -17, duracion: 0.07, brillo: b ? 0.6 : 0.3, pan: b ? 0.3 : -0.3});
  });

  // Bajando por la columna: Shepard hacia abajo
  for (let k = 0, s = cuantizar(l.premio + 0.4, pulso, 0.25, 'siguiente'); s < l.caracol - 0.3; k++, s += semi) {
    notas.push({t: s, frecuencia: tono - penta(k), shepard: true, volumenDb: -19, duracion: 0.08});
  }

  // Cortes de escena
  for (const t of cortes(l)) {
    notas.push({t, frecuencia: 0, volumenDb: -16, efecto: 'barrido', duracion: pulso.negra});
    notas.push({t, frecuencia: 0, volumenDb: -14, efecto: 'impresora', pan: 0.3});
  }
  return notas;
}
