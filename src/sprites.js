/* Grease & Gold: World Tour - procedural 16-bit sprite engine.
   Every character is rendered from one shared skeleton into FIXED 112x112 frames.
   Feet anchor = (56,100) in every frame. Legs use 2-bone IK so planted feet really sit on y=0. */
(function (G) {
'use strict';
const HS = 1.22; /* head scale: big readable heads */
const CELL = 112, AX = 56, AY = 100, COLS = 8;
const hex = (h) => { const n = parseInt(h.slice(1), 16); return ((255 << 24) | ((n & 255) << 16) | (((n >> 8) & 255) << 8) | ((n >> 16) & 255)) >>> 0; };
const OUT = hex('#1b1226');
const shade = (c, f) => { const r = (c & 255) * f, g = ((c >> 8) & 255) * f, b = ((c >> 16) & 255) * f; return ((255 << 24) | (Math.min(255, b) << 16) | (Math.min(255, g) << 8) | Math.min(255, r)) >>> 0; };
const rad = (d) => d * Math.PI / 180;

class Buf {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint32Array(w * h); }
  set(x, y, c) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c; }
  get(x, y) { return (x >= 0 && y >= 0 && x < this.w && y < this.h) ? this.d[y * this.w + x] : 0; }
  disk(cx, cy, r, c) { for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) { const dx = x + .5 - cx, dy = y + .5 - cy; if (dx * dx + dy * dy <= r * r) this.set(x, y, c); } }
  ell(cx, cy, rx, ry, c) { for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) { const dx = (x + .5 - cx) / rx, dy = (y + .5 - cy) / ry; if (dx * dx + dy * dy <= 1) this.set(x, y, c); } }
  line(a, b, r, c) { const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2)); for (let i = 0; i <= n; i++) { const t = i / n; this.disk(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, r, c); } }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(Math.round(x) + i, Math.round(y) + j, c); }
  poly(p, c) { let y0 = 1e9, y1 = -1e9; p.forEach(q => { y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }); for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) { const yc = y + .5, xs = []; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); } xs.sort((u, v) => u - v); for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.set(x, y, c); } }
  outline(c) { const o = []; for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (!this.d[y * this.w + x]) { if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) o.push(y * this.w + x); } o.forEach(i => this.d[i] = c); }
  toCanvas(mk) { const cv = mk(this.w, this.h), ctx = cv.getContext('2d'), id = ctx.createImageData(this.w, this.h); new Uint32Array(id.data.buffer).set(this.d); ctx.putImageData(id, 0, 0); return cv; }
  bbox() { let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.d[y * this.w + x]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return { x0, y0, x1, y1 }; }
}

/* ---------- 2-bone IK ---------- */
function ik(ax, ay, tx, ty, l1, l2, bend) {
  let dx = tx - ax, dy = ty - ay; const d0 = Math.hypot(dx, dy) || 1e-6;
  const dd = Math.min(l1 + l2 - 0.02, Math.max(Math.abs(l1 - l2) + 0.02, d0));
  const nx = dx / d0, ny = dy / d0; tx = ax + nx * dd; ty = ay + ny * dd;
  const a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const mx = ax + nx * a, my = ay + ny * a;
  const c1 = (-ny * h) * bend[0] + (nx * h) * bend[1];
  const knee = c1 >= 0 ? [mx - ny * h, my + nx * h] : [mx + ny * h, my - nx * h];
  return { mid: knee, end: [tx, ty], reach: d0 - dd };
}

/* ---------- kits (palette + build) ---------- */
const K = {};
const kit = (id, o) => { K[id] = Object.assign({ id, weapon: null, family: 'fist', scale: 1 }, o); };
kit('vv', { name: 'V.V.', scale: .96, style: 'crop', family: 'mic', weapon: 'mic', build: { torso: 4.0, leg: 2.9, arm: 2.1, head: 6 },
  face: { r: 6, hair: 'long', hairC: '#6b4730', hair2: '#d3a468', shades: '#1f2430', skin: '#f0b995' },
  pal: { skin: '#f0b995', sleeve: '#f0b995', cuff: '#f0b995', pants: '#1a1a22', shoe: '#15151a', sole: '#eeeeee', top: '#7c808a', topD: '#5d616b', chain: '#f0c43c', belt: '#2a2a33' } });
kit('ricky', { name: 'Ricky B', scale: 1.0, style: 'coat', family: 'flag', weapon: 'flag', build: { torso: 5.0, leg: 3.1, arm: 2.6, head: 6.4 },
  face: { r: 6.4, hair: 'slick', hairC: '#17171d', shades: '#d98a2b', moustache: true, skin: '#e0ac86' },
  pal: { skin: '#d9a07a', sleeve: '#c9a275', cuff: '#f1e4c8', pants: '#232a4c', shoe: '#6b3f22', coat: '#c9a275', coatD: '#a58058', collar: '#f1e4c8', shirt: '#17171d', chain: '#f0c43c' } });
kit('johnny', { name: 'Johnny $', scale: 1.02, style: 'jacket', family: 'salami', weapon: 'salami', build: { torso: 5.4, leg: 3.2, arm: 2.7, head: 6.4 },
  face: { r: 6.4, hair: 'curly', hairC: '#17120f', shades: '#14151a', beard: '#1c1512', skin: '#9c6b4a' },
  pal: { skin: '#9c6b4a', sleeve: '#5f90c6', cuff: '#7aa6d6', pants: '#8db2d4', shoe: '#f2f2f2', sole: '#b9bec8', jacket: '#5f90c6', jacketD: '#3f6fa6', shirt: '#f4f4f4', chain: '#d9dee8' } });
kit('guard', { name: 'Corporate Guard', scale: 1.0, style: 'suit', build: { torso: 5.0, leg: 3.0, arm: 2.5, head: 6.2 }, weapon: 'baton',
  face: { r: 6.2, hair: 'cap', hairC: '#1c2a5a', skin: '#e2ad88' },
  pal: { skin: '#e2ad88', sleeve: '#26407a', cuff: '#26407a', pants: '#1c2a5a', shoe: '#101014', jacket: '#26407a', jacketD: '#1c2d5a', shirt: '#9fb4d8', tie: '#d4a31c' } });
kit('exec', { name: 'Executive', scale: 1.0, style: 'suit', build: { torso: 4.8, leg: 2.9, arm: 2.4, head: 6.2 },
  face: { r: 6.2, hair: 'comb', hairC: '#2c2118', skin: '#e5b08a' },
  pal: { skin: '#e5b08a', sleeve: '#4a4f5c', cuff: '#4a4f5c', pants: '#363a46', shoe: '#101014', jacket: '#4a4f5c', jacketD: '#343845', shirt: '#f2f2f2', tie: '#c0392b' } });
kit('heavy', { name: 'Corporate Heavy', scale: 1.08, style: 'fat', build: { torso: 8.6, leg: 4.2, arm: 3.5, head: 7.2 },
  face: { r: 7.2, hair: 'bald', hairC: '#2a1c14', stubble: '#8a5f4a', skin: '#d99a78' },
  pal: { skin: '#d99a78', sleeve: '#2c2c38', cuff: '#2c2c38', pants: '#24242e', shoe: '#101014', jacket: '#2c2c38', jacketD: '#1d1d26', shirt: '#eeeeee', tie: '#d4a31c' } });
