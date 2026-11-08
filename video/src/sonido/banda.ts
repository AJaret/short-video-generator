// Banda sonora de un episodio, en estéreo: voz + música compuesta para el episodio + efectos de la
// plantilla + efectos del episodio, mezclada por código en una sola pista (mezcla.wav) que
// Remotion solo reproduce.
//
// Todo lo que suena cae en la rejilla de pulso (pulso.ts), igual que lo que se mueve en pantalla:
//   · música (musica.ts): intensidad que sube hasta la revelación, un tiempo de silencio justo antes
//     ("caída") y golpe de platillo + grave en ella; después, el remate y un acorde final
//   · música ≈ 18 dB bajo la voz; baja 3 dB más mientras habla y 7 dB más durante los impactos
//   · impresora riso al salir la portada (cae en el primer tiempo del compás 1 a 92 BPM),
//     papel cuando el panel sube/baja, sello en cada impacto (todos en el pulso)
//   · zumbido grave que crece durante los 4 s previos a la revelación
//   · −14 LUFS con limitador enlazado a −1 dBFS
import {DURACION_IMPACTO, DURACION_PORTADA} from '../canal/diseno';
import {cuantizar, pulsoDe, type Pulso} from '../canal/pulso';
import {momentoImpacto, resolverPanel, tiempoDeAncla} from '../canal/tiempos';
import type {ConfigEpisodio, Tiempos} from '../canal/tipos';
import {impresora, papel, sello, tic, ticShepard, zumbido} from './instrumentos';
import {musicaMisterio, type PlanMusical} from './musica';
import {aDb, db, estereo, limitador, rms, sumarPaneado} from './sintesis';

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
  /** Paneo (−1 izquierda … 1 derecha). */
  pan?: number;
};

export type ContextoSonido = {config: ConfigEpisodio; tiempos: Tiempos; duracion: number; pulso: Pulso};

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
const CENTRO = Math.SQRT1_2; // lo mono va al centro con −3 dB por canal (misma sonoridad que antes)

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

const anclaOSegundos = (valor: string | number | undefined, tiempos: Tiempos) =>
  typeof valor === 'number' ? valor : valor ? tiempoDeAncla(tiempos, valor) : null;

/** Plan musical a partir de la línea de tiempo del episodio. */
function planMusical(config: ConfigEpisodio, tiempos: Tiempos, duracion: number, pulso: Pulso, revelacion: number | null): PlanMusical {
  const remateBruto = anclaOSegundos(config.audio?.remate, tiempos);
  const remate = remateBruto !== null ? cuantizar(remateBruto, pulso) : revelacion !== null ? revelacion + 2 * pulso.compas : duracion;
  const final = Math.max(remate, cuantizar(duracion - pulso.compas * 0.75, pulso, 4, 'anterior'));
  const salida = DURACION_PORTADA;
  return {
    duracion,
    pulso,
    final,
    caidas: revelacion !== null ? [[revelacion - pulso.negra, revelacion]] : [],
    golpes: revelacion !== null ? [revelacion] : [],
    intensidad: (t) => {
      if (t < salida - 0.01) return 0.2;
      if (revelacion !== null && t < revelacion) return 0.3 + 0.55 * Math.min(1, (t - salida) / Math.max(1, revelacion - salida));
      if (revelacion === null) return 0.35 + 0.5 * Math.min(1, (t - salida) / Math.max(1, remate - salida));
      if (t < remate) return 1;
      return 0.25 * (1 - 0.6 * Math.min(1, (t - remate) / Math.max(1, final - remate)));
    },
  };
}

