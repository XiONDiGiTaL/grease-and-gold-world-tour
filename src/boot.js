/* Browser bootstrap: canvas sizing, fixed-timestep loop, pointer/touch controls. */
(function (G) {
'use strict';
const GW = G.GW, GH = G.GH, I = G.Input, view = document.getElementById('view'), low = G.makeCanvas(Math.round(GW * G.Z), Math.round(GH * G.Z));
const touch = document.getElementById('touch'), game = G.game = new G.Game(); game.state = 'loading';
function resize() {
  const dpr = window.devicePixelRatio || 1, w = window.innerWidth, h = window.innerHeight; let s = Math.min(w * dpr / GW, h * dpr / GH); if (s >= 1) s = Math.floor(s);
  view.width = Math.round(GW * s); view.height = Math.round(GH * s); view.style.width = (view.width / dpr) + 'px'; view.style.height = (view.height / dpr) + 'px';
}
window.addEventListener('resize', resize); resize();
const unlock = () => G.Audio.unlock(); ['pointerdown', 'keydown', 'touchstart'].forEach(e => window.addEventListener(e, unlock, { passive: true }));
let last = performance.now(), acc = 0; const STEP = 1000 / 60;
function frame(now) {
  acc += Math.min(100, now - last); last = now; let n = 0;
  while (acc >= STEP && n < 5) { if (game.state !== 'loading' || game.pending) game.update(); acc -= STEP; n++; } if (n === 5) acc = 0;
  game.renderLow(low); game.renderUI(view, low); G.Music.sync(); touch.classList.toggle('off', game.state !== 'play' && game.state !== 'pause'); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
G.loadFont().then(() => setTimeout(() => { game.initAssets(G.makeCanvas); game.state = 'title'; }, 60));
document.addEventListener('visibilitychange', () => { if (document.hidden && game.state === 'play') { game.state = 'pause'; game.menu = 0; I.clear(); } });

/* canvas taps for menus */
view.addEventListener('pointerdown', ev => {
  const r = view.getBoundingClientRect(), lx = (ev.clientX - r.left) / r.width * GW, ly = (ev.clientY - r.top) / r.height * GH, st = game.state;
  if (st === 'title' || st === 'gameover' || st === 'stageclear' || st === 'victory') { I.set('start', true); setTimeout(() => I.set('start', false), 40); }
  else if (st === 'select') { const i = Math.floor((lx - (GW / 2 - 62 - 124)) / 124); if (ly > 24 && ly < 206 && i >= 0 && i < 3) { if (game.sel === i) { I.set('start', true); setTimeout(() => I.set('start', false), 40); } else { game.sel = i; G.Audio.play('ui'); } } }
  else if (st === 'pause') { const i = Math.floor((ly - 60) / 15); if (i >= 0 && i < 4) { game.menu = i; game.pauseChoose(i); } }
});

/* touch controls */
if ('ontouchstart' in window || (window.matchMedia && matchMedia('(pointer:coarse)').matches)) touch.classList.add('on');
const T = I._touch;
document.querySelectorAll('[data-btn]').forEach(el => { const b = el.dataset.btn;
  const on = (v) => (ev) => { ev.preventDefault(); T[b] = v; el.classList.toggle('down', v); I.recompute(); }; el.addEventListener('pointerdown', ev => { el.setPointerCapture(ev.pointerId); on(true)(ev); }); ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(e => el.addEventListener(e, on(false))); });
const dpad = document.getElementById('dpad');
function dp(ev) { const r = dpad.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width * 2 - 1, y = (ev.clientY - r.top) / r.height * 2 - 1, m = Math.hypot(x, y); const dead = m < .22; T.left = !dead && x < -.3; T.right = !dead && x > .3; T.up = !dead && y < -.3; T.down = !dead && y > .3; I.recompute(); }
dpad.addEventListener('pointerdown', ev => { ev.preventDefault(); dpad.setPointerCapture(ev.pointerId); dp(ev); }); dpad.addEventListener('pointermove', ev => { if (ev.buttons || ev.pressure > 0) dp(ev); });
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(e => dpad.addEventListener(e, () => { T.left = T.right = T.up = T.down = false; I.recompute(); }));
})(globalThis.GG);