kit('brawler', { name: 'Street Scrapper', scale: .98, style: 'tank', build: { torso: 4.6, leg: 3.0, arm: 2.6, head: 6.2 },
  face: { r: 6.2, hair: 'beanie', hairC: '#7a2c2c', stubble: '#7b5a47', skin: '#d6a07c' },
  pal: { skin: '#d6a07c', sleeve: '#d6a07c', cuff: '#d6a07c', pants: '#4a5238', shoe: '#3a2a1a', tank: '#a7a79b', tankD: '#85857b' } });
kit('raider', { name: 'Ashfall Raider', scale: 1.0, style: 'military', build: { torso: 5.0, leg: 3.1, arm: 2.6, head: 6.2 }, weapon: 'baton', throws: true,
  face: { r: 6.2, hair: 'cap', hairC: '#3a4228', goggles: '#3aa07a', skin: '#c8946a' },
  pal: { skin: '#c8946a', sleeve: '#5b6b3a', cuff: '#3f4a28', pants: '#4a4a38', shoe: '#2b2118', jacket: '#5b6b3a', jacketD: '#424f2a', vest: '#3a3f2a', scarf: '#b04a2a' } });
kit('ledger', { name: 'The Ledger', scale: 1.14, style: 'suit', build: { torso: 5.4, leg: 3.3, arm: 2.8, head: 6.6 }, weapon: 'case',
  face: { r: 6.6, hair: 'comb', hairC: '#d9d9e2', visor: '#48d17a', skin: '#e0b090' },
  pal: { skin: '#e0b090', sleeve: '#16301f', cuff: '#16301f', pants: '#16301f', shoe: '#101014', jacket: '#16301f', jacketD: '#0f2216', shirt: '#f0f0f0', tie: '#48d17a' } });
kit('bigtony', { name: 'Big Tony', scale: 1.26, style: 'fat', build: { torso: 9.2, leg: 4.5, arm: 3.8, head: 7.6 },
  face: { r: 7.6, hair: 'bald', hairC: '#2a1a14', beard: '#2a1a14', skin: '#c88a68' },
  pal: { skin: '#c88a68', sleeve: '#7a1f2b', cuff: '#7a1f2b', pants: '#2a2a2a', shoe: '#101014', jacket: '#7a1f2b', jacketD: '#5a1520', shirt: '#eadfc0', tie: '#f0c43c', chain: '#f0c43c' } });
kit('mara', { name: 'Dusty Mara', scale: 1.04, style: 'military', build: { torso: 4.4, leg: 3.0, arm: 2.4, head: 6.2 }, weapon: 'baton', throws: true,
  face: { r: 6.2, hair: 'long', hairC: '#241a16', hair2: '#4a3128', goggles: '#d0402f', skin: '#c08a62' },
  pal: { skin: '#c08a62', sleeve: '#7a2e2e', cuff: '#d4a31c', pants: '#3a3430', shoe: '#241a14', jacket: '#7a2e2e', jacketD: '#5a2020', vest: '#d4a31c', scarf: '#d4a31c' } });
kit('auditor', { name: 'The Auditor', scale: 1.12, style: 'suit', build: { torso: 4.6, leg: 3.0, arm: 2.5, head: 6.4 }, weapon: 'cane',
  face: { r: 6.4, hair: 'slick', hairC: '#101018', shades: '#d4a31c', skin: '#cfa080' },
  pal: { skin: '#cfa080', sleeve: '#101018', cuff: '#d4a31c', pants: '#101018', shoe: '#101014', jacket: '#101018', jacketD: '#06060a', shirt: '#e8d8a0', tie: '#d4a31c' } });
Object.values(K).forEach(k => { const walk = (o) => { for (const key in o) { if (typeof o[key] === 'string' && o[key][0] === '#') o[key] = hex(o[key]); } }; walk(k.pal); walk(k.face); });
const hexOf = (s) => hex(s);

/* ---------- poses ---------- */
const BASE = { hip: [0, 25], lean: 4, head: 0, fF: [9, 0], fB: [-9, 0], hF: [12, 37], hB: [6, 35], wang: 60, ext: 0, legBend: [1, 0.1] };
const P = (o) => Object.assign({}, BASE, o);
const LEG = { fF: [16, 0], fB: [-11, 0] };

function walkFrames(n, stride, lift, lean, hipDrop, hipY, armSw) {
  const out = [];
  const foot = (q) => { q = ((q % 1) + 1) % 1; if (q < .5) return [stride - 2 * stride * (q / .5), 0]; const t = (q - .5) / .5; return [-stride + 2 * stride * t, lift * Math.sin(Math.PI * t)]; };
  for (let i = 0; i < n; i++) {
    const p = i / n, c = Math.cos(2 * Math.PI * p), sn = Math.sin(2 * Math.PI * p);
    out.push(P({ hip: [0, hipY - hipDrop * c * c], lean, fF: foot(p), fB: foot(p + .5), hF: [11 + armSw * sn * .6, 36 + armSw * .3 * c], hB: [5 - armSw * sn, 34], head: 0 }));
  }
  return out;
}
const spinFrames = (n, f) => { const o = []; for (let i = 0; i < n; i++) o.push(f(i, i * 360 / n)); return o; };

