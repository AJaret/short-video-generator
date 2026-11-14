// nº08b · ¿Quién diseñó los trenes? · el episodio del moho rehecho con las referencias como base.
//
// Mismo guion, misma voz y misma simulación que nº08 (el modelo de tubos de Tero y otros, 2010, en
// ../nº08-moho/simulacion.ts). Estética riso del canal, sin excepciones de color. De las ediciones de
// referencia se toma:
//   · 3D: el mapa es una maqueta (tres.ts). Empieza visto desde arriba, como el mapa de nº08, y se
//     inclina cuando la voz pregunta "¿cómo las unirías?". Las ciudades son cilindros tramados.
//   · Planchas de tinta a sangre con el dibujo en papel, solo en los dos momentos fuertes: la
//     revelación (plancha azul) y "26 horas" (plancha rosa).
//   · Capa técnica: cruces de retícula, mira, lecturas, marco con estrellas.
// Movimiento calmado, porque es un video que explica: la cámara viaja despacio con la voz y deriva muy
// poco; nada salta ni late al ritmo. Lo único que va con la música son los cortes y los gestos que
// ya eran necesarios (las ciudades que aparecen, los copos que caen), y su sonido sale de linea.ts.
import React, {useMemo} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {
  cilindro,
  cobertura,
  cubo,
  dibujar3D,
  enNegativo,
  entradaCubica,
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
  recortarPapel,
  rotulo,
  sacudirRegistro,
  salidaCubica,
  salidaRebote,
  TITULAR,
  trazarEstrella,
  useDibujo,
  type Camara,
  type Capas,
  type Objeto3D,
  type PropsSketch,
  type Vec3,
} from '@canal';
import {bahiaEnPantalla, CIUDADES, crearRed, simular} from '../nº08-moho/simulacion';
import {crecida, enPortadaEn, fase, linea, momentosAvena, momentosCiudades, pasoPoda, pasoTruco, type Linea} from './linea';

const UMBRAL = 0.05;
const FUENTE = 'Tero y otros, Science 327, 439 (2010)';

/** Mapa (px de la simulación) → mundo: 100 px = 1 unidad, suelo en y = 0, +Z hacia el sur. */
const aMundo = (x: number, y: number): Vec3 => [(x - 540) / 100, 0, (y - 775) / 100];

const CILINDRO = cilindro(14);
const CUBO = cubo();
const ESFERA = esfera(8, 14);
const altura = (i: number) => (i === 0 ? 0.6 : 0.34);
const radio = (i: number) => (i === 0 ? 0.15 : 0.1);

// ── Cámara ────────────────────────────────────────────────────────────────────────────────────

/** Una toma 3D. `escala` = px por unidad a la distancia del objetivo (la perspectiva la da `distancia`). */
type Toma3 = {objetivo: Vec3; distancia: number; azimut: number; elevacion: number; escala: number; centro: [number, number]};
type Plano3 = {desde: number; toma: Toma3; /** Segundos de viaje desde la toma anterior (0 = corte). */ viaje?: number};

const aCamara = (c: Toma3): Camara => ({
  objetivo: c.objetivo,
  distancia: c.distancia,
  azimut: c.azimut,
  elevacion: c.elevacion,
  fov: 2 * Math.atan(540 / (c.escala * c.distancia)),
  centro: c.centro,
  vista: 1080,
});

