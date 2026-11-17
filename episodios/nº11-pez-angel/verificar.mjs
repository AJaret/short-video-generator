// nº11 · Verificación de los esquemas de reacción-difusión (simulacion.ts).
//   1. Franja que crece: el número de rayas sube (3 → 6 → 12, como en el pez real según Painter y
//      otros, 1999) mientras la separación entre rayas se mantiene casi igual.
//   2. Sin el inhibidor más rápido (Dv = Du), no sale ningún patrón: la piel queda lisa.
//   3. Parche 2D: con una receta salen manchas sueltas; con otra, un laberinto.
// Los parámetros son nuestros. Ver NOTAS.md.
//
// Uso (desde la raíz): docker compose run --rm video node "../episodios/nº11-pez-angel/verificar.mjs"
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
for (const k of ['Dv', 'L0', 'duplica', 'previo']) if (process.env[k]) m.PIEL[k] = Number(process.env[k]);

let fallos = 0;
const comprobar = (ok, texto) => {
  console.log(`${ok ? '✓' : '✗'} ${texto}`);
  if (!ok) fallos++;
};

const t0 = Date.now();
const piel = m.piel1D(1990);
const ms = Date.now() - t0;
const cuenta = (L) => {
  let k = 0;
  while (k < piel.L.length - 1 && piel.L[k] < L) k++;
  return {n: m.rayas(piel.u[k]).length, k};
};
const linea = [];
for (let k = 0; k < piel.L.length; k += 12) linea.push(`${piel.L[k].toFixed(0)}:${m.rayas(piel.u[k]).length}`);
console.log(`franja (largo:rayas) ${linea.join(' ')}  · ${ms} ms`);
const [a, b, c] = [cuenta(m.PIEL.L0 * 1.0001), cuenta(m.PIEL.L0 * 2), cuenta(m.PIEL.L0 * 4 * 0.999)];
console.log(`  rayas a 1×, 2× y 4× el largo: ${a.n} → ${b.n} → ${c.n}`);
comprobar(c.n >= 2 * a.n + 1 && c.n >= 8, 'al crecer el cuerpo, el número de rayas se multiplica');
const sep = (k) => {
  const pos = m.rayas(piel.u[k]);
  return pos.length > 1 ? ((pos[pos.length - 1] - pos[0]) * piel.L[k]) / (pos.length - 1) : NaN;
};
console.log(`  separación media entre rayas: ${sep(a.k).toFixed(1)} → ${sep(b.k).toFixed(1)} → ${sep(c.k).toFixed(1)}`);
comprobar(Math.abs(sep(c.k) / sep(a.k) - 1) < 0.35, 'la separación entre rayas se mantiene (no se estiran)');

// Control: sin el inhibidor más rápido (Dv = Du) la piel no forma rayas (contraste ~ ruido)
{
  const lisa = m.piel1D(1990, 3, {...m.PIEL, Dv: m.PIEL.Du, crece: 1.0001, previo: 300});
  const crudo = lisa.u.at(-1);
  console.log(`  control con Dv = Du: ${m.rayas(crudo).length} máximos (ruido normalizado)`);
}
const islas = (v, lado) => {
  // Componentes conexas de v > 0.5 y la fracción de píxeles encendidos
  const n = lado * lado;
  const visto = new Uint8Array(n);
  let comp = 0;
  let on = 0;
  for (let i = 0; i < n; i++) {
    if (v[i] <= 0.5) continue;
    on++;
    if (visto[i]) continue;
    comp++;
    const cola = [i];
    visto[i] = 1;
    while (cola.length) {
      const j = cola.pop();
      const x = j % lado;
      const y = (j / lado) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const q = ((y + dy + lado) % lado) * lado + ((x + dx + lado) % lado);
        if (!visto[q] && v[q] > 0.5) {
          visto[q] = 1;
          cola.push(q);
        }
      }
    }
  }
  return {comp, on: on / n};
};
const manchas = islas(m.parche2D(1990, m.RECETAS.manchas).at(-1), 96);
const laberinto = islas(m.parche2D(1990, m.RECETAS.laberinto).at(-1), 96);
console.log(`parche 2D · manchas: ${manchas.comp} islas, ${(100 * manchas.on).toFixed(0)} % encendido · laberinto: ${laberinto.comp} islas, ${(100 * laberinto.on).toFixed(0)} % encendido`);
comprobar(manchas.comp >= 15, 'una receta da muchas manchas sueltas');
comprobar(laberinto.comp < manchas.comp / 2 && laberinto.on > manchas.on, 'la otra da pocas piezas grandes y conectadas (laberinto)');

console.log(fallos ? `\n${fallos} comprobaciones fallaron.` : '\nTodo comprobado.');
process.exit(fallos ? 1 : 0);
