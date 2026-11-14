// nº08b · Partitura: la música se compone a partir de la MISMA línea de tiempo que la imagen
// (linea.ts; ver @sonido/edicion). La imagen es calmada: aquí solo suena lo que de verdad pasa en
// pantalla, y el resto es el ritmo de fondo de cada sección.
//
//   · Cortes de verdad (portada, revelación, cifras, décadas, 26 horas, loop): bombo + sub + palmada.
//   · Portada: un acorde punteado por palabra del título (el sello lo pone la plantilla).
//   · Las 36 ciudades: una nota por pareja, subiendo (una por fusa). Los 36 copos: bajando.
//   · El moho cae en Tokio: un grave largo. Sin cerebro, sin planos, sin ingenieros: tres notas que bajan.
//   · "Lo cubrió todo": una escala que sube con la malla, y una subida hasta la poda, donde entra el ritmo.
//   · Un tiempo de silencio… y la revelación (golpe). Las cifras: una campana por fila.
//   · La rotura: un hueco y un grave. "Se engrosa": grave; "desaparece": se va la música.
//   · 26 horas: campanas. El último compás, el acorde del loop.
import {momentosPortada} from '@canal/tiempos';
import type {ContextoSonido} from '@sonido/banda';
import {penta, type Partitura} from '@sonido/edicion';
import {cortes, linea, momentosAvena, momentosCiudades} from './linea';

const FPS = 30;

export function partitura({config, tiempos, duracion, pulso}: ContextoSonido): Partitura {
  const fin = (Math.ceil(duracion * FPS) - 1) / FPS;
  const l = linea(tiempos, fin, pulso);
  const negra = pulso.negra;
  const corchea = negra / 2;
  const semi = negra / 4;
  const notas: Partitura['notas'] = [];
  const lado = (k: number) => (k % 2 ? 0.45 : -0.45);

  // ── Portada: un acorde punteado que sube con cada palabra del título ──
  notas.push({t: 0, nota: 0, voz: 'grave', vel: 0.7, dur: negra * 2}, {t: 0, nota: 12, vel: 0.6, dur: 0.5});
  momentosPortada(config.titulo, negra).forEach((t, i) => {
    for (const n of [0, 7]) notas.push({t, nota: [0, 3, 7, 12][i % 4] + n, vel: 0.9, pan: lado(i) * 0.5, dur: 0.35});
  });

  // ── Las 36 ciudades: Tokio en el corte, y una nota por pareja subiendo ──
  const ciudades = momentosCiudades(l);
  notas.push({t: ciudades[0], nota: 12, voz: 'campana', vel: 0.8});
  for (let i = 1; i < ciudades.length; i += 2) {
    const j = (i - 1) / 2;
    notas.push({t: ciudades[i], nota: penta(j) - 12, voz: j % 2 ? 'clic' : 'pluck', vel: 0.55, pan: lado(j), dur: j % 2 ? 0.05 : 0.2});
  }
  // "¿Cómo las unirías?": los trazos salen de Tokio
  notas.push({t: l.unir, nota: 7, vel: 0.7, dur: 0.4});

  // ── Los 36 copos de avena: una nota por pareja, bajando ──
  const avena = momentosAvena(l);
  for (let i = 0; i < avena.length; i += 2) {
    const j = i / 2;
    notas.push({t: avena[i], nota: penta(12 - j), voz: 'campana', vel: 0.5, pan: lado(j)});
  }

  // ── El moho cae en Tokio (aterriza medio segundo después de la frase); "una sola célula" ──
  notas.push({t: l.moho + corchea * 2, nota: 0, voz: 'grave', vel: 0.9, dur: negra * 3});
  notas.push({t: l.celula, nota: 19, voz: 'campana', vel: 0.7, pan: 0.3});
  // Sin cerebro, sin planos, sin ingenieros: tres notas que bajan
  l.sin.forEach((t, i) => notas.push({t, nota: [12, 10, 8][i], vel: 0.85, dur: 0.4}));

  // ── "Lo cubrió todo": una escala que sube con la malla ──
  for (let k = 0, s = l.cubre + semi; s < l.poda - semi; k++, s += semi) notas.push({t: s, nota: penta(k) - 12, vel: 0.4 + 0.03 * k, pan: lado(k), dur: 0.16});

  // ── "Unos cuantos tubos gruesos" ──
  notas.push({t: l.gruesos, nota: 12, voz: 'campana', vel: 0.7, pan: -0.3}, {t: l.gruesos, nota: 19, voz: 'campana', vel: 0.6, pan: 0.3});

  // ── Las cifras: una campana por fila ──
  [l.costo, l.eficiencia].forEach((t, i) => notas.push({t, nota: 12 + 7 * i, voz: 'campana', vel: 0.75, pan: lado(i) * 0.6}));
  // "Si se rompe una vía": un grave y la nota que tensa
  notas.push({t: l.rompe, nota: 0, voz: 'grave', vel: 0.9, dur: negra * 2}, {t: l.rompe, nota: 6, vel: 0.7, dur: 0.4});

  // ── El truco: "se engrosa" ──
  notas.push({t: l.engrosa, nota: 0, voz: 'grave', vel: 0.8, dur: negra * 2}, {t: l.engrosa, nota: 7, vel: 0.7, dur: 0.4});

  // ── 26 horas: campanas ──
  [12, 19, 24].forEach((nota, i) => notas.push({t: l.dia + 0.15 + i * 0.05, nota, voz: 'campana', vel: 0.75, pan: (i - 1) * 0.4}));

  const fuerza = new Map<number, number>([[l.revelacion, 1.3], [l.costo, 0.7], [l.decadas, 0.8], [l.dia, 1.1], [l.loop, 0.9]]);
  return {
    secciones: [
      {desde: 0, nivel: 0},
      {desde: l.mapa, nivel: 1},
      {desde: avena[35] + semi, nivel: 2},
      {desde: l.moho, nivel: 1},
      {desde: l.poda, nivel: 3},
      {desde: l.gruesos, nivel: 2},
      {desde: l.revelacion, nivel: 3},
      {desde: l.costo, nivel: 2},
      {desde: l.solo, nivel: 1},
      {desde: l.rompe, nivel: 2},
      {desde: l.truco, nivel: 1},
      {desde: l.engrosa, nivel: 2},
      {desde: l.desaparece + corchea, nivel: 0},
      {desde: l.decadas, nivel: 1},
      {desde: l.dia, nivel: 2},
    ],
    // La pausa ya calla antes de la revelación; tras "desaparece" la música ya se fue
    cortes: cortes(l).map((t) => ({t, fuerza: fuerza.get(t) ?? 1, hueco: t === l.revelacion || t === l.decadas || t === l.costo ? 0 : undefined})),
    golpes: [l.revelacion],
    paradas: [[l.pausa, l.revelacion], [l.rompe - semi, l.rompe], [l.desaparece + corchea, l.decadas]],
    subidas: [[l.cubre + negra, l.poda - semi]],
    notas,
    glitches: [],
    final: l.loop,
  };
}
