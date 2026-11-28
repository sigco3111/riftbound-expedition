import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { MOBILE, SZ, roadZ, makeGround, makeGrass, makeEnv } from './scenery.js';
import { HEROES, ERA, ENEMIES, CREDITS, ZONES } from './data.js';

const $ = id => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const SAVE_KEY = 'riftbound.v1';
let save = { embers: 30, unlocked: ['w_medieval', 'm_king', 'w_soldier', 'w_witch', 'm_farmer', 'w_punk'], party: [], best: 0 };
try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) {}
save.boons = save.boons || {};
if (![1, 2, 4].includes(save.speed)) save.speed = 1;
if (save.autoRetry == null) save.autoRetry = true;
if (Q.get('unlock')) save.unlocked = HEROES.map(h => h.id);
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} };

// ---------- renderer ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, MOBILE ? 1.5 : 2));
const LOWQ = Q.get('q') === 'low';
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .92;
renderer.shadowMap.enabled = !LOWQ; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
var composer = null;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a1020);
scene.fog = new THREE.FogExp2(0x1a2c4e, 0.024);
const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 400);
const camOff = new THREE.Vector3(), camTarget = new THREE.Vector3();
let PORT = false;
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  const portrait = camera.aspect < 0.8;
  camOff.set(0, portrait ? 17 : 4.8, portrait ? 12 : 10.5); camera.fov = portrait ? 58 : 42; PORT = portrait;
  camera.position.copy(camTarget).add(camOff); camera.lookAt(camTarget.x, .5, camTarget.z + 1);
  camera.updateProjectionMatrix();
  if (composer) composer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', resize); resize();
const hemi = new THREE.HemisphereLight(0x6a8cf0, 0x262c52, 1.9); scene.add(hemi);
const moon = new THREE.DirectionalLight(0x86a4ff, 2.6); moon.position.set(-10, 20, 8); scene.add(moon);
const rim = new THREE.DirectionalLight(0x6c8cff, 1.3); rim.position.set(12, 9, -16); scene.add(rim);
const ARENA = 19;
function skyTexture(top, bot) {
  const c = document.createElement('canvas'); c.width = 16; c.height = 512; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, top); gr.addColorStop(1, bot); g.fillStyle = gr; g.fillRect(0, 0, 16, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function groundTexture() {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  g.fillStyle = '#6a7390'; g.fillRect(0, 0, S, S);
  let seed = 3; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 900; i++) { const x = r() * S, y = r() * S, w = 14 + r() * 40; g.fillStyle = `rgba(${40 + r() * 50},${45 + r() * 50},${70 + r() * 50},${.25 + r() * .3})`; g.fillRect(x, y, w, w * (.5 + r())); }
  g.strokeStyle = 'rgba(15,18,30,.55)'; g.lineWidth = 2;
  for (let i = 0; i <= 16; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, S); g.stroke(); g.beginPath(); g.moveTo(0, i * 64); g.lineTo(S, i * 64); g.stroke(); }
  g.strokeStyle = 'rgba(255,190,110,.9)'; g.lineWidth = 5; g.beginPath(); g.arc(S / 2, S / 2, S * .17, 0, 7); g.stroke();
  g.lineWidth = 3; g.beginPath(); g.arc(S / 2, S / 2, S * .26, 0, 7); g.stroke();
  for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; g.beginPath(); g.moveTo(S / 2 + Math.cos(a) * S * .17, S / 2 + Math.sin(a) * S * .17); g.lineTo(S / 2 + Math.cos(a) * S * .26, S / 2 + Math.sin(a) * S * .26); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const groundMat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, envMapIntensity: 1.5 });
{
  const g = new THREE.Mesh(new THREE.PlaneGeometry(SZ * 2, SZ * 2), groundMat);
  g.rotation.x = -Math.PI / 2; g.receiveShadow = true; scene.add(g);
  { const far = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshBasicMaterial({ color: 0x1a2438 })); far.rotation.x = -Math.PI / 2; far.position.y = -.04; scene.add(far); }
  // stars + moon
  const sp = []; for (let i = 0; i < 400; i++) { const a = Math.random() * 6.283, e = Math.random() * 1.2 + .1, R = 150; sp.push(Math.cos(a) * Math.cos(e) * R, Math.sin(e) * R * .7 + 10, Math.sin(a) * Math.cos(e) * R - 20); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xdfe8ff, size: 1.1, sizeAttenuation: false, fog: false })));
  const mo = new THREE.Mesh(new THREE.SphereGeometry(7, 24, 16), new THREE.MeshBasicMaterial({ color: 0xdde6ff, fog: false })); mo.position.set(-60, 55, -110); scene.add(mo);
}
// zone-themed debris of the swallowed eras (primitives only)
const world = new THREE.Group(); scene.add(world);
const box = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); return o; };
function makeWall(M) { const g = new THREE.Group(); g.add(box(5, 3, 1, M.stone, 0, 1.5, 0)); for (let i = 0; i < 4; i++) g.add(box(.9, .8, 1.1, M.stone, -1.9 + i * 1.27, 3.4, 0)); g.add(box(1.6, 5, 1.6, M.stone, 3, 2.5, 0)); return g; }
function makeCar(M) { const g = new THREE.Group(); g.add(box(3.4, .9, 1.6, M.car, 0, .8, 0)); g.add(box(1.8, .8, 1.4, M.glass, -.2, 1.6, 0)); for (const [x, z] of [[-1.1, .8], [1.1, .8], [-1.1, -.8], [1.1, -.8]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(.4, .4, .3, 10), M.dark); w.rotation.x = Math.PI / 2; w.position.set(x, .4, z); g.add(w); } return g; }
function makePod(M) { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.9, 3.6, 8), M.hull); b.position.y = 1.4; g.add(b); const band = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, .3, 8), M.glow); band.position.y = 2.2; g.add(band); const fin = box(.3, 2.2, 2.4, M.hull, 1.7, 1, 0); g.add(fin); return g; }
function makeCrystal(M) { const g = new THREE.Group(); for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(.5 + Math.random() * .5, 2.5 + Math.random() * 3.5, 5), M.crystal); c.position.set((Math.random() - .5) * 2.4, 1.4, (Math.random() - .5) * 2.4); c.rotation.z = (Math.random() - .5) * .5; g.add(c); } return g; }
let grassMesh = null; const groundCache = {};
function getGround(zi) { const k = zi % ZONES.length; return groundCache[k] || (groundCache[k] = Object.assign(makeGround(k), { env: makeEnv(renderer, ZONES[k]) })); }
function buildWorld(zi) {
  const Z = ZONES[zi % ZONES.length];
  world.clear();
  const M = { stone: new THREE.MeshStandardMaterial({ color: Z.stone, roughness: 1 }), car: new THREE.MeshStandardMaterial({ color: Z.car, roughness: .7 }), glass: new THREE.MeshStandardMaterial({ color: 0x223044, roughness: .3 }), dark: new THREE.MeshStandardMaterial({ color: 0x15171d }), hull: new THREE.MeshStandardMaterial({ color: Z.hull, roughness: .5, metalness: .4 }), glow: new THREE.MeshBasicMaterial({ color: Z.glow }), crystal: new THREE.MeshStandardMaterial({ color: Z.glow, emissive: Z.glow, emissiveIntensity: .8, roughness: .3 }) };
  let seed = 11 + zi * 17; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const mk = [makeWall, makeCar, makePod, makeCrystal];
  // debris of the swallowed eras along the road: one SZ-long stretch, repeated 3 times (main.js slides it with the road)
  const spec = [];
  for (let i = 0; i < 16; i++) { const x = (rnd() - .5) * SZ; spec.push({ kind: Z.mix[Math.floor(rnd() * Z.mix.length)], x, z: roadZ(x) - (9 + rnd() * 22), ry: rnd() * 6.28, rz: (rnd() - .5) * .35, s: .9 + rnd() * .8 }); }
  for (let i = 0; i < 12; i++) { const x = (rnd() - .5) * SZ, side = rnd() < .5 ? -1 : 1; spec.push({ rock: .3 + rnd() * .5, x, z: roadZ(x) + side * (3.5 + rnd() * 18) }); }
  for (let c = -1; c <= 1; c++) for (const p of spec) {
    let o; if (p.rock) { o = new THREE.Mesh(new THREE.DodecahedronGeometry(p.rock), M.stone); o.position.set(p.x + c * SZ, .2, p.z); }
    else { o = mk[p.kind](M); o.position.set(p.x + c * SZ, 0, p.z); o.rotation.y = p.ry; o.rotation.z = p.rz; o.scale.setScalar(p.s); }
    world.add(o);
  }
  scene.background = skyTexture(Z.skyTop, Z.skyBot); scene.fog.color.set(Z.skyBot).lerp(new THREE.Color(Z.fog), .35); hemi.color.set(Z.hemi); moon.color.set(Z.moon);
  world.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const gt = getGround(zi); for (const x of [gt.map, gt.rough]) { x.wrapS = x.wrapT = THREE.RepeatWrapping; x.repeat.set(2, 2); }
  groundMat.map = gt.map; groundMat.roughnessMap = gt.rough; groundMat.envMap = gt.env; groundMat.needsUpdate = true;
  if (grassMesh) { scene.remove(grassMesh); grassMesh.material.dispose(); grassMesh.dispose(); }
  grassMesh = makeGrass(zi); scene.add(grassMesh);
}
// floating embers around the lantern
const emberGeo = new THREE.BufferGeometry(); const EN = 140; const emberPos = new Float32Array(EN * 3); const emberSeed = [];
for (let i = 0; i < EN; i++) { emberSeed.push({ a: Math.random() * 6.28, r: 1 + Math.random() * 9, y: Math.random() * 6, v: .3 + Math.random() * .7 }); }
emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
const embers = new THREE.Points(emberGeo, new THREE.PointsMaterial({ color: 0xffb455, size: .12, transparent: true, opacity: .85, depthWrite: false })); scene.add(embers);
function tickEmbers(t, dt) { for (let i = 0; i < EN; i++) { const e = emberSeed[i]; e.y += e.v * dt; if (e.y > 7) e.y = 0; emberPos[i * 3] = Math.cos(e.a + t * .1 * e.v) * e.r; emberPos[i * 3 + 1] = e.y; emberPos[i * 3 + 2] = Math.sin(e.a + t * .1 * e.v) * e.r; } emberGeo.attributes.position.needsUpdate = true; }
// lantern
const lantern = new THREE.Group();
{
  // 내 설계: 주철 가로등. 받침, 가는 기둥, 장식 링, 유리 상자형 등롱과 지붕, 그리고 빛나는 불꽃 심지.
  const iron = new THREE.MeshStandardMaterial({ color: 0x1f2024, roughness: .55, metalness: .7 }), add = (g, y, m = iron) => { const o = new THREE.Mesh(g, m); o.position.y = y; lantern.add(o); return o; };
  add(new THREE.CylinderGeometry(.42, .52, .25, 10), .12); add(new THREE.CylinderGeometry(.26, .36, .35, 10), .42);
  add(new THREE.CylinderGeometry(.075, .11, 2.9, 8), 1.95);
  for (const y of [.8, 1.7, 2.7]) add(new THREE.TorusGeometry(.13, .035, 6, 14), y).rotation.x = Math.PI / 2;
  add(new THREE.CylinderGeometry(.34, .2, .22, 8), 3.5); // 등롱 받침
  const glass = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc766).multiplyScalar(1.5), transparent: true, opacity: .92 });
  add(new THREE.BoxGeometry(.42, .6, .42), 3.9, glass);
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(.05, .66, .05), iron); b.position.set(x * .22, 3.9, z * .22); lantern.add(b); }
  add(new THREE.ConeGeometry(.42, .34, 4), 4.4).rotation.y = Math.PI / 4; add(new THREE.SphereGeometry(.06, 8, 6), 4.62);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(.14, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffe0a0).multiplyScalar(2.2) })); flame.scale.y = 1.5; flame.position.y = 3.85; lantern.add(flame);
  const bulb = flame;
  const light = new THREE.PointLight(0xffa860, 110, 22, 2); light.position.y = 3.9; light.castShadow = !LOWQ; light.shadow.mapSize.set(MOBILE ? 512 : 1024, MOBILE ? 512 : 1024); light.shadow.bias = -.002; light.shadow.camera.near = .5; light.shadow.camera.far = 30; lantern.add(light);
  lantern.userData = { bulb, light };
  lantern.scale.setScalar(.74); scene.add(lantern);
}

