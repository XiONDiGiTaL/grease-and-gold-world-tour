// node tests/run.js  - headless checks (no browser). Prints PASS/FAIL per rule.
const path = require('path'); const { createCanvas } = require('@napi-rs/canvas');
['foodart', 'rigart', 'sprites', 'rig', 'enemyart', 'sheetkit', 'input', 'audio', 'stages', 'game'].forEach(n => require('../src/' + n + '.js'));
const G = globalThis.GG; G.makeCanvas = (w, h) => createCanvas(w, h); const S = G.Sprites, I = G.Input;
let pass = 0, fail = 0; const failures = [];
const ok = (cond, name, info) => { if (cond) { pass++; console.log('PASS', name); } else { fail++; failures.push(name); console.log('FAIL', name, info !== undefined ? '-> ' + JSON.stringify(info) : ''); } };
const section = (s) => console.log('\n== ' + s);

/* ---------------- sprites ---------------- */
section('Sprite sheets');
const kits = [...S.PLAYERS.map(i => [i, true]), ...S.ENEMIES.map(i => [i, false])]; const R = {}; const rigKits = kits.filter(([id]) => !S.K[id].sheet);
kits.forEach(([id, p]) => R[id] = S.renderKit(id, p));
ok(kits.length === 12, '12 kits rendered (3 players + 9 enemies/bosses)');
let bad = [];
kits.forEach(([id, isP]) => { const names = isP ? S.PLAYER_ANIMS : S.ENEMY_ANIMS; names.forEach(a => { const fr = R[id].frames[a]; if (!fr || fr.length !== S.TIMING[a].length) bad.push(id + ':' + a); }); });
ok(!bad.length, 'every kit has every required animation with matching frame counts', bad);
bad = [];
kits.forEach(([id]) => Object.entries(R[id].frames).forEach(([a, fs]) => fs.forEach((b, i) => { const bb = b.bbox(); if (bb.x1 < 0 || bb.x0 < 1 || bb.y0 < 1 || bb.x1 > S.CELL - 2 || bb.y1 > S.CELL - 2) bad.push(`${id}:${a}[${i}] bbox ${JSON.stringify(bb)}`); })));
ok(!bad.length, 'no frame touches or is clipped by the fixed 112x112 canvas edge', bad.slice(0, 6));
bad = [];
rigKits.forEach(([id]) => { const ref = Math.hypot(R[id].rigs.idle[0].sh[0] - R[id].rigs.idle[0].hip[0], R[id].rigs.idle[0].sh[1] - R[id].rigs.idle[0].hip[1]); Object.entries(R[id].rigs).forEach(([a, rs]) => rs.forEach((r, i) => { const torso = Math.hypot(r.sh[0] - r.hip[0], r.sh[1] - r.hip[1]); if (Math.abs(torso - ref) > .01) bad.push(`${id}:${a}[${i}] torso ${torso.toFixed(2)} vs ${ref.toFixed(2)}`); })); });
ok(!bad.length, 'torso length identical in every frame of a kit (no shrinking during attacks)', bad.slice(0, 6));
// planted feet: lowest opaque pixel (outline row) must be exactly the anchor row on grounded frames
bad = [];
const grounded = ['idle', 'a1', 'a2', 'a3', 'special', 'grab', 'gstrike', 'throw', 'hit', 'getup', 'land', 'win', 'held'];
kits.forEach(([id, isP]) => { grounded.forEach(a => { if (!R[id].frames[a]) return; R[id].frames[a].forEach((b, i) => { const pz = R[id].poses[a][i]; const planted = (pz.fF[1] === 0 || pz.fB[1] === 0); if (!planted) return; const bb = b.bbox(); if (Math.abs(bb.y1 - S.AY) > 1) bad.push(`${id}:${a}[${i}] bottom=${bb.y1} anchor=${S.AY}`); }); }); });
ok(!bad.length, 'planted feet sit on the shared ground anchor in all grounded frames (+/-1px outline)', bad.slice(0, 8));
// walk: stance foot slides backward relative to body (no moonwalk) and cycle has 8 distinct frames
bad = [];
rigKits.forEach(([id]) => { const pz = R[id].poses.walk; for (let i = 0; i < 8; i++) { const a = pz[i], b = pz[(i + 1) % 8]; for (const f of ['fF', 'fB']) if (a[f][1] === 0 && b[f][1] === 0 && !(b[f][0] < a[f][0])) bad.push(`${id} ${f} frame ${i}`); } });
ok(!bad.length, 'walk cycle: planted foot always travels backward relative to the body (not walking backwards)', bad.slice(0, 5));
const sig = (b) => Array.from(b.d).reduce((h, v) => (h * 31 + v) >>> 0, 7);
ok(rigKits.every(([id]) => new Set(R[id].frames.walk.map(sig)).size === 8) && kits.every(([id]) => new Set(R[id].frames.walk.map(sig)).size >= 2), 'rigged walk cycles have 8 distinct frames; every enemy walk cycles through >=2 hand-drawn frames');
ok(rigKits.every(([id]) => new Set(R[id].frames.idle.map(sig)).size >= 3), 'hero idle has subtle but real variation (no static single frame)');
// idle bob: hip height must not move between idle frames
ok(kits.every(([id]) => R[id].poses.idle.every(p => p.hip[1] === R[id].poses.idle[0].hip[1])), 'idle has no hip bobbing');
// specials differ from basic attacks and from each other
['ricky', 'vv', 'johnny'].forEach(id => { const sp = new Set(R[id].frames.special.map(sig)), a1 = new Set(R[id].frames.a1.map(sig)); ok(sp.size === 6 && ![...sp].some(h => a1.has(h)), id + ': special sequence is its own 6-frame set (not reused attack frames)'); });
// height consistency: standing height of idle frames equal across the three heroes' idle (scale differences only)
const heights = {}; kits.forEach(([id]) => { const b = R[id].frames.idle[0].bbox(); heights[id] = b.y1 - b.y0; });
ok(S.PLAYERS.every(id => Math.abs(R[id].rigs.idle[0].head[1] - R[id].rigs.idle[1].head[1]) < 1.6), 'head height stable across idle frames');
// portrait / props / food
const mkc = (w, h) => createCanvas(w, h);
['crate', 'barrel', 'bin', 'boxes'].forEach(t => { const im = S.makeProp(t), b = im.bbox(); ok(b.x0 >= 0 && b.x1 <= im.w - 1 && b.y1 <= im.h - 1 && b.y0 >= 0, 'prop ' + t + ' within canvas'); });
['adana', 'shish', 'doner', 'lahmacun', 'kunefe', 'spit'].forEach(t => { const im = S.makeFood(t), b = im.bbox(); ok(b.x0 >= 1 && b.y0 >= 0 && b.x1 <= im.w - 2 && b.y1 <= im.h - 1, 'food ' + t + ' not clipped'); });
// no magenta artifacts in any generated art (hue ~300deg, high saturation) except none expected
let mag = 0; const chk = (b) => { for (const v of b.d) { if (!v) continue; const r = v & 255, g = (v >> 8) & 255, bl = (v >> 16) & 255; if (r > 200 && bl > 150 && g < 90) mag++; } };
kits.forEach(([id]) => Object.values(R[id].frames).forEach(fs => fs.forEach(chk))); ['crate', 'barrel', 'bin', 'boxes'].forEach(t => chk(S.makeProp(t))); ['adana', 'shish', 'doner', 'lahmacun', 'kunefe', 'spit'].forEach(t => chk(S.makeFood(t)));
ok(mag === 0, 'zero magenta/pink pixels in character, prop or food art', mag);
// no semi-transparent pixels (crisp 16-bit pixels)
let semi = 0; kits.forEach(([id]) => Object.values(R[id].frames).forEach(fs => fs.forEach(b => { for (const v of b.d) { const a = v >>> 24; if (a !== 0 && a !== 255) semi++; } })));
ok(semi === 0, 'no anti-aliased / semi-transparent pixels in any frame', semi);

