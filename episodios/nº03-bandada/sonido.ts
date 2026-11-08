// nº03 · Sonido propio, en el pulso.
//   · Las tres reglas: una nota al presentar cada una.
//   · El giro: cada semicorchea suena una nota por las aves que acaban de girar (más fuerte cuantas
//     más), subiendo por la pentatónica de La menor: se OYE cómo el giro recorre la bandada.
//   · "¿Y la que iba delante?": una campanita cuando aparece el círculo que la señala.
// Usa la misma simulación y la misma correspondencia de tiempos que Sketch.tsx.
import type {ContextoSonido, EventoSonoro} from '@sonido/banda';
import {tiempoDeAncla} from '@canal/tiempos';
import {cuantizar} from '@canal/pulso';
import {hz} from '@sonido/sintesis';
import {iniciadorasDe, momentosDeGiro, vuelo} from './simulacion';

const PENTATONICA = [0, 3, 5, 7, 10];
const grado = (k: number) => PENTATONICA[k % 5] + 12 * Math.floor(k / 5);
const FPS = 30;

export function eventos({config, tiempos, duracion, pulso}: ContextoSonido): EventoSonoro[] {
  const lista: EventoSonoro[] = [];
  for (const [i, frase] of ['si otra', 'si las de al lado', 'y si empieza'].entries()) {
    const t = tiempoDeAncla(tiempos, frase);
    if (t !== null) lista.push({t: cuantizar(t, pulso, 0.25), frecuencia: [220, 261.63, 329.63][i], volumenDb: -8, duracion: 0.19, brillo: 0.45, pan: (i - 1) * 0.4});
  }

  // Misma cuenta que Sketch.tsx: fin = último fotograma; antes del remate, reloj = t + fin − remate
  const fin = (Math.ceil(duracion * FPS) - 1) / FPS;
  const giro = tiempoDeAncla(tiempos, 'unas giran') ?? 28;
  const remate = tiempoDeAncla(tiempos, 'y la que iba delante') ?? 34;
  const giroSim = giro + fin - remate;
  const estados = vuelo(config.semilla, 2 * fin + 3, giroSim);
  const giros = momentosDeGiro(estados, giroSim, giroSim + (remate - giro));
  const ini = iniciadorasDe(estados[0]);
  const aVideo = (s: number) => s - fin + remate;

  // Semicorcheas con aves que acaban de girar (sin contar las iniciadoras)
  const porSemi = new Map<number, number>();
  giros.forEach((s, i) => {
    if (!Number.isFinite(s) || ini.has(i)) return;
    const t = cuantizar(aVideo(s), pulso, 0.25, 'siguiente');
    if (t < remate - 0.05) porSemi.set(t, (porSemi.get(t) ?? 0) + 1);
  });
  [...porSemi.entries()].sort((a, b) => a[0] - b[0]).forEach(([t, n], k) => {
    lista.push({t, frecuencia: hz(grado(Math.min(k, 12)) - 12), volumenDb: -16 + Math.min(8, n * 1.2), duracion: 0.1, brillo: 0.4, pan: ((k % 5) - 2) * 0.2});
  });
  lista.push({t: cuantizar(giro, pulso, 0.25), frecuencia: hz(-24), volumenDb: -6, duracion: 0.4, brillo: 0.25});
  lista.push({t: cuantizar(remate, pulso, 0.25, 'siguiente'), frecuencia: hz(19), volumenDb: -6, duracion: 0.5, brillo: 0.8});
  return lista;
}
