# Canal de reels · Programación creativa con estética riso dither

Este repositorio produce videos verticales (Reels / TikTok / Shorts) de 30–45 s sobre programación creativa, matemáticas visuales y algoritmos de la naturaleza. Todo se genera con código. Lee este archivo completo antes de crear o modificar cualquier cosa: define la identidad del canal y las reglas técnicas.

## Equipo de trabajo
- GPU: NVIDIA RTX 2060 (6 GB VRAM) · CPU: Intel i9-9900 · Sistema: Windows 11 (confírmalo antes de dar comandos).
- Todo corre en **Docker** (Docker Desktop + WSL2). La GPU llega al servicio `voz` con `deploy.resources.reservations.devices` en compose; no se instalan drivers ni CUDA dentro de WSL. En Windows solo hay Python 3.12, sin paquetes, para ejecutar `producir.py`. Node no está instalado en Windows.
- Instala siempre PyTorch con soporte CUDA. Si un script de IA dice "cpu", es un error de instalación.
- Con 6 GB de VRAM: no cargues dos modelos de IA a la vez en GPU. Voz y transcripción se ejecutan una después de otra, liberando memoria entre pasos.

---

## 1 · Estética: "Riso dither"
Risografía de dos tintas sobre papel, donde sombras y volúmenes se construyen con dithering, nunca con degradados.

### Paleta (únicos colores permitidos)
| Rol | HEX |
|---|---|
| Papel (fondo) | `#F2EBDD` |
| Tinta A · rosa fluor | `#FF48B0` |
| Tinta B · azul riso | `#0078BF` |
| Texto · negro riso | `#1E1E1E` |
| Solape A×B (sale solo del multiply) | `#002284` |

Tintas de serie (un episodio puede sustituir UNA tinta por otra de esta lista): `#00838A` verde azulado, `#FFE800` amarillo, `#FF6C2F` naranja, `#00A95C` verde, `#765BA7` morado.

### Tipografía (Google Fonts)
- Titulares: **Archivo Black**, siempre en mayúsculas.
- Datos, etiquetas, subtítulos normales y numeración: **Space Mono**.

### Textura (filtro global obligatorio)
- Dithering ordenado Bayer 4×4 (o Floyd–Steinberg en imágenes fijas), 4 niveles por tinta.
- Punto de dither: 3–4 px a 1080×1920.
- Desajuste de registro entre tintas: 2–6 px, fijo y determinista (por semilla). En video no tiembla: el temblor por fotograma parpadeaba y el que cambiaba por compás se veía como un salto cada ~2,6 s. La vida la da el golpe riso de cada tiempo.
- Tintas combinadas en modo multiply sobre el papel.
- Grano de papel por encima de todo al 3–5 % de opacidad.