// ---------- assets ----------
const loader = new GLTFLoader();
const cache = new Map();
function loadModel(url) {
  if (!cache.has(url)) cache.set(url, new Promise((res, rej) => loader.load(url, res, undefined, rej)));
  return cache.get(url);
}
function findClip(clips, re) { return clips.find(c => re.test(c.name)); }
function makeInstance(gltf, targetH, mode, yaw) {
  const root = SkeletonUtils.clone(gltf.scene);
  const wrap = new THREE.Group(); wrap.add(root);
  root.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3());
  const dim = mode === 'max' ? Math.max(size.x, size.y, size.z) : size.y;
  const s = targetH / dim; root.scale.multiplyScalar(s); root.rotation.y = yaw || 0;
  root.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(root);
  root.position.y -= box.min.y; root.position.x -= (box.min.x + box.max.x) / 2; root.position.z -= (box.min.z + box.max.z) / 2;
  root.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = true; o.receiveShadow = true; } });
  const mixer = new THREE.AnimationMixer(root);
  return { wrap, root, mixer, clips: gltf.animations, actions: {}, cur: null };
}
function play(inst, clip, { loop = true, fade = 0.15, speed = 1 } = {}) {
  if (!clip) return null;
  let a = inst.actions[clip.name]; if (!a) a = inst.actions[clip.name] = inst.mixer.clipAction(clip);
  if (inst.cur === a && loop) return a;
  a.reset(); a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); a.clampWhenFinished = !loop; a.timeScale = speed;
  a.play(); if (inst.cur && inst.cur !== a) inst.cur.crossFadeTo(a, fade, false);
  inst.cur = a; return a;
}

// ---------- state ----------
let G = null; // game state
const heroById = Object.fromEntries(HEROES.map(h => [h.id, h]));
let selected = (save.party || []).filter(id => heroById[id] && save.unlocked.includes(id)).slice(0, 5);
if (Q.get('party')) selected = Q.get('party').split(',').filter(id => heroById[id]).slice(0, 5);
let manual = false;
const keys = {}; let stickVec = { x: 0, y: 0 };

// ---------- synergy ----------
function computeSynergy(ids) {
  const defs = ids.map(i => heroById[i]); const cnt = { medieval: 0, modern: 0, space: 0 }; const roles = {};
  defs.forEach(d => { cnt[d.era]++; roles[d.role] = (roles[d.role] || 0) + 1; });
  const S = { hp: 1, rate: 1, cdr: 1, dmg: 1, taken: 1, gold: 1, aoe: 1, turret: 1, ranged: 1, regen: 0, chips: [] };
  if (cnt.medieval >= 2) { S.hp *= cnt.medieval >= 3 ? 1.3 : 1.12; S.regen += cnt.medieval >= 3 ? 1.5 : .5; S.chips.push(`중세 ${cnt.medieval}: 체력/회복`); }
  if (cnt.modern >= 2) { S.rate *= cnt.modern >= 3 ? 1.25 : 1.1; S.dmg *= cnt.modern >= 3 ? 1.1 : 1; S.chips.push(`현대 ${cnt.modern}: 공속/치명`); }
  if (cnt.space >= 2) { S.cdr *= cnt.space >= 3 ? .7 : .85; S.aoe *= cnt.space >= 3 ? 1.25 : 1.1; S.chips.push(`우주 ${cnt.space}: 쿨다운/범위`); }
  if (cnt.medieval && cnt.modern && cnt.space) { S.gold *= 1.2; S.dmg *= 1.05; S.chips.push('등불 연합: 엠버 +20%, 피해 +5%'); }
  if (roles.tank && roles.aura) { S.taken *= .85; S.chips.push('방패+오라: 받는 피해 -15%'); }
  if (roles.control && roles.caster) { S.aoe *= 1.25; S.chips.push('제어+마법: 범위 피해 +25%'); }
  if ((roles.engineer || roles.trapper) && roles.tank) { S.turret *= 1.3; S.chips.push('설치+방패: 설치물 +30%'); }
  if ((roles.gunner || 0) >= 2) { S.ranged *= 1.1; S.chips.push('사수 2: 원거리 +10%'); }
  return S;
}

// ---------- menu ----------
const SKILL_DESC = { barrier: '등불 방벽: 4초간 파티 전체 받는 피해 -50%', heal: '치유: 파티와 등불을 회복', aoe: '범위 마법: 적 무리에 광역 피해와 감속', pull: '중력장: 적을 끌어당기고 늦춤', turret: '포탑 설치: 일정 시간 자동 사격', trap: '함정 설치: 밟으면 폭발하며 감속', volley: '연속 사격: 여러 발을 연달아 발사', dash: '돌진 타격: 적에게 뛰어들어 범위 피해', aura: '지휘 오라: 파티 공격 속도 +25% (5초)', gold: '보급' };
let eraTab = 'all';
function renderMenu() {
  $('contBtn').classList.toggle('hidden', !save.run); if (save.run) $('contBtn').textContent = `이어하기 (스테이지 ${save.run.wave} · Lv${save.run.level})`;
  $('meta').textContent = `보유 엠버 ${save.embers} · 최고 스테이지 ${save.best} · 해금 ${save.unlocked.length}/21`;
  const tabs = $('tabs'); tabs.innerHTML = '';
  [['all', '전체'], ['medieval', '중세'], ['modern', '현대'], ['space', '우주']].forEach(([k, n]) => { const b = document.createElement('button'); b.className = 'tab' + (eraTab === k ? ' on' : ''); b.textContent = n; b.onclick = () => { eraTab = k; renderMenu(); }; tabs.appendChild(b); });
  const grid = $('grid'); grid.innerHTML = '';
  HEROES.filter(h => eraTab === 'all' || h.era === eraTab).forEach(h => {
    const unlocked = save.unlocked.includes(h.id);
    const d = document.createElement('div');
    d.className = `hc e-${h.era}` + (selected.includes(h.id) ? ' sel' : '') + (unlocked ? '' : ' lock');
    d.innerHTML = `${ptHtml(h.id, 'lg')}<b>${h.name}</b><span class="era" style="color:${ERA[h.era].color}">${ERA[h.era].name}</span><span class="role">${h.roleName}</span><p class="bl">${unlocked ? h.blurb : `<span class="lk">잠김 · ${h.cost} 엠버</span>`}</p><span class="info">i</span>${selected.includes(h.id) ? '<span class="pick">편성 ' + (selected.indexOf(h.id) + 1) + '</span>' : ''}`;
    d.querySelector('.info').onclick = e => { e.stopPropagation(); openDetail(h); };
    d.onclick = () => toggleHero(h);
    grid.appendChild(d);
  });
  const slots = $('slots'); slots.innerHTML = '';
  for (let i = 0; i < 5; i++) { const id = selected[i]; const d = document.createElement('div'); d.className = 'slot' + (id ? ' full' : ''); d.textContent = id ? heroById[id].name : `빈 슬롯 ${i + 1}`; if (id) { d.style.setProperty('--era', ERA[heroById[id].era].color); d.onclick = () => { selected = selected.filter(x => x !== id); renderMenu(); }; } slots.appendChild(d); }
  const S = computeSynergy(selected);
  $('preview').innerHTML = selected.length ? (S.chips.length ? S.chips.map(c => `<span class="chip">${c}</span>`).join(' ') : '활성 시너지 없음 (같은 시대 2명 이상이면 발동)') : '영웅을 눌러 파티에 넣으세요. i 버튼은 상세/3D 보기.';
  const b = $('startBtn'); b.disabled = selected.length < 1; b.textContent = selected.length === 5 ? '출정' : `출정 (${selected.length}/5명)`;
  fillPortraits(HEROES.filter(h => (eraTab === 'all' || h.era === eraTab)).sort((a, b) => (selected.includes(b.id) | 0) - (selected.includes(a.id) | 0) || (save.unlocked.includes(b.id) | 0) - (save.unlocked.includes(a.id) | 0)).map(h => h.id));
  $('credits').innerHTML = CREDITS;
}
function toggleHero(h) {
  const unlocked = save.unlocked.includes(h.id);
  if (!unlocked) { if (save.embers >= h.cost) { if (confirm(`${h.name} 해금: 엠버 ${h.cost}`)) { save.embers -= h.cost; save.unlocked.push(h.id); persist(); } } else { $('preview').textContent = `엠버가 부족합니다 (${h.cost} 필요)`; return; } }
  else if (selected.includes(h.id)) selected = selected.filter(x => x !== h.id);
  else if (selected.length < 5) selected.push(h.id);
  renderMenu();
}
// hero portraits: own offscreen render, cached as data URLs
const PORT_IMG = {}; let PORT_R = null, PORT_Q = Promise.resolve();
const EQI = { weapon: '<svg viewBox="0 0 24 24"><path d="M14.5 3.5 20.5 3.5 20.5 9.5 10 20 7.5 17.5 18 7z M5.5 15.5 8.5 18.5 5 22 2 22 2 19z" fill="currentColor"/></svg>', armour: '<svg viewBox="0 0 24 24"><path d="M12 2 20 5.5V12c0 5-3.6 8.6-8 10-4.4-1.4-8-5-8-10V5.5z" fill="currentColor"/></svg>', trinket: '<svg viewBox="0 0 24 24"><path d="M12 2 15 9 22 9.5 16.5 14 18.5 21.5 12 17.5 5.5 21.5 7.5 14 2 9.5 9 9z" fill="currentColor"/></svg>' };
function ptHtml(id, cls) { return `<span class="pt ${cls || ''}"><img data-pid="${id}" alt="" ${PORT_IMG[id] ? `src="${PORT_IMG[id]}"` : ''}></span>`; }
function fillPortraits(ids) {
  ids.forEach(id => { if (PORT_IMG[id]) return; PORT_Q = PORT_Q.then(async () => {
    if (PORT_IMG[id]) return; const def = heroById[id]; if (!def) return;
    try {
      const gltf = await loadModel(def.file);
      if (!PORT_R) { const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); r.outputColorSpace = THREE.SRGBColorSpace; r.setSize(160, 160, false); const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xdfe8ff, 0x445066, 2.0)); const dl = new THREE.DirectionalLight(0xffe2b0, 2.2); dl.position.set(1.5, 2.5, 3); sc.add(dl); const cam = new THREE.PerspectiveCamera(26, 1, .1, 50); cam.position.set(0, 1.45, 2.1); cam.lookAt(0, 1.38, 0); PORT_R = { r, sc, cam }; }
      const inst = makeInstance(gltf, 1.75, 'y', 0); PORT_R.sc.add(inst.wrap); inst.mixer.update(0); PORT_R.r.render(PORT_R.sc, PORT_R.cam);
      PORT_IMG[id] = PORT_R.r.domElement.toDataURL('image/png'); PORT_R.sc.remove(inst.wrap);
    } catch (e) { return; }
    document.querySelectorAll(`img[data-pid="${id}"]`).forEach(im => im.src = PORT_IMG[id]);
  }); });
}
// 3D detail preview (own renderer)
let pv = null;
async function openDetail(h) {
  $('detail').classList.remove('hidden');
  const unlocked = save.unlocked.includes(h.id);
  $('dtext').innerHTML = `<b style="font-size:16px">${h.name}</b> <span style="color:${ERA[h.era].color}">${ERA[h.era].name} · ${h.roleName}</span><br>${h.blurb}<br>체력 ${h.hp} · 공격력 ${h.dmg || '-'} · 공속 ${h.rate} · 사거리 ${h.range} · 이동 ${h.speed}<br>스킬: ${SKILL_DESC[h.skill.type] || ''} (재사용 ${h.skill.cd}초)${unlocked ? '' : `<br>🔒 해금 ${h.cost} 엠버`}`;
  const sb = $('dsel'); sb.textContent = !unlocked ? `해금 (${h.cost} 엠버)` : selected.includes(h.id) ? '파티에서 빼기' : '파티에 넣기';
  sb.onclick = () => { toggleHero(h); $('detail').classList.add('hidden'); if (pv) pv.stop = true; };
  $('dclose').onclick = () => { $('detail').classList.add('hidden'); if (pv) pv.stop = true; };
  if (!pv) { const r = new THREE.WebGLRenderer({ canvas: $('pv'), antialias: true, alpha: true }); r.outputColorSpace = THREE.SRGBColorSpace; const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x445066, 2.2)); const dl = new THREE.DirectionalLight(0xffffff, 1.6); dl.position.set(2, 4, 3); sc.add(dl); const cam = new THREE.PerspectiveCamera(32, 260 / 320, .1, 50); cam.position.set(0, 1.25, 5.2); cam.lookAt(0, .9, 0); pv = { r, sc, cam, clock: new THREE.Clock(), inst: null, t: 0 }; r.setSize(260, 320, false); }
  pv.stop = false; if (pv.inst) { pv.sc.remove(pv.inst.wrap); pv.inst = null; }
  const gltf = await loadModel(h.file); if (pv.stop) return;
  const inst = makeInstance(gltf, 1.75, 'y', 0); pv.sc.add(inst.wrap); pv.inst = inst; pv.t = 0; pv.clipList = ['Idle', ...h.anim.map(n => ({ melee: 'Sword_Slash', gun: 'Gun_Shoot', punch: 'Punch_Left', kick: 'Kick_Right', cast: 'Interact', wave: 'Wave' }[n]))];
  pv.ci = -1; const loop = () => { if (pv.stop || pv.inst !== inst) return; requestAnimationFrame(loop); const dt = Math.min(pv.clock.getDelta(), .05); pv.t += dt; if (pv.t > (pv.ci <= 0 ? 2.2 : 1.6) || pv.ci < 0) { pv.t = 0; pv.ci = (pv.ci + 1) % pv.clipList.length; play(inst, findClip(inst.clips, new RegExp(pv.pclip = pv.clipList[pv.ci] + '$')), { loop: pv.ci === 0, fade: .12 }); } inst.wrap.rotation.y += dt * .6; inst.mixer.update(dt); pv.r.render(pv.sc, pv.cam); }; loop();
}
$('startBtn').onclick = () => {
  if (save.run) {
    const g = emberGain(save.run.maxStage, save.run.relics);
    if (!confirm(`진행 중인 원정(스테이지 ${save.run.wave}, Lv${save.run.level})이 있습니다.\n[확인] 포기하고 정산: 엠버 +${g}을 받고, 이 원정의 장비/레벨/은화는 사라지며 새로 출정합니다.\n[취소] 그대로 두고 "이어하기"를 사용합니다.`)) return;
    save.embers += g; save.best = Math.max(save.best || 0, save.run.maxStage); save.run = null; persist();
  }
  save.party = selected.slice(); persist(); startGame(); };
