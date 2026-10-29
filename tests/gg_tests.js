/* Headless simulation + art checks. node tests/gg_tests.js
   These prove mechanics and screen flow, not game feel or visuals. */
require('../src/gg/core.js');
require('../src/gg/art.js');
require('../src/gg/stages.js');
require('../src/gg/input.js');
require('../src/gg/audio.js');
require('../src/gg/net.js');
require('../src/gg/sim.js');
const G = globalThis.GG, I = G.Input;
const meta = require('../assets/gg/fighters.json');

let pass = 0, fail = 0; const fails = [];
function ok(c, name, info) { if (c) { pass++; console.log('PASS ' + name); } else { fail++; fails.push(name); console.log('FAIL ' + name + (info !== undefined ? ' -> ' + JSON.stringify(info) : '')); } }
function section(s) { console.log('\n== ' + s); }
const settings = JSON.parse(JSON.stringify(G.DEFAULTS));
I.init(settings);
const audio = { sfx() {}, music() {}, duck() {}, tick() {}, applySettings() {}, stop() {} };

function mk(mode) {
  const g = new G.Game({ settings: settings, meta: meta, audio: audio, net: null });
  I.clear();
  g.newGame(mode || 'solo', { stage: 0 });
  g.players.forEach(p => { p.invuln = 0; });
  g.screen = 'play';
  return g;
}
function step(g, n) { for (let k = 0; k < (n || 1); k++) { G.Input.compute(); g.update(); G.Input.tick(); G.Input.endFrame(); } }
function kc(a, p) { return settings.keys[p || 'p1'][a]; }
function down(g, a, p) { I.keys[kc(a, p)] = true; G.Input.compute(); }
function up(g, a, p) { I.keys[kc(a, p)] = false; G.Input.compute(); }
function tap(g, a, n) { down(g, a); step(g, 1); up(g, a); step(g, (n || 1) - 1); }
function hold(g, a, n) { down(g, a); step(g, n); up(g, a); }
function clearEnemies(g) { g.enemies = []; g.spawnQ = []; }
function put(g, type, dx, dy, st) {
  const p = g.players[0], e = g.makeEnemy(type, p.x + dx, p.y + dy);
  e.state = st || 'idle'; e.cool = 9999; e.x = p.x + dx; e.y = p.y + dy;
  e.face = dx > 0 ? -1 : 1; g.enemies.push(e); return e;
}
function grounded(g) { g.players.forEach(p => { p.invuln = 0; p.state = 'idle'; p.x = 160; p.y = 200; p.z = 0; }); g.cam.x = 90; g.cam.max = 900; clearEnemies(g); }

section('art');
{
  const heroFrames = ['idle', 'walk', 'a1', 'a2', 'a3', 'special', 'jump', 'jatk', 'jdown', 'land', 'grab', 'gstrike', 'throw', 'hurt', 'knock', 'down', 'getup', 'dead', 'win', 'held'];
  const missing = [], clipped = [], timingBad = [];
  for (const id of G.Art.HEROES) {
    const k = meta.kits[id];
    heroFrames.forEach(a => {
      const an = k.anims[a];
      if (!an || !an.frames.length) return missing.push(id + ':' + a);
      if (an.timing.length !== an.frames.length) timingBad.push(id + ':' + a);
      an.frames.forEach((f, i) => {
        if (f.w <= 1 || f.h <= 1) clipped.push(id + ':' + a + i + ' empty');
        if (f.w > 132 || f.h > 116) clipped.push(id + ':' + a + i + ' overflow');
      });
    });
  }
  ok(!missing.length, 'all three fighters have the full animation set', missing.slice(0, 5));
  ok(!timingBad.length, 'every animation has one timing entry per frame', timingBad.slice(0, 5));
  ok(!clipped.length, 'no empty or overflowing sprite frames', clipped.slice(0, 5));
  const feetOff = [];
  for (const id of ['ricky', 'vv', 'johnny']) {
    for (const a of ['idle', 'walk', 'turn', 'grab', 'hurt']) {
      meta.kits[id].anims[a].frames.forEach((f, i) => {
        const bottom = f.oy + f.h;
        if (Math.abs(bottom) > 2) feetOff.push(id + ':' + a + i + ' bottom=' + bottom);
      });
    }
    /* finishers may drive a weapon into the floor (the renderer clips it), so
       attack frames are only checked against gross floating/sinking */
    for (const a of ['a1', 'a2', 'a3', 'special']) {
      meta.kits[id].anims[a].frames.forEach((f, i) => {
        const bottom = f.oy + f.h;
        if (bottom < -4 || bottom > 14) feetOff.push(id + ':' + a + i + ' bottom=' + bottom);
      });
    }
  }
  ok(!feetOff.length, 'feet stay on the shared ground anchor in locomotion; slams may reach the floor', feetOff.slice(0, 6));
  ok(meta.kits.ricky.anims.walk.frames.length === 8, 'walk cycle is 8 frames');
  ok(meta.kits.johnny.anims.special.frames.length >= 6, 'special has its own multi-frame animation');
  ok(meta.kits.ricky.anims.special.frames.every((f, i) => {
    const a = meta.kits.ricky.anims.a1.frames[Math.min(i, 3)];
    return f.w !== a.w || f.h !== a.h;
  }), 'special frames are not reused attack frames');
}