const COMMON = {
  idle: (w) => [P({ wang: w }), P({ wang: w, hF: [12, 38], hB: [6, 36] }), P({ wang: w, hF: [12, 38], hB: [6, 36], lean: 5 }), P({ wang: w, lean: 5 })],
  walk: (w) => walkFrames(8, 10, 6, 6, 1.5, 25, 5).map(p => (p.wang = w, p)),
  run: (w) => walkFrames(6, 14, 10, 18, 2, 24, 8).map(p => (p.wang = w, p.hF = [10 + (p.hF[0] - 11) * 1.2, 34], p)),
  jump: () => [P({ hip: [0, 22], lean: 6, fF: [11, 11], fB: [-6, 7], hF: [14, 44], hB: [4, 47] }), P({ hip: [0, 22], lean: 4, fF: [9, 9], fB: [-8, 11], hF: [13, 40], hB: [2, 44] }), P({ hip: [0, 24], lean: 2, fF: [7, 1], fB: [-7, 0], hF: [12, 42], hB: [2, 40] })],
  land: () => [P({ hip: [0, 19], lean: 18, fF: [12, 0], fB: [-10, 0], hF: [14, 27], hB: [6, 25] })],
  hit: () => [P({ hip: [-3, 24], lean: -12, head: -12, fF: [8, 0], fB: [-12, 0], hF: [8, 40], hB: [-8, 36] }), P({ hip: [-2, 24], lean: -7, head: -6, fF: [9, 0], fB: [-11, 0], hF: [9, 31], hB: [-5, 30] })],
  knock: () => [P({ hip: [-6, 30], lean: -50, head: -40, fF: [14, 20], fB: [8, 24], hF: [-30, 44], hB: [-26, 36], wang: 170, legBend: [.3, -1] }), P({ hip: [-3, 15], lean: -78, head: -70, fF: [18, 13], fB: [12, 17], hF: [-27, 24], hB: [-22, 20], wang: 175, legBend: [.2, -1] })],
  down: () => [P({ hip: [-5, 9], lean: -86, head: -90, fF: [16, 14], fB: [11, 9], hF: [-30, 7], hB: [-14, 3], wang: 175, legBend: [.2, -1] }), P({ hip: [-5, 6], lean: -88, head: -90, fF: [22, 3], fB: [20, 1], hF: [-31, 4], hB: [-14, 2], wang: 178, legBend: [.2, -1] })],
  getup: () => [P({ hip: [-4, 13], lean: 20, head: 8, fF: [10, 0], fB: [-12, 0], hF: [14, 5], hB: [8, 4], wang: 20 }), P({ hip: [0, 17], lean: 36, head: 18, fF: [12, 0], fB: [-8, 0], hF: [14, 16], hB: [6, 14], wang: 20 }), P({ hip: [0, 22], lean: 12, fF: [10, 0], fB: [-8, 0], hF: [12, 32], hB: [6, 30] })],
  dead: () => [P({ hip: [-5, 6], lean: -88, head: -90, fF: [22, 3], fB: [20, 1], hF: [-31, 4], hB: [-14, 2], wang: 178, legBend: [.2, -1] }), P({ hip: [-5, 6], lean: -88, head: -90, fF: [23, 2], fB: [18, 1], hF: [-28, 8], hB: [-10, 6], wang: 178, legBend: [.2, -1] })],
  grab: () => [P({ hip: [0, 24], lean: 8, fF: [10, 0], fB: [-9, 0], hF: [17, 35], hB: [15, 31], wang: 40 }), P({ hip: [0, 24], lean: 10, fF: [10, 0], fB: [-9, 0], hF: [17, 36], hB: [15, 32], wang: 40 })],
  held: () => [P({ hip: [0, 22], lean: 26, head: 22, fF: [8, 0], fB: [-8, 0], hF: [8, 24], hB: [4, 22], wang: 100 })],
  gstrike: () => [P({ hip: [-1, 24], lean: -2, fF: [10, 0], fB: [-9, 0], hF: [10, 38], hB: [6, 36], wang: 100 }), P({ hip: [1, 24], lean: 8, fF: [10, 0], fB: [-9, 0], fF: [16, 21], hF: [18, 36], hB: [12, 34], wang: 30 }), P({ hip: [0, 24], lean: 5, fF: [10, 0], fB: [-9, 0], hF: [14, 34], hB: [8, 32], wang: 50 })],
  throw: () => [P({ hip: [-2, 24], lean: -12, fF: [10, 0], fB: [-11, 0], hF: [-4, 46], hB: [-6, 44], wang: 120 }), P({ hip: [3, 23], lean: 28, fF: [15, 0], fB: [-10, 0], hF: [22, 40], hB: [20, 38], wang: 20 }), P({ hip: [2, 24], lean: 14, fF: [14, 0], fB: [-10, 0], hF: [16, 34], hB: [12, 32], wang: 40 })],
  win: () => [P({ hip: [0, 25], lean: -2, fF: [9, 0], fB: [-9, 0], hF: [8, 59], hB: [-4, 57], wang: 90 }), P({ hip: [0, 25], lean: 0, fF: [9, 0], fB: [-9, 0], hF: [9, 60], hB: [-3, 58], wang: 80 })]
};
const SHIFT = (poses, dx) => poses.map(p => Object.assign({}, p, { hip: [p.hip[0] + dx, p.hip[1]], fF: [p.fF[0] + dx, p.fF[1]], fB: [p.fB[0] + dx, p.fB[1]], hF: [p.hF[0] + dx, p.hF[1]], hB: [p.hB[0] + dx, p.hB[1]] }));
['knock', 'down', 'dead'].forEach(k => { const f = COMMON[k]; COMMON[k] = (w, sc) => SHIFT(f(w), Math.max(0, 12 - ((sc || 1) - 1) * 45)); });
const WAV = { mic: 60, flag: 84, salami: 38, fist: 90 };

const ATK = {};
ATK.mic = {
  a1: () => [P({ hip: [-2, 25], lean: -6, hF: [0, 36], wang: 150, ...LEG, fF: [8, 0] }), P({ hip: [3, 24], lean: 14, hF: [24, 38], wang: 5, ext: 6, ...LEG, head: 8 }), P({ hip: [3, 24], lean: 15, hF: [25, 37], wang: 0, ext: 10, ...LEG, head: 8 }), P({ hip: [1, 25], lean: 6, hF: [16, 36], wang: 30, ...LEG })],
  a2: () => [P({ hip: [-3, 25], lean: -8, hF: [-4, 41], wang: 165, ...LEG, fF: [8, 0] }), P({ hip: [4, 24], lean: 18, hF: [22, 38], wang: 20, ext: 8, ...LEG, head: 10 }), P({ hip: [4, 24], lean: 20, hF: [23, 35], wang: 5, ext: 22, ...LEG, head: 10 }), P({ hip: [2, 25], lean: 8, hF: [16, 36], wang: 30, ...LEG })],
  a3: () => SLAM(0),
  jatk: () => [P({ hip: [0, 26], lean: 10, fF: [14, 14], fB: [-6, 8], hF: [22, 36], hB: [8, 40], wang: 5, ext: 12 }), P({ hip: [0, 26], lean: 10, fF: [15, 13], fB: [-6, 8], hF: [23, 35], hB: [8, 40], wang: 0, ext: 14 })],
  jdown: () => [P({ hip: [2, 24], lean: 24, fF: [10, 12], fB: [-4, 14], hF: [20, 24], hB: [14, 28], wang: -80, ext: 6 }), P({ hip: [2, 24], lean: 26, fF: [10, 12], fB: [-4, 14], hF: [20, 22], hB: [14, 26], wang: -85, ext: 8 })],
  special: () => spinFrames(6, (i, a) => P({ hip: [0, 22], lean: 6, fF: [13, 0], fB: [-13, 0], hF: [3 + 12 * Math.cos(rad(a)), 38 + 8 * Math.sin(rad(a))], hB: [-5, 36], wang: a, ext: 18 }))
};
function SLAM(w) {
  return [P({ hip: [-1, 24], lean: -4, hF: [5, 56], hB: [2, 54], wang: 100 + w, fF: [10, 0], fB: [-10, 0] }), P({ hip: [0, 25], lean: -8, hF: [7, 60], hB: [3, 58], wang: 100 + w, fF: [10, 0], fB: [-10, 0] }),
    P({ hip: [5, 22], lean: 28, head: 20, hF: [23, 22], hB: [18, 24], wang: -50 + w, ext: 4, fF: [18, 0], fB: [-10, 0] }), P({ hip: [5, 22], lean: 30, head: 20, hF: [25, 15], hB: [20, 18], wang: -70 + w, ext: 2, fF: [18, 0], fB: [-10, 0] }), P({ hip: [3, 24], lean: 14, hF: [20, 28], hB: [14, 28], wang: -20 + w, fF: [17, 0], fB: [-10, 0] })];
}
ATK.flag = {
  a1: () => [P({ hip: [-2, 25], lean: -6, hF: [2, 36], wang: 60, ...LEG, fF: [8, 0] }), P({ hip: [3, 24], lean: 12, hF: [20, 37], wang: 6, ...LEG, head: 6 }), P({ hip: [3, 24], lean: 13, hF: [22, 36], wang: 3, ...LEG, head: 6 }), P({ hip: [1, 25], lean: 6, hF: [14, 36], wang: 70, ...LEG })],
  a2: () => [P({ hip: [-3, 25], lean: -10, hF: [-2, 44], wang: 135, ...LEG, fF: [8, 0] }), P({ hip: [1, 25], lean: 8, hF: [14, 44], wang: 62, ...LEG }), P({ hip: [4, 24], lean: 16, hF: [22, 30], wang: -25, ...LEG, head: 8 }), P({ hip: [2, 25], lean: 6, hF: [14, 36], wang: 70, ...LEG })],
  a3: () => { const f = SLAM(-5); f[2] = Object.assign({}, f[2], { hF: [23, 32], wang: -48 }); f[3] = Object.assign({}, f[3], { hF: [25, 31], wang: -52 }); return f; },
  jatk: () => [P({ hip: [0, 26], lean: 10, fF: [14, 14], fB: [-6, 8], hF: [20, 32], hB: [8, 40], wang: -30 }), P({ hip: [0, 26], lean: 10, fF: [15, 13], fB: [-6, 8], hF: [21, 31], hB: [8, 40], wang: -34 })],
  jdown: () => [P({ hip: [2, 24], lean: 24, fF: [10, 12], fB: [-4, 14], hF: [20, 32], hB: [14, 30], wang: -72 }), P({ hip: [2, 24], lean: 26, fF: [10, 12], fB: [-4, 14], hF: [20, 31], hB: [14, 29], wang: -78 })],
  special: () => spinFrames(6, (i, a) => P({ hip: [0, 22], lean: 4, fF: [13, 0], fB: [-13, 0], hF: [8, 44], hB: [4, 40], wang: a }))
};
ATK.salami = {
  a1: () => [P({ hip: [-2, 25], lean: -6, hF: [2, 40], wang: 115, ...LEG, fF: [8, 0] }), P({ hip: [3, 24], lean: 12, hF: [22, 34], wang: 15, ...LEG, head: 6 }), P({ hip: [3, 24], lean: 13, hF: [24, 33], wang: 0, ...LEG, head: 6 }), P({ hip: [1, 25], lean: 6, hF: [14, 36], wang: 40, ...LEG })],
  a2: () => [P({ hip: [-3, 25], lean: -10, hF: [-3, 42], wang: 150, ...LEG, fF: [8, 0] }), P({ hip: [1, 25], lean: 8, hF: [14, 42], wang: 70, ...LEG }), P({ hip: [4, 24], lean: 16, hF: [22, 28], wang: -12, ...LEG, head: 8 }), P({ hip: [2, 25], lean: 6, hF: [14, 36], wang: 40, ...LEG })],
  a3: () => SLAM(10),
  jatk: () => ATK.flag.jatk(), jdown: () => ATK.flag.jdown(),
  special: () => { const f = [[8, 60, 100], [12, 56, 50], [23, 22, -60], [25, 17, -80], [14, 40, 20], [4, 52, 90]]; return f.map((q, i) => P({ hip: [i >= 2 && i <= 3 ? 4 : 0, i >= 2 && i <= 3 ? 22 : 24], lean: i >= 2 && i <= 3 ? 26 : 0, head: i >= 2 && i <= 3 ? 16 : 0, fF: [14, 0], fB: [-12, 0], hF: [q[0], q[1]], hB: [q[0] - 4, q[1] - 2], wang: q[2] })); }
};
ATK.fist = {
  a1: () => [P({ hip: [-1, 25], lean: -6, hF: [2, 36], wang: 110, fF: [8, 0], fB: [-11, 0] }), P({ hip: [3, 25], lean: 12, hF: [23, 38], wang: 5, ...LEG }), P({ hip: [3, 25], lean: 13, hF: [24, 37], wang: 3, ...LEG }), P({ hip: [1, 25], lean: 6, hF: [14, 36], wang: 40, ...LEG })],
  a2: () => [P({ hip: [-2, 25], lean: -8, fF: [12, 20], fB: [-6, 0], hF: [8, 38], hB: [4, 36], wang: 60 }), P({ hip: [3, 24], lean: -10, fF: [29, 22], fB: [-6, 0], hF: [8, 38], hB: [0, 36], wang: 60 }), P({ hip: [3, 24], lean: -11, fF: [30, 22], fB: [-6, 0], hF: [8, 38], hB: [0, 36], wang: 60 }), P({ hip: [1, 25], lean: 2, fF: [10, 8], fB: [-8, 0] })],
  a3: () => SLAM(0)
};
const THROWPOSE = () => [P({ hip: [-2, 25], lean: -12, hF: [-4, 50], wang: 120, ...LEG, fF: [8, 0] }), P({ hip: [3, 24], lean: 14, hF: [22, 46], wang: 30, ...LEG }), P({ hip: [3, 24], lean: 16, hF: [24, 42], wang: 20, ...LEG }), P({ hip: [1, 25], lean: 6, hF: [14, 36], wang: 40, ...LEG })];

