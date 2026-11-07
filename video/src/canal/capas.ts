// Sistema de capas por tinta.
//
// Cada componente (sketch, subtítulos, panel…) no pinta en el DOM: registra una función de dibujo
// con useDibujo(). En cada fotograma <RisoFilter> limpia las capas, llama a todas las funciones en
// orden y pasa el resultado por el shader riso.
//
// Convención de las capas (una por tinta: a, b, k):
//   cobertura de tinta = alfa × (1 − luminancia)
//   → negro opaco = tinta al 100 %, gris = tinta parcial (se tramará), blanco/transparente = sin tinta.
//
// Capas tramadas (a, b, k): todo lo que tiene volumen o tono; pasan por el dither Bayer de 3 px.
// Capas sólidas (solido.a, solido.b, solido.k): texto y líneas finas. Sin trama (el punto de 3 px
// rompe la letra pequeña), pero con el mismo desajuste de registro que su tinta.
// Para dejar "papel" (quitar tinta ya dibujada) usa recortarPapel().
import {createContext, useContext, useLayoutEffect, useRef} from 'react';

export type Capas = {
  /** Tinta A (rosa fluor o la sustituta del episodio). */
  a: CanvasRenderingContext2D;
  /** Tinta B (azul riso o la sustituta). */
  b: CanvasRenderingContext2D;
  /** Negro riso. */
  k: CanvasRenderingContext2D;
  /** Texto y líneas finas, sin trama (umbral al 50 %). */
  solido: {a: CanvasRenderingContext2D; b: CanvasRenderingContext2D; k: CanvasRenderingContext2D};
};

/** Las seis capas en una lista (tramadas y sólidas). */
export const todasLasCapas = (c: Capas): CanvasRenderingContext2D[] => [c.a, c.b, c.k, c.solido.a, c.solido.b, c.solido.k];

export type InfoDibujo = {
  /** Fotograma absoluto de la composición. */
  frame: number;
  fps: number;
  /** Segundos desde el inicio. */
  t: number;
  ancho: number;
  alto: number;
};

export type FnDibujo = (capas: Capas, info: InfoDibujo) => void;

/** Orden de dibujo de la plantilla: lo de mayor número queda encima. */
export const ORDEN = {
  sketch: 0,
  panel: 10,
  impacto: 20,
  subtitulo: 30,
  numeracion: 40,
  portada: 50,
} as const;

type Entrada = {orden: number; fn: FnDibujo};
export type Registro = Map<symbol, Entrada>;

export const ContextoRiso = createContext<Registro | null>(null);

/**
 * Registra una función de dibujo para este fotograma. Debe usarse dentro de <RisoFilter>.
 * La función se ejecuta en cada fotograma después de que el componente se renderiza.
 */
export function useDibujo(orden: number, fn: FnDibujo): void {
  const registro = useContext(ContextoRiso);
  const id = useRef<symbol | null>(null);
  if (id.current === null) id.current = Symbol('dibujo');
  useLayoutEffect(() => {
    if (!registro) throw new Error('useDibujo() debe usarse dentro de <RisoFilter>.');
    const clave = id.current as symbol;
    registro.set(clave, {orden, fn});
    return () => {
      registro.delete(clave);
    };
  });
}

/** Color de relleno para una cobertura dada (0..1) en cualquier capa. */
export function cobertura(valor = 1): string {
  const v = Math.max(0, Math.min(1, valor));
  return `rgba(0,0,0,${v})`;
}

/**
 * Quita la tinta ya dibujada dentro del trazado (deja papel) en las seis capas.
 * `fuerza` < 1 deja papel parcial (útil para entradas y salidas).
 * `trazar` debe construir un path (beginPath + rect/moveTo…), no rellenarlo.
 */
export function recortarPapel(
  capas: Capas,
  trazar: (ctx: CanvasRenderingContext2D) => void,
  fuerza = 1,
): void {
  for (const ctx of todasLasCapas(capas)) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = cobertura(fuerza);
    trazar(ctx);
    ctx.fill();
    ctx.restore();
  }
}
