// nº01 · Sonido propio del episodio, en el pulso de la música: cada paso suena, cada vez más agudo.
//
//   · Pasos lentos (uno por tiempo): un tic por paso, un escalón más arriba en la pentatónica de La
//     menor (la tonalidad de la música): los pasos SON parte de la música.
//   · Aceleración: escalera de Shepard (subida sin fin) en corcheas, luego semicorcheas y luego fusas,
//     cada vez más fuerte; se corta en la caída (el tiempo de silencio antes de la revelación).
//   · Autopista: la subida se detiene; un pulso estable (La–Mi) en cada tiempo que se apaga.
//
// Usa la misma línea de tiempo que la animación (linea.ts).
import type {ContextoSonido, EventoSonoro} from '@sonido/banda';
import {hz} from '@sonido/sintesis';
import {claves} from './linea';

const PENTATONICA = [0, 3, 5, 7, 10]; // la, do, re, mi, sol
const grado = (k: number) => PENTATONICA[k % 5] + 12 * Math.floor(k / 5);

export function eventos({tiempos, duracion, pulso}: ContextoSonido): EventoSonoro[] {
  const puntos = claves(tiempos, duracion, pulso);
  const [t0] = puntos[0];
  const [tFacil, lentos] = puntos[1];
  const tRevelacion = puntos[4][0];
  const tFin = puntos[puntos.length - 1][0];
  const negra = pulso.negra;
  const lista: EventoSonoro[] = [];

  // 1. Pasos lentos: un escalón de la pentatónica por paso, desde La3
  for (let k = 0; k < lentos; k++) {
    lista.push({t: t0 + k * negra, frecuencia: hz(grado(k) - 12), volumenDb: 0, duracion: 0.2, brillo: 0.45, pan: k % 2 ? 0.25 : -0.25});
  }

  // 2. Aceleración: Shepard en la rejilla, subdivisión cada vez más fina; calla en la caída
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

  // 3. Autopista: pulso estable en cada tiempo que se apaga
  const pulsos = Math.floor((tFin - tRevelacion) / negra);
  for (let i = 1; i <= pulsos; i++) {
    lista.push({
      t: tRevelacion + i * negra,
      frecuencia: hz(i % 2 ? 7 : 0),
      volumenDb: -6 - (18 * i) / Math.max(1, pulsos),
      duracion: 0.25,
      brillo: 0.3,
    });
  }
  return lista;
}