### Prohibido
Degradados suaves, glow, sombras proyectadas, bordes perfectos, blanco puro (#FFF), negro puro (#000), más de 2 tintas + negro en un mismo video.

---

## 2 · Tono y voz: "Misterio con guiño"
- Narradora IA: femenina, 30–40 años, español latino neutro, timbre medio-grave y cálido, tono de documental nocturno con ironía amable. ~150 palabras/minuto.
- Tercera persona. Nunca "yo descubrí". Puede hablarle al espectador ("mira", "fíjate").
- Estructura de cada guion: misterio → explicación visual → revelación → remate con guiño o pregunta.
- Humor seco 6/10. Sin saludos ni despedidas.
- En los guiones: `[pausa]`, `[pausa larga]` y las indicaciones visuales `[Animación: ...]` (estas últimas NO se leen en voz alta).
- **Etiquetas de ElevenLabs v3, siempre**, en español como las muestra su interfaz: `[en tono juguetón]`, `[con entusiasmo]`, `[riendo por lo bajo]`, `[suspirando]`, etc. Pocas por guion, al servicio del guiño. Van tal cual en `guion.md`: la alineación descarta cualquier `[marca]` que no sea pausa o animación.
- Números y siglas escritos como se pronuncian ("veintitrés", "pe cinco jota ese").
- **Puntuación para la voz** (decide cómo termina cada frase; con solo puntos, todos los cierres caen igual y suena a lectura):
  - `¿…?` para hablarle al espectador ("Parece quieto, ¿verdad?"). El tono sube o se queda abierto.
  - Comas para unir frases cortas seguidas ("Cinco veces, y nadie le pidió…"). El tono queda en continuación.
  - `...` para el suspenso del misterio. El final queda en el aire.
  - `¡…!` para el dato que golpea.
  - El punto, solo para los cierres de verdad (la revelación, el remate).
  - Ejemplo de referencia: `episodios/nº00-prueba/guion.md`.
- Música: **"misterio con guiño"**, marimba en arpegios sobre sub-grave, La menor, 92 BPM, en estéreo. **Va al ritmo de la animación**, estilo motion graphics: sube hacia la revelación, calla un tiempo justo antes y golpea en ella. Baja cuando entra el dato clave. Sustituye al lo-fi del plan original: el usuario la eligió el 2026-11-07, tras comparar bocetos con dos reels de referencia (pulso rápido, muchas notas cortas, energía que acompaña a la imagen).
- Desde `nº04` (2026-11-08) la música es la **"viva"** (`audio.estilo: "viva"`): instrumentos grabados reales (VCSL, CC0: marimba, vibráfono, glockenspiel, caja, palmadas, hi-hat…) con batería y más energía; la sintetizada sonaba "a juguete". **Cada episodio suena distinto**: tonalidad menor, progresión, patrón y instrumento del gancho en `config.audio` (o por la semilla), y el gancho melódico sale de la semilla. Los efectos afinados del episodio suman `tono` (ver `docs/sonido.md`).
- Golpes visuales y musicales solo en la revelación de verdad. Nada de zoom con rebote en cada golpe ni de destellos de color en momentos que no sorprenden (se probaron en `nº04` y se quitaron).
- Firma sonora: traqueteo de impresora riso en cada transición; zumbido grave que crece antes de la revelación.

---

## 3 · Formato en pantalla: "Lienzo + panel"
- Lienzo 1080×1920, 30 fps. Sin cámara: nada grabado; todo se genera con código. Una cámara virtual 3D (`tres.ts`) sí se permite en las partes que lo pidan.
- Base: animación a pantalla completa.
- Panel de datos: sube desde abajo SOLO en episodios con simulación o números. Ocupa ~35 % inferior útil; la animación se compacta arriba. Contiene contadores, fórmula o mini gráfico en dither.
- Zonas seguras (no poner nada importante): ~200 px arriba, ~380 px abajo, ~140 px a la derecha.

### Subtítulos (palabra a palabra, sincronizados con el JSON de tiempos)
- Normal: Space Mono ~44 px, 2–3 palabras visibles, palabra activa en tinta A, sobre una tira de papel discreta en el tercio inferior (por encima de la zona segura).
- Impacto: Archivo Black ~120 px al centro, para el dato clave o el tema principal. Máximo 1–3 por video, marcados en el guion.

### Estructura temporal (30–45 s)
0–3 s portada/gancho · 3–25 s misterio y explicación · 25–38 s revelación · 38–45 s remate. El último fotograma enlaza con el primero (loop): desde `nº04` son iguales, porque el título entra después del fotograma 0.
- La imagen no se queda quieta: planos de cámara con la voz, acercamientos lentos y detalles (`camara.ts`, `detalles.ts`, ver `docs/kit.md`). El informe avisa si hay más de 4 s seguidos de imagen quieta. Desde `nº06` **sin recuadro de visor** (el usuario, 2026-11-11): la animación va centrada en la pantalla (x = 540) y ocupa casi todo el alto; los subtítulos y rótulos llevan su tira de papel encima. Solo lo importante (texto, datos, el foco de la escena) evita las zonas seguras; el fondo de la animación puede pasar por debajo. `nº04` y `nº05` conservan el visor.
Excepción aprobada por el usuario: un episodio puede durar más si lo pide el tema. `nº01` dura 71,6 s porque explica lo que se sabe y lo que no.
Otra excepción (2026-11-14): `nº08b-moho-edicion` recrea `nº08` en estilo **"edición"** (`config.estilo: "edicion"`: color directo sin filtro riso, 3D, glitch en los cortes y música compuesta desde la imagen), a partir de dos ediciones de referencia. Es una prueba pedida para ese episodio: no cambia la estética riso del canal. Ver `docs/kit.md` y `docs/sonido.md`.

### Portada
Gancho de los primeros 2,6 s: "nº XX / tema" en Space Mono, título grande en Archivo Black y la animación detrás, con movimiento desde el primer instante. El fotograma 0 **ya no es la miniatura** (el usuario la elige al publicar, 2026-11-08): queda sin título, igual que el último, y el título se imprime palabra a palabra, una por corchea, con un golpe de sello cada una. Todo lo importante dentro del recorte central 3:4 (1080×1440), por si la miniatura sale de estos fotogramas. `nº01`–`nº03` ya están publicados con la portada fija: no se vuelven a renderizar.

---

## Producción y reglas técnicas

Todo corre en Docker; `producir.py` es el único coordinador en Windows, con Python estándar. El flujo es guion → voz/tiempos → mezcla → render → informe y fotogramas. La voz externa es fuente versionada; no se regenera con Chatterbox mientras exista `voz_externa.*`.

- Las dependencias y modelos viven en volúmenes Docker; no instalar Node, CUDA ni paquetes de IA en Windows. Solo `voz` necesita GPU; `analisis` reutiliza su imagen sin reservarla.
- Rutas relativas a la raíz del repo en código y configuración. No versionar MP4, `voz.wav`, `mezcla.wav`, `tiempos.json`, cachés ni stills.
- Dibujar con `useDibujo`: volúmenes en `capas.a/b/k` tramadas; textos y líneas finas en `capas.solido.a/b/k`; papel con `recortarPapel`. El color lo pone `RisoFilter` por CPU. Escalar antes de tramar, sin CSS sobre el resultado.
- Usar anclas del guion con `tiempoDeAncla`, no segundos fijos salvo valores de reserva. `linea.ts` es puro y se comparte entre sketch y sonido. Los eventos rítmicos van al pulso de `pulsoDe(config)`.
- `config.json`: `numero`, `tema`, `titulo`, `semilla`, `tintas`, `impactos` (máx. 3), `panel` opcional, `cola`, `ritmo`, `audio` y `voz` opcional. Se permite sustituir como máximo una tinta por una de serie. Las entradas de impacto son `sello`, `letras` y `barrido`; `letras` alarga su duración y se rechazan solapes.
- El panel debe bajar antes del final (`hasta`, segundos o ancla) y el sketch repetir su estado de portada en el último fotograma para cerrar el loop. No hay subtítulos normales durante la portada (0–2,6 s).
- Space Mono latino no incluye griego ni flechas; usar `t` y `:` en fórmulas y etiquetas.
- Comprobar las afirmaciones con simulación propia o fuentes antes de grabar voz, y versionar `verificar.py`/`verificar.mjs` con el episodio. Rotular las metáforas visuales como «esquema».
- **Fuente en pantalla** (desde `nº08`, pedido del usuario): mientras la voz cuenta lo que hicieron, descubrieron o concluyeron unos científicos (o da un dato con fuente), la fuente oficial va en pantalla con `fuenteEnPantalla()` (`detalles.ts`): «fuente Autor y otros, Revista volumen, página (año)», arriba bajo la numeración, aunque la voz no la diga.
- El informe mide LUFS, pico y true peak del MP4, genera hoja de contactos, comprueba el loop con una heurística y mide el dinamismo (aviso si la imagen está quieta más de 4 s). `--pulso` compara ataques con el BPM configurado; no estima el tempo. Revisar siempre visualmente los stills y la hoja tras producir.
- Un informe fallido devuelve código 2: el MP4 puede ser nuevo y los archivos de `stills/` anteriores. Los tramos usan `hoja_tramo.png` e `informe_tramo.txt`.

### Reglas para sketches generativos (críticas)
- Render determinista: todo depende de `useCurrentFrame()`. Nada de `requestAnimationFrame`, `Date.now()` ni `Math.random()`.
- Aleatoriedad con PRNG con semilla (por ejemplo mulberry32) guardada en la config del episodio.
- Simulaciones con estado (boids, autómatas, partículas): se precalculan por fotograma o se recalculan de forma determinista desde el fotograma 0. El fotograma N debe ser idéntico en la vista previa y en el render.
- Los sketches dibujan en escala de grises o con máscaras por tinta. El color final lo pone `<RisoFilter>`.


## Documentación según la tarea

- [Producción](docs/produccion.md): estructura del repo y episodios, opciones de `producir.py`, config, capas y anclas.
- [Voz](docs/voz.md): TTS, caché, alineación, interfaz y tomas de ElevenLabs.
- [Kit](docs/kit.md): herramientas de motion graphics y motor 3D; leer antes de crear un sketch.
- [Sonido](docs/sonido.md): instrumentos, composición, mezcla, limitador y sincronía.
- [Render](docs/render.md): CPU, rendimiento e interpretación de los informes.
- [nº01](episodios/nº01-hormiga-de-langton/NOTAS.md), [nº02](episodios/nº02-juego-del-caos/NOTAS.md), [nº03](episodios/nº03-bandada/NOTAS.md), [nº04](episodios/nº04-lorenz/NOTAS.md) y [nº08b](episodios/nº08b-moho-edicion/NOTAS.md): rigor y decisiones de cada episodio.

## Comandos habituales (PowerShell, raíz del repo)

```powershell
python producir.py nº02-juego-del-caos --solo-video --stills --pulso
python producir.py nº02-juego-del-caos --solo-video --tramo 40-60
python producir.py nº02-juego-del-caos --voz-externa toma.mp3
python producir.py nº00-prueba --solo-voz
```

### Docker y comprobaciones
```
docker compose build video                          # tras cambiar video/Dockerfile
docker compose run --rm video npm install           # tras cambiar video/package.json
docker compose up -d video                          # Remotion Studio en http://localhost:3000
docker compose run --rm video npx remotion still ep00-prueba out/portada.png --frame=0
docker compose run --rm video npx tsc --noEmit -p . # comprobar tipos
docker compose build voz                            # tras cambiar voz/requirements.txt (tarda: ~5 GB)
docker compose run --rm voz python voz/generar.py --guion episodios/nº00-prueba/guion.md --salida episodios/nº00-prueba/
docker compose up -d voz                            # interfaz de pruebas en http://localhost:7860
docker compose run --rm video node scripts/sonido_muestrario.mjs   # banda del muestrario
docker compose run --rm video npx remotion render muestrario out/muestrario.mp4 --props='{"guias":false}'
```
La primera ejecución de voz descarga los pesos de Chatterbox (~3 GB) y de Whisper `small` al volumen `modelos_voz`.
Los stills del comando Remotion de ejemplo se guardan en `video/out/`; los de `producir.py --stills`, en `episodios/<ep>/stills/`.


```powershell
docker compose run --rm video node scripts/verificar_auditoria.mjs
python -m unittest discover -s herramientas -p "test_*.py"
```

## Cómo trabajar en este repo
- Antes de un cambio grande, propón un plan breve y espera aprobación.
- Respeta la paleta, las tipografías y las zonas seguras sin excepciones. Si algo no encaja, pregunta en vez de inventar un estilo nuevo.
- Verifica visualmente: `producir.py --stills` (portada, subtítulo normal, dato de impacto y panel) y la hoja de contactos `stills/hoja.png`; revísalos antes de dar algo por terminado.
- Código y comentarios en español.
