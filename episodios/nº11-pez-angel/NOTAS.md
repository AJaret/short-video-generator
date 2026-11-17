# Verificación y decisiones de nº11

Borrador: guion y verificación hechos; falta la aprobación del usuario para grabar la voz y montar el video.

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
