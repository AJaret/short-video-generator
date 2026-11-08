# Canal de reels · Programación creativa con estética riso dither

Este repositorio produce videos verticales (Reels / TikTok / Shorts) de 30–45 s sobre programación creativa, matemáticas visuales y algoritmos de la naturaleza. Todo se genera con código. Lee este archivo completo antes de crear o modificar cualquier cosa: define la identidad del canal y las reglas técnicas.

## Equipo de trabajo
- GPU: NVIDIA RTX 2060 (6 GB VRAM) · CPU: Intel i9-9900 · Sistema: Windows 11 (confírmalo antes de dar comandos).
- Todo corre en **Docker** (Docker Desktop + WSL2). La GPU llega a los contenedores con `--gpus all` / `gpus: all` en compose; no se instalan drivers ni CUDA dentro de WSL. En Windows solo hay Python 3.12, sin paquetes, para ejecutar `producir.py`. Node no está instalado en Windows.
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
- Desajuste de registro entre tintas: 2–6 px, con temblor leve y determinista.
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
- Números y siglas escritos como se pronuncian ("veintitrés", "pe cinco jota ese").
- **Puntuación para la voz** (decide cómo termina cada frase; con solo puntos, todos los cierres caen igual y suena a lectura):
  - `¿…?` para hablarle al espectador ("Parece quieto, ¿verdad?"). El tono sube o se queda abierto.
  - Comas para unir frases cortas seguidas ("Cinco veces, y nadie le pidió…"). El tono queda en continuación.
  - `...` para el suspenso del misterio. El final queda en el aire.
  - `¡…!` para el dato que golpea.
  - El punto, solo para los cierres de verdad (la revelación, el remate).
  - Ejemplo de referencia: `episodios/nº00-prueba/guion.md`.
- Música: **"misterio con guiño"**, marimba en arpegios sobre sub-grave, La menor, 92 BPM, en estéreo. **Va al ritmo de la animación**, estilo motion graphics: sube hacia la revelación, calla un tiempo justo antes y golpea en ella. Baja cuando entra el dato clave. Sustituye al lo-fi del plan original: el usuario la eligió el 2026-11-07, tras comparar bocetos con dos reels de referencia (pulso rápido, muchas notas cortas, energía que acompaña a la imagen).
- Firma sonora: traqueteo de impresora riso en cada transición; zumbido grave que crece antes de la revelación.

---

## 3 · Formato en pantalla: "Lienzo + panel"
- Lienzo 1080×1920, 30 fps. Sin cámara.
- Base: animación a pantalla completa.
- Panel de datos: sube desde abajo SOLO en episodios con simulación o números. Ocupa ~35 % inferior útil; la animación se compacta arriba. Contiene contadores, fórmula o mini gráfico en dither.
- Zonas seguras (no poner nada importante): ~200 px arriba, ~380 px abajo, ~140 px a la derecha.

### Subtítulos (palabra a palabra, sincronizados con el JSON de tiempos)
- Normal: Space Mono ~44 px, 2–3 palabras visibles, palabra activa en tinta A, sobre una tira de papel discreta en el tercio inferior (por encima de la zona segura).
- Impacto: Archivo Black ~120 px al centro, para el dato clave o el tema principal. Máximo 1–3 por video, marcados en el guion.

### Estructura temporal (30–45 s)
0–3 s portada/gancho · 3–25 s misterio y explicación · 25–38 s revelación · 38–45 s remate. Procura que el último fotograma enlace con el primero (loop).
Excepción aprobada por el usuario: un episodio puede durar más si lo pide el tema. `nº01` dura 71,6 s porque explica lo que se sabe y lo que no.

### Portada
El primer fotograma es también la miniatura: "nº XX / tema" en Space Mono, título grande en Archivo Black y un fotograma clave de la animación. Todo lo importante dentro del recorte central 3:4 (1080×1440).

---

## 4 · Stack técnico

### Cadena de producción
```
guion.md ─▶ voz/ (Python, GPU) ─▶ voz.wav + tiempos.json
                                          │
Sketch.tsx (canvas/WebGL) ─▶ video/ (Remotion, plantilla del canal) ─▶ MP4 1080×1920

Todo lo coordina producir.py desde la raíz del repo.
```