/* durations in 60Hz ticks (walk/run are distance-driven; specials loop) */
const TIMING = { idle: [14, 14, 14, 14], walk: [3, 3, 3, 3, 3, 3, 3, 3], run: [3, 3, 3, 3, 3, 3], jump: [99, 99, 99], land: [6], jatk: [4, 99], jdown: [3, 99],
  a1: [4, 3, 3, 6], a2: [5, 3, 4, 7], a3: [7, 4, 4, 5, 8], special: [4, 4, 4, 4, 4, 4], grab: [10, 10], gstrike: [3, 4, 6], throw: [5, 4, 8], hit: [6, 8],
  knock: [99, 99], down: [8, 99], getup: [8, 8, 8], dead: [12, 99], win: [14, 14], held: [99] };
const PLAYER_ANIMS = ['idle', 'walk', 'run', 'jump', 'land', 'jatk', 'jdown', 'a1', 'a2', 'a3', 'special', 'grab', 'gstrike', 'throw', 'hit', 'knock', 'down', 'getup', 'dead', 'win', 'held'];
const ENEMY_ANIMS = ['idle', 'walk', 'run', 'a1', 'a2', 'a3', 'hit', 'knock', 'down', 'getup', 'dead', 'held'];

function buildPoses(k, isPlayer) {
  const w = WAV[k.family], fam = ATK[k.family], names = isPlayer ? PLAYER_ANIMS : ENEMY_ANIMS, out = {};
  for (const a of names) {
    if (COMMON[a]) out[a] = COMMON[a](w, k.scale);
    else if (a === 'a2' && k.throws) out[a] = THROWPOSE();
    else out[a] = fam[a]();
  }
  return out;
}

