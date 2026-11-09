// Cámara 2D del sketch: planos, acercamiento continuo, zoom con rebote en los golpes y seguimiento.
// Módulo PURO salvo conCamara(), que solo transforma los contextos de las capas.
//
// En los reels de referencia la imagen nunca se queda quieta: la cámara se acerca despacio dentro de
// cada plano, cambia de encuadre cada pocos segundos y "empuja" en los golpes de la música. Aquí:
//   · tomaEn(t, planos)   el encuadre vigente. Cada plano entra con corte seco o con un movimiento
//                         suave de una negra, y dentro de él la cámara se acerca (`deriva`).
//   · empujes(t, momentos) zoom con rebote en los golpes: sube en 2 fotogramas y cae en ~0,25 s.
//   · seguir(p, …)        encuadre que lleva un punto (el que se mueve) hacia un sitio de la pantalla.
//   · conCamara(capas, toma, fn) dibuja `fn` con la toma aplicada en las seis capas.
//
// La transformación va en los contextos del canvas, ANTES del tramado: el punto de trama sigue
// midiendo 3 px y las líneas finas (capas sólidas) se escalan sin escalones.
// Lo que no debe moverse con la cámara (rótulos, lecturas) se dibuja fuera de conCamara().
import {todasLasCapas, type Capas} from './capas';
import {salidaCubica} from './curvas';
import {ANCHO, ALTO} from './diseno';

/** Encuadre: zoom alrededor del pivote (px, py), desplazamiento en pantalla y giro (rad). */
export type Toma = {zoom: number; px: number; py: number; dx: number; dy: number; giro: number};

export const TOMA_NEUTRA: Toma = {zoom: 1, px: ANCHO / 2, py: ALTO / 2, dx: 0, dy: 0, giro: 0};

export type Plano = {
  /** Segundo en que empieza (mejor en el pulso). */
  desde: number;
  /** Encuadre (lo que falte sale de TOMA_NEUTRA), o una función del tiempo (seguimiento). */
  toma: Partial<Toma> | ((t: number) => Partial<Toma>);
  /** Zoom extra que gana a lo largo del plano (0,06 = se acerca un 6 %). Por defecto 0,04. */
  deriva?: number;
  /** Giro (rad) que gana a lo largo del plano: una órbita lenta para los planos quietos. */
  giro?: number;
  /** 'corte' = seco (por defecto); 'suave' = viaja desde la toma anterior en `viaje` s. */
  entrada?: 'corte' | 'suave';
  viaje?: number;
};

const completar = (p: Partial<Toma>): Toma => ({...TOMA_NEUTRA, ...p});
const resolver = (plano: Plano, t: number): Toma => completar(typeof plano.toma === 'function' ? plano.toma(t) : plano.toma);

export function mezclarTomas(a: Toma, b: Toma, f: number): Toma {
  const m = (x: number, y: number) => x + (y - x) * f;
  // El zoom se mezcla en escala logarítmica: un viaje de ×1 a ×4 avanza parejo
  return {
    zoom: Math.exp(m(Math.log(a.zoom), Math.log(b.zoom))),
    px: m(a.px, b.px),
    py: m(a.py, b.py),
    dx: m(a.dx, b.dx),
    dy: m(a.dy, b.dy),
    giro: m(a.giro, b.giro),
  };
}

/** Toma con la deriva aplicada, en el segundo `t` del plano `i`. */
function tomaDelPlano(planos: Plano[], i: number, t: number): Toma {
  const plano = planos[i];
  const fin = planos[i + 1]?.desde ?? plano.desde + 6;
  const avance = Math.max(0, Math.min(1, (t - plano.desde) / Math.max(0.1, fin - plano.desde)));
  const toma = resolver(plano, t);
  return {...toma, zoom: toma.zoom * (1 + (plano.deriva ?? 0.04) * avance), giro: toma.giro + (plano.giro ?? 0) * avance};
}

/** Encuadre vigente en `t`. `planos` en orden de `desde`; antes del primero, la toma neutra. */
export function tomaEn(t: number, planos: Plano[]): Toma {
  let i = -1;
  for (let k = 0; k < planos.length; k++) if (planos[k].desde <= t) i = k;
  if (i < 0) return TOMA_NEUTRA;
  const actual = tomaDelPlano(planos, i, t);
  const plano = planos[i];
  if (plano.entrada !== 'suave' || i === 0) return actual;
  const viaje = plano.viaje ?? 0.65;
  const f = (t - plano.desde) / viaje;
  if (f >= 1) return actual;
  // Sale de donde estaba la cámara justo antes del cambio
  const previa = tomaDelPlano(planos, i - 1, plano.desde - 1e-3);
  return mezclarTomas(previa, actual, salidaCubica(f));
}

/**
 * Empujón de zoom en los golpes: factor ≥ 1 (multiplica el zoom). Sube en `subida` s y cae
 * exponencialmente con constante `caida`. Varios golpes seguidos se suman.
 */
export function empujes(t: number, momentos: number[], fuerza = 0.07, caida = 0.2, subida = 0.06): number {
  let extra = 0;
  for (const m of momentos) {
    const d = t - m;
    if (d < 0 || d > caida * 6) continue;
    extra += fuerza * (d < subida ? salidaCubica(d / subida) : Math.exp(-(d - subida) / caida));
  }
  return 1 + extra;
}

/**
 * Toma que lleva el punto (x, y) del dibujo al punto (sx, sy) de la pantalla, con zoom alrededor
 * de él. Para seguir algo que se mueve, pásale su posición en cada fotograma (suavizada si salta).
 */
export function seguir(x: number, y: number, zoom: number, sx = ANCHO / 2, sy = 900, giro = 0): Partial<Toma> {
  return {zoom, px: x, py: y, dx: sx - x, dy: sy - y, giro};
}

/** Lleva un punto del dibujo a la pantalla con esa toma (para colocar rótulos junto a algo). */
export function aPantallaCon(toma: Toma, x: number, y: number): [number, number] {
  const c = Math.cos(toma.giro);
  const s = Math.sin(toma.giro);
  const ux = (x - toma.px) * toma.zoom;
  const uy = (y - toma.py) * toma.zoom;
  return [toma.px + toma.dx + ux * c - uy * s, toma.py + toma.dy + ux * s + uy * c];
}

/** Dibuja `fn` con la toma aplicada en las seis capas (y la deshace al terminar). */
export function conCamara(capas: Capas, toma: Toma, fn: () => void): void {
  const lista = todasLasCapas(capas);
  for (const ctx of lista) {
    ctx.save();
    ctx.translate(toma.px + toma.dx, toma.py + toma.dy);
    ctx.rotate(toma.giro);
    ctx.scale(toma.zoom, toma.zoom);
    ctx.translate(-toma.px, -toma.py);
  }
  try {
    fn();
  } finally {
    for (const ctx of lista) ctx.restore();
  }
}
