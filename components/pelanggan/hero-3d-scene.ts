export type DishPreset = "nasi" | "mie" | "esteh";

interface MeshData {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint16Array;
}

interface CompiledMesh {
  posBuffer: WebGLBuffer;
  normBuffer: WebGLBuffer;
  idxBuffer: WebGLBuffer;
  count: number;
}

interface ScenePart {
  mesh: CompiledMesh;
  color: [number, number, number];
  alpha: number;
  shininess: number;
  specular: number;
  pos: [number, number, number];
  rot: [number, number, number];
  scale: [number, number, number];
  animKind?: "steam" | "ice";
  phase?: number;
}

export interface Hero3DOptions {
  initialDish?: DishPreset;
  reducedMotion?: boolean;
  onReady?: () => void;
}

export interface Hero3DController {
  setDish: (dish: DishPreset) => void;
  setReducedMotion: (reduced: boolean) => void;
  resetView: () => void;
  resize: () => void;
  destroy: () => void;
}

const VERTEX_SHADER = `
  attribute vec3 aPosition;
  attribute vec3 aNormal;
  uniform mat4 uProjection;
  uniform mat4 uView;
  uniform mat4 uModel;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  void main() {
    vec4 worldPos = uModel * vec4(aPosition, 1.0);
    vWorldPos = worldPos.xyz;
    vNormal = normalize(mat3(uModel) * aNormal);
    gl_Position = uProjection * uView * worldPos;
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  uniform vec3 uColor;
  uniform float uAlpha;
  uniform float uShininess;
  uniform float uSpecular;
  uniform vec3 uCameraPos;
  uniform vec3 uKeyLightDir;
  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(uCameraPos - vWorldPos);
    vec3 keyDir = normalize(uKeyLightDir);
    vec3 fillDir = normalize(vec3(-0.75, 0.25, 0.55));
    vec3 rimDir = normalize(vec3(0.0, 0.7, -0.85));
    float keyDiff = max(dot(N, keyDir), 0.0);
    float fillDiff = max(dot(N, fillDir), 0.0);
    float rimDiff = max(dot(N, rimDir), 0.0);
    vec3 H = normalize(keyDir + V);
    float spec = pow(max(dot(N, H), 0.0), uShininess) * uSpecular;
    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.6);
    float hemi = 0.5 + 0.5 * N.y;
    vec3 ambient = mix(vec3(0.16, 0.24, 0.19), vec3(0.46, 0.44, 0.39), hemi);
    vec3 keyColor = vec3(1.0, 0.96, 0.89) * keyDiff * 0.92;
    vec3 fillColor = vec3(0.36, 0.62, 0.46) * fillDiff * 0.34;
    vec3 rimColor = vec3(0.98, 0.80, 0.52) * (rimDiff * 0.35 + fresnel * 0.32);
    vec3 lit = uColor * (ambient + keyColor + fillColor) + rimColor * 0.42 + vec3(1.0, 0.97, 0.92) * spec;
    gl_FragColor = vec4(lit, uAlpha);
  }
`;

function mat4Identity(): Float32Array {
  const out = new Float32Array(16);
  out[0] = 1; out[5] = 1; out[10] = 1; out[15] = 1;
  return out;
}

