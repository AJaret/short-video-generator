// Música del canal: "misterio con guiño" (el boceto C elegido por el usuario el 2026-11-07).
//
// La menor (la misma tonalidad que los tics de los episodios), 92 BPM por defecto. Marimba en
// arpegios con un patrón 3+3+2 que "gira", sub-grave, bombo y aro a medio tiempo, shaker con swing
// y campanitas FM, todo en estéreo con un eco que rebota de lado a lado.
//
// No es un bucle de fondo: se compone para cada episodio a partir de un PLAN que viene de su línea
// de tiempo (banda.ts): la intensidad de cada tiempo decide qué capas suenan, hay silencios
// ("caídas") justo antes de la revelación y golpes (platillo + grave) en ella. Como todo cae en la
// rejilla de pulso (pulso.ts), la animación, la plantilla y la música laten juntas.
import {mulberry32} from '../canal/prng';
import type {Pulso} from '../canal/pulso';
import {aro, bajoPulsado, bombo, campanaFM, golpeGrave, hatAbierto, hatCerrado, marimba, palmada, platillo, shaker, subBajo} from './instrumentos';
import {ecoPingPong, estereo, fundidos, hz, rmsEstereo, sumarPaneado, type Estereo} from './sintesis';

export type PlanMusical = {
  duracion: number;
  pulso: Pulso;
  /** Intensidad (0…1) en el segundo t: decide las capas. */
  intensidad: (t: number) => number;
  /** Tramos [desde, hasta] en los que la música calla (la caída antes de la revelación). */
  caidas: [number, number][];
  /** Momentos con golpe de platillo + grave (la revelación). */
  golpes: number[];
  /** Desde aquí solo queda el acorde final sonando (en el primer tiempo de un compás). */
  final: number;
};

/** Acordes (semitonos respecto a la4) y raíces del bajo: Am – Fmaj7 – Am – G. */
const ACORDES = [
  [-12, -9, -5, 0, 3],
  [-16, -12, -9, -4, 0],
  [-12, -9, -5, 0, 3],
  [-14, -10, -7, -2, 2],
];
const RAICES = [-36, -40, -36, -38];
/** Índices del acorde en cada semicorchea: grupos 3+3+2 que hacen "girar" el arpegio. */
const PATRON = [0, 2, 4, 1, 3, 2, 4, 3];

/**
 * Devuelve dos pistas estéreo: `base` (lo que baja cuando entra un dato de impacto) y `acentos`
 * (golpes de la revelación, que no deben bajar). La base sale normalizada a −20 dB RMS.
 */
