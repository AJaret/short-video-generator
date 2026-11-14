// nº08 · Sonido propio, con la misma línea de tiempo que la animación (linea.ts). Las notas suman
// `tono` (la tonalidad de la música del episodio) y van en la pentatónica menor.
//   · Las 36 ciudades: una nota por ciudad, subiendo (una por fusa).
//   · "¿Cómo las unirías?": papel. El moho en Tokio: una nota grave que crece.
//   · Sin cerebro, sin planos, sin ingenieros: tres notas que bajan.
//   · Lo cubrió todo: Shepard hacia arriba; la poda: Shepard hacia abajo (se van tubos).
//   · Las cifras: una nota por fila; la rotura: golpe grave.
//   · El truco: notas cortas del flujo en corcheas.
//   · Cortes de escena: aire que llega al corte e impresora riso.
import type {ContextoSonido, EventoSonoro} from '@sonido/banda';
import {cuantizar} from '@canal/pulso';
import {hz} from '@sonido/sintesis';
import {cortes, linea, momentosCiudades} from './linea';

const FPS = 30;
const PENTA = [0, 3, 5, 7, 10];
const penta = (k: number) => 12 * Math.floor(k / 5) + PENTA[((k % 5) + 5) % 5];

export function eventos({tiempos, duracion, pulso, tono}: ContextoSonido): EventoSonoro[] {
  const notas: EventoSonoro[] = [];
  const fin = (Math.ceil(duracion * FPS) - 1) / FPS;
  const l = linea(tiempos, fin);
  const semi = pulso.negra / 4;
  const shepard = (desde: number, hasta: number, sube: boolean, db = -17) => {
    for (let k = 0, s = cuantizar(desde, pulso, 0.25, 'siguiente'); s < hasta; k++, s += semi) {
      notas.push({t: s, frecuencia: tono + (sube ? penta(k) : -penta(k)), shepard: true, volumenDb: db, duracion: 0.08});
    }
  };

  momentosCiudades(l, pulso).forEach((t, i) => notas.push({t, frecuencia: hz(tono + penta(Math.floor(i / 2))), volumenDb: -19, duracion: 0.07, brillo: 0.5, pan: (i % 2 ? 0.3 : -0.3)}));
  notas.push({t: l.unirias, frecuencia: 0, volumenDb: -15, efecto: 'papel'});
  notas.push({t: cuantizar(l.soltaron + 0.4, pulso, 0.5), frecuencia: hz(tono - 24), volumenDb: -10, duracion: 0.6, brillo: 0.2});
  [l.sinCerebro, l.sinPlanos, l.sinIngenieros].forEach((t, i) => notas.push({t: cuantizar(t, pulso, 0.5), frecuencia: hz(tono + 12 - penta(i * 2)), volumenDb: -13, duracion: 0.18, brillo: 0.5}));
  shepard(l.primero, l.despues - 0.1, true);
  shepard(l.despues, l.gruesos + 0.4, false, -18);
  [l.costo, l.eficiencia].forEach((t, i) => notas.push({t: cuantizar(t, pulso, 0.5), frecuencia: hz(tono + 7 + 5 * i), volumenDb: -12, duracion: 0.2, brillo: 0.5}));
  notas.push({t: cuantizar(l.rompe, pulso, 0.5), frecuencia: hz(tono - 24), volumenDb: -8, duracion: 0.5, brillo: 0.2});
  for (let k = 0, s = cuantizar(l.truco + 0.3, pulso, 0.5, 'siguiente'); s < l.desaparece + 0.3; k++, s += pulso.negra / 2) {
    notas.push({t: s, frecuencia: hz(tono + penta(k % 8)), volumenDb: -18, duracion: 0.08, brillo: 0.4, pan: k % 2 ? 0.4 : -0.4});
  }
  for (const t of cortes(l)) {
    notas.push({t, frecuencia: 0, volumenDb: -16, efecto: 'barrido', duracion: pulso.negra});
    notas.push({t, frecuencia: 0, volumenDb: -14, efecto: 'impresora', pan: 0.3});
  }
  return notas;
}
