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
//   · −14 LUFS medidos (BS.1770) con limitador enlazado a −1 dBFS
import {DURACION_PORTADA} from '../canal/diseno';
import {cuantizar, pulsoDe, type Pulso} from '../canal/pulso';
import {anclasNoEncontradas, finImpacto, momentoImpacto, resolverPanel, tiempoDeAncla} from '../canal/tiempos';
import type {ConfigEpisodio, Tiempos} from '../canal/tipos';
import {barrido, golpeCorto, impresora, papel, sello, tic, ticShepard, zumbido} from './instrumentos';
import {musicaMisterio, musicaViva, type PlanMusical} from './musica';
import {aDb, db, estereo, normalizarLufs, rms, sumarPaneado} from './sintesis';

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
  /**
   * En lugar de un tic, un efecto de la plantilla: la impresora en un corte de escena, `golpe` (bombo +
   * palmada, para los empujones de cámara), `barrido` (aire que sube y TERMINA en `t`, para llegar a
   * un corte) o `parada` (la música calla desde `t` durante `duracion` s; no suena nada).
   */
  efecto?: 'impresora' | 'papel' | 'golpe' | 'barrido' | 'parada';
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
const LUFS_OBJETIVO = -14; // Reels/TikTok/Shorts
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

/**
 * Plan musical a partir de la línea de tiempo del episodio. Tras la revelación: 2 compases a tope
 * y luego intensidad media (0,65) mientras se explica, hasta el remate. Cada golpe (la revelación y
 * los de `audio.golpes`) lleva un tiempo de silencio justo antes.
 */
function planMusical(config: ConfigEpisodio, tiempos: Tiempos, duracion: number, pulso: Pulso, revelacion: number | null): PlanMusical {
  const extras = (config.audio?.golpes ?? [])
    .map((g) => anclaOSegundos(g, tiempos))
    .filter((g): g is number => g !== null)
    .map((g) => cuantizar(g, pulso));
  const golpes = [...(revelacion !== null ? [revelacion] : []), ...extras];
  const remateBruto = anclaOSegundos(config.audio?.remate, tiempos);
  // Reserva aire para oír el acorde, incluso sin revelación o con un remate demasiado tardío.
  const limiteFinal = Math.max(0, duracion - pulso.compas * 0.75);
  const remate = Math.min(limiteFinal, Math.max(0, remateBruto !== null ? cuantizar(remateBruto, pulso)
    : revelacion !== null ? revelacion + 2 * pulso.compas : duracion - 2 * pulso.compas));
  const final = Math.max(0, cuantizar(Math.max(remate, limiteFinal), pulso, 4, 'anterior'));
  const salida = DURACION_PORTADA;
  return {
    duracion,
    pulso,
    final,
    caidas: golpes.map((g): [number, number] => [g - pulso.negra, g]),
    golpes,
    intensidad: (t) => {
      if (t < salida - 0.01) return 0.2;
      if (revelacion !== null && t < revelacion) return 0.3 + 0.55 * Math.min(1, (t - salida) / Math.max(1, revelacion - salida));
      if (revelacion === null && t < remate) return 0.35 + 0.5 * Math.min(1, (t - salida) / Math.max(1, remate - salida));
      if (t < remate) return revelacion !== null && t < revelacion + 2 * pulso.compas ? 1 : 0.65;
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
  // Valida también las referencias de un plan con música desactivada.
  for (const valor of [audio.revelacion, audio.remate, ...(audio.golpes ?? [])]) {
    if (typeof valor === 'string') tiempoDeAncla(tiempos, valor);
  }
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
      // Fin real (con 'letras' puede pasar de `duracion`): la música sube cuando el texto se va
      return inicio === null ? null : {inicio, fin: finImpacto(imp, inicio, pulso)};
    })
    .filter((x): x is {inicio: number; fin: number} => x !== null);
  const revelacionBruta = anclaOSegundos(audio.revelacion, tiempos);
  const revelacion = revelacionBruta !== null ? cuantizar(revelacionBruta, pulso) : null;

  const propios = eventos ? eventos({config, tiempos, duracion, pulso}) : [];

  // 3. Música compuesta para el episodio, con ducking
  if (audio.musica !== false) {
    const plan = planMusical(config, tiempos, duracion, pulso, revelacion);
    for (const ev of propios) if (ev.efecto === 'parada') plan.caidas.push([ev.t, ev.t + (ev.duracion ?? pulso.negra)]);
    const componer = audio.estilo === 'viva' ? musicaViva : musicaMisterio;
    const {base, acentos} = componer(sr, plan, config.semilla);
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
  for (const ev of propios) {
    if (ev.efecto === 'parada') continue; // ya está en el plan musical
    if (ev.efecto === 'barrido') {
      const largo = ev.duracion ?? pulso.negra;
      sumarPaneado(mezcla, barrido(sr, largo, Math.round(ev.t * 100)), sr, ev.t - largo, relativo(ev.volumenDb), ev.pan ?? 0);
      continue;
    }
    const sonido =
      ev.efecto === 'golpe'
        ? golpeCorto(sr, Math.round(ev.t * 100))
        : ev.efecto === 'impresora'
        ? impresora(sr, 0.6, Math.round(ev.t * 100))
        : ev.efecto === 'papel'
          ? papel(sr, true, 0.45, Math.round(ev.t * 100))
          : ev.shepard
            ? ticShepard(sr, ev.frecuencia, ev.duracion ?? 0.09)
            : tic(sr, ev.frecuencia, ev.duracion ?? 0.12, ev.brillo ?? 0.35);
    sumarPaneado(mezcla, sonido, sr, ev.t, relativo(ev.volumenDb), ev.pan ?? 0);
  }
  efectos.push(`${propios.length} eventos del episodio`);
  informe.efectos = efectos;
  informe.avisos = [...anclasNoEncontradas].map((ancla) => `ANCLA NO ENCONTRADA: «${ancla}»`);

  // 6. Sonoridad final medida (BS.1770) y limitador enlazado: −14 LUFS sea cual sea la voz
  informe.lufs = Math.round(normalizarLufs([mezcla.l, mezcla.r], sr, LUFS_OBJETIVO, -1) * 10) / 10;
  informe.duracion_s = Math.round(duracion * 100) / 100;
  return {mezcla, sr, informe};
}
