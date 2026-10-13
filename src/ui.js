/* Rendering: low-res 384x216 world canvas (crisp pixels) + hi-res overlay for HUD/menus. */
(function (G) {
'use strict';
const S = G.Sprites, GW = G.GW, GH = G.GH, CELL = S.CELL, AX = S.AX, AY = S.AY, COLS = S.COLS, FT = G.FLOOR_TOP, P = G.Game.prototype;
const GOLD = '#f2b630', GOLD2 = '#ffd866', INK = '#14091c', MAG = '#d93aa0', CREAM = '#f6ead0', RED = '#e0322e', DIM = '#8f84a3';
G.HELP_OLD = [['Move', 'Arrow keys / WASD'], ['Attack  (tap x3 = combo)', 'J or Z'], ['Jump', 'K, X or Space'], ['Special (hold)', 'L or C'], ['Grab / Throw', 'U, V or I'], ['Pause', 'Esc or P'], ['Mute', 'M'], ['Hitbox debug', 'F3'],
  ['Air attacks', 'Attack in air  /  Down+Attack = dive'], ['Gamepad', 'A jump, X attack, B special, Y grab, Start']];
function T(ctx, str, x, y, size, col, al) { const px = Math.max(8, Math.round(size / 8) * 8); ctx.font = px + 'px PS2P, "Courier New", monospace'; ctx.textAlign = al || 'left'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, px * .3); ctx.strokeStyle = INK; ctx.strokeText(str, x, y); ctx.fillStyle = col; ctx.fillText(str, x, y); }
function box(ctx, x, y, w, h, fill, border, bw) { ctx.fillStyle = border; ctx.fillRect(x - bw, y - bw, w + bw * 2, h + bw * 2); ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); }

const Z = G.Z;
P.initAssets = function (mk) {
  this.mk = mk; this.sheets = {}; this.portraits = {}; this.bgs = {};
  S.PLAYERS.forEach(id => this.buildKit(id, true));
  this.propImg = {}; ['crate', 'barrel', 'bin', 'boxes'].forEach(t => this.propImg[t] = S.makeProp(t).toCanvas(mk));
  this.foodImg = {}; ['adana', 'shish', 'doner', 'lahmacun', 'kunefe', 'spit'].forEach(t => this.foodImg[t] = S.makeFood(t).toCanvas(mk));
  const fx = S.makeFx(); this.fx = { spark: fx.spark.map(b => b.toCanvas(mk)), boom: fx.boom.map(b => b.toCanvas(mk)), dust: fx.dust.map(b => b.toCanvas(mk)), ko: fx.ko.toCanvas(mk), glow: fx.glow.toCanvas(mk), sparkle: fx.sparkle.map(b => b.toCanvas(mk)) };
  this.tmp = mk(CELL, CELL);
};
P.buildKit = function (id, isPlayer) { if (this.sheets[id]) return; const rk = S.renderKit(id, isPlayer); this.sheets[id] = S.pack(rk, this.mk); this.portraits[id] = S.portrait(rk).toCanvas(this.mk); };
/* kits/backdrops are built per stage (hi-res sheets are large); heroes stay resident */
P.ensureAssets = function (si) {
  if (!this.mk) return; const st = G.STAGES[si], need = new Set(['guard', 'exec']); st.waves.forEach(w => w.e.forEach(q => need.add(G.ED[q[0]].kit)));
  need.forEach(k => this.buildKit(k, false)); Object.keys(this.sheets).forEach(k => { if (!S.PLAYERS.includes(k) && !need.has(k)) { delete this.sheets[k]; delete this.portraits[k]; } });
  this.buildBg(si); Object.keys(this.bgs).forEach(i => { if (+i !== si && +i !== 0 && +i !== 3) delete this.bgs[i]; });
};
P.buildBg = function (i) { if (!this.bgs) this.bgs = {}; if (!this.bgs[i]) this.bgs[i] = G.buildBackdrop(G.STAGES[i], i); };