export function musicaMisterio(sr: number, plan: PlanMusical, semilla = 92): {base: Estereo; acentos: Estereo} {
  const {pulso, duracion} = plan;
  const azar = mulberry32(semilla);
  const negra = pulso.negra;
  const semi = negra / 4;
  const base = estereo(sr, duracion);
  const acentos = estereo(sr, duracion);

  const tiempos = Math.floor(plan.final / negra);
  for (let b = 0; b < tiempos; b++) {
    const t = b * negra;
    const I = plan.intensidad(t);
    const compas = Math.floor(b / 4);
    const enCompas = b % 4;
    const acorde = ACORDES[compas % 4];

    // Marimba: corcheas con poca intensidad, semicorcheas con más
    const porTiempo = I < 0.3 ? 2 : 4;
    for (let j = 0; j < porTiempo; j++) {
      const k = b * 4 + j * (4 / porTiempo);
      const acento = k % 8 === 0 || k % 8 === 3 || k % 8 === 6;
      const nota = acorde[PATRON[k % 8]] + (compas % 2 === 1 && k % 16 >= 8 ? 12 : 0);
      const vel = (acento ? 0.8 : 0.45) * (0.6 + 0.4 * I) * (0.85 + 0.15 * azar());
      sumarPaneado(base, marimba(sr, hz(nota), vel), sr, t + j * (negra / porTiempo), 0.3, Math.sin(k * 0.9 + compas) * 0.9);
    }
    // Sub-grave
    if (I > 0.3 && enCompas === 0) sumarPaneado(base, subBajo(sr, hz(RAICES[compas % 4]), negra * 1.4), sr, t, 0.5 * I);
    if (I > 0.3 && enCompas === 2) sumarPaneado(base, subBajo(sr, hz(RAICES[compas % 4]), negra * 0.9), sr, t + 0.5 * negra, 0.35 * I);
    // Batería a medio tiempo
    if (I > 0.45 && enCompas === 0) sumarPaneado(base, bombo(sr), sr, t, 0.5);
    if (I > 0.85 && enCompas === 2) sumarPaneado(base, bombo(sr), sr, t + 0.5 * negra, 0.3);
    if (I > 0.45 && enCompas === 2) sumarPaneado(base, aro(sr, 1100), sr, t, 0.2, 0.3);
    if (I > 0.55) {
      const g = Math.min(1, (I - 0.55) / 0.3);
      sumarPaneado(base, shaker(sr, b * 2), sr, t, 0.11 * g, -0.35);
      sumarPaneado(base, shaker(sr, b * 2 + 1), sr, t + negra * 0.5 + 0.025, 0.07 * g, -0.35);
    }
    // Campanita en el contratiempo del último tiempo, cada dos compases
    if (I > 0.8 && compas % 2 === 0 && enCompas === 3) {
      sumarPaneado(base, campanaFM(sr, hz(acorde[4] + 12), 0.5), sr, t + 0.5 * negra, 0.2, 0.5);
    }
  }
  // Acorde final: arpegio rápido que se queda sonando (el último fotograma enlaza con el primero)
  const final = ACORDES[Math.floor(plan.final / pulso.compas) % 4];
  final.forEach((nota, i) => sumarPaneado(base, marimba(sr, hz(nota), 0.7), sr, plan.final + i * semi * 0.5, 0.3, (i - 2) * 0.35));

  return terminar(sr, plan, base, acentos);
}

/** Eco, caídas, normalización a −20 dB RMS, golpes de la revelación y fundidos (las dos músicas). */
function terminar(sr: number, plan: PlanMusical, base: Estereo, acentos: Estereo): {base: Estereo; acentos: Estereo} {
  const {pulso, duracion} = plan;
  const negra = pulso.negra;
  ecoPingPong(base, sr, negra * 0.75, 0.3, 0.28);

  // Caídas: silencio con rampas de 15 ms
  const rampa = 0.015;
  for (const [desde, hasta] of plan.caidas) {
    for (let i = Math.max(0, Math.round((desde - rampa) * sr)); i < Math.min(base.l.length, Math.round(hasta * sr)); i++) {
      const s = i / sr;
      const g = s < desde ? (desde - s) / rampa : 0;
      base.l[i] *= g;
      base.r[i] *= g;
    }
  }

  // Normalizar la base a −20 dB RMS
  const g = 10 ** (-20 / 20) / (rmsEstereo(base) || 1);
  for (let i = 0; i < base.l.length; i++) {
    base.l[i] *= g;
    base.r[i] *= g;
  }

  // Golpes de la revelación (mismo nivel relativo que la base)
  for (const t of plan.golpes) {
    sumarPaneado(acentos, golpeGrave(sr), sr, t, 0.55 * g * 3);
    sumarPaneado(acentos, platillo(sr, Math.round(t * 1000)), sr, t, 0.35 * g * 3, -0.3);
    sumarPaneado(acentos, platillo(sr, Math.round(t * 1000) + 1), sr, t + 0.012, 0.35 * g * 3, 0.3);
  }
  // También termina a cero en episodios muy cortos o con un golpe cerca del último fotograma.
  for (const c of [base.l, base.r, acentos.l, acentos.r]) fundidos(c, sr, 0, Math.min(0.4, duracion / 4));
  return {base, acentos};
}

