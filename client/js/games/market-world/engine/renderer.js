// ==========================================================
// Market World - the renderer.
//
// A deliberately small WebGL layer: one shader, one vertex format,
// meshes uploaded once and drawn many times. No external library,
// nothing to download, and it runs on the WebGL 1 that every mid-range
// Android phone already has.
// ==========================================================
import { mat4, identity, multiply, perspective, lookAt, compose, rgb, clamp } from './math.js';

const VERT = `
precision mediump float;
attribute vec3 aPos;
attribute vec3 aNormal;
attribute vec3 aColor;
uniform mat4 uViewProj;
uniform mat4 uModel;
uniform vec3 uTint;
varying vec3 vNormal;
varying vec3 vColor;
varying float vDepth;
varying vec3 vWorld;
void main() {
  vec4 world = uModel * vec4(aPos, 1.0);
  vWorld = world.xyz;
  vNormal = mat3(uModel) * aNormal;
  vColor = aColor * uTint;
  vec4 clip = uViewProj * world;
  vDepth = clip.w;
  gl_Position = clip;
}`;

const FRAG = `
precision mediump float;
varying vec3 vNormal;
varying vec3 vColor;
varying float vDepth;
varying vec3 vWorld;
uniform vec3 uLightDir;
uniform vec3 uSky;
uniform vec3 uGround;
uniform vec3 uFog;
uniform float uFogNear;
uniform float uFogFar;
uniform float uAlpha;
uniform float uEmissive;
void main() {
  vec3 n = normalize(vNormal);
  float key = max(dot(n, uLightDir), 0.0);
  float fill = 0.5 + 0.5 * n.y;                       // hemisphere ambient
  vec3 ambient = mix(uGround, uSky, fill);
  vec3 lit = vColor * (ambient * 0.62 + key * 0.62);
  lit += vColor * uEmissive;
  float fogAmount = clamp((vDepth - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
  vec3 finalColor = mix(lit, uFog, fogAmount * 0.85);
  gl_FragColor = vec4(finalColor, uAlpha);
}`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader failed to build: ${log}`);
  }
  return shader;
}

export class Mesh {
  constructor(gl, data) {
    this.gl = gl;
    this.vbo = gl.createBuffer();
    this.ibo = gl.createBuffer();
    this.count = data.indices.length;
    this.type = data.indices instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, data.verts, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indices, gl.STATIC_DRAW);
  }

  dispose() {
    this.gl.deleteBuffer(this.vbo);
    this.gl.deleteBuffer(this.ibo);
  }
}

export class Renderer {
  constructor(canvas) {
    const opts = { antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false };
    const gl = canvas.getContext('webgl2', opts) || canvas.getContext('webgl', opts);
    if (!gl) throw new Error('This device cannot run 3D graphics in the browser (WebGL is unavailable).');
    this.canvas = canvas;
    this.gl = gl;
    this.isGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
    if (!this.isGL2) gl.getExtension('OES_element_index_uint');

    const program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Shader link failed: ${gl.getProgramInfoLog(program)}`);
    }
    this.program = program;
    gl.useProgram(program);

    this.attribs = {
      pos: gl.getAttribLocation(program, 'aPos'),
      normal: gl.getAttribLocation(program, 'aNormal'),
      color: gl.getAttribLocation(program, 'aColor')
    };
    this.uniforms = {};
    ['uViewProj', 'uModel', 'uTint', 'uLightDir', 'uSky', 'uGround', 'uFog', 'uFogNear', 'uFogFar', 'uAlpha', 'uEmissive']
      .forEach((name) => { this.uniforms[name] = gl.getUniformLocation(program, name); });

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.clearColor(0.55, 0.78, 0.95, 1);

    this.viewProj = mat4();
    this.view = mat4();
    this.proj = mat4();
    this.model = mat4();
    this.dpr = 1;
    this.width = 1;
    this.height = 1;
    this.drawCalls = 0;
    this.sky = rgb('#dff1ff');
    this.ground = rgb('#4a6d3a');
    this.fog = rgb('#cfe8ff');
    this.fogNear = 34;
    this.fogFar = 110;
    this.lightDir = [0.45, 0.82, 0.35];
    this.quality = 1;
  }

  /** Resizes the drawing buffer, capping pixel density so phones stay smooth. */
  resize(cssWidth, cssHeight) {
    const cap = this.quality >= 1 ? 2 : 1.35;
    const dpr = Math.min(window.devicePixelRatio || 1, cap);
    const w = Math.max(1, Math.round(cssWidth * dpr));
    const h = Math.max(1, Math.round(cssHeight * dpr));
    if (w === this.canvas.width && h === this.canvas.height) return;
    this.canvas.width = w;
    this.canvas.height = h;
    this.dpr = dpr;
    this.width = cssWidth;
    this.height = cssHeight;
    this.gl.viewport(0, 0, w, h);
  }

  setSky(skyHex, groundHex, fogHex) {
    this.sky = rgb(skyHex);
    this.ground = rgb(groundHex);
    this.fog = rgb(fogHex);
    this.gl.clearColor(this.fog[0], this.fog[1], this.fog[2], 1);
  }

  beginFrame(camera) {
    const gl = this.gl;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);
    const aspect = this.canvas.width / Math.max(1, this.canvas.height);
    perspective(this.proj, camera.fov, aspect, 0.5, 260);
    lookAt(this.view, camera.eye, camera.target, [0, 1, 0]);
    multiply(this.viewProj, this.proj, this.view);
    gl.uniformMatrix4fv(this.uniforms.uViewProj, false, this.viewProj);
    gl.uniform3fv(this.uniforms.uLightDir, this.lightDir);
    gl.uniform3fv(this.uniforms.uSky, this.sky);
    gl.uniform3fv(this.uniforms.uGround, this.ground);
    gl.uniform3fv(this.uniforms.uFog, this.fog);
    gl.uniform1f(this.uniforms.uFogNear, this.fogNear);
    gl.uniform1f(this.uniforms.uFogFar, this.fogFar);
    gl.uniform1f(this.uniforms.uAlpha, 1);
    gl.uniform1f(this.uniforms.uEmissive, 0);
    gl.uniform3f(this.uniforms.uTint, 1, 1, 1);
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    this.boundMesh = null;
    this.drawCalls = 0;
  }

  bind(mesh) {
    if (this.boundMesh === mesh) return;
    const gl = this.gl;
    const stride = 9 * 4;
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo);
    gl.enableVertexAttribArray(this.attribs.pos);
    gl.vertexAttribPointer(this.attribs.pos, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(this.attribs.normal);
    gl.vertexAttribPointer(this.attribs.normal, 3, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(this.attribs.color);
    gl.vertexAttribPointer(this.attribs.color, 3, gl.FLOAT, false, stride, 24);
    this.boundMesh = mesh;
  }

  /**
   * Draws a mesh. `t` is an optional transform object; leaving it out draws
   * the mesh exactly where its vertices already are (used for static scenery
   * that was baked into world space when it was built).
   */
  draw(mesh, t, tint, alpha = 1, emissive = 0) {
    if (!mesh || !mesh.count) return;
    const gl = this.gl;
    this.bind(mesh);
    if (t) {
      compose(this.model, t.x || 0, t.y || 0, t.z || 0, t.rx || 0, t.ry || 0, t.rz || 0,
        t.sx ?? t.s ?? 1, t.sy ?? t.s ?? 1, t.sz ?? t.s ?? 1);
    } else {
      identity(this.model);
    }
    gl.uniformMatrix4fv(this.uniforms.uModel, false, this.model);
    if (tint) gl.uniform3f(this.uniforms.uTint, tint[0], tint[1], tint[2]);
    else gl.uniform3f(this.uniforms.uTint, 1, 1, 1);
    gl.uniform1f(this.uniforms.uAlpha, alpha);
    gl.uniform1f(this.uniforms.uEmissive, emissive);
    gl.drawElements(gl.TRIANGLES, mesh.count, mesh.type, 0);
    this.drawCalls += 1;
  }

  /** Draws with a matrix that was already worked out (used by the skeletons). */
  drawMatrix(mesh, matrix, tint, alpha = 1, emissive = 0) {
    if (!mesh || !mesh.count) return;
    const gl = this.gl;
    this.bind(mesh);
    gl.uniformMatrix4fv(this.uniforms.uModel, false, matrix);
    if (tint) gl.uniform3f(this.uniforms.uTint, tint[0], tint[1], tint[2]);
    else gl.uniform3f(this.uniforms.uTint, 1, 1, 1);
    gl.uniform1f(this.uniforms.uAlpha, alpha);
    gl.uniform1f(this.uniforms.uEmissive, emissive);
    gl.drawElements(gl.TRIANGLES, mesh.count, mesh.type, 0);
    this.drawCalls += 1;
  }

  beginTransparent() {
    const gl = this.gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
  }

  endTransparent() {
    const gl = this.gl;
    gl.disable(gl.BLEND);
    gl.depthMask(true);
  }

  /** Screen position of a world point, for pinning DOM labels onto the scene. */
  project(x, y, z, out) {
    const m = this.viewProj;
    const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (cw <= 0.001) { out.visible = false; return out; }
    const cx = m[0] * x + m[4] * y + m[8] * z + m[12];
    const cy = m[1] * x + m[5] * y + m[9] * z + m[13];
    out.x = (cx / cw * 0.5 + 0.5) * this.width;
    out.y = (0.5 - cy / cw * 0.5) * this.height;
    out.visible = out.x > -80 && out.x < this.width + 80 && out.y > -80 && out.y < this.height + 80;
    return out;
  }
}