### Estructura del repositorio (monorepo)
```
canal-reels/
  CLAUDE.md
  docker-compose.yml   # servicios: video (Remotion) y voz (PyTorch + CUDA, Fase 2)
  producir.py          # orquestador: un comando produce el episodio completo
  voz/                 # Python: estudio de voz (TTS local + tiempos por palabra)
    app.py             #   interfaz web local para pruebas
    generar.py         #   CLI usada por producir.py
    requirements.txt
  video/               # Remotion + TypeScript: plantilla del canal y render
  assets/
    voz_canal.wav      # audio de referencia de la voz del canal (identidad, no cambiar)
    musica/
    sfx/               # impresora riso, zumbido grave
  episodios/
    nº03-lorenz/ ...
```
- Las dependencias viven en imágenes y volúmenes de Docker, no en el disco de Windows: `node_modules` de `video/` está en el volumen `video_node_modules` (leerlo desde Windows sería muy lento) y la caché de modelos irá en su propio volumen. El repo se monta en `/repo` dentro de los contenedores.
- `.gitignore`: `.venv/`, `node_modules/`, caché de modelos, `out/` y los audios/videos generados (`episodios/*/voz.wav`, `episodios/*/tiempos.json`, `episodios/*/.hash_voz`, `episodios/*/stills/`, `*.mp4`).
- Las rutas siempre relativas a la raíz del repo, nunca absolutas.

### Orquestador: `producir.py`
```
python producir.py episodios/nº03-lorenz            # voz + tiempos + render
python producir.py episodios/nº03-lorenz --solo-voz
python producir.py episodios/nº03-lorenz --solo-video
python producir.py nº03-lorenz --stills          # además: fotogramas de verificación en episodios/<ep>/stills/
python producir.py nº03-lorenz --borrador        # 1 toma de voz por bloque (3× más rápido)
python producir.py nº03-lorenz --forzar-voz      # regenerar la voz aunque el guion no cambie
```
- Se ejecuta en Windows (PowerShell), con solo la librería estándar. Comprueba el episodio y el `config.json`, comprueba que Docker responda y, si la interfaz de voz está abierta, la detiene para liberar la GPU.
- `--stills` elige solos los fotogramas a revisar: portada (0), subtítulo normal (la primera palabra tras la portada sin impacto ni panel), dato de impacto (0,4 s después de su ancla) y panel (1,5 s después de que sube). Cada vez que se produce un episodio hay que revisarlos.
- Tiempos de referencia de `nº00` (12 s de voz): la voz con 3 tomas tarda ~4 min, y el render con los 4 fotogramas ~2,5 min.
Pasos: 1) lee `guion.md` y `config.json` · 2) genera `voz.wav` y `tiempos.json` con `voz/generar.py` (`docker compose run --rm voz ...`), saltándose el paso si el guion no cambió (compara un hash) · 3) libera la GPU (el contenedor de voz termina) · 4) lanza `npx remotion render` en el servicio `video` con el ID de composición del episodio · 5) deja el MP4 en `episodios/<ep>/<ep>.mp4`.
ID de composición: el nombre de la carpeta con `nº` → `ep` y sin caracteres fuera de `[a-zA-Z0-9-]` (`nº03-lorenz` → `ep03-lorenz`). La regla está en `video/src/episodios.ts` y `producir.py` debe usar la misma.

