// nº08b · ¿Quién diseñó los trenes? · montaje "edición" (color directo, 3D, cortes al pulso).
//
// Mismo guion, misma voz y misma simulación que nº08 (el modelo de tubos de Tero y otros, 2010, en
// ../nº08-moho/simulacion.ts); cambia el estilo: planchas de un color a sangre, sólidos 3D, capa
// técnica y glitch en los cortes, como en las dos ediciones de referencia del usuario. NO pasa por el
// filtro riso (config.estilo = "edicion"): dibuja el fotograma entero en un <LienzoEdicion>.
//
// La línea de tiempo (linea.ts) está en corcheas de la música y la comparte la partitura (sonido.ts).
import React, {useMemo} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {
  agruparSubtitulos,
  cilindro,
  cubo,
  entradaCubica,
  entradaSalidaCubica,
  esfera,
  fuente,
  giroAlPulso,
  golpe,
  hash01,
  momentosPortada,
  MONO,
  pulsoDe,
  salidaCubica,
  salidaExpo,
  salidaRebote,
  TITULAR,
  type PropsSketch,
  type Vec3,
} from '@canal';
import {
  AMBAR,
  AZUL,
  BLANCO,
  cabecera,
  carasDe,
  destello,
  etiqueta,
  fondoRejilla,
  glitchDeCorte,
  LienzoEdicion,
  marco,
  mezclarCamaras,
  NEGRO,
  pintarCaras,
  proyectar,
  subtituloEdicion,
  TEMAS,
  textoContorno,
  vistaDe,
  type Camara3,
  type Cara3,
  type Post,
  type Tema,
  type Vista3,
} from '@canal/edicion';
import {bahiaEnPantalla, CIUDADES, crearRed, simular} from '../nº08-moho/simulacion';
import {CARTELES, cortes, crecida, enPortadaEn, fase, linea, momentosAvena, momentosCiudades, pasoPoda, pasoTruco} from './linea';

const UMBRAL = 0.05;
const FUENTE = 'Tero y otros, Science 327, 439 (2010)';

/** Mapa (px de la simulación) → mundo: 100 px = 1 unidad, suelo en y = 0, +Z hacia el sur. */
const aMundo = (x: number, y: number): Vec3 => [(x - 540) / 100, 0, (y - 775) / 100];

const CILINDRO = cilindro(14);
const TAPA = 15; // índice de la tapa de arriba en cilindro(14): 14 lados + la base
const CUBO = cubo();
const ESFERA = esfera(7, 12);

const CENITAL: Camara3 = {objetivo: [0, 0, 0], distancia: 40, azimut: 0, elevacion: Math.PI / 2, escala: 100, centro: [540, 730]};
const PORTADA: Camara3 = {...CENITAL, escala: 78, centro: [540, 640]};
const OBLICUA: Camara3 = {objetivo: [0, 0, 0.1], distancia: 13, azimut: -0.3, elevacion: 0.95, escala: 102, centro: [552, 772]};

const altura = (i: number) => (i === 0 ? 0.6 : 0.34);
const radio = (i: number) => (i === 0 ? 0.15 : 0.1);

/** Mayor tamaño de fuente (hasta `max`) con el que `texto` cabe en `ancho`. */
function tamQueCabe(ctx: CanvasRenderingContext2D, texto: string, ancho: number, max: number): number {
  ctx.font = fuente(TITULAR, 100);
  return Math.min(max, (100 * ancho) / ctx.measureText(texto).width);
}