section('movement');
{
  const g = mk(); const p = g.players[0]; p.x = 130; g.cam.x = 60; g.cam.max = 900;
  const x0 = p.x; hold(g, 'right', 24);
  ok(p.x > x0 + 20, 'walking right moves the fighter', p.x - x0);
  const y0 = p.y; hold(g, 'down', 20);
  ok(p.y > y0, 'moving down changes the lane (y)', p.y - y0);
  ok(Math.abs(p.z) < .01, 'lane movement does not change jump height');
  hold(g, 'up', 90);
  ok(p.y >= G.FT - .01, 'lane clamps at the top of the walkable band', p.y);
}
{
  const g = mk(); const p = g.players[0]; p.x = 160; g.cam.x = 90; g.cam.max = 900;
  const y0 = p.y; let peak = 0;
  tap(g, 'jump', 1);
  for (let i = 0; i < 60; i++) { step(g); peak = Math.max(peak, p.z); }
  ok(peak > 32 && peak < 58, 'jump apex is in the tuned band', peak);
  ok(Math.abs(p.y - y0) < .01, 'jumping leaves the ground lane unchanged');
  ok(p.z === 0, 'fighter lands back on the floor', p.z);
}

section('combat');
{
  const g = mk(); grounded(g); const p = g.players[0];
  const e = put(g, 'jooce', 40, 0); e.hp = e.maxhp = 400;
  let maxStep = 0; const hp0 = e.hp;
  tap(g, 'attack', 1);
  for (let i = 0; i < 90; i++) {
    if (i === 6 || i === 17 || i === 30) tap(g, 'attack', 1); else step(g);
    if (p.state === 'attack') maxStep = Math.max(maxStep, p.step);
  }
  ok(maxStep === 2, 'taps chain into the 3-hit combo', maxStep);
  ok(e.hp < hp0 - 10, 'combo deals real damage', hp0 - e.hp);
  ok(['knock', 'down', 'getup', 'idle', 'hit', 'dead'].includes(e.state), 'enemy resolves its hit reaction', e.state);
}
{
  const g = mk(); grounded(g); const p = g.players[0];
  const lane = put(g, 'jooce', 40, 40), behind = put(g, 'jooce', -40, 0), far = put(g, 'jooce', 120, 0);
  lane.hp = behind.hp = far.hp = 90;
  tap(g, 'attack', 20);
  ok(lane.hp === 90, 'enemy in another lane is not hit', lane.hp);
  ok(behind.hp === 90, 'enemy behind the fighter is not hit', behind.hp);
  ok(far.hp === 90, 'enemy beyond reach is not hit', far.hp);
  const front = put(g, 'jooce', 38, 0); front.hp = 90;
  tap(g, 'attack', 20);
  ok(front.hp < 90, 'enemy in front, in lane and in reach is hit', front.hp);
}
{
  const g = mk(); grounded(g); const p = g.players[0];
  const e = put(g, 'heavy', 40, 0); e.hp = e.maxhp = 900; e.poise = 0;
  tap(g, 'attack', 1); let hs = 0;
  for (let i = 0; i < 20; i++) { step(g); hs = Math.max(hs, g.hitstop); }
  ok(hs > 0 && hs <= 9, 'hit-stop is present but brief', hs);
}