/* ---------------- gameplay ---------------- */
section('Gameplay rules');
const mk = (ch, opts) => { const g = new G.Game(Object.assign({}, opts)); I.clear(); g.startRun(ch || 'ricky'); g.players[0].invuln = 0; return g; };
const step = (g, n) => { for (let i = 0; i < (n || 1); i++) g.update(); };
const press = (g, b, hold) => { I.set(b, true); step(g, hold || 1); I.set(b, false); };
const clearEnemies = (g) => { g.enemies = []; g.spawnQ = []; };
const put = (g, type, dx, dy, st) => { const p = g.players[0], e = g.makeEnemy(type, p.x + dx, p.y + dy); e.state = st || 'idle'; e.cool = 9999; e.face = dx > 0 ? -1 : 1; g.enemies.push(e); return e; };

// movement + walk phase distance sync
{ const g = mk('ricky'); const p = g.players[0]; p.x = 120; g.cam.x = 60; const x0 = p.x, ph0 = p.phase; let phTotal = 0, last = p.phase; I.set('right', true);
  for (let i = 0; i < 60; i++) { step(g); let d = p.phase - last; if (d < -.5) d += 1; phTotal += d; last = p.phase; } I.set('right', false);
  const dist = p.x - x0; ok(dist > 60, 'holding right moves the fighter', dist); ok(Math.abs(phTotal * p.stride - dist) < 6, 'walk-cycle phase advances with distance travelled (feet planted, no sliding)', { cyc: phTotal * p.stride, dist }); }
