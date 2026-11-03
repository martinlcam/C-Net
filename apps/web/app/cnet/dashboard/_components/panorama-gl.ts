// WebGL renderer for dual-fisheye frames. One full-screen triangle pair; the fragment shader
// turns every pixel into a world ray, picks the lens that faces it and reads the fisheye
// circle, blending the two in a narrow band around the seam. Mirrors the maths in panorama.ts.

import { blendAngle, type Calibration, type Mat3 } from "./panorama"

export type PanoramaSource = HTMLVideoElement | HTMLImageElement

export type PanoramaRenderer = {
  setSource(source: PanoramaSource | null): void
  setCalibration(cal: Calibration): void
  setView(view: Mat3, fov: number): void
  resize(cssWidth: number, cssHeight: number, dpr: number): void
  /** Draw the current view, uploading a new frame first when the source has one. False if the
   * source had nothing to show yet. */
  draw(): boolean
  dispose(): void
}

const VERTEX = `
attribute vec2 aPos;
varying vec2 vPos;
void main() {
  vPos = aPos;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`

const FRAGMENT = `
precision highp float;
uniform sampler2D uTex;
uniform mat3 uView;
uniform float uAspect;
uniform float uTanHalf;
uniform vec3 uLens0;
uniform vec3 uLens1;
uniform float uBlend;
varying vec2 vPos;

const float HALF_PI = 1.5707963267948966;

// side is +1 for lens 0 (left circle, looks forward) and -1 for lens 1 (right, looks back).
vec2 lensUv(vec3 d, vec3 lens, float side) {
  float z = side * d.z;
  vec2 p = vec2(side * d.x, -d.y);
  float theta = acos(clamp(z, -1.0, 1.0));
  float rho = lens.z * theta / HALF_PI;
  float planar = length(p);
  vec2 s = planar > 0.0 ? p / planar * rho : vec2(0.0);
  float index = side > 0.0 ? 0.0 : 0.5;
  float u = index + 0.25 * (1.0 + lens.x + s.x);
  float v = 0.5 * (1.0 + lens.y + s.y);
  return vec2(clamp(u, index, index + 0.5), clamp(v, 0.0, 1.0));
}

void main() {
  vec3 cam = normalize(vec3(vPos.x * uTanHalf, vPos.y * uTanHalf * uAspect, 1.0));
  vec3 d = uView * cam;
  float w0 = smoothstep(-uBlend, uBlend, d.z);
  vec3 c = vec3(0.0);
  if (w0 > 0.0) c += w0 * texture2D(uTex, lensUv(d, uLens0, 1.0)).rgb;
  if (w0 < 1.0) c += (1.0 - w0) * texture2D(uTex, lensUv(d, uLens1, -1.0)).rgb;
  gl_FragColor = vec4(c, 1.0);
}`

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, src)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("panorama shader:", gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader
}

function sourceReady(source: PanoramaSource): boolean {
  if (source instanceof HTMLVideoElement) return source.readyState >= 2 && source.videoWidth > 0
  return source.complete && source.naturalWidth > 0
}

export function createPanoramaRenderer(canvas: HTMLCanvasElement): PanoramaRenderer | null {
  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
    powerPreference: "high-performance",
  })
  if (!gl) return null

  const vs = compile(gl, gl.VERTEX_SHADER, VERTEX)
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT)
  const program = gl.createProgram()
  if (!vs || !fs || !program) return null
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("panorama program:", gl.getProgramInfoLog(program))
    return null
  }
  // biome-ignore lint/correctness/useHookAtTopLevel: WebGL's useProgram is not a React hook
  gl.useProgram(program)

  const quad = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, quad)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const aPos = gl.getAttribLocation(program, "aPos")
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  // Video frames are not power-of-two sized: clamp and skip mipmaps or sampling returns black.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array(3))

  const u = {
    view: gl.getUniformLocation(program, "uView"),
    aspect: gl.getUniformLocation(program, "uAspect"),
    tanHalf: gl.getUniformLocation(program, "uTanHalf"),
    lens0: gl.getUniformLocation(program, "uLens0"),
    lens1: gl.getUniformLocation(program, "uLens1"),
    blend: gl.getUniformLocation(program, "uBlend"),
  }

  let source: PanoramaSource | null = null
  let uploaded = false
  // The frame last pushed to the GPU, so a paused video is not re-uploaded on every pan.
  let uploadedTime = -1
  let disposed = false

  const renderer: PanoramaRenderer = {
    setSource(next) {
      source = next
      uploaded = false
      uploadedTime = -1
    },
    setCalibration(cal) {
      const [a, b] = cal.lenses
      gl.uniform3f(u.lens0, a.cx, a.cy, a.r90)
      gl.uniform3f(u.lens1, b.cx, b.cy, b.r90)
      gl.uniform1f(u.blend, Math.sin(blendAngle(cal)))
    },
    setView(view, fov) {
      gl.uniformMatrix3fv(u.view, false, view)
      gl.uniform1f(u.tanHalf, Math.tan(fov / 2))
    },
    resize(cssWidth, cssHeight, dpr) {
      const w = Math.max(1, Math.round(cssWidth * dpr))
      const h = Math.max(1, Math.round(cssHeight * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      gl.viewport(0, 0, w, h)
      gl.uniform1f(u.aspect, h / w)
    },
    draw() {
      if (disposed || !source || !sourceReady(source)) return false
      const time = source instanceof HTMLVideoElement ? source.currentTime : 0
      if (!uploaded || time !== uploadedTime) {
        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, source)
        uploaded = true
        uploadedTime = time
      }
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      return true
    },
    dispose() {
      disposed = true
      gl.deleteTexture(texture)
      gl.deleteBuffer(quad)
      gl.deleteProgram(program)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      // The context itself is left alone: React dev double-mounts into the same canvas, and a
      // lost context cannot compile shaders again. It goes away with the canvas element.
    },
  }
  return renderer
}
