// nº03 · Comprobación (rigor) de lo que afirma el guion con la MISMA simulación que el video:
//   · "Unas giran, sus vecinas las siguen... y el giro recorre la bandada": el giro empieza en unas
//     pocas aves y se propaga; las que están más lejos de las iniciadoras giran más tarde.
//   · "¿Y la que iba delante? También estaba mirando de reojo": la de delante NO es iniciadora y gira
//     después de que lo hagan sus vecinas.
//   docker compose run --rm video node "../episodios/nº03-bandada/verificar.mjs"
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const {build} = await import(pathToFileURL(path.resolve('node_modules/esbuild/lib/main.js')).href);
const salida = path.resolve('out', 'verificar_n03.mjs');
await build({
  entryPoints: [path.join(aqui, 'simulacion.ts')], bundle: true, platform: 'node', format: 'esm', outfile: salida,
  alias: {'@canal': path.resolve('src/canal')}, logLevel: 'warning',
});
const {vuelo, momentosDeGiro, iniciadorasDe, PASO} = await import(`${pathToFileURL(salida).href}?v=${Date.now()}`);

const config = JSON.parse((await import('node:fs')).readFileSync(path.join(aqui, 'config.json'), 'utf8'));
const GIRO = 12; // segundo de la simulación en que empiezan (cualquiera sirve: el patrón es el mismo)
const estados = vuelo(config.semilla, GIRO + 15, GIRO);
const VENTANA = 4; // en el video caben ~4 s entre "unas giran" y "¿y la que iba delante?"
const giros = momentosDeGiro(estados, GIRO, GIRO + VENTANA);
const ini = iniciadorasDe(estados[0]);
const enGiro = estados[Math.round(GIRO / PASO)];

// Distancia de cada ave a la iniciadora más cercana, en el momento del giro
const dist = enGiro.map((a) => Math.min(...[...ini].map((j) => Math.hypot(a.x - enGiro[j].x, a.y - enGiro[j].y, a.z - enGiro[j].z))));
const seguidoras = enGiro.map((_, i) => i).filter((i) => !ini.has(i));
const giraron = seguidoras.filter((i) => Number.isFinite(giros[i]));
// Correlación de rangos (Spearman) entre distancia y retraso del giro
const rango = (v) => { const o = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]); const r = new Array(v.length); o.forEach(([, i], k) => (r[i] = k)); return r; };
const d = giraron.map((i) => dist[i]), g = giraron.map((i) => giros[i]);
const rd = rango(d), rg = rango(g), n = d.length;
const spearman = 1 - (6 * rd.reduce((s, x, k) => s + (x - rg[k]) ** 2, 0)) / (n * (n * n - 1));
// Propagación a lo ancho: las iniciadoras están en el costado izquierdo (z menor); si el giro recorre
// la bandada, cuanto más a la derecha (z mayor), más tarde gira
const rz = rango(giraron.map((i) => enGiro[i].z));
const spearmanZ = 1 - (6 * rz.reduce((s, x, k) => s + (x - rg[k]) ** 2, 0)) / (n * (n * n - 1));
// Por franjas de 2 unidades a lo ancho: retraso medio
const franjas = new Map();
for (const i of giraron) { const f = Math.floor(enGiro[i].z / 2) * 2; const v = franjas.get(f) ?? []; v.push(giros[i] - GIRO); franjas.set(f, v); }
const porFranja = [...franjas.entries()].sort((a, b) => a[0] - b[0]).map(([f, v]) => `z ${f}…${f + 2}: ${(v.reduce((s, x) => s + x, 0) / v.length).toFixed(2)} s (${v.length})`);
// La de delante: mayor x (el vuelo va hacia +x) en el momento del giro
const delante = enGiro.map((a, i) => [a.x, i]).sort((a, b) => b[0] - a[0])[0][1];
const ordenDelante = [...giros].sort((a, b) => a - b).indexOf(giros[delante]);
const medianaIni = [...ini].map((i) => giros[i]).sort((a, b) => a - b)[6];

console.log(`aves: ${enGiro.length} · iniciadoras: ${ini.size} (costado izquierdo)`);
console.log(`seguidoras que giran (> 25°) en ${VENTANA} s: ${giraron.length} de ${seguidoras.length}`);
console.log(`retraso del giro frente a distancia a las iniciadoras (Spearman): ${spearman.toFixed(2)} (positivo = el giro se propaga)`);
console.log(`retraso frente a la posición a lo ancho (Spearman con z): ${spearmanZ.toFixed(2)}`);
console.log('retraso medio por franja, del costado izquierdo al derecho: ' + porFranja.join(' · '));
console.log(`retraso medio de las seguidoras: ${(g.reduce((s, x) => s + x, 0) / n - GIRO).toFixed(2)} s · iniciadoras (mediana): ${(medianaIni - GIRO).toFixed(2)} s`);
console.log(`la de delante (ave ${delante}): ¿iniciadora? ${ini.has(delante) ? 'SÍ' : 'no'} · gira a +${(giros[delante] - GIRO).toFixed(2)} s, la nº ${ordenDelante + 1} de ${enGiro.length}`);
