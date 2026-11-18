# Verificación y decisiones de nº11

Comprobación de los esquemas: `docker compose run --rm video node "../episodios/nº11-pez-angel/verificar.mjs"` (~3 s).

## Lo que dice la voz y de dónde sale
- **«De joven tiene tres rayas... no se estiran: se multiplican. Tres, seis, doce»**: en *Pomacanthus semicirculatus* el patrón juvenil pasa de 3 a 6 y a 12 rayas verticales hacia los 2, 6 y 12 meses, porque entre las rayas que ya hay aparecen otras nuevas. Fuente: figura de Painter, Maini y Othmer, «Stripe formation in juvenile *Pomacanthus* explained by a generalized Turing mechanism with chemotaxis», *PNAS* 96, 5549–5554 (1999), con imágenes tomadas de Kondo y Asai (1995). A diferencia de los mamíferos, cuyos dibujos se agrandan con el cuerpo, las rayas mantienen la separación reorganizándose (resumen de Kondo y Asai, 1995).
- **«En mil novecientos cincuenta y dos, Alan Turing... propuso una receta: dos sustancias que se esparcen por la piel»**: Turing, «The chemical basis of morphogenesis», *Phil. Trans. R. Soc. B* 237, 37–72 (1952): sustancias (morfógenos) que reaccionan y se difunden por un tejido pueden dar los patrones de la morfogénesis.
- **«Una se activa a sí misma, la otra la frena... y la que frena corre más»**: la forma de activador e inhibidor, con activación de corto alcance e inhibición de largo alcance (Kondo y Miura, «Reaction-diffusion model as a framework for understanding biological pattern formation», *Science* 329, 1616–1620, 2010).
- **«De la nada salen manchas, laberintos o rayas»**: comprobado con nuestras simulaciones (abajo) y descrito en Kondo y Miura (2010).
- **«Turing murió dos años después, sin verlo en un animal»**: Turing murió en 1954. El ejemplo en un animal que se toma como primero es el de Kondo y Asai (1995).
- **«En mil novecientos noventa y cinco, dos biólogos siguieron a un pez ángel durante tres meses, y sus rayas se reacomodaban como en la simulación»**: Kondo y Asai, «A reaction–diffusion wave on the skin of the marine angelfish *Pomacanthus*», *Nature* 376, 765–768 (1995). Fotografiaron el cambio de las rayas durante 90 días y lo compararon con una simulación de reacción-difusión: «the striking similarity between the actual and simulated pattern rearrangement». La voz dice «un pez ángel» y no «este»: las fuentes difieren en la especie de la figura de los 90 días (*P. imperator* o *P. semicirculatus*).

## Matiz (no va en la voz)
Hofer y Maini (*Nature* 380, 678, 1996) discutieron que la reacción-difusión por sí sola explique todo lo que se vio. Kondo y Asai respondieron en el mismo número. Por eso la voz dice «como en la simulación» y no «como predijo Turing».

## Los esquemas del video (`simulacion.ts`)
- **Franja que crece** (Schnakenberg, activador e inhibidor, el inhibidor se difunde 22 veces más rápido): de largo 30 a 120. Las rayas pasan de 3 a 5 y a 10, y la separación media se mantiene en 12,0 → 12,0 → 12,1. En el pez real son 3 → 6 → 12; la diferencia está en los bordes del esquema, y el video no enseña el conteo de la simulación junto a esa frase.
- **Control**: sin el inhibidor más rápido (Dv = Du) no sale ninguna raya.
- **Parche 2D** (Gray-Scott): con una receta salen 46 manchas sueltas; con otra, una sola pieza conectada (un laberinto).

## Voz
- Toma generada con el conector de ElevenLabs el 2026-11-17 (719 créditos): 49,4 s. Whisper empató el 88 % (oyó «pes ángel» por «pez ángel»; la alineación con el guion es correcta).

## Imagen y sonido (con nº09 y nº10 como estándar)
- **El pez en 3D**: cuerpo y aletas con volumen tramado en azul (sombra en negro). Las rayas se dibujan como **bandas lisas** que siguen la curva del cuerpo y continúan por las aletas, en papel con un velo azul. Repartir las caras de la malla entre «raya» y «cuerpo» daba bordes escalonados y, con 12 rayas, un tablero.
- «Tres, seis, doce»: el pez crece y le salen rayas nuevas entre las viejas, como en las fotos (lectura «2 / 6 / 12 meses · rayas»; fuente Painter y otros, 1999). Son las rayas del pez real, no las de la simulación.
- **La ficha de 1952** (y 1954): detrás, muy suave, la piel formándose sola con la receta (manchas, y luego laberinto), para que la escena no quede quieta.
- **La receta**: el activador (rosa) y el inhibidor (azul) a lo largo de la franja, del ruido a las ondas, y la piel que se raya debajo.
- **Manchas, laberinto y rayas**: tres cuadros que se forman solos, con las simulaciones.
- **Revelación**: plancha azul a sangre con el pez en papel y las rayas de la simulación (la franja que crece) reacomodándose; contador de 0 a 90 días.
- **Loop**: la cola y el leve giro dan un número entero de ciclos en todo el video, y el cierre vuelve al pez de la portada.
- **Música `edicion` en Mi menor**: una nota por cada raya nueva (3 → 6 → 12), agudos para el activador y graves para el inhibidor, un acorde por cuadro, y en la revelación una campana cada vez que la simulación inserta una raya.
- Movimiento: el 6 % de los fotogramas tiene cambio fuerte y ningún tramo quieto pasa de 0,4 s.

## Correcciones del usuario (2026-11-17)
- «Tres, seis, doce» no se veía: las rayas solo engordaban. Ahora cada raya conserva su ancho real mientras el cuerpo crece («no se estiran»), así que se abren huecos, y las nuevas nacen en ellos justo cuando la voz dice «seis» y «doce».
- Los fondos de las fichas (manchas y laberinto) se cortaban arriba y abajo. Ahora son un mosaico a pantalla completa (Gray-Scott es periódico, así que no hay costuras), y la retícula del pez llega a los bordes.
- La receta empezaba como un caos de líneas (cada fotograma se normalizaba por separado y el ruido inicial, minúsculo, salía a tamaño completo) y se veía a saltos (pocas instantáneas). Ahora usa una escala fija, la del patrón ya formado: dos líneas casi planas cuyas ondas crecen solas. Además interpola entre instantáneas.
- Rayas del pez: líneas claras finas, como el juvenil real y como en la escena azul.
