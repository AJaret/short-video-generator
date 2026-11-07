// Fuentes del canal, empaquetadas desde npm (@fontsource) para que el render no dependa de internet.
// El subconjunto "latin" cubre el español (á, é, ñ, ¿, ¡, º…).
import archivoBlack400 from '@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff2';
import spaceMono400 from '@fontsource/space-mono/files/space-mono-latin-400-normal.woff2';
import spaceMono700 from '@fontsource/space-mono/files/space-mono-latin-700-normal.woff2';

/** Titulares: siempre en mayúsculas. */
export const TITULAR = '"Archivo Black"';
/** Datos, etiquetas, subtítulos normales y numeración. */
export const MONO = '"Space Mono"';

let promesa: Promise<void> | null = null;

/** Carga las fuentes una sola vez y las registra en document.fonts. */
export function cargarFuentes(): Promise<void> {
  if (!promesa) {
    const caras = [
      new FontFace('Archivo Black', `url(${archivoBlack400}) format('woff2')`, {weight: '400'}),
      new FontFace('Space Mono', `url(${spaceMono400}) format('woff2')`, {weight: '400'}),
      new FontFace('Space Mono', `url(${spaceMono700}) format('woff2')`, {weight: '700'}),
    ];
    promesa = Promise.all(
      caras.map((cara) =>
        cara.load().then((cargada) => {
          document.fonts.add(cargada);
        }),
      ),
    ).then(() => undefined);
  }
  return promesa;
}

/** Atajo para ctx.font. */
export function fuente(familia: string, tamano: number, peso: 400 | 700 = 400): string {
  return `${peso} ${tamano}px ${familia}`;
}
