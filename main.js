import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { HEROES, ERA, ENEMIES, UPGRADES, CREDITS } from './data.js';

const $ = id => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const SAVE_KEY = 'riftbound.v1';
let save = { embers: 30, unlocked: ['w_medieval', 'm_king', 'w_soldier', 'w_witch', 'm_farmer', 'w_punk'], party: [], best: 0 };
try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) {}
if (Q.get('unlock')) save.unlocked = HEROES.map(h => h.id);
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} };

// ---------- renderer ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a1020);
scene.fog = new THREE.Fog(0x0a1020, 30, 80);
const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 200);
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  const portrait = camera.aspect < 0.8;
  camera.position.set(0, portrait ? 22 : 13, portrait ? 14 : 10.5);
  camera.lookAt(0, 0, 1);
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
scene.add(new THREE.HemisphereLight(0xb4c6ff, 0x3a3048, 1.6));
const moon = new THREE.DirectionalLight(0xc7d6ff, 1.4); moon.position.set(-10, 20, 8); scene.add(moon);
const ARENA = 19;
{
  const g = new THREE.Mesh(new THREE.CircleGeometry(ARENA + 14, 64), new THREE.MeshStandardMaterial({ color: 0x2b3650, roughness: 1 }));
  g.rotation.x = -Math.PI / 2; scene.add(g);
  const ring = new THREE.Mesh(new THREE.RingGeometry(ARENA - 0.2, ARENA + 0.2, 80), new THREE.MeshBasicMaterial({ color: 0x5a3b1a }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; scene.add(ring);
  // debris of three swallowed eras (primitives only): ruined wall, wrecked car, ship fragment
  const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const mats = [0x5b4a3a, 0x3e4b66, 0x5e4b7a].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: .9 }));
  for (let i = 0; i < 46; i++) {
    const a = rnd() * Math.PI * 2, r = ARENA + 2 + rnd() * 10, k = i % 3;
    const geo = k === 0 ? new THREE.BoxGeometry(2 + rnd() * 2, 1 + rnd() * 3, .8) : k === 1 ? new THREE.BoxGeometry(2.4, .9, 1.2) : new THREE.ConeGeometry(.9 + rnd(), 2 + rnd() * 3, 5);
    const m = new THREE.Mesh(geo, mats[k]); m.position.set(Math.cos(a) * r, geo.parameters.height ? geo.parameters.height / 2 : 1, Math.sin(a) * r);
    m.rotation.y = rnd() * 6; m.rotation.z = (rnd() - .5) * .5; scene.add(m);
  }
}
// lantern
const lantern = new THREE.Group();
{
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.12, .18, 3.2, 8), new THREE.MeshStandardMaterial({ color: 0x2b2b30 }));
  pole.position.y = 1.6; lantern.add(pole);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(.55, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffc766 }));
  bulb.position.y = 3.5; lantern.add(bulb);
  const light = new THREE.PointLight(0xffa03a, 90, 30, 1.6); light.position.y = 3.6; lantern.add(light);
  lantern.userData = { bulb, light };
  scene.add(lantern);
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
  root.traverse(o => { if (o.isMesh) { o.frustumCulled = false; } });
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
let manual = true;
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
function renderMenu() {
  $('meta').textContent = `보유 엠버 ${save.embers} · 최고 웨이브 ${save.best} · 해금 ${save.unlocked.length}/21`;
  const grid = $('grid'); grid.innerHTML = '';
  HEROES.forEach(h => {
    const unlocked = save.unlocked.includes(h.id);
    const d = document.createElement('div');
    d.className = `hc e-${h.era}` + (selected.includes(h.id) ? ' sel' : '') + (unlocked ? '' : ' lock');
    d.innerHTML = `<b>${h.name}</b><span class="era" style="color:${ERA[h.era].color}">${ERA[h.era].name}</span> · ${h.roleName}<br>${unlocked ? h.blurb : `🔒 ${h.cost} 엠버`}`;
    d.onclick = () => {
      if (!unlocked) { if (save.embers >= h.cost) { save.embers -= h.cost; save.unlocked.push(h.id); persist(); } else { $('preview').textContent = `엠버가 부족합니다 (${h.cost} 필요)`; return; } }
      else if (selected.includes(h.id)) selected = selected.filter(x => x !== h.id);
      else if (selected.length < 5) selected.push(h.id);
      renderMenu();
    };
    grid.appendChild(d);
  });
  const S = computeSynergy(selected);
  $('preview').innerHTML = selected.length ? (S.chips.length ? S.chips.map(c => `<span class="chip">${c}</span>`).join(' ') : '활성 시너지 없음') : '영웅을 눌러 파티에 넣으세요.';
  const b = $('startBtn'); b.disabled = selected.length < 1; b.textContent = selected.length === 5 ? '출정' : `출정 (${selected.length}/5명)`;
  $('credits').innerHTML = CREDITS;
}
$('startBtn').onclick = () => { save.party = selected.slice(); persist(); startGame(); };
$('resetBtn').onclick = () => { if (confirm('저장 데이터를 지울까요?')) { localStorage.removeItem(SAVE_KEY); location.reload(); } };

