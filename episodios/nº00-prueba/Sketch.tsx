// nº00 · prueba de plantilla: dos órbitas que se cruzan.
// Dibuja en escala de grises sobre las capas de tinta; el color lo pone <RisoFilter>.
import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {cobertura, mulberry32, ORDEN, useDibujo, type ContextoSketch, type DatosPanel, type PropsSketch} from '@canal';

const VUELTAS = 5;

/**
 * Fase (0…1) del fotograma: va de 0 en el primero a 1 en el último, así que el último fotograma
 * repite la portada (loop). Usa la duración real de la composición (voz + cola), no un periodo fijo.
 */
const faseDe = (frame: number, duracion: number) => frame / Math.max(1, duracion - 1);

const Sketch: React.FC<PropsSketch> = ({config, area}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();

  useDibujo(ORDEN.sketch, ({a, b, k}) => {
    const fase = faseDe(frame, durationInFrames); // 0 y 1 dan el mismo dibujo: VUELTAS vueltas completas
    const angulo = fase * Math.PI * 2 * VUELTAS;

    // Centro y tamaño dentro del área disponible (respeta la zona segura de arriba)
    const arriba = Math.max(area.y, 200);
    const cx = (area.x + area.w - 140) / 2 + 30;
    const cy = arriba + (area.y + area.h - arriba) / 2;
    const radio = Math.min(area.w - 200, area.y + area.h - arriba) * 0.3;

    // Tinta A: esfera con volumen (el degradado de origen se convierte en trama)
    const ax = cx + Math.cos(angulo) * radio * 0.35;
    const ay = cy + Math.sin(angulo) * radio * 0.35;
    const g = a.createRadialGradient(ax - radio * 0.3, ay - radio * 0.35, radio * 0.1, ax, ay, radio);
    g.addColorStop(0, cobertura(0.15));
    g.addColorStop(0.6, cobertura(0.6));
    g.addColorStop(1, cobertura(1));
    a.fillStyle = g;
    a.beginPath();
    a.arc(ax, ay, radio, 0, Math.PI * 2);
    a.fill();

    // Tinta B: anillo de puntos en contrafase; donde pisa a la esfera sale el solape.
    // Gira a 0,4 de la esfera: 2 vueltas enteras en el video (con 0,5 serían 2,5 y el último
    // fotograma quedaría con el anillo girado media vuelta respecto a la portada).
    const azar = mulberry32(config.semilla);
    const puntos = 36;
    for (let i = 0; i < puntos; i++) {
      const th = (i / puntos) * Math.PI * 2 - angulo * 0.4;
      const r = radio * (1.05 + 0.18 * Math.sin(5 * th + angulo));
      const tam = 10 + azar() * 26;
      b.fillStyle = cobertura(0.45 + azar() * 0.55);
      b.beginPath();
      b.arc(cx + Math.cos(th) * r, cy + Math.sin(th) * r, tam, 0, Math.PI * 2);
      b.fill();
    }

    // Negro: eje fino de referencia
    k.strokeStyle = cobertura(0.8);
    k.lineWidth = 3;
    k.beginPath();
    k.moveTo(cx - radio * 1.5, cy);
    k.lineTo(cx + radio * 1.5, cy);
    k.stroke();
  });

  return null;
};

export default Sketch;

/** Datos del panel para el fotograma dado. */
export function panel(frame: number, {duracion}: ContextoSketch): DatosPanel {
  const fase = faseDe(frame, duracion); // contexto.duracion ya está en fotogramas
  const vueltas = fase * VUELTAS;
  return {
    contadores: [
      {etiqueta: 'vueltas', valor: vueltas.toFixed(2)},
      {etiqueta: 'fotograma', valor: String(frame).padStart(3, '0')},
    ],
    formula: 'r = 1 + 0.18·sin(5t)',
    grafico: Array.from({length: 28}, (_, i) => 0.5 + 0.5 * Math.sin((i / 28) * Math.PI * 2 * 2 + fase * Math.PI * 2 * VUELTAS)),
  };
}
