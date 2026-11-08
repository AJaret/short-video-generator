# Estructura y producción

## 4 · Stack técnico

### Cadena de producción
```
guion.md ─▶ voz/ (Python, GPU) ─▶ voz.wav + tiempos.json
                                          │
Sketch.tsx (canvas 2D) ─▶ video/ (Remotion, plantilla del canal) ─▶ MP4 1080×1920 ─▶ informe (hoja + sonoridad)

Todo lo coordina producir.py desde la raíz del repo.
```

### Estructura del repositorio (monorepo)
```
canal-reels/
  CLAUDE.md
  docker-compose.yml   # servicios: video, voz (CUDA) y analisis (sin GPU)
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
- Las dependencias viven en imágenes y volúmenes de Docker, no en el disco de Windows: `node_modules` de `video/` está en el volumen `video_node_modules` (leerlo desde Windows sería muy lento) y la caché de modelos vive en su propio volumen. El repo se monta en `/repo` dentro de los contenedores.
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
python producir.py nº03-lorenz --solo-video --tramo 40-60   # solo ese tramo (s) → <ep>.tramo.mp4, ~1 min
python producir.py nº03-lorenz --solo-video --pulso         # el informe mide también la sincronía (~1 min más)
```
- Se ejecuta en Windows (PowerShell), con solo la librería estándar. Comprueba el episodio y el `config.json`, comprueba que Docker responda y, si se va a generar o alinear voz y la interfaz de voz está abierta, la detiene para liberar la GPU.
- `--stills` elige solos los fotogramas a revisar: portada (0), subtítulo normal (la primera palabra tras la portada sin impacto ni panel), dato de impacto (tras completar su entrada, con el ancla cuantizada al pulso) y panel (1,5 s después de que sube). Se sacan del MP4 con ffmpeg, en segundos. Cada vez que se produce un episodio hay que revisarlos.
- **Informe automático** tras cada render (`herramientas/informe.py`, en el servicio `analisis`, que reutiliza la imagen de voz sin reservar GPU y tiene ffmpeg completo; el de Remotion viene recortado):
  - `episodios/<ep>/stills/hoja.png`: hoja de contactos con 24 fotogramas repartidos, cada uno con su segundo. Es lo primero que se revisa.
  - `informe.txt`: LUFS, pico y *true peak*.
  - Con `--pulso`: % de picos visuales fuertes en la rejilla y los que quedan fuera.
  - Con `--tramo`: `hoja_tramo.png` e `informe_tramo.txt`, con los segundos del episodio.
- **Para iterar**, renderiza solo el tramo que cambió con `--tramo`, y el episodio completo al final.
- Tiempos de referencia:
  - `nº00` (12 s de voz): la voz con 3 tomas tarda ~4 min.
  - `nº02` (66,9 s): el render completo, con stills, hoja y sincronía, tarda **2,7 min**; un tramo de 20 s, ~1 min. Antes del filtro por CPU eran 9,5 min.
Pasos: 1) valida guion/configuración y Docker · 2) detiene la interfaz de voz para liberar GPU si va a generar o alinear voz · 3) genera o alinea voz y tiempos, y termina el contenedor para liberar el modelo · 4) valida anclas y límites del tramo · 5) genera `mezcla.wav` · 6) renderiza el MP4 (o solo stills con `--solo-voz --stills`) · 7) ejecuta el informe en `analisis`. `--solo-video` empieza con los tiempos existentes; `--solo-voz` reconstruye también la mezcla sin renderizar MP4.
ID de composición: el nombre de la carpeta con `nº` → `ep` y sin caracteres fuera de `[a-zA-Z0-9-]` (`nº03-lorenz` → `ep03-lorenz`). La regla está en `video/src/episodios.ts` y `producir.py` debe usar la misma.


### Video: `video/` (Remotion + TypeScript)
- Lee los archivos del episodio (`voz.wav`, `tiempos.json`, `config.json`, `Sketch.tsx`) desde `episodios/<ep>/`.
- Licencia de Remotion: gratis para individuos y empresas de hasta 3 personas (uso comercial incluido).
- Componentes de plantilla, reutilizables en todos los episodios:
  - `<RisoFilter>`: post-proceso de todo el fotograma por CPU (`tramado.ts`: separación en tintas, dither Bayer, desajuste de registro, multiply, grano).
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
- La plancha negra es la referencia de registro (no se desplaza). A y B se mueven aproximadamente 1,6–2,4 px de base (con variación por semilla) en sentidos opuestos, fijos durante todo el video (ver `docs/sonido.md`, golpe riso: el temblor por fotograma y el que cambiaba por compás se veían como parpadeo y como salto).
- Bordes imperfectos: `trazarRectIrregular`, `trazarLineaIrregular`, `trazarCirculoIrregular` y `trazarPoligonoIrregular` (también estrellas), deterministas por semilla.