function mat4Multiply(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16);
  for (let col = 0; col < 4; col++) {
    const b0 = b[col * 4], b1 = b[col * 4 + 1], b2 = b[col * 4 + 2], b3 = b[col * 4 + 3];
    out[col * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
    out[col * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
    out[col * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
    out[col * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
  }
  return out;
}

function mat4Perspective(fovRad: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1.0 / Math.tan(fovRad / 2);
  const nf = 1 / (near - far);
  const out = new Float32Array(16);
  out[0] = f / aspect; out[5] = f; out[10] = (far + near) * nf; out[11] = -1; out[14] = 2 * far * near * nf;
  return out;
}

function mat4LookAt(eye: [number, number, number], center: [number, number, number], up: [number, number, number]): Float32Array {
  let zx = eye[0] - center[0], zy = eye[1] - center[1], zz = eye[2] - center[2];
  let len = Math.hypot(zx, zy, zz) || 1;
  zx /= len; zy /= len; zz /= len;
  let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
  len = Math.hypot(xx, xy, xz) || 1;
  xx /= len; xy /= len; xz /= len;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  const out = mat4Identity();
  out[0] = xx; out[1] = yx; out[2] = zx;
  out[4] = xy; out[5] = yy; out[6] = zy;
  out[8] = xz; out[9] = yz; out[10] = zz;
  out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
  return out;
}

function mat4FromTRS(pos: [number, number, number], rot: [number, number, number], scale: [number, number, number]): Float32Array {
  const [tx, ty, tz] = pos, [rx, ry, rz] = rot, [sx, sy, sz] = scale;
  const cx = Math.cos(rx), sinX = Math.sin(rx), cy = Math.cos(ry), sinY = Math.sin(ry), cz = Math.cos(rz), sinZ = Math.sin(rz);
  const out = new Float32Array(16);
  out[0] = (cy * cz + sinY * sinX * sinZ) * sx;
  out[1] = (cx * sinZ) * sx;
  out[2] = (-sinY * cz + cy * sinX * sinZ) * sx;
  out[4] = (-cy * sinZ + sinY * sinX * cz) * sy;
  out[5] = (cx * cz) * sy;
  out[6] = (sinY * sinZ + cy * sinX * cz) * sy;
  out[8] = (sinY * cx) * sz;
  out[9] = (-sinX) * sz;
  out[10] = (cy * cx) * sz;
  out[12] = tx; out[13] = ty; out[14] = tz; out[15] = 1;
  return out;
}

function createSphere(rx: number, ry: number, rz: number, lat = 14, lon = 20): MeshData {
  const positions: number[] = [], normals: number[] = [], indices: number[] = [];
  for (let i = 0; i <= lat; i++) {
    const theta = (i * Math.PI) / lat, sinT = Math.sin(theta), cosT = Math.cos(theta);
    for (let j = 0; j <= lon; j++) {
      const phi = (j * 2 * Math.PI) / lon, sinP = Math.sin(phi), cosP = Math.cos(phi);
      const nx = cosP * sinT, ny = cosT, nz = sinP * sinT;
      positions.push(nx * rx, ny * ry, nz * rz);
      const nLen = Math.hypot(nx / rx, ny / ry, nz / rz) || 1;
      normals.push(nx / rx / nLen, ny / ry / nLen, nz / rz / nLen);
    }
  }
  for (let i = 0; i < lat; i++) {
    for (let j = 0; j < lon; j++) {
      const a = i * (lon + 1) + j, b = a + lon + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), indices: new Uint16Array(indices) };
}

function createLathe(profile: ReadonlyArray<[number, number]>, segments = 32): MeshData {
  const positions: number[] = [], normals: number[] = [], indices: number[] = [];
  const rows = profile.length;
  for (let i = 0; i < rows; i++) {
    const [r, y] = profile[i];
    const prev = profile[Math.max(0, i - 1)], next = profile[Math.min(rows - 1, i + 1)];
    let nr = next[1] - prev[1], ny = -(next[0] - prev[0]);
    const nLen = Math.hypot(nr, ny) || 1;
    nr /= nLen; ny /= nLen;
    for (let j = 0; j <= segments; j++) {
      const phi = (j * 2 * Math.PI) / segments, cosP = Math.cos(phi), sinP = Math.sin(phi);
      positions.push(r * cosP, y, r * sinP);
      normals.push(nr * cosP, ny, nr * sinP);
    }
  }
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * (segments + 1) + j, b = a + segments + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), indices: new Uint16Array(indices) };
}

function createTorus(majorR: number, minorR: number, majorSegs = 28, minorSegs = 12): MeshData {
  const positions: number[] = [], normals: number[] = [], indices: number[] = [];
  for (let i = 0; i <= majorSegs; i++) {
    const u = (i * 2 * Math.PI) / majorSegs, cosU = Math.cos(u), sinU = Math.sin(u);
    for (let j = 0; j <= minorSegs; j++) {
      const v = (j * 2 * Math.PI) / minorSegs, cosV = Math.cos(v), sinV = Math.sin(v);
      positions.push((majorR + minorR * cosV) * cosU, minorR * sinV, (majorR + minorR * cosV) * sinU);
      normals.push(cosV * cosU, sinV, cosV * sinU);
    }
  }
  for (let i = 0; i < majorSegs; i++) {
    for (let j = 0; j < minorSegs; j++) {
      const a = i * (minorSegs + 1) + j, b = a + minorSegs + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), indices: new Uint16Array(indices) };
}

function createCylinder(rTop: number, rBottom: number, height: number, segments = 16): MeshData {
  const half = height / 2;
  return createLathe([[0.001, -half], [rBottom, -half], [rBottom, -half + 0.001], [rTop, half - 0.001], [rTop, half], [0.001, half]], segments);
}

function createBox(w: number, h: number, d: number): MeshData {
  const hx = w / 2, hy = h / 2, hz = d / 2;
  const faces: Array<{ n: [number, number, number]; v: Array<[number, number, number]> }> = [
    { n: [0, 0, 1], v: [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]] },
    { n: [0, 0, -1], v: [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]] },
    { n: [0, 1, 0], v: [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]] },
    { n: [0, -1, 0], v: [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]] },
    { n: [1, 0, 0], v: [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]] },
    { n: [-1, 0, 0], v: [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]] },
  ];
  const positions: number[] = [], normals: number[] = [], indices: number[] = [];
  faces.forEach((face, idx) => {
    const base = idx * 4;
    for (const [x, y, z] of face.v) {
      positions.push(x, y, z);
      normals.push(face.n[0], face.n[1], face.n[2]);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  });
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), indices: new Uint16Array(indices) };
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function uploadMesh(gl: WebGLRenderingContext, data: MeshData, registry: CompiledMesh[]): CompiledMesh | null {
  const posBuffer = gl.createBuffer(), normBuffer = gl.createBuffer(), idxBuffer = gl.createBuffer();
  if (!posBuffer || !normBuffer || !idxBuffer) return null;
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, data.positions, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, normBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, data.normals, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indices, gl.STATIC_DRAW);
  const compiled: CompiledMesh = { posBuffer, normBuffer, idxBuffer, count: data.indices.length };
  registry.push(compiled);
  return compiled;
}