/** A third person camera that follows the player and can be swung by a drag. */
export class Camera {
  constructor() {
    this.fov = 52 * Math.PI / 180;
    this.eye = [0, 12, 16];
    this.target = [0, 1, 0];
    this.focusX = 0;
    this.focusZ = 0;
    this.yaw = 0;
    this.pitch = 0.86;
    this.distance = 15;
    this.shake = 0;
  }

  setDistance(d) { this.distance = clamp(d, 7, 42); }

  update(dt, fx, fz, fy = 0) {
    this.focusX += (fx - this.focusX) * Math.min(1, dt * 6);
    this.focusZ += (fz - this.focusZ) * Math.min(1, dt * 6);
    const p = clamp(this.pitch, 0.35, 1.32);
    const horizontal = Math.cos(p) * this.distance;
    let shakeX = 0; let shakeY = 0;
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.2);
      shakeX = (Math.random() - 0.5) * this.shake * 0.5;
      shakeY = (Math.random() - 0.5) * this.shake * 0.5;
    }
    this.eye[0] = this.focusX + Math.sin(this.yaw) * horizontal + shakeX;
    this.eye[1] = fy + Math.sin(p) * this.distance + shakeY;
    this.eye[2] = this.focusZ + Math.cos(this.yaw) * horizontal;
    this.target[0] = this.focusX;
    this.target[1] = fy + 1.1;
    this.target[2] = this.focusZ;
  }

  /** Turns a tap into a point on the ground plane, for tap-to-walk. */
  screenToGround(nx, ny, aspect) {
    const tan = Math.tan(this.fov / 2);
    const dirCamera = [nx * tan * aspect, ny * tan, -1];
    const f = [this.target[0] - this.eye[0], this.target[1] - this.eye[1], this.target[2] - this.eye[2]];
    const fl = Math.hypot(f[0], f[1], f[2]) || 1;
    const fz = [-f[0] / fl, -f[1] / fl, -f[2] / fl];
    let rx = fz[2] * 0 - fz[1] * 0;
    let sx = 1 * fz[2] - 0 * fz[1];
    // right = normalize(cross(up, fz))
    const upx = 0, upy = 1, upz = 0;
    rx = upy * fz[2] - upz * fz[1];
    const ry = upz * fz[0] - upx * fz[2];
    const rz = upx * fz[1] - upy * fz[0];
    const rl = Math.hypot(rx, ry, rz) || 1;
    const right = [rx / rl, ry / rl, rz / rl];
    const up = [fz[1] * right[2] - fz[2] * right[1], fz[2] * right[0] - fz[0] * right[2], fz[0] * right[1] - fz[1] * right[0]];
    const dir = [
      right[0] * dirCamera[0] + up[0] * dirCamera[1] - fz[0],
      right[1] * dirCamera[0] + up[1] * dirCamera[1] - fz[1],
      right[2] * dirCamera[0] + up[2] * dirCamera[1] - fz[2]
    ];
    if (Math.abs(dir[1]) < 0.0001) return null;
    const t = -this.eye[1] / dir[1];
    if (t < 0) return null;
    void sx;
    return { x: this.eye[0] + dir[0] * t, z: this.eye[2] + dir[2] * t };
  }
}
