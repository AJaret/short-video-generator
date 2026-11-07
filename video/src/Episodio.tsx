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
  resolverTintas,
  RisoFilter,
  SubtituloNormal,
} from './canal';
import {buscarEpisodio} from './episodios';

export type PropsEpisodio = {carpeta: string; guias: boolean};

export const ComposicionEpisodio: React.FC<PropsEpisodio> = ({carpeta, guias}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ep = buscarEpisodio(carpeta);
  const {config, sketch, tiempos} = ep;
  const tintas = useMemo(() => resolverTintas(config.tintas), [config.tintas]);

  const progreso = progresoPanel(frame, fps, config.panel);
  const area = areaSketch(progreso);
  const Sketch = sketch.default;

  return (
    <AbsoluteFill>
      <RisoFilter tintas={tintas} semilla={config.semilla}>
        <Sketch config={config} area={area} />
        {config.panel ? (
          <PanelDatos progreso={progreso} titulo={config.panel.titulo} datos={sketch.panel?.(frame, fps)} />
        ) : null}
        <DatoImpacto impactos={config.impactos ?? []} tiempos={tiempos} progresoPanel={progreso} />
        {tiempos ? <SubtituloNormal tiempos={tiempos} progresoPanel={progreso} /> : null}
        <Numeracion numero={config.numero} desde={DURACION_PORTADA} />
        <Portada numero={config.numero} tema={config.tema} titulo={config.titulo} />
      </RisoFilter>
      <GuiaZonasSeguras visible={guias} />
      {ep.voz ? <Html5Audio src={ep.voz} /> : null}
    </AbsoluteFill>
  );
};
