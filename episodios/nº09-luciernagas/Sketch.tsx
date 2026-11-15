// nº09 · ¿Quién las dirige? Luciérnagas que parpadean a la vez (Buck y Buck, 1968) y el modelo que
// lo explica (Mirollo y Strogatz, 1990).
//
// Escenas y momentos en linea.ts; el modelo en simulacion.ts. Estética riso, sin colores nuevos:
//   · La noche es un panel de tinta azul (tramada) sobre el papel, y la luz de cada luciérnaga es el
//     PAPEL que asoma: un punto limpio con dos anillos de trama alrededor (nada de degradados ni glow).
//   · El rosa (A) queda para la regla: la carga de los relojes y el empujón.
//   · El suelo es papel: ahí van el título de la portada, los subtítulos y las lecturas.
// Movimiento calmado: la cámara apenas gira (y vuelve a su sitio para el loop). Lo que se mueve es el
// tema: el parpadeo, a un destello cada dos tiempos. El primer y el último fotograma son un destello.
import React, {useMemo} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {
  cobertura,
  entradaSalidaCubica,
  fondoTinta,
  fuente,
  fuenteEnPantalla,
  lectura,
  MONO,
  mulberry32,
  ORDEN,
  proyectar,
  pulsoDe,
  recortarPapel,
  rotulo,
  sacudirRegistro,
  salidaCubica,
  trazarCirculoIrregular,
  trazarRectIrregular,
  useDibujo,
  type Camara,
  type Capas,
  type PropsSketch,
  type Vec3,
} from '@canal';
import {desdeDestello, desdeDestelloArbol, fase, linea, parpado, type Escena} from './linea';
import {fasesEn, gruposEn} from './simulacion';

const N = 120;
/**
 * Encuadre del árbol. `p` = 0 en la portada y en el último fotograma: el panel de noche acaba arriba
 * y deja sitio al título sobre el papel. `p` = 1 el resto del tiempo: el árbol baja y crece.
 */
const encuadre = (p: number) => ({
  /** Centro de la copa en pantalla. */
  cx: 540,
  cy: 500 + 110 * p,
  /** Borde inferior del panel de noche (debajo, el suelo de papel). */
  horizonte: 970 + 210 * p,
  /** px por unidad de la copa. */
  escala: 112 * (1 + 0.12 * p),
});
/** Cuánto dura la luz de un destello (constante de caída, s). */
const CAIDA = 0.26;
const brillo = (dt: number) => (dt < 0 ? 0 : Math.exp(-dt / CAIDA));

