// nº08 · ¿Quién diseñó los trenes? El moho Physarum y la red de Tokio (Tero y otros, 2010).
//
// Escenas y momentos en linea.ts; la simulación (modelo de tubos del propio artículo) en
// simulacion.ts. Tintas: el moho y sus tubos en rosa (A); la bahía en azul (B) a medio tono; las
// ciudades y la avena en negro; en las cifras, el moho en rosa y los trenes en azul. Centrado en
// x = 540, sin recuadro.
import React, {useMemo} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {
  cobertura,
  conCamara,
  fuente,
  fuenteEnPantalla,
  hash01,
  mira,
  MONO,
  ORDEN,
  pulsoDe,
  recortarPapel,
  rotulo,
  sacudirRegistro,
  salidaCubica,
  TITULAR,
  tomaEn,
  useDibujo,
  type Capas,
  type Plano,
  type PropsSketch,
  type Toma,
} from '@canal';
import {DURACION_PORTADA} from '@canal/diseno';
import {cortes, crecida, enPortadaEn, fase, linea, momentosCiudades, pasoPoda, pasoTruco, type Linea} from './linea';
import {bahiaEnPantalla, CIUDADES, crearRed, simular, type Red} from './simulacion';

const UMBRAL = 0.05;

/** Tubos: grosor según la conductividad D (el radio crece como D^(1/4) en Hagen-Poiseuille; se exagera). */
function tubos(c: Capas, red: Red, D: Float32Array | null, op: {hastaSaltos?: number; quitar?: number; escala?: number} = {}) {
  const a = c.solido.a;
  a.strokeStyle = cobertura(1);
  a.lineCap = 'round';
  // Por grosor, en tres grupos (menos cambios de estilo)
  for (const [min, max, g] of [[0, 0.25, 0], [0.25, 0.6, 1], [0.6, 99, 2]] as const) {
    a.beginPath();
    let hay = false;
    for (let k = 0; k < red.a.length; k++) {
      if (k === op.quitar) continue;
      const d = D ? D[k] : 0.3;
      if (D && (d < UMBRAL || d < min || d >= max)) continue;
      if (!D && g !== 0) continue;
      if (op.hastaSaltos !== undefined && Math.max(red.saltos[red.a[k]], red.saltos[red.b[k]]) > op.hastaSaltos) continue;
      a.moveTo(red.x[red.a[k]], red.y[red.a[k]]);
      a.lineTo(red.x[red.b[k]], red.y[red.b[k]]);
      hay = true;
    }
    if (!hay) continue;
    a.lineWidth = ((D ? [3, 7, 12][g] : 2.5) * (op.escala ?? 1));
    a.stroke();
  }
}

/** La bahía de Tokio: agua a medio tono azul, con su rótulo. */
function bahia(c: Capas) {
  const pol = bahiaEnPantalla();
  c.b.fillStyle = cobertura(0.34);
  c.b.beginPath();
  pol.forEach(([x, y], i) => (i ? c.b.lineTo(x, y) : c.b.moveTo(x, y)));
  c.b.closePath();
  c.b.fill();
}

/** Ciudades: punto negro (o copo de avena) y Tokio más grande con su nombre. */
function ciudades(c: Capas, red: Red, visibles: number, avena: number) {
  const k = c.solido.k;
  k.fillStyle = cobertura(1);
  for (let i = 0; i < Math.min(visibles, CIUDADES.length); i++) {
    const x = red.x[i];
    const y = red.y[i];
    if (avena > 0) {
      // Copo de avena: óvalo a medio tono, girado
      c.k.fillStyle = cobertura(0.67);
      c.k.beginPath();
      c.k.ellipse(x, y, 13 * avena, 9 * avena, hash01(i, 5) * Math.PI, 0, Math.PI * 2);
      c.k.fill();
    }
    k.beginPath();
    k.arc(x, y, i === 0 ? 10 : 6, 0, Math.PI * 2);
    k.fill();
  }
  if (visibles > 0) {
    k.font = fuente(MONO, 34, 700);
    k.fillText('Tokio', red.x[0] - 40, red.y[0] - 24);
  }
}

// ── Cámara ────────────────────────────────────────────────────────────────────────────────────

