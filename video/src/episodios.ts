// Descubre los episodios en ../../episodios/<carpeta>/ y carga sus archivos.
// Cada carpeta con config.json + Sketch.tsx se convierte en una composición.
import type {ConfigEpisodio, ModuloSketch, Tiempos} from './canal/tipos';

export type Episodio = {
  carpeta: string;
  /** ID de la composición: "nº03-lorenz" → "ep03-lorenz". */
  id: string;
  config: ConfigEpisodio;
  sketch: ModuloSketch;
  tiempos: Tiempos | null;
  /** URL del audio de la voz, si ya se generó. */
  voz: string | null;
};

/** Regla compartida con producir.py para pasar de carpeta a ID de composición. */
export const idDeCarpeta = (carpeta: string) => carpeta.replace(/^nº/, 'ep').replace(/[^a-zA-Z0-9-]/g, '');

const archivos = require.context('../../episodios', true, /^\.\/[^/]+\/(Sketch\.tsx|config\.json|tiempos\.json|voz\.wav)$/);

function cargar(): Episodio[] {
  const porCarpeta = new Map<string, Record<string, unknown>>();
  for (const clave of archivos.keys()) {
    const [, carpeta, archivo] = clave.split('/');
    const entrada = porCarpeta.get(carpeta) ?? {};
    entrada[archivo] = archivos(clave);
    porCarpeta.set(carpeta, entrada);
  }
  const episodios: Episodio[] = [];
  for (const [carpeta, f] of porCarpeta) {
    if (!f['config.json'] || !f['Sketch.tsx']) continue;
    const voz = f['voz.wav'] as {default?: string} | string | undefined;
    episodios.push({
      carpeta,
      id: idDeCarpeta(carpeta),
      config: f['config.json'] as ConfigEpisodio,
      sketch: f['Sketch.tsx'] as ModuloSketch,
      tiempos: (f['tiempos.json'] as Tiempos | undefined) ?? null,
      voz: voz === undefined ? null : typeof voz === 'string' ? voz : (voz.default ?? null),
    });
  }
  return episodios.sort((x, y) => x.carpeta.localeCompare(y.carpeta));
}

export const EPISODIOS = cargar();

export function buscarEpisodio(carpeta: string): Episodio {
  const ep = EPISODIOS.find((e) => e.carpeta === carpeta);
  if (!ep) throw new Error(`No existe el episodio "${carpeta}" en episodios/.`);
  return ep;
}