const Sketch: React.FC<PropsSketch> = ({tiempos, config}) => {
  const f = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const t = f / fps;
  const fin = (durationInFrames - 1) / fps;
  const pulso = useMemo(() => pulsoDe(config), [config]);
  const l = useMemo(() => linea(tiempos, fin, pulso, config.semilla), [tiempos, fin, pulso, config.semilla]);

  // Las luciérnagas: 120 puntos repartidos dentro de la copa (un elipsoide), fijos
  const copa = useMemo(() => {
    const azar = mulberry32(config.semilla + 5);
    const puntos: Vec3[] = [];
    while (puntos.length < N) {
      const p: Vec3 = [azar() * 2 - 1, azar() * 2 - 1, azar() * 2 - 1];
      if (p[0] ** 2 + p[1] ** 2 + p[2] ** 2 <= 1) puntos.push([p[0] * 3.3, p[1] * 2.7, p[2] * 3.3]);
    }
    return puntos;
  }, [config.semilla]);

  // ── El árbol de noche ───────────────────────────────────────────────────────────────────────

  /** El panel de noche con el árbol y sus luciérnagas. `luz(i)` = brillo 0…1 de cada una. */
  function arbol(c: Capas, luz: (i: number) => number, p: number) {
    const e = encuadre(p);
    const m = e.escala / 112;
    // La cámara gira muy poco y vuelve a su sitio al final (loop)
    const cam: Camara = {
      objetivo: [0, 0, 0],
      distancia: 18,
      azimut: 0.22 * Math.sin((2 * Math.PI * t) / Math.max(1, fin)),
      elevacion: 0.08,
      fov: 2 * Math.atan(540 / (e.escala * 18)),
      centro: [e.cx, e.cy],
      vista: 1080,
    };
    // Noche: tinta azul tramada hasta el horizonte; la copa y el tronco, en negro a medio tono
    fondoTinta(c, 'b', {trama: true, rect: {x: -24, y: -24, w: 1128, h: e.horizonte + 24}, semilla: 3});
    c.k.fillStyle = cobertura(0.34);
    trazarCirculoIrregular(c.k, e.cx, e.cy, 392 * m, 9, 24, 60);
    c.k.fill();
    c.k.fillStyle = cobertura(0.67);
    c.k.beginPath();
    c.k.moveTo(e.cx - 36 * m, e.cy + 350 * m);
    c.k.lineTo(e.cx + 36 * m, e.cy + 350 * m);
    c.k.lineTo(e.cx + 58 * m, e.horizonte + 50);
    c.k.lineTo(e.cx - 60 * m, e.horizonte + 50);
    c.k.closePath();
    c.k.fill();

    // Luciérnagas: por niveles de brillo (4), para recortar el papel de pocas veces
    type Punto = [number, number, number];
    const niveles: Punto[][] = [[], [], [], []];
    const apagadas: Punto[] = [];
    for (let i = 0; i < N; i++) {
      const q = proyectar(copa[i], cam);
      if (!q) continue;
      const b = luz(i);
      const escala = q[3] / 112;
      if (b < 0.1) apagadas.push([q[0], q[1], 3 * escala]);
      else niveles[Math.min(3, Math.floor(b * 4))].push([q[0], q[1], (4 + 6 * b) * escala]);
    }
    const k = c.solido.k;
    k.fillStyle = cobertura(1);
    k.beginPath();
    for (const [x, y, r] of apagadas) {
      k.moveTo(x + r, y);
      k.arc(x, y, r, 0, Math.PI * 2);
    }
    k.fill();
    niveles.forEach((puntos, nivel) => {
      if (!puntos.length) return;
      const q = (nivel + 1) / 4;
      // Dos anillos de trama (la luz se abre en escalones) y el punto de papel limpio
      for (const [factor, fuerza] of [[2.4, 0.34 * q], [1.6, 0.67 * q], [1, 1]] as const) {
        recortarPapel(c, (ctx) => {
          ctx.beginPath();
          for (const [x, y, r] of puntos) {
            ctx.moveTo(x + r * factor, y);
            ctx.arc(x, y, r * factor, 0, Math.PI * 2);
          }
        }, fuerza);
      }
    });
  }

  /** Los párpados de 1917: papel que se cierra sobre la noche, con el borde del ojo en negro. */
  function parpados(c: Capas, p: number) {
    const h = parpado(t, l);
    if (h >= 740) return;
    const {cy, horizonte} = encuadre(p);
    const ojo = (ctx: CanvasRenderingContext2D) => {
      ctx.moveTo(-10, cy);
      ctx.quadraticCurveTo(540, cy - 2 * h, 1090, cy);
      ctx.quadraticCurveTo(540, cy + 2 * h, -10, cy);
      ctx.closePath();
    };
    recortarPapel(c, (ctx) => {
      ctx.beginPath();
      ctx.rect(-40, -40, 1160, horizonte + 140);
      ojo(ctx);
    }, 1, 'evenodd');
    const k = c.solido.k;
    k.strokeStyle = cobertura(1);
    k.lineWidth = 7;
    k.lineJoin = 'round';
    k.beginPath();
    ojo(k);
    k.stroke();
  }

  // ── Los relojes (sobre papel) ───────────────────────────────────────────────────────────────

  const angulo = (fa: number) => -Math.PI / 2 + 2 * Math.PI * fa;

  /** Un reloj: se carga (sector rosa a medio tono), y al llegar arriba destella (rosa lleno). */
  function reloj(c: Capas, cx: number, cy: number, R: number, fa: number, luz: number, nombre: string, salto: {desde: number; hasta: number} | null) {
    const a = c.a;
    // Destello: todo el disco, con la tinta que le quede (se apaga por la trama)
    if (luz > 0.08) {
      a.fillStyle = cobertura(Math.min(1, 0.2 + 0.8 * luz));
      a.beginPath();
      a.arc(cx, cy, R * 0.97, 0, Math.PI * 2);
      a.fill();
    }
    // Carga: sector desde arriba hasta la aguja
    a.fillStyle = cobertura(0.34);
    a.beginPath();
    a.moveTo(cx, cy);
    a.arc(cx, cy, R * 0.97, -Math.PI / 2, angulo(fa));
    a.closePath();
    a.fill();
    const k = c.solido.k;
    k.strokeStyle = cobertura(1);
    k.fillStyle = cobertura(1);
    k.lineWidth = 5;
    trazarCirculoIrregular(k, cx, cy, R, 17);
    k.stroke();
    k.beginPath();
    for (let i = 0; i < 12; i++) {
      const ang = angulo(i / 12);
      const r0 = i === 0 ? R * 0.74 : R * 0.88;
      k.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
      k.lineTo(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R);
    }
    k.stroke();
    k.lineWidth = 8;
    k.lineCap = 'round';
    k.beginPath();
    k.moveTo(cx, cy);
    k.lineTo(cx + Math.cos(angulo(fa)) * R * 0.8, cy + Math.sin(angulo(fa)) * R * 0.8);
    k.stroke();
    k.beginPath();
    k.arc(cx, cy, 11, 0, Math.PI * 2);
    k.fill();
    // El empujón: el tramo que la aguja se salta al ver el destello de la otra, en rosa lleno
    if (salto) {
      const s = c.solido.a;
      s.strokeStyle = cobertura(1);
      s.lineWidth = 18;
      s.lineCap = 'butt';
      s.beginPath();
      s.arc(cx, cy, R + 24, angulo(salto.desde), angulo(salto.hasta));
      s.stroke();
    }
    k.font = fuente(MONO, 30, 700);
    k.textAlign = 'center';
    k.textBaseline = 'alphabetic';
    k.fillText(nombre, cx, cy + R + 84);
    k.textAlign = 'left';
  }

  function escenaRelojes(c: Capas) {
    const e = l.relojes;
    const ciclos = (t - e.inicio) / l.T;
    // Antes de que empiece la simulación, cada reloj corre libre desde su fase de partida
    const libre = (i: number) => {
      const x = e.fases0[i] + ciclos;
      return x - Math.floor(x);
    };
    const fases = ciclos < 0 ? [libre(0), libre(1)] : Array.from(fasesEn(e.fases0, ciclos, {eps: e.eps}));
    // El último destello de una sola (no las dos a la vez): la otra da un salto
    let salto: {quien: number; desde: number; hasta: number} | null = null;
    for (const d of e.historia.destellos) {
      if (d.t > ciclos) break;
      if (d.quienes.length !== 1 || (ciclos - d.t) * l.T > 0.45) continue;
      const otra = 1 - d.quienes[0];
      const antes = fasesEn(e.fases0, d.t - 1e-7, {eps: e.eps})[otra];
      const despues = fasesEn(e.fases0, d.t + 1e-7, {eps: e.eps})[otra];
      salto = {quien: otra, desde: antes, hasta: despues > antes ? despues : 1};
    }
    const dos = salidaCubica(fase(t, l.regla - 0.1, l.regla + 0.45));
    const xa = 540 - 240 * dos;
    reloj(c, xa, 720, 170, fases[0], brillo(desdeDestello(e, 0, t, l.T)), 'luciérnaga A', salto?.quien === 0 ? salto : null);
    if (t >= l.regla - 0.1) {
      reloj(c, 1080 - xa, 720, 170 * dos, fases[1], brillo(desdeDestello(e, 1, t, l.T)) * dos, 'luciérnaga B', salto?.quien === 1 ? salto : null);
      const desfase = Math.abs(fases[0] - fases[1]);
      const valor = Math.min(desfase, 1 - desfase);
      lectura(c.solido.k, 'desfase entre las dos', `${valor.toFixed(2).replace('.', ',')} de ciclo`, 70, 1340, {tam: 56});
    }
    rotulo(c, 'esquema · modelo de Mirollo y Strogatz', 90, 360, fase(t, l.truco, l.truco + 0.4), {tam: 26, tinta: 'b'});
    if (t >= l.siVe - 0.2) rotulo(c, 've un destello: adelanta su reloj', 90, 1150, fase(t, l.siVe - 0.2, l.siVe + 0.2), {tam: 30, tinta: 'a', semilla: 41});
  }

  // ── Los sensores (sobre papel) ──────────────────────────────────────────────────────────────

  function escenaSensores(c: Capas) {
    const e: Escena = l.nodos;
    const k = c.solido.k;
    const pos = (i: number): [number, number] => [540 + ((i % 4) - 1.5) * 190, 500 + Math.floor(i / 4) * 140];
    // Enlaces de radio entre vecinos, punteados
    k.strokeStyle = cobertura(1);
    k.lineWidth = 2.5;
    k.setLineDash([6, 10]);
    k.beginPath();
    for (let i = 0; i < e.n; i++) {
      const [x, y] = pos(i);
      if (i % 4 < 3) {
        k.moveTo(x + 44, y);
        k.lineTo(x + 146, y);
      }
      if (i + 4 < e.n) {
        k.moveTo(x, y + 44);
        k.lineTo(x, y + 96);
      }
    }
    k.stroke();
    k.setLineDash([]);
    for (let i = 0; i < e.n; i++) {
      const [x, y] = pos(i);
      const luz = brillo(desdeDestello(e, i, t, l.T));
      // El LED: rosa que se apaga por la trama
      if (luz > 0.2) {
        c.a.fillStyle = cobertura(Math.min(1, 0.1 + 0.9 * luz));
        c.a.beginPath();
        c.a.rect(x - 30, y - 30, 60, 60);
        c.a.fill();
      }
      k.lineWidth = 4;
      trazarRectIrregular(k, {x: x - 32, y: y - 32, w: 64, h: 64}, 60 + i, 1.5);
      k.stroke();
      // Antena
      k.beginPath();
      k.moveTo(x + 20, y - 32);
      k.lineTo(x + 20, y - 62);
      k.stroke();
      k.beginPath();
      k.arc(x + 20, y - 66, 5, 0, Math.PI * 2);
      k.fill();
    }
    fuenteEnPantalla(c, 'Werner-Allen y otros, SenSys (2005)', fase(t, l.sensores, l.sensores + 0.4));
    rotulo(c, 'esquema · red de sensores sin reloj central', 90, 360, fase(t, l.sensores, l.sensores + 0.4), {tam: 26, tinta: 'b'});
    if (t >= e.juntas) lectura(k, 'error medido en la red real', '0,0001 s', 70, 1340, {tam: 56});
  }

  // ── Fotograma ───────────────────────────────────────────────────────────────────────────────

  useDibujo(ORDEN.sketch, (c) => {
    const k = c.solido.k;
    if (t >= l.truco && t < l.sinJefe) escenaRelojes(c);
    else if (t >= l.sensores && t < l.bicho) escenaSensores(c);
    else if (t >= l.sinJefe && t < l.revelacion) {
      // El enjambre: arranca desordenado y se va juntando (la simulación de verdad)
      const e = l.enjambre;
      arbol(c, (i) => brillo(desdeDestello(e, i, t, l.T)), 1);
      const ciclos = (t - e.inicio) / l.T;
      lectura(k, 'destellos distintos por ciclo', String(ciclos < 1 ? e.n : gruposEn(e.historia, ciclos)), 70, 1340, {tam: 60});
      rotulo(c, 'esquema · relojes iguales que se ven todos', 90, 360, fase(t, l.sinJefe, l.sinJefe + 0.4), {tam: 26, tinta: 'b'});
      const sale = fase(t, l.demostraron - 0.1, l.demostraron + 0.3);
      rotulo(c, 'sin jefe', 600, 1030, fase(t, l.sinJefe, l.sinJefe + 0.3), {tam: 34, tinta: 'a', desde: 'derecha', salida: sale, semilla: 31});
      if (t >= l.sinMetronomo) rotulo(c, 'sin metrónomo', 600, 1102, fase(t, l.sinMetronomo, l.sinMetronomo + 0.3), {tam: 34, tinta: 'a', desde: 'derecha', salida: sale, semilla: 32});
      if (t >= l.demostraron) fuenteEnPantalla(c, 'Mirollo y Strogatz, SIAM J. Appl. Math. 50, 1645 (1990)', fase(t, l.demostraron, l.demostraron + 0.4));
    } else {
      // El árbol sincronizado: al principio, tras la revelación y en el cierre
      const luz = brillo(desdeDestelloArbol(t, l));
      // Tras la portada el árbol baja y crece (un solo movimiento lento); en el cierre vuelve a su sitio
      const p = t < l.truco ? entradaSalidaCubica(fase(t, l.mapa, l.mapa + 1.4)) : t >= l.bicho ? 1 - entradaSalidaCubica(fase(t, l.bicho + 0.4, fin - 0.7)) : 1;
      arbol(c, () => luz, p);
      parpados(c, p);
      if (t >= l.laurent && t < l.noEran + 0.6) fuenteEnPantalla(c, 'P. Laurent, Science 45, 44 (1917)', fase(t, l.laurent, l.laurent + 0.4));
      if (t >= l.tailandia && t < l.truco) {
        fuenteEnPantalla(c, 'Buck y Buck, Science 159, 1319 (1968)', fase(t, l.tailandia, l.tailandia + 0.4));
        rotulo(c, 'esquema · aquí parpadean más lento', 90, 360, fase(t, l.tailandia, l.tailandia + 0.4), {tam: 26, tinta: 'b'});
        rotulo(c, 'Pteroptyx malaccae · Tailandia', 90, 1110, fase(t, l.tailandia + 0.2, l.tailandia + 0.6), {tam: 30, tinta: 'b', semilla: 43});
        lectura(k, 'en el árbol real, un destello cada', '0,56 s', 70, 1340, {tam: 60});
      } else if (t >= l.mapa && t < l.laurent) {
        rotulo(c, 'esquema · un árbol de luciérnagas', 90, 360, fase(t, l.mapa, l.mapa + 0.4), {tam: 26, tinta: 'b'});
      }
      if (t >= l.revelacion && t < l.sensores) {
        lectura(k, 'destellos distintos por ciclo', '1', 70, 1340, {tam: 60});
        fuenteEnPantalla(c, 'Mirollo y Strogatz, SIAM J. Appl. Math. 50, 1645 (1990)', 1);
        rotulo(c, 'esquema · relojes iguales que se ven todos', 90, 360, 1, {tam: 26, tinta: 'b'});
      }
    }
    // El glitch riso, solo en la revelación
    sacudirRegistro(c, t, [l.revelacion], 9, 0.12);
  });

  return null;
};

export default Sketch;