function planosDe(l: Linea, red: Red): Plano[] {
  const neutra = {zoom: 1};
  const tokio = {px: red.x[0], py: red.y[0]};
  return [
    {desde: DURACION_PORTADA, toma: neutra, deriva: 0.05},
    {desde: l.avena, toma: {zoom: 1.2, ...tokio}, entrada: 'suave', viaje: 0.9, deriva: 0.05},
    {desde: l.soltaron, toma: {zoom: 2.4, ...tokio, dy: 880 - red.y[0]}, entrada: 'suave', viaje: 0.9, deriva: 0.05},
    {desde: l.primero, toma: neutra, entrada: 'suave', viaje: 1.2, deriva: 0.03},
    {desde: l.parecia, toma: neutra, deriva: 0.04},
    {desde: l.truco, toma: {zoom: 2.3, ...tokio, dy: 860 - red.y[0]}, entrada: 'suave', viaje: 0.8, deriva: 0.05},
    {desde: l.decadas, toma: neutra, entrada: 'suave', viaje: 0.8, deriva: 0.03},
  ];
}

// ── Componente ────────────────────────────────────────────────────────────────────────────────

const Sketch: React.FC<PropsSketch> = ({tiempos, config}) => {
  const f = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const t = f / fps;
  const l = linea(tiempos, (durationInFrames - 1) / fps);
  const pulso = pulsoDe(config);
  const red = useMemo(() => crearRed(config.semilla), [config.semilla]);
  const historia = useMemo(() => simular(red, config.semilla), [red, config.semilla]);
  const final = historia[historia.length - 1];
  // "Si se rompe una vía": el tubo vivo cuya rotura aísla más ciudades (y las ciudades que aísla)
  const rotura = useMemo(() => {
    const n = red.x.length;
    const vivos = [...final].map((v, k) => (v > UMBRAL ? k : -1)).filter((k) => k >= 0);
    let mejor = {tubo: -1, aisladas: [] as number[]};
    for (const quitar of vivos) {
      const vecinos: number[][] = Array.from({length: n}, () => []);
      for (const k of vivos) if (k !== quitar) {
        vecinos[red.a[k]].push(red.b[k]);
        vecinos[red.b[k]].push(red.a[k]);
      }
      const visto = new Uint8Array(n);
      visto[0] = 1;
      const cola = [0];
      for (let i = 0; i < cola.length; i++) for (const v of vecinos[cola[i]]) if (!visto[v]) {
        visto[v] = 1;
        cola.push(v);
      }
      const aisladas = CIUDADES.map((_, c) => c).filter((c) => !visto[c]);
      if (aisladas.length > mejor.aisladas.length && aisladas.length <= 6) mejor = {tubo: quitar, aisladas};
    }
    return mejor;
  }, [red, final]);
  const momentos = momentosCiudades(l, pulso);
  const listaCortes = cortes(l);

  useDibujo(ORDEN.sketch, (c) => {
    const hud: (() => void)[] = [];
    if (enPortadaEn(t, l)) {
      // Portada y final: el mapa con la red final, más pequeño y arriba (por encima del título)
      const toma: Toma = {zoom: 0.72, px: 540, py: 330, dx: 0, dy: -110, giro: 0};
      conCamara(c, toma, () => {
        bahia(c);
        tubos(c, red, final);
        ciudades(c, red, 36, 0);
      });
      if (t >= l.dia && t < l.fin - 0.4) {
        // "Poco más de un día": 26 horas
        const k = c.solido.k;
        k.fillStyle = cobertura(1);
        k.font = fuente(TITULAR, 96);
        k.textAlign = 'center';
        k.fillText('26 HORAS', 540, 1060);
        k.font = fuente(MONO, 26, 700);
        k.fillText('la red del moho, en el artículo', 540, 1110);
        k.textAlign = 'left';
        fuenteEnPantalla(c, 'Scientific American (2010): la red a las 26 horas', fase(t, l.dia, l.dia + 0.4));
      }
    } else {
      conCamara(c, tomaEn(t, planosDe(l, red)), () => escena(c, hud));
    }
    hud.forEach((h) => h());
    sacudirRegistro(c, t, listaCortes, 8, 0.1);
  });

  function escena(c: Capas, hud: (() => void)[]) {
    bahia(c);
    const visibles = momentos.filter((m) => t >= m).length;
    const avena = salidaCubica(fase(t, l.avena, l.avena + 0.5));

    // ── Mapa: "¿cómo las unirías con trenes?": trazos punteados desde Tokio ──
    if (t >= l.unirias && t < l.dosMil) {
      const k = c.solido.k;
      k.strokeStyle = cobertura(1);
      k.lineWidth = 2.5;
      k.setLineDash([8, 10]);
      k.beginPath();
      const e = salidaCubica(fase(t, l.unirias, l.unirias + 0.8));
      for (let i = 1; i < 36; i++) {
        k.moveTo(red.x[0], red.y[0]);
        k.lineTo(red.x[0] + (red.x[i] - red.x[0]) * e, red.y[0] + (red.y[i] - red.y[0]) * e);
      }
      k.stroke();
      k.setLineDash([]);
    }

    // ── El moho en Tokio ──
    if (t >= l.soltaron && t < l.primero + 0.6) {
      const r = 14 + 30 * salidaCubica(fase(t, l.soltaron + 0.4, l.primero + 0.4));
      c.a.fillStyle = cobertura(0.67);
      c.a.beginPath();
      for (let k = 0; k <= 24; k++) {
        const ang = (k / 24) * Math.PI * 2;
        const rr = r * (0.85 + 0.3 * hash01(k, Math.floor(t * 4)));
        const x = red.x[0] + Math.cos(ang) * rr;
        const y = red.y[0] + Math.sin(ang) * rr;
        if (k) c.a.lineTo(x, y);
        else c.a.moveTo(x, y);
      }
      c.a.closePath();
      c.a.fill();
      mira(c.solido.k, red.x[0], red.y[0], 70, fase(t, l.celula, l.celula + 0.4), t);
    }

    // ── Lo cubrió todo, y la poda ──
    if (t >= l.primero && t < l.truco) {
      if (t < l.despues) tubos(c, red, null, {hastaSaltos: Math.floor(red.maxSaltos * crecida(t, l))});
      else {
        const quitar = t >= l.rompe ? rotura.tubo : undefined;
        tubos(c, red, historia[pasoPoda(t, l, historia.length - 1)], {quitar});
        if (t >= l.rompe) {
          // La rotura: una cruz negra en el tubo, y las ciudades que se quedan aisladas, marcadas
          const k = rotura.tubo;
          const x = (red.x[red.a[k]] + red.x[red.b[k]]) / 2;
          const y = (red.y[red.a[k]] + red.y[red.b[k]]) / 2;
          const e = salidaCubica(fase(t, l.rompe, l.rompe + 0.3));
          const s = c.solido.k;
          s.strokeStyle = cobertura(1);
          s.lineWidth = 7;
          s.beginPath();
          s.moveTo(x - 22 * e, y - 22 * e);
          s.lineTo(x + 22 * e, y + 22 * e);
          s.moveTo(x + 22 * e, y - 22 * e);
          s.lineTo(x - 22 * e, y + 22 * e);
          s.stroke();
          rotura.aisladas.forEach((i, n) => mira(c.solido.k, red.x[i], red.y[i], 26, fase(t, l.rompe + 0.3 + n * 0.08, l.rompe + 0.7 + n * 0.08), t));
        }
      }
    }

    // ── El truco: de cerca, la poda otra vez y el flujo por los tubos ──
    if (t >= l.truco) {
      const D = historia[pasoTruco(t, l, historia.length - 1)];
      tubos(c, red, D);
      // Flujo: puntos que corren por los tubos gruesos
      c.solido.k.fillStyle = cobertura(1);
      c.solido.k.beginPath();
      for (let k = 0; k < red.a.length; k++) {
        if (D[k] < 0.5) continue;
        const u = (t * 1.6 + hash01(k, 9)) % 1;
        const x = red.x[red.a[k]] + (red.x[red.b[k]] - red.x[red.a[k]]) * u;
        const y = red.y[red.a[k]] + (red.y[red.b[k]] - red.y[red.a[k]]) * u;
        c.solido.k.moveTo(x + 3, y);
        c.solido.k.arc(x, y, 3, 0, Math.PI * 2);
      }
      c.solido.k.fill();
      hud.push(() => {
        if (t >= l.engrosa - 0.2) rotulo(c, 'mucho flujo: se engrosa', 90, 430, fase(t, l.engrosa - 0.2, l.engrosa + 0.2), {tam: 30, tinta: 'a'});
        if (t >= l.desaparece - 0.2) rotulo(c, 'poco flujo: desaparece', 90, 500, fase(t, l.desaparece - 0.2, l.desaparece + 0.2), {tam: 30, tinta: 'b'});
        rotulo(c, 'esquema · modelo de tubos del artículo', 90, 360, fase(t, l.truco, l.truco + 0.4), {tam: 26, tinta: 'b'});
      });
    }

    ciudades(c, red, visibles, avena);

    // ── Rótulos y cifras ──
    hud.push(() => {
      // Fuente en pantalla mientras la voz cuenta el experimento, sus resultados y su modelo
      const FUENTE = 'Tero y otros, Science 327, 439 (2010)';
      if (t >= l.dosMil && t < l.primero) fuenteEnPantalla(c, FUENTE, fase(t, l.dosMil, l.dosMil + 0.4));
      if (t >= l.parecia && t < l.decadas) fuenteEnPantalla(c, FUENTE, fase(t, l.parecia, l.parecia + 0.4));
      if (t >= l.sinCerebro && t < l.primero) {
        ([['sin cerebro', l.sinCerebro], ['sin planos', l.sinPlanos], ['sin ingenieros', l.sinIngenieros]] as const).forEach(([texto, desde], i) => {
          if (t >= desde) rotulo(c, texto, 600, 1180 + i * 70, fase(t, desde, desde + 0.3), {tam: 34, tinta: 'a', desde: 'derecha'});
        });
      }
      if (t >= l.primero && t < l.parecia) rotulo(c, 'esquema · ciudades aproximadas', 90, 400, fase(t, l.primero, l.primero + 0.4), {tam: 26, tinta: 'b'});
      if (t >= l.parecia && t < l.truco) cifras(c);
    });
  }

  /** Las cifras del artículo: moho (rosa) frente a trenes (azul). */
  function cifras(c: Capas) {
    recortarPapel(c, (ctx) => {
      ctx.beginPath();
      ctx.rect(50, 1120, 980, 300);
    });
    const k = c.solido.k;
    k.fillStyle = cobertura(1);
    k.font = fuente(MONO, 28, 700);
    k.fillText('moho', 660, 1160);
    k.fillText('trenes', 840, 1160);
    c.solido.a.fillStyle = cobertura(1);
    c.solido.a.fillRect(625, 1138, 24, 24);
    c.solido.b.fillStyle = cobertura(1);
    c.solido.b.fillRect(805, 1138, 24, 24);
    const filas: [string, number, string, number, string, number][] = [
      ['costo', 1.75, '1,75', 1.8, '1,8', l.costo],
      ['eficiencia', 0.85, '0,85', 0.85, '0,85', l.eficiencia],
      ['si falla un tramo', 0.17, '14–20 % se aísla', 0.04, '4 %', l.rompe],
    ];
    filas.forEach(([nombre, vm, tm, vt, tt, desde], i) => {
      if (t < desde) return;
      const y = 1205 + i * 74;
      const e = salidaCubica(fase(t, desde, desde + 0.5));
      const escala = i === 0 ? 170 : i === 1 ? 340 : 1500;
      k.font = fuente(MONO, 30, 700);
      k.fillText(nombre, 70, y + 18);
      c.solido.a.fillRect(390, y - 6, vm * escala * e, 18);
      c.solido.b.fillRect(390, y + 16, vt * escala * e, 18);
      k.font = fuente(MONO, 24, 700);
      k.fillText(tm, 400 + vm * escala * e, y + 9);
      k.fillText(tt, 400 + vt * escala * e, y + 33);
    });
    rotulo(c, 'medido en el artículo', 90, 400, fase(t, l.parecia, l.parecia + 0.4), {tam: 26, tinta: 'b'});
  }

  return null;
};

export default Sketch;
