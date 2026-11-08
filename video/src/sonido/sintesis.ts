// Síntesis de audio por código: utilidades puras y deterministas (sin DOM ni Node).
// Todo trabaja sobre Float32Array mono en el rango −1…1.
import {mulberry32} from '../canal/prng';

/** dB → ganancia lineal. */
export const db = (v: number) => 10 ** (v / 20);
/** Ganancia lineal → dB. */
export const aDb = (g: number) => 20 * Math.log10(Math.max(1e-9, g));

export const silencio = (sr: number, segundos: number) => new Float32Array(Math.max(0, Math.round(sr * segundos)));

/** Suma `fuente` dentro de `destino` a partir de `segundo`, con ganancia. */
export function sumarEn(destino: Float32Array, fuente: Float32Array, sr: number, segundo: number, ganancia = 1): void {
  const inicio = Math.round(segundo * sr);
  for (let i = 0; i < fuente.length; i++) {
    const j = inicio + i;
    if (j >= 0 && j < destino.length) destino[j] += fuente[i] * ganancia;
  }
}

export function ruidoBlanco(n: number, semilla: number): Float32Array {
  const azar = mulberry32(semilla);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = azar() * 2 - 1;
  return x;
}

/** Filtro de un polo, en el sitio. */
export function pasaBajos1(x: Float32Array, sr: number, fc: number): Float32Array {
  const a = Math.exp((-2 * Math.PI * fc) / sr);
  let y = 0;
  for (let i = 0; i < x.length; i++) {
    y = (1 - a) * x[i] + a * y;
    x[i] = y;
  }
  return x;
}

export function pasaAltos1(x: Float32Array, sr: number, fc: number): Float32Array {
  const a = Math.exp((-2 * Math.PI * fc) / sr);
  let y = 0;
  let previo = 0;
  for (let i = 0; i < x.length; i++) {
    y = a * (y + x[i] - previo);
    previo = x[i];
    x[i] = y;
  }
  return x;
}

export type TipoBiquad = 'pasabajos' | 'pasaaltos' | 'pasabanda';

/**
 * Biquad (fórmulas RBJ), en el sitio. `fc` puede ser una función del índice de muestra para barridos.
 */
export function biquad(x: Float32Array, sr: number, tipo: TipoBiquad, fc: number | ((i: number) => number), q = 0.707): Float32Array {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  let b0 = 0, b1 = 0, b2 = 0, a1 = 0, a2 = 0;
  const calcular = (f: number) => {
    const w = (2 * Math.PI * Math.min(f, sr * 0.45)) / sr;
    const cos = Math.cos(w);
    const alfa = Math.sin(w) / (2 * q);
    const a0 = 1 + alfa;
    if (tipo === 'pasabajos') {
      b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = (1 - cos) / 2;
    } else if (tipo === 'pasaaltos') {
      b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = (1 + cos) / 2;
    } else {
      b0 = alfa; b1 = 0; b2 = -alfa;
    }
    a1 = -2 * cos; a2 = 1 - alfa;
    b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
  };
  const variable = typeof fc === 'function';
  if (!variable) calcular(fc as number);
  for (let i = 0; i < x.length; i++) {
    if (variable && i % 32 === 0) calcular((fc as (i: number) => number)(i));
    const entrada = x[i];
    const salida = b0 * entrada + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = entrada; y2 = y1; y1 = salida;
    x[i] = salida;
  }
  return x;
}

/** Envolvente ataque lineal + caída exponencial (constante de tiempo `caida`). */
export function envolvente(n: number, sr: number, ataque: number, caida: number): Float32Array {
  const e = new Float32Array(n);
  const na = Math.max(1, Math.round(ataque * sr));
  for (let i = 0; i < n; i++) {
    e[i] = i < na ? i / na : Math.exp(-(i - na) / (caida * sr));
  }
  return e;
}

export function multiplicar(x: Float32Array, e: Float32Array | ((i: number) => number)): Float32Array {
  for (let i = 0; i < x.length; i++) x[i] *= typeof e === 'function' ? e(i) : e[i];
  return x;
}

/** Fundidos de entrada y salida (en segundos), en el sitio. */
export function fundidos(x: Float32Array, sr: number, entrada: number, salida: number): Float32Array {
  const ne = Math.round(entrada * sr);
  const ns = Math.round(salida * sr);
  for (let i = 0; i < Math.min(ne, x.length); i++) x[i] *= i / ne;
  for (let i = 0; i < Math.min(ns, x.length); i++) x[x.length - 1 - i] *= i / ns;
  return x;
}

