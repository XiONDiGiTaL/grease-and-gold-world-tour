/* Rendering: low-res 384x216 world canvas (crisp pixels) + hi-res overlay for HUD/menus. */
(function (G) {
'use strict';
const S = G.Sprites, GW = G.GW, GH = G.GH, CELL = S.CELL, AX = S.AX, AY = S.AY, COLS = S.COLS, FT = G.FLOOR_TOP, P = G.Game.prototype;
const GOLD = '#f2b630', GOLD2 = '#ffd866', INK = '#14091c', MAG = '#d93aa0', CREAM = '#f6ead0', RED = '#e0322e', DIM = '#8f84a3';
G.HELP = [['Move', 'Arrow keys / WASD'], ['Attack  (tap x3 = combo)', 'J or Z'], ['Jump', 'K, X or Space'], ['Special (hold)', 'L or C'], ['Grab / Throw', 'U, V or I'], ['Pause', 'Esc or P'], ['Mute', 'M'], ['Hitbox debug', 'F3'],
  ['Air attacks', 'Attack in air  /  Down+Attack = dive'], ['Gamepad', 'A jump, X attack, B special, Y grab, Start']];
function T(ctx, str, x, y, size, col, al) { ctx.font = '900 ' + Math.round(size) + 'px "Arial Black","Impact","Helvetica Neue",Arial,sans-serif'; ctx.textAlign = al || 'left'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, size * .2); ctx.strokeStyle = INK; ctx.strokeText(str, x, y); ctx.fillStyle = col; ctx.fillText(str, x, y); }
function box(ctx, x, y, w, h, fill, border, bw) { ctx.fillStyle = border; ctx.fillRect(x - bw, y - bw, w + bw * 2, h + bw * 2); ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); }

P.initAssets = function (mk) {
  this.mk = mk; this.sheets = {}; this.portraits = {}; this.rk = {};
  S.PLAYERS.forEach(id => { const rk = S.renderKit(id, true); this.sheets[id] = S.packGame(rk, mk); this.portraits[id] = S.portrait(rk).toCanvas(mk); });
  S.ENEMIES.forEach(id => { const rk = S.renderKit(id, false); this.sheets[id] = S.packGame(rk, mk); this.portraits[id] = S.portrait(rk).toCanvas(mk); });
  this.propImg = {}; ['crate', 'barrel', 'bin', 'boxes'].forEach(t => this.propImg[t] = S.makeProp(t).toCanvas(mk));
  this.foodImg = {}; ['adana', 'shish', 'doner', 'lahmacun', 'kunefe', 'spit'].forEach(t => this.foodImg[t] = S.makeFood(t).toCanvas(mk)); this.emptyPlate = S.makeEmptyPlate().toCanvas(mk);
  const fx = S.makeFx(); this.fx = { spark: fx.spark.map(b => b.toCanvas(mk)), boom: fx.boom.map(b => b.toCanvas(mk)), dust: fx.dust.map(b => b.toCanvas(mk)), ko: fx.ko.toCanvas(mk), glow: fx.glow.toCanvas(mk), sparkle: fx.sparkle.map(b => b.toCanvas(mk)) };
  this.tmp = mk(CELL, CELL); this.bgs = {};
};
P.buildBg = function (i) { if (!this.bgs) this.bgs = {}; if (!this.bgs[i]) this.bgs[i] = G.buildBackdrop(G.STAGES[i], i); };