export function mountHero3DScene(canvas: HTMLCanvasElement, options: Hero3DOptions = {}): Hero3DController | null {
  const gl = canvas.getContext("webgl", { alpha: true, antialias: true, powerPreference: "high-performance" });
  if (!gl) return null;
  const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  if (!vs || !fs) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program); gl.deleteShader(vs); gl.deleteShader(fs);
    return null;
  }
  gl.useProgram(program);

  const aPosition = gl.getAttribLocation(program, "aPosition");
  const aNormal = gl.getAttribLocation(program, "aNormal");
  const uProjection = gl.getUniformLocation(program, "uProjection");
  const uView = gl.getUniformLocation(program, "uView");
  const uModel = gl.getUniformLocation(program, "uModel");
  const uColor = gl.getUniformLocation(program, "uColor");
  const uAlpha = gl.getUniformLocation(program, "uAlpha");
  const uShininess = gl.getUniformLocation(program, "uShininess");
  const uSpecular = gl.getUniformLocation(program, "uSpecular");
  const uCameraPos = gl.getUniformLocation(program, "uCameraPos");
  const uKeyLightDir = gl.getUniformLocation(program, "uKeyLightDir");

  const meshes: CompiledMesh[] = [];
  const up = (d: MeshData) => uploadMesh(gl, d, meshes);

  const plateMesh = up(createLathe([[0.001, -0.14], [0.82, -0.14], [1.06, -0.05], [1.38, 0.09], [1.34, 0.14], [0.98, 0.02], [0.001, 0.0]]));
  const plateRimMesh = up(createTorus(1.34, 0.032, 32, 10));
  const riceDomeMesh = up(createLathe([[0.001, 0.0], [0.64, 0.01], [0.62, 0.16], [0.52, 0.34], [0.34, 0.48], [0.14, 0.54], [0.001, 0.55]]));
  const chickenMesh = up(createSphere(0.36, 0.2, 0.28, 12, 16));
  const eggWhiteMesh = up(createSphere(0.3, 0.055, 0.26, 10, 16));
  const eggYolkMesh = up(createSphere(0.13, 0.1, 0.13, 12, 16));
  const sambalMesh = up(createSphere(0.18, 0.11, 0.18, 10, 14));
  const leafMesh = up(createSphere(0.24, 0.045, 0.16, 10, 14));
  const cucumberMesh = up(createCylinder(0.14, 0.14, 0.04, 16));
  const steamMesh = up(createSphere(0.12, 0.15, 0.12, 10, 12));
  const bowlMesh = up(createLathe([[0.001, -0.42], [0.54, -0.42], [0.62, -0.34], [0.95, -0.06], [1.14, 0.34], [1.07, 0.36], [0.88, 0.0], [0.52, -0.3], [0.001, -0.32]]));
  const bowlRimMesh = up(createTorus(1.105, 0.036, 32, 10));
  const brothMesh = up(createCylinder(0.96, 0.88, 0.06, 28));
  const noodleRingLarge = up(createTorus(0.56, 0.075, 28, 10));
  const noodleRingMid = up(createTorus(0.34, 0.07, 24, 10));
  const noodleRingTop = up(createTorus(0.18, 0.065, 20, 10));
  const chopstickMesh = up(createCylinder(0.022, 0.036, 2.25, 10));
  const glassMesh = up(createLathe([[0.001, -0.72], [0.48, -0.72], [0.52, -0.66], [0.68, 0.66], [0.63, 0.68], [0.48, -0.58], [0.001, -0.6]]));
  const teaLiquidMesh = up(createCylinder(0.59, 0.45, 1.06, 24));
  const iceCubeMesh = up(createBox(0.24, 0.24, 0.24));
  const strawMesh = up(createCylinder(0.038, 0.038, 1.82, 12));
  const limeMesh = up(createCylinder(0.26, 0.26, 0.055, 20));
  const coasterMesh = up(createCylinder(0.74, 0.78, 0.06, 28));

  if (
    !plateMesh || !plateRimMesh || !riceDomeMesh || !chickenMesh || !eggWhiteMesh || !eggYolkMesh ||
    !sambalMesh || !leafMesh || !cucumberMesh || !steamMesh || !bowlMesh || !bowlRimMesh || !brothMesh ||
    !noodleRingLarge || !noodleRingMid || !noodleRingTop || !chopstickMesh || !glassMesh ||
    !teaLiquidMesh || !iceCubeMesh || !strawMesh || !limeMesh || !coasterMesh
  ) return null;

  const dishes: Record<DishPreset, ScenePart[]> = {
    nasi: [
      { mesh: plateMesh, color: [0.97, 0.94, 0.88], alpha: 1, shininess: 48, specular: 0.42, pos: [0, -0.18, 0], rot: [0, 0, 0], scale: [1, 1, 1] },
      { mesh: plateRimMesh, color: [0.18, 0.36, 0.25], alpha: 1, shininess: 56, specular: 0.45, pos: [0, -0.055, 0], rot: [0, 0, 0], scale: [1, 1, 1] },
      { mesh: riceDomeMesh, color: [0.99, 0.98, 0.95], alpha: 1, shininess: 10, specular: 0.08, pos: [-0.26, -0.15, -0.1], rot: [0, 0, 0], scale: [1, 1, 1] },
      { mesh: chickenMesh, color: [0.56, 0.27, 0.11], alpha: 1, shininess: 28, specular: 0.35, pos: [0.46, 0.02, 0.18], rot: [0.12, 0.45, -0.18], scale: [1.05, 0.95, 1] },
      { mesh: chickenMesh, color: [0.68, 0.36, 0.15], alpha: 1, shininess: 24, specular: 0.28, pos: [0.58, -0.02, -0.22], rot: [-0.1, -0.4, 0.12], scale: [0.76, 0.78, 0.8] },
      { mesh: eggWhiteMesh, color: [0.99, 0.97, 0.91], alpha: 1, shininess: 32, specular: 0.28, pos: [-0.14, -0.08, 0.56], rot: [0.06, 0.2, 0], scale: [1, 1, 1] },
      { mesh: eggYolkMesh, color: [0.98, 0.67, 0.12], alpha: 1, shininess: 52, specular: 0.55, pos: [-0.12, -0.01, 0.56], rot: [0, 0, 0], scale: [1, 1, 1] },
      { mesh: sambalMesh, color: [0.78, 0.15, 0.11], alpha: 1, shininess: 36, specular: 0.38, pos: [0.22, -0.08, 0.62], rot: [0, 0, 0], scale: [1, 1, 1] },
      { mesh: leafMesh, color: [0.28, 0.58, 0.26], alpha: 1, shininess: 18, specular: 0.18, pos: [-0.74, -0.06, 0.34], rot: [0.2, 0.5, 0.25], scale: [1.1, 1, 1.1] },
      { mesh: leafMesh, color: [0.35, 0.66, 0.31], alpha: 1, shininess: 18, specular: 0.18, pos: [-0.54, -0.05, 0.52], rot: [-0.15, -0.4, 0.18], scale: [0.95, 1, 0.95] },
      { mesh: cucumberMesh, color: [0.64, 0.85, 0.48], alpha: 1, shininess: 22, specular: 0.22, pos: [0.18, -0.1, -0.62], rot: [0.12, 0.3, 0.1], scale: [1, 1, 1] },
      { mesh: cucumberMesh, color: [0.56, 0.79, 0.42], alpha: 1, shininess: 22, specular: 0.22, pos: [0.38, -0.08, -0.52], rot: [-0.1, -0.2, 0.22], scale: [0.95, 1, 0.95] },
      { mesh: steamMesh, color: [0.99, 0.98, 0.95], alpha: 0.34, shininess: 8, specular: 0.05, pos: [-0.26, 0.68, -0.08], rot: [0, 0, 0], scale: [0.9, 1.15, 0.9], animKind: "steam", phase: 0 },
      { mesh: steamMesh, color: [0.99, 0.98, 0.95], alpha: 0.28, shininess: 8, specular: 0.05, pos: [0.16, 0.76, 0.12], rot: [0, 0, 0], scale: [0.78, 1.05, 0.78], animKind: "steam", phase: 2.1 },
      { mesh: steamMesh, color: [0.99, 0.98, 0.95], alpha: 0.26, shininess: 8, specular: 0.05, pos: [-0.04, 0.84, -0.22], rot: [0, 0, 0], scale: [0.7, 0.95, 0.7], animKind: "steam", phase: 4.2 },
    ],
    mie: [
      { mesh: bowlMesh, color: [0.96, 0.93, 0.86], alpha: 1, shininess: 52, specular: 0.44, pos: [0, -0.04, 0], rot: [0, 0, 0], scale: [1, 1, 1] },
      { mesh: bowlRimMesh, color: [0.18, 0.38, 0.26], alpha: 1, shininess: 58, specular: 0.46, pos: [0, 0.31, 0], rot: [0, 0, 0], scale: [1, 1, 1] },
      { mesh: brothMesh, color: [0.76, 0.46, 0.16], alpha: 0.96, shininess: 70, specular: 0.62, pos: [0, 0.16, 0], rot: [0, 0, 0], scale: [1, 1, 1] },
      { mesh: noodleRingLarge, color: [0.96, 0.79, 0.36], alpha: 1, shininess: 20, specular: 0.24, pos: [0, 0.21, 0], rot: [0.06, 0.4, 0.05], scale: [1.05, 1.1, 1.05] },
      { mesh: noodleRingMid, color: [0.98, 0.83, 0.42], alpha: 1, shininess: 22, specular: 0.26, pos: [-0.06, 0.27, 0.04], rot: [-0.08, 0.9, 0.06], scale: [1.08, 1.12, 1.08] },
      { mesh: noodleRingTop, color: [0.95, 0.76, 0.32], alpha: 1, shininess: 22, specular: 0.24, pos: [0.08, 0.32, -0.06], rot: [0.12, -0.5, 0.08], scale: [1.1, 1.1, 1.1] },
      { mesh: eggWhiteMesh, color: [0.99, 0.98, 0.94], alpha: 1, shininess: 30, specular: 0.26, pos: [0.42, 0.27, 0.26], rot: [0.18, 0.4, -0.2], scale: [0.85, 1.3, 0.85] },
      { mesh: eggYolkMesh, color: [0.97, 0.64, 0.11], alpha: 1, shininess: 46, specular: 0.48, pos: [0.42, 0.33, 0.26], rot: [0, 0, 0], scale: [0.95, 0.95, 0.95] },
      { mesh: leafMesh, color: [0.26, 0.58, 0.27], alpha: 1, shininess: 18, specular: 0.2, pos: [-0.46, 0.27, -0.2], rot: [0.22, -0.5, 0.28], scale: [1.15, 1.1, 1.1] },
      { mesh: leafMesh, color: [0.34, 0.67, 0.33], alpha: 1, shininess: 18, specular: 0.2, pos: [-0.32, 0.3, -0.44], rot: [-0.18, 0.4, 0.16], scale: [0.95, 1, 0.95] },
      { mesh: sambalMesh, color: [0.8, 0.17, 0.12], alpha: 1, shininess: 36, specular: 0.35, pos: [-0.36, 0.26, 0.34], rot: [0, 0, 0], scale: [0.85, 0.9, 0.85] },
      { mesh: chopstickMesh, color: [0.64, 0.42, 0.21], alpha: 1, shininess: 26, specular: 0.24, pos: [0.22, 0.38, -0.32], rot: [0.06, 0.36, 1.54], scale: [1, 1, 1] },
      { mesh: chopstickMesh, color: [0.58, 0.37, 0.18], alpha: 1, shininess: 26, specular: 0.24, pos: [0.28, 0.39, -0.18], rot: [0.04, 0.24, 1.54], scale: [1, 1, 1] },
      { mesh: steamMesh, color: [0.99, 0.98, 0.95], alpha: 0.34, shininess: 8, specular: 0.05, pos: [-0.14, 0.64, 0.04], rot: [0, 0, 0], scale: [0.88, 1.15, 0.88], animKind: "steam", phase: 0.5 },
      { mesh: steamMesh, color: [0.99, 0.98, 0.95], alpha: 0.28, shininess: 8, specular: 0.05, pos: [0.2, 0.72, -0.12], rot: [0, 0, 0], scale: [0.76, 1.0, 0.76], animKind: "steam", phase: 2.7 },
    ],
    esteh: [
      { mesh: coasterMesh, color: [0.56, 0.36, 0.18], alpha: 1, shininess: 16, specular: 0.16, pos: [0, -0.77, 0], rot: [0, 0, 0], scale: [1, 1, 1] },
      { mesh: teaLiquidMesh, color: [0.68, 0.33, 0.08], alpha: 0.92, shininess: 68, specular: 0.55, pos: [0, -0.05, 0], rot: [0, 0, 0], scale: [1, 1, 1] },
      { mesh: iceCubeMesh, color: [0.88, 0.96, 0.99], alpha: 0.78, shininess: 90, specular: 0.82, pos: [-0.18, 0.36, 0.12], rot: [0.4, 0.6, 0.2], scale: [1, 1, 1], animKind: "ice", phase: 0 },
      { mesh: iceCubeMesh, color: [0.86, 0.95, 0.99], alpha: 0.76, shininess: 90, specular: 0.82, pos: [0.2, 0.32, -0.14], rot: [-0.3, 1.1, 0.45], scale: [0.92, 0.92, 0.92], animKind: "ice", phase: 2.0 },
      { mesh: iceCubeMesh, color: [0.9, 0.97, 1.0], alpha: 0.72, shininess: 90, specular: 0.82, pos: [0.02, 0.16, 0.2], rot: [0.6, -0.4, 0.3], scale: [0.88, 0.88, 0.88], animKind: "ice", phase: 4.1 },
      { mesh: strawMesh, color: [0.22, 0.48, 0.32], alpha: 1, shininess: 48, specular: 0.44, pos: [0.18, 0.2, -0.04], rot: [0.1, 0, -0.22], scale: [1, 1, 1] },
      { mesh: limeMesh, color: [0.56, 0.82, 0.24], alpha: 1, shininess: 30, specular: 0.28, pos: [-0.58, 0.62, 0.16], rot: [0.6, 0.2, 0.9], scale: [1, 1, 1] },
      { mesh: glassMesh, color: [0.93, 0.98, 0.96], alpha: 0.32, shininess: 96, specular: 0.88, pos: [0, 0, 0], rot: [0, 0, 0], scale: [1, 1, 1] },
    ],
  };

  let currentDish: DishPreset = options.initialDish ?? "nasi";
  let reducedMotion = Boolean(options.reducedMotion);
  let targetYaw = 0.35, currentYaw = 0.35, targetPitch = 0.46, currentPitch = 0.46, dishPop = 1;
  let dragging = false, lastPointerX = 0, lastPointerY = 0, pointerHoverX = 0, pointerHoverY = 0;
  let rafId = 0, destroyed = false;
  const startTime = performance.now();

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
  };

  const renderFrame = (now: number) => {
    const elapsed = (now - startTime) * 0.001;
    if (!dragging && !reducedMotion) targetYaw += 0.0045;
    const lerp = reducedMotion ? 1 : 0.12;
    currentYaw += (targetYaw - currentYaw) * lerp;
    currentPitch += (targetPitch - currentPitch) * lerp;
    dishPop += (1 - dishPop) * (reducedMotion ? 1 : 0.14);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const aspect = canvas.width / Math.max(1, canvas.height);
    const projection = mat4Perspective((38 * Math.PI) / 180, aspect, 0.1, 30);
    const camDist = 3.95;
    const camY = Math.sin(currentPitch) * camDist;
    const camHoriz = Math.cos(currentPitch) * camDist;
    const camX = Math.sin(currentYaw) * camHoriz;
    const camZ = Math.cos(currentYaw) * camHoriz;
    const view = mat4LookAt([camX, camY, camZ], [0, 0.05, 0], [0, 1, 0]);

    gl.uniformMatrix4fv(uProjection, false, projection);
    gl.uniformMatrix4fv(uView, false, view);
    gl.uniform3f(uCameraPos, camX, camY, camZ);
    gl.uniform3f(uKeyLightDir, 0.65 + pointerHoverX * 0.45, 0.92 - pointerHoverY * 0.25, 0.72);

    const bobY = reducedMotion ? 0 : Math.sin(elapsed * 1.9) * 0.055;
    const rootModel = mat4FromTRS([0, bobY, 0], [0, 0, 0], [dishPop, dishPop, dishPop]);

    for (const part of dishes[currentDish]) {
      let [px, py, pz] = part.pos;
      let [sx, sy, sz] = part.scale;
      const [rx, baseRy, rz] = part.rot;
      let ry = baseRy;
      let alpha = part.alpha;

      if (!reducedMotion && part.animKind === "steam") {
        const cycle = (elapsed * 0.48 + (part.phase ?? 0)) % 1;
        py += cycle * 0.52;
        px += Math.sin(cycle * Math.PI * 2 + (part.phase ?? 0)) * 0.07;
        const grow = 0.7 + cycle * 0.65;
        sx *= grow; sy *= grow; sz *= grow;
        alpha *= Math.sin(cycle * Math.PI);
      } else if (!reducedMotion && part.animKind === "ice") {
        py += Math.sin(elapsed * 2.2 + (part.phase ?? 0)) * 0.032;
        ry += Math.sin(elapsed * 0.9 + (part.phase ?? 0)) * 0.14;
      }

      const partModel = mat4Multiply(rootModel, mat4FromTRS([px, py, pz], [rx, ry, rz], [sx, sy, sz]));
      gl.depthMask(alpha >= 0.98);
      gl.uniformMatrix4fv(uModel, false, partModel);
      gl.uniform3f(uColor, part.color[0], part.color[1], part.color[2]);
      gl.uniform1f(uAlpha, alpha);
      gl.uniform1f(uShininess, part.shininess);
      gl.uniform1f(uSpecular, part.specular);

      gl.bindBuffer(gl.ARRAY_BUFFER, part.mesh.posBuffer);
      gl.enableVertexAttribArray(aPosition);
      gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, part.mesh.normBuffer);
      gl.enableVertexAttribArray(aNormal);
      gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, part.mesh.idxBuffer);
      gl.drawElements(gl.TRIANGLES, part.mesh.count, gl.UNSIGNED_SHORT, 0);
    }
    gl.depthMask(true);
  };

  const loop = (now: number) => {
    if (destroyed) return;
    renderFrame(now);
    if (!reducedMotion) rafId = window.requestAnimationFrame(loop);
  };

  const onPointerDown = (e: PointerEvent) => {
    dragging = true;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    try { canvas.setPointerCapture(e.pointerId); } catch {}
  };

  const onPointerMove = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      pointerHoverX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerHoverY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    }
    if (!dragging) {
      if (reducedMotion) renderFrame(performance.now());
      return;
    }
    targetYaw -= (e.clientX - lastPointerX) * 0.012;
    targetPitch = Math.max(0.14, Math.min(1.08, targetPitch + (e.clientY - lastPointerY) * 0.008));
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    if (reducedMotion) renderFrame(performance.now());
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    try {
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    } catch {}
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);

  resize();
  renderFrame(startTime);
  options.onReady?.();
  if (!reducedMotion) rafId = window.requestAnimationFrame(loop);

  return {
    setDish(dish: DishPreset) {
      if (currentDish === dish) return;
      currentDish = dish;
      dishPop = reducedMotion ? 1 : 0.72;
      targetYaw += 0.55;
      if (reducedMotion) renderFrame(performance.now());
    },
    setReducedMotion(nextReduced: boolean) {
      if (reducedMotion === nextReduced) return;
      reducedMotion = nextReduced;
      window.cancelAnimationFrame(rafId);
      if (reducedMotion) renderFrame(performance.now());
      else rafId = window.requestAnimationFrame(loop);
    },
    resetView() {
      targetYaw = 0.35;
      targetPitch = 0.46;
      if (reducedMotion) renderFrame(performance.now());
    },
    resize() {
      resize();
      if (reducedMotion) renderFrame(performance.now());
    },
    destroy() {
      destroyed = true;
      window.cancelAnimationFrame(rafId);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      for (const m of meshes) {
        gl.deleteBuffer(m.posBuffer);
        gl.deleteBuffer(m.normBuffer);
        gl.deleteBuffer(m.idxBuffer);
      }
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    },
  };
}
