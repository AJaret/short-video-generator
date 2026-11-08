// Instrumentos y efectos del canal, sintetizados por código (deterministas por semilla).
//
// Firma sonora (CLAUDE.md §2): impresora riso en las transiciones y zumbido grave que crece antes
// de la revelación. La música (musica.ts) usa los instrumentos del final de este archivo.
import {mulberry32} from '../canal/prng';
import {
  biquad,
  envolvente,
  fundidos,
  multiplicar,
  normalizarPico,
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

// ───────────────────────────── Instrumentos de la música ─────────────────────────────

/** Marimba: parciales 1, ≈4 y ≈10 (los de una lámina de madera) con caídas cortas + golpe de maza. */
export function marimba(sr: number, f: number, velocidad = 1): Float32Array {
  const n = Math.round(sr * 1.2);
  const x = new Float32Array(n);
  const parciales: [number, number, number][] = [[1, 1, 0.55], [3.99, 0.3, 0.12], [9.9, 0.07, 0.035]];
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let s = 0;
    for (const [m, g, c] of parciales) s += g * Math.sin(2 * Math.PI * f * m * t) * Math.exp(-t / c);
    x[i] = s * Math.min(1, i / (0.0015 * sr)) * velocidad;
  }
  const maza = ruidoBlanco(Math.round(sr * 0.01), Math.round(f * 7));
  pasaBajos1(maza, sr, 3000);
  multiplicar(maza, envolvente(maza.length, sr, 0.0003, 0.002));
  sumarEn(x, maza, sr, 0, 0.15 * velocidad);
  return x;
}

/** Campanita FM: el índice de modulación cae rápido (ataque brillante, cola redonda). */
export function campanaFM(sr: number, f: number, velocidad = 1, caida = 0.4): Float32Array {
  const n = Math.round(sr * caida * 4);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const indice = 2.8 * Math.exp(-t / 0.05);
    x[i] = velocidad * Math.sin(2 * Math.PI * f * t + indice * Math.sin(2 * Math.PI * f * 2 * t)) * Math.exp(-t / caida) * Math.min(1, i / (0.001 * sr));
  }
  return x;
}

/** Sub-grave: seno con una pizca de saturación (se oye también en altavoces pequeños). */
export function subBajo(sr: number, f: number, duracion: number): Float32Array {
  const n = Math.round(sr * duracion);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const e = Math.min(1, t / 0.01) * Math.min(1, (duracion - t) / 0.05);
    x[i] = Math.tanh(1.6 * Math.sin(2 * Math.PI * f * t)) * e * 0.7;
  }
  return x;
}

export function bombo(sr: number): Float32Array {
  const n = Math.round(sr * 0.35);
  const x = new Float32Array(n);
  let fase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    fase += (2 * Math.PI * (48 + 90 * Math.exp(-t / 0.03))) / sr;
    x[i] = Math.tanh(1.5 * Math.sin(fase)) * Math.exp(-t / 0.12);
  }
  return x;
}

/** Golpe de aro / bloque de madera. */
export function aro(sr: number, f = 1100): Float32Array {
  const n = Math.round(sr * 0.12);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = Math.sin(2 * Math.PI * f * (i / sr)) * Math.exp(-i / (0.025 * sr));
  return x;
}

export function shaker(sr: number, semilla: number): Float32Array {
  const x = ruidoBlanco(Math.round(sr * 0.09), semilla);
  biquad(x, sr, 'pasabanda', 6500, 1.2);
  return multiplicar(x, (i) => Math.sin((Math.PI * i) / (sr * 0.09)) ** 2);
}

/** Platillo de golpe (revelación): ruido brillante con cola larga. */
export function platillo(sr: number, semilla: number, duracion = 1.6): Float32Array {
  const x = ruidoBlanco(Math.round(sr * duracion), semilla);
  pasaAltos1(pasaAltos1(x, sr, 4500), sr, 4500);
  biquad(x, sr, 'pasabajos', 11000, 0.7);
  return multiplicar(x, envolvente(x.length, sr, 0.002, duracion / 5));
}

/** Golpe grave cinematográfico (revelación): caída de tono larga y saturada. */
export function golpeGrave(sr: number): Float32Array {
  const n = Math.round(sr * 1.4);
  const x = new Float32Array(n);
  let fase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    fase += (2 * Math.PI * (38 + 70 * Math.exp(-t / 0.06))) / sr;
    x[i] = Math.tanh(2 * Math.sin(fase)) * Math.exp(-t / 0.45);
  }
  return x;
}
