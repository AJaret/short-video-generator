// Muestreador: instrumentos reales grabados (VCSL, CC0; ver herramientas/muestras.py) tocados por
// código. Módulo PURO: las muestras llegan ya leídas (sonido.mjs las carga de video/src/sonido/muestras).
//
// Para una nota se elige la muestra grabada más cercana (y la capa fuerte o media según la
// intensidad) y se reproduce más rápido o más lento: así se afina sin perder el timbre real.
// Las percusiones sin altura alternan sus tomas (round robin) para no sonar a metralleta.

export type Muestra = {datos: Float32Array; sr: number; midi: number | null; capa: string};
export type BancoMuestras = Record<string, Muestra[]>;

const cache = new WeakMap<Muestra, Map<string, Float32Array>>();

/** Remuestrea con interpolación lineal: `paso` muestras de origen por muestra de salida. */
function reproducir(m: Muestra, paso: number): Float32Array {
  let porMuestra = cache.get(m);
  if (!porMuestra) cache.set(m, (porMuestra = new Map()));
  const clave = paso.toFixed(6);
  const hecho = porMuestra.get(clave);
  if (hecho) return hecho;
  const n = Math.floor((m.datos.length - 1) / paso);
  const y = new Float32Array(Math.max(0, n));
  for (let i = 0; i < n; i++) {
    const p = i * paso;
    const k = Math.floor(p);
    const f = p - k;
    y[i] = m.datos[k] * (1 - f) + m.datos[k + 1] * f;
  }
  porMuestra.set(clave, y);
  return y;
}

/** Nota MIDI `midi` del instrumento, al sample rate `sr`. `fuerte` elige la capa 'loud' si existe. */
export function notaMuestreada(banco: BancoMuestras, instrumento: string, midi: number, sr: number, fuerte = false): Float32Array | null {
  const lista = banco[instrumento]?.filter((m) => m.midi !== null);
  if (!lista?.length) return null;
  let mejor = lista[0];
  for (const m of lista) {
    const d = Math.abs((m.midi as number) - midi) - Math.abs((mejor.midi as number) - midi);
    const capaBuena = (m.capa === 'loud') === fuerte;
    const capaMejor = (mejor.capa === 'loud') === fuerte;
    if (d < 0 || (d === 0 && capaBuena && !capaMejor)) mejor = m;
  }
  const paso = 2 ** ((midi - (mejor.midi as number)) / 12) * (mejor.sr / sr);
  return reproducir(mejor, paso);
}

/** Golpe de una percusión sin altura; `indice` alterna las tomas. */
export function golpeMuestreado(banco: BancoMuestras, instrumento: string, indice: number, sr: number): Float32Array | null {
  const lista = banco[instrumento];
  if (!lista?.length) return null;
  const m = lista[((indice % lista.length) + lista.length) % lista.length];
  return reproducir(m, m.sr / sr);
}
