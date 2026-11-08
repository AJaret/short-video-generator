// <Transiciones>: dibuja las transiciones entre escenas de un sketch (ver transiciones.ts).
// Van por encima del sketch y por debajo de la plantilla (panel, impactos, subtítulos).
import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {ORDEN, useDibujo} from './capas';
import type {Pulso} from './pulso';
import {dibujarTransicion, transicionEn, type Transicion} from './transiciones';

export const Transiciones: React.FC<{lista: Transicion[]; pulso: Pulso}> = ({lista, pulso}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  useDibujo(ORDEN.transicion, (capas) => {
    const activa = transicionEn(frame / fps, lista, pulso);
    if (activa) dibujarTransicion(capas, activa.tr, activa.p);
  });
  return null;
};