$('contBtn').onclick = () => { if (save.run) startGame(true); };
$('resetBtn').onclick = () => { if (confirm('저장 데이터를 지울까요?')) { localStorage.removeItem(SAVE_KEY); location.reload(); } };

// ---------- game ----------
const ENY = {}; // enemy loaded defs
async function preloadEnemy(key) {
  const d = ENEMIES[key]; if (!d) return;
  if (!d.gltf) d.gltf = await loadModel(d.file);
}
async function startGame(resume) {
  const R = resume ? save.run : null; if (!R) save.run = null;
  $('loading').classList.remove('hidden');
  if (G) cleanup();
  if (R) selected = R.party.filter(id => heroById[id]);
  const S = computeSynergy(selected);
  if (FX.ok) try { FX.ctx.stopAll(); FX.live = []; } catch (e) { }
  G = { S, heroes: [], enemies: [], proj: [], fx: [], turrets: [], timers: [], wave: 0, kills: 0, earned: 0, lantern: 100, lanternMax: 100, over: false, waveActive: false, spawnQ: [], flames: 3, W: 0, state: 'init', packs: [], packNo: 0, packsDone: 0, marching: false, stT: 0, nextW: 0, t: 0, camp: { whet: 0, dress: 0, oil: 0, tonic: 0 }, tonics: 2, loot: [], relics: 0, maxStage: 0, silverMul: 1, xp: 0, level: 1, pendingCards: 0, cardStack: {}, holdCount: 0, st: { downs: 0, minHp: 1, t: 0 }, bonus: { atk: 1, hp: 1, rate: 1, speed: 1, cdr: 1, gold: 1 }, boss: null, flare: 0 };
  for (let i = 0; i < selected.length; i++) {
    const def = heroById[selected[i]]; const gltf = await loadModel(def.file);
    const inst = makeInstance(gltf, 2.5, 'y', 0);
    const hero = { def, inst, hp: def.hp * S.hp, maxhp: def.hp * S.hp, pos: new THREE.Vector3(Math.cos(i * 1.2) * 3 + 0, 0, 3 + Math.sin(i * 1.2) * 2), atkCd: 0, skCd: 3 + i, alive: true, busy: 0, face: 0, idx: i };
    hero.clips = { idle: findClip(inst.clips, /Idle$/) || findClip(inst.clips, /Idle/), walk: findClip(inst.clips, /Walk$/), run: findClip(inst.clips, /Run$/), melee: findClip(inst.clips, /Sword_Slash$/), gun: findClip(inst.clips, /Gun_Shoot$/), punch: findClip(inst.clips, /Punch_Left$/), kick: findClip(inst.clips, /Kick_Right$/), cast: findClip(inst.clips, /Interact$/), wave: findClip(inst.clips, /Wave$/), die: findClip(inst.clips, /Death$/), hit: findClip(inst.clips, /HitRecieve$/) };
    hero.attackClips = def.anim.map(n => hero.clips[n]).filter(Boolean);
    inst.wrap.position.copy(hero.pos); scene.add(inst.wrap); play(inst, hero.clips.idle);
    G.heroes.push(hero);
  }
  buildPartyUI();
  $('menu').classList.add('hidden'); $('modal').classList.add('hidden'); $('hud').classList.remove('hidden'); $('loading').classList.add('hidden');
  $('stick').classList.toggle('hidden', !('ontouchstart' in window));
  updateHUD();
  G.bonus.atk *= 1 + .06 * boonLv('dmg'); G.bonus.gold *= 1 + .1 * boonLv('silver'); G.bonus.xp = (G.bonus.xp || 1) * (1 + .08 * boonLv('xp'));
  { const k = 1 + .06 * boonLv('hp'); G.heroes.forEach(h => { h.maxhp *= k; h.hp *= k; }); }
  const startWave = parseInt(Q.get('wave') || '0', 10) || (1 + Math.min(boonLv('start'), Math.max(0, (save.best || 0) - 3)));
  G.wave = Math.max(1, startWave); G.maxStage = G.wave - 1;
  if (R) { restoreRun(R); toast(`이어하기: 스테이지 ${G.wave}`); }
  beginStage();
}
function cleanup() {
  if (G.lightMesh) scene.remove(G.lightMesh);
  [...G.heroes.map(h => h.inst.wrap), ...G.enemies.map(e => e.inst.wrap), ...G.proj.map(p => p.mesh), ...G.fx.map(f => f.mesh), ...G.turrets.map(t => t.mesh)].forEach(o => scene.remove(o));
  G = null;
}
function buildPartyUI() {
  const p = $('party'); p.innerHTML = '';
  G.heroes.forEach(h => {
    const c = document.createElement('div'); c.className = 'card'; c.style.setProperty('--era', ERA[h.def.era].color);
    c.innerHTML = `<div class="n">${h.def.name}</div><div class="bar"><div class="hp"></div></div><div class="bar cd"><div class="cd"></div></div>`;
    h.ui = c; p.appendChild(c);
  });
  const syn = $('synergy'); syn.innerHTML = G.S.chips.map(c => `<span class="chip">${c}</span>`).join('');
}
function toast(t) { const e = $('toast'); e.textContent = t; e.style.opacity = 1; clearTimeout(toast.h); toast.h = setTimeout(() => e.style.opacity = 0, 1600); }
function updateHUD() {
  $('flareBtn').textContent = G.flare >= 1 ? '플레어 발사!' : `플레어 ${Math.floor((G.flare || 0) * 100)}%`; $('flareBtn').classList.toggle('ready', G.flare >= 1);
  $('wave').textContent = G.wave; $('kills').textContent = G.kills; $('embers').textContent = G.earned;
  $('lanternFill').style.width = Math.min(100, G.packsDone / 4 * 100) + '%';
  $('lanternTxt').textContent = `${ZONES[Math.max(0, Math.floor((G.wave - 1) / 5)) % 5].name} · 불꽃 ×${G.flames} · ${Math.min(G.packNo, 3)}/3 무리${G.packsDone >= 4 ? ' · 보스 격파' : ''} · Lv${G.level} (${Math.floor(G.xp)}/${xpNeed(G.level)})`;
  G.heroes.forEach(h => { h.ui.classList.toggle('dead', !h.alive); h.ui.querySelector('.hp').style.width = Math.max(0, h.hp / h.maxhp * 100) + '%'; const cdv = 1 - Math.max(0, h.skCd) / (h.def.skill.cd * G.S.cdr * G.bonus.cdr); h.ui.querySelector('.cd').style.width = Math.min(100, cdv * 100) + '%'; });
  $('modeBtn').textContent = manual ? '수동 (Space)' : '위임 (Space)';
  if (G.boss && G.boss.alive) { $('bossBar').classList.remove('hidden'); $('bossName').textContent = G.boss.def.name; $('bossFill').style.width = Math.max(0, G.boss.hp / G.boss.maxhp * 100) + '%'; } else $('bossBar').classList.add('hidden');
}
$('modeBtn').onclick = () => { manual = !manual; };
$('flareBtn').onclick = () => { fireFlare(); };
$('speedBtn').onclick = () => { save.speed = save.speed === 1 ? 2 : save.speed === 2 ? 4 : 1; persist(); $('speedBtn').textContent = save.speed + '배속'; };
$('speedBtn').textContent = save.speed + '배속';
addEventListener('keydown', e => { keys[e.code] = true; if (e.code === 'Space') { manual = !manual; e.preventDefault(); } });
addEventListener('keyup', e => keys[e.code] = false);
{ // touch stick
  const st = $('stick'), kn = $('knob'); let act = false;
  const mv = e => { const r = st.getBoundingClientRect(); const t = e.touches ? e.touches[0] : e; let x = (t.clientX - r.left - 55) / 55, y = (t.clientY - r.top - 55) / 55; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } stickVec = { x, y }; kn.style.left = 35 + x * 35 + 'px'; kn.style.top = 35 + y * 35 + 'px'; };
  st.addEventListener('touchstart', e => { act = true; mv(e); e.preventDefault(); }, { passive: false });
  st.addEventListener('touchmove', e => { if (act) mv(e); e.preventDefault(); }, { passive: false });
  st.addEventListener('touchend', () => { act = false; stickVec = { x: 0, y: 0 }; kn.style.left = kn.style.top = '35px'; });
}