/* ---------- figure renderer ---------- */
function headColor(f, lx, ly) {
  const R = f.r, r2 = lx * lx + ly * ly;
  let col = 0;
  const inFace = ((lx + .4) / R) ** 2 + ((ly + .3) / (R + .5)) ** 2 <= 1;
  if (inFace) col = f.skin;
  if (lx > R - .4 && lx < R + .9 && ly > -1.3 && ly < .2 && col === 0) col = f.skin; // nose
  const hairTop = (ly > 1.6 + Math.max(0, lx - 2) * .35) || lx < -3.4;
  switch (f.hair) {
    case 'slick': if (inFace && hairTop) col = f.hairC; if (lx > -3 && lx < 4 && ly > R - .6 && ly < R + 1.4) col = f.hairC; if (lx > -4.8 && lx < -3.4 && ly < 1.5 && ly > -2 && inFace) col = shade(f.hairC, 1.0); break;
    case 'comb': if (inFace && (ly > 2.2 + Math.max(0, lx - 3) * .4 || lx < -3.6)) col = f.hairC; break;
    case 'curly': if (r2 <= (R + 1.5) ** 2 && (ly > 2.4 + Math.max(0, lx - 1) * .25 || lx < -3) && !(lx > 1 && ly < 2.6)) col = (Math.sin(lx * 2.3) + Math.cos(ly * 2.6) > .9) ? shade(f.hairC, 1.5) : f.hairC; break;
    case 'long': if (inFace && (ly > 1.2 + Math.max(0, lx - 2) * .3 || lx < -3.2)) col = (((Math.floor((lx + ly * .6) / 2.4)) % 3 + 3) % 3 === 0) ? f.hair2 : f.hairC; break;
    case 'beanie': if (r2 <= (R + 1) ** 2 && ly > 1.6) col = ly < 3.2 ? shade(f.hairC, 1.35) : f.hairC; break;
    case 'cap': if (inFace && ly > 1.9) col = f.hairC; if (ly > 1.2 && ly < 2.7 && lx > 2 && lx < R + 3.6) col = shade(f.hairC, 1.25); if (lx < -3.6 && inFace) col = f.hairC; break;
  }
  if (f.stubble && inFace && ly < -1.2 && lx > -3 && col === f.skin) col = f.stubble;
  if (f.beard && inFace && ly < -2.2 && lx > -2.6 && lx < R - .6) col = f.beard;
  if (f.shades && lx > .4 && lx < R - .4 && ly > -.6 && ly < 1.9) col = ly > 1.35 ? hex('#1b1226') : ((lx > 2.2 && lx < 3.6 && ly > .4 && ly < 1.2) ? shade(f.shades, 1.9) : shade(f.shades, .78));
  if (f.shades && lx > -3.2 && lx <= .2 && ly > .8 && ly < 1.7) col = shade(f.shades, .8);
  if (f.goggles && lx > .6 && lx < R - .1 && ly > -.4 && ly < 2.3) col = f.goggles;
  if (f.visor && lx > .6 && lx < R - .1 && ly > -.3 && ly < 2.0) col = f.visor;
  if (f.moustache && lx > 2.4 && lx < R - .5 && ly > -2.5 && ly < -1.5) col = f.hairC;
  if (f.moustache && lx > R - 1.6 && lx < R - .3 && ly >= -1.5 && ly < -.2) col = f.hairC;
  if (!f.beard && !f.moustache && lx > 3.4 && lx < 5.6 && ly > -3.4 && ly < -2.6 && inFace) col = shade(f.skin, .72);
  return col;
}
function drawHead(buf, k, cx, cy, tiltDeg) {
  const s = k.scale * HS, t = rad(tiltDeg), ct = Math.cos(t), st = Math.sin(t), f = k.face, span = Math.ceil((f.r + 5) * s);
  for (let py = Math.floor(cy - span); py <= Math.ceil(cy + span); py++) for (let px = Math.floor(cx - span); px <= Math.ceil(cx + span); px++) {
    const wx = px + .5 - cx, wy = -(py + .5 - cy), lx = (wx * ct - wy * st) / s, ly = (wx * st + wy * ct) / s;
    const c = headColor(f, lx, ly); if (c) buf.set(px, py, c);
  }
}

function drawWeapon(buf, k, pose, hand, hip, s) {
  const t = k.weapon; if (!t) return;
  const a = rad(pose.wang), dx = Math.cos(a), dy = -Math.sin(a), ext = (pose.ext || 0) * s, px = -dy, py = dx; // perp (pixel)
  const hx = hand[0], hy = hand[1];
  if (t === 'mic') {
    const belt = [hip[0] - 2 * s, hip[1] + 1 * s], mx = hx + dx * ext, my = hy + dy * ext;
    const sag = 9 * Math.max(0, 1 - ext / (22 * s)) + 2;
    const cord = (A, B, sg) => { const C = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2 + sg]; for (let i = 0; i <= 24; i++) { const u = i / 24, x = (1 - u) * (1 - u) * A[0] + 2 * u * (1 - u) * C[0] + u * u * B[0], y = (1 - u) * (1 - u) * A[1] + 2 * u * (1 - u) * C[1] + u * u * B[1]; buf.disk(x, y, .75, hex('#2a2a32')); } };
    cord(belt, [hx, hy], sag); if (ext > 0) buf.line([hx, hy], [mx, my], .75, hex('#2a2a32'));
    const hl = 7 * s, e = [mx + dx * hl, my + dy * hl];
    buf.line([mx, my], e, 1.7 * s, hex('#c8ccd6')); buf.line([mx, my], [mx + dx * 2, my + dy * 2], 1.7 * s, hex('#2a2a32'));
    buf.disk(e[0] + dx * 1.2, e[1] + dy * 1.2, 3.2 * s, hex('#5c6070')); buf.disk(e[0] + dx * 1.2 - 1, e[1] + dy * 1.2 - 1, 1.4 * s, hex('#c9cfdc'));
  } else if (t === 'flag') {
    const P0 = [hx - dx * 9 * s, hy - dy * 9 * s], P1 = [hx + dx * 26 * s, hy + dy * 26 * s];
    buf.line(P0, P1, 1.2 * s, hex('#8a5a2b')); buf.disk(P1[0] + dx, P1[1] + dy, 1.5 * s, hex('#f0c43c'));
    const cl = 15 * s, ch = 10 * s, A = P1, B = [P1[0] + px * cl, P1[1] + py * cl], C = [B[0] - dx * ch, B[1] - dy * ch], D = [A[0] - dx * ch, A[1] - dy * ch];
    buf.poly([A, B, C, D], hex('#e30a17'));
    const mid = [(A[0] + D[0]) / 2, (A[1] + D[1]) / 2], q = (u) => [mid[0] + px * u * s, mid[1] + py * u * s];
    buf.disk(q(5.2)[0], q(5.2)[1], 3.1 * s, hex('#ffffff')); buf.disk(q(6.3)[0], q(6.3)[1], 2.5 * s, hex('#e30a17')); buf.disk(q(9.8)[0], q(9.8)[1], 1.05 * s, hex('#ffffff'));
  } else if (t === 'salami') {
    const A = [hx - dx * 6 * s, hy - dy * 6 * s], B = [hx + dx * 19 * s, hy + dy * 19 * s], r = 4.4 * s;
    buf.line([A[0] - dx * 3, A[1] - dy * 3], [A[0] - dx * 5, A[1] - dy * 5], 1 * s, hex('#d9c28a'));
    buf.line(A, B, r, hex('#8e2f2a')); buf.line([A[0] + px * r * .35, A[1] + py * r * .35], [B[0] + px * r * .35, B[1] + py * r * .35], r * .45, hex('#b8453c'));
    buf.line([A[0] - px * r * .6, A[1] - py * r * .6], [B[0] - px * r * .6, B[1] - py * r * .6], r * .3, hex('#6a2020'));
    for (let i = 0; i < 6; i++) { const u = (i + .5) / 6.2, off = ((i % 3) - 1) * r * .5; buf.disk(A[0] + (B[0] - A[0]) * u + px * off, A[1] + (B[1] - A[1]) * u + py * off, .8 * s, hex('#f1dcc8')); }
    buf.disk(B[0], B[1], r * .75, hex('#7a2622')); buf.line([B[0], B[1]], [B[0] + dx * 3 * s, B[1] + dy * 3 * s], 1 * s, hex('#d9c28a')); buf.disk(A[0], A[1], r * .75, hex('#7a2622'));
  } else if (t === 'baton') {
    buf.line([hx - dx * 3 * s, hy - dy * 3 * s], [hx + dx * 18 * s, hy + dy * 18 * s], 1.7 * s, hex('#4d5560')); buf.line([hx + dx * 12 * s, hy + dy * 12 * s], [hx + dx * 18 * s, hy + dy * 18 * s], 1.7 * s, hex('#8892a0'));
  } else if (t === 'case') {
    const C = [hx + dx * 6 * s, hy + dy * 6 * s], w = 6 * s, h = 4.2 * s;
    buf.poly([[C[0] - dx * w - px * h, C[1] - dy * w - py * h], [C[0] + dx * w - px * h, C[1] + dy * w - py * h], [C[0] + dx * w + px * h, C[1] + dy * w + py * h], [C[0] - dx * w + px * h, C[1] - dy * w + py * h]], hex('#2b1d12'));
    buf.disk(C[0], C[1], 1.3 * s, hex('#48d17a'));
  } else if (t === 'cane') {
    const B = [hx + dx * 17 * s, hy + dy * 17 * s]; buf.line([hx - dx * 4 * s, hy - dy * 4 * s], B, 1.1 * s, hex('#e0b02c')); buf.disk(B[0], B[1], 2.1 * s, hex('#f6d060'));
  }
}

