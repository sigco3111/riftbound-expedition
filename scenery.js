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
const vn = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return hash(xi, yi) * (1 - u) * (1 - v) + hash(xi + 1, yi) * u * (1 - v) + hash(xi, yi + 1) * (1 - u) * v + hash(xi + 1, yi + 1) * u * v; };
export const fbm = (x, y, o = 4) => { let s = 0, a = .5; for (let i = 0; i < o; i++) { s += a * vn(x, y); x *= 2.03; y *= 2.03; a *= .5; } return s; };
const sm = (a, b, x) => { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); };
export const roadZ = x => .2 + Math.sin(x * .16 + .5) * 2.6 - x * .06; // road centre line z(x), passes the lantern clearing
const CLEAR = 4.4;

export function makeGround(zi) {
  const P = PAL[zi % PAL.length], N = MOBILE ? 512 : 1024;
  const cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d'), im = g.createImageData(N, N);
  const rc = document.createElement('canvas'); rc.width = rc.height = N; const gr = rc.getContext('2d'), imr = gr.createImageData(N, N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = (i / N - .5) * SZ, z = (j / N - .5) * SZ, k = (j * N + i) * 4;
    const n1 = fbm(x * .35, z * .35, 3), n2 = fbm(x * 1.6 + 9, z * 1.6 + 4, 3), n3 = fbm(x * .9 + 30, z * .9 + 7, 3);
    const dz = z - roadZ(x) + (n1 - .5) * 1.6, rr = Math.hypot(x, z) + (n1 - .5) * 2.4;
    const road = Math.max(1 - sm(1.35, 2.1, Math.abs(dz)), 1 - sm(CLEAR - .8, CLEAR + .9, rr)); // road + lantern clearing
    const tn = .55 + n2 * .9 + n3 * .35;
    let cr = P.gr[0] * tn, cg = P.gr[1] * tn, cb = P.gr[2] * tn;
    const mr = P.mud[0] * (.7 + n2 * .6), mg = P.mud[1] * (.7 + n2 * .6), mb = P.mud[2] * (.7 + n2 * .6);
    cr += (mr - cr) * road; cg += (mg - cg) * road; cb += (mb - cb) * road;
    let rough = .95 - .15 * road;
    const lane = Math.min(Math.abs(dz - .62), Math.abs(dz + .62)), rut = (1 - sm(.12, .34, lane)) * (1 - sm(1.4, 2.0, Math.abs(dz)));
    const wet = sm(.5, .6, fbm(x * .55 + 50, z * 2.2 + 3, 3)) * rut;
    const pud = sm(.6, .68, fbm(x * .3 + 120, z * .3 + 55, 3)) * road * (1 - sm(CLEAR - 3, CLEAR - 1, rr) * .0);
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
export function makeGrass(zi, radius) {
  grassAssets();
  const P = PAL[zi % PAL.length], GN = MOBILE ? 3500 : 9000;
  const mat = new THREE.MeshStandardMaterial({ map: grassTex, alphaTest: .45, side: THREE.DoubleSide, roughness: 1, emissive: 0x141c30, emissiveMap: grassTex });
  mat.onBeforeCompile = s => { s.fragmentShader = s.fragmentShader.replace('float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;', 'float faceDirection = 1.0;'); };
  const mesh = new THREE.InstancedMesh(tuftGeo, mat, GN), d = new THREE.Object3D(), col = new THREE.Color();
  let seed = 41 + zi * 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const base = new THREE.Color(P.gr[0] / 255, P.gr[1] / 255, P.gr[2] / 255);
  let n = 0, tries = 0;
  while (n < GN && tries++ < 300000) {
    const a = rnd() * 6.283, r = Math.sqrt(rnd()) * radius, x = Math.cos(a) * r, z = Math.sin(a) * r;
    const dz = Math.abs(z - roadZ(x)) + (fbm(x * .35, z * .35, 3) - .5) * 1.6, rr = Math.hypot(x, z) + (fbm(x * .35, z * .35, 3) - .5) * 2.4;
    if (dz < 1.7 || rr < CLEAR + .6) continue;
    if (rnd() > sm(.36, .6, fbm(x * .22 + 5, z * .22 + 9, 3))) continue;
    d.position.set(x, 0, z); const s = .3 + rnd() * .45; d.scale.set(s, s * (.5 + rnd() * .5), s); d.rotation.set(0, rnd() * 6, 0); d.updateMatrix(); mesh.setMatrixAt(n, d.matrix);
    col.copy(base).multiplyScalar(1.3 + rnd() * 1.0).offsetHSL((rnd() - .5) * .05, .05, 0); mesh.setColorAt(n, col); n++;
  }
  mesh.count = n; return mesh;
}

export function makeEnv(renderer, Z) { // small reflection source for wet ground: moon + lantern glow
  const pm = new THREE.PMREMGenerator(renderer), e = new THREE.Scene();
  e.background = new THREE.Color(Z.skyBot);
  const m = new THREE.Mesh(new THREE.SphereGeometry(6, 16, 8), new THREE.MeshBasicMaterial({ color: Z.moon })); m.position.set(20, 30, -14); e.add(m);
  const l = new THREE.Mesh(new THREE.SphereGeometry(2, 16, 8), new THREE.MeshBasicMaterial({ color: 0xffc080 })); l.position.set(-6, 5, 0); e.add(l);
  const t = pm.fromScene(e).texture; pm.dispose(); return t;
}
