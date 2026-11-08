# Render por CPU

### Render
- `npx remotion render` a 1080×1920, 30 fps, H.264, CRF 18, audio AAC.
- **Sin GPU ni WebGL:** el filtro riso va por CPU (`video/src/canal/tramado.ts`) y Chrome se lanza con `swiftshader` (`video/remotion.config.ts`), que deja los canvas en memoria normal.
  - Antes el filtro era un shader WebGL con `swangle`. La GPU emulada vive en **un solo proceso compartido** por todas las pestañas, así que el render no pasaba de ~3,5 fotogramas/s con ningún número de hilos (medido: 4, 8, 12 y 16 daban lo mismo, y PNG/JPEG o media escala tampoco influían).
  - Por CPU, cada pestaña filtra por su cuenta: 90 fotogramas pasan de 25 s a 7,4 s.
  - Comparado píxel a píxel con el shader: diferencia media de ~2/255, que es el grano. Solo cambia de verdad el 0,02–0,19 % de los píxeles, en bordes por redondeo.
  - No vuelvas a WebGL sin medir. El cuello de botella no está en el dibujo: dentro de la página, todo un fotograma tarda ~3 ms.
- Los canvas de las capas se crean con `willReadFrequently: true`, porque el filtro lee sus píxeles en cada fotograma.
- Fuentes empaquetadas desde npm (`@fontsource`): el render no depende de internet.


El informe corre en `analisis`, sin GPU. El loop compara el primer y último fotograma reducidos a 270×480; avisa si más del 15 % cambia más de 48/255. Es una heurística: la portada añade texto y no se exige igualdad de píxeles. Los tramos no miden loop.

Los informes completos y parciales usan nombres separados, incluso si un tramo empieza en cero: `informe.txt`/`hoja.png` frente a `informe_tramo.txt`/`hoja_tramo.png`. Con tramos, `--pulso` usa los segundos del episodio para conservar la fase de la rejilla.
