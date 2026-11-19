// nº12 · Verificación del esquema del grupo apiñado (simulacion.ts).
//   1. Si nadie se mueve, los del borde de barlovento se llevan todo el frío y los de dentro nunca
//      lo pasan: el reparto es muy desigual.
//   2. Si los más expuestos se van al lado resguardado, al cabo de un rato el frío se reparte casi
//      por igual (lo que encontraron Waters y otros, PLoS ONE 2012, con su modelo).
//   3. El grupo entero avanza a favor del viento.
// Los parámetros son nuestros. Ver NOTAS.md.
//
// Uso (desde la raíz): docker compose run --rm video node "../episodios/nº12-pinguinos/verificar.mjs"
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
const RONDAS = Number(process.env.RONDAS ?? 1500);

let fallos = 0;
const comprobar = (ok, texto) => {
  console.log(`${ok ? '✓' : '✗'} ${texto}`);
  if (!ok) fallos++;
};

const t0 = Date.now();
const quieto = m.simular(1, RONDAS, {mover: false});
const ronda = m.simular(1, RONDAS);
const fq = quieto.frio.at(-1);
const fr = ronda.frio.at(-1);
console.log(`(${RONDAS} rondas, ${Date.now() - t0} ms)`);
console.log(`quietos: el más castigado pasa ${m.desigualdad(fq).toFixed(1)} veces el frío medio · ${(100 * m.nuncaFrio(fq)).toFixed(0)} % nunca pasa frío`);
console.log(`en ronda: el más castigado pasa ${m.desigualdad(fr).toFixed(1)} veces el frío medio · ${(100 * m.nuncaFrio(fr)).toFixed(0)} % nunca pasa frío`);
comprobar(m.desigualdad(fq) > 3 && m.nuncaFrio(fq) > 0.5, 'sin moverse, el frío se lo llevan siempre los mismos');
comprobar(m.desigualdad(fr) < 2 && m.nuncaFrio(fr) < 0.05, 'con la regla, el frío se reparte casi por igual');
const [x0] = m.centro(ronda.rondas[0].celdas);
const [x1] = m.centro(ronda.rondas.at(-1).celdas);
console.log(`el grupo avanzó ${(x1 - x0).toFixed(1)} cuerpos a favor del viento`);
comprobar(x1 - x0 > 3, 'el grupo entero avanza a favor del viento');
// Evolución de la desigualdad (para escoger cuántas rondas enseñar)
const pasos = [];
for (const k of [50, 100, 200, 400, 800, RONDAS - 1]) if (k < RONDAS) pasos.push(`${k}:${m.desigualdad(ronda.frio[k]).toFixed(1)}/${(100 * m.nuncaFrio(ronda.frio[k])).toFixed(0)}%`);
console.log(`ronda:desigualdad/nunca frío  ${pasos.join('  ')}`);

console.log(fallos ? `\n${fallos} comprobaciones fallaron.` : '\nTodo comprobado.');
process.exit(fallos ? 1 : 0);
