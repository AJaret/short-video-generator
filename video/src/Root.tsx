// Una composición por episodio. Duración = última palabra de tiempos.json + cola.
import React from 'react';
import {Composition} from 'remotion';
import {ALTO, ANCHO, FPS} from './canal';
import {ComposicionEpisodio, type PropsEpisodio} from './Episodio';
import {buscarEpisodio, EPISODIOS} from './episodios';

const DURACION_SIN_VOZ = 15; // segundos, hasta que exista tiempos.json

export const Raiz: React.FC = () => (
  <>
    {EPISODIOS.map((ep) => (
      <Composition
        key={ep.id}
        id={ep.id}
        component={ComposicionEpisodio}
        width={ANCHO}
        height={ALTO}
        fps={FPS}
        durationInFrames={DURACION_SIN_VOZ * FPS}
        defaultProps={{carpeta: ep.carpeta, guias: true}}
        calculateMetadata={({props}: {props: PropsEpisodio}) => {
          const {tiempos, config} = buscarEpisodio(props.carpeta);
          const segundos = tiempos ? tiempos.duracion + (config.cola ?? 1.5) : DURACION_SIN_VOZ;
          return {durationInFrames: Math.ceil(segundos * FPS)};
        }}
      />
    ))}
  </>
);
