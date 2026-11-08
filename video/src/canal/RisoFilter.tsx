// <RisoFilter>: post-proceso riso de todo el fotograma, por CPU (tramado.ts).
//
//  1. Cada fotograma limpia las seis capas (a, b, k tramadas + sus sólidas) y llama a las funciones registradas con useDibujo().
//  2. Lee los píxeles de las capas y tramado.ts:
//     - toma la cobertura de cada tinta (alfa × (1 − luminancia)),
//     - la trama con Bayer 4×4 a 4 niveles, con punto de 3 px,
//     - desplaza cada tinta (desajuste de registro con temblor leve y determinista),
//     - escala el dibujo con el golpe de compás (al leer las capas: el punto sigue midiendo 3 px),
//     - combina las tintas en multiply sobre el papel,
//     - añade grano de papel al 4 %.
//
// Antes era un shader WebGL; dentro de Docker la GPU es emulada en un solo proceso compartido y el
// render no pasaba de ~3,5 fotogramas/s con ningún número de hilos. Por CPU, cada pestaña filtra por
// su cuenta (ver remotion.config.ts: sin GPU).
import React, {useLayoutEffect, useRef, useState, useEffect} from 'react';
import {AbsoluteFill, continueRender, delayRender, useCurrentFrame, useVideoConfig} from 'remotion';
import {ContextoRiso, todasLasCapas, type Capas, type Registro} from './capas';
import {cargarFuentes} from './fuentes';
import {NEGRO, PAPEL, type Tintas} from './paleta';
import {DURACION_PORTADA} from './diseno';
import {mulberry32, ruido1d} from './prng';
import {golpe, type Pulso} from './pulso';
import {tramar} from './tramado';

/**
 * Desajuste de registro de una tinta en el fotograma: base fija por semilla (≈1,6–2,4 px), un
 * temblor de ±0.8 px y un `empuje` (px) que late con la música ("golpe riso", como el tambor de la
 * impresora en cada vuelta). Entre A y B quedan 2–6 px.
 *
 * `reloj` decide cuándo cambia el temblor. Con pulso es el número de compás (entero): el temblor
 * cambia solo en el primer tiempo de cada compás, junto al golpe. Antes era un ruido continuo por
 * fotograma: al redondear a píxeles, cada tinta saltaba 1 px a destiempo cada pocos fotogramas, y
 * con líneas finas (nº04) todo el dibujo parpadeaba ("tiembla mucho", lo notó el usuario).
 */
function desajuste(semilla: number, tinta: number, reloj: number, base: number, empuje = 0): [number, number] {
  const azar = mulberry32(semilla * 31 + tinta * 7919);
  const angulo = azar() * Math.PI * 2 + tinta * Math.PI; // A y B tienden a ir en sentidos opuestos
  const radio = base + azar() * 0.8 + empuje;
  const tx = (ruido1d(reloj, semilla + tinta * 101) - 0.5) * 1.6;
  const ty = (ruido1d(reloj, semilla + tinta * 211 + 5) - 0.5) * 1.6;
  return [Math.cos(angulo) * radio + tx, Math.sin(angulo) * radio + ty];
}

export type PropsRisoFilter = {
  tintas: Tintas;
  semilla: number;
  /** Tamaño del punto de trama en px (3–4 a 1080×1920). */
  punto?: number;
  /** Opacidad del grano de papel (0.03–0.05). */
  grano?: number;
  /** Pulso musical: el registro late en cada tiempo y el fotograma da un leve empujón en cada compás. */
  pulso?: Pulso | null;
  children?: React.ReactNode;
};

const EMPUJE_REGISTRO = 0.9; // px extra por tinta en cada tiempo
const EMPUJE_ESCALA = 0.01; // escala extra en el primer tiempo de cada compás

