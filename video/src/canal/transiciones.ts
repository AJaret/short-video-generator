// Transiciones entre escenas, en el pulso. Funciones de dibujo puras (sin React).
//
// Todas tapan y destapan: empiezan en un tiempo de la música, tapan la escena con tinta hasta la
// mitad (el CORTE de escena ocurre ahí, escondido bajo la tinta) y la destapan en la otra mitad.
// Por defecto duran 2 negras, así que el corte también cae en un tiempo.
//
//   · 'barrido': una mancha de tinta con borde ondulado y orla punteada (la trama a 2/3 y 1/3)
//     cruza la pantalla en cualquier ángulo. Es la "ola azul" de la referencia.
//   · 'iris':    un anillo de tinta que se cierra hacia un punto y se abre desde él.
//   · 'trama':   la escena se cubre de puntos de tinta que crecen en oleada y luego se encogen:
//     una nube de partículas hecha con la propia trama.
//   · 'corte':   corte seco (no dibuja nada).
import {cobertura, recortarPapel, type Capas} from './capas';
import {entradaSalidaCubica, limitar01} from './curvas';
import {trazarCirculoIrregular} from './dibujo';
import {ALTO, ANCHO} from './diseno';
import type {NombreTinta} from './fondos';
import {hash01, ruido1d} from './prng';
import type {Pulso} from './pulso';

export type TipoTransicion = 'corte' | 'barrido' | 'iris' | 'trama';

export type Transicion = {
  /** Segundo en que empieza (debería caer en un tiempo: usa cuantizar()). */
  t: number;
  tipo: TipoTransicion;
  /** Duración en negras (por defecto 2: el corte cae justo en el tiempo siguiente). */
  negras?: number;
  /** Tinta que tapa (por defecto 'b'). */
  tinta?: NombreTinta;
  /** Barrido: hacia dónde avanza, en grados (0 = sube, 90 = hacia la derecha, 180 = baja…). */
  angulo?: number;
  /** Iris: centro (por defecto el centro del lienzo). Trama: de dónde sale la oleada. */
  centro?: [number, number];
  semilla?: number;
};

const NEGRAS_POR_DEFECTO = 2;

export const duracionTransicion = (tr: Transicion, pulso: Pulso) => (tr.negras ?? NEGRAS_POR_DEFECTO) * pulso.negra;

/** Momento del corte (la escena cambia aquí, con la pantalla tapada). */
export const corteDe = (tr: Transicion, pulso: Pulso) => (tr.tipo === 'corte' ? tr.t : tr.t + duracionTransicion(tr, pulso) / 2);

/** La transición que está sonando en `t` y su progreso (0…1), o null. */
export function transicionEn(t: number, lista: Transicion[], pulso: Pulso): {tr: Transicion; p: number} | null {
  for (const tr of lista) {
    if (tr.tipo === 'corte') continue;
    const d = duracionTransicion(tr, pulso);
    if (t >= tr.t && t < tr.t + d) return {tr, p: (t - tr.t) / d};
  }
  return null;
}

/** Cuántos cortes han pasado en `t`: el índice de la escena vigente (0 = antes del primero). */
export const escenaEn = (t: number, lista: Transicion[], pulso: Pulso) => lista.filter((tr) => t >= corteDe(tr, pulso)).length;

/** Tapar (0 → 1 en la primera mitad) y destapar (0 → 1 en la segunda), con curva. */
function fases(p: number): [number, number] {
  return [entradaSalidaCubica(limitar01(p * 2)), entradaSalidaCubica(limitar01(p * 2 - 1))];
}

const ORLA = 26; // ancho de cada banda punteada de la orla, en px

export function dibujarTransicion(capas: Capas, tr: Transicion, p: number): void {
  if (tr.tipo === 'barrido') barrido(capas, tr, p);
  else if (tr.tipo === 'iris') iris(capas, tr, p);
  else if (tr.tipo === 'trama') trama(capas, tr, p);
}

// ── Barrido orgánico ──────────────────────────────────────────────────────────────────────────

