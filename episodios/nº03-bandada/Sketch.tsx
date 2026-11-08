import React,{useMemo} from 'react';
import {useCurrentFrame,useVideoConfig} from 'remotion';
import {cobertura,ORDEN,tiempoDeAncla,useDibujo,type PropsSketch} from '@canal';
import {reglaEnPantalla} from './reglas';
import {vuelo,PASO,type Ave} from './simulacion';

type V=[number,number,number];
const suave=(x:number)=>{const u=Math.min(1,Math.max(0,x));return u*u*(3-2*u);};
const mezcla=(a:number,b:number,q:number)=>a+(b-a)*q;
const Sketch:React.FC<PropsSketch>=({config,tiempos})=>{
 const frame=useCurrentFrame(),{fps,durationInFrames}=useVideoConfig();
 const t=frame/fps,fin=(durationInFrames-1)/fps;
 const ancla=(s:string,reserva:number)=>tiempoDeAncla(tiempos,s)??reserva;
 const cerca=ancla('fíjate',5), r1=ancla('si otra',13), r2=ancla('si las de al lado',17), r3=ancla('y si empieza',21);
 const lejos=ancla('ahora mira desde lejos',26), giro=ancla('unas giran',28), remate=ancla('y la que iba delante',34);
 const estados=useMemo(()=>vuelo(config.semilla,2*fin+3,giro+fin-remate),[config.semilla,fin,giro,remate]);
 // La de delante en el plano final (vuelve el principio del vuelo, como la portada): la de mayor x
 const delante=useMemo(()=>estados[0].map((a,k)=>[a.x,k]).sort((a,b)=>b[0]-a[0])[0][1],[estados]);
 useDibujo(ORDEN.sketch,(capas)=>{
   if(t>=r1 && t<lejos){
     const regla=t<r2?1:t<r3?2:3;
     const accion=regla===1?ancla('se aparta',14.3):regla===2?ancla('ajusta el suyo',17.4):ancla('se acerca al grupo',20.68);
     reglaEnPantalla(capas,regla,t,[0,r1,r2,r3][regla],accion,[0,r2,r3,lejos][regla],ancla('cambian de rumbo',16.02));
     return;
   }
   // El final vuelve al mismo instante y encuadre de la portada.
   const ultimoPlano=t>=remate;
   const reloj=ultimoPlano ? t-remate : t+fin-remate;
   const k=Math.floor(reloj/PASO),q=reloj/PASO-k;
   const todas=estados[k].map((a,i)=>{const b=estados[k+1][i];return {...a,x:mezcla(a.x,b.x,q),y:mezcla(a.y,b.y,q),z:mezcla(a.z,b.z,q)};});
   const centro=todas.reduce((v,a)=>[v[0]+a.x/todas.length,v[1]+a.y/todas.length,v[2]+a.z/todas.length] as V,[0,0,0] as V);
   const rosa=todas[0],detalle=t>=cerca && t<lejos;
   const enfoque=detalle?suave((t-cerca)/0.55)*(1-suave((t-lejos+0.5)/0.5)):0;
   const objetivo:V=[mezcla(centro[0],rosa.x,enfoque),mezcla(centro[1],rosa.y,enfoque),mezcla(centro[2],rosa.z,enfoque)];
   const az=0.45+0.38*Math.sin(reloj*0.24)+1.45*(ultimoPlano?0:suave((t-lejos)/2));
   const el=0.27+0.55*(ultimoPlano?0:suave((t-giro)/2));
   const dist=mezcla(25,7.4,enfoque);
   function proyectar(x:number,y:number,z:number):V{
     x-=objetivo[0];y-=objetivo[1];z-=objetivo[2];
     const u=x*Math.cos(az)-z*Math.sin(az),w=x*Math.sin(az)+z*Math.cos(az);
     const profundidad=dist+w*Math.cos(el)-y*Math.sin(el);
     const f=1250/Math.max(1,profundidad);
     return [500+u*f,820-(y*Math.cos(el)+w*Math.sin(el))*f,profundidad];
   }
   const visibles=todas.map((a,i)=>({a,i,p:proyectar(a.x,a.y,a.z),d:Math.hypot(a.x-rosa.x,a.y-rosa.y,a.z-rosa.z)}))
     .filter(o=>o.p[2]>1.4 && (!detalle || o.d<3.2 || enfoque<0.7)).sort((a,b)=>b.p[2]-a.p[2]);
   const tinta=capas.solido.k;
   if(detalle && enfoque>0.9){
     const h=proyectar(rosa.x,rosa.y,rosa.z);
     tinta.strokeStyle=cobertura(0.72);tinta.lineWidth=2;tinta.setLineDash([6,12]);
     for(const o of visibles.filter(o=>o.i!==0).sort((a,b)=>a.d-b.d).slice(0,4)){
       tinta.beginPath();tinta.moveTo(h[0],h[1]);tinta.lineTo(o.p[0],o.p[1]);tinta.stroke();
     }
     tinta.setLineDash([]);
   }
   // "¿Y la que iba delante?": un círculo punteado la señala solo mientras la voz pregunta por ella
   // (antes aparecía desde que giraba, mientras la voz aún hablaba del giro, y se adelantaba).
   // Se va antes del final para que el último fotograma sea la portada.
   const preguntando=ultimoPlano && t<Math.min(remate+3.2,fin-0.8);
   if(preguntando){
     const d=todas[delante],h=proyectar(d.x,d.y,d.z);
     tinta.strokeStyle=cobertura(1);tinta.lineWidth=3;tinta.setLineDash([7,9]);
     tinta.beginPath();tinta.arc(h[0],h[1],46,0,2*Math.PI);tinta.stroke();tinta.setLineDash([]);
   }
   for(const {a,i} of visibles){
     const largo=Math.hypot(a.vx,a.vz)||1,fx=a.vx/largo,fz=a.vz/largo;
     const ala=Math.sin(reloj*8+i*2.4)*0.32;
     const punto=(avance:number,lado:number,alto:number)=>proyectar(a.x+avance*fx-lado*fz,a.y+alto,a.z+avance*fz+lado*fx);
     const pico=punto(0.46,0,0.04),cola=punto(-0.42,0,-0.04),lomo=punto(0.03,0,0.13);
     const ctx=i===0?capas.a:capas.b;
     for(const lado of [-1,1]){
       const codo=punto(-0.05,lado*0.35,ala+0.11),punta=punto(-0.30,lado*0.85,ala*1.7);
       ctx.fillStyle=cobertura(lado===1?0.98:0.67);
       ctx.beginPath();ctx.moveTo(pico[0],pico[1]);for(const v of [codo,punta,cola,lomo])ctx.lineTo(v[0],v[1]);ctx.closePath();ctx.fill();
     }
     // El pliegue longitudinal y la cola bifurcada mantienen la silueta legible de perfil.
     const cuerpo=i===0?capas.solido.a:capas.solido.b;
     cuerpo.fillStyle=cobertura(1);
     const perfil=[punto(0.52,0,0.06),punto(0.21,0.08,0.12),punto(-0.46,0.13,-0.06),
       punto(-0.34,0,-0.04),punto(-0.46,-0.13,-0.06),punto(0.21,-0.08,0.12)];
     cuerpo.beginPath();perfil.forEach((v,j)=>j?cuerpo.lineTo(v[0],v[1]):cuerpo.moveTo(v[0],v[1]));cuerpo.closePath();cuerpo.fill();
   }
 });
 return null;
};
export default Sketch;
