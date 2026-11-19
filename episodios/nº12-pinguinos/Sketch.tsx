// nº12 · ¿A quién le toca el borde? Pingüinos emperador apiñados contra el viento (Waters y otros,
// 2012; Zitterbart y otros, 2011; Gilbert y otros, 2006).
//
// Escenas y momentos en linea.ts; el modelo en simulacion.ts. En riso, con nº09–nº11 como estándar:
//   · Maqueta 3D (tres.ts): pingüinos con cuerpo negro tramado, panza de papel y una mancha rosa en el
//     cuello, sobre un hielo de papel con retícula azul a pantalla completa. Ventisca: trazos azules
//     que cruzan la pantalla entera.
//   · La regla, desde arriba: la simulación. El tono de cada pingüino dice cuánto viento recibe y el
//     que se mueve va en rosa, rodeando el grupo.
//   · El reparto: el frío acumulado de cada pingüino, sin moverse y con la regla.
//   · Revelación: plancha azul con el grupo en papel y la ola de pasitos recorriéndolo.
// El primer y el último fotograma son el mismo (loop): la portada.
import React, {useMemo} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {
  cobertura,
  dibujar3D,
  enNegativo,
  entradaSalidaCubica,
  esfera,
  fondoTinta,
  fuente,
  fuenteEnPantalla,
  hash01,
  lectura,
  mira,
  MONO,
  ORDEN,
  proyectar,
  pulsoDe,
  rotulo,
  sacudirRegistro,
  salidaCubica,
  TITULAR,
  trazarEstrella,
  useDibujo,
  type Camara,
  type Capas,
  type Material,
  type Objeto3D,
  type PropsSketch,
  type Vec3,
} from '@canal';
import {fase, frenteOla, linea, rondaRegla, RONDAS_REGLA, RONDAS_TOTAL} from './linea';
import {aPlano, centro, clave, desigualdad, exposicion, inicial, PARAMS, simular, type Celda} from './simulacion';

const BOLA = esfera(7, 12);

type Toma = {objetivo: Vec3; distancia: number; azimut: number; elevacion: number; escala: number; centro: [number, number]};
const aCamara = (c: Toma): Camara => ({
  objetivo: c.objetivo,
  distancia: c.distancia,
  azimut: c.azimut,
  elevacion: c.elevacion,
  fov: 2 * Math.atan(540 / (c.escala * c.distancia)),
  centro: c.centro,
  vista: 1080,
});
const mezclar = (a: Toma, b: Toma, f: number): Toma => {
  const m = (x: number, y: number) => x + (y - x) * f;
  return {
    objetivo: [m(a.objetivo[0], b.objetivo[0]), m(a.objetivo[1], b.objetivo[1]), m(a.objetivo[2], b.objetivo[2])],
    distancia: m(a.distancia, b.distancia),
    azimut: m(a.azimut, b.azimut),
    elevacion: m(a.elevacion, b.elevacion),
    escala: m(a.escala, b.escala),
    centro: [m(a.centro[0], b.centro[0]), m(a.centro[1], b.centro[1])],
  };
};

const PORTADA: Toma = {objetivo: [0, 0.4, 0], distancia: 34, azimut: 0.75, elevacion: 0.42, escala: 70, centro: [540, 560]};
const GRUPO: Toma = {objetivo: [0, 0.4, 0], distancia: 34, azimut: 0.95, elevacion: 0.5, escala: 82, centro: [540, 820]};
const CERCA: Toma = {objetivo: [5.6, 0.6, 1.2], distancia: 16, azimut: 1.15, elevacion: 0.22, escala: 150, centro: [540, 820]};
const ARRIBA: Toma = {objetivo: [0, 0, 0], distancia: 40, azimut: 0, elevacion: 1.553, escala: 70, centro: [540, 820]};