/**
 * Música "viva" (la prueba de nº04, 2026-11-08): la misma armonía y la misma marimba, pero arreglada
 * como los reels de referencia que el usuario pasó (motion graphics):
 *   · batería completa: bombo en 1 y 3, palmada de papel en 2 y 4, hi-hat en corcheas → semicorcheas,
 *     hi-hat abierto en los contratiempos cuando está a tope;
 *   · bajo pulsado en corcheas (no solo el sub-grave largo) y campanitas agudas en arpegio (brillo);
 *   · las capas entran y salen en la raya de compás (la intensidad se lee al empezar cada compás),
 *     así cada sección se oye distinta en vez de un crescendo plano;
 *   · final de cada frase de 4 compases: redoble de palmadas o un "stop" (la batería calla un tiempo);
 *   · redoble que acelera en el compás antes de cada golpe (corcheas → semicorcheas → fusas).
 */
export function musicaViva(sr: number, plan: PlanMusical, semilla = 92): {base: Estereo; acentos: Estereo} {
  const {pulso, duracion} = plan;
  const azar = mulberry32(semilla);
  const negra = pulso.negra;
  const semi = negra / 4;
  const base = estereo(sr, duracion);
  const acentos = estereo(sr, duracion);
  const enRedoble = (t: number) => plan.golpes.some((g) => t >= g - pulso.compas - negra - 1e-3 && t < g - negra - 1e-3);

  const tiempos = Math.floor(plan.final / negra);
  for (let b = 0; b < tiempos; b++) {
    const t = b * negra;
    const compas = Math.floor(b / 4);
    const enCompas = b % 4;
    // La intensidad se lee al empezar el compás (o en el golpe, si cae dentro): las capas entran en
    // la raya o en el golpe, no a mitad de un crescendo
    let lectura = compas * pulso.compas;
    for (const g of plan.golpes) if (g > lectura && g <= t + 1e-3) lectura = g;
    const I = plan.intensidad(lectura + 1e-3);
    const acorde = ACORDES[compas % 4];
    const raiz = RAICES[compas % 4];
    const finDeFrase = compas % 4 === 3 && enCompas === 3;
    const stop = finDeFrase && compas % 8 === 7 && I >= 0.4;
    const redobleFrase = finDeFrase && !stop && I >= 0.4;
    const redoble = enRedoble(t);

    // Marimba (igual que la original)
    const porTiempo = I < 0.3 ? 2 : 4;
    for (let j = 0; j < porTiempo; j++) {
      const k = b * 4 + j * (4 / porTiempo);
      const acento = k % 8 === 0 || k % 8 === 3 || k % 8 === 6;
      const nota = acorde[PATRON[k % 8]] + (compas % 2 === 1 && k % 16 >= 8 ? 12 : 0);
      const vel = (acento ? 0.8 : 0.45) * (0.35 + 0.65 * I) * (0.85 + 0.15 * azar());
      sumarPaneado(base, marimba(sr, hz(nota), vel), sr, t + j * (negra / porTiempo), 0.3, Math.sin(k * 0.9 + compas) * 0.9);
    }
    // Campanitas agudas: arpegio dos octavas arriba en corcheas (brillo), a partir de 0,75
    if (I >= 0.75) {
      for (let j = 0; j < 2; j++) {
        const k = b * 2 + j;
        sumarPaneado(base, campanaFM(sr, hz(acorde[PATRON[(k * 3) % 8]] + 24), 0.35, 0.18), sr, t + j * negra * 0.5, 0.16, Math.sin(k * 1.3) * 0.7);
      }
    }
    if (stop) continue; // el stop: un tiempo sin bajo ni batería (la marimba sigue)

    // Bajo: sub-grave largo en el 1 y, desde 0,35, corcheas pulsadas con salto de octava
    if (I >= 0.3 && enCompas === 0) sumarPaneado(base, subBajo(sr, hz(raiz), negra * 1.2), sr, t, 0.4 * I);
    if (I >= 0.35) {
      const figura = [0, null, 0, 12, null, 0, 12, 7]; // por corchea, a lo largo de un compás
      for (let j = 0; j < 2; j++) {
        const nota = figura[enCompas * 2 + j];
        if (nota === null) continue;
        sumarPaneado(base, bajoPulsado(sr, hz(raiz + 12 + nota), negra * 0.45), sr, t + j * negra * 0.5, (j ? 0.32 : 0.42) * Math.min(1, I + 0.2));
      }
    }
    // Batería
    if (I >= 0.4 && (enCompas === 0 || enCompas === 2)) sumarPaneado(base, bombo(sr), sr, t, 0.62);
    if (I >= 0.7 && enCompas === 1) sumarPaneado(base, bombo(sr), sr, t + 0.75 * negra, 0.38);
    if (I >= 0.5 && (enCompas === 1 || enCompas === 3) && !redobleFrase && !redoble) sumarPaneado(base, palmada(sr, b), sr, t, 0.34, 0.08);
    if (I >= 0.3 && !redoble) {
      const divisiones = I >= 0.6 ? 4 : 2;
      for (let j = 0; j < divisiones; j++) {
        const vel = divisiones === 4 ? [0.55, 0.22, 0.75, 0.3][j] : [0.35, 0.7][j];
        const swing = divisiones === 4 && j % 2 === 1 ? 0.018 : 0;
        sumarPaneado(base, hatCerrado(sr, b * 4 + j), sr, t + j * (negra / divisiones) + swing, 0.42 * vel, 0.32);
      }
    }
    if (I >= 0.8 && (enCompas === 1 || enCompas === 3)) sumarPaneado(base, hatAbierto(sr, b), sr, t + 0.5 * negra, 0.18, -0.3);
    if (I >= 0.55 && I < 0.8) sumarPaneado(base, shaker(sr, b * 2), sr, t + negra * 0.5 + 0.02, 0.08, -0.4);
    // Fin de frase: cuatro palmadas en semicorcheas que crecen
    if (redobleFrase) for (let j = 0; j < 4; j++) sumarPaneado(base, palmada(sr, b * 7 + j), sr, t + j * semi, 0.12 + 0.07 * j, (j - 1.5) * 0.15);
    // Redoble antes de un golpe: corcheas, semicorcheas y fusas, creciendo
    if (redoble) {
      const g = plan.golpes.find((x) => t >= x - pulso.compas - negra - 1e-3 && t < x - negra - 1e-3) ?? t;
      const avance = Math.max(0, Math.min(1, (t - (g - pulso.compas - negra)) / pulso.compas));
      const golpes = avance < 0.5 ? 2 : avance < 0.75 ? 4 : 8;
      for (let j = 0; j < golpes; j++) {
        const s = t + j * (negra / golpes);
        const crece = Math.max(0, Math.min(1, (s - (g - pulso.compas - negra)) / pulso.compas));
        sumarPaneado(base, palmada(sr, b * 11 + j), sr, s, 0.1 + 0.3 * crece, (j % 2 ? 0.2 : -0.2));
      }
    }
  }
  // Acorde final: arpegio rápido que se queda sonando (el último fotograma enlaza con el primero)
  const final = ACORDES[Math.floor(plan.final / pulso.compas) % 4];
  final.forEach((nota, i) => sumarPaneado(base, marimba(sr, hz(nota), 0.7), sr, plan.final + i * semi * 0.5, 0.3, (i - 2) * 0.35));
  sumarPaneado(base, campanaFM(sr, hz(final[4] + 24), 0.5, 0.5), sr, plan.final, 0.12, 0.4);
  return terminar(sr, plan, base, acentos);
}