export function rms(x: Float32Array, desde = 0, hasta = x.length): number {
  let s = 0;
  for (let i = desde; i < hasta; i++) s += x[i] * x[i];
  return Math.sqrt(s / Math.max(1, hasta - desde));
}

export function pico(x: Float32Array): number {
  let p = 0;
  for (let i = 0; i < x.length; i++) p = Math.max(p, Math.abs(x[i]));
  return p;
}

/** Escala para que el pico quede en `objetivoDb`. */
export function normalizarPico(x: Float32Array, objetivoDb: number): Float32Array {
  const p = pico(x) || 1;
  const g = db(objetivoDb) / p;
  for (let i = 0; i < x.length; i++) x[i] *= g;
  return x;
}

/** Escala para que el RMS quede en `objetivoDb`. */
export function normalizarRms(x: Float32Array, objetivoDb: number): Float32Array {
  const r = rms(x) || 1;
  const g = db(objetivoDb) / r;
  for (let i = 0; i < x.length; i++) x[i] *= g;
  return x;
}

// Interpolación sinc con ventana Hann, 24 coeficientes por fase; no se cambia la frecuencia del WAV.
const RADIO_PICO = 12;
const FASES_PICO = [0.25, 0.5, 0.75].map((fase) => {
  const pesos = Array.from({length: RADIO_PICO * 2}, (_, k) => {
    const d = k - RADIO_PICO + 1 - fase;
    return Math.sin(Math.PI * d) / (Math.PI * d) * (0.5 + 0.5 * Math.cos(Math.PI * d / RADIO_PICO));
  });
  const suma = pesos.reduce((a, b) => a + b, 0);
  return pesos.map((p) => p / suma);
});

/** Pico por intervalo, incluidos los picos entre muestras (sobremuestreo 4×). */
function picosInterpolados(lista: Float32Array[]): Float32Array {
  const n = lista[0].length;
  const picos = new Float32Array(n);
  for (const c of lista) {
    for (let i = 0; i < n; i++) {
      let p = Math.max(picos[i], Math.abs(c[i]));
      for (const pesos of FASES_PICO) {
        let v = 0;
        for (let k = 0; k < pesos.length; k++) v += (c[i + k - RADIO_PICO + 1] ?? 0) * pesos[k];
        p = Math.max(p, Math.abs(v));
      }
      picos[i] = p;
    }
  }
  return picos;
}

/** True peak estimado por interpolación 4×; se contrasta con ffmpeg en el informe del MP4. */
export function picoVerdadero(canales: Float32Array[]): number {
  return pico(picosInterpolados(canales));
}

/**
 * Limitador enlazado entre canales, con rampa de ataque de 3 ms y relajación de 80 ms.
 * Detecta picos entre muestras a 4×. La comprobación final corrige los que pueda crear la propia
 * envolvente con una ganancia común constante; el margen de 0,05 dB cubre el redondeo a PCM.
 */
export function limitador(canales: Float32Array | Float32Array[], sr: number, techoDb = -1): void {
  const lista = Array.isArray(canales) ? canales : [canales];
  const techo = db(techoDb - 0.05);
  const anticipa = Math.max(1, Math.round(0.003 * sr));
  const n = lista[0].length;
  const necesaria = new Float32Array(n).fill(1);
  const picos = picosInterpolados(lista);
  for (let i = 0; i < n; i++) {
    const a = picos[i];
    if (a > techo) {
      const g = techo / a;
      for (let j = Math.max(0, i - anticipa); j <= i; j++) {
        necesaria[j] = Math.min(necesaria[j], g + (1 - g) * (i - j) / anticipa);
      }
    }
  }
  const relaja = Math.exp(-1 / (0.08 * sr));
  let g = 1;
  for (let i = 0; i < n; i++) {
    g = necesaria[i] < g ? necesaria[i] : 1 - (1 - g) * relaja;
    if (g > necesaria[i]) g = necesaria[i];
    for (const c of lista) c[i] *= g;
  }
  const p = picoVerdadero(lista);
  if (p > techo) for (const c of lista) for (let i = 0; i < n; i++) c[i] *= techo / p;
}

// ───────────────────────────── Sonoridad (BS.1770) ─────────────────────────────

