// Banda sonora de un episodio: voz + música lo-fi + efectos de la plantilla + efectos del episodio,
// mezclada por código en una sola pista (mezcla.wav) que Remotion solo reproduce.
//
// Reglas de mezcla (CLAUDE.md §2):
//   · música ≈ 18 dB por debajo de la voz; baja 3 dB más mientras habla la voz (sidechain)
//     y 7 dB más durante los datos de impacto ("baja cuando entra el dato clave")
//   · impresora riso al salir la portada; papel cuando el panel sube/baja; sello en cada impacto
//   · zumbido grave que crece durante los segundos previos a la revelación y se corta en ella
//   · limitador final a −1 dBFS
import {DURACION_IMPACTO, DURACION_PORTADA} from '../canal/diseno';
import {inicioImpacto, resolverPanel, tiempoDeAncla} from '../canal/tiempos';
import type {ConfigEpisodio, Tiempos} from '../canal/tipos';
import {impresora, musicaLofi, papel, sello, tic, ticShepard, zumbido} from './instrumentos';
import {aDb, db, limitador, rms, sumarEn} from './sintesis';

/** Efecto puntual que un episodio pide (sonido.ts): un tic afinado. */
export type EventoSonoro = {
  t: number;
  /** Hz (tic normal) o semitonos respecto a la4 si `shepard` (solo importa la nota, no la octava). */
  frecuencia: number;
  /** dB respecto a la voz (p. ej. −20). */
  volumenDb: number;
  duracion?: number;
  brillo?: number;
  /** Tic de Shepard: subida "infinita" si cada evento sube un escalón (ver ticShepard). */
  shepard?: boolean;
};

export type ContextoSonido = {config: ConfigEpisodio; tiempos: Tiempos; duracion: number};

export type EntradaBanda = {
  config: ConfigEpisodio;
  tiempos: Tiempos;
  voz: {sr: number; datos: Float32Array};
  /** Efectos propios del episodio (función exportada por episodios/<ep>/sonido.ts). */
  eventos?: (contexto: ContextoSonido) => EventoSonoro[];
};

const COLA_POR_DEFECTO = 1.5;
const GANANCIA_FINAL_DB = 3.2; // objetivo ≈ −14 LUFS (Reels/TikTok/Shorts), medido con pyloudnorm
const DURACION_ZUMBIDO = 4;

/** Nivel de la voz (RMS de los tramos con habla, en dB) y máscara de "está hablando" cada 10 ms. */
function analizarVoz(voz: Float32Array, sr: number): {nivelDb: number; habla: Float32Array} {
  const marco = Math.round(sr * 0.01);
  const n = Math.ceil(voz.length / marco);
  const energia = new Float32Array(n);
  for (let i = 0; i < n; i++) energia[i] = aDb(rms(voz, i * marco, Math.min(voz.length, (i + 1) * marco)));
  const activos = [...energia].filter((e) => e > -45);
  const nivelDb = activos.length ? aDb(Math.sqrt(activos.reduce((s, e) => s + db(e) ** 2, 0) / activos.length)) : -30;
  const habla = new Float32Array(n);
  for (let i = 0; i < n; i++) habla[i] = energia[i] > nivelDb - 20 ? 1 : 0;
  return {nivelDb, habla};
}

/** Curva de ganancia (por marco de 10 ms) suavizada con ataque y relajación distintos. */
function suavizar(objetivo: Float32Array, ataqueMarcos: number, relajaMarcos: number): Float32Array {
  const y = new Float32Array(objetivo.length);
  let g = objetivo[0] ?? 1;
  for (let i = 0; i < objetivo.length; i++) {
    const k = objetivo[i] < g ? 1 / ataqueMarcos : 1 / relajaMarcos;
    g += (objetivo[i] - g) * k;
    y[i] = g;
  }
  return y;
}

