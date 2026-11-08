// Genera episodios/<ep>/mezcla.wav: voz + música lo-fi + efectos de la plantilla + efectos del
// episodio (episodios/<ep>/sonido.ts, si existe). Todo por código y determinista.
//
// Uso (dentro del servicio video, lo llama producir.py):
//   node scripts/sonido.mjs nº01-hormiga-de-langton
import {build} from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const carpeta = process.argv[2];
if (!carpeta) {
  console.error('Uso: node scripts/sonido.mjs <carpeta del episodio>');
  process.exit(1);
}
const ep = path.resolve('..', 'episodios', carpeta);
for (const archivo of ['config.json', 'tiempos.json', 'voz.wav']) {
  if (!fs.existsSync(path.join(ep, archivo))) {
    console.error(`Falta ${archivo} en ${ep}: genera primero la voz.`);
    process.exit(1);
  }
}

// Compila banda.ts (+ sonido.ts del episodio) a un módulo de Node
const propio = path.join(ep, 'sonido.ts');
const entrada = [
  `export {construirBanda} from ${JSON.stringify(path.resolve('src/sonido/banda.ts'))};`,
  `export {leerWav, escribirWav} from ${JSON.stringify(path.resolve('src/sonido/sintesis.ts'))};`,
  fs.existsSync(propio) ? `export {eventos} from ${JSON.stringify(propio)};` : 'export const eventos = undefined;',
].join('\n');
const compilado = path.resolve('out', 'sonido_compilado.mjs');
await build({
  stdin: {contents: entrada, resolveDir: process.cwd(), sourcefile: 'entrada.ts', loader: 'ts'},
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: compilado,
  alias: {'@canal': './src/canal', '@sonido': './src/sonido'},
  logLevel: 'warning',
});
const m = await import(`${pathToFileURL(compilado).href}?v=${Date.now()}`);

const leerJson = (archivo) => JSON.parse(fs.readFileSync(path.join(ep, archivo), 'utf8'));
const inicio = Date.now();
const voz = m.leerWav(new Uint8Array(fs.readFileSync(path.join(ep, 'voz.wav'))));
const {mezcla, sr, informe} = m.construirBanda({
  config: leerJson('config.json'),
  tiempos: leerJson('tiempos.json'),
  voz,
  eventos: m.eventos,
});
fs.writeFileSync(path.join(ep, 'mezcla.wav'), m.escribirWav([mezcla.l, mezcla.r], sr));
console.log(JSON.stringify({...informe, efectos_propios: Boolean(m.eventos), tiempo_s: (Date.now() - inicio) / 1000}, null, 2));
console.log(`Listo: episodios/${carpeta}/mezcla.wav`);
