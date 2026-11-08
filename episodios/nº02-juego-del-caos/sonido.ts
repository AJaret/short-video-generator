// nº02 · Sonido propio del episodio, en el pulso de la música.
//
// Cada esquina es una nota del acorde de La menor (la, do, mi; en el cuadrado, también sol): el
// dado toca un arpegio al azar que siempre suena "afinado" con la música.
//   · Tiradas lentas: una nota por tiempo, paneada según la esquina.
//   · Aceleración: una nota por semicorchea, cada vez más fuerte; calla un tiempo antes de la revelación.
//   · Revelación y "vuelve el orden": impresora (se imprime todo de golpe; el golpe lo pone la música).
//   · Zoom: un tic agudo en cada ×2. Esquema: papel al encogerse; una campanita por copia.
//   · Cuadrado: semicorcheas mientras se llena; papel en el barrido de la regla nueva.
//   · Tetraedro: tics suaves mientras se construye; un golpe grave en cada salto del giro.
//   · Final: una nota por tirada, hasta la de portada.
//   · Cortes de escena: impresora riso.
import type {ContextoSonido, EventoSonoro} from '@sonido/banda';
import {hz} from '@sonido/sintesis';
import {corteDe} from '@canal/transiciones';
import {
  linea,
  PUNTOS_PORTADA,
  saltoVisible,
  semicorcheasAceleracion,
  semicorcheasCuadrado,
  tiradasCuadrado,
  transiciones,
} from './linea';
import {JUEGO_COPO, JUEGO_CUADRADO, JUEGO_TRIANGULO} from './simulacion';

/** Nota (semitonos respecto a la4) y paneo de cada esquina. */
const NOTAS_TRI = [-12, -9, -5]; // la3, do4, mi4
const PAN_TRI = [-0.5, 0.5, 0];
const NOTAS_CUAD = [-12, -9, -5, -2]; // + sol4
const PAN_CUAD = [-0.5, 0.5, 0.5, -0.5];

export function eventos({tiempos, duracion, pulso}: ContextoSonido): EventoSonoro[] {
  const l = linea(tiempos, duracion, pulso);
  const lista: EventoSonoro[] = [];
  const tri = JUEGO_TRIANGULO;

  // 1. Tiradas lentas
  for (let k = 0; k < l.lentos; k++) {
    const e = tri.esquina[k];
    lista.push({t: l.tTira + k * l.negra, frecuencia: hz(NOTAS_TRI[e]), volumenDb: -2, duracion: 0.28, brillo: 0.45, pan: PAN_TRI[e]});
  }

  // 2. Aceleración (las mismas tiradas que se ven saltar)
  const semis = semicorcheasAceleracion(l);
  semis.forEach((s, i) => {
    const v = saltoVisible(s + 1e-4, l);
    if (!v) return;
    const e = tri.esquina[v.indice];
    lista.push({t: s, frecuencia: hz(NOTAS_TRI[e] + 12), volumenDb: -14 + (8 * i) / Math.max(1, semis.length - 1), duracion: 0.08, brillo: 0.4, pan: PAN_TRI[e] * 0.7});
  });

  // 3. Impresiones de golpe
  lista.push({t: l.tRevela, frecuencia: 0, volumenDb: -4, efecto: 'impresora'});
  lista.push({t: l.tOrden, frecuencia: 0, volumenDb: -4, efecto: 'impresora'});

  // 4. Zoom y esquema
  lista.push({t: l.tZoom, frecuencia: hz(12), volumenDb: -8, duracion: 0.2, brillo: 0.7});
  lista.push({t: l.tZoom + l.negra, frecuencia: hz(19), volumenDb: -8, duracion: 0.2, brillo: 0.7});
  lista.push({t: l.tSuerte, frecuencia: hz(0), volumenDb: -10, duracion: 0.3, brillo: 0.4});
  lista.push({t: l.tEncoge, frecuencia: 0, volumenDb: -6, efecto: 'papel'});
  [0, 1, 2].forEach((i) => lista.push({t: l.tCopias + i * l.negra, frecuencia: hz(NOTAS_TRI[i] + 24), volumenDb: -6, duracion: 0.35, brillo: 0.7, pan: PAN_TRI[i]}));

  // 5. Cuadrado
  const {ruido, copo} = semicorcheasCuadrado(l);
  ruido.forEach((s, i) => {
    const n = Math.max(1, tiradasCuadrado(s + 1e-4, l).ruido);
    const e = JUEGO_CUADRADO.esquina[n - 1];
    lista.push({t: s, frecuencia: hz(NOTAS_CUAD[e] + 12), volumenDb: -13 + (5 * i) / Math.max(1, ruido.length - 1), duracion: 0.07, brillo: 0.35, pan: PAN_CUAD[e] * 0.7});
  });
  lista.push({t: l.tRegla, frecuencia: 0, volumenDb: -6, efecto: 'papel'});
  copo.forEach((s, i) => {
    const n = Math.max(1, tiradasCuadrado(s + 1e-4, l).copo);
    const e = JUEGO_COPO.esquina[n - 1];
    lista.push({t: s, frecuencia: hz(NOTAS_CUAD[e] + 12), volumenDb: -14 + (8 * i) / Math.max(1, copo.length - 1), duracion: 0.07, brillo: 0.45, pan: PAN_CUAD[e] * 0.7});
  });

  // 6. Tetraedro
  for (let s = l.tConstruye; s < l.tTetra + 2 * l.negra - 1e-6; s += l.negra / 2) {
    lista.push({t: s, frecuencia: hz(24 + ((Math.round((s - l.tConstruye) / (l.negra / 2)) * 7) % 12)), volumenDb: -16, duracion: 0.06, brillo: 0.3});
  }
  for (let s = l.tGira; s < l.tVisto + 1e-6; s += l.negra) lista.push({t: s, frecuencia: hz(-24), volumenDb: -4, duracion: 0.35, brillo: 0.25});

  // 7. Final: una nota por tirada hasta la de portada
  const k = Math.round((l.tTiraOtra - l.tFinal) / l.negra);
  for (let i = 0; i <= k; i++) {
    const e = tri.esquina[PUNTOS_PORTADA - k + i - 1];
    lista.push({t: l.tFinal + i * l.negra, frecuencia: hz(NOTAS_TRI[e]), volumenDb: -8 - i, duracion: 0.28, brillo: 0.4, pan: PAN_TRI[e]});
  }

  // 8. Cortes de escena
  for (const tr of transiciones(l)) lista.push({t: corteDe(tr, pulso) - 0.05, frecuencia: 0, volumenDb: -8, efecto: 'impresora'});
  return lista;
}
