// Tipos compartidos entre la plantilla y los episodios.
import type React from 'react';
import type {Tintas} from './paleta';
import type {Rect} from './diseno';

/** Momento de impacto: texto grande al centro. Máximo 3 por video. */
export type Impacto = {
  texto: string;
  /** Palabra o frase del guion donde empieza (se busca en tiempos.json). */
  ancla?: string;
  /** Alternativa a `ancla`: segundo exacto de inicio. */
  desde?: number;
  /** Duración en segundos (por defecto 1.6). */
  duracion?: number;
};

/** config.json de un episodio. */
export type ConfigEpisodio = {
  numero: number;
  /** Tema corto para "nº XX / tema". */
  tema: string;
  /** Título de portada (se muestra en mayúsculas). */
  titulo: string;
  semilla: number;
  tintas?: Partial<Tintas>;
  impactos?: Impacto[];
  /**
   * Panel de datos: solo en episodios con simulación o números. Sube en `desde` (s) o en `ancla`;
   * baja en `hasta` (s, o una palabra/frase del guion).
   */
  panel?: {desde?: number; ancla?: string; hasta?: number | string; titulo?: string};
  /** Segundos extra tras la última palabra (por defecto 1.5). */
  cola?: number;
  /** Banda sonora (ver video/src/sonido/banda.ts). */
  audio?: {
    /** Música lo-fi de fondo (por defecto sí). */
    musica?: boolean;
    /** Música respecto a la voz, en dB (por defecto −18). */
    musicaDb?: number;
    /** Momento de la revelación (ancla del guion o segundos): el zumbido crece hasta ahí. */
    revelacion?: string | number;
  };
};

/** Una palabra de tiempos.json. */
export type Palabra = {texto: string; inicio: number; fin: number};

/** tiempos.json generado por voz/generar.py. */
export type Tiempos = {palabras: Palabra[]; duracion: number};

/** Lo que el sketch devuelve para el panel de datos. */
export type DatosPanel = {
  contadores?: {etiqueta: string; valor: string}[];
  formula?: string;
  /** Mini gráfico: valores en 0..1. */
  grafico?: number[];
};

/** Props que recibe el componente Sketch de cada episodio. */
export type PropsSketch = {
  config: ConfigEpisodio;
  /** Área disponible para la animación (se compacta arriba cuando sube el panel). */
  area: Rect;
  /** Tiempos de la voz, para sincronizar la animación con la narración (ver tiempoDeAncla). */
  tiempos: Tiempos | null;
};

/** Lo que recibe la función panel() de un sketch, además del fotograma. */
export type ContextoSketch = {
  fps: number;
  /** Duración total de la composición en fotogramas. */
  duracion: number;
  tiempos: Tiempos | null;
  config: ConfigEpisodio;
};

/** Módulo Sketch.tsx de un episodio. */
export type ModuloSketch = {
  default: React.FC<PropsSketch>;
  /** Opcional: datos del panel para el fotograma dado. */
  panel?: (frame: number, contexto: ContextoSketch) => DatosPanel;
};
