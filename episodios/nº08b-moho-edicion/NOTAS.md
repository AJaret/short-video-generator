# nº08b · el episodio del moho, con las referencias como base

Versión de `nº08-moho` pedida por el usuario el 2026-11-14 a partir de dos ediciones de motion graphics de referencia («019 · software edit» y la edición de «Big Walk»). `nº08` queda intacto para comparar.

## Qué pidió el usuario (tras una primera versión que se pasó de copia)
La primera versión copiaba las referencias: color directo sin riso, cortes y glitch constantes y la cámara saltando en cada tiempo. El usuario la corrigió:
1. Los movimientos al ritmo de la música eran innecesarios: se usan solo cuando hacen falta, como en las referencias.
2. Es un video que explica: tanto movimiento en pantalla molesta.
3. Las referencias son para basarse; **la paleta del canal no se cambia**. Como mucho, otro color en un momento concreto.

Esta versión sigue la estética riso completa y no usa ningún color fuera de la paleta.

## Qué es igual que en nº08
- Guion, toma de voz (`voz_externa.mp3`), tiempos y cifras. El rigor está en [las notas de nº08](../nº08-moho/NOTAS.md).
- La simulación: se importa de `../nº08-moho/simulacion.ts` (el modelo de tubos de Tero y otros, *Science* 327, 439, 2010). Su comprobación sigue siendo `nº08-moho/verificar.mjs`.
- Rótulos de rigor («esquema · ciudades aproximadas», «medido en el artículo», «esquema · modelo de tubos del artículo») y la fuente en pantalla.

## Qué se toma de las referencias
- **3D** (`tres.ts`): el mapa es una maqueta. Empieza visto desde arriba, igual que el mapa de `nº08`, y se inclina cuando la voz pregunta «¿cómo las unirías?». Las ciudades son cilindros tramados, los copos de avena cubitos y el moho una gota rosa.
- **Planchas de tinta a sangre con el dibujo en papel**, solo en los dos momentos fuertes: la revelación (plancha azul, la red dentro de un marco con dos estrellas) y «26 HORAS» (plancha rosa).
- **Capa técnica**: cruces de retícula en el suelo, mira, lecturas de datos.
- **Música `edicion`** (`video/src/sonido/edicion.ts`): electrónica en Fa menor compuesta con `sonido.ts → partitura()`, que sale de la misma `linea.ts` que la imagen.

## Movimiento
- Un solo plano continuo de la maqueta: la cámara viaja con la voz (cuatro viajes de 1,4–1,8 s) y entre medias deriva muy poco.
- Cortes de verdad, solo seis: salida de la portada, revelación, cifras, «décadas», «26 horas» y el loop.
- Nada salta ni late al ritmo. Las tintas se separan unos px (`sacudirRegistro`) solo en la revelación y en la rotura.
- Van al pulso los gestos que ya hacían falta: las 36 ciudades aparecen de dos en dos, una pareja por fusa, y los copos caen igual. La partitura les pone una nota.

## Sin verificar por oído
La música se comprobó con mediciones (tempo, tonalidad, reparto de frecuencias, sonoridad y pico), no escuchándola: el timbre lo tiene que juzgar el usuario.
