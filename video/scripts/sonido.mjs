// Genera episodios/<ep>/mezcla.wav: voz + música misterio con guiño + efectos de la plantilla + efectos del
// episodio (episodios/<ep>/sonido.ts, si existe). Todo por código y determinista.
//
// Uso (dentro del servicio video, lo llama producir.py):
//   node scripts/sonido.mjs nº01-hormiga-de-langton
import {build} from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

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
  `export {anclasNoEncontradas} from ${JSON.stringify(path.resolve('src/canal/tiempos.ts'))};`,
  fs.existsSync(propio) ? `export {eventos} from ${JSON.stringify(propio)};` : 'export const eventos = undefined;',
].join('\n');
const compilado = await build({
  stdin: {contents: entrada, resolveDir: process.cwd(), sourcefile: 'entrada.ts', loader: 'ts'},
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  alias: {'@canal': './src/canal', '@sonido': './src/sonido'},
  logLevel: 'warning',
});
const m = await import('data:text/javascript;base64,' + Buffer.from(compilado.outputFiles[0].contents).toString('base64'));

const leerJson = (archivo) => JSON.parse(fs.readFileSync(path.join(ep, archivo), 'utf8'));
const inicio = Date.now();
m.anclasNoEncontradas.clear();
const voz = m.leerWav(new Uint8Array(fs.readFileSync(path.join(ep, 'voz.wav'))));
// Instrumentos reales (VCSL, CC0) para la música viva: herramientas/muestras.py los prepara
const carpetaMuestras = path.resolve('src/sonido/muestras');
const muestras = {};
if (fs.existsSync(path.join(carpetaMuestras, 'muestras.json'))) {
  const manifiesto = JSON.parse(fs.readFileSync(path.join(carpetaMuestras, 'muestras.json'), 'utf8'));
  for (const [nombre, lista] of Object.entries(manifiesto.instrumentos)) {
    muestras[nombre] = lista.map((e) => ({...m.leerWav(new Uint8Array(fs.readFileSync(path.join(carpetaMuestras, e.archivo)))), midi: e.midi, capa: e.capa}));
  }
}
const {mezcla, sr, informe} = m.construirBanda({
  config: leerJson('config.json'),
  tiempos: leerJson('tiempos.json'),
  voz,
  eventos: m.eventos,
  muestras,
});
fs.writeFileSync(path.join(ep, 'mezcla.wav'), m.escribirWav([mezcla.l, mezcla.r], sr));
for (const aviso of informe.avisos ?? []) console.warn(`⚠ ${aviso}`);
console.log(JSON.stringify({...informe, efectos_propios: Boolean(m.eventos), tiempo_s: (Date.now() - inicio) / 1000}, null, 2));
console.log(`Listo: episodios/${carpeta}/mezcla.wav`);
