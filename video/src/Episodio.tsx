// Composición de un episodio: sketch + plantilla del canal, todo a través de <RisoFilter>.
import React, {useMemo} from 'react';
import {AbsoluteFill, Html5Audio, useCurrentFrame, useVideoConfig} from 'remotion';
import {
  areaSketch,
  DatoImpacto,
  DURACION_PORTADA,
  GuiaZonasSeguras,
  Numeracion,
  PanelDatos,
  Portada,
  progresoPanel,
  pulsoDe,
  resolverPanel,
  resolverTintas,
  RisoFilter,
  SubtituloNormal,
} from './canal';
import {buscarEpisodio} from './episodios';

export type PropsEpisodio = {carpeta: string; guias: boolean};

export const ComposicionEpisodio: React.FC<PropsEpisodio> = ({carpeta, guias}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const ep = buscarEpisodio(carpeta);
  const {config, sketch, tiempos} = ep;
  const tintas = useMemo(() => resolverTintas(config.tintas), [config.tintas]);

  const pulso = useMemo(() => pulsoDe(config), [config]);
  const panel = useMemo(() => resolverPanel(config.panel, tiempos, pulso), [config.panel, tiempos, pulso]);
  const progreso = progresoPanel(frame, fps, panel);
  const area = areaSketch(progreso);
  const Sketch = sketch.default;

  return (
    <AbsoluteFill>
      <RisoFilter tintas={tintas} semilla={config.semilla} pulso={pulso}>
        <Sketch config={config} area={area} tiempos={tiempos} />
        {panel ? (
          <PanelDatos
            progreso={progreso}
            titulo={panel.titulo}
            datos={sketch.panel?.(frame, {fps, duracion: durationInFrames, tiempos, config})}
          />
        ) : null}
        <DatoImpacto impactos={config.impactos ?? []} tiempos={tiempos} progresoPanel={progreso} pulso={pulso} />
        {tiempos ? (
          // Durante la portada no hay subtítulos: el primer fotograma es la miniatura y el título manda
          <SubtituloNormal tiempos={tiempos} progresoPanel={progreso} ocultoEn={(t) => t < DURACION_PORTADA} />
        ) : null}
        <Numeracion numero={config.numero} desde={DURACION_PORTADA} />
        <Portada numero={config.numero} tema={config.tema} titulo={config.titulo} pulso={pulso} />
      </RisoFilter>
      <GuiaZonasSeguras visible={guias} />
      {/* Mezcla final (voz + música + efectos) si existe; si no, solo la voz */}
      {ep.mezcla ?? ep.voz ? <Html5Audio src={(ep.mezcla ?? ep.voz) as string} /> : null}
    </AbsoluteFill>
  );
};
