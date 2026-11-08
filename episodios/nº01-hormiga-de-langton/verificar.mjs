// nº01 · Comprobación (rigor): busca dibujos de partida (semillas) que acaben en autopista, con el
// MISMO generador que el sketch (mulberry32 + la misma regla de dibujo). De aquí salen TABLEROS (linea.ts)
// y el dato "396 de 400 semillas acaban en autopista antes de 40 000 pasos".
//   docker compose run --rm video node "../episodios/nº01-hormiga-de-langton/verificar.mjs"
function mulberry32(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const RADIO = 3, DENSIDAD = 0.45, N = 40000, LADO = 512, MITAD = 256;
const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
const resultados = [];
for (let semilla = 1; semilla <= 400; semilla++) {
  const azar = mulberry32(semilla);
  const negra = new Uint8Array(LADO * LADO);
  for (let y = -RADIO; y <= RADIO; y++) for (let x = -RADIO; x <= RADIO; x++) if (azar() < DENSIDAD) negra[(y + MITAD) * LADO + x + MITAD] = 1;
  let x = 0, y = 0, d = 0, minX = 0, maxX = 0, minY = 0, maxY = 0, pasos = N;
  const movs = new Uint8Array(N);
  for (let k = 0; k < N; k++) {
    const i = (y + MITAD) * LADO + (x + MITAD);
    d = negra[i] ? (d + 3) % 4 : (d + 1) % 4;
    negra[i] ^= 1;
    x += DX[d]; y += DY[d]; movs[k] = d;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    if (Math.abs(x) > MITAD - 5 || Math.abs(y) > MITAD - 5) { pasos = k + 1; break; }
  }
  // Inicio de la autopista: el último paso que rompe la periodicidad de 104 (+1)
  let j = pasos - 105;
  while (j >= 0 && movs[j] === movs[j + 104]) j--;
  const inicio = j + 1;
  if (inicio > pasos - 3000) continue; // sin autopista clara
  // dirección de la autopista
  let sx = 0, sy = 0;
  for (let k = inicio; k < inicio + 104; k++) { sx += DX[movs[k]]; sy += DY[movs[k]]; }
  resultados.push({semilla, inicio, dir: `${sx},${sy}`});
}
console.log(`semillas con autopista en < ${N} pasos: ${resultados.length} de 400`);
const elegibles = resultados.filter((r) => r.inicio >= 600 && r.inicio <= 12000);
// cuatro con inicios repartidos y direcciones distintas si se puede
const porDir = {};
for (const r of elegibles) (porDir[r.dir] ??= []).push(r);
console.log('direcciones:', Object.fromEntries(Object.entries(porDir).map(([k, v]) => [k, v.length])));
const elegidas = [];
for (const lista of Object.values(porDir)) { lista.sort((a, b) => a.inicio - b.inicio); elegidas.push(lista[Math.floor(lista.length / 2)]); }
console.log('propuesta (una por dirección):', JSON.stringify(elegidas.slice(0, 4)));
console.log('ejemplos:', JSON.stringify(elegibles.slice(0, 12)));
