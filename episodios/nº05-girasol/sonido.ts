// nº05 · Sonido propio, con la misma línea de tiempo que la animación (linea.ts). Todas las notas
// suman `tono` (la tonalidad de la música del episodio) y van en la pentatónica menor.
//   · Espirales: una nota cada dos espirales, subiendo; las rosas a la izquierda, las azules (más
//     graves) a la derecha. Cuando vuelven "solas" con el ángulo de oro, suben las dos a la vez.
//   · Crecimiento: cada semilla lenta es una nota que sube; las cientos rápidas, una escalera de
//     Shepard en semicorcheas ("cada vez más" sin volverse chillona).
//   · Papel cuando las semillas se recogen ("nadie") y cuando el ángulo cambia (135°, 137°).
//   · Estudio: una nota por girasol que aparece; el de Lucas, más grave.
//   · Cortes de escena: aire que llega al corte e impresora riso.
import type {ContextoSonido, EventoSonoro} from '@sonido/banda';
import {cuantizar} from '@canal/pulso';
import {hz} from '@sonido/sintesis';
import {cortes, crecimiento, espirales, ESTUDIO, linea, momentosEstudio} from './linea';

const FPS = 30;
const PENTA = [0, 3, 5, 7, 10];
const penta = (k: number) => 12 * Math.floor(k / 5) + PENTA[((k % 5) + 5) % 5];

export function eventos({tiempos, duracion, pulso, tono}: ContextoSonido): EventoSonoro[] {
  const notas: EventoSonoro[] = [];
  const fin = (Math.ceil(duracion * FPS) - 1) / FPS;
  const l = linea(tiempos, fin);
  const esp = espirales(l, pulso);
  const cr = crecimiento(l, pulso);

  // Espirales rosas (34) y azules (55): una nota cada dos
  for (let i = 0; i < 34; i += 2) notas.push({t: esp.rosa + i * esp.fusa, frecuencia: hz(tono + penta(i / 2)), volumenDb: -17, duracion: 0.09, brillo: 0.5, pan: -0.5});
  for (let i = 0; i < 55; i += 2) notas.push({t: esp.azul + i * esp.fusa, frecuencia: hz(tono - 12 + penta(i / 2)), volumenDb: -17, duracion: 0.09, brillo: 0.35, pan: 0.5});

  // "Nadie": las semillas se recogen
  notas.push({t: l.nadie, frecuencia: 0, volumenDb: -14, efecto: 'papel'});

  // Crecimiento: las lentas, una nota por semilla; las rápidas, Shepard en semicorcheas
  for (let n = 1; n <= cr.lentas; n++) notas.push({t: cr.momento(n), frecuencia: hz(tono - 12 + penta(n - 1)), volumenDb: -11, duracion: 0.16, brillo: 0.45});
  const semi = pulso.negra / 4;
  for (let k = 0, s = cuantizar(cr.rapidoDesde, pulso, 0.25, 'siguiente'); s < cr.rapidoHasta; k++, s += semi) {
    notas.push({t: s, frecuencia: tono + penta(k), shepard: true, volumenDb: -16, duracion: 0.08});
  }

  // El ángulo cambia: papel
  notas.push({t: l.ciento35 - 0.3, frecuencia: 0, volumenDb: -15, efecto: 'papel'});
  notas.push({t: l.ciento37, frecuencia: 0, volumenDb: -15, efecto: 'papel'});

  // Las espirales aparecen "solas": las dos familias suben a la vez
  for (let i = 0; i < 17; i++) {
    notas.push({t: esp.otraVez + i * esp.fusa, frecuencia: hz(tono + penta(i)), volumenDb: -18, duracion: 0.08, brillo: 0.5, pan: i % 2 ? 0.5 : -0.5});
  }

  // Estudio: una nota por girasol; el de Lucas, grave
  momentosEstudio(l, pulso).forEach((t, i) => {
    const g = ESTUDIO[i];
    notas.push({t, frecuencia: hz(tono + (g.fibonacci ? penta(5 + i) : -12)), volumenDb: -12, duracion: 0.2, brillo: 0.5});
  });
  notas.push({t: cuantizar(l.unaDeCada, pulso, 0.5), frecuencia: hz(tono - 17), volumenDb: -11, duracion: 0.3, brillo: 0.3});

  // Cortes de escena
  for (const t of cortes(l, pulso)) {
    notas.push({t, frecuencia: 0, volumenDb: -16, efecto: 'barrido', duracion: pulso.negra});
    notas.push({t, frecuencia: 0, volumenDb: -14, efecto: 'impresora', pan: 0.3});
  }
  return notas;
}
