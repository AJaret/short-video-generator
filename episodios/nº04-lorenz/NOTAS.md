# Verificación y decisiones de nº04

Comprobación: `docker compose run --rm analisis python "episodios/nº04-lorenz/verificar.py"` (regenera `trayectorias.json`, que sale idéntico: es determinista).

- Sistema de Lorenz clásico (σ = 10, ρ = 28, β = 8/3) integrado con RK4 y h = 0,01 desde (1, 1, 1) y (1,001, 1, 1): la rosa y la azul.
- «¿Alcanzas a ver cuándo se separan?»: la distancia es 0,001 al empezar, 0,0236 en el paso 1500, 1,56 en el 2000 y ~13 en el 2500.
- «En algunas vueltas, los puntos hasta vuelven a acercarse»: en el tramo que se ve (del paso 2700 al cruce), la distancia cae a menos de la mitad tras haber crecido 13 veces; por ejemplo, de 43,4 a 4,7.
- «Ya cruzó a la izquierda… y la azul todavía da otra vuelta por la derecha»: `verificar.py` busca el primer paso en que la rosa cruza a x < 0 mientras la azul sigue en x > 0 y da al menos una vuelta completa más por la derecha (paso 3472 → 3538).
- El campo de flechas es un corte en el plano x-z con y = 1 (dx = 10(1 − x), dz = x − 8z/3) y se rotula como «esquema»; el punto rosa que lo recorre sigue ese corte con RK4.
- Portada y último fotograma: la mariposa completa con los dos puntos en lóbulos opuestos (el instante final de las trayectorias), por encima del título. Antes era una elipse pequeña, porque al principio las dos curvas van pegadas.
- «Fíjate en esta línea»: el tramo 1200→1880 de las trayectorias. Las curvas van pegadas mientras cruzan de un lóbulo al otro (menos de 2 px de separación) y se abren a ~100 px justo después de «¿cuándo se separan?». El tramo anterior (420→720) eran solo vueltas cerradas en un lóbulo y se veía como un óvalo girando.
- Sonido: cada cambio de lóbulo suena en su lado del estéreo (la rosa aguda, la azul grave), con la misma línea de tiempo que la imagen (`linea.ts`), también en la escena de la línea.
- Duración: 80 s por la toma de voz. Para acortarlo habría que regrabar.
