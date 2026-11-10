// nº05 · Línea de tiempo y modelo del girasol. Módulo PURO (sin React): lo usan la animación
// (Sketch.tsx) y el sonido (sonido.ts), así cada semilla y cada espiral suenan cuando se ven.
//
//   portada (0–2,6 s)            girasol de oro con un barrido que gira (= último fotograma, sin barrido)
//   girasol (→ "nadie")          las 34 espirales rosas, las 55 azules y la fila de Fibonacci
//   crecimiento (→ "con un…")    vuelve a crecer semilla a semilla: lento de cerca, luego cientos
//   ángulos (→ "aunque, ojo")    135° da rayos, 137° casi, 137,5° (el de oro) espirales sin huecos
//   estudio (→ "se equivocaron") cuatro girasoles pequeños: tres Fibonacci y uno de Lucas (esquema)
//   final (→ fin)                el girasol de la portada (loop)
//
// Modelo de Vogel (1979): la semilla n está en el ángulo n·α y a la distancia c·√n del centro
// (verificado en verificar.py; ver NOTAS.md).
import {DURACION_PORTADA} from '@canal/diseno';
import {cuantizar, type Pulso} from '@canal/pulso';
import {normalizar, tiempoDeAncla} from '@canal/tiempos';
import type {Tiempos} from '@canal/tipos';

export const PHI = (1 + Math.sqrt(5)) / 2;
/** Ángulo de oro: 360° · (1 − 1/φ) ≈ 137,508°. */
export const ORO = 360 * (1 - 1 / PHI);
/** Ángulo de Lucas (espirales 29/47, un patrón no Fibonacci que el estudio de 2016 encontró). */
export const LUCAS = 360 / (3 + 1 / PHI);
/** Semillas del girasol grande: con 400, las espirales son 34 y 55 (verificar.py). */
export const SEMILLAS = 400;
/** Las espirales se dibujan desde aquí hacia fuera (dentro, sus vecinas ya no son las de 34 y 55). */
export const DESDE_ESPIRAL = 70;

export const fase = (t: number, a: number, b: number) => Math.max(0, Math.min(1, (t - a) / Math.max(0.01, b - a)));
const suave = (x: number) => 1 - (1 - Math.max(0, Math.min(1, x))) ** 3;

export type Linea = {
  treinta: number;
  cincuenta: number;
  fibonacci: number;
  quien: number;
  nadie: number;
  cada: number;
  regla: number;
  cientos: number;
  redondo: number;
  ciento35: number;
  rayos: number;
  ciento37: number;
  pero: number;
  oro: number;
  ninguna: number;
  sinHuecos: number;
  espirales: number;
  aunque: number;
  estudio: number;
  unaDeCada: number;
  equivocaron: number;
  fin: number;
};

/** Inicio de la última palabra de la frase (el golpe cae en la palabra que pesa). */
function palabraFinal(tiempos: Tiempos | null, frase: string, defecto: number): number {
  const inicio = tiempoDeAncla(tiempos, frase);
  if (inicio === null || !tiempos) return defecto;
  const n = normalizar(frase).split(/\s+/).filter(Boolean).length;
  const i = tiempos.palabras.findIndex((p) => p.inicio === inicio);
  return tiempos.palabras[i + n - 1]?.inicio ?? defecto;
}

/** `fin` = segundo del último fotograma. Los valores por defecto son los de la toma actual. */
export function linea(tiempos: Tiempos | null, fin: number): Linea {
  const a = (s: string, d: number) => tiempoDeAncla(tiempos, s) ?? d;
  return {
    treinta: a('treinta y cuatro', 3.48),
    cincuenta: a('cincuenta y cinco', 6.26),
    fibonacci: a('dos números de fibonacci', 8.26),
    quien: a('quién las contó', 11.06),
    nadie: a('nadie', 12.24),
    cada: a('cada semilla nueva', 13.38),
    regla: a('una sola regla', 18.52),
    cientos: palabraFinal(tiempos, 'repetida cientos de veces', 21.1),
    redondo: a('con un ángulo redondo', 22.04),
    ciento35: a('ciento treinta y cinco', 23.66),
    rayos: a('salen rayos', 25.5),
    ciento37: a('ciento treinta y siete casi', 28.22),
    pero: a('pero no', 30.48),
    // El número completo llega en "punto cinco": ahí cambia el ángulo, el sello y el golpe musical
    oro: a('punto cinco', 33.04),
    ninguna: a('ninguna semilla', 35.12),
    sinHuecos: a('sin huecos', 37.4),
    espirales: a('las espirales aparecen', 38.76),
    aunque: a('aunque ojo', 40.96),
    estudio: a('en un estudio', 42.46),
    unaDeCada: a('una de cada cuatro', 45.28),
    equivocaron: a('se equivocaron', 48.18),
    fin,
  };
}

