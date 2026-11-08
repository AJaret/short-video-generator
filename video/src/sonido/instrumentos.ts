// Instrumentos y efectos del canal, sintetizados por código (deterministas por semilla).
//
// Firma sonora (CLAUDE.md §2): impresora riso en las transiciones, zumbido grave que crece antes de
// la revelación, música lo-fi ambient analógica de 70–85 BPM (vinilo + sintes de cinta).
import {mulberry32} from '../canal/prng';
import {
  biquad,
  envolvente,
  fundidos,
  hz,
  multiplicar,
  normalizarPico,
  normalizarRms,
  pasaAltos1,
  pasaBajos1,
  ruidoBlanco,
  silencio,
  sumarEn,
} from './sintesis';

// ───────────────────────────── Efectos ─────────────────────────────

/** "Tic" corto y afinado (un paso, un contador…). Pico ≈ 0 dBFS antes de aplicar ganancia. */
export function tic(sr: number, frecuencia: number, duracion = 0.12, brillo = 0.35): Float32Array {
  const n = Math.round(sr * duracion);
  const x = new Float32Array(n);
  const caida = duracion / 4;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const e = Math.min(1, i / (0.002 * sr)) * Math.exp(-t / caida);
    x[i] = e * (Math.sin(2 * Math.PI * frecuencia * t) + brillo * Math.sin(2 * Math.PI * 2 * frecuencia * t) * Math.exp(-t / (caida / 2)));
  }
  return normalizarPico(x, 0);
}

/**
 * Tic de Shepard: la misma nota en varias octavas, con más peso en las centrales (campana sobre el
 * logaritmo de la frecuencia). Si cada tic sube un escalón, el oído oye una subida sin fin que nunca
 * se vuelve chillona: ideal para "acelera y acelera".
 * `semitonos` = altura respecto a la4 (solo importa su clase: la octava la reparte la campana).
 */
export function ticShepard(sr: number, semitonos: number, duracion = 0.09): Float32Array {
  const n = Math.round(sr * duracion);
  const x = new Float32Array(n);
  const clase = ((semitonos % 12) + 12) % 12;
  const caida = duracion / 3.5;
  for (let octava = -3; octava <= 2; octava++) {
    const f = 440 * 2 ** ((clase + 12 * octava) / 12);
    const distancia = Math.log2(f / 523); // campana centrada en do5
    const peso = Math.exp(-(distancia * distancia) / (2 * 0.9 * 0.9));
    if (peso < 0.01) continue;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      x[i] += peso * Math.sin(2 * Math.PI * f * t) * Math.min(1, i / (0.002 * sr)) * Math.exp(-t / caida);
    }
  }
  return normalizarPico(x, 0);
}

/** Traqueteo de impresora riso: tambor que gira (clics rítmicos) + motor + papel que sale. */
export function impresora(sr: number, duracion = 0.9, semilla = 7): Float32Array {
  const x = silencio(sr, duracion);
  const azar = mulberry32(semilla);
  // Clics del tambor, ~14 por segundo, con ligera irregularidad
  for (let t = 0.02; t < duracion - 0.12; t += 1 / 14 + (azar() - 0.5) * 0.008) {
    const clic = ruidoBlanco(Math.round(sr * 0.018), Math.floor(azar() * 1e9));
    biquad(clic, sr, 'pasabanda', 2200 + azar() * 900, 1.4);
    multiplicar(clic, envolvente(clic.length, sr, 0.0005, 0.004));
    sumarEn(x, clic, sr, t, 0.55 + azar() * 0.3);
  }
  // Motor: zumbido grave con ruido
  const motor = ruidoBlanco(x.length, semilla + 1);
  pasaBajos1(pasaBajos1(motor, sr, 220), sr, 220);
  for (let i = 0; i < motor.length; i++) motor[i] = motor[i] * 6 + 0.12 * Math.sin((2 * Math.PI * 100 * i) / sr);
  fundidos(motor, sr, 0.05, 0.15);
  sumarEn(x, motor, sr, 0, 0.5);
  // Papel que sale: soplido de ruido al final
  const papel = ruidoBlanco(Math.round(sr * 0.25), semilla + 2);
  biquad(papel, sr, 'pasabanda', (i) => 1500 + (i / (sr * 0.25)) * 2500, 0.8);
  multiplicar(papel, (i) => Math.sin((Math.PI * i) / (sr * 0.25)));
  sumarEn(x, papel, sr, duracion - 0.3, 0.6);
  return normalizarPico(x, 0);
}

/** Golpe de sello: golpe grave + chasquido de papel. */
export function sello(sr: number, semilla = 11): Float32Array {
  const n = Math.round(sr * 0.35);
  const x = new Float32Array(n);
  let fase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const f = 50 + 70 * Math.exp(-t / 0.03);
    fase += (2 * Math.PI * f) / sr;
    x[i] = Math.sin(fase) * Math.exp(-t / 0.08);
  }
  const golpe = ruidoBlanco(Math.round(sr * 0.05), semilla);
  pasaBajos1(golpe, sr, 1800);
  multiplicar(golpe, envolvente(golpe.length, sr, 0.0005, 0.01));
  sumarEn(x, golpe, sr, 0, 2.5);
  return normalizarPico(x, 0);
}

