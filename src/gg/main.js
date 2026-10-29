/* Browser bootstrap: asset loading, integer-scaled canvas, fixed 60Hz loop,
   pointer/touch, audio unlock, invite links. */
(function (G) {
'use strict';
const LW = G.LW, LH = G.LH;
const view = document.getElementById('view');
let low = null, ctx = null, scale = 2;

/* Asset URLs carry the build version: an atlas and its frame table must always
   come from the same build, otherwise cached offsets point into new pixels and
   fighters render as garbage. */
const asset = (p) => p + '?v=' + encodeURIComponent((typeof window !== 'undefined' && window.GG_ASSET_HASH) || G.VERSION);
function loadImage(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(src)); i.src = asset(src); }); }
async function loadJSON(src) { const r = await fetch(asset(src), { cache: 'no-cache' }); if (!r.ok) throw new Error(src + ' ' + r.status); return r.json(); }

function fit() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const availW = window.innerWidth, availH = window.innerHeight;
  /* fractional fit so portrait/narrow screens use their full width; the
     canvas is upscaled with pixelated CSS so pixels stay hard */
  scale = Math.max(.5, Math.min(availW / LW, availH / LH));
  view.width = Math.round(LW * scale * dpr); view.height = Math.round(LH * scale * dpr);
  const cssW = view.width / dpr, cssH = view.height / dpr;
  view.style.width = cssW + 'px'; view.style.height = cssH + 'px';
  low.width = LW; low.height = LH;
  ctx = low.getContext('2d'); ctx.imageSmoothingEnabled = false;
}
function renderFrame(game) {
  const v = view.getContext('2d');
  v.imageSmoothingEnabled = false;
  v.fillStyle = '#07050c'; v.fillRect(0, 0, view.width, view.height);
  if (game.screen === 'play' || game.screen === 'pause' || game.screen === 'clear' || game.screen === 'over' || game.screen === 'victory') {
    const shake = game.settings.shake && game.shake > .3 && game.screen === 'play' ? game.shake : 0;
    const ox = shake ? Math.round((Math.random() * 2 - 1) * shake) : 0;
    const oy = shake ? Math.round((Math.random() * 2 - 1) * shake * .6) : 0;
    ctx.save(); ctx.translate(ox, oy);
    G.Render.world(game, ctx);
    ctx.restore();
    G.Render.hud(game, ctx);
  } else {
    ctx.fillStyle = '#0b0812'; ctx.fillRect(0, 0, LW, LH);
  }
  G.Render.screen(game, ctx);
  if (game.settings.scanlines) G.Render.scanlines(ctx);
  v.drawImage(low, 0, 0, view.width, view.height);
}

