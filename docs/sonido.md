# Música, mezcla y verificación

### Sonido: `video/src/sonido/` (todo por código, determinista)
- `producir.py` genera `episodios/<ep>/mezcla.wav` antes del render con `node scripts/sonido.mjs <ep>`, que tarda ~2 s. La mezcla junta voz, música, efectos de la plantilla y efectos del episodio, y Remotion **solo reproduce esa pista** (si no existe, solo la voz). `mezcla.wav` no se versiona.
- `sintesis.ts`: osciladores, filtros (un polo y biquad con barrido), envolventes, limitador con anticipación y lectura y escritura de WAV.
- `instrumentos.ts` contiene la firma sonora del canal:
  - `impresora` (traqueteo riso), `sello` (golpe), `papel` (deslizamiento) y `zumbido` (grave que crece).
  - `tic` (afinado) y `ticShepard` (subida "infinita").
  - Instrumentos de la música: marimba, campana FM, sub-grave, bombo, aro, shaker, platillo y golpe grave.
- `musica.ts` · `musicaMisterio`: se **compone para cada episodio** a partir de un plan, no es un bucle de fondo.
  - Base: Am – Fmaj7 – Am – G, con la marimba en semicorcheas en un patrón 3+3+2 que "gira".
  - La intensidad de cada tiempo decide qué capas suenan:
    - menos de 0,3: marimba en corcheas.
    - más de 0,3: sub-grave.
    - más de 0,45: bombo y aro a medio tiempo.
    - más de 0,55: shaker.
    - más de 0,8: campanitas.
  - Dentro del plan: **caídas** (silencio), **golpes** (platillo + grave) y un **acorde final**.
  - Eco que rebota de lado a lado, en estéreo.
- **Pulso (`video/src/canal/pulso.ts`):** el reloj que comparten animación, plantilla y sonido.
  - `pulsoDe(config)` (`ritmo.bpm`, 92 por defecto), `cuantizar(t, pulso, division, modo)`, `golpe(t, pulso)` (envolvente que late en cada tiempo) y `faseEn`.
  - A 92 BPM un compás dura 2,609 s, así que la salida de la portada (2,6 s) cae en el primer tiempo del compás 1.
- **Lo que va al pulso en la plantilla:**
  - El panel sube y baja, y los sellos de impacto entran, en el tiempo más cercano a su ancla (`resolverPanel(…, pulso)`, `momentoImpacto`).
  - **Golpe riso** (`ritmo.golpeVisual`, activo por defecto): en cada tiempo el desajuste de registro de A y B da un salto de +0,9 px que cae en 0,12 s. No actúa durante la portada. `golpeVisual: false` lo quita (lo usa `nº04`, todo líneas finas, donde ese salto separa y junta los colores en cada tiempo).
  - Ya no hay empujón de escala por compás ni temblor de registro. Con el filtro por CPU, el 1 % de escala se reescalaba por vecino más cercano y, junto al temblor que cambiaba en cada compás, cada ~2,6 s todo el dibujo daba un salto, "como si se volviera a generar" (lo notó el usuario). Medido en el final quieto de `nº04`: el cambio medio entre fotogramas pasó de 0,48 a 0,01.
- `banda.ts` (reglas de mezcla, en **estéreo**):
  - Plan musical:
    - Intensidad 0,2 en la portada; sube de 0,3 a 0,85 hasta la revelación (`audio.revelacion`, llevada al tiempo más cercano).
    - **Un tiempo de silencio** justo antes de la revelación y **golpe** en ella.
    - Dos compases a tope; luego intensidad media (0,65) mientras se explica, hasta `audio.remate` (ancla, por defecto 2 compases después, limitado para dejar espacio al acorde final). Después se reduce hasta el acorde final.
    - `audio.golpes` (anclas) añade más golpes, cada uno con su tiempo de silencio antes.
  - Música a −18 dB respecto a la voz (`audio.musicaDb`). La base baja 3 dB más mientras habla la voz y 7 dB más durante los impactos; los golpes no bajan.
  - Efectos, todos en el pulso: impresora al salir la portada, papel al subir y bajar el panel, sello + impresora corta en cada impacto, y zumbido durante los 4 s previos a la revelación.
  - La voz y los efectos van al centro, con −3 dB por canal. Salida a **−14 LUFS**: la mezcla mide su propia sonoridad con `lufs()` (BS.1770, coincide con pyloudnorm) y se ajusta sola con `normalizarLufs()` y un limitador enlazado con anticipación de 3 ms, ataque en rampa, relajación de 80 ms y detección de pico real por interpolación 4× (techo −1 dBTP; se comprueba tras codificar AAC). No hay ganancias fijas que calibrar: antes, una ganancia fija dejó `nº01` a −12,8 al cambiar la voz.