const Sketch: React.FC<PropsSketch> = ({tiempos, config}) => {
  const f = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const t = f / fps;
  const pulso = useMemo(() => pulsoDe(config), [config]);
  const l = useMemo(() => linea(tiempos, (durationInFrames - 1) / fps, pulso), [tiempos, durationInFrames, fps, pulso]);
  const grupos = useMemo(() => (tiempos ? agruparSubtitulos(tiempos.palabras) : []), [tiempos]);

  // La simulación (una vez): malla, historia de la poda y lo que se deriva de ella
  const sim = useMemo(() => {
    const red = crearRed(config.semilla);
    const historia = simular(red, config.semilla);
    const final = historia[historia.length - 1];
    const nodos = Array.from(red.x, (x, i) => aMundo(x, red.y[i]));
    const bahia = bahiaEnPantalla().map(([x, y]) => aMundo(x, y));
    const n = red.x.length;
    // Tubos vivos en cada paso (el contador de la poda) y tubos de la malla hasta cada salto
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
    return {red, historia, final, nodos, bahia, vivosEn, hasta, rotura};
  }, [config.semilla]);

  const {red, historia, final, nodos, bahia, rotura} = sim;
  const mCiudades = useMemo(() => momentosCiudades(l), [l]);
  const mAvena = useMemo(() => momentosAvena(l), [l]);
  const listaCortes = useMemo(() => cortes(l), [l]);
  const numero = `nº ${String(config.numero).padStart(2, '0')}`;
  /** Fotogramas desde un momento (0 = el primer fotograma en que ya ocurrió). */
  const desde = (momento: number) => f - Math.ceil(momento * fps - 1e-6);
  /** Asentamiento tras un corte: la escena entra un poco grande y frena. */
  const empuje = (corte: number, fuerza = 0.06) => 1 + fuerza * (1 - salidaExpo(fase(t, corte, corte + 0.35)));

  // ── Piezas del mapa ─────────────────────────────────────────────────────────────────────────

  /** Cuadrícula en el suelo (se mueve con la cámara: hace legible el giro). */
  function suelo(ctx: CanvasRenderingContext2D, v: Vista3, tema: Tema) {
    const paso = 0.6;
    const R = 16;
    for (const fuerte of [false, true]) {
      ctx.beginPath();
      for (let i = -R; i <= R; i++) {
        if ((i % 5 === 0) !== fuerte) continue;
        for (let j = -R; j < R; j += 2) {
          for (const [a, b] of [
            [[i * paso, 0, j * paso], [i * paso, 0, (j + 2) * paso]],
            [[j * paso, 0, i * paso], [(j + 2) * paso, 0, i * paso]],
          ] as [Vec3, Vec3][]) {
            const pa = proyectar(a, v);
            const pb = proyectar(b, v);
            if (!pa || !pb) continue;
            ctx.moveTo(pa[0], pa[1]);
            ctx.lineTo(pb[0], pb[1]);
          }
        }
      }
      ctx.strokeStyle = fuerte ? tema.rejillaFuerte : tema.rejilla;
      ctx.lineWidth = fuerte ? 2 : 1;
      ctx.stroke();
    }
  }

  function agua(ctx: CanvasRenderingContext2D, v: Vista3, tema: Tema) {
    ctx.beginPath();
    bahia.forEach((p, i) => {
      const q = proyectar(p, v);
      if (!q) return;
      if (i) ctx.lineTo(q[0], q[1]);
      else ctx.moveTo(q[0], q[1]);
    });
    ctx.closePath();
    ctx.fillStyle = tema.agua;
    ctx.fill();
  }

  /**
   * Tubos sobre el suelo. Con `D`, el grosor sale de la conductividad (el modelo de tubos); sin `D`, la
   * malla de partida, fina, hasta `hastaSaltos` saltos desde Tokio.
   */
  function tubos(
    ctx: CanvasRenderingContext2D,
    v: Vista3,
    color: string,
    D: Float32Array | null,
    op: {hastaSaltos?: number; quitar?: number; grosor?: number; refuerzo?: number} = {},
  ) {
    const porGrosor = new Map<number, Path2D>();
    for (let k = 0; k < red.a.length; k++) {
      if (k === op.quitar) continue;
      let ancho = 0.02;
      if (D) {
        const d = D[k];
        if (d < UMBRAL) continue;
        ancho = (0.018 + 0.1 * Math.min(1, d)) * (d >= 0.5 ? (op.refuerzo ?? 1) : 1);
      } else if (op.hastaSaltos !== undefined && Math.max(red.saltos[red.a[k]], red.saltos[red.b[k]]) > op.hastaSaltos) continue;
      const a = proyectar(nodos[red.a[k]], v);
      const b = proyectar(nodos[red.b[k]], v);
      if (!a || !b) continue;
      const w = Math.max(1.5, Math.round(ancho * (op.grosor ?? 1) * (a[3] + b[3])) / 2);
      let camino = porGrosor.get(w);
      if (!camino) porGrosor.set(w, (camino = new Path2D()));
      camino.moveTo(a[0], a[1]);
      camino.lineTo(b[0], b[1]);
    }
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    for (const [w, camino] of porGrosor) {
      ctx.lineWidth = w;
      ctx.stroke(camino);
    }
  }

  /**
   * Ciudades: discos planos (altura 0) o cilindros con la tapa del color de las líneas. `asoma(i)` es
   * el tamaño 0…1 con que aparece cada una; `extra` son más caras que deben ordenarse con ellas.
   */
  function ciudades(
    ctx: CanvasRenderingContext2D,
    v: Vista3,
    tema: Tema,
    op: {asoma?: (i: number) => number; alto?: (i: number) => number; extra?: Cara3[]; tokio?: boolean} = {},
  ) {
    const caras: Cara3[] = op.extra ?? [];
    for (let i = 0; i < CIUDADES.length; i++) {
      const e = op.asoma ? op.asoma(i) : 1;
      if (e <= 0) continue;
      const h = op.alto ? op.alto(i) : altura(i);
      const p = nodos[i];
      const r = radio(i) * e;
      if (h < 0.012) {
        const pts: [number, number][] = [];
        let z = 0;
        for (let k = 0; k < 14; k++) {
          const q = proyectar([p[0] + Math.cos((k / 14) * Math.PI * 2) * r, 0.004, p[2] + Math.sin((k / 14) * Math.PI * 2) * r], v);
          if (!q) continue;
          pts.push([q[0], q[1]]);
          z += q[2] / 14;
        }
        if (pts.length === 14) caras.push({pts, z, relleno: tema.linea, i: 0});
      } else {
        for (const c of carasDe(CILINDRO, {escala: [r, h / 2, r], pos: [p[0], h / 2, p[2]]}, v, {luz: tema.solidoLuz, sombra: tema.solidoSombra})) {
          if (c.i === TAPA) c.relleno = tema.linea;
          caras.push(c);
        }
      }
    }
    pintarCaras(ctx, caras);
    if (op.tokio !== false && (!op.asoma || op.asoma(0) > 0)) {
      const h = op.alto ? op.alto(0) : altura(0);
      const q = proyectar([nodos[0][0], h, nodos[0][2]], v);
      if (q) {
        ctx.font = fuente(MONO, 30, 700);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = tema.texto;
        ctx.fillText('Tokio', q[0] + 16, q[1] - 16);
      }
    }
  }

  /** Copos de avena (cubitos ámbar): `y(i)` es su altura sobre el suelo, o null si aún no existe. */
  function copos(v: Vista3, y: (i: number) => number | null): Cara3[] {
    const caras: Cara3[] = [];
    for (let i = 0; i < CIUDADES.length; i++) {
      const yy = y(i);
      if (yy === null) continue;
      const p = nodos[i];
      caras.push(...carasDe(CUBO, {escala: [0.075, 0.028, 0.055], rot: [0, hash01(i, 5) * Math.PI, 0], pos: [p[0], yy, p[2]]}, v, {luz: AMBAR, sombra: '#8A5F00'}));
    }
    return caras;
  }

  /** Contador grande de contorno (los numerales de la referencia) con su etiqueta. */
  function contador(ctx: CanvasRenderingContext2D, tema: Tema, valor: string, rotulo: string) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    textoContorno(ctx, valor, 66, 1372, 160, tema.linea, 4);
    ctx.font = fuente(MONO, 26, 700);
    ctx.fillStyle = tema.texto;
    ctx.fillText(rotulo, 72, 1228);
  }

  // ── Escenas ─────────────────────────────────────────────────────────────────────────────────

  /** Portada (y cierre): la red final desde arriba. `tp` = segundos de portada; 0 = fotograma del loop. */
  function portada(ctx: CanvasRenderingContext2D, tp: number) {
    const tema = TEMAS.azul;
    const v = vistaDe(PORTADA);
    ctx.fillStyle = tema.fondo;
    ctx.fillRect(0, 0, 1080, 1920);
    suelo(ctx, v, tema);
    agua(ctx, v, tema);
    tubos(ctx, v, tema.linea, final);
    ciudades(ctx, v, tema, {alto: () => 0});
    if (tp <= 0) return;
    // Un marco de selección salta de ciudad en ciudad, una por semicorchea
    const salto = Math.floor(tp / (l.negra / 4));
    const q = proyectar(nodos[1 + Math.floor(hash01(salto, 7) * 35)], v);
    if (q) marco(ctx, q[0] - 24, q[1] - 24, 48, 48, AMBAR, 3, 8);
    // Título: una palabra por corchea, cada una entra grande y frena
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = tema.texto;
    ctx.font = fuente(MONO, 30, 700);
    ctx.fillText(`${numero} / ${config.tema}`, 70, 1022);
    const lineas = [['¿QUIÉN'], ['DISEÑÓ', 'LOS'], ['TRENES?']];
    const momentos = momentosPortada(config.titulo, l.negra);
    const tam = Math.min(118, tamQueCabe(ctx, 'DISEÑÓ LOS', 860, 118));
    let indice = 0;
    lineas.forEach((palabras, fila) => {
      let x = 70;
      for (const palabra of palabras) {
        ctx.font = fuente(TITULAR, tam);
        const ancho = ctx.measureText(palabra).width;
        const ti = momentos[indice] ?? 0;
        if (tp >= ti) {
          const e = 1 + 0.22 * (1 - salidaExpo((tp - ti) / 0.2));
          const y = 1142 + fila * (tam + 6);
          ctx.save();
          ctx.translate(x + ancho / 2, y - tam * 0.36);
          ctx.scale(e, e);
          ctx.fillStyle = indice === 3 ? AMBAR : tema.texto;
          ctx.fillText(palabra, -ancho / 2, tam * 0.36);
          ctx.restore();
          if (tp - ti < 0.14) marco(ctx, x - 10, y - tam * 0.8, ancho + 20, tam * 0.92, BLANCO, 3, 10);
        }
        x += ancho + tam * 0.28;
        indice++;
      }
    });
    // El marco con dos destellos de la referencia, cuando el título está completo
    const fin = momentos[momentos.length - 1] + l.negra / 2;
    if (tp >= fin) {
      const e = salidaRebote(fase(tp, fin, fin + 0.25));
      marco(ctx, 150, 300, 780, 680, tema.tenue, 2);
      destello(ctx, 150, 300, 84 * e, tp * 0.6, BLANCO, 3);
      destello(ctx, 930, 980, 70 * e, -tp * 0.5, BLANCO, 8);
    }
  }

  /** Las 36 ciudades aparecen; "¿cómo las unirías?": salen trazos de Tokio y el mapa se inclina a 3D. */
  function escenaMapa(ctx: CanvasRenderingContext2D) {
    const tema = TEMAS.azul;
    const giro = entradaSalidaCubica(fase(t, l.unir, l.unir + l.negra * 2));
    const v = vistaDe(mezclarCamaras({...CENITAL, escala: 100 * empuje(l.mapa)}, OBLICUA, giro));
    ctx.fillStyle = tema.fondo;
    ctx.fillRect(0, 0, 1080, 1920);
    suelo(ctx, v, tema);
    agua(ctx, v, tema);
    const visibles = mCiudades.filter((m) => t >= m).length;
    // Trazos de Tokio a cada ciudad
    if (t >= l.unir) {
      const e = salidaExpo(fase(t, l.unir, l.unir + l.negra));
      const a = proyectar(nodos[0], v);
      ctx.strokeStyle = tema.linea;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 1; i < 36 && a; i++) {
        const p = nodos[i];
        const b = proyectar([nodos[0][0] + (p[0] - nodos[0][0]) * e, 0, nodos[0][2] + (p[2] - nodos[0][2]) * e], v);
        if (!b) continue;
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
      }
      ctx.stroke();
    }
    ciudades(ctx, v, tema, {
      asoma: (i) => (t >= mCiudades[i] ? salidaRebote(fase(t, mCiudades[i], mCiudades[i] + 0.14)) : 0),
      // Con el giro, los discos se levantan en cilindros (de Tokio hacia fuera)
      alto: (i) => altura(i) * salidaCubica(fase(t, l.unir + 0.04 * red.saltos[i] * 0.3, l.unir + 0.04 * red.saltos[i] * 0.3 + 0.45)),
    });
    // Marco que se cierra sobre cada ciudad al aparecer
    for (let i = 0; i < 36; i++) {
      const dt = t - mCiudades[i];
      if (dt < 0 || dt >= 0.17) continue;
      const q = proyectar(nodos[i], v);
      if (!q) continue;
      const lado = 78 - 46 * salidaExpo(dt / 0.17);
      marco(ctx, q[0] - lado / 2, q[1] - lado / 2, lado, lado, AMBAR, 3);
    }
    // Después, el marco salta de ciudad en ciudad hasta la pregunta
    if (visibles === 36 && t < l.unir) {
      const q = proyectar(nodos[1 + Math.floor(hash01(Math.floor(t / (l.negra / 4)), 3) * 35)], v);
      if (q) marco(ctx, q[0] - 24, q[1] - 24, 48, 48, AMBAR, 3, 8);
    }
    contador(ctx, tema, String(visibles).padStart(2, '0'), 'ciudades');
    cabecera(ctx, tema, numero, null);
  }

  /** Plancha blanca: caen los 36 copos de avena, uno en cada ciudad. */
  function escenaAvena(ctx: CanvasRenderingContext2D) {
    const tema = TEMAS.blanco;
    const v = vistaDe({
      ...OBLICUA,
      azimut: OBLICUA.azimut + giroAlPulso(t, pulso, {paso: 0.12, desde: l.avena, frenado: 0.45}),
      elevacion: 0.9,
      // Algo más lejos que en la poda: la ciudad del suroeste no pisa el rótulo del contador
      escala: OBLICUA.escala * 0.9 * empuje(l.avena),
    });
    ctx.fillStyle = tema.fondo;
    ctx.fillRect(0, 0, 1080, 1920);
    suelo(ctx, v, tema);
    agua(ctx, v, tema);
    const caida = 0.3;
    const extra = copos(v, (i) => {
      const dt = t - (mAvena[i] - caida);
      if (dt < 0) return null;
      return altura(i) + 0.03 + 1.9 * (1 - entradaCubica(Math.min(1, dt / caida)));
    });
    ciudades(ctx, v, tema, {extra});
    // Anillo al aterrizar cada copo
    let caidos = 0;
    for (let i = 0; i < 36; i++) {
      const dt = t - mAvena[i];
      if (dt >= 0) caidos++;
      if (dt < 0 || dt >= 0.16) continue;
      const q = proyectar([nodos[i][0], altura(i), nodos[i][2]], v);
      if (!q) continue;
      ctx.strokeStyle = AMBAR;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(q[0], q[1], 12 + 150 * dt, (12 + 150 * dt) * 0.62, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (t < l.caen) contador(ctx, tema, '2010', 'año del experimento');
    else contador(ctx, tema, String(caidos).padStart(2, '0'), 'copos de avena');
    cabecera(ctx, tema, numero, FUENTE, fase(t, l.avena, l.avena + 0.4));
  }

  /** Plancha negra, de cerca: el moho cae en Tokio. "Una sola célula". */
  function escenaMoho(ctx: CanvasRenderingContext2D) {
    const tema = TEMAS.negro;
    const tk = nodos[0];
    const cerca = salidaExpo(fase(t, l.celula, l.celula + 0.5));
    const v = vistaDe({
      objetivo: [tk[0], 0.42, tk[2]],
      distancia: 5.5,
      azimut: 0.5 + giroAlPulso(t, pulso, {paso: 0.09, desde: l.moho, frenado: 0.45}),
      elevacion: 0.55,
      escala: (290 + 120 * cerca) * empuje(l.moho),
      centro: [540, 860],
    });
    ctx.fillStyle = tema.fondo;
    ctx.fillRect(0, 0, 1080, 1920);
    suelo(ctx, v, tema);
    agua(ctx, v, tema);
    // El moho: una gota que cae, se aplasta y late con la música
    const llega = salidaRebote(fase(t, l.moho + 0.12, l.moho + 0.42));
    const R = 0.25 * Math.max(0.35, llega) * (1 + 0.07 * golpe(t, pulso, 1, 0.16));
    const cae = 1.3 * (1 - salidaExpo(fase(t, l.moho, l.moho + 0.22)));
    const centro: Vec3 = [tk[0], altura(0) + R * 0.45 + cae, tk[2]];
    const extra = [
      ...copos(v, (i) => (i === 0 ? null : altura(i) + 0.03)),
      ...carasDe(ESFERA, {escala: [R, R * 0.62, R], pos: centro}, v, {luz: '#FFFFFF', sombra: '#AEB6C9'}),
    ];
    ciudades(ctx, v, tema, {extra, tokio: false});
    const q = proyectar(centro, v);
    if (q && t >= l.celula) {
      // Visor: un marco que se cierra sobre la célula, con su destello y su ficha
      const lado = 300 * (1 + 0.7 * (1 - salidaExpo(fase(t, l.celula, l.celula + 0.3))));
      marco(ctx, q[0] - lado / 2, q[1] - lado / 2, lado, lado, AMBAR, 3, 14);
      destello(ctx, q[0] + lado / 2, q[1] - lado / 2, 64 * salidaRebote(fase(t, l.celula + 0.1, l.celula + 0.35)), t * 0.7, BLANCO, 5);
      etiqueta(ctx, 'Physarum polycephalum', 70, 1210, fase(t, l.celula, l.celula + 0.25), {tam: 30, fondo: BLANCO, color: NEGRO});
      etiqueta(ctx, 'una sola célula', 70, 1270, fase(t, l.celula + 0.15, l.celula + 0.4), {tam: 30, fondo: AMBAR, color: NEGRO});
    } else if (q) {
      ctx.font = fuente(MONO, 30, 700);
      ctx.fillStyle = tema.texto;
      ctx.textAlign = 'left';
      ctx.fillText('Tokio', q[0] + 90, q[1] + 60);
    }
    cabecera(ctx, tema, numero, FUENTE);
  }

  /** Tres carteles a pantalla completa: SIN CEREBRO / SIN PLANOS / SIN INGENIEROS, tachados. */
  function cartel(ctx: CanvasRenderingContext2D, i: number) {
    const tema = [TEMAS.azul, TEMAS.blanco, TEMAS.negro][i];
    const tc = t - l.sin[i];
    fondoRejilla(ctx, tema, {dx: i * 27, dy: i * 13});
    const palabra = CARTELES[i];
    const tam = tamQueCabe(ctx, palabra, 900, 190);
    ctx.font = fuente(TITULAR, tam);
    const ancho = ctx.measureText(palabra).width;
    const e = 1 + 0.14 * (1 - salidaExpo(tc / 0.22));
    ctx.save();
    ctx.translate(540, 880);
    ctx.scale(e, e);
    ctx.translate(-540, -880);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = tema.texto;
    ctx.font = fuente(TITULAR, 150);
    ctx.fillText('SIN', 70, 800);
    ctx.font = fuente(TITULAR, tam);
    const y = 800 + tam * 0.95;
    ctx.fillText(palabra, 70, y);
    marco(ctx, 54, y - tam * 0.86, ancho + 32, tam * 1.02, tema.tenue, 2, 12);
    // Tachado: una barra ámbar cruza la palabra justo después de entrar
    const tachado = salidaExpo((tc - 0.1) / 0.2);
    if (tc > 0.1) {
      ctx.fillStyle = AMBAR;
      ctx.fillRect(44, y - tam * 0.42, (ancho + 52) * tachado, tam * 0.13);
    }
    ctx.restore();
    ctx.fillStyle = tema.texto;
    ctx.font = fuente(MONO, 30, 700);
    ctx.fillText(`${i + 1}/3`, 70, 640);
    destello(ctx, 860, 620, 80 * salidaRebote(Math.min(1, tc / 0.25)) * (1 + 0.1 * golpe(t, pulso, 0.5, 0.1)), tc * 0.8 + i, tema.linea, 11 + i);
    cabecera(ctx, tema, numero, FUENTE);
  }

  /** Plancha azul: "primero lo cubrió todo". La malla crece desde Tokio y la cámara se aleja. */
  function escenaCubre(ctx: CanvasRenderingContext2D) {
    const tema = TEMAS.azul;
    const p = salidaCubica(fase(t, l.cubre, l.poda));
    const tk = nodos[0];
    const v = vistaDe(mezclarCamaras({...OBLICUA, objetivo: [tk[0], 0, tk[2]], escala: 210, azimut: 0.25}, {...OBLICUA, azimut: 0.05}, p));
    ctx.fillStyle = tema.fondo;
    ctx.fillRect(0, 0, 1080, 1920);
    suelo(ctx, v, tema);
    agua(ctx, v, tema);
    const saltos = Math.floor(red.maxSaltos * crecida(t, l));
    tubos(ctx, v, tema.linea, null, {hastaSaltos: saltos});
    ciudades(ctx, v, tema);
    contador(ctx, tema, String(sim.hasta[saltos]).padStart(4, '0'), 'tubos');
    etiqueta(ctx, 'esquema · ciudades aproximadas', 60, 290, fase(t, l.cubre, l.cubre + 0.3), {tam: 22, fondo: BLANCO, color: AZUL});
    cabecera(ctx, tema, numero, null);
  }

  /** Plancha blanca: el modelo de tubos poda la malla. Se congela un tiempo antes de la revelación. */
  function escenaPoda(ctx: CanvasRenderingContext2D) {
    const tema = TEMAS.blanco;
    const tt = Math.min(t, l.pausa);
    const v = vistaDe({
      ...OBLICUA,
      azimut: -0.35 + giroAlPulso(tt, pulso, {paso: 0.14, desde: l.poda, frenado: 0.45}),
      elevacion: 0.88,
      escala: OBLICUA.escala * empuje(l.poda, 0.1),
    });
    ctx.fillStyle = tema.fondo;
    ctx.fillRect(0, 0, 1080, 1920);
    suelo(ctx, v, tema);
    agua(ctx, v, tema);
    const paso = pasoPoda(t, l, historia.length - 1);
    // "Unos cuantos tubos gruesos": los que quedan dan un latido
    const latido = t >= l.gruesos ? 1 + 0.7 * (1 - salidaExpo(fase(tt, l.gruesos, l.gruesos + 0.35))) : 1;
    tubos(ctx, v, tema.linea, historia[paso], {refuerzo: latido});
    ciudades(ctx, v, tema);
    if (t >= l.gruesos) {
      const e = salidaRebote(fase(tt, l.gruesos, l.gruesos + 0.25));
      destello(ctx, 180, 470, 90 * e, tt * 0.6, AZUL, 21);
      destello(ctx, 900, 1120, 70 * e, -tt * 0.6, AZUL, 22);
    }
    contador(ctx, tema, String(sim.vivosEn[paso]).padStart(4, '0'), 'tubos');
    etiqueta(ctx, 'esquema · ciudades aproximadas', 60, 290, 1, {tam: 22, fondo: AZUL, color: BLANCO});
    cabecera(ctx, tema, numero, null);
  }

  /** La revelación: la red del moho enmarcada y, debajo, las cifras del artículo (moho frente a trenes). */
  function escenaCifras(ctx: CanvasRenderingContext2D) {
    const tema = TEMAS.azul;
    const v = vistaDe({
      objetivo: [0, 0, 0],
      distancia: 13,
      azimut: 0.2 + giroAlPulso(t, pulso, {paso: 0.07, desde: l.revelacion, frenado: 0.5}),
      elevacion: 0.98,
      escala: 70 * empuje(l.revelacion, 0.16),
      centro: [540, 670],
    });
    ctx.fillStyle = tema.fondo;
    ctx.fillRect(0, 0, 1080, 1920);
    suelo(ctx, v, tema);
    agua(ctx, v, tema);
    const rota = t >= l.rompe;
    tubos(ctx, v, tema.linea, final, {quitar: rota ? rotura.tubo : undefined});
    ciudades(ctx, v, tema);
    // Marco con dos destellos (la firma de la referencia)
    const e = salidaRebote(fase(t, l.revelacion, l.revelacion + 0.3));
    const late = 1 + 0.12 * golpe(t, pulso, 1, 0.14);
    marco(ctx, 100, 372, 840, 590, BLANCO, 3);
    destello(ctx, 100, 372, 88 * e * late, t * 0.5, BLANCO, 31);
    destello(ctx, 940, 962, 76 * e * late, -t * 0.5, BLANCO, 32);

    if (rota) {
      // La rotura: una cruz en el tubo, y las ciudades que se quedan aisladas parpadean en su marco
      const k = rotura.tubo;
      const a = nodos[red.a[k]];
      const b = nodos[red.b[k]];
      const q = proyectar([(a[0] + b[0]) / 2, 0, (a[2] + b[2]) / 2], v);
      if (q) {
        const s = 26 * salidaRebote(fase(t, l.rompe, l.rompe + 0.25));
        ctx.strokeStyle = AMBAR;
        ctx.lineWidth = 9;
        ctx.lineCap = 'butt';
        ctx.beginPath();
        ctx.moveTo(q[0] - s, q[1] - s);
        ctx.lineTo(q[0] + s, q[1] + s);
        ctx.moveTo(q[0] + s, q[1] - s);
        ctx.lineTo(q[0] - s, q[1] + s);
        ctx.stroke();
      }
      const parpadeo = Math.floor((t - l.rompe) / (l.negra / 2)) % 2 === 0;
      rotura.aisladas.forEach((i) => {
        const c = proyectar([nodos[i][0], altura(i), nodos[i][2]], v);
        if (c && (parpadeo || t > l.rompe + l.negra * 2)) marco(ctx, c[0] - 22, c[1] - 22, 44, 44, AMBAR, 3, 8);
      });
    }

    // Cifras: moho (blanco) frente a trenes (ámbar)
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = fuente(MONO, 28, 700);
    ctx.fillStyle = BLANCO;
    ctx.fillRect(400, 1022, 24, 24);
    ctx.fillText('moho', 436, 1045);
    ctx.fillStyle = AMBAR;
    ctx.fillRect(590, 1022, 24, 24);
    ctx.fillStyle = BLANCO;
    ctx.fillText('trenes', 626, 1045);
    const filas: [string, number, string, number, string, number][] = [
      ['costo', 1.75, '1,75', 1.8, '1,8', l.costo],
      ['eficiencia', 0.85, '0,85', 0.85, '0,85', l.eficiencia],
      ['si falla un tramo', 0.17, '14–20 % se aísla', 0.04, '4 %', l.rompe],
    ];
    filas.forEach(([nombre, vm, tm, vt, tt, cuando], i) => {
      if (t < cuando) return;
      const y = 1122 + i * 84;
      const p = salidaExpo(fase(t, cuando, cuando + 0.4));
      const escala = i === 0 ? 170 : i === 1 ? 340 : 1500;
      ctx.font = fuente(MONO, 28, 700);
      ctx.fillStyle = BLANCO;
      ctx.fillText(nombre, 70, y + 16);
      // Barras con canto (volumen plano, sin degradado)
      for (const [valor, color, canto, dy] of [[vm, BLANCO, '#9FB2E8', -18], [vt, AMBAR, '#8A5F00', 12]] as const) {
        const w = valor * escala * p;
        ctx.fillStyle = canto;
        ctx.beginPath();
        ctx.moveTo(400, y + dy + 22);
        ctx.lineTo(400 + w, y + dy + 22);
        ctx.lineTo(400 + w + 6, y + dy + 28);
        ctx.lineTo(406, y + dy + 28);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = color;
        ctx.fillRect(400, y + dy, w, 22);
      }
      ctx.font = fuente(MONO, 24, 700);
      ctx.fillStyle = BLANCO;
      ctx.fillText(tm, 414 + vm * escala * p, y);
      ctx.fillText(tt, 414 + vt * escala * p, y + 31);
      if (t - cuando < 0.16) marco(ctx, 56, y - 30, 880, 72, AMBAR, 3, 10);
    });
    etiqueta(ctx, 'medido en el artículo', 60, 322, fase(t, l.revelacion, l.revelacion + 0.3), {tam: 22, fondo: BLANCO, color: AZUL});
    cabecera(ctx, tema, numero, FUENTE, fase(t, l.revelacion, l.revelacion + 0.3));
  }

  /** Plancha negra, a ras de suelo: la poda otra vez, de cerca, con el flujo corriendo por los tubos. */
  function escenaTruco(ctx: CanvasRenderingContext2D) {
    const tema = TEMAS.negro;
    const p = fase(t, l.truco, l.decadas);
    const tk = nodos[0];
    const v = vistaDe({
      objetivo: [tk[0] - 0.8 + 1.4 * p, 0, tk[2] - 0.3 + 0.5 * p],
      distancia: 4.5,
      azimut: 0.9 - 0.5 * p + giroAlPulso(t, pulso, {paso: 0.05, desde: l.truco, frenado: 0.5}),
      elevacion: 0.44 + 0.1 * p,
      escala: 250 * empuje(l.truco, 0.1),
      centro: [540, 900],
    });
    ctx.fillStyle = tema.fondo;
    ctx.fillRect(0, 0, 1080, 1920);
    suelo(ctx, v, tema);
    agua(ctx, v, tema);
    const D = historia[pasoTruco(t, l, historia.length - 1)];
    const refuerzo = t >= l.engrosa ? 1 + 0.5 * (1 - salidaExpo(fase(t, l.engrosa, l.engrosa + 0.5))) : 1;
    tubos(ctx, v, tema.linea, D, {grosor: 1.25, refuerzo});
    // Flujo: puntos ámbar que corren por los tubos gruesos que sobreviven a la poda
    ctx.fillStyle = AMBAR;
    ctx.beginPath();
    for (let k = 0; k < red.a.length; k++) {
      if (D[k] < 0.5 || final[k] < UMBRAL) continue;
      const a = nodos[red.a[k]];
      const b = nodos[red.b[k]];
      const u = (t * 1.6 + hash01(k, 9)) % 1;
      const q = proyectar([a[0] + (b[0] - a[0]) * u, 0.01, a[2] + (b[2] - a[2]) * u], v);
      if (!q) continue;
      const r = Math.max(2.5, 0.035 * q[3]);
      ctx.moveTo(q[0] + r, q[1]);
      ctx.arc(q[0], q[1], r, 0, Math.PI * 2);
    }
    ctx.fill();
    ciudades(ctx, v, tema, {tokio: false});
    etiqueta(ctx, 'esquema · modelo de tubos del artículo', 60, 322, fase(t, l.truco, l.truco + 0.3), {tam: 22, fondo: BLANCO, color: NEGRO});
    etiqueta(ctx, 'mucho flujo: se engrosa', 70, 1210, fase(t, l.engrosa, l.engrosa + 0.25), {tam: 30, fondo: BLANCO, color: NEGRO});
    etiqueta(ctx, 'poco flujo: desaparece', 70, 1270, fase(t, l.desaparece, l.desaparece + 0.25), {tam: 30, fondo: '#3A3A42', color: BLANCO});
    cabecera(ctx, tema, numero, FUENTE);
  }

  /** Cartel blanco: "los ingenieros tardaron décadas". Una regla de marcas avanza despacio. */
  function escenaDecadas(ctx: CanvasRenderingContext2D) {
    const tema = TEMAS.blanco;
    const tc = t - l.decadas;
    fondoRejilla(ctx, tema);
    const tam = tamQueCabe(ctx, 'DÉCADAS', 900, 190);
    const e = (1 + 0.12 * (1 - salidaExpo(tc / 0.22))) * (1 + 0.012 * tc);
    ctx.save();
    ctx.translate(540, 900);
    ctx.scale(e, e);
    ctx.translate(-540, -900);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = tema.texto;
    ctx.font = fuente(MONO, 36, 700);
    ctx.fillText('los ingenieros', 74, 790);
    ctx.fillStyle = AZUL;
    ctx.font = fuente(TITULAR, tam);
    ctx.fillText('DÉCADAS', 70, 800 + tam * 0.95);
    // Regla: una marca por semicorchea; va lenta a propósito
    const y = 800 + tam * 0.95 + 90;
    const marcas = Math.min(28, Math.floor(tc / (l.negra / 4)));
    ctx.fillStyle = tema.texto;
    ctx.fillRect(70, y, 870, 3);
    for (let i = 0; i <= marcas; i++) ctx.fillRect(70 + i * 31, y - (i % 7 === 0 ? 34 : 18), 4, i % 7 === 0 ? 34 : 18);
    ctx.restore();
    destello(ctx, 870, 640, 76 * salidaRebote(Math.min(1, tc / 0.25)), tc * 0.5, AZUL, 41);
    cabecera(ctx, tema, numero, null);
  }

  /** "Poco más de un día": 26 HORAS en una tarjeta blanca sobre la plancha azul. */
  function escenaDia(ctx: CanvasRenderingContext2D) {
    const tema = TEMAS.azul;
    const tc = t - l.dia;
    fondoRejilla(ctx, tema, {dx: 27, dy: 27});
    const e = salidaExpo(tc / 0.3);
    const alto = 620 * e;
    ctx.fillStyle = BLANCO;
    ctx.fillRect(130, 880 - alto / 2, 820, alto);
    if (e > 0.6) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(130, 880 - alto / 2, 820, alto);
      ctx.clip();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = NEGRO;
      ctx.font = fuente(MONO, 34, 700);
      ctx.fillText('el moho', 186, 660);
      textoContorno(ctx, '26', 176, 930, 300, AZUL, 6);
      ctx.fillStyle = AZUL;
      ctx.font = fuente(TITULAR, 118);
      ctx.fillText('HORAS', 182, 1060);
      ctx.fillStyle = NEGRO;
      ctx.font = fuente(MONO, 26, 700);
      ctx.fillText('la red del moho, en el artículo', 186, 1130);
      ctx.restore();
    }
    const r = salidaRebote(fase(tc, 0.15, 0.4)) * (1 + 0.1 * golpe(t, pulso, 1, 0.14));
    destello(ctx, 130, 570, 90 * r, tc * 0.5, BLANCO, 51);
    destello(ctx, 950, 1190, 76 * r, -tc * 0.5, BLANCO, 52);
    cabecera(ctx, tema, numero, 'Scientific American (2010): la red a las 26 horas', fase(tc, 0, 0.3));
  }

  // ── Fotograma ───────────────────────────────────────────────────────────────────────────────

  const dibujar = (ctx: CanvasRenderingContext2D): Post | null => {
    if (enPortadaEn(t, l)) portada(ctx, t < l.mapa ? t : 0);
    else if (t < l.avena) escenaMapa(ctx);
    else if (t < l.moho) escenaAvena(ctx);
    else if (t < l.sin[0]) escenaMoho(ctx);
    else if (t < l.cubre) cartel(ctx, t < l.sin[1] ? 0 : t < l.sin[2] ? 1 : 2);
    else if (t < l.poda) escenaCubre(ctx);
    else if (t < l.revelacion) escenaPoda(ctx);
    else if (t < l.truco) escenaCifras(ctx);
    else if (t < l.decadas) escenaTruco(ctx);
    else if (t < l.dia) escenaDecadas(ctx);
    else escenaDia(ctx);

    if (t >= l.mapa && t < l.loop) subtituloEdicion(ctx, grupos, t);

    // Glitch: en cada corte, en el silencio antes de la revelación y en la rotura
    let post: Post | null = null;
    for (const c of listaCortes) post = glitchDeCorte(desde(c), f, c === l.revelacion ? 1.3 : 1) ?? post;
    if (desde(l.revelacion) === 0) post = {...post, invertir: true};
    if (t >= l.pausa && t < l.revelacion) {
      // El tiempo de silencio: la imagen congelada tartamudea, cada vez más rota
      const d = desde(l.pausa);
      const roto = d % 4 >= 2;
      post = {rgb: 3 + d * 1.1, pixel: roto ? 10 + d * 2 : 0, bandas: roto ? 0.45 : 0, semilla: f};
    }
    const dr = desde(l.rompe);
    if (dr >= 0 && dr < 5) post = {rgb: 26 * (1 - dr / 5), pixel: dr < 2 ? 26 : 0, bandas: 1 - dr / 5, semilla: f};
    const dd = desde(l.desaparece);
    if (dd >= 0 && dd < 2) post = {rgb: 12 - dd * 6, semilla: f};
    return post;
  };

  return <LienzoEdicion dibujar={dibujar} fondo={AZUL} />;
};

export default Sketch;
