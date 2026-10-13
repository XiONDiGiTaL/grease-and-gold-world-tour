// Runs the REAL shipped HTML file (all scripts inlined) in jsdom with a napi-canvas backend, drives it with real keyboard events
// (title -> select -> play -> attack/jump/special), screenshots the actual <canvas>, and fails on ANY runtime error.
//   node tools/run_html.js play-v10.html [outDir]
const fs = require('fs'), path = require('path'); const { JSDOM, VirtualConsole } = require('jsdom'); const { createCanvas } = require('@napi-rs/canvas');
const file = process.argv[2], outDir = process.argv[3] || 'shots_html'; fs.mkdirSync(outDir, { recursive: true });
const errors = []; const vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.detail && e.detail.stack || e.message))); vc.on('error', e => errors.push('console.error: ' + e));
const dom = new JSDOM(fs.readFileSync(file, 'utf8'), { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: 'file:///' + path.basename(file), beforeParse(w) {
  const real = new WeakMap(), proto = w.HTMLCanvasElement.prototype;
  proto.getContext = function (t) { let c = real.get(this); if (!c) { c = createCanvas(this.width || 300, this.height || 150); real.set(this, c); this._c = c; const ctx = c.getContext('2d'), di = ctx.drawImage.bind(ctx); ctx.drawImage = (img, ...a) => di(img && img._c ? img._c : img, ...a); c._ctx = ctx; }
    if (this.width && (c.width !== this.width || c.height !== this.height)) { c.width = this.width; c.height = this.height; const ctx = c.getContext('2d'), di = ctx.drawImage.bind(ctx); ctx.drawImage = (img, ...a) => di(img && img._c ? img._c : img, ...a); c._ctx = ctx; } return c._ctx || c.getContext(t); };
  w.addEventListener('error', e => errors.push('window.onerror: ' + e.message + ' @' + e.filename + ':' + e.lineno)); w.matchMedia = () => ({ matches: false }); w.AudioContext = undefined; w.webkitAudioContext = undefined;
} });
const w = dom.window, sleep = (ms) => new Promise(r => setTimeout(r, ms));
const key = (code, down) => w.dispatchEvent(new w.KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true, cancelable: true }));
const tap = async (code, ms = 60) => { key(code, true); await sleep(ms); key(code, false); await sleep(40); };
const shot = (name) => { const v = w.document.getElementById('view'); fs.writeFileSync(path.join(outDir, name + '.png'), v._c.toBuffer('image/png')); };
const until = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(50); } return false; };
const checks = []; const ok = (c, n, i) => { checks.push([c, n]); console.log(c ? 'PASS' : 'FAIL', n, c ? '' : '-> ' + JSON.stringify(i)); };
(async () => {
  const G = w.GG; ok(!!G && !!G.game, 'page scripts executed (GG.game exists)');
  const booted = await until(() => G.game.state === 'title', 60000); ok(booted, 'boots past loading to the title screen', G.game.state); await sleep(400); shot('01_title');
  await tap('Enter'); ok(G.game.state === 'select', 'Enter on title opens character select', G.game.state); await sleep(300); shot('02_select');
  await tap('ArrowRight'); await tap('ArrowLeft');
  await tap('Enter'); ok(G.game.state === 'play', 'Enter starts the game', G.game.state);
  await sleep(2600); const p = G.game.players[0]; const x0 = p.x; shot('03_play_start');
  key('ArrowRight', true); await sleep(1500); key('ArrowRight', false); ok(p.x > x0 + 30, 'holding right walks the fighter', p.x - x0);
  const y0 = p.y; key('ArrowDown', true); await sleep(500); key('ArrowDown', false); ok(p.y > y0 + 5, 'holding down walks into the lane', p.y - y0);
  await tap('KeyK', 80); await sleep(250); ok(p.z > 0 || p.state === 'jump', 'K jumps', { z: p.z, s: p.state }); await sleep(900);
  const e = G.game.makeEnemy('exec', p.x + 70, p.y); e.state = 'idle'; e.cool = 9999; e.face = -1; e.hp = e.maxhp = 400; G.game.enemies.push(e);
  key('ArrowRight', true); await sleep(500); key('ArrowRight', false);
  const hp0 = e.hp; for (let i = 0; i < 4; i++) { await tap('KeyJ', 70); await sleep(180); } await sleep(300); ok(e.hp < hp0, 'J attack hurts an enemy', { hp0, hp: e.hp }); shot('04_attack');
  p.hype = 60; key('KeyL', true); await sleep(700); ok(p.state === 'special', 'holding L performs the special', p.state); shot('05_special'); key('KeyL', false); await sleep(300);
  G.game.items.push({ type: 'adana', x: p.x + 60, y: p.y, z: 0, life: 900, t: 0 }); G.game.items.push({ type: 'spit', x: p.x + 120, y: p.y - 6, z: 0, life: 900, t: 0 }); await sleep(400); shot('06_food');
  key('Escape', true); await sleep(80); key('Escape', false); await sleep(200); ok(G.game.state === 'pause', 'Esc pauses', G.game.state); shot('07_pause');
  key('Escape', true); await sleep(80); key('Escape', false); await sleep(200); ok(G.game.state === 'play', 'Esc resumes', G.game.state);
  ok(errors.length === 0, 'no runtime errors during the whole session', errors.slice(0, 5));
  const fails = checks.filter(c => !c[0]).length; console.log(fails ? `\n${fails} FAILED` : '\nREAL-PAGE TEST OK'); process.exit(fails ? 1 : 0);
})();
