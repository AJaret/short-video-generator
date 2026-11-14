// nº08 · Verificación del esquema del moho (el modelo de tubos de Tero y otros, en simulacion.ts).
// Comprueba que la simulación del video hace lo que dice la voz:
//   1. Parte de una malla que lo cubre todo.
//   2. "Fue soltando los caminos que no servían... y se quedó con unos cuantos tubos gruesos": al
//      final quedan pocos tubos y la red sigue uniendo las 36 ciudades.
// Las cifras del experimento real (costo, eficiencia, tolerancia a fallos frente a los trenes) son
// del artículo, no de esta simulación: ver NOTAS.md.
//
// Uso (desde video/): docker compose run --rm -w /repo/video video node "../episodios/nº08-moho/verificar.mjs"
import esb from '/repo/video/node_modules/esbuild/lib/main.js';
import fs from 'node:fs';
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

const SEMILLA = 2010;
// Para probar parámetros sin tocar el módulo: FLUJO=1 PASOS=600 node verificar.mjs
if (process.env.FLUJO) m.PARAMS.flujo = Number(process.env.FLUJO);
if (process.env.PASOS) m.PARAMS.pasos = Number(process.env.PASOS);
if (process.env.DT) m.PARAMS.dt = Number(process.env.DT);
const t0 = Date.now();
const red = m.crearRed(SEMILLA);
const historia = m.simular(red, SEMILLA);
console.log(`malla: ${red.x.length} nodos, ${red.a.length} tubos (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
for (const p of [0, 50, 100, 200, 300, historia.length - 1]) {
  const D = historia[p];
  const v = m.vivos(D).length;
  const con = m.conectadas(red, D).filter(Boolean).length;
  const c = m.costos(red, D);
  console.log(`paso ${String(p).padStart(3)}: ${String(v).padStart(4)} tubos vivos · ciudades conectadas ${con}/36 · largo / árbol mínimo ${(c.total / c.arbol).toFixed(2)}`);
}
const final = historia[historia.length - 1];
const vivosFin = m.vivos(final).length;
if (m.conectadas(red, final).filter(Boolean).length !== 36) throw new Error('la red final no conecta las 36 ciudades');
if (!(vivosFin < red.a.length * 0.25)) throw new Error('la red no se adelgaza lo suficiente');
// Imagen para mirarla (SVG): grosor según D
if (process.env.SALIDA) {
  const lineas = [];
  for (let k = 0; k < red.a.length; k++) {
    const d = final[k];
    if (d < 0.05) continue;
    lineas.push(`<line x1="${red.x[red.a[k]].toFixed(1)}" y1="${red.y[red.a[k]].toFixed(1)}" x2="${red.x[red.b[k]].toFixed(1)}" y2="${red.y[red.b[k]].toFixed(1)}" stroke="black" stroke-width="${(2 + 14 * Math.sqrt(d)).toFixed(1)}" stroke-linecap="round"/>`);
  }
  const puntos = m.CIUDADES.map((_, c) => `<circle cx="${red.x[c].toFixed(1)}" cy="${red.y[c].toFixed(1)}" r="9" fill="${c ? 'red' : 'blue'}"/>`);
  fs.writeFileSync(path.join(process.env.SALIDA, 'red_final.svg'), `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" style="background:white">${lineas.join('')}${puntos.join('')}</svg>`);
}
console.log('OK');