function figure(k, pose) {
  const buf = new Buf(CELL, CELL), s = k.scale, B = k.build, pal = k.pal, st = k.style;
  const T = (p) => [AX + p[0] * s, AY - p[1] * s];
  const hip = T(pose.hip), lean = rad(pose.lean), d = [Math.sin(lean), -Math.cos(lean)], n = [-d[1], d[0]], TL = 18 * s;
  const along = (t, off) => [hip[0] + d[0] * TL * t + n[0] * (off || 0) * s, hip[1] + d[1] * TL * t + n[1] * (off || 0) * s];
  const sh = along(1), headC = [sh[0] + d[0] * (1.5 + k.face.r * HS) * s + n[0] * s, sh[1] + d[1] * (1.5 + k.face.r * HS) * s + n[1] * s];
  const rig = {};
  const legBend = pose.legBend;
  const shoeR = Math.max(2.3, B.leg - .3);
  const leg = (foot, front) => { const hp = [hip[0] + (front ? 1 : -1) * .6 * s, hip[1]], tg = T(foot); tg[1] -= shoeR * s; const r = Object.assign({ hp }, ik(hp[0], hp[1], tg[0], tg[1], 14 * s, 14 * s, legBend)); if (r.mid[1] > AY - 4 * s && foot[1] < 8) r.mid[1] = AY - 4 * s; return r; };
  const arm = (hand, front) => { const sp = [sh[0] + (front ? 1 : -1) * .8 * s, sh[1] + 1 * s], tg = T(hand); return Object.assign({ sp }, ik(sp[0], sp[1], tg[0], tg[1], 9 * s, 9 * s, [-.4, 1])); };
  const lB = leg(pose.fB, false), lF = leg(pose.fF, true), aB = arm(pose.hB, false), aF = arm(pose.hF, true);
  rig.lF = lF; rig.lB = lB; rig.aF = aF; rig.aB = aB; rig.head = headC; rig.hip = hip; rig.sh = sh;
  const drawLeg = (L, front) => {
    const f = front ? 1 : .78, c = shade(pal.pants, f), r = B.leg * s;
    buf.line(L.hp, L.mid, r + .4, c); buf.line(L.mid, L.end, Math.min(r - .2, shoeR * s), c);
    const sc = shade(pal.shoe, front ? 1 : .8), e = L.end;
    buf.line([e[0] - 1.2 * s, e[1]], [e[0] + 4.2 * s, e[1]], shoeR * s, sc);
    if (pal.sole) buf.line([e[0] - 2 * s, e[1] + (shoeR - .9) * s], [e[0] + 4.4 * s + shoeR * .3, e[1] + (shoeR - .9) * s], .9 * s, shade(pal.sole, front ? 1 : .85));
  };
  const drawArm = (A, hand, front) => {
    const f = front ? 1 : .78, sl = shade(pal.sleeve, f), r = B.arm * s;
    buf.line(A.sp, A.mid, r + .3, sl); buf.line(A.mid, A.end, r, sl); if (pal.cuff !== pal.skin && st !== 'tank' && st !== 'crop') buf.disk(A.end[0] - (A.end[0] - A.mid[0]) * .12, A.end[1] - (A.end[1] - A.mid[1]) * .12, r + .3, shade(pal.cuff, f));
    buf.disk(A.end[0], A.end[1], 2.1 * s, shade(pal.skin, f));
  };
  drawArm(aB, pose.hB, false);
  drawLeg(lB, false);
  // long hair behind
  if (k.face.hair === 'long') for (let i = 0; i <= 16; i++) { const p = [headC[0] - d[0] * i * s - n[0] * (4.6 - Math.min(i, 8) * .1) * s + Math.sin(i * .9) * 1.3 * s, headC[1] - d[1] * i * s - n[1] * (3.4 - Math.min(i, 8) * .12) * s]; buf.disk(p[0], p[1], (3.3 - i * .06) * s, (i % 5 < 2) ? k.face.hair2 : k.face.hairC); }
  // torso
  const tr = B.torso * s;
  const gold = (p, r) => buf.disk(p[0], p[1], r * s, hex('#f0c43c'));
  if (st === 'crop') {
    buf.line(hip, sh, tr, pal.skin);
    buf.line(along(1.0), along(.52), tr + .6, pal.top); buf.line(along(.98, 1.2), along(.55, 1.2), tr * .4, pal.topD);
    buf.line(along(.06), hip, tr + .6, pal.pants); buf.line(along(.16, 1), along(.06, 1), 1.2 * s, hex('#3c3c48')); buf.line([hip[0] - n[0] * 3 * s, hip[1] - n[1] * 3 * s], [hip[0] - n[0] * 3 * s - d[0] * 0, hip[1] - n[1] * 3 * s - d[1] * 0], 1, pal.belt);
    buf.line(along(1.0, tr / s - .5), along(.84, tr / s - .3), .8 * s, pal.chain);
  } else if (st === 'coat') {
    buf.line(hip, sh, tr, pal.shirt); buf.line(along(1), along(-.1), tr + 1.6 * s, pal.coat);
    buf.line(along(.98, tr / s + 1), along(-.05, tr / s + 1), 1.2 * s, pal.coatD);
    buf.line(along(.92, tr / s - .6), along(.0, tr / s - .6), 1.7 * s, pal.shirt);
    buf.line(along(.98, tr / s - .4), along(.5, tr / s - .4), .8 * s, pal.chain); gold(along(.5, tr / s - .5), 1.5);
    const cp = along(1.02); buf.disk(cp[0] + n[0] * 2.2 * s, cp[1] + n[1] * 2.2 * s, 3.2 * s, pal.collar); buf.disk(cp[0] - n[0] * 2.2 * s, cp[1] - n[1] * 2.2 * s, 3.2 * s, shade(pal.collar, .85));
  } else if (st === 'jacket') {
    buf.line(hip, sh, tr, pal.shirt); buf.line(along(1), along(.0), tr + 1.1 * s, pal.jacket);
    buf.line(along(.9, tr / s - .3), along(.05, tr / s - .3), 1.8 * s, pal.shirt); buf.line(along(.98, tr / s + .8), along(.05, tr / s + .8), .8 * s, pal.jacketD);
    buf.line(along(.98, tr / s - .2), along(.55, tr / s - .2), .8 * s, pal.chain);
    const cp = along(1.0); buf.disk(cp[0] + n[0] * 2 * s, cp[1] + n[1] * 2 * s, 2.4 * s, pal.jacketD);
  } else if (st === 'suit' || st === 'fat') {
    buf.line(hip, sh, tr, pal.shirt); buf.line(along(1), along(.02), tr + .8 * s, pal.jacket);
    if (st === 'fat') { const bc = along(.32, tr / s - 1); buf.disk(bc[0], bc[1], 8.5 * s, pal.jacket); buf.disk(bc[0] + n[0] * 4 * s, bc[1] + n[1] * 4 * s, 4.2 * s, pal.shirt); }
    buf.line(along(.95, tr / s - .2), along(st === 'fat' ? .25 : .38, tr / s - .2), 1.2 * s, pal.tie || hex('#c0392b')); buf.line(along(.98, tr / s + .6), along(.1, tr / s + .6), .8 * s, pal.jacketD);
  } else if (st === 'tank') {
    buf.line(hip, sh, tr, pal.skin); buf.line(along(1), along(.1), tr + .4 * s, pal.tank); buf.line(along(.9, tr / s - 1), along(.15, tr / s - 1), 1.2 * s, pal.tankD);
  } else if (st === 'military') {
    buf.line(hip, sh, tr, pal.jacket); buf.line(along(.95, tr / s - .5), along(.1, tr / s - .5), 1.5 * s, pal.vest); buf.line(along(.9), along(.2), tr * .8, shade(pal.vest, .9));
    buf.line(along(0.55, 0), along(0.55, tr / s + .8), 1 * s, shade(pal.vest, 1.3));
    const cp = along(1.0); buf.disk(cp[0] + n[0] * 1 * s, cp[1] + n[1] * 1 * s, 3 * s, pal.scarf);
  }
  drawLeg(lF, true);
  if (k.face.hair === 'long' || true) drawHead(buf, k, headC[0], headC[1], pose.head);
  drawArm(aF, pose.hF, true);
  drawWeapon(buf, k, pose, aF.end, hip, s);
  buf.outline(OUT);
  return { buf, rig };
}

