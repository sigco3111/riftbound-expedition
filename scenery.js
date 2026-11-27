// Original scenery code for Riftbound Expedition (no Lanternfall code). Smooth-noise ground with dirt road, ruts and puddles,
// low grass patches, and a small environment map for wet reflections.
import * as THREE from 'three';

export const MOBILE = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 560;
export const SZ = 76; // ground texture covers SZ x SZ world units
const PAL = [ // per zone: grass rgb, mud rgb, puddle rgb
  { gr: [34, 44, 46], mud: [56, 56, 60], pud: [26, 40, 66] },
  { gr: [34, 46, 52], mud: [78, 78, 84], pud: [22, 40, 70] },
  { gr: [44, 40, 60], mud: [80, 68, 92], pud: [34, 30, 74] },
  { gr: [56, 36, 52], mud: [96, 60, 84], pud: [60, 24, 66] },
  { gr: [70, 60, 30], mud: [92, 78, 54], pud: [58, 48, 28] },
];
const hash = (x, y) => { const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); };
const md = (a, n) => ((a % n) + n) % n;
// value noise that repeats every SZ world units on both axes: lattice has `cy` cells per period
const vnp = (u, v, cy) => { const xi = Math.floor(u), yi = Math.floor(v), xf = u - xi, yf = v - yi, a = xf * xf * (3 - 2 * xf), b = yf * yf * (3 - 2 * yf); const x0 = md(xi, cy), x1 = md(xi + 1, cy), y0 = md(yi, cy), y1 = md(yi + 1, cy); return hash(x0, y0) * (1 - a) * (1 - b) + hash(x1, y0) * a * (1 - b) + hash(x0, y1) * (1 - a) * b + hash(x1, y1) * a * b; };
// fp(x, z, f, o): fractal noise at about f cycles per world unit, tileable with period SZ
export const fp = (x, z, f, o = 3) => { let c = Math.max(1, Math.round(f * SZ)), s = 0, a = .5; for (let i = 0; i < o; i++) { s += a * vnp(x / SZ * c + 3.7 * i, z / SZ * c + 1.9 * i, c); c *= 2; a *= .5; } return s; };
const sm = (a, b, x) => { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); };
export const roadZ = x => Math.sin(x * (Math.PI * 4 / SZ) + .5) * 2.4; // road centre line z(x), repeats every SZ so the road can scroll forever

export function makeGround(zi) {
  const P = PAL[zi % PAL.length], N = MOBILE ? 512 : 1024;
  const cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d'), im = g.createImageData(N, N);
  const rc = document.createElement('canvas'); rc.width = rc.height = N; const gr = rc.getContext('2d'), imr = gr.createImageData(N, N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = (i / N - .5) * SZ, z = (j / N - .5) * SZ, k = (j * N + i) * 4;
    const n1 = fp(x, z, .35, 3), n2 = fp(x + 9, z + 4, 1.6, 3), n3 = fp(x + 30, z + 7, .9, 3);
    const dz = z - roadZ(x) + (n1 - .5) * 1.6;
    const road = 1 - sm(1.35, 2.1, Math.abs(dz));
    const tn = .55 + n2 * .9 + n3 * .35;
    let cr = P.gr[0] * tn, cg = P.gr[1] * tn, cb = P.gr[2] * tn;
    const mr = P.mud[0] * (.7 + n2 * .6), mg = P.mud[1] * (.7 + n2 * .6), mb = P.mud[2] * (.7 + n2 * .6);
    cr += (mr - cr) * road; cg += (mg - cg) * road; cb += (mb - cb) * road;
    let rough = .95 - .15 * road;
    const lane = Math.min(Math.abs(dz - .62), Math.abs(dz + .62)), rut = (1 - sm(.12, .34, lane)) * (1 - sm(1.4, 2.0, Math.abs(dz)));
    const wet = sm(.5, .6, fp(x + 50, z + 3, 1.1, 3)) * rut;
    const pud = sm(.6, .68, fp(x + 120, z + 55, .3, 3)) * road;
    const w = Math.max(wet, pud * .9);
    cr = cr * (1 - .4 * rut) * (1 - w) + P.pud[0] * w; cg = cg * (1 - .4 * rut) * (1 - w) + P.pud[1] * w; cb = cb * (1 - .4 * rut) * (1 - w) + P.pud[2] * w;
    rough = rough * (1 - .4 * rut) * (1 - w) + .04 * w;
    im.data[k] = cr; im.data[k + 1] = cg; im.data[k + 2] = cb; im.data[k + 3] = 255;
    const rv = Math.max(0, Math.min(255, rough * 255)); imr.data[k] = imr.data[k + 1] = imr.data[k + 2] = rv; imr.data[k + 3] = 255;
  }
  g.putImageData(im, 0, 0); gr.putImageData(imr, 0, 0);
  const map = new THREE.CanvasTexture(cv); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  const rough = new THREE.CanvasTexture(rc); rough.anisotropy = 4;
  return { map, rough };
}