(async function boot() {
  low = document.createElement('canvas');
  low.width = LW; low.height = LH;
  ctx = low.getContext('2d'); ctx.imageSmoothingEnabled = false;
  fit();
  window.addEventListener('resize', fit);
  const settings = G.loadSettings();
  G.Input.init(settings);
  const game = G.game = new G.Game({ settings: settings, audio: G.Audio, net: null, meta: null });
  game.screen = 'loading';
  let pct = 0;
  const drawLoad = (p, label) => { G.Render.loading(ctx, p, label); const v = view.getContext('2d'); v.imageSmoothingEnabled = false; v.drawImage(low, 0, 0, view.width, view.height); };
  drawLoad(0, 'LOADING ATLAS');
  try {
    const [meta, props] = await Promise.all([loadJSON('assets/gg/fighters.json'), loadJSON('assets/gg/props.json')]);
    pct = .15; drawLoad(pct, 'LOADING FIGHTERS');
    const fighters = await loadImage('assets/gg/fighters.png');
    const propsImg = await loadImage('assets/gg/props.png');
    const stages = [];
    for (let i = 0; i < G.STAGES.length; i++) {
      drawLoad(.3 + i * .16, 'LOADING ' + G.STAGES[i].name.toUpperCase());
      const [far, mid, floor] = await Promise.all([
        loadImage('assets/gg/stage' + i + '_far.png'),
        loadImage('assets/gg/stage' + i + '_mid.png'),
        loadImage('assets/gg/stage' + i + '_floor.png')
      ]);
      stages.push({ far: far, mid: mid, floor: floor });
    }
    G.Render.init({ meta: meta, fighters: fighters, props: props, propsImg: propsImg, stages: stages });
    game.meta = meta;
    game.audio = G.Audio;
    G.Audio.applySettings(settings);
    drawLoad(1, 'READY');
    G.net = game.net = new G.Net();
    /* invite links: ?room=CODE (relay) or ?room=CODE&local=1 (same-browser) */
    const room = G.roomFromUrl();
    G.localRoom = /[?&]local=1/.test(location.search);
    if (room) {
      game.mode = 'online'; game.joinCode = room; game.screen = 'join';
      game.joinError = '';
      try { game.invite = G.inviteUrl(room); } catch (e) {}
      game.screen = 'online'; game.menu = 1;
      game.toastMsg('ROOM ' + room + ' - PRESS ENTER TO JOIN');
    } else {
      game.screen = 'title';
      G.Audio.music('title');
    }
  } catch (err) {
    game.screen = 'title';
    G.gameError = String(err && err.message || err);
    drawLoad(1, 'ASSETS MISSING - RUN npm run art');
    console.error(err);
  }

  /* pointer / touch */
  function toLocal(ev) {
    const r = view.getBoundingClientRect();
    return { x: (ev.clientX - r.left) / r.width * LW, y: (ev.clientY - r.top) / r.height * LH };
  }
  view.addEventListener('pointerdown', ev => {
    G.Audio.unlock(); G.Audio.applySettings(settings);
    const p = toLocal(ev);
    for (let i = game.hot.length - 1; i >= 0; i--) {
      const h = game.hot[i];
      if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) { game.clickHot(h); return; }
    }
    if (game.screen === 'title') game.goto('main');
    else if (game.screen === 'play') { G.Input.setEdge('p1', 'attack'); }
  });
  const touch = document.getElementById('touch');
  if ('ontouchstart' in window || (window.matchMedia && matchMedia('(pointer:coarse)').matches)) touch.classList.add('on');
  document.querySelectorAll('[data-btn]').forEach(el => {
    const b = el.dataset.btn;
    const on = (v) => (ev) => { ev.preventDefault(); G.Input.touch[b] = v; el.classList.toggle('down', v); };
    el.addEventListener('pointerdown', ev => { el.setPointerCapture(ev.pointerId); G.Audio.unlock(); on(true)(ev); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(e => el.addEventListener(e, on(false)));
  });
  const dpad = document.getElementById('dpad');
  if (dpad) {
    const dp = (ev) => {
      const r = dpad.getBoundingClientRect();
      const x = (ev.clientX - r.left) / r.width * 2 - 1, y = (ev.clientY - r.top) / r.height * 2 - 1;
      const m = Math.hypot(x, y), dead = m < .24;
      G.Input.touch.left = !dead && x < -.3; G.Input.touch.right = !dead && x > .3;
      G.Input.touch.up = !dead && y < -.3; G.Input.touch.down = !dead && y > .3;
    };
    dpad.addEventListener('pointerdown', ev => { ev.preventDefault(); dpad.setPointerCapture(ev.pointerId); dp(ev); });
    dpad.addEventListener('pointermove', ev => { if (ev.buttons || ev.pressure > 0) dp(ev); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(e => dpad.addEventListener(e, () => { G.Input.touch.left = G.Input.touch.right = G.Input.touch.up = G.Input.touch.down = false; }));
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(e => window.addEventListener(e, () => { G.Audio.unlock(); G.Audio.applySettings(settings); }, { passive: true }));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.screen === 'play') { game.pause(); }
    if (document.hidden) G.Input.clear();
  });
  window.addEventListener('blur', () => G.Input.clear());

  /* fixed-step loop with bounded catch-up */
  let last = performance.now(), acc = 0;
  const STEP = 1000 / 60;
  function frame(now) {
    acc += Math.min(120, now - last); last = now;
    let n = 0;
    while (acc >= STEP && n < 5) {
      G.Input.pollPads();
      G.Input.compute();
      game.update();
      G.Input.tick();
      G.Input.endFrame();
      G.Audio.tick();
      game.hot = [];
      acc -= STEP; n++;
    }
    if (n === 5) acc = 0;
    renderFrame(game);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  G.Input.setWaiting(false);
})();
})(globalThis.GG = globalThis.GG || {});