// ----- waves -----
// 내 설계: 전투를 길게 하려고 무리당 적 수를 늘리고(CROWD), 적 한 마리의 보상/드랍/플레어 충전은 같은 비율로 줄여 경제는 유지한다.
const CROWD = 3.6, crowdK = e => (e.def.boss || e.def.reward >= 15) ? 1 : 1 / CROWD;
function waveComposition(w) {
  const q = []; const z = Math.floor((w - 1) / 5);
  const n = Math.round((9 + Math.floor(w * 2.2)) * CROWD);
  for (let i = 0; i < n; i++) {
    const r = Math.random(); let k = 'rat';
    if (z === 0) k = r > .55 ? 'zombie' : 'rat';
    else if (z === 1) k = r > .66 ? 'skeleton' : r > .33 ? 'zombie' : 'rat';
    else k = r > .5 ? 'skeleton' : r > .2 ? 'zombie' : 'rat';
    if (w < 3 && k === 'skeleton') k = 'zombie';
    q.push(k);
  }
  if (w >= 3 && w % 3 === 0 && w % 5 !== 0) q.push('lava');
  return q;
}
const BOSS_ORDER = ['ogre', 'trex', 'mech'];
const bossOf = w => BOSS_ORDER[(w - 1) % 3];
const WALK = 3.4;
const CEN = new THREE.Vector3(), EAST = new THREE.Vector3(1, 0, 0);
// ----- stage flow: march along the road -> 3 packs -> stage boss -> relight -> pick a boon -> next stage -----
async function beginStage() {
  G.st = { downs: 0, minHp: 1, t: 0 }; G.loot = [];
  const zi = Math.floor((G.wave - 1) / 5);
  if (G.zone !== zi) { G.zone = zi; buildWorld(zi); if ((G.wave - 1) % 5 === 0) setTimeout(() => toast(`구역 ${zi % 5 + 1}: ${ZONES[zi % 5].name}`), 1700); }
  const all = waveComposition(G.wave), per = Math.ceil(all.length / 3);
  G.packs = [all.slice(0, per), all.slice(per, per * 2), all.slice(per * 2)];
  G.packNo = 0; G.packsDone = 0; G.spawnQ = []; G.waveActive = false; G.boss = null;
  await Promise.all([...new Set([...all, bossOf(G.wave)])].map(preloadEnemy));
  G.heroes.forEach(h => { if (!h.alive) { h.alive = true; h.hp = h.maxhp * .6; h.inst.wrap.visible = true; play(h.inst, h.clips.idle); } });
  G.state = 'walk'; G.nextW = G.W + 8; G.stT = 0;
  toast(`스테이지 ${G.wave}`);
  snapshotRun();
  updateHUD();
}
function advance(dt) {
  const dx = WALK * dt; G.W += dx;
  for (const e of G.enemies) e.pos.x -= dx;
  for (const p of G.proj) p.mesh.position.x -= dx;
  for (const f of G.fx) f.mesh.position.x -= dx;
  for (const u of G.turrets) { u.pos.x -= dx; u.mesh.position.x -= dx; }
}
function stageFlow(dt) {
  G.marching = false; G.stT += dt;
  const alive = G.enemies.filter(e => e.alive);
  if (G.state === 'walk') {
    G.marching = true; advance(dt);
    if (G.W >= G.nextW) {
      if (G.packNo < 3) { G.spawnQ = [...G.packs[G.packNo]]; G.packNo++; G.spawnT = 0; G.waveActive = true; G.state = 'fight'; G.stT = 0; }
      else { G.spawnQ = [bossOf(G.wave)]; G.spawnT = 0; G.waveActive = true; G.state = 'boss'; G.stT = 0; toast(`${ENEMIES[bossOf(G.wave)].name} 등장!`); }
    }
  } else if (G.state === 'fight' || G.state === 'boss') {
    if (!alive.some(e => e.pos.x < 12) && (alive.length || G.spawnQ.length)) { G.marching = true; advance(dt); }
    if (!alive.length && !G.spawnQ.length) {
      G.heroes.forEach(h => { if (!h.alive) { h.alive = true; h.hp = h.maxhp * .4; h.inst.wrap.visible = true; play(h.inst, h.clips.idle); } else h.hp = Math.min(h.maxhp, h.hp + h.maxhp * Math.min(.4, .03 + .025 * G.camp.dress)); });
      G.waveActive = false; G.stT = 0; G.packsDone++; if (save.autoCamp) autoCamp(); campHint();
      if (G.state === 'boss') { G.boss = null; G.packsDone = 4; G.state = 'relight'; G.maxStage = Math.max(G.maxStage, G.wave); toast('길목의 등불에 불을 붙입니다'); G.heroes.forEach(h => { h.alive = true; h.hp = h.maxhp; h.inst.wrap.visible = true; }); G.tonics = maxTonics(); }
      else { G.state = 'breather'; }
    }
  } else if (G.state === 'breather') {
    if (G.stT > 1) { G.state = 'walk'; G.nextW = G.W + 8 + Math.random() * 3; G.stT = 0; }
  } else if (G.state === 'relight') {
    if (G.stT > 2.2) { G.state = 'choice'; offerUpgrade(); }
  } else if (G.state === 'wipe') {
    if (G.stT > 2) {
      if (G.flames <= 0) { end(); return; }
      G.enemies.forEach(e => scene.remove(e.inst.wrap)); G.enemies = []; G.spawnQ = []; G.boss = null;
      G.heroes.forEach(h => { h.alive = true; h.hp = h.maxhp; h.inst.wrap.visible = true; play(h.inst, h.clips.idle); });
      G.wave = Math.max(1, G.wave - 1); G.state = 'init'; beginStage(); toast(`파티가 스테이지 ${G.wave}로 물러납니다`);
    }
  }
}
function nextWave() { G.wave++; G.state = 'init'; beginStage(); }
function spawnEnemy(key) {
  const d = ENEMIES[key]; const inst = makeInstance(d.gltf, d.h * 1.25, d.mode || 'y', d.yaw);
  const sx = 15 + Math.random() * 5; const pos = new THREE.Vector3(sx, 0, roadZ(G.W + sx) + (Math.random() - .5) * 5);
  const sc = d.boss ? 1600 * (.6 + G.wave * .13) / d.hp : 1 + G.wave * .09; // stage bosses share one strength curve, the model only changes the look
  const early = d.boss ? 1 : 1 + .9 * Math.max(0, 6 - G.wave) / 5; // 초반 전투가 너무 짧아 스킬 연출이 안 보여서 1~5스테이지 일반 적 체력만 +90%(스테이지 1) → 0%(스테이지 6)로 감소(내 설계)
  const e = { key, def: d, inst, pos, hp: d.hp * sc * early, maxhp: d.hp * sc * early, dmg: (d.boss ? 30 : d.dmg) * (1 + G.wave * .06), atkCd: 0, alive: true, clipW: findClip(inst.clips, d.walk), clipA: findClip(inst.clips, d.atk), dying: 0, hitFlash: 0 };
  inst.wrap.position.copy(pos); scene.add(inst.wrap); play(inst, e.clipW);
  G.enemies.push(e); if (d.boss) G.boss = e; return e;
}
function nearest(list, p, maxd = 1e9) { let b = null, bd = maxd; for (const o of list) { if (o.alive === false) continue; const dd = o.pos.distanceTo(p); if (dd < bd) { bd = dd; b = o; } } return b; }
// ---------- 등불 반경 / 램프유 / 플레어 (원작 규칙을 참고한 독립 구현) ----------
const lightCarrier = () => G.heroes.find(h => h.alive) || G.heroes[0];
const cardLv = id => (G.cardStack && G.cardStack[id]) || 0;
const lightRadius = () => 9 * (1 + .06 * G.camp.oil + .15 * cardLv('p:light')) * (.72 + .0933 * G.flames);
function inLight(pos) { const c = lightCarrier(); return !!c && Math.hypot(pos.x - c.pos.x, pos.z - c.pos.z) < lightRadius(); }
function fireFlare() {
  if (!G || G.over || G.paused || G.flare < 1 || G.heroes.every(h => !h.alive)) return false;
  G.flare = 0; const c = lightCarrier(), r = lightRadius(), pf = 1 + .3 * cardLv('p:flare');
  const dmg = G.heroes.reduce((a, h) => a + ((h.def.dmg || 0) * G.bonus.atk * (h.mul || 1) * (h.gm ? h.gm.atk : 1) * G.S.dmg), 0) * 1.5 * pf;
  G.enemies.forEach(e => { if (e.alive && Math.hypot(e.pos.x - c.pos.x, e.pos.z - c.pos.z) < r) damageEnemy(e, dmg); });
  G.heroes.forEach(h => { if (h.alive) h.hp = Math.min(h.maxhp, h.hp + h.maxhp * .1); });
  ring(c.pos, r, 0xffb860, .7); try { fxPlay('light', c.pos, Math.min(.8, Math.max(.5, r / 14))); } catch (e) { } toast('등불 플레어!'); return true;
}
function damageEnemy(e, dmg, noLight) {
  if (!e.alive) return; if (!noLight && inLight(e.pos)) dmg *= 1 + .02 * G.camp.oil + .04; e.hp -= dmg; e.hitFlash = .12; dmgText(e.pos, dmg); try { fxHit(e, dmg); } catch (er) { }
  if (e.hp <= 0) { e.alive = false; e.dying = 1; G.kills++; G.flare = Math.min(1, G.flare + (e.def.boss ? .5 : e.def.reward >= 15 ? .1 : .045 * crowdK(e)) * (1 + .3 * cardLv('p:flare'))); const gb = 1 + G.heroes.reduce((a, h) => a + (h.alive ? (h.def.goldBonus || 0) : 0), 0); const held = G.holdCount > 0 ? .8 : 1; dropLoot(e); const gRaw = e.def.reward * crowdK(e) * G.S.gold * G.bonus.gold * gb * held * (G.silverMul || 1); let gain; if (crowdK(e) === 1) gain = Math.ceil(gRaw); else { const tot = gRaw + (G.silverFrac || 0); gain = Math.floor(tot + 1e-9); G.silverFrac = tot - gain; }  /* 분수 보상은 잔여를 누적해 정수로 지급 */  G.earned += gain; addXp(Math.max(.4, e.def.reward * .9 * crowdK(e)) * Math.pow(1.13, G.wave - 1) * (G.bonus.xp || 1) * held); if (e.inst.cur) e.inst.cur.paused = true; }
}
const dmgLayer = document.createElement('div'); dmgLayer.style.cssText = 'position:fixed;inset:0;pointer-events:none;overflow:hidden'; document.body.appendChild(dmgLayer);
function dmgText(pos, dmg) {
  if (dmgLayer.childElementCount > 24) return;
  const v = new THREE.Vector3(pos.x, 2, pos.z).project(camera); const el = document.createElement('div');
  el.textContent = Math.round(dmg); el.style.cssText = `position:absolute;left:${(v.x + 1) / 2 * innerWidth}px;top:${(1 - v.y) / 2 * innerHeight}px;color:#fff3c0;font:700 13px system-ui;text-shadow:0 1px 3px #000;transition:transform .6s,opacity .6s`;
  dmgLayer.appendChild(el); requestAnimationFrame(() => { el.style.transform = 'translateY(-26px)'; el.style.opacity = 0; }); setTimeout(() => el.remove(), 650);
}
function damageHero(h, dmg) {
  if (!h.alive) return; h.hp -= dmg * G.S.taken * (h.gm ? h.gm.ward : 1) * (h.shield > 0 ? .5 : 1); // 등불 방벽: 지속시간 동안 받는 피해 50%(내 설계, 이전엔 배선 누락)
  if (h.hp <= 0) { h.hp = 0; h.alive = false; h.downT = 20; G.st.downs++; play(h.inst, h.clips.die, { loop: false }); }
  else if (h.busy <= 0 && Math.random() < .15) { h.busy = .4; play(h.inst, h.clips.hit, { loop: false }); }
}
function after(t, fn) { G.timers.push({ t, fn }); }
function ring(pos, r, color, life = .45) {
  const m = new THREE.Mesh(new THREE.RingGeometry(r * .85, r, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .8, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.set(pos.x, .1, pos.z); scene.add(m); G.fx.push({ mesh: m, life, max: life, grow: r });
}
function shoot(from, to, dmg, color, onHit) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(.14, 8, 6), new THREE.MeshBasicMaterial({ color }));
  m.position.set(from.x, 1.2, from.z); scene.add(m);
  G.proj.push({ mesh: m, target: to, dmg, speed: 26, onHit });
}
const teamAtk = h => h.def.dmg * (h.mul || 1) * (h.gm ? h.gm.atk : 1) * G.bonus.atk * G.S.dmg * (h.def.ranged ? G.S.ranged : 1);

function heroAttack(h, tgt) {
  const d = h.def; const clip = h.attackClips[Math.floor(Math.random() * h.attackClips.length)];
  h.atkCd = 1 / (d.rate * G.S.rate * G.bonus.rate * (h.gm ? h.gm.rate : 1) * (h.buffT > 0 ? 1.25 : 1)); h.busy = Math.min(.45, h.atkCd * .9);
  const a = play(h.inst, clip, { loop: false, fade: .08, speed: 1.4 });
  const crit = Math.random() < (d.crit || 0.05) ? 2 : 1;
  const dmg = teamAtk(h) * crit;
  if (d.ranged) after(.18, () => tgt.alive && shoot(h.pos, tgt, dmg, d.color, e => damageEnemy(e, dmg)));
  else after(.2, () => { if (!tgt.alive) return; damageEnemy(tgt, dmg); if (d.cleave) for (const e of G.enemies) if (e !== tgt && e.alive && e.pos.distanceTo(h.pos) < d.range + 1.2) damageEnemy(e, dmg * .5); });
}
function heroSkill(h) {
  const sk = h.def.skill; const S = G.S; let used = false; const AT = G.bonus.atk * (h.mul || 1) * (h.skMul || 1) * (h.gm ? h.gm.atk * h.gm.skill : 1);
  const live = G.enemies.filter(e => e.alive);
  const hurt = G.heroes.filter(x => x.alive && x.hp < x.maxhp * .75);
  switch (sk.type) {
    case 'barrier': if (live.some(e => e.pos.distanceTo(h.pos) < 6)) { G.heroes.forEach(x => x.shield = 4 * (h.skMul || 1)); ring(h.pos, 2.2, 0xffd36b); used = true; } break;
    case 'heal': if (hurt.length || G.lantern < G.lanternMax * .7) { G.heroes.forEach(x => x.alive && (x.hp = Math.min(x.maxhp, x.hp + sk.power * AT))); G.lantern = Math.min(G.lanternMax, G.lantern + sk.power * .4); ring(h.pos, 2.4, 0x58d68d); used = true; } break;
    case 'aoe': { const t = nearest(live, h.pos, 18); if (t) { const r = sk.r * S.aoe; ring(t.pos, r, sk.color || 0xb86bff, .5); const dmg = sk.power * AT * S.dmg; after(.25, () => G.enemies.forEach(e => e.alive && e.pos.distanceTo(t.pos) < r && (damageEnemy(e, dmg), sk.slow && (e.slow = 2.5)))); used = true; } } break;
    case 'pull': { const t = nearest(live, h.pos, 18); if (t) { ring(t.pos, sk.r * S.aoe * (h.skMul || 1), 0x9b6bdc, .6); G.enemies.forEach(e => { if (e.alive && !e.def.boss && e.pos.distanceTo(t.pos) < sk.r * S.aoe * (h.skMul || 1)) { e.pos.lerp(t.pos, .8); e.slow = 3; } }); used = true; } } break;
    case 'turret': if (live.length) { const m = new THREE.Mesh(new THREE.CylinderGeometry(.35, .5, .9, 8), new THREE.MeshStandardMaterial({ color: sk.color || 0x4aa3df, emissive: sk.color || 0x4aa3df, emissiveIntensity: .4 })); const p = h.pos.clone().add(new THREE.Vector3((Math.random() - .5) * 3, 0, (Math.random() - .5) * 3)); m.position.set(p.x, .45, p.z); scene.add(m); G.turrets.push({ mesh: m, pos: p, life: 12, cd: 0, dmg: sk.power * AT * S.turret, blocker: sk.blocker }); used = true; } break;
    case 'trap': if (live.length) { const t = nearest(live, h.pos, 18); const m = new THREE.Mesh(new THREE.CylinderGeometry(.6, .6, .1, 12), new THREE.MeshBasicMaterial({ color: 0xe67e22 })); m.position.set(t.pos.x, .06, t.pos.z); scene.add(m); G.turrets.push({ mesh: m, pos: t.pos.clone(), life: 10, trap: true, dmg: sk.power * AT * S.turret, r: 3 }); used = true; } break;
    case 'volley': { const t = nearest(live, h.pos, 20); if (t) { const dmg = sk.power * AT * S.dmg * S.ranged; for (let i = 0; i < sk.n; i++) after(i * .08, () => { const tt = nearest(G.enemies.filter(e => e.alive), h.pos, 22); tt && shoot(h.pos, tt, dmg, h.def.color, e => damageEnemy(e, dmg)); }); used = true; } } break;
    case 'dash': { const t = nearest(live, h.pos, 20); if (t) { const dir = t.pos.clone().sub(h.pos).setY(0).normalize(); h.pos.copy(t.pos).addScaledVector(dir, -1.2); const dmg = sk.power * AT * S.dmg; G.enemies.forEach(e => e.alive && e.pos.distanceTo(t.pos) < 2.8 && damageEnemy(e, dmg)); ring(t.pos, 2.8, 0xff5555, .3); used = true; } } break;
    case 'aura': G.heroes.forEach(x => x.buffT = 5 * (h.skMul || 1)); ring(h.pos, 2.6, 0xffe08a, .6); used = !!live.length; if (used) G.bonus.atk *= 1; break;
    case 'gold': G.earned += 0; used = false; h.skCd = 9999; break;
  }
  if (used) { try { fxSkill(h, sk, nearest(live, h.pos, 22)); } catch (e) { } h.skCd = sk.cd * S.cdr * G.bonus.cdr * (h.skCdMul || 1) * (h.gm ? h.gm.cdr : 1); if (h.clips.cast && sk.type !== 'dash') { h.busy = .5; play(h.inst, h.clips.cast, { loop: false, fade: .1 }); } }
  else h.skCd = Math.min(h.skCd, 0) + .5;
}

