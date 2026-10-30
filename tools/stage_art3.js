/* Hi-res (3x) stage painter: soft-shaded, "toy render" look to match the hero art.
   node tools/stage_art3.js  ->  assets/gg/stage{0..3}_{far,mid,floor}.png (overwrites the old pixel layers) */
const fs = require('fs'), path = require('path');
const { createCanvas } = require('@napi-rs/canvas');
const K = 3, LW = 480, LH = 270, FT = 150;
const LEN = [1760, 1900, 1960, 2060];
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function mk(w, h) { const c = createCanvas(Math.round(w * K), Math.round(h * K)), x = c.getContext('2d'); x.scale(K, K); return { c, x, w, h }; }
function lin(x, x0, y0, x1, y1, stops) { const g = x.createLinearGradient(x0, y0, x1, y1); stops.forEach(([t, c]) => g.addColorStop(t, c)); return g; }
function rad(x, cx, cy, r0, r1, stops) { const g = x.createRadialGradient(cx, cy, r0, cx, cy, r1); stops.forEach(([t, c]) => g.addColorStop(t, c)); return g; }
function rgba(r, g, b, a) { return `rgba(${r | 0},${g | 0},${b | 0},${a})`; }
function speckle(x, x0, y0, w, h, n, R, cols, size) { for (let i = 0; i < n; i++) { x.fillStyle = cols[(R() * cols.length) | 0]; x.fillRect(x0 + R() * w, y0 + R() * h, size || .5, size || .5); } }
function cloud(x, cx, cy, s, a, R) { for (let i = 0; i < 9; i++) { const ox = (R() - .5) * 60 * s, oy = (R() - .5) * 12 * s, rx = (22 + R() * 26) * s, ry = (8 + R() * 8) * s; x.fillStyle = rad(x, cx + ox, cy + oy, 0, rx, [[0, rgba(255, 255, 255, a)], [1, rgba(255, 255, 255, 0)]]); x.beginPath(); x.ellipse(cx + ox, cy + oy, rx, ry, 0, 0, 7); x.fill(); } }
function crack(x, x0, y0, len, R, col, wd) { let px = x0, py = y0; x.strokeStyle = col; x.lineWidth = wd || .6; x.lineJoin = 'round'; x.beginPath(); x.moveTo(px, py);
  for (let i = 0; i < len; i++) { px += 3 + R() * 7; py += (R() - .45) * 6; x.lineTo(px, py); if (R() < .16) { const bx = px, by = py; x.moveTo(bx, by); x.lineTo(bx + 4 + R() * 6, by + (R() - .3) * 9); x.moveTo(px, py); } } x.stroke(); }
