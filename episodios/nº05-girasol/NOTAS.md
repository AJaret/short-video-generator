# Verificación y decisiones de nº05

Comprobación: `python "episodios/nº05-girasol/verificar.py"` (Python estándar, sin paquetes; < 1 s).

- Modelo de Vogel (1979): la semilla n está en el ángulo n·α y a la distancia c·√n del centro. Es un modelo, no una planta: en pantalla se rotula como «esquema».
- Ángulo de oro: 360° · (1 − 1/φ) = 137,508°. El guion dice «ciento treinta y siete punto cinco».
- «Treinta y cuatro hacia un lado y cincuenta y cinco hacia el otro»: con el ángulo de oro, las espirales visibles (parastiquias) son siempre dos números de Fibonacci seguidos, y la pareja depende de cuántas semillas hay: 21/34 con 150, 34/55 con 400, 55/89 con 1000 y 89/144 con 2500 (`verificar.py` las cuenta con las diferencias de índice entre semillas vecinas de la corona exterior). La animación debe usar ~400 semillas cuando la voz dice 34 y 55.
- «Con un ángulo redondo, como ciento treinta y cinco grados, salen rayos»: 135° = 3/8 de vuelta, así que las semillas solo ocupan 8 direcciones (8 rayos rectos); 120° da 3 y 144° da 5. El ángulo de oro no repite dirección nunca (337 direcciones distintas, redondeando a 1°, en 400 semillas).
- «Con ciento treinta y siete, casi... pero no»: la uniformidad del reparto (coeficiente de variación de la distancia a la vecina más cercana, 1000 semillas) es 0,084 con 137°, 0,091 con 138° y 0,019 con 137,508°: unas 4,5 veces peor. Se ven brazos curvos con huecos entre ellos.
- «Sin huecos»: en el modelo, el ángulo de oro da el reparto más parejo de los probados; no es un empaquetado perfecto, por eso el guion no dice «perfecto».
- «En un estudio con más de seiscientos girasoles, una de cada cuatro cuentas no dio Fibonacci»: Swinton y Ochu, *Royal Society Open Science* 3 (2016), «Novel Fibonacci and non-Fibonacci structure in the sunflower: results of a citizen science experiment» (doi:10.1098/rsos.160091). 657 girasoles; en el subconjunto más fiable, 565 de 768 conteos de espirales fueron números de Fibonacci (74 %) y otros 67 tenían una estructura emparentada. «Una de cada cuatro cuentas no dio Fibonacci» = 203/768 = 26 %.
- Música: Mi menor, progresión «ola» (i–iv–i–v), arpegio «ola», gancho en vibráfono (distinta de nº04: Re menor, épica, glockenspiel).
- Guion: 120 palabras, con etiquetas de ElevenLabs en español. Toma del 2026-11-10: 51,0 s de voz, 52,4 s de video; Whisper empató el 81 % de las palabras con el guion (las anclas usadas caen bien).
- Remate: los cuatro girasoles del estudio son un esquema con el modelo: tres con el ángulo de oro (150, 400 y 1000 semillas → 21/34, 34/55, 55/89) y uno con el ángulo de Lucas, 360°/(3 + 1/φ) ≈ 99,502° (29/47, `verificar.py` punto 5). El estudio de 2016 sí encontró cabezas con números de Lucas entre las no Fibonacci.
- El sello «137,5°», el cambio de ángulo hacia el de oro y el golpe musical caen en «punto cinco» (no en «ciento…»: llegaban antes de que la voz dijera el número). La lectura de giro dice «siempre igual» hasta que la voz prueba 135°, para no adelantar la revelación.
- Producción: loop exacto (0 %), tramo quieto más largo 0,7 s, −14,0 LUFS.