// backward walking reverses animation
{ const g = mk('ricky'); const p = g.players[0]; p.face = -1; p.vx = 1.5; p.state = 'walk'; const ph = p.phase; g.walkPhase(p); const d1 = p.phase - ph; ok(d1 < 0 || d1 > .5, 'moving against facing plays the walk cycle in reverse'); }
// jump separates height from ground plane
{ const g = mk('vv'); const p = g.players[0]; p.x = 150; g.cam.x = 90; const y0 = p.y; let peak = 0; press(g, 'jump'); for (let i = 0; i < 50; i++) { step(g); peak = Math.max(peak, p.z); } ok(peak > 38 && peak < 52, 'jump apex ~44px', peak); ok(Math.abs(p.y - y0) < .01, 'jumping does not change the ground-plane lane (y)', p.y - y0); ok(p.z === 0 && ['land', 'idle'].includes(p.state), 'lands back at z=0'); }
// buffered 3-hit combo
{ const g = mk('ricky'); clearEnemies(g); const p = g.players[0]; p.x = 150; g.cam.x = 90; const e = put(g, 'exec', 40, 0); e.def = Object.assign({}, e.def); e.hp = 500; e.maxhp = 500; let maxStep = -1, hitStates = new Set();
  press(g, 'attack'); for (let i = 0; i < 70; i++) { if (i === 6 || i === 17) press(g, 'attack'); else step(g); if (p.state === 'attack') maxStep = Math.max(maxStep, p.step); hitStates.add(e.state); }
  ok(maxStep === 2, 'attack taps chain into a buffered 3-hit combo (a1 > a2 > a3)', maxStep); ok(hitStates.has('knock') || hitStates.has('down'), 'combo finisher knocks the enemy down', [...hitStates]); }
// lane / direction hit detection
{ const g = mk('ricky'); clearEnemies(g); const p = g.players[0]; p.x = 150; g.cam.x = 90; const inLane = put(g, 'exec', 40, 0), offLane = put(g, 'exec', 40, 32), behind = put(g, 'exec', -40, 0), tooFar = put(g, 'exec', 90, 0); inLane.hp = offLane.hp = behind.hp = tooFar.hp = 90; press(g, 'attack'); step(g, 20);
  ok(inLane.hp < 90, 'enemy in front and in lane is hit'); ok(offLane.hp === 90, 'enemy in a different lane (depth) is NOT hit', offLane.hp); ok(behind.hp === 90, 'enemy behind the fighter is NOT hit', behind.hp); ok(tooFar.hp === 90, 'enemy out of reach is NOT hit'); }
