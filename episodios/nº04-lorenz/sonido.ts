// nº04 · Sonido propio, en el pulso. Las notas suman `tono` (la tonalidad de la música del episodio).
//   · Las flechas del campo entran con un tic por columna (semicorcheas).
//   · Cada vez que un punto cambia de lóbulo, suena en ese lado: izquierda o derecha en el estéreo.
//     La rosa, aguda; la azul, grave. Mientras van juntas suenan a la vez; al separarse, cada una a
//     su aire: se oye el caos. Usa la misma línea de tiempo que la animación (linea.ts).
import type {ContextoSonido, EventoSonoro} from '@sonido/banda';
import {cuantizar} from '@canal/pulso';
import {hz} from '@sonido/sintesis';
import {cambiosDeLobulo, linea, momentosDe} from './linea';

const FPS = 30;

export function eventos({tiempos, duracion, pulso, tono}: ContextoSonido): EventoSonoro[] {
  const notas: EventoSonoro[] = [];
  const fin = (Math.ceil(duracion * FPS) - 1) / FPS;
  const l = linea(tiempos, fin);
  for (let i = 0; i < 7; i++) {
    notas.push({t: l.mapa + i * (pulso.negra / 4), frecuencia: hz(-12 + tono + [0, 3, 5, 7, 10, 12, 15][i]), volumenDb: -14, duracion: 0.08, brillo: 0.35});
  }

  // Cambios de lóbulo, en la semicorchea siguiente (sin repetir la misma curva en la misma semicorchea)
  const vistos = new Set<string>();
  for (const {t, curva, lado} of cambiosDeLobulo(l, FPS)) {
    const tq = cuantizar(t, pulso, 0.25, 'siguiente');
    const clave = `${curva}${tq.toFixed(3)}`;
    if (vistos.has(clave) || tq >= duracion - 0.2) continue;
    vistos.add(clave);
    const rosa = curva === 'rosa';
    notas.push({t: tq, frecuencia: hz(tono + (rosa ? (lado < 0 ? 7 : 12) : lado < 0 ? -5 : 0)), volumenDb: rosa ? -8 : -9, duracion: 0.18, brillo: rosa ? 0.6 : 0.35, pan: lado * 0.7});
  }

  // Cada corte de escena: aire que llega al corte y la impresora riso (la firma del canal en las
  // transiciones). Los golpes cortos de los empujones de cámara se quitaron con los empujones.
  const m = momentosDe(tiempos, l, pulso);
  for (const t of m.cortes) {
    notas.push({t, frecuencia: 0, volumenDb: -16, efecto: 'barrido', duracion: pulso.negra});
    notas.push({t, frecuencia: 0, volumenDb: -14, efecto: 'impresora', pan: 0.3});
  }
  return notas;
}
