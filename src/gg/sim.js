/* Grease & Gold: World Tour - fixed-60Hz simulation + screen flow. */
(function (G) {
'use strict';
const Art = G.Art;
const clamp = G.clamp, rnd = G.rnd, sgn = G.sgn;

const WALK = 2.25, WALKY = 1.5, GRAV = .30, JUMPV = 5.0;
const FT = G.FT, FB = G.FB;
const DRAIN = 1.05;              /* HYPE per tick while a special is held */
G.K = { WALK, WALKY, GRAV, JUMPV, DRAIN };

/* ---------------- characters ---------------- */
/* reach/damage tuned per fighter; startup/active use art frame indices */
const CH = G.CH = {
  ricky: { name: 'Ricky B', kit: 'ricky', hp: 105, spd: 1.0, reach: 1.0,
    weapon: 'Turkish flag & pole', special: 'Flag Cyclone',
    blurb: 'BALANCED. LONG POLE THRUSTS, WIDE SWEEPS.',
    stats: { power: 3, speed: 3, reach: 5, health: 3 },
    moves: [
      { box: { x0: 6, x1: 60, tol: 15, z0: 0, z1: 58 }, dmg: 7, kb: 1.6, stun: 16, hs: 4, hype: 5, active: [1, 2] },
      { box: { x0: 0, x1: 58, tol: 17, z0: 0, z1: 60 }, dmg: 8, kb: 2.0, stun: 18, hs: 4, hype: 5, active: [1, 2] },
      { box: { x0: 4, x1: 54, tol: 20, z0: 0, z1: 62 }, dmg: 15, kb: 4.6, stun: 26, hs: 8, hype: 9, active: [2, 3], knock: true, launch: 3.3 }
    ],
    spec: { every: 9, box: { x0: -20, x1: 74, tol: 26, z0: 0, z1: 66 }, dmg: 4, kb: 2.2, hs: 2, knockEvery: 4 } },
  vv: { name: 'V.V.', kit: 'vv', hp: 92, spd: 1.14, reach: .9,
    weapon: 'Vintage mic & cord', special: 'Mic Drop',
    blurb: 'FAST. SHORT JABS, CORD WHIP, SPIN FINISH.',
    stats: { power: 2, speed: 5, reach: 4, health: 2 },
    moves: [
      { box: { x0: 4, x1: 50, tol: 13, z0: 0, z1: 56 }, dmg: 5, kb: 1.3, stun: 14, hs: 3, hype: 5, active: [1, 2] },
      { box: { x0: 2, x1: 56, tol: 15, z0: 0, z1: 58 }, dmg: 6, kb: 1.7, stun: 15, hs: 3, hype: 5, active: [1, 2] },
      { box: { x0: 0, x1: 52, tol: 18, z0: 0, z1: 60 }, dmg: 12, kb: 4.2, stun: 24, hs: 7, hype: 8, active: [2, 3], knock: true, launch: 3.1 }
    ],
    spec: { every: 7, box: { x0: -58, x1: 58, tol: 22, z0: 0, z1: 62 }, dmg: 3, kb: 2.5, hs: 2, knockEvery: 3 } },
  johnny: { name: 'Johnny $', kit: 'johnny', hp: 124, spd: .86, reach: 1.04,
    weapon: 'Giant salami', special: 'Salami Slam',
    blurb: 'HEAVY. BIG ARCS, HUGE KNOCKBACK, ARMORED.',
    stats: { power: 5, speed: 2, reach: 3, health: 5 },
    moves: [
      { box: { x0: 4, x1: 56, tol: 16, z0: 0, z1: 58 }, dmg: 9, kb: 2.2, stun: 18, hs: 5, hype: 6, active: [1, 2] },
      { box: { x0: 0, x1: 58, tol: 18, z0: 0, z1: 60 }, dmg: 10, kb: 2.6, stun: 20, hs: 5, hype: 6, active: [1, 2] },
      { box: { x0: 2, x1: 58, tol: 21, z0: 0, z1: 64 }, dmg: 18, kb: 5.4, stun: 28, hs: 9, hype: 10, active: [2, 3], knock: true, launch: 3.6 }
    ],
    spec: { every: 10, box: { x0: -10, x1: 62, tol: 24, z0: 0, z1: 64 }, dmg: 5, kb: 2.8, hs: 3, knockEvery: 4 } }
};
G.CH_ORDER = ['ricky', 'vv', 'johnny'];

const EM = G.EM = {
  jab: { anim: 'a1', windup: 22, dmg: 5, kb: 1.4, stun: 14, hs: 3, reach: 36, tol: 13, cool: 40, active: [1, 2] },
  swing: { anim: 'a2', windup: 30, dmg: 8, kb: 2.4, stun: 20, hs: 5, reach: 44, tol: 15, cool: 62, active: [1, 2] },
  baton: { anim: 'a1', windup: 26, dmg: 7, kb: 2.0, stun: 18, hs: 4, reach: 50, tol: 14, cool: 52, active: [1, 2] },
  smash: { anim: 'a2', windup: 42, dmg: 13, kb: 4.4, stun: 26, hs: 8, reach: 48, tol: 18, cool: 80, active: [1, 2], knock: true, launch: 2.8, armor: true },
  charge: { anim: 'a2', kind: 'charge', windup: 40, dmg: 14, kb: 4, stun: 24, hs: 8, reach: 34, tol: 16, cool: 90, dur: 44, speed: 3.4, armor: true },
  bottle: { anim: 'a2', kind: 'proj', windup: 26, dmg: 6, kb: 1.6, stun: 14, hs: 3, cool: 70, ranged: true }
};
const ED = G.ED = {
  jooce: { name: 'Jooce', kit: 'jooce', hp: 34, spd: 1.05, moves: ['baton', 'jab'], score: 100 },
  hobo: { name: 'Street Hobo', kit: 'hobo', hp: 30, spd: 1.4, moves: ['jab', 'swing'], score: 120 },
  turd: { name: 'Turd', kit: 'turd', hp: 40, spd: 1.2, moves: ['baton', 'bottle'], score: 140 },
  heavy: { name: 'Big Business', kit: 'heavy', hp: 88, spd: .82, moves: ['swing', 'smash'], poise: 30, score: 300 },
  ledger: { name: 'The Ledger', kit: 'ledger', hp: 220, spd: 1.1, boss: true, poise: 40, moves: ['jab', 'smash', 'charge'], score: 2000 },
  bigtony: { name: 'Big Tony', kit: 'bigtony', hp: 330, spd: .95, boss: true, poise: 70, moves: ['swing', 'smash', 'charge'], score: 3000 },
  mara: { name: 'Dusty Mara', kit: 'mara', hp: 250, spd: 1.55, boss: true, poise: 36, moves: ['baton', 'bottle', 'swing'], score: 3500 },
  auditor: { name: 'The Auditor', kit: 'auditor', hp: 380, spd: 1.3, boss: true, poise: 46, moves: ['baton', 'smash', 'charge'], score: 6000 }
};
const FOOD = G.FOOD = {
  adana: { heal: 25, name: 'Adana Kebab' }, shish: { heal: 32, name: 'Shish Kebab' },
  doner: { heal: 45, name: 'Doner Plate' }, lahmacun: { heal: 18, name: 'Lahmacun' },
  kunefe: { heal: 15, name: 'Kunefe' }, spit: { heal: 80, name: 'Doner Spit' }
};
const DROPS = ['adana', 'adana', 'shish', 'shish', 'lahmacun', 'kunefe', 'doner'];
const DIFF = { 0: { hp: .85, dmg: .8, slots: 1, cool: 1.25 }, 1: { hp: 1, dmg: 1, slots: 2, cool: 1 }, 2: { hp: 1.2, dmg: 1.2, slots: 3, cool: .8 } };

/* ---------------- input action names ---------------- */
const ACT = ['left', 'right', 'up', 'down', 'attack', 'jump', 'special', 'grab', 'start', 'pause'];
G.ACT = ACT;

class Game {
  constructor(opts) {
    opts = opts || {};
    this.settings = opts.settings || G.loadSettings();
    this.meta = opts.meta || null;
    this.audio = opts.audio || null;
    this.net = opts.net || null;
    this.mode = 'solo';
    this.screen = 'title';
    this.sel = 0; this.selP2 = 0; this.menu = 0; this.sub = 0; this.helpScroll = 0;
    this.t = 0; this.lives = 3; this.score = 0; this.stageIdx = 0; this.tick = 0;
    this.p1 = 'ricky'; this.p2 = 'vv';
    this.players = []; this.enemies = []; this.props = []; this.items = []; this.fx = []; this.projs = [];
    this.cam = { x: 0, max: 0 }; this.waveIdx = 0; this.waveState = 'walk'; this.spawnQ = [];
    this.hitstop = 0; this.shake = 0; this.flashT = 0; this.banner = 0; this.goT = 0; this.clearT = 0;
    this.combo = { n: 0, t: 0, pop: 0 }; this.boss = null; this.training = false;
    this.hot = []; this.toast = null; this.msg = ''; this.diff = this.settings.diff | 0;
    this.netState = 'idle'; this.code = ''; this.invite = ''; this.guestReady = false; this.ready = false;
    this.remap = null; this.cfg = null;
    this.best = 0; try { this.best = +(localStorage.getItem('gg-best') || 0); } catch (e) {}
  }
  get S() { return this.settings; }
  tr(k) { return G.t(k, this.settings.lang); }

  /* ---------------- lifecycle ---------------- */
  newGame(mode, opts) {
    this.mode = mode || 'solo';
    this.players = []; this.enemies = []; this.props = []; this.items = []; this.fx = []; this.projs = [];
    this.score = 0; this.lives = mode === 'training' ? 99 : 3; this.carry = null;
    this.training = mode === 'training';
    this.stageIdx = this.training ? 0 : (opts && opts.stage) || 0;
    this.waveIdx = 0; this.waveState = 'walk'; this.spawnQ = []; this.boss = null;
    this.hitstop = 0; this.shake = 0; this.banner = 150; this.clearT = 0; this.combo = { n: 0, t: 0, pop: 0 };
    this.cam.x = 0; this.goT = 0; this.tick = 0;
    const ids = mode === 'local' || mode === 'online' ? [this.p1, this.p2] : [this.p1];
    ids.forEach((id, i) => this.addPlayer(i, id));
    this.loadStage(this.stageIdx);
    this.screen = 'play';
    if (this.audio) this.audio.music(this.training ? 'training' : G.STAGES[this.stageIdx].music);
  }
  addPlayer(idx, charId) {
    const def = G.CH[charId], kit = Art.KITS[def.kit];
    const p = {
      pid: idx, team: 'p', charId: charId, def: def, kitId: def.kit, name: def.name,
      x: 80 + idx * 26, y: 200 + idx * 14, z: 0, vx: 0, vy: 0, vz: 0, face: 1,
      hp: def.hp, maxhp: def.hp, hype: 35, state: 'idle', anim: 'idle', frame: 0, ft: 0,
      invuln: 90, flash: 0, step: 0, chainT: 0, hitChain: 0, chainTimer: 0, held: null, stun: 0,
      downT: 0, reviveT: 0, dead: false, lives: 3, airAtk: false, spT: 0, pulses: 0, last: {},
      hw: 11 * kit.b.s, hd: 8, ht: 66 * kit.b.s, stride: 46 * kit.b.s, phase: 0, swung: false, status: null
    };
    p.baseSpd = WALK * def.spd;
    this.players.push(p);
    return p;
  }
  loadStage(i) {
    this.stageIdx = i; this.stage = G.STAGES[i];
    const keep = this.players.map(p => ({ pid: p.pid, charId: p.charId, hp: p.hp, hype: p.hype, lives: p.lives }));
    this.enemies = []; this.props = []; this.items = []; this.fx = []; this.projs = []; this.spawnQ = [];
    this.waveIdx = 0; this.waveState = 'walk'; this.boss = null; this.tick = 0;
    this.cam.x = 0; this.cam.max = this.stage.waves[0].x; this.goT = 0; this.banner = 160; this.clearT = 0;
    this.stage.props.forEach(q => this.props.push({ kind: 'prop', type: q[0], x: q[1], y: q[2], z: 0, hp: 3, hw: 15, hd: 9, ht: 30, shake: 0 }));
    this.players.forEach((p, k) => {
      const s = keep[k]; if (!s) return;
      p.hp = Math.max(s.hp, p.maxhp * .55); p.hype = Math.max(30, Math.min(100, s.hype)); p.lives = s.lives;
      p.x = 80 + k * 26; p.y = 200 + k * 12; p.z = 0; p.vx = p.vy = p.vz = 0;
      p.state = 'idle'; p.dead = false; p.invuln = 100; p.held = null; p.hitChain = 0; this.setAnim(p, 'idle');
    });
    if (this.training) this.setupTraining();
  }
  setupTraining() {
    this.waveState = 'training'; this.cam.max = 760; this.items = []; this.props = [];
    ['barrel', 'crate'].forEach((t, i) => this.props.push({ kind: 'prop', type: t, x: 470 + i * 70, y: 176 + i * 26, z: 0, hp: 3, hw: 15, hd: 9, ht: 30, shake: 0 }));
    const d = this.makeEnemy('heavy', 330, 200);
    d.dummy = true; d.maxhp = d.hp = 9999; d.state = 'idle'; d.cool = 99999; d.face = -1; d.name = 'DUMMY';
    this.enemies = [d]; this.boss = null;
    this.resetDummy();
  }
  resetDummy() {
    this.enemies.forEach(e => { e.hp = e.maxhp; e.state = 'idle'; e.x = 330; e.y = 200; e.z = 0; e.vx = e.vy = e.vz = 0; e.stun = 0; e.cool = 99999; e.anim = 'idle'; e.frame = 0; });
    this.players.forEach((p, k) => { p.hp = p.maxhp; p.hype = 100; p.x = 200 + k * 30; p.y = 200; p.z = 0; p.state = 'idle'; p.dead = false; p.downT = 0; p.invuln = 20; });
    this.cam.x = 60; this.fx = []; this.toast = this.tr('train_hint');
  }
  setAnim(e, a) { if (e.anim !== a) { e.anim = a; e.frame = 0; e.ft = 0; e.done = false; } }
  restartAnim(e, a) { e.anim = a; e.frame = 0; e.ft = 0; e.done = false; }
  timing(kit, anim) {
    const k = this.meta && this.meta.kits[kit];
    const an = k && k.anims[anim];
    if (an && an.timing) return an.timing;
    return Art.TIMING[anim] || [6, 6, 6, 6];
  }
  advance(e, loop) {
    const T = this.timing(e.kitId, e.anim);
    e.ft++;
    while (e.ft >= (T[e.frame] || 6)) { e.ft -= (T[e.frame] || 6); e.frame++; if (e.frame >= T.length) { if (loop) e.frame = 0; else { e.frame = T.length - 1; e.done = true; e.ft = 0; break; } } }
  }
  atFrame(e, idx) { return e.frame === idx; }

  /* ---------------- input ---------------- */
  held(a, p) { return G.Input.isHeld(p ? 'p2' : 'p1', a); }
  just(a, p) { return G.Input.just(p ? 'p2' : 'p1', a); }
  consume(a, p) { return G.Input.consume(p ? 'p2' : 'p1', a); }
  axisX(p) { return (this.held('right', p) ? 1 : 0) - (this.held('left', p) ? 1 : 0); }
  axisY(p) { return (this.held('down', p) ? 1 : 0) - (this.held('up', p) ? 1 : 0); }

  /* ---------------- update ---------------- */
  update() {
    this.t++;
    const guest = this.mode === 'online' && this.net && !this.net.isHost();
    if (!guest) {
      if (this.screen === 'play' || this.screen === 'pause' || this.screen === 'clear' || this.screen === 'over' || this.screen === 'victory') this.updatePlay();
      this.updateScreen();
    } else if (this.screen === 'lobby' || this.screen === 'online' || this.screen === 'join') this.updateLobbyInput();
    if (this.net) this.net.tick(this);
    if (this.toast && this.toastT > 0) { if (--this.toastT <= 0) this.toast = null; }
  }
  updateScreen() {
    const I = G.Input;
    if (this.screen === 'join') { this.navJoin(); return; }
    if (this.screen === 'lobby') { this.navLobby(); return; }
    if (I.just('p1', 'pause') || I.just('p1', 'back')) this.onBack();
    if (this.screen === 'title') { if (I.just('p1', 'start') || I.just('p1', 'attack') || I.just('p1', 'jump')) this.goto('main'); }
    else if (this.screen === 'main' || this.screen === 'modes' || this.screen === 'settings' || this.screen === 'credits' || this.screen === 'howto' || this.screen === 'online') this.navScreen();
    else if (this.screen === 'select') this.navSelect();
    else if (this.screen === 'pause') this.navPause();
    else if (this.screen === 'clear') { if (I.just('p1', 'start') || I.just('p1', 'attack')) this.nextStage(); }
    else if (this.screen === 'over') this.navOver();
    else if (this.screen === 'victory') { if (I.just('p1', 'start') || I.just('p1', 'attack')) this.goto('title'); }
  }
  updateLobbyInput() {
    if (this.screen === 'join') this.navJoin();
    else if (this.screen === 'lobby') this.navLobby();
  }
  navScreen() {
    const sc = this.screen;
    const rows = sc === 'main' ? ['mode_solo', 'mode_local', 'mode_online', 'main_training', 'main_howto', 'main_settings', 'main_credits']
      : sc === 'settings' ? ['set_music', 'set_sfx', 'set_shake', 'set_flash', 'set_scan', 'set_lang', 'set_keys', 'set_back']
      : sc === 'online' ? ['online_host', 'online_join', 'online_local', 'mode_back']
      : sc === 'howto' ? ['mode_back'] : ['mode_back'];
    if (G.Input.just('p1', 'up')) { this.menu = (this.menu + rows.length - 1) % rows.length; this.blip(); }
    if (G.Input.just('p1', 'down')) { this.menu = (this.menu + 1) % rows.length; this.blip(); }
    const left = G.Input.just('p1', 'left'), right = G.Input.just('p1', 'right');
    if (sc === 'settings') this.adjust(this.menu, right ? 1 : left ? -1 : 0);
    if (G.Input.just('p1', 'start') || G.Input.just('p1', 'attack')) {
      if (sc === 'main') {
        if (this.menu === 0) { this.mode = 'solo'; this.goto('select'); }
        else if (this.menu === 1) { this.mode = 'local'; this.goto('select'); }
        else if (this.menu === 2) { this.mode = 'online'; this.goto('online'); }
        else if (this.menu === 3) { this.goto('training'); this.newGame('training', { stage: 0 }); }
        else if (this.menu === 4) { this.helpScroll = 0; this.goto('howto'); }
        else if (this.menu === 5) this.goto('settings');
        else this.goto('credits');
        this.blip(true);
      } else if (sc === 'settings') {
        if (this.menu === 7) this.goto('main');
        else if (this.menu === 6) this.cfg = { player: 0, row: 0, waiting: false };
        else this.adjust(this.menu, 1);
      } else if (sc === 'online') {
        if (this.menu === 0) this.startHost();
        else if (this.menu === 1) this.screen = 'join';
        else if (this.menu === 2) this.startHost('local');
        else this.goto('main');
      } else this.goto('main');
    }
    if (this.cfg) this.navRemap();
  }
  adjust(row, dir) {
    if (!dir) return;
    const s = this.settings;
    if (row === 0) s.music = clamp(Math.round((s.music + dir * .1) * 10) / 10, 0, 1);
    else if (row === 1) s.sfx = clamp(Math.round((s.sfx + dir * .1) * 10) / 10, 0, 1);
    else if (row === 2) s.shake = s.shake ? 0 : 1;
    else if (row === 3) s.flash = s.flash ? 0 : 1;
    else if (row === 4) s.scanlines = s.scanlines ? 0 : 1;
    else if (row === 5) { s.lang = s.lang === 'en' ? 'tr' : 'en'; }
    if (row <= 5) { G.saveSettings(s); this.blip(); }
    if (this.audio) this.audio.applySettings(s);
  }
  navRemap() {
    const c = this.cfg, keys = ACT;
    if (c.waiting) {
      const code = G.Input.captureKey();
      if (code) {
        const other = this.settings.keys[c.player ? 'p2' : 'p1'];
        if (Object.keys(other).some(k => k !== keys[c.row] && other[k] === code)) { this.toast = this.tr('keys_conflict'); this.toastT = 90; }
        else { other[keys[c.row]] = code; G.saveSettings(this.settings); c.waiting = false; this.blip(true); }
      }
      if (G.Input.just('p1', 'back')) c.waiting = false;
      return;
    }
    if (G.Input.just('p1', 'up')) { c.row = (c.row + keys.length - 1) % keys.length; this.blip(); }
    if (G.Input.just('p1', 'down')) { c.row = (c.row + 1) % keys.length; this.blip(); }
    if (G.Input.just('p1', 'left') || G.Input.just('p1', 'right')) { c.player = c.player ? 0 : 1; this.blip(); }
    if (G.Input.just('p1', 'start') || G.Input.just('p1', 'attack')) c.waiting = true;
    if (G.Input.just('p1', 'back')) this.cfg = null;
  }
  goto(s) {
    this.screen = s; this.menu = 0; this.sub = 0;
    if (this.net && s === 'title') this.net.leave();
    if (s === 'title' && this.audio) this.audio.music('title');
  }
  onBack() {
    const s = this.screen;
    if (s === 'title') return;
    if (s === 'play') { this.pause(); return; }
    if (s === 'pause') { this.resume(); return; }
    if (s === 'select') { this.goto('main'); return; }
    if (s === 'lobby') { this.leaveOnline(); return; }
    if (s === 'join' || s === 'online' || s === 'settings' || s === 'credits' || s === 'howto' || s === 'modes') { this.goto('main'); return; }
    if (s === 'clear') { this.nextStage(); return; }
    if (s === 'over' || s === 'victory') { this.goto('title'); return; }
    if (this.cfg) { this.cfg = null; return; }
  }
  navSelect() {
    const n = G.CH_ORDER.length;
    if (G.Input.just('p1', 'left')) { this.sel = (this.sel + n - 1) % n; this.blip(); }
    if (G.Input.just('p1', 'right')) { this.sel = (this.sel + 1) % n; this.blip(); }
    if (this.mode === 'local') {
      if (G.Input.just('p2', 'left')) { this.selP2 = (this.selP2 + n - 1) % n; this.blip(); }
      if (G.Input.just('p2', 'right')) { this.selP2 = (this.selP2 + 1) % n; this.blip(); }
    }
    if (G.Input.just('p1', 'start') || G.Input.just('p1', 'attack')) {
      this.p1 = G.CH_ORDER[this.sel];
      this.p2 = this.mode === 'local' ? G.CH_ORDER[this.selP2 === this.sel ? (this.selP2 + 1) % n : this.selP2] : 'vv';
      if (this.mode === 'online') { this.beginOnlineLobby(); return; }
      this.newGame(this.mode, { stage: this.settings.stage | 0 });
      this.blip(true);
    }
  }
  navPause() {
    const rows = ['pause_resume', 'pause_restart', 'pause_settings', 'pause_howto', 'pause_quit'];
    if (this.mode === 'online' && !this.isHost()) return;    /* guest waits for the host */
    if (G.Input.just('p1', 'up')) { this.menu = (this.menu + rows.length - 1) % rows.length; this.blip(); }
    if (G.Input.just('p1', 'down')) { this.menu = (this.menu + 1) % rows.length; this.blip(); }
    if (G.Input.just('p1', 'start') || G.Input.just('p1', 'attack')) {
      if (this.menu === 0) this.resume();
      else if (this.menu === 1) { this.restartStage(); }
      else if (this.menu === 2) { this.pauseHost = true; this.goto('settings'); this.returnScreen = 'pause'; }
      else if (this.menu === 3) { this.returnScreen = 'pause'; this.goto('howto'); }
      else { this.goto('title'); }
      this.blip(true);
    }
  }
  navOver() {
    const rows = ['over_continue', 'over_title_btn'];
    if (G.Input.just('p1', 'up') || G.Input.just('p1', 'left')) { this.menu = 0; this.blip(); }
    if (G.Input.just('p1', 'down') || G.Input.just('p1', 'right')) { this.menu = 1; this.blip(); }
    if (G.Input.just('p1', 'start') || G.Input.just('p1', 'attack')) {
      if (this.menu === 0) { this.lives = 3; this.newGame(this.mode, { stage: this.stageIdx }); }
      else this.goto('title');
      this.blip(true);
    }
  }
  blip(big) { if (this.audio) this.audio.sfx(big ? 'go' : 'ui'); }
  toastMsg(s) { this.toast = s; this.toastT = 100; }

  /* ---------------- play loop ---------------- */
  pause() {
    if (this.screen !== 'play') return;
    if (this.mode === 'online' && !this.isHost()) { this.toastMsg(this.tr('pause_waiting')); if (this.net) this.net.requestPause(true); return; }
    this.screen = 'pause'; this.menu = 0;
    if (this.audio) this.audio.duck(true);
    if (this.net) this.net.sendPause(true);
  }
  resume() {
    this.screen = 'play'; this.menu = 0;
    if (this.audio) this.audio.duck(false);
    if (this.net) this.net.sendPause(false);
    G.Input.clear();
  }
  restartStage() {
    if (this.net && this.mode === 'online' && !this.isHost()) { this.net.requestRestart(); return; }
    this.carry = null; this.lives = Math.max(3, this.lives);
    this.newGame(this.mode, { stage: this.stageIdx });
    if (this.net) this.net.sendRestart(this);
  }
  nextStage() {
    if (this.net && this.mode === 'online' && !this.isHost()) return;
    if (this.stageIdx >= G.STAGES.length - 1) { this.goto('victory'); return; }
    const keep = this.players.map(p => ({ charId: p.charId, hp: p.hp, hype: p.hype }));
    this.stageIdx++;
    this.loadStage(this.stageIdx);
    this.players.forEach((p, k) => { const s = keep[k]; if (s) { p.hp = Math.max(p.maxhp * .6, s.hp + p.maxhp * .25); p.hype = Math.max(35, s.hype); } });
    this.lives = Math.max(this.lives, 2);
    this.screen = 'play'; this.banner = 150;
    if (this.audio) this.audio.music(G.STAGES[this.stageIdx].music);
    if (this.net) this.net.sendRestart(this);
  }
  updatePlay() {
    if (this.screen === 'play') {
      if (this.training) {
        if (G.Input.just('p1', 'pause')) { this.goto('title'); return; }
        if (G.Input.consume('p1', 'grab') && G.Input.held.p1.up) this.resetDummy();
      }
      if (this.hitstop > 0) { this.hitstop--; this.shake *= .9; return; }
      this.tick++;
      for (const p of this.players) this.updatePlayer(p);
      for (const e of this.enemies) this.updateEnemy(e);
      this.separate();
      this.updateProjs();
      this.props.forEach(p => { if (p.shake > 0) p.shake--; });
      this.updateItems(); this.updateFx();
      if (!this.training) this.updateWaves();
      this.updateCamera();
      this.enemies = this.enemies.filter(e => !e.remove);
      this.props = this.props.filter(p => !p.remove);
      if (this.banner > 0) this.banner--;
      if (this.shake > 0) this.shake *= .86;
      if (this.shake < .2) this.shake = 0;
      if (this.flashT > 0) this.flashT--;
      if (this.combo.t > 0) { this.combo.t--; if (!this.combo.t) this.combo.n = 0; }
      if (this.combo.pop > 0) this.combo.pop -= .6;
      if (this.training) this.enemies.forEach(e => { if (e.hp < 1) e.hp = e.maxhp; });
      this.checkDefeat();
    } else if (this.hitstop > 0) this.hitstop--;
  }
  checkDefeat() {
    if (this.training) return;
    const live = this.players.filter(p => !p.dead && p.state !== 'downed');
    if (live.length) return;
    if (this.mode !== 'solo' && this.lives > 0 && this.players.some(p => p.state === 'downed')) return;
    this.screen = 'over'; this.menu = 0;
    if (this.audio) this.audio.sfx('ko');
    if (this.net && this.isHost()) this.net.sendOver(this);
  }

  /* ---------------- fighters ---------------- */
  updatePlayer(p) {
    if (p.dead) { this.advance(p, false); return; }
    if (p.invuln > 0) p.invuln--;
    if (p.flash > 0) p.flash--;
    if (p.chainTimer > 0 && --p.chainTimer === 0) p.hitChain = 0;
    this.settle(p);
    switch (p.state) {
      case 'idle': case 'walk': this.playerGround(p); break;
      case 'attack': this.playerAttack(p); break;
      case 'jump': case 'jatk': case 'jdown': this.playerAir(p); break;
      case 'land': this.advance(p, false); p.vx *= .8; p.vy *= .8; if (p.done) { p.state = 'idle'; this.setAnim(p, 'idle'); } break;
      case 'special': this.playerSpecial(p); break;
      case 'grab': case 'gstrike': case 'throw': this.playerGrab(p); break;
      case 'hit': this.advance(p, false); p.x += p.vx; p.vx *= .86; p.y += p.vy; p.vy *= .86; if (--p.stun <= 0) { p.state = 'idle'; this.setAnim(p, 'idle'); } break;
      case 'knock': this.knockStep(p); break;
      case 'down': this.downStep(p, 46); break;
      case 'downed': this.downedStep(p); break;
      case 'getup': this.advance(p, false); if (p.done) { p.state = 'idle'; this.setAnim(p, 'idle'); } break;
      case 'dead': this.advance(p, false); break;
      case 'win': this.advance(p, true); break;
    }
    if (p.state !== 'down' && p.state !== 'downed' && p.state !== 'knock') {
      p.x = clamp(p.x, this.cam.x + 10, Math.min(this.cam.x + G.LW - 10, this.stage.len - 10));
      p.y = clamp(p.y, FT, FB);
    }
    this.pickupCheck(p);
  }
  settle(e) { if (e.z > 0 && !['knock', 'jump', 'jatk', 'jdown', 'down', 'downed', 'dead'].includes(e.state)) { e.vz -= GRAV; e.z += e.vz; if (e.z <= 0) { e.z = 0; e.vz = 0; } } }
  playerGround(p) {
    const ax = this.axisX(p.pid), ay = this.axisY(p.pid);
    if (ax) p.face = ax;
    if (this.consume('jump', p.pid) && p.state !== 'land') { p.state = 'jump'; p.vz = JUMPV; p.vx *= .9; p.vy *= .6; this.setAnim(p, 'jump'); if (this.audio) this.audio.sfx('jump'); return; }
    if (this.consume('special', p.pid) && p.hype > 3) { this.startSpecial(p); return; }
    if (this.consume('attack', p.pid)) { this.startAttack(p, p.chainTimer > 0 && p.step < 2 ? p.step + 1 : 0); return; }
    if (this.consume('grab', p.pid)) { this.tryGrab(p); if (p.state === 'grab') return; }
    const spd = p.baseSpd;
    let tx = ax * spd, ty = ay * WALKY * (p.def.spd);
    if (ax && ay) { tx *= .82; ty *= .82; }
    p.vx += (tx - p.vx) * .45; p.vy += (ty - p.vy) * .45;
    if (Math.abs(p.vx) < .06) p.vx = 0;
    if (Math.abs(p.vy) < .06) p.vy = 0;
    p.x += p.vx; p.y += p.vy;
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > .25) {
      p.state = 'walk'; this.setAnim(p, 'walk'); this.walkPhase(p, sp);
    } else { if (p.state === 'walk') { p.state = 'idle'; this.setAnim(p, 'idle'); } this.advance(p, true); }
  }
  walkPhase(e, sp) { e.phase = (e.phase + sp / e.stride) % 1; e.frame = Math.floor(e.phase * 8) % 8; }
  startAttack(p, step) {
    p.state = 'attack'; p.step = clamp(step, 0, 2); p.hitSet = new Set(); p.swung = false;
    p.vx *= .15; p.vy *= .15;
    this.restartAnim(p, ['a1', 'a2', 'a3'][p.step]);
    if (this.audio) this.audio.sfx('swing');
  }
  playerAttack(p) {
    const mv = p.def.moves[p.step];
    /* a tap during the move is queued and fires on recovery: forgiving, not mashed */
    if (this.consume('attack', p.pid)) p.queued = true;
    this.advance(p, false);
    p.x += p.vx; p.vx *= .78;
    if (mv.active.includes(p.frame)) {
      if (p.step === 2 && p.frame === 2 && !p.lunged2) { p.lunged2 = true; p.vx = p.face * 2.1; }
      this.strike(p, mv, p.hitSet);
    }
    if (p.done) {
      p.lunged2 = false;
      const next = p.queued && p.step < 2 ? p.step + 1 : 0;
      p.queued = false;
      p.chainTimer = next ? 16 : 0;
      p.step = next;
      if (next) { this.startAttack(p, next); return; }
      p.state = 'idle'; this.setAnim(p, 'idle');
    }
  }
  playerAir(p) {
    const ax = this.axisX(p.pid), ay = this.axisY(p.pid);
    p.vz -= GRAV; p.z += p.vz;
    p.vx += (ax * p.baseSpd * .9 - p.vx) * .08; p.vy += (ay * .8 - p.vy) * .08;
    p.x += p.vx; p.y += p.vy;
    if (p.state === 'jump') {
      p.frame = p.vz > 1.2 ? 0 : p.vz > -1.2 ? 1 : 2;
      if (this.consume('attack', p.pid)) {
        p.hitSet = new Set();
        if (ay > 0) { p.state = 'jdown'; this.restartAnim(p, 'jdown'); p.vz = Math.min(p.vz, -2); }
        else { p.state = 'jatk'; this.restartAnim(p, 'jatk'); }
        if (this.audio) this.audio.sfx('swing');
      }
    } else {
      this.advance(p, false);
      const air = p.state === 'jatk'
        ? { box: { x0: 0, x1: 46, tol: 16, z0: p.z - 20, z1: p.z + 26 }, dmg: 7, kb: 1.8, stun: 16, hs: 4, hype: 4, active: [0, 1, 2] }
        : { box: { x0: -6, x1: 36, tol: 16, z0: 0, z1: p.z + 20 }, dmg: 10, kb: 2.6, stun: 20, hs: 5, hype: 5, knock: true, launch: 2.4, active: [0, 1] };
      air.box.z0 += p.z; air.box.z1 += p.z;
      if (air.active.includes(p.frame)) this.strike(p, air, p.hitSet);
    }
    if (p.z <= 0 && p.vz < 0) {
      p.z = 0; p.vz = 0; p.state = 'land'; this.restartAnim(p, 'land');
      this.dust(p.x, p.y, 2); if (this.audio) this.audio.sfx('land');
    }
  }
  startSpecial(p) {
    p.state = 'special'; p.spT = 0; p.pulses = 0; p.vx = p.vy = 0; p.hitSet = new Set();
    this.restartAnim(p, 'special');
    if (this.audio) this.audio.sfx('special');
    this.fx.push({ type: 'ring', x: p.x, y: p.y, z: 6, life: 18, age: 0 });
  }
  playerSpecial(p) {
    if (!this.held('special', p.pid) || p.hype <= 0) { p.state = 'idle'; this.setAnim(p, 'idle'); return; }
    p.hype = Math.max(0, p.hype - DRAIN);
    this.advance(p, true); p.spT++;
    const sp = p.def.spec;
    if (p.spT % sp.every === 1) { p.hitSet = new Set(); p.pulses++; }
    if (p.spT % sp.every < 4) this.strike(p, sp, p.hitSet, { special: true, knock: p.pulses % sp.knockEvery === 0, launch: 2.6 });
    if (p.spT % 9 === 0) this.fx.push({ type: 'ring', x: p.x + p.face * 26, y: p.y, z: 20, life: 12, age: 0 });
  }
  tryGrab(p) {
    let best = null, bd = 1e9;
    for (const e of this.enemies) {
      if (!this.grabbable(e)) continue;
      const dx = (e.x - p.x) * p.face;
      if (dx < -8 || dx > 34 || Math.abs(e.y - p.y) > 13) continue;
      if (dx < bd) { bd = dx; best = e; }
    }
    if (!best) return;
    p.state = 'grab'; p.held = best; p.grabT = 0; p.gcount = 0; this.restartAnim(p, 'grab');
    p.vx = p.vy = 0;
    best.state = 'held'; best.heldBy = p; best.grabT = 0; best.atk = null; best.armor = false; best.warn = false;
    if (this.audio) this.audio.sfx('grab');
  }
  grabbable(e) {
    if (e.team !== 'e' || e.remove || e.z > 1 || e.dummy) return false;
    if (['idle', 'walk', 'hit', 'stun'].includes(e.state)) return true;
    return e.state === 'attack' && e.atk && e.atk.phase === 'windup' && !e.def.boss;
  }
  releaseHold(p) { const e = p.held; if (e) { e.heldBy = null; if (e.state === 'held') { e.state = 'idle'; e.cool = 40; this.setAnim(e, 'idle'); } } p.held = null; }
  playerGrab(p) {
    const e = p.held;
    if (!e || e.state !== 'held') { p.held = null; p.state = 'idle'; this.setAnim(p, 'idle'); return; }
    e.x += (p.x + p.face * 20 - e.x) * .45; e.y += (p.y - e.y) * .45; e.face = -p.face; e.grabT++;
    if (e.grabT > (e.def.boss ? 80 : 130)) { this.releaseHold(p); p.state = 'idle'; p.invuln = 14; return; }
    if (p.state === 'grab') {
      this.advance(p, true);
      if (this.consume('attack', p.pid)) { p.state = 'gstrike'; this.restartAnim(p, 'gstrike'); p.struck = false; }
      else if (this.consume('grab', p.pid) || this.consume('jump', p.pid)) {
        const ax = this.axisX(p.pid); if (ax) p.face = ax;
        p.state = 'throw'; this.restartAnim(p, 'throw'); p.thrown = false;
      }
    } else if (p.state === 'gstrike') {
      this.advance(p, false);
      if (p.frame >= 1 && !p.struck) {
        p.struck = true;
        p.gcount++;
        const strike = { dmg: p.gcount % 3 === 0 ? 10 : 5, kb: .5, stun: 22, hs: 4, hype: 5, knock: p.gcount % 3 === 0, launch: 2.6 };
        this.hurt(e, p, strike, { grab: true });
        if (p.gcount % 3 === 0 || e.state !== 'held') { p.held = null; e.heldBy = null; }
      }
      if (p.done) { p.state = p.held ? 'grab' : 'idle'; this.restartAnim(p, p.held ? 'grab' : 'idle'); }
    } else if (p.state === 'throw') {
      this.advance(p, false);
      if (p.frame >= 1 && !p.thrown) {
        p.thrown = true;
        e.x = p.x + p.face * 16; e.z = 18; e.face = -p.face;
        e.heldBy = null; p.held = null;
        this.hurt(e, p, { dmg: 11, kb: 0, stun: 20, hs: 5, hype: 8, knock: true, launch: 1 }, { throwStart: true });
        e.vx = p.face * 5.2; e.vz = 3.2; e.thrown = true; e.thrownHit = new Set([e]); e.owner = p;
        if (this.audio) this.audio.sfx('throw');
      }
      if (p.done) { p.state = 'idle'; this.setAnim(p, 'idle'); }
    }
  }
  knockStep(e) {
    e.vz -= GRAV; e.z += e.vz; e.x += e.vx; e.y = clamp(e.y + (e.vy || 0), FT, FB); e.vx *= .985;
    if (e.team === 'p') e.x = clamp(e.x, this.cam.x + 6, this.cam.x + G.LW - 6);
    e.anim = 'knock'; e.frame = (e.vz > 0 || e.z > 16) ? 0 : 1;
    if (e.thrown && e.team === 'e') {
      const mv = { box: { x0: -16, x1: 16, tol: 13, z0: 0, z1: 50 }, dmg: 9, kb: 2.4, stun: 22, hs: 5, hype: 0, knock: true, launch: 2.2, owner: e.owner };
      this.strike(e, mv, e.thrownHit);
    }
    if (e.z <= 0 && e.vz < 0) {
      e.z = 0; e.vz = 0; e.vx *= .4; e.thrown = false;
      e.state = e.hp <= 0 ? 'dead' : 'down'; e.downT = 0;
      this.restartAnim(e, e.hp <= 0 ? 'dead' : 'down');
      this.dust(e.x, e.y, 3); this.shake = Math.max(this.shake, 2.4); if (this.audio) this.audio.sfx('land');
      if (e.team === 'p' && e.hp <= 0) this.playerDowned(e);
    }
  }
  downStep(e, wait) {
    e.downT++; e.x += e.vx; e.vx *= .86;
    e.anim = 'down'; e.frame = e.downT < 12 ? 0 : 1;
    if (e.team === 'p') e.x = clamp(e.x, this.cam.x + 8, this.cam.x + G.LW - 8);
    if (e.downT > wait) {
      if (e.team === 'e') { e.state = 'getup'; this.restartAnim(e, 'getup'); e.invuln = 30; }
      else { e.state = 'idle'; this.setAnim(e, 'idle'); e.invuln = 50; }
    }
  }
  downedStep(p) {
    p.downT++;
    p.anim = 'down'; p.frame = 1;
    const partner = this.players.find(o => o !== p && !o.dead && o.state !== 'downed');
    if (partner && this.lives > 0) {
      const near = Math.abs(partner.x - p.x) < 34 && Math.abs(partner.y - p.y) < 22;
      p.reviveT = near ? (p.reviveT || 0) + 1 : 0;
      if (p.reviveT > 80) {
        this.lives--;
        p.state = 'idle'; p.dead = false; p.hp = Math.round(p.maxhp * .55); p.invuln = 120; p.downT = 0;
        this.setAnim(p, 'idle');
        this.fx.push({ type: 'heal', x: p.x, y: p.y, z: 30, life: 26, age: 0 });
        if (this.audio) this.audio.sfx('pick');
        return;
      }
    }
    if (p.downT > 420) {
      p.dead = true; p.state = 'dead'; this.lives--;
      if (this.lives <= 0) { this.screen = 'over'; this.menu = 0; if (this.audio) this.audio.sfx('ko'); }
    }
  }
  playerDowned(p) {
    if (this.mode === 'solo' || this.training) {
      if (this.lives > 1) {
        this.lives--; p.hp = p.maxhp; p.state = 'idle'; p.invuln = 150; p.hitChain = 0; p.z = 0;
        p.x = this.cam.x + 80; p.y = 200; this.setAnim(p, 'idle'); this.dust(p.x, p.y, 4);
        return;
      }
      this.lives--;
      p.state = 'dead'; p.dead = true;
      this.screen = 'over'; this.menu = 0;
      if (this.audio) this.audio.sfx('ko');
      if (this.net && this.isHost()) this.net.sendOver(this);
      return;
    }
    p.state = 'downed'; p.downT = 0; p.reviveT = 0;
    if (this.audio) this.audio.sfx('ko');
  }
  /* ---------------- hit detection ---------------- */
  strike(att, mv, hitSet, extra) {
    mv = Object.assign({}, mv, extra || {});
    const f = att.face, b = mv.box;
    const x0 = att.x + (f > 0 ? b.x0 : -b.x1), x1 = att.x + (f > 0 ? b.x1 : -b.x0);
    const z0 = att.z + b.z0, z1 = att.z + b.z1;
    /* a thrown enemy keeps the thrower's allegiance: friendly bowling only */
    const allied = att.team === 'p' || !!(mv.owner && mv.owner.team === 'p');
    const targets = allied ? this.enemies.concat(this.props) : this.players;
    let hit = false;
    for (const t of targets) {
      if (hitSet.has(t) || t === att || t.remove) continue;
      if (t.kind !== 'prop') {
        if (t.invuln > 0 || ['down', 'downed', 'dead', 'getup', 'knock'].includes(t.state)) continue;
      }
      if (x1 < t.x - t.hw || x0 > t.x + t.hw) continue;
      if (Math.abs(t.y - att.y) > (b.tol || 14) + t.hd) continue;
      if (z1 < t.z || z0 > t.z + (t.ht || 30)) continue;
      hitSet.add(t); this.hurt(t, att, mv); hit = true;
    }
    return hit;
  }
  hurt(t, a, mv, opt) {
    opt = opt || {};
    const who = mv.owner || a;
    const f = who.face || 1;
    const sx = t.x - f * 8, sz = clamp((mv.box ? (mv.box.z0 + mv.box.z1) / 2 : 30) + (a.z || 0), 8, (t.ht || 50) - 4);
    if (t.kind === 'prop') {
      t.hp -= mv.special ? .5 : 1; t.shake = 8;
      this.spark(sx, t.y, sz, false, who.pid);
      if (this.audio) this.audio.sfx('hit');
      this.hitstop = Math.max(this.hitstop, 2);
      if (t.hp <= 0) this.breakProp(t);
      return;
    }
    if (!t.dummy) t.hp -= mv.dmg;
    t.flash = 4;
    if (t.dummy) t.hp = t.maxhp;
    let knock = !!mv.knock || t.hitChain >= 2 || t.z > 1 || (t.hp <= 0 && !t.dummy);
    if (t.def && t.def.poise) {
      t.poise -= mv.dmg;
      if (t.poise <= 0) { knock = true; t.poise = t.def.poise; }
      else if (t.hp > 0 && !mv.knock) knock = false;
    }
    if (t.state === 'special' && !mv.knock) knock = false;
    if (t.state === 'attack' && t.armor && !mv.knock) knock = false;
    if (t.held && t.team === 'p') { /* player grabbed: release */ this.releaseHold(t); }
    if (knock && !t.dummy) {
      if (t.heldBy) { t.heldBy.held = null; t.heldBy.state = 'idle'; this.setAnim(t.heldBy, 'idle'); }
      t.heldBy = null; t.state = 'knock'; t.vz = mv.launch || 2.8;
      t.vx = f * (mv.kb || 2.4); t.atk = null; t.armor = false; t.warn = false; t.hitChain = 0;
      this.restartAnim(t, 'knock'); t.thrown = !!opt.throwStart ? false : t.thrown;
      if (opt.throwStart) { t.thrown = false; }
    } else if (!t.dummy) {
      if (t.state !== 'held') {
        t.state = 'hit'; t.stun = mv.stun || 16; t.vx = f * (mv.kb || 1.4); t.vy = 0;
        t.atk = null; t.armor = false; t.warn = false; t.hitChain++; t.chainTimer = 55;
        this.restartAnim(t, 'hit');
      }
    }
    const heavy = knock || (mv.dmg || 0) >= 9;
    this.hitstop = Math.max(this.hitstop, mv.hs || 3);
    this.shake = Math.max(this.shake, heavy ? 3.4 : 1.5);
    this.spark(sx, t.y, sz, heavy, who.pid);
    if (this.audio) this.audio.sfx(t.hp <= 0 && !t.dummy ? 'ko' : heavy ? 'heavy' : 'hit');
    if (who.team === 'p') {
      if (t.team === 'e') {
        const pts = Math.round((mv.dmg || 0) * 12);
        this.score += pts;
        if (t.hp <= 0 && !t.dummy) { this.score += t.def.score; t.remove = false; }
        if (t.def.boss) this.boss = t;
      }
      if (!mv.special) who.hype = Math.min(100, who.hype + (mv.hype || 4));
      this.combo.n++; this.combo.t = 110; this.combo.pop = 8;
    }
    if (t.team === 'p') {
      this.combo.n = 0;
      if (this.mode === 'online' && this.isHost()) this.net.sendShake(this, this.shake);
    }
  }
  breakProp(p) {
    p.remove = true;
    if (this.audio) this.audio.sfx('smash');
    this.shake = Math.max(this.shake, 2);
    const col = p.type === 'barrel' ? 0x3b6aa8 : p.type === 'bin' ? 0x7d8590 : 0xa8702f;
    for (let i = 0; i < 10; i++) this.fx.push({ type: 'debris', x: p.x + rnd(-8, 8), y: p.y, z: rnd(8, 22), vx: rnd(-2, 2), vy: rnd(-.3, .3), vz: rnd(1.6, 3.6), life: 40, age: 0, col: col });
    this.dust(p.x, p.y, 3);
    if (Math.random() < .78) this.items.push({ type: G.pick(DROPS), x: p.x, y: p.y, z: 20, vz: 2, life: 780, t: 0 });
  }

  /* ---------------- enemies ---------------- */
  makeEnemy(type, x, y) {
    const d = G.ED[type], kit = Art.KITS[d.kit], diff = DIFF[this.diff] || DIFF[1];
    const hp = Math.round(d.hp * (this.mode === 'local' || this.mode === 'online' ? diff.hp * 1.15 : diff.hp));
    return {
      kind: 'fighter', team: 'e', uid: (G._uid = (G._uid || 0) + 1), type: type, def: d, kitId: d.kit,
      x: x, y: y, z: 0, vx: 0, vy: 0, vz: 0, face: x > 240 ? -1 : 1,
      hp: hp, maxhp: hp, state: 'spawn', anim: 'walk', frame: 0, ft: 0, phase: 0,
      hw: (d.hw || 12) * kit.b.s, hd: 8, ht: 64 * kit.b.s, stride: 44 * kit.b.s,
      invuln: 0, flash: 0, hitChain: 0, chainTimer: 0, poise: d.poise || 0, cool: 30 + Math.random() * 40,
      token: false, ring: 74, laneOff: rnd(-24, 24), atk: null, armor: false, warn: false,
      downT: 0, deadT: 0, retreat: 0, boss: !!d.boss, dummy: false
    };
  }
  nearestPlayer(e) {
    let best = null, bd = 1e9;
    for (const p of this.players) {
      if (p.dead || p.state === 'downed') continue;
      const d = Math.abs(p.x - e.x) + Math.abs(p.y - e.y) * 2.2;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  updateEnemy(e) {
    if (e.remove) return;
    if (e.flash > 0) e.flash--;
    if (e.cool > 0) e.cool--;
    if (e.invuln > 0) e.invuln--;
    if (e.chainTimer > 0 && --e.chainTimer === 0) e.hitChain = 0;
    this.settle(e);
    switch (e.state) {
      case 'spawn': {
        e.x += e.face * -1 * 0; e.x += (e.face > 0 ? 1 : -1) * -1.7 * -1;
        /* face points into the arena, so walk along it - the old sign walked
           right-side spawns away from the camera forever. */
        e.x += e.face * 1.7;
        this.setAnim(e, 'walk'); this.walkPhase(e, 1.7);
        if (e.x > this.cam.x + 26 && e.x < this.cam.x + G.LW - 26) e.state = 'idle';
        break;
      }
      case 'idle': case 'retreat': this.aiThink(e); break;
      case 'attack': this.aiAttack(e); break;
      case 'charge': this.aiCharge(e); break;
      case 'hit': this.advance(e, false); e.x += e.vx; e.vx *= .86; e.y += e.vy || 0; e.vy *= .86; if (--e.stun <= 0) { e.state = 'idle'; this.setAnim(e, 'idle'); } break;
      case 'knock': this.knockStep(e); break;
      case 'down': this.downStep(e, e.boss ? 52 : 44); break;
      case 'getup': this.advance(e, false); if (e.done) { e.state = 'idle'; this.setAnim(e, 'idle'); e.cool = 16; } break;
      case 'dead': e.deadT++; e.x += e.vx; e.vx *= .86; e.anim = 'dead'; e.frame = 0; if (e.deadT > 60) e.remove = true; break;
      case 'held': e.anim = 'held'; e.frame = 0; if (!e.heldBy) { e.state = 'idle'; e.cool = 26; } break;
    }
    if (!['knock', 'down', 'dead', 'spawn'].includes(e.state)) {
      e.x = clamp(e.x, this.cam.x - 50, this.cam.x + G.LW + 50);
      e.y = clamp(e.y, FT, FB);
    }
  }
  updateTokens() {
    const ps = this.players.filter(p => !p.dead && p.state !== 'downed');
    if (!ps.length) return;
    const diff = DIFF[this.diff] || DIFF[1];
    const grunts = this.enemies.filter(e => !e.boss && !e.dummy && !e.remove && !['dead', 'down', 'knock', 'spawn', 'held', 'getup'].includes(e.state));
    const busy = (e) => e.state === 'attack' || e.state === 'charge';
    grunts.forEach(e => { if (!busy(e)) e.token = false; });
    const slots = this.stage ? this.stage.tokens + (this.players.length - 1) : 2;
    const free = Math.max(0, Math.min(slots, diff.slots + (this.players.length - 1)) - grunts.filter(busy).length);
    const sorted = grunts.filter(e => !busy(e)).sort((a, b) => Math.abs(a.x - ps[0].x) - Math.abs(b.x - ps[0].x));
    sorted.slice(0, free).forEach(e => e.token = true);
    /* spread the crowd across lanes so they do not stack into one wall */
    grunts.forEach((e, i) => {
      const n = grunts.length;
      const t = n > 1 ? i / (n - 1) : .5;
      e.laneOff = (t - .5) * 84;
      e.ring = (66 + (i % 3) * 18);
    });
  }
  aiThink(e) {
    const p = this.nearestPlayer(e);
    if (!p) { this.setAnim(e, 'idle'); this.advance(e, true); return; }
    const dx = p.x - e.x, dy = p.y - e.y, adx = Math.abs(dx), ady = Math.abs(dy);
    if (adx > 2) e.face = dx > 0 ? 1 : -1;
    const spd = e.def.spd, diff = DIFF[this.diff] || DIFF[1];
    let tvx = 0, tvy = 0;
    const lane = (ty, k) => { const d = ty - e.y; tvy = clamp(d * .22, -spd * .8, spd * .8) * (Math.abs(d) < 2 ? 0 : 1) * (k || 1); };
    if (e.retreat > 0) {
      e.retreat--; tvx = -e.face * spd * .9; lane(p.y + e.laneOff * .4);
    } else if (e.token || e.boss || e.dummy) {
      if (e.dummy) { this.setAnim(e, 'idle'); this.advance(e, true); return; }
      const mvName = e.next && G.EM[e.next] ? e.next : (e.next = G.pick(e.def.moves));
      const mv = G.EM[mvName];
      const range = (mv.reach || 44) + 4;
      if (e.cool > 0) {
        if (adx > range + 14) tvx = e.face * spd * .62; else if (adx < range - 18) tvx = -e.face * spd * .45;
        lane(p.y + e.laneOff * .3, .7);
        if (adx < range + 20) tvx *= .4;
      } else if (mv.ranged) {
        if (adx >= 90 && adx <= 170 && ady < 10) { this.startEnemyAttack(e, mvName); return; }
        if (adx < 90) tvx = -e.face * spd; else if (adx > 170) tvx = e.face * spd * .8;
        lane(p.y);
      } else if (mv.kind === 'charge') {
        if (adx >= 76 && adx <= 240 && ady < 10) { this.startEnemyAttack(e, mvName); return; }
        tvx = adx < 76 ? -e.face * spd : e.face * spd * .7; lane(p.y);
      } else {
        if (adx <= range && ady <= 8) { this.startEnemyAttack(e, mvName); return; }
        if (adx > range - 6) tvx = e.face * spd;
        lane(p.y);
      }
    } else {
      const ring = e.ring;
      if (adx > ring + 16) tvx = e.face * spd * .8;
      else if (adx < ring - 20) tvx = -e.face * spd * .6;
      lane(p.y + e.laneOff, .8);
      if (Math.random() < .004) e.retreat = 30;
    }
    e.vx += (tvx - e.vx) * .28; e.vy += (tvy - e.vy) * .28;
    if (Math.abs(e.vx) < .03) e.vx = 0;
    if (Math.abs(e.vy) < .03) e.vy = 0;
    e.x += e.vx; e.y += e.vy;
    if (Math.hypot(e.vx, e.vy) > .25) { this.setAnim(e, 'walk'); this.walkPhase(e, Math.hypot(e.vx, e.vy)); }
    else { this.setAnim(e, 'idle'); this.advance(e, true); }
  }
  startEnemyAttack(e, name) {
    const mv = G.EM[name];
    e.state = 'attack'; e.atk = { name: name, mv: mv, phase: 'windup', t: 0, hitSet: new Set(), fired: false };
    e.vx = e.vy = 0; this.restartAnim(e, mv.anim); e.armor = !!mv.armor; e.next = null; e.warn = true;
    e.windScale = e.def.boss && e.hp < e.maxhp * .35 ? .68 : 1;
    if (this.audio) this.audio.sfx('warn');
  }
  aiAttack(e) {
    const a = e.atk;
    if (!a) { e.state = 'idle'; return; }
    const mv = a.mv;
    if (a.phase === 'windup') {
      a.t++; e.frame = 0; e.ft = 0;
      const p = this.nearestPlayer(e);
      if (p && a.t < mv.windup * .55) e.face = p.x >= e.x ? 1 : -1;
      if (a.t >= mv.windup * (e.windScale || 1)) {
        e.warn = false;
        if (mv.kind === 'charge') { e.state = 'charge'; e.ct = 0; e.hitSet = new Set(); this.setAnim(e, 'run'); e.armor = true; return; }
        a.phase = 'strike'; e.frame = 1; e.ft = 0;
        if (mv.kind === 'proj') { this.fireProj(e, mv); a.fired = true; }
      }
      return;
    }
    this.advance(e, false);
    if ((mv.active || [1]).includes(e.frame) && mv.kind !== 'proj') {
      if (!a.swung) { a.swung = true; if (this.audio) this.audio.sfx('swing'); }
      const box = { x0: 6, x1: mv.reach, tol: mv.tol, z0: 0, z1: 62 };
      this.strike(e, { box: box, dmg: mv.dmg * (DIFF[this.diff] ? DIFF[this.diff].dmg : 1), kb: mv.kb, stun: mv.stun, hs: mv.hs, knock: mv.knock, launch: mv.launch, active: mv.active }, a.hitSet);
    }
    if (e.done) this.endEnemyAttack(e);
  }
  endEnemyAttack(e) {
    const mv = e.atk ? e.atk.mv : null;
    e.atk = null; e.armor = false; e.warn = false; e.state = 'idle'; this.setAnim(e, 'idle');
    e.cool = mv ? mv.cool * (DIFF[this.diff] ? DIFF[this.diff].cool : 1) * (e.def.boss && e.hp < e.maxhp * .35 ? .6 : 1) : 40;
    if (e.def.retreat) { e.retreat = 30; e.state = 'retreat'; }
    e.next = null;
  }
  aiCharge(e) {
    const mv = e.atk.mv;
    e.ct++; e.x += e.face * mv.speed;
    this.setAnim(e, 'run'); e.phase = (e.phase + mv.speed / 44) % 1; e.frame = Math.floor(e.phase * 4) % 4;
    const hit = this.strike(e, { box: { x0: -6, x1: 30, tol: mv.tol, z0: 0, z1: 62 }, dmg: mv.dmg * (DIFF[this.diff] ? DIFF[this.diff].dmg : 1), kb: mv.kb, stun: mv.stun, hs: mv.hs, knock: mv.knock, launch: 2.8 }, e.hitSet);
    const edge = (e.x < this.cam.x + 6 && e.face < 0) || (e.x > this.cam.x + G.LW - 6 && e.face > 0);
    if (e.ct > mv.dur || hit || edge) {
      e.atk = null; e.armor = false; e.state = 'hit'; e.stun = hit ? 18 : 40; this.restartAnim(e, 'hit');
      e.cool = mv.cool; e.vx = 0; e.hitChain = 0;
    }
  }
  fireProj(e, mv) {
    if (this.audio) this.audio.sfx('throw');
    this.projs.push({ x: e.x + e.face * 16, y: e.y, z: 34, vx: e.face * 3.2, life: 140, dmg: mv.dmg, owner: e });
  }
  updateProjs() {
    for (const pr of this.projs) {
      pr.x += pr.vx; pr.life--;
      if (pr.x < this.cam.x - 40 || pr.x > this.cam.x + G.LW + 40) pr.life = 0;
      for (const p of this.players) {
        if (p.dead || p.invuln > 0 || ['down', 'downed', 'knock', 'getup'].includes(p.state)) continue;
        if (Math.abs(p.x - pr.x) < p.hw + 5 && Math.abs(p.y - pr.y) < 12 && pr.z > p.z && pr.z < p.z + p.ht) {
          pr.life = 0;
          this.hurt(p, { x: pr.x, face: sgn(pr.vx), team: 'e' }, { dmg: pr.dmg, kb: 1.8, stun: 16, hs: 3, box: { z0: 20, z1: 40 } });
        }
      }
    }
    this.projs = this.projs.filter(p => p.life > 0);
  }
  separate() {
    const L = [...this.players.filter(p => !p.dead), ...this.enemies].filter(e => !['knock', 'down', 'downed', 'dead', 'held', 'spawn'].includes(e.state) && e.z < 4);
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const a = L[i], b = L[j];
      const rx = (a.hw + b.hw) * .95, ry = 11;
      const dx = b.x - a.x, dy = b.y - a.y;
      const nx = dx / rx, ny = dy / ry, d2 = nx * nx + ny * ny;
      if (d2 >= 1 || d2 < 1e-6) continue;
      const d = Math.sqrt(d2), m = (1 - d) * .85;
      const wa = a.team === 'p' ? .35 : 1, wb = b.team === 'p' ? .35 : 1;
      const ux = nx / d, uy = ny / d;
      a.x -= ux * m * wa * (rx / 18); b.x += ux * m * wb * (rx / 18);
      a.y -= uy * m * wa * .55; b.y += uy * m * wb * .55;
    }
  }

  /* ---------------- pickups / fx / waves ---------------- */
  pickupCheck(p) {
    if (p.dead || p.state === 'down' || p.state === 'downed' || p.z > 12) return;
    for (const it of this.items) {
      if (it.taken || it.z > 8) continue;
      if (Math.abs(it.x - p.x) < 18 && Math.abs(it.y - p.y) < 13) {
        it.taken = true;
        const f = G.FOOD[it.type];
        p.hp = Math.min(p.maxhp, p.hp + f.heal);
        this.score += 120;
        if (this.audio) this.audio.sfx('pick');
        this.fx.push({ type: 'food', food: it.type, x: it.x, y: it.y, z: 4, life: 34, age: 0 });
        this.fx.push({ type: 'text', x: it.x, y: it.y, z: 26, life: 50, age: 0, s: '+' + f.heal });
        this.fx.push({ type: 'glow', x: it.x, y: it.y, z: 16, life: 20, age: 0 });
        for (let i = 0; i < 5; i++) this.fx.push({ type: 'star', x: it.x + rnd(-14, 14), y: it.y, z: rnd(6, 26), life: rnd(14, 26), age: 0 });
      }
    }
  }
  updateItems() {
    this.items.forEach(it => {
      it.t++; it.life--;
      if (it.z > 0 || it.vz) { it.vz = (it.vz || 0) - .2; it.z += it.vz; if (it.z <= 0) { it.z = 0; it.vz = 0; } }
    });
    this.items = this.items.filter(i => !i.taken && i.life > 0);
  }
  spark(x, y, z, big, pid) {
    this.fx.push({ type: big ? 'boom' : 'spark', x: x, y: y, z: z, life: big ? 14 : 8, age: 0 });
    if (big) this.fx.push({ type: 'ring', x: x, y: y, z: z, life: 12, age: 0 });
  }
  dust(x, y, n) { for (let i = 0; i < n; i++) this.fx.push({ type: 'dust', x: x + rnd(-10, 10), y: y, z: 2, vx: rnd(-.5, .5), life: 18, age: 0 }); }
  updateFx() {
    for (const f of this.fx) {
      f.age = (f.age || 0) + 1; f.life--;
      if (f.vx) f.x += f.vx;
      if (f.vy) f.y += f.vy;
      if (f.vz !== undefined) { f.z += f.vz; if (f.type === 'debris') { f.vz -= .22; if (f.z < 0) { f.z = 0; f.vz = 0; f.vx *= .5; } } }
      if (f.type === 'food') f.z += .5;
    }
    this.fx = this.fx.filter(f => f.life > 0);
  }
  spawnEnemy(type, side, delay) {
    const x = side === 'R' ? this.cam.x + G.LW + 24 : this.cam.x - 24;
    const e = this.makeEnemy(type, x, rnd(FT + 10, FB - 10));
    e.face = side === 'R' ? -1 : 1;
    this.enemies.push(e);
    return e;
  }
  updateWaves() {
    const st = this.stage;
    this.spawnQ.forEach(q => q.t--);
    this.spawnQ.filter(q => q.t <= 0).forEach(q => this.spawnEnemy(q.type, q.side));
    this.spawnQ = this.spawnQ.filter(q => q.t > 0);
    this.updateTokens();
    const w = st.waves[this.waveIdx];
    if (this.waveState === 'walk' && w && this.cam.x >= w.x - 2) {
      this.waveState = 'fight'; this.cam.max = w.x;
      w.e.forEach(q => this.spawnQ.push({ type: q[0], side: q[1], t: q[2] !== undefined ? q[2] : Math.floor(rnd(0, 60)) }));
      if (w.boss) { this.bossBanner = 130; if (this.audio) this.audio.sfx('go'); this.items.push({ type: 'spit', x: w.x + 70, y: 210, z: 0, life: 5000, t: 0 }); }
    } else if (this.waveState === 'fight' && this.spawnQ.length === 0 && this.enemies.every(e => e.remove || e.state === 'dead')) {
      this.waveState = 'walk'; this.waveIdx++; this.goT = 0;
      this.boss = null;
      if (this.waveIdx >= st.waves.length) { this.cam.max = st.len - G.LW; this.clearT = 1; }
      else { this.cam.max = st.waves[this.waveIdx].x; if (this.audio) this.audio.sfx('go'); }
    }
    if (this.clearT > 0) {
      this.clearT++;
      const ps = this.players;
      if (this.clearT === 24) ps.forEach(p => { if (!p.dead) { p.state = 'win'; this.restartAnim(p, 'win'); p.vx = p.vy = 0; } });
      if (this.clearT === 120) { this.best = Math.max(this.best, this.score); try { localStorage.setItem('gg-best', this.best); } catch (e) {} }
      if (this.clearT > 230) { this.screen = this.stageIdx >= G.STAGES.length - 1 ? 'victory' : 'clear'; this.menu = 0; if (this.audio) this.audio.sfx('go'); if (this.net && this.isHost()) this.net.sendScreen(this.screen, this); }
    }
    if (this.bossBanner > 0) this.bossBanner--;
    if (this.waveState === 'walk') this.goT++;
  }
  updateCamera() {
    const live = this.players.filter(p => !p.dead && p.state !== 'downed');
    if (!live.length) return;
    let lo = 1e9, hi = -1e9;
    live.forEach(p => { lo = Math.min(lo, p.x); hi = Math.max(hi, p.x); });
    const gap = hi - lo;
    const target = gap > 150 ? (lo + hi) / 2 - G.LW * .5 : live[0].x - G.LW * .42;
    let nx = this.cam.x + clamp((target - this.cam.x) * .12, -6, 6);
    this.cam.x = clamp(Math.max(this.cam.x, nx), 0, Math.max(0, this.cam.max));
    /* soft leash: the trailing player is nudged toward the camera, never past hazards */
    this.players.forEach(p => {
      if (p.dead) return;
      const left = this.cam.x + 14, right = this.cam.x + G.LW - 14;
      if (p.x < left) p.x += Math.min(2.6, left - p.x);
      if (p.x > right) p.x -= Math.min(2.6, p.x - right);
    });
  }

  /* ---------------- online ---------------- */
  isHost() { return this.mode !== 'online' || !this.net || this.net.isHost(); }
  /* pointer/touch: a rendered hot region was activated */
  clickHot(hot) {
    if (!hot) return;
    if (hot.act === 'row' || hot.act === 'pick') { this.menu = hot.i; if (hot.act === 'pick') this.sel = hot.i; }
    this.activate();
  }
  activate() {
    const sc = this.screen;
    if (sc === 'title') { this.goto('main'); return; }
    if (sc === 'main') {
      if (this.menu === 0) { this.mode = 'solo'; this.goto('select'); }
      else if (this.menu === 1) { this.mode = 'local'; this.goto('select'); }
      else if (this.menu === 2) { this.mode = 'online'; this.goto('online'); }
      else if (this.menu === 3) { this.newGame('training', { stage: 0 }); }
      else if (this.menu === 4) { this.goto('howto'); }
      else if (this.menu === 5) { this.goto('settings'); }
      else { this.goto('credits'); }
      this.blip(true); return;
    }
    if (sc === 'select') { this.navSelectConfirm(); return; }
    if (sc === 'settings') {
      if (this.cfg) { this.cfg.waiting = true; return; }
      if (this.menu === 6) this.cfg = { player: 0, row: 0, waiting: false };
      else if (this.menu === 7) this.goto('main');
      else this.adjust(this.menu, 1);
      return;
    }
    if (sc === 'online') {
      if (this.menu === 0) this.startHost();
      else if (this.menu === 1) { this.joinCode = ''; this.joinError = ''; this.screen = 'join'; }
      else if (this.menu === 2) this.startHost('local');
      else this.goto('main');
      return;
    }
    if (sc === 'howto' || sc === 'credits') { this.goto('main'); return; }
    if (sc === 'pause') {
      if (this.menu === 0) this.resume();
      else if (this.menu === 1) this.restartStage();
      else if (this.menu === 2) { this.returnScreen = 'pause'; this.goto('settings'); }
      else if (this.menu === 3) { this.returnScreen = 'pause'; this.goto('howto'); }
      else this.goto('title');
      return;
    }
    if (sc === 'over') { if (this.menu === 0) { this.lives = 3; this.newGame(this.mode, { stage: this.stageIdx }); } else this.goto('title'); return; }
    if (sc === 'clear') { this.nextStage(); return; }
    if (sc === 'victory') { this.goto('title'); return; }
    if (sc === 'lobby') { this.lobbyActivate(); return; }
  }
  navSelectConfirm() {
    const n = G.CH_ORDER.length;
    this.p1 = G.CH_ORDER[this.sel];
    this.p2 = this.mode === 'local' ? G.CH_ORDER[this.selP2 === this.sel ? (this.selP2 + 1) % n : this.selP2] : 'vv';
    if (this.mode === 'online') { this.beginOnlineLobby(); return; }
    this.newGame(this.mode, { stage: this.settings.stage | 0 });
    this.blip(true);
  }
  navJoin() {
    const I = G.Input;
    const code = G.Input.captureKey();
    if (I.just('p1', 'back')) { this.goto('online'); return; }
    if (code) {
      if (code === 'Backspace') this.joinCode = (this.joinCode || '').slice(0, -1);
      else if (code === 'Enter') { if ((this.joinCode || '').length === 5) this.doJoin(); }
      else {
        const ch = code.replace('Key', '').replace('Digit', '').replace('Numpad', '');
        if (/^[A-Z0-9]$/.test(ch) && (this.joinCode || '').length < 5) this.joinCode = (this.joinCode || '') + ch;
      }
      this.blip();
    }
  }
  doJoin() {
    if (!this.net) { this.toastMsg('NO NETWORK MODULE'); return; }
    this.mode = 'online';
    this.net.join(this, this.joinCode, G.localRoom ? 'local' : 'relay');
  }
  navLobby() {
    const I = G.Input, L = this.lobby || {};
    if (I.just('p1', 'back')) { this.leaveOnline(); return; }
    if (G.Input.keys['KeyC']) { try { navigator.clipboard.writeText(this.invite || ''); this.toastMsg('INVITE COPIED'); } catch (e) {} }
    if (!this.isHost()) {
      if (I.just('p1', 'start') || I.just('p1', 'attack')) { this.ready = !this.ready; this.net.send({ t: 'ready', r: this.ready }); this.blip(true); }
      if (I.just('p1', 'left') || I.just('p1', 'right')) {
        const i = (G.CH_ORDER.indexOf(this.p2) + (I.just('p1', 'right') ? 1 : 2)) % 3;
        this.p2 = G.CH_ORDER[i]; this.net.send({ t: 'pick', f: this.p2 }); this.blip();
      }
      return;
    }
    if (I.just('p1', 'left') || I.just('p1', 'right')) {
      if (I.just('p1', 'left')) this.diff = (this.diff + 2) % 3;
      else this.diff = (this.diff + 1) % 3;
      this.settings.diff = this.diff; G.saveSettings(this.settings); this.net.pushLobby(); this.blip();
    }
    if (I.just('p1', 'up') || I.just('p1', 'down')) {
      this.settings.stage = ((this.settings.stage | 0) + (I.just('p1', 'down') ? 1 : 3)) % 4;
      G.saveSettings(this.settings); this.net.pushLobby(); this.blip();
    }
    if (I.just('p1', 'start') || I.just('p1', 'attack')) {
      if (this.net.canStart()) { this.net.start(); this.blip(true); }
      else { this.toastMsg(this.tr('lobby_waiting')); }
    }
  }
  lobbyActivate() {
    if (!this.isHost()) { this.ready = !this.ready; if (this.net) this.net.send({ t: 'ready', r: this.ready }); return; }
    if (this.net && this.net.canStart()) { this.net.start(); this.blip(true); }
    else this.toastMsg(this.tr('lobby_waiting'));
  }
  resumeNet() { this.screen = 'play'; G.Input.clear(); if (this.audio) this.audio.duck(false); }
  startGuest(net, m) {
    this.mode = 'online'; this.net = net; this.stageIdx = m.stage | 0; this.stage = G.STAGES[this.stageIdx];
    this.p1 = m.p1; this.p2 = m.p2; this.diff = m.diff | 0;
    this.players = [this.snapFighter([m.p1, 0, 80, 200, 0, 1, 'idle', 0, 100, 100, 35, 3, 'idle', 0], 'p'), this.snapFighter([m.p2, 1, 110, 210, 0, 1, 'idle', 0, 100, 100, 35, 3, 'idle', 0], 'p')];
    this.enemies = []; this.props = []; this.items = []; this.projs = []; this.cam.x = 0; this.cam.max = 0;
    this.screen = 'play'; this.banner = 120; G.Input.clearRemote(0); G.Input.clearRemote(1);
    if (this.audio) this.audio.music(this.stage.music);
  }
  startHost(kind) {
    if (!this.net) { this.toastMsg('NO NETWORK MODULE'); return; }
    this.mode = 'online';
    this.net.host(this, kind || 'relay');
  }
  beginOnlineLobby() {
    this.mode = 'online';
    this.net.beginLobby(this);
  }
  leaveOnline() {
    if (this.net) this.net.leave();
    this.mode = 'solo'; this.goto('online');
  }
  netError(key) {
    const map = { full: 'online_full', 'not-found': 'online_notfound', timeout: 'online_timeout', 'host-left': 'online_hostleft', version: 'online_version' };
    this.toastMsg(this.tr(map[key] || 'online_failed'));
    this.toastT = 180;
    this.screen = 'online';
  }
  /* guest receives a full snapshot: render-only state */
  applySnapshot(s) {
    this.screen = s.scr || 'play';
    this.score = s.score; this.lives = s.lives; this.stageIdx = s.st; this.waveIdx = s.wv;
    this.cam.x = s.cam; this.cam.max = s.cmx;
    this.waveState = s.ws; this.clearT = s.cl; this.banner = s.ban || 0; this.hitstop = 0;
    this.combo.n = s.cb || 0; this.combo.t = s.cb ? 20 : 0;
    this.training = !!s.tr;
    if (!this.stage || this.stageIdx !== this._snapStage) { this.stage = G.STAGES[this.stageIdx]; this._snapStage = this.stageIdx; }
    this.players = (s.p || []).map(a => this.snapFighter(a, 'p'));
    this.enemies = (s.e || []).map(a => this.snapFighter(a, 'e'));
    this.props = (s.pr || []).map(a => ({ kind: 'prop', type: a[0], x: a[1], y: a[2], z: 0, hp: a[3], hw: 15, hd: 9, ht: 30, shake: 0 }));
    this.items = (s.it || []).map(a => ({ type: a[0], x: a[1], y: a[2], z: a[3], t: a[4] || 0, life: 900 }));
    this.projs = (s.pj || []).map(a => ({ x: a[0], y: a[1], z: a[2], vx: a[3] }));
    this.boss = this.enemies.find(e => e.boss) || null;
    this.ghostTargets = { players: this.players.map(p => ({ x: p.x, y: p.y, z: p.z })) };
  }
  snapFighter(a, team) {
    const id = a[0];
    const def = team === 'p' ? G.CH[id] : G.ED[id];
    const kit = Art.KITS[(def || G.CH.ricky).kit];
    return {
      kind: 'fighter', team: team, pid: a[1], charId: id, type: id, def: def || G.CH.ricky, kitId: (def || G.CH.ricky).kit,
      x: a[2], y: a[3], z: a[4], face: a[5], anim: a[6], frame: a[7], hp: a[8], maxhp: a[9], hype: a[10],
      lives: a[11], state: a[12], invuln: a[13] || 0, flash: 0, hw: 11 * kit.b.s, hd: 8, ht: 64 * kit.b.s,
      boss: team === 'e' && !!(def && def.boss), warn: false, dummy: false, vx: 0, vy: 0, vz: 0
    };
  }
}
G.Game = Game;
})(globalThis.GG = globalThis.GG || {});
