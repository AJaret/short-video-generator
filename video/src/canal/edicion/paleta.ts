// Estilo "edición" (prueba de nº08b, 2026-11-14): color directo, sin filtro riso. Lo pidió el usuario
// a partir de dos ediciones de motion graphics de referencia: planchas de un solo color a sangre,
// formas blancas, cuadrícula técnica, sólidos 3D y destellos de glitch en los cortes.
//
// Colores medidos en la referencia: azul eléctrico #0848F8, blanco, negro y ámbar #F0B000.
// NO sustituye a la paleta riso del canal (paleta.ts): solo vale para episodios con
// `estilo: "edicion"` en config.json.

export const AZUL = '#0A4AFF';
export const BLANCO = '#FFFFFF';
export const NEGRO = '#050505';
export const AMBAR = '#F5B000';

/** Un fondo y los colores que se leen sobre él. Cada escena usa un tema; el corte cambia de tema. */
export type Tema = {
  nombre: 'azul' | 'blanco' | 'negro';
  fondo: string;
  /** Cuadrícula fina y sus líneas maestras. */
  rejilla: string;
  rejillaFuerte: string;
  /** Líneas, tubos y formas planas. */
  linea: string;
  texto: string;
  /** Caras de un sólido 3D: a plena luz y en sombra (la tapa puede ir en `linea`). */
  solidoLuz: string;
  solidoSombra: string;
  agua: string;
  acento: string;
  /** Líneas secundarias (marcos de selección, guías). */
  tenue: string;
};

export const TEMAS: Record<Tema['nombre'], Tema> = {
  azul: {
    nombre: 'azul',
    fondo: AZUL,
    rejilla: 'rgba(255,255,255,0.10)',
    rejillaFuerte: 'rgba(255,255,255,0.24)',
    linea: BLANCO,
    texto: BLANCO,
    solidoLuz: '#4C4954',
    solidoSombra: '#17161C',
    agua: '#0634BE',
    acento: AMBAR,
    tenue: 'rgba(255,255,255,0.6)',
  },
  blanco: {
    nombre: 'blanco',
    fondo: '#FAFAFC',
    rejilla: 'rgba(10,74,255,0.10)',
    rejillaFuerte: 'rgba(10,74,255,0.26)',
    linea: AZUL,
    texto: '#0A0A0A',
    solidoLuz: '#44444E',
    solidoSombra: '#0A0A0E',
    agua: '#D3DEFB',
    acento: AMBAR,
    tenue: 'rgba(10,74,255,0.6)',
  },
  negro: {
    nombre: 'negro',
    fondo: NEGRO,
    rejilla: 'rgba(255,255,255,0.08)',
    rejillaFuerte: 'rgba(255,255,255,0.2)',
    linea: BLANCO,
    texto: BLANCO,
    solidoLuz: '#3A6FFF',
    solidoSombra: '#03207A',
    agua: '#15171F',
    acento: AMBAR,
    tenue: 'rgba(255,255,255,0.55)',
  },
};

const aRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Mezcla dos colores '#RRGGBB' (f = 0 → a, f = 1 → b). */
export function mezclarColor(a: string, b: string, f: number): string {
  const [ar, ag, ab] = aRgb(a);
  const [br, bg, bb] = aRgb(b);
  const k = Math.max(0, Math.min(1, f));
  return `rgb(${Math.round(ar + (br - ar) * k)},${Math.round(ag + (bg - ag) * k)},${Math.round(ab + (bb - ab) * k)})`;
}
