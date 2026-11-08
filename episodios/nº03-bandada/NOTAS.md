# Verificación y decisiones de nº03

Comprobación: `docker compose run --rm video node "../episodios/nº03-bandada/verificar.mjs"`.

- El guion dice «en esta simulación» y no afirma nada de los estorninos reales: todo se comprueba con la misma simulación que se ve (`simulacion.ts`, 144 aves, cada una solo ve a sus vecinas a distancia² < 5).
- **Quién empieza el giro.** La primera versión hacía girar a las 12 aves de *delante*, lo que contradecía el remate («¿Y la que iba delante? También estaba mirando de reojo»): en esa simulación, la de delante sí daba la orden. Ahora empiezan 12 aves del **costado izquierdo**.
- **«El giro recorre la bandada».** Con las reglas originales solo giraba el 37 % de la bandada en 12 s, casi a la vez, y la de delante nunca giraba. Con las reglas elegidas por búsqueda (`REGLAS` en `simulacion.ts`: alineación 8, visión más corta, empuje 2,6 durante 3,5 s):
  - giran 132 de 132 seguidoras en 4 s (lo que dura esa parte del video);
  - en ola: el retraso crece con la distancia a las iniciadoras (Spearman 0,83); el costado izquierdo gira a ~1,1 s y el derecho a ~2,1 s;
  - la de delante no es iniciadora y gira a +1,4 s, como una seguidora más.
- En pantalla, un círculo punteado señala a la de delante desde que gira, y otra vez en el plano final mientras la voz pregunta por ella. Desaparece antes del último fotograma para que el loop coincida con la portada.
- Sonido: cada semicorchea suena una nota por las aves que acaban de girar (subiendo por la pentatónica), y una campanita cuando gira la de delante: el giro se oye recorrer la bandada.