export function construirBanda({config, tiempos, voz, eventos}: EntradaBanda) {
  const sr = voz.sr;
  const pulso = pulsoDe(config);
  const duracion = tiempos.duracion + (config.cola ?? COLA_POR_DEFECTO);
  const mezcla = estereo(sr, duracion);
  const n = mezcla.l.length;
  const audio = config.audio ?? {};
  const {nivelDb, habla} = analizarVoz(voz.datos, sr);
  /** Ganancia para efectos normalizados a pico 0 dBFS, relativa al nivel de la voz (el paneo al centro ya resta 3 dB). */
  const relativo = (dbRespectoVoz: number) => db(nivelDb + dbRespectoVoz);
  const informe: Record<string, unknown> = {voz_db: Math.round(nivelDb * 10) / 10, bpm: pulso.bpm};

  // 1. Voz, al centro
  sumarPaneado(mezcla, voz.datos, sr, 0, 1);

  // 2. Momentos del episodio, en el pulso
  const impactos = (config.impactos ?? [])
    .map((imp) => {
      const inicio = momentoImpacto(imp, tiempos, pulso);
      return inicio === null ? null : {inicio, fin: inicio + (imp.duracion ?? DURACION_IMPACTO)};
    })
    .filter((x): x is {inicio: number; fin: number} => x !== null);
  const revelacionBruta = anclaOSegundos(audio.revelacion, tiempos);
  const revelacion = revelacionBruta !== null ? cuantizar(revelacionBruta, pulso) : null;

  // 3. Música compuesta para el episodio, con ducking
  if (audio.musica !== false) {
    const plan = planMusical(config, tiempos, duracion, pulso, revelacion);
    const {base, acentos} = musicaMisterio(sr, plan, config.semilla);
    const musicaDb = audio.musicaDb ?? -18;
    const g = (db(nivelDb + musicaDb) / db(-20)) * CENTRO;
    const marco = Math.round(sr * 0.01);
    const marcos = Math.ceil(n / marco);
    const objetivo = new Float32Array(marcos);
    for (let i = 0; i < marcos; i++) {
      const t = i * 0.01;
      let k = 1;
      if (habla[i]) k *= db(-3);
      if (impactos.some(({inicio, fin}) => t >= inicio - 0.1 && t <= fin + 0.2)) k *= db(-7);
      objetivo[i] = k;
    }
    const ducking = suavizar(objetivo, 5, 30);
    for (let i = 0; i < Math.min(n, base.l.length); i++) {
      const d = ducking[Math.min(marcos - 1, Math.floor(i / marco))];
      mezcla.l[i] += (base.l[i] * d + acentos.l[i]) * g;
      mezcla.r[i] += (base.r[i] * d + acentos.r[i]) * g;
    }
    informe.musica = {
      db_respecto_voz: musicaDb,
      caida: plan.caidas.map(([a, b]) => `${a.toFixed(2)}–${b.toFixed(2)} s`),
      golpes: plan.golpes.map((t) => `${t.toFixed(2)} s`),
      acorde_final: `${plan.final.toFixed(2)} s`,
    };
  }

  // 4. Efectos de la plantilla (en el pulso)
  const efectos: string[] = [];
  sumarPaneado(mezcla, impresora(sr, 0.9, config.semilla), sr, DURACION_PORTADA - 0.35, relativo(-6));
  efectos.push(`impresora ${(DURACION_PORTADA - 0.35).toFixed(2)} s`);
  const panel = resolverPanel(config.panel, tiempos, pulso);
  if (panel) {
    sumarPaneado(mezcla, papel(sr, true), sr, panel.desde, relativo(-8), -0.25);
    efectos.push(`papel ↑ ${panel.desde.toFixed(2)} s`);
    if (panel.hasta !== undefined) {
      sumarPaneado(mezcla, papel(sr, false, 0.45, 14), sr, panel.hasta, relativo(-10), 0.25);
      efectos.push(`papel ↓ ${panel.hasta.toFixed(2)} s`);
    }
  }
  for (const {inicio} of impactos) {
    sumarPaneado(mezcla, sello(sr, Math.round(inicio * 100)), sr, inicio, relativo(-3));
    sumarPaneado(mezcla, impresora(sr, 0.35, Math.round(inicio * 10)), sr, inicio + 0.05, relativo(-14), 0.3);
    efectos.push(`sello ${inicio.toFixed(2)} s`);
  }
  if (revelacion !== null) {
    const largo = Math.min(DURACION_ZUMBIDO, revelacion - DURACION_PORTADA);
    if (largo > 0.5) {
      sumarPaneado(mezcla, zumbido(sr, largo, config.semilla), sr, revelacion - largo, relativo(-7));
      efectos.push(`zumbido ${(revelacion - largo).toFixed(2)}–${revelacion.toFixed(2)} s`);
    }
  }

  // 5. Efectos del episodio
  const propios = eventos ? eventos({config, tiempos, duracion, pulso}) : [];
  for (const ev of propios) {
    const sonido = ev.shepard
      ? ticShepard(sr, ev.frecuencia, ev.duracion ?? 0.09)
      : tic(sr, ev.frecuencia, ev.duracion ?? 0.12, ev.brillo ?? 0.35);
    sumarPaneado(mezcla, sonido, sr, ev.t, relativo(ev.volumenDb), ev.pan ?? 0);
  }
  efectos.push(`${propios.length} eventos del episodio`);
  informe.efectos = efectos;

  // 6. Volumen final y limitador enlazado
  const g = db(GANANCIA_FINAL_DB);
  for (let i = 0; i < n; i++) {
    mezcla.l[i] *= g;
    mezcla.r[i] *= g;
  }
  limitador([mezcla.l, mezcla.r], sr, -1);
  informe.duracion_s = Math.round(duracion * 100) / 100;
  return {mezcla, sr, informe};
}
