// <LienzoEdicion>: el lienzo del estilo "edición" (color directo, SIN filtro riso). El sketch le pasa
// una función que dibuja el fotograma entero con Canvas 2D y, si quiere, devuelve un glitch (Post)
// que se aplica a los píxeles ya dibujados. Igual de determinista que <RisoFilter>: todo depende de
// useCurrentFrame().
import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {AbsoluteFill, continueRender, delayRender, useCurrentFrame, useVideoConfig} from 'remotion';
import {cargarFuentes} from '../fuentes';
import {aplicarPost, sinPost, type Post} from './glitch';

export type InfoEdicion = {frame: number; fps: number; t: number; ancho: number; alto: number};
export type DibujoEdicion = (ctx: CanvasRenderingContext2D, info: InfoEdicion) => Post | void | null;

export const LienzoEdicion: React.FC<{dibujar: DibujoEdicion; fondo?: string}> = ({dibujar, fondo = '#000'}) => {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);

  // Las fuentes deben estar cargadas antes de dibujar texto en el canvas
  const [espera] = useState(() => delayRender('Cargando fuentes del canal'));
  const [listas, setListas] = useState(false);
  useEffect(() => {
    cargarFuentes().then(() => setListas(true));
  }, []);
  useEffect(() => {
    if (listas) continueRender(espera);
  }, [listas, espera]);

  useLayoutEffect(() => {
    if (!listas || !ref.current) return;
    const ctx = ref.current.getContext('2d', {willReadFrequently: true}) as CanvasRenderingContext2D;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    const post = dibujar(ctx, {frame, fps, t: frame / fps, ancho: width, alto: height});
    ctx.restore();
    if (!sinPost(post)) {
      const imagen = ctx.getImageData(0, 0, width, height);
      aplicarPost(imagen.data, width, height, post as Post);
      ctx.putImageData(imagen, 0, 0);
    }
  });

  return (
    <AbsoluteFill style={{backgroundColor: fondo}}>
      <canvas ref={ref} width={width} height={height} style={{width: '100%', height: '100%'}} />
    </AbsoluteFill>
  );
};