const emberGain = (ms, rel) => Math.max(1, Math.floor(Math.pow(Math.max(0, ms), 1.25) * .75 + rel));
function end(win) {
  if (G.over) return;
  G.over = true; save.run = null; const gain = emberGain(G.maxStage, G.relics);
  save.embers += gain; save.best = Math.max(save.best || 0, G.maxStage); persist();
  const m = $('modal'); m.classList.remove('hidden');
  let retryStop = null, retryDone = false;
  const armRetry = () => { if (retryStop) retryStop(); retryStop = countdown(m, 8, () => { if (!retryDone && save.autoRetry && G && G.over) { retryDone = true; startGame(); } }, '자동으로 다시 출정 (화면을 누르면 멈춤)'); };
  const render = () => {
    m.innerHTML = `<h1>등불이 꺼졌습니다</h1><p>도달 스테이지 ${G.maxStage} · 레벨 ${G.level} · 처치 ${G.kills} · 유물 ${G.relics} · 획득 엠버 ${gain}</p><p>보유 엠버 <b>${save.embers}</b> (영구 강화: 다음 런부터 계속 적용)</p>` +
      BOONS.map(b => { const lv = boonLv(b[0]), mx = lv >= b[4]; return `<button class="opt" data-b="${b[0]}" ${mx || save.embers < boonCost(b[0]) ? 'disabled' : ''}><b>${b[1]}</b> ${lv}/${b[4]}<br>${b[2]} · ${mx ? '최대' : '비용 ' + boonCost(b[0])}</button>`; }).join('') +
      '<br><button class="mbtn" id="again">다시 출정</button><br><button class="ghost" id="arBtn"></button> <button class="ghost" id="tomenu">영웅 선택으로</button><p id="cd" style="opacity:.7;font-size:12px"></p>';
    const ar = $('arBtn'); ar.textContent = '자동 재도전: ' + (save.autoRetry ? '켜짐' : '꺼짐'); ar.onclick = e => { e.stopPropagation(); save.autoRetry = !save.autoRetry; persist(); render(); if (save.autoRetry) armRetry(); else if (retryStop) retryStop(); };
    m.querySelectorAll('[data-b]').forEach(el => el.onclick = () => { const id = el.dataset.b, c = boonCost(id); if (save.embers >= c && boonLv(id) < BOONS.find(x => x[0] === id)[4]) { save.embers -= c; save.boons[id] = boonLv(id) + 1; persist(); render(); } });
    $('again').onclick = () => { if (retryStop) retryStop(); startGame(); }; $('tomenu').onclick = () => { m.classList.add('hidden'); $('hud').classList.add('hidden'); $('menu').classList.remove('hidden'); cleanup(); renderMenu(); };
  };
  render(); if (save.autoRetry) armRetry();
}
// ---------- 영웅별 장비 (무기/방어구/장신구, 4등급, 유물은 특수 효과) ----------
const GRADES = [['낡은', 1, '#a8a290'], ['단련된', 1.45, '#7fb4d6'], ['도금된', 2, '#e0a33c'], ['유물', 2.9, '#ff7a3a']];
const SLOTS = [['weapon', '무기', '공격력'], ['armour', '방어구', '체력'], ['trinket', '장신구', '스킬 위력']];
const SPECIALS = [['haste', '공격 속도 +12%'], ['cdr', '스킬 재사용 -12%'], ['silver', '은화 +20%'], ['ward', '받는 피해 -10%']];
function makeItem(slot, stage, minGrade) {
  const r = Math.random(); let g = r < .015 ? 3 : r < .1 ? 2 : r < .38 ? 1 : 0; g = Math.max(g, minGrade || 0);
  const pow = Math.max(1, Math.round(7 * Math.pow(1.105, stage - 1) * GRADES[g][1] * (.88 + Math.random() * .24)));
  const it = { slot, g, pow }; if (g === 3) { const sp = SPECIALS[Math.floor(Math.random() * SPECIALS.length)]; it.sp = sp[0]; it.spT = sp[1]; }
  return it;
}
function recalcHero(h) {
  const g = h.gear || {}, w = g.weapon ? g.weapon.pow : 0, a = g.armour ? g.armour.pow : 0, t = g.trinket ? g.trinket.pow : 0;
  const n = k => SLOTS.reduce((c, sl) => c + (g[sl[0]] && g[sl[0]].sp === k ? 1 : 0), 0);
  const nm = { atk: 1 + w / 100, hp: 1 + a / 100, skill: 1 + t / 100, rate: Math.pow(1.12, n('haste')), cdr: Math.pow(.88, n('cdr')), ward: Math.pow(.9, n('ward')), silver: Math.pow(1.2, n('silver')) };
  const o = h.gm || { hp: 1 }; const k = nm.hp / o.hp; h.maxhp *= k; h.hp *= k; h.gm = nm;
  G.silverMul = (1 + .2 * G.heroes.reduce((c, x) => c + SLOTS.reduce((q, sl) => q + ((x.gear || {})[sl[0]] && x.gear[sl[0]].sp === 'silver' ? 1 : 0), 0), 0));
}
const itemName = it => `${GRADES[it.g][0]} ${SLOTS.find(x => x[0] === it.slot)[1]}`;
function dropLoot(e) {
  const boss = !!e.def.boss, elite = !boss && e.def.reward >= 15;
  const p = boss ? 1 : elite ? .3 : .085 * crowdK(e) * (G.wave === 1 && G.packNo <= 1 ? 1.6 : 1);
  const n = boss ? 2 + (Math.random() < .5 ? 1 : 0) : (Math.random() < p ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const h = G.heroes[Math.floor(Math.random() * G.heroes.length)], slot = SLOTS[Math.floor(Math.random() * 3)][0], it = makeItem(slot, G.wave, boss ? 1 : 0);
    h.gear = h.gear || {}; const cur = h.gear[slot], sm = G.silverMul || 1;
    if (!cur || it.pow > cur.pow || (it.g === 3 && cur.g < 3 && it.pow > cur.pow * .85)) {
      if (cur) G.earned += Math.round(cur.pow * .6 * sm);
      h.gear[slot] = it; recalcHero(h); if (it.g === 3) G.relics++;
      G.loot.push(`<span style="color:${GRADES[it.g][2]}">${h.def.name}: ${itemName(it)} +${it.pow}%${it.spT ? ' (' + it.spT + ')' : ''}</span>`);
      toast(`${h.def.name} ${itemName(it)} 획득`);
    } else { const v = Math.round(it.pow * .6 * sm * Math.pow(1.02, G.wave)); G.bag = G.bag || []; it.hi = G.heroes.indexOf(h); G.bag.push(it); }
  }
}
// ---------- 은화로 캠프 자동 강화 ----------
const CAMP = [['whet', '숫돌', '공격력', 8, 45, 1], ['dress', '붕대', '체력', 8, 45, 1.05], ['oil', '램프유', '등불 반경과 빛 속 회복/피해', 6, 60, 1.5], ['tonic', '탕약', '탕약 개수와 회복량', 1, 70, 1.7]];
const campCost = id => { const c = CAMP.find(x => x[0] === id); return Math.round(c[4] * Math.pow(1.42, G.camp[id])); };
function buyCamp(id) {
  const c = CAMP.find(x => x[0] === id), n = G.camp[id]; if (G.earned < campCost(id)) return false; G.earned -= campCost(id); G.camp[id]++;
  if (id === 'whet') G.bonus.atk *= (1 + .08 * (n + 1)) / (1 + .08 * n);
  else if (id === 'dress') { const k = (1 + .08 * (n + 1)) / (1 + .08 * n); G.heroes.forEach(h => { h.maxhp *= k; h.hp *= k; }); }
  else if (id === 'oil') { /* 등불 반경/빛 속 효과는 G.camp.oil에서 직접 계산 */ }
  else G.tonics = Math.min(maxTonics(), G.tonics + 1);
  toast(`캠프: ${c[1]} ${G.camp[id]}`);
}
const maxTonics = () => Math.min(6, 2 + Math.floor((G.camp.tonic + 1) / 2));
function autoCamp() {
  for (let g = 0; g < 20; g++) { let best = null, bc = 1e18; for (const c of CAMP) { const cost = campCost(c[0]) * c[5]; if (cost < bc) { bc = cost; best = c; } } if (best && G.earned >= campCost(best[0])) buyCamp(best[0]); else break; }
}
function useTonic(dt) {
  G.tonicCd = (G.tonicCd || 0) - dt; if (G.tonics <= 0 || G.tonicCd > 0) return;
  const h = G.heroes.find(x => x.alive && x.hp < x.maxhp * .33); if (!h) return;
  G.tonics--; G.tonicCd = 5; h.hp = Math.min(h.maxhp, h.hp + h.maxhp * Math.min(.7, .35 + .025 * G.camp.tonic)); toast(`${h.def.name} 탕약 사용`);
}

