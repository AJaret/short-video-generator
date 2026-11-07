// Utilidades sobre tiempos.json: grupos de subtítulos, palabra activa y anclas de impacto.
import type {ConfigEpisodio, Impacto, Palabra, Tiempos} from './tipos';

/** Minúsculas, sin acentos ni puntuación: para comparar palabras del guion. */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ\s]/g, '')
    .trim();
}

export type Grupo = {palabras: Palabra[]; inicio: number; fin: number};

const FIN_DE_FRASE = /[.,;:?!…]$/;

/** Agrupa las palabras en bloques de 2–3 para el subtítulo normal. */
export function agruparSubtitulos(palabras: Palabra[], maxPalabras = 3, maxCaracteres = 26): Grupo[] {
  const grupos: Grupo[] = [];
  let actual: Palabra[] = [];
  const cerrar = () => {
    if (actual.length === 0) return;
    grupos.push({palabras: actual, inicio: actual[0].inicio, fin: actual[actual.length - 1].fin});
    actual = [];
  };
  for (const p of palabras) {
    const largo = [...actual, p].map((x) => x.texto).join(' ').length;
    if (actual.length >= maxPalabras || (actual.length > 0 && largo > maxCaracteres)) cerrar();
    actual.push(p);
    if (FIN_DE_FRASE.test(p.texto)) cerrar();
  }
  cerrar();
  return grupos;
}

/**
 * Grupo visible en el segundo `t`: desde su primera palabra hasta que empieza el siguiente
 * (o 0.6 s después de su última palabra si hay silencio).
 */
export function grupoEn(grupos: Grupo[], t: number): Grupo | null {
  for (let i = 0; i < grupos.length; i++) {
    const g = grupos[i];
    const siguiente = grupos[i + 1]?.inicio ?? Infinity;
    const finVisible = Math.min(siguiente, g.fin + 0.6);
    if (t >= g.inicio && t < finVisible) return g;
  }
  return null;
}

/** Índice de la palabra activa dentro del grupo (la última que ya empezó). */
export function palabraActiva(grupo: Grupo, t: number): number {
  let activa = 0;
  grupo.palabras.forEach((p, i) => {
    if (t >= p.inicio) activa = i;
  });
  return activa;
}

/**
 * Segundo en que la voz empieza a decir `ancla` (palabra o frase del guion, sin importar acentos,
 * mayúsculas ni puntuación). `null` si no hay tiempos o no aparece.
 * Sirve para sincronizar animación, panel e impactos con la narración.
 */
export function tiempoDeAncla(tiempos: Tiempos | null, ancla: string): number | null {
  if (!tiempos) return null;
  const buscada = normalizar(ancla).split(/\s+/).filter(Boolean);
  const palabras = tiempos.palabras.map((p) => normalizar(p.texto));
  for (let i = 0; i + buscada.length <= palabras.length; i++) {
    if (buscada.every((a, j) => palabras[i + j] === a)) return tiempos.palabras[i].inicio;
  }
  return null;
}

/** Segundo de inicio de un impacto: `desde` o la primera aparición de su `ancla` en el guion. */
export function inicioImpacto(impacto: Impacto, tiempos: Tiempos | null): number | null {
  if (typeof impacto.desde === 'number') return impacto.desde;
  return impacto.ancla ? tiempoDeAncla(tiempos, impacto.ancla) : null;
}

/**
 * Panel con `desde` y `hasta` en segundos. `desde` puede venir de `ancla`; `hasta` puede ser un
 * número o una palabra/frase del guion (el panel baja cuando la voz la dice). Sin tiempos, sube a los 5 s.
 */
export function resolverPanel(
  panel: ConfigEpisodio['panel'],
  tiempos: Tiempos | null,
): {desde: number; hasta?: number; titulo?: string} | undefined {
  if (!panel) return undefined;
  const desde = panel.desde ?? (panel.ancla ? tiempoDeAncla(tiempos, panel.ancla) : null) ?? 5;
  const hasta = typeof panel.hasta === 'string' ? (tiempoDeAncla(tiempos, panel.hasta) ?? undefined) : panel.hasta;
  return {desde, hasta, titulo: panel.titulo};
}
