# Canal de reels · Programación creativa con estética riso dither

Este repositorio produce videos verticales (Reels / TikTok / Shorts) de 30–45 s sobre programación creativa, matemáticas visuales y algoritmos de la naturaleza. Todo se genera con código. Lee este archivo completo antes de crear o modificar cualquier cosa: define la identidad del canal y las reglas técnicas.

## Equipo de trabajo
- GPU: NVIDIA RTX 2060 (6 GB VRAM) · CPU: Intel i9-9900 · Sistema: Windows 11 (confírmalo antes de dar comandos).
- Todo corre en **Docker** (Docker Desktop + WSL2). La GPU llega a los contenedores con `--gpus all` / `gpus: all` en compose; no se instalan drivers ni CUDA dentro de WSL. En Windows no hay Python ni Node instalados (salvo Python básico para `producir.py`, a partir de la Fase 3).
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
- Música: lo-fi ambient analógico, 70–85 BPM, vinilo + sintes de cinta. Baja cuando entra el dato clave.
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
- `.gitignore`: `.venv/`, `node_modules/`, caché de modelos, `out/` y los audios/videos generados (`episodios/*/voz.wav`, `episodios/*/tiempos.json`, `*.mp4`).
- Las rutas siempre relativas a la raíz del repo, nunca absolutas.

### Orquestador: `producir.py`
```
python producir.py episodios/nº03-lorenz            # voz + tiempos + render
python producir.py episodios/nº03-lorenz --solo-voz
python producir.py episodios/nº03-lorenz --solo-video
```
Pasos: 1) lee `guion.md` y `config.json` · 2) genera `voz.wav` y `tiempos.json` con `voz/generar.py` (`docker compose run --rm voz ...`), saltándose el paso si el guion no cambió (compara un hash) · 3) libera la GPU (el contenedor de voz termina) · 4) lanza `npx remotion render` en el servicio `video` con el ID de composición del episodio · 5) deja el MP4 en `episodios/<ep>/<ep>.mp4`.
ID de composición: el nombre de la carpeta con `nº` → `ep` y sin caracteres fuera de `[a-zA-Z0-9-]` (`nº03-lorenz` → `ep03-lorenz`). La regla está en `video/src/episodios.ts` y `producir.py` debe usar la misma.

### Voz: `voz/` (Python)
- TTS local con clonación de voz y licencia comercial (modelo elegido tras investigar; candidato principal: Chatterbox Multilingual, MIT).
- Usa siempre `assets/voz_canal.wav` como referencia por defecto.
- Exporta `voz.wav` y `tiempos.json` con inicio/fin de cada palabra del guion original (alineación forzada o Whisper con timestamps por palabra).
- CLI: `python voz/generar.py --guion episodios/<ep>/guion.md --salida episodios/<ep>/`

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
`numero`, `tema`, `titulo`, `semilla`, `tintas` (`{a, b}`; se valida que como mucho una sea de serie), `impactos` (máx. 3: `{texto, ancla | desde, duracion}`; `ancla` es una palabra o frase del guion que se busca en `tiempos.json`), `panel` (`{desde, hasta?, titulo?}`, solo si el episodio lleva datos) y `cola` (segundos tras la última palabra). El sketch puede exportar `panel(frame, fps)` con contadores, fórmula y mini gráfico.

### Reglas para sketches generativos (críticas)
- Render determinista: todo depende de `useCurrentFrame()`. Nada de `requestAnimationFrame`, `Date.now()` ni `Math.random()`.
- Aleatoriedad con PRNG con semilla (por ejemplo mulberry32) guardada en la config del episodio.
- Simulaciones con estado (boids, autómatas, partículas): se precalculan por fotograma o se recalculan de forma determinista desde el fotograma 0. El fotograma N debe ser idéntico en la vista previa y en el render.
- Los sketches dibujan en escala de grises o con máscaras por tinta. El color final lo pone `<RisoFilter>`.

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
```
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
`episodios/nº00-prueba/` es el episodio de prueba de la plantilla. Tiene un `tiempos.json` falso que sí se versiona, porque todavía no hay voz.

---

## Cómo trabajar en este repo
- Antes de un cambio grande, propón un plan breve y espera aprobación.
- Respeta la paleta, las tipografías y las zonas seguras sin excepciones. Si algo no encaja, pregunta en vez de inventar un estilo nuevo.
- Verifica visualmente: renderiza fotogramas sueltos (`npx remotion still`) de portada, subtítulo normal, dato de impacto y panel, y revísalos antes de dar algo por terminado.
- Código y comentarios en español.
