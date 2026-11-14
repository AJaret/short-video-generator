// nº08b · Partitura: la música se compone a partir de la MISMA línea de tiempo que la imagen
// (linea.ts), así que cada corte y cada gesto de pantalla tiene su sonido (ver @sonido/edicion).
//
//   · Cada corte de escena: bombo + sub + palmada (lo pone la música), con un hueco y aire antes.
//   · Portada: una nota por palabra del título y un clic por cada salto del marco.
//   · Las 36 ciudades: una nota por pareja, subiendo (una por fusa). Los 36 copos: bajando.
//   · "¿Cómo las unirías?" y "lo cubrió todo": subidas (redoble + aire) hasta el corte.
//   · El moho cae en Tokio: un grave largo. Los tres carteles: tres golpes secos entre silencios.
//   · La poda: entra todo el ritmo. Un tiempo de silencio con glitches… y la revelación.
//   · Las cifras: una campana por fila. La rotura: silencio, glitch y grave.
//   · El truco: un clic por semicorchea (el flujo); "se engrosa": grave; "desaparece": se va la música.
//   · Décadas: un clic por marca de la regla. 26 horas: campanas. El último compás, el acorde del loop.
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
  const glitches: Partitura['glitches'] = [];
  const lado = (k: number) => (k % 2 ? 0.45 : -0.45);

  // ── Portada ──
  notas.push({t: 0, nota: 0, voz: 'grave', vel: 0.9, dur: negra * 2}, {t: 0, nota: 12, vel: 0.7, dur: 0.5});
  const titulo = momentosPortada(config.titulo, negra);
  titulo.forEach((t, i) => {
    // Cada palabra del título: acorde punteado que sube + grave corto
    for (const n of [0, 7]) notas.push({t, nota: [0, 3, 7, 12][i % 4] + n, vel: 1, pan: lado(i) * 0.5, dur: 0.35});
    notas.push({t, nota: -12, voz: 'grave', vel: 0.85, dur: corchea});
  });
  for (let k = 1; k * semi < l.mapa - semi; k++) notas.push({t: k * semi, nota: penta((k * 3) % 7) + 12, voz: 'clic', vel: 0.22, pan: lado(k)});
  const marco = titulo[titulo.length - 1] + corchea;
  notas.push({t: marco, nota: 19, voz: 'campana', vel: 0.7, pan: -0.3}, {t: marco, nota: 12, voz: 'campana', vel: 0.6, pan: 0.3});

  // ── Las 36 ciudades: Tokio en el corte, y una nota por pareja subiendo ──
  const ciudades = momentosCiudades(l);
  notas.push({t: ciudades[0], nota: 12, voz: 'campana', vel: 0.8});
  for (let i = 1; i < ciudades.length; i += 2) {
    const j = (i - 1) / 2;
    notas.push({t: ciudades[i], nota: penta(j) - 12, voz: j % 2 ? 'clic' : 'pluck', vel: 0.55, pan: lado(j), dur: j % 2 ? 0.05 : 0.2});
  }
  for (let s = ciudades[35] + semi * 2; s < l.unir - 0.01; s += semi) notas.push({t: s, nota: penta(Math.round(s / semi) % 6) + 12, voz: 'clic', vel: 0.2, pan: lado(Math.round(s / semi))});
  // "¿Cómo las unirías?": los trazos salen de Tokio
  notas.push({t: l.unir, nota: -12, voz: 'grave', vel: 0.6, dur: negra}, {t: l.unir, nota: 7, vel: 0.8});

  // ── Los 36 copos de avena: una nota por pareja, bajando ──
  const avena = momentosAvena(l);
  for (let i = 0; i < avena.length; i += 2) {
    const j = i / 2;
    notas.push({t: avena[i], nota: penta(12 - j), voz: 'campana', vel: 0.5, pan: lado(j)});
  }
  const finAvena = avena[35] + semi;

  // ── El moho cae en Tokio; "una sola célula" ──
  notas.push({t: l.moho, nota: 0, voz: 'grave', vel: 1, dur: negra * 3});
  notas.push({t: l.celula, nota: 19, voz: 'campana', vel: 0.8, pan: 0.3}, {t: l.celula, nota: 24, voz: 'clic', vel: 0.5, pan: -0.3});
  notas.push({t: l.celula + semi, nota: 26, voz: 'clic', vel: 0.4, pan: 0.3});

  // ── Los tres carteles: golpe, nota que baja y el tachado (ráfaga) ──
  l.sin.forEach((t, i) => {
    notas.push({t, nota: [12, 10, 8][i], vel: 1, dur: 0.4}, {t, nota: [0, -2, -4][i], voz: 'grave', vel: 0.7, dur: negra});
    glitches.push({t: t + 0.1, dur: 0.13, vel: 0.9});
  });

  // ── "Lo cubrió todo": una escala que sube con la malla ──
  for (let k = 0, s = l.cubre + semi; s < l.poda - semi; k++, s += semi) notas.push({t: s, nota: penta(k) - 12, vel: 0.4 + 0.03 * k, pan: lado(k), dur: 0.16});

  // ── "Unos cuantos tubos gruesos": el latido de la red; después, el silencio roto ──
  notas.push({t: l.gruesos, nota: 12, voz: 'campana', vel: 0.8, pan: -0.3}, {t: l.gruesos, nota: 19, voz: 'campana', vel: 0.7, pan: 0.3});
  glitches.push({t: l.pausa, dur: 0.1}, {t: l.pausa + corchea, dur: 0.1}, {t: l.pausa + semi * 3, dur: 0.14, vel: 1.2});

  // ── Las cifras: una campana por fila ──
  [l.costo, l.eficiencia].forEach((t, i) => {
    notas.push({t, nota: 12 + 7 * i, voz: 'campana', vel: 0.75, pan: lado(i) * 0.6}, {t, nota: 24, voz: 'clic', vel: 0.45});
  });
  // "Si se rompe una vía": ráfaga, grave y las ciudades aisladas parpadeando
  glitches.push({t: l.rompe, dur: 0.18, vel: 1.3});
  notas.push({t: l.rompe, nota: 0, voz: 'grave', vel: 1, dur: negra * 2}, {t: l.rompe, nota: 6, vel: 0.7, dur: 0.4});
  for (let k = 1; k <= 3; k++) notas.push({t: l.rompe + k * corchea, nota: 18, voz: 'clic', vel: 0.4, pan: lado(k)});

  // ── El truco: el flujo, un clic por semicorchea; "se engrosa" y "desaparece" ──
  for (let k = 0, s = l.truco + corchea; s < l.desaparece - 0.01; k++, s += semi) notas.push({t: s, nota: penta(k % 8) + 12, voz: 'clic', vel: 0.2, pan: lado(k)});
  notas.push({t: l.engrosa, nota: 0, voz: 'grave', vel: 0.9, dur: negra * 2}, {t: l.engrosa, nota: 7, vel: 0.7, dur: 0.4});
  glitches.push({t: l.desaparece, dur: 0.12});

  // ── Décadas: un clic por marca de la regla. 26 horas: campanas ──
  for (let k = 0; k <= 28 && l.decadas + k * semi < l.dia - 0.01; k++) notas.push({t: l.decadas + k * semi, nota: k % 7 === 0 ? 12 : 7, voz: 'clic', vel: k % 7 === 0 ? 0.4 : 0.2, pan: lado(k) * 0.4});
  [12, 19, 24].forEach((nota, i) => notas.push({t: l.dia + 0.15 + i * 0.05, nota, voz: 'campana', vel: 0.75, pan: (i - 1) * 0.4}));

  const fuerza = new Map<number, number>([
    [l.moho, 1.2], [l.sin[0], 1.1], [l.sin[1], 1.1], [l.sin[2], 1.1], [l.poda, 1.3], [l.revelacion, 1.3], [l.decadas, 0.8], [l.loop, 0.9],
  ]);
  return {
    secciones: [
      {desde: 0, nivel: 0},
      {desde: l.mapa, nivel: 1},
      {desde: l.unir, nivel: 0},
      {desde: l.avena, nivel: 1},
      {desde: finAvena, nivel: 2},
      {desde: l.moho, nivel: 1},
      {desde: l.sin[0], nivel: 0},
      {desde: l.cubre, nivel: 1},
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
    cortes: cortes(l).map((t) => ({t, fuerza: fuerza.get(t) ?? 1, hueco: t === l.revelacion || t === l.decadas ? 0 : undefined})),
    golpes: [l.revelacion],
    paradas: [[l.pausa, l.revelacion], [l.rompe - semi, l.rompe], [l.desaparece + corchea, l.decadas]],
    subidas: [[marco + semi, l.mapa], [l.unir, l.avena - semi], [l.cubre, l.poda - semi]],
    notas,
    glitches,
    final: l.loop,
  };
}
