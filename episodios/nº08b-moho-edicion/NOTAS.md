# nº08b · el mismo episodio, en estilo "edición"

Recreación de `nº08-moho` pedida por el usuario el 2026-11-14 a partir de dos ediciones de motion graphics de referencia («019 · software edit», hecha con After Effects y Tracery, y la edición de «Big Walk»). Lo que se toma de ellas es **el estilo, el montaje y cómo la música y la imagen van de la mano**; no el contenido del juego ni las pistas de música. La velocidad no se copia: sigue a 92 BPM y con los cortes anclados a la voz.

Para este episodio el usuario pidió **ignorar la estética riso de `CLAUDE.md`**. `nº08` queda intacto para comparar.

## Qué es igual que en nº08
- Guion, toma de voz (`voz_externa.mp3`), tiempos y cifras. El rigor está en [las notas de nº08](../nº08-moho/NOTAS.md).
- La simulación: se importa de `../nº08-moho/simulacion.ts` (el modelo de tubos de Tero y otros, *Science* 327, 439, 2010). Su comprobación sigue siendo `nº08-moho/verificar.mjs`.
- Rótulos de rigor: «esquema · ciudades aproximadas», «medido en el artículo», «esquema · modelo de tubos del artículo» y la fuente en pantalla mientras la voz habla del estudio.

## Qué cambia
- **Color directo, sin filtro riso** (`"estilo": "edicion"` en `config.json`): el sketch dibuja el fotograma entero en un `<LienzoEdicion>` con el kit `@canal/edicion`. Colores medidos en la referencia: azul `#0A4AFF`, blanco, negro y ámbar `#F5B000`.
- **Planchas a sangre que cambian en cada corte** (azul, blanca, negra) con cuadrícula de plano técnico, marcos de selección, destellos y numerales de contorno.
- **3D**: el mapa es una maqueta. Las ciudades son cilindros, los copos de avena cubitos ámbar, el moho una gota y los tubos cintas sobre el suelo con el grosor del modelo. La cámara empieza cenital (parece el mapa 2D), se inclina en «¿cómo las unirías?», gira a saltos en cada tiempo y baja a ras de suelo en «el truco».
- **Glitch en los cortes** (2–3 fotogramas de mosaico, canales RGB separados y franjas), en el tiempo de silencio antes de la revelación y en «si se rompe una vía».
- **Música `edicion`** (`video/src/sonido/edicion.ts`): electrónica en Fa menor compuesta a partir de `sonido.ts → partitura()`, que sale de la misma `linea.ts` que la imagen. Cada corte lleva bombo, sub y palmada con un hueco de silencio antes; cada ciudad, copo, cifra y marca de la regla tiene su nota; cada glitch, su ráfaga de ruido.
- Tipografías: se conservan Archivo Black y Space Mono (son las que el render tiene empaquetadas).

## Escenas (cortes en corcheas de la música)
Portada → las 36 ciudades (dos por fusa) y el giro a 3D → plancha blanca: caen los copos → plancha negra: el moho en Tokio → tres carteles («sin cerebro / sin planos / sin ingenieros») → plancha azul: la malla lo cubre todo → plancha blanca: la poda → un tiempo de silencio con glitch → revelación: la red enmarcada y las cifras del artículo; la rotura → plancha negra a ras de suelo: el flujo → cartel «DÉCADAS» → tarjeta «26 HORAS» → portada (loop).

## Sin verificar por oído
La música se comprobó con mediciones (tempo, tonalidad, reparto de frecuencias, sonoridad y pico), no escuchándola: el timbre lo tiene que juzgar el usuario.
