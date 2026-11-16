// nº10 · Simulación de la elección de casa de un enjambre. Módulo PURO: lo usan la animación, el
// sonido y verificar.mjs.
//
// Un ESQUEMA del mecanismo que describe Seeley (Honeybee Democracy, 2010; Seeley y Buhrman 2001;
// Seeley y Visscher 2004; Seeley y otros, Science 2012):
//   · Unos cientos de exploradoras. Cada una, si no tiene sitio, o sale a buscar (y encuentra una de
//     las cajas al azar) o sigue a una bailarina: cuantos más circuitos baila un sitio, más reclutas.
//   · Al volver de su sitio, baila: más circuitos cuanto mejor es el sitio, y en cada vuelta baila
//     unos cuantos menos. Cuando ya no baila, se retira (y puede volver a ser reclutada).
//   · Quórum: cuando en una caja coinciden `quorum` exploradoras a la vez, el enjambre se decide.
//   · Opcional (`cabezazos`): las bailarinas de un sitio frenan a las de los otros sitios.
// Los parámetros son nuestros: el video lo rotula «esquema». Determinista: mulberry32.
import {mulberry32} from '@canal/prng';

export type Sitio = {nombre: string; calidad: number};

/** Las cajas del experimento de la isla: una buena y cuatro regulares. */
export const CAJAS: Sitio[] = [
  {nombre: 'A', calidad: 0.4},
  {nombre: 'B', calidad: 0.4},
  {nombre: 'C', calidad: 1},
  {nombre: 'D', calidad: 0.4},
  {nombre: 'E', calidad: 0.4},
];
/** Índice de la caja buena. */
export const BUENA = 2;

export const PARAMS = {
  /** Exploradoras. */
  exploradoras: 300,
  /** Circuitos del primer baile para un sitio de calidad 1. */
  circuitos: 90,
  /** Circuitos menos en cada vuelta. */
  caida: 15,
  /** Probabilidad, por ronda, de que una exploradora libre salga a buscar por su cuenta. */
  buscar: 0.005,
  /** Probabilidad, por ronda, de que una exploradora libre siga a una bailarina (si hay bailes). */
  seguir: 0.05,
  /** Probabilidad de encontrar una caja concreta al buscar (las cinco igual de visibles). */
  encontrar: 0.15,
  /** Exploradoras a la vez en una caja para decidir. */
  quorum: 15,
  /** Fracción de las exploradoras de un sitio que, de visita, están en la caja en un momento dado. */
  enCaja: 0.12,
  /** Frenos: cada bailarina de un sitio quita esta fracción de circuitos a las de los demás. */
  cabezazos: 0,
};

export type Ronda = {
  /** Exploradoras con cada sitio (bailando o de visita). */
  comprometidas: number[];
  /** Circuitos de baile de cada sitio en esta ronda (el "voto"). */
  baile: number[];
  /** Exploradoras en cada caja en esta ronda. */
  enCaja: number[];
};

export type Historia = {rondas: Ronda[]; eleccion: number | null; ronda: number | null};

export function simular(semilla: number, rondas = 200, sitios: Sitio[] = CAJAS, p = PARAMS): Historia {
  const azar = mulberry32(semilla * 977 + 31);
  const n = p.exploradoras;
  const m = sitios.length;
  const sitio = new Int32Array(n).fill(-1);
  const circuitos = new Float64Array(n);
  const historia: Ronda[] = [];
  let eleccion: number | null = null;
  let cuando: number | null = null;
  for (let r = 0; r < rondas; r++) {
    // Baile de esta ronda, por sitio
    const baile = new Array(m).fill(0);
    for (let i = 0; i < n; i++) if (sitio[i] >= 0) baile[sitio[i]] += circuitos[i];
    const total = baile.reduce((s, v) => s + v, 0);
    // Exploradoras libres: buscan solas o siguen a una bailarina
    for (let i = 0; i < n; i++) {
      if (sitio[i] >= 0) continue;
      const x = azar();
      if (total > 0 && x < p.seguir) {
        let u = azar() * total;
        let j = 0;
        while (j < m - 1 && u > baile[j]) u -= baile[j++];
        sitio[i] = j;
        circuitos[i] = p.circuitos * sitios[j].calidad;
      } else if (azar() < p.buscar) {
        // Sale a buscar sola: encuentra una caja al azar (o ninguna)
        const j = Math.floor(azar() * m);
        if (azar() < p.encontrar * m) {
          sitio[i] = j;
          circuitos[i] = p.circuitos * sitios[j].calidad;
        }
      }
    }
    // Las comprometidas visitan su caja y vuelven a bailar un poco menos
    const comprometidas = new Array(m).fill(0);
    const enCaja = new Array(m).fill(0);
    for (let i = 0; i < n; i++) {
      if (sitio[i] < 0) continue;
      comprometidas[sitio[i]]++;
      if (azar() < p.enCaja) enCaja[sitio[i]]++;
    }
    for (let i = 0; i < n; i++) {
      if (sitio[i] < 0) continue;
      const j = sitio[i];
      // Cabezazos: las bailarinas de los otros sitios frenan esta campaña
      const rivales = comprometidas.reduce((s, v, k) => (k === j ? s : s + v), 0);
      circuitos[i] -= p.caida + p.cabezazos * rivales;
      if (circuitos[i] <= 0) {
        sitio[i] = -1;
        circuitos[i] = 0;
      }
    }
    historia.push({comprometidas, baile, enCaja});
    if (eleccion === null) {
      for (let j = 0; j < m; j++) if (enCaja[j] >= p.quorum) {
        eleccion = j;
        cuando = r;
      }
      if (eleccion !== null) break;
    }
  }
  return {rondas: historia, eleccion, ronda: cuando};
}
