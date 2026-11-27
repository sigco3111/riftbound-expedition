export const ERA = {
  medieval: { name: '중세', color: '#d99a4e' },
  modern: { name: '현대', color: '#5cb3ee' },
  space: { name: '우주', color: '#a77be8' },
};
const H = (id, name, file, era, role, roleName, blurb, cost, s, skill) => ({ id, name, file: 'assets/heroes/' + file, era, role, roleName, blurb, cost, ...s, skill });
// stats: hp, dmg (per hit), rate (attacks/s), range, speed, ranged, keep, crit, cleave, anim, color
export const HEROES = [
  // ---- medieval (7)
  H('w_medieval', '등불 기사', 'w_medieval.gltf', 'medieval', 'tank', '탱커', '전열에서 베고 방벽을 세운다', 0, { hp: 260, dmg: 16, rate: 1.1, range: 2.2, speed: 4.2, cleave: 1, anim: ['melee'], color: 0xffd36b }, { type: 'barrier', cd: 12 }),
  H('m_king', '잿빛 왕', 'm_king.glb', 'medieval', 'aura', '지휘관', '오라로 파티를 강화한다', 0, { hp: 200, dmg: 14, rate: 1.0, range: 2.2, speed: 4, anim: ['melee'], color: 0xffe08a }, { type: 'aura', cd: 10 }),
  H('w_adventurer', '여행자 리나', 'w_adventurer.gltf', 'medieval', 'duelist', '기동 딜러', '돌진하며 연타한다', 30, { hp: 150, dmg: 13, rate: 1.7, range: 2, speed: 6, crit: .15, anim: ['melee', 'kick'], color: 0xffa54a }, { type: 'dash', cd: 8, power: 55 }),
  H('m_adventurer', '탐험가 카일', 'm_adventurer.glb', 'medieval', 'trapper', '함정꾼', '지뢰형 함정을 깐다', 30, { hp: 160, dmg: 10, rate: 1.3, range: 2.2, speed: 5, anim: ['punch', 'kick'], color: 0xe67e22 }, { type: 'trap', cd: 7, power: 70 }),
  H('m_farmer', '농부 토마스', 'm_farmer.glb', 'medieval', 'support', '치유사', '수확의 힘으로 파티와 등불을 회복', 0, { hp: 170, dmg: 0, rate: 1, range: 6, speed: 4, keep: 'home', anim: ['cast'], color: 0x58d68d }, { type: 'heal', cd: 8, power: 45 }),
  H('w_soldier', '석궁병 미라', 'w_soldier.gltf', 'medieval', 'gunner', '사수', '중거리에서 쏜다', 0, { hp: 140, dmg: 15, rate: 1.4, range: 11, speed: 4.4, ranged: 1, anim: ['gun'], color: 0xffd9a0 }, { type: 'volley', cd: 9, power: 12, n: 6 }),
  H('w_witch', '그늘 마녀', 'w_witch.gltf', 'medieval', 'caster', '마법', '범위 마법으로 적을 약화', 30, { hp: 120, dmg: 12, rate: .9, range: 12, speed: 4, ranged: 1, keep: 1, anim: ['cast'], color: 0xb86bff }, { type: 'aoe', cd: 6, power: 70, r: 4, slow: 1, color: 0xb86bff }),
  // ---- modern (9)
  H('w_punk', '펑크 제이', 'w_punk.gltf', 'modern', 'brawler', '격투가', '펀치와 킥 콤보', 0, { hp: 190, dmg: 9, rate: 2.2, range: 1.9, speed: 5.4, crit: .1, anim: ['punch', 'kick'], color: 0xff5ea8 }, { type: 'dash', cd: 9, power: 45 }),
  H('m_punk', '반격 맥스', 'm_punk.glb', 'modern', 'tank', '반격형', '맞으면서 되받아친다', 40, { hp: 240, dmg: 14, rate: 1.4, range: 2, speed: 4.6, cleave: 1, anim: ['punch', 'kick'], color: 0xff7a5e }, { type: 'barrier', cd: 14 }),
  H('w_casual', '단검 유나', 'w_casual.gltf', 'modern', 'duelist', '보조 딜러', '재빠른 단검 공격', 40, { hp: 130, dmg: 11, rate: 1.9, range: 1.9, speed: 6.2, crit: .2, anim: ['punch', 'melee'], color: 0x8fe0ff }, { type: 'dash', cd: 7, power: 50 }),
  H('m_casual', '정찰병 데니', 'm_casual.glb', 'modern', 'support', '정찰/버프', '이동과 시야를 돕고 버프', 40, { hp: 140, dmg: 8, rate: 1.4, range: 2, speed: 6.5, anim: ['punch'], color: 0x9be8c8 }, { type: 'aura', cd: 11 }),
  H('m_hoodie', '후드 암살자', 'm_hoodie.glb', 'modern', 'assassin', '암살자', '치명타 위주의 킥', 50, { hp: 120, dmg: 20, rate: 1.5, range: 1.9, speed: 6.4, crit: .35, anim: ['kick'], color: 0xd0d0ff }, { type: 'dash', cd: 6, power: 80 }),
  H('m_swat', '진압대원 렉스', 'm_swat.glb', 'modern', 'gunner', '제압 사수', '탱커처럼 버티며 쏜다', 50, { hp: 230, dmg: 12, rate: 1.8, range: 9, speed: 4.4, ranged: 1, anim: ['gun'], color: 0x7fb3ff }, { type: 'volley', cd: 8, power: 14, n: 8 }),
  H('w_worker', '정비사 하나', 'w_worker.gltf', 'modern', 'engineer', '포탑공', '포탑을 설치한다', 40, { hp: 150, dmg: 6, rate: 1.2, range: 2.2, speed: 4.4, anim: ['punch'], color: 0x4aa3df }, { type: 'turret', cd: 9, power: 14 }),
  H('m_worker', '건설공 보', 'm_worker.glb', 'modern', 'engineer', '방벽공', '바리케이드형 포탑 설치', 40, { hp: 220, dmg: 10, rate: 1, range: 2.2, speed: 4, anim: ['punch'], color: 0xf1c40f }, { type: 'turret', cd: 10, power: 10, color: 0xf1c40f }),
  H('m_beach', '해변 한량 쥰', 'm_beach.glb', 'modern', 'wild', '변칙 딜러', '랜덤한 큰 한 방', 30, { hp: 150, dmg: 12, rate: 1.4, range: 2, speed: 5, crit: .3, anim: ['kick', 'punch'], color: 0xffd23f }, { type: 'dash', cd: 8, power: 90 }),
  // ---- space (5)
  H('w_scifi', '레이저 사수 노바', 'w_scifi.gltf', 'space', 'gunner', '레이저 사수', '관통형 레이저 사격', 40, { hp: 130, dmg: 16, rate: 1.5, range: 12, speed: 4.6, ranged: 1, keep: 1, anim: ['gun'], color: 0x6bf0ff }, { type: 'volley', cd: 8, power: 20, n: 5 }),
  H('m_astronaut', '중력 비행사', 'm_astronaut.glb', 'space', 'control', '제어', '적을 끌어당기고 늦춘다', 50, { hp: 170, dmg: 9, rate: 1.1, range: 10, speed: 4.2, ranged: 1, keep: 1, anim: ['cast'], color: 0x9b6bdc }, { type: 'pull', cd: 9, r: 5 }),
  H('w_formal', '전략가 세라', 'w_formal.gltf', 'space', 'aura', '전략가', '파티를 가속시킨다', 50, { hp: 140, dmg: 0, rate: 1, range: 6, speed: 4, keep: 'home', anim: ['wave'], color: 0xc9a7ff }, { type: 'aura', cd: 9 }),
  H('w_suit', '회계관 비올라', 'w_suit.gltf', 'space', 'support', '보급가', '파티를 회복시킨다', 50, { hp: 140, dmg: 0, rate: 1, range: 6, speed: 4, keep: 'home', anim: ['wave'], color: 0x7de3b0 }, { type: 'heal', cd: 10, power: 35 }),
  H('m_business', '거래인 해리', 'm_business.glb', 'space', 'wild', '경제형', '전투 보상으로 엠버를 더 번다', 50, { hp: 160, dmg: 11, rate: 1.2, range: 2, speed: 4.4, anim: ['punch', 'kick'], color: 0xe6c200, goldBonus: .25 }, { type: 'dash', cd: 9, power: 40 }),
];

