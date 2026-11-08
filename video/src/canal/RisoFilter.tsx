// <RisoFilter>: post-proceso riso de todo el fotograma, por CPU (tramado.ts).
//
//  1. Cada fotograma limpia las seis capas (a, b, k tramadas + sus sólidas) y llama a las funciones registradas con useDibujo().
//  2. Lee los píxeles de las capas y tramado.ts:
//     - toma la cobertura de cada tinta (alfa × (1 − luminancia)),
//     - la trama con Bayer 4×4 a 4 niveles, con punto de 3 px,
//     - desplaza cada tinta (desajuste de registro fijo por semilla + el golpe de cada tiempo),
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
 * Desajuste de registro de una tinta: FIJO por semilla (≈1,6–3 px, A y B en sentidos opuestos; entre
 * ellas quedan 2–6 px) más un `empuje` (px) que late con la música ("golpe riso", como el tambor de
 * la impresora en cada vuelta).
 *
 * En video el registro no tiembla. Lo intentamos dos veces y las dos se veía mal:
 *  · temblor continuo por fotograma: al redondear a píxeles, cada tinta saltaba 1 px a destiempo y
 *    con líneas finas (nº04) todo parpadeaba ("tiembla mucho");
 *  · temblor que cambiaba en cada compás, junto a un empujón de escala del 1 %: cada ~2,6 s todo el
 *    dibujo daba un salto, "como si se volviera a generar" (los dos los notó el usuario).
 */
function desajuste(semilla: number, tinta: number, base: number, empuje = 0): [number, number] {
  const azar = mulberry32(semilla * 31 + tinta * 7919);
  const angulo = azar() * Math.PI * 2 + tinta * Math.PI; // A y B tienden a ir en sentidos opuestos
  const radio = base + azar() * 0.8 + empuje;
  const tx = (ruido1d(0, semilla + tinta * 101) - 0.5) * 1.6;
  const ty = (ruido1d(0, semilla + tinta * 211 + 5) - 0.5) * 1.6;
  return [Math.cos(angulo) * radio + tx, Math.sin(angulo) * radio + ty];
}

export type PropsRisoFilter = {
  tintas: Tintas;
  semilla: number;
  /** Tamaño del punto de trama en px (3–4 a 1080×1920). */
  punto?: number;
  /** Opacidad del grano de papel (0.03–0.05). */
  grano?: number;
  /** Pulso musical: el registro late en cada tiempo (golpe riso). */
  pulso?: Pulso | null;
  children?: React.ReactNode;
};

const EMPUJE_REGISTRO = 0.9; // px extra por tinta en cada tiempo

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
  const latido = conGolpe && pulso ? golpe(t, pulso, 1, 0.12) : 0;
  // Sin empujón de escala por compás: cada ~2,6 s todo el dibujo daba un salto (ver desajuste()).
  // tramar() conserva el parámetro `escala` por si un sketch necesita escalar el fotograma entero.
  const escala = 1;

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
      desajustes: [desajuste(semilla, 1, 1.6, empuje), desajuste(semilla, 2, 1.6, empuje), [0, 0]], // el negro es la referencia
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
