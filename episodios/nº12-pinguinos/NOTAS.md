# Verificación y decisiones de nº12

Borrador: guion y verificación hechos; falta la aprobación del usuario para grabar la voz y montar el video.

Comprobación del esquema: `docker compose run --rm video node "../episodios/nº12-pinguinos/verificar.mjs"` (~1 s).

## Lo que dice la voz y de dónde sale
- **«Invierno en la Antártida, hasta cuarenta grados bajo cero... los machos cuidan el huevo sobre sus patas durante más de dos meses»**: los machos de pingüino emperador llevan el huevo sobre las patas; tarda de 65 a 75 días en eclosionar. En invierno, de −40 a 0 °C, con vientos que dan sensaciones de −60 °C. Fuente: Australian Antarctic Division (antarctica.gov.au, «Emperor penguin» y «Breeding cycle»). Fuente institucional, no un artículo. No se dan cifras de peso perdido ni de temperatura dentro del grupo porque las fuentes no coinciden (de 24 a 37 °C).
- **«Se apiñan, y cada uno solo quiere no pasar frío. El que recibe el viento rodea el grupo y se pega del lado resguardado... y así el grupo entero avanza»** y **«Con esa regla egoísta, un modelo matemático mostró que el frío se reparte casi por igual»**: Waters, Blanchette y Kim, «Modeling huddling penguins», *PLoS ONE* 7, e50277 (2012). Los pingüinos del borde más expuestos al viento se mueven a sotavento a lo largo del borde; los de dentro no se mueven. Cada uno solo busca reducir su propia pérdida de calor, y aun así todos acaban con un acceso «approximately equal» al calor del grupo. La voz dice «casi por igual».
- **«Al filmar un grupo de verdad, vieron que cada minuto o menos todos dan un pasito a la vez, como una ola, para no atascarse»**: Zitterbart, Wienecke, Butler y Fabry, «Coordinated movements prevent jamming in an emperor penguin huddle», *PLoS ONE* 6, e20260 (2011). Cada 30–60 s todos los pingüinos dan pasitos que recorren el grupo entero como una ola, a unos 12 cm/s. Así el grupo, tan apretado que no podría moverse, no se atasca («jamming»). Comprobado en el resumen y en la nota de prensa.
- **«Y a todos les toca el centro»**: Gilbert y otros (*Physiology & Behavior*, 2006) observaron que, aunque los grupos sean variados, las aves tienen un acceso igual al calor del grupo («equal access»). Comprobado en el resumen. Es también lo que da el modelo.

## El esquema del video (`simulacion.ts`)
- Retícula triangular con 140 pingüinos y viento de izquierda a derecha. En cada ronda, el del borde que más viento recibe (con algo de ruido) se va al hueco del borde más resguardado. Los de dentro no se mueven. Es un esquema en la línea del modelo de Waters y otros (2012); los parámetros son nuestros.
- `verificar.mjs` (1500 rondas):
  - **sin moverse**: el más castigado pasa 9,4 veces el frío medio y el 71 % nunca pasa frío;
  - **con la regla**: 1,8 veces, y nadie se libra (0 %);
  - el grupo avanza unos 107 cuerpos a favor del viento.
