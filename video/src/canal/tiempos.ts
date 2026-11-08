// Utilidades sobre tiempos.json: grupos de subtítulos, palabra activa y anclas de impacto.
import {DURACION_IMPACTO, FPS} from './diseno';
import {BPM_POR_DEFECTO, cuantizar, type Pulso} from './pulso';
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

/** Diagnóstico de la producción actual; sonido.mjs lo vacía al empezar cada episodio. */
export const anclasNoEncontradas = new Set<string>();

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
  if (!buscada.length) {
    anclasNoEncontradas.add(ancla);
    return null;
  }
  const palabras = tiempos.palabras.map((p) => normalizar(p.texto));
  for (let i = 0; i + buscada.length <= palabras.length; i++) {
    if (buscada.every((a, j) => palabras[i + j] === a)) return tiempos.palabras[i].inicio;
  }
  anclasNoEncontradas.add(ancla);
  return null;
}

/** Segundo de inicio de un impacto: `desde` o la primera aparición de su `ancla` en el guion. */
export function inicioImpacto(impacto: Impacto, tiempos: Tiempos | null): number | null {
  if (typeof impacto.desde === 'number') return impacto.desde;
  return impacto.ancla ? tiempoDeAncla(tiempos, impacto.ancla) : null;
}

/**
 * Momento en que entra un impacto: su ancla (o `desde`), llevada al tiempo de la música más cercano
 * si hay pulso (el sello cae en el pulso, a como mucho media negra de la palabra).
 */
export function momentoImpacto(impacto: Impacto, tiempos: Tiempos | null, pulso?: Pulso | null): number | null {
  const t = inicioImpacto(impacto, tiempos);
  return t === null || !pulso ? t : cuantizar(t, pulso);
}

/** Segundos que tarda cada letra de textoLetras() (cinetica.ts) en asentarse. */
export const ASIENTO_LETRA = 0.1;
/** Fotogramas del fundido de salida de un impacto (DatoImpacto.tsx). */
export const SALIDA_IMPACTO = 6;
/** Segundos mínimos con la palabra completa a la vista antes de que empiece la salida. */
const LECTURA_IMPACTO = 0.6;

/**
 * Segundo en que termina de verdad un impacto que entra en `inicio`. Con entrada 'letras' el texto se
 * imprime a una letra por semicorchea, así que un texto largo no cabe en `duracion`: el fin se
 * alarga hasta que la última letra se asienta, se lee (~0,6 s) y sale. Lo usan la imagen
 * (tramosImpacto) y la música (ducking de banda.ts), para que los dos acaben a la vez.
 */
export function finImpacto(impacto: Impacto, inicio: number, pulso?: Pulso | null, fps = FPS): number {
  const fin = inicio + (impacto.duracion ?? DURACION_IMPACTO);
  if ((impacto.entrada ?? 'sello') !== 'letras') return fin;
  const negra = pulso?.negra ?? 60 / BPM_POR_DEFECTO; // mismo ritmo de reserva que DatoImpacto
  const letras = impacto.texto.replace(/\s/g, '').length;
  const ultima = inicio + Math.max(0, letras - 1) * negra * 0.25;
  return Math.max(fin, ultima + ASIENTO_LETRA + LECTURA_IMPACTO + SALIDA_IMPACTO / fps);
}

/**
 * Panel con `desde` y `hasta` en segundos. `desde` puede venir de `ancla`; `hasta` puede ser un
 * número o una palabra/frase del guion (el panel baja cuando la voz la dice). Sin tiempos, sube a los 5 s.
 * Con pulso, ambos caen en el tiempo de la música más cercano.
 */
export function resolverPanel(
  panel: ConfigEpisodio['panel'],
  tiempos: Tiempos | null,
  pulso?: Pulso | null,
): {desde: number; hasta?: number; titulo?: string} | undefined {
  if (!panel) return undefined;
  const alPulso = (t: number) => (pulso ? cuantizar(t, pulso) : t);
  const desde = alPulso(panel.desde ?? (panel.ancla ? tiempoDeAncla(tiempos, panel.ancla) : null) ?? 5);
  const hastaBruto = typeof panel.hasta === 'string' ? (tiempoDeAncla(tiempos, panel.hasta) ?? undefined) : panel.hasta;
  return {desde, hasta: hastaBruto === undefined ? undefined : alPulso(hastaBruto), titulo: panel.titulo};
}