// ---------- game ----------
const ENY = {}; // enemy loaded defs
async function preloadEnemy(key) {
  const d = ENEMIES[key]; if (!d) return;
  if (!d.gltf) d.gltf = await loadModel(d.file);
}
async function startGame() {
  $('loading').classList.remove('hidden');
  if (G) cleanup();
  const S = computeSynergy(selected);
  G = { S, heroes: [], enemies: [], proj: [], fx: [], turrets: [], timers: [], wave: 0, kills: 0, earned: 0, lantern: 100, lanternMax: 100, over: false, waveActive: false, spawnQ: [], t: 0, bonus: { atk: 1, hp: 1, rate: 1, speed: 1, cdr: 1, gold: 1 }, boss: null };
  for (let i = 0; i < selected.length; i++) {
    const def = heroById[selected[i]]; const gltf = await loadModel(def.file);
    const inst = makeInstance(gltf, 1.75, 'y', 0);
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
  const startWave = parseInt(Q.get('wave') || '0', 10);
  G.wave = Math.max(0, startWave - 1);
  nextWave();
}
function cleanup() {
  [...G.heroes.map(h => h.inst.wrap), ...G.enemies.map(e => e.inst.wrap), ...G.proj.map(p => p.mesh), ...G.fx.map(f => f.mesh), ...G.turrets.map(t => t.mesh)].forEach(o => scene.remove(o));
  G = null;
}
function buildPartyUI() {
  const p = $('party'); p.innerHTML = '';
  G.heroes.forEach(h => {
    const c = document.createElement('div'); c.className = 'card'; c.style.borderColor = ERA[h.def.era].color;
    c.innerHTML = `<div class="n">${h.def.name}</div><div class="bar"><div class="hp"></div></div><div class="bar cd"><div class="cd"></div></div>`;
    h.ui = c; p.appendChild(c);
  });
  const syn = $('synergy'); syn.innerHTML = G.S.chips.map(c => `<span class="chip">${c}</span>`).join('');
}
function toast(t) { const e = $('toast'); e.textContent = t; e.style.opacity = 1; clearTimeout(toast.h); toast.h = setTimeout(() => e.style.opacity = 0, 1600); }
function updateHUD() {
  $('wave').textContent = G.wave; $('kills').textContent = G.kills; $('embers').textContent = G.earned;
  $('lanternFill').style.width = Math.max(0, G.lantern / G.lanternMax * 100) + '%';
  $('lanternTxt').textContent = `등불 ${Math.max(0, Math.ceil(G.lantern))}/${G.lanternMax}`;
  G.heroes.forEach(h => { h.ui.classList.toggle('dead', !h.alive); h.ui.querySelector('.hp').style.width = Math.max(0, h.hp / h.maxhp * 100) + '%'; const cdv = 1 - Math.max(0, h.skCd) / (h.def.skill.cd * G.S.cdr * G.bonus.cdr); h.ui.querySelector('.cd').style.width = Math.min(100, cdv * 100) + '%'; });
  $('modeBtn').textContent = manual ? '수동 (Space)' : '위임 (Space)';
  if (G.boss && G.boss.alive) { $('bossBar').classList.remove('hidden'); $('bossName').textContent = G.boss.def.name; $('bossFill').style.width = Math.max(0, G.boss.hp / G.boss.maxhp * 100) + '%'; } else $('bossBar').classList.add('hidden');
}
$('modeBtn').onclick = () => { manual = !manual; };
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
function waveComposition(w) {
  const q = [];
  const n = 5 + Math.floor(w * 2.2);
  for (let i = 0; i < n; i++) {
    const r = Math.random(); let k = 'rat';
    if (w >= 2 && r > .45) k = 'zombie';
    if (w >= 3 && r > .75) k = 'skeleton';
    q.push(k);
  }
  if (w >= 3 && w % 3 === 0) q.push('lava');
  if (w % 5 === 0) q.push(['ogre', 'trex', 'mech'][(w / 5 - 1) % 3]);
  return q;
}
async function nextWave() {
  G.wave++; G.waveActive = true;
  G.spawnQ = Q.get('force') ? Q.get('force').split(',') : waveComposition(G.wave);
  const need = [...new Set(G.spawnQ)];
  await Promise.all(need.map(preloadEnemy));
  G.spawnT = 0; G.spawnTotal = G.spawnQ.length;
  toast(G.wave % 5 === 0 ? `웨이브 ${G.wave}: 균열의 군주!` : `웨이브 ${G.wave}`);
  G.heroes.forEach(h => { if (!h.alive) { h.alive = true; h.hp = h.maxhp * .6; h.inst.wrap.visible = true; play(h.inst, h.clips.idle); } });
  updateHUD();
}
function spawnEnemy(key) {
  const d = ENEMIES[key]; const inst = makeInstance(d.gltf, d.h, d.mode || 'y', d.yaw);
  const a = Math.random() * Math.PI * 2; const SR = +(Q.get('r') || ARENA); const pos = new THREE.Vector3(Math.cos(a) * SR, 0, Math.sin(a) * SR);
  const sc = 1 + G.wave * (d.boss ? .12 : .09);
  const e = { key, def: d, inst, pos, hp: d.hp * sc, maxhp: d.hp * sc, dmg: d.dmg * (1 + G.wave * .06), atkCd: 0, alive: true, clipW: findClip(inst.clips, d.walk), clipA: findClip(inst.clips, d.atk), dying: 0, hitFlash: 0 };
  inst.wrap.position.copy(pos); scene.add(inst.wrap); play(inst, e.clipW);
  G.enemies.push(e); if (d.boss) G.boss = e; return e;
}
function nearest(list, p, maxd = 1e9) { let b = null, bd = maxd; for (const o of list) { if (o.alive === false) continue; const dd = o.pos.distanceTo(p); if (dd < bd) { bd = dd; b = o; } } return b; }
function damageEnemy(e, dmg) {
  if (!e.alive) return; e.hp -= dmg; e.hitFlash = .12;
  if (e.hp <= 0) { e.alive = false; e.dying = 1; G.kills++; const gb = 1 + G.heroes.reduce((a, h) => a + (h.alive ? (h.def.goldBonus || 0) : 0), 0); const gain = Math.ceil(e.def.reward * G.S.gold * G.bonus.gold * gb); G.earned += gain; if (e.inst.cur) e.inst.cur.paused = true; }
}
function damageHero(h, dmg) {
  if (!h.alive) return; h.hp -= dmg * G.S.taken;
  if (h.hp <= 0) { h.hp = 0; h.alive = false; play(h.inst, h.clips.die, { loop: false }); }
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
const teamAtk = h => h.def.dmg * G.bonus.atk * G.S.dmg * (h.def.ranged ? G.S.ranged : 1);

function heroAttack(h, tgt) {
  const d = h.def; const clip = h.attackClips[Math.floor(Math.random() * h.attackClips.length)];
  h.atkCd = 1 / (d.rate * G.S.rate * G.bonus.rate * (h.buffT > 0 ? 1.25 : 1)); h.busy = Math.min(.45, h.atkCd * .9);
  const a = play(h.inst, clip, { loop: false, fade: .08, speed: 1.4 });
  const crit = Math.random() < (d.crit || 0.05) ? 2 : 1;
  const dmg = teamAtk(h) * crit;
  if (d.ranged) after(.18, () => tgt.alive && shoot(h.pos, tgt, dmg, d.color, e => damageEnemy(e, dmg)));
  else after(.2, () => { if (!tgt.alive) return; damageEnemy(tgt, dmg); if (d.cleave) for (const e of G.enemies) if (e !== tgt && e.alive && e.pos.distanceTo(h.pos) < d.range + 1.2) damageEnemy(e, dmg * .5); });
}
function heroSkill(h) {
  const sk = h.def.skill; const S = G.S; let used = false;
  const live = G.enemies.filter(e => e.alive);
  const hurt = G.heroes.filter(x => x.alive && x.hp < x.maxhp * .75);
  switch (sk.type) {
    case 'barrier': if (live.some(e => e.pos.distanceTo(h.pos) < 6)) { G.heroes.forEach(x => x.shield = 4); ring(h.pos, 5, 0xffd36b); used = true; } break;
    case 'heal': if (hurt.length || G.lantern < G.lanternMax * .7) { G.heroes.forEach(x => x.alive && (x.hp = Math.min(x.maxhp, x.hp + sk.power * G.bonus.atk))); G.lantern = Math.min(G.lanternMax, G.lantern + sk.power * .4); ring(h.pos, 6, 0x58d68d); used = true; } break;
    case 'aoe': { const t = nearest(live, h.pos, 18); if (t) { const r = sk.r * S.aoe; ring(t.pos, r, sk.color || 0xb86bff, .5); const dmg = sk.power * G.bonus.atk * S.dmg; after(.25, () => G.enemies.forEach(e => e.alive && e.pos.distanceTo(t.pos) < r && (damageEnemy(e, dmg), sk.slow && (e.slow = 2.5)))); used = true; } } break;
    case 'pull': { const t = nearest(live, h.pos, 18); if (t) { ring(t.pos, sk.r * S.aoe, 0x9b6bdc, .6); G.enemies.forEach(e => { if (e.alive && !e.def.boss && e.pos.distanceTo(t.pos) < sk.r * S.aoe) { e.pos.lerp(t.pos, .8); e.slow = 3; } }); used = true; } } break;
    case 'turret': if (live.length) { const m = new THREE.Mesh(new THREE.CylinderGeometry(.35, .5, .9, 8), new THREE.MeshStandardMaterial({ color: sk.color || 0x4aa3df, emissive: sk.color || 0x4aa3df, emissiveIntensity: .4 })); const p = h.pos.clone().add(new THREE.Vector3((Math.random() - .5) * 3, 0, (Math.random() - .5) * 3)); m.position.set(p.x, .45, p.z); scene.add(m); G.turrets.push({ mesh: m, pos: p, life: 12, cd: 0, dmg: sk.power * G.bonus.atk * S.turret, blocker: sk.blocker }); used = true; } break;
    case 'trap': if (live.length) { const t = nearest(live, h.pos, 18); const m = new THREE.Mesh(new THREE.CylinderGeometry(.6, .6, .1, 12), new THREE.MeshBasicMaterial({ color: 0xe67e22 })); m.position.set(t.pos.x, .06, t.pos.z); scene.add(m); G.turrets.push({ mesh: m, pos: t.pos.clone(), life: 10, trap: true, dmg: sk.power * G.bonus.atk * S.turret, r: 3 }); used = true; } break;
    case 'volley': { const t = nearest(live, h.pos, 20); if (t) { const dmg = sk.power * G.bonus.atk * S.dmg * S.ranged; for (let i = 0; i < sk.n; i++) after(i * .08, () => { const tt = nearest(G.enemies.filter(e => e.alive), h.pos, 22); tt && shoot(h.pos, tt, dmg, h.def.color, e => damageEnemy(e, dmg)); }); used = true; } } break;
    case 'dash': { const t = nearest(live, h.pos, 20); if (t) { const dir = t.pos.clone().sub(h.pos).setY(0).normalize(); h.pos.copy(t.pos).addScaledVector(dir, -1.2); const dmg = sk.power * G.bonus.atk * S.dmg; G.enemies.forEach(e => e.alive && e.pos.distanceTo(t.pos) < 2.8 && damageEnemy(e, dmg)); ring(t.pos, 2.8, 0xff5555, .3); used = true; } } break;
    case 'aura': G.heroes.forEach(x => x.buffT = 5); ring(h.pos, 7, 0xffe08a, .8); used = !!live.length; if (used) G.bonus.atk *= 1; break;
    case 'gold': G.earned += 0; used = false; h.skCd = 9999; break;
  }
  if (used) { h.skCd = sk.cd * S.cdr * G.bonus.cdr; if (h.clips.cast && sk.type !== 'dash') { h.busy = .5; play(h.inst, h.clips.cast, { loop: false, fade: .1 }); } }
  else h.skCd = Math.min(h.skCd, 0) + .5;
}

function end(win) {
  G.over = true; const gain = G.earned; save.embers += gain; save.best = Math.max(save.best, G.wave - 1); persist();
  const m = $('modal'); m.classList.remove('hidden');
  m.innerHTML = `<h1>등불이 꺼졌습니다</h1><p>도달 웨이브 ${G.wave} · 처치 ${G.kills} · 획득 엠버 ${gain}</p><button class="mbtn" id="again">다시 출정</button><br><button class="ghost" id="tomenu">영웅 선택으로</button>`;
  $('again').onclick = () => startGame(); $('tomenu').onclick = () => { m.classList.add('hidden'); $('hud').classList.add('hidden'); $('menu').classList.remove('hidden'); cleanup(); renderMenu(); };
}
function offerUpgrade() {
  G.waveActive = false; G.paused = true;
  const pool = [...UPGRADES].sort(() => Math.random() - .5).slice(0, 3);
  const m = $('modal'); m.classList.remove('hidden');
  m.innerHTML = `<h1>웨이브 ${G.wave} 클리어</h1><p>강화를 하나 고르세요</p>` + pool.map((u, i) => `<button class="opt" data-i="${i}"><b>${u.name}</b><br>${u.desc}</button>`).join('');
  m.querySelectorAll('.opt').forEach(b => b.onclick = () => { pool[+b.dataset.i].apply(G); m.classList.add('hidden'); G.paused = false; nextWave(); });
}

// ---------- loop ----------
const TS = Math.max(1, parseInt(Q.get('ts') || '1', 10)); const clock = new THREE.Clock(); const tmp = new THREE.Vector3();
function faceTo(wrap, dir, dt, rate = 12) { if (dir.lengthSq() < 1e-6) return; const a = Math.atan2(dir.x, dir.z); let d = a - wrap.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); wrap.rotation.y += d * Math.min(1, dt * rate); }
function update(dt) {
  G.t += dt;
  // timers
  for (const t of G.timers) t.t -= dt; const due = G.timers.filter(t => t.t <= 0); G.timers = G.timers.filter(t => t.t > 0); due.forEach(t => t.fn());
  // spawning
  if (G.waveActive && G.spawnQ.length) { G.spawnT -= dt; if (G.spawnT <= 0) { const k = G.spawnQ.shift(); spawnEnemy(k); G.spawnT = Math.max(.25, 1.1 - G.wave * .03); } }
  const living = G.heroes.filter(h => h.alive);
  // heroes
  const inp = new THREE.Vector3((keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + stickVec.x, 0, (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0) + stickVec.y);
  const leader = living[0];
  const liveEn = G.enemies.filter(e => e.alive);
  for (const h of G.heroes) {
    h.atkCd -= dt; h.skCd -= dt; h.busy -= dt; h.buffT = (h.buffT || 0) - dt; h.shield = (h.shield || 0) - dt;
    if (!h.alive) { h.inst.mixer.update(dt); continue; }
    if (G.S.regen) h.hp = Math.min(h.maxhp, h.hp + G.S.regen * dt);
    const d = h.def; let move = new THREE.Vector3(); let speed = d.speed * G.bonus.speed;
    const tgt = nearest(liveEn, h.pos, 30);
    if (manual && h === leader) { if (inp.lengthSq() > .01) move.copy(inp).normalize(); }
    else if (manual) { tmp.copy(leader.pos).add(new THREE.Vector3(Math.cos(h.idx * 1.3) * 2.2, 0, Math.sin(h.idx * 1.3) * 2.2 + 1)); const dd = tmp.sub(h.pos); if (dd.length() > 1.2) move.copy(dd).normalize(); }
    else if (tgt) { // delegated AI by role
      const dist = tgt.pos.distanceTo(h.pos); const hold = d.ranged || d.keep ? d.range * .7 : d.range * .8;
      const fromLantern = h.pos.length();
      if (d.keep === 'home') { const home = new THREE.Vector3(Math.cos(h.idx * 1.26) * 3.5, 0, Math.sin(h.idx * 1.26) * 3.5); const dd = home.sub(h.pos); if (dd.length() > .8) move.copy(dd).normalize(); }
      else if (dist > hold) move.copy(tgt.pos).sub(h.pos).setY(0).normalize();
      else if ((d.ranged || d.keep) && dist < d.range * .4) move.copy(h.pos).sub(tgt.pos).setY(0).normalize();
      if (fromLantern > 17 && move.dot(h.pos) > 0) move.set(0, 0, 0);
    } else { const home = new THREE.Vector3(Math.cos(h.idx * 1.26) * 4, 0, Math.sin(h.idx * 1.26) * 4 + 1); const dd = home.sub(h.pos); if (dd.length() > .8) move.copy(dd).normalize(); }
    if (h.busy <= 0) { // moving
      if (move.lengthSq() > .01) { h.pos.addScaledVector(move, speed * dt); faceTo(h.inst.wrap, move, dt); play(h.inst, speed > 5 ? h.clips.run : h.clips.walk || h.clips.run, { speed: speed > 5 ? 1 : speed / 3.2 }); }
      else play(h.inst, h.clips.idle);
    }
    const len = h.pos.length(); if (len > ARENA - 1) h.pos.multiplyScalar((ARENA - 1) / len);
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
  const lp = new THREE.Vector3(0, 0, 0);
  for (const e of G.enemies) {
    if (!e.alive) { e.dying -= dt * 1.4; e.inst.wrap.scale.setScalar(Math.max(.001, e.dying)); e.inst.wrap.position.y = -(1 - Math.max(0, e.dying)) * .5; continue; }
    e.atkCd -= dt; e.slow = (e.slow || 0) - dt; e.hitFlash -= dt;
    const th = nearest(living, e.pos, 6); const target = th ? th.pos : lp; const dist = e.pos.distanceTo(target);
    const reach = (e.def.reach || 1.6) + (th ? 0 : 1.5);
    let sp = e.def.speed * (e.slow > 0 ? .45 : 1);
    if (dist > reach) { tmp.copy(target).sub(e.pos).setY(0).normalize(); e.pos.addScaledVector(tmp, sp * dt); faceTo(e.inst.wrap, tmp, dt, 8); play(e.inst, e.clipW, { speed: Math.max(.6, sp / e.def.animSpeed) }); }
    else {
      tmp.copy(target).sub(e.pos); faceTo(e.inst.wrap, tmp, dt, 14);
      if (e.atkCd <= 0) { e.atkCd = e.def.cd; play(e.inst, e.clipA, { loop: false, fade: .1 }); const dmg = e.dmg; const hh = th; after(e.def.hitT || .4, () => { if (!e.alive) return; if (hh) damageHero(hh, dmg); else { G.lantern -= dmg * .5; if (G.lantern <= 0 && !G.over) end(); } if (e.def.boss) ring(e.pos, 4, 0xff3b3b, .4), G.heroes.forEach(x => x.alive && x.pos.distanceTo(e.pos) < 4 && x !== hh && damageHero(x, dmg * .5)); }); }
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
  // wave end
  if (G.waveActive && !G.spawnQ.length && G.enemies.every(e => !e.alive) && !G.over) { G.boss = null; offerUpgrade(); }
  if (!G.over && living.length === 0 && G.heroes.length) end();
  // lantern glow
  const pulse = .85 + Math.sin(G.t * 3) * .1; lantern.userData.light.intensity = 90 * pulse * (.5 + .5 * Math.max(0, G.lantern) / G.lanternMax);
  updateHUD();
}
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), .05);
  if (G && !G.over && !G.paused && $('loading').classList.contains('hidden')) { const n = TS; for (let i = 0; i < n && G && !G.over && !G.paused; i++) update(dt); }
  renderer.render(scene, camera);
}
frame();
renderMenu();
window.__dbg = () => G; // dev
if (Q.get('autostart')) setTimeout(() => { manual = Q.get('mode') !== 'auto'; startGame(); }, 200);