/* ---------- kit rendering ---------- */
function renderKit(id, isPlayer) {
  const k = K[id], poses = buildPoses(k, isPlayer), frames = {}, rigs = {};
  for (const a in poses) { frames[a] = []; rigs[a] = []; poses[a].forEach(p => { const r = figure(k, p); frames[a].push(r.buf); rigs[a].push(r.rig); }); }
  return { id, kit: k, frames, rigs, poses };
}
const PLAYERS = ['ricky', 'vv', 'johnny'], ENEMIES = ['guard', 'exec', 'heavy', 'brawler', 'raider', 'ledger', 'bigtony', 'mara', 'auditor'];
function portrait(rk) { const r = rk.rigs.idle[0].head, b = rk.frames.idle[0], o = new Buf(32, 32); for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) o.set(x, y, b.get(Math.round(r[0]) - 16 + x, Math.round(r[1]) - 15 + y)); return o; }

/* ---------- props, food, fx ---------- */
const C = hex;
function makeProp(type) {
  const b = new Buf(34, 36);
  if (type === 'crate') { b.rect(3, 8, 28, 26, C('#a8702f')); b.rect(3, 8, 28, 3, C('#c98d45')); b.rect(5, 12, 24, 20, C('#8d5a25')); for (let i = 0; i < 3; i++) b.rect(5, 14 + i * 7, 24, 1, C('#6a4219')); b.line([5, 12], [29, 32], .9, C('#6a4219')); b.line([29, 12], [5, 32], .9, C('#6a4219')); b.rect(3, 8, 3, 26, C('#c98d45')); b.rect(28, 8, 3, 26, C('#7a4d1f')); b.rect(13, 19, 8, 6, C('#f0c43c')); b.rect(15, 21, 4, 2, C('#a8731d')); }
  if (type === 'barrel') { b.ell(17, 18, 11, 16, C('#3b6aa8')); b.rect(6, 8, 22, 21, C('#3b6aa8')); b.rect(6, 8, 4, 21, C('#5b8bc8')); b.rect(24, 8, 4, 21, C('#294e84')); b.ell(17, 8, 11, 4, C('#6b9bd6')); [10, 18, 27].forEach(y => b.rect(5, y, 24, 2, C('#9aa3b2'))); b.rect(12, 14, 10, 6, C('#f0c43c')); }
  if (type === 'bin') { b.rect(5, 10, 24, 25, C('#7d8590')); b.rect(5, 10, 4, 25, C('#a3acb8')); b.rect(25, 10, 4, 25, C('#5a626d')); b.ell(17, 10, 13, 4, C('#9aa3b2')); b.rect(3, 7, 28, 3, C('#a3acb8')); for (let i = 0; i < 4; i++) b.rect(9 + i * 5, 14, 2, 18, C('#5a626d')); }
  if (type === 'boxes') { b.rect(2, 18, 18, 16, C('#c49a5a')); b.rect(2, 18, 18, 3, C('#dcb878')); b.rect(8, 21, 6, 13, C('#9a7640')); b.rect(15, 4, 17, 15, C('#b98a4c')); b.rect(15, 4, 17, 3, C('#d4a868')); b.rect(21, 7, 5, 12, C('#8f6a38')); b.rect(18, 22, 14, 12, C('#a8793f')); b.rect(18, 22, 14, 3, C('#c8995a')); }
  b.outline(OUT); return b;
}
const PROP_BASE = 35; // bottom row offset
function plate(b, cx, cy) { b.ell(cx, cy + 1, 16.5, 9.5, C('#b8862a')); b.ell(cx, cy, 16.5, 9.2, C('#e8b83c')); b.ell(cx, cy, 14.8, 8, C('#f6f2ea')); b.ell(cx, cy + .6, 11, 5.6, C('#e3dfd3')); }
function makeFood(type) {
  const W = 36, H = 26, b = new Buf(W, H), cx = 18, cy = 14;
  const plateless = (type === 'spit');
  if (type === 'spit') { const s = new Buf(30, 50); for (let y = 8; y < 44; y++) { const t = (y - 8) / 36, hw = 10.5 - t * 3.2 + Math.sin(t * 3) * .8; for (let x = Math.round(15 - hw); x < Math.round(15 + hw); x++) { const band = Math.floor((y + (x > 15 ? 0 : 1)) / 3) & 1; const sh = x < 15 - hw * .45 ? .75 : (x > 15 + hw * .45 ? 1.18 : 1); s.set(x, y, shade(band ? C('#a9703a') : C('#8a5530'), sh)); } } s.ell(15, 8, 10.5, 2.4, C('#c28a50')); s.rect(14, 44, 2, 5, C('#9aa3b2')); s.rect(14, 2, 2, 7, C('#9aa3b2')); s.rect(16, 0, 8, 5, C('#e30a17')); s.disk(18.2, 2.5, 1.5, C('#fff')); s.disk(18.9, 2.5, 1.2, C('#e30a17')); s.set(21, 2, C('#fff')); s.outline(OUT); return s; }
  plate(b, cx, cy);
  if (type === 'adana') { b.line([7, 12], [26, 5.5], 2.6, C('#7a3220')); b.line([7, 12.6], [26, 6.2], 1, C('#b95a32')); b.line([8, 17], [27, 10], 2.6, C('#7a3220')); b.line([8, 17.6], [27, 10.6], 1, C('#b95a32')); for (let i = 0; i < 6; i++) { b.set(10 + i * 3, 11 - i, C('#4a1c12')); b.set(11 + i * 3, 16 - i, C('#4a1c12')); } b.line([3, 17], [9, 15], .6, C('#d9c08a')); b.line([3, 12.5], [9, 11], .6, C('#d9c08a')); b.line([6, 9], [16, 5], 1.6, C('#d8261c')); b.line([8, 8], [17, 5.4], 1.2, C('#3fa03a')); b.disk(25, 19, 2.6, C('#c9788a')); b.disk(22, 20, 2.2, C('#e5aab8')); b.disk(27, 21, 1.8, C('#b45a70')); }
  if (type === 'shish') { b.ell(cx, cy + 1, 12, 6, C('#efe6cf')); for (let i = 0; i < 12; i++) b.set(8 + i * 2 + (i % 3), 11 + (i % 4) * 2, C('#d4c8a8')); for (const off of [-3.5, 3]) { b.line([5, 14 + off + 2], [30, 6 + off + 2], .8, C('#cfa66a')); const cols = ['#7a3320', '#d8372a', '#7a3320', '#3fa03a', '#7a3320']; cols.forEach((c, i) => { const u = .22 + i * .14, x = 5 + 25 * u, y = 14 + off + 2 - 8 * u; b.rect(Math.round(x) - 2, Math.round(y) - 3, 4, 4, C(c)); b.rect(Math.round(x) - 2, Math.round(y) - 3, 4, 1, shade(C(c), 1.3)); }); } }
  if (type === 'doner') { b.ell(12, 15, 9.5, 5.2, C('#7b4a2c')); for (let i = 0; i < 7; i++) b.line([5 + i * 2.2, 17 - (i % 2)], [8 + i * 2.2, 12 + (i % 3)], .7, C('#b0703f')); for (let i = 0; i < 9; i++) b.line([14 + i, 6 + (i % 3)], [20 + i, 11 - (i % 2)], .6, C('#f2c94c')); b.ell(27, 9, 5, 3.4, C('#d8372a')); b.ell(26, 8, 4, 2.2, C('#5aa63a')); b.ell(10, 7, 6, 3, C('#e0bd80')); b.ell(24, 17, 6, 4, C('#e8c98c')); b.line([19, 17], [29, 17], .8, C('#cfa35e')); b.disk(24, 16, 1.6, C('#6fb03a')); b.disk(27, 15, 1.2, C('#d8372a')); }
  if (type === 'lahmacun') { b.ell(cx, cy, 13.4, 7.2, C('#a8512c')); b.ell(cx, cy - .8, 12, 5.8, C('#b85c32')); for (let i = 0; i < 14; i++) { const a = i * 2.4, r = 3 + (i % 5) * 1.7; b.set(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * .5), C(i % 3 ? '#4a8a30' : '#d8372a')); } b.poly([[18, 14], [32, 6], [31, 10]], C('#c46a38')); b.line([18, 14], [32, 6], .8, C('#f6f2ea')); b.set(25, 9, C('#4a8a30')); }
  if (type === 'kunefe') { b.ell(cx, cy, 13.5, 7.2, C('#b86a1c')); b.ell(cx, cy - .7, 12.6, 6.4, C('#e0922a')); for (let i = 0; i < 18; i++) b.set(Math.round(cx - 11 + (i * 7) % 23), Math.round(cy - 4 + (i * 5) % 9), C('#f6c860')); b.ell(cx, cy - .8, 5, 2.6, C('#9ac040')); for (let i = 0; i < 6; i++) b.set(cx - 4 + i * 2, cy - 1 + (i % 2), C('#d6e870')); }
  b.outline(OUT); return b;
}
function makeEmptyPlate() { const b = new Buf(36, 26); plate(b, 18, 14); b.line([6, 13], [26, 6], 1.2, C('#b0703f')); b.line([7, 14], [27, 7], .6, C('#e0bd80')); b.disk(10, 18, 1, C('#7a3220')); b.disk(21, 19, 1.4, C('#c9788a')); b.line([26, 16], [33, 22], .8, C('#aab0bc')); b.outline(OUT); return b; }
function star(b, cx, cy, ro, ri, n, c, rot) { const pts = []; for (let i = 0; i < n * 2; i++) { const r = i % 2 ? ri : ro, a = rot + i * Math.PI / n; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } b.poly(pts, c); }
function makeFx() {
  const fx = { spark: [], boom: [], dust: [], ko: null, glow: null, sparkle: [] };
  [5, 8, 10].forEach((r, i) => { const b = new Buf(24, 24); star(b, 12, 12, r + 1, r * .45, 7, C('#e8402a'), .3 * i); star(b, 12, 12, r - .5, r * .38, 7, C('#ffd23a'), .3 * i); b.disk(12, 12, Math.max(1.5, r * .3), C('#fff6d0')); fx.spark.push(b); });
  [8, 14, 18].forEach((r, i) => { const b = new Buf(44, 44); star(b, 22, 22, r + 2.4, r * .55, 9, OUT, .2 * i); star(b, 22, 22, r + 1, r * .5, 9, C('#e8402a'), .2 * i); star(b, 22, 22, r - 1.2, r * .42, 9, C('#ffd23a'), .2 * i); b.disk(22, 22, Math.max(2, r * .34), C('#fffbe6')); fx.boom.push(b); });
  [3, 5, 7].forEach((r, i) => { const b = new Buf(24, 12); [[-5, 0, r], [0, -1, r + 1], [5, 0, r]].forEach(q => b.ell(12 + q[0] * (1 + i * .35), 7 + q[1], q[2], q[2] * .6, C('#c9c3b4'))); b.ell(12, 6, 3 + i, 2 + i * .5, C('#e8e3d4')); fx.dust.push(b); });
  const k = new Buf(9, 9); star(k, 4.5, 4.5, 4.4, 1.8, 5, OUT, -Math.PI / 2); star(k, 4.5, 4.5, 3.4, 1.5, 5, C('#ffd23a'), -Math.PI / 2); fx.ko = k;
  const g = new Buf(30, 30); star(g, 15, 15, 14, 3.4, 8, C('#ffe9a0'), 0); star(g, 15, 15, 9, 3, 8, C('#fffbe6'), .39); g.disk(15, 15, 4, C('#ffffff')); fx.glow = g;
  [2, 3, 4].forEach(r => { const b = new Buf(9, 9); b.rect(4, 4 - r, 1, r * 2 + 1, C('#ffffff')); b.rect(4 - r, 4, r * 2 + 1, 1, C('#ffffff')); b.set(4, 4, C('#fff6c8')); fx.sparkle.push(b); });
  return fx;
}

