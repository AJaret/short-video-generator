// nº03 · Bandada (boids en 3D). Módulo PURO: lo usan la animación, el sonido y verificar.mjs.
//
// Cada ave solo mira a sus vecinas (distancia² < radio2) y sigue tres reglas: separación, alineación y
// cohesión. En `giro` unas pocas aves de UN COSTADO cambian de rumbo durante 2,2 s; el resto solo
// responde a sus vecinas. No son las de delante: el guion remata con "¿y la que iba delante?
// También estaba mirando de reojo", así que en la simulación la de delante debe ser una seguidora
// (comprobado con verificar.mjs).
import {mulberry32} from '@canal/prng';

export type Ave = {x:number; y:number; z:number; vx:number; vy:number; vz:number};
export const PASO = 0.1;
const N = 144;
// Los estados se calculan a pasos fijos, con las mismas vecinas para todo el paso.
/** Parámetros de las reglas (los valores por defecto son los del video). */
export type Reglas = {alineacion:number; cohesion:number; separacion:number; radio2:number; empuje:number; duracionEmpuje:number};
// Elegidos con una búsqueda (video/out/n03_busca2.mjs) para que lo que dice el guion sea cierto:
// con los de antes solo giraba el 37 % de la bandada, casi a la vez, y la de delante nunca. Con
// visión más corta (radio² 5) y más alineación, gira el 100 % en 4 s, en ola (el retraso crece con
// la distancia a las iniciadoras, Spearman 0,83) y la de delante gira como una seguidora más.
export const REGLAS:Reglas = {alineacion:8, cohesion:0.28, separacion:2.8, radio2:5, empuje:2.6, duracionEmpuje:3.5};

export function vuelo(semilla:number, segundos:number, giro:number, r:Reglas=REGLAS): Ave[][] {
  const azar = mulberry32(semilla);
  let aves:Ave[] = Array.from({length:N}, () => ({
    x:(azar()-0.5)*15, y:(azar()-0.5)*5, z:(azar()-0.5)*8,
    vx:1.8+azar()*0.3, vy:(azar()-0.5)*0.4, vz:(azar()-0.5)*0.5,
  }));
  const estados = [aves];
  const iniciadoras = iniciadorasDe(aves);
  for(let k=1;k<=Math.ceil(segundos/PASO)+1;k++){
    const t=k*PASO;
    aves=aves.map((a,i)=>{
      let ax=0,ay=0,az=0,n=0,sx=0,sy=0,sz=0;
      for(const b of aves){
        const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,d2=dx*dx+dy*dy+dz*dz;
        if(d2===0 || d2>r.radio2) continue;
        n++;
        ax+=r.cohesion*dx+r.alineacion*(b.vx-a.vx); ay+=r.cohesion*dy+r.alineacion*(b.vy-a.vy); az+=r.cohesion*dz+r.alineacion*(b.vz-a.vz);
        if(d2<1.8){const f=r.separacion/(0.04+d2); sx-=dx*f;sy-=dy*f;sz-=dz*f;}
      }
      const divisor=Math.max(1,n);
      let vx=a.vx+PASO*(ax/divisor+sx),vy=a.vy+PASO*(ay/divisor+sy),vz=a.vz+PASO*(az/divisor+sz);
      // Unas pocas aves cambian de rumbo; las demás responden a sus vecinas.
      if(iniciadoras.has(i) && t>=giro && t<giro+r.duracionEmpuje){vx-=0.19*r.empuje;vz+=0.25*r.empuje;vy+=0.07*r.empuje;}
      const f=2/Math.max(0.01,Math.hypot(vx,vy,vz));vx*=f;vy*=f;vz*=f;
      return {x:a.x+vx*PASO,y:a.y+vy*PASO,z:a.z+vz*PASO,vx,vy,vz};
    });
    estados.push(aves);
  }
  return estados;
}

/** Las 12 aves del costado izquierdo (menor z al empezar): las que inician el giro. */
export function iniciadorasDe(aves:Ave[]):Set<number>{
  return new Set(aves.map((a,i)=>({z:a.z,i})).sort((a,b)=>a.z-b.z).slice(0,12).map(a=>a.i));
}

/**
 * Segundo (de la simulación) en que cada ave ya giró: su rumbo se separa más de `umbral` grados del
 * que llevaba en `giro`. Infinity si no llega a girar antes de `hasta`.
 */
export function momentosDeGiro(estados:Ave[][],giro:number,hasta:number,umbral=25):number[]{
  const k0=Math.max(0,Math.round(giro/PASO));
  const ref=estados[k0];
  const cos=Math.cos(umbral*Math.PI/180);
  return ref.map((r,i)=>{
    const lr=Math.hypot(r.vx,r.vy,r.vz)||1;
    for(let k=k0;k<estados.length && k*PASO<=hasta;k++){
      const a=estados[k][i];
      const c=(a.vx*r.vx+a.vy*r.vy+a.vz*r.vz)/((Math.hypot(a.vx,a.vy,a.vz)||1)*lr);
      if(c<cos)return k*PASO;
    }
    return Infinity;
  });
}