let grassTex = null, tuftGeo = null;
function grassAssets() {
  if (grassTex) return;
  let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  for (let i = 0; i < 22; i++) { const px = 8 + rnd() * 112, h = 40 + rnd() * 80, lean = (rnd() - .5) * 36; const gg = x.createLinearGradient(0, 128, 0, 128 - h); gg.addColorStop(0, '#555a2a'); gg.addColorStop(1, '#d8c878'); x.fillStyle = gg; x.beginPath(); x.moveTo(px - 2.5, 128); x.quadraticCurveTo(px + lean * .3, 128 - h * .6, px + lean, 128 - h); x.quadraticCurveTo(px + lean * .3 + 3, 128 - h * .5, px + 2.5, 128); x.fill(); }
  grassTex = new THREE.CanvasTexture(c); grassTex.colorSpace = THREE.SRGBColorSpace;
  const q = new THREE.PlaneGeometry(.8, .7); q.translate(0, .35, 0);
  const pos = [], uv = [], nn = [];
  [q.clone(), q.clone().rotateY(Math.PI / 3), q.clone().rotateY(-Math.PI / 3)].map(p => p.toNonIndexed()).forEach(p => { pos.push(...p.attributes.position.array); uv.push(...p.attributes.uv.array); });
  for (let i = 0; i < pos.length / 3; i++) nn.push(0, 1, 0);
  tuftGeo = new THREE.BufferGeometry(); tuftGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); tuftGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); tuftGeo.setAttribute('normal', new THREE.Float32BufferAttribute(nn, 3));
}
export function makeGrass(zi) { // grass for one SZ-long stretch of road, copied 3 times; main.js slides it so the road never ends
  grassAssets();
  const P = PAL[zi % PAL.length], PER = MOBILE ? 2400 : 5200, BAND = 30; // tufts per stretch, half width of the grass band
  const mat = new THREE.MeshStandardMaterial({ map: grassTex, alphaTest: .45, side: THREE.DoubleSide, roughness: 1, emissive: 0x141c30, emissiveMap: grassTex });
  mat.onBeforeCompile = s => { s.fragmentShader = s.fragmentShader.replace('float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;', 'float faceDirection = 1.0;'); };
  const mesh = new THREE.InstancedMesh(tuftGeo, mat, PER * 3), d = new THREE.Object3D(), col = new THREE.Color();
  let seed = 41 + zi * 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const base = new THREE.Color(P.gr[0] / 255, P.gr[1] / 255, P.gr[2] / 255);
  const local = []; let tries = 0;
  while (local.length < PER && tries++ < 300000) {
    const x = (rnd() - .5) * SZ, z = (rnd() * 2 - 1) * BAND;
    const dz = Math.abs(z - roadZ(x)) + (fp(x, z, .35, 3) - .5) * 1.6;
    if (dz < 1.7) continue;
    if (rnd() > sm(.36, .6, fp(x + 5, z + 9, .22, 3))) continue;
    local.push([x, z, .3 + rnd() * .45, .5 + rnd() * .5, rnd() * 6, 1.3 + rnd() * 1.0, (rnd() - .5) * .05]);
  }
  let n = 0;
  for (let c = -1; c <= 1; c++) for (const t of local) {
    d.position.set(t[0] + c * SZ, 0, t[1]); d.scale.set(t[2], t[2] * t[3], t[2]); d.rotation.set(0, t[4], 0); d.updateMatrix(); mesh.setMatrixAt(n, d.matrix);
    col.copy(base).multiplyScalar(t[5]).offsetHSL(t[6], .05, 0); mesh.setColorAt(n, col); n++;
  }
  mesh.count = n; mesh.frustumCulled = false; return mesh;
}

export function makeEnv(renderer, Z) { // small reflection source for wet ground: moon + lantern glow
  const pm = new THREE.PMREMGenerator(renderer), e = new THREE.Scene();
  e.background = new THREE.Color(Z.skyBot);
  const m = new THREE.Mesh(new THREE.SphereGeometry(6, 16, 8), new THREE.MeshBasicMaterial({ color: Z.moon })); m.position.set(20, 30, -14); e.add(m);
  const l = new THREE.Mesh(new THREE.SphereGeometry(2, 16, 8), new THREE.MeshBasicMaterial({ color: 0xffc080 })); l.position.set(-6, 5, 0); e.add(l);
  const t = pm.fromScene(e).texture; pm.dispose(); return t;
}
