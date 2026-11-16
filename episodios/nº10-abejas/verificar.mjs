// nº10 · Verificación del esquema del enjambre (simulacion.ts).
// Comprueba que el mecanismo que cuenta la voz hace lo que dice:
//   1. Con bailes que dependen de la calidad y que decaen en cada vuelta, el enjambre elige la caja
//      buena la mayoría de las veces (en el experimento real, 4 de 5 enjambres; Seeley y Buhrman 2001).
//   2. Si todas bailaran igual sin importar la calidad, elegiría al azar (~1 de cada 5).
//   3. Si el baile no decayera, se atascaría más (o elegiría peor): el olvido ayuda.
//   4. Cuánto tarda en llegar al quórum.
// Los parámetros son nuestros. Ver NOTAS.md.
//
// Uso (desde la raíz): docker compose run --rm video node "../episodios/nº10-abejas/verificar.mjs"
import esb from '/repo/video/node_modules/esbuild/lib/main.js';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const r = await esb.build({
  entryPoints: [path.join(aqui, 'simulacion.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  alias: {'@canal': '/repo/video/src/canal'},
});
const m = await import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].contents).toString('base64'));

const ENJAMBRES = 400;
const prueba = (nombre, sitios, params) => {
  let buena = 0;
  let sin = 0;
  const rondas = [];
  for (let s = 1; s <= ENJAMBRES; s++) {
    const h = m.simular(s, 300, sitios, {...m.PARAMS, ...params});
    if (h.eleccion === null) sin++;
    else {
      rondas.push(h.ronda);
      if (h.eleccion === m.BUENA) buena++;
    }
  }
  rondas.sort((a, b) => a - b);
  const med = rondas.length ? rondas[Math.floor(rondas.length / 2)] : null;
  console.log(`${nombre}: caja buena ${(100 * buena / ENJAMBRES).toFixed(0)} % · sin decidir ${(100 * sin / ENJAMBRES).toFixed(0)} % · rondas hasta el quórum (mediana) ${med}`);
  return {buena: buena / ENJAMBRES, sin: sin / ENJAMBRES};
};

let fallos = 0;
const comprobar = (ok, texto) => {
  console.log(`${ok ? '✓' : '✗'} ${texto}`);
  if (!ok) fallos++;
};

const base = prueba('el modelo', m.CAJAS, {});
comprobar(base.buena >= 0.6, 'con bailes según la calidad, elige la caja buena la mayoría de las veces');
const iguales = prueba('todas bailan igual', m.CAJAS.map((c) => ({...c, calidad: 1})), {});
comprobar(iguales.buena < 0.35, 'si todas bailaran igual, casi nunca elegiría la buena (o no se decidiría)');
const sinOlvido = prueba('sin que el baile decaiga', m.CAJAS, {caida: 0.5});
comprobar(sinOlvido.buena < base.buena, 'sin el baile que decae, acierta menos');
prueba('con cabezazos', m.CAJAS, {cabezazos: 0.05});

console.log(fallos ? `\n${fallos} comprobaciones fallaron.` : '\nTodo comprobado.');
process.exit(fallos ? 1 : 0);
