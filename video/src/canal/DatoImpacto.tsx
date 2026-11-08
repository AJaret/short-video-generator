// <DatoImpacto>: Archivo Black ~120 px al centro para el dato clave. Máximo 3 por video.
// Sobre un bloque de papel con su sombra de tinta A. Tres entradas (`impacto.entrada`):
//   · 'sello' (por defecto): un leve sobretamaño que se asienta.
//   · 'letras': el bloque cae como sello y el texto se imprime letra a letra, en semicorcheas.
//   · 'barrido': una barra de tinta A cruza el bloque en un tiempo y deja el texto descubierto.
import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {cobertura, ORDEN, recortarPapel, todasLasCapas, useDibujo} from './capas';
import {ajustarTexto, mezclar, trazarRectIrregular} from './dibujo';
import {DURACION_IMPACTO, UTIL} from './diseno';
import {fuente, TITULAR} from './fuentes';
import {momentoImpacto} from './tiempos';
import {textoBarrido, textoLetras} from './cinetica';
import type {Pulso} from './pulso';
import type {Impacto, Tiempos} from './tipos';
import {centroAreaConPanel} from './PanelDatos';

const ENTRADA = 4; // fotogramas
const SALIDA = 6; // fotogramas

/** Tramos [inicio, fin] en segundos de los impactos que se pueden ubicar. */
export function tramosImpacto(
  impactos: Impacto[],
  tiempos: Tiempos | null,
  pulso?: Pulso | null,
): {impacto: Impacto; inicio: number; fin: number}[] {
  if (impactos.length > 3) throw new Error(`Máximo 3 datos de impacto por video (hay ${impactos.length}).`);
  return impactos.flatMap((impacto) => {
    const inicio = momentoImpacto(impacto, tiempos, pulso);
    if (inicio === null) return [];
    return [{impacto, inicio, fin: inicio + (impacto.duracion ?? DURACION_IMPACTO)}];
  });
}

export type PropsDatoImpacto = {
  impactos: Impacto[];
  tiempos: Tiempos | null;
  progresoPanel: number;
  /** Con pulso, el sello entra en el tiempo de la música más cercano a su ancla. */
  pulso?: Pulso | null;
};

export const DatoImpacto: React.FC<PropsDatoImpacto> = ({impactos, tiempos, progresoPanel, pulso}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const tramos = tramosImpacto(impactos, tiempos, pulso);

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
    const yLinea = (i: number) => cy - alto / 2 + interlinea * (i + 0.5) + 4;
    const entrada = tramo.impacto.entrada ?? 'sello';
    const ritmo: Pulso = pulso ?? {bpm: 92, negra: 60 / 92, compas: 240 / 92, golpeVisual: false};
    if (entrada === 'letras' && restantes >= SALIDA) {
      // Cada línea empieza donde acabó la anterior (contando solo letras)
      let previas = 0;
      lineas.forEach((linea, i) => {
        textoLetras(k, linea, cx, yLinea(i), t, tramo.inicio + previas * ritmo.negra * 0.25, ritmo);
        previas += linea.replace(/\s/g, '').length;
      });
    } else if (entrada === 'barrido' && restantes >= SALIDA) {
      const p = Math.min(1, (t - tramo.inicio) / ritmo.negra);
      lineas.forEach((linea, i) => {
        const x = cx - k.measureText(linea).width / 2;
        textoBarrido(capas, k, linea, x, yLinea(i), p, {alto: interlinea * 0.92, semilla: semillaForma + 10 + i, margen: 10});
      });
    } else {
      lineas.forEach((linea, i) => k.fillText(linea, cx, yLinea(i)));
    }
  });

  return null;
};