// ---------- 정비 허브: 언제든 열 수 있고, 열려 있는 동안 전투/행군/자동 타이머가 멈춘다 ----------
const SK_TRAIN = { barrier: '방벽 지속시간 +8% (기본 4초)', aura: '오라 지속시간 +8% (기본 5초)', pull: '중력장 범위 +8%' };
const skTrainable = h => h.def.skill.type !== 'gold';
const trainCost = (h, k) => Math.round(35 * Math.pow(1.38, (h.tr || {})[k] | 0) * (k === 'hp' ? 1 : k === 'sk' ? 1.3 : 1.1));
function train(h, k, free) {
  h.tr = h.tr || {}; const n = h.tr[k] | 0; const c = trainCost(h, k); if (k === 'sk' && !skTrainable(h)) return false; if (!free) { if (G.earned < c) return false; G.earned -= c; }
  h.tr[k] = n + 1; const r = (1 + .06 * (n + 1)) / (1 + .06 * n);
  if (k === 'atk') h.mul = (h.mul || 1) * r; else if (k === 'sk') { const q = (1 + .08 * (n + 1)) / (1 + .08 * n); h.skMul = (h.skMul || 1) * q; } else { h.maxhp *= r; h.hp *= r; } return true;
}
function planCamp() { // 추천 정비: 구매 순서를 시뮬레이션만 하고 적용하지 않는다. 항목별로 묶어 비용 합계를 보여준다.
  let silver = G.earned; const lv = { ...G.camp }, cost = id => { const c = CAMP.find(x => x[0] === id); return Math.round(c[4] * Math.pow(1.42, lv[id])); }, per = {}; let total = 0;
  for (let g = 0; g < 20; g++) { let best = null, bc = 1e18; for (const c of CAMP) { const k = cost(c[0]) * c[5]; if (k < bc) { bc = k; best = c; } } if (best && silver >= cost(best[0])) { const k = cost(best[0]), id = best[0]; silver -= k; total += k; const p = per[id] = per[id] || { name: best[1], from: lv[id], n: 0, c: 0 }; p.n++; p.c += k; lv[id]++; } else break; }
  return { plan: Object.values(per).map(p => `${p.name} Lv ${p.from}→${p.from + p.n} (${p.c} 은화)`), total };
}
let hubOpen = false;
function campHint() { const b = $('campBtn'); if (b) { b.classList.add('ready'); b.textContent = '정비 ●'; } toast('정비 가능 (우상단 정비 버튼)'); }
function openHub(onBack) {
  if (!G || G.over || hubOpen) return; const was = G.paused; if (!onBack && was) return;
  hubOpen = true; G.paused = true; const m = $('modal'); m.classList.remove('hidden'); let tab = -1, pv = null, sellArm = null, bagSlot = 'all', bagMore = 40;
  const gearTxt = it => it ? `${itemName(it)} +${it.pow}%${it.spT ? ' (' + it.spT + ')' : ''}` : '없음';
  const close = () => { hubOpen = false; $('campBtn').classList.remove('ready'); $('campBtn').textContent = '정비'; if (onBack) onBack(); else { m.classList.add('hidden'); G.paused = false; } };
  const render = () => {
    const railBtn = (t, label, sub, era, id) => `<button class="rt${tab === t ? ' on' : ''}" data-t="${t}" ${era ? `style="--era:${era}"` : ''}>${id ? ptHtml(id) : ''}<span class="rtx"><b>${label}</b>${sub ? `<em>${sub}</em>` : ''}</span></button>`;
    const tabs = railBtn(-1, '파티 정비', '공용 강화', '') + G.heroes.map((h, i) => railBtn(i, h.def.name, `${ERA[h.def.era].name} · ${h.def.roleName}`, ERA[h.def.era].color, h.def.id)).join('');
    const row = (attr, key, title, sub, cost, dis) => `<button class="opt" ${attr}="${key}" ${dis ? 'disabled' : ''}><span class="ot"><b>${title}</b><em>${sub}</em></span><span class="cost">${cost}<small>은화</small></span></button>`;
    let body = '';
    if (tab === -1) {
      pv = planCamp();
      body = `<h3>공용 강화</h3><div class="list">` + CAMP.map(c => row('data-c', c[0], `${c[1]} <i class="lv">Lv ${G.camp[c[0]]}</i>`, c[2], campCost(c[0]), G.earned < campCost(c[0]))).join('') + `</div>` +
        `<h3>추천 정비</h3><div class="rec">${pv.plan.length ? pv.plan.map(x => `<div>${x}</div>`).join('') + `<div class="tot">합계 <b>${pv.total}</b> 은화 <span>보유 ${Math.round(G.earned)}</span></div>` : '<div class="mute">지금은 살 수 있는 것이 없음</div>'}</div>` +
        `<div class="btnrow"><button class="mbtn" data-rec="1" ${pv.plan.length ? '' : 'disabled'}>추천대로 정비</button><button class="ghost" id="acBtn">자동 정비: ${save.autoCamp ? '켜짐 (팩 종료마다 추천 구매)' : '꺼짐'}</button></div>`;
    } else {
      const h = G.heroes[tab], g = h.gear || {};
      const trn = k => row('data-tr', k, `${k === 'atk' ? '공격 훈련' : k === 'hp' ? '체력 훈련' : '스킬 수련'} <i class="lv">Lv ${(h.tr || {})[k] | 0}</i>`, k === 'atk' ? '기본 공격력 +6%' : k === 'hp' ? '체력 +6%' : (SKILL_DESC[h.def.skill.type] || '스킬').split(':')[0] + ': ' + (SK_TRAIN[h.def.skill.type] || '스킬 위력 +8%'), trainCost(h, k), G.earned < trainCost(h, k) || (k === 'sk' && !skTrainable(h)));
      body = `<div class="hero-head" style="--era:${ERA[h.def.era].color}">${ptHtml(h.def.id, "xl")}<div class="hn"><h2>${h.def.name}</h2><span class="era">${ERA[h.def.era].name} · ${h.def.roleName}</span></div><dl class="stats"><div><dt>체력</dt><dd>${Math.round(h.maxhp)}</dd></div><div><dt>공격 배율</dt><dd>${(h.mul || 1).toFixed(2)}</dd></div></dl></div>` +
        `<h3>장비</h3><div class="gslots">${SLOTS.map(sl => { const it = g[sl[0]]; return `<div class="gslot${it ? '' : ' empty'}"><span class="sn"><i class="eqi">${EQI[sl[0]]}</i>${sl[1]}</span>${it ? `<b>${itemName(it)}</b><i>+${it.pow}%${it.spT ? ' · ' + it.spT : ''}</i>` : '<b>비어 있음</b>'}</div>`; }).join('')}</div>` +
        `<h3>훈련</h3><div class="list">${['atk', 'hp', 'sk'].map(trn).join('')}</div>` +
        (() => { const all = G.bag || [], L = all.map((it, bi) => ({ it, bi })).filter(x => bagSlot === 'all' || x.it.slot === bagSlot).sort((a, b) => b.it.pow - a.it.pow), shown = L.slice(0, bagMore); return `<h3>가방 <span class="mute">${all.length}개 · 판매는 두 번 눌러야 확정됩니다</span></h3><div class="flt">${[['all', '전체'], ...SLOTS.map(x => [x[0], x[1]])].map(f => `<button class="fl${bagSlot === f[0] ? ' on' : ''}" data-f="${f[0]}">${f[1]}</button>`).join('')}</div>` + shown.map(x => `<div class="bagrow"><span><b>${gearTxt(x.it)}</b><em>${G.heroes[x.it.hi] ? G.heroes[x.it.hi].def.name + ' 드랍 · ' : ''}현재 ${h.def.name}: ${gearTxt(g[x.it.slot])}</em></span><button class="sm" data-eq="${x.bi}">장착</button><button class="sm ghost${sellArm === x.it ? ' warn' : ''}" data-sell="${x.bi}">${sellArm === x.it ? '정말 판매? ' : '판매 '}${Math.round(x.it.pow * .6 * (G.silverMul || 1))}</button></div>`).join('') + (L.length > shown.length ? `<button class="ghost" data-more="1">더 보기 (${L.length - shown.length}개 남음)</button>` : ''); })();
    }
    m.innerHTML = `<div class="hub"><header class="hubhead"><div><h1>정비</h1><p class="note">열려 있는 동안 전투는 멈춰 있습니다</p></div><div class="silver"><span>은화</span><b>${Math.round(G.earned)}</b></div></header><div class="hubgrid"><nav class="rail">${tabs}</nav><section class="pane">${body}</section></div><div class="hubfoot"><button class="mbtn" id="hubClose">닫고 계속</button></div></div>`; fillPortraits(G.heroes.map(x => x.def.id));
    m.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { tab = +b.dataset.t; sellArm = null; render(); });
    m.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { buyCamp(b.dataset.c); render(); });
    m.querySelectorAll('[data-tr]').forEach(b => b.onclick = () => { train(G.heroes[tab], b.dataset.tr); render(); });
    m.querySelectorAll('[data-eq]').forEach(b => b.onclick = () => { sellArm = null; const h = G.heroes[tab], it = G.bag[+b.dataset.eq]; G.bag.splice(+b.dataset.eq, 1); h.gear = h.gear || {}; const cur = h.gear[it.slot]; if (cur) { cur.hi = tab; G.bag.push(cur); } delete it.hi; h.gear[it.slot] = it; recalcHero(h); render(); });
    m.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => { const bi = +b.dataset.sell, it = G.bag[bi]; if (!it) return; if (sellArm !== it) { sellArm = it; render(); return; } sellArm = null; G.earned += Math.round(it.pow * .6 * (G.silverMul || 1)); G.bag.splice(+b.dataset.sell, 1); render(); });
    m.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { bagSlot = b.dataset.f; bagMore = 40; sellArm = null; render(); });
    const mo = m.querySelector('[data-more]'); if (mo) mo.onclick = () => { bagMore += 40; sellArm = null; render(); };
    const rc = m.querySelector('[data-rec]'); if (rc) rc.onclick = () => { autoCamp(); render(); };
    const ac = $('acBtn'); if (ac) ac.onclick = () => { save.autoCamp = !save.autoCamp; persist(); render(); };
    $('hubClose').onclick = close;
  };
  render();
}
$('campBtn').onclick = () => openHub();
// ---------- 런 종료: 엠버 정산 + 영구 강화 ----------
const BOONS = [['dmg', '분노의 엠버', '모든 런 공격력 +6%', 2, 20], ['hp', '인내의 엠버', '모든 런 체력 +6%', 2, 20], ['silver', '풍요의 엠버', '모든 런 은화 +10%', 2, 10], ['xp', '기억의 엠버', '모든 런 경험치 +8%', 2, 10], ['start', '길의 엠버', '한 스테이지 앞에서 시작', 4, 12]];
const boonLv = id => save.boons[id] || 0;
const boonCost = id => Math.round(BOONS.find(b => b[0] === id)[3] * (1 + .6 * boonLv(id)));
const xpNeed = L => Math.round(26 * Math.pow(1.4, L - 1) + 8 * (L - 1));
function addXp(x) { G.xp += x; let n = xpNeed(G.level); while (G.xp >= n) { G.xp -= n; G.level++; G.pendingCards++; toast(`레벨 ${G.level}`); n = xpNeed(G.level); } }
// 레벨업 카드: 파티 공용 + 편성에 있는 역할별 카드. 같은 카드는 3번까지 중첩.
function cardPool() {
  const pool = [];
  pool.push({ id: 'p:dmg', name: '날 선 칼날', desc: '파티 전체 공격력 +10%', apply: G => G.bonus.atk *= 1.1 });
  pool.push({ id: 'p:hp', name: '단련', desc: '파티 전체 체력 +12%', apply: G => G.heroes.forEach(h => { h.maxhp *= 1.12; h.hp *= 1.12; }) });
  pool.push({ id: 'p:haste', name: '빠른 행군', desc: '파티 전체 공격 속도 +7%', apply: G => G.bonus.rate *= 1.07 });
  pool.push({ id: 'p:light', name: '밝은 등불', desc: '등불 반경 +15%', apply: G => {} });
  pool.push({ id: 'p:flare', name: '가득 찬 저장고', desc: '플레어 충전 +30%, 위력 +30%', apply: G => {} });
  pool.push({ id: 'p:gold', name: '약탈꾼', desc: '획득 은화 +25%', apply: G => G.bonus.gold *= 1.25 });
  const roles = [...new Set(G.heroes.map(h => h.def.role))];
  for (const r of roles) {
    const rn = G.heroes.find(h => h.def.role === r).def.roleName;
    pool.push({ id: 'a:' + r, name: `${rn} 단련`, desc: `${rn} 역할 영웅 공격력 +18%(기본 공격과 스킬)`, apply: G => G.heroes.filter(h => h.def.role === r).forEach(h => h.mul = (h.mul || 1) * 1.18) });
    pool.push({ id: 'h:' + r, name: `${rn} 강건`, desc: `${rn} 역할 영웅 체력 +25%`, apply: G => G.heroes.filter(h => h.def.role === r).forEach(h => { h.maxhp *= 1.25; h.hp *= 1.25; }) });
  }
  for (const t of [...new Set(G.heroes.map(h => h.def.skill.type))].filter(t => !['barrier', 'pull', 'aura', 'gold'].includes(t))) {
    const nm = (SKILL_DESC[t] || t).split(':')[0];
    pool.push({ id: 'sk:' + t, name: `${nm} 숙련`, desc: `'${nm}' 스킬 위력 +25%, 재사용 -10% (스킬 종류별 성장, 원작의 직업별 스킬 카드를 대체한 제 설계)`, apply: G => G.heroes.filter(h => h.def.skill.type === t).forEach(h => { h.skMul = (h.skMul || 1) * 1.25; h.skCdMul = (h.skCdMul || 1) * .9; }) });
  }
  pool.push({ id: 'p:xp', name: '배움의 불꽃', desc: '경험치 +15%', apply: G => G.bonus.xp = (G.bonus.xp || 1) * 1.15 });
  return pool.filter(c => (G.cardStack[c.id] || 0) < 3);
}
function countdown(m, secs, fn, label) {
  let t = secs, stopped = false; const el = m.querySelector('#cd');
  const iv = setInterval(() => { if (stopped) return; t--; if (el) el.textContent = `${t}초 뒤 ${label}`; if (t <= 0) { clearInterval(iv); fn(); } }, 1000);
  m.onpointerdown = () => { stopped = true; if (el) el.textContent = ''; };
  return () => { clearInterval(iv); m.onpointerdown = null; };
}
function openCards() {
  if (G.pendingCards <= 0) return; G.pendingCards--; G.paused = true;
  const pool = cardPool().sort(() => Math.random() - .5).slice(0, 3); if (!pool.length) { G.paused = false; return; }
  const m = $('modal'); m.classList.remove('hidden');
  let rec = 0, bs = -1; pool.forEach((c, i) => { const sc = (c.id.startsWith('p:') ? 1.2 : 1) + Math.random() * .8 + (/^(p:dmg|p:hp|a:)/.test(c.id) ? .3 : 0); if (sc > bs) { bs = sc; rec = i; } });
  m.innerHTML = `<h1>레벨 ${G.level}</h1><p>강화 카드를 하나 고르세요 (화면을 누르면 자동 선택이 멈춥니다)</p>` + pool.map((u, i) => `<button class="opt" data-i="${i}"><b>${u.name}${G.cardStack[u.id] ? ' (' + (G.cardStack[u.id] + 1) + '단계)' : ''}${i === rec ? ' (추천)' : ''}</b><br>${u.desc}</button>`).join('') + '<p id="cd" style="opacity:.7;font-size:12px"></p>';
  let done = false, stop = null;
  const pick = i => { if (done) return; done = true; stop(); const c = pool[i]; c.apply(G); G.cardStack[c.id] = (G.cardStack[c.id] || 0) + 1; m.classList.add('hidden'); G.paused = false; };
  stop = countdown(m, 6, () => pick(rec), '추천 카드 선택');
  m.querySelectorAll('.opt').forEach(b => b.onclick = () => pick(+b.dataset.i));
}
// 보스 뒤 위험도: 전멸 횟수, 최저 체력, 소요 시간으로 계산
function danger(next) {
  const st = G.st; let sc = st.downs * 1.4 + (st.minHp < .3 ? 2 : st.minHp < .5 ? 1 : st.minHp < .65 ? .4 : 0) + (st.t > 170 ? .6 : 0) + (next ? .5 : 0);
  return sc >= 2.2 ? ['치명적', 'DEADLY', '#ff6a5a'] : sc >= .9 ? ['위험', 'RISKY', '#ffb347'] : ['안전', 'SAFE', '#7fd37f'];
}
function stewardPush() { const d = danger(true)[1]; if (d === 'SAFE') return true; if (d === 'RISKY') return G.flames >= 2 || G.holdCount >= 2; return G.holdCount >= 3 + (3 - G.flames); }
function offerUpgrade() {
  G.waveActive = false; G.paused = true;
  let extra = G.loot.length ? '<p>' + G.loot.join('<br>') + '</p>' : '';
  if (G.wave % 5 === 0) {
    const locked = HEROES.filter(h => !save.unlocked.includes(h.id)).slice(0, 3);
    locked.forEach(h => save.unlocked.push(h.id)); persist();
    const zn = ZONES[(G.wave / 5 - 1) % 5];
    extra += `<p style="color:#ffd36b">구역 클리어: ${zn.name}.${locked.length ? '<br>영웅 해금: ' + locked.map(h => h.name).join(', ') : ''}</p>`;
  }
  const dg = danger(true), rec = stewardPush();
  const m = $('modal'); m.classList.remove('hidden');
  m.innerHTML = `<h1>스테이지 ${G.wave} 클리어</h1>${extra}<p>다음 구간 위험도: <b style="color:${dg[2]}">${dg[0]}</b> · 레벨 ${G.level}</p><button class="opt" data-go="1"><b>전진${rec ? ' (추천)' : ''}</b><br>다음 스테이지로 나아갑니다</button><button class="opt" data-go="0"><b>같은 구간 반복${rec ? '' : ' (추천)'}</b><br>경험치·은화 80%, 장비와 경험치를 더 모읍니다</button><button class="opt" id="hubOpen"><b>정비</b><br>장비, 훈련, 캠프를 조정합니다 (열면 자동 진행이 멈춥니다)</button><p id="cd" style="opacity:.7;font-size:12px"></p>`;
  let done = false, stop = null;
  const go = push => { if (done) return; done = true; stop(); m.classList.add('hidden'); G.paused = false; if (push) { G.holdCount = 0; nextWave(); } else { G.holdCount++; G.state = 'init'; beginStage(); } };
  stop = countdown(m, 7, () => go(rec), '추천 선택으로 진행');
  m.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go === '1'));
  const html = m.innerHTML, bindClear = () => { m.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go === '1')); $('hubOpen').onclick = () => { if (done) return; stop(); hubOpen = false; openHub(() => { m.innerHTML = html; bindClear(); const cd = $('cd'); if (cd) cd.textContent = ''; }); }; };
  bindClear();
}