### config.json
`numero`, `tema`, `titulo`, `semilla`, `tintas` (`{a, b}`; se valida que como mucho una sea de serie), `impactos` (máx. 3: `{texto, ancla | desde, duracion}`), `panel` (`{ancla | desde, hasta?, titulo?}`, solo si el episodio lleva datos; `hasta` puede ser un número de segundos o un ancla), `cola` (segundos tras la última palabra) y opcionalmente `voz` (ajustes de la voz).
- **Anclas:** una palabra o frase del guion, sin importar acentos, mayúsculas ni puntuación. Se busca en `tiempos.json` el momento en que la voz la dice. Conviene anclar todo (impactos, panel, momentos del sketch) en lugar de usar segundos, porque así sobrevive a cualquier regeneración de la voz.
- **Sincronizar el sketch con la narración:** el sketch recibe `tiempos` en sus props y usa `tiempoDeAncla(tiempos, "paso diez mil")` para saber en qué segundo pasa algo. Debe tener tiempos por defecto para cuando todavía no hay voz. Ejemplo: `episodios/nº01-hormiga-de-langton/Sketch.tsx`, cuya línea de tiempo pasa por anclas del guion.
- El sketch puede exportar `panel(frame, {fps, duracion, tiempos, config})` con contadores, fórmula y mini gráfico.
- **Durante la portada (0–2,6 s) no hay subtítulos normales**, aunque la voz ya hable: el primer fotograma es la miniatura.
- **Loop:** el sketch dibuja en la portada el mismo estado que en su último fotograma, y el panel baja antes del final (`hasta`), para que el último fotograma coincida con el primero.
- **Fuentes:** el subconjunto latino de Space Mono no tiene griego ni flechas (θ, →). Usa texto ("t", ":") en fórmulas y etiquetas.
- **Rigor:** las afirmaciones del guion se comprueban, con una simulación propia o con fuentes, antes de grabar la voz. Lo que es una metáfora visual se rotula como "esquema". En `nº01`: la autopista empieza en el paso 9 977 (simulado); que la hormiga nunca queda encerrada está demostrado (Bunimovich y Troubetzkoy, 1992); que puede calcular cualquier cosa también (Gajardo, Moreira y Goles, 2002); y que siempre acabe en autopista sigue sin demostrarse.
  - Las comprobaciones se versionan con el episodio, en `verificar.py` o `verificar.mjs`, para poder repetirlas.
  - En `nº02` (simulado con 200 000 puntos, `verificar.py`):
    - En el triángulo, ningún punto cae en el hueco central desde el primer salto; es exacto, porque un salto hacia una esquina cae siempre en la copia a la mitad de esa esquina.
    - En el cuadrado sin regla los puntos lo llenan todo; con «no repetir esquina» sale un fractal.
    - El tetraedro de Sierpinski tiene dimensión 2, y visto a lo largo del eje que une dos aristas opuestas es un cuadrado lleno.
    - Ojo al contar puntos «dentro del hueco»: el borde es parte del fractal, y en float32 hace falta un margen.
    - **Empieza el juego sobre el fractal**, en una esquina, o descarta los primeros ~40 saltos. Si empieza fuera, el salto k cae en un hueco de nivel k+2, y se ven puntos sueltos en el centro de los triángulos (lo detectó el usuario). Empezando en una esquina, de 160 000 puntos ninguno cae en ningún hueco.


### Estructura de un episodio
```
episodios/
  nº03-lorenz/
    guion.md        # texto con [pausa] y [Animación: ...]
    voz.wav         # generado
    tiempos.json    # generado
    config.json     # número, título, tintas, semilla, momentos de impacto, ¿panel?
    Sketch.tsx      # la animación generativa del episodio
    linea.ts        # (opcional) línea de tiempo pura, compartida con sonido.ts
    simulacion.ts   # (opcional) simulación pura y determinista
    sonido.ts       # (opcional) efectos propios en el pulso
    verificar.py    # comprobación de las afirmaciones del guion (o verificar.mjs)
    voz_externa.mp3 # toma de ElevenLabs (se versiona)
```
`episodios/nº00-prueba/` es el episodio de prueba de la plantilla y de la voz. Su `voz.wav` y su `tiempos.json` se generan igual que en cualquier episodio. Para probar un sketch sin GPU hay un generador de tiempos falsos: `node scripts/tiempos_falsos.js ../episodios/<ep>/guion.md ../episodios/<ep>/tiempos.json`, que se ejecuta dentro del servicio `video`.

---


Los impactos con entrada `letras` se alargan para que la última letra se asiente (0,1 s), pueda leerse (0,6 s) y salga (6 fotogramas). `finImpacto` lo comparte con el ducking; dos impactos solapados tras cuantizar producen un error con sus textos.

Antes de producir se avisa de anclas de configuración ausentes. Los tramos se redondean a fotogramas y se recortan al final real; si empiezan fuera o no abarcan un fotograma se rechazan antes de mezclar. Un fallo de informe devuelve código 2 y no anuncia sus archivos como nuevos.

En `nº00`, la toma actual dura 12,31 s y `cola: 2.69` completa los 15 s que dice el guion. El panel baja en «A ninguna parte». La fase usa la duración real para repetir el dibujo en el último fotograma. Si cambia la toma, revisar esa cola.
