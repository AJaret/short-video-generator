// nº11 · ¿Quién pinta las rayas? El pez ángel y la receta de Turing (1952), vista en un animal por
// Kondo y Asai (1995).
//
// Escenas y momentos en linea.ts; las simulaciones de reacción-difusión en simulacion.ts. Con nº09 y
// nº10 como estándar, en riso y con movimiento calmado:
//   · El pez en 3D (tres.ts): cuerpo y aletas con volumen tramado en azul, y las rayas pintadas SOBRE
//     el volumen en papel, como el juvenil real (azul oscuro con rayas claras). Crece y le salen
//     rayas nuevas entre las viejas.
//   · La receta, sobre papel: el activador (rosa) y el inhibidor (azul) a lo largo de una franja de piel,
//     y la piel que se raya debajo. Luego tres cuadros: manchas, laberinto y rayas.
//   · Revelación: plancha azul a sangre con el pez en papel y las rayas de la simulación reacomodándose.
// El primer y el último fotograma son el mismo (loop): el pez juvenil de la portada.
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
  lectura,
  MONO,
  ORDEN,
  proyectar,
  pulsoDe,
  recortarPapel,
  rotulo,
  sacudirRegistro,
  salidaCubica,
  TITULAR,
  trazarEstrella,
  trazarRectIrregular,
  useDibujo,
  type Camara,
  type Capas,
  type Material,
  type PropsSketch,
  type Vec3,
} from '@canal';
import {fase, linea, rayasReales, tamanoPez, type Linea} from './linea';
import {parche2D, piel1D, RECETAS, type Piel} from './simulacion';

const ESFERA = esfera(24, 36);
/** Cuerpo: elipsoide alto y aplastado (semiejes en tamaño 1). */
const CUERPO: Vec3 = [1.8, 1.7, 0.45];
/** Aletas (planas): dorsal, anal y cola. */
type Aleta = {escala: Vec3; pos: Vec3; cola?: boolean};
const ALETAS: Aleta[] = [
  {escala: [1.55, 1.05, 0.06], pos: [-0.75, 1.35, 0]},
  {escala: [1.45, 1.0, 0.06], pos: [-0.75, -1.35, 0]},
  {escala: [0.6, 1.05, 0.06], pos: [-2.15, 0, 0], cola: true},
];
/** Largo para situar las rayas: de la punta de la cola (−2,75) al morro (+1,8). */
const COLA = -2.75;
const MORRO = 1.8;
/** Posición a lo largo del cuerpo (0 = cola, 1 = morro) → x del pez (tamaño 1). */
const xDe = (s: number) => COLA + s * (MORRO - COLA);

// ── Cámara ────────────────────────────────────────────────────────────────────────────────────

type Toma = {distancia: number; azimut: number; elevacion: number; escala: number; centro: [number, number]};
const aCamara = (c: Toma): Camara => ({
  objetivo: [0, 0, 0],
  distancia: c.distancia,
  azimut: c.azimut,
  elevacion: c.elevacion,
  fov: 2 * Math.atan(540 / (c.escala * c.distancia)),
  centro: c.centro,
  vista: 1080,
});

