/* Grease & Gold: World Tour - game logic (fixed 60Hz). Rendering/UI lives in ui.js. */
(function (G) {
'use strict';
const S = G.Sprites, I = G.Input, A = G.Audio, GW = G.GW, FT = G.FLOOR_TOP, FB = G.FLOOR_BOT;
const GS = S.GS; /* sprites are GS x bigger than the original tuning: reach/height/stride scale with them */
const GRAV = .24, JUMPV = 4.7, WALK = 1.5, WALKY = 1.0, DRAIN = .28; /* HYPE drain per tick while a special is held (~17/s) */
G.CONST = { GRAV, JUMPV, WALK, WALKY, DRAIN };
if (typeof document !== 'undefined' && !G.makeCanvas) G.makeCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

/* ---------- data ---------- */
const bx = (x0, x1, d, z0, z1) => ({ x0, x1, d, z0, z1 });
G.CH = {
  ricky: { name: 'Ricky B', kit: 'ricky', hp: 100, spd: 1.5, rate: 1.0, weapon: 'Turkish flag & pole', special: 'Flag Wave', blurb: 'Balanced. Long pole thrusts|and wide sweeps.', stats: { power: 3, speed: 3, reach: 5, health: 3 },
    moves: [{ hit: [1, 2], box: bx(6, 52, 9, 8, 48), dmg: 5, kb: .7, stun: 15, hs: 3, hype: 5 }, { hit: [1, 2], box: bx(0, 52, 18, 6, 56), dmg: 6, kb: .9, stun: 16, hs: 3, hype: 5 }, { hit: [2, 3], box: bx(6, 46, 13, 0, 58), dmg: 10, kb: 3, knock: true, launch: 2.8, hs: 7, hype: 8 }],
    spec: { pulse: 10, box: bx(-14, 62, 16, 0, 62), dmg: 3, kb: .9, stun: 14, hs: 2, knockEvery: 4, omni: false } },
  vv: { name: 'V.V.', kit: 'vv', hp: 90, spd: 1.68, rate: 1.16, weapon: 'Vintage mic & cord', special: 'Mic Drop', blurb: 'Fast striker. The cord whip|reaches farthest.', stats: { power: 2, speed: 5, reach: 4, health: 2 },
    moves: [{ hit: [1, 2], box: bx(2, 44, 10, 10, 52), dmg: 4, kb: .6, stun: 14, hs: 3, hype: 5 }, { hit: [2], box: bx(4, 52, 11, 12, 50), dmg: 5, kb: .9, stun: 16, hs: 3, hype: 5 }, { hit: [2, 3], box: bx(0, 44, 12, 0, 58), dmg: 8, kb: 3, knock: true, launch: 2.6, hs: 7, hype: 8 }],
    spec: { pulse: 12, box: bx(-54, 54, 18, 0, 58), dmg: 3, kb: 1, stun: 14, hs: 2, knockEvery: 3, omni: true } },
  johnny: { name: 'Johnny $', kit: 'johnny', hp: 118, spd: 1.36, rate: .9, weapon: 'Giant salami', special: 'Salami Slam', blurb: 'Heavy hitter. Slow, big arcs,|huge knockback.', stats: { power: 5, speed: 2, reach: 3, health: 5 },
    moves: [{ hit: [1, 2], box: bx(4, 48, 12, 8, 50), dmg: 6, kb: .8, stun: 17, hs: 4, hype: 5 }, { hit: [1, 2], box: bx(0, 50, 15, 6, 54), dmg: 7, kb: 1.1, stun: 18, hs: 4, hype: 5 }, { hit: [2, 3], box: bx(4, 50, 14, 0, 60), dmg: 12, kb: 3.6, knock: true, launch: 3.2, hs: 8, hype: 9 }],
    spec: { pulse: 12, box: bx(-4, 52, 16, 0, 60), dmg: 4, kb: 1.2, stun: 14, hs: 2, knockEvery: 3, omni: false } }
};
const JATK = { box: bx(0, 42, 14, -8, 50), dmg: 5, kb: 1, stun: 14, hs: 3, hype: 4 };
const JDOWN = { box: bx(-4, 30, 14, -46, 12), dmg: 7, kb: 2, stun: 18, hs: 4, hype: 5, knock: true, launch: 2 };
const GSTRIKE = [{ dmg: 4, kb: .4, stun: 24, hs: 3, hype: 4 }, { dmg: 4, kb: .4, stun: 24, hs: 3, hype: 4 }, { dmg: 7, kb: 3, knock: true, launch: 2.4, hs: 6, hype: 6 }];
const THROWMV = { dmg: 10, kb: 0, knock: true, hs: 5, hype: 6 };
const THROWHIT = { dmg: 8, kb: 2, knock: true, launch: 2.2, hs: 4, hype: 0 };
G.MV = { JATK, JDOWN, GSTRIKE, THROWMV, THROWHIT };
G.FOOD = { adana: { heal: 25, name: 'Adana Kebab' }, shish: { heal: 30, name: 'Shish Kebab' }, doner: { heal: 45, name: 'Doner Plate' }, lahmacun: { heal: 20, name: 'Lahmacun' }, kunefe: { heal: 15, name: 'Kunefe' }, spit: { heal: 80, name: 'Doner Spit' } };
const DROPS = ['adana', 'adana', 'adana', 'shish', 'shish', 'lahmacun', 'lahmacun', 'kunefe', 'doner'];

const EM = {
  punch: { anim: 'a1', windup: 20, hit: [1, 2], box: bx(4, 32, 10, 6, 50), dmg: 6, kb: 1.6, stun: 16, hs: 3, cool: 55, engage: 28 },
  kick: { anim: 'a2', windup: 26, hit: [1, 2], box: bx(4, 42, 10, 2, 38), dmg: 7, kb: 2, stun: 18, hs: 3, cool: 60, engage: 36 },
  jab: { anim: 'a1', windup: 9, hit: [1, 2], box: bx(4, 30, 10, 6, 50), dmg: 4, kb: 1.2, stun: 12, hs: 2, cool: 10, engage: 26, chain: 'kick2' },
  kick2: { anim: 'a2', windup: 8, hit: [1, 2], box: bx(4, 42, 10, 2, 38), dmg: 6, kb: 2, stun: 16, hs: 3, cool: 48, engage: 36 },
  baton: { anim: 'a1', windup: 18, hit: [1, 2], box: bx(4, 48, 11, 6, 52), dmg: 7, kb: 1.8, stun: 17, hs: 3, cool: 58, engage: 40 },
  hook: { anim: 'a1', windup: 28, hit: [1, 2], box: bx(4, 36, 12, 4, 54), dmg: 9, kb: 2.4, stun: 20, hs: 4, cool: 70, engage: 32, armor: true },
  smash: { anim: 'a3', windup: 36, hit: [2, 3], box: bx(2, 46, 14, 0, 66), dmg: 12, kb: 3, knock: true, launch: 2.6, hs: 7, cool: 85, engage: 38, armor: true },
  throw: { anim: 'a2', windup: 22, hit: [1], kind: 'ranged', count: 1, dmg: 6, cool: 100, engage: 90 },
  volley: { anim: 'a2', windup: 18, hit: [1], kind: 'ranged', count: 3, dmg: 6, cool: 110, engage: 90 },
  charge: { anim: 'a1', windup: 40, kind: 'charge', dur: 46, speed: 3.2, box: bx(-8, 32, 12, 0, 56), dmg: 14, kb: 3.4, knock: true, launch: 2.6, hs: 7, cool: 90, engage: 130, armor: true },
  summon: { anim: 'a3', windup: 70, kind: 'summon', hit: [], dmg: 0, cool: 200, engage: 999, armor: true }
};
G.EM = EM;
G.ED = {
  guard: { kit: 'guard', name: 'Jooce', hp: 34, spd: 1.05, moves: ['baton', 'kick'], score: 100 },
  exec: { kit: 'exec', name: 'OJ Jooce', hp: 30, spd: 1.2, moves: ['punch', 'kick'], score: 120 },
  heavy: { kit: 'heavy', name: 'Big Business', hp: 84, spd: .8, moves: ['hook', 'smash'], poise: 26, hw: 15, grabEscape: 100, score: 300 },
  brawler: { kit: 'brawler', name: 'Street Hobo', hp: 28, spd: 1.45, moves: ['jab', 'kick'], score: 100 },
  raider: { kit: 'raider', name: 'Turd', hp: 36, spd: 1.25, moves: ['baton', 'throw'], score: 140 },
  ledger: { kit: 'ledger', name: 'The Ledger', hp: 190, spd: 1.2, boss: true, poise: 34, moves: ['punch', 'kick', 'smash', 'charge'], grabEscape: 60, score: 2000 },
  bigtony: { kit: 'bigtony', name: 'Big Tony', hp: 300, spd: .95, boss: true, poise: 64, hw: 10, moves: ['hook', 'smash', 'charge'], grabEscape: 50, score: 3000 },
  mara: { kit: 'mara', name: 'Dusty Mara', hp: 230, spd: 1.7, boss: true, poise: 34, retreat: true, moves: ['baton', 'baton', 'volley'], grabEscape: 55, score: 3500 },
  auditor: { kit: 'auditor', name: 'The Auditor', hp: 350, spd: 1.35, boss: true, poise: 40, summonAt: .5, moves: ['baton', 'kick', 'smash', 'charge'], grabEscape: 55, score: 6000 }
};
G.ED.auditor.moves = ['punch', 'kick', 'smash', 'charge'];
(function applyScale() { const sb = (b) => { b.x0 *= GS; b.x1 *= GS; b.z0 *= GS; b.z1 *= GS; };
  Object.values(G.CH).forEach(c => { c.moves.forEach(m => sb(m.box)); sb(c.spec.box); }); sb(JATK.box); sb(JDOWN.box);
  Object.values(EM).forEach(m => { if (m.box) sb(m.box); if (m.engage && m.engage < 900) m.engage *= GS; }); })();
G.CONST.GS = GS;

/* ---------- helpers ---------- */
const sgn = (v) => v < 0 ? -1 : 1, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = (a, b) => a + Math.random() * (b - a);
function setAnim(e, a) { if (e.anim !== a) { e.anim = a; e.frame = 0; e.ft = 0; e.done = false; } }
function restartAnim(e, a) { e.anim = a; e.frame = 0; e.ft = 0; e.done = false; }
function advance(e, loop, rate) { const T = S.TIMING[e.anim]; e.ft += (rate || 1); while (e.ft >= T[e.frame]) { e.ft -= T[e.frame]; e.frame++; if (e.frame >= T.length) { if (loop) e.frame = 0; else { e.frame = T.length - 1; e.done = true; e.ft = 0; break; } } } }
G.anim = { setAnim, restartAnim, advance };

class Game {
  constructor(opts) {
    opts = opts || {};
    this.state = 'title'; this.sel = 0; this.menu = 0; this.t = 0; this.godMode = !!opts.godMode;
    this.sheets = null; this.stageIdx = 0; this.best = 0;
    this.resetWorld();
  }
  resetWorld() {
    this.players = []; this.enemies = []; this.props = []; this.items = []; this.projs = []; this.parts = []; this.spawnQ = [];
    this.hitstop = 0; this.shake = 0; this.cam = { x: 0, max: 0 }; this.waveIdx = 0; this.waveState = 'walk'; this.banner = 0; this.goT = 0; this.clearT = 0; this.combo = { n: 0, t: 0 }; this.lastEnemy = null; this.lastEnemyT = 0; this.tick = 0; this.flashT = 0;
  }
  /* ----- run / stage flow ----- */
  beginRun(id) { this.state = 'loading'; this.loadWait = 0; this.pending = () => this.startRun(id); }
  beginStage(i) { this.state = 'loading'; this.loadWait = 0; this.pending = () => this.startStage(i); }
  startRun(charId) { this.charId = charId; this.lives = 3; this.score = 0; this.carry = null; this.startStage(0); }
  startStage(i) {
    const st = G.STAGES[i]; if (this.ensureAssets) this.ensureAssets(i); if (G.Music) G.Music.play(st.music || 'arcade'); this.stageIdx = i; this.stage = st; const keep = this.players[0];
    this.resetWorld(); const p = this.makePlayer(this.charId);
    if (this.carry) { p.hp = Math.min(p.maxhp, Math.max(this.carry.hp, p.maxhp * .5)); p.hype = Math.max(25, this.carry.hype); }
    p.lives = this.lives; this.players = [p];
    st.props.forEach(q => this.props.push({ kind: 'prop', type: q[0], x: q[1], y: q[2], z: 0, hp: q[0] === 'barrel' || q[0] === 'bin' ? 3 : 4, hw: 12, hd: 9, ht: 26, shake: 0 }));
    this.banner = 170; this.state = 'play'; this.stageT = 0; this.cam.max = st.waves[0].x; this.bossDef = null; this.cam.x = 0;
    if (this.sheets) this.bgs = this.bgs || {}; if (this.buildBg) this.buildBg(i);
  }
  makePlayer(id) {
    const def = G.CH[id], kit = S.K[def.kit];
    return { kind: 'fighter', team: 'p', id, def, kitId: def.kit, x: 70, y: 172, z: 0, vx: 0, vy: 0, vz: 0, face: 1, hp: def.hp, maxhp: def.hp, hype: 30, state: 'idle', anim: 'idle', frame: 0, ft: 0, phase: 0, hw: 11 * kit.scale, hd: 7, ht: 56 * kit.scale, stride: (kit.strideMul || 40) * kit.scale, runStride: 56 * kit.scale, invuln: 90, flash: 0, hitChain: 0, chainT: 0, comboTimer: 0, nextStep: 0, step: 0, hitSet: new Set(), rate: def.rate, spT: 0, pulses: 0, held: null, grabT: 0, gcount: 0, downT: 0, deadT: 0 };
  }
  makeEnemy(type, x, y) {
    const d = G.ED[type], kit = S.K[d.kit], hp = d.hp;
    return { kind: 'fighter', team: 'e', uid: (G._uid = (G._uid || 0) + 1), type, def: d, kitId: d.kit, x, y, z: 0, vx: 0, vy: 0, vz: 0, face: x > 0 ? -1 : 1, hp, maxhp: hp, state: 'spawn', anim: 'walk', frame: 0, ft: 0, phase: 0, hw: (d.hw || 11) * kit.scale, hd: 7, ht: 58 * kit.scale, stride: (kit.strideMul || 40) * kit.scale, runStride: 56 * kit.scale, invuln: 0, flash: 0, hitChain: 0, chainT: 0, cool: 40 + Math.random() * 40, token: false, ring: rnd(72, 118) * GS, laneOff: rnd(-26, 26), poise: d.poise || 0, hitSet: new Set(), downT: 0, deadT: 0, armor: false, rate: 1, retreat: 0, atk: null, boss: !!d.boss, summoned: false, grabT: 0 };
  }

  /* ----- main tick ----- */
  update() {
    I.pollPad && I.pollPad(); this.t++;
    if (this.state === 'loading') { if (this.pending && ++this.loadWait > 2) { const f = this.pending; this.pending = null; f(); } I.tick(); I.endFrame(); return; }
    const frozen = this.state === 'play' && this.hitstop > 0 && !I.just('pause');
    if (this.state === 'play') this.updatePlay();
    else this.updateMenus();
    if (!frozen) I.tick(); /* the input buffer does not drain during hit-stop, so combos stay forgiving */
    I.endFrame();
  }
  updatePlay() {
    if (I.just('pause')) { this.state = 'pause'; this.menu = 0; A.play('ui'); if (G.Music) G.Music.duck(true); return; }
    if (this.hitstop > 0) { this.hitstop--; this.shake *= .9; return; }
    this.tick++; this.stageT++;
    this.players.forEach(p => this.updatePlayer(p));
    this.enemies.forEach(e => this.updateEnemy(e));
    this.updateTokens(); this.separate();
    this.projs.forEach(pr => this.updateProj(pr)); this.projs = this.projs.filter(p => p.life > 0);
    this.props.forEach(p => { if (p.shake > 0) p.shake--; });
    this.updateItems(); this.updateParts(); this.updateWaves(); this.updateCamera();
    this.enemies = this.enemies.filter(e => !e.remove); this.props = this.props.filter(p => !p.remove);
    if (this.banner > 0) this.banner--; if (this.shake > 0) this.shake *= .88; if (this.shake < .15) this.shake = 0;
    if (this.combo.t > 0) { this.combo.t--; if (this.combo.t <= 0) this.combo.n = 0; }
    if (this.lastEnemyT > 0) this.lastEnemyT--;
    if (this.flashT > 0) this.flashT--;
  }

  /* ----- players ----- */
  pm(p) { return p.def.moves; }
  settle(e) { if (e.z > 0 && !['knock', 'jump', 'jatk', 'jdown'].includes(e.state)) { e.vz = (e.vz || 0) - GRAV; e.z += e.vz; if (e.z <= 0) { e.z = 0; e.vz = 0; } } }
  updatePlayer(p) {
    this.settle(p);
    p.t = (p.t || 0) + 1; if (p.invuln > 0) p.invuln--; if (p.flash > 0) p.flash--; if (p.comboTimer > 0) p.comboTimer--;
    if (p.chainT > 0 && --p.chainT === 0) p.hitChain = 0;
    const ax = I.axisX(), ay = I.axisY();
    switch (p.state) {
      case 'idle': case 'walk': this.playerGround(p, ax, ay); break;
      case 'attack': this.playerAttack(p); break;
      case 'jump': case 'jatk': case 'jdown': this.playerAir(p, ax, ay); break;
      case 'land': advance(p, false, 1); p.vx *= .8; p.vy *= .8; if (p.done) { p.state = 'idle'; setAnim(p, 'idle'); } break;
      case 'special': this.playerSpecial(p); break;
      case 'grab': case 'gstrike': case 'throw': this.playerGrab(p, ax, ay); break;
      case 'hit': advance(p, false, 1); p.x += p.vx; p.vx *= .85; if (--p.stun <= 0) { p.state = 'idle'; setAnim(p, 'idle'); } break;
      case 'knock': this.knockStep(p); break;
      case 'down': this.downStep(p, 46); break;
      case 'getup': advance(p, false, 1); if (p.done) { p.state = 'idle'; setAnim(p, 'idle'); } break;
      case 'dead': this.deadStep(p); break;
      case 'win': advance(p, true, 1); break;
    }
    if (p.state !== 'dead' && p.state !== 'down') this.clampPlayer(p);
    this.pickupCheck(p);
  }
  clampPlayer(p) { p.x = clamp(p.x, this.cam.x + 14, this.cam.x + GW - 14); p.y = clamp(p.y, FT, FB); }
  playerGround(p, ax, ay) {
    if (ax) p.face = ax;
    if (I.consume('jump')) { p.state = 'jump'; p.vz = JUMPV; p.vx *= .95; p.vy *= .8; setAnim(p, 'jump'); A.play('jump'); return; }
    if (I.consume('special') && p.hype > 0) { this.startSpecial(p); return; }
    if (I.consume('attack')) { this.startAttack(p, p.comboTimer > 0 ? p.nextStep : 0); return; }
    if (I.consume('grab')) { this.tryGrab(p); if (p.state === 'grab') return; }
    let tx = ax * p.def.spd, ty = ay * WALKY * (p.def.spd / 1.5); if (ax && ay) { tx *= .86; ty *= .86; }
    p.vx += (tx - p.vx) * .5; p.vy += (ty - p.vy) * .5;
    if (Math.abs(p.vx) < .05) p.vx = 0; if (Math.abs(p.vy) < .05) p.vy = 0;
    p.x += p.vx; p.y += p.vy;
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > .2) { p.state = 'walk'; setAnim(p, 'walk'); this.walkPhase(p); } else { if (p.state === 'walk') { p.state = 'idle'; setAnim(p, 'idle'); } advance(p, true, 1); }
  }
  walkPhase(e) { const sp = Math.hypot(e.vx, e.vy), back = Math.abs(e.vx) > Math.abs(e.vy) && e.vx * e.face < 0 ? -1 : 1; e.phase += back * sp / e.stride; e.phase = ((e.phase % 1) + 1) % 1; e.frame = Math.floor(e.phase * 8) % 8; }
  startAttack(p, step) {
    p.state = 'attack'; p.step = step; p.hitSet = new Set(); p.swung = false; p.lunged = false; p.vx *= .2; p.vy *= .2; restartAnim(p, ['a1', 'a2', 'a3'][step]);
  }
  playerAttack(p) {
    const mv = this.pm(p)[p.step]; advance(p, false, p.rate); p.x += p.vx; p.vx *= .8;
    if (p.frame === 1 && !p.lunged) { p.lunged = true; p.vx = p.face * 1.0; } /* front-foot step matches the lunge pose */
    if (mv.hit.includes(p.frame)) { if (!p.swung) { p.swung = true; A.play('swing'); } this.strike(p, mv.box, mv, p.hitSet); }
    if (p.frame > mv.hit[mv.hit.length - 1] && p.step < 2 && I.consume('attack')) { this.startAttack(p, p.step + 1); return; }
    if (p.done) { p.comboTimer = p.step < 2 ? 18 : 0; p.nextStep = p.step < 2 ? p.step + 1 : 0; p.state = 'idle'; setAnim(p, 'idle'); }
  }
  playerAir(p, ax, ay) {
    p.vz -= GRAV; p.z += p.vz; p.vx += (ax * p.def.spd * .85 - p.vx) * .07; p.vy += (ay * .7 - p.vy) * .07; p.x += p.vx; p.y += p.vy;
    if (p.state === 'jump') {
      p.frame = p.vz > 1.2 ? 0 : (p.vz > -1.2 ? 1 : 2);
      if (I.consume('attack')) { if (ay > 0) { p.state = 'jdown'; restartAnim(p, 'jdown'); p.vz = Math.min(p.vz, -1.5); } else { p.state = 'jatk'; restartAnim(p, 'jatk'); } p.hitSet = new Set(); A.play('swing'); }
    } else { advance(p, false, 1); this.strike(p, p.state === 'jatk' ? JATK.box : JDOWN.box, p.state === 'jatk' ? JATK : JDOWN, p.hitSet); }
    if (p.z <= 0 && p.vz < 0) { p.z = 0; p.vz = 0; p.state = 'land'; restartAnim(p, 'land'); this.dust(p.x, p.y, 2); A.play('land'); }
  }
  startSpecial(p) { p.state = 'special'; p.spT = 0; p.pulses = 0; p.vx = p.vy = 0; restartAnim(p, 'special'); }
  playerSpecial(p) {
    const sp = p.def.spec;
    if (!I.held.special || p.hype <= 0) { p.state = 'land'; restartAnim(p, 'land'); return; }
    p.hype = Math.max(0, p.hype - DRAIN); advance(p, true, 1); p.spT++;
    const ph = p.spT % sp.pulse;
    if (ph === 1) { p.hitSet = new Set(); p.pulses++; A.play('special'); }
    if (ph >= 1 && ph <= 4) this.strike(p, sp.box, Object.assign({}, sp, { special: true, knock: p.pulses % sp.knockEvery === 0, launch: 2.4 }), p.hitSet);
  }
  tryGrab(p) {
    let best = null, bd = 1e9;
    this.enemies.forEach(e => { if (!this.grabbable(e)) return; const dx = (e.x - p.x) * p.face; if (dx < -6 * GS || dx > 28 * GS || Math.abs(e.y - p.y) > 10) return; if (dx < bd) { bd = dx; best = e; } });
    if (!best) return;
    p.state = 'grab'; p.held = best; p.grabT = 0; p.gcount = 0; restartAnim(p, 'grab'); p.vx = p.vy = 0;
    best.state = 'held'; best.heldBy = p; best.grabT = 0; best.atk = null; best.armor = false; best.warn = false; A.play('hit');
  }
  grabbable(e) { return e.team === 'e' && !e.remove && e.z === 0 && ['idle', 'hit', 'tired', 'retreat'].includes(e.state) || (e.team === 'e' && e.state === 'attack' && e.atk && e.atk.phase === 'windup' && !e.def.boss); }
  release(p) { const e = p.held; if (e) { e.heldBy = null; if (e.state === 'held') { e.state = 'idle'; e.cool = 40; setAnim(e, 'idle'); } } p.held = null; }
  playerGrab(p, ax, ay) {
    const e = p.held;
    if (!e || e.state !== 'held') { p.held = null; p.state = 'idle'; setAnim(p, 'idle'); return; }
    e.x += (p.x + p.face * 17 * GS - e.x) * .5; e.y += (p.y - e.y) * .5; e.face = -p.face; e.grabT++; p.grabT++;
    if (e.grabT > (e.def.grabEscape || 140)) { this.release(p); p.state = 'idle'; setAnim(p, 'idle'); p.invuln = 10; return; }
    if (p.state === 'grab') {
      advance(p, true, 1);
      if (I.consume('attack')) { p.state = 'gstrike'; restartAnim(p, 'gstrike'); p.struck = false; }
      else if (I.consume('grab') || I.consume('jump')) { if (ax) p.face = ax; p.state = 'throw'; restartAnim(p, 'throw'); p.thrown = false; }
    } else if (p.state === 'gstrike') {
      advance(p, false, 1.1);
      if (p.frame === 1 && !p.struck) { p.struck = true; const mv = GSTRIKE[p.gcount % 3]; p.gcount++; A.play('swing'); this.hurt(e, p, mv); if (p.gcount % 3 === 0 || e.state !== 'held') { p.held = null; e.heldBy = null; } }
      if (p.done) { p.state = p.held ? 'grab' : 'idle'; restartAnim(p, p.held ? 'grab' : 'idle'); }
    } else if (p.state === 'throw') {
      advance(p, false, 1);
      if (p.frame === 1 && !p.thrown) { p.thrown = true; e.x = p.x + p.face * 14 * GS; e.face = -p.face; e.heldBy = null; p.held = null; this.hurt(e, p, Object.assign({}, THROWMV)); e.vx = p.face * 3.6; e.vz = 3.4; e.thrown = true; e.thrownHit = new Set([e]); e.owner = p; A.play('throw'); }
      if (p.done) { p.state = 'idle'; setAnim(p, 'idle'); }
    }
  }

  /* ----- shared fighter physics ----- */
  knockStep(e) {
    e.vz -= GRAV; e.z += e.vz; e.x += e.vx; e.y = clamp(e.y + (e.vy || 0), FT, FB); e.vx *= .985;
    if (e.team === 'p') e.x = clamp(e.x, this.cam.x + 6, this.cam.x + GW - 6);
    e.anim = 'knock'; e.frame = (e.vz > 0 || e.z > 16) ? 0 : 1;
    if (e.thrown) this.strike(e, { x0: -14 * GS, x1: 14 * GS, d: 10, z0: 0, z1: 44 * GS }, Object.assign({ owner: e.owner }, THROWHIT), e.thrownHit);
    if (e.z <= 0 && e.vz < 0) { e.z = 0; e.vz = 0; e.vx *= .4; e.thrown = false; e.state = 'down'; e.downT = 0; restartAnim(e, 'down'); this.dust(e.x, e.y, 3); this.shake = Math.max(this.shake, 2.5); A.play('land'); if (e.hp <= 0) { e.state = 'dead'; e.deadT = 0; restartAnim(e, 'dead'); } }
  }
  downStep(e, wait) { e.downT++; e.x += e.vx; e.vx *= .85; if (e.team === 'p') e.x = clamp(e.x, this.cam.x + 6, this.cam.x + GW - 6); e.anim = 'down'; e.frame = e.downT < 10 ? 0 : 1; if (e.downT > wait) { e.state = 'getup'; restartAnim(e, 'getup'); e.invuln = 36; } }
  deadStep(e) { e.deadT++; e.x += e.vx; e.vx *= .85; if (e.team === 'p') { e.anim = 'dead'; e.frame = 0; if (e.deadT > 80) this.playerDied(e); } else { e.frame = 0; if (e.deadT > 70) e.remove = true; } }
  playerDied(p) {
    this.lives--; if (this.lives <= 0) { this.state = 'gameover'; this.menu = 0; A.play('ko'); if (G.Music) G.Music.stop(); return; }
    p.lives = this.lives; p.hp = p.maxhp; p.x = this.cam.x + 60; p.y = 170; p.z = 0; p.state = 'idle'; p.invuln = 150; p.hitChain = 0; setAnim(p, 'idle'); p.vx = p.vy = 0;
  }

  /* ----- hit detection (3D: x range in facing direction, lane depth, height) ----- */
  strike(att, box, mv, hitSet) {
    const f = att.face; let x0 = att.x + f * box.x0, x1 = att.x + f * box.x1; if (x0 > x1) { const t = x0; x0 = x1; x1 = t; }
    const z0 = att.z + box.z0, z1 = att.z + box.z1, who = mv.owner || att;
    const targets = att.team === 'e' && !mv.owner ? this.players : (who.team === 'p' ? this.enemies.concat(this.props) : this.players);
    let hit = false;
    for (const t of targets) {
      if (hitSet.has(t) || t === att) continue; if (t.kind === 'fighter' && !this.canBeHit(t, mv)) continue;
      if (x1 < t.x - t.hw || x0 > t.x + t.hw) continue; if (Math.abs(t.y - att.y) > box.d + t.hd) continue; if (z1 < t.z || z0 > t.z + t.ht) continue;
      hitSet.add(t); this.hurt(t, att, mv); hit = true;
    }
    return hit;
  }
  canBeHit(t, mv) { if (t.invuln > 0 || this.isGod(t)) return false; return !['down', 'dead', 'getup', 'knock'].includes(t.state) && !t.remove; }
  isGod(t) { return this.godMode && t.team === 'p'; }
  hurt(t, a, mv) {
    const who = mv.owner || a, f = mv.omni ? (t.x >= a.x ? 1 : -1) : (a.face || 1);
    const sx = t.x - f * t.hw * .4, sy = t.y, sz = clamp(a.z + (mv.box ? (mv.box.z0 + mv.box.z1) / 2 : 30), t.z + 10, t.z + (t.ht || 30) - 6);
    if (t.kind === 'prop') { t.hp -= mv.special ? .5 : 1; t.shake = 8; this.spark(sx, sy, sz, 0); A.play('hit'); this.hitstop = Math.max(this.hitstop, 2); if (t.hp <= 0) this.breakProp(t); return; }
    const dmg = mv.dmg; t.hp -= dmg; t.flash = 4;
    let knock = t.hp <= 0 || !!mv.knock || t.hitChain >= 2 || t.z > 1; /* a fighter hit in mid-air is knocked down (the flinch state has no gravity) */
    if (t.def && t.def.poise && t.team === 'e') { t.poise -= dmg; if (t.poise <= 0) { knock = true; t.poise = t.def.poise; } else if (t.hp > 0) knock = false; }
    const noFlinch = (t.armor || t.state === 'special') && !knock;
    if (t.held && t.team === 'p') this.release(t);
    if (knock) {
      if (t.heldBy && a !== t.heldBy) { t.heldBy.held = null; t.heldBy.state = 'idle'; setAnim(t.heldBy, 'idle'); }
      t.heldBy = null; t.state = 'knock'; t.vz = mv.launch || 3; t.vx = f * (mv.kb || 2.4); t.atk = null; t.armor = false; t.warn = false; t.hitChain = 0; restartAnim(t, 'knock'); t.thrown = false;
    } else if (!noFlinch) {
      if (t.state === 'held') { /* stays held, just flinches visually */ t.flash = 6; } else { t.state = 'hit'; t.stun = mv.stun || 18; t.vx = f * (mv.kb || 1.5); t.atk = null; t.armor = false; t.warn = false; t.hitChain++; t.chainT = 45; restartAnim(t, 'hit'); }
    }
    const heavy = knock || dmg >= 9;
    this.hitstop = Math.max(this.hitstop, mv.hs || 3); this.shake = Math.max(this.shake, heavy ? 3.2 : 1.4);
    this.spark(sx, sy, sz, heavy ? 1 : 0); A.play(t.hp <= 0 ? 'ko' : (heavy ? 'heavy' : 'hit'));
    if (who.team === 'p') {
      if (t.team === 'e') { this.score += Math.round(dmg * 10); this.lastEnemy = t; this.lastEnemyT = 150; if (t.hp <= 0) this.score += t.def.score; }
      if (!mv.special && mv.hype !== 0) who.hype = Math.min(100, who.hype + (mv.hype || 4)); /* HYPE only from ordinary attacks, never from special damage */
      this.combo.n++; this.combo.t = 100; this.combo.pop = 8;
    }
  }
  breakProp(p) {
    p.remove = true; A.play('smash'); this.shake = Math.max(this.shake, 2);
    for (let i = 0; i < 12; i++) this.parts.push({ type: 'debris', x: p.x + rnd(-8, 8), y: p.y, z: rnd(6, 20), vx: rnd(-1.8, 1.8), vy: rnd(-.3, .3), vz: rnd(1.5, 3.8), life: 40, c: p.type === 'barrel' ? '#3b6aa8' : (p.type === 'bin' ? '#7d8590' : '#a8702f') });
    this.dust(p.x, p.y, 3);
    if (Math.random() < .7) this.items.push({ type: DROPS[Math.floor(Math.random() * DROPS.length)], x: p.x, y: p.y, z: 18, vz: 2, life: 900, t: 0 });
  }

  /* ----- enemies ----- */
  nearestPlayer(e) { let b = null, bd = 1e9; for (const p of this.players) { if (['dead'].includes(p.state)) continue; const d = Math.abs(p.x - e.x) + Math.abs(p.y - e.y) * 2; if (d < bd) { bd = d; b = p; } } return b; }
  updateEnemy(e) {
    this.settle(e);
    const D = e.def; if (e.flash > 0) e.flash--; if (e.cool > 0) e.cool--; if (e.invuln > 0) e.invuln--;
    if (e.chainT > 0 && --e.chainT === 0) e.hitChain = 0;
    switch (e.state) {
      case 'spawn': { const tx = e.face > 0 ? 1 : -1; e.vx = tx * 1.6; e.vy = 0; e.x += e.vx; setAnim(e, 'walk'); this.walkPhase(e); if (e.x > this.cam.x + 26 && e.x < this.cam.x + GW - 26) { e.state = 'idle'; } break; }
      case 'idle': this.aiThink(e); break;
      case 'retreat': this.aiThink(e); break;
      case 'attack': this.aiAttack(e); break;
      case 'charge': this.aiCharge(e); break;
      case 'tired': e.tiredT--; setAnim(e, 'idle'); advance(e, true, 1); if (e.tiredT <= 0) e.state = 'idle'; break;
      case 'hit': advance(e, false, 1); e.x += e.vx; e.vx *= .85; if (--e.stun <= 0) { e.state = 'idle'; setAnim(e, 'idle'); } break;
      case 'knock': this.knockStep(e); break;
      case 'down': this.downStep(e, e.boss ? 50 : 44); break;
      case 'getup': advance(e, false, 1); if (e.done) { e.state = 'idle'; setAnim(e, 'idle'); e.cool = 20; } break;
      case 'dead': this.deadStep(e); break;
      case 'held': e.anim = 'held'; e.frame = 0; if (!e.heldBy) { e.state = 'idle'; e.cool = 30; } break;
    }
    if (!['knock', 'down', 'dead', 'spawn'].includes(e.state)) { e.x = clamp(e.x, this.cam.x - 40, this.cam.x + GW + 40); e.y = clamp(e.y, FT, FB); }
    if (e.state === 'idle' && D.summonAt && !e.summoned && e.hp < e.maxhp * D.summonAt && e.cool <= 0) { e.summoned = true; this.startEnemyAttack(e, 'summon'); }
  }
  updateTokens() {
    const pl = this.players[0]; if (!pl || !this.stage) return;
    const grunts = this.enemies.filter(e => !e.boss && !e.remove && !['dead', 'down', 'knock', 'spawn', 'held', 'getup'].includes(e.state));
    const busy = (e) => e.state === 'attack' || e.state === 'charge';
    grunts.forEach(e => { if (!busy(e)) e.token = false; });
    const byId = grunts.slice().sort((a, b) => a.uid - b.uid); /* spread idle enemies over distinct lanes/rings so crowds fan out instead of stacking */
    byId.forEach((e, i) => { const n = byId.length; e.laneOff = n > 1 ? ((i + .5) / n - .5) * 64 : e.laneOff; e.ring = (70 + (i % 3) * 20) * GS; });
    const free = this.stage.tokens - grunts.filter(busy).length;
    grunts.filter(e => !busy(e)).sort((a, b) => Math.abs(a.x - pl.x) - Math.abs(b.x - pl.x)).slice(0, Math.max(0, free)).forEach(e => e.token = true);
  }
  aiThink(e) {
    const p = this.nearestPlayer(e), D = e.def; if (!p) { setAnim(e, 'idle'); advance(e, true, 1); return; }
    const dx = p.x - e.x, dy = p.y - e.y, adx = Math.abs(dx), ady = Math.abs(dy); if (adx > 3) e.face = dx > 0 ? 1 : -1;
    let tvx = 0, tvy = 0; const spd = D.spd;
    const moveToLane = (ty, k) => { const d = ty - e.y; tvy = clamp(d * .2, -spd * .8, spd * .8) * (Math.abs(d) < 2 ? 0 : 1) * (k || 1); };
    if (e.state === 'retreat' || e.retreat > 0) { e.state = 'retreat'; e.retreat--; tvx = -e.face * spd * .9; moveToLane(p.y + e.laneOff * .5); if (e.retreat <= 0) e.state = 'idle'; }
    else if (e.token || e.boss) {
      if (e.cool > 0) { const ring = (e.boss ? 66 : 62) * GS; if (adx > ring + 8) tvx = e.face * spd * .7; else if (adx < ring - 14) tvx = -e.face * spd * .6; moveToLane(p.y + e.laneOff * .3, .7); }
      else {
        if (!e.next) e.next = D.moves[Math.floor(Math.random() * D.moves.length)];
        const mv = EM[e.next];
        if (mv.kind === 'ranged') { if (adx >= 70 * GS && adx <= 170 * GS && ady < 8) { this.startEnemyAttack(e, e.next); return; } if (adx < 70 * GS) tvx = -e.face * spd; else if (adx > 170 * GS) tvx = e.face * spd; moveToLane(p.y); }
        else if (mv.kind === 'charge') { if (adx >= 80 * GS && adx <= 230 * GS && ady < 8) { this.startEnemyAttack(e, e.next); return; } if (adx < 80 * GS) tvx = -e.face * spd; else tvx = e.face * spd * .8; moveToLane(p.y); }
        else if (mv.kind === 'summon') { this.startEnemyAttack(e, e.next); return; }
        else { if (adx <= mv.engage && ady <= 6) { this.startEnemyAttack(e, e.next); return; } if (adx > mv.engage - 4) tvx = e.face * spd; moveToLane(p.y); }
      }
    } else { const ring = e.ring; if (adx > ring + 14) tvx = e.face * spd * .85; else if (adx < ring - 18) tvx = -e.face * spd * .7; moveToLane(p.y + e.laneOff, .8); }
    e.vx += (tvx - e.vx) * .3; e.vy += (tvy - e.vy) * .3; if (Math.abs(e.vx) < .03) e.vx = 0; if (Math.abs(e.vy) < .03) e.vy = 0;
    e.x += e.vx; e.y += e.vy;
    if (Math.hypot(e.vx, e.vy) > .25) { setAnim(e, 'walk'); this.walkPhase(e); } else { setAnim(e, 'idle'); advance(e, true, 1); }
  }
  startEnemyAttack(e, name) {
    const mv = EM[name]; e.state = 'attack'; e.atk = { name, mv, phase: 'windup', t: 0, hitSet: new Set(), fired: false }; e.vx = e.vy = 0; restartAnim(e, mv.anim); e.armor = !!mv.armor; e.next = null; e.warn = true;
    e.windScale = e.boss && e.hp < e.maxhp * .35 ? .7 : 1; A.play('warn');
  }
  aiAttack(e) {
    const a = e.atk; if (!a) { e.state = 'idle'; return; } const mv = a.mv;
    if (a.phase === 'windup') {
      a.t++; e.frame = 0; e.ft = 0; const p = this.nearestPlayer(e); if (p && a.t < mv.windup * .5) e.face = p.x >= e.x ? 1 : -1;
      if (a.t >= mv.windup * e.windScale) { e.warn = false; if (mv.kind === 'charge') { e.state = 'charge'; e.ct = 0; e.hitSet = new Set(); setAnim(e, 'run'); e.armor = true; return; } if (mv.kind === 'summon') { this.doSummon(e); a.phase = 'recover'; a.t = 0; return; } a.phase = 'strike'; e.frame = 1; e.ft = 0; }
      return;
    }
    if (a.phase === 'recover') { a.t++; if (a.t > 40) this.endEnemyAttack(e); return; }
    advance(e, false, 1);
    if (mv.kind === 'ranged') { if (e.frame >= mv.hit[0] && !a.fired) { a.fired = true; this.fireProj(e, mv); } }
    else if (mv.hit.includes(e.frame)) { if (!a.swung) { a.swung = true; A.play('swing'); } this.strike(e, mv.box, mv, a.hitSet); }
    if (e.done) this.endEnemyAttack(e);
  }
  endEnemyAttack(e) {
    const a = e.atk, mv = a ? a.mv : null; e.atk = null; e.armor = false; e.warn = false; e.state = 'idle'; setAnim(e, 'idle'); e.cool = mv ? mv.cool * (e.boss && e.hp < e.maxhp * .35 ? .65 : 1) : 40;
    if (mv && mv.chain && Math.random() < .8) { const p = this.nearestPlayer(e); if (p && Math.abs(p.x - e.x) < 50) { this.startEnemyAttack(e, mv.chain); return; } }
    if (e.def.retreat) { e.retreat = 36; e.state = 'retreat'; }
  }
  aiCharge(e) {
    const mv = e.atk.mv; e.ct++; e.x += e.face * mv.speed; setAnim(e, 'run'); e.phase += mv.speed / e.runStride; e.phase %= 1; e.frame = Math.floor(e.phase * 6) % 6;
    const hit = this.strike(e, mv.box, mv, e.hitSet);
    const edge = (e.x < this.cam.x + 10 && e.face < 0) || (e.x > this.cam.x + GW - 10 && e.face > 0);
    if (e.ct > mv.dur || hit || edge) { e.atk = null; e.armor = false; e.state = 'tired'; e.tiredT = hit ? 20 : 44; e.cool = mv.cool; e.vx = 0; }
  }
  doSummon(e) { A.play('go'); [['guard', -1], ['exec', 1]].forEach(q => { const n = this.makeEnemy(q[0], q[1] < 0 ? this.cam.x - 24 : this.cam.x + GW + 24, rnd(FT + 6, FB - 6)); n.face = q[1] < 0 ? 1 : -1; this.enemies.push(n); }); this.flashT = 6; }
  fireProj(e, mv) { A.play('throw'); for (let i = 0; i < mv.count; i++) this.projs.push({ x: e.x + e.face * 18 * GS, y: e.y + (i - (mv.count - 1) / 2) * 12, z: 32 * GS + e.z, vx: e.face * 2.4, life: 160, dmg: mv.dmg, owner: e, spin: 0 }); }
  updateProj(pr) {
    pr.x += pr.vx; pr.life--; pr.spin++; if (pr.x < this.cam.x - 30 || pr.x > this.cam.x + GW + 30) pr.life = 0;
    for (const p of this.players) { if (!this.canBeHit(p, {})) continue; if (Math.abs(p.x - pr.x) < p.hw + 4 && Math.abs(p.y - pr.y) < 9 && pr.z > p.z && pr.z < p.z + p.ht) { pr.life = 0; this.hurt(p, { x: pr.x - Math.sign(pr.vx) * 20, face: Math.sign(pr.vx), z: 0, team: 'e' }, { dmg: pr.dmg, kb: 1.5, stun: 16, hs: 3, box: { z0: 20, z1: 40 } }); } }
  }

  /* ----- crowd separation ----- */
  separate() {
    const L = [...this.players, ...this.enemies].filter(e => !['knock', 'down', 'dead', 'held', 'spawn'].includes(e.state) && e.z < 4);
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const a = L[i], b = L[j], rx = (a.hw + b.hw) * .9, ry = 10, dx = b.x - a.x, dy = b.y - a.y, nx = dx / rx, ny = dy / ry, d2 = nx * nx + ny * ny;
      if (d2 >= 1) continue; const d = Math.sqrt(d2) || .01, m = (1 - d) * .9, wa = a.team === 'p' ? .3 : 1, wb = b.team === 'p' ? .3 : 1, jx = d < .05 ? rnd(-1, 1) : 0, jy = d < .05 ? rnd(-1, 1) : 0;
      const ux = (nx / d) || jx, uy = (ny / d) || jy;
      a.x -= ux * m * wa * (rx / 14); b.x += ux * m * wb * (rx / 14); a.y -= uy * m * wa * .5; b.y += uy * m * wb * .5;
    }
  }

  /* ----- items / particles / waves / camera ----- */
  pickupCheck(p) {
    if (p.state === 'dead' || p.state === 'down' || p.z > 10) return;
    this.items.forEach(it => { if (it.taken || it.z > 6) return; if (Math.abs(it.x - p.x) < 15 && Math.abs(it.y - p.y) < 11) {
      it.taken = true; const f = G.FOOD[it.type]; p.hp = Math.min(p.maxhp, p.hp + f.heal); this.score += 100; A.play('pick');
      this.parts.push({ type: 'foodghost', food: it.type, x: it.x, y: it.y, z: 4, vz: .45, life: 34 }, { type: 'glow', x: it.x, y: it.y, z: 14, life: 18 }, { type: 'text', x: it.x, y: it.y, z: 26, vz: .6, life: 56, s: '+100' });
      for (let i = 0; i < 6; i++) this.parts.push({ type: 'sparkle', x: it.x + rnd(-14, 14), y: it.y, z: rnd(4, 24), vz: rnd(.2, .8), life: rnd(16, 30) });
    } });
  }
  updateItems() { this.items.forEach(it => { it.t++; it.life--; if (it.z > 0 || it.vz) { it.vz = (it.vz || 0) - .2; it.z += it.vz; if (it.z <= 0) { it.z = 0; it.vz = 0; } } }); this.items = this.items.filter(i => !i.taken && i.life > 0); }
  spark(x, y, z, big) { this.parts.push({ type: big ? 'boom' : 'spark', x, y, z, life: big ? 14 : 9 }); }
  dust(x, y, n) { for (let i = 0; i < n; i++) this.parts.push({ type: 'dust', x: x + rnd(-10, 10), y: y + 1, z: 2, vx: rnd(-.5, .5), vz: rnd(.1, .4), life: 20 }); }
  updateParts() { this.parts.forEach(p => { p.age = (p.age || 0) + 1; p.life--; if (p.vx) p.x += p.vx; if (p.vy) p.y += p.vy; if (p.vz !== undefined) { p.z += p.vz; if (p.type === 'debris') { p.vz -= .22; if (p.z < 0) { p.z = 0; p.vz = 0; p.vx *= .5; } } } }); this.parts = this.parts.filter(p => p.life > 0); }
  spawnEnemy(type, side) {
    const x = side === 'R' ? this.cam.x + GW + 26 : this.cam.x - 26, e = this.makeEnemy(type, x, rnd(FT + 8, FB - 8)); e.face = side === 'R' ? -1 : 1; this.enemies.push(e); return e;
  }
  updateWaves() {
    const st = this.stage; if (!st) return;
    this.spawnQ.forEach(q => q.t--); this.spawnQ.filter(q => q.t <= 0).forEach(q => this.spawnEnemy(q.type, q.side)); this.spawnQ = this.spawnQ.filter(q => q.t > 0);
    const w = st.waves[this.waveIdx];
    if (this.waveState === 'walk' && w && this.cam.x >= w.x - 2) {
      this.waveState = 'fight'; this.cam.max = w.x; w.e.forEach(q => this.spawnQ.push({ type: q[0], side: q[1], t: q[2] !== undefined ? q[2] : Math.floor(rnd(0, 70)) }));
      if (w.boss) { this.bossBanner = 150; A.play('go'); this.items.push({ type: 'spit', x: w.x + 60, y: 190, z: 0, life: 6000, t: 0 }); }
    } else if (this.waveState === 'fight' && this.spawnQ.length === 0 && this.enemies.every(e => e.state === 'dead')) {
      this.waveState = 'walk'; this.waveIdx++; this.goT = 0;
      if (this.waveIdx >= st.waves.length) { this.cam.max = st.len - GW; this.clearT = 1; } else { this.cam.max = st.waves[this.waveIdx].x; A.play('go'); }
    }
    if (this.clearT > 0) { this.clearT++; const p = this.players[0]; if (this.clearT === 20 && p && p.state !== 'dead') { p.state = 'win'; restartAnim(p, 'win'); p.vx = p.vy = 0; } if (this.clearT > 190) { this.finishStage(); } }
    if (this.bossBanner > 0) this.bossBanner--; if (this.waveState === 'walk') this.goT++;
  }
  finishStage() { const p = this.players[0]; this.carry = { hp: p.hp, hype: p.hype }; this.lives = Math.max(this.lives, 1); this.state = this.stageIdx >= G.STAGES.length - 1 ? 'victory' : 'stageclear'; this.best = Math.max(this.best, this.score); this.clearT = 0; A.play('go'); }
  updateCamera() {
    const p = this.players[0]; if (!p) return; const target = p.x - GW * .42 + p.face * 14, c = this.cam;
    const nx = c.x + clamp((target - c.x) * .1, -4, 4); c.x = clamp(Math.max(c.x, nx), 0, c.max);
  }

  /* ----- menus ----- */
  updateMenus() {
    const j = (b) => I.just(b);
    if (this.state === 'title') { if (j('start') || j('attack') || j('jump')) { this.state = 'select'; A.play('ui'); if (G.Music) G.Music.play('arcade'); } }
    else if (this.state === 'select') { const ids = Object.keys(G.CH); if (j('left')) { this.sel = (this.sel + 2) % 3; A.play('ui'); } if (j('right')) { this.sel = (this.sel + 1) % 3; A.play('ui'); } if (j('start') || j('attack')) { this.beginRun(ids[this.sel]); A.play('go'); } if (j('pause') || j('back')) this.state = 'title'; }
    else if (this.state === 'pause') { if (j('up')) this.menu = (this.menu + 3) % 4; if (j('down')) this.menu = (this.menu + 1) % 4; if (j('pause')) { this.state = 'play'; if (G.Music) G.Music.duck(false); return; } if (j('start') || j('attack')) this.pauseChoose(this.menu); }
    else if (this.state === 'gameover') { if (j('start') || j('attack')) { this.lives = 3; this.score = 0; this.carry = null; this.beginStage(this.stageIdx); } if (j('pause') || j('back')) { this.state = 'title'; } }
    else if (this.state === 'stageclear') { if (j('start') || j('attack')) { this.beginStage(this.stageIdx + 1); A.play('go'); } }
    else if (this.state === 'victory') { if (j('start') || j('attack')) this.state = 'title'; }
  }
  pauseChoose(i) { if (G.Music) G.Music.duck(false); if (i === 0) this.state = 'play'; else if (i === 1) { this.lives = 3; this.score = Math.max(0, this.score); this.carry = null; this.beginStage(this.stageIdx); } else if (i === 2) { this.menu = 2; this.showHelp = !this.showHelp; } else this.state = 'title'; A.play('ui'); }
}
G.Game = Game;
})(globalThis.GG = globalThis.GG || {});
