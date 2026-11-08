// <RisoFilter>: post-proceso WebGL de todo el fotograma.
//
//  1. Cada fotograma limpia las seis capas (a, b, k tramadas + sus sólidas) y llama a las funciones registradas con useDibujo().
//  2. Sube las capas como texturas y el shader:
//     - toma la cobertura de cada tinta (alfa × (1 − luminancia)),
//     - la trama con Bayer 4×4 a 4 niveles, con punto de 3 px,
//     - desplaza cada tinta (desajuste de registro con temblor leve y determinista),
//     - combina las tintas en multiply sobre el papel,
//     - añade grano de papel al 4 %.
import React, {useLayoutEffect, useRef, useState, useEffect} from 'react';
import {AbsoluteFill, continueRender, delayRender, useCurrentFrame, useVideoConfig} from 'remotion';
import {ContextoRiso, todasLasCapas, type Capas, type Registro} from './capas';
import {cargarFuentes} from './fuentes';
import {hexARgb, NEGRO, PAPEL, type Tintas} from './paleta';
import {DURACION_PORTADA} from './diseno';
import {mulberry32, ruido1d} from './prng';
import {golpe, type Pulso} from './pulso';

const VERTICES = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAGMENTOS = `
precision highp float;
uniform sampler2D uA;
uniform sampler2D uB;
uniform sampler2D uK;
uniform sampler2D uSA;
uniform sampler2D uSB;
uniform sampler2D uSK;
uniform vec2 uRes;
uniform float uPunto;
uniform vec2 uOffA;
uniform vec2 uOffB;
uniform vec2 uOffK;
uniform vec3 uColA;
uniform vec3 uColB;
uniform vec3 uColK;
uniform vec3 uPapel;
uniform float uGrano;

// Bayer 2×2 = [[0,2],[3,1]] → bayer4 combina dos niveles.
float bayer2(vec2 p) { return mod(2.0 * p.x + 3.0 * p.y, 4.0); }
float bayer4(vec2 celda) {
  vec2 p1 = mod(celda, 2.0);
  vec2 p2 = mod(floor(celda / 2.0), 2.0);
  return (4.0 * bayer2(p1) + bayer2(p2) + 0.5) / 16.0;
}

float cobertura(vec4 t) {
  float luma = dot(t.rgb, vec3(0.299, 0.587, 0.114));
  return t.a * (1.0 - luma);
}

// Trama ordenada a 4 niveles: 0, 1/3, 2/3, 1.
float tramar(float v, vec2 celda) {
  return clamp(floor(v * 3.0 + bayer4(celda)) / 3.0, 0.0, 1.0);
}

// Cobertura tramada de una capa en el píxel, con su desajuste de registro.
float tinta(sampler2D capa, vec2 pix, vec2 desajuste) {
  vec2 p = pix - desajuste;
  vec2 celda = floor(p / uPunto);
  vec2 uv = (celda + 0.5) * uPunto / uRes;
  return tramar(cobertura(texture2D(capa, uv)), celda);
}

// Capa sólida (texto, líneas finas): sin trama, umbral al 50 %, mismo desajuste que su tinta.
float solida(sampler2D capa, vec2 pix, vec2 desajuste) {
  vec2 uv = (floor(pix - desajuste) + 0.5) / uRes;
  return step(0.5, cobertura(texture2D(capa, uv)));
}

float azar(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  // Coordenadas en píxeles con origen arriba a la izquierda (como el canvas 2D)
  vec2 pix = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);

  float a = max(tinta(uA, pix, uOffA), solida(uSA, pix, uOffA));
  float b = max(tinta(uB, pix, uOffB), solida(uSB, pix, uOffB));
  float k = max(tinta(uK, pix, uOffK), solida(uSK, pix, uOffK));

  vec3 color = uPapel;
  color *= mix(vec3(1.0), uColA, a);
  color *= mix(vec3(1.0), uColB, b);
  color *= mix(vec3(1.0), uColK, k);

  // Grano de papel estático (fibra fina + grumos), tinte negro riso
  float grano = azar(floor(pix)) * 0.7 + azar(floor(pix / 3.0) + 17.0) * 0.3;
  color = mix(color, uColK, uGrano * grano);

  gl_FragColor = vec4(color, 1.0);
}
`;

type EstadoGL = {
  gl: WebGLRenderingContext;
  programa: WebGLProgram;
  texturas: WebGLTexture[];
  uniforms: Record<string, WebGLUniformLocation | null>;
};

function compilar(gl: WebGLRenderingContext, tipo: number, fuente: string): WebGLShader {
  const shader = gl.createShader(tipo) as WebGLShader;
  gl.shaderSource(shader, fuente);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`Error compilando shader riso: ${gl.getShaderInfoLog(shader)}`);
  }
  return shader;
}