function shadow(ctx, x, y, w, a) { ctx.fillStyle = 'rgba(8,4,16,' + a + ')'; const rows = [.55, .85, 1, .85, .55]; rows.forEach((r, i) => { const ww = Math.round(w * r); ctx.fillRect(x - (ww >> 1), y - 2 + i, ww, 1); }); }
P.drawFighter = function (ctx, e, camx, camy) {
  const sh = this.sheets[e.kitId]; if (!sh) return; const idx = sh.index[e.anim] || sh.index.idle, fr = idx.start + Math.min(e.frame, idx.n - 1), sx = (fr % COLS) * CELL, sy = Math.floor(fr / COLS) * CELL;
  const x = Math.round(e.x - camx), y = Math.round(e.y - e.z - camy);
  ctx.save(); ctx.translate(x, y); if (e.face < 0) ctx.scale(-1, 1);
  if (e.flash > 0) { const t = this.tmp, c = t.getContext('2d'); c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, CELL, CELL); c.drawImage(sh.canvas, sx, sy, CELL, CELL, 0, 0, CELL, CELL); c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(255,255,255,.75)'; c.fillRect(0, 0, CELL, CELL); c.globalCompositeOperation = 'source-over'; ctx.drawImage(t, -AX, -AY); }
  else ctx.drawImage(sh.canvas, sx, sy, CELL, CELL, -AX, -AY, CELL, CELL);
  ctx.restore();
};
P.renderWorld = function (ctx) {
  const st = this.stage, bg = this.bgs && this.bgs[this.stageIdx]; ctx.imageSmoothingEnabled = false;
  const cam = Math.round(this.cam.x), shx = this.shake > 0 ? Math.round((Math.random() * 2 - 1) * this.shake) : 0, shy = this.shake > 0 ? Math.round((Math.random() * 2 - 1) * this.shake * .6) : 0;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, GW, GH); ctx.save(); ctx.translate(shx, shy);
  if (bg) { ctx.drawImage(bg.far, -Math.floor(cam * .2), 0); ctx.drawImage(bg.mid, -Math.floor(cam * .5), 0); ctx.drawImage(bg.floor, -cam, 0); }
  const list = [...this.props.map(o => ({ o, y: o.y, k: 'prop' })), ...this.items.map(o => ({ o, y: o.y, k: 'item' })), ...this.projs.map(o => ({ o, y: o.y, k: 'proj' })), ...this.enemies.map(o => ({ o, y: o.y, k: 'f' })), ...this.players.map(o => ({ o, y: o.y, k: 'f' }))].sort((a, b) => a.y - b.y);
  // shadows
  list.forEach(q => { const o = q.o, x = Math.round(o.x - cam), y = Math.round(o.y);
    if (q.k === 'f') { if (o.state === 'dead' && o.deadT > 40 && (o.deadT >> 1) & 1) return; shadow(ctx, x, y, (o.hw * 2 + 6) * (1 - Math.min(.5, o.z / 140)), .4 - Math.min(.2, o.z / 300)); }
    else if (q.k === 'prop') shadow(ctx, x, y, 28, .35); else if (q.k === 'item') shadow(ctx, x, y, 22 - Math.min(8, o.z), .3); else if (q.k === 'proj') shadow(ctx, x, y, 8, .3); });
  list.forEach(q => { const o = q.o, x = Math.round(o.x - cam), y = Math.round(o.y);
    if (q.k === 'prop') { const im = this.propImg[o.type], off = o.shake > 0 ? ((o.shake & 1) ? 1 : -1) : 0; ctx.drawImage(im, x - 17 + off, y - 35); }
    else if (q.k === 'item') { const bob = o.z > 0 ? 0 : Math.round(Math.sin(o.t * .12) * 2) + 4, im = this.foodImg[o.type], zz = Math.round(o.z) + bob, gl = .28 + .14 * Math.sin(o.t * .15);
      if (o.life < 180 && (o.life >> 2) & 1) return; ctx.fillStyle = 'rgba(255,214,90,' + gl + ')'; ctx.beginPath(); ctx.ellipse(x, y - zz - im.height * .45, im.width * .62, im.height * .62, 0, 0, 7); ctx.fill(); ctx.drawImage(im, x - (im.width >> 1), y - zz - im.height + 3);
      for (let k = 0; k < 3; k++) { const ph = (o.t + k * 23) % 70; if (ph < 14) { const sp = this.fx.sparkle[ph < 5 || ph > 10 ? 0 : 2], a = (o.t * .02 + k * 2.1); ctx.drawImage(sp, Math.round(x + Math.cos(a * 3) * 14) - 4, Math.round(y - zz - im.height * .5 + Math.sin(a * 5) * 9) - 4); } } }
    else if (q.k === 'proj') { ctx.fillStyle = '#1b1226'; ctx.fillRect(x - 4, y - Math.round(o.z) - 5, 8, 10); ctx.fillStyle = (o.spin >> 2) & 1 ? '#c8ccd6' : '#8f98a8'; ctx.fillRect(x - 3, y - Math.round(o.z) - 4, 6, 8); ctx.fillStyle = '#d0402f'; ctx.fillRect(x - 3, y - Math.round(o.z) - 2, 6, 2); }
    else { if (o.state === 'dead' && o.deadT > 40 && (o.deadT >> 1) & 1) return; if (o.team === 'p' && o.invuln > 0 && o.state !== 'dead' && (o.invuln >> 2) & 1) return;
      this.drawFighter(ctx, o, cam, 0);
      if (o.warn && (this.t >> 2) & 1) { const hy = Math.round(o.y - o.z - o.ht - 10); ctx.fillStyle = INK; ctx.fillRect(x - 3, hy - 1, 6, 12); ctx.fillStyle = '#ff3a30'; ctx.fillRect(x - 2, hy, 4, 7); ctx.fillRect(x - 2, hy + 9, 4, 2); }
      if ((o.state === 'down' && o.downT < 36) || (o.state === 'hit' && o.hitChain >= 2)) { const hy = o.y - o.z - o.ht - 4; for (let k = 0; k < 3; k++) { const a = this.t * .22 + k * 2.09; ctx.drawImage(this.fx.ko, Math.round(x + Math.cos(a) * 10) - 4, Math.round(hy + Math.sin(a) * 3) - 4); } } }
  });
  this.parts.forEach(p => { const x = Math.round(p.x - cam), y = Math.round(p.y - p.z), age = p.age || 0, fx = this.fx;
    if (p.type === 'spark') { const im = fx.spark[Math.min(2, age >> 2)]; ctx.drawImage(im, x - 12, y - 12); }
    else if (p.type === 'boom') { const im = fx.boom[Math.min(2, age >> 2)]; ctx.drawImage(im, x - 22, y - 22); }
    else if (p.type === 'dust') { ctx.globalAlpha = Math.min(1, p.life / 12); ctx.drawImage(fx.dust[Math.min(2, age >> 3)], x - 12, y - 8); ctx.globalAlpha = 1; }
    else if (p.type === 'debris') { ctx.fillStyle = INK; ctx.fillRect(x - 2, y - 2, 5, 5); ctx.fillStyle = p.c; ctx.fillRect(x - 1, y - 1, 3, 3); }
    else if (p.type === 'plate') { ctx.globalAlpha = Math.min(1, p.life / 20); ctx.drawImage(this.emptyPlate, x - 18, y - 26); ctx.globalAlpha = 1; }
    else if (p.type === 'glow') { const r = 1 + age * .08; ctx.globalAlpha = Math.min(1, p.life / 10); ctx.drawImage(fx.glow, x - 15 * r, y - 15 * r, 30 * r, 30 * r); ctx.globalAlpha = 1; }
    else if (p.type === 'sparkle') { ctx.drawImage(fx.sparkle[(age >> 2) % 3], x - 4, y - 4); } });
  ctx.restore();
  if (G.debug) this.debugDraw(ctx, cam);
};
P.debugDraw = function (ctx, cam) {
  [...this.players, ...this.enemies].forEach(o => { const x = Math.round(o.x - cam), y = Math.round(o.y); ctx.strokeStyle = '#3cf'; ctx.strokeRect(x - o.hw, y - o.z - o.ht, o.hw * 2, o.ht); ctx.strokeStyle = '#fc3'; ctx.strokeRect(x - o.hw, y - o.hd, o.hw * 2, o.hd * 2); ctx.fillStyle = '#f33'; ctx.fillRect(x - 1, y - 1, 3, 3); });
};
const stat = (ctx, x, y, label, v, S1) => { T(ctx, label, x, y, 6.2 * S1, CREAM); for (let i = 0; i < 5; i++) { ctx.fillStyle = i < v ? GOLD : '#3a2a4a'; ctx.fillRect(x + (52 + i * 9) * S1, y - 5.6 * S1, 7.4 * S1, 6 * S1); } };
P.renderUI = function (view, low) {
  const ctx = view.getContext('2d'), S1 = view.width / GW, W = view.width, H = view.height; ctx.imageSmoothingEnabled = false;
  const u = (v) => v * S1;
  if (this.state === 'loading') { ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H); T(ctx, 'GREASE & GOLD', W / 2, H * .45, u(22), GOLD, 'center'); T(ctx, 'drawing sprites...', W / 2, H * .55, u(8), CREAM, 'center'); return; }
  const worldStates = ['play', 'pause', 'gameover', 'stageclear', 'victory'];
  if (worldStates.includes(this.state) || this.state === 'title' || this.state === 'select') ctx.drawImage(low, 0, 0, W, H);
  if (this.state === 'title') this.uiTitle(ctx, S1, W, H); else if (this.state === 'select') this.uiSelect(ctx, S1, W, H);
  else { this.uiHud(ctx, S1, W, H); if (this.state === 'pause') this.uiPause(ctx, S1, W, H); if (this.state === 'gameover') this.uiEnd(ctx, S1, W, H, 'GAME OVER', RED, ['Score  ' + String(this.score).padStart(6, '0')], 'Enter: continue stage   Esc: title'); if (this.state === 'stageclear') this.uiEnd(ctx, S1, W, H, 'STAGE CLEAR', GOLD, [this.stage.name, 'Score  ' + String(this.score).padStart(6, '0'), 'Lives  ' + this.lives], 'Enter: next stop on the tour'); if (this.state === 'victory') this.uiEnd(ctx, S1, W, H, 'WORLD TOUR COMPLETE', GOLD2, ['Grease & Gold take the crown', 'Final score  ' + String(this.score).padStart(6, '0')], 'Enter: back to title'); }
};
P.renderLow = function (low) {
  const c = low.getContext('2d'); c.imageSmoothingEnabled = false;
  if (this.state === 'title' || this.state === 'select') { this.buildBg(this.state === 'title' ? 0 : 3); const bg = this.bgs[this.state === 'title' ? 0 : 3], sc = (this.t * .3) % 600; c.drawImage(bg.far, -Math.floor(sc * .2), 0); c.drawImage(bg.mid, -Math.floor(sc * .5), 0); c.drawImage(bg.floor, -Math.floor(sc), 0); c.fillStyle = 'rgba(14,6,24,.55)'; c.fillRect(0, 0, GW, GH);
    if (this.state === 'title') ['ricky', 'vv', 'johnny'].forEach((id, i) => { const e = { kitId: id, anim: 'idle', frame: Math.floor(this.t / 14 + i) % 4, x: 112 + i * 80, y: 198, z: 0, face: i === 1 ? 1 : (i === 0 ? 1 : -1), flash: 0 }; this.drawFighter(c, e, 0, 0); }); return; }
  if (this.stage) this.renderWorld(c);
};
P.uiTitle = function (ctx, S1, W, H) {
  const u = (v) => v * S1; ctx.fillStyle = MAG; ctx.save(); ctx.translate(W / 2, u(40)); ctx.rotate(-.035); ctx.fillRect(-u(128), u(26), u(256), u(22)); ctx.restore();
  ctx.save(); ctx.translate(W / 2, u(60)); ctx.rotate(-.035); T(ctx, 'GREASE', -u(2), 0, u(36), GOLD, 'right'); T(ctx, '&', u(15), 0, u(36), MAG, 'center'); T(ctx, 'GOLD', u(28), 0, u(36), GOLD, 'left'); ctx.restore();
  ctx.save(); ctx.translate(W / 2, u(90)); ctx.rotate(-.035); T(ctx, 'W O R L D   T O U R', 0, 0, u(12), CREAM, 'center'); ctx.restore();
  if ((this.t >> 5) & 1) T(ctx, 'PRESS ENTER  /  TAP TO START', W / 2, u(122), u(9), CREAM, 'center');
  T(ctx, 'Move: arrows/WASD   Attack: J   Jump: K   Special (hold): L   Grab: U   Pause: Esc', W / 2, u(209), u(5.2), DIM, 'center');
  T(ctx, 'Browser playtest build', W / 2, u(214.5), u(4.4), DIM, 'center');
};
P.uiSelect = function (ctx, S1, W, H) {
  const u = (v) => v * S1, ids = Object.keys(G.CH); T(ctx, 'CHOOSE YOUR FIGHTER', W / 2, u(13), u(11), GOLD, 'center');
  ids.forEach((id, i) => { const d = G.CH[id], cx = GW / 2 + (i - 1) * 124, x = cx - 56, y = 17, sel = i === this.sel, sh = this.sheets[d.kit]; box(ctx, u(x), u(y), u(112), u(190), sel ? '#2a1238' : '#1a0d26', sel ? GOLD : '#4a3a5a', u(sel ? 2 : 1));
    if (sh) { const idx = sh.index.idle, fr = idx.start + (sel ? Math.floor(this.t / 14) % 4 : 0), sx = (fr % COLS) * CELL, sy = Math.floor(fr / COLS) * CELL; ctx.globalAlpha = sel ? 1 : .6; ctx.drawImage(sh.canvas, sx + AX - 52, sy + AY - 100, 104, 104, u(cx - 52), u(y + 3), u(104), u(104)); ctx.globalAlpha = 1; }
    T(ctx, d.name, u(cx), u(y + 121), u(11), sel ? GOLD2 : CREAM, 'center'); T(ctx, d.weapon, u(cx), u(y + 130), u(5.8), DIM, 'center');
    T(ctx, 'SPECIAL', u(x + 8), u(y + 142), u(6), MAG); T(ctx, d.special, u(x + 46), u(y + 142), u(6.4), CREAM);
    stat(ctx, u(x + 8), u(y + 154), 'POWER', d.stats.power, S1); stat(ctx, u(x + 8), u(y + 163), 'SPEED', d.stats.speed, S1); stat(ctx, u(x + 8), u(y + 172), 'REACH', d.stats.reach, S1); stat(ctx, u(x + 8), u(y + 181), 'HEALTH', d.stats.health, S1); });
  T(ctx, G.CH[ids[this.sel]].blurb.replace('|', ' '), W / 2, u(214), u(5.6), CREAM, 'center');
};
P.uiHud = function (ctx, S1, W, H) {
  const u = (v) => v * S1, p = this.players[0]; if (!p) return; const d = p.def;
  box(ctx, u(6), u(6), u(44), u(44), INK, GOLD, u(2)); const pt = this.portraits[d.kit]; if (pt) ctx.drawImage(pt, u(8), u(8), u(40), u(40));
  T(ctx, d.name, u(56), u(15), u(8.5), GOLD2); T(ctx, 'x' + Math.max(0, this.lives), u(156), u(15), u(8.5), CREAM, 'right');
  const bar = (x, y, w, h, pct, col, back) => { box(ctx, u(x), u(y), u(w), u(h), back, CREAM, u(1)); ctx.fillStyle = col; ctx.fillRect(u(x), u(y), u(w * Math.max(0, pct)), u(h)); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(u(x), u(y), u(w * Math.max(0, pct)), u(h * .3)); ctx.fillStyle = 'rgba(20,9,28,.5)'; for (let i = 1; i < 10; i++) ctx.fillRect(u(x + w * i / 10) - 1, u(y), 1, u(h)); };
  T(ctx, 'HP', u(56), u(27), u(6), CREAM); bar(80, 20.5, 76, 8, p.hp / p.maxhp, p.hp / p.maxhp < .3 && (this.t >> 3) & 1 ? '#ff7a5a' : '#e0322e', '#3a1420');
  T(ctx, 'HYPE', u(56), u(38), u(6), MAG); bar(80, 32.5, 76, 6, p.hype / 100, p.state === 'special' ? GOLD2 : GOLD, '#33210a');
  T(ctx, String(this.score).padStart(6, '0'), u(GW / 2 + 20), u(16), u(13), CREAM, 'center'); T(ctx, 'SCORE', u(GW / 2 + 20), u(24), u(5.5), DIM, 'center');
  if (this.lastEnemyT > 0 && this.lastEnemy && !this.lastEnemy.boss) { const e = this.lastEnemy; T(ctx, e.def.name, u(GW - 8), u(15), u(7), CREAM, 'right'); bar(GW - 98, 19, 90, 6, e.hp / e.maxhp, '#d93aa0', '#2a1030'); }
  const boss = this.enemies.find(e => e.boss && e.state !== 'dead' && !e.remove);
  if (boss && boss.state !== 'spawn') { T(ctx, boss.def.name.toUpperCase(), u(GW / 2), u(GH - 19), u(8.5), GOLD2, 'center'); bar(GW / 2 - 110, GH - 15, 220, 9, boss.hp / boss.maxhp, '#d93aa0', '#2a1030'); }
  if (this.combo.n >= 2 && this.combo.t > 0) { const pop = Math.max(0, (this.combo.pop = Math.max(0, (this.combo.pop || 0) - .5))); T(ctx, this.combo.n + ' HITS', u(8), u(66), u(10 + pop * .6), (this.combo.n >= 8 ? GOLD2 : CREAM)); }
  if (this.state === 'play') {
    if (this.banner > 0 && this.stage) { const a = Math.min(1, this.banner / 20, (170 - this.banner) / 12 + .2); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(20,9,28,.78)'; ctx.fillRect(0, u(78), W, u(52)); ctx.fillStyle = MAG; ctx.fillRect(0, u(78), W, u(2)); ctx.fillRect(0, u(128), W, u(2)); T(ctx, this.stage.tour, W / 2, u(94), u(8), MAG, 'center'); T(ctx, this.stage.name.toUpperCase(), W / 2, u(118), u(22), GOLD, 'center'); ctx.globalAlpha = 1; }
    if (this.bossBanner > 0 && (this.bossBanner >> 3) & 1) T(ctx, 'WARNING   BOSS', W / 2, u(84), u(18), RED, 'center');
    if (this.waveState === 'walk' && this.stage && this.waveIdx < this.stage.waves.length && this.goT > 10 && this.waveIdx > 0 && (this.goT >> 4) & 1) { T(ctx, 'GO', u(GW - 44), u(86), u(18), GOLD2, 'center'); ctx.fillStyle = GOLD2; ctx.fillRect(u(GW - 30), u(91), u(10), u(6)); ctx.beginPath(); ctx.moveTo(u(GW - 20), u(86)); ctx.lineTo(u(GW - 10), u(94)); ctx.lineTo(u(GW - 20), u(102)); ctx.fill(); }
    if (this.flashT > 0) { ctx.fillStyle = 'rgba(255,255,255,' + this.flashT / 10 + ')'; ctx.fillRect(0, 0, W, H); }
  }
};
P.uiPause = function (ctx, S1, W, H) {
  const u = (v) => v * S1; ctx.fillStyle = 'rgba(14,6,24,.78)'; ctx.fillRect(0, 0, W, H); T(ctx, 'PAUSED', W / 2, u(44), u(20), GOLD, 'center');
  ['Resume', 'Restart stage', this.showHelp ? 'Hide controls' : 'Controls', 'Quit to title'].forEach((s, i) => T(ctx, (i === this.menu ? '> ' : '  ') + s, W / 2 - u(48), u(70 + i * 15), u(10), i === this.menu ? GOLD2 : CREAM));
  if (this.showHelp) G.HELP.forEach((r, i) => { T(ctx, r[0], W / 2 - u(150), u(144 + i * 7.2 - (i > 4 ? 0 : 0)), u(5.6), CREAM); T(ctx, r[1], W / 2 + u(10), u(144 + i * 7.2), u(5.6), DIM); });
};
P.uiEnd = function (ctx, S1, W, H, title, col, lines, hint) {
  const u = (v) => v * S1; ctx.fillStyle = 'rgba(14,6,24,.8)'; ctx.fillRect(0, 0, W, H); T(ctx, title, W / 2, u(70), u(title.length > 12 ? 20 : 26), col, 'center'); lines.forEach((l, i) => T(ctx, l, W / 2, u(98 + i * 16), u(11), CREAM, 'center'));
  if ((this.t >> 5) & 1) T(ctx, hint, W / 2, u(176), u(8), GOLD2, 'center');
};
})(globalThis.GG = globalThis.GG || {});
