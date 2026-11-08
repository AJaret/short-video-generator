// Regresiones de la auditoría: ejecutar en Docker con node scripts/verificar_auditoria.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {build} from 'esbuild';
import {pathToFileURL} from 'node:url';
import path from 'node:path';

await build({stdin: {contents: `
  export * from './src/canal/tiempos';
  export {tramosImpacto} from './src/canal/DatoImpacto';
  export {pulsoDe} from './src/canal/pulso';
  export * from './src/sonido/sintesis';
  export {construirBanda} from './src/sonido/banda';
  export * from '../episodios/nº02-juego-del-caos/linea';
  export {eventos} from '../episodios/nº02-juego-del-caos/sonido';
  export {JUEGO_COPO, JUEGO_CUADRADO} from '../episodios/nº02-juego-del-caos/simulacion';
`, resolveDir: process.cwd(), loader: 'ts'}, bundle: true, platform: 'node', format: 'esm', loader: {'.woff2': 'dataurl'},
  alias: {'@canal': './src/canal', '@sonido': './src/sonido'}, outfile: 'out/verificar_auditoria.mjs'});
const m = await import(pathToFileURL(path.resolve('out/verificar_auditoria.mjs')).href);
const leer = (ep, f) => JSON.parse(fs.readFileSync(`../episodios/${ep}/${f}.json`, 'utf8'));
for (const ep of ['nº00-prueba', 'nº01-hormiga-de-langton', 'nº02-juego-del-caos']) {
  const c = leer(ep, 'config'), t = leer(ep, 'tiempos'), p = m.pulsoDe(c);
  assert.ok(m.tramosImpacto(c.impactos, t, p).length > 0);
}
const c = leer('nº02-juego-del-caos', 'config'), t = leer('nº02-juego-del-caos', 'tiempos'), p = m.pulsoDe(c);
const impacto = m.tramosImpacto(c.impactos, t, p).find((x) => x.impacto.entrada === 'letras');
const ultimaLetra = impacto.inicio + (impacto.impacto.texto.replace(/\s/g, '').length - 1) * p.negra / 4;
assert.ok(impacto.fin - 6 / 30 - ultimaLetra >= 0.699);
assert.throws(() => m.tramosImpacto([{texto: 'uno', desde: 10}, {texto: 'dos', desde: 11}], t, p), /se solapan/);
const l = m.linea(t, t.duracion + c.cola, p);
const evs = m.eventos({config: c, tiempos: t, duracion: t.duracion + c.cola, pulso: p});
let notas = 0;
const semis = m.semicorcheasCuadrado(l);
for (const [lista, juego, regla] of [[semis.ruido, m.JUEGO_CUADRADO, false], [semis.copo, m.JUEGO_COPO, true]]) {
  for (const s of lista) {
    const e = juego.esquina[m.indiceCuadrado(s, l, regla)];
    const nota = m.hz([-12, -9, -5, -2][e] + 12);
    assert.ok(evs.some((ev) => Math.abs(ev.t - s) < 1e-8 && ev.frecuencia === nota));
    notas++;
  }
}
const quieto = m.saltoVisible(l.tRevela - l.negra, l);
assert.deepEqual(m.saltoVisible(l.tRevela - 0.001, l), quieto);

// Seno a un cuarto de la frecuencia de muestreo: el pico entre muestras supera el pico PCM.
const sr = 24000;
const seno = Float32Array.from({length: sr}, (_, i) => 1.2 * Math.sin(Math.PI * i / 2 + Math.PI / 4));
assert.ok(m.picoVerdadero([seno]) > m.pico(seno) * 1.2);
const r = Float32Array.from(seno, (x) => x * 0.5);
m.limitador([seno, r], sr);
assert.ok(m.aDb(m.picoVerdadero([seno, r])) <= -1);
for (let i = 0; i < sr; i++) assert.ok(Math.abs(r[i] - seno[i] * 0.5) < 1e-6);
// Un pico aislado debe provocar una rampa previa, sin el escalón del limitador antiguo.
const impulso = new Float32Array(sr).fill(0.1);
impulso[sr / 2] = 2;
m.limitador(impulso, sr);
const ataque = impulso.slice(sr / 2 - Math.round(sr * 0.003), sr / 2);
assert.ok(new Set(ataque).size > 30);
assert.ok(Math.max(...ataque.slice(1).map((x, i) => Math.abs(x - ataque[i]))) < 0.003);
const cero = new Float32Array(sr);
assert.equal(m.normalizarLufs([cero], sr), -Infinity);
assert.ok(cero.every((x) => x === 0));

// Sin revelación: el acorde cabe antes del final y se respetan anclas aun con música desactivada.
m.anclasNoEncontradas.clear();
const sinVoz = {sr: 8000, datos: new Float32Array(8000 * 12)};
const banda = m.construirBanda({config: {...c, impactos: [], panel: undefined, cola: 1.5, audio: {}},
  tiempos: {duracion: 12, palabras: []}, voz: sinVoz});
assert.ok(parseFloat(banda.informe.musica.acorde_final) <= 13.5 - 0.75 * p.compas);
assert.equal(banda.mezcla.l.at(-1), 0);
m.construirBanda({config: {...c, impactos: [], panel: undefined, audio: {musica: false, remate: 'ancla inventada'}},
  tiempos: {duracion: 12, palabras: []}, voz: sinVoz});
assert.ok(m.anclasNoEncontradas.has('ancla inventada'));
assert.equal(m.tiempoDeAncla(t, ''), null);
console.log(`OK: 3 episodios sin solapes; impacto legible; ${notas} notas sincronizadas; pausa; limitador 4×, rampa y estéreo; silencio; cierre y anclas.`);