const mezclarTomas = (a: Toma3, b: Toma3, f: number): Toma3 => {
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

/** Deriva: la cámara nunca se queda clavada, pero se mueve muy poco (órbita y acercamiento lentos). */
const conDeriva = (toma: Toma3, dt: number): Toma3 => ({...toma, azimut: toma.azimut + 0.012 * dt, escala: toma.escala * (1 + 0.004 * dt)});

function tomaEn(t: number, planos: Plano3[]): Toma3 {
  let i = 0;
  while (i + 1 < planos.length && t >= planos[i + 1].desde) i++;
  const actual = conDeriva(planos[i].toma, t - planos[i].desde);
  const viaje = planos[i].viaje ?? 0;
  if (i === 0 || viaje <= 0 || t >= planos[i].desde + viaje) return actual;
  const anterior = conDeriva(planos[i - 1].toma, t - planos[i - 1].desde);
  return mezclarTomas(anterior, actual, entradaSalidaCubica((t - planos[i].desde) / viaje));
}

const CENITAL: Toma3 = {objetivo: [0, 0, 0], distancia: 30, azimut: 0, elevacion: 1.553, escala: 100, centro: [540, 730]};
const PORTADA: Toma3 = {...CENITAL, escala: 72, centro: [540, 540]};
const GENERAL: Toma3 = {objetivo: [0, 0, 0.1], distancia: 13, azimut: -0.22, elevacion: 0.95, escala: 93, centro: [558, 750]};

function planosDe(l: Linea, tokio: Vec3): Plano3[] {
  return [
    {desde: l.mapa, toma: CENITAL},
    // "¿Cómo las unirías?": el mapa se inclina y se vuelve maqueta
    {desde: l.unir, toma: GENERAL, viaje: 1.8},
    // "Y en Tokio soltaron un moho": de cerca
    {desde: l.moho, toma: {objetivo: [tokio[0], 0.3, tokio[2]], distancia: 6, azimut: 0.3, elevacion: 0.62, escala: 250, centro: [540, 820]}, viaje: 1.4},
    // "Primero lo cubrió todo": otra vez el mapa entero
    {desde: l.cubre, toma: {...GENERAL, azimut: 0.08}, viaje: 1.4},
    // Las cifras: la red arriba, más pequeña (corte: viene de la plancha azul)
    {desde: l.costo, toma: {...GENERAL, azimut: 0.15, elevacion: 1, escala: 66, centro: [540, 640]}},
    // "¿El truco?": a ras de suelo, junto a Tokio
    {desde: l.truco, toma: {objetivo: [tokio[0] + 0.1, 0, tokio[2] + 0.1], distancia: 5, azimut: 0.6, elevacion: 0.5, escala: 235, centro: [540, 900]}, viaje: 1.4},
  ];
}

// ── Componente ────────────────────────────────────────────────────────────────────────────────

const Sketch: React.FC<PropsSketch> = ({tiempos, config}) => {
  const f = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const t = f / fps;
  const pulso = useMemo(() => pulsoDe(config), [config]);
  const l = useMemo(() => linea(tiempos, (durationInFrames - 1) / fps, pulso), [tiempos, durationInFrames, fps, pulso]);

  // La simulación (una vez): malla, historia de la poda y lo que se deriva de ella
  const sim = useMemo(() => {
    const red = crearRed(config.semilla);
    const historia = simular(red, config.semilla);
    const final = historia[historia.length - 1];
    const nodos = Array.from(red.x, (x, i) => aMundo(x, red.y[i]));
    const bahia = bahiaEnPantalla().map(([x, y]) => aMundo(x, y));
    const n = red.x.length;
    // Tubos vivos en cada paso (la lectura de la poda) y tubos de la malla hasta cada salto
    const vivosEn = historia.map((D) => D.reduce((s, v) => s + (v > UMBRAL ? 1 : 0), 0));
    const hasta = new Int32Array(red.maxSaltos + 1);
    for (let k = 0; k < red.a.length; k++) hasta[Math.max(red.saltos[red.a[k]], red.saltos[red.b[k]])]++;
    for (let h = 1; h < hasta.length; h++) hasta[h] += hasta[h - 1];
    // "Si se rompe una vía": el tubo vivo cuya rotura aísla más ciudades (hasta 6), y cuáles
    const vivos = [...final].map((v, k) => (v > UMBRAL ? k : -1)).filter((k) => k >= 0);
    let rotura = {tubo: -1, aisladas: [] as number[]};
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
      if (aisladas.length > rotura.aisladas.length && aisladas.length <= 6) rotura = {tubo: quitar, aisladas};
    }
    // Retícula del suelo: pocas cruces (una cada 2 unidades), para que acompañen sin ensuciar
    const cruces: Vec3[] = [];
    for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) cruces.push([i * 2, 0, j * 2]);
    return {red, historia, final, nodos, bahia, vivosEn, hasta, rotura, cruces};
  }, [config.semilla]);

  const {red, historia, final, nodos, bahia, rotura} = sim;
  const mCiudades = useMemo(() => momentosCiudades(l), [l]);
  const mAvena = useMemo(() => momentosAvena(l), [l]);
  const planos = useMemo(() => planosDe(l, nodos[0]), [l, nodos]);

  type Proy = ([number, number, number, number] | null)[];

  // ── Piezas del mapa ─────────────────────────────────────────────────────────────────────────

  /** Cruces de retícula en el suelo: hacen legible el movimiento de la cámara sin ensuciar. */
  function reticula(c: Capas, cam: Camara) {
    const k = c.solido.k;
    k.strokeStyle = cobertura(1);
    k.lineWidth = 2;
    k.beginPath();
    for (const p of sim.cruces) {
      const q = proyectar(p, cam);
      if (!q) continue;
      const s = Math.max(4, Math.min(10, q[3] * 0.07));
      k.moveTo(q[0] - s, q[1]);
      k.lineTo(q[0] + s, q[1]);
      k.moveTo(q[0], q[1] - s);
      k.lineTo(q[0], q[1] + s);
    }
    k.stroke();
  }

  /** La bahía de Tokio: agua a medio tono azul. */
  function agua(c: Capas, cam: Camara) {
    c.b.fillStyle = cobertura(0.34);
    c.b.beginPath();
    bahia.forEach((p, i) => {
      const q = proyectar(p, cam);
      if (!q) return;
      if (i) c.b.lineTo(q[0], q[1]);
      else c.b.moveTo(q[0], q[1]);
    });
    c.b.closePath();
    c.b.fill();
  }

  /**
   * Tubos sobre el suelo, trazados en `ctx`. Con `D`, el grosor sale de la conductividad (el modelo de
   * tubos); sin `D`, la malla de partida, fina, hasta `hastaSaltos` saltos desde Tokio.
   */
  function tubos(
    ctx: CanvasRenderingContext2D,
    P: Proy,
    D: Float32Array | null,
    op: {hastaSaltos?: number; quitar?: number; grosor?: number} = {},
  ) {
    const porGrosor = new Map<number, Path2D>();
    for (let k = 0; k < red.a.length; k++) {
      if (k === op.quitar) continue;
      let ancho = 0.022;
      if (D) {
        const d = D[k];
        if (d < UMBRAL) continue;
        ancho = 0.02 + 0.1 * Math.min(1, d);
      } else if (op.hastaSaltos !== undefined && Math.max(red.saltos[red.a[k]], red.saltos[red.b[k]]) > op.hastaSaltos) continue;
      const a = P[red.a[k]];
      const b = P[red.b[k]];
      if (!a || !b) continue;
      const w = Math.max(2.5, Math.round(ancho * (op.grosor ?? 1) * (a[3] + b[3])) / 2);
      let camino = porGrosor.get(w);
      if (!camino) porGrosor.set(w, (camino = new Path2D()));
      camino.moveTo(a[0], a[1]);
      camino.lineTo(b[0], b[1]);
    }
    ctx.lineCap = 'round';
    for (const [w, camino] of porGrosor) {
      ctx.lineWidth = w;
      ctx.stroke(camino);
    }
  }

  /**
   * Ciudades: cilindros tramados en negro (o discos, si `alto` es 0). `asoma(i)` es el tamaño 0…1 con
   * que aparece cada una; `extra` son más objetos 3D que deben taparse con ellas (copos, el moho).
   */
  function ciudades(
    c: Capas,
    cam: Camara,
    P: Proy,
    op: {asoma?: (i: number) => number; alto?: (i: number) => number; extra?: Objeto3D[]; tokio?: boolean} = {},
  ) {
    const objetos: Objeto3D[] = op.extra ?? [];
    const k = c.solido.k;
    k.fillStyle = cobertura(1);
    for (let i = 0; i < CIUDADES.length; i++) {
      const e = op.asoma ? op.asoma(i) : 1;
      if (e <= 0) continue;
      const h = op.alto ? op.alto(i) : altura(i);
      const r = radio(i) * e;
      const p = nodos[i];
      const q = P[i];
      if (h < 0.012) {
        if (!q) continue;
        k.beginPath();
        k.arc(q[0], q[1], Math.max(4, r * q[3] * 0.78), 0, Math.PI * 2);
        k.fill();
      } else {
        objetos.push({malla: CILINDRO, tr: {escala: [r, h / 2, r], pos: [p[0], h / 2, p[2]]}, material: {tinta: 'k', tonos: [0.42, 1]}});
      }
    }
    if (objetos.length) dibujar3D(c, objetos, cam, {ambiente: 0.25});
    if (op.tokio !== false && (!op.asoma || op.asoma(0) > 0)) {
      const h = op.alto ? op.alto(0) : altura(0);
      const q = proyectar([nodos[0][0], h, nodos[0][2]], cam);
      if (q) {
        k.font = fuente(MONO, 34, 700);
        k.textAlign = 'left';
        k.textBaseline = 'alphabetic';
        k.fillStyle = cobertura(1);
        k.fillText('Tokio', q[0] + 18, q[1] - 18);
      }
    }
  }

  /** Copos de avena: cubitos claros con arista. `y(i)` = altura de su centro, o null si aún no existe. */
  function copos(y: (i: number) => number | null): Objeto3D[] {
    const objetos: Objeto3D[] = [];
    for (let i = 0; i < CIUDADES.length; i++) {
      const yy = y(i);
      if (yy === null) continue;
      const p = nodos[i];
      objetos.push({
        malla: CUBO,
        tr: {escala: [0.085, 0.03, 0.06], rot: [0, hash01(i, 5) * Math.PI, 0], pos: [p[0], yy, p[2]]},
        material: {tinta: 'k', tonos: [0.05, 0.45], aristas: true},
      });
    }
    return objetos;
  }

  // ── Escenas ─────────────────────────────────────────────────────────────────────────────────

  /** Portada (y cierre): la red final vista desde arriba, quieta: el fotograma del loop. */
  function portada(c: Capas) {
    const cam = aCamara(PORTADA);
    const P = nodos.map((p) => proyectar(p, cam));
    agua(c, cam);
    c.solido.a.strokeStyle = cobertura(1);
    tubos(c.solido.a, P, final);
    ciudades(c, cam, P, {alto: () => 0});
  }

  /** La maqueta, de las ciudades al truco: un solo plano continuo, con la cámara viajando con la voz. */
  function maqueta(c: Capas) {
    const cam = aCamara(tomaEn(t, planos));
    const P = nodos.map((p) => proyectar(p, cam));
    reticula(c, cam);
    agua(c, cam);
    const a = c.solido.a;
    const k = c.solido.k;
    a.strokeStyle = cobertura(1);

    // ── "¿Cómo las unirías con trenes?": trazos punteados desde Tokio ──
    if (t >= l.unir && t < l.avena) {
      const e = salidaCubica(fase(t, l.unir, l.unir + 0.9));
      const o = nodos[0];
      const pa = P[0];
      k.strokeStyle = cobertura(1);
      k.lineWidth = 2.5;
      k.setLineDash([8, 10]);
      k.beginPath();
      for (let i = 1; i < 36 && pa; i++) {
        const pb = proyectar([o[0] + (nodos[i][0] - o[0]) * e, 0, o[2] + (nodos[i][2] - o[2]) * e], cam);
        if (!pb) continue;
        k.moveTo(pa[0], pa[1]);
        k.lineTo(pb[0], pb[1]);
      }
      k.stroke();
      k.setLineDash([]);
    }

    // ── La red: malla que crece, poda, red final (con la rotura) o la poda de cerca ──
    let D: Float32Array | null = null;
    if (t >= l.truco) {
      D = historia[pasoTruco(t, l, historia.length - 1)];
      tubos(a, P, D, {grosor: 1.2});
    } else if (t >= l.costo) {
      tubos(a, P, final, {quitar: t >= l.rompe ? rotura.tubo : undefined});
    } else if (t >= l.poda) {
      tubos(a, P, historia[pasoPoda(t, l, historia.length - 1)]);
    } else if (t >= l.cubre) {
      tubos(a, P, null, {hastaSaltos: Math.floor(red.maxSaltos * crecida(t, l))});
    }

    // ── El truco: el flujo, puntos que corren por los tubos gruesos que sobreviven ──
    if (D) {
      k.fillStyle = cobertura(1);
      k.beginPath();
      for (let i = 0; i < red.a.length; i++) {
        if (D[i] < 0.5 || final[i] < UMBRAL) continue;
        const p0 = nodos[red.a[i]];
        const p1 = nodos[red.b[i]];
        const u = (t * 1.2 + hash01(i, 9)) % 1;
        const q = proyectar([p0[0] + (p1[0] - p0[0]) * u, 0.01, p0[2] + (p1[2] - p0[2]) * u], cam);
        if (!q) continue;
        const r = Math.max(3, 0.03 * q[3]);
        k.moveTo(q[0] + r, q[1]);
        k.arc(q[0], q[1], r, 0, Math.PI * 2);
      }
      k.fill();
    }

    // ── Ciudades, copos de avena y el moho ──
    const levanta = (i: number) => altura(i) * salidaCubica(fase(t, l.unir + 0.2 + red.saltos[i] * 0.012, l.unir + 0.9 + red.saltos[i] * 0.012));
    const extra: Objeto3D[] = [];
    if (t >= mAvena[0] - 0.3 && t < l.revelacion) {
      extra.push(...copos((i) => {
        if (i === 0 && t >= l.moho) return null; // el moho se come el de Tokio
        const dt = t - (mAvena[i] - 0.3);
        return dt < 0 ? null : altura(i) + 0.035 + 1.9 * (1 - entradaCubica(Math.min(1, dt / 0.3)));
      }));
    }
    const tk = nodos[0];
    let moho: Vec3 | null = null;
    if (t >= l.moho && t < l.cubre + 1.4) {
      // El moho: una gota rosa que cae sobre Tokio y se asienta (se va al empezar a cubrirlo todo)
      const R = 0.26 * Math.max(0.3, salidaRebote(fase(t, l.moho + 0.5, l.moho + 0.9))) * (1 - salidaCubica(fase(t, l.cubre, l.cubre + 0.8)));
      const cae = 1.5 * (1 - salidaCubica(fase(t, l.moho + 0.3, l.moho + 0.7)));
      moho = [tk[0], altura(0) + R * 0.45 + cae, tk[2]];
      if (R > 0.01) extra.push({malla: ESFERA, tr: {escala: [R, R * 0.62, R], pos: moho}, material: {tinta: 'a', sombra: 'b', tonos: [0.3, 1]}});
    }
    ciudades(c, cam, P, {
      asoma: (i) => (t >= mCiudades[i] ? salidaCubica(fase(t, mCiudades[i], mCiudades[i] + 0.15)) : 0),
      alto: t < l.avena ? levanta : undefined,
      extra,
      tokio: !(t >= l.moho && t < l.cubre),
    });

    // ── "Una sola célula": la mira ──
    if (moho && t >= l.celula && t < l.cubre) {
      const q = proyectar(moho, cam);
      if (q) mira(k, q[0], q[1], 150, fase(t, l.celula, l.celula + 0.45), t * 0.25, 4);
    }

    // ── La rotura: una cruz en el tubo, y una mira en cada ciudad que se queda aislada ──
    if (t >= l.rompe && t < l.truco) {
      const i = rotura.tubo;
      const p0 = nodos[red.a[i]];
      const p1 = nodos[red.b[i]];
      const q = proyectar([(p0[0] + p1[0]) / 2, 0, (p0[2] + p1[2]) / 2], cam);
      if (q) {
        const s = 22 * salidaCubica(fase(t, l.rompe, l.rompe + 0.3));
        k.strokeStyle = cobertura(1);
        k.lineWidth = 7;
        k.beginPath();
        k.moveTo(q[0] - s, q[1] - s);
        k.lineTo(q[0] + s, q[1] + s);
        k.moveTo(q[0] + s, q[1] - s);
        k.lineTo(q[0] - s, q[1] + s);
        k.stroke();
      }
      rotura.aisladas.forEach((ciudad, n) => {
        const pc = proyectar([nodos[ciudad][0], altura(ciudad), nodos[ciudad][2]], cam);
        if (pc) mira(k, pc[0], pc[1], 26, fase(t, l.rompe + 0.3 + n * 0.08, l.rompe + 0.7 + n * 0.08), t * 0.25);
      });
    }

    // ── Lecturas, rótulos y fuente (no se mueven con la cámara) ──
    if (t < l.avena) {
      const visibles = mCiudades.filter((m) => t >= m).length;
      lectura(k, 'ciudades', String(visibles).padStart(2, '0'), 70, 1340, {tam: 60});
    } else if (t >= l.caen && t < l.moho) {
      const caidos = mAvena.filter((m) => t >= m).length;
      lectura(k, 'copos de avena', String(caidos).padStart(2, '0'), 70, 1340, {tam: 60});
    } else if (t >= l.cubre && t < l.poda) {
      lectura(k, 'tubos', String(sim.hasta[Math.floor(red.maxSaltos * crecida(t, l))]), 70, 1340, {tam: 60});
    } else if (t >= l.poda && t < l.revelacion) {
      lectura(k, 'tubos', String(sim.vivosEn[pasoPoda(t, l, historia.length - 1)]), 70, 1340, {tam: 60});
    }
    if (t >= l.avena && t < l.cubre) fuenteEnPantalla(c, FUENTE, fase(t, l.avena, l.avena + 0.4));
    if (t >= l.costo) fuenteEnPantalla(c, FUENTE, 1);
    if (t >= l.sin[0] && t < l.cubre) {
      (['sin cerebro', 'sin planos', 'sin ingenieros'] as const).forEach((texto, i) => {
        if (t >= l.sin[i]) rotulo(c, texto, 560, 1130 + i * 72, fase(t, l.sin[i], l.sin[i] + 0.3), {tam: 34, tinta: 'a', desde: 'derecha', semilla: 31 + i});
      });
    }
    if (t >= l.cubre && t < l.revelacion) rotulo(c, 'esquema · ciudades aproximadas', 90, 400, fase(t, l.cubre, l.cubre + 0.4), {tam: 26, tinta: 'b'});
    if (t >= l.costo && t < l.truco) cifras(c);
    if (t >= l.truco) {
      rotulo(c, 'esquema · modelo de tubos del artículo', 90, 360, fase(t, l.truco, l.truco + 0.4), {tam: 26, tinta: 'b'});
      if (t >= l.engrosa - 0.2) rotulo(c, 'mucho flujo: se engrosa', 90, 1180, fase(t, l.engrosa - 0.2, l.engrosa + 0.2), {tam: 30, tinta: 'a', semilla: 41});
      if (t >= l.desaparece - 0.2) rotulo(c, 'poco flujo: desaparece', 90, 1252, fase(t, l.desaparece - 0.2, l.desaparece + 0.2), {tam: 30, tinta: 'b', semilla: 42});
    }
  }

  /** Las cifras del artículo: moho (rosa) frente a trenes (azul). */
  function cifras(c: Capas) {
    recortarPapel(c, (ctx) => {
      ctx.beginPath();
      ctx.rect(50, 1020, 980, 330);
    });
    const k = c.solido.k;
    for (const ctx of [k, c.solido.a, c.solido.b]) {
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
    }
    k.fillStyle = cobertura(1);
    k.font = fuente(MONO, 28, 700);
    k.fillText('moho', 436, 1066);
    k.fillText('trenes', 626, 1066);
    c.solido.a.fillStyle = cobertura(1);
    c.solido.a.fillRect(400, 1044, 24, 24);
    c.solido.b.fillStyle = cobertura(1);
    c.solido.b.fillRect(590, 1044, 24, 24);
    const filas: [string, number, string, number, string, number][] = [
      ['costo', 1.75, '1,75', 1.8, '1,8', l.costo],
      ['eficiencia', 0.85, '0,85', 0.85, '0,85', l.eficiencia],
      ['si falla un tramo', 0.17, '14–20 % se aísla', 0.04, '4 %', l.rompe],
    ];
    filas.forEach(([nombre, vm, tm, vt, tt, cuando], i) => {
      if (t < cuando) return;
      const y = 1128 + i * 80;
      const e = salidaCubica(fase(t, cuando, cuando + 0.5));
      const escala = i === 0 ? 170 : i === 1 ? 340 : 1500;
      k.font = fuente(MONO, 28, 700);
      k.fillText(nombre, 70, y + 18);
      c.solido.a.fillRect(400, y - 8, vm * escala * e, 20);
      c.solido.b.fillRect(400, y + 16, vt * escala * e, 20);
      k.font = fuente(MONO, 24, 700);
      k.fillText(tm, 412 + vm * escala * e, y + 9);
      k.fillText(tt, 412 + vt * escala * e, y + 33);
    });
    rotulo(c, 'medido en el artículo', 90, 360, fase(t, l.costo, l.costo + 0.4), {tam: 26, tinta: 'b'});
  }

  /** Estrella de papel sobre una plancha (el destello de las referencias, en negativo). */
  function estrella(c: Capas, x: number, y: number, r: number, semilla: number) {
    if (r < 2) return;
    enNegativo(c, (ctx) => {
      trazarEstrella(ctx, x, y, r, 8, semilla, 0.2, 0.22);
      ctx.fill();
    });
  }

  /**
   * La revelación: plancha azul a sangre y, en papel, la red del moho dentro de un marco con dos
   * estrellas. Es el único momento, con "26 horas", en que cambia el fondo.
   */
  function revelacion(c: Capas) {
    const tr = t - l.revelacion;
    const cam = aCamara(conDeriva({...GENERAL, azimut: 0.1, elevacion: 1.05, escala: 84, centro: [540, 800]}, tr));
    const P = nodos.map((p) => proyectar(p, cam));
    fondoTinta(c, 'b');
    const e = salidaCubica(fase(tr, 0, 0.35));
    enNegativo(c, (ctx) => {
      tubos(ctx, P, final);
      for (let i = 0; i < CIUDADES.length; i++) {
        const q = P[i];
        if (!q) continue;
        ctx.beginPath();
        ctx.arc(q[0], q[1], i === 0 ? 15 : 10, 0, Math.PI * 2);
        ctx.fill();
      }
      // Marco fino, con sus rótulos
      ctx.lineWidth = 5;
      ctx.lineCap = 'butt';
      ctx.strokeRect(90, 420, 860, 760);
      ctx.font = fuente(MONO, 30, 700);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('la red del moho', 210, 404);
      ctx.textAlign = 'right';
      ctx.fillText('esquema', 946, 404);
    });
    estrella(c, 90, 420, 96 * e, 3);
    estrella(c, 950, 1180, 80 * e, 8);
    fuenteEnPantalla(c, FUENTE, fase(tr, 0, 0.4));
  }

  /** "Los ingenieros tardaron décadas": cartel sobre papel, con una regla que avanza despacio. */
  function decadas(c: Capas) {
    const tc = t - l.decadas;
    const k = c.solido.k;
    const b = c.solido.b;
    for (const ctx of [k, b]) {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = cobertura(1);
    }
    k.font = fuente(MONO, 38, 700);
    k.fillText('los ingenieros', 74, 760);
    b.font = fuente(TITULAR, 100);
    const tam = Math.min(190, (100 * 880) / b.measureText('DÉCADAS').width);
    b.font = fuente(TITULAR, tam);
    b.fillText('DÉCADAS', 70, 770 + tam * 0.95);
    // Regla de años: se llena despacio, de corrido
    const y = 770 + tam * 0.95 + 96;
    const avance = fase(tc, 0.2, l.dia - l.decadas);
    k.fillRect(70, y, 870, 4);
    for (let i = 0; i <= 28; i++) {
      if (i / 28 > avance) break;
      k.fillRect(70 + i * 31, y - (i % 7 === 0 ? 36 : 18), 4, i % 7 === 0 ? 36 : 18);
    }
  }

  /** "Poco más de un día": 26 HORAS en papel sobre una plancha rosa a sangre. */
  function dia(c: Capas) {
    const tc = t - l.dia;
    fondoTinta(c, 'a');
    const e = salidaCubica(fase(tc, 0, 0.35));
    enNegativo(c, (ctx) => {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.font = fuente(MONO, 38, 700);
      ctx.fillText('el moho', 74, 700);
      ctx.font = fuente(TITULAR, 330);
      ctx.fillText('26', 58, 990);
      ctx.font = fuente(TITULAR, 150);
      ctx.fillText('HORAS', 66, 1140);
      ctx.font = fuente(MONO, 28, 700);
      ctx.fillText('la red del moho, en el artículo', 74, 1210);
    });
    estrella(c, 800, 640, 110 * e, 5);
    fuenteEnPantalla(c, 'Scientific American (2010): la red a las 26 horas', fase(tc, 0, 0.4));
  }

  useDibujo(ORDEN.sketch, (c) => {
    if (enPortadaEn(t, l)) portada(c);
    else if (t >= l.dia) dia(c);
    else if (t >= l.decadas) decadas(c);
    else if (t >= l.revelacion && t < l.costo) revelacion(c);
    else maqueta(c);
    // El glitch riso (las tintas se separan unos px), solo en la revelación y en la rotura
    sacudirRegistro(c, t, [l.revelacion, l.rompe], 9, 0.12);
  });

  return null;
};

export default Sketch;