export const ENEMIES = {
  rat: { name: '심연 쥐', file: 'assets/enemies/rat.glb', h: 1.3, mode: 'max', yaw: 0, hp: 22, dmg: 4, speed: 4.2, animSpeed: 4.2, cd: 1.0, hitT: .25, reward: 1, r: .6, reach: 1.1, walk: /^Walk$/, atk: /^Attack\.001$/ },
  zombie: { name: '감염자', file: 'assets/enemies/zombie-quaternius-ccby3.glb', h: 1.8, yaw: 0, hp: 60, dmg: 7, speed: 1.9, animSpeed: 1.9, cd: 1.3, hitT: .4, reward: 2, r: .7, walk: /ZombieWalk$/, atk: /ZombieBite$/ },
  skeleton: { name: '해골 무법자', file: 'assets/enemies/skeleton-outlaw.glb', h: 1.8, yaw: 0, hp: 48, dmg: 9, speed: 2.6, animSpeed: 2.6, cd: 1.1, hitT: .4, reward: 3, r: .7, walk: /^walk$/, atk: /^attack_1$/ },
  lava: { name: '용암 골렘', file: 'assets/enemies/lava-golem.glb', h: 3.2, yaw: 0, hp: 520, dmg: 26, speed: 1.6, animSpeed: 1.6, cd: 1.8, hitT: .6, reward: 15, r: 1.4, reach: 2.4, walk: /^walk$/, atk: /^smash$/ },
  ogre: { name: '균열 오우거', file: 'assets/enemies/anymove-ogre.glb', h: 4, yaw: 0, hp: 2600, dmg: 38, speed: 1.5, animSpeed: 1.5, cd: 2.0, hitT: .7, reward: 80, r: 1.8, reach: 3, boss: true, walk: /^Walk$/, atk: /^Attack$/ },
  trex: { name: '심연 티렉스', file: 'assets/enemies/anymove-trex.glb', h: 4.2, yaw: 0, hp: 3600, dmg: 46, speed: 1.9, animSpeed: 1.9, cd: 2.0, hitT: .7, reward: 110, r: 2, reach: 3.2, boss: true, walk: /^Walk$/, atk: /^Attack$/ },
  mech: { name: '폐허 메카', file: 'assets/enemies/anymove-mech.glb', h: 4.6, yaw: 0, hp: 5200, dmg: 55, speed: 1.4, animSpeed: 1.4, cd: 2.2, hitT: .8, reward: 150, r: 2.2, reach: 3.4, boss: true, walk: /^Walk$/, atk: /^Attack$/ },
};

