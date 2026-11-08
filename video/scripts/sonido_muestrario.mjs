// Genera video/src/muestrario/mezcla.wav: la banda del muestrario del kit de motion graphics.
//
// Uso (dentro del servicio video):
//   node scripts/sonido_muestrario.mjs
import {build} from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const entrada = [
  `export {bandaMuestrario} from ${JSON.stringify(path.resolve('src/muestrario/sonido.ts'))};`,
  `export {escribirWav} from ${JSON.stringify(path.resolve('src/sonido/sintesis.ts'))};`,
].join('\n');
const compilado = path.resolve('out', 'sonido_muestrario.mjs');
await build({
  stdin: {contents: entrada, resolveDir: process.cwd(), sourcefile: 'entrada.ts', loader: 'ts'},
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: compilado,
  alias: {'@canal': './src/canal', '@sonido': './src/sonido'},
  loader: {'.woff2': 'empty'}, // las fuentes no hacen falta para el sonido
  logLevel: 'warning',
});
const m = await import(`${pathToFileURL(compilado).href}?v=${Date.now()}`);
const {mezcla, sr, informe} = m.bandaMuestrario();
fs.writeFileSync(path.resolve('src/muestrario/mezcla.wav'), m.escribirWav([mezcla.l, mezcla.r], sr));
console.log(JSON.stringify(informe, null, 2));
console.log('Listo: video/src/muestrario/mezcla.wav');
