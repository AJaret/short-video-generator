# Verificación y decisiones de nº02

  - En `nº02` (simulado con 200 000 puntos, `verificar.py`):
    - En el triángulo, ningún punto cae en el hueco central desde el primer salto; es exacto, porque un salto hacia una esquina cae siempre en la copia a la mitad de esa esquina.
    - En el cuadrado sin regla los puntos lo llenan todo; con «no repetir esquina» sale un fractal.
    - El tetraedro de Sierpinski tiene dimensión 2, y visto a lo largo del eje que une dos aristas opuestas es un cuadrado lleno.
    - Ojo al contar puntos «dentro del hueco»: el borde es parte del fractal, y en float32 hace falta un margen.
    - **Empieza el juego sobre el fractal**, en una esquina, o descarta los primeros ~40 saltos. Si empieza fuera, el salto k cae en un hueco de nivel k+2, y se ven puntos sueltos en el centro de los triángulos (lo detectó el usuario). Empezando en una esquina, de 160 000 puntos ninguno cae en ningún hueco.


La esquina visible y la nota se calculan con `indiceCuadrado`; el triángulo mantiene el último salto durante el tiempo de silencio anterior a la revelación. La entrada de «Cero en el hueco» se alarga automáticamente para que se lea completa.
