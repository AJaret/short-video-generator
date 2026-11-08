"""Integra Lorenz y localiza un cruce con una vuelta adicional en el lóbulo derecho."""
from pathlib import Path
import json
from math import atan2, pi
def campo(p):
    x,y,z=p
    return 10*(y-x), x*(28-z)-y, x*y-8*z/3
def sumar(p,v,h):
    return tuple(a+h*b for a,b in zip(p,v))
def curva(x):
    p=(x,1.,1.); pts=[p]; h=.01
    for _ in range(6500):
        a=campo(p); b=campo(sumar(p,a,h/2)); c=campo(sumar(p,b,h/2)); d=campo(sumar(p,c,h))
        p=sumar(p,[i+2*j+2*k+l for i,j,k,l in zip(a,b,c,d)],h/6); pts.append(p)
    return pts
a,b=curva(1.),curva(1.001)
def vueltas(tr,i,j):
    ang=[atan2(p[2]-27,p[0]-72**.5) for p in tr[i:j+1]]
    return abs(sum((v-u+pi)%(2*pi)-pi for u,v in zip(ang,ang[1:])))/(2*pi)
for i in range(100,len(a)-200):
    if a[i-1][0]>0>=a[i][0] and b[i][0]>0:
        j=next((k for k in range(i+1,min(i+300,len(b))) if b[k][0]<=0),min(i+300,len(b)-1))
        if vueltas(b,i,j-1)>=1:
            break
else: raise ValueError('Sin cruce verificable')
fin=next(k for k in range(i+2,j) if vueltas(b,i,k)>=1)
Path(__file__).with_name('trayectorias.json').write_text(json.dumps(dict(rosa=a[:fin+2],azul=b[:fin+2],cruce=i,fin=fin),separators=(',',':')))
print(i,fin,vueltas(b,i,fin))

# "En algunas vueltas, los puntos hasta vuelven a acercarse": en el tramo que se ve (índice 2700 al
# cruce), la distancia entre los dos puntos cae a menos de la mitad tras haber crecido.
from math import dist as distancia
d = [distancia(p, q) for p, q in zip(a[: fin + 2], b[: fin + 2])]
maximo, casos = 0.0, []
for k in range(2700, i + 1):
    if d[k] > maximo:
        maximo, km = d[k], k
    if maximo > 0 and d[k] < 0.5 * maximo:
        casos.append((km, round(maximo, 2), k, round(d[k], 2)))
        maximo = d[k]
print("distancia al empezar:", d[0], "· en el cruce:", round(d[i], 2))
print("reacercamientos (máximo -> menos de la mitad) entre 2700 y el cruce:", len(casos), casos[:4])
assert casos, "No hay reacercamientos en el tramo que se ve: el guion no se cumple"
