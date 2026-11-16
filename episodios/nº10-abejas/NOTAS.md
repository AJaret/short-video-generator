# Verificación y decisiones de nº10

Comprobación del esquema: `docker compose run --rm video node "../episodios/nº10-abejas/verificar.mjs"` (~3 s).

## Lo que dice la voz y de dónde sale
- **«Diez mil abejas colgadas de una rama» / «Unos cientos de exploradoras»**: de un enjambre de unas 10 000 abejas salen unas 300–500 exploradoras (Seeley, *Honeybee Democracy*, Princeton University Press, 2010). Comprobado en fuente secundaria (Science News; nota de prensa de Cornell, 2006).
- **«La reina no. Ella solo espera»**: la reina no participa en la elección; deciden las exploradoras (Seeley, 2010). Fuente secundaria.
- **«Si el sitio es bueno, baila mucho, si es regular, poco... y en cada vuelta baila menos»**: más circuitos de baile cuanto mejor es el sitio (en una prueba, unos 100 circuitos para un sitio de primera frente a 12 para uno mediocre, según Cornell) y menos circuitos en cada vuelta (unos 15 menos, según Science News). Fuente secundaria; las cifras no van en la voz.
- **«Cuando unas quince exploradoras coinciden en el mismo hueco, se acaba la votación»**: quórum en el sitio. Seeley y Visscher, «Quorum sensing during nest-site selection by honeybee swarms», *Behav. Ecol. Sociobiol.* 56, 594–601 (2004), demuestran que el enjambre detecta el quórum en el sitio. La cifra de unas 15 exploradoras es de la nota de prensa de Cornell y de Science News. Otra nota (Live Science) habla de 50–100 bailarinas; la voz dice «unas quince» exploradoras **en el hueco**, que es lo que miden.
- **«En una isla sin árboles, un biólogo les puso cinco cajas, una buena y cuatro regulares, y en cuatro de cinco enjambres eligieron la buena»**: Seeley y Buhrman, «Nest-site selection in honey bees: how well do swarms implement the best-of-N decision rule?», *Behav. Ecol. Sociobiol.* 49, 416–427 (2001). En Appledore Island (Maine), casi sin árboles: cinco cajas, una de alta calidad y cuatro de calidad media; en 4 de 5 ensayos eligieron la mejor. Comprobado en el resumen. El PDF del artículo es escaneado y no se pudo leer entero: el tamaño de las cajas no va en el video.
- No se usa (pero está comprobado): las exploradoras frenan con cabezazos a las bailarinas de otros sitios (Seeley y otros, *Science* 335, 108–111, 2012).

## El esquema del video (`simulacion.ts`)
- 300 exploradoras y cinco cajas (una de calidad 1 y cuatro de 0,4). Una exploradora libre sigue a una bailarina en proporción a los circuitos de cada sitio, o sale a buscar sola. Al volver, baila 90 × calidad circuitos, 15 menos en cada vuelta. Quórum: 15 exploradoras a la vez en una caja. Los parámetros son nuestros: se rotula «esquema».
- `verificar.mjs`, con 400 enjambres:
  - el modelo elige la caja buena el 100 % de las veces (mediana: 36 rondas hasta el quórum);
  - si todas bailaran igual, solo acertaría el 4 % y el 80 % no llegaría al quórum;
  - si el baile no decayera, se quedaría con el primer sitio encontrado y acertaría solo el 35 %.
- El modelo acierta más que los enjambres reales (4 de 5): es un esquema, y la voz da la cifra real.

## Voz
- Toma generada con el conector de ElevenLabs el 2026-11-16 (727 créditos): 50,1 s. Whisper empató el 92 %. Solo etiquetas de emoción; el remate, sin etiqueta.

## Imagen y sonido (con nº08b y nº09 como estándar)
- **Maqueta 3D**: el enjambre (nube de esferas en negro tramado con la sombra en rosa) colgado de una rama sobre papel. La cámara se acerca a la reina (en rosa, con una mira: «la reina: no decide»). Corte a la isla: el poste con el enjambre y cinco cajas con volumen (la buena en rosa, las regulares en azul) sobre una retícula azul. Las exploradoras vuelan en arco hacia las cajas.
- El paso de la reina a la isla es un corte: un viaje de cámara atravesaba la caja C y se veía enorme.
- **El baile**, sobre papel: dos panales hexagonales con su bailarina recorriendo el ocho (rosa la buena, azul la regular). Las barras muestran los circuitos de cada vuelta del modelo (buena 90 → 75 → 60; regular 36 → 21 → 6). Las cifras son del esquema y no salen en la voz.
- **La votación**: la isla arriba y, abajo, las exploradoras en cada caja (la simulación) con la línea del quórum. La caja C la cruza justo antes de «se acaba la votación».
- **Revelación**: plancha rosa a sangre con «4 DE 5» en papel y cuatro de cinco cajas marcadas.
- **Cierre**: vuelta al enjambre y a la portada. Loop exacto: las abejas de adorno dan un número entero de vueltas en todo el video.
- **Música `edicion` en Sol menor**: clics cuando salen las exploradoras; en el baile, notas rápidas y agudas para la buena y pocas y graves para la regular; en la votación, una nota por cada exploradora que se suma a una caja (campana para la C); golpe en el quórum y en la revelación.
- Movimiento: el 5 % de los fotogramas tiene cambio fuerte (el más calmado hasta ahora) y ningún tramo quieto pasa de 0,4 s.