function box(x, bx, by, bw, bh, base, o) {   /* soft-shaded block: lit left face, shaded right edge, top highlight, contact shadow */
  o = o || {}; const [r, g, b] = base;
  x.fillStyle = lin(x, bx, by, bx + bw, by, [[0, rgba(r * 1.08, g * 1.08, b * 1.08, 1)], [.55, rgba(r, g, b, 1)], [1, rgba(r * .72, g * .72, b * .74, 1)]]); x.fillRect(bx, by, bw, bh);
  x.fillStyle = lin(x, bx, by, bx, by + bh, [[0, 'rgba(255,255,255,.16)'], [.25, 'rgba(255,255,255,0)'], [.8, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.22)']]); x.fillRect(bx, by, bw, bh);
  x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(bx, by, bw, .7); x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(bx + bw - .8, by, .8, bh);
}
function save(layer, name) { fs.writeFileSync(path.join(__dirname, '..', 'assets', 'gg', name + '.png'), layer.c.toBuffer('image/png')); }

/* ---------------- STAGE 0: Skyline Plaza (overcast concrete, wood cladding) ---------------- */
function stage0() {
  const L = LEN[0], R = rng(11);
  const wf = Math.ceil(LW + (L - LW) * .18), wm = Math.ceil(LW + (L - LW) * .48);
  const far = mk(wf, LH), fx = far.x;
  fx.fillStyle = lin(fx, 0, 0, 0, LH, [[0, '#9fb2c8'], [.5, '#cdd9e6'], [.78, '#e6ecf2'], [1, '#d9dfe6']]); fx.fillRect(0, 0, wf, LH);
  for (let i = 0; i < 14; i++) cloud(fx, R() * wf, 18 + R() * 70, .7 + R() * .9, .5, R);
  for (let i = 0, px = -20; px < wf + 40; i++) {   /* hazy distant towers */
    const w = 26 + R() * 40, h = 50 + R() * 70; fx.fillStyle = rgba(150 + R() * 20, 165 + R() * 20, 185 + R() * 15, .75); fx.fillRect(px, FT - h, w, h + 30);
    fx.fillStyle = 'rgba(255,255,255,.18)'; for (let wy = FT - h + 6; wy < FT - 4; wy += 7) fx.fillRect(px + 3, wy, w - 6, 1.2); px += w * .7;
  }
  fx.fillStyle = lin(fx, 0, FT - 30, 0, FT + 6, [[0, 'rgba(230,236,244,0)'], [1, 'rgba(230,236,244,.9)']]); fx.fillRect(0, FT - 30, wf, 40);
  fx.fillStyle = '#c9d0d8'; fx.fillRect(0, FT, wf, LH - FT);
  save(far, 'stage0_far');
  const mid = mk(wm, LH), mx = mid.x;
  for (let px = -10; px < wm + 20;) {
    const kind = (R() * 3) | 0, w = 90 + R() * 80, h = 95 + R() * 55, y = FT - h;
    if (kind === 0) {   /* poured-concrete slab with panel seams */
      box(mx, px, y, w, h + 2, [168, 170, 176]);
      mx.strokeStyle = 'rgba(70,74,84,.22)'; mx.lineWidth = .5; for (let sx = px + 14; sx < px + w; sx += 22) { mx.beginPath(); mx.moveTo(sx, y); mx.lineTo(sx, FT); mx.stroke(); }
      for (let sy = y + 18; sy < FT; sy += 26) { mx.beginPath(); mx.moveTo(px, sy); mx.lineTo(px + w, sy); mx.stroke(); }
      mx.fillStyle = 'rgba(40,46,60,.55)'; mx.fillRect(px + w * .12, y + 18, w * .76, 7);    /* ribbon window */
      mx.fillStyle = 'rgba(180,205,230,.4)'; mx.fillRect(px + w * .12, y + 18, w * .76, 2);
    } else if (kind === 1) {   /* timber-clad block (like the render) */
      box(mx, px, y + 10, w, h - 8, [150, 112, 82]);
      for (let sy = y + 12; sy < FT; sy += 4.2) { mx.fillStyle = (sy / 4.2 | 0) % 2 ? 'rgba(60,36,20,.28)' : 'rgba(255,220,170,.12)'; mx.fillRect(px, sy, w, 1.4); }
      box(mx, px - 3, y + 6, w + 6, 6, [182, 184, 190]);
    } else {   /* glass + steel */
      box(mx, px, y + 6, w, h - 4, [96, 112, 132]);
      for (let gx = px + 4; gx < px + w - 4; gx += 11) for (let gy = y + 14; gy < FT - 24; gy += 12) { mx.fillStyle = rgba(150 + R() * 40, 185 + R() * 30, 215, .55); mx.fillRect(gx, gy, 8.5, 9); mx.fillStyle = 'rgba(255,255,255,.35)'; mx.fillRect(gx, gy, 8.5, 1); }
      mx.fillStyle = 'rgba(40,44,54,.8)'; for (let gx = px + 2; gx < px + w; gx += 11) mx.fillRect(gx, y + 8, .8, h);
    }
    mx.fillStyle = lin(mx, 0, FT - 26, 0, FT, [[0, 'rgba(30,34,46,0)'], [1, 'rgba(30,34,46,.45)']]); mx.fillRect(px, FT - 26, w, 26);   /* ground occlusion */
    mx.fillStyle = 'rgba(30,34,44,.7)'; mx.fillRect(px + w * .4, FT - 22, w * .2, 22);   /* doorway */
    px += w + 4 + R() * 14;
  }
  const bd = 8; mx.fillStyle = lin(mx, 0, FT - bd, 0, FT, [[0, '#d6d8dd'], [1, '#aeb1b9']]); mx.fillRect(0, FT - bd, wm, bd);   /* plaza ledge */
  mx.fillStyle = 'rgba(255,255,255,.55)'; mx.fillRect(0, FT - bd, wm, 1); mx.fillStyle = 'rgba(0,0,0,.25)'; mx.fillRect(0, FT - 1, wm, 1);
  save(mid, 'stage0_mid');
  const fl = mk(L, LH), fc = fl.x;
  fc.fillStyle = lin(fc, 0, FT, 0, LH, [[0, '#a7a9b1'], [.45, '#92949d'], [1, '#7c7e88']]); fc.fillRect(0, FT, L, LH - FT);
  for (let i = 0; i < 40; i++) { fc.fillStyle = rgba(60, 64, 76, .05 + R() * .06); fc.beginPath(); fc.ellipse(R() * L, FT + 10 + R() * 100, 20 + R() * 60, 3 + R() * 9, 0, 0, 7); fc.fill(); }
  fc.strokeStyle = 'rgba(40,44,56,.30)'; fc.lineWidth = .6;
  for (let y = FT + 14, d = 14; y < LH; d *= 1.12, y += d) { fc.beginPath(); fc.moveTo(0, y); fc.lineTo(L, y); fc.stroke(); }
  for (let x2 = 0; x2 < L; x2 += 56) for (let y = FT; y < LH; y += 1) {}
  for (let x2 = 0; x2 < L; x2 += 56) { fc.beginPath(); fc.moveTo(x2 + 28, FT); fc.lineTo(x2 + (x2 + 28 - L / 2 > 0 ? 28 : 28) + (x2 - L / 2) * .0, LH); fc.stroke(); }
  speckle(fc, 0, FT, L, LH - FT, 26000, R, ['rgba(255,255,255,.10)', 'rgba(20,24,36,.10)', 'rgba(255,255,255,.06)'], .6);
  for (let i = 0; i < 46; i++) crack(fc, R() * L, FT + 12 + R() * 98, 6 + (R() * 12 | 0), R, 'rgba(30,32,44,.7)', .55 + R() * .5);
  fc.fillStyle = lin(fc, 0, FT, 0, FT + 14, [[0, 'rgba(40,44,60,.45)'], [1, 'rgba(40,44,60,0)']]); fc.fillRect(0, FT, L, 14);
  save(fl, 'stage0_floor');
}

/* ---------------- STAGE 1: Harbor Docks (sunset, wet asphalt, containers) ---------------- */
function stage1() {
  const L = LEN[1], R = rng(23);
  const wf = Math.ceil(LW + (L - LW) * .18), wm = Math.ceil(LW + (L - LW) * .48);
  const far = mk(wf, LH), fx = far.x;
  fx.fillStyle = lin(fx, 0, 0, 0, FT, [[0, '#5a4f8a'], [.35, '#d9728a'], [.7, '#f6a566'], [1, '#fbd596']]); fx.fillRect(0, 0, wf, LH);
  fx.fillStyle = rad(fx, wf * .55, FT - 18, 2, 90, [[0, 'rgba(255,244,210,1)'], [.2, 'rgba(255,214,150,.7)'], [1, 'rgba(255,170,110,0)']]); fx.fillRect(0, 0, wf, FT + 10);
  for (let i = 0; i < 9; i++) cloud(fx, R() * wf, 20 + R() * 60, .8 + R(), .35, R);
  fx.fillStyle = lin(fx, 0, FT - 22, 0, LH, [[0, '#f2b783'], [.3, '#6f6b9a'], [1, '#2f3558']]); fx.fillRect(0, FT - 22, wf, LH - FT + 22);   /* sea */
  for (let i = 0; i < 700; i++) { fx.fillStyle = rgba(255, 220, 170, .08 + R() * .2); fx.fillRect(wf * .5 + (R() - .5) * 150 * (.2 + (R())), FT - 18 + R() * 40, 2 + R() * 7, .6); }
  for (let px = 20; px < wf; px += 120 + R() * 140) {   /* gantry cranes */
    const h = 62 + R() * 26; fx.fillStyle = 'rgba(52,44,84,.88)'; fx.fillRect(px, FT - 24 - h, 3, h + 6); fx.fillRect(px + 38, FT - 24 - h, 3, h + 6); fx.fillRect(px - 8, FT - 24 - h, 66, 3.5); fx.fillRect(px - 20, FT - 24 - h + 8, 40, 2);
    fx.strokeStyle = 'rgba(52,44,84,.7)'; fx.lineWidth = .7; fx.beginPath(); fx.moveTo(px + 2, FT - 24 - h); fx.lineTo(px + 40, FT - 24); fx.moveTo(px + 40, FT - 24 - h); fx.lineTo(px + 2, FT - 24); fx.stroke(); }
  fx.fillStyle = '#2d3455'; fx.fillRect(0, FT, wf, LH - FT);
  save(far, 'stage1_far');
  const mid = mk(wm, LH), mx = mid.x; const cols = [[196, 62, 56], [58, 108, 168], [226, 170, 56], [64, 140, 112], [150, 82, 150], [220, 120, 60]];
  for (let px = -10; px < wm + 20;) {
    const stack = 1 + ((R() * 3) | 0), cw = 58, ch = 22; const baseCol = cols[(R() * cols.length) | 0]; const sw = 1 + ((R() * 2) | 0);
    for (let sx = 0; sx < sw; sx++) for (let sy = 0; sy < stack; sy++) {
      const c = R() < .35 ? cols[(R() * cols.length) | 0] : baseCol, x0 = px + sx * (cw + 1), y0 = FT - (sy + 1) * ch; box(mx, x0, y0, cw, ch, c);
      mx.strokeStyle = 'rgba(0,0,0,.22)'; mx.lineWidth = .5; for (let rx = x0 + 4; rx < x0 + cw - 2; rx += 4.2) { mx.beginPath(); mx.moveTo(rx, y0 + 2); mx.lineTo(rx, y0 + ch - 2); mx.stroke(); }
      mx.fillStyle = 'rgba(255,255,255,.2)'; mx.fillRect(x0, y0 + ch - 2, cw, 1);
    }
    mx.fillStyle = lin(mx, 0, FT - 18, 0, FT, [[0, 'rgba(20,20,40,0)'], [1, 'rgba(20,20,40,.5)']]); mx.fillRect(px, FT - 18, sw * (cw + 1), 18);
    px += sw * (cw + 1) + 22 + R() * 70;
    if (R() < .5) { mx.fillStyle = '#2a2e44'; mx.fillRect(px, FT - 70, 2.2, 70); mx.fillStyle = 'rgba(255,230,160,.95)'; mx.beginPath(); mx.arc(px + 1, FT - 72, 2.6, 0, 7); mx.fill();
      mx.fillStyle = rad(mx, px + 1, FT - 72, 0, 18, [[0, 'rgba(255,220,150,.5)'], [1, 'rgba(255,220,150,0)']]); mx.fillRect(px - 18, FT - 92, 40, 40); px += 40; }
  }
  mx.fillStyle = lin(mx, 0, FT - 7, 0, FT, [[0, '#6c5a4a'], [1, '#463a32']]); mx.fillRect(0, FT - 7, wm, 7); mx.fillStyle = 'rgba(255,220,170,.4)'; mx.fillRect(0, FT - 7, wm, .8);
  save(mid, 'stage1_mid');
  const fl = mk(L, LH), fc = fl.x;
  fc.fillStyle = lin(fc, 0, FT, 0, LH, [[0, '#4a4658'], [.4, '#383a4a'], [1, '#2a2c3a']]); fc.fillRect(0, FT, L, LH - FT);
  for (let i = 0; i < 30; i++) { const px = R() * L, py = FT + 16 + R() * 90, rx = 30 + R() * 70, ry = 4 + R() * 9; fc.fillStyle = rad(fc, px, py, 0, rx, [[0, 'rgba(255,190,130,.38)'], [.6, 'rgba(180,120,140,.2)'], [1, 'rgba(60,60,90,0)']]); fc.beginPath(); fc.ellipse(px, py, rx, ry, 0, 0, 7); fc.fill(); }
  speckle(fc, 0, FT, L, LH - FT, 24000, R, ['rgba(255,255,255,.07)', 'rgba(0,0,0,.14)'], .6);
  fc.fillStyle = 'rgba(244,196,64,.9)'; fc.fillRect(0, FT + 8, L, 2); fc.fillStyle = 'rgba(244,196,64,.7)'; for (let x2 = 0; x2 < L; x2 += 36) fc.fillRect(x2, LH - 10, 18, 2.4);
  for (let i = 0; i < 30; i++) crack(fc, R() * L, FT + 14 + R() * 96, 5 + (R() * 9 | 0), R, 'rgba(14,14,26,.65)', .55);
  fc.fillStyle = lin(fc, 0, FT, 0, FT + 12, [[0, 'rgba(20,20,40,.5)'], [1, 'rgba(20,20,40,0)']]); fc.fillRect(0, FT, L, 12);
  save(fl, 'stage1_floor');
}

/* ---------------- STAGE 2: Ashfall Pass (canyon, dust) ---------------- */
function stage2() {
  const L = LEN[2], R = rng(37);
  const wf = Math.ceil(LW + (L - LW) * .18), wm = Math.ceil(LW + (L - LW) * .48);
  const far = mk(wf, LH), fx = far.x;
  fx.fillStyle = lin(fx, 0, 0, 0, FT, [[0, '#d98f6e'], [.4, '#f0b98a'], [.8, '#f8dcae'], [1, '#f4e6c8']]); fx.fillRect(0, 0, wf, LH);
  fx.fillStyle = rad(fx, wf * .3, 50, 2, 70, [[0, 'rgba(255,250,225,1)'], [.3, 'rgba(255,236,190,.55)'], [1, 'rgba(255,220,170,0)']]); fx.fillRect(0, 0, wf, FT);
  for (let i = 0; i < 6; i++) cloud(fx, R() * wf, 25 + R() * 50, 1.1 + R(), .3, R);
  [[.0, 78, '#b9806f'], [.5, 60, '#a5706a'], [1, 40, '#8f6068']].forEach(([t, hh, c], li) => { fx.fillStyle = c; fx.beginPath(); fx.moveTo(0, FT); for (let x2 = 0; x2 <= wf; x2 += 6) fx.lineTo(x2, FT - hh * (.45 + .55 * Math.abs(Math.sin(x2 * (.011 + li * .007) + li * 2.1 + R() * .15)))); fx.lineTo(wf, FT); fx.closePath(); fx.fill(); });
  fx.fillStyle = '#d9b98d'; fx.fillRect(0, FT, wf, LH - FT);
  save(far, 'stage2_far');
  const mid = mk(wm, LH), mx = mid.x;
  for (let px = -20; px < wm + 30;) {
    const w = 80 + R() * 110, h = 70 + R() * 70, y = FT - h; mx.fillStyle = lin(mx, px, 0, px + w, 0, [[0, '#d27a4e'], [.6, '#b85f3c'], [1, '#8a4430']]);
    mx.beginPath(); mx.moveTo(px, FT); mx.lineTo(px + 6, y + 20); mx.lineTo(px + w * .25, y); mx.lineTo(px + w * .7, y + 8); mx.lineTo(px + w, y + 30); mx.lineTo(px + w + 6, FT); mx.closePath(); mx.fill();
    for (let sy = y + 18; sy < FT - 4; sy += 7 + R() * 6) { mx.fillStyle = R() < .5 ? 'rgba(255,214,170,.20)' : 'rgba(80,30,20,.22)'; mx.fillRect(px + 3, sy, w - 6, 1.4 + R() * 1.4); }
    mx.fillStyle = lin(mx, 0, FT - 30, 0, FT, [[0, 'rgba(60,24,20,0)'], [1, 'rgba(60,24,20,.45)']]); mx.fillRect(px, FT - 30, w + 6, 30);
    if (R() < .6) { const cx = px + w * (.2 + R() * .6); mx.fillStyle = '#4f7a4a'; mx.fillRect(cx, FT - 26, 3.2, 26); mx.fillRect(cx - 5, FT - 17, 2.6, 8); mx.fillRect(cx - 5, FT - 17, 7, 2.2); mx.fillRect(cx + 5, FT - 21, 2.6, 8); mx.fillStyle = 'rgba(255,255,255,.25)'; mx.fillRect(cx, FT - 26, 1, 26); }
    px += w * .75 + R() * 24;
  }
  mx.fillStyle = lin(mx, 0, FT - 8, 0, FT, [[0, 'rgba(214,170,120,0)'], [1, 'rgba(214,170,120,.9)']]); mx.fillRect(0, FT - 8, wm, 8);
  save(mid, 'stage2_mid');
  const fl = mk(L, LH), fc = fl.x;
  fc.fillStyle = lin(fc, 0, FT, 0, LH, [[0, '#cfae83'], [.5, '#b99568'], [1, '#9c7a56']]); fc.fillRect(0, FT, L, LH - FT);
  for (let i = 0; i < 34; i++) { fc.fillStyle = rgba(120, 84, 56, .06 + R() * .06); fc.beginPath(); fc.ellipse(R() * L, FT + 8 + R() * 100, 30 + R() * 80, 3 + R() * 8, 0, 0, 7); fc.fill(); }
  speckle(fc, 0, FT, L, LH - FT, 30000, R, ['rgba(255,235,200,.14)', 'rgba(90,60,40,.18)', 'rgba(255,255,255,.07)'], .6);
  for (const ty of [FT + 40, FT + 52, FT + 78, FT + 90]) { fc.strokeStyle = 'rgba(96,66,44,.22)'; fc.lineWidth = 1.6; fc.beginPath(); fc.moveTo(0, ty); for (let x2 = 0; x2 <= L; x2 += 30) fc.lineTo(x2, ty + Math.sin(x2 * .03 + ty) * 1.4); fc.stroke(); }
  for (let i = 0; i < 70; i++) { const px = R() * L, py = FT + 6 + R() * 104; fc.fillStyle = rgba(120, 96, 76, .5 + R() * .4); fc.beginPath(); fc.ellipse(px, py, 1 + R() * 2.4, .8 + R() * 1.3, 0, 0, 7); fc.fill(); }
  for (let i = 0; i < 28; i++) crack(fc, R() * L, FT + 12 + R() * 96, 5 + (R() * 10 | 0), R, 'rgba(70,44,30,.65)', .55);
  fc.fillStyle = lin(fc, 0, FT, 0, FT + 12, [[0, 'rgba(110,70,50,.45)'], [1, 'rgba(110,70,50,0)']]); fc.fillRect(0, FT, L, 12);
  save(fl, 'stage2_floor');
}

/* ---------------- STAGE 3: Gold Tower (night, glass + gold, polished marble) ---------------- */
function stage3() {
  const L = LEN[3], R = rng(53);
  const wf = Math.ceil(LW + (L - LW) * .18), wm = Math.ceil(LW + (L - LW) * .48);
  const far = mk(wf, LH), fx = far.x;
  fx.fillStyle = lin(fx, 0, 0, 0, FT, [[0, '#120d2b'], [.5, '#3a1e58'], [.85, '#8a3a74'], [1, '#d9689a']]); fx.fillRect(0, 0, wf, LH);
  for (let i = 0; i < 90; i++) { fx.fillStyle = rgba(255, 245, 220, .25 + R() * .6); fx.fillRect(R() * wf, R() * 70, .6 + R() * .9, .6 + R() * .9); }
  for (let px = -10; px < wf + 20;) { const w = 18 + R() * 34, h = 40 + R() * 90; fx.fillStyle = lin(fx, 0, FT - h, 0, FT, [[0, 'rgba(40,20,70,.95)'], [1, 'rgba(70,30,90,.95)']]); fx.fillRect(px, FT - h, w, h + 4);
    for (let wy = FT - h + 4; wy < FT - 4; wy += 5) for (let wx = px + 3; wx < px + w - 3; wx += 5) if (R() < .5) { fx.fillStyle = R() < .6 ? 'rgba(255,206,110,.85)' : 'rgba(150,210,255,.8)'; fx.fillRect(wx, wy, 2.2, 2.6); } px += w * .8; }
  for (let i = 0; i < 40; i++) { const bx = R() * wf, by = FT - 6 - R() * 60, r = 3 + R() * 7; fx.fillStyle = rad(fx, bx, by, 0, r, [[0, rgba(255, 190, 120, .25)], [1, rgba(255, 190, 120, 0)]]); fx.fillRect(bx - r, by - r, r * 2, r * 2); }
  fx.fillStyle = '#2a1a44'; fx.fillRect(0, FT, wf, LH - FT);
  save(far, 'stage3_far');
  const mid = mk(wm, LH), mx = mid.x;
  mx.fillStyle = lin(mx, 0, 0, 0, FT, [[0, 'rgba(14,12,32,.0)'], [1, 'rgba(14,12,32,0)']]);
  for (let px = -10; px < wm + 40;) {   /* gold-trimmed glass bays between fluted columns */
    const bay = 110 + R() * 30, top = 16 + R() * 14; box(mx, px, top, bay, FT - top, [24, 26, 52]);
    mx.fillStyle = lin(mx, px, top, px + bay, FT, [[0, 'rgba(120,150,230,.35)'], [.5, 'rgba(60,70,130,.15)'], [1, 'rgba(240,160,200,.28)']]); mx.fillRect(px + 3, top + 3, bay - 6, FT - top - 6);
    mx.strokeStyle = 'rgba(232,184,70,.9)'; mx.lineWidth = .9; for (let gx = px + 3; gx <= px + bay - 3; gx += (bay - 6) / 4) { mx.beginPath(); mx.moveTo(gx, top + 3); mx.lineTo(gx, FT); mx.stroke(); } for (let gy = top + 28; gy < FT; gy += 34) { mx.beginPath(); mx.moveTo(px + 3, gy); mx.lineTo(px + bay - 3, gy); mx.stroke(); }
    mx.fillStyle = 'rgba(255,255,255,.18)'; mx.beginPath(); mx.moveTo(px + 10, top + 4); mx.lineTo(px + 34, top + 4); mx.lineTo(px + 8, FT - 10); mx.lineTo(px - 4, FT - 10); mx.fill();
    box(mx, px + bay, 0, 14, FT + 2, [230, 190, 96]);   /* gold column */
    for (let fy = 0; fy < FT; fy += 1) {} mx.fillStyle = 'rgba(120,80,10,.28)'; for (let cx = px + bay + 2.4; cx < px + bay + 13; cx += 3.2) mx.fillRect(cx, 0, .8, FT);
    px += bay + 14;
  }
  mx.fillStyle = lin(mx, 0, FT - 30, 0, FT, [[0, 'rgba(255,170,90,0)'], [1, 'rgba(255,170,90,.28)']]); mx.fillRect(0, FT - 30, wm, 30);
  mx.fillStyle = lin(mx, 0, FT - 6, 0, FT, [[0, '#e8c668'], [1, '#a37a28']]); mx.fillRect(0, FT - 6, wm, 6); mx.fillStyle = 'rgba(255,255,255,.55)'; mx.fillRect(0, FT - 6, wm, .8);
  save(mid, 'stage3_mid');
  const fl = mk(L, LH), fc = fl.x;
  fc.fillStyle = lin(fc, 0, FT, 0, LH, [[0, '#2a2338'], [.5, '#1d1829'], [1, '#14101e']]); fc.fillRect(0, FT, L, LH - FT);
  for (let i = 0; i < 90; i++) { const px = R() * L; fc.fillStyle = lin(fc, px, FT, px + 6, LH, [[0, 'rgba(255,200,120,.10)'], [1, 'rgba(255,200,120,0)']]); fc.fillRect(px, FT, 6 + R() * 20, LH - FT); }
  fc.strokeStyle = 'rgba(232,184,70,.75)'; fc.lineWidth = .9; for (let y = FT + 16, d = 14; y < LH; d *= 1.15, y += d) { fc.beginPath(); fc.moveTo(0, y); fc.lineTo(L, y); fc.stroke(); }
  for (let x2 = 0; x2 < L; x2 += 80) { fc.beginPath(); fc.moveTo(x2, FT); fc.lineTo(x2, LH); fc.stroke(); }
  fc.fillStyle = 'rgba(232,184,70,.35)'; for (let x2 = 40; x2 < L; x2 += 160) { fc.beginPath(); fc.moveTo(x2, FT + 58); fc.lineTo(x2 + 26, FT + 84); fc.lineTo(x2, FT + 110); fc.lineTo(x2 - 26, FT + 84); fc.closePath(); fc.fill(); }
  speckle(fc, 0, FT, L, LH - FT, 22000, R, ['rgba(255,255,255,.07)', 'rgba(150,120,200,.10)'], .6);
  fc.fillStyle = lin(fc, 0, FT, 0, FT + 20, [[0, 'rgba(255,170,90,.32)'], [1, 'rgba(255,170,90,0)']]); fc.fillRect(0, FT, L, 20);
  save(fl, 'stage3_floor');
}
[stage0, stage1, stage2, stage3].forEach((f, i) => { f(); console.log('stage', i, 'done'); });
