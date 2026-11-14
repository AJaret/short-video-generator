# Catálogo de animación y 3D

### Kit de motion graphics (`video/src/canal/`)
Inspirado en los reels de referencia (cortes al ritmo, fondos de un solo color, formas geométricas, nubes de partículas), traducido a riso. Son funciones de dibujo puras que el sketch combina, y su tiempo sale siempre del pulso. Se ven todas en la composición **`muestrario`** (`video/src/muestrario/`), que sirve de catálogo y de ejemplo de uso.
- `curvas.ts`: `tramo(t, inicio, duracion)` y curvas (`salidaCubica`, `entradaSalidaCubica`, `salidaExpo`, `salidaRebote`). Arranques secos y frenadas suaves.
- `fondos.ts`:
  - `fondoTinta(capas, 'b')` pone una plancha de tinta a sangre. Por defecto va en la capa sólida, para que el texto recortado salga nítido; con `{trama: true, cobertura: 0.34}` queda de medio tono punteado.
  - `enNegativo(capas, ctx => …)` deja papel con cualquier relleno, trazo o `fillText`: formas y titulares en papel sobre la tinta.
  - Un relleno de tinta A sobre la plancha B sale del multiply como `#002284`.
- `transiciones.ts` + `<Transiciones lista pulso>` (`ORDEN.transicion`, por encima del sketch y por debajo de la plantilla):
  - Tipos: `barrido` (mancha de borde ondulado con orla punteada, en cualquier `angulo`), `iris` (agujero que se cierra hacia un `centro` y se abre), `trama` (oleada de puntos que crecen y se encogen) y `corte`.
  - Todas tapan, cortan y destapan. Duran 2 negras por defecto: si empiezan un tiempo antes del compás (`t: compas - negra`), el corte cae justo en el compás.
  - `corteDe(tr, pulso)` da el momento del cambio de escena y `escenaEn(t, lista, pulso)` el índice de la escena vigente.
  - Sonido sugerido: papel al empezar un barrido e impresora en cada corte.
- `graficos.ts`:
  - `estallido` (rayos que salen en un golpe), `trazarEstrella`.
  - `ondas`: nace un anillo en cada tiempo.
  - `marcasRegistro`: cruces de registro impresas en las tres planchas; el desajuste las separa en tres colores y saltan con el golpe riso. Van en las esquinas, dentro de las zonas seguras, porque son decoración.
  - `nubeParticulas(ctx, n, p, destino, {desde})`: puntos que vuelan de dispersos (o de otra figura) a `enCirculo`, `enRejilla` o `enEspiral` (girasol).
- `cinetica.ts`:
  - `textoLetras`: letra a letra, una por semicorchea; `momentosLetras` da los mismos instantes al sonido.
  - `textoBarrido`: una barra de tinta tapa el hueco y, al retirarse, deja el texto.
  - `rotulo`: etiqueta Space Mono en tira de papel que entra con rebote.
- `camara.ts` · **cámara 2D** (prueba de dinamismo de `nº04`, 2026-11-08):
  - `tomaEn(t, planos)`: cada `Plano` tiene `desde`, una `toma` (`zoom` alrededor de `px, py`, desplazamiento `dx, dy`, `giro`) o una función del tiempo para seguir algo, `deriva` (zoom que gana dentro del plano) y `giro` (órbita lenta). Entra con `corte` o `suave` (viaje de `viaje` s desde la toma anterior).
  - `empujes(t, momentos, fuerza)`: zoom con rebote en los golpes (sube en 2 fotogramas y cae en ~0,2 s); multiplica el zoom de la toma. Se probó en `nº04` en cada golpe y se quitó: en un video que explica algo se ve mal. Úsalo solo en portadas o remates muy cortos, si acaso.
  - `conCamara(capas, toma, fn)`: dibuja `fn` con la toma en las seis capas, antes del tramado. Lo que no se mueve con la cámara (rótulos, lecturas) se dibuja fuera.
  - `seguir`, `aPantallaCon`, `mezclarTomas`.
  - `VISOR` y `recortarA`: el marco de visor de `nº04` y `nº05`. Desde `nº06` no se usa: la animación va centrada (x = 540) y a pantalla casi completa, y los datos van en tiras de papel. Para el último fotograma (loop), la toma debe volver a la neutra.
- `detalles.ts` · la capa técnica de las referencias:
  - `cuadricula(ctx, toma)`: cruces en el mundo (dentro de `conCamara`); hacen legible el movimiento de cámara sobre líneas finas.
  - `mira(ctx, x, y, r, p, giro)`, `marcoEsquinas(ctx, rect, p)` (visor que se cierra; en `nº04` vuelve a cerrarse en cada corte) y `lectura(ctx, etiqueta, valor, x, y)` para datos que cambian.
  - `fuenteEnPantalla(capas, texto, p)`: la fuente oficial de lo que cuenta la voz (estudio, dato, premio), en Space Mono 24 sobre una tira de papel, arriba a la izquierda bajo la numeración; entra deslizándose (`p` 0…1). Obligatoria desde `nº08` cuando la voz habla de lo que encontraron unos científicos.
  - `sacudirRegistro(capas, t, momentos, px)`: las tintas se separan unos px durante ~3 fotogramas (el glitch riso, en cortes y revelaciones).
