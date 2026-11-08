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
  /**
   * Cómo entra: 'sello' (por defecto, sobretamaño que se asienta), 'letras' (letra a letra en
   * semicorcheas) o 'barrido' (una barra de tinta lo descubre en un tiempo).
   */
  entrada?: 'sello' | 'letras' | 'barrido';
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
  /** Pulso musical (ver pulso.ts): todo lo que se mueve al ritmo usa este tempo. */
  ritmo?: {
    /** Tempo en BPM (por defecto 92). */
    bpm?: number;
    /** "Golpe riso" visual en cada tiempo (por defecto sí). */
    golpeVisual?: boolean | 'compas';
  };
  /** Banda sonora (ver video/src/sonido/banda.ts). */
  audio?: {
    /** Música misterio con guiño (por defecto sí). */
    musica?: boolean;
    /** Música respecto a la voz, en dB (por defecto −18). */
    musicaDb?: number;
    /** Momento de la revelación (ancla del guion o segundos): el zumbido crece hasta ahí. */
    revelacion?: string | number;
    /** Desde aquí la música se reduce al remate (ancla o segundos; por defecto 2 compases tras la revelación). */
    remate?: string | number;
    /** Golpes musicales extra (anclas o segundos), cada uno con un tiempo de silencio antes. */
    golpes?: (string | number)[];
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