function barrido(capas: Capas, tr: Transicion, p: number): void {
  const tinta = tr.tinta ?? 'b';
  const semilla = tr.semilla ?? 3;
  const ang = ((tr.angulo ?? 0) * Math.PI) / 180;
  // En coordenadas locales la mancha SUBE (de +y a −y). Medidas del lienzo en ese marco:
  const largo = Math.abs((ALTO / 2) * Math.cos(ang)) + Math.abs((ANCHO / 2) * Math.sin(ang));
  const ancho = Math.abs((ANCHO / 2) * Math.cos(ang)) + Math.abs((ALTO / 2) * Math.sin(ang)) + 40;
  const amp = 70; // ondulación del borde
  const recorrido = largo + amp + ORLA * 2 + 20;
  const [tapa, destapa] = fases(p);
  const frente = recorrido - 2 * recorrido * tapa; // de abajo (+) a arriba (−)
  const cola = recorrido - 2 * recorrido * destapa;

  // Borde ondulado: ruido suave + una onda larga que se desplaza con el avance
  const borde = (x: number, y0: number, s: number) =>
    y0 + amp * ((ruido1d(x / 140 + s * 7, semilla + s) - 0.5) * 1.4 + 0.45 * Math.sin(x / 210 + p * 5 + s));
  const paso = 18;
  const trazarFranja = (ctx: CanvasRenderingContext2D, arriba: number, abajo: number, sA: number, sB: number) => {
    ctx.beginPath();
    for (let x = -ancho; x <= ancho; x += paso) {
      const y = borde(x, arriba, sA);
      if (x === -ancho) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    for (let x = ancho; x >= -ancho; x -= paso) ctx.lineTo(x, borde(x, abajo, sB));
    ctx.closePath();
  };
  const local = (ctx: CanvasRenderingContext2D) => {
    ctx.translate(ANCHO / 2, ALTO / 2);
    ctx.rotate(ang);
  };
  const conMarco = (ctx: CanvasRenderingContext2D, fn: () => void) => {
    ctx.save();
    local(ctx);
    fn();
    ctx.restore();
  };

  if (cola - frente < 1) return;
  // Cuerpo: quita la escena y la tapa con tinta llena
  recortarPapel(capas, (ctx) => {
    local(ctx);
    trazarFranja(ctx, frente, cola, 0, 1);
  });
  const ctx = capas[tinta];
  conMarco(ctx, () => {
    ctx.fillStyle = cobertura(1);
    trazarFranja(ctx, frente, cola, 0, 1);
    ctx.fill();
    // Orla punteada delante y detrás: la trama a 2/3 y a 1/3 sobre la escena
    [0.66, 0.33].forEach((c, i) => {
      ctx.fillStyle = cobertura(c);
      trazarFranja(ctx, frente - ORLA * (i + 1), frente - ORLA * i, 0, 0);
      ctx.fill();
      trazarFranja(ctx, cola + ORLA * i, cola + ORLA * (i + 1), 1, 1);
      ctx.fill();
    });
  });
}

// ── Iris ──────────────────────────────────────────────────────────────────────────────────────

function iris(capas: Capas, tr: Transicion, p: number): void {
  const tinta = tr.tinta ?? 'b';
  const semilla = tr.semilla ?? 5;
  const [cx, cy] = tr.centro ?? [ANCHO / 2, ALTO / 2];
  const rMax = Math.max(Math.hypot(cx, cy), Math.hypot(ANCHO - cx, cy), Math.hypot(cx, ALTO - cy), Math.hypot(ANCHO - cx, ALTO - cy)) + ORLA * 2 + 10;
  const [tapa, destapa] = fases(p);
  // Tinta a sangre con un agujero redondo: el agujero se cierra hacia el centro (tapa) y luego se
  // vuelve a abrir desde el centro, ya con la escena nueva (destapa).
  const interior = rMax * (1 - tapa);
  const hueco = rMax * destapa;
  const anillo = (ctx: CanvasRenderingContext2D, rDentro: number) => {
    ctx.beginPath();
    ctx.rect(-40, -40, ANCHO + 80, ALTO + 80);
    if (rDentro > 1) {
      trazarCirculoIrregular(ctx, cx, cy, rDentro, semilla, 4, 24, true);
    }
  };
  const radio = destapa > 0 ? hueco : interior;
  if (radio >= rMax - 1) return;
  recortarPapel(capas, (ctx) => anillo(ctx, radio), 1, 'evenodd');
  const ctx = capas[tinta];
  ctx.save();
  ctx.fillStyle = cobertura(1);
  anillo(ctx, radio);
  ctx.fill('evenodd');
  // Orla punteada hacia dentro del agujero
  if (radio > 1) {
    [0.66, 0.33].forEach((c, i) => {
      const r1 = radio - ORLA * i;
      const r2 = radio - ORLA * (i + 1);
      if (r1 <= 1) return;
      ctx.fillStyle = cobertura(c);
      trazarCirculoIrregular(ctx, cx, cy, r1, semilla + i + 1, 4);
      if (r2 > 1) trazarCirculoIrregular(ctx, cx, cy, r2, semilla + i + 2, 4, 24, true);
      ctx.fill('evenodd');
    });
  }
  ctx.restore();
}

// ── Disolución en trama (nube de puntos) ──────────────────────────────────────────────────────

const CELDA = 42;

function trama(capas: Capas, tr: Transicion, p: number): void {
  const tinta = tr.tinta ?? 'b';
  const semilla = tr.semilla ?? 9;
  const [ox, oy] = tr.centro ?? [0, ALTO];
  const lejos = Math.max(Math.hypot(ox, oy), Math.hypot(ANCHO - ox, oy), Math.hypot(ox, ALTO - oy), Math.hypot(ANCHO - ox, ALTO - oy));
  const g = limitar01(p * 2);
  const s = limitar01(p * 2 - 1);
  const VENTANA = 0.4; // cada punto tarda este tramo en crecer (o encogerse)
  const puntos: [number, number, number][] = [];
  for (let y = CELDA / 2; y < ALTO + CELDA; y += CELDA) {
    for (let x = CELDA / 2; x < ANCHO + CELDA; x += CELDA) {
      // Retraso: distancia al origen de la oleada + un poco de azar (nube, no frente recto)
      const d = 0.75 * (Math.hypot(x - ox, y - oy) / lejos) + 0.25 * hash01(semilla, x, y);
      const crece = entradaSalidaCubica((g - d * (1 - VENTANA)) / VENTANA);
      const encoge = entradaSalidaCubica((s - d * (1 - VENTANA)) / VENTANA);
      const r = CELDA * 0.74 * (crece - encoge);
      if (r > 1.5) puntos.push([x, y, r]);
    }
  }
  if (!puntos.length) return;
  const trazar = (ctx: CanvasRenderingContext2D) => {
    ctx.beginPath();
    for (const [x, y, r] of puntos) {
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
  };
  recortarPapel(capas, trazar);
  const ctx = capas.solido[tinta];
  ctx.fillStyle = cobertura(1);
  trazar(ctx);
  ctx.fill();
}