- `<DatoImpacto>`: `impacto.entrada` puede ser `'sello'` (por defecto), `'letras'` o `'barrido'`.
- Reglas: el texto y las líneas finas van en capas sólidas; los volúmenes, tonos y orlas, en las tramadas. Nada de degradados: los medios tonos son la trama a 1/3 y 2/3.
- `tres.ts` · **3D en riso**: un motor propio y ligero, sin Three.js ni WebGL. Proyecta a 2D y pinta con el algoritmo del pintor, así que es determinista y rápido en el render por CPU. El volumen sale de la trama: la luz de cada cara se convierte en cobertura de tinta.
  - Mallas: `cubo`, `esfera`, `toro`, `cilindro`, `cono` y `superficie(f)` (y = f(x, z), se ve por los dos lados). `transformar` aplica escala, giro y posición.
  - `Camara` en órbita: `distancia`, `azimut`, `elevacion` y `fov` (pequeño = casi ortográfica; desde arriba parece 2D). La luz va fija respecto a la cámara.
  - `dibujar3D(capas, objetos, camara, {luz, ambiente, niebla})`. Cada objeto lleva `material: {tinta, sombra?, aristas?, alambre?, tonos?}`:
    - `sombra` imprime la parte oscura también con la otra tinta.
    - Las aristas van en la capa sólida.
    - `niebla` resta tinta con la distancia.
    - Cada cara tapa lo de detrás en todas las tintas.
    - `armado(i, n)` hace que las caras lleguen volando una a una, por ejemplo en semicorcheas.
  - `curva3D`: polilínea con grosor según la profundidad; lo cercano en una tinta y lo lejano en otra, con un halo de papel en los cruces. `puntos3D` + `puntosEsfera`, y `nudoToroidal` como ejemplo.
  - `giroAlPulso(t, pulso, {paso, division, desde})`: un giro que salta en cada tiempo y frena. Es el movimiento motion graphics de un objeto 3D.
  - Luz casi de frente = todo claro. Para superficies, una luz rasante (`luz: [-0.85, 0.45, -0.3]`, `ambiente: 0.1`) hace que el relieve se lea por su sombra.
  - Uso: en las partes de un episodio que lo pidan (atractores, bandadas en 3D, superficies). No hace falta en todo el video.
  - Para nubes de decenas de miles de puntos (como el tetraedro de `nº02`), proyecta con `proyectar` y escribe los puntos directamente en un `ImageData`: es mucho más rápido que un `arc` por punto.

### Estilo "edición" (`video/src/canal/edicion/`, prueba de `nº08b`, 2026-11-14)
Color directo, **sin filtro riso**. Es una excepción que pidió el usuario para recrear `nº08` con el estilo de dos ediciones de referencia; no sustituye a la estética del canal. Se activa con `"estilo": "edicion"` en `config.json`: `Episodio.tsx` deja de montar `<RisoFilter>` y la plantilla (portada, panel, impactos, subtítulos), y el sketch dibuja el fotograma entero.
- `LienzoEdicion.tsx`: `<LienzoEdicion dibujar={(ctx, info) => post} />`. Un Canvas 2D a color; si `dibujar` devuelve un `Post`, se aplica a los píxeles ya dibujados.
- `paleta.ts`: azul `#0A4AFF`, blanco, negro y ámbar `#F5B000` (medidos en la referencia) y los `TEMAS` (`azul`, `blanco`, `negro`): un fondo a sangre y los colores que se leen sobre él. Cada corte cambia de tema.
- `glitch.ts`: `aplicarPost` (mosaico `pixel`, canales separados `rgb`, franjas `bandas`, `invertir`) y `glitchDeCorte(desde, frame)` para los 2–3 fotogramas de un corte. Determinista.
- `tres.ts`: 3D de caras planas a color. Reutiliza las mallas y `transformar` de `../tres.ts`; `Camara3` lleva `escala` (px por unidad en el objetivo), así que la perspectiva se regula con `distancia` sin cambiar el tamaño. `carasDe` + `pintarCaras` (algoritmo del pintor); cada cara lleva su índice `i` para recolorear una (la tapa de un cilindro).
- `graficos.ts`: `fondoRejilla` (plano técnico), `destello`, `marco` (selección con asas), `etiqueta` (caja que se descubre), `textoContorno` (numerales grandes), `subtituloEdicion` (mismos grupos que el subtítulo riso, banda negra y palabra activa en ámbar) y `cabecera` (numeración + fuente en pantalla).
- El sketch respeta lo demás: determinista por fotograma, zonas seguras, loop (último fotograma = primero), fuente en pantalla y rótulos «esquema».
