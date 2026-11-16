// nº10 · Partitura: la música sale de la misma línea de tiempo y de la misma simulación que la imagen
// (linea.ts; ver @sonido/edicion).
//
//   · Portada: un acorde punteado por palabra del título.
//   · Las exploradoras salen: clics sueltos, cada vez más.
//   · El baile: la buena, notas rápidas y agudas; la regular, pocas y graves; en cada vuelta, menos.
//   · La votación: cada exploradora que se suma a una caja es una nota (la caja buena, campana; las
//     regulares, punteo). El quórum («se acaba la votación») es un corte con golpe.
//   · Revelación «4 de 5»: golpe; cuatro campanas, una por caja marcada.
import {momentosPortada} from '@canal/tiempos';
import type {ContextoSonido} from '@sonido/banda';
import {penta, type Partitura} from '@sonido/edicion';
import {circuitos, cortes, linea, rondaEn} from './linea';
import {BUENA, CAJAS} from './simulacion';

const FPS = 30;

export function partitura({config, tiempos, duracion, pulso}: ContextoSonido): Partitura {
  const fin = (Math.ceil(duracion * FPS) - 1) / FPS;
  const l = linea(tiempos, fin, pulso, config.semilla);
  const negra = pulso.negra;
  const corchea = negra / 2;
  const semi = negra / 4;
  const notas: Partitura['notas'] = [];
  const lado = (k: number) => (k % 2 ? 0.45 : -0.45);

  // Portada
  notas.push({t: 0, nota: 0, voz: 'grave', vel: 0.7, dur: negra * 2});
  momentosPortada(config.titulo, negra).forEach((t, i) => {
    for (const n of [0, 7]) notas.push({t, nota: [0, 3, 7, 12][i % 4] + n, vel: 0.85, pan: lado(i) * 0.5, dur: 0.35});
  });

  // Las exploradoras salen: clics sueltos, cada vez más (uno por semicorchea al final)
  for (let k = 0, s = l.exploradoras; s < l.baile - 0.05; k++, s += corchea - (corchea - semi) * ((s - l.exploradoras) / (l.baile - l.exploradoras))) {
    notas.push({t: s, nota: penta((k * 3) % 8) + 12, voz: 'clic', vel: 0.25, pan: lado(k)});
  }

  // El baile: la buena en semicorcheas agudas, la regular en negras graves (con pausas); menos en cada vuelta
  for (let s = l.bueno; s < l.asi - corchea; s += semi) {
    const {valor} = circuitos(s, l, 1);
    if (Math.round((s - l.bueno) / semi) % 6 < Math.round((6 * valor) / 90)) notas.push({t: s, nota: 19, voz: 'clic', vel: 0.3, pan: -0.35});
  }
  for (let k = 0, s = l.regular; s < l.asi - corchea; k++, s += negra) {
    const {valor} = circuitos(s, l, CAJAS[0].calidad);
    if (valor > 0 && k % 2 === 0) notas.push({t: s, nota: 3, vel: 0.5, pan: 0.35, dur: 0.25});
  }
  notas.push({t: l.cadaVuelta, nota: -2, vel: 0.6, dur: 0.4});

  // La votación: cada exploradora que se suma a una caja, una nota (como mucho una por caja y ronda)
  const R = l.sim.ronda ?? l.sim.rondas.length - 1;
  for (let r = 1; r <= R; r++) {
    // Segundo del video en que se ve esta ronda
    let s = l.asi + 0.2 + (r / R) * (l.votacion - l.asi - 0.2);
    s = Math.round(s / semi) * semi;
    if (rondaEn(s, l) < r - 1) continue;
    CAJAS.forEach((_, j) => {
      const nuevas = l.sim.rondas[r].comprometidas[j] - l.sim.rondas[r - 1].comprometidas[j];
      if (nuevas <= 0) return;
      const vel = Math.min(0.85, 0.3 + 0.05 * nuevas);
      notas.push(j === BUENA ? {t: s, nota: 12 + penta(r % 5), voz: 'campana', vel, pan: 0} : {t: s + 0.02 * j, nota: penta(j) - 12, vel: vel * 0.6, pan: lado(j), dur: 0.2});
    });
  }

  // El experimento real: una nota por caja al decir «cinco cajas»
  for (let j = 0; j < 5; j++) notas.push({t: l.cajas + j * semi, nota: j === BUENA ? 19 : 7, voz: j === BUENA ? 'campana' : 'pluck', vel: 0.6, pan: (j - 2) * 0.3, dur: 0.25});
  // Revelación: cuatro campanas, una por caja marcada
  for (let j = 0; j < 4; j++) notas.push({t: l.revelacion + 0.2 + j * 0.12 * 3, nota: 12 + [0, 3, 7, 12][j], voz: 'campana', vel: 0.6, pan: (j - 1.5) * 0.3});

  const fuerza = new Map<number, number>([[l.votacion, 1.2], [l.revelacion, 1.3], [l.remate, 0.8]]);
  return {
    secciones: [
      {desde: 0, nivel: 0},
      {desde: l.mapa, nivel: 1},
      {desde: l.baile, nivel: 1},
      {desde: l.asi, nivel: 2},
      {desde: l.votacion, nivel: 1},
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
