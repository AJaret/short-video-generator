# Verificación y decisiones de nº06

Comprobación: `python "episodios/nº06-bosque/verificar.py"` (Python estándar, sin paquetes; ~45 s). Regenera `bosques.json`, que sale idéntico porque es determinista (mulberry32, el mismo generador que el kit).

- Modelo: percolación de sitios en una rejilla cuadrada. Cada casilla tiene un árbol con probabilidad p; el fuego empieza en todos los árboles de la fila de abajo y salta solo a los cuatro vecinos (arriba, abajo, izquierda, derecha). Es un modelo de juguete del incendio, no un simulador forestal: en pantalla se rotula como «esquema».
- Umbral: 0,59274621 en la rejilla cuadrada (Newman y Ziff, *Phys. Rev. Lett.* 85, 4104, 2000, arXiv:cond-mat/0005264; mismo valor en la revisión de Ziff de 2011, arXiv:1103.3243). El guion dice «cincuenta y nueve».
- Probabilidad de cruzar, medida en `verificar.py`:

  | Rejilla | 55 % | 57 % | 59 % | 61 % | 62 % | 65 % |
  |---|---|---|---|---|---|---|
  | 56×72 (la del video, 400 bosques) | 1 % | 10 % | 40 % | 69 % | 82 % | 98 % |
  | 200×200 (120 bosques) | 0 % | 1 % | 42 % | 97 % | 100 % | 100 % |

- Por eso el guion compara 55 % con **65 %** en el bosque del video (con 62 % solo cruza ~4 de cada 5), y el salto «con cincuenta y siete casi nunca, con sesenta y uno casi siempre» lo atribuye a «un bosque grande» (1 % → 97 % en 200×200). Cuanto más grande el bosque, más brusco el salto.
- Bosques del video (`bosques.json`, 56×72):
  - 55 % (semilla 5, densidad real 55,6 %): el fuego llega a la fila 27 de 72 y se apaga en 54 pasos; quema 342 de 2240 árboles.
  - 65 % (semilla 1, 65,3 %): cruza en 140 pasos; quema 2440 de 2633.
  - 59 % (semilla 29, 58,8 %): cruza en 138 pasos quemando 1299 de 2370, es decir, deja en pie el 45 % («casi la mitad del bosque en pie»).
- «Transición de fase»: la percolación es el ejemplo de libro de una transición de fase continua. El guion no la compara con el agua que se congela (esa es de otro tipo).
- Música: Sol menor, progresión andaluza (i–VII–VI–V), arpegio «pulso», gancho en marimba (distinta de nº04 y nº05).
- Guion: 123 palabras, con etiquetas de ElevenLabs en español. Toma del 2026-11-11: 50,4 s de voz, 51,8 s de video; Whisper empató el 87 % de las palabras.
- Gráfica: las curvas son las medidas por `verificar.py` (bosques.json → curvas), de 50 % a 70 %: el bosque del video (300 bosques por punto) y uno de 200×200 (80 por punto). Las marcas dicen 1 % en 57 % y 96 % en 61 % (bosque grande). Se rotula «medido», no «esquema».
- Los gemelos del final son el mismo campo de azar de 100×100 con 57 % y 61 % (el segundo solo añade árboles); `gemelos()` en `linea.ts` busca, determinista, la primera semilla en la que el de 57 % se apaga y el de 61 % cruza. Se rotulan «esquema».
- El sello «59 %» y el golpe musical caen en «cincuenta y nueve». En el bosque de 59 % el fuego cruza justo en «estrechito» y después se dibuja en rosa el camino por el que cruzó (de arriba hacia abajo por pasos decrecientes).
- Portada y final: el bosque de 59 % intacto (chispas abajo en la portada). En «¿cuántos árboles plantarías tú?» la densidad sube y baja sobre el mismo campo y vuelve al 59 % en el último fotograma: loop exacto (0 %).