/* ---------- atlas packing ---------- */
function packGame(rk, mk) { // dense 8-col sheet used in game
  const names = Object.keys(rk.frames), index = {}; let n = 0;
  names.forEach(a => { index[a] = { start: n, n: rk.frames[a].length }; n += rk.frames[a].length; });
  const rows = Math.ceil(n / COLS), cv = mk(COLS * CELL, rows * CELL), ctx = cv.getContext('2d');
  names.forEach(a => rk.frames[a].forEach((b, i) => { const idx = index[a].start + i; ctx.drawImage(b.toCanvas(mk), (idx % COLS) * CELL, Math.floor(idx / COLS) * CELL); }));
  return { canvas: cv, index, cols: COLS };
}
function packRows(rk, mk) { // artist sheet: one animation per row
  const names = Object.keys(rk.frames), rows = {}, cv = mk(COLS * CELL, names.length * CELL), ctx = cv.getContext('2d');
  names.forEach((a, r) => { rows[a] = { row: r, n: rk.frames[a].length }; rk.frames[a].forEach((b, i) => ctx.drawImage(b.toCanvas(mk), i * CELL, r * CELL)); });
  return { canvas: cv, rows };
}

G.Sprites = { CELL, AX, AY, COLS, K, TIMING, PLAYERS, ENEMIES, PLAYER_ANIMS, ENEMY_ANIMS, Buf, renderKit, packGame, packRows, portrait, makeProp, makeFood, makeEmptyPlate, makeFx, figure, buildPoses, ik };
})(typeof globalThis !== 'undefined' ? (globalThis.GG = globalThis.GG || {}) : window.GG);