export const RisoFilter: React.FC<PropsRisoFilter> = ({tintas, semilla, punto = 3, grano = 0.04, pulso, children}) => {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const salidaRef = useRef<ImageData | null>(null);
  const [registro] = useState<Registro>(() => new Map());
  const [capas] = useState<Capas>(() => {
    const crear = () => {
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      // willReadFrequently: el canvas vive en memoria normal y leer sus píxeles es barato
      return c.getContext('2d', {willReadFrequently: true}) as CanvasRenderingContext2D;
    };
    return {a: crear(), b: crear(), k: crear(), solido: {a: crear(), b: crear(), k: crear()}};
  });

  // Las fuentes deben estar cargadas antes de dibujar texto en los canvas
  const [esperaFuentes] = useState(() => delayRender('Cargando fuentes del canal'));
  const [fuentesListas, setFuentesListas] = useState(false);
  useEffect(() => {
    cargarFuentes().then(() => setFuentesListas(true));
  }, []);
  useEffect(() => {
    if (fuentesListas) continueRender(esperaFuentes);
  }, [fuentesListas, esperaFuentes]);

  // Golpe riso: late en cada tiempo de la música (no durante la portada: la miniatura sale limpia)
  const t = frame / fps;
  const conGolpe = Boolean(pulso?.golpeVisual) && t >= DURACION_PORTADA;
  // golpeVisual 'compas': solo el golpe de compás, sin el salto de registro de cada tiempo (para
  // episodios de líneas finas, donde ese salto separa y junta los colores en cada tiempo)
  const latido = conGolpe && pulso && pulso.golpeVisual === true ? golpe(t, pulso, 1, 0.12) : 0;
  // Temblor: cambia en cada compás (sin pulso, cada ~0,23 s como antes)
  const reloj = pulso ? Math.floor(t / pulso.compas + 1e-9) : frame / 7;
  // La escala se aplica dentro de tramar() (al leer las capas), no con CSS sobre el canvas ya tramado:
  // Chrome lo remuestreaba, suavizaba la trama y sacaba colores fuera de la paleta. Cuando el golpe
  // ya se apagó (< 1 %, menos de 0,1 px en el borde) se deja en 1 exacto.
  const golpeCompas = conGolpe && pulso ? golpe(t, pulso, 4, 0.15) : 0;
  // En escalones de 0,25 %: cada cambio de escala mueve las líneas finas un píxel, así que menos
  // cambios (4 por compás en vez de ~15) es menos parpadeo, con el mismo empujón.
  const escala = golpeCompas >= 0.01 ? 1 + Math.round((EMPUJE_ESCALA * golpeCompas) / 0.0025) * 0.0025 : 1;

  // Se ejecuta en cada render, después de que los hijos registraron su dibujo
  useLayoutEffect(() => {
    if (!fuentesListas || !canvasRef.current) return;
    const destino = canvasRef.current.getContext('2d') as CanvasRenderingContext2D;
    if (!salidaRef.current) salidaRef.current = destino.createImageData(width, height);

    // 1. Dibujar las capas
    const info = {frame, fps, t: frame / fps, ancho: width, alto: height};
    const lista = todasLasCapas(capas);
    for (const ctx of lista) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, width, height);
    }
    const entradas = [...registro.values()].sort((x, y) => x.orden - y.orden);
    for (const {fn} of entradas) {
      lista.forEach((ctx) => ctx.save());
      fn(capas, info);
      lista.forEach((ctx) => ctx.restore());
    }

    // 2. Tramado riso por CPU
    const leer = (ctx: CanvasRenderingContext2D) => ctx.getImageData(0, 0, width, height).data;
    const empuje = EMPUJE_REGISTRO * latido;
    tramar({
      ancho: width,
      alto: height,
      tramadas: [leer(capas.a), leer(capas.b), leer(capas.k)],
      solidas: [leer(capas.solido.a), leer(capas.solido.b), leer(capas.solido.k)],
      desajustes: [desajuste(semilla, 1, reloj, 1.6, empuje), desajuste(semilla, 2, reloj, 1.6, empuje), [0, 0]], // el negro es la referencia
      colores: {a: tintas.a, b: tintas.b, k: NEGRO, papel: PAPEL},
      punto,
      grano,
      escala,
      salida: salidaRef.current.data,
    });
    destino.putImageData(salidaRef.current, 0, 0);
  });

  return (
    <ContextoRiso.Provider value={registro}>
      <AbsoluteFill style={{backgroundColor: PAPEL}}>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{width: '100%', height: '100%'}}
        />
      </AbsoluteFill>
      {children}
    </ContextoRiso.Provider>
  );
};