/** Coeficientes [b0, b1, b2, a1, a2] (normalizados) de los filtros de ponderación K. */
function ponderacionK(sr: number): number[][] {
  const estante = (() => {
    const A = 10 ** (4 / 40), w = (2 * Math.PI * 1500) / sr, cos = Math.cos(w), al = Math.sin(w) / (2 * Math.SQRT1_2);
    const a0 = A + 1 - (A - 1) * cos + 2 * Math.sqrt(A) * al;
    return [
      (A * (A + 1 + (A - 1) * cos + 2 * Math.sqrt(A) * al)) / a0,
      (-2 * A * (A - 1 + (A + 1) * cos)) / a0,
      (A * (A + 1 + (A - 1) * cos - 2 * Math.sqrt(A) * al)) / a0,
      (2 * (A - 1 - (A + 1) * cos)) / a0,
      (A + 1 - (A - 1) * cos - 2 * Math.sqrt(A) * al) / a0,
    ];
  })();
  const pasaAltos = (() => {
    const w = (2 * Math.PI * 38) / sr, cos = Math.cos(w), al = Math.sin(w) / (2 * 0.5);
    const a0 = 1 + al;
    return [(1 + cos) / 2 / a0, -(1 + cos) / a0, (1 + cos) / 2 / a0, (-2 * cos) / a0, (1 - al) / a0];
  })();
  return [estante, pasaAltos];
}

/**
 * Sonoridad integrada en LUFS según ITU-R BS.1770 (ponderación K, bloques de 400 ms con 75 % de
 * solape, puerta absoluta de −70 LUFS y relativa de −10 LU). Coincide con pyloudnorm.
 */
export function lufs(canales: Float32Array[], sr: number): number {
  const filtrados = canales.map((c) => {
    let x = Float64Array.from(c);
    for (const [b0, b1, b2, a1, a2] of ponderacionK(sr)) {
      const y = new Float64Array(x.length);
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      for (let i = 0; i < x.length; i++) {
        const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1; x1 = x[i]; y2 = y1; y1 = v;
        y[i] = v;
      }
      x = y;
    }
    return x;
  });
  const bloque = Math.round(0.4 * sr);
  const paso = Math.round(0.1 * sr);
  const z: number[] = [];
  for (let ini = 0; ini + bloque <= filtrados[0].length; ini += paso) {
    let suma = 0;
    for (const c of filtrados) {
      let s = 0;
      for (let i = ini; i < ini + bloque; i++) s += c[i] * c[i];
      suma += s / bloque;
    }
    z.push(suma);
  }
  const sonoridad = (v: number) => -0.691 + 10 * Math.log10(v);
  const absolutos = z.filter((v) => sonoridad(v) > -70);
  if (!absolutos.length) return -Infinity;
  const media = (l: number[]) => l.reduce((s, v) => s + v, 0) / l.length;
  const relativa = sonoridad(media(absolutos)) - 10;
  return sonoridad(media(absolutos.filter((v) => sonoridad(v) > relativa)));
}

/**
 * Lleva la pista a `objetivo` LUFS sin pasar de `techoDb`: ganancia + limitador, y una segunda
 * pasada corta porque el limitador baja un poco la sonoridad. Devuelve la sonoridad final.
 */
export function normalizarLufs(canales: Float32Array[], sr: number, objetivo = -14, techoDb = -1): number {
  for (let pasada = 0; pasada < 2; pasada++) {
    const medida = lufs(canales, sr);
    if (!Number.isFinite(medida)) return medida; // silencio: evita 0 × Infinity → NaN
    const g = db(objetivo - medida);
    for (const c of canales) for (let i = 0; i < c.length; i++) c[i] *= g;
    limitador(canales, sr, techoDb);
  }
  return lufs(canales, sr);
}

// ───────────────────────────── Estéreo ─────────────────────────────

export type Estereo = {l: Float32Array; r: Float32Array};

export const estereo = (sr: number, segundos: number): Estereo => ({l: silencio(sr, segundos), r: silencio(sr, segundos)});

/** Suma una fuente mono con paneo de potencia constante (−1 izquierda, 0 centro, 1 derecha). */
export function sumarPaneado(destino: Estereo, fuente: Float32Array, sr: number, segundo: number, ganancia = 1, pan = 0): void {
  const a = ((Math.max(-1, Math.min(1, pan)) + 1) * Math.PI) / 4;
  sumarEn(destino.l, fuente, sr, segundo, ganancia * Math.cos(a));
  sumarEn(destino.r, fuente, sr, segundo, ganancia * Math.sin(a));
}