/** Papel que se desliza (panel que sube o baja). `subiendo` decide el sentido del barrido. */
export function papel(sr: number, subiendo = true, duracion = 0.5, semilla = 13): Float32Array {
  const n = Math.round(sr * duracion);
  const x = ruidoBlanco(n, semilla);
  biquad(x, sr, 'pasabanda', (i) => {
    const f = i / n;
    return subiendo ? 700 + 2600 * f : 3300 - 2600 * f;
  }, 0.9);
  multiplicar(x, (i) => Math.sin(Math.PI * (i / n)) ** 1.5);
  return normalizarPico(x, 0);
}

/**
 * Zumbido grave que crece hasta la revelación: notas graves desafinadas entre sí (batimiento) con
 * un filtro que se abre. Termina en seco (con 25 ms de fundido) justo cuando llega la revelación.
 */
export function zumbido(sr: number, duracion = 4, semilla = 17): Float32Array {
  const n = Math.round(sr * duracion);
  const x = new Float32Array(n);
  const voces = [
    {f: 55, g: 1},
    {f: 55.6, g: 0.8},
    {f: 110.3, g: 0.45},
    {f: 82.4, g: 0.3},
  ];
  for (const {f, g} of voces) {
    let fase = 0;
    for (let i = 0; i < n; i++) {
      fase += f / sr;
      const diente = 2 * (fase - Math.floor(fase + 0.5)); // diente de sierra
      x[i] += g * diente;
    }
  }
  biquad(x, sr, 'pasabajos', (i) => 120 + 900 * (i / n) ** 2, 1.2);
  const aire = ruidoBlanco(n, semilla);
  biquad(aire, sr, 'pasabanda', (i) => 200 + 1200 * (i / n) ** 2, 2);
  sumarEn(x, aire, sr, 0, 0.15);
  multiplicar(x, (i) => (i / n) ** 1.6);
  fundidos(x, sr, 0, 0.025);
  return normalizarPico(x, 0);
}

// ───────────────────────────── Música lo-fi ─────────────────────────────

/** Acordes (semitonos respecto a la4) — progresión de cuatro compases en la menor. */
const ACORDES = [
  [-24, -12, -5, 0, 3, 7], // Am9 (la, mi, la, do, mi… con 9ª = si en la voz alta abajo)
  [-28, -16, -9, -5, 0, 4], // Fmaj7 (fa, do, mi, la)
  [-21, -9, -5, -2, 2, 7], // Cmaj7/do
  [-26, -14, -7, -2, 2, 5], // G6 (sol, re, mi, si)
];

/** Piano eléctrico tipo Rhodes: parciales con caída y un leve trémolo. */
function rhodes(sr: number, f: number, duracion: number, velocidad: number): Float32Array {
  const n = Math.round(sr * duracion);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const e = Math.min(1, t / 0.006) * Math.exp(-t / (0.9 + 0.6 * velocidad));
    const campana = 0.25 * velocidad * Math.sin(2 * Math.PI * f * 4.01 * t) * Math.exp(-t / 0.08);
    x[i] = e * (Math.sin(2 * Math.PI * f * t) + 0.22 * Math.sin(2 * Math.PI * 2 * f * t) + campana) * (1 + 0.08 * Math.sin(2 * Math.PI * 4.2 * t));
  }
  return x;
}

/** Colchón de sintetizador de cinta: dientes de sierra desafinados y filtrados, ataque lento. */
function colchon(sr: number, notas: number[], duracion: number): Float32Array {
  const n = Math.round(sr * duracion);
  const x = new Float32Array(n);
  for (const nota of notas) {
    for (const desafine of [-0.06, 0.07]) {
      const f = hz(nota + desafine);
      let fase = 0;
      for (let i = 0; i < n; i++) {
        fase += f / sr;
        x[i] += 2 * (fase - Math.floor(fase + 0.5));
      }
    }
  }
  biquad(x, sr, 'pasabajos', 900, 0.7);
  multiplicar(x, (i) => Math.min(1, i / (0.6 * sr)) * Math.min(1, (n - i) / (0.4 * sr)));
  return x;
}

function bombo(sr: number): Float32Array {
  const n = Math.round(sr * 0.28);
  const x = new Float32Array(n);
  let fase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    fase += (2 * Math.PI * (45 + 70 * Math.exp(-t / 0.025))) / sr;
    x[i] = Math.sin(fase) * Math.exp(-t / 0.09);
  }
  return x;
}

function escobilla(sr: number, semilla: number): Float32Array {
  const x = ruidoBlanco(Math.round(sr * 0.22), semilla);
  biquad(x, sr, 'pasabanda', 2800, 0.6);
  multiplicar(x, envolvente(x.length, sr, 0.004, 0.06));
  return x;
}

