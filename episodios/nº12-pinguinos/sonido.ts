// nº12 · Partitura: la música sale de la misma línea de tiempo y de la misma simulación que la imagen
// (linea.ts; ver @sonido/edicion).
//
//   · Portada: un acorde punteado por palabra del título.
//   · El huevo: una campana suave.
//   · La regla: cada cambio de sitio de un pingüino es una nota (como mucho una por corchea).
//   · El reparto: un acorde que se abre cuando el frío se iguala.
//   · La ola de pasitos: un arpegio que cruza de lado a lado en la revelación.
import {momentosPortada} from '@canal/tiempos';
import type {ContextoSonido} from '@sonido/banda';
import {penta, type Partitura} from '@sonido/edicion';
import {cortes, linea, rondaRegla} from './linea';

const FPS = 30;

export function partitura({config, tiempos, duracion, pulso}: ContextoSonido): Partitura {
  const fin = (Math.ceil(duracion * FPS) - 1) / FPS;
  const l = linea(tiempos, fin, pulso);
  const negra = pulso.negra;
  const corchea = negra / 2;
  const notas: Partitura['notas'] = [];
  const lado = (k: number) => (k % 2 ? 0.45 : -0.45);

  notas.push({t: 0, nota: 0, voz: 'grave', vel: 0.7, dur: negra * 2});
  momentosPortada(config.titulo, negra).forEach((t, i) => {
    for (const n of [0, 7]) notas.push({t, nota: [0, 3, 7, 12][i % 5 % 4] + n, vel: 0.85, pan: lado(i) * 0.5, dur: 0.35});
  });
  notas.push({t: l.machos + 0.8, nota: 19, voz: 'campana', vel: 0.6});

  // La regla: una nota por corchea mientras haya cambios de sitio
  let previo = 0;
  for (let k = 0, s = l.apinan + 0.3; s < l.regla - 0.2; k++, s += corchea) {
    const r = Math.floor(rondaRegla(s, l));
    if (r > previo) notas.push({t: s, nota: penta(k % 7) - 5, voz: k % 4 === 0 ? 'pluck' : 'clic', vel: 0.35, pan: lado(k), dur: 0.15});
    previo = r;
  }
  // El reparto: el acorde se abre cuando el frío se iguala
  [0, 4, 7, 12].forEach((n, i) => notas.push({t: l.regla + 1.6 + i * 0.25, nota: n, voz: 'campana', vel: 0.55, pan: (i - 1.5) * 0.3}));

  // La ola: un arpegio que cruza de izquierda a derecha
  for (let i = 0; i < 12; i++) notas.push({t: l.ola - 0.4 + i * (negra / 4), nota: penta(i), voz: 'pluck', vel: 0.55, pan: -0.8 + (1.6 * i) / 11, dur: 0.2});

  const fuerza = new Map<number, number>([[l.revelacion, 1.3], [l.remate, 0.8]]);
  return {
    secciones: [
      {desde: 0, nivel: 0},
      {desde: l.mapa, nivel: 1},
      {desde: l.apinan, nivel: 2},
      {desde: l.regla, nivel: 1},
      {desde: l.revelacion, nivel: 3},
      {desde: l.remate, nivel: 1},
    ],
    cortes: cortes(l).map((t) => ({t, fuerza: fuerza.get(t) ?? 1, hueco: t === l.revelacion ? 0 : undefined})),
    golpes: [l.revelacion],
    paradas: [[l.pausa, l.revelacion]],
    subidas: [],
    notas,
    glitches: [],
    final: l.fin - 1.2,
  };
}