const Sketch: React.FC<PropsSketch> = ({tiempos, config}) => {
  const f = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const t = f / fps;
  const fin = (durationInFrames - 1) / fps;
  const pulso = useMemo(() => pulsoDe(config), [config]);
  const l = useMemo(() => linea(tiempos, fin, pulso), [tiempos, fin, pulso]);

  const sim = useMemo(() => {
    const ronda = simular(config.semilla, RONDAS_TOTAL);
    const quieto = simular(config.semilla, RONDAS_TOTAL, {mover: false});
    const cel0 = inicial(PARAMS.n);
    // Centrado: el grupo de partida en el origen
    const [cx, cy] = centro(cel0);
    return {ronda, quieto, cel0, cx, cy};
  }, [config.semilla]);

  /** Celda → mundo (x a favor del viento, z de lado), centrado en el grupo de partida. */
  const aMundo = (c: Celda): Vec3 => {
    const [x, y] = aPlano(c);
    return [x - sim.cx, 0, y - sim.cy];
  };

  // ── Piezas ──────────────────────────────────────────────────────────────────────────────────

  /** Un pingüino en `p`, mirando a favor del viento (+x). `egg` = con el huevo sobre las patas. */
  function pinguino(p: Vec3, s = 1, egg = false): Objeto3D[] {
    const cuerpo: Material = {tinta: 'k', tonos: [0.55, 1]};
    const panza: Material = {tinta: 'k', tonos: [0.02, 0.2]};
    const objetos: Objeto3D[] = [
      {malla: BOLA, tr: {escala: [0.42 * s, 0.62 * s, 0.4 * s], pos: [p[0], p[1] + 0.62 * s, p[2]]}, material: cuerpo},
      {malla: BOLA, tr: {escala: [0.26 * s, 0.5 * s, 0.32 * s], pos: [p[0] + 0.2 * s, p[1] + 0.56 * s, p[2]]}, material: panza},
      {malla: BOLA, tr: {escala: 0.22 * s, pos: [p[0] + 0.04 * s, p[1] + 1.32 * s, p[2]]}, material: cuerpo},
      {malla: BOLA, tr: {escala: [0.08 * s, 0.11 * s, 0.2 * s], pos: [p[0] + 0.05 * s, p[1] + 1.18 * s, p[2]]}, material: {tinta: 'a', tonos: [0.5, 1]}},
      {malla: BOLA, tr: {escala: [0.16 * s, 0.04 * s, 0.05 * s], pos: [p[0] + 0.27 * s, p[1] + 1.32 * s, p[2]]}, material: cuerpo},
    ];
    if (egg) objetos.push({malla: BOLA, tr: {escala: [0.2 * s, 0.25 * s, 0.2 * s], pos: [p[0] + 0.5 * s, p[1] + 0.25 * s, p[2]]}, material: {tinta: 'k', tonos: [0.02, 0.25], aristas: true}});
    return objetos;
  }

  /** Hielo: cruces azules a pantalla completa. */
  function hielo(c: Capas, cam: Camara) {
    const b = c.solido.b;
    b.strokeStyle = cobertura(1);
    b.lineWidth = 2.5;
    b.beginPath();
    for (let i = -24; i <= 24; i++) for (let j = -24; j <= 24; j++) {
      const q = proyectar([i * 2, 0, j * 2], cam);
      if (!q || q[0] < -20 || q[0] > 1100 || q[1] < -20 || q[1] > 1940) continue;
      const s = Math.max(4, Math.min(10, q[3] * 0.1));
      b.moveTo(q[0] - s, q[1]);
      b.lineTo(q[0] + s, q[1]);
      b.moveTo(q[0], q[1] - s * 0.5);
      b.lineTo(q[0], q[1] + s * 0.5);
    }
    b.stroke();
  }

  /**
   * Ventisca: trazos azules que cruzan la pantalla entera, de izquierda a derecha. Cada uno da un
   * número entero de vueltas en todo el video (loop exacto).
   */
  function ventisca(c: Capas, fuerza = 1) {
    const b = c.solido.b;
    b.strokeStyle = cobertura(1);
    b.lineCap = 'round';
    const W = 1400;
    for (let i = 0; i < 26; i++) {
      const vueltas = 2 + Math.floor(hash01(i, 2) * 3);
      const x = ((hash01(i, 1) * W + (W * vueltas * t) / l.fin) % W) - 160;
      const y = 120 + hash01(i, 3) * 1700;
      const largo = (50 + hash01(i, 4) * 130) * fuerza;
      b.lineWidth = 2 + hash01(i, 5) * 2;
      b.beginPath();
      b.moveTo(x, y);
      b.lineTo(x + largo, y + largo * 0.08);
      b.stroke();
    }
  }

  /** El grupo en 3D con la toma `toma`. `celdas` = posiciones; `destacar` marca a uno en rosa. */
  function grupo3D(c: Capas, toma: Toma, celdas: Celda[], op: {egg?: number} = {}) {
    const cam = aCamara(toma);
    hielo(c, cam);
    const objetos: Objeto3D[] = [];
    celdas.forEach((cel, k) => {
      // Cada uno algo distinto (fijo en todo el video): un desplazamiento y una altura propios
      const [x, y, z] = aMundo(cel);
      const p: Vec3 = [x + (hash01(k, 11) - 0.5) * 0.3, y, z + (hash01(k, 12) - 0.5) * 0.3];
      objetos.push(...pinguino(p, 0.9 + 0.2 * hash01(k, 13), k === op.egg));
    });
    dibujar3D(c, objetos, cam, {ambiente: 0.3, luz: [-0.4, 0.7, 0.5]});
    return cam;
  }

  // ── La regla, desde arriba ──────────────────────────────────────────────────────────────────

  /** Dibuja el grupo visto desde arriba en la ronda `r` (con decimales), centrado en su centro. */
  function arriba(c: Capas, r: number, op: {papel?: boolean; ola?: number} = {}) {
    const h = sim.ronda;
    const r0 = Math.max(0, Math.min(h.rondas.length - 1, Math.floor(r)));
    const r1 = Math.min(h.rondas.length - 1, r0 + 1);
    const u = entradaSalidaCubica(r - Math.floor(r));
    const cel = h.rondas[r0].celdas;
    const sig = h.rondas[r1];
    const ocupado = new Set(cel.map((x) => clave(...x)));
    // Encuadre: sigue al centro del grupo; el hielo se desliza debajo
    const [gx, gy] = centro(cel);
    const E = 54;
    const C: [number, number] = [540, 840];
    const pant = ([x, y]: [number, number]): [number, number] => [C[0] + (x - gx) * E, C[1] + (y - gy) * E];
    if (!op.papel) {
      // Hielo: cruces que se desplazan con el avance del grupo
      const b = c.solido.b;
      b.strokeStyle = cobertura(1);
      b.lineWidth = 2.5;
      b.beginPath();
      const paso = 2 * E;
      const ox = (((-gx * E) % paso) + paso) % paso;
      const oy = (((-gy * E) % paso) + paso) % paso;
      for (let x = ox - paso; x < 1180; x += paso) for (let y = oy - paso; y < 2000; y += paso) {
        b.moveTo(x - 8, y);
        b.lineTo(x + 8, y);
        b.moveTo(x, y - 8);
        b.lineTo(x, y + 8);
      }
      b.stroke();
    }
    const k = c.solido.k;
    let movil = null as [number, number] | null;
    cel.forEach((cc, i) => {
      let p = aPlano(cc);
      // El que se mueve en esta ronda: rodea el grupo por fuera (un arco), no lo atraviesa
      if (sig.movido === i && sig.desde && sig.hasta) {
        const a = aPlano(sig.desde);
        const b2 = aPlano(sig.hasta);
        const ang0 = Math.atan2(a[1] - gy, a[0] - gx);
        let ang1 = Math.atan2(b2[1] - gy, b2[0] - gx);
        if (ang1 - ang0 > Math.PI) ang1 -= 2 * Math.PI;
        if (ang0 - ang1 > Math.PI) ang1 += 2 * Math.PI;
        const r0r = Math.hypot(a[0] - gx, a[1] - gy) + 0.6;
        const r1r = Math.hypot(b2[0] - gx, b2[1] - gy) + 0.6;
        const ang = ang0 + (ang1 - ang0) * u;
        const rr = r0r + (r1r - r0r) * u + 0.8 * Math.sin(Math.PI * u);
        p = [gx + Math.cos(ang) * rr, gy + Math.sin(ang) * rr];
        movil = pant(p);
      }
      // Ola: los del frente de la ola dan su pasito
      if (op.ola !== undefined) {
        const xs = cel.map((q) => aPlano(q)[0]);
        const min = Math.min(...xs);
        const max = Math.max(...xs);
        const s = (p[0] - min) / Math.max(1e-6, max - min);
        p = [p[0] + 0.35 * entradaSalidaCubica(Math.max(0, Math.min(1, (op.ola * 1.3 - s) / 0.3))), p[1]];
      }
      const [x, y] = pant(p);
      const e = exposicion(cc, ocupado);
      if (op.papel) {
        enNegativo(c, (ctx) => {
          ctx.beginPath();
          ctx.ellipse(x, y, E * 0.42, E * 0.36, 0, 0, Math.PI * 2);
          ctx.fill();
        });
        if (op.ola !== undefined) {
          const xs = cel.map((q) => aPlano(q)[0]);
          const s = (aPlano(cc)[0] - Math.min(...xs)) / Math.max(1e-6, Math.max(...xs) - Math.min(...xs));
          if (Math.abs(op.ola * 1.3 - 0.15 - s) < 0.12) {
            c.solido.a.fillStyle = cobertura(1);
            c.solido.a.beginPath();
            c.solido.a.ellipse(x, y, E * 0.2, E * 0.17, 0, 0, Math.PI * 2);
            c.solido.a.fill();
          }
        }
        return;
      }
      // Cuerpo visto desde arriba (negro tramado), con la cabeza hacia sotavento
      c.k.fillStyle = cobertura(0.85);
      c.k.beginPath();
      c.k.ellipse(x, y, E * 0.42, E * 0.36, 0, 0, Math.PI * 2);
      c.k.fill();
      c.k.fillStyle = cobertura(1);
      c.k.beginPath();
      c.k.arc(x + E * 0.2, y, E * 0.15, 0, Math.PI * 2);
      c.k.fill();
      // Frío: rosa tramado según el viento que recibe
      if (e > 0.3) {
        c.a.fillStyle = cobertura(Math.min(1, 0.2 + 0.4 * e));
        c.a.beginPath();
        c.a.ellipse(x, y, E * 0.42, E * 0.36, 0, 0, Math.PI * 2);
        c.a.fill();
      }
    });
    if (movil && !op.papel) {
      const [mx, my] = movil;
      c.a.fillStyle = cobertura(1);
      c.a.beginPath();
      c.a.ellipse(mx, my, E * 0.42, E * 0.36, 0, 0, Math.PI * 2);
      c.a.fill();
      mira(k, mx, my, E * 0.9, 1, t * 0.4, 3);
    }
    return pant;
  }

  /** Flecha del viento (dibujada: Space Mono no tiene flechas). */
  function flechaViento(c: Capas, x: number, y: number) {
    const k = c.solido.k;
    k.strokeStyle = cobertura(1);
    k.lineWidth = 4;
    k.beginPath();
    k.moveTo(x, y);
    k.lineTo(x + 110, y);
    k.moveTo(x + 90, y - 14);
    k.lineTo(x + 110, y);
    k.lineTo(x + 90, y + 14);
    k.stroke();
    k.font = fuente(MONO, 26, 700);
    k.textAlign = 'left';
    k.textBaseline = 'middle';
    k.fillStyle = cobertura(1);
    k.fillText('viento', x + 124, y);
  }

  // ── El reparto del frío ─────────────────────────────────────────────────────────────────────

  function reparto(c: Capas) {
    const p = fase(t, l.regla + 0.2, l.pausa - 0.2);
    const ronda = Math.max(1, Math.round(entradaSalidaCubica(p) * (RONDAS_TOTAL - 1)));
    const filas: [string, number[], 'b' | 'a', number][] = [
      ['si nadie se moviera', sim.quieto.frio[ronda], 'b', 520],
      ['con la regla egoísta', sim.ronda.frio[ronda], 'a', 1020],
    ];
    const k = c.solido.k;
    for (const [nombre, frio, tinta, y0] of filas) {
      const orden = [...frio].sort((a, b) => b - a);
      const max = Math.max(1e-9, ...sim.quieto.frio[ronda]);
      const alto = 300;
      const ancho = 900 / orden.length;
      const capa = c.solido[tinta];
      capa.fillStyle = cobertura(1);
      orden.forEach((v, i) => {
        const h = (v / max) * alto;
        capa.fillRect(90 + i * ancho, y0 + alto - h, Math.max(1, ancho - 1), h);
      });
      k.strokeStyle = cobertura(1);
      k.lineWidth = 3;
      k.beginPath();
      k.moveTo(90, y0 + alto + 2);
      k.lineTo(990, y0 + alto + 2);
      k.stroke();
      k.font = fuente(MONO, 28, 700);
      k.textAlign = 'left';
      k.textBaseline = 'alphabetic';
      k.fillStyle = cobertura(1);
      k.fillText(nombre, 90, y0 - 22);
      k.font = fuente(MONO, 24, 400);
      k.textAlign = 'right';
      k.fillText(`el más castigado: ${desigualdad(frio).toFixed(1).replace('.', ',')} veces la media`, 990, y0 + alto + 42);
      k.textAlign = 'left';
    }
    k.font = fuente(MONO, 22, 400);
    k.fillText('frío acumulado de cada pingüino, de mayor a menor', 90, 470);
    fuenteEnPantalla(c, 'Waters y otros, PLoS ONE 7, e50277 (2012)', 1);
    rotulo(c, 'esquema · simulación de 140 pingüinos', 90, 360, fase(t, l.regla, l.regla + 0.4), {tam: 26, tinta: 'b'});
  }

  // ── Revelación: la ola ──────────────────────────────────────────────────────────────────────

  function revelacion(c: Capas) {
    const tr = t - l.revelacion;
    fondoTinta(c, 'b');
    arriba(c, RONDAS_REGLA, {papel: true, ola: frenteOla(t, l)});
    const e = salidaCubica(fase(tr, 0, 0.35));
    enNegativo(c, (ctx) => {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.font = fuente(MONO, 30, 700);
      ctx.fillText('cada 30 a 60 segundos, una ola de pasitos', 70, 1250);
      ctx.font = fuente(TITULAR, 140);
      ctx.fillText('12 CM/S', 64, 1400);
    });
    if (e > 0) {
      enNegativo(c, (ctx) => {
        trazarEstrella(ctx, 920, 470, 100 * e, 8, 5, 0.2, 0.22);
        ctx.fill();
      });
    }
    fuenteEnPantalla(c, 'Zitterbart y otros, PLoS ONE 6, e20260 (2011)', 1);
  }

  // ── Fotograma ───────────────────────────────────────────────────────────────────────────────

  useDibujo(ORDEN.sketch, (c) => {
    const k = c.solido.k;
    if (t >= l.borde && t < l.regla) {
      const r = t < l.apinan ? 0 : rondaRegla(t, l);
      arriba(c, r);
      flechaViento(c, 90, 470);
      ventisca(c, 0.7);
      if (t < l.apinan) {
        rotulo(c, '¿a quién le toca el borde?', 90, 360, fase(t, l.borde, l.borde + 0.4), {tam: 28, tinta: 'a', semilla: 41});
      } else {
        rotulo(c, 'esquema · la regla del modelo', 90, 360, fase(t, l.apinan, l.apinan + 0.4), {tam: 26, tinta: 'b'});
        if (t >= l.viento - 0.3) rotulo(c, 'el más expuesto rodea el grupo', 90, 1180, fase(t, l.viento - 0.3, l.viento + 0.1), {tam: 30, tinta: 'a', semilla: 42});
        lectura(k, 'cambios de sitio', String(Math.floor(r)), 70, 1340, {tam: 56});
      }
    } else if (t >= l.regla && t < l.revelacion) {
      reparto(c);
    } else if (t >= l.revelacion && t < l.remate) {
      revelacion(c);
    } else {
      // 3D: portada, el frío, el huevo y el cierre
      let toma: Toma;
      if (t < l.machos) toma = mezclar(PORTADA, GRUPO, entradaSalidaCubica(fase(t, l.mapa, l.mapa + 1.6)));
      else if (t < l.borde) toma = mezclar(GRUPO, CERCA, entradaSalidaCubica(fase(t, l.machos, l.machos + 1.4)));
      else toma = mezclar(GRUPO, PORTADA, entradaSalidaCubica(fase(t, l.remate + 0.3, l.fin - 0.6)));
      // El huevo: el pingüino del borde de sotavento más cercano a la cámara
      let huevo = -1;
      let mejor = -Infinity;
      sim.cel0.forEach((cc, i) => {
        const [x, , z] = aMundo(cc);
        if (x + 0.5 * z > mejor) {
          mejor = x + 0.5 * z;
          huevo = i;
        }
      });
      const cam3 = grupo3D(c, toma, sim.cel0, {egg: t >= l.machos && t < l.borde ? huevo : undefined});
      if (t >= l.machos && t < l.borde) {
        const [hx, , hz] = aMundo(sim.cel0[huevo]);
        const q = proyectar([hx + 0.5, 0.25, hz], cam3);
        if (q) mira(k, q[0], q[1], 0.6 * q[3], fase(t, l.machos + 0.8, l.machos + 1.3), t * 0.3, 4);
      }
      ventisca(c);
      if (t >= l.mapa && t < l.machos) lectura(k, 'invierno en la Antártida', 'hasta −40 °C', 70, 1340, {tam: 56});
      if (t >= l.machos && t < l.borde) {
        lectura(k, 'el huevo sobre las patas', '65 a 75 días', 70, 1340, {tam: 56});
        fuenteEnPantalla(c, 'Australian Antarctic Division: el pingüino emperador', fase(t, l.machos, l.machos + 0.4));
      }
      if (t >= l.mapa && t < l.machos) rotulo(c, 'esquema · pingüinos emperador', 90, 360, fase(t, l.mapa, l.mapa + 0.4), {tam: 26, tinta: 'b'});
      if (t >= l.remate) {
        fuenteEnPantalla(c, 'Gilbert y otros, Physiol. Behav. (2006)', fase(t, l.remate, l.remate + 0.4) * (1 - fase(t, l.fin - 1.2, l.fin - 0.8)));
      }
    }
    sacudirRegistro(c, t, [l.revelacion], 9, 0.12);
  });

  return null;
};

export default Sketch;
