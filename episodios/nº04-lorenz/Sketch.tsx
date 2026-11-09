// nº04 · ¿Cuándo se separan? Dos puntos que empiezan a 0,001 de distancia en el sistema de Lorenz.
//
// Trayectorias integradas con RK4 (h = 0,01) en verificar.py → trayectorias.json. Escenas (linea.ts):
// portada (la mariposa) · la línea que son dos (y se rebobina) · esquema (ampliación, campo de flechas, dos pasos) ·
// las curvas que se separan, se reacercan y cruzan · el atractor completo · "una vuelta más" (= portada).
// Tintas: rosa → tinta A · azul → tinta B (donde se solapan sale el morado del multiply) · flechas → negro.
import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {
  cobertura,
  conCamara,
  empujes,
  entradaSalidaCubica,
  estallido,
  fondoTinta,
  fuente,
  golpe,
  hash01,
  lectura,
  marcoEsquinas,
  mira,
  MONO,
  ORDEN,
  pulsoDe,
  rotulo,
  sacudirRegistro,
  salidaCubica,
  tiempoDeAncla,
  tomaEn,
  useDibujo,
  type Capas,
  type Plano,
  type Toma,
  type PropsSketch,
} from '@canal';
import {DURACION_PORTADA} from '@canal/diseno';
import datos from './trayectorias.json';
import {fase, indiceEn, linea, momentosDe, type Linea, type Momentos} from './linea';

type P3 = number[];

function flecha(c: CanvasRenderingContext2D, x: number, y: number, dx: number, dy: number, grosor = 5) {
  const ang = Math.atan2(dy, dx);
  const l = Math.hypot(dx, dy);
  if (l < 1) return;
  c.save();
  c.translate(x, y);
  c.rotate(ang);
  c.lineWidth = grosor;
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(l, 0);
  c.stroke();
  c.beginPath();
  c.moveTo(l, 0);
  c.lineTo(l - 12, -7);
  c.lineTo(l - 12, 7);
  c.closePath();
  c.fill();
  c.restore();
}

// ── Encuadres ─────────────────────────────────────────────────────────────────────────────────

/** Vista de las curvas: escala (px por unidad), centro vertical y giro alrededor del eje z. */
type Vista = {escala: number; cy: number; ang: number};
const VISTA_CURVAS: Vista = {escala: 19, cy: 850, ang: 0};
/** La mariposa de la portada y del final: más pequeña y más arriba, por encima del título. */
const VISTA_PORTADA: Vista = {escala: 13, cy: 690, ang: 0};
/** El atractor completo al alejar la cámara (cabe con el giro de ±0,6 rad). */
const ESCALA_ATRACTOR = 14;

const proyectar = (p: P3, v: Vista): [number, number] => [
  500 + (p[0] * Math.cos(v.ang) + p[1] * Math.sin(v.ang)) * v.escala,
  v.cy - (p[2] - 25) * v.escala + (p[1] * Math.cos(v.ang) - p[0] * Math.sin(v.ang)) * Math.sin(v.ang) * 4,
];

function vistaEn(t: number, l: Linea): Vista {
  if (t < DURACION_PORTADA) return VISTA_PORTADA;
  const giro = (s: number) => (s >= l.abre ? 0.6 * Math.sin((s - l.abre) * 0.25) * fase(s, l.abre, l.abre + 2) : 0);
  // "Alejemos la cámara": de 19 a 14 px por unidad. Con el giro (±0,6 rad) la figura abre hasta
  // |x| ≈ 30: a 19 se salía por los dos lados (−68…1068 px); a 14 queda en 82…918, dentro de las zonas seguras.
  const lejos = (s: number) => VISTA_CURVAS.escala + (ESCALA_ATRACTOR - VISTA_CURVAS.escala) * salidaCubica(fase(s, l.abre, l.abre + 2));
  if (t < l.cierre) return {...VISTA_CURVAS, escala: lejos(t), ang: giro(t)};
  // "Una vuelta más": la cámara vuelve al encuadre de la portada
  const k = salidaCubica(fase(t, l.cierre, l.cierre + 0.8));
  const e0 = lejos(l.cierre);
  return {escala: e0 + (VISTA_PORTADA.escala - e0) * k, cy: 850 + (VISTA_PORTADA.cy - 850) * k, ang: giro(l.cierre) * (1 - k)};
}

