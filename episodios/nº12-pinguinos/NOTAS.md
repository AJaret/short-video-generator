# Verificación y decisiones de nº12

Comprobación del esquema: `docker compose run --rm video node "../episodios/nº12-pinguinos/verificar.mjs"` (~1 s).

## Lo que dice la voz y de dónde sale
- **«Invierno en la Antártida, hasta cuarenta grados bajo cero... los machos cuidan el huevo sobre sus patas durante más de dos meses»**: los machos de pingüino emperador llevan el huevo sobre las patas; tarda de 65 a 75 días en eclosionar. En invierno, de −40 a 0 °C, con vientos que dan sensaciones de −60 °C. Fuente: Australian Antarctic Division (antarctica.gov.au, «Emperor penguin» y «Breeding cycle»). Fuente institucional, no un artículo. No se dan cifras de peso perdido ni de temperatura dentro del grupo porque las fuentes no coinciden (de 24 a 37 °C).
- **«Se apiñan, y cada uno solo quiere no pasar frío. El que recibe el viento rodea el grupo y se pega del lado resguardado... y así el grupo entero avanza»** y **«Con esa regla egoísta, un modelo matemático mostró que el frío se reparte casi por igual»**: Waters, Blanchette y Kim, «Modeling huddling penguins», *PLoS ONE* 7, e50277 (2012). Los pingüinos del borde más expuestos al viento se mueven a sotavento a lo largo del borde; los de dentro no se mueven. Cada uno solo busca reducir su propia pérdida de calor, y aun así todos acaban con un acceso «approximately equal» al calor del grupo. La voz dice «casi por igual».
- **«Al filmar un grupo de verdad, vieron que cada minuto o menos todos dan un pasito a la vez, como una ola, para no atascarse»**: Zitterbart, Wienecke, Butler y Fabry, «Coordinated movements prevent jamming in an emperor penguin huddle», *PLoS ONE* 6, e20260 (2011). Cada 30–60 s todos los pingüinos dan pasitos que recorren el grupo entero como una ola, a unos 12 cm/s. Así el grupo, tan apretado que no podría moverse, no se atasca («jamming»). Comprobado en el resumen y en la nota de prensa.
- **«Y a todos les toca el centro»**: Gilbert y otros (*Physiology & Behavior*, 2006) observaron que, aunque los grupos sean variados, las aves tienen un acceso igual al calor del grupo («equal access»). Comprobado en el resumen. Es también lo que da el modelo.

## El esquema del video (`simulacion.ts`)
- Retícula triangular con 140 pingüinos y viento de izquierda a derecha. En cada ronda, el del borde que más viento recibe (con algo de ruido) se va al hueco del borde más resguardado. Los de dentro no se mueven. Es un esquema en la línea del modelo de Waters y otros (2012); los parámetros son nuestros.
- `verificar.mjs` (1500 rondas):
  - **sin moverse**: el más castigado pasa 8,9 veces el frío medio y el 70 % nunca pasa frío;
  - **con la regla**: 1,9 veces, y nadie se libra (0 %);
  - el grupo avanza unos 100 cuerpos a favor del viento.
- El grupo de partida es redondo: las 140 celdas más cercanas al centro. Con un hexágono, en 3D parecía un desfile en filas.

## Voz
- Toma generada con el conector de ElevenLabs el 2026-11-18 (703 créditos): 45,8 s. Whisper empató el 99 %. Solo etiquetas de emoción.

## Imagen y sonido
- **Maqueta 3D**: 140 pingüinos con cuerpo negro tramado, panza de papel y mancha rosa en el cuello, cada uno con un desplazamiento y una altura propios (fijos), sobre un hielo de papel con retícula azul a pantalla completa. La ventisca son trazos azules que cruzan toda la pantalla, lentos (2 a 4 vueltas en todo el video, para que el loop sea exacto).
- **El huevo**: la cámara se acerca a un macho del borde, con el huevo delante de las patas y una mira; lectura «65 a 75 días».
- **La regla, desde arriba**: la simulación sigue al grupo mientras avanza y el hielo se desliza debajo. En rosa, los que reciben viento; el que cambia de sitio rodea el grupo por fuera con su mira. Se ven 90 cambios de sitio: con 320, el 38 % de los fotogramas cambiaba de golpe, demasiado movimiento.
- **El reparto**: el frío acumulado de cada pingüino, de mayor a menor, sin moverse (azul) y con la regla (rosa), a lo largo de 1500 rondas. Sin moverse, 8,9 veces la media; con la regla, 1,9.
- **Revelación**: plancha azul con el grupo en papel y la ola de pasitos (en rosa) recorriéndolo de atrás hacia delante; «cada 30 a 60 segundos» y «12 CM/S».
- **Cierre**: vuelta al grupo de la portada (loop exacto).
- **Música `edicion` en Do menor**: una nota por cada cambio de sitio, un acorde que se abre cuando el frío se iguala y un arpegio que cruza de izquierda a derecha con la ola.
- Movimiento: el 20 % de los fotogramas tiene cambio fuerte y ningún tramo quieto pasa de 0,3 s.