// hit-stop is brief
{ const g = mk('johnny'); clearEnemies(g); const p = g.players[0]; p.x = 150; g.cam.x = 90; const e = put(g, 'exec', 36, 0); e.hp = 200; press(g, 'attack'); let maxHs = 0; for (let i = 0; i < 40; i++) { step(g); maxHs = Math.max(maxHs, g.hitstop); } ok(maxHs > 0 && maxHs <= 9, 'hit-stop occurs and stays brief (<=9 ticks / 150ms)', maxHs); }
// HYPE rules
{ const g = mk('vv'); clearEnemies(g); const p = g.players[0]; p.x = 150; g.cam.x = 90; for (let i = 0; i < 4; i++) { const e = put(g, 'heavy', 24 + i * 6, (i - 1.5) * 4); e.hp = e.maxhp = 900; } p.hype = 50; const h0 = p.hype; I.set('special', true); step(g, 2); ok(p.state === 'special', 'special starts with any HYPE remaining'); let rose = false, prev = p.hype; for (let i = 0; i < 60; i++) { step(g); if (p.hype > prev + 1e-9) rose = true; prev = p.hype; }
  ok(!rose, 'HYPE never increases while a special is hitting (special damage grants no HYPE)'); ok(h0 - p.hype > 10 && h0 - p.hype < 25, 'HYPE drains continuously while held', h0 - p.hype);
  I.set('special', false); step(g, 2); const hr = p.hype; step(g, 30); ok(p.state !== 'special' && Math.abs(p.hype - hr) < 1e-9, 'releasing stops the special and the drain'); }
{ const g = mk('ricky'); clearEnemies(g); const p = g.players[0]; p.hype = 1; p.x = 150; g.cam.x = 90; I.set('special', true); step(g, 12); ok(p.state !== 'special' && p.hype === 0, 'special stops when HYPE depletes', { s: p.state, h: p.hype }); I.set('special', false); }
{ const g = mk('ricky'); clearEnemies(g); const p = g.players[0]; p.hype = 0; p.x = 150; g.cam.x = 90; const e = put(g, 'exec', 40, 0); e.hp = 300; press(g, 'attack'); step(g, 15); ok(p.hype > 0, 'ordinary successful attacks restore HYPE', p.hype); const g2 = mk('ricky'); clearEnemies(g2); g2.players[0].hype = 0; g2.players[0].x = 150; g2.cam.x = 90; step(g2, 5); I.set('special', true); step(g2, 5); ok(g2.players[0].state !== 'special', 'special cannot start at 0 HYPE'); I.set('special', false); }
// grab, strike, throw
{ const g = mk('johnny'); clearEnemies(g); const p = g.players[0]; p.x = 150; g.cam.x = 90; const e = put(g, 'exec', 22, 0); e.hp = e.maxhp = 120; const hp0 = e.hp; press(g, 'grab'); step(g, 2); ok(p.state === 'grab' && e.state === 'held', 'grab latches an enemy in front'); press(g, 'attack'); step(g, 14); ok(e.hp < hp0, 'grab strike damages the held enemy', e.hp); const hp1 = e.hp; I.set('right', true); press(g, 'grab'); I.set('right', false); step(g, 6); ok((e.state === 'knock' && e.thrown) || e.state === 'down', 'throw launches the enemy', e.state); step(g, 40); ok(e.hp < hp1, 'throw deals damage', e.hp); }
// thrown enemy bowls into others
{ const g = mk('johnny'); clearEnemies(g); const p = g.players[0]; p.x = 150; g.cam.x = 90; const e = put(g, 'exec', 22, 0), o = put(g, 'exec', 70, 0); o.hp = o.maxhp = 100; press(g, 'grab'); step(g, 2); press(g, 'grab'); step(g, 50); ok(o.hp < 100, 'a thrown enemy hits other enemies (bowling)', o.hp); }
// props + pickups
{ const g = mk('ricky'); clearEnemies(g); const p = g.players[0]; g.props = [{ kind: 'prop', type: 'crate', x: p.x + 36, y: p.y, z: 0, hp: 4, hw: 12, hd: 9, ht: 26, shake: 0 }]; Math.random = (() => { const r = Math.random; return () => .1; })(); p.x = 150; g.cam.x = 90; g.props[0].x = p.x + 36; g.props[0].y = p.y;
  for (let i = 0; i < 10; i++) { p.x = 150; g.cam.x = 90; press(g, 'attack'); step(g, 16); if (!g.props.length) break; } ok(g.props.length === 0, 'crate is destructible'); ok(g.items.length === 1, 'broken prop drops a food pickup', g.items.length);
  const it = g.items[0]; p.hp = 40; p.x = it.x - 2; p.y = it.y; step(g, 60); const itx = g.items.find(i => i === it); ok(!itx && p.hp > 40, 'walking over food heals', p.hp); }
