// Música "edición" (prueba de nº08b, 2026-11-14): electrónica compuesta A PARTIR DE LA IMAGEN.
//
// Las otras dos músicas del canal (musica.ts) siguen un plan de intensidad y la imagen se ajusta a
// su pulso. Aquí es al revés: el episodio entrega una PARTITURA (sonido.ts → partitura()) sacada de
// su misma línea de tiempo, y cada cosa que pasa en pantalla tiene su sonido:
//   · cada corte de escena: bombo + sub + palmada, con un hueco de silencio y aire que sube justo antes;
//   · cada gesto (una ciudad que aparece, un copo que cae, una cifra que entra): una nota;
//   · cada glitch de la imagen: una ráfaga de ruido digital;
//   · las secciones (nivel 0…3) deciden qué capas del ritmo suenan entre corte y corte.
// Carácter (de la referencia del usuario, sin copiar su pista): menor, sub-grave largo tipo 808, notas
// punteadas con silencios, ritmo a medio tiempo y paradas en seco. Va al tempo del episodio (92 BPM).
//
// Armonía: i – VI – III – VII, un acorde por compás, en la tonalidad del episodio. Módulo PURO.
import {mulberry32} from '../canal/prng';
import type {Pulso} from '../canal/pulso';
import {barrido, bombo, golpeGrave, hatAbierto, hatCerrado, palmada, platillo} from './instrumentos';
import {golpeMuestreado, notaMuestreada, type BancoMuestras} from './muestreo';
import {biquad, ecoPingPong, estereo, fundidos, hz, normalizarPico, pasaAltos1, rmsEstereo, sumarPaneado, type Estereo} from './sintesis';

export type VozNota = 'pluck' | 'campana' | 'clic' | 'grave';

export type Partitura = {
  /** Energía del ritmo desde cada momento: 0 = solo los gestos, 1 = pulso mínimo, 2 = ritmo, 3 = todo. */
  secciones: {desde: number; nivel: 0 | 1 | 2 | 3}[];
  /** Cortes de escena. `hueco` = segundos de silencio justo antes (por defecto una semicorchea; 0 = ninguno). */
  cortes: {t: number; fuerza?: number; hueco?: number}[];
  /** Golpes grandes (la revelación): platillo + grave + acorde. */
  golpes: number[];
  /** Silencios de la base: [desde, hasta]. Los gestos y los glitches siguen sonando. */
  paradas: [number, number][];
  /** Subidas [desde, hasta]: redoble que acelera y aire que crece hasta `hasta`. */
  subidas: [number, number][];
  /** Notas de un gesto de la imagen. `nota` en semitonos respecto a la tónica (0 = tónica central). */
  notas: {t: number; nota: number; voz?: VozNota; vel?: number; pan?: number; dur?: number}[];
  /** Ráfagas de ruido digital (el glitch de la imagen). */
  glitches: {t: number; dur: number; vel?: number}[];
  /** Acorde final (el fotograma del loop). */
  final: number;
};

/** i – VI – III – VII: voces del acorde y raíz del bajo, en semitonos respecto a la tónica. */
const ACORDES = [[0, 3, 7, 12], [-4, 0, 3, 8], [-9, 3, 7, 10], [-2, 2, 5, 10]];
const RAICES = [0, -4, 3, -2];
/** Arpegio en semicorcheas (índices del acorde): grupos 3+3+2. */
const ARPEGIO = [0, 2, 3, 1, 2, 3, 0, 3];
/** Gancho de 2 compases en corcheas (grados de la pentatónica menor; null = silencio). */
const GANCHO = [7, null, 10, 7, null, 12, 10, null, 7, null, 5, 7, null, 3, 5, null];
const PENTA = [0, 3, 5, 7, 10];
export const penta = (k: number) => 12 * Math.floor(k / 5) + PENTA[((k % 5) + 5) % 5];

// ── Instrumentos ──────────────────────────────────────────────────────────────────────────────

