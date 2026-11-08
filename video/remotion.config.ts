// Configuración de Remotion para el canal.
// Se ejecuta desde video/ (dentro del contenedor: /repo/video).
import path from 'node:path';
import {Config} from '@remotion/cli/config';

const raizVideo = process.cwd();

Config.setEntryPoint('src/index.ts');

// Música y efectos del canal: staticFile('sfx/...') apunta a assets/
Config.setPublicDir(path.join(raizVideo, '..', 'assets'));

// Salida: H.264, CRF 18, audio AAC (por defecto con h264)
Config.setCodec('h264');
Config.setCrf(18);
Config.setVideoImageFormat('png');

// Docker Desktop recién arrancado puede tardar más de 30 s en preparar Chrome y cargar el bundle.
Config.setDelayRenderTimeoutInMilliseconds(120_000);

// Sin GPU: el filtro riso es por CPU (tramado.ts). 'swiftshader' deja el canvas en memoria normal y
// cada pestaña trabaja por su cuenta; con 'swangle' todo pasaba por un único proceso de GPU emulada.
Config.setChromiumOpenGlRenderer('swiftshader');

// Los episodios viven fuera de video/: les damos acceso a node_modules y al alias @canal
Config.overrideWebpackConfig((actual) => ({
  ...actual,
  resolve: {
    ...actual.resolve,
    alias: {
      ...(actual.resolve?.alias ?? {}),
      '@canal': path.join(raizVideo, 'src', 'canal'),
    },
    modules: [
      ...(actual.resolve?.modules ?? ['node_modules']),
      path.join(raizVideo, 'node_modules'),
    ],
  },
}));