// poise-armored enemy hit by a knock-type move must recover from hit-stun (regression: stun was undefined -> stuck forever)
{ const g = mk('ricky'); clearEnemies(g); const p = g.players[0]; p.x = 150; g.cam.x = 90; const h = put(g, 'heavy', 36, 0); h.hp = h.maxhp = 900; h.poise = 999; g.hurt(h, p, { dmg: 1, knock: true, launch: 2, kb: 2, hs: 0, box: { z0: 10, z1: 40 } }); step(g, 60); ok(h.state === 'idle' && Number.isFinite(h.stun), 'heavy hit by a knock-move without poise break recovers from hit-stun (no stuck state)', { s: h.state, stun: h.stun }); }
// food pickup: the collection effect shows the SAME food that was picked up (regression: it used to show an Adana plate for every food)
{ const g = mk('ricky'); clearEnemies(g); const p = g.players[0]; p.x = 150; g.cam.x = 90; for (const type of ['doner', 'kunefe', 'lahmacun', 'shish', 'spit']) { g.parts = []; g.items = [{ type, x: p.x + 2, y: p.y, z: 0, life: 900, t: 0 }]; p.hp = 10; step(g, 2); const ghost = g.parts.find(q => q.type === 'foodghost'); ok(ghost && ghost.food === type && p.hp > 10, 'collecting ' + type + ' shows and heals ' + type, ghost && ghost.food); } }
// music: stage 3 uses the second song, the rest the first
ok(G.STAGES.map(s => s.music).join() === 'arcade,arcade,kneel,arcade', 'stage music: Arcade Tune on stages 1,2,4; I Don\'t Kneel on stage 3', G.STAGES.map(s => s.music));
// regression: a fighter hit while jumping must come back down (used to float forever in the hit state)
{ const g = mk('vv'); clearEnemies(g); const p = g.players[0]; p.x = 150; g.cam.x = 90; press(g, 'jump'); step(g, 10); ok(p.z > 5, 'precondition: jumping'); g.hurt(p, { x: p.x + 20, face: -1, z: 0, team: 'e' }, { dmg: 3, kb: 1, stun: 16, hs: 0, box: { z0: 10, z1: 40 } }); step(g, 90);
  ok(p.z === 0 && !['hit', 'jump'].includes(p.state), 'player hit in mid-air lands (no floating)', { z: p.z, s: p.state });
  const e = put(g, 'guard', 40, 0); e.z = 30; e.vz = 0; e.state = 'hit'; e.stun = 20; step(g, 90); ok(e.z === 0, 'any airborne fighter in a ground state is pulled back to the floor', e.z); }