/** Sub tipo 808: seno saturado con una caída de tono al atacar. */
function sub808(sr: number, f: number, duracion: number, golpe = 1): Float32Array {
  const n = Math.round(sr * duracion);
  const x = new Float32Array(n);
  let fase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    fase += (2 * Math.PI * f * (1 + 1.6 * golpe * Math.exp(-t / 0.03))) / sr;
    const e = Math.min(1, t / 0.004) * Math.exp(-t / (duracion * 0.55)) * Math.min(1, (duracion - t) / 0.03);
    x[i] = Math.tanh(2.2 * Math.sin(fase)) * e * 0.8;
  }
  return x;
}

/** Nota punteada: dos sierras desafinadas y un filtro que se cierra deprisa. */
function pluck(sr: number, f: number, duracion = 0.32, brillo = 1): Float32Array {
  const n = Math.round(sr * duracion);
  const x = new Float32Array(n);
  let a = 0, b = 0.37, c = 0;
  for (let i = 0; i < n; i++) {
    a += (f * 1.004) / sr;
    b += (f * 0.996) / sr;
    c += (f * 0.5) / sr;
    const sierra = (p: number) => 2 * (p - Math.floor(p + 0.5));
    x[i] = 0.5 * sierra(a) + 0.5 * sierra(b) + 0.35 * Math.sign(Math.sin(2 * Math.PI * c));
  }
  biquad(x, sr, 'pasabajos', (i) => Math.min(9000, f * 1.2 + 4200 * brillo * Math.exp(-i / sr / 0.055)), 1.6);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    x[i] *= Math.min(1, t / 0.002) * Math.exp(-t / (duracion * 0.33)) * Math.min(1, (duracion - t) / 0.01);
  }
  return x;
}

/** Acorde en colchón corto: sierras desafinadas con el filtro bajo (el que "bombea" con el bombo). */
function colchon(sr: number, notas: number[], tonica: number, duracion: number, brillo = 1): Float32Array {
  const n = Math.round(sr * duracion);
  const x = new Float32Array(n);
  notas.forEach((nota, k) => {
    for (const desafino of [0.994, 1, 1.006]) {
      const f = hz(tonica + nota) * desafino;
      let p = (k * 0.31 + desafino * 7) % 1;
      for (let i = 0; i < n; i++) {
        p += f / sr;
        x[i] += 2 * (p - Math.floor(p + 0.5));
      }
    }
  });
  biquad(x, sr, 'pasabajos', (i) => 500 + 1700 * brillo * Math.exp(-i / sr / (duracion * 0.5)), 0.9);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    x[i] *= Math.min(1, t / 0.012) * Math.min(1, (duracion - t) / 0.08) / (notas.length * 3);
  }
  return x;
}

/** Clic digital afinado: unos pocos ciclos de onda cuadrada (los "bips" de la capa técnica). */
function clic(sr: number, f: number, duracion = 0.05): Float32Array {
  const n = Math.round(sr * duracion);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    x[i] = (Math.sign(Math.sin(2 * Math.PI * f * t)) * 0.6 + Math.sin(2 * Math.PI * f * t)) * Math.exp(-t / (duracion * 0.22)) * Math.min(1, t / 0.0006);
  }
  pasaAltos1(x, sr, 300);
  return x;
}

/** Ráfaga de glitch: ruido de muestreo y retención que cambia de ritmo a trozos, modulado en anillo. */
function rafaga(sr: number, duracion: number, semilla: number): Float32Array {
  const n = Math.round(sr * duracion);
  const x = new Float32Array(n);
  const azar = mulberry32(semilla * 97 + 13);
  let valor = 0;
  let retener = 8;
  let anillo = 180;
  let puerta = 1;
  for (let i = 0; i < n; i++) {
    if (i % Math.round(sr * 0.011) === 0) {
      retener = 3 + Math.floor(azar() * 60);
      anillo = 60 + azar() * 900;
      puerta = azar() < 0.22 ? 0 : 1;
    }
    if (i % retener === 0) valor = azar() * 2 - 1;
    x[i] = valor * Math.sign(Math.sin((2 * Math.PI * anillo * i) / sr)) * puerta;
  }
  biquad(x, sr, 'pasabanda', 2400, 0.5);
  fundidos(x, sr, 0.001, 0.004);
  return normalizarPico(x, 0);
}