const Sketch: React.FC<PropsSketch> = ({tiempos, config}) => {
  const f = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const t = f / fps;
  const fin = (durationInFrames - 1) / fps;
  const pulso = useMemo(() => pulsoDe(config), [config]);
  const l = useMemo(() => linea(tiempos, fin, pulso), [tiempos, fin, pulso]);

  // Simulaciones (una vez): la franja que crece y los dos cuadros de piel
  const sim = useMemo(() => {
    const piel: Piel = piel1D(config.semilla);
    let previo = 0;
    while (previo < piel.t.length - 1 && piel.t[previo] < 120) previo++;
    return {
      piel,
      previo,
      manchas: parche2D(config.semilla, RECETAS.manchas),
      laberinto: parche2D(config.semilla + 1, RECETAS.laberinto),
    };
  }, [config.semilla]);

  /** Valor de un perfil 1D en `s` (0…1), interpolado. */
  const en = (perfil: Float32Array, s: number) => {
    const x = Math.max(0, Math.min(1, s)) * (perfil.length - 1);
    const i = Math.min(perfil.length - 2, Math.floor(x));
    return perfil[i] * (1 - (x - i)) + perfil[i + 1] * (x - i);
  };

  // ── El pez ──────────────────────────────────────────────────────────────────────────────────

  /** Movimiento del pez: la cola y un leve giro, en ciclos enteros a lo largo del video (loop exacto). */
  const colaEn = (tt: number) => 0.28 * Math.sin((2 * Math.PI * 16 * tt) / l.fin);
  const giroEn = (tt: number) => 0.32 * Math.sin((2 * Math.PI * 2 * tt) / l.fin);

  /** Banda de raya [s0, s1] sobre la cara visible del cuerpo: un polígono que sigue su curva. */
  function bandaCuerpo(ctx: CanvasRenderingContext2D, cam: Camara, tam: number, s0: number, s1: number) {
    const [a, b, c] = CUERPO;
    const borde = (s: number, sube: boolean): [number, number][] => {
      const pts: [number, number][] = [];
      for (let k = 0; k <= 26; k++) {
        const v = sube ? k / 26 : 1 - k / 26;
        const y = (v * 2 - 1) * b * 0.999;
        // Rayas algo curvas: se arquean hacia la cola arriba y abajo
        const x = Math.max(-a, Math.min(a, xDe(s) - 0.22 * (y / b) ** 2));
        const r = 1 - (x / a) ** 2 - (y / b) ** 2;
        if (r < 0) continue;
        const q = proyectar([x * tam, y * tam, c * Math.sqrt(r) * tam], cam);
        if (q) pts.push([q[0], q[1]]);
      }
      return pts;
    };
    const pts = [...borde(s0, true), ...borde(s1, false)];
    if (pts.length < 3) return;
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (const [x, y] of pts.slice(1)) ctx.lineTo(x, y);
    ctx.closePath();
  }

  /** Punto de una aleta (u, v en el círculo unidad), con la cola girada. */
  function aletaPunto(aleta: Aleta, cola: number, u: number, v: number): Vec3 {
    let x = u * aleta.escala[0];
    const y = v * aleta.escala[1];
    let z = 0;
    if (aleta.cola) {
      const px = x + aleta.escala[0];
      [x, z] = [px * Math.cos(cola) - aleta.escala[0], -px * Math.sin(cola)];
    }
    return [x + aleta.pos[0], y + aleta.pos[1], z + aleta.pos[2]];
  }

  /** Banda [s0, s1] sobre una aleta plana: la franja vertical recortada por el contorno de la aleta. */
  function bandaAleta(ctx: CanvasRenderingContext2D, cam: Camara, tam: number, aleta: Aleta, cola: number, s0: number, s1: number) {
    const contorno: [number, number][] = [];
    for (let k = 0; k < 40; k++) {
      const ang = (k / 40) * Math.PI * 2;
      const p = aletaPunto(aleta, cola, Math.cos(ang), Math.sin(ang));
      const q = proyectar([p[0] * tam, p[1] * tam, p[2] * tam], cam);
      if (q) contorno.push([q[0], q[1]]);
    }
    if (contorno.length < 3) return;
    ctx.save();
    ctx.beginPath();
    contorno.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.clip();
    // La misma curva que en el cuerpo, prolongada por la aleta
    const b = CUERPO[1];
    const lado = (sx: number, sube: boolean): [number, number][] => {
      const pts: [number, number][] = [];
      for (let k = 0; k <= 30; k++) {
        const v = sube ? k / 30 : 1 - k / 30;
        const y = (v * 2 - 1) * 2.6;
        const q = proyectar([(xDe(sx) - 0.22 * (y / b) ** 2) * tam, y * tam, aleta.pos[2] * tam], cam);
        if (q) pts.push([q[0], q[1]]);
      }
      return pts;
    };
    const pts = [...lado(s0, true), ...lado(s1, false)];
    ctx.beginPath();
    pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /**
   * Dibuja el pez y sus rayas. `bandas` = intervalos [s0, s1] a lo largo del cuerpo. `papel` = true en
   * la revelación (cuerpo en papel y rayas azules, sobre la plancha).
   */
  function dibujarPez(c: Capas, tam: number, toma: Toma, bandas: [number, number][], papel = false) {
    const cam = aCamara({...toma, azimut: toma.azimut + giroEn(t)});
    const cola = colaEn(t);
    const mat: Material = papel ? {tinta: 'k', tonos: [0.02, 0.2]} : {tinta: 'b', sombra: 'k', tonos: [0.5, 1]};
    const luz: Vec3 = [-0.5, 0.6, 0.6];
    /** Pinta una raya: azul sobre el pez de papel, o clara (papel con un velo azul) sobre el azul. */
    const raya = (dibujar: (ctx: CanvasRenderingContext2D) => void) => {
      if (papel) {
        c.solido.b.fillStyle = cobertura(1);
        dibujar(c.solido.b);
        return;
      }
      for (const ctx of [c.a, c.b, c.k, c.solido.a, c.solido.b, c.solido.k]) {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = '#000';
        dibujar(ctx);
        ctx.restore();
      }
      c.b.fillStyle = cobertura(0.18);
      dibujar(c.b);
    };
    // 1. Aletas (detrás del cuerpo) y sus rayas
    dibujar3D(
      c,
      ALETAS.map((a) => ({
        malla: ESFERA,
        tr: {
          escala: [a.escala[0] * tam, a.escala[1] * tam, a.escala[2] * tam] as Vec3,
          rot: [0, a.cola ? cola : 0, 0] as Vec3,
          pos: (a.cola ? aletaPunto(a, cola, 0, 0) : a.pos).map((x) => x * tam) as Vec3,
        },
        material: mat,
      })),
      cam,
      {ambiente: 0.3, luz},
    );
    for (const a of ALETAS) for (const [s0, s1] of bandas) raya((ctx) => bandaAleta(ctx, cam, tam, a, cola, s0, s1));
    // 2. El cuerpo (tapa lo que de las aletas queda detrás) y sus rayas
    dibujar3D(c, [{malla: ESFERA, tr: {escala: CUERPO.map((x) => x * tam) as Vec3}, material: mat}], cam, {ambiente: 0.3, luz});
    raya((ctx) => {
      ctx.beginPath();
      for (const [s0, s1] of bandas) bandaCuerpo(ctx, cam, tam, s0, s1);
      ctx.fill();
    });
    // 3. El ojo
    const ojo = proyectar([1.25 * tam, 0.45 * tam, 0.33 * tam], cam);
    if (ojo) {
      const k = c.solido.k;
      k.fillStyle = cobertura(1);
      k.beginPath();
      k.arc(ojo[0], ojo[1], 0.13 * tam * ojo[3], 0, Math.PI * 2);
      k.fill();
    }
    return cam;
  }

  /** Rayas del pez real (3 → 6 → 12): bandas más finas cuanto más crece. */
  const rayasDe = (tt: number): [number, number][] => {
    const ancho = 0.05 / tamanoPez(tt, l);
    return rayasReales(tt, l).map((r) => {
      const centro = 0.14 + 0.72 * r.pos;
      return [centro - ancho * r.grosor, centro + ancho * r.grosor] as [number, number];
    });
  };

  /** Rayas de la simulación (la franja que crece) en la instantánea `k`: donde el activador es alto. */
  const rayasSim = (k: number): [number, number][] => {
    const u = sim.piel.u[k];
    const bandas: [number, number][] = [];
    let desde = -1;
    for (let i = 0; i <= 300; i++) {
      const s = i / 300;
      const dentro = i < 300 && en(u, s) > 0.62;
      if (dentro && desde < 0) desde = s;
      if (!dentro && desde >= 0) {
        bandas.push([0.14 + 0.72 * desde, 0.14 + 0.72 * s]);
        desde = -1;
      }
    }
    return bandas;
  };

  /** Retícula de cruces en una pared del fondo (se mueve con el giro de la cámara). */
  function reticula(c: Capas, cam: Camara) {
    const b = c.solido.b;
    b.strokeStyle = cobertura(1);
    b.lineWidth = 2.5;
    b.beginPath();
    for (let i = -8; i <= 8; i++) for (let j = -9; j <= 9; j++) {
      const q = proyectar([i * 1.2, j * 1.2, -4], cam);
      if (!q) continue;
      b.moveTo(q[0] - 7, q[1]);
      b.lineTo(q[0] + 7, q[1]);
      b.moveTo(q[0], q[1] - 7);
      b.lineTo(q[0], q[1] + 7);
    }
    b.stroke();
  }

  const PORTADA: Toma = {distancia: 18, azimut: 0, elevacion: 0.05, escala: 118, centro: [540, 560]};

  // ── Escenas ─────────────────────────────────────────────────────────────────────────────────

  function escenaPez(c: Capas) {
    // Tras la portada el pez baja al centro; en el cierre vuelve a su sitio
    const p = t < l.turing ? entradaSalidaCubica(fase(t, l.mapa, l.mapa + 1.4)) : 1 - entradaSalidaCubica(fase(t, l.remate + 0.3, l.fin - 0.6));
    const tam = t < l.turing ? tamanoPez(t, l) : 1;
    const toma: Toma = {...PORTADA, escala: (PORTADA.escala * (1 + 0.1 * p)) / tam ** 0.7, centro: [540, 560 + 180 * p]};
    reticula(c, aCamara(toma));
    dibujarPez(c, tam, toma, rayasDe(t < l.turing ? t : 0));
    const k = c.solido.k;
    if (t >= l.mapa && t < l.turing) {
      rotulo(c, 'esquema · pez ángel juvenil', 90, 360, fase(t, l.mapa, l.mapa + 0.4), {tam: 26, tinta: 'b'});
      // La edad y las rayas, como en las fotos del pez real
      const etapas: [number, string, string][] = [[l.joven, '2 meses', '3'], [l.seis, '6 meses', '6'], [l.doce, '12 meses', '12']];
      let actual = etapas[0];
      for (const e of etapas) if (t >= e[0]) actual = e;
      if (t >= l.joven) lectura(k, `${actual[1]} · rayas`, actual[2], 70, 1340, {tam: 60});
      if (t >= l.tres) fuenteEnPantalla(c, 'Painter y otros, PNAS 96, 5549 (1999)', fase(t, l.tres, l.tres + 0.4));
    }
  }

  /** La ficha del artículo de Turing (1952), y en 1954 su fecha de muerte. */
  function escenaFicha(c: Capas, conMuerte: boolean) {
    const k = c.solido.k;
    const desde = conMuerte ? l.murio : l.turing;
    const hasta = conMuerte ? l.revelacion : l.dos;
    const e = salidaCubica(fase(t, desde, desde + 0.5));
    // Detrás, muy suave, la piel formándose sola con la receta (manchas en 1952, laberinto en 1954)
    const fotos = conMuerte ? sim.laberinto : sim.manchas;
    const kf = Math.min(fotos.length - 1, Math.round(fase(t, desde, hasta) * (fotos.length - 1)));
    const fondo = conMuerte ? c.b : c.a;
    fondo.save();
    fondo.globalAlpha = 0.34;
    campo(fondo, fotos[kf], 96, -60, 160, 1200, 1200);
    fondo.restore();
    // La ficha deriva despacio hacia arriba
    const y = 560 + 60 * (1 - e) - 40 * fase(t, desde, hasta);
    recortarPapel(c, (ctx) => trazarRectIrregular(ctx, {x: 110, y, w: 860, h: 560}, 13, 3));
    c.k.fillStyle = cobertura(0.12);
    trazarRectIrregular(c.k, {x: 110, y, w: 860, h: 560}, 13, 3);
    c.k.fill();
    k.lineWidth = 4;
    k.strokeStyle = cobertura(1);
    trazarRectIrregular(k, {x: 110, y, w: 860, h: 560}, 14, 3);
    k.stroke();
    k.fillStyle = cobertura(1);
    k.textAlign = 'left';
    k.textBaseline = 'alphabetic';
    k.font = fuente(MONO, 34, 700);
    k.fillText('The chemical basis', 160, y + 90);
    k.fillText('of morphogenesis', 160, y + 136);
    k.font = fuente(MONO, 26, 400);
    k.fillText('A. M. Turing · Phil. Trans. R. Soc. B 237', 160, y + 190);
    const b = c.solido.b;
    b.fillStyle = cobertura(1);
    b.font = fuente(TITULAR, 200);
    b.fillText('1952', 150, y + 420);
    if (conMuerte) {
      const a = c.solido.a;
      a.fillStyle = cobertura(1);
      a.font = fuente(TITULAR, 100);
      a.fillText('— 1954', 470, y + 515);
      rotulo(c, 'sin verlo en un animal', 90, 1290, fase(t, l.murio + 1.2, l.murio + 1.6), {tam: 30, tinta: 'a', semilla: 47});
    } else {
      fuenteEnPantalla(c, 'Turing, Phil. Trans. R. Soc. B 237, 37 (1952)', fase(t, l.turing, l.turing + 0.4));
    }
  }

  /** La receta: activador e inhibidor a lo largo de la piel, que se raya debajo. */
  function escenaReceta(c: Capas) {
    const k0 = Math.round(sim.previo * entradaSalidaCubica(fase(t, l.dos + 0.3, l.recetas - 0.3)));
    const u = sim.piel.u[k0];
    const v = sim.piel.v[k0];
    const x0 = 90;
    const x1 = 990;
    const curva = (ctx: CanvasRenderingContext2D, datos: Float32Array, base: number, alto: number) => {
      ctx.beginPath();
      for (let i = 0; i <= 200; i++) {
        const s = i / 200;
        const y = base - en(datos, s) * alto;
        if (i) ctx.lineTo(x0 + s * (x1 - x0), y);
        else ctx.moveTo(x0 + s * (x1 - x0), y);
      }
      ctx.stroke();
    };
    const a = c.solido.a;
    const b = c.solido.b;
    a.lineWidth = 7;
    a.strokeStyle = cobertura(1);
    a.lineJoin = 'round';
    b.lineWidth = 5;
    b.strokeStyle = cobertura(1);
    b.lineJoin = 'round';
    curva(a, u, 860, 300);
    curva(b, v, 860, 300);
    const k = c.solido.k;
    k.lineWidth = 3;
    k.strokeStyle = cobertura(1);
    k.beginPath();
    k.moveTo(x0, 862);
    k.lineTo(x1, 862);
    k.stroke();
    // La piel: el activador hace la raya (rosa tramado)
    for (let i = 0; i < 180; i++) {
      const s = i / 180;
      const val = en(u, s);
      if (val < 0.25) continue;
      c.a.fillStyle = cobertura(Math.min(1, (val - 0.2) * 1.3));
      c.a.fillRect(x0 + s * (x1 - x0), 920, (x1 - x0) / 180 + 1, 200);
    }
    k.strokeRect(x0, 920, x1 - x0, 200);
    k.font = fuente(MONO, 24, 700);
    k.textAlign = 'left';
    k.fillText('la piel', x0, 1155);
    rotulo(c, 'esquema · reacción-difusión', 90, 360, fase(t, l.dos, l.dos + 0.4), {tam: 26, tinta: 'b'});
    if (t >= l.activa - 0.2) rotulo(c, 'activador: se activa a sí mismo', 90, 450, fase(t, l.activa - 0.2, l.activa + 0.2), {tam: 28, tinta: 'a', semilla: 41});
    if (t >= l.frena - 0.2) rotulo(c, 'inhibidor: lo frena', 90, 515, fase(t, l.frena - 0.2, l.frena + 0.2), {tam: 28, tinta: 'b', semilla: 42});
    if (t >= l.corre - 0.2) rotulo(c, 'y se esparce 22 veces más rápido', 90, 580, fase(t, l.corre - 0.2, l.corre + 0.2), {tam: 28, tinta: 'b', semilla: 43});
  }

  /** Un campo 2D (0…1) dibujado en una capa tramada, escalado al rectángulo. */
  function campo(ctx: CanvasRenderingContext2D, datos: Float32Array, lado: number, x: number, y: number, w: number, h: number) {
    const lienzo = document.createElement('canvas');
    lienzo.width = lado;
    lienzo.height = lado;
    const c2 = lienzo.getContext('2d') as CanvasRenderingContext2D;
    const img = c2.createImageData(lado, lado);
    for (let i = 0; i < datos.length; i++) {
      img.data[i * 4 + 3] = Math.round(255 * Math.min(1, Math.max(0, (datos[i] - 0.2) * 1.6)));
    }
    c2.putImageData(img, 0, 0);
    ctx.drawImage(lienzo, x, y, w, h);
  }

  /** Manchas, laberinto y rayas: tres cuadros de piel que se forman solos. */
  function escenaRecetas(c: Capas) {
    const k = c.solido.k;
    const cuadros: [number, number, number, number, 'a' | 'b' | 'k', string, number, Float32Array[] | null][] = [
      [90, 470, 420, 420, 'a', 'manchas', l.manchas, sim.manchas],
      [570, 470, 420, 420, 'b', 'laberinto', l.laberintos, sim.laberinto],
      [90, 970, 900, 300, 'k', 'rayas', l.rayas, null],
    ];
    for (const [x, y, w, h, tinta, nombre, desde, fotos] of cuadros) {
      if (t < desde - 0.3) continue;
      const p = fase(t, desde - 0.3, desde + 1.6);
      if (fotos) {
        const kf = Math.min(fotos.length - 1, Math.round(p * (fotos.length - 1)));
        campo(c[tinta], fotos[kf], 96, x, y, w, h);
      } else {
        // Rayas: la franja que crece, estirada en vertical
        const kf = sim.previo + Math.round(p * (sim.piel.u.length - 1 - sim.previo));
        const u = sim.piel.u[kf];
        for (let i = 0; i < 300; i++) {
          const val = en(u, i / 300);
          if (val < 0.55) continue;
          c.k.fillStyle = cobertura(0.85);
          c.k.fillRect(x + (i / 300) * w, y, w / 300 + 1, h);
        }
      }
      k.lineWidth = 4;
      k.strokeStyle = cobertura(1);
      trazarRectIrregular(k, {x, y, w, h}, 17 + x, 2);
      k.stroke();
      k.font = fuente(MONO, 28, 700);
      k.fillStyle = cobertura(1);
      k.textAlign = 'left';
      k.fillText(nombre, x, y + h + 40);
    }
    rotulo(c, 'esquema · la misma receta, otras cantidades', 90, 360, fase(t, l.recetas, l.recetas + 0.4), {tam: 26, tinta: 'b'});
  }

  /** La revelación: plancha azul, el pez en papel y sus rayas reacomodándose (la simulación). */
  function revelacion(c: Capas) {
    const tr = t - l.revelacion;
    fondoTinta(c, 'b');
    const p = fase(t, l.revelacion + 0.3, l.remate - 0.2);
    const kf = sim.previo + Math.round(entradaSalidaCubica(p) * (sim.piel.u.length - 1 - sim.previo));
    const tam = 1.05 + 0.75 * p;
    const toma: Toma = {...PORTADA, escala: 118 / tam ** 0.7, centro: [560, 760]};
    dibujarPez(c, tam, toma, rayasSim(kf), true);
    const e = salidaCubica(fase(tr, 0, 0.35));
    enNegativo(c, (ctx) => {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.font = fuente(MONO, 30, 700);
      ctx.fillText('días siguiendo al mismo pez', 80, 1215);
      ctx.font = fuente(TITULAR, 150);
      ctx.fillText(String(Math.round(90 * fase(t, l.revelacion + 0.3, l.remate - 0.4))), 74, 1370);
    });
    if (e > 0) {
      enNegativo(c, (ctx) => {
        trazarEstrella(ctx, 900, 470, 100 * e, 8, 5, 0.2, 0.22);
        ctx.fill();
      });
    }
    fuenteEnPantalla(c, 'Kondo y Asai, Nature 376, 765 (1995)', 1);
    rotulo(c, 'esquema · rayas de la simulación', 90, 360, fase(tr, 0, 0.4), {tam: 26, tinta: 'a', semilla: 49});
  }

  useDibujo(ORDEN.sketch, (c) => {
    if (t >= l.turing && t < l.dos) escenaFicha(c, false);
    else if (t >= l.dos && t < l.recetas) escenaReceta(c);
    else if (t >= l.recetas && t < l.murio) escenaRecetas(c);
    else if (t >= l.murio && t < l.revelacion) escenaFicha(c, true);
    else if (t >= l.revelacion && t < l.remate) revelacion(c);
    else escenaPez(c);
    sacudirRegistro(c, t, [l.revelacion], 9, 0.12);
  });

  return null;
};

export default Sketch;
