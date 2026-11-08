// Medidas del lienzo, zonas seguras y regiones de la plantilla (CLAUDE.md §3).

export const ANCHO = 1080;
export const ALTO = 1920;
export const FPS = 30;

/** Zonas seguras: no poner nada importante dentro de estos márgenes. */
export const SEGURA = {arriba: 200, abajo: 380, derecha: 140, izquierda: 60} as const;

export type Rect = {x: number; y: number; w: number; h: number};

/** Región útil: donde puede ir el contenido importante. */
export const UTIL: Rect = {
  x: SEGURA.izquierda,
  y: SEGURA.arriba,
  w: ANCHO - SEGURA.izquierda - SEGURA.derecha,
  h: ALTO - SEGURA.arriba - SEGURA.abajo,
};

/** Recorte central 3:4 de la miniatura (1080×1440). */
export const RECORTE_PORTADA: Rect = {x: 0, y: (ALTO - 1440) / 2, w: 1080, h: 1440};

/** Panel de datos: ~35 % inferior de la región útil, pegado a la zona segura de abajo. */
export const PANEL_ALTO = Math.round(UTIL.h * 0.35);
export const PANEL: Rect = {
  x: UTIL.x,
  y: UTIL.y + UTIL.h - PANEL_ALTO,
  w: UTIL.w,
  h: PANEL_ALTO,
};

/** Separación entre la tira de subtítulos y el panel cuando este está arriba. */
export const HUECO_SUBTITULO = 40;

/** Centro vertical de la tira de subtítulos sin panel (tercio inferior, sobre la zona segura). */
export const SUBTITULO_Y = UTIL.y + UTIL.h - 90;

/** Segundos que la portada permanece en pantalla (gancho de 0–3 s). */
export const DURACION_PORTADA = 2.6;

/** Duración por defecto de un dato de impacto, en segundos. */
export const DURACION_IMPACTO = 1.6;