/** Curvas y puntos. Con `completa`, desde el principio de la trayectoria; si no, una estela. */
function curvas(c: Parameters<Parameters<typeof useDibujo>[1]>[0], indice: number, v: Vista, completa: number, largo = 170) {
  for (const [curva, ctx] of [[datos.azul, c.solido.b], [datos.rosa, c.solido.a]] as const) {
    const estela = Math.max(0, indice - largo);
    const desde = Math.floor(estela * (1 - completa));
    ctx.strokeStyle = ctx.fillStyle = cobertura(1);
    ctx.lineWidth = completa > 0.5 ? 2.5 : 5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = desde; i <= indice; i++) {
      const [x, y] = proyectar(curva[i], v);
      if (i === desde) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    const [x, y] = proyectar(curva[indice], v);
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Flecha del campo de Lorenz en un punto, proyectada en x-z (dx = 10(y − x), dz = xy − 8z/3), en px.
 * La dirección es exacta; el largo crece con la rapidez pero comprimido (log), para que las flechas
 * lentas se vean (antes, a 4 px por unidad, la del inicio medía 7 px y no se veía).
 */
function flechaLorenz(p: P3): [number, number] {
  const vx = 10 * (p[1] - p[0]);
  const vz = p[0] * p[1] - (8 * p[2]) / 3;
  const v = Math.hypot(vx, vz) || 1;
  const largo = 70 + 45 * Math.log1p(v);
  return [(vx / v) * largo, -(vz / v) * largo];
}

// ── Campo de flechas (esquema) ────────────────────────────────────────────────────────────────

/** Corte del campo de Lorenz en el plano x-z con y = 1: dx = 10(1 − x), dz = x − 8z/3. */
const vector = (x: number, z: number): [number, number] => [10 * (1 - x), x - 8 * z / 3];
const aPantalla = (x: number, z: number): [number, number] => [500 + ((x - 1) / 0.45) * 106, 850 - ((z - 1) / 0.8) * 118];

/** Un punto que sigue las flechas (RK4 en el corte), desde arriba a la izquierda. Determinista. */
function recorrido(tiempo: number): [number, number][] {
  const pasos = Math.min(400, Math.floor(tiempo / 0.002));
  let x = -0.35;
  let z = 2.6;
  const out: [number, number][] = [[x, z]];
  const h = 0.002;
  for (let k = 0; k < pasos; k++) {
    const [a1, b1] = vector(x, z);
    const [a2, b2] = vector(x + (h / 2) * a1, z + (h / 2) * b1);
    const [a3, b3] = vector(x + (h / 2) * a2, z + (h / 2) * b2);
    const [a4, b4] = vector(x + h * a3, z + h * b3);
    x += (h / 6) * (a1 + 2 * a2 + 2 * a3 + a4);
    z += (h / 6) * (b1 + 2 * b2 + 2 * b3 + b4);
    out.push([x, z]);
  }
  return out;
}

// ── Cámara (prueba de dinamismo, 2026-11-08) ──────────────────────────────────────────────────
// En los reels de referencia la imagen no se queda quieta: aquí la cámara sigue a la línea, cambia
// de encuadre con la voz (cortes y viajes cortos), se acerca despacio dentro de cada plano y empuja
// en cada golpe (los mismos momentos suenan en sonido.ts).

/** Centro de la estela reciente de una o dos curvas en pantalla (suaviza el seguimiento). */
function centroEstela(i: number, v: Vista, curvas: P3[][], largo = 60): [number, number] {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const curva of curvas) {
    for (let k = Math.max(0, i - largo); k <= i; k += 3) {
      const [x, y] = proyectar(curva[k], v);
      sx += x;
      sy += y;
      n++;
    }
  }
  return [sx / n, sy / n];
}

/** Toma que acerca (x, y) y lo lleva una fracción `peso` del camino hacia el centro del encuadre. */
const encuadrar = (x: number, y: number, zoom: number, peso = 0.8): Partial<Toma> => ({
  zoom,
  px: x,
  py: y,
  dx: (540 - x) * peso,
  dy: (880 - y) * peso,
});

function planosDe(l: Linea, m: Momentos): Plano[] {
  const sigue = (curvas: P3[][], zoom: number, peso = 0.8, largo = 60) => (s: number) => {
    const [x, y] = centroEstela(indiceEn(s, l), vistaEn(s, l), curvas, largo);
    return encuadrar(x, y, zoom, peso);
  };
  const lobulo = (lado: number, zoom: number) => (s: number) => {
    const [x, y] = proyectar([lado * 8.5, lado * 8.5, 27], vistaEn(s, l));
    return encuadrar(x, y, zoom, 0.7);
  };
  const neutra = {zoom: 1};
  return [
    // La línea: la cámara la persigue; con la pregunta se aleja y, al separarse, se acerca a la punta
    {desde: DURACION_PORTADA, toma: sigue([datos.rosa], 1.55, 0.85, 90), deriva: 0.1},
    {desde: m.alcanzas, toma: neutra, entrada: 'suave', viaje: 0.8, deriva: 0.05},
    {desde: m.separan, toma: sigue([datos.rosa, datos.azul], 2.1, 0.9, 12), entrada: 'suave', viaje: 0.5, deriva: 0.1},
    // "Vamos al principio": la cámara persigue la punta mientras la línea se rebobina
    {desde: l.inicio, toma: sigue([datos.rosa], 1.5, 0.85, 40), deriva: 0.1},
    // El principio: el zoom va por dentro (escala de los puntos); la cámara se acerca y gira un poco
    {desde: l.rebobina, toma: neutra, deriva: 0.14, giro: 0.06},
    {desde: m.queImporta, toma: {zoom: 1.3, px: 500, py: 845}, entrada: 'suave', viaje: 0.6, deriva: 0.05},
    // El campo: entra cerca y se aleja mientras aparecen las flechas
    {desde: l.mapa, toma: {zoom: 1.4, px: 500, py: 850, giro: -0.05}, deriva: -0.26, giro: 0.08},
    // Las dos flechas: cerca cuando se juntan para compararlas
    {desde: l.dos, toma: {zoom: 1, px: 480, py: 850}, deriva: 0.12, giro: 0.04},
    {desde: m.casiApuntan, toma: {zoom: 1.45, px: 500, py: 720}, entrada: 'suave', viaje: 0.5, deriva: 0.05},
    {desde: m.comoPuntos, toma: {zoom: 1, px: 480, py: 850}, entrada: 'suave', viaje: 0.6, deriva: 0.14, giro: -0.04},
    {desde: m.cadaUno, toma: {zoom: 1.2, px: 480, py: 850, giro: 0.03}, deriva: 0.16, giro: -0.06},
    // Los pasos: un corte por paso (azul, rosa, las dos)
    {desde: m.avanzan, toma: {zoom: 1.25, px: 380, py: 830}, deriva: 0.1},
    {desde: m.cambia, toma: {zoom: 1.25, px: 600, py: 830}, deriva: 0.1},
    {desde: m.otraVez, toma: {zoom: 1, px: 480, py: 850}, deriva: 0.2, giro: 0.06},
    // Las curvas: la cámara va con los dos puntos; en la revelación, con la rosa y luego con la azul
    {desde: l.casi, toma: sigue([datos.rosa, datos.azul], 1.3, 0.75, 30), deriva: 0.1},
    {desde: m.rosaRev, toma: sigue([datos.rosa], 1.6, 0.8, 20), deriva: 0.08},
    {desde: m.azulTodavia, toma: sigue([datos.azul], 1.6, 0.8, 20), entrada: 'suave', viaje: 0.6, deriva: 0.08},
    // El atractor: planos de cada lóbulo y de los puntos, con la voz
    {desde: l.abre, toma: neutra, entrada: 'suave', viaje: 1, deriva: 0.04},
    {desde: m.reglas, toma: lobulo(-1, 1.7), deriva: 0.08},
    {desde: m.vuelta, toma: lobulo(1, 1.7), deriva: 0.08},
    {desde: m.loQueCambia, toma: neutra, entrada: 'suave', viaje: 0.7, deriva: 0.05},
    {desde: m.error, toma: sigue([datos.rosa, datos.azul], 2.2, 0.8, 0), entrada: 'suave', viaje: 0.6, deriva: 0.1},
    {desde: m.alPrincipio, toma: neutra, deriva: 0.16, giro: -0.08},
    {desde: m.varias, toma: sigue([datos.azul], 1.6, 0.75, 0), entrada: 'suave', viaje: 0.8, deriva: 0.06},
    {desde: m.lado, toma: neutra, entrada: 'suave', viaje: 0.7, deriva: 0},
    // "Una vuelta más": sin cámara, como la portada (loop)
    {desde: l.cierre, toma: neutra, deriva: 0},
  ];
}

/** "160 000", "0,0013": coma decimal y espacio de miles. */
function numero(v: number, decimales: number): string {
  const [ent, dec] = v.toFixed(decimales).split('.');
  const miles = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return dec ? `${miles},${dec}` : miles;
}

/** Partículas que se dejan llevar por el campo (esquema): nacen, avanzan unas décimas y se apagan. */
function particulasCampo(ctx: CanvasRenderingContext2D, tiempo: number) {
  const VIDA = 1.6;
  ctx.fillStyle = cobertura(1);
  for (let k = 0; k < 70; k++) {
    const desfase = hash01(k, 3) * VIDA;
    const edad = (tiempo + desfase) % VIDA;
    const ciclo = Math.floor((tiempo + desfase) / VIDA);
    let x = -0.35 + hash01(k, ciclo, 1) * 2.7;
    let z = -0.6 + hash01(k, ciclo, 2) * 3.2;
    const pasos = Math.floor(edad * 60);
    for (let j = 0; j < pasos; j++) {
      const [vx, vz] = vector(x, z);
      x += vx * 0.002;
      z += vz * 0.002;
    }
    const [px, py] = aPantalla(x, z);
    const r = 9 * Math.sin((Math.PI * edad) / VIDA);
    if (r < 1.5) continue;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** En el atractor completo, un tramo de cada curva recorre la figura (la vuelta que no para). */
function cometas(c: Capas, s: number, v: Vista) {
  const total = datos.fin;
  for (const [curva, ctx, desfase] of [[datos.rosa, c.solido.a, 0], [datos.azul, c.solido.b, 0.5]] as const) {
    const k = Math.floor((s * 150 + desfase * total) % total);
    const desde = Math.max(0, k - 70);
    ctx.strokeStyle = ctx.fillStyle = cobertura(1);
    ctx.lineWidth = 7;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = desde; i <= k; i++) {
      const [x, y] = proyectar(curva[i], v);
      if (i === desde) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    const [x, y] = proyectar(curva[k], v);
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Dos lecturas arriba (bajo la numeración, fuera de la zona segura): izquierda y derecha. */
function lecturas(c: Capas, e1: string, v1: string, e2: string, v2: string) {
  lectura(c.solido.k, e1, v1, 112, 345, {tam: 30});
  lectura(c.solido.k, e2, v2, 898, 345, {tam: 30, alinear: 'right'});
}

// ── Componente ────────────────────────────────────────────────────────────────────────────────

const Sketch: React.FC<PropsSketch> = ({tiempos, config}) => {
  const f = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const t = f / fps;
  const l = linea(tiempos, (durationInFrames - 1) / fps);
  const pulso = pulsoDe(config);
  const m = momentosDe(tiempos, l, pulso);

  useDibujo(ORDEN.sketch, (c) => {
    // Lo que no se mueve con la cámara (rótulos, lecturas, marco) se dibuja después, en pantalla
    const hud: (() => void)[] = [];
    const rotuloHud = (...args: Parameters<typeof rotulo>) => hud.push(() => rotulo(...args));
    const lecturasHud = (...args: [string, string, string, string]) => hud.push(() => lecturas(c, ...args));
    const enPortada = t < DURACION_PORTADA || t >= l.cierre;
    const toma = tomaEn(t, planosDe(l, m));
    const empuje = empujes(t, m.golpes, 0.07) * empujes(t, [m.rosaRev], 0.16, 0.3);
    const tomaFinal: Toma = {...toma, zoom: toma.zoom * empuje};

    // ¡Mira la rosa!: un tiempo de medio tono azul detrás de todo (el golpe de la revelación)
    if (t >= m.rosaRev && t < m.rosaRev + pulso.negra) fondoTinta(c, 'b', {trama: true, cobertura: 0.34});

    conCamara(c, tomaFinal, () => escena(c, rotuloHud, lecturasHud));

    if (!enPortada) {
      // Marco de visor: se cierra de nuevo en cada corte de escena
      const corte = Math.max(DURACION_PORTADA, ...m.cortes.filter((x) => x <= t));
      marcoEsquinas(c.solido.k, {x: 70, y: 255, w: 870, h: 1110}, fase(t, corte, corte + 0.45), {grosor: 4, largo: 40});
    }
    hud.forEach((f) => f());
    sacudirRegistro(c, t, [...m.cortes, m.rosaRev, m.casi, m.siquiera], 9, 0.1);
  });

  function escena(c: Capas, rotuloHud: (...args: Parameters<typeof rotulo>) => void, lecturasHud: (...args: [string, string, string, string]) => void) {
    const papel = c.solido.k;
    const esquema = t >= l.rebobina && t < l.casi;
    if (esquema) {
      // Zoom exponencial ("potencias de diez") de ×1 a ×160 000 entre "nos acercamos" y "entre los dos":
      // la retícula crece desde el centro sin parar y, al final, el punto se abre en dos.
      const decadas = 5.2 * entradaSalidaCubica(fase(t, m.acercamos, m.entreLosDos));
      const escala = 10 ** decadas;
      // El desplazamiento inicial es de 0,001 en x. Ampliamos ambas muestras con la misma escala.
      if (t < l.mapa) {
        // Retícula de cruces cada `paso` px; las de cada 10 son mayores. Al pasar de década, las
        // pequeñas se vuelven las mayores (mismo tamaño): el crecimiento no salta.
        const frac = decadas - Math.floor(decadas);
        const paso = 95 * 10 ** frac;
        papel.strokeStyle = cobertura(1);
        papel.lineWidth = 2.5;
        papel.beginPath();
        for (let i = -Math.ceil(430 / paso); i <= Math.ceil(430 / paso); i++) {
          for (let j = -Math.ceil(520 / paso); j <= Math.ceil(520 / paso); j++) {
            const mayor = i % 10 === 0 && j % 10 === 0;
            const tam = mayor ? 10 + 8 * frac : 3 + 7 * frac;
            const x = 500 + i * paso;
            const y = 845 + j * paso;
            if (x < 90 || x > 920 || y < 300 || y > 1340) continue;
            papel.moveTo(x - tam, y);
            papel.lineTo(x + tam, y);
            papel.moveTo(x, y - tam);
            papel.lineTo(x, y + tam);
          }
        }
        papel.stroke();
        const separacion = 0.5 * 0.001 * escala;
        for (const [j, ctx] of [c.solido.b, c.solido.a].entries()) {
          const x = 500 + (j ? -separacion : separacion);
          ctx.fillStyle = ctx.strokeStyle = cobertura(1);
          ctx.beginPath();
          ctx.arc(x, 845, 15, 0, Math.PI * 2);
          ctx.fill();
          if (separacion > 40) mira(ctx, x, 845, 44, fase(t, m.entreLosDos - 0.3, m.entreLosDos + 0.2), t * 0.9 * (j ? -1 : 1));
        }
        mira(papel, 500, 845, 70, fase(t, m.solo, m.solo + 0.4) * (1 - fase(t, m.diminuto, m.diminuto + 0.2)), t * 0.6);
        marcoEsquinas(papel, {x: 500 - separacion - 70, y: 845 - 70, w: 2 * separacion + 140, h: 140}, fase(t, m.queImporta, m.queImporta + 0.5), {grosor: 4, largo: 26, desde: 60});
        rotuloHud(c, 'inicio / diferencia: 0.001', 95, 470, 1, {tinta: 'a', tam: 31});
        lecturasHud('zoom', 'x' + numero(escala, 0), 'en pantalla', numero(2 * separacion, 1) + ' px');
        return;
      }
      papel.strokeStyle = papel.fillStyle = cobertura(1);
      if (t < l.dos) {
        // Las flechas entran columna a columna, una por semicorchea
        for (let i = -3; i <= 3; i++) {
          const q = salidaCubica(fase(t, l.mapa + (i + 3) * (pulso.negra / 4), l.mapa + (i + 3) * (pulso.negra / 4) + 0.25));
          if (q <= 0) continue;
          for (let j = -2; j <= 2; j++) {
            const [dx, dz] = vector(1 + i * 0.45, 1 + j * 0.8);
            const late = 1 + 0.12 * golpe(t, pulso, 1, 0.18); // las flechas laten con cada tiempo
            flecha(papel, 500 + i * 106, 850 - j * 118, dx * 4 * q * late, -dz * 4 * q * late);
          }
        }
        // Partículas en azul que corren con el campo (entran cuando ya están las flechas)
        if (t > l.mapa + 2 * pulso.negra) particulasCampo(c.solido.b, t - l.mapa);
        // Un punto rosa que se deja llevar por las flechas: va rápido donde son largas y frena donde son cortas
        const arranque = l.mapa + 7 * (pulso.negra / 4) + 0.3;
        if (t > arranque) {
          const r = recorrido((t - arranque) * 0.12);
          const a = c.solido.a;
          a.strokeStyle = a.fillStyle = cobertura(1);
          a.lineWidth = 4;
          a.setLineDash([8, 10]);
          a.beginPath();
          r.forEach(([x, z], k) => {
            const [px, py] = aPantalla(x, z);
            if (k) a.lineTo(px, py);
            else a.moveTo(px, py);
          });
          a.stroke();
          a.setLineDash([]);
          const [px, py] = aPantalla(...r[r.length - 1]);
          a.beginPath();
          a.arc(px, py, 14, 0, Math.PI * 2);
          a.fill();
        }
        rotuloHud(c, 'esquema · campo en un corte x-z', 90, 465, 1, {tam: 32, tinta: 'b'});
        return;
      }
      const marcas = [l.pasos, tiempoAncla(tiempos, 'cambia la flecha', l.pasos + 1), tiempoAncla(tiempos, 'avanzan otra vez', l.pasos + 2)];
      const paso = t < marcas[1] ? 0 : t < marcas[2] ? 1 : 2;
      const u = t < l.pasos ? 0 : paso + fase(t, marcas[paso], Math.min(marcas[paso] + 0.5, marcas[paso + 1] ?? l.casi));
      // "Casi apuntan al mismo sitio": las flechas se juntan en el centro para compararlas; vuelven en "como los puntos…"
      const tJuntas = tiempoAncla(tiempos, 'casi apuntan', l.dos + 1.5);
      const tSeparan = tiempoAncla(tiempos, 'como los puntos', tJuntas + 3.7);
      const juntas = t < l.pasos ? salidaCubica(fase(t, tJuntas, tJuntas + 0.5)) * (1 - salidaCubica(fase(t, tSeparan, tSeparan + 0.5))) : 0;
      const entra = t < l.pasos ? salidaCubica(fase(t, l.dos + 0.2, l.dos + 0.6)) : 1;
      for (const [j, ctx] of [c.solido.b, c.solido.a].entries()) {
        const xx = j ? 1 : 1.001;
        const idx = Math.min(50, Math.round(u * 4));
        const curva = j ? datos.rosa : datos.azul;
        const pt = curva[idx];
        // Dos ampliaciones contiguas conservan la misma escala y el mismo eje vertical.
        const x = 260 + 440 * j + (pt[0] - xx) * 25;
        const y = 850 - (pt[2] - 1) * 25;
        ctx.fillStyle = ctx.strokeStyle = cobertura(1);
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.fill();
        mira(ctx, x, y, 36, fase(t, m.flechas, m.flechas + 0.4) * (1 - juntas), t * 0.8 * (j ? 1 : -1));
        const [dx, dz] = flechaLorenz(pt);
        const ox = x + (500 - x) * juntas;
        const oy = y + (700 - y) * juntas;
        flecha(ctx, ox, oy, dx * entra, dz * entra, 6);
        ctx.font = fuente(MONO, 27, 700);
        ctx.fillText(j ? 'ROSA' : 'AZUL', 210 + 470 * j, 1030);
      }
      if (juntas > 0.5) {
        // La diferencia de verdad, medida con las dos flechas del inicio
        const [ax, az] = flechaLorenz(datos.azul[0]);
        const [bx, bz] = flechaLorenz(datos.rosa[0]);
        const grados = (Math.abs(Math.atan2(az, ax) - Math.atan2(bz, bx)) * 180) / Math.PI;
        rotuloHud(c, `ángulo entre las dos: ${grados.toFixed(2).replace('.', ',')}°`, 270, 1290, salidaCubica(fase(t, tJuntas + 0.3, tJuntas + 0.7)), {tam: 30, tinta: 'b'});
      }
      rotuloHud(c, t < l.pasos ? 'misma escala / dos inicios' : 'movimiento / paso ' + (paso + 1), 90, 465, 1, {tam: 32, tinta: 'a'});
      return;
    }

    const indice = indiceEn(t, l);
    const v = vistaEn(t, l);
    // La figura completa: en la portada, al alejar la cámara y en el final
    const completa = t < DURACION_PORTADA || t >= l.cierre ? 1 : t >= l.abre ? fase(t, l.abre, l.abre + 2) : 0;
    // En la escena de la línea, estela larga: que se lea como una línea que recorre la figura
    curvas(c, indice, v, completa, t < l.rebobina ? 450 : 170);
    if (t >= l.abre + 2 && t < l.cierre) cometas(c, t - l.abre - 2, v);
    const [rx, ry] = proyectar(datos.rosa[indice], v);
    const [ax, ay] = proyectar(datos.azul[indice], v);
    // La revelación: estallido y mira sobre la rosa; luego, mira sobre la azul
    if (t >= m.rosaRev && t < l.abre) {
      estallido(c.solido.a, rx, ry, 150, fase(t, m.rosaRev, m.rosaRev + 0.55), {rayos: 14, semilla: 4});
      mira(c.solido.a, rx, ry, 40, fase(t, m.rosaRev, m.rosaRev + 0.4), t);
    }
    if (t >= m.azulTodavia && t < l.abre) mira(c.solido.b, ax, ay, 40, fase(t, m.azulTodavia, m.azulTodavia + 0.4), -t);
    if (t >= m.error && t < m.alPrincipio) {
      mira(c.solido.a, rx, ry, 30, fase(t, m.error, m.error + 0.4), t);
      mira(c.solido.b, ax, ay, 30, fase(t, m.error + 0.15, m.error + 0.55), -t);
    }
    // Lecturas que no paran: el tiempo de la simulación y la distancia entre los dos puntos
    if (t >= DURACION_PORTADA && t < l.abre) {
      const d = Math.hypot(...[0, 1, 2].map((k) => datos.rosa[indice][k] - datos.azul[indice][k]));
      lecturasHud('tiempo', 't ' + numero(indice * 0.01, 2), 'distancia', numero(d, d < 0.01 ? 4 : 2));
    }
    if (t >= l.casi && t < l.abre) {
      // La distancia entre los dos puntos, como una línea punteada
      const a = proyectar(datos.rosa[indice], v);
      const b = proyectar(datos.azul[indice], v);
      papel.strokeStyle = cobertura(1);
      papel.lineWidth = 2;
      papel.setLineDash([6, 9]);
      papel.beginPath();
      papel.moveTo(a[0], a[1]);
      papel.lineTo(b[0], b[1]);
      papel.stroke();
      papel.setLineDash([]);
    }
    if (t >= l.abre && t < l.cierre) rotuloHud(c, 'atractor de Lorenz', 90, 420, 1, {tam: 32, tinta: 'b'});
  }
  return null;
};

/** tiempoDeAncla con valor por defecto (para las marcas de la escena de pasos). */
function tiempoAncla(tiempos: PropsSketch['tiempos'], ancla: string, defecto: number): number {
  return tiempoDeAncla(tiempos, ancla) ?? defecto;
}

export default Sketch;
