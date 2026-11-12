// nº06 · Sonido propio, con la misma línea de tiempo que la animación (linea.ts). Las notas suman
// `tono` (la tonalidad de la música del episodio) y van en la pentatónica menor.
//   · El fuego de cerca: una nota por paso (corcheas), subiendo.
//   · El fuego rápido: una escalera de Shepard en semicorcheas mientras avanza (la tensión sube sin
//     volverse chillona); si se ahoga, una nota grave; si cruza, un acorde arriba.
//   · Portada: el fuego ya sube (gancho), con su escalera de Shepard.
//   · Gráfica: una nota en 57 % (grave) y otra en 61 % (aguda); al terminar de arder cada fila de
//     bosques miniatura, grave (57 %: casi todos se apagan) o acorde (61 %: casi todos cruzan).
//   · Los gemelos: el de 57 % se apaga (grave) y el de 61 % cruza (acorde) en "todo cambia de golpe".
//   · Cortes de escena: aire que llega al corte e impresora riso.
import type {ContextoSonido, EventoSonoro} from '@sonido/banda';
import {cuantizar} from '@canal/pulso';
import {hz} from '@sonido/sintesis';
import {ARDOR_MINIS, cortes, gemelos, linea, pasoEn} from './linea';
import {DURACION_PORTADA} from '@canal/diseno';

const FPS = 30;
const PENTA = [0, 3, 5, 7, 10];
const penta = (k: number) => 12 * Math.floor(k / 5) + PENTA[((k % 5) + 5) % 5];

export function eventos({tiempos, duracion, pulso, tono}: ContextoSonido): EventoSonoro[] {
  const notas: EventoSonoro[] = [];
  const fin = (Math.ceil(duracion * FPS) - 1) / FPS;
  const l = linea(tiempos, fin);
  const semi = pulso.negra / 4;
  const acorde = (t: number) => [12, 15, 19].forEach((n, i) => notas.push({t: t + i * 0.03, frecuencia: hz(tono + n), volumenDb: -12, duracion: 0.35, brillo: 0.55, pan: (i - 1) * 0.4}));
  const apagado = (t: number) => notas.push({t, frecuencia: hz(tono - 24), volumenDb: -9, duracion: 0.5, brillo: 0.2});

  // Portada: el fuego sube a toda velocidad
  for (let k = 0, s = cuantizar(0.12, pulso, 0.25, 'siguiente'); s < DURACION_PORTADA - 0.2; k++, s += semi) {
    notas.push({t: s, frecuencia: tono + penta(k), shepard: true, volumenDb: -19, duracion: 0.07});
  }

  // Chispas: empieza el incendio
  notas.push({t: l.incendio, frecuencia: 0, volumenDb: -15, efecto: 'papel'});

  // 55 % de cerca: una nota por paso (cada vez que el paso cambia)
  let previo = 0;
  for (let f = Math.ceil(l.vecino * FPS); f < l.con55 * FPS; f++) {
    const p = Math.floor(pasoEn(f / FPS, l, pulso, '55'));
    if (p > previo) notas.push({t: f / FPS, frecuencia: hz(tono - 12 + penta(p)), volumenDb: -11, duracion: 0.16, brillo: 0.45});
    previo = Math.max(previo, p);
  }
  // Fuego rápido: Shepard en semicorcheas
  const shepard = (desde: number, hasta: number) => {
    for (let k = 0, s = cuantizar(desde, pulso, 0.25, 'siguiente'); s < hasta; k++, s += semi) {
      notas.push({t: s, frecuencia: tono + penta(k), shepard: true, volumenDb: -16, duracion: 0.08});
    }
  };
  shepard(l.con55, l.ahoga + 0.2);
  apagado(cuantizar(l.ahoga + 0.3, pulso, 0.5));
  shepard(l.con65 + 0.1, l.medio - 0.3);
  acorde(cuantizar(l.medio - 0.3, pulso, 0.5));

  // Gráfica
  notas.push({t: cuantizar(l.c57, pulso, 0.5), frecuencia: hz(tono - 12), volumenDb: -12, duracion: 0.25, brillo: 0.3});
  notas.push({t: cuantizar(l.c61, pulso, 0.5), frecuencia: hz(tono + 12), volumenDb: -12, duracion: 0.25, brillo: 0.6});
  apagado(cuantizar(l.c57 + ARDOR_MINIS, pulso, 0.5));
  acorde(cuantizar(l.c61 + ARDOR_MINIS, pulso, 0.5));

  // 59 %: cruza por un camino estrecho
  shepard(l.justo + 0.1, l.estrechito + 0.4);
  acorde(cuantizar(l.estrechito + 0.4, pulso, 0.5));

  // Gemelos: el de 57 % se apaga antes; el de 61 % cruza en "todo cambia de golpe"
  const gem = gemelos();
  const inicio = l.fisicos + 0.6;
  const final = l.golpe + 0.2;
  shepard(inicio, final);
  apagado(cuantizar(inicio + (gem.b57.total / gem.b61.total) * (final - inicio), pulso, 0.5));
  acorde(cuantizar(final, pulso, 0.5));

  // Cortes de escena
  for (const t of cortes(l)) {
    notas.push({t, frecuencia: 0, volumenDb: -16, efecto: 'barrido', duracion: pulso.negra});
    notas.push({t, frecuencia: 0, volumenDb: -14, efecto: 'impresora', pan: 0.3});
  }
  return notas;
}
