// <GuiaZonasSeguras>: superpone las zonas seguras y el recorte 3:4 SOLO en la vista previa.
// En el render (still o video) no se dibuja nada.
import React from 'react';
import {AbsoluteFill, getRemotionEnvironment} from 'remotion';
import {ALTO, ANCHO, RECORTE_PORTADA, SEGURA} from './diseno';
import {TINTA_A, TINTA_B} from './paleta';

const rayado = (color: string) =>
  `repeating-linear-gradient(45deg, ${color}55 0 6px, transparent 6px 18px)`;

export const GuiaZonasSeguras: React.FC<{visible?: boolean}> = ({visible = true}) => {
  if (!visible || getRemotionEnvironment().isRendering) return null;
  const zona = (estilo: React.CSSProperties) => (
    <div style={{position: 'absolute', background: rayado(TINTA_A), ...estilo}} />
  );
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {zona({left: 0, top: 0, width: ANCHO, height: SEGURA.arriba})}
      {zona({left: 0, top: ALTO - SEGURA.abajo, width: ANCHO, height: SEGURA.abajo})}
      {zona({left: ANCHO - SEGURA.derecha, top: SEGURA.arriba, width: SEGURA.derecha, height: ALTO - SEGURA.arriba - SEGURA.abajo})}
      <div
        style={{
          position: 'absolute',
          left: RECORTE_PORTADA.x,
          top: RECORTE_PORTADA.y,
          width: RECORTE_PORTADA.w,
          height: RECORTE_PORTADA.h,
          outline: `3px dashed ${TINTA_B}`,
          outlineOffset: -3,
        }}
      />
    </AbsoluteFill>
  );
};