section('HYPE');
{
  const g = mk(); grounded(g); const p = g.players[0];
  for (let i = 0; i < 3; i++) { const e = put(g, 'heavy', 30 + i * 8, 0); e.hp = e.maxhp = 900; }
  p.hype = 60;
  hold(g, 'special', 2);
  ok(p.state === 'special', 'holding special starts it with HYPE', p.state);
  let rose = false, prev = p.hype;
  hold(g, 'special', 40);
  for (let i = 0; i < 40; i++) { step(g); if (p.hype > prev + 1e-9) rose = true; prev = p.hype; I.keys[kc('special')] = true; G.Input.compute(); }
  I.keys[kc('special')] = false; G.Input.compute();
  ok(!rose, 'special damage never refunds HYPE');
  ok(prev < 55, 'HYPE drains while the special is held', prev);
  step(g, 2);
  const after = p.hype; step(g, 20);
  ok(p.state !== 'special' && Math.abs(p.hype - after) < .001, 'releasing stops the special and the drain');
  const g2 = mk(); grounded(g2); const p2 = g2.players[0]; p2.hype = 0;
  hold(g2, 'special', 3);
  ok(p2.state !== 'special', 'special cannot start without HYPE');
  const g3 = mk(); grounded(g3); const p3 = g3.players[0]; p3.hype = 0;
  put(g3, 'jooce', 40, 0).hp = 300;
  tap(g3, 'attack', 20);
  ok(p3.hype > 0, 'ordinary hits build HYPE', p3.hype);
}

section('grapple');
{
  const g = mk(); grounded(g); const p = g.players[0];
  const e = put(g, 'jooce', 24, 0); e.hp = e.maxhp = 200;
  tap(g, 'grab', 2);
  ok(p.state === 'grab' && e.state === 'held', 'grab latches an enemy in front', { p: p.state, e: e.state });
  const hp0 = e.hp;
  tap(g, 'attack', 14);
  ok(e.hp < hp0, 'grab strikes damage the held enemy', e.hp);
  tap(g, 'grab', 10);
  ok(p.state === 'throw' || p.state === 'idle' || e.state === 'knock' || e.state === 'down', 'grab again throws the enemy', { p: p.state, e: e.state });
  const g2 = mk(); grounded(g2); const p2 = g2.players[0];
  const a = put(g2, 'jooce', 24, 0); a.hp = a.maxhp = 200;
  const b = put(g2, 'jooce', 90, 0); b.hp = b.maxhp = 120;
  tap(g2, 'grab', 2); tap(g2, 'grab', 2); step(g2, 40);
  ok(b.hp < 120, 'a thrown enemy bowls into other enemies', b.hp);
}

section('props and food');
{
  const g = mk(); grounded(g); const p = g.players[0];
  /* a crate has a 78% drop chance, so break several rather than assuming one roll */
  let broke = 0;
  for (let n = 0; n < 12 && !g.items.length; n++) {
    p.x = 160; p.y = 200;
    g.props = [{ kind: 'prop', type: 'crate', x: p.x + 34, y: p.y, z: 0, hp: 2, hw: 15, hd: 9, ht: 30, shake: 0 }];
    for (let i = 0; i < 8 && g.props.length; i++) { p.x = 160; tap(g, 'attack', 22); }
    if (!g.props.length) broke++;
  }
  ok(broke > 0, 'crates are destructible', broke);
  const it = g.items[0];
  ok(!!it, 'a broken crate drops food', { broke: broke, items: g.items.length });
  if (it) {
    p.hp = 30; it.x = p.x + 2; it.y = p.y; it.z = 0; step(g, 3);
    ok(p.hp > 30, 'walking over food heals', p.hp);
  }
}

