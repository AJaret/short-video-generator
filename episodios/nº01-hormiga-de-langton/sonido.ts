// nº01 · Sonido propio del episodio, en el pulso de la música.
//
//   · Principal: un tic por paso lento, un escalón más arriba en la pentatónica de La menor (la
//     tonalidad de la música); escalera de Shepard en la aceleración (corcheas → semicorcheas →
//     fusas) que calla en la caída; pulso estable (La–Mi) en la autopista.
//   · Cortes de escena: traqueteo de impresora riso.
//   · Tableros: un "pling" (do-mi-sol-la agudos) cuando empieza la autopista de cada tablero.
//   · Cuadro: un tic de Shepard (sube sin fin) cada vez que la hormiga se sale del cuadro.
//   · Cinta: bips de computadora: agudo al escribir 1, grave al escribir 0, suave al moverse.
//   · Final: la hormiga vuelve a caminar: pulso suave en cada tiempo hasta que se queda quieta.
//
// Usa la misma línea de tiempo y la misma simulación que la animación.
import type {ContextoSonido, EventoSonoro} from '@sonido/banda';
import {hz} from '@sonido/sintesis';
import {cinta, escenas, tAutopistaTablero, TABLEROS} from './linea';
import {cuadroEn} from './simulacion';

const PENTATONICA = [0, 3, 5, 7, 10]; // la, do, re, mi, sol
const grado = (k: number) => PENTATONICA[k % 5] + 12 * Math.floor(k / 5);

export function eventos({tiempos, duracion, pulso}: ContextoSonido): EventoSonoro[] {
  const e = escenas(tiempos, duracion, pulso);
  const [t0] = e.principal[0];
  const [tFacil, lentos] = e.principal[1];
  const tRevelacion = e.principal[4][0];
  const negra = pulso.negra;
  const lista: EventoSonoro[] = [];

  // 1. Pasos lentos: un escalón de la pentatónica por paso, desde La3
  for (let k = 0; k < lentos; k++) {
    lista.push({t: t0 + k * negra, frecuencia: hz(grado(k) - 12), volumenDb: 0, duracion: 0.2, brillo: 0.45, pan: k % 2 ? 0.25 : -0.25});
  }

  // 2. Aceleración: Shepard en la rejilla, cada vez más fina; calla en la caída
  const finSubida = tRevelacion - negra;
  let t = tFacil;
  let escalon = 0;
  while (t < finSubida - 1e-6) {
    const avance = (t - tFacil) / (finSubida - tFacil);
    const division = avance < 0.33 ? 0.5 : avance < 0.66 ? 0.25 : 0.125;
    lista.push({t, frecuencia: grado(escalon), volumenDb: -12 + 9 * avance, duracion: Math.min(0.09, division * negra * 1.2), shepard: true});
    escalon++;
    t += division * negra;
  }

  // 3. Autopista: pulso estable en cada tiempo que se apaga, hasta el corte
  const pulsos = Math.floor((e.tTableros - tRevelacion) / negra) - 1;
  for (let i = 1; i <= pulsos; i++) {
    lista.push({t: tRevelacion + i * negra, frecuencia: hz(i % 2 ? 7 : 0), volumenDb: -6 - (14 * i) / Math.max(1, pulsos), duracion: 0.25, brillo: 0.3});
  }

  // 4. Cortes de escena: impresora riso
  for (const corte of [e.tTableros, e.tCuadro, e.tCinta, e.tFinal]) lista.push({t: corte - 0.05, frecuencia: 0, volumenDb: -8, efecto: 'impresora'});

  // 5. Tableros: "pling" al empezar cada autopista
  const plings = [3, 7, 10, 12]; // do5, mi5, sol5, la5
  TABLEROS.forEach((_, k) => {
    lista.push({t: tAutopistaTablero(k, e), frecuencia: hz(plings[k]), volumenDb: -2, duracion: 0.35, brillo: 0.6, pan: k % 2 ? 0.4 : -0.4});
  });

  // 6. Cuadro: un tic de Shepard que sube con cada salida
  cuadroEn(e.tCinta, e).momentos.forEach((m, i) => {
    lista.push({t: m, frecuencia: grado(i), volumenDb: -4, duracion: 0.12, shepard: true});
  });

  // 7. Cinta: bips de computadora
  for (const mov of cinta(e).slice(1)) {
    if (mov.tipo === 'sube') lista.push({t: mov.t, frecuencia: hz(19), volumenDb: -8, duracion: 0.07, brillo: 0.2, pan: 0.2});
    else if (mov.tipo === 'baja') lista.push({t: mov.t, frecuencia: hz(7), volumenDb: -8, duracion: 0.07, brillo: 0.2, pan: -0.2});
    else lista.push({t: mov.t, frecuencia: hz(-5), volumenDb: -16, duracion: 0.04, brillo: 0.1});
  }

  // 8. Final: la hormiga vuelve a caminar
  for (let tb = e.tFinal + negra; tb < e.tQuieta - 1e-6; tb += negra) {
    lista.push({t: tb, frecuencia: hz(0), volumenDb: -14, duracion: 0.2, brillo: 0.3});
  }
  return lista;
}
