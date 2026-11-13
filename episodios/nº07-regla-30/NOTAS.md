# Verificación y decisiones de nº07

Comprobación: `python "episodios/nº07-regla-30/verificar.py"` (Python estándar, < 1 s).

- Regla 30 (Wolfram, 1983): autómata celular elemental. Cada casilla nueva mira tres de la fila anterior (ella y sus dos vecinas); la tabla de 8 casos, leída de 111 a 000, es 00011110 = 30. Equivale a izquierda XOR (centro OR derecha). `verificar.py` lo comprueba.
- «Empezamos con un solo punto negro… y salen triángulos como los de la concha»: en 200 filas hay huecos blancos triangulares de 8 tamaños, cada vez más raros cuanto más grandes (2011 de 1 casilla, 1482 de 2, 317 de 3… 2 de 8).
- La concha: el patrón de *Conus textile* **se parece** a la Regla 30 (Wikipedia, «Rule 30»); no se afirma que el caracol la siga. El caracol deposita el pigmento en el borde que crece, una línea a la vez (Meinhardt; Fowler, Meinhardt y Prusinkiewicz, SIGGRAPH 1992). El mecanismo sigue en discusión: los modelos de reacción-difusión de Meinhardt no tienen evidencia fisiológica directa y hay una hipótesis neurosecretora, de ahí «los biólogos todavía lo discuten». La concha del video es un **esquema** dibujado con la Regla 30 desde una fila al azar.
- «Se usó para sacar números al azar»: la columna central se usó como generador pseudoaleatorio en Mathematica (Wikipedia, que cita la documentación de Mathematica 8). En 20 000 filas: 50,6 % negros y ningún periodo ≤ 2000 en la segunda mitad (indicio, no prueba).
- «Un premio de diez mil dólares para quien demuestre que nunca se repite… sigue sin demostrarse»: Rule 30 Prizes de Wolfram (1 de octubre de 2019), tres problemas de 10 000 dólares cada uno; el primero es si la columna central nunca se vuelve periódica. Un preprint de 2026 (arXiv:2609.09431) dice que sigue abierto. Hay un preprint de 2022 que dice resolverlo, sin aceptación conocida; por eso el guion no dice «nadie lo ha cobrado».
- Música: Do menor, progresión «misterio» (i–VI–i–VII), arpegio «giro», gancho en glockenspiel.
- Guion: 121 palabras, ~48 s, con etiquetas de ElevenLabs en español. Primer guion pensado para generar la toma con el conector de ElevenLabs.
