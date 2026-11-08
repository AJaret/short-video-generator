// <DatoImpacto>: Archivo Black ~120 px al centro para el dato clave. Máximo 3 por video.
// Entra como un sello (un leve sobretamaño que se asienta) sobre un bloque de tinta A.
import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {cobertura, ORDEN, recortarPapel, todasLasCapas, useDibujo} from './capas';
import {ajustarTexto, mezclar, trazarRectIrregular} from './dibujo';
import {DURACION_IMPACTO, UTIL} from './diseno';
import {fuente, TITULAR} from './fuentes';
import {inicioImpacto} from './tiempos';
import type {Impacto, Tiempos} from './tipos';
import {centroAreaConPanel} from './PanelDatos';

const ENTRADA = 4; // fotogramas
const SALIDA = 6; // fotogramas

/** Tramos [inicio, fin] en segundos de los impactos que se pueden ubicar. */
export function tramosImpacto(impactos: Impacto[], tiempos: Tiempos | null): {impacto: Impacto; inicio: number; fin: number}[] {
  if (impactos.length > 3) throw new Error(`Máximo 3 datos de impacto por video (hay ${impactos.length}).`);
  return impactos.flatMap((impacto) => {
    const inicio = inicioImpacto(impacto, tiempos);
    if (inicio === null) return [];
    return [{impacto, inicio, fin: inicio + (impacto.duracion ?? DURACION_IMPACTO)}];
  });
}

export type PropsDatoImpacto = {
  impactos: Impacto[];
  tiempos: Tiempos | null;
  progresoPanel: number;
};

export const DatoImpacto: React.FC<PropsDatoImpacto> = ({impactos, tiempos, progresoPanel}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const tramos = tramosImpacto(impactos, tiempos);

  useDibujo(ORDEN.impacto, (capas) => {
    const t = frame / fps;
    const tramo = tramos.find((x) => t >= x.inicio && t < x.fin);
    if (!tramo) return;
    const {a} = capas;
    const k = capas.solido.k;
    const f = frame - Math.round(tramo.inicio * fps);
    const restantes = Math.round(tramo.fin * fps) - frame;

    // Sello: 108 % → 100 % en pocos fotogramas; salida disolviéndose en la trama
    const escala = f < ENTRADA ? mezclar(1.08, 1, f / ENTRADA) : 1;
    const tinta = restantes < SALIDA ? restantes / SALIDA : 1;

    const {tamano, lineas} = ajustarTexto(k, tramo.impacto.texto.toUpperCase(), TITULAR, UTIL.w - 80, 2, 132, 72);
    const interlinea = tamano * 1.0;
    const alto = interlinea * lineas.length;
    const cy = mezclar(UTIL.y + UTIL.h * 0.42, centroAreaConPanel(), progresoPanel);
    k.font = fuente(TITULAR, tamano);
    const ancho = Math.max(...lineas.map((l) => k.measureText(l).width));
    const cx = UTIL.x + UTIL.w / 2;

    const bloque = {x: cx - ancho / 2 - 36, y: cy - alto / 2 - 30, w: ancho + 72, h: alto + 60};
    const semillaForma = 700 + Math.round(tramo.inicio * 10);

    for (const ctx of todasLasCapas(capas)) {
      ctx.translate(cx, cy);
      ctx.scale(escala, escala);
      ctx.translate(-cx, -cy);
    }
    recortarPapel(capas, (ctx) => trazarRectIrregular(ctx, bloque, semillaForma, 3), tinta);
    a.fillStyle = cobertura(tinta);
    trazarRectIrregular(a, {...bloque, x: bloque.x + 14, y: bloque.y + 14}, semillaForma + 1, 3);
    a.fill();

    k.fillStyle = cobertura(tinta);
    k.textAlign = 'center';
    k.textBaseline = 'middle';
    lineas.forEach((linea, i) => k.fillText(linea, cx, cy - alto / 2 + interlinea * (i + 0.5) + 4));
  });

  return null;
};