function shadow(ctx, x, y, w, a) { ctx.fillStyle = 'rgba(8,4,16,' + a + ')'; ctx.beginPath(); ctx.ellipse(x, y, w / 2, Math.max(3, w * .09), 0, 0, 7); ctx.fill(); }
P.drawFighter = function (ctx, e, camx, ox, oy) {
  const sh = this.sheets[e.kitId]; if (!sh) return; const fr = sh.frames[e.anim] || sh.frames.idle, f = fr[Math.min(e.frame, fr.length - 1)];
  const x = Math.round((e.x - camx) * Z) + (ox || 0), y = Math.round((e.y - e.z) * Z) + (oy || 0);
  ctx.save(); ctx.translate(x, y); if (e.face < 0) ctx.scale(-1, 1);
  if (e.flash > 0) { const t = this.tmp, c = t.getContext('2d'); c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, t.width, t.height); c.drawImage(sh.canvas, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h); c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(255,255,255,.78)'; c.fillRect(0, 0, f.w, f.h); c.globalCompositeOperation = 'source-over'; ctx.drawImage(t, 0, 0, f.w, f.h, f.ox, f.oy, f.w, f.h); }
  else ctx.drawImage(sh.canvas, f.x, f.y, f.w, f.h, f.ox, f.oy, f.w, f.h);
  ctx.restore();
};
const img = (ctx, im, ux, uy, ox, oy, a) => { if (a !== undefined) ctx.globalAlpha = a; ctx.drawImage(im, Math.round(ux * Z - im.width * Z / 2) + ox, Math.round(uy * Z - im.height * Z / 2) + oy, im.width * Z, im.height * Z); ctx.globalAlpha = 1; };
P.renderWorld = function (ctx) {
  const bg = this.bgs && this.bgs[this.stageIdx], W = ctx.canvas.width, H = ctx.canvas.height; ctx.imageSmoothingEnabled = false;
  const cam = this.cam.x, camp = Math.round(cam * Z), ox = this.shake > 0 ? Math.round((Math.random() * 2 - 1) * this.shake * Z) : 0, oy = this.shake > 0 ? Math.round((Math.random() * 2 - 1) * this.shake * Z * .6) : 0;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  if (bg) { ctx.drawImage(bg.far, -Math.floor(camp * .2) + ox, oy); ctx.drawImage(bg.mid, -Math.floor(camp * .5) + ox, oy); ctx.drawImage(bg.floor, -camp + ox, oy); }
  const list = [...this.props.map(o => ({ o, y: o.y, k: 'prop' })), ...this.items.map(o => ({ o, y: o.y, k: 'item' })), ...this.projs.map(o => ({ o, y: o.y, k: 'proj' })), ...this.enemies.map(o => ({ o, y: o.y, k: 'f' })), ...this.players.map(o => ({ o, y: o.y, k: 'f' }))].sort((a, b) => a.y - b.y);
  const px = (o) => Math.round((o.x - cam) * Z) + ox, py = (o) => Math.round(o.y * Z) + oy;
  list.forEach(q => { const o = q.o, x = px(o), y = py(o);
    if (q.k === 'f') { if (o.state === 'dead' && o.deadT > 40 && (o.deadT >> 1) & 1) return; shadow(ctx, x, y, (o.hw * 2 + 8) * Z * (1 - Math.min(.5, o.z / 140)), .42 - Math.min(.2, o.z / 300)); }
    else if (q.k === 'prop') shadow(ctx, x, y, 32 * Z, .36); else if (q.k === 'item') shadow(ctx, x, y, 28 * Z - Math.min(10, o.z) * Z * .4, .32); else shadow(ctx, x, y, 9 * Z, .3); });
  list.forEach(q => { const o = q.o, x = px(o), y = py(o);
    if (q.k === 'prop') { const im = this.propImg[o.type], off = o.shake > 0 ? ((o.shake & 1) ? 2 : -2) : 0; ctx.drawImage(im, Math.round(x - im.width / 2) + off, Math.round(y - im.height + Z)); }
    else if (q.k === 'item') { const bob = o.z > 0 ? 0 : Math.round(Math.sin(o.t * .12) * 2 * Z) + 4 * Z, im = this.foodImg[o.type], zz = Math.round(o.z * Z) + bob, gl = .26 + .14 * Math.sin(o.t * .15);
      if (o.life < 180 && (o.life >> 2) & 1) return; ctx.fillStyle = 'rgba(255,214,90,' + gl + ')'; ctx.beginPath(); ctx.ellipse(x, y - zz - im.height * .45, im.width * .62, im.height * .62, 0, 0, 7); ctx.fill(); ctx.drawImage(im, Math.round(x - im.width / 2), Math.round(y - zz - im.height + 3 * Z));
      for (let k = 0; k < 3; k++) { const ph = (o.t + k * 23) % 70; if (ph < 14) { const sp = this.fx.sparkle[ph < 5 || ph > 10 ? 0 : 2], a = (o.t * .02 + k * 2.1); ctx.drawImage(sp, Math.round(x + Math.cos(a * 3) * im.width * .42 - sp.width * Z / 2), Math.round(y - zz - im.height * .5 + Math.sin(a * 5) * im.height * .3 - sp.height * Z / 2), sp.width * Z, sp.height * Z); } } }
    else if (q.k === 'proj') { const zz = Math.round(o.z * Z); ctx.fillStyle = INK; ctx.fillRect(x - 5 * Z, y - zz - 6 * Z, 10 * Z, 12 * Z); ctx.fillStyle = (o.spin >> 2) & 1 ? '#c8ccd6' : '#8f98a8'; ctx.fillRect(x - 4 * Z, y - zz - 5 * Z, 8 * Z, 10 * Z); ctx.fillStyle = '#d0402f'; ctx.fillRect(x - 4 * Z, y - zz - 2.5 * Z, 8 * Z, 2.5 * Z); }
    else { if (o.state === 'dead' && o.deadT > 40 && (o.deadT >> 1) & 1) return; if (o.team === 'p' && o.invuln > 0 && o.state !== 'dead' && (o.invuln >> 2) & 1) return;
      this.drawFighter(ctx, o, cam, ox, oy);
      if (o.warn && (this.t >> 2) & 1) { const hy = Math.round((o.y - o.z - o.ht - 10) * Z) + oy; ctx.fillStyle = INK; ctx.fillRect(x - 4 * Z, hy - Z, 8 * Z, 15 * Z); ctx.fillStyle = '#ff3a30'; ctx.fillRect(x - 2.5 * Z, hy, 5 * Z, 9 * Z); ctx.fillRect(x - 2.5 * Z, hy + 11 * Z, 5 * Z, 3 * Z); }
      if ((o.state === 'down' && o.downT < 36) || (o.state === 'hit' && o.hitChain >= 2)) { const hy = (o.y - o.z - o.ht - 4) * Z + oy; for (let k = 0; k < 3; k++) { const a = this.t * .22 + k * 2.09, ko = this.fx.ko; ctx.drawImage(ko, Math.round(x + Math.cos(a) * 13 * Z - ko.width * Z / 2), Math.round(hy + Math.sin(a) * 4 * Z - ko.height * Z / 2), ko.width * Z, ko.height * Z); } } }
  });
  this.parts.forEach(p => { const x = (p.x - cam), y = (p.y - p.z), age = p.age || 0, fx = this.fx;
    if (p.type === 'spark') img(ctx, fx.spark[Math.min(2, age >> 2)], x, y, ox, oy);
    else if (p.type === 'boom') img(ctx, fx.boom[Math.min(2, age >> 2)], x, y, ox, oy);
    else if (p.type === 'dust') img(ctx, fx.dust[Math.min(2, age >> 3)], x, y, ox, oy, Math.min(1, p.life / 12));
    else if (p.type === 'debris') { const X = Math.round(x * Z) + ox, Y = Math.round(y * Z) + oy; ctx.fillStyle = INK; ctx.fillRect(X - 3 * Z, Y - 3 * Z, 6 * Z, 6 * Z); ctx.fillStyle = p.c; ctx.fillRect(X - 2 * Z, Y - 2 * Z, 4 * Z, 4 * Z); }
    else if (p.type === 'foodghost') { const im = this.foodImg[p.food], k = 1 + age * .012; ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 24)); ctx.drawImage(im, Math.round(x * Z + ox - im.width * k / 2), Math.round(y * Z + oy - im.height * k + 8 * Z), im.width * k, im.height * k); ctx.globalAlpha = 1; }
    else if (p.type === 'glow') { const g = fx.glow, r = 1 + age * .09; ctx.globalAlpha = Math.min(1, p.life / 10); ctx.drawImage(g, Math.round(x * Z + ox - g.width * r * 1.6 / 2), Math.round(y * Z + oy - g.height * r * 1.6 / 2), g.width * r * 1.6, g.height * r * 1.6); ctx.globalAlpha = 1; }
    else if (p.type === 'sparkle') { const sp = fx.sparkle[(age >> 2) % 3]; ctx.drawImage(sp, Math.round(x * Z + ox - sp.width * Z / 2), Math.round(y * Z + oy - sp.height * Z / 2), sp.width * Z, sp.height * Z); }
    else if (p.type === 'text') T(ctx, p.s, Math.round(x * Z) + ox, Math.round(y * Z) + oy, 8 * Z, '#5fe06a', 'center'); });
  if (G.debug) this.debugDraw(ctx, cam);
};
P.debugDraw = function (ctx, cam) {
  [...this.players, ...this.enemies].forEach(o => { const x = Math.round((o.x - cam) * Z), y = Math.round(o.y * Z); ctx.strokeStyle = '#3cf'; ctx.strokeRect(x - o.hw * Z, y - (o.z + o.ht) * Z, o.hw * 2 * Z, o.ht * Z); ctx.strokeStyle = '#fc3'; ctx.strokeRect(x - o.hw * Z, y - o.hd * Z, o.hw * 2 * Z, o.hd * 2 * Z); ctx.fillStyle = '#f33'; ctx.fillRect(x - 2, y - 2, 5, 5); });
};
G.HELP = [['MOVE', 'ARROWS / WASD'], ['ATTACK', 'J / Z  TAP x3'], ['JUMP', 'K / X / SPACE'], ['SPECIAL', 'HOLD L / C'], ['GRAB+THROW', 'U / V / I'], ['AIR ATTACK', 'ATTACK IN AIR'], ['DIVE', 'DOWN + AIR ATTACK'], ['PAUSE / MUTE', 'ESC / M']];
const C = { red: '#d8271d', redD: '#4a0f12', yel: '#ffd23a', yelD: '#7a5a00', blu: '#38b6ff', bluD: '#0d2a55', panel: '#1d1030', edge: '#f6ead0' };
const stat = (ctx, x, y, label, v, S1) => { T(ctx, label, x, y, 5 * S1, CREAM); for (let i = 0; i < 5; i++) { ctx.fillStyle = INK; ctx.fillRect(x + (40 + i * 11) * S1, y - 6 * S1, 9 * S1, 7 * S1); ctx.fillStyle = i < v ? GOLD : '#3a2a4a'; ctx.fillRect(x + (40 + i * 11) * S1 + S1, y - 5 * S1, 7 * S1, 5 * S1); } };
function gauge(ctx, S1, x, y, w, h, pct, fill, back, hi) { const u = (v) => v * S1; ctx.fillStyle = INK; ctx.fillRect(u(x - 2), u(y - 2), u(w + 4), u(h + 4)); ctx.fillStyle = CREAM; ctx.fillRect(u(x - 1), u(y - 1), u(w + 2), u(h + 2)); ctx.fillStyle = back; ctx.fillRect(u(x), u(y), u(w), u(h)); const fw = Math.round(w * Math.max(0, Math.min(1, pct))); ctx.fillStyle = fill; ctx.fillRect(u(x), u(y), u(fw), u(h)); ctx.fillStyle = hi; ctx.fillRect(u(x), u(y), u(fw), u(Math.max(1, Math.floor(h / 3)))); ctx.fillStyle = 'rgba(0,0,0,.35)'; for (let i = 1; i < 12; i++) ctx.fillRect(u(x + w * i / 12) - 1, u(y), 1, u(h)); }
function frame(ctx, S1, x, y, w, h, col) { const u = (v) => v * S1; ctx.fillStyle = INK; ctx.fillRect(u(x - 3), u(y - 3), u(w + 6), u(h + 6)); ctx.fillStyle = col; ctx.fillRect(u(x - 2), u(y - 2), u(w + 4), u(h + 4)); ctx.fillStyle = C.panel; ctx.fillRect(u(x), u(y), u(w), u(h)); }
P.renderUI = function (view, low) {
  const ctx = view.getContext('2d'), S1 = view.width / GW, W = view.width, H = view.height; ctx.imageSmoothingEnabled = false;
  if (this.state === 'loading') { ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H); T(ctx, 'GREASE & GOLD', W / 2, H * .45, 24 * S1, GOLD, 'center'); T(ctx, 'LOADING...', W / 2, H * .58, 8 * S1, CREAM, 'center'); return; }
  ctx.imageSmoothingEnabled = (W % low.width) !== 0; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(low, 0, 0, W, H); ctx.imageSmoothingEnabled = false;
  if (this.state === 'title') this.uiTitle(ctx, S1, W, H); else if (this.state === 'select') this.uiSelect(ctx, S1, W, H);
  else { this.uiHud(ctx, S1, W, H); if (this.state === 'pause') this.uiPause(ctx, S1, W, H); if (this.state === 'gameover') this.uiEnd(ctx, S1, W, H, 'GAME OVER', RED, ['SCORE ' + String(this.score).padStart(7, '0')], 'ENTER: CONTINUE   ESC: TITLE'); if (this.state === 'stageclear') this.uiEnd(ctx, S1, W, H, 'STAGE CLEAR', GOLD, [this.stage.name.toUpperCase(), 'SCORE ' + String(this.score).padStart(7, '0'), 'LIVES ' + this.lives], 'ENTER: NEXT STOP'); if (this.state === 'victory') this.uiEnd(ctx, S1, W, H, 'TOUR COMPLETE', GOLD2, ['GREASE & GOLD TAKE THE CROWN', 'FINAL SCORE ' + String(this.score).padStart(7, '0')], 'ENTER: TITLE'); }
};
P.renderLow = function (low) {
  const c = low.getContext('2d'); c.imageSmoothingEnabled = false;
  if (this.state === 'title' || this.state === 'select') { const si = this.state === 'title' ? 0 : 3; this.buildBg(si); const bg = this.bgs[si], sc = Math.round(((this.t * .3) % 600) * Z); c.drawImage(bg.far, -Math.floor(sc * .2), 0); c.drawImage(bg.mid, -Math.floor(sc * .5), 0); c.drawImage(bg.floor, -sc, 0); c.fillStyle = 'rgba(14,6,24,.5)'; c.fillRect(0, 0, low.width, low.height);
    if (this.state === 'title') ['ricky', 'vv', 'johnny'].forEach((id, i) => { const e = { kitId: id, anim: 'idle', frame: Math.floor(this.t / 14 + i) % 4, x: 112 + i * 80, y: 200, z: 0, face: i === 2 ? -1 : 1, flash: 0 }; this.drawFighter(c, e, 0, 0, 0); }); return; }
  if (this.stage) this.renderWorld(c);
};
P.uiTitle = function (ctx, S1, W, H) {
  const u = (v) => v * S1;
  ctx.fillStyle = 'rgba(14,6,24,.55)'; ctx.fillRect(0, u(30), W, u(88));
  T(ctx, 'GREASE & GOLD', W / 2 + u(2), u(66) + u(2), u(24), MAG, 'center'); T(ctx, 'GREASE & GOLD', W / 2, u(66), u(24), GOLD, 'center');
  ctx.fillStyle = MAG; ctx.fillRect(u(86), u(76), u(212), u(18)); ctx.fillStyle = INK; ctx.fillRect(u(86), u(76), u(212), u(2)); ctx.fillRect(u(86), u(92), u(212), u(2));
  T(ctx, 'WORLD TOUR', W / 2, u(90), u(16), CREAM, 'center');
  if ((this.t >> 5) & 1) T(ctx, 'PRESS ENTER OR TAP', W / 2, u(116), u(8), CREAM, 'center');
  T(ctx, 'J ATTACK   K JUMP   L SPECIAL   U GRAB', W / 2, u(203), u(5), DIM, 'center'); T(ctx, '(C) GREASE & GOLD RECORDS', W / 2, u(213), u(5), '#6a5a80', 'center');
};
P.uiSelect = function (ctx, S1, W, H) {
  const u = (v) => v * S1, ids = Object.keys(G.CH); T(ctx, 'SELECT YOUR FIGHTER', W / 2, u(13), u(8), GOLD, 'center');
  ids.forEach((id, i) => { const d = G.CH[id], cx = GW / 2 + (i - 1) * 124, x = cx - 56, y = 19, sel = i === this.sel, sh = this.sheets[d.kit]; frame(ctx, S1, x, y, 112, 186, sel ? GOLD : '#5a4a6a');
    if (sh) { const fr = sh.frames.idle, f = fr[sel ? Math.floor(this.t / 14) % fr.length : 0], k = S1 / Z * .95; ctx.globalAlpha = sel ? 1 : .55; ctx.imageSmoothingEnabled = true; ctx.drawImage(sh.canvas, f.x, f.y, f.w, f.h, u(cx) + f.ox * k, u(y + 110) + f.oy * k, f.w * k, f.h * k); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = 1; }
    T(ctx, d.name.toUpperCase(), u(cx), u(y + 120), u(8), sel ? GOLD2 : CREAM, 'center'); T(ctx, d.weapon.toUpperCase().slice(0, 18), u(cx), u(y + 129), u(5), DIM, 'center');
    T(ctx, d.special.toUpperCase(), u(cx), u(y + 141), u(5), MAG, 'center');
    stat(ctx, u(x + 8), u(y + 154), 'POW', d.stats.power, S1); stat(ctx, u(x + 8), u(y + 163), 'SPD', d.stats.speed, S1); stat(ctx, u(x + 8), u(y + 172), 'RCH', d.stats.reach, S1); stat(ctx, u(x + 8), u(y + 181), 'HP', d.stats.health, S1); });
  const bl = G.CH[ids[this.sel]].blurb.split('|'); bl.forEach((l, k) => T(ctx, l.toUpperCase(), W / 2, u(211 + k * 5.5), u(5), CREAM, 'center'));
};
P.uiHud = function (ctx, S1, W, H) {
  const u = (v) => v * S1, p = this.players[0]; if (!p) return; const d = p.def;
  frame(ctx, S1, 7, 6, 40, 40, GOLD); const pt = this.portraits[d.kit]; ctx.imageSmoothingEnabled = true; if (pt) ctx.drawImage(pt, u(7), u(6), u(40), u(40)); ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = INK; ctx.fillRect(u(7), u(36), u(14), u(10)); T(ctx, '1P', u(8), u(44), u(5), GOLD2);
  T(ctx, d.name.toUpperCase(), u(56), u(15), u(8), GOLD2); T(ctx, 'x' + Math.max(0, this.lives), u(150), u(15), u(8), CREAM, 'right');
  const low = p.hp / p.maxhp < .3 && (this.t >> 3) & 1; gauge(ctx, S1, 58, 20, 92, 8, p.hp / p.maxhp, low ? '#ff6a4a' : C.yel, C.redD, '#fff0a0');
  gauge(ctx, S1, 58, 32, 92, 5, p.hype / 100, p.state === 'special' ? '#9be6ff' : C.blu, C.bluD, '#d6f4ff'); T(ctx, 'HYPE', u(58), u(45), u(5), '#9be6ff');
  T(ctx, 'SCORE', u(GW / 2 + 6), u(11), u(5), DIM, 'center'); T(ctx, String(this.score).padStart(7, '0'), u(GW / 2 + 6), u(21), u(8), CREAM, 'center');
  if (this.lastEnemyT > 0 && this.lastEnemy && !this.lastEnemy.boss) { const e = this.lastEnemy, pe = this.portraits[e.kitId]; frame(ctx, S1, 331, 6, 40, 40, '#b0407a'); ctx.imageSmoothingEnabled = true; if (pe) ctx.drawImage(pe, u(331), u(6), u(40), u(40)); ctx.imageSmoothingEnabled = false; T(ctx, e.def.name.toUpperCase().slice(0, 14), u(326), u(15), u(5), CREAM, 'right'); gauge(ctx, S1, 236, 20, 90, 8, e.hp / e.maxhp, '#ff5aa8', '#3a0f2a', '#ffc6e0'); }
  const boss = this.enemies.find(e => e.boss && e.state !== 'dead' && !e.remove);
  if (boss && boss.state !== 'spawn') { const pb = this.portraits[boss.kitId]; frame(ctx, S1, 40, 170, 30, 30, '#b0407a'); ctx.imageSmoothingEnabled = true; if (pb) ctx.drawImage(pb, 0, 0, pb.width, pb.height, u(40), u(170), u(30), u(30)); ctx.imageSmoothingEnabled = false; T(ctx, boss.def.name.toUpperCase(), u(78), u(181), u(8), GOLD2); gauge(ctx, S1, 78, 186, 266, 10, boss.hp / boss.maxhp, '#ff5aa8', '#3a0f2a', '#ffc6e0'); }
  if (this.combo.n >= 2 && this.combo.t > 0) { const pop = Math.max(0, (this.combo.pop = Math.max(0, (this.combo.pop || 0) - .5))); T(ctx, this.combo.n + ' HITS', u(8), u(62), u(8 + pop * .8), this.combo.n >= 8 ? GOLD2 : CREAM); }
  if (this.state === 'play') {
    if (this.banner > 0 && this.stage) { const a = Math.min(1, this.banner / 20, (170 - this.banner) / 12 + .2); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(20,9,28,.85)'; ctx.fillRect(0, u(78), W, u(54)); ctx.fillStyle = MAG; ctx.fillRect(0, u(78), W, u(2)); ctx.fillRect(0, u(130), W, u(2)); T(ctx, this.stage.tour.replace(/ {2,}/g, ' '), W / 2, u(94), u(8), MAG, 'center'); T(ctx, this.stage.name.toUpperCase(), W / 2, u(120), u(16), GOLD, 'center'); ctx.globalAlpha = 1; }
    if (this.bossBanner > 0 && (this.bossBanner >> 3) & 1) T(ctx, 'WARNING', W / 2, u(80), u(16), RED, 'center');
    if (this.waveState === 'walk' && this.stage && this.waveIdx < this.stage.waves.length && this.goT > 10 && this.waveIdx > 0 && (this.goT >> 4) & 1) { const pts = [[GW - 30, 91], [GW - 19, 91], [GW - 19, 86], [GW - 7, 94.5], [GW - 19, 103], [GW - 19, 98], [GW - 30, 98]]; ctx.save(); ctx.beginPath(); pts.forEach((q, i) => i ? ctx.lineTo(u(q[0]), u(q[1])) : ctx.moveTo(u(q[0]), u(q[1]))); ctx.closePath(); ctx.lineJoin = 'miter'; ctx.miterLimit = 2; ctx.lineWidth = Math.max(2, u(2)); ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = GOLD2; ctx.fill(); ctx.restore(); T(ctx, 'GO', u(GW - 46), u(100), u(16), GOLD2, 'center'); }
    if (this.flashT > 0) { ctx.fillStyle = 'rgba(255,255,255,' + this.flashT / 10 + ')'; ctx.fillRect(0, 0, W, H); }
  }
};
P.uiPause = function (ctx, S1, W, H) {
  const u = (v) => v * S1; ctx.fillStyle = 'rgba(14,6,24,.82)'; ctx.fillRect(0, 0, W, H); T(ctx, 'PAUSED', W / 2, u(40), u(16), GOLD, 'center');
  ['RESUME', 'RESTART STAGE', this.showHelp ? 'HIDE CONTROLS' : 'CONTROLS', 'QUIT TO TITLE'].forEach((s, i) => T(ctx, (i === this.menu ? '> ' : '  ') + s, W / 2 - u(70), u(66 + i * 14), u(8), i === this.menu ? GOLD2 : CREAM));
  if (this.showHelp) G.HELP.forEach((r, i) => { T(ctx, r[0], u(60), u(136 + i * 9), u(5), CREAM); T(ctx, r[1], u(170), u(136 + i * 9), u(5), DIM); });
};
P.uiEnd = function (ctx, S1, W, H, title, col, lines, hint) {
  const u = (v) => v * S1; ctx.fillStyle = 'rgba(14,6,24,.84)'; ctx.fillRect(0, 0, W, H); T(ctx, title, W / 2 + u(2), u(66) + u(2), u(title.length > 11 ? 16 : 24), MAG, 'center'); T(ctx, title, W / 2, u(66), u(title.length > 11 ? 16 : 24), col, 'center'); lines.forEach((l, i) => T(ctx, l, W / 2, u(98 + i * 16), u(8), CREAM, 'center'));
  if ((this.t >> 5) & 1) T(ctx, hint, W / 2, u(176), u(8), GOLD2, 'center');
};
})(globalThis.GG = globalThis.GG || {});
