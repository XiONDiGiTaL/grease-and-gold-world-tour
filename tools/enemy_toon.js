/* Soft-shaded "vinyl toy" enemy renderer. Uses the engine's own skeletons + pose tables (Art._test.solve / posesFor),
   draws gradient-shaded chibi bodies at 3x, packs assets/gg/enemies.png + enemies.json.   node tools/enemy_toon.js */
const fs = require('fs'), path = require('path');
require('../src/gg/core.js'); require('../src/gg/art.js');
const { createCanvas } = require('@napi-rs/canvas');
const G = globalThis.GG, Art = G.Art, T = Art._test, K = 3;
const CW = 170, CH = 170, AXn = 85, AYn = 138;            /* my cell (logical units) + feet anchor */
const E = Art.CELL, SHX = AXn - E.ax, SHY = AYn - E.ay;   /* engine cell -> my cell */
const OUT = '#1c1424';
const GOLD = { hi: Art.hex(0xffdc72), base: Art.hex(0xe8b93a), sh: Art.hex(0xa87c18) }, STEEL = { hi: Art.hex(0xcccccc), base: Art.hex(0x999999), sh: Art.hex(0x666666) };
const css = (c) => { const r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255; return `rgb(${r},${g},${b})`; };
const mix = (c, k) => { const r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255; return `rgb(${Math.max(0, Math.min(255, r * k)) | 0},${Math.max(0, Math.min(255, g * k)) | 0},${Math.max(0, Math.min(255, b * k)) | 0})`; };

function limbPath(x, a, b, w0, w1) {
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, ang = Math.atan2(dy, dx);
  x.beginPath(); x.moveTo(a.x + nx * w0 / 2, a.y + ny * w0 / 2); x.lineTo(b.x + nx * w1 / 2, b.y + ny * w1 / 2);
  x.arc(b.x, b.y, w1 / 2, ang + Math.PI / 2, ang - Math.PI / 2, true); x.lineTo(a.x - nx * w0 / 2, a.y - ny * w0 / 2); x.arc(a.x, a.y, w0 / 2, ang - Math.PI / 2, ang + Math.PI / 2, true); x.closePath();
}
function shaded(x, a, b, w, pal) {       /* gradient across the limb: light edge, base, shadow edge */
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const g = x.createLinearGradient(mx - nx * w / 2, my - ny * w / 2, mx + nx * w / 2, my + ny * w / 2);
  g.addColorStop(0, css(pal.hi)); g.addColorStop(.45, css(pal.base)); g.addColorStop(1, css(pal.sh)); return g;
}
function limb(x, a, b, w0, w1, pal) {
  limbPath(x, a, b, w0, w1); x.fillStyle = shaded(x, a, b, (w0 + w1) / 2, pal); x.fill(); x.lineWidth = .9; x.strokeStyle = OUT; x.lineJoin = 'round'; x.stroke();
}
function ball(x, cx, cy, rx, ry, pal, ang) {
  x.beginPath(); x.ellipse(cx, cy, rx, ry, ang || 0, 0, 7); const g = x.createRadialGradient(cx - rx * .35, cy - ry * .4, 0, cx, cy, Math.max(rx, ry) * 1.1);
  g.addColorStop(0, css(pal.hi)); g.addColorStop(.55, css(pal.base)); g.addColorStop(1, css(pal.sh)); x.fillStyle = g; x.fill(); x.lineWidth = .9; x.strokeStyle = OUT; x.stroke();
}
function rr(x, cx, cy, w, h, r, ang, pal, noOutline) {
  x.save(); x.translate(cx, cy); x.rotate(ang || 0); x.beginPath(); x.roundRect(-w / 2, -h / 2, w, h, r);
  const g = x.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); g.addColorStop(0, css(pal.hi)); g.addColorStop(.5, css(pal.base)); g.addColorStop(1, css(pal.sh)); x.fillStyle = g; x.fill();
  if (!noOutline) { x.lineWidth = .9; x.strokeStyle = OUT; x.stroke(); } x.restore();
}