/** Eco que rebota de un lado a otro, oscurecido en cada vuelta. Se suma al propio destino. */
export function ecoPingPong(destino: Estereo, sr: number, retardo: number, realimentacion: number, mezcla: number): void {
  const d = Math.round(retardo * sr);
  const n = destino.l.length;
  const el = new Float32Array(n), er = new Float32Array(n);
  for (let i = d; i < n; i++) {
    el[i] = (destino.r[i - d] + er[i - d] * realimentacion) * 0.5 + el[i - 1] * 0.5;
    er[i] = (destino.l[i - d] + el[i - d] * realimentacion) * 0.5 + er[i - 1] * 0.5;
  }
  for (let i = 0; i < n; i++) {
    destino.l[i] += el[i] * mezcla;
    destino.r[i] += er[i] * mezcla;
  }
}

export function rmsEstereo(e: Estereo): number {
  return Math.sqrt((rms(e.l) ** 2 + rms(e.r) ** 2) / 2);
}

/** Remuestreo lineal (suficiente para subir de frecuencia efectos sintetizados). */
export function remuestrear(x: Float32Array, srOrigen: number, srDestino: number): Float32Array {
  if (srOrigen === srDestino) return x;
  const n = Math.round((x.length * srDestino) / srOrigen);
  const y = new Float32Array(n);
  const paso = srOrigen / srDestino;
  for (let i = 0; i < n; i++) {
    const p = i * paso;
    const k = Math.floor(p);
    const f = p - k;
    y[i] = (x[k] ?? 0) * (1 - f) + (x[k + 1] ?? 0) * f;
  }
  return y;
}

// ───────────────────────────── WAV ─────────────────────────────

/** Lee un WAV PCM (16 o 24 bits) o float de 32 bits; devuelve mono. */
export function leerWav(bytes: Uint8Array): {sr: number; datos: Float32Array} {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const texto = (o: number) => String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
  if (texto(0) !== 'RIFF' || texto(8) !== 'WAVE') throw new Error('No es un WAV.');
  let o = 12;
  let formato = 1, canales = 1, sr = 44100, bits = 16;
  let datos: Float32Array | null = null;
  while (o + 8 <= bytes.length) {
    const id = texto(o);
    const tam = v.getUint32(o + 4, true);
    if (id === 'fmt ') {
      formato = v.getUint16(o + 8, true);
      canales = v.getUint16(o + 10, true);
      sr = v.getUint32(o + 12, true);
      bits = v.getUint16(o + 22, true);
      if (formato === 0xfffe) formato = v.getUint16(o + 32, true);
    } else if (id === 'data') {
      const bytesMuestra = bits / 8;
      const n = Math.floor(tam / (bytesMuestra * canales));
      datos = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        let s = 0;
        for (let c = 0; c < canales; c++) {
          const p = o + 8 + (i * canales + c) * bytesMuestra;
          if (formato === 3 && bits === 32) s += v.getFloat32(p, true);
          else if (bits === 16) s += v.getInt16(p, true) / 32768;
          else if (bits === 24) s += ((v.getUint8(p) | (v.getUint8(p + 1) << 8) | (v.getInt8(p + 2) << 16)) / 8388608);
          else throw new Error(`WAV de ${bits} bits no admitido.`);
        }
        datos[i] = s / canales;
      }
    }
    o += 8 + tam + (tam % 2);
  }
  if (!datos) throw new Error('El WAV no tiene datos.');
  return {sr, datos};
}

/** Escribe un WAV PCM de 16 bits con uno o más canales (mono: un array; estéreo: [l, r]). */
export function escribirWav(canales: Float32Array | Float32Array[], sr: number): Uint8Array {
  const lista = Array.isArray(canales) ? canales : [canales];
  const nc = lista.length;
  const n = lista[0].length;
  const bytes = new Uint8Array(44 + n * 2 * nc);
  const v = new DataView(bytes.buffer);
  const poner = (o: number, s: string) => [...s].forEach((c, i) => (bytes[o + i] = c.charCodeAt(0)));
  poner(0, 'RIFF');
  v.setUint32(4, 36 + n * 2 * nc, true);
  poner(8, 'WAVE');
  poner(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, nc, true);
  v.setUint32(24, sr, true);
  v.setUint32(28, sr * 2 * nc, true);
  v.setUint16(32, 2 * nc, true);
  v.setUint16(34, 16, true);
  poner(36, 'data');
  v.setUint32(40, n * 2 * nc, true);
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < nc; c++) {
      v.setInt16(44 + (i * nc + c) * 2, Math.round(Math.max(-1, Math.min(1, lista[c][i])) * 32767), true);
    }
  }
  return bytes;
}

/** Nota → Hz (la4 = 440, en semitonos respecto a la4). */
export const hz = (semitonosDesdeLa4: number) => 440 * 2 ** (semitonosDesdeLa4 / 12);
