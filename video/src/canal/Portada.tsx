// <Portada>: el gancho de los primeros 2,6 s.
// "nº XX / tema" en Space Mono + título en Archivo Black, dentro del recorte 3:4 (por si la miniatura
// se elige de estos fotogramas). El fondo lo pone el sketch: el título se imprime encima en negro
// (sin tapar con papel), como en una riso de dos pasadas.
// Desde el 2026-11-08 el fotograma 0 ya no tiene que ser la miniatura (el usuario la elige al
// publicar): la portada entra con movimiento desde el primer instante. La etiqueta se desliza, la
// franja de tinta se estira y el título se imprime palabra a palabra, una por corchea, cada una con
// un golpe de sello (banda.ts). El fotograma 0 queda sin título, igual que el último: loop exacto.
import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {cobertura, ORDEN, recortarPapel, useDibujo} from './capas';
import {momentosPortada} from './tiempos';
import {salidaCubica, tramo} from './curvas';
import {ajustarTexto, trazarRectIrregular} from './dibujo';
import {ALTO, DURACION_PORTADA, RECORTE_PORTADA, SEGURA, UTIL} from './diseno';
import {fuente, MONO, TITULAR} from './fuentes';
import {numeroConFormato} from './Numeracion';
import type {Pulso} from './pulso';

const FOTOGRAMAS_SALIDA = 8;

export type PropsPortada = {numero: number; tema: string; titulo: string; pulso?: Pulso | null};

export const Portada: React.FC<PropsPortada> = ({numero, tema, titulo, pulso}) => {
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
    const t = frame / fps;
    const momentos = momentosPortada(titulo, pulso?.negra ?? 60 / 92);

    // Etiqueta "nº XX / tema", arriba dentro del recorte 3:4
    const arriba = RECORTE_PORTADA.y + 56;
    k.font = fuente(MONO, 40, 700);
    const etiqueta = `${numeroConFormato(numero)} / ${tema.toLowerCase()}`;
    const anchoEtiqueta = k.measureText(etiqueta).width;
    // La etiqueta entra deslizándose desde la izquierda (en el fotograma 0 está fuera de cuadro)
    const dx = -(1 - salidaCubica(tramo(t, 0, 0.35))) * (x + anchoEtiqueta + 60);
    recortarPapel(
      capas,
      (ctx) => trazarRectIrregular(ctx, {x: x - 16 + dx, y: arriba - 12, w: anchoEtiqueta + 32, h: 72}, 11 + tembl, 2),
      tinta,
    );
    if (conTexto) {
      k.fillStyle = cobertura(1);
      k.textBaseline = 'top';
      k.fillText(etiqueta, x + dx, arriba + 4);
    }

    // Título: hasta 3 líneas, apoyado abajo dentro del recorte (y por encima de la zona segura)
    const {tamano, lineas} = ajustarTexto(k, titulo.toUpperCase(), TITULAR, ancho, 3, 150, 84);
    const interlinea = tamano;
    const base = Math.min(RECORTE_PORTADA.y + RECORTE_PORTADA.h - 150, ALTO - SEGURA.abajo - 50);
    const y0 = base - interlinea * lineas.length;

    // Franja de tinta A sobre el título: se estira con la primera palabra
    const largo = ancho * 0.36 * salidaCubica(tramo(t, momentos[0] ?? 0, 0.3));
    if (largo > 4) {
      a.fillStyle = cobertura(tinta);
      trazarRectIrregular(a, {x: x - 8, y: y0 - 56, w: largo, h: 30}, 37 + tembl, 2);
      a.fill();
    }

    if (conTexto) {
      // Palabra a palabra, una por corchea (cada una cae seca, como un sello)
      k.font = fuente(TITULAR, tamano);
      k.fillStyle = cobertura(1);
      k.textBaseline = 'top';
      let n = 0;
      lineas.forEach((linea, i) => {
        let previo = '';
        for (const palabra of linea.split(' ')) {
          const desde = momentos[Math.min(n, momentos.length - 1)] ?? 0;
          if (t >= desde) k.fillText(palabra, x + k.measureText(previo).width, y0 + i * interlinea);
          previo += palabra + ' ';
          n++;
        }
      });
    }
  });

  return null;
};