function drawKit(kit, anim, fi) {
  const poses = kit._poses || (kit._poses = Art.posesFor(kit)), list = poses[anim] || poses.idle, P = list[Math.min(fi, list.length - 1)];
  const J = T.solve(kit, P), b = kit.b, s = b.s, pal = kit.pal, face = kit.face, skin = { base: Art.hex(kit.skin.base), hi: Art.hex(kit.skin.hi), sh: Art.hex(kit.skin.sh) };   /* SKIN holds raw 0xRRGGBB */
  const c = createCanvas(CW * K, CH * K), x = c.getContext('2d'); x.scale(K, K); x.translate(AXn, AYn); x.scale(.86, .86); x.translate(-AXn, -AYn); x.translate(SHX, SHY);
  const bulk = 1.22, W = (v) => v * s * bulk;            /* chibi thickness */
  const suit = pal.suit || pal.coat || pal.vest || pal.top || pal.denim, under = pal.pants || pal.leather || suit, shoeP = pal.shoe || pal.boot || suit;
  x.lineCap = 'round';
  /* weapon behind for windups */
  const wb = P.wbehind || P.wpn < -115;
  const weaponDraw = () => {
    const h = J.armF.ha, r = P.wpn * Math.PI / 180, ux = Math.cos(r), uy = Math.sin(r);
    const L = (kit.weapon === 'case' ? 0 : 17) * s;
    if (kit.weapon === 'baton') { limb(x, { x: h.x - ux * 3, y: h.y - uy * 3 }, { x: h.x + ux * L, y: h.y + uy * L }, 3.2 * s, 3 * s, pal.gold || pal.mic || STEEL); ball(x, h.x + ux * L, h.y + uy * L, 2.6 * s, 2.6 * s, pal.gold || GOLD); }
    else if (kit.weapon === 'bottle') { limb(x, h, { x: h.x + ux * 11 * s, y: h.y + uy * 11 * s }, 5.4 * s, 4 * s, pal.glass); limb(x, { x: h.x + ux * 10 * s, y: h.y + uy * 10 * s }, { x: h.x + ux * 15 * s, y: h.y + uy * 15 * s }, 2.2 * s, 2.2 * s, pal.glass); }
    else if (kit.weapon === 'book') rr(x, h.x + ux * 5 * s, h.y + uy * 5 * s, 13 * s, 10 * s, 1.2, r, pal.book);
    else if (kit.weapon === 'case') { rr(x, h.x + ux * 8 * s, h.y + uy * 8 * s + 4, 18 * s, 12 * s, 1.6, r, pal.case); rr(x, h.x + ux * 8 * s, h.y + uy * 8 * s + 4, 3 * s, 3 * s, .8, r, pal.gold || GOLD); }
    else if (kit.weapon === 'mic') { limb(x, h, { x: h.x + ux * 6 * s, y: h.y + uy * 6 * s }, 3 * s, 2.6 * s, pal.mic); ball(x, h.x + ux * 10 * s, h.y + uy * 10 * s, 4.6 * s, 4.6 * s, pal.mic); }
  };
  const arm = (A, back) => {
    const sleeve = suit, w = W(4.4);
    limb(x, A.sh, A.el, w, w * .92, sleeve); limb(x, A.el, A.ha, w * .9, w * .78, back ? sleeve : sleeve);
    ball(x, A.ha.x, A.ha.y, W(2.7), W(2.7), skin);
  };
  const leg = (Lg) => {
    limb(x, Lg.hip, Lg.kn, W(6), W(5.2), under); limb(x, Lg.kn, Lg.an, W(5.2), W(4.4), under);
    const fw = 1; ball(x, Lg.an.x + 2.4 * s * fw, Lg.an.y + 1.4, W(4.6), W(2.6), shoeP, 0);
  };
  if (wb) weaponDraw();
  arm(J.armB, true); leg(J.legB);
  /* torso */
  const sh = J.sh, hip = J.hip, lean = (P.lean || 0) * Math.PI / 180, px = Math.cos(lean), py = Math.sin(lean);
  const sw = W(b.shW * .56), hw = W(b.hipW * .5), belly = (face === 'jowls') ? 1.18 : 1;
  x.beginPath(); x.moveTo(sh.x - px * sw * .86, sh.y - py * sw * .86 - 1); x.quadraticCurveTo(sh.x - px * sw * 1.12, sh.y + 5, hip.x - px * hw * belly * 1.25, hip.y - 2);
  x.lineTo(hip.x - px * hw, hip.y + 2); x.lineTo(hip.x + px * hw, hip.y + 2); x.lineTo(hip.x + px * hw * belly * 1.25, hip.y - 2); x.quadraticCurveTo(sh.x + px * sw * 1.12, sh.y + 5, sh.x + px * sw * .86, sh.y + py * sw * .86 - 1); x.closePath();
  const tg = x.createLinearGradient(sh.x - sw, sh.y, sh.x + sw, sh.y); tg.addColorStop(0, css(suit.hi)); tg.addColorStop(.5, css(suit.base)); tg.addColorStop(1, css(suit.sh)); x.fillStyle = tg; x.fill(); x.lineWidth = .9; x.strokeStyle = OUT; x.stroke();
  const shirt = pal.shirt || pal.tee || pal.top, tie = pal.tie || pal.band;
  if (shirt && kit.id !== 'mara') { x.beginPath(); x.moveTo(sh.x - 3.5 * s, sh.y); x.lineTo(sh.x + 3.5 * s, sh.y); x.lineTo(sh.x + .8, hip.y - 7); x.lineTo(sh.x - .8, hip.y - 7); x.closePath(); x.fillStyle = css(shirt.base); x.fill(); x.stroke(); }
  if (tie && pal.tie) { x.beginPath(); x.moveTo(sh.x - 1.2, sh.y + 1); x.lineTo(sh.x + 1.2, sh.y + 1); x.lineTo(sh.x + 1.8, hip.y - 9); x.lineTo(sh.x, hip.y - 5); x.lineTo(sh.x - 1.8, hip.y - 9); x.closePath(); x.fillStyle = css(pal.tie.base); x.fill(); x.lineWidth = .6; x.stroke(); }
  if (kit.id === 'mara') { x.fillStyle = css(pal.top.base); x.fillRect(sh.x - sw * .8, sh.y - 1, sw * 1.6, 9); x.fillStyle = css(skin.base); x.fillRect(sh.x - sw * .7, sh.y + 8, sw * 1.4, 4); x.fillStyle = css(pal.belt.base); x.fillRect(hip.x - hw, hip.y - 3, hw * 2, 3); }
  if (kit.id === 'hobo') { x.fillStyle = css(pal.shirt.base); x.fillRect(sh.x - 2.5, sh.y, 5, 9); x.strokeStyle = mix(pal.coat.base, .6); x.lineWidth = .7; x.beginPath(); x.moveTo(sh.x, sh.y); x.lineTo(sh.x + .5, hip.y); x.stroke(); }
  if (kit.id === 'turd') { x.fillStyle = css(pal.shirt.base); x.fillRect(sh.x - 2.5, sh.y, 5, 10); }
  leg(J.legF);
  /* head */
  const hc = { x: J.head.x, y: J.head.y - 1 }, R = b.headR * 1.72 * (face === 'jowls' ? 1.04 : 1), hang = (P.head || 0) * Math.PI / 180 + lean;
  x.save(); x.translate(hc.x, hc.y); x.rotate(hang * .8);
  const fx = R * .22;      /* facing +x, slight 3/4 */
  if (face === 'box') {     /* Jooce: juice-box head with straw */
    rr(x, 0, 0, R * 2.15, R * 2.35, 2.2, 0, pal.box);
    x.fillStyle = css(pal.straw.base); x.fillRect(R * .15, -R * 1.18 - 6, 2, 7); x.fillRect(R * .15, -R * 1.18 - 6, R * .9, 2); x.strokeStyle = OUT; x.lineWidth = .6; x.strokeRect(R * .15, -R * 1.18 - 6, 2, 7);
    x.fillStyle = 'rgba(255,255,255,.85)'; x.beginPath(); x.roundRect(-R * .9 + fx, -R * .55, R * 1.7, R * 1.35, 2); x.fill();
    x.fillStyle = '#2a1a1a'; x.beginPath(); x.arc(-R * .35 + fx, -R * .1, 1.5, 0, 7); x.arc(R * .35 + fx, -R * .1, 1.5, 0, 7); x.fill(); x.strokeStyle = '#2a1a1a'; x.lineWidth = .9; x.beginPath(); x.arc(fx, R * .22, R * .38, .15, Math.PI - .15); x.stroke();
    x.fillStyle = css(pal.box.hi); x.globalAlpha = .45; x.fillRect(-R * 1.0, -R * 1.1, R * .45, R * 2); x.globalAlpha = 1;
  } else {
    ball(x, 0, 0, R, R * 1.05, skin);
    ball(x, -R * .92, R * .1, R * .2, R * .28, skin);     /* ear */
    const eyeY = -R * .08, ex = [R * .02 + fx, R * .52 + fx];
    if (face === 'glasses') { x.strokeStyle = OUT; x.lineWidth = .8; ex.forEach(e => { x.fillStyle = 'rgba(210,235,255,.65)'; x.beginPath(); x.arc(e, eyeY, R * .27, 0, 7); x.fill(); x.stroke(); }); x.beginPath(); x.moveTo(ex[0] + R * .27, eyeY); x.lineTo(ex[1] - R * .27, eyeY); x.stroke(); }
    ex.forEach(e => { x.fillStyle = '#fff'; x.beginPath(); x.ellipse(e, eyeY, R * .17, R * .21, 0, 0, 7); x.fill(); x.fillStyle = '#2b1c18'; x.beginPath(); x.arc(e + R * .05, eyeY + .3, R * .1, 0, 7); x.fill(); });
    x.strokeStyle = '#2b1c18'; x.lineWidth = 1; x.beginPath(); x.moveTo(ex[0] - R * .2, eyeY - R * .34); x.lineTo(ex[0] + R * .16, eyeY - R * .26); x.moveTo(ex[1] - R * .16, eyeY - R * .26); x.lineTo(ex[1] + R * .2, eyeY - R * .34); x.stroke();   /* brows */
    x.beginPath(); x.moveTo(R * .3 + fx, eyeY + R * .12); x.lineTo(R * .36 + fx, eyeY + R * .42); x.lineTo(R * .22 + fx, eyeY + R * .46); x.strokeStyle = mix(skin.base, .62); x.lineWidth = .7; x.stroke();    /* nose */
    if (face === 'lips') { x.fillStyle = css(pal.lip.base); x.beginPath(); x.ellipse(R * .3 + fx, R * .62, R * .22, R * .1, 0, 0, 7); x.fill(); }
    else { x.strokeStyle = '#5a2a22'; x.lineWidth = 1; x.beginPath(); x.arc(R * .28 + fx, R * .5, R * .22, .2, Math.PI - .2); x.stroke(); }
    if (face === 'stubble') { x.fillStyle = 'rgba(60,50,40,.42)'; x.beginPath(); x.ellipse(R * .1, R * .52, R * .62, R * .42, 0, 0, Math.PI); x.fill(); }
    if (face === 'jowls') { ball(x, -R * .42, R * .58, R * .36, R * .3, skin); ball(x, R * .62, R * .58, R * .36, R * .3, skin); }
    if (kit.id === 'heavy' || kit.id === 'bigtony') { x.strokeStyle = '#2b1c18'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(R * .02 + fx, R * .33); x.lineTo(R * .6 + fx, R * .33); x.stroke(); }
    /* hair / hats */
    const hairP = pal.hair;
    if (kit.hair === 'long') { ball(x, -R * .15, -R * .55, R * 1.1, R * .72, hairP); x.beginPath(); x.moveTo(-R * 1.0, -R * .1); x.quadraticCurveTo(-R * 1.5, R * 1.6, -R * .8, R * 2.0); x.lineTo(-R * .3, R * .6); x.closePath(); x.fillStyle = css(hairP.base); x.fill(); x.lineWidth = .9; x.strokeStyle = OUT; x.stroke(); }
    else if (kit.hair === 'slick' || kit.hair === 'flat' || kit.hair === 'short') { x.beginPath(); x.ellipse(-R * .05, -R * .62, R * 1.0, R * .52, 0, Math.PI, 0); x.closePath(); x.fillStyle = mix(hairP.base, 1); x.fill(); x.lineWidth = .9; x.strokeStyle = OUT; x.stroke(); }
    else if (kit.hair === 'beanie') { ball(x, -R * .05, -R * .55, R * 1.05, R * .66, pal.hat); x.fillStyle = css(pal.hat.sh); x.fillRect(-R * 1.0, -R * .12, R * 2.0, R * .26); x.strokeStyle = OUT; x.lineWidth = .7; x.strokeRect(-R * 1.0, -R * .12, R * 2.0, R * .26); }
    if (kit.id === 'turd') {   /* the poop hat: stacked swirl, glossy */
      const hp = { hi: Art.hex(0xb98a58), base: Art.hex(0x8a5428), sh: Art.hex(0x4e2c14) };
      ball(x, -R * .05, -R * .72, R * 1.0, R * .5, hp); ball(x, -R * .05, -R * 1.18, R * .78, R * .4, hp); ball(x, -R * .02, -R * 1.58, R * .5, R * .3, hp); x.beginPath(); x.moveTo(-R * .08, -R * 1.88); x.quadraticCurveTo(R * .3, -R * 2.05, R * .25, -R * 1.8); x.closePath(); x.fillStyle = css(hp.base); x.fill(); x.stroke();
      x.fillStyle = 'rgba(255,255,255,.4)'; x.beginPath(); x.ellipse(-R * .38, -R * 1.2, R * .14, R * .08, -.4, 0, 7); x.fill();
      x.fillStyle = css(pal.band.base); x.fillRect(-R * 1.0, -R * .25, R * 2.0, R * .22); x.strokeRect(-R * 1.0, -R * .25, R * 2.0, R * .22);
    }
  }
  x.restore();
  arm(J.armF, false);
  if (!wb) weaponDraw();
  /* knockdown rotation */
  let out = c;
  if (P.rot) { out = createCanvas(CW * K, CH * K); const o = out.getContext('2d'); const hx = AXn + (J.hip.x + SHX - AXn) * .86, hy = AYn + (J.hip.y + SHY - AYn) * .86; o.translate(hx * K, hy * K); o.rotate(P.rot * Math.PI / 180); o.translate(-hx * K, -hy * K); o.drawImage(c, 0, 0); }
  return out;
}