// crowd separation
{ const g = mk('ricky'); clearEnemies(g); const p = g.players[0]; p.x = 200; g.cam.x = 150; for (let i = 0; i < 5; i++) { const e = put(g, 'guard', 160 - 200 + 150 + 0, 0); e.x = 120; e.y = 170; e.cool = 9999; } step(g, 90); let mn = 1e9; for (let i = 0; i < g.enemies.length; i++) for (let j = i + 1; j < g.enemies.length; j++) { const A = g.enemies[i], B = g.enemies[j]; mn = Math.min(mn, Math.hypot((A.x - B.x) / ((A.hw + B.hw) * .9), (A.y - B.y) / 10)); } ok(mn > .8, 'crowd separation pulls stacked enemies apart (no body overlap)', mn); }
// enemy windup readability
{ const g = mk('ricky'); clearEnemies(g); const p = g.players[0]; p.x = 150; g.cam.x = 90; p.invuln = 0; g.godMode = true; const e = put(g, 'exec', 30, 0); e.cool = 0; e.token = true; let warnTicks = 0, lastWarn = false; for (let i = 0; i < 120; i++) { step(g); g.updateTokens(); e.token = true; if (e.warn) warnTicks++; } ok(warnTicks >= 15, 'enemy telegraphs its attack with a held windup frame + warning icon', warnTicks); }
// player damage and death -> lives
{ const g = mk('ricky'); clearEnemies(g); const p = g.players[0]; p.x = 150; g.cam.x = 90; p.hp = 1; const e = put(g, 'exec', 30, 0); e.cool = 0; e.token = true; let died = false; for (let i = 0; i < 400; i++) { step(g); e.token = true; if (g.lives < 3) { died = true; break; } } ok(died && p.hp === p.maxhp && g.players[0].state === 'idle', 'losing all HP costs a life and respawns with full HP', { lives: g.lives }); }
// no NaN anywhere after a chaotic run
{ const g = mk('vv'); const ids = ['guard', 'exec', 'heavy', 'brawler', 'raider']; for (let i = 0; i < 12; i++) g.spawnEnemy(ids[i % 5], i % 2 ? 'R' : 'L'); for (let i = 0; i < 600; i++) { I.set('attack', i % 7 < 2); I.set('right', i % 90 < 45); I.set('up', i % 50 < 20); if (i % 130 === 0) press(g, 'jump'); step(g); } I.clear(); const all = [...g.players, ...g.enemies]; ok(all.every(o => Number.isFinite(o.x) && Number.isFinite(o.y) && Number.isFinite(o.z) && Number.isFinite(o.hp)), 'no NaN/Infinity after chaotic input'); }

/* ---------------- full-stage autoplay (invincible bot) ---------------- */
section('Stage flow (bot with god mode)');
for (let si = 0; si < 4; si++) {
  const g = mk('ricky', { godMode: true }); g.startStage(si); g.lives = 3; let ticks = 0, maxLockViol = 0, sawFight = false, bossSeen = false, cleared = false, kills = 0;
  const p = g.players[0];
  while (ticks < 60 * 60 * 9) { ticks++;
    const live = g.enemies.filter(e => e.state !== 'dead' && e.state !== 'spawn' && !e.remove); const tgt = live.sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
    I.set('left', false); I.set('right', false); I.set('up', false); I.set('down', false);
    if (g.items.length && p.hp < p.maxhp * .6) { const it = g.items[0]; I.set(it.x > p.x + 3 ? 'right' : 'left', Math.abs(it.x - p.x) > 3); I.set(it.y > p.y + 2 ? 'down' : 'up', Math.abs(it.y - p.y) > 2); }
    else if (tgt) { const dx = tgt.x - p.x; if (Math.abs(dx) > 34) I.set(dx > 0 ? 'right' : 'left', true); else if (Math.abs(dx) < 16) I.set(dx > 0 ? 'left' : 'right', true); if (Math.abs(tgt.y - p.y) > 3) I.set(tgt.y > p.y ? 'down' : 'up', true); I.set('attack', Math.abs(dx) < 60 && ticks % 6 < 2); I.set('special', p.hype > 70 && Math.abs(dx) < 40); if (p.state === 'special' && p.hype < 20) I.set('special', false); }
    else I.set('right', true);
    g.update(); if (g.waveState === 'fight') sawFight = true; if (g.enemies.some(e => e.boss)) bossSeen = true; if (g.cam.x > g.cam.max + .5) maxLockViol++;
    if (g.state === 'stageclear' || g.state === 'victory') { cleared = true; break; } if (g.state === 'gameover') break;
  }
  I.clear(); ok(cleared, `stage ${si + 1} (${G.STAGES[si].name}) is completable start-to-boss`, { ticks, state: g.state, wave: g.waveIdx }); ok(sawFight && bossSeen, `stage ${si + 1}: waves lock the fight and a boss appears`); ok(maxLockViol === 0, `stage ${si + 1}: camera never scrolls past the wave lock`, maxLockViol); console.log('     stage', si + 1, 'cleared in', (ticks / 60).toFixed(0) + 's of bot time');
}
console.log(`\n${pass} passed, ${fail} failed`); if (fail) { console.log('FAILED:', failures); process.exit(1); }
