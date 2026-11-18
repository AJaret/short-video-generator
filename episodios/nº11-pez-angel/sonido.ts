// nº11 · Partitura: la música sale de la misma línea de tiempo y de las mismas simulaciones que la
// imagen (linea.ts; ver @sonido/edicion).
//
//   · Portada: un acorde punteado por palabra del título.
//   · «Tres, seis, doce»: una nota por cada raya nueva que aparece (subiendo).
//   · La receta: el activador, notas agudas; el inhibidor, graves; la piel que se raya, un acorde.
//   · Manchas, laberintos, rayas: un acorde por cuadro.
//   · Revelación «1995»: golpe; luego, una campana cada vez que la simulación inserta una raya.
import {momentosPortada} from '@canal/tiempos';
import type {ContextoSonido} from '@sonido/banda';
import {penta, type Partitura} from '@sonido/edicion';
import {cortes, fase, linea, rayasReales} from './linea';
import {piel1D, rayas} from './simulacion';

const FPS = 30;

export function partitura({config, tiempos, duracion, pulso}: ContextoSonido): Partitura {
  const fin = (Math.ceil(duracion * FPS) - 1) / FPS;
  const l = linea(tiempos, fin, pulso);
  const negra = pulso.negra;
  const semi = negra / 4;
  const notas: Partitura['notas'] = [];
  const lado = (k: number) => (k % 2 ? 0.45 : -0.45);

  // Portada
  notas.push({t: 0, nota: 0, voz: 'grave', vel: 0.7, dur: negra * 2});
  momentosPortada(config.titulo, negra).forEach((t, i) => {
    for (const n of [0, 7]) notas.push({t, nota: [0, 3, 7, 12][i % 4] + n, vel: 0.85, pan: lado(i) * 0.5, dur: 0.35});
  });

  // Tres, seis, doce: una nota por raya, y las nuevas en semicorcheas que suben
  notas.push({t: l.tres, nota: 0, voz: 'campana', vel: 0.7});
  [l.seis, l.doce].forEach((t0, k) => {
    const nuevas = rayasReales(t0 + 1, l).length - rayasReales(t0 - 0.5, l).length;
    for (let i = 0; i < nuevas; i++) notas.push({t: t0 - 0.4 + i * semi, nota: penta(i + 5 * k), voz: k ? 'clic' : 'pluck', vel: 0.55, pan: lado(i), dur: 0.2});
  });

  // La receta: el activador (agudo) y el inhibidor (grave)
  notas.push({t: l.activa, nota: 12, voz: 'campana', vel: 0.65, pan: -0.3}, {t: l.frena, nota: -12, voz: 'grave', vel: 0.6, dur: negra});
  for (let k = 0, s = l.corre; s < l.recetas - semi; k++, s += semi * 2) notas.push({t: s, nota: penta(k % 6) - 5, vel: 0.35, pan: lado(k), dur: 0.15});

  // Manchas, laberintos, rayas: un acorde cada uno
  [l.manchas, l.laberintos, l.rayas].forEach((t, i) => {
    for (const n of [0, 4, 7]) notas.push({t: t + n * 0.01, nota: [0, 3, 7][i] + n, voz: 'campana', vel: 0.5, pan: (i - 1) * 0.4});
  });

  // Revelación: una campana cada vez que la simulación inserta una raya
  const piel = piel1D(config.semilla);
  let previo = 0;
  while (previo < piel.t.length - 1 && piel.t[previo] < 120) previo++;
  let antes = -1;
  for (let s = l.revelacion + 0.3; s < l.remate - 0.2; s += semi) {
    const p = fase(s, l.revelacion + 0.3, l.remate - 0.2);
    const e = p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2;
    const k = previo + Math.round(e * (piel.u.length - 1 - previo));
    const n = rayas(piel.u[k]).length;
    if (antes >= 0 && n > antes) notas.push({t: s, nota: 12 + penta(n), voz: 'campana', vel: 0.7, pan: lado(n)});
    antes = n;
  }

  const fuerza = new Map<number, number>([[l.revelacion, 1.3], [l.murio, 0.7], [l.remate, 0.8]]);
  return {
    secciones: [
      {desde: 0, nivel: 0},
      {desde: l.mapa, nivel: 1},
      {desde: l.dos, nivel: 2},
      {desde: l.murio, nivel: 1},
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
