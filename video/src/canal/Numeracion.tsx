// <Numeracion>: "nº XX" pequeño arriba a la izquierda, tras la portada.
import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {cobertura, ORDEN, recortarPapel, useDibujo} from './capas';
import {trazarRectIrregular} from './dibujo';
import {UTIL} from './diseno';
import {fuente, MONO} from './fuentes';

export const numeroConFormato = (n: number) => `nº ${String(n).padStart(2, '0')}`;

export type PropsNumeracion = {numero: number; /** Segundo en que aparece. */ desde: number};

export const Numeracion: React.FC<PropsNumeracion> = ({numero, desde}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  useDibujo(ORDEN.numeracion, (capas, info) => {
    if (frame < desde * fps) return;
    const k = capas.solido.k;
    const texto = numeroConFormato(numero);
    k.font = fuente(MONO, 30, 700);
    const ancho = k.measureText(texto).width;
    const x = UTIL.x;
    const y = UTIL.y + 24;
    recortarPapel(capas, (ctx) =>
      trazarRectIrregular(ctx, {x: x - 12, y: y - 8, w: ancho + 24, h: 52}, 51 + Math.floor(info.frame / 4), 1.5),
    );
    k.fillStyle = cobertura(1);
    k.textBaseline = 'top';
    k.fillText(texto, x, y);
  });

  return null;
};
