// nº09 · Verificación del esquema de las luciérnagas (el modelo de Mirollo y Strogatz, en simulacion.ts).
// Comprueba que la simulación del video hace lo que dice la voz:
//   1. Sin empujón (ε = 0), cada una sigue a su ritmo: no se sincronizan.
//   2. Con la regla ("si ve un destello, adelanta el suyo"), "tarde o temprano terminan todas juntas":
//      con muchos arranques al azar, TODOS acaban en un solo destello por ciclo.
//   3. Cuántos ciclos tarda (para repartir la escena en el video) y cómo baja el número de grupos.
// El teorema es del artículo (para casi cualquier arranque); esto solo lo ilustra con nuestros
// parámetros. Ver NOTAS.md.
//
// Uso (desde la raíz): docker compose run --rm -w /repo/video video node "../episodios/nº09-luciernagas/verificar.mjs"
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

// Para probar parámetros sin tocar el módulo: EPS=0.01 N=200 node verificar.mjs
if (process.env.EPS) m.PARAMS.eps = Number(process.env.EPS);
if (process.env.N) m.PARAMS.n = Number(process.env.N);
if (process.env.B) m.PARAMS.b = Number(process.env.B);
const {n, b, eps} = m.PARAMS;
const ARRANQUES = 300;
const TOPE = 400; // ciclos

let fallos = 0;
const comprobar = (ok, texto) => {
  console.log(`${ok ? '✓' : '✗'} ${texto}`);
  if (!ok) fallos++;
};

// 1. Sin empujón no hay sincronía
const libre = m.simular(m.fasesAlAzar(n, 1), 60, {eps: 0});
comprobar(libre.sincronia === null && m.gruposEn(libre, 60) === n, `sin empujón (ε = 0): tras 60 ciclos siguen ${m.gruposEn(libre, 60)} destellos distintos por ciclo (${n} luciérnagas)`);

// 2. Con la regla, todos los arranques acaban en sincronía
const tiempos = [];
for (let s = 1; s <= ARRANQUES; s++) {
  const h = m.simular(m.fasesAlAzar(n, s), TOPE);
  if (h.sincronia !== null) tiempos.push(h.sincronia);
}
tiempos.sort((x, y) => x - y);
comprobar(tiempos.length === ARRANQUES, `con la regla (n = ${n}, b = ${b}, ε = ${eps}): ${tiempos.length} de ${ARRANQUES} arranques al azar acaban en un solo destello por ciclo`);
if (tiempos.length) {
  const mediana = tiempos[Math.floor(tiempos.length / 2)];
  console.log(`  ciclos hasta la sincronía: mínimo ${tiempos[0].toFixed(1)} · mediana ${mediana.toFixed(1)} · máximo ${tiempos[tiempos.length - 1].toFixed(1)}`);
}

// 3. Cómo se agrupan (el arranque que usa el video lo elige linea.ts; aquí, el nº 1)
const h = m.simular(m.fasesAlAzar(n, 1), TOPE);
const pasos = [];
for (let c = 1; c <= Math.ceil(h.sincronia ?? 0) + 1; c++) pasos.push(`${c}:${m.gruposEn(h, c)}`);
console.log(`  grupos por ciclo (arranque 1): ${pasos.join(' ')}`);
// Tras la sincronía, un destello por ciclo, exacto
const ultimos = h.destellos.slice(-3);
comprobar(ultimos.every((d) => d.quienes.length === n) && Math.abs(ultimos[2].t - ultimos[1].t - 1) < 1e-9, 'después, todas disparan juntas una vez por ciclo');

console.log(fallos ? `\n${fallos} comprobaciones fallaron.` : '\nTodo comprobado.');
process.exit(fallos ? 1 : 0);
