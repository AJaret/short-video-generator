# Verificación y decisiones de nº09

Borrador: guion y verificación hechos; falta la aprobación del usuario para grabar la voz y montar el video.

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
- El ciclo del video será de 1,3 s (dos tiempos a 92 BPM), más lento que el real (0,56 s), para que el parpadeo no moleste.
