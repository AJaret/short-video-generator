# Voz del canal

### Voz: `voz/` (Python)
- TTS local con clonación de voz y licencia comercial (modelo elegido: Chatterbox Multilingual, MIT).
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


La interfaz `voz/app.py` también respeta `voz_externa.*`, libera Chatterbox antes de alinear con Whisper y olvida el modelo incluso si falla la generación. `--solo-voz` reconstruye además `mezcla.wav` para que Studio reproduzca la toma nueva.