export const UPGRADES = [
  { name: '날 선 의지', desc: '파티 공격력 +15%', apply: G => G.bonus.atk *= 1.15 },
  { name: '단단한 결의', desc: '파티 최대 체력 +20%, 전원 회복', apply: G => G.heroes.forEach(h => { h.maxhp *= 1.2; h.hp = h.maxhp; }) },
  { name: '등불 수선', desc: '등불 최대치 +30, 등불 완전 회복', apply: G => { G.lanternMax += 30; G.lantern = G.lanternMax; } },
  { name: '빠른 손', desc: '파티 공격 속도 +12%', apply: G => G.bonus.rate *= 1.12 },
  { name: '가벼운 발', desc: '이동 속도 +12%', apply: G => G.bonus.speed *= 1.12 },
  { name: '집중', desc: '스킬 쿨다운 -12%', apply: G => G.bonus.cdr *= .88 },
  { name: '엠버 수확', desc: '획득 엠버 +25%', apply: G => G.bonus.gold *= 1.25 },
  { name: '응급 처치', desc: '파티 전원 체력 60% 회복, 쓰러진 영웅 부활', apply: G => G.heroes.forEach(h => { h.alive = true; h.inst.wrap.visible = true; h.hp = Math.max(h.hp, h.maxhp * .6); }) },
];

export const CREDITS = `
<p>코드: 이 저장소의 자체 제작 코드. three.js (MIT, lib/THREE_LICENSE.txt).</p>
<p>영웅 21종: Quaternius, Ultimate Modular Men Pack / Ultimate Modular Women Pack (CC0 1.0).</p>
<p>적: 쥐 Evil Giant Rat (CC0, OpenGameArt), 용암 골렘 Lava Golem (CC0, OpenGameArt), 해골 무법자 Skeleton Outlaw (CC0, OpenGameArt), 오우거/티렉스/메카 anymove (CC0, patch.gg).</p>
<p>감염자(좀비): Quaternius Animated Zombie, CC BY 3.0, 출처 표기: Quaternius (https://poly.pizza/m/jkrEvQZb8J).</p>
<p>상세 출처와 라이선스는 저장소의 CREDITS.md 참고.</p>`;
