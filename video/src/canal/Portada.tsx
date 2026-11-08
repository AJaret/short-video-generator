// <Portada>: el primer fotograma es la miniatura.
// "nº XX / tema" en Space Mono + título en Archivo Black, todo dentro del recorte 3:4.
// El fotograma clave de la animación lo pone el sketch y se ve detrás: el título se imprime
// encima en negro (sin tapar con papel), como en una riso de dos pasadas.
import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {cobertura, ORDEN, recortarPapel, useDibujo} from './capas';
import {ajustarTexto, trazarRectIrregular} from './dibujo';
import {ALTO, DURACION_PORTADA, RECORTE_PORTADA, SEGURA, UTIL} from './diseno';
import {fuente, MONO, TITULAR} from './fuentes';
import {numeroConFormato} from './Numeracion';

const FOTOGRAMAS_SALIDA = 8;

export type PropsPortada = {numero: number; tema: string; titulo: string};

export const Portada: React.FC<PropsPortada> = ({numero, tema, titulo}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const fin = Math.round(DURACION_PORTADA * fps);

  useDibujo(ORDEN.portada, (capas, info) => {
    if (frame >= fin) return;
    const {a} = capas;
    const k = capas.solido.k;
    // Salida: la etiqueta de papel y la franja se disuelven en la trama; el texto se va a mitad
    const salida = Math.max(0, (frame - (fin - FOTOGRAMAS_SALIDA)) / FOTOGRAMAS_SALIDA);
    const tinta = 1 - salida;
    const conTexto = salida < 0.5;
    const tembl = Math.floor(info.frame / 3);
    const x = UTIL.x;
    const ancho = UTIL.w;

    // Etiqueta "nº XX / tema", arriba dentro del recorte 3:4
    const arriba = RECORTE_PORTADA.y + 56;
    k.font = fuente(MONO, 40, 700);
    const etiqueta = `${numeroConFormato(numero)} / ${tema.toLowerCase()}`;
    const anchoEtiqueta = k.measureText(etiqueta).width;
    recortarPapel(
      capas,
      (ctx) => trazarRectIrregular(ctx, {x: x - 16, y: arriba - 12, w: anchoEtiqueta + 32, h: 72}, 11 + tembl, 2),
      tinta,
    );
    if (conTexto) {
      k.fillStyle = cobertura(1);
      k.textBaseline = 'top';
      k.fillText(etiqueta, x, arriba + 4);
    }

    // Título: hasta 3 líneas, apoyado abajo dentro del recorte (y por encima de la zona segura)
    const {tamano, lineas} = ajustarTexto(k, titulo.toUpperCase(), TITULAR, ancho, 3, 150, 84);
    const interlinea = tamano;
    const base = Math.min(RECORTE_PORTADA.y + RECORTE_PORTADA.h - 150, ALTO - SEGURA.abajo - 50);
    const y0 = base - interlinea * lineas.length;

    // Franja de tinta A sobre el título
    a.fillStyle = cobertura(tinta);
    trazarRectIrregular(a, {x: x - 8, y: y0 - 56, w: ancho * 0.36, h: 30}, 37 + tembl, 2);
    a.fill();

    if (conTexto) {
      k.font = fuente(TITULAR, tamano);
      k.fillStyle = cobertura(1);
      k.textBaseline = 'top';
      lineas.forEach((linea, i) => k.fillText(linea, x, y0 + i * interlinea));
    }
  });

  return null;
};