### Voz: `voz/` (Python)
- TTS local con clonación de voz y licencia comercial (modelo elegido tras investigar; candidato principal: Chatterbox Multilingual, MIT).
- Usa siempre `assets/voz_canal.wav` como referencia por defecto.
- Exporta `voz.wav` y `tiempos.json` con inicio/fin de cada palabra del guion original (alineación forzada o Whisper con timestamps por palabra).
- CLI: `python voz/generar.py --guion episodios/<ep>/guion.md --salida episodios/<ep>/`
- Implementación actual (`voz/nucleo.py`):
  - Modelos: `chatterbox-tts==0.1.7` (`ChatterboxMultilingualTTS`, `language_id="es"`, MIT; las salidas llevan la marca de agua inaudible Perth) y Whisper `small` para los tiempos.
  - El guion se parte en **bloques**: todo el texto entre dos `[pausa]`, `[pausa larga]` o cambios de párrafo se genera de una vez (si pasa de ~260 caracteres, se parte por frases). Los títulos `#` y `[Animación: …]` no se leen. Generar frase a frase sonaba robótico: cada frase llevaba su propia entonación de "frase suelta".
  - Silencios entre bloques: 0,45 s con `[pausa]`, 0,9 s con `[pausa larga]` y 0,5 s entre párrafos. Bajo toda la pista va un tono de sala a −66 dB (`tono_sala_db`), porque el salto de la voz al cero digital se nota y suena artificial.
  - **Mejor de 3 tomas:** Chatterbox genera 3 tomas de cada bloque (`tomas`, con semillas distintas) → se libera → Whisper analiza todas → se libera → se queda la mejor de cada bloque según `puntuar_toma`:
    - palabras que Whisper entiende (×200): nitidez de la articulación.
    - microcortes dentro de las palabras (×1,5): voz entrecortada.
    - palabras repetidas al final (×10).
    - −15 si un bloque que termina en punto **sube** el tono al final, porque suena a frase sin terminar.

    Si la mejor toma sigue siendo ilegible (menos del 60 % de palabras), el ciclo se repite una vez para ese bloque. El costo es el tiempo: unos 4 minutos por cada 12 s de voz. Con `"voz": {"tomas": 1}` en `config.json` es tres veces más rápido, para borradores.
  - Puerta de ruido (`compuerta_db = −18`): entre palabras, lo que suena muy por debajo de la voz (respiraciones, murmullos, chasquidos del modelo) baja 18 dB con rampas de 40 ms. No toca la voz: se mide que las palabras y sus colas pierden 0 dB.
  - Final de cada bloque: Whisper marca el fin de la última palabra antes de tiempo, y cortar ahí "corta" la voz. `fin_natural` sigue la energía desde ese punto hasta que la voz cae 30 dB y se mantiene así 120 ms; luego deja 60 ms de aire y aplica un fundido de salida de 80 ms. El tope es +0,45 s, para no conservar respiraciones.
  - Chatterbox a veces **repite el final** de frases cortas. Whisper detecta las palabras que sobran tras el final del guion y el corte nunca entra en ellas.
  - Whisper va **sin `initial_prompt`**: con el texto exacto como prompt, alucina otra cosa. Lo que oye se empata con las palabras del guion original (difflib), y las que no empatan (por ejemplo "quince" frente a "15") se reparten entre sus vecinas. Así los subtítulos muestran siempre el texto del guion.
  - Volumen: −16 LUFS, pico máximo −1 dB. WAV a 24 kHz (la frecuencia de Chatterbox).
  - Ajustes por defecto, elegidos de oído con el usuario el 2026-11-07:
    - exageración 0,8: más emoción, porque 0,5 sonaba monótono.
    - cfg 0,5.
    - temperatura 0,8: con 0,95 articula peor ("gida" por "gira"), hay más microcortes y los cierres suben.
    - `min_p` 0,05 y `top_p` 1,0.

    Se pueden cambiar por episodio con un bloque `"voz": {...}` en `config.json` o con `--temperatura 0.85`, etc. La semilla sale de `config.json`.
  - Caché: `.hash_voz` guarda el hash del guion, los ajustes, la referencia y las versiones. Si no cambia, no se regenera (salvo con `--forzar`).
  - `tiempos.json`: `{palabras: [{texto, inicio, fin}], duracion, meta: {segmentos, palabras_por_minuto, empatadas_whisper}}`.
- Interfaz de pruebas: `docker compose up -d voz` → http://localhost:7860. Sirve para probar frases sueltas y para generar el episodio completo.
- **Voz externa (ElevenLabs, locución real…):** desde `nº01` el usuario prefiere ElevenLabs, porque la voz de Chatterbox no le convenció.
  - Importación: `python producir.py <ep> --voz-externa toma.mp3` copia el audio a `episodios/<ep>/voz_externa.mp3`. Ese archivo **se versiona**, porque es la fuente y no se puede regenerar.
  - Mientras ese archivo exista, `generar.py` no usa Chatterbox: Whisper alinea el audio con el guion, convierte el resultado a `voz.wav` (−16 LUFS) y saca `tiempos.json`. Tarda ~30 s.
  - El resumen avisa de lo que Whisper oyó y **no está en el guion** (por ejemplo, una etiqueta de emoción leída en voz alta).
  - Para volver a Chatterbox, basta con borrar `voz_externa.*`.
  - El texto que se pega en ElevenLabs debe tener **las mismas palabras que `guion.md`**; las etiquetas `[curious]` y los `<break>` dan igual. Si cambian palabras, hay que actualizar el guion. Formato que funcionó en `nº01`: Eleven v3 con etiquetas en inglés (`[curious]`, `[mischievously]`, `[excited]`, `[serious]`) y puntos suspensivos para las pausas; el usuario evitó `[whispers]`/`[softly]` porque el cambio de volumen sonaba brusco.
  - Licencia: el plan gratuito de ElevenLabs normalmente no permite uso comercial. Antes de publicar, el usuario debe confirmar que su plan lo permite.