// ---------- 저장 / 이어하기 (스테이지 시작 시점 스냅샷, 체력은 가득 채워 복원) ----------
function snapshotRun() {
  if (!G || G.over || !G.heroes.length) return;
  save.run = { v: 1, party: G.heroes.map(h => h.def.id), wave: G.wave, maxStage: G.maxStage, level: G.level, xp: G.xp, earned: G.earned, flames: G.flames, camp: { ...G.camp }, tonics: G.tonics, relics: G.relics, kills: G.kills, holdCount: G.holdCount, pendingCards: G.pendingCards, cardStack: { ...G.cardStack }, flare: G.flare, silverFrac: +(G.silverFrac || 0).toFixed(4), gear: G.heroes.map(h => h.gear || {}), train: G.heroes.map(h => ({ ...(h.tr || {}) })), bag: (G.bag || []).slice() };
  persist();
}
function restoreRun(R) {
  G.wave = Math.max(1, R.wave | 0); G.maxStage = R.maxStage | 0; G.level = R.level || 1; G.xp = R.xp || 0; G.earned = R.earned || 0;
  G.flames = R.flames || 1; G.tonics = R.tonics || 0; G.relics = R.relics || 0; G.kills = R.kills || 0; G.holdCount = R.holdCount || 0; G.pendingCards = R.pendingCards || 0;
  G.camp = { whet: 0, dress: 0, oil: 0, tonic: 0, ...R.camp };
  G.bonus.atk *= 1 + .08 * G.camp.whet;
  { const k = 1 + .08 * G.camp.dress; G.heroes.forEach(h => { h.maxhp *= k; h.hp *= k; }); }
  G.heroes.forEach((h, i) => { h.gear = R.gear[i] || {}; recalcHero(h); });
  G.silverFrac = Math.max(0, Math.min(.999, +R.silverFrac || 0)); G.bag = (R.bag || []).slice(); G.heroes.forEach((h, i) => { const t = (R.train || [])[i] || {}; for (let n = 0; n < (t.atk | 0); n++) train(h, 'atk', true); for (let n = 0; n < (t.hp | 0); n++) train(h, 'hp', true); for (let n = 0; n < (t.sk | 0); n++) train(h, 'sk', true); });
  G.cardStack = {};
  const pool = cardPool();
  for (const id in R.cardStack) { const c = pool.find(x => x.id === id); if (c) for (let n = 0; n < R.cardStack[id]; n++) c.apply(G); }
  G.cardStack = { ...R.cardStack };
  G.flare = Math.max(0, Math.min(1, +R.flare || 0));
  G.heroes.forEach(h => h.hp = h.maxhp);
}
// ---------- loop ----------
const TS = Math.max(1, parseInt(Q.get('ts') || '1', 10)); const clock = new THREE.Clock(); const tmp = new THREE.Vector3();
function faceTo(wrap, dir, dt, rate = 12) { if (dir.lengthSq() < 1e-6) return; const a = Math.atan2(dir.x, dir.z); let d = a - wrap.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); wrap.rotation.y += d * Math.min(1, dt * rate); }
// party walks as a column along the road, lantern bearer at the front
function colHome(i) { return new THREE.Vector3(2.4 - i * 2.5, 0, [-1.7, 1.3, -.2, 2, -2.1][i % 5]); }
function update(dt) {
  G.t += dt;
  // timers
  for (const t of G.timers) t.t -= dt; const due = G.timers.filter(t => t.t <= 0); G.timers = G.timers.filter(t => t.t > 0); due.forEach(t => t.fn());
  // spawning
  CEN.set(0, 0, roadZ(G.W)); stageFlow(dt); useTonic(dt);
  { G.st.t += dt; const ht = G.heroes.reduce((a, h) => a + (h.alive ? h.hp : 0), 0) / Math.max(1, G.heroes.reduce((a, h) => a + h.maxhp, 0)); if (ht < G.st.minHp) G.st.minHp = ht; if (G.pendingCards > 0 && !G.paused && (G.state === 'walk' || G.state === 'breather')) openCards(); }
  { const live = G.enemies.filter(e => e.alive);
    if (live.length) G.flare = Math.min(1, G.flare + dt * .012 * (1 + .3 * cardLv('p:flare')));
    if (!manual && G.flare >= 1 && live.length && G.heroes.some(h => h.alive)) {
      const c = lightCarrier(), inR = live.filter(e => Math.hypot(e.pos.x - c.pos.x, e.pos.z - c.pos.z) < lightRadius()).length, ph = G.heroes.reduce((a, h) => a + (h.alive ? h.hp : 0), 0) / Math.max(1, G.heroes.reduce((a, h) => a + h.maxhp, 0));
      if (inR >= Math.min(5, Math.max(3, live.length)) || (G.boss && G.boss.alive && (G.boss.swing || ph < .5)) || G.heroes.some(h => h.alive && h.hp < h.maxhp * .25)) fireFlare();
    }
    if (!G.lightMesh) { const m = new THREE.Mesh(new THREE.RingGeometry(.994, 1, 96), new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: .09, side: THREE.DoubleSide, depthWrite: false })); m.rotation.x = -Math.PI / 2; scene.add(m); G.lightMesh = m; }
    const lc = lightCarrier(); if (lc) { G.lightMesh.position.set(lc.pos.x, .06, lc.pos.z); G.lightMesh.scale.setScalar(lightRadius()); G.lightMesh.material.opacity = G.flare >= 1 ? .3 : .09; } }
  if (G.waveActive && G.spawnQ.length) { G.spawnT -= dt; if (G.spawnT <= 0) { const k = G.spawnQ.shift(); spawnEnemy(k); G.spawnT = Math.max(.25, .8 - G.wave * .02); } }
  const living = G.heroes.filter(h => h.alive);
  // heroes
  const inp = new THREE.Vector3((keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + stickVec.x, 0, (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0) + stickVec.y);
  const leader = living[0];
  const liveEn = G.enemies.filter(e => e.alive);
  for (const h of G.heroes) {
    h.atkCd -= dt; h.skCd -= dt; h.busy -= dt; h.buffT = (h.buffT || 0) - dt; h.shield = (h.shield || 0) - dt;
    if (!h.alive) {
      h.inst.mixer.update(dt); h.downT = (h.downT == null ? 20 : h.downT) - dt;
      if (h.downT <= 0 && G.state !== 'wipe' && living.length) { h.alive = true; h.hp = h.maxhp * .35; h.inst.wrap.visible = true; play(h.inst, h.clips.idle); toast(h.def.name + ' 일어납니다'); }
      continue;
    }
    if (G.S.regen) h.hp = Math.min(h.maxhp, h.hp + G.S.regen * dt);
    if (inLight(h.pos)) h.hp = Math.min(h.maxhp, h.hp + h.maxhp * Math.min(.012, .002 + .0007 * G.camp.oil) * dt);
    const d = h.def; let move = new THREE.Vector3(); let speed = d.speed * G.bonus.speed;
    const tgt = nearest(liveEn, h.pos, 30);
    if (manual && h === leader) { if (inp.lengthSq() > .01) move.copy(inp).normalize(); }
    else if (manual) { tmp.copy(leader.pos).add(new THREE.Vector3(Math.cos(h.idx * 1.3) * 2.2, 0, Math.sin(h.idx * 1.3) * 2.2 + 1)); const dd = tmp.sub(h.pos); if (dd.length() > 1.2) move.copy(dd).normalize(); }
    else if (tgt) { // delegated AI by role
      const dist = tgt.pos.distanceTo(h.pos); const hold = d.ranged || d.keep ? d.range * .7 : d.range * .8;
      const fromLantern = h.pos.distanceTo(CEN);
      if (d.keep === 'home') { const home = colHome(h.idx).add(CEN); const dd = home.sub(h.pos); if (dd.length() > .8) move.copy(dd).normalize(); }
      else if (dist > hold) move.copy(tgt.pos).sub(h.pos).setY(0).normalize();
      else if ((d.ranged || d.keep) && dist < d.range * .4) move.copy(h.pos).sub(tgt.pos).setY(0).normalize();
      if (fromLantern > 17 && move.dot(tmp.copy(h.pos).sub(CEN)) > 0) move.set(0, 0, 0);
    } else { const home = colHome(h.idx).add(CEN); const dd = home.sub(h.pos); if (dd.length() > .8) move.copy(dd).normalize(); }
    if (h.busy <= 0) { // moving
      if (move.lengthSq() > .01) { h.pos.addScaledVector(move, speed * dt); faceTo(h.inst.wrap, move, dt); play(h.inst, speed > 5 ? h.clips.run : h.clips.walk || h.clips.run, { speed: speed > 5 ? 1 : speed / 3.2 }); }
      else if (G.marching) { faceTo(h.inst.wrap, EAST, dt, 6); play(h.inst, h.clips.walk || h.clips.run, { speed: 1 }); }
      else play(h.inst, h.clips.idle);
    }
    { tmp.copy(h.pos).sub(CEN); const len = tmp.length(); if (len > ARENA - 1) h.pos.copy(CEN).addScaledVector(tmp, (ARENA - 1) / len); }
    h.inst.wrap.position.copy(h.pos);
    if (tgt && tgt.pos.distanceTo(h.pos) <= d.range) {
      tmp.copy(tgt.pos).sub(h.pos); if (h.busy > 0 || move.lengthSq() < .01) faceTo(h.inst.wrap, tmp, dt, 20);
      if (h.atkCd <= 0 && h.busy <= 0 && d.dmg > 0) heroAttack(h, tgt);
    }
    if (h.skCd <= 0 && h.busy <= .3) heroSkill(h);
    if (h.buffT > 0 && !h.buffApplied) { h.buffApplied = 1; }
    h.inst.mixer.update(dt);
  }
  // aura buff handled as flat bonus on heroes with aura role: +25% to rate while buffT>0
  // enemies
  const lp = CEN;
  for (const e of G.enemies) {
    if (!e.alive) { e.dying -= dt * 1.4; e.inst.wrap.scale.setScalar(Math.max(.001, e.dying)); e.inst.wrap.position.y = -(1 - Math.max(0, e.dying)) * .5; continue; }
    e.atkCd -= dt; e.slow = (e.slow || 0) - dt; e.hitFlash -= dt;
    const th = nearest(living, e.pos, 60); const target = th ? th.pos : lp; const dist = e.pos.distanceTo(target);
    const reach = (e.def.reach || 1.6) + (th ? 0 : 1.5);
    let sp = e.def.speed * (e.slow > 0 ? .45 : 1);
    if (dist > reach) { tmp.copy(target).sub(e.pos).setY(0).normalize(); e.pos.addScaledVector(tmp, sp * dt); faceTo(e.inst.wrap, tmp, dt, 8); play(e.inst, e.clipW, { speed: Math.max(.6, sp / e.def.animSpeed) }); }
    else {
      tmp.copy(target).sub(e.pos); faceTo(e.inst.wrap, tmp, dt, 14);
      if (e.atkCd <= 0) { e.atkCd = e.def.cd; play(e.inst, e.clipA, { loop: false, fade: .1 }); const dmg = e.dmg; const hh = th; e.swing = true; after(e.def.hitT || .4, () => { e.swing = false; if (!e.alive) return; if (hh) damageHero(hh, dmg); if (e.def.boss) ring(e.pos, 4, 0xff3b3b, .4), G.heroes.forEach(x => x.alive && x.pos.distanceTo(e.pos) < 4 && x !== hh && damageHero(x, dmg * .5)); }); }
      else if (e.inst.cur && e.inst.cur.isRunning && !e.inst.cur.isRunning()) play(e.inst, e.clipW);
    }
    e.inst.wrap.position.copy(e.pos);
    e.inst.mixer.update(dt);
  }
  // separation
  for (let i = 0; i < G.enemies.length; i++) { const a = G.enemies[i]; if (!a.alive) continue; for (let j = i + 1; j < G.enemies.length; j++) { const b = G.enemies[j]; if (!b.alive) continue; tmp.copy(a.pos).sub(b.pos); const d = tmp.length(), r = (a.def.r + b.def.r); if (d < r && d > 1e-4) { tmp.multiplyScalar((r - d) / d * .25); a.pos.add(tmp); b.pos.sub(tmp); } } }
  G.enemies = G.enemies.filter(e => e.alive || e.dying > 0 || (scene.remove(e.inst.wrap), false));
  // projectiles
  for (const p of G.proj) { if (!p.target.alive) { p.dead = true; continue; } tmp.copy(p.target.pos).setY(1); const d = tmp.clone().sub(p.mesh.position); const step = p.speed * dt; if (d.length() <= step + .3) { p.onHit(p.target); p.dead = true; } else p.mesh.position.addScaledVector(d.normalize(), step); }
  G.proj = G.proj.filter(p => { if (p.dead) scene.remove(p.mesh); return !p.dead; });
  // turrets / traps
  for (const t of G.turrets) { t.life -= dt; t.cd -= dt;
    if (t.trap) { const hit = G.enemies.find(e => e.alive && e.pos.distanceTo(t.pos) < 1.2); if (hit) { G.enemies.forEach(e => e.alive && e.pos.distanceTo(t.pos) < t.r && (damageEnemy(e, t.dmg), e.slow = 3)); ring(t.pos, t.r, 0xe67e22); t.life = 0; } }
    else if (t.cd <= 0) { const tg = nearest(G.enemies.filter(e => e.alive), t.pos, 14); if (tg) { t.cd = .6; shoot(t.pos, tg, t.dmg, 0x7fd0ff, e => damageEnemy(e, t.dmg)); } } }
  G.turrets = G.turrets.filter(t => { if (t.life <= 0) scene.remove(t.mesh); return t.life > 0; });
  // fx
  for (const f of G.fx) { f.life -= dt; const k = 1 - f.life / f.max; f.mesh.scale.setScalar(.3 + k * .7 + .01); f.mesh.material.opacity = Math.max(0, .8 * (1 - k)); }
  G.fx = G.fx.filter(f => { if (f.life <= 0) scene.remove(f.mesh); return f.life > 0; });
  if (!G.over && G.state !== 'wipe' && G.state !== 'init' && living.length === 0 && G.heroes.length) { G.state = 'wipe'; G.stT = 0; G.flames--; toast(G.flames > 0 ? '불꽃이 하나 꺼졌습니다' : '마지막 불꽃이 꺼졌습니다'); }
  // lantern glow
  const pulse = .85 + Math.sin(G.t * 3) * .1; lantern.userData.light.intensity = 110 * pulse * (.72 + .0933 * Math.max(0, G.flames));
  { const c = new THREE.Vector3(); let n = 0; living.forEach(h => { c.add(h.pos); n++; }); if (n) { c.multiplyScalar(.75 / n); c.x += PORT ? 1.5 : 3; camTarget.lerp(c, Math.min(1, dt * 3)); camera.position.copy(camTarget).add(camOff); camera.lookAt(camTarget.x, .5, camTarget.z + 1); } }
  { const rem = G.W - SZ * Math.round(G.W / SZ); world.position.x = -rem; if (grassMesh) grassMesh.position.x = -rem; const ox = G.W / SZ + .5; groundMat.map.offset.set(ox, .5); groundMat.roughnessMap.offset.set(ox, .5); }
  lantern.position.set(-1.8, 0, CEN.z); embers.position.copy(lantern.position);
  tickEmbers(G.t, dt);
  updateHUD();
}