export function construirBanda({config, tiempos, voz, eventos}: EntradaBanda) {
  const sr = voz.sr;
  const duracion = tiempos.duracion + (config.cola ?? COLA_POR_DEFECTO);
  const n = Math.ceil(duracion * sr);
  const mezcla = new Float32Array(n);
  const audio = config.audio ?? {};
  const {nivelDb, habla} = analizarVoz(voz.datos, sr);
  const relativo = (dbRespectoVoz: number) => db(nivelDb + dbRespectoVoz); // ganancia para picos ≈ 0 dBFS
  const informe: Record<string, unknown> = {voz_db: Math.round(nivelDb * 10) / 10};

  // 1. Voz
  sumarEn(mezcla, voz.datos, sr, 0, 1);

  // 2. Música con ducking
  const impactos = (config.impactos ?? [])
    .map((imp) => {
      const inicio = inicioImpacto(imp, tiempos);
      return inicio === null ? null : {inicio, fin: inicio + (imp.duracion ?? DURACION_IMPACTO)};
    })
    .filter((x): x is {inicio: number; fin: number} => x !== null);
  if (audio.musica !== false) {
    const musica = musicaLofi(sr, duracion, config.semilla);
    const musicaDb = audio.musicaDb ?? -18;
    const base = db(nivelDb + musicaDb) / db(-20); // la pista sale a −20 dB RMS
    const marcos = Math.ceil(n / Math.round(sr * 0.01));
    const objetivo = new Float32Array(marcos);
    for (let i = 0; i < marcos; i++) {
      const t = i * 0.01;
      let g = 1;
      if (habla[i]) g *= db(-3);
      if (impactos.some(({inicio, fin}) => t >= inicio - 0.1 && t <= fin + 0.2)) g *= db(-7);
      objetivo[i] = g;
    }
    const ganancia = suavizar(objetivo, 5, 30); // ataque 50 ms, relajación 300 ms
    const marco = Math.round(sr * 0.01);
    for (let i = 0; i < Math.min(n, musica.length); i++) {
      mezcla[i] += musica[i] * base * ganancia[Math.min(ganancia.length - 1, Math.floor(i / marco))];
    }
    informe.musica_db_respecto_voz = musicaDb;
  }

  // 3. Efectos de la plantilla
  const efectos: string[] = [];
  sumarEn(mezcla, impresora(sr, 0.9, config.semilla), sr, DURACION_PORTADA - 0.35, relativo(-6));
  efectos.push(`impresora ${(DURACION_PORTADA - 0.35).toFixed(2)} s`);

  const panel = resolverPanel(config.panel, tiempos);
  if (panel) {
    sumarEn(mezcla, papel(sr, true), sr, panel.desde, relativo(-8));
    efectos.push(`papel ↑ ${panel.desde.toFixed(2)} s`);
    if (panel.hasta !== undefined) {
      sumarEn(mezcla, papel(sr, false, 0.45, 14), sr, panel.hasta, relativo(-10));
      efectos.push(`papel ↓ ${panel.hasta.toFixed(2)} s`);
    }
  }
  for (const {inicio} of impactos) {
    sumarEn(mezcla, sello(sr, Math.round(inicio * 100)), sr, inicio, relativo(-3));
    sumarEn(mezcla, impresora(sr, 0.35, Math.round(inicio * 10)), sr, inicio + 0.05, relativo(-14));
    efectos.push(`sello ${inicio.toFixed(2)} s`);
  }

  const revelacion =
    typeof audio.revelacion === 'number' ? audio.revelacion : audio.revelacion ? tiempoDeAncla(tiempos, audio.revelacion) : null;
  if (revelacion !== null) {
    const largo = Math.min(DURACION_ZUMBIDO, revelacion - DURACION_PORTADA);
    if (largo > 0.5) {
      sumarEn(mezcla, zumbido(sr, largo, config.semilla), sr, revelacion - largo, relativo(-7));
      efectos.push(`zumbido ${(revelacion - largo).toFixed(2)}–${revelacion.toFixed(2)} s`);
    }
  }

  // 4. Efectos del episodio
  const propios = eventos ? eventos({config, tiempos, duracion}) : [];
  for (const ev of propios) {
    const sonido = ev.shepard
      ? ticShepard(sr, ev.frecuencia, ev.duracion ?? 0.09)
      : tic(sr, ev.frecuencia, ev.duracion ?? 0.12, ev.brillo ?? 0.35);
    sumarEn(mezcla, sonido, sr, ev.t, relativo(ev.volumenDb));
  }
  efectos.push(`${propios.length} eventos del episodio`);
  informe.efectos = efectos;

  // 5. Volumen final y limitador
  const g = db(GANANCIA_FINAL_DB);
  for (let i = 0; i < n; i++) mezcla[i] *= g;
  limitador(mezcla, sr, -1);
  informe.duracion_s = Math.round(duracion * 100) / 100;
  return {mezcla, sr, informe};
}