### Video: `video/` (Remotion + TypeScript)
- Lee los archivos del episodio (`voz.wav`, `tiempos.json`, `config.json`, `Sketch.tsx`) desde `episodios/<ep>/`.
- Licencia de Remotion: gratis para individuos y empresas de hasta 3 personas (uso comercial incluido).
- Componentes de plantilla, reutilizables en todos los episodios:
  - `<RisoFilter>`: post-proceso WebGL de todo el fotograma (separación en tintas, dither Bayer, desajuste de registro, multiply, grano).
  - `<Portada>`, `<SubtituloNormal>`, `<DatoImpacto>`, `<PanelDatos>`, `<Numeracion>`.
  - `<GuiaZonasSeguras>`: superpone las zonas seguras solo en la vista previa, nunca en el render.
- Cada episodio solo aporta su sketch generativo y su configuración.
- Los episodios se descubren solos (`require.context` sobre `episodios/*/`) e importan la plantilla desde `@canal`.

### Sistema de capas (cómo se dibuja todo)
- Nada se pinta en el DOM. Cada componente (sketch incluido) registra una función con `useDibujo(ORDEN.x, (capas, info) => {...})`, y `<RisoFilter>` las ejecuta en orden en cada fotograma.
- Seis canvas 2D, uno por tinta y por tipo:
  - `capas.a`, `capas.b`, `capas.k` (**tramadas**): formas, volumen y tonos. Pasan por el dither Bayer 4×4 de 3 px.
  - `capas.solido.a/b/k` (**sólidas**): texto y líneas finas. Sin trama (umbral al 50 %) y con el mismo desajuste de registro que su tinta. El punto de 3 px rompe la letra pequeña: el texto va siempre aquí.
- Cobertura de tinta = alfa × (1 − luminancia): negro opaco = 100 %, gris = tono tramado, transparente = sin tinta. Usa `cobertura(v)` como color de relleno.
- Para dejar papel (tiras de subtítulos, panel, fondos de etiquetas) usa `recortarPapel(capas, trazado)`: borra lo que ya está dibujado debajo, en las seis capas.
- La plancha negra es la referencia de registro (no se desplaza). A y B se mueven 2–3 px en sentidos opuestos, con un temblor suave de ±0.8 px.
- Bordes imperfectos: `trazarRectIrregular` y `trazarLineaIrregular` (deterministas por semilla).

### config.json
`numero`, `tema`, `titulo`, `semilla`, `tintas` (`{a, b}`; se valida que como mucho una sea de serie), `impactos` (máx. 3: `{texto, ancla | desde, duracion}`), `panel` (`{ancla | desde, hasta?, titulo?}`, solo si el episodio lleva datos; `hasta` puede ser un número de segundos o un ancla), `cola` (segundos tras la última palabra) y opcionalmente `voz` (ajustes de la voz).
- **Anclas:** una palabra o frase del guion, sin importar acentos, mayúsculas ni puntuación. Se busca en `tiempos.json` el momento en que la voz la dice. Conviene anclar todo (impactos, panel, momentos del sketch) en lugar de usar segundos, porque así sobrevive a cualquier regeneración de la voz.
- **Sincronizar el sketch con la narración:** el sketch recibe `tiempos` en sus props y usa `tiempoDeAncla(tiempos, "paso diez mil")` para saber en qué segundo pasa algo. Debe tener tiempos por defecto para cuando todavía no hay voz. Ejemplo: `episodios/nº01-hormiga-de-langton/Sketch.tsx`, cuya línea de tiempo pasa por anclas del guion.
- El sketch puede exportar `panel(frame, {fps, duracion, tiempos, config})` con contadores, fórmula y mini gráfico.
- **Durante la portada (0–2,6 s) no hay subtítulos normales**, aunque la voz ya hable: el primer fotograma es la miniatura.
- **Loop:** el sketch dibuja en la portada el mismo estado que en su último fotograma, y el panel baja antes del final (`hasta`), para que el último fotograma coincida con el primero.
- **Fuentes:** el subconjunto latino de Space Mono no tiene griego ni flechas (θ, →). Usa texto ("t", ":") en fórmulas y etiquetas.
- **Rigor:** las afirmaciones del guion se comprueban, con una simulación propia o con fuentes, antes de grabar la voz. Lo que es una metáfora visual se rotula como "esquema". En `nº01`: la autopista empieza en el paso 9 977 (simulado); que la hormiga nunca queda encerrada está demostrado (Bunimovich y Troubetzkoy, 1992); que puede calcular cualquier cosa también (Gajardo, Moreira y Goles, 2002); y que siempre acabe en autopista sigue sin demostrarse.

