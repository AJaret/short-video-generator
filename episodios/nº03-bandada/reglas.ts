import {cobertura,rotulo,type Capas} from '@canal';

type Punto={x:number;y:number};
const fase=(t:number,a:number,b:number)=>{
  const u=Math.min(1,Math.max(0,(t-a)/Math.max(0.01,b-a)));
  return u*u*(3-2*u);
};

// Vista desde arriba. La estela conserva el recorrido para poder comparar el antes y el después.
export function reglaEnPantalla(c:Capas,regla:number,t:number,inicio:number,accion:number,fin:number,giro:number){
  const n=[0,2,4,5][regla];
  function pose(i:number,s:number){
    const causa=fase(s,inicio,accion-0.12);
    const respuesta=fase(s,accion,fin-0.13);
    const avance=70*(s-inicio)/(fin-inicio);
    if(regla===1)return i===0
      ? {x:385+avance,y:830-210*respuesta,a:-0.85*Math.sin(Math.PI*respuesta)}
      : {x:245+avance+97*causa,y:1120-238*causa,a:-0.7*(1-causa)};
    if(regla===2){
      const cambio=i===0?respuesta:fase(s,giro,accion-0.12);
      return {x:[265,460,590,720][i]+avance,y:[1010,805,970,820][i]-150*cambio,a:-0.9*cambio};
    }
    const dx=[0,-90,35,-55,70][i],dy=[0,-75,-90,65,45][i];
    return i===0?{x:280+270*respuesta,y:1020-160*respuesta,a:-0.45*Math.sin(Math.PI*respuesta)}
      :{x:480+dx+185*causa+25*respuesta,y:875+dy-55*causa,a:-0.18};
  }
  rotulo(c,['','01 / separación','02 / alineación','03 / cohesión'][regla],90,440,1,{tam:38,tinta:'a'});
  if(regla===1){
    const h=pose(0,t),ctx=c.solido.k;
    ctx.strokeStyle=cobertura(1);ctx.lineWidth=3;ctx.setLineDash([8,13]);ctx.beginPath();ctx.arc(h.x,h.y,126,0,2*Math.PI);ctx.stroke();ctx.setLineDash([]);
  }
  for(let i=n-1;i>=0;i--){
    const {x,y,a}=pose(i,t),ctx=i===0?c.solido.a:c.solido.b;
    ctx.strokeStyle=cobertura(1);ctx.lineWidth=4;ctx.setLineDash([6,10]);ctx.beginPath();
    for(let j=0;j<=28;j++){const p=pose(i,inicio+(t-inicio)*j/28);if(j===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);}
    ctx.stroke();ctx.setLineDash([]);
    ctx.save();ctx.translate(x,y);ctx.rotate(a);
    if(regla===2){ctx.beginPath();ctx.moveTo(42,0);ctx.lineTo(95,0);ctx.lineTo(82,-9);ctx.moveTo(95,0);ctx.lineTo(82,9);ctx.stroke();}
    const batido=7*Math.sin(8*t+i);
    const cara=(p:Punto[],tono:number)=>{
      const tinta=i===0?c.a:c.b;tinta.save();tinta.translate(x,y);tinta.rotate(a);tinta.fillStyle=cobertura(tono);
      tinta.beginPath();p.forEach((v,j)=>j?tinta.lineTo(v.x,v.y):tinta.moveTo(v.x,v.y));tinta.closePath();tinta.fill();tinta.restore();
    };
    for(const lado of [-1,1])cara([{x:39,y:0},{x:4,y:lado*25},{x:-33,y:lado*(54+batido)},{x:-17,y:lado*10},{x:-30,y:0}],lado===1?0.63:1);
    ctx.fillStyle=cobertura(1);ctx.beginPath();ctx.moveTo(46,0);ctx.lineTo(-32,7);ctx.lineTo(-21,0);ctx.lineTo(-32,-7);ctx.closePath();ctx.fill();ctx.restore();
  }
}