function trimCanvas(c) {
  const x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height).data; let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) for (let xx = 0; xx < c.width; xx++) if (d[(y * c.width + xx) * 4 + 3] > 6) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return { w: 1, h: 1, ox: 0, oy: 0, img: x.getImageData(0, 0, 1, 1) };
  x0 = Math.max(0, x0 - 1); y0 = Math.max(0, y0 - 1); x1 = Math.min(c.width - 1, x1 + 1); y1 = Math.min(c.height - 1, y1 + 1);
  return { w: x1 - x0 + 1, h: y1 - y0 + 1, ox: x0 - AXn * K, oy: y0 - AYn * K, img: x.getImageData(x0, y0, x1 - x0 + 1, y1 - y0 + 1) };
}
const ids = process.argv.slice(2).filter(a => !a.startsWith('--')); const kits = ids.length ? ids : Art.ENEMIES;
const items = [], meta = { version: 3, res: K, kits: {} };
kits.forEach(id => {
  const kit = T.KITS[id], entry = { id, name: kit.name, kind: 'enemy', res: K, smooth: true, anims: {} };
  Art.ANIMS.enemy.forEach(a => {
    const list = (kit._poses || (kit._poses = Art.posesFor(kit)))[a] || kit._poses.idle; entry.anims[a] = { timing: Art.TIMING[a].slice(0, list.length), frames: [] };
    for (let i = 0; i < list.length; i++) { const t = trimCanvas(drawKit(kit, a, i)); items.push({ key: id + ':' + a + ':' + i, t }); entry.anims[a].frames.push(id + ':' + a + ':' + i); }
  });
  const idle = drawKit(kit, 'idle', 0), pc = createCanvas(168, 168), pctx = pc.getContext('2d'); pctx.imageSmoothingQuality = 'high';
  const bx = (AXn - 38) * K, by = (AYn - 98) * K; pctx.drawImage(idle, bx, by, 76 * K, 76 * K, 0, 0, 168, 168);
  items.push({ key: id + ':portrait', t: { w: 168, h: 168, ox: 0, oy: 0, img: pctx.getImageData(0, 0, 168, 168) } }); entry.portrait = id + ':portrait'; meta.kits[id] = entry; console.log('drew', id);
});
let xx = 2, yy = 2, rowh = 0; const W = 2048; items.forEach(it => { if (xx + it.t.w + 2 > W) { xx = 2; yy += rowh + 2; rowh = 0; } it.x = xx; it.y = yy; xx += it.t.w + 2; rowh = Math.max(rowh, it.t.h); });
let H = 1; while (H < yy + rowh + 2) H *= 2;
const atlas = createCanvas(W, H), actx = atlas.getContext('2d'); items.forEach(it => actx.putImageData(it.t.img, it.x, it.y));
const by = {}; items.forEach(it => { by[it.key] = { x: it.x, y: it.y, w: it.t.w, h: it.t.h, ox: it.t.ox, oy: it.t.oy }; });
Object.values(meta.kits).forEach(k => { Object.values(k.anims).forEach(a => { a.frames = a.frames.map(key => by[key]); }); k.portrait = by[k.portrait]; });
fs.writeFileSync(path.join(__dirname, '..', 'assets', 'gg', 'enemies.png'), atlas.toBuffer('image/png'));
fs.writeFileSync(path.join(__dirname, '..', 'assets', 'gg', 'enemies.json'), JSON.stringify(meta));
console.log('enemies.png', W, 'x', H, items.length, 'frames');