### Reglas para sketches generativos (críticas)
- Render determinista: todo depende de `useCurrentFrame()`. Nada de `requestAnimationFrame`, `Date.now()` ni `Math.random()`.
- Aleatoriedad con PRNG con semilla (por ejemplo mulberry32) guardada en la config del episodio.
- Simulaciones con estado (boids, autómatas, partículas): se precalculan por fotograma o se recalculan de forma determinista desde el fotograma 0. El fotograma N debe ser idéntico en la vista previa y en el render.
- Los sketches dibujan en escala de grises o con máscaras por tinta. El color final lo pone `<RisoFilter>`.

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
  - **Golpe riso** (`ritmo.golpeVisual`, activo por defecto): en cada tiempo el desajuste de registro de A y B da un salto de +0,9 px que cae en 0,12 s, y en cada compás el fotograma se escala un 1 %. No actúa durante la portada.
- `banda.ts` (reglas de mezcla, en **estéreo**):
  - Plan musical:
    - Intensidad 0,2 en la portada; sube de 0,3 a 0,85 hasta la revelación (`audio.revelacion`, llevada al tiempo más cercano).
    - **Un tiempo de silencio** justo antes de la revelación y **golpe** en ella.
    - Dos compases a tope; luego intensidad media (0,65) mientras se explica, hasta `audio.remate` (ancla, por defecto 2 compases después). Después se reduce hasta el acorde final.
    - `audio.golpes` (anclas) añade más golpes, cada uno con su tiempo de silencio antes.
  - Música a −18 dB respecto a la voz (`audio.musicaDb`). La base baja 3 dB más mientras habla la voz y 7 dB más durante los impactos; los golpes no bajan.
  - Efectos, todos en el pulso: impresora al salir la portada, papel al subir y bajar el panel, sello + impresora corta en cada impacto, y zumbido durante los 4 s previos a la revelación.
  - La voz y los efectos van al centro, con −3 dB por canal. Salida a **−14 LUFS**: la mezcla mide su propia sonoridad con `lufs()` (BS.1770, coincide con pyloudnorm) y se ajusta sola con `normalizarLufs()` y un limitador enlazado a −1 dBFS. No hay ganancias fijas que calibrar: antes, una ganancia fija dejó `nº01` a −12,8 al cambiar la voz.
