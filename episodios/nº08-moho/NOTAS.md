# Verificación y decisiones de nº08

Comprobación del esquema: `docker compose run --rm -w /repo/video video node "../episodios/nº08-moho/verificar.mjs"` (~2 s).

## El experimento (Tero y otros, «Rules for Biologically Inspired Adaptive Network Design», *Science* 327, 439, 2010)
- 36 fuentes de comida en la posición de ciudades de la zona de Tokio; el plasmodio creció desde Tokio, «initially filled much of the available land space, but then concentrated on FSs by thinning out the network to leave a subset of larger, interconnecting tubes». La comida eran copos de avena (Live Science, 2010) y la luz marcaba montañas y lagos, porque el moho la evita.
- *Physarum polycephalum* es «a large, single-celled amoeboid organism» → «una sola célula», «sin cerebro».
- Costo (largo total relativo al árbol mínimo, TL_MST): trenes ≈ 1,8; moho 1,75 ± 0,30 (n = 21) → «casi el mismo costo».
- Eficiencia (distancia mínima media, MD_MST): 0,85 los trenes y 0,85 ± 0,04 el moho → «la misma eficiencia».
- Tolerancia a fallos: solo el 4 % de las averías de un tramo aíslan parte de la red de trenes, frente a 14 ± 4 % (moho con luz) y 20 ± 13 % (sin luz) → «si se rompe una vía, sus trenes aguantan mejor».
- Las redes son «comparable», no idénticas: el guion dice «se parecía».
- «Poco más de un día»: la foto de la red es a las 26 horas (pie de foto en Scientific American, 2010).
- «El tubo que lleva mucho flujo se engrosa... y el que no, desaparece»: el modelo matemático del artículo (flujo de Hagen-Poiseuille por cada tubo y dD/dt = f(|Q|) − D, con γ = 1,8).

## El esquema del video (`simulacion.ts`)
- Es ese mismo modelo, resuelto con una malla propia: rejilla triangular de 673 nodos y 1802 tubos sobre el terreno alrededor de las ciudades (cierre convexo ensanchado), sin cruzar la bahía de Tokio. En cada paso una ciudad al azar es la fuente y las demás se reparten el flujo (I0 = 0,6, dt = 0,25, 500 pasos).
- Posiciones de las 36 ciudades: aproximadas (latitud y longitud de ciudades reales de Kanto). La plantilla exacta del artículo no se reproduce: se rotula «esquema».
- `verificar.mjs`: la malla se poda de 1802 a 247 tubos y la red final sigue uniendo las 36 ciudades; su largo es 2,1 veces el árbol mínimo (dato de nuestro esquema, no se dice en el video).
- El video NO dibuja la red de trenes real (no tenemos sus datos con rigor): la comparación se cuenta con las cifras del artículo.
- Música: Fa menor, progresión épica, arpegio «ola», gancho en vibráfono.
- Guion: 122 palabras, ~48 s, con etiquetas de ElevenLabs.
