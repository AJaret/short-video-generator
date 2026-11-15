// nº09 · Partitura: aquí la sincronía SE OYE. La música sale de la misma línea de tiempo y de las
// mismas simulaciones que la imagen (linea.ts; ver @sonido/edicion).
//
//   · El árbol sincronizado: dos campanas en cada destello conjunto (uno cada dos tiempos).
//   · Los relojes: cada destello de A suena en la tónica y cada uno de B en la quinta; cuando se
//     juntan, suenan a la vez.
//   · El enjambre: cada grupo que destella es una nota. Al principio son clics sueltos, como lluvia;
//     según se agrupan, quedan menos notas y más fuertes, hasta el golpe de la revelación.
//   · Los sensores: un clic por nodo, hasta el destello conjunto.
//   · Cortes de verdad (relojes, enjambre, revelación, sensores, cierre): bombo + sub + palmada.
import type {ContextoSonido} from '@sonido/banda';
import {penta, type Partitura} from '@sonido/edicion';
import {cortes, destellosArbol, linea, type Escena} from './linea';

const FPS = 30;

export function partitura({config, tiempos, duracion, pulso}: ContextoSonido): Partitura {
  const fin = (Math.ceil(duracion * FPS) - 1) / FPS;
  const l = linea(tiempos, fin, pulso, config.semilla);
  const negra = pulso.negra;
  const notas: Partitura['notas'] = [];
  const lado = (k: number) => (k % 2 ? 0.45 : -0.45);

  // ── El árbol sincronizado (no en el último fotograma: no hay tiempo para que suene) ──
  for (const s of destellosArbol(l)) {
    if (s > fin - 0.4) continue;
    notas.push({t: s, nota: 12, voz: 'campana', vel: 0.55, pan: -0.3}, {t: s, nota: 19, voz: 'campana', vel: 0.45, pan: 0.3});
  }

  // ── Los dos relojes: A en la tónica, B en la quinta ──
  const r = l.relojes;
  for (const d of r.historia.destellos) {
    const s = r.inicio + d.t * l.T;
    if (s < l.truco || s >= l.sinJefe - 0.05) continue;
    for (const quien of d.quienes) {
      if (quien === 1 && s < l.regla) continue; // B aún no ha entrado
      notas.push({t: s, nota: quien ? 7 : 0, vel: 0.75, pan: quien ? 0.4 : -0.4, dur: 0.35});
    }
  }
  // Antes de que empiece su simulación, A va solo y libre
  for (let s = r.inicio - r.fases0[0] * l.T; s >= l.truco; s -= l.T) if (s < r.inicio) notas.push({t: s, nota: 0, vel: 0.75, pan: -0.4, dur: 0.35});

  /** Destellos de una escena simulada → notas, como mucho una (el grupo mayor) por fusa. */
  const sonar = (e: Escena, desde: number, hasta: number, octava: number) => {
    const fusa = negra / 8;
    const porFusa = new Map<number, {s: number; m: number; quien: number}>();
    for (const d of e.historia.destellos) {
      const s = e.inicio + d.t * l.T;
      if (s < desde || s >= hasta) continue;
      const hueco = Math.floor(s / fusa);
      const previo = porFusa.get(hueco);
      if (!previo || d.quienes.length > previo.m) porFusa.set(hueco, {s, m: d.quienes.length, quien: d.quienes[0]});
    }
    for (const {s, m, quien} of porFusa.values()) {
      const peso = m / e.n;
      if (peso < 0.05) notas.push({t: s, nota: penta(quien % 10) + octava + 12, voz: 'clic', vel: 0.16 + 0.5 * peso, pan: lado(quien)});
      else notas.push({t: s, nota: penta(quien % 5) + octava, voz: peso > 0.5 ? 'campana' : 'pluck', vel: 0.35 + 0.5 * peso, pan: lado(quien) * 0.6, dur: 0.3});
    }
  };
  // El enjambre, hasta la pausa de antes de la revelación; los sensores, toda su escena
  sonar(l.enjambre, l.sinJefe, l.pausa, 0);
  sonar(l.nodos, l.sensores, l.bicho - 0.05, 12);

  const fuerza = new Map<number, number>([[l.revelacion, 1.3], [l.truco, 0.8], [l.bicho, 0.8]]);
  return {
    secciones: [
      {desde: 0, nivel: 0},
      {desde: l.mapa, nivel: 1},
      {desde: l.tailandia, nivel: 2},
      {desde: l.truco, nivel: 1},
      // El enjambre sube un escalón antes: la revelación ya no salta de 1 a 3
      {desde: l.sinJefe, nivel: 2},
      {desde: l.revelacion, nivel: 3},
      {desde: l.sensores, nivel: 2},
      {desde: l.bicho, nivel: 1},
    ],
    cortes: cortes(l).map((t) => ({t, fuerza: fuerza.get(t) ?? 1, hueco: t === l.revelacion ? 0 : undefined})),
    golpes: [l.revelacion],
    paradas: [[l.pausa, l.revelacion]],
    // Sin redoble ni aire antes de la revelación (el usuario lo oyó brusco): basta el tiempo de silencio
    subidas: [],
    notas,
    glitches: [],
    // El acorde final, en el penúltimo destello del árbol (el último es el fotograma del loop)
    final: l.fin - l.T,
  };
}