// ---------- skill / hit effects (Effekseer runtime, CC0 effect files from the user's effekseer-ko fork; own integration code) ----------
const FX = { ctx: null, fx: {}, ok: false, lastHit: 0, lastCast: {} };
const FX_LIST = { // id: [file, load scale]
  meteor: ['nextsoft/MagicMeteo', .5], thunder: ['nextsoft/MagicThunder', .5], cold: ['nextsoft/MagicCold', .5], tornado: ['nextsoft/MagicTornade', .5], heal: ['nextsoft/MagicHeal2', .5], powerup: ['nextsoft/PowerUp', .5], slash: ['nextsoft/Sword2', .5],
  light: ['tktk/Light', .5], fireball: ['pierre-2/FireBall', .5], ember: ['pierre-2/Sword_Ember', .5], flame: ['pierre-1/Flame', .5], herald: ['pierre-1/Herald', .5], sonic: ['pierre-1/SonicBoom', .5], bolt: ['pierre-1/LightningStrike', .5],
  hit: ['tktk/ToonHit', .4], hit2: ['andrewfm/hit_eff', .4], barrier: ['effekseer-1.6/Barrior01', .5], aura: ['effekseer-1.6/Aura01', .5]
};
async function initFx() {
  try {
    if (!window.effekseer || LOWQ) return;
    await new Promise((ok, no) => window.effekseer.initRuntime('fx/effekseer.wasm', ok, () => no(new Error('fx runtime'))));
    const gl = renderer.getContext(); FX.ctx = window.effekseer.createContext(); FX.ctx.init(gl, { instanceMaxCount: 4000, squareMaxCount: 12000 });
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    await Promise.all(Object.entries(FX_LIST).map(([id, [f, sc]]) => new Promise(res => { const e = FX.ctx.loadEffect('fx/effects/' + f + '.efk', sc, () => { FX.fx[id] = e; res(); }, () => res()); })));
    FX.ok = Object.keys(FX.fx).length > 0;
  } catch (err) { console.warn('fx disabled', err); }
}
function fxPlay(id, pos, scale = 1, speed = 1, y = 0) {
  if (!FX.ok || !FX.fx[id]) return null;
  const h = FX.ctx.play(FX.fx[id], pos.x, y, pos.z); scale = Math.min(scale, 1.6); if (scale !== 1) h.setScale(scale, scale, scale); if (speed !== 1) h.setSpeed(speed); FX.n = (FX.n || 0) + 1; (FX.live = FX.live || []).push(h); return h;
}
const fxPass = { enabled: true, needsSwap: false, clear: false, renderToScreen: false, isPass: true, setSize() { }, dispose() { },
  render(r, wb, rb, delta) {
    if (!FX.ok) return; const c = FX.ctx; const dt = Math.min(delta || .016, .05);
    // 재생 중인 효과가 없으면 update/draw(GL 상태 저장 호출이 많음)를 통째로 건너뛴다
    if (FX.live && FX.live.length) FX.live = FX.live.filter(x => x.exists); if (!FX.live || !FX.live.length) return;
    c.update(dt * 60 * (G && !G.paused ? (save.speed || 1) : 0));
    r.setRenderTarget(rb); c.setProjectionMatrix(camera.projectionMatrix.elements); c.setCameraMatrix(camera.matrixWorldInverse.elements);
    const gl = r.getContext(); gl.bindVertexArray(null); gl.useProgram(null); c.draw(); r.resetState();
  } };
const SKILL_FX = { aoe: ['thunder', .6], pull: ['tornado', .7], heal: ['heal', 1.1], aura: ['powerup', 1], barrier: ['barrier', .65], dash: ['slash', .7], volley: ['fireball', .9], turret: ['flame', .8], trap: ['flame', 1] };
function fxSkill(h, sk, target) {
  const f = SKILL_FX[sk.type]; if (!f) return;
  const now = performance.now(); if (now - (FX.lastCast[h.def.id] || 0) < 400) return; FX.lastCast[h.def.id] = now;
  const onSelf = sk.type === 'heal' || sk.type === 'aura' || sk.type === 'barrier';
  if (onSelf) { if (sk.type === 'heal') G.heroes.forEach(x => x.alive && fxPlay('heal', x.pos, .7)); else fxPlay(f[0], h.pos, f[1]); }
  else if (target) fxPlay(f[0], target.pos, f[1] * (sk.type === 'aoe' ? Math.max(.8, (sk.r || 3) / 3) : 1));
  if (sk.type === 'aoe' && FX.fx.meteor && target && sk.slow) fxPlay('cold', target.pos, 1.2);
}
function fxHit(e, dmg) {
  const now = performance.now(); if (now - FX.lastHit < 90) return; FX.lastHit = now;
  fxPlay(Math.random() < .5 ? 'hit' : 'hit2', e.pos, Math.min(1.2, .6 + dmg / 200), 1.4, 1);
}

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), .05);
  if (G && !G.over && !G.paused && $('loading').classList.contains('hidden')) { const n = TS * save.speed; for (let i = 0; i < n && G && !G.over && !G.paused; i++) update(dt); }
  if (composer) composer.render(); else renderer.render(scene, camera);
}
buildWorld(0);
initFx();
if (!LOWQ) { composer = new EffectComposer(renderer); composer.setSize(innerWidth, innerHeight); composer.addPass(new RenderPass(scene, camera)); composer.addPass(fxPass); composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth / (MOBILE ? 2 : 1), innerHeight / (MOBILE ? 2 : 1)), .5, .6, .9)); composer.addPass(new OutputPass()); }
frame();
renderMenu();
window.__dbg = () => G; // dev
if (Q.get('autostart')) setTimeout(() => { manual = Q.get('mode') !== 'auto'; startGame(); }, 200);
