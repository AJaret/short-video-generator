// nº01 · Sonido propio del episodio: cada paso de la hormiga suena, y cada vez más agudo.
//
//   · Pasos lentos: un tic por paso, un semitono más arriba cada vez (escala cromática desde La4,
//     por encima del registro de la voz para que no se tapen).
//   · Aceleración: tics de Shepard que suben un escalón de la pentatónica de La menor (la tonalidad
//     de la música) en cada tic, cada vez más seguidos (de uno cada 0,3 s a 30 por segundo) y más
//     fuertes: una subida que no termina nunca, hasta la revelación.
//   · Autopista: la subida se detiene; un pulso estable (La–Mi) cada medio segundo que se apaga.
//
// Usa la misma línea de tiempo que la animación (linea.ts), así el sonido sigue a la imagen.
import type {ContextoSonido, EventoSonoro} from '@sonido/banda';
import {hz} from '@sonido/sintesis';
import {claves} from './linea';

const PENTATONICA = [0, 3, 5, 7, 10]; // La menor pentatónica: la, do, re, mi, sol
const INTERVALO_INICIAL = 0.3; // s entre tics al empezar a acelerar
const INTERVALO_FINAL = 1 / 30; // un tic por fotograma justo antes de la revelación

export function eventos({tiempos, duracion}: ContextoSonido): EventoSonoro[] {
  const puntos = claves(tiempos, duracion);
  const [t0] = puntos[0];
  const [tFacil, lentos] = puntos[1];
  const tRevelacion = puntos[4][0];
  const tFin = puntos[puntos.length - 1][0];
  const lista: EventoSonoro[] = [];

  // 1. Pasos lentos: semitono a semitono desde La4
  for (let k = 1; k <= lentos; k++) {
    const t = t0 + ((tFacil - t0) * k) / lentos;
    lista.push({t, frecuencia: hz(k - 1), volumenDb: 0, duracion: 0.18, brillo: 0.45});
  }

  // 2. Aceleración: escalera de Shepard que no deja de subir, cada vez más rápida
  let t = tFacil + INTERVALO_INICIAL;
  let escalon = 0;
  while (t < tRevelacion - 0.02) {
    const avance = (t - tFacil) / (tRevelacion - tFacil);
    const grado = PENTATONICA[escalon % 5] + 12 * Math.floor(escalon / 5);
    lista.push({t, frecuencia: grado, volumenDb: -12 + 9 * avance, duracion: 0.09, shepard: true});
    escalon++;
    t += INTERVALO_INICIAL * (INTERVALO_FINAL / INTERVALO_INICIAL) ** avance;
  }

  // 3. Autopista: pulso estable que se apaga
  const pulsos = Math.floor((tFin - tRevelacion) / 0.5);
  for (let i = 0; i < pulsos; i++) {
    lista.push({
      t: tRevelacion + 0.35 + i * 0.5,
      frecuencia: hz(i % 2 ? 7 : 0),
      volumenDb: -6 - (18 * i) / Math.max(1, pulsos),
      duracion: 0.25,
      brillo: 0.3,
    });
  }
  return lista;
}
