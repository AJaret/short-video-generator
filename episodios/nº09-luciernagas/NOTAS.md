# Verificación y decisiones de nº09

Comprobación del esquema: `docker compose run --rm video node "../episodios/nº09-luciernagas/verificar.mjs"` (~2 s).

## Lo que dice la voz y de dónde sale
- **«Está lleno de luciérnagas... y todas se encienden a la vez» / «En Tailandia hay árboles enteros que laten como un solo foco»**: Buck y Buck, «Mechanism of Rhythmic Synchronous Flashing of Fireflies», *Science* 159, 1319–1327 (1968). Machos de *Pteroptyx malaccae* reunidos en árboles, en Tailandia, destellan en sincronía con un periodo de unos 560 ± 6 ms (a 28 °C). El guion no da número de luciérnagas.
- **«En mil novecientos diecisiete, un naturalista escribió que eso era imposible... que lo que parpadeaba eran los párpados del que miraba»**: P. Laurent, «The supposed synchronal flashing of fireflies», *Science* 45 (1150), 44 (12 de enero de 1917). El artículo existe con esa referencia (PubMed 17777240). Su argumento (que la sincronía era «contraria a todas las leyes naturales» y que la causa eran los párpados del observador) está comprobado **por fuente secundaria** (Cabinet Magazine, «A Minor History of / Odd Sympathy»; también lo cuenta Strogatz en *Sync*). No se ha leído el texto original, que es de pago.
- **«Cada luciérnaga lleva su propio reloj, y una sola regla: si ve un destello, ajusta el suyo»**: Buck y Buck (1968) explican la sincronía por el reajuste del ritmo de cada macho a partir de los destellos anteriores. La voz dice «ajusta», no «adelanta»: en las luciérnagas reales el ajuste depende de la especie. En el modelo del video, el destello adelanta el reloj.
- **«Dos matemáticos demostraron que, con esa regla, tarde o temprano terminan todas juntas»**: Mirollo y Strogatz, «Synchronization of pulse-coupled biological oscillators», *SIAM J. Appl. Math.* 50 (6), 1645–1662 (1990). Demuestran que una población de osciladores idénticos, acoplados todos con todos por pulsos, se sincroniza para casi cualquier condición inicial. Parte del modelo de Peskin del marcapasos del corazón. En pantalla van las condiciones: relojes iguales y todas se ven entre sí.
- **«Con ese truco ya se ponen en hora redes de sensores»**: Werner-Allen, Tewari, Patel, Welsh y Nagpal, «Firefly-inspired sensor network synchronicity with realistic radio effects», SenSys 2005, 142–153. Extienden el modelo de Mirollo y Strogatz a radios reales y sincronizan una red de sensores con un error de unos 100 µs.

## Lo que NO se dice (y por qué)
- Que una luciérnaga sola no lleva ritmo y que el ritmo solo aparece en grupo (Sarfati y otros, *eLife*, 2023): el artículo tiene una nota editorial de preocupación sobre sus datos y una corrección de 2025. Fuera.
- En el campo cada luciérnaga solo ve a sus vecinas (Sarfati, Hayes y Peleg, *Science Advances* 7, eabg9259, 2021): el teorema es para «todas con todas». Por eso la simulación se rotula «esquema».

## El esquema del video (`simulacion.ts`)
- El modelo de Mirollo y Strogatz, simulado por eventos (exacto): 120 relojes idénticos, carga cóncava (b = 3) y empujón ε = 0,001 por destello.
- `verificar.mjs`: sin empujón, tras 60 ciclos siguen 120 destellos distintos por ciclo; con la regla, 300 de 300 arranques al azar acaban en un solo destello por ciclo (mínimo 7,4 ciclos, mediana 11,4, máximo 23,7). Después, todas disparan juntas una vez por ciclo.
- En el video el ciclo dura 1,3 s (dos tiempos a 92 BPM), más lento que el real (0,56 s), para que el parpadeo no moleste. Va rotulado.
- El video usa tres simulaciones de ese modelo, con parámetros distintos para que cada una dure lo que su escena (`linea.ts` elige el arranque al azar que más se acerca):
  - los dos relojes: n = 2, ε = 0,12;
  - el enjambre: n = 120, ε = 0,002 (con 0,001 tardaría ~11 ciclos; la escena dura 5);
  - los sensores: n = 20, ε = 0,008.

## Voz
- Toma generada con el conector de ElevenLabs el 2026-11-14 (698 créditos): 44,7 s.
- El usuario oyó la etiqueta `[riendo por lo bajo]` del último párrafo como un cambio de voz artificial. Se regrabó solo ese párrafo sin etiqueta (101 créditos) y se empalmó en la pausa de 38,4 s (corte en 38,45 s, 0,35 s de silencio y −1 dB para igualar el volumen). El empalme no se ha comprobado de oído.
- Toma final: 45,0 s; Whisper empató el 97 %.

## Imagen y sonido
- **Noche en riso, sin colores nuevos**: un panel de tinta azul tramada sobre el papel. La luz de cada luciérnaga es el papel que asoma: un punto limpio con dos anillos de trama. El rosa queda para la regla (la carga de los relojes, el empujón, los sensores).
- **Escenas**: el árbol sincronizado (portada incluida) → los párpados de 1917, dos parpadeos de papel → «En Tailandia…», con el dato real (un destello cada 0,56 s) → sobre papel, un reloj que se carga y destella, y luego dos con el empujón a la vista → el enjambre desordenado que se junta, con la lectura de destellos distintos por ciclo de 120 a 1 → revelación en «todas juntas» → sobre papel, una red de 20 sensores que se pone en hora sola → el árbol, sincronizado.
- **Loop**: el primer y el último fotograma son un destello del árbol. `cola: 1.28` hace que el último fotograma caiga justo en un destello de la rejilla que empezó en la revelación; si cambia la voz, hay que recalcularla.
- **Movimiento**: la cámara gira muy poco y vuelve a su sitio. El árbol baja y crece una vez tras la portada y vuelve en el cierre. Cinco cortes de verdad. Lo que se mueve es el tema: el parpadeo.
- **Música `edicion` en Re menor**: aquí la sincronía se oye. Dos campanas en cada destello conjunto; A y B en tónica y quinta; cada grupo del enjambre es una nota (como mucho una por fusa), así que empieza como lluvia de clics y termina en un pulso.
- Fuente en pantalla: Laurent (1917), Buck y Buck (1968), Mirollo y Strogatz (1990) y Werner-Allen y otros (2005), cada una mientras la voz habla de ello.
