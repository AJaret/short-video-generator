// Genera un tiempos.json falso a partir de guion.md (~150 palabras/min) para probar la plantilla.
// Uso (en el contenedor): node scripts/tiempos_falsos.js ../episodios/<ep>/guion.md ../episodios/<ep>/tiempos.json
const fs = require('fs');
const [guion, salida] = process.argv.slice(2);
let texto = fs.readFileSync(guion, 'utf8').split('\n').filter(l => !l.startsWith('#')).join(' ');
texto = texto.replace(/\[Animación:[^\]]*\]/g, ' ');
const fichas = texto.split(/\s+/).filter(Boolean);
let t = 0.5; const palabras = [];
for (const f of fichas) {
  if (f === '[pausa]') { t += 0.45; continue; }
  if (f === '[pausa' ) { continue; }
  if (f === 'larga]') { t += 0.9; continue; }
  const dur = 0.16 + 0.045 * f.replace(/[^\p{L}\p{N}]/gu, '').length;
  palabras.push({texto: f, inicio: +t.toFixed(3), fin: +(t + dur).toFixed(3)});
  t += dur + 0.06;
  if (/[.,;:?!]$/.test(f)) t += 0.15;
}
fs.writeFileSync(salida, JSON.stringify({palabras, duracion: +palabras.at(-1).fin.toFixed(3)}, null, 1) + '\n');
console.log(palabras.length, 'palabras, duración', palabras.at(-1).fin);
