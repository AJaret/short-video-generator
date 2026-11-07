// <SubtituloNormal>: palabra a palabra, 2–3 palabras visibles, palabra activa en tinta A,
// sobre una tira de papel en el tercio inferior. Si el panel está arriba, se coloca encima de él.
import React, {useMemo} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {cobertura, ORDEN, recortarPapel, useDibujo} from './capas';
import {mezclar, trazarRectIrregular} from './dibujo';
import {SUBTITULO_Y, UTIL} from './diseno';
import {fuente, MONO} from './fuentes';
import {agruparSubtitulos, grupoEn, palabraActiva} from './tiempos';
import type {Tiempos} from './tipos';
import {subtituloYConPanel} from './PanelDatos';

const TAMANO = 44;
const ALTO_TIRA = 76;

export type PropsSubtituloNormal = {
  tiempos: Tiempos;
  /** 0 = panel abajo/oculto, 1 = panel arriba. */
  progresoPanel: number;
  /** Segundos durante los que no se muestran (p. ej. un dato de impacto encima). */
  ocultoEn?: (t: number) => boolean;
};

export const SubtituloNormal: React.FC<PropsSubtituloNormal> = ({tiempos, progresoPanel, ocultoEn}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const grupos = useMemo(() => agruparSubtitulos(tiempos.palabras), [tiempos]);

  useDibujo(ORDEN.subtitulo, (capas) => {
    const t = frame / fps;
    if (ocultoEn?.(t)) return;
    const grupo = grupoEn(grupos, t);
    if (!grupo) return;
    const {a, k} = capas.solido;
    const activa = palabraActiva(grupo, t);

    k.font = fuente(MONO, TAMANO);
    a.font = k.font;
    const espacio = k.measureText(' ').width;
    const anchos = grupo.palabras.map((p) => k.measureText(p.texto).width);
    const total = anchos.reduce((s, w) => s + w, 0) + espacio * (anchos.length - 1);

    const cy = mezclar(SUBTITULO_Y, subtituloYConPanel(), progresoPanel);
    const x0 = UTIL.x + (UTIL.w - total) / 2;
    const indice = grupos.indexOf(grupo);

    // Tira de papel: la forma cambia con cada grupo, no con cada fotograma (discreta)
    recortarPapel(capas, (ctx) =>
      trazarRectIrregular(ctx, {x: x0 - 24, y: cy - ALTO_TIRA / 2, w: total + 48, h: ALTO_TIRA}, 300 + indice, 2.5),
    );

    let x = x0;
    grupo.palabras.forEach((p, i) => {
      const ctx = i === activa ? a : k;
      ctx.fillStyle = cobertura(1);
      ctx.textBaseline = 'middle';
      ctx.fillText(p.texto, x, cy + 2);
      x += anchos[i] + espacio;
    });
  });

  return null;
};