/** Subida de tono: una sierra filtrada que sube una octava y crece (se suma al aire del barrido). */
function subidaTonal(sr: number, f: number, duracion: number): Float32Array {
  const n = Math.round(sr * duracion);
  const x = new Float32Array(n);
  let p = 0;
  for (let i = 0; i < n; i++) {
    const u = i / n;
    p += (f * 2 ** u) / sr;
    x[i] = 2 * (p - Math.floor(p + 0.5)) * u ** 2;
  }
  biquad(x, sr, 'pasabajos', (i) => 400 + 5000 * (i / n) ** 2, 1.2);
  fundidos(x, sr, 0, 0.008);
  return x;
}

// ── Composición ───────────────────────────────────────────────────────────────────────────────

/**
 * Devuelve `base` (lo que baja cuando habla la voz) y `acentos` (cortes, golpes y gestos: no bajan).
 * `tono` = semitonos de la tónica respecto a La (Fa menor = −4). La base sale a −20 dB RMS.
 */
export function musicaEdicion(
  sr: number,
  duracion: number,
  pulso: Pulso,
  partitura: Partitura,
  tono: number,
  semilla = 92,
  banco?: BancoMuestras,
): {base: Estereo; acentos: Estereo} {
  const negra = pulso.negra;
  const semi = negra / 4;
  const azar = mulberry32(semilla);
  const armonia = estereo(sr, duracion); // colchón, arpegio y gancho: bombean con el bombo
  const ritmo = estereo(sr, duracion);
  const acentos = estereo(sr, duracion);
  const f = (n: number) => hz(n + tono);
  /** Raíz del sub: nunca por debajo de ~41 Hz (los altavoces del móvil ya no la dan). */
  const fSub = (raiz: number) => {
    let n = raiz - 36;
    while (f(n) < 41) n += 12;
    return f(n);
  };
  const nota = (inst: string, n: number, fuerte: boolean, alt: () => Float32Array) => (banco && notaMuestreada(banco, inst, 69 + n + tono, sr, fuerte)) || alt();
  const golpeDe = (inst: string, i: number, alt: () => Float32Array) => (banco && golpeMuestreado(banco, inst, i, sr)) || alt();
  const secciones = [...partitura.secciones].sort((a, b) => a.desde - b.desde);
  const nivelEn = (t: number) => {
    let nivel = 0;
    for (const s of secciones) if (t >= s.desde - 1e-6) nivel = s.nivel;
    return t >= partitura.final ? 0 : nivel;
  };
  const acordeEn = (t: number) => Math.floor(t / pulso.compas + 1e-6) % 4;
  const bombos: number[] = [];
  const darBombo = (t: number, g: number, destino = ritmo) => {
    sumarPaneado(destino, bombo(sr), sr, t, g);
    bombos.push(t);
  };

  // 1. El ritmo entre corte y corte, sobre la rejilla absoluta (t = 0 es el compás 0)
  const tiempos = Math.ceil(duracion / negra);
  for (let b = 0; b < tiempos; b++) {
    const t = b * negra;
    const compas = Math.floor(b / 4);
    const enCompas = b % 4;
    const N = nivelEn(t + 1e-4);
    const acorde = ACORDES[compas % 4];
    const raiz = RAICES[compas % 4];
    if (N === 0) continue;

    // Sub largo en el 1 (y a medio compás si hay ritmo)
    if (enCompas === 0) sumarPaneado(ritmo, sub808(sr, fSub(raiz), negra * (N >= 2 ? 1.6 : 2.6), 0.6), sr, t, 0.27);
    if (N >= 2 && enCompas === 2) sumarPaneado(ritmo, sub808(sr, fSub(raiz), negra * 0.9, 0.6), sr, t + negra * 0.5, 0.23);
    if (N >= 3 && enCompas === 3) sumarPaneado(ritmo, sub808(sr, fSub(raiz + (compas % 2 ? 7 : 0)), negra * 0.45, 0.6), sr, t + negra * 0.5, 0.2);

    // Colchón: el acorde entero en el 1, oscuro en nivel 1 y más abierto después
    if (enCompas === 0) sumarPaneado(armonia, colchon(sr, acorde, tono - 12, negra * 3.5, N >= 2 ? 1 : 0.65), sr, t, 0.85, -0.1);
    if (N >= 3 && enCompas === 2) sumarPaneado(armonia, colchon(sr, acorde, tono, negra * 0.7, 1.4), sr, t + negra * 0.5, 0.5, 0.25);

    // Arpegio punteado: corcheas en nivel 1, semicorcheas (3+3+2) desde el 2
    const porTiempo = N >= 2 ? 4 : 2;
    for (let j = 0; j < porTiempo; j++) {
      const k = b * 4 + j * (4 / porTiempo);
      const acento = k % 8 === 0 || k % 8 === 3 || k % 8 === 6;
      const n = acorde[ARPEGIO[k % 8]] + (compas % 2 === 1 && k % 16 >= 8 ? 12 : 0);
      const vel = (acento ? 0.9 : 0.5) * (0.62 + 0.13 * N) * (0.85 + 0.15 * azar());
      sumarPaneado(armonia, pluck(sr, f(n), 0.3, 0.5 + 0.3 * N), sr, t + j * (negra / porTiempo), 0.44 * vel, Math.sin(k * 0.9 + compas) * 0.7);
    }

    // Gancho (vibráfono real) a tope
    if (N >= 3) {
      for (let j = 0; j < 2; j++) {
        const g = GANCHO[(b * 2 + j) % GANCHO.length];
        if (g === null) continue;
        sumarPaneado(armonia, nota('vibrafono', g + 12, true, () => pluck(sr, f(g + 12), 0.5, 1.5)), sr, t + j * negra * 0.5, 0.22, 0.3);
      }
    }

    // Batería a medio tiempo: bombo en el 1 (y en el "y" del 2), caja + palmada en el 3
    if (N >= 2 && enCompas === 0) darBombo(t, 0.7);
    if (N >= 2 && enCompas === 1) darBombo(t + negra * 0.5, 0.5);
    if (N >= 3 && enCompas === 3) darBombo(t + negra * 0.25, 0.42);
    if (N >= 2 && enCompas === 2) {
      sumarPaneado(ritmo, golpeDe('caja', b, () => palmada(sr, b)), sr, t, 0.32, 0.05);
      sumarPaneado(ritmo, golpeDe('palmada', b, () => palmada(sr, b + 1)), sr, t + 0.004, 0.26, -0.12);
    }
    // Hi-hat: corcheas suaves en nivel 1, semicorcheas con acentos desde el 2, y un redoble de fusas al acabar el compás
    const divisiones = N >= 2 ? 4 : 2;
    for (let j = 0; j < divisiones; j++) {
      const vel = divisiones === 4 ? [0.55, 0.3, 0.85, 0.35][j] : [0.35, 0.7][j];
      sumarPaneado(ritmo, golpeDe('hat', b * 4 + j, () => hatCerrado(sr, b * 4 + j)), sr, t + j * (negra / divisiones), 0.25 * vel * (N === 1 ? 0.7 : 1), 0.3);
    }
    if (N >= 2 && enCompas === 3 && compas % 2 === 1) {
      for (let j = 0; j < 4; j++) sumarPaneado(ritmo, golpeDe('hat', b * 9 + j, () => hatCerrado(sr, b * 9 + j)), sr, t + negra * 0.5 + j * (negra / 8), 0.14 + 0.04 * j, -0.3);
    }
    if (N >= 3 && (enCompas === 1 || enCompas === 3)) sumarPaneado(ritmo, golpeDe('hatAbierto', b, () => hatAbierto(sr, b)), sr, t + negra * 0.5, 0.18, 0.35);
  }

  // 2. Subidas: redoble de caja que acelera, aire y tono que suben hasta el final del tramo
  for (const [desde, hasta] of partitura.subidas) {
    const largo = hasta - desde;
    if (largo <= 0.05) continue;
    let s = desde;
    let i = 0;
    while (s < hasta - 0.01) {
      const u = (s - desde) / largo;
      sumarPaneado(ritmo, golpeDe('caja', i, () => palmada(sr, i)), sr, s, 0.06 + 0.26 * u, i % 2 ? 0.15 : -0.15);
      s += u < 0.5 ? negra / 2 : u < 0.8 ? negra / 4 : negra / 8;
      i++;
    }
    sumarPaneado(acentos, barrido(sr, largo, Math.round(desde * 100)), sr, desde, 0.34, 0.1);
    sumarPaneado(acentos, subidaTonal(sr, f(-12), largo), sr, desde, 0.22, -0.1);
  }

  // 3. Bombeo: el colchón y el arpegio se agachan con cada bombo (el pulso de la electrónica)
  bombos.sort((a, b) => a - b);
  let ib = 0;
  for (let i = 0; i < armonia.l.length; i++) {
    const t = i / sr;
    while (ib + 1 < bombos.length && bombos[ib + 1] <= t) ib++;
    const dt = bombos.length && bombos[ib] <= t ? t - bombos[ib] : 1;
    const g = dt < 0.28 ? 0.3 + 0.7 * (dt / 0.28) ** 1.5 : 1;
    armonia.l[i] *= g;
    armonia.r[i] *= g;
  }
  ecoPingPong(armonia, sr, negra * 0.75, 0.3, 0.26);
  const base = estereo(sr, duracion);
  for (let i = 0; i < base.l.length; i++) {
    base.l[i] = armonia.l[i] + ritmo.l[i];
    base.r[i] = armonia.r[i] + ritmo.r[i];
  }

  // 4. Silencios de la base: las paradas y el hueco antes de cada corte (rampas de 8 ms)
  const huecos: [number, number][] = [...partitura.paradas];
  for (const c of partitura.cortes) {
    const hueco = c.hueco ?? semi;
    if (hueco > 0) huecos.push([c.t - hueco, c.t]);
  }
  const rampa = 0.008;
  for (const [desde, hasta] of huecos) {
    for (let i = Math.max(0, Math.round((desde - rampa) * sr)); i < Math.min(base.l.length, Math.round(hasta * sr)); i++) {
      const s = i / sr;
      const g = s < desde ? (desde - s) / rampa : 0;
      base.l[i] *= g;
      base.r[i] *= g;
    }
  }
  // Después del acorde final solo queda su cola
  for (let i = Math.round(partitura.final * sr); i < base.l.length; i++) {
    const g = Math.max(0, 1 - (i / sr - partitura.final) / 0.02);
    base.l[i] *= g;
    base.r[i] *= g;
  }

  // 5. Cortes: bombo + sub del acorde + palmada, y el aire que llega justo al corte
  for (const c of partitura.cortes) {
    const fuerza = c.fuerza ?? 1;
    const raiz = RAICES[acordeEn(c.t)];
    sumarPaneado(acentos, bombo(sr), sr, c.t, 0.6 * fuerza);
    sumarPaneado(acentos, sub808(sr, fSub(raiz), negra * 1.3, 1), sr, c.t, 0.34 * fuerza);
    sumarPaneado(acentos, golpeDe('palmada', Math.round(c.t * 10), () => palmada(sr, Math.round(c.t * 10))), sr, c.t, 0.3 * fuerza, 0.1);
    sumarPaneado(acentos, colchon(sr, ACORDES[acordeEn(c.t)], tono, negra * 0.5, 1.6), sr, c.t, 0.8 * fuerza, -0.15);
    const aire = Math.min(negra, c.t);
    if (aire > 0.1) sumarPaneado(acentos, barrido(sr, aire, Math.round(c.t * 100)), sr, c.t - aire, 0.2 * fuerza, -0.2);
  }

  // 6. Golpes grandes: grave largo, platillos a los lados y el acorde abierto
  for (const t of partitura.golpes) {
    sumarPaneado(acentos, golpeGrave(sr), sr, t, 0.5);
    sumarPaneado(acentos, platillo(sr, Math.round(t * 1000)), sr, t, 0.36, -0.35);
    sumarPaneado(acentos, platillo(sr, Math.round(t * 1000) + 1), sr, t + 0.012, 0.36, 0.35);
    sumarPaneado(acentos, colchon(sr, [...ACORDES[acordeEn(t)], 19], tono, negra * 2.5, 2), sr, t, 0.85);
  }

  // 7. Gestos de la imagen
  for (const n of partitura.notas) {
    const vel = n.vel ?? 0.6;
    const voz = n.voz ?? 'pluck';
    const x =
      voz === 'grave'
        ? sub808(sr, fSub(n.nota), n.dur ?? negra * 1.5, 1.4)
        : voz === 'clic'
          ? clic(sr, f(n.nota + 12), n.dur ?? 0.05)
          : voz === 'campana'
            ? nota('glock', n.nota + 12, vel > 0.6, () => pluck(sr, f(n.nota + 12), 0.5, 1.6))
            : pluck(sr, f(n.nota), n.dur ?? 0.28, 1.2);
    const g = voz === 'grave' ? 0.42 : voz === 'clic' ? 0.4 : voz === 'campana' ? 0.36 : 0.5;
    sumarPaneado(acentos, x, sr, n.t, g * vel, n.pan ?? 0);
  }
  for (const g of partitura.glitches) sumarPaneado(acentos, rafaga(sr, g.dur, Math.round(g.t * 1000)), sr, g.t, 0.3 * (g.vel ?? 1), 0);

  // 8. Acorde final: arpegio punteado + vibráfono que se queda sonando (enlaza con el principio)
  const final = ACORDES[acordeEn(partitura.final)];
  final.forEach((n, i) => sumarPaneado(base, pluck(sr, f(n), 0.9, 1.4), sr, partitura.final + i * semi * 0.5, 0.3, (i - 1.5) * 0.4));
  final.slice(1).forEach((n, i) => sumarPaneado(base, nota('vibrafono', n, false, () => pluck(sr, f(n), 1.2, 1)), sr, partitura.final, 0.12, (i - 1) * 0.4));
  sumarPaneado(base, sub808(sr, fSub(RAICES[acordeEn(partitura.final)]), negra * 2, 0.8), sr, partitura.final, 0.3);

  // 9. Base a −20 dB RMS (medido donde suena, para que los silencios no la inflen) y acentos a su escala
  let suma = 0;
  let cuenta = 0;
  const marco = Math.round(sr * 0.05);
  for (let i = 0; i + marco <= base.l.length; i += marco) {
    let e = 0;
    for (let j = i; j < i + marco; j++) e += base.l[j] ** 2 + base.r[j] ** 2;
    e /= 2 * marco;
    if (e > 1e-6) {
      suma += e;
      cuenta++;
    }
  }
  const medida = cuenta ? Math.sqrt(suma / cuenta) : rmsEstereo(base) || 1;
  const g = 10 ** (-20 / 20) / medida;
  for (const c of [base.l, base.r, acentos.l, acentos.r]) {
    for (let i = 0; i < c.length; i++) c[i] *= g;
    fundidos(c, sr, 0, Math.min(0.4, duracion / 4));
  }
  return {base, acentos};
}