- **Efectos propios de un episodio:** `episodios/<ep>/sonido.ts` exporta `eventos({config, tiempos, duracion, pulso})` y devuelve una lista de tics con `{t, frecuencia, volumenDb, duracion?, brillo?, shepard?, pan?}`. Con `efecto: 'impresora' | 'papel'` se pide un efecto de la plantilla, por ejemplo la impresora en cada corte de escena.
  - Para que imagen y sonido coincidan, la línea de tiempo del sketch va en un módulo **puro** (`linea.ts`, sin React), compartido por `Sketch.tsx` y `sonido.ts`, y **en la rejilla de pulso**. Ejemplo: `nº01`:
    - Un paso de la hormiga por tiempo: salta al empezar el tiempo, frenando, y luego espera. Cada paso suena un escalón más arriba en la pentatónica de La menor, así que los pasos forman parte de la música.
    - La cámara salta en cada tiempo.
    - En la aceleración suena una escalera de Shepard en corcheas, luego semicorcheas y luego fusas.
    - La autopista aparece en el golpe de la revelación.
    - **Escenas con cortes secos en el pulso**, cada una anclada a una frase del guion: principal → 4 tableros con dibujos de partida distintos → cuadro que la hormiga siempre rompe → cinta (esquema de una máquina que cuenta en binario) → final, que vuelve a la portada.
    - La simulación está en otro módulo puro (`simulacion.ts`), que también usa el sonido; por ejemplo, para que suene un tic en cada salida del cuadro.
    - Los dibujos de partida se eligieron simulando 400 semillas con el mismo generador (`out/buscar_tableros.mjs`): 396 acaban en autopista antes de 40 000 pasos. En pantalla solo se muestra lo comprobado.
    - En el panel, una lista de comprobación se completa a medida que la voz lo dice.
  - Lección aprendida: 30 tics por segundo a la misma altura se oyen como un zumbido. Para "cada paso más alto" hace falta que cada tic suba de verdad: Shepard, o un rango amplio.
- Verificación:
  - `pyloudnorm` en el servicio `voz` para el volumen total y los picos.
  - El tempo se mide en el canal lateral (L−R), donde no está la voz. Con la voz, el detector se confunde: en `nº01` daba 126 BPM en la mezcla y 92,3 BPM en el lateral.
  - Los picos de cambio entre fotogramas del MP4 se comparan con la rejilla. En `nº01`, el 79 % cae a ≤ 2 fotogramas de un tiempo; los demás son cambios de subtítulo, que siguen a la voz.
  - La correlación L/R de la mezcla sale ~1 porque la voz al centro domina. Es normal: la música sí es estéreo.

### Render
- `npx remotion render` a 1080×1920, 30 fps, H.264, CRF 18, audio AAC.
- WebGL en el render: dentro de Docker, Chrome no ve la GPU, así que se usa `swangle` (SwiftShader por CPU), ya fijado en `video/remotion.config.ts`. Si los shaders salen en negro o falla WebGL, revisa esto primero.
- Fuentes empaquetadas desde npm (`@fontsource`): el render no depende de internet.

### Comandos (desde la raíz del repo, en PowerShell)
```
docker compose build video                          # tras cambiar video/Dockerfile
docker compose run --rm video npm install           # tras cambiar video/package.json
docker compose up -d video                          # Remotion Studio en http://localhost:3000
docker compose run --rm video npx remotion still ep00-prueba out/portada.png --frame=0
docker compose run --rm video npx tsc --noEmit -p . # comprobar tipos
docker compose build voz                            # tras cambiar voz/requirements.txt (tarda: ~5 GB)
docker compose run --rm voz python voz/generar.py --guion episodios/nº00-prueba/guion.md --salida episodios/nº00-prueba/
docker compose up -d voz                            # interfaz de pruebas en http://localhost:7860
```
La primera ejecución de voz descarga los pesos de Chatterbox (~3 GB) y de Whisper `small` al volumen `modelos_voz`.
Los stills se guardan en `video/out/`.

### Estructura de un episodio
```
episodios/
  nº03-lorenz/
    guion.md        # texto con [pausa] y [Animación: ...]
    voz.wav         # generado
    tiempos.json    # generado
    config.json     # número, título, tintas, semilla, momentos de impacto, ¿panel?
    Sketch.tsx      # la animación generativa del episodio
```
`episodios/nº00-prueba/` es el episodio de prueba de la plantilla y de la voz. Su `voz.wav` y su `tiempos.json` se generan igual que en cualquier episodio. Para probar un sketch sin GPU hay un generador de tiempos falsos: `node scripts/tiempos_falsos.js ../episodios/<ep>/guion.md ../episodios/<ep>/tiempos.json`, que se ejecuta dentro del servicio `video`.

---

## Cómo trabajar en este repo
- Antes de un cambio grande, propón un plan breve y espera aprobación.
- Respeta la paleta, las tipografías y las zonas seguras sin excepciones. Si algo no encaja, pregunta en vez de inventar un estilo nuevo.
- Verifica visualmente: renderiza fotogramas sueltos (`npx remotion still`) de portada, subtítulo normal, dato de impacto y panel, y revísalos antes de dar algo por terminado.
- Código y comentarios en español.