function iniciarGL(canvas: HTMLCanvasElement): EstadoGL {
  const gl = canvas.getContext('webgl', {preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false});
  if (!gl) throw new Error('WebGL no disponible. ¿Se lanzó el render con --gl=swangle o --gl=angle?');
  const programa = gl.createProgram() as WebGLProgram;
  gl.attachShader(programa, compilar(gl, gl.VERTEX_SHADER, VERTICES));
  gl.attachShader(programa, compilar(gl, gl.FRAGMENT_SHADER, FRAGMENTOS));
  gl.linkProgram(programa);
  if (!gl.getProgramParameter(programa, gl.LINK_STATUS)) {
    throw new Error(`Error enlazando shader riso: ${gl.getProgramInfoLog(programa)}`);
  }
  gl.useProgram(programa);

  // Rectángulo a pantalla completa
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(programa, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const texturas = ['uA', 'uB', 'uK', 'uSA', 'uSB', 'uSK'].map((nombre, i) => {
    const tex = gl.createTexture() as WebGLTexture;
    gl.activeTexture(gl.TEXTURE0 + i);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(gl.getUniformLocation(programa, nombre), i);
    return tex;
  });
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

  const nombres = ['uRes', 'uPunto', 'uOffA', 'uOffB', 'uOffK', 'uColA', 'uColB', 'uColK', 'uPapel', 'uGrano'];
  const uniforms = Object.fromEntries(nombres.map((n) => [n, gl.getUniformLocation(programa, n)]));
  return {gl, programa, texturas, uniforms};
}

/**
 * Desajuste de registro de una tinta en el fotograma: base fija por semilla (≈1,6–2,4 px), un
 * temblor suave de ±0.8 px y un `empuje` (px) que late con la música ("golpe riso", como el tambor
 * de la impresora en cada vuelta). Entre A y B quedan 2–6 px.
 */
function desajuste(semilla: number, tinta: number, frame: number, base: number, empuje = 0): [number, number] {
  const azar = mulberry32(semilla * 31 + tinta * 7919);
  const angulo = azar() * Math.PI * 2 + tinta * Math.PI; // A y B tienden a ir en sentidos opuestos
  const radio = base + azar() * 0.8 + empuje;
  const tx = (ruido1d(frame / 7, semilla + tinta * 101) - 0.5) * 1.6;
  const ty = (ruido1d(frame / 7, semilla + tinta * 211 + 5) - 0.5) * 1.6;
  return [Math.cos(angulo) * radio + tx, Math.sin(angulo) * radio + ty];
}

export type PropsRisoFilter = {
  tintas: Tintas;
  semilla: number;
  /** Tamaño del punto de trama en px (3–4 a 1080×1920). */
  punto?: number;
  /** Opacidad del grano de papel (0.03–0.05). */
  grano?: number;
  /** Pulso musical: el registro late en cada tiempo y el fotograma da un leve empujón en cada compás. */
  pulso?: Pulso | null;
  children?: React.ReactNode;
};

const EMPUJE_REGISTRO = 0.9; // px extra por tinta en cada tiempo
const EMPUJE_ESCALA = 0.01; // escala extra en el primer tiempo de cada compás

export const RisoFilter: React.FC<PropsRisoFilter> = ({tintas, semilla, punto = 3, grano = 0.04, pulso, children}) => {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<EstadoGL | null>(null);
  const [registro] = useState<Registro>(() => new Map());
  const [capas] = useState<Capas>(() => {
    const crear = () => {
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      return c.getContext('2d') as CanvasRenderingContext2D;
    };
    return {a: crear(), b: crear(), k: crear(), solido: {a: crear(), b: crear(), k: crear()}};
  });

  // Las fuentes deben estar cargadas antes de dibujar texto en los canvas
  const [esperaFuentes] = useState(() => delayRender('Cargando fuentes del canal'));
  const [fuentesListas, setFuentesListas] = useState(false);
  useEffect(() => {
    cargarFuentes().then(() => setFuentesListas(true));
  }, []);
  useEffect(() => {
    if (fuentesListas) continueRender(esperaFuentes);
  }, [fuentesListas, esperaFuentes]);

  // Golpe riso: late en cada tiempo de la música (no durante la portada: la miniatura sale limpia)
  const t = frame / fps;
  const conGolpe = Boolean(pulso?.golpeVisual) && t >= DURACION_PORTADA;
  const latido = conGolpe && pulso ? golpe(t, pulso, 1, 0.12) : 0;
  const escala = conGolpe && pulso ? 1 + EMPUJE_ESCALA * golpe(t, pulso, 4, 0.15) : 1;

  // Se ejecuta en cada render, después de que los hijos registraron su dibujo
  useLayoutEffect(() => {
    if (!fuentesListas || !canvasRef.current) return;
    if (!glRef.current) glRef.current = iniciarGL(canvasRef.current);
    const {gl, texturas, uniforms: u} = glRef.current;

    // 1. Dibujar las capas
    const info = {frame, fps, t: frame / fps, ancho: width, alto: height};
    const lista = todasLasCapas(capas);
    for (const ctx of lista) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, width, height);
    }
    const entradas = [...registro.values()].sort((x, y) => x.orden - y.orden);
    for (const {fn} of entradas) {
      lista.forEach((ctx) => ctx.save());
      fn(capas, info);
      lista.forEach((ctx) => ctx.restore());
    }

    // 2. Subir texturas
    lista.forEach((ctx, i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, texturas[i]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ctx.canvas);
    });

    // 3. Uniforms y dibujo
    gl.viewport(0, 0, width, height);
    gl.uniform2f(u.uRes, width, height);
    gl.uniform1f(u.uPunto, punto);
    const empuje = EMPUJE_REGISTRO * latido;
    gl.uniform2f(u.uOffA, ...desajuste(semilla, 1, frame, 1.6, empuje));
    gl.uniform2f(u.uOffB, ...desajuste(semilla, 2, frame, 1.6, empuje));
    gl.uniform2f(u.uOffK, 0, 0); // el negro es la plancha de referencia
    gl.uniform3f(u.uColA, ...hexARgb(tintas.a));
    gl.uniform3f(u.uColB, ...hexARgb(tintas.b));
    gl.uniform3f(u.uColK, ...hexARgb(NEGRO));
    gl.uniform3f(u.uPapel, ...hexARgb(PAPEL));
    gl.uniform1f(u.uGrano, grano);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  });

  return (
    <ContextoRiso.Provider value={registro}>
      <AbsoluteFill style={{backgroundColor: PAPEL}}>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{width: '100%', height: '100%', transform: `scale(${escala})`}}
        />
      </AbsoluteFill>
      {children}
    </ContextoRiso.Provider>
  );
};
