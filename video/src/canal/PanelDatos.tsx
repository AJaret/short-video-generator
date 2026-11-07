// <PanelDatos>: sube desde abajo SOLO en episodios con simulación o números.
// Ocupa ~35 % inferior de la región útil; la animación se compacta arriba.
// Contiene contadores, fórmula y/o mini gráfico tramado.
import React from 'react';
import {Easing, interpolate, useCurrentFrame} from 'remotion';
import {cobertura, ORDEN, recortarPapel, useDibujo} from './capas';
import {trazarLineaIrregular, trazarRectIrregular} from './dibujo';
import {ALTO, ANCHO, HUECO_SUBTITULO, PANEL, SEGURA, UTIL, type Rect} from './diseno';
import {fuente, MONO} from './fuentes';
import type {DatosPanel} from './tipos';

const FOTOGRAMAS_SUBIDA = 18;
const MITAD_TIRA_SUBTITULO = 38;

/** 0 = oculto, 1 = arriba. Determinista a partir del fotograma. */
export function progresoPanel(frame: number, fps: number, panel: {desde: number; hasta?: number} | undefined): number {
  if (!panel) return 0;
  const sube = interpolate(frame, [panel.desde * fps, panel.desde * fps + FOTOGRAMAS_SUBIDA], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  if (panel.hasta === undefined) return sube;
  const baja = interpolate(frame, [panel.hasta * fps, panel.hasta * fps + FOTOGRAMAS_SUBIDA], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.in(Easing.cubic),
  });
  return sube * (1 - baja);
}

/** Centro vertical de la tira de subtítulos cuando el panel está arriba. */
export const subtituloYConPanel = () => PANEL.y - HUECO_SUBTITULO - MITAD_TIRA_SUBTITULO;

/** Área de la animación según el progreso del panel (pantalla completa → compactada arriba). */
export function areaSketch(progreso: number): Rect {
  const altoCompacto = subtituloYConPanel() - MITAD_TIRA_SUBTITULO - HUECO_SUBTITULO / 2;
  return {x: 0, y: 0, w: ANCHO, h: ALTO + (altoCompacto - ALTO) * progreso};
}

/** Centro vertical útil de la animación con el panel arriba (para el dato de impacto). */
export const centroAreaConPanel = () => (UTIL.y + subtituloYConPanel() - MITAD_TIRA_SUBTITULO) / 2;

export type PropsPanelDatos = {
  progreso: number;
  titulo?: string;
  datos?: DatosPanel;
};

export const PanelDatos: React.FC<PropsPanelDatos> = ({progreso, titulo = 'datos', datos}) => {
  const frame = useCurrentFrame();

  useDibujo(ORDEN.panel, (capas) => {
    if (progreso <= 0) return;
    const {b} = capas;
    const {a, k} = capas.solido;
    // Sube desde fuera de pantalla
    const desplazamiento = (1 - progreso) * (PANEL.h + SEGURA.abajo + 40);
    const r: Rect = {...PANEL, y: PANEL.y + desplazamiento};
    const tembl = Math.floor(frame / 4);

    // Fondo de papel + marco negro tembloroso
    recortarPapel(capas, (ctx) => trazarRectIrregular(ctx, {x: r.x - 20, y: r.y, w: r.w + 40, h: ALTO}, 900, 2));
    k.strokeStyle = cobertura(1);
    k.lineWidth = 4;
    trazarRectIrregular(k, r, 901 + tembl, 1.5);
    k.stroke();

    // Cabecera
    const pad = 32;
    k.fillStyle = cobertura(1);
    k.textBaseline = 'top';
    k.font = fuente(MONO, 28, 700);
    k.fillText(titulo.toUpperCase(), r.x + pad, r.y + pad - 6);
    k.lineWidth = 2;
    trazarLineaIrregular(k, r.x + pad, r.y + pad + 40, r.x + r.w - pad, r.y + pad + 40, 905 + tembl);
    k.stroke();

    let y = r.y + pad + 66;
    const izquierda = r.x + pad;
    const derecha = r.x + r.w - pad;

    // Contadores: etiqueta en negro, valor grande en tinta A
    const contadores = datos?.contadores ?? [];
    if (contadores.length > 0) {
      const ancho = (derecha - izquierda) / contadores.length;
      contadores.forEach((c, i) => {
        const x = izquierda + i * ancho;
        k.font = fuente(MONO, 26);
        k.fillText(c.etiqueta.toLowerCase(), x, y);
        a.font = fuente(MONO, 56, 700);
        a.fillStyle = cobertura(1);
        a.textBaseline = 'top';
        a.fillText(c.valor, x, y + 34);
      });
      y += 116;
    }

    // Fórmula
    if (datos?.formula) {
      k.font = fuente(MONO, 32);
      k.fillText(datos.formula, izquierda, y);
      y += 52;
    }

    // Mini gráfico: barras en tinta B, el tono sale de la trama
    const valores = datos?.grafico ?? [];
    const abajo = r.y + r.h - pad;
    if (valores.length > 0 && abajo - y > 40) {
      const altoG = abajo - y;
      const paso = (derecha - izquierda) / valores.length;
      valores.forEach((v, i) => {
        const h = Math.max(2, v * altoG);
        b.fillStyle = cobertura(0.35 + 0.65 * v);
        b.fillRect(izquierda + i * paso, abajo - h, Math.max(2, paso - 3), h);
      });
      k.lineWidth = 2;
      trazarLineaIrregular(k, izquierda, abajo, derecha, abajo, 907 + tembl, 1);
      k.stroke();
    }
  });

  return null;
};