function platillo(sr: number, semilla: number): Float32Array {
  const x = ruidoBlanco(Math.round(sr * 0.05), semilla);
  pasaAltos1(pasaAltos1(x, sr, 6000), sr, 6000);
  multiplicar(x, envolvente(x.length, sr, 0.001, 0.012));
  return x;
}

/**
 * Pista lo-fi ambient de `duracion` segundos: 78 BPM, la menor, Rhodes + colchón de cinta + bajo +
 * batería con escobillas y swing, todo con "wow & flutter" de cinta y crujido de vinilo.
 * Normalizada a −20 dB RMS (la mezcla decide el volumen final).
 */
export function musicaLofi(sr: number, duracion: number, semilla = 78, bpm = 78): Float32Array {
  const azar = mulberry32(semilla);
  const negra = 60 / bpm;
  const compas = negra * 4;
  const largo = duracion + 1;
  const piano = silencio(sr, largo);
  const pads = silencio(sr, largo);
  const bajo = silencio(sr, largo);
  const bateria = silencio(sr, largo);

  for (let c = 0; c * compas < largo; c++) {
    const t0 = c * compas;
    const acorde = ACORDES[c % ACORDES.length];
    // Rhodes: acorde rasgueado en el 1 y en el "y" del 3
    for (const [tiempo, vel] of [[0, 0.9], [2.5, 0.55]] as const) {
      acorde.slice(1).forEach((nota, k) => {
        const v = vel * (0.8 + azar() * 0.2);
        sumarEn(piano, rhodes(sr, hz(nota), compas * 0.9, v), sr, t0 + tiempo * negra + k * 0.012 + azar() * 0.006, v / acorde.length);
      });
    }
    // Colchón: el acorde completo, todo el compás
    sumarEn(pads, colchon(sr, acorde.slice(2, 5), compas + 0.3), sr, t0, 0.05);
    // Bajo: fundamental en el 1 y el 3
    for (const tiempo of [0, 2]) {
      const n = Math.round(sr * negra * 1.6);
      const b = new Float32Array(n);
      const f = hz(acorde[0]);
      for (let i = 0; i < n; i++) b[i] = Math.sin((2 * Math.PI * f * i) / sr) * Math.min(1, i / (0.01 * sr)) * Math.exp(-i / (0.5 * sr));
      sumarEn(bajo, b, sr, t0 + tiempo * negra, 0.5);
    }
    // Batería con swing (corcheas al 58 %)
    sumarEn(bateria, bombo(sr), sr, t0, 0.9);
    sumarEn(bateria, bombo(sr), sr, t0 + 2.5 * negra, 0.5);
    for (const tiempo of [1, 3]) sumarEn(bateria, escobilla(sr, c * 10 + tiempo), sr, t0 + tiempo * negra, 0.35);
    for (let k = 0; k < 8; k++) {
      const swing = k % 2 === 1 ? 0.58 : 0.5;
      const t = t0 + (Math.floor(k / 2) + (k % 2 ? swing : 0)) * negra;
      sumarEn(bateria, platillo(sr, c * 100 + k), sr, t, k % 2 ? 0.12 : 0.18);
    }
  }

  // Mezcla de la banda
  const banda = silencio(sr, largo);
  sumarEn(banda, piano, sr, 0, 0.55);
  sumarEn(banda, pads, sr, 0, 1);
  sumarEn(banda, bajo, sr, 0, 0.55);
  sumarEn(banda, bateria, sr, 0, 0.45);

  // Cinta: "wow" lento y "flutter" rápido modulando la velocidad de lectura
  const cinta = new Float32Array(Math.round(sr * duracion));
  for (let i = 0; i < cinta.length; i++) {
    const t = i / sr;
    const desvio = 0.0025 * Math.sin(2 * Math.PI * 0.55 * t) + 0.0006 * Math.sin(2 * Math.PI * 6.3 * t);
    const p = i * (1 + desvio) + 200;
    const k = Math.floor(p);
    const f = p - k;
    cinta[i] = (banda[k] ?? 0) * (1 - f) + (banda[k + 1] ?? 0) * f;
  }
  // Calidez lo-fi: recorte suave de agudos
  biquad(cinta, sr, 'pasabajos', 5200, 0.6);

  // Vinilo: siseo muy bajo + crujidos aleatorios
  const siseo = ruidoBlanco(cinta.length, semilla + 1);
  biquad(siseo, sr, 'pasabanda', 4000, 0.5);
  sumarEn(cinta, siseo, sr, 0, 0.012);
  for (let t = 0; t < duracion; t += 0.02 + azar() * 0.25) {
    const crujido = ruidoBlanco(Math.round(sr * 0.002), Math.floor(azar() * 1e9));
    pasaAltos1(crujido, sr, 1500);
    sumarEn(cinta, crujido, sr, t, 0.04 + azar() * 0.1);
  }

  fundidos(cinta, sr, 1.2, 1.5);
  return normalizarRms(cinta, -20);
}