/** Ángulo de giro entre semillas en `t`: el de oro, salvo cuando la voz prueba 135° y 137°. */
export function anguloEn(t: number, l: Linea): number {
  if (t < l.ciento35 - 0.3) return ORO;
  if (t < l.ciento37) return ORO + (135 - ORO) * suave(fase(t, l.ciento35 - 0.3, l.ciento35 + 0.5));
  if (t < l.oro) return 135 + 2 * suave(fase(t, l.ciento37, l.ciento37 + 1.1));
  return 137 + (ORO - 137) * suave(fase(t, l.oro, l.oro + 1.6));
}

/** Momentos del crecimiento: una semilla por corchea de cerca y luego cientos, cada vez más rápido. */
export function crecimiento(l: Linea, pulso: Pulso) {
  const corchea = pulso.negra / 2;
  const inicio = cuantizar(l.cada, pulso, 0.5, 'siguiente');
  const lentas = Math.max(4, Math.floor((l.regla - inicio) / corchea));
  const rapidoDesde = inicio + lentas * corchea;
  const rapidoHasta = Math.max(rapidoDesde + 1, l.redondo - 0.3);
  const K = 4;
  /** Segundo en que aparece la semilla n (1…SEMILLAS). */
  const momento = (n: number) => {
    if (n <= lentas) return inicio + (n - 1) * corchea;
    const x = Math.log(1 + ((n - lentas) * (Math.exp(K) - 1)) / (SEMILLAS - lentas)) / K;
    return rapidoDesde + x * (rapidoHasta - rapidoDesde);
  };
  return {inicio, lentas, rapidoDesde, rapidoHasta, corchea, momento};
}

/**
 * Cuántas semillas se ven en `t` (con fracción, para el tamaño de la que está saliendo). Antes de
 * "nadie" y desde el crecimiento terminado, todas; en "nadie" se recogen hacia el centro.
 */
export function semillasEn(t: number, l: Linea, pulso: Pulso): number {
  const c = crecimiento(l, pulso);
  if (t < l.nadie) return SEMILLAS;
  if (t < c.inicio) return SEMILLAS * (1 - suave(fase(t, l.nadie, Math.min(c.inicio, l.nadie + 0.6))));
  if (t >= c.rapidoHasta) return SEMILLAS;
  let n = 0;
  while (n < SEMILLAS && c.momento(n + 1) <= t) n++;
  return n;
}

/** Espirales: la familia rosa (34) y la azul (55) entran una por fusa desde su número en la voz. */
export function espirales(l: Linea, pulso: Pulso) {
  const fusa = pulso.negra / 8;
  return {
    fusa,
    rosa: cuantizar(l.treinta, pulso, 0.125, 'siguiente'),
    azul: cuantizar(l.cincuenta, pulso, 0.125, 'siguiente'),
    // Al final del ángulo de oro aparecen "solas": las dos familias a la vez, el doble de rápido
    otraVez: cuantizar(l.espirales, pulso, 0.125, 'siguiente'),
  };
}

/** Los cuatro girasoles del estudio (esquema): semillas, ángulo y sus espirales. */
export const ESTUDIO = [
  {n: 150, angulo: ORO, espirales: '21 / 34', fibonacci: true},
  {n: 400, angulo: ORO, espirales: '34 / 55', fibonacci: true},
  {n: 400, angulo: LUCAS, espirales: '29 / 47', fibonacci: false},
  {n: 1000, angulo: ORO, espirales: '55 / 89', fibonacci: true},
];

/** Segundo en que aparece cada girasol del estudio (uno por negra desde "en un estudio"). */
export function momentosEstudio(l: Linea, pulso: Pulso): number[] {
  const desde = cuantizar(l.estudio, pulso, 1, 'siguiente');
  return ESTUDIO.map((_, i) => desde + i * pulso.negra);
}

/** Cambios de escena (marco de visor, aire e impresora). */
export const cortes = (l: Linea, pulso: Pulso) => [crecimiento(l, pulso).inicio, l.aunque, l.equivocaron];

export const enPortadaEn = (t: number, l: Linea) => t < DURACION_PORTADA || t >= l.equivocaron;
