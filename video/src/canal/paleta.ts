// Paleta del canal. Son los ÚNICOS colores permitidos (ver CLAUDE.md §1).

export const PAPEL = '#F2EBDD';
export const TINTA_A = '#FF48B0'; // rosa fluor
export const TINTA_B = '#0078BF'; // azul riso
export const NEGRO = '#1E1E1E'; // texto · negro riso

/** Tintas de serie: un episodio puede sustituir UNA de las dos tintas por una de estas. */
export const TINTAS_SERIE = {
  verdeAzulado: '#00838A',
  amarillo: '#FFE800',
  naranja: '#FF6C2F',
  verde: '#00A95C',
  morado: '#765BA7',
} as const;

export type Tintas = {a: string; b: string};

const SERIE = Object.values(TINTAS_SERIE).map((c) => c.toUpperCase());

/**
 * Valida las tintas de un episodio y devuelve las definitivas.
 * Reglas: A ∈ {rosa, serie}, B ∈ {azul, serie}, como mucho una sustituida y distintas entre sí.
 */
export function resolverTintas(pedidas?: Partial<Tintas>): Tintas {
  const a = (pedidas?.a ?? TINTA_A).toUpperCase();
  const b = (pedidas?.b ?? TINTA_B).toUpperCase();
  const aSustituida = a !== TINTA_A;
  const bSustituida = b !== TINTA_B;
  if (aSustituida && !SERIE.includes(a)) {
    throw new Error(`Tinta A no permitida: ${a}. Usa ${TINTA_A} o una tinta de serie.`);
  }
  if (bSustituida && !SERIE.includes(b)) {
    throw new Error(`Tinta B no permitida: ${b}. Usa ${TINTA_B} o una tinta de serie.`);
  }
  if (aSustituida && bSustituida) {
    throw new Error('Solo se puede sustituir UNA tinta por episodio.');
  }
  if (a === b) {
    throw new Error('Las dos tintas del episodio no pueden ser iguales.');
  }
  return {a, b};
}

/** '#RRGGBB' → [r, g, b] en 0..1 (componentes de color normalizados). */
export function hexARgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