- **Efectos propios de un episodio:** `episodios/<ep>/sonido.ts` exporta `eventos({config, tiempos, duracion, pulso})` y devuelve una lista de tics con `{t, frecuencia, volumenDb, duracion?, brillo?, shepard?, pan?}`. Con `efecto: 'impresora' | 'papel'` se pide un efecto de la plantilla, por ejemplo la impresora en cada corte de escena.
  - Para que imagen y sonido coincidan, la línea de tiempo del sketch va en un módulo **puro** (`linea.ts`, sin React), compartido por `Sketch.tsx` y `sonido.ts`, y **en la rejilla de pulso**. Ejemplo: `nº01`:
    - Un paso de la hormiga por tiempo: salta al empezar el tiempo, frenando, y luego espera. Cada paso suena un escalón más arriba en la pentatónica de La menor, así que los pasos forman parte de la música.
    - La cámara salta en cada tiempo.
    - En la aceleración suena una escalera de Shepard en corcheas, luego semicorcheas y luego fusas.
    - La autopista aparece en el golpe de la revelación.
    - **Escenas con cortes secos en el pulso**, cada una anclada a una frase del guion: principal → 4 tableros con dibujos de partida distintos → cuadro que la hormiga siempre rompe → cinta (esquema de una máquina que cuenta en binario) → final, que vuelve a la portada.
    - La simulación está en otro módulo puro (`simulacion.ts`), que también usa el sonido; por ejemplo, para que suene un tic en cada salida del cuadro.
    - Los dibujos de partida se eligieron simulando 400 semillas con el mismo generador (`episodios/nº01-hormiga-de-langton/verificar.mjs`): 396 acaban en autopista antes de 40 000 pasos. En pantalla solo se muestra lo comprobado.
    - En el panel, una lista de comprobación se completa a medida que la voz lo dice.
  - Lección aprendida: 30 tics por segundo a la misma altura se oyen como un zumbido. Para "cada paso más alto" hace falta que cada tic suba de verdad: Shepard, o un rango amplio.
- Verificación (la hace `herramientas/informe.py` tras cada render):
  - `pyloudnorm` para el volumen total y ebur128 de ffmpeg para el *true peak*.
  - `--pulso` compara ataques de la mezcla mono y picos visuales con la rejilla del BPM configurado; no estima el tempo ni separa el canal lateral. La voz también produce ataques. Como referencia histórica de una prueba aparte: en `nº01` el detector daba 126 BPM en la mezcla y 92,3 BPM en el lateral (L−R).
  - Los picos de cambio entre fotogramas del MP4 se comparan con la rejilla. En `nº01`, el 79 % cae a ≤ 2 fotogramas de un tiempo; los demás son cambios de subtítulo, que siguen a la voz.
  - La correlación L/R de la mezcla sale ~1 porque la voz al centro domina. Es normal: la música sí es estéreo.


Sin revelación, el remate empieza por defecto dos compases antes del final. El acorde final se reserva antes de los últimos tres cuartos de compás y las pistas musicales terminan con fundido.

`tiempoDeAncla` registra las anclas ausentes en `anclasNoEncontradas`; `sonido.mjs` vacía ese registro por producción e imprime los avisos de `informe.avisos`, incluidas las anclas usadas en `linea.ts`. Sin tiempos todavía no avisa.

El detector de pico real usa interpolación sinc con ventana Hann a 4×. El techo incluye un margen de 0,05 dB y una comprobación tras aplicar la envolvente. El informe mide de forma independiente el MP4 con ffmpeg: la codificación AAC puede modificar los picos.

Regresiones de audio, anclas y sincronía: `docker compose run --rm video node scripts/verificar_auditoria.mjs`.