section('waves');
{
  const g = mk(); grounded(g);
  g.waveState = 'fight'; g.spawnQ = []; g.waveIdx = 0; g.cam.x = 200; g.players[0].x = 300;
  g.enemies = [];
  const w0 = g.waveIdx;
  g.updateWaves();
  ok(g.waveIdx > w0 || g.clearT > 0, 'clearing every enemy advances the wave', { w: g.waveIdx, c: g.clearT });
}
{
  const g = mk(); grounded(g); g.cam.x = 0; g.cam.max = 900;
  const e = g.spawnEnemy('jooce', 'R');
  const x0 = e.x;
  step(g, 120);
  ok(e.state !== 'spawn', 'a spawned enemy walks into the arena', { s: e.state, x: e.x });
  ok(e.x < x0 - 40, 'right-side reinforcements move toward the fighters', x0 - e.x);
}

section('co-op');
{
  const g = mk('local');
  ok(g.players.length === 2, 'local co-op spawns two fighters');
  const [p1, p2] = g.players; p1.x = 150; p2.x = 400; p1.y = 190; p2.y = 230; g.cam.x = 150; g.cam.max = 900;
  step(g, 20);
  ok(Math.abs(p2.x - p1.x) < 250, 'the shared camera keeps partners in view', p2.x - p1.x);
  const lives = g.lives;
  p2.hp = 0; p2.x = 200; p2.y = 200; p1.x = 206; p1.y = 202;
  g.playerDowned(p2);
  ok(p2.state === 'downed', 'a defeated partner goes down, not out');
  p1.x = 206; p1.y = 202;
  step(g, 130);
  ok(p2.state === 'idle' && g.lives === lives - 1, 'standing close revives the partner for a life', { s: p2.state, lives: g.lives });
  const p3 = g.players[1]; p3.hp = 0; g.lives = 1;
  g.playerDowned(p3); p1.x = 900; p1.y = 200;
  step(g, 450);
  ok(g.screen === 'over', 'a team wipe ends the run', g.screen);
}

section('screens');
{
  const g = new G.Game({ settings: settings, meta: meta, audio: audio, net: null });
  I.clear();
  ok(g.screen === 'title', 'boots to the title screen');
  tap(g, 'start', 2); ok(g.screen === 'main', 'title opens the main menu', g.screen);
  g.menu = 0; tap(g, 'start', 2); ok(g.screen === 'select', 'solo opens fighter select', g.screen);
  tap(g, 'start', 3); ok(g.screen === 'play' && g.players.length === 1, 'select starts the run', g.screen);
  tap(g, 'pause', 2); ok(g.screen === 'pause', 'pause opens', g.screen);
  tap(g, 'start', 2); ok(g.screen === 'play', 'pause resumes', g.screen);
  g.screen = 'settings'; g.menu = 0; const m0 = g.settings.music;
  tap(g, 'right', 2); ok(g.settings.music !== m0, 'settings change with left/right', [m0, g.settings.music]);
  g.screen = 'main'; g.menu = 3; tap(g, 'start', 3);
  ok(g.screen === 'play' && g.training, 'training starts the real simulation', g.screen);
  ok(g.enemies[0] && g.enemies[0].dummy, 'training has a resettable dummy');
  g.resetDummy();
  ok(Math.abs(g.enemies[0].x - 330) < 1, 'the dummy resets to its spot');
}

section('network protocol');
{
  const g = mk('online'); g.p1 = 'ricky'; g.p2 = 'vv'; g.players = []; g.addPlayer(0, 'ricky'); g.addPlayer(1, 'vv');
  g.stageIdx = 0; g.stage = G.STAGES[0]; g.cam.x = 100; g.score = 1234; g.lives = 2;
  const snap = new G.Net().pack(g);
  const g2 = new G.Game({ settings: settings, meta: meta, audio: audio, net: null });
  g2.applySnapshot(snap);
  ok(g2.players.length === 2 && Math.abs(g2.players[0].x - g.players[0].x) < 1, 'snapshot round-trip keeps fighter positions', [g2.players[0].x, g.players[0].x]);
  ok(g2.score === g.score && g2.lives === g.lives, 'snapshot carries score and lives');
  ok(G.PROTO === 2, 'protocol version is explicit');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) { console.log('failures: ' + fails.join(', ')); process.exit(1); }
