/* Grease & Gold: World Tour - sprite art.
   Hand-authored keyframes, rasterised analytically into real pixels.
   No photo cut-outs, no runtime IK, no stretched parts: every limb is a
   fixed-length bone rotated to the pose; the outline is computed once on the
   silhouette so overlapping parts cannot produce duplicate-arm edges.
   Runs in Node (tools/build_art.js) and in the browser (fallback). */
(function (G) {
'use strict';
const Art = G.Art = {};

const CW = 132, CH = 116, AX = 66, AY = 104;   /* frame cell + feet anchor */
Art.CELL = { w: CW, h: CH, ax: AX, ay: AY };

/* ---------------- raster core ---------------- */
function newBuf(w, h) { return { w: w, h: h, d: new Uint32Array(w * h), m: new Uint8Array(w * h) }; }
const C = (r, g, b) => (0xFF000000 | (b << 16) | (g << 8) | r) >>> 0;
function hex(h) { const n = typeof h === 'string' ? parseInt(h.replace('#', ''), 16) : h; return C((n >> 16) & 255, (n >> 8) & 255, n & 255); }
Art.hex = hex;
Art.C = C;

const B = { base: 0, hi: 1, sh: 2, dk: 3 };
function tone(pal, i) { return pal[i] !== undefined ? pal[i] : pal[0]; }

function put(a, x, y, c) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= a.w || y >= a.h) return;
  const i = y * a.w + x; a.d[i] = c; a.m[i] = 1;
}
function filled(a, x, y) { x = Math.round(x); y = Math.round(y); return x >= 0 && y >= 0 && x < a.w && y < a.h && a.m[y * a.w + x] === 1; }
function rect(a, x, y, w, h, col) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(a, x + i, y + j, col);
}
function disc(a, cx, cy, r, col) {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x + .5 - cx, dy = y + .5 - cy;
      if (dx * dx + dy * dy <= r2) put(a, x, y, col);
    }
}
function ellipse(a, cx, cy, rx, ry, col) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + .5 - cx) / rx, dy = (y + .5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) put(a, x, y, col);
    }
}
function poly(a, pts, col) {
  let y0 = 1e9, y1 = -1e9;
  for (const p of pts) { if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    const xs = [];
    for (let i = 0, n = pts.length; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      if ((p[1] <= y && q[1] > y) || (q[1] <= y && p[1] > y)) xs.push(p[0] + (y - p[1]) / (q[1] - p[1]) * (q[0] - p[0]));
    }
    xs.sort((u, v) => u - v);
    for (let i = 0; i + 1 < xs.length; i += 2)
      for (let x = Math.ceil(xs[i]); x < xs[i + 1]; x++) put(a, x, y, col);
  }
}
/* rotated rectangle: centre, half-extents, angle (rad) */
function rrect(a, cx, cy, hw, hh, ang, col) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const pts = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(q => [cx + q[0] * c - q[1] * s, cy + q[0] * s + q[1] * c]);
  poly(a, pts, col);
}
/* capsule with 3-tone cel shading (light from upper-left) */
function capsule(a, x0, y0, x1, y1, r0, r1, pal) {
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1e-6;
  const minx = Math.floor(Math.min(x0 - r0, x1 - r1) - 1), maxx = Math.ceil(Math.max(x0 + r0, x1 + r1) + 1);
  const miny = Math.floor(Math.min(y0 - r0, y1 - r1) - 1), maxy = Math.ceil(Math.max(y0 + r0, y1 + r1) + 1);
  for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
    const px = x + .5, py = y + .5;
    let t = ((px - x0) * dx + (py - y0) * dy) / L2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = x0 + dx * t, cy = y0 + dy * t;
    const r = r0 + (r1 - r0) * t;
    const ddx = px - cx, ddy = py - cy, d = Math.hypot(ddx, ddy);
    if (d > r) continue;
    let col = tone(pal, B.base);
    if (d > 0.001) {
      const nx = ddx / d, ny = ddy / d;
      const lum = nx * -0.62 + ny * -0.78;
      if (lum > 0.42) col = tone(pal, B.hi);
      else if (lum < -0.4) col = tone(pal, B.sh);
      else if (lum < -0.82) col = tone(pal, B.dk);
    }
    put(a, x, y, col);
  }
}
/* silhouette outline: every body pixel touching empty space becomes dark */
function outline(a, col) {
  const m = a.m.slice();
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
    const i = y * a.w + x; if (!m[i]) continue;
    if (!m[i - 1] && x > 0 || !m[i + 1] && x < a.w - 1 || !m[i - a.w] && y > 0 || !m[i + a.w] && y < a.h - 1) a.d[i] = col;
  }
}
function clipRect(a, x, y, w, h, col) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const px = Math.round(x + i), py = Math.round(y + j);
    if (px < 0 || py < 0 || px >= a.w || py >= a.h) continue;
    const k = py * a.w + px; if (a.m[k]) a.d[k] = col;
  }
}
function clipEllipse(a, cx, cy, rx, ry, col) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + .5 - cx) / rx, dy = (y + .5 - cy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      if (x < 0 || y < 0 || x >= a.w || y >= a.h) continue;
      const k = y * a.w + x; if (a.m[k]) a.d[k] = col;
    }
}
function line(a, x0, y0, x1, y1, col, w) {
  const dx = x1 - x0, dy = y1 - y0, n = Math.max(Math.abs(dx), Math.abs(dy));
  for (let i = 0; i <= n; i++) {
    const x = x0 + dx * i / (n || 1), y = y0 + dy * i / (n || 1);
    if (w && w > 1) rect(a, Math.round(x - (w - 1) / 2), Math.round(y - (w - 1) / 2), w, w, col);
    else put(a, x, y, col);
  }
}

/* ---------------- palettes ---------------- */
const OUT = 0x140d18;
const SKIN = { light: { base: 0xd49a6a, hi: 0xe8b98a, sh: 0xa8703f, dk: 0x7d4f2a }, mid: { base: 0xb87a4e, hi: 0xd19667, sh: 0x8d5731, dk: 0x5f3a22 }, dark: { base: 0x8a5330, hi: 0xa86a42, sh: 0x603520, dk: 0x3d2114 } };

function pal(base, hi, sh, dk) { return { base: hex(base), hi: hex(hi), sh: hex(sh), dk: hex(dk === undefined ? sh : dk) }; }

const KITS = {};
/* ---- Ricky B: shearling coat, black trousers, Turkish flag on a pole ---- */
KITS.ricky = {
  id: 'ricky', name: 'Ricky B', kind: 'hero', h: 68, skin: SKIN.light,
  b: { s: 1.0, hipY: 33, torso: 19, shW: 19, hipW: 12, headR: 6.6, headY: 10, legU: 15, legL: 15, armU: 11, armL: 10.5, hand: 3.2 },
  pal: {
    coat: pal(0xc4a377, 0xe0c295, 0x9b7d52), fleece: pal(0xe8dcc2, 0xf6eedd, 0xbfae90),
    shirt: pal(0x2a2431, 0x3d3547, 0x171320), pants: pal(0x332e42, 0x4a4459, 0x1d1928),
    boot: pal(0x6b4a30, 0x8a6440, 0x4a3120), hair: pal(0x1c1520, 0x2c2330, 0x100b13),
    gold: pal(0xe8b93a, 0xffdc72, 0xa87c18), flag: pal(0xd8262c, 0xf0464a, 0x9c1418),
    steel: pal(0xb9c0cc, 0xe6ebf2, 0x7c8494), white: pal(0xf4efe2, 0xffffff, 0xc8c0b0)
  },
  face: 'mustache', hair: 'slick', weapon: 'flag'
};
/* ---- V.V.: grey crop top, black leather, vintage mic on a cord ---- */
KITS.vv = {
  id: 'vv', name: 'V.V.', kind: 'hero', h: 64, skin: SKIN.light,
  b: { s: 0.97, hipY: 33, torso: 18.5, shW: 19.5, hipW: 12.5, headR: 6.9, headY: 9.8, legU: 15, legL: 15, armU: 10.8, armL: 10.3, hand: 2.4 },
  pal: {
    top: pal(0x9aa1ab, 0xc8ced7, 0x666b76), leather: pal(0x2a2431, 0x483f57, 0x15111d),
    belt: pal(0x342c3a, 0x4c4254, 0x1d1824), shoe: pal(0xeae8e2, 0xffffff, 0xa8a49c),
    hair: pal(0x704426, 0xa86c34, 0x442512), gold: pal(0xe8b93a, 0xffdc72, 0xa87c18),
    mic: pal(0xd6dbe4, 0xf4f7fb, 0x98a0b0), cord: pal(0x8a2a2a, 0xb03a3a, 0x5a1a1a),
    lip: pal(0x9c2f3a, 0xc4505a, 0x6c1a22)
  },
  face: 'lips', hair: 'long', weapon: 'mic'
};
/* ---- Johnny $: denim, white tee, ripped jeans, giant salami ---- */
KITS.johnny = {
  id: 'johnny', name: 'Johnny $', kind: 'hero', h: 71, skin: SKIN.dark,
  b: { s: 1.07, hipY: 35, torso: 20.5, shW: 25, hipW: 15.5, headR: 7.3, headY: 10.8, legU: 16, legL: 16, armU: 12.2, armL: 11.6, hand: 2.8 },
  pal: {
    denim: pal(0x4a72a8, 0x6d94c6, 0x2e4d78), denimLt: pal(0x8faacb, 0xb4cce2, 0x64809f),
    tee: pal(0xecebe6, 0xffffff, 0xb9b8b2), skinD: SKIN.dark, beard: pal(0x211711, 0x33241a, 0x120c08),
    hair: pal(0x1a1210, 0x2a1e18, 0x0d0806), gold: pal(0xe8b93a, 0xffdc72, 0xa87c18),
    shoe: pal(0xe9e8e2, 0xffffff, 0xb5b4ae), salami: pal(0x9c3d2b, 0xbc5a40, 0x742818),
    speck: pal(0xe8c9a8, 0xf6e2c8, 0xc0a084)
  },
  face: 'beard', hair: 'crop', weapon: 'salami'
};

/* ---- enemies ---- */
function enemyKit(id, name, base, opts) {
  KITS[id] = Object.assign({
    id: id, name: name, kind: 'enemy', h: 62, skin: SKIN.mid,
    b: { s: .93, hipY: 33, torso: 18, shW: 21, hipW: 13, headR: 6.7, headY: 9.6, legU: 15, legL: 15, armU: 10.8, armL: 10.4, hand: 2.5 },
    pal: {}, face: 'plain', hair: 'short', weapon: 'baton'
  }, base, opts || {});
}
enemyKit('jooce', 'Jooce', {
  h: 60, skin: SKIN.mid, face: 'box',
  pal: {
    suit: pal(0x384a6c, 0x50648e, 0x22304a), shirt: pal(0xe6e2d4, 0xfffbf0, 0xb5b0a2),
    box: pal(0xe07a2a, 0xf79c4a, 0xa8541a), straw: pal(0xf2ead0, 0xffffff, 0xbcb298),
    shoe: pal(0x241f28, 0x362f3c, 0x120f16), hair: pal(0x1a1418, 0x2a2228, 0x0e0a0e),
    tie: pal(0xb03030, 0xd24a4a, 0x7a1c1c)
  }
}, { weapon: 'baton' });
enemyKit('hobo', 'Street Hobo', {
  h: 63, face: 'stubble', hair: 'beanie', weapon: 'bottle',
  pal: {
    coat: pal(0x5e5a3c, 0x7b7650, 0x403c26), shirt: pal(0x8a7f66, 0xa89c80, 0x635a46),
    pants: pal(0x3e3a30, 0x565044, 0x27241c), shoe: pal(0x40342a, 0x584838, 0x241c16),
    hat: pal(0x8a3a2e, 0xa85040, 0x5c241c), hair: pal(0x4a4438, 0x625a4a, 0x2e2a22),
    glass: pal(0x6a8a4a, 0x9ab06a, 0x445c30)
  }
}, { b: { s: .94, hipY: 33, torso: 17.5, shW: 18, hipW: 11, headR: 6.4, headY: 9.2, legU: 15, legL: 15, armU: 11, armL: 10.5, hand: 3.2 } });
enemyKit('turd', 'Turd', {
  h: 63, face: 'bandana',
  pal: {
    vest: pal(0x6a4a2e, 0x86603f, 0x4a2f1c), shirt: pal(0xb9a271, 0xd2bc88, 0x8e7a50),
    pants: pal(0x3a4a3a, 0x50644e, 0x26321f), boot: pal(0x2a241c, 0x3e362a, 0x171310),
    hat: pal(0x7a4a24, 0x9c6434, 0x542f14), hair: pal(0x241a12, 0x36261a, 0x140d08),
    band: pal(0xc23a2a, 0xe25a44, 0x8a2216)
  }
}, { b: { s: .99, hipY: 31, torso: 17.5, shW: 21, hipW: 12.5, headR: 6.2, headY: 9, legU: 14, legL: 14, armU: 10.5, armL: 10, hand: 3.2 } });
enemyKit('heavy', 'Big Business', {
  h: 68, face: 'jowls', hair: 'bald',
  pal: {
    suit: pal(0x474b5a, 0x60657c, 0x2b2f3c), shirt: pal(0xe8e6dc, 0xffffff, 0xb8b6ac),
    pants: pal(0x2e313c, 0x424858, 0x1b1d26), shoe: pal(0x1c1a20, 0x2c2a34, 0x0e0d12),
    tie: pal(0x8a2a2a, 0xaa3a3a, 0x5a1818), hair: pal(0x3a3230, 0x4e4442, 0x241e1c),
    case: pal(0x5a3a24, 0x76502f, 0x3a2416)
  }
}, { b: { s: 1.05, hipY: 33, torso: 19, shW: 25, hipW: 17, headR: 7.2, headY: 9.4, legU: 15, legL: 15, armU: 11, armL: 10.5, hand: 3.4 } });
enemyKit('ledger', 'The Ledger', {
  h: 68, face: 'glasses', hair: 'slick', weapon: 'book',
  pal: {
    suit: pal(0x2f5c3a, 0x467a50, 0x1d3a24), shirt: pal(0xe4e6d8, 0xfffff2, 0xb2b4a6),
    pants: pal(0x264a30, 0x386040, 0x16301c), shoe: pal(0x241c1a, 0x362a26, 0x120d0c),
    tie: pal(0xd8b430, 0xf0d462, 0x9a7c18), hair: pal(0x1e1a18, 0x302824, 0x100c0a),
    book: pal(0x7a2a2a, 0x9c3a3a, 0x4c1616), paper: pal(0xe8e0c8, 0xfffbe8, 0xbcb298)
  }
}, { b: { s: 1.02, hipY: 33, torso: 19, shW: 21, hipW: 13, headR: 6.9, headY: 9.6, legU: 15, legL: 15, armU: 11, armL: 10.5, hand: 3.3 } });
enemyKit('bigtony', 'Big Tony', {
  h: 73, face: 'jowls', hair: 'flat', weapon: 'case',
  pal: {
    suit: pal(0x6a2430, 0x8a3442, 0x45141e), shirt: pal(0x1c1620, 0x2e2634, 0x0e0a12),
    pants: pal(0x341824, 0x4a2432, 0x200e16), shoe: pal(0x1a1418, 0x2a2028, 0x0c080c),
    tie: pal(0xd8b430, 0xf0d462, 0x9a7c18), hair: pal(0x1a1412, 0x2a201c, 0x0c0806),
    case: pal(0x3c3a44, 0x54525e, 0x24222a), gold: pal(0xe8b93a, 0xffdc72, 0xa87c18)
  }
}, { b: { s: 1.14, hipY: 35, torso: 20.5, shW: 27, hipW: 18, headR: 7.4, headY: 10, legU: 16, legL: 16, armU: 12, armL: 11.5, hand: 3.6 } });
enemyKit('mara', 'Dusty Mara', {
  h: 65, skin: SKIN.light, face: 'lips', hair: 'long', weapon: 'mic',
  pal: {
    top: pal(0x6a3a56, 0x8a5072, 0x482438), leather: pal(0x2a2430, 0x403a48, 0x16121c),
    belt: pal(0x3c3040, 0x544458, 0x221a26), shoe: pal(0x24202a, 0x36303c, 0x131018),
    hair: pal(0x8a2a48, 0xb04464, 0x5c162c), gold: pal(0xe8b93a, 0xffdc72, 0xa87c18),
    mic: pal(0xc8b0d0, 0xe8daf0, 0x8a7494), cord: pal(0x6a2a4a, 0x8a3a62, 0x42162c),
    lip: pal(0xb02a3a, 0xd44a5a, 0x7c1624)
  }
}, { b: { s: .97, hipY: 32, torso: 18.5, shW: 16.5, hipW: 10.5, headR: 6.4, headY: 9.6, legU: 14.5, legL: 14.5, armU: 10.5, armL: 10, hand: 3 } });
enemyKit('auditor', 'The Auditor', {
  h: 72, face: 'glasses', hair: 'slick', weapon: 'baton',
  pal: {
    suit: pal(0x24222a, 0x3a3742, 0x121016), shirt: pal(0xd8b430, 0xf4d462, 0x9a7c18),
    pants: pal(0x1c1a22, 0x2c2a34, 0x0c0a10), shoe: pal(0x0e0c10, 0x1c1a20, 0x060406),
    tie: pal(0x0e0c10, 0x1c1a20, 0x060406), hair: pal(0x14100e, 0x221c18, 0x080606),
    gold: pal(0xe8b93a, 0xffdc72, 0xa87c18), glow: pal(0xf0e6a0, 0xfffce0, 0xb0a060)
  }
}, { b: { s: 1.1, hipY: 34, torso: 20, shW: 24, hipW: 14, headR: 7.1, headY: 9.8, legU: 15.5, legL: 15.5, armU: 11.5, armL: 11, hand: 3.4 } });
Art.KITS = KITS;
Art.trim = trim;
Art.portrait = portrait;
Art.HEROES = ['ricky', 'vv', 'johnny'];
Art.ENEMIES = ['jooce', 'hobo', 'turd', 'heavy', 'ledger', 'bigtony', 'mara', 'auditor'];

/* ---------------- poses ----------------
   angle convention: 0 = straight down, + = forward (facing +x). f=front/near
   limb, b=back/far. wpn = weapon angle in degrees from +x (0 = forward). */
const BASE = { lean: 1, dx: 0, dy: 0, rot: 0, head: 0, hf: 13, kf: 7, hb: -13, kb: -5, sf: -9, ef: -7, sb: 9, eb: 7, wpn: -78, wbehind: 0, hairSway: 0 };
const p = (o) => Object.assign({}, BASE, o);

const POSE = {};
POSE.idle = [
  p({}),
  p({ dy: .5, lean: 1.6, sf: -11, ef: -9, sb: 10, eb: 8, head: .5 }),
  p({ dy: .2, lean: 1.2, sf: -8, ef: -6, sb: 8, eb: 6, wpn: -76 }),
  p({ dy: .7, lean: 2, sf: -12, ef: -10, sb: 11, eb: 9, head: -1 })
];
POSE.walk = [
  p({ hf: 25, kf: 17, hb: -23, kb: -16, sf: -21, ef: -13, sb: 18, eb: 11, lean: 2, wpn: -70 }),
  p({ hf: 19, kf: 11, hb: -15, kb: -32, sf: -15, ef: -9, sb: 13, eb: 8, lean: 3, dy: 1.3, wpn: -72 }),
  p({ hf: 7, kf: 1, hb: -5, kb: -38, sf: -7, ef: -4, sb: 6, eb: 4, lean: 2.5, dy: -.4, wpn: -76 }),
  p({ hf: -5, kf: -10, hb: 9, kb: -14, sf: 4, ef: 2, sb: -5, eb: -3, lean: 1.5, dy: -1.2, wpn: -80 }),
  p({ hf: -17, kf: -15, hb: 21, kb: 7, sf: 16, ef: 10, sb: -17, eb: -11, lean: 1.5, wpn: -84 }),
  p({ hf: -9, kf: -27, hb: 17, kb: 13, sf: 12, ef: 7, sb: -13, eb: -8, lean: 2.5, dy: 1.2, wpn: -82 }),
  p({ hf: 3, kf: -5, hb: 5, kb: 1, sf: -2, ef: -1, sb: 3, eb: 2, lean: 2.5, dy: -.3, wpn: -78 }),
  p({ hf: 15, kf: 7, hb: -7, kb: -12, sf: -13, ef: -8, sb: 11, eb: 7, lean: 2, dy: -1, wpn: -74 })
];
POSE.turn = [p({ hf: 8, kf: 3, hb: -8, kb: -4, sf: -4, ef: -2, sb: 4, eb: 3, lean: 0, head: 6 }), p({ hf: 12, kf: 6, hb: -12, kb: -6, sf: -8, ef: -6, sb: 8, eb: 6, head: 3 })];
POSE.a1 = [
  p({ lean: -8, hf: 15, kf: 8, hb: -15, kb: -6, sf: -46, ef: -104, sb: 16, eb: 12, wpn: -150, head: 2 }),
  p({ lean: 11, dx: 2, hf: 21, kf: 11, hb: -19, kb: -12, sf: 84, ef: 90, sb: -24, eb: -18, wpn: 2 }),
  p({ lean: 9, dx: 2, hf: 20, kf: 11, hb: -18, kb: -11, sf: 76, ef: 74, sb: -16, eb: -12, wpn: 8 }),
  p({ lean: 3, hf: 16, kf: 8, hb: -16, kb: -6, sf: 38, ef: 28, sb: -4, eb: -2, wpn: -34 })
];
POSE.a2 = [
  p({ lean: -5, hf: 14, kf: 7, hb: -14, kb: -6, sf: 34, ef: 124, sb: 12, eb: 8, wpn: -128 }),
  p({ lean: 13, dx: 3, hf: 24, kf: 13, hb: -21, kb: -14, sf: 104, ef: 58, sb: -28, eb: -20, wpn: 48 }),
  p({ lean: 11, dx: 3, hf: 23, kf: 13, hb: -20, kb: -13, sf: 92, ef: 36, sb: -20, eb: -14, wpn: 62 }),
  p({ lean: 4, hf: 16, kf: 8, hb: -16, kb: -7, sf: 42, ef: 22, sb: -6, eb: -4, wpn: -14 })
];
POSE.a3 = [
  p({ lean: -14, hf: 17, kf: 10, hb: -18, kb: -8, sf: 152, ef: 164, sb: -18, eb: -24, wpn: -164, head: -7, dy: 1 }),
  p({ lean: -19, hf: 18, kf: 11, hb: -19, kb: -9, sf: 154, ef: 202, sb: -22, eb: -30, wpn: -196, head: -9, dy: 2 }),
  p({ lean: 27, dx: 4, hf: 27, kf: 15, hb: -25, kb: -18, sf: 56, ef: 8, sb: -36, eb: -26, wpn: 58, head: 8 }),
  p({ lean: 24, dx: 4, hf: 26, kf: 15, hb: -24, kb: -17, sf: 46, ef: 4, sb: -30, eb: -22, wpn: 70, head: 7 }),
  p({ lean: 8, hf: 18, kf: 9, hb: -18, kb: -7, sf: 22, ef: -10, sb: -4, eb: -4, wpn: -22 })
];
POSE.jump = [
  p({ hf: 42, kf: -46, hb: 24, kb: -66, sf: 26, ef: -12, sb: -18, eb: -30, lean: 4, wpn: -60 }),
  p({ hf: 30, kf: -30, hb: 14, kb: -52, sf: 40, ef: -6, sb: -24, eb: -34, lean: 6, wpn: -50 }),
  p({ hf: 20, kf: -16, hb: 6, kb: -36, sf: 30, ef: -20, sb: -16, eb: -28, lean: 8, wpn: -64 })
];
POSE.jatk = [
  p({ hf: 36, kf: -34, hb: 18, kb: -58, lean: 12, sf: 108, ef: 118, sb: -30, eb: -22, wpn: 24 }),
  p({ hf: 30, kf: -26, hb: 12, kb: -50, lean: 14, sf: 116, ef: 124, sb: -26, eb: -18, wpn: 30 }),
  p({ hf: 26, kf: -20, hb: 8, kb: -44, lean: 10, sf: 100, ef: 96, sb: -20, eb: -14, wpn: 14 })
];
POSE.jdown = [
  p({ hf: 30, kf: -20, hb: 10, kb: -40, lean: 42, sf: 96, ef: 104, sb: -40, eb: -30, wpn: 60, head: 10 }),
  p({ hf: 34, kf: -16, hb: 6, kb: -46, lean: 52, sf: 104, ef: 112, sb: -46, eb: -34, wpn: 72, head: 12 })
];
POSE.land = [
  p({ dy: 7, hf: 22, kf: 30, hb: -22, kb: 14, lean: 12, sf: 20, ef: -24, sb: -14, eb: -24, head: 6 }),
  p({ dy: 3, hf: 17, kf: 16, hb: -17, kb: -2, lean: 4, sf: -2, ef: -10, sb: 2, eb: -2, head: 2 })
];
POSE.grab = [
  p({ lean: 5, hf: 17, kf: 9, hb: -19, kb: -4, sf: 66, ef: 76, sb: 32, eb: 62, wpn: -100 }),
  p({ lean: 7, hf: 18, kf: 10, hb: -20, kb: -4, sf: 71, ef: 80, sb: 34, eb: 66, wpn: -96 })
];
POSE.gstrike = [
  p({ lean: 3, hf: 16, kf: 8, hb: -16, kb: -4, sf: 22, ef: 128, sb: 30, eb: 60, wpn: -108 }),
  p({ lean: 16, hf: 46, kf: 74, hb: -14, kb: -6, sf: 52, ef: 44, sb: 24, eb: 54, wpn: -96, head: 6 }),
  p({ lean: 10, hf: 28, kf: 32, hb: -16, kb: -4, sf: 44, ef: 40, sb: 22, eb: 52, wpn: -100, head: 3 })
];
POSE.throw = [
  p({ lean: -8, hf: 16, kf: 8, hb: -18, kb: -4, sf: 30, ef: 118, sb: 26, eb: 112, wpn: -110 }),
  p({ lean: 12, hf: 22, kf: 12, hb: -20, kb: -12, sf: 96, ef: 40, sb: 92, eb: 34, wpn: -40 }),
  p({ lean: 6, hf: 18, kf: 9, hb: -18, kb: -6, sf: 58, ef: 20, sb: 54, eb: 16, wpn: -60 })
];
POSE.special = [
  p({ lean: -6, hf: 20, kf: 12, hb: -20, kb: -8, sf: 30, ef: 138, sb: -26, eb: -40, wpn: -138, head: -4 }),
  p({ lean: 8, dx: 2, hf: 24, kf: 14, hb: -22, kb: -12, sf: 112, ef: 96, sb: -40, eb: -46, wpn: 30 }),
  p({ lean: 16, dx: 4, hf: 30, kf: 18, hb: -26, kb: -16, sf: 96, ef: 40, sb: -34, eb: -30, wpn: 92, head: 6 }),
  p({ lean: 2, hf: 22, kf: 12, hb: -22, kb: -8, sf: 44, ef: 130, sb: -20, eb: -36, wpn: -120, head: -2 }),
  p({ lean: 12, dx: 2, hf: 26, kf: 15, hb: -24, kb: -12, sf: 120, ef: 70, sb: -36, eb: -24, wpn: 50 }),
  p({ lean: 8, hf: 22, kf: 12, hb: -22, kb: -10, sf: 92, ef: 54, sb: -24, eb: -18, wpn: 74 })
];
POSE.hurt = [
  p({ lean: -22, dx: -2, hf: 6, kf: 2, hb: -18, kb: -10, sf: -34, ef: -20, sb: -20, eb: -30, head: -12, wpn: -120 }),
  p({ lean: -13, dx: -1, hf: 10, kf: 5, hb: -16, kb: -8, sf: -18, ef: -8, sb: -10, eb: -18, head: -7, wpn: -104 })
];
POSE.knock = [
  p({ rot: -42, lean: -6, hf: 26, kf: 10, hb: -8, kb: -24, sf: -50, ef: -30, sb: -60, eb: -44, head: -10, wpn: -140, dy: 14 }),
  p({ rot: -74, lean: -2, hf: 22, kf: 6, hb: -6, kb: -20, sf: -60, ef: -40, sb: -66, eb: -50, head: -6, wpn: -150, dy: 22 })
];
POSE.down = [
  p({ rot: -90, dy: 24, lean: 0, hf: 14, kf: 6, hb: -2, kb: -10, sf: -20, ef: -34, sb: -26, eb: -40, head: 0, wpn: -160 }),
  p({ rot: -90, dy: 23, lean: 0, hf: 10, kf: 2, hb: -6, kb: -14, sf: -14, ef: -26, sb: -20, eb: -32, head: 2, wpn: -158 })
];
POSE.getup = [
  p({ rot: -66, dy: 20, lean: 10, hf: 30, kf: 44, hb: -10, kb: -30, sf: 40, ef: 60, sb: 10, eb: 20, head: -4, wpn: -120 }),
  p({ rot: -32, dy: 10, lean: 18, hf: 34, kf: 52, hb: -18, kb: -22, sf: 26, ef: 30, sb: 8, eb: 12, head: -2, wpn: -100 }),
  p({ rot: -8, dy: 3, lean: 8, hf: 22, kf: 22, hb: -20, kb: -8, sf: 4, ef: -6, sb: 4, eb: -2, head: 0, wpn: -84 })
];
POSE.dead = [
  p({ rot: -90, dy: 24, lean: -2, hf: 12, kf: 4, hb: -4, kb: -12, sf: -30, ef: -50, sb: -36, eb: -56, head: -6, wpn: -170 }),
  p({ rot: -90, dy: 24, lean: -2, hf: 12, kf: 4, hb: -4, kb: -12, sf: -32, ef: -52, sb: -38, eb: -58, head: -6, wpn: -170 })
];
POSE.win = [
  p({ lean: -4, hf: 14, kf: 6, hb: -14, kb: -6, sf: 160, ef: 168, sb: 20, eb: 30, wpn: -170, head: -8, dy: 0 }),
  p({ lean: -3, hf: 14, kf: 7, hb: -14, kb: -5, sf: 150, ef: 158, sb: 26, eb: 36, wpn: -160, head: -6, dy: 2 }),
  p({ lean: -5, hf: 15, kf: 6, hb: -15, kb: -7, sf: 162, ef: 172, sb: 22, eb: 32, wpn: -172, head: -9, dy: 0 }),
  p({ lean: -2, hf: 13, kf: 6, hb: -13, kb: -5, sf: 154, ef: 164, sb: 18, eb: 28, wpn: -166, head: -5, dy: 3 })
];
POSE.held = [p({ lean: -14, hf: 8, kf: 4, hb: -16, kb: -8, sf: -30, ef: -46, sb: -20, eb: -36, head: -6, wpn: -110 })];
POSE.tired = [p({ lean: 18, dy: 3, hf: 18, kf: 20, hb: -18, kb: 4, sf: 26, ef: -20, sb: 20, eb: -16, head: 12, wpn: -40 })];
POSE.run = [
  p({ hf: 34, kf: 26, hb: -30, kb: -40, sf: -34, ef: -50, sb: 30, eb: 14, lean: 12, wpn: -90 }),
  p({ hf: 16, kf: 4, hb: -14, kb: -60, sf: -20, ef: -30, sb: 22, eb: 8, lean: 14, dy: 1.5, wpn: -86 }),
  p({ hf: -18, kf: -30, hb: 30, kb: 10, sf: 24, ef: 8, sb: -26, eb: -42, lean: 13, wpn: -80 }),
  p({ hf: 4, kf: -8, hb: 8, kb: -22, sf: 6, ef: -4, sb: -8, eb: -20, lean: 12, dy: -1.5, wpn: -84 })
];
POSE.spawn = [p({ hf: 8, kf: 3, hb: -8, kb: -4, sf: -4, ef: -2, sb: 4, eb: 3 })];

const ANIMS = {
  hero: ['idle', 'walk', 'turn', 'a1', 'a2', 'a3', 'jump', 'jatk', 'jdown', 'land', 'grab', 'gstrike', 'throw', 'special', 'hurt', 'knock', 'down', 'getup', 'dead', 'win', 'held', 'tired'],
  enemy: ['idle', 'walk', 'run', 'a1', 'a2', 'hurt', 'knock', 'down', 'getup', 'dead', 'held', 'win', 'spawn']
};
const TIMING = {
  idle: [14, 12, 14, 12], walk: [7, 6, 7, 6, 7, 6, 7, 6], turn: [5, 5],
  a1: [5, 3, 5, 7], a2: [6, 3, 5, 7], a3: [7, 4, 4, 6, 9],
  jump: [10, 10, 8], jatk: [5, 5, 5], jdown: [5, 12], land: [4, 5],
  grab: [8, 8], gstrike: [4, 4, 6], throw: [5, 4, 8],
  special: [6, 6, 6, 6, 6, 6], hurt: [6, 7], knock: [10, 10], down: [22, 22],
  getup: [5, 6, 6], dead: [30, 30], win: [12, 12, 12, 14], held: [30], run: [5, 5, 5, 5], spawn: [10], tired: [10]
};
Art.POSE = POSE; Art.TIMING = TIMING; Art.ANIMS = ANIMS;

/* per-hero tweaks to the shared pose library: distinct weapon choreography */
const HERO_MOVES = {
  ricky: {   /* pole: long thrusts, wide sweeps, flag held high */
    a1: [p({ lean: -7, hf: 15, kf: 8, hb: -15, kb: -6, sf: -54, ef: -118, sb: 14, eb: 10, wpn: -166 }),
      p({ lean: 12, dx: 3, hf: 22, kf: 11, hb: -20, kb: -13, sf: 92, ef: 94, sb: -22, eb: -16, wpn: -2 }),
      p({ lean: 10, dx: 3, hf: 21, kf: 11, hb: -19, kb: -12, sf: 84, ef: 80, sb: -14, eb: -10, wpn: 2 }),
      p({ lean: 3, hf: 16, kf: 8, hb: -16, kb: -6, sf: 36, ef: 26, sb: -4, eb: -2, wpn: -40 })],
    a2: [p({ lean: -4, hf: 14, kf: 7, hb: -14, kb: -6, sf: 22, ef: 150, sb: 10, eb: 4, wpn: -150 }),
      p({ lean: 14, dx: 3, hf: 25, kf: 14, hb: -22, kb: -14, sf: 118, ef: 44, sb: -26, eb: -18, wpn: 66 }),
      p({ lean: 12, dx: 3, hf: 24, kf: 14, hb: -21, kb: -13, sf: 104, ef: 24, sb: -18, eb: -12, wpn: 78 }),
      p({ lean: 4, hf: 16, kf: 8, hb: -16, kb: -7, sf: 40, ef: 16, sb: -6, eb: -4, wpn: -20 })],
    a3: [p({ lean: -16, hf: 18, kf: 11, hb: -19, kb: -9, sf: 146, ef: 178, sb: -20, eb: -26, wpn: -178, head: -8, dy: 1 }),
      p({ lean: -21, hf: 19, kf: 12, hb: -20, kb: -10, sf: 150, ef: 214, sb: -24, eb: -32, wpn: -206, head: -10, dy: 2 }),
      p({ lean: 30, dx: 5, hf: 30, kf: 17, hb: -27, kb: -20, sf: 66, ef: 12, sb: -34, eb: -24, wpn: 64, head: 9 }),
      p({ lean: 26, dx: 5, hf: 29, kf: 17, hb: -26, kb: -19, sf: 54, ef: 6, sb: -28, eb: -20, wpn: 74, head: 8 }),
      p({ lean: 8, hf: 18, kf: 9, hb: -18, kb: -7, sf: 22, ef: -12, sb: -4, eb: -4, wpn: -26 })],
    special: [p({ lean: -8, hf: 22, kf: 13, hb: -22, kb: -9, sf: 18, ef: 156, sb: -30, eb: -44, wpn: -156, head: -6 }),
      p({ lean: 10, dx: 2, hf: 26, kf: 15, hb: -24, kb: -13, sf: 128, ef: 84, sb: -44, eb: -50, wpn: 22 }),
      p({ lean: 18, dx: 4, hf: 32, kf: 19, hb: -28, kb: -17, sf: 104, ef: 30, sb: -38, eb: -32, wpn: 86, head: 7 }),
      p({ lean: -2, hf: 24, kf: 13, hb: -24, kb: -9, sf: 30, ef: 150, sb: -22, eb: -38, wpn: -138, head: -4 }),
      p({ lean: 14, dx: 2, hf: 28, kf: 16, hb: -26, kb: -13, sf: 132, ef: 58, sb: -40, eb: -26, wpn: 44 }),
      p({ lean: 9, hf: 24, kf: 13, hb: -24, kb: -11, sf: 98, ef: 44, sb: -26, eb: -20, wpn: 68 })]
  },
  vv: {      /* mic: short jabs, whipping cord sweep, spinning drop */
    a1: [p({ lean: -6, hf: 15, kf: 8, hb: -15, kb: -6, sf: -40, ef: -90, sb: 18, eb: 14, wpn: -130 }),
      p({ lean: 9, dx: 2, hf: 22, kf: 12, hb: -20, kb: -13, sf: 96, ef: 86, sb: -22, eb: -16, wpn: 10 }),
      p({ lean: 8, dx: 2, hf: 21, kf: 11, hb: -19, kb: -12, sf: 86, ef: 70, sb: -14, eb: -10, wpn: 16 }),
      p({ lean: 3, hf: 16, kf: 8, hb: -16, kb: -6, sf: 34, ef: 22, sb: -4, eb: -2, wpn: -30 })],
    a2: [p({ lean: -6, hf: 14, kf: 7, hb: -14, kb: -6, sf: 40, ef: 140, sb: 14, eb: 10, wpn: -142 }),
      p({ lean: 12, dx: 3, hf: 24, kf: 14, hb: -22, kb: -15, sf: 116, ef: 40, sb: -30, eb: -22, wpn: 62 }),
      p({ lean: 10, dx: 3, hf: 23, kf: 13, hb: -21, kb: -14, sf: 100, ef: 22, sb: -20, eb: -14, wpn: 78 }),
      p({ lean: 4, hf: 16, kf: 8, hb: -16, kb: -7, sf: 38, ef: 18, sb: -6, eb: -4, wpn: -16 })],
    a3: [p({ lean: -12, hf: 16, kf: 10, hb: -18, kb: -8, sf: 140, ef: 184, sb: -18, eb: -24, wpn: -168, head: -6, dy: 1 }),
      p({ lean: -16, hf: 18, kf: 11, hb: -19, kb: -9, sf: 148, ef: 216, sb: -22, eb: -30, wpn: -196, head: -8, dy: 2 }),
      p({ lean: 24, dx: 4, hf: 28, kf: 16, hb: -26, kb: -19, sf: 62, ef: 6, sb: -32, eb: -22, wpn: 42, head: 7 }),
      p({ lean: 22, dx: 4, hf: 27, kf: 16, hb: -25, kb: -18, sf: 52, ef: 2, sb: -28, eb: -20, wpn: 54, head: 6 }),
      p({ lean: 7, hf: 18, kf: 9, hb: -18, kb: -7, sf: 20, ef: -12, sb: -4, eb: -4, wpn: -24 })],
    special: [p({ lean: -9, hf: 24, kf: 14, hb: -24, kb: -10, sf: 40, ef: 170, sb: -34, eb: -46, wpn: -170, head: -7 }),
      p({ lean: 6, dx: 2, hf: 28, kf: 16, hb: -26, kb: -14, sf: 130, ef: 110, sb: -48, eb: -52, wpn: -10 }),
      p({ lean: 20, dx: 5, hf: 34, kf: 20, hb: -30, kb: -18, sf: 118, ef: 24, sb: -40, eb: -34, wpn: 96, head: 8 }),
      p({ lean: 0, hf: 26, kf: 14, hb: -26, kb: -10, sf: 24, ef: 164, sb: -24, eb: -40, wpn: -148, head: -5 }),
      p({ lean: 16, dx: 3, hf: 30, kf: 17, hb: -28, kb: -14, sf: 140, ef: 46, sb: -42, eb: -28, wpn: 38 }),
      p({ lean: 10, hf: 26, kf: 14, hb: -26, kb: -12, sf: 104, ef: 40, sb: -28, eb: -22, wpn: 60 })]
  },
  johnny: {  /* salami: two-handed baseball swings, huge overhead slam */
    a1: [p({ lean: -9, hf: 15, kf: 8, hb: -16, kb: -6, sf: -30, ef: -104, sb: 24, eb: 68, wpn: -150, head: 2 }),
      p({ lean: 11, dx: 2, hf: 22, kf: 12, hb: -20, kb: -13, sf: 78, ef: 88, sb: 54, eb: 84, wpn: 4 }),
      p({ lean: 9, dx: 2, hf: 21, kf: 11, hb: -19, kb: -12, sf: 70, ef: 70, sb: 48, eb: 78, wpn: 10 }),
      p({ lean: 3, hf: 16, kf: 8, hb: -16, kb: -6, sf: 34, ef: 30, sb: 22, eb: 48, wpn: -38 })],
    a2: [p({ lean: -6, hf: 14, kf: 7, hb: -14, kb: -6, sf: 26, ef: 132, sb: 6, eb: 96, wpn: -140 }),
      p({ lean: 15, dx: 3, hf: 25, kf: 14, hb: -23, kb: -16, sf: 108, ef: 46, sb: 44, eb: 96, wpn: 56 }),
      p({ lean: 13, dx: 3, hf: 24, kf: 14, hb: -22, kb: -15, sf: 96, ef: 28, sb: 38, eb: 88, wpn: 70 }),
      p({ lean: 5, hf: 16, kf: 8, hb: -16, kb: -7, sf: 40, ef: 20, sb: 18, eb: 40, wpn: -18 })],
    a3: [p({ lean: -18, hf: 17, kf: 10, hb: -19, kb: -9, sf: 156, ef: 176, sb: 40, eb: 104, wpn: -176, head: -8, dy: 1 }),
      p({ lean: -24, hf: 19, kf: 12, hb: -20, kb: -10, sf: 158, ef: 212, sb: 44, eb: 118, wpn: -206, head: -11, dy: 3 }),
      p({ lean: 32, dx: 5, hf: 30, kf: 18, hb: -28, kb: -20, sf: 58, ef: 4, sb: -8, eb: 40, wpn: 62, head: 10 }),
      p({ lean: 28, dx: 5, hf: 29, kf: 18, hb: -27, kb: -19, sf: 48, ef: 2, sb: -12, eb: 34, wpn: 72, head: 9 }),
      p({ lean: 9, hf: 18, kf: 9, hb: -18, kb: -7, sf: 20, ef: -10, sb: 12, eb: 26, wpn: -22 })],
    special: [p({ lean: -10, hf: 26, kf: 15, hb: -26, kb: -11, sf: 10, ef: 170, sb: 30, eb: 110, wpn: -168, head: -7 }),
      p({ lean: 12, dx: 3, hf: 30, kf: 17, hb: -28, kb: -15, sf: 136, ef: 96, sb: 52, eb: 116, wpn: 10 }),
      p({ lean: 24, dx: 6, hf: 36, kf: 22, hb: -32, kb: -19, sf: 112, ef: 18, sb: 20, eb: 76, wpn: 92, head: 9 }),
      p({ lean: -4, hf: 28, kf: 15, hb: -28, kb: -11, sf: 20, ef: 168, sb: 34, eb: 112, wpn: -152, head: -6 }),
      p({ lean: 18, dx: 3, hf: 32, kf: 18, hb: -30, kb: -15, sf: 140, ef: 54, sb: 56, eb: 104, wpn: 40 }),
      p({ lean: 11, hf: 28, kf: 15, hb: -28, kb: -13, sf: 106, ef: 44, sb: 40, eb: 92, wpn: 64 })]
  }
};
Art.posesFor = function (kit) {
  const style = kit.kind === 'hero' ? HERO_MOVES[kit.id] : null;
  const out = {};
  const list = kit.kind === 'hero' ? ANIMS.hero : ANIMS.enemy;
  list.forEach(a => { out[a] = (style && style[a]) || POSE[a] || POSE.idle; });
  /* enemies share the shared attack poses with swapped weapon styling */
  return out;
};

/* ---------------- body construction ---------------- */
function solve(kit, P) {
  const b = kit.b, s = b.s;
  const hip = { x: P.dx * s, y: -b.hipY * s + P.dy * s };
  const lean = P.lean * Math.PI / 180;
  const upx = Math.sin(lean), upy = -Math.cos(lean);
  const sh = { x: hip.x + upx * b.torso * s, y: hip.y + upy * b.torso * s };
  const hd = lean + P.head * Math.PI / 180;
  const head = { x: sh.x + Math.sin(hd) * b.headY * s, y: sh.y - Math.cos(hd) * b.headY * s };
  const arm = (ang, o) => {
    const a = ang * Math.PI / 180;
    const ex = sh.x + Math.sin(a) * b.armU * s, ey = sh.y + Math.cos(a) * b.armU * s;
    const bb = o * Math.PI / 180;
    const hx = ex + Math.sin(bb) * b.armL * s, hy = ey + Math.cos(bb) * b.armL * s;
    return { el: { x: ex, y: ey }, ha: { x: hx, y: hy } };
  };
  const perp = { x: Math.cos(lean), y: Math.sin(lean) };
  const off = b.shW * .30 * s;
  const armAt = (ang, o, side) => {
    const sx = sh.x + perp.x * off * side, sy = sh.y + perp.y * off * side;
    const a = ang * Math.PI / 180;
    const ex = sx + Math.sin(a) * b.armU * s, ey = sy + Math.cos(a) * b.armU * s;
    const bb = o * Math.PI / 180;
    const hx = ex + Math.sin(bb) * b.armL * s, hy = ey + Math.cos(bb) * b.armL * s;
    return { sh: { x: sx, y: sy }, el: { x: ex, y: ey }, ha: { x: hx, y: hy } };
  };
  const armF = armAt(P.sf, P.ef, 1), armB = armAt(P.sb, P.eb, -1);
  const legAt = (ang, kn, side) => {
    const hx = hip.x + perp.x * 2.2 * s * side, hy = hip.y + perp.y * 2.2 * s * side;
    const a = ang * Math.PI / 180;
    const kx = hx + Math.sin(a) * b.legU * s, ky = hy + Math.cos(a) * b.legU * s;
    const bb = kn * Math.PI / 180;
    const ax = kx + Math.sin(bb) * b.legL * s, ay = ky + Math.cos(bb) * b.legL * s;
    return { hip: { x: hx, y: hy }, kn: { x: kx, y: ky }, an: { x: ax, y: ay } };
  };
  const J = { hip: hip, sh: sh, head: head, armF: armF, armB: armB, legF: legAt(P.hf, P.kf, 1), legB: legAt(P.hb, P.kb, -1), lean: P.lean };
  /* move from feet-origin space into the frame cell */
  const shift = (o) => { o.x += AX; o.y += AY; return o; };
  ['hip', 'sh', 'head'].forEach(k => shift(J[k]));
  ['armF', 'armB'].forEach(k => { shift(J[k].sh); shift(J[k].el); shift(J[k].ha); });
  ['legF', 'legB'].forEach(k => { shift(J[k].hip); shift(J[k].kn); shift(J[k].an); });
  return J;
}

/* place the far arm so its hand lands on a target (two bones, fixed length) */
function gripArm(kit, J, target) {
  const s = kit.b.s, L1 = kit.b.armU * s, L2 = kit.b.armL * s;
  const sh = J.armB.sh;
  let dx = target.x - sh.x, dy = target.y - sh.y;
  let d = Math.hypot(dx, dy) || 1;
  const maxD = L1 + L2 - .2, minD = Math.abs(L1 - L2) + .2;
  if (d > maxD) { const k = maxD / d; dx *= k; dy *= k; d = maxD; }
  if (d < minD) { const k = minD / d; dx *= k; dy *= k; d = minD; }
  const base = Math.atan2(dy, dx);
  const a = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
  const elx = sh.x + Math.cos(base + a) * L1, ely = sh.y + Math.sin(base + a) * L1;
  J.armB.el = { x: elx, y: ely };
  J.armB.ha = { x: sh.x + dx, y: sh.y + dy };
}

function drawTorso(a, kit, J) {
  const b = kit.b, s = b.s, P = kit._P;
  const hw = b.hipW * .5 * s, sw = b.shW * .5 * s;
  const ang = J.lean * Math.PI / 180, c = Math.cos(ang), sn = Math.sin(ang);
  const q = (ox, oy) => ({ x: J.hip.x + ox * c - oy * sn, y: J.hip.y + ox * sn + oy * c });
  const hipL = q(-hw, 0), hipR = q(hw, 0), shL = q(-sw, -b.torso * s), shR = q(sw, -b.torso * s);
  const pal = kit.pal;
  const cloth = pal.coat || pal.suit || pal.denim || pal.top || pal.vest;
  poly(a, [[hipL.x, hipL.y], [shL.x, shL.y], [shR.x, shR.y], [hipR.x, hipR.y]], cloth.base);
  /* shading: light edge on the -x side, core shadow on +x */
  const edge = Math.max(1.6, 2.2 * s);
  const hiBand = [hipL, shL, q(-sw + edge * 1.4, -b.torso * s + 1), q(-hw + edge, -1)];
  poly(a, hiBand.map(v => [v.x, v.y]), cloth.hi);
  const shBand = [hipR, shR, q(sw - edge * 1.2, -b.torso * s + 1), q(hw - edge * .8, -1)];
  poly(a, shBand.map(v => [v.x, v.y]), cloth.sh);
  /* garment details */
  const frontX = 1.2 * s;
  if (kit.id === 'ricky') {
    /* shearling: collar blobs + open coat showing black shirt */
    clipPoly(a, q(frontX - 1.6 * s, -1), q(frontX + 2.2 * s, -1), q(frontX + 2.6 * s, -b.torso * s + 2), q(frontX - 0.4 * s, -b.torso * s + 2), pal.shirt.base);
    const collar = pal.fleece;
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      const x = shL.x + (shR.x - shL.x) * t, y = shL.y + (shR.y - shL.y) * t;
      disc(a, x, y + .4 * s, 2.4 * s, i % 2 ? collar.base : collar.hi);
    }
    clipRect(a, J.hip.x - hw, J.hip.y - 2.4 * s, hw * 2, 2 * s, 0x2a2128);
    clipRect(a, J.hip.x + hw * .35, J.hip.y - 3 * s, 3 * s, 3 * s, pal.gold.base);
  } else if (kit.id === 'vv') {
    /* crop top: hem above the navel, bare midriff, leather waistband */
    const hem = -b.torso * .42 * s;
    poly(a, [[J.hip.x - hw - .4, J.hip.y + hem], [shL.x - 1, shL.y + 1], [shR.x + 1, shR.y + 1], [J.hip.x + hw + .4, J.hip.y + hem]], pal.top.base);
    poly(a, [[J.hip.x - hw - .4, J.hip.y + hem], [J.hip.x - hw + 2.2 * s, J.hip.y + hem], [shL.x + 1.2 * s, shL.y + 1], [shL.x - 1, shL.y + 1]], pal.top.hi);
    poly(a, [[J.hip.x + 1, J.hip.y + hem + .6 * s], [J.hip.x + hw + .4, J.hip.y + hem], [shR.x + 1, shR.y + 1], [shR.x - 1.4 * s, shR.y + 1]], pal.top.sh);
    clipPoly(a, q(-hw - 1, hem), q(hw + 1, hem), q(hw + 1, hem + 3.2 * s), q(-hw - 1, hem + 3.2 * s), kit.skin.base);
    clipRect(a, J.hip.x - hw - .4, J.hip.y - 3.4 * s, hw * 2 + .8, 2.6 * s, pal.belt.base);
    clipRect(a, J.hip.x - 1.4 * s, J.hip.y - 3.4 * s, 2.8 * s, 2.6 * s, pal.gold.base);
  } else if (kit.id === 'johnny') {
    /* open denim jacket over white tee, chain, ripped shoulder */
    clipPoly(a, q(-2.6 * s, -1), q(2.8 * s, -1), q(3.4 * s, -b.torso * s + 1), q(-2.4 * s, -b.torso * s + 1), pal.tee.base);
    const jag = (ox, t) => q(ox, -b.torso * s * t);
    const l1 = [jag(-sw, 0), jag(-sw + 3.4 * s, 0), jag(-sw + 2.2 * s, .45), jag(-sw + 3.6 * s, .8), jag(-sw + 2.4 * s, 1)];
    poly(a, l1.map(v => [v.x, v.y]), pal.denim.hi);
    const r1 = [jag(sw, 0), jag(sw - 3.2 * s, 0), jag(sw - 2 * s, .5), jag(sw - 3.4 * s, .85), jag(sw - 2 * s, 1)];
    poly(a, r1.map(v => [v.x, v.y]), pal.denim.sh);
    /* collar */
    poly(a, [jag(-2.6 * s, .97), jag(-1.2 * s, .92), jag(-3.6 * s, .82)], pal.denim.hi);
    poly(a, [jag(3.2 * s, .97), jag(2 * s, .92), jag(4.2 * s, .84)], pal.denim.sh);
    /* chain */
    const cx0 = q(-1 , -b.torso * s * .74), cx1 = q(2.2 * s, -b.torso * s * .34);
    for (let i = 0; i <= 7; i++) {
      const t = i / 7, x = cx0.x + (cx1.x - cx0.x) * t + Math.sin(t * Math.PI) * 2.4 * s, y = cx0.y + (cx1.y - cx0.y) * t + Math.sin(t * Math.PI) * 1.2 * s;
      put(a, x, y, i % 2 ? pal.gold.hi : pal.gold.base);
    }
    disc(a, q(2.6 * s, -b.torso * s * .30).x, q(2.6 * s, -b.torso * s * .30).y, 1.7 * s, pal.gold.base);
  } else {
    /* generic enemy suit: lapels + tie / vest */
    if (pal.shirt) clipPoly(a, q(-1.8 * s, -1), q(2.4 * s, -1), q(3.4 * s, -b.torso * s + 1.4), q(-1.2 * s, -b.torso * s + 1.4), pal.shirt.base);
    if (pal.tie) {
      const t0 = q(2.2 * s, -b.torso * s + 2), t1 = q(1.2 * s, -b.torso * s * .18);
      poly(a, [[t0.x - 1.4 * s, t0.y], [t0.x + 1.4 * s, t0.y], [t1.x + 1 * s, t1.y], [t1.x - 1 * s, t1.y]], pal.tie.base);
    }
    if (pal.vest) {
      clipPoly(a, q(-hw, -1), q(hw, -1), q(sw - 1, -b.torso * s + 2), q(-sw + 1, -b.torso * s + 2), pal.vest.base);
      clipPoly(a, q(-2.4 * s, -1), q(2.4 * s, -1), q(3 * s, -b.torso * s + 2), q(-2 * s, -b.torso * s + 2), pal.shirt.base);
    }
    if (kit.id === 'bigtony') { disc(a, q(0, -b.torso * .55).x, q(0, -b.torso * .55).y, 4.6 * s, cloth.sh); disc(a, q(0, -b.torso * .52).x, q(0, -b.torso * .52).y, 1.4 * s, pal.gold.base); }
  }
}
function clipPoly(a, p0, p1, p2, p3, col) { poly(a, [[p0.x, p0.y], [p1.x, p1.y], [p2.x, p2.y], [p3.x, p3.y]], col); }

function leg(a, kit, hipJ, knJ, anJ, pal, far) {
  const s = kit.b.s;
  const pants = pal.pants || pal.leather || pal.denimLt || pal.suit;
  const shoe = pal.boot || pal.shoe || pal.suit;
  capsule(a, hipJ.x, hipJ.y, knJ.x, knJ.y, 5.1 * s, 3.9 * s, pants);
  capsule(a, knJ.x, knJ.y, anJ.x, anJ.y, 3.8 * s, 3.0 * s, pants);
  /* shoe: a chunky boot with a sole, toe following the facing */
  const ang = Math.atan2(anJ.y - knJ.y, anJ.x - knJ.x);
  const toeX = anJ.x + Math.cos(ang) * 2 + 5.2 * s, toeY = anJ.y + 1.2 * s;
  capsule(a, anJ.x - 1.4 * s, anJ.y - .1 * s, toeX, toeY, 3.2 * s, 2.5 * s, shoe);
  capsule(a, anJ.x - 1.8 * s, toeY + 1.4 * s, toeX + .6 * s, toeY + 1.5 * s, 1.4 * s, 1.3 * s, shoe.dk || shoe.sh);
  capsule(a, anJ.x - 2.2 * s, anJ.y - 1.2 * s, anJ.x + 1.4 * s, anJ.y - 1.3 * s, 1.5 * s, 1.4 * s, shoe.hi);
  if (kit.id === 'johnny') {
    /* ripped knee + cuff */
    clipRect(a, knJ.x - 1.6 * s, knJ.y - 1.6 * s, 3.2 * s, 2.2 * s, kit.skin.base);
    clipRect(a, anJ.x - 2.4 * s, anJ.y - 1.4 * s, 4.8 * s, 1.6 * s, pal.denimLt.base);
  }
  if (kit.id === 'vv') clipRect(a, anJ.x - 2 * s, anJ.y - 1.6 * s, 4 * s, 1.2 * s, pal.shoe.hi);
}

function arm(a, kit, shJ, elJ, haJ, pal, far) {
  const s = kit.b.s;
  const sleeve = pal.coat || pal.suit || pal.denim || pal.top || pal.vest || pal.shirt;
  const skin = kit.skin;
  const isLong = kit.id !== 'vv';
  capsule(a, shJ.x, shJ.y, elJ.x, elJ.y, 4.5 * s, 3.6 * s, sleeve);
  if (isLong) capsule(a, elJ.x, elJ.y, haJ.x, haJ.y, 3.4 * s, 2.9 * s, sleeve);
  else capsule(a, elJ.x, elJ.y, haJ.x, haJ.y, 3.0 * s, 2.5 * s, skin);
  /* hand */
  disc(a, haJ.x, haJ.y, 3.1 * s, skin.base);
  disc(a, haJ.x - .7, haJ.y - .9, 1.9 * s, skin.hi);
  clipEllipse(a, haJ.x + .9 * s, haJ.y + .9 * s, 1.7 * s, 1.4 * s, skin.sh);
  if (kit.id === 'ricky') { /* fleece cuff */
    const dx = elJ.x - shJ.x, dy = elJ.y - shJ.y, n = Math.hypot(dx, dy) || 1;
    clipEllipse(a, elJ.x + dx / n * 2.4 * s, elJ.y + dy / n * 2.4 * s, 3.1 * s, 2.4 * s, pal.fleece.hi);
  }
}

function head(a, kit, J) {
  const s = kit.b.s, P = kit._P, pal = kit.pal;
  const hx = J.head.x, hy = J.head.y, r = kit.b.headR * s * 1.06;
  const dir = P.rot > 50 ? 1 : 1; /* always facing +x in art */
  /* hair behind */
  if (kit.hair === 'long') {
    const sway = Math.sin((kit._f || 0) * .8) * 1.2;
    poly(a, [[hx - r * .9, hy - r * .6], [hx + r * .4, hy - r * 1.05], [hx - r * .2, hy + r * 1.6 + sway], [hx - r * 1.5, hy + r * 1.1 + sway], [hx - r * 1.35, hy + r * .2]], pal.hair.base);
    poly(a, [[hx - r * .9, hy - r * .3], [hx - r * .35, hy + r * 1.2], [hx - r * .8, hy + r * .9]], pal.hair.hi);
  }
  /* neck */
  capsule(a, hx - r * .25, hy + r * .75, hx + r * .2, hy + r * 1.4, 2.2 * s, 2.4 * s, kit.skin.sh);
  /* face */
  ellipse(a, hx, hy, r * .92, r * 1.02, kit.skin.base);
  /* cheek light + jaw shadow */
  clipEllipse(a, hx - r * .28, hy - r * .22, r * .52, r * .58, kit.skin.hi);
  clipEllipse(a, hx + r * .3, hy + r * .5, r * .5, r * .4, kit.skin.sh);
  /* ear */
  disc(a, hx - r * .78, hy + r * .1, r * .26, kit.skin.sh);
  /* hair front */
  if (kit.hair === 'long') {
    poly(a, [[hx - r * 1.05, hy - r * .55], [hx - r * .2, hy - r * 1.25], [hx + r * .95, hy - r * .85], [hx + r * .7, hy - r * .45], [hx - r * .1, hy - r * .7], [hx - r * .95, hy - r * .15]], pal.hair.base);
    poly(a, [[hx - r * .5, hy - r * .95], [hx + r * .5, hy - r * .95], [hx + r * .1, hy - r * .55]], pal.hair.hi);
  } else if (kit.hair === 'slick') {
    poly(a, [[hx - r, hy - r * .2], [hx - r * .9, hy - r * .95], [hx + r * .15, hy - r * 1.18], [hx + r * .9, hy - r * .72], [hx + r * .55, hy - r * .5], [hx - r * .3, hy - r * .62]], pal.hair.base);
    clipRect(a, hx + r * .1, hy - r * 1.0, r * .7, Math.max(1, r * .16), pal.hair.hi);
  } else if (kit.hair === 'crop' || kit.hair === 'short') {
    poly(a, [[hx - r, hy - r * .3], [hx - r * .85, hy - r * .95], [hx + r * .3, hy - r * 1.16], [hx + r * .92, hy - r * .66], [hx + r * .2, hy - r * .66], [hx - r * .3, hy - r * .55]], pal.hair.base);
    clipRect(a, hx - r * .5, hy - r * .95, r * .9, Math.max(1, r * .15), pal.hair.hi);
    if (kit.hair === 'short') clipEllipse(a, hx - r * .4, hy - r * .55, r * .5, r * .28, pal.hair.hi);
  } else if (kit.hair === 'beanie') {
    ellipse(a, hx - r * .05, hy - r * .78, r * .98, r * .46, pal.hat.base);
    clipRect(a, hx - r * .95, hy - r * .95, r * 1.9, 1.4 * s, pal.hat.hi);
    clipRect(a, hx - r * .5, hy - r * 1.34, r * 1.05, Math.max(1, r * .35), pal.hat.sh);
  } else if (kit.hair === 'bald') {
    clipEllipse(a, hx - r * .2, hy - r * .72, r * .62, r * .3, kit.skin.hi);
    clipRect(a, hx - r * .95, hy + r * .1, r * .4, r * .55, kit.skin.sh);
  } else if (kit.hair === 'flat') {
    rect(a, hx - r * .9, hy - r * 1.12, r * 1.9, r * .42, pal.hair.base);
    clipRect(a, hx - r * .75, hy - r * 1.1, r * 1.4, Math.max(1, r * .1), pal.hair.hi);
  }
  /* face features */
  const ex = hx + r * .30, ey = hy - r * .12;
  if (kit.face === 'box') {
    /* juice-carton head: overwrite the skull with a carton + straw */
    ellipse(a, hx, hy, r * 1.02, r * 1.1, pal.box.base);
    clipRect(a, hx - r * .9, hy - r * .95, r * .5, r * 1.7, pal.box.hi);
    clipRect(a, hx + r * .4, hy - r * .9, r * .5, r * 1.8, pal.box.sh);
    rect(a, hx + r * .05, hy - r * 1.55, 1.5 * s, r * 1.1, pal.straw.base);
    rect(a, hx + r * .05, hy - r * 1.55, 1.5 * s, 1.2 * s, pal.straw.hi);
    rect(a, hx + r * .05, hy - r * 1.2, r * .8, 1.2 * s, pal.straw.sh);
    /* cartoon eyes on the carton */
    clipRect(a, ex - r * .5, ey - r * .18, r * .45, r * .4, OUT);
    clipRect(a, ex + r * .12, ey - r * .18, r * .45, r * .4, OUT);
    clipRect(a, ex - 1, ey - r * .14, Math.max(1, r * .12), Math.max(1, r * .16), pal.straw.hi);
  } else if (kit.face === 'bandana') {
    clipRect(a, hx - r * .95, hy - r * .52, r * 1.95, r * .38, pal.band.base);
    clipRect(a, hx - r * .95, hy - r * .52, r * 1.95, Math.max(1, r * .12), pal.band.hi);
    clipRect(a, ex - r * .45, ey - r * .16, r * .4, r * .28, OUT);
    clipRect(a, ex + r * .14, ey - r * .16, r * .4, r * .28, OUT);
  } else {
    /* shades or eyes */
    if (kit.id === 'ricky' || kit.id === 'vv' || kit.id === 'johnny' || kit.id === 'mara') {
      clipRect(a, ex - r * .62, ey - r * .26, r * .74, r * .44, OUT);
      clipRect(a, ex + r * .14, ey - r * .26, r * .64, r * .44, OUT);
      clipRect(a, ex - r * .62, ey - r * .26, r * 1.4, Math.max(1, r * .12), kit.pal.gold ? kit.pal.gold.hi : 0xd8b040);
      clipRect(a, ex - r * .18, ey - r * .26, Math.max(1, r * .12), Math.max(1, r * .1), kit.pal.gold ? kit.pal.gold.hi : 0xd8b040);
      put(a, ex - r * .3, ey - r * .05, 0xf0e0b0);
    } else {
      clipRect(a, ex - r * .45, ey - r * .14, r * .34, r * .3, OUT);
      clipRect(a, ex + r * .16, ey - r * .14, r * .3, r * .3, OUT);
    }
  }
  if (kit.face === 'mustache') {
    clipRect(a, hx + r * .06, hy + r * .3, r * .78, Math.max(1, r * .17), pal.hair.base);
    clipRect(a, hx + r * .55, hy + r * .24, r * .3, Math.max(1, r * .2), pal.hair.sh);
    clipRect(a, hx + r * .1, hy + r * .62, r * .42, Math.max(1, r * .12), pal.hair.base);
  } else if (kit.face === 'beard') {
    clipEllipse(a, hx + r * .12, hy + r * .58, r * .86, r * .52, pal.beard.base);
    clipRect(a, hx + r * .5, hy + r * .3, r * .4, Math.max(1, r * .13), pal.hair.base);
    clipEllipse(a, hx + r * .1, hy + r * .5, r * .3, r * .12, pal.hair.hi);
  } else if (kit.face === 'lips') {
    clipRect(a, hx + r * .16, hy + r * .38, r * .48, Math.max(1, r * .16), pal.lip.base);
    clipRect(a, hx + r * .18, hy + r * .46, r * .4, Math.max(1, r * .07), pal.lip.sh);
  } else if (kit.face === 'jowls') {
    clipRect(a, hx + r * .1, hy + r * .42, r * .5, Math.max(1, r * .12), kit.skin.dk);
    clipRect(a, hx + r * .52, hy + r * .38, r * .16, r * .18, kit.skin.sh);
  } else if (kit.face === 'glasses') {
    clipRect(a, ex - r * .5, ey - r * .2, r * .48, r * .3, pal.gold ? pal.gold.hi : 0xd8b040);
    clipRect(a, ex + r * .14, ey - r * .2, r * .42, r * .3, pal.gold ? pal.gold.hi : 0xd8b040);
    clipRect(a, ex - r * .42, ey - r * .16, r * .34, r * .22, 0x2a3038);
    clipRect(a, ex + r * .2, ey - r * .16, r * .3, r * .22, 0x2a3038);
  } else if (kit.face === 'stubble') {
    clipEllipse(a, hx + r * .2, hy + r * .55, r * .62, r * .4, kit.skin.sh);
    clipRect(a, hx + r * .1, hy + r * .66, r * .2, Math.max(1, r * .14), OUT);
  } else if (kit.face === 'plain') {
    clipRect(a, hx + r * .2, hy + r * .48, r * .38, Math.max(1, r * .1), kit.skin.dk);
  }
  /* nose */
  clipRect(a, hx + r * .78, hy + r * .12, Math.max(1, r * .16), Math.max(1, r * .22), kit.skin.sh);
  /* brow shadow + chin line give the face a readable structure at 1x */
  clipRect(a, hx + r * .1, hy - r * .44, r * .72, Math.max(1, r * .08), kit.skin.sh);
  if (kit.face !== 'box') clipRect(a, hx + r * .16, hy + r * .8, r * .5, Math.max(1, r * .07), kit.skin.dk);
}

/* ---------------- weapons ---------------- */
function weapon(ax, ay, angDeg, len, pal, kind) {
  const ang = angDeg * Math.PI / 180, dx = Math.cos(ang), dy = Math.sin(ang);
  return { x: ax, y: ay, dx: dx, dy: dy, len: len, pal: pal, kind: kind,
    at: (t) => ({ x: ax + dx * len * t, y: ay + dy * len * t }) };
}
function drawWeapon(a, kit, J, P) {
  const s = kit.b.s, pal = kit.pal;
  const hand = J.armF.ha;
  const ang = P.wpn;
  const w = weapon(hand.x, hand.y, ang, 1, pal, kit.weapon);
  if (kit.weapon === 'flag') {
    const L = 46 * s, tipx = hand.x + Math.cos(ang * Math.PI / 180) * L, tipy = hand.y + Math.sin(ang * Math.PI / 180) * L;
    capsule(a, hand.x, hand.y, tipx, tipy, 1.6 * s, 1.5 * s, pal.steel);
    disc(a, tipx, tipy, 2.4 * s, pal.gold.base);
    disc(a, tipx - .7, tipy - .8, 1.1 * s, pal.gold.hi);
    /* flag cloth: rectangle hanging off the pole, waving */
    const bx = hand.x + Math.cos(ang * Math.PI / 180) * L * .72, by = hand.y + Math.sin(ang * Math.PI / 180) * L * .72;
    const wave = Math.sin((kit._f || 0) * 1.3) * 2.2;
    const nx = -Math.sin(ang * Math.PI / 180), ny = Math.cos(ang * Math.PI / 180);
    const fw = 21 * s, fh = 16 * s;
    const p1 = { x: bx, y: by }, p2 = { x: bx + nx * fw * .55, y: by + ny * fw * .55 };
    const p3 = { x: bx + nx * fw + Math.cos(ang * Math.PI / 180) * fh * .2 + wave, y: by + ny * fw + Math.sin(ang * Math.PI / 180) * fh * .2 };
    const p4 = { x: p3.x - nx * fw * .45, y: p3.y - ny * fw * .45 };
    poly(a, [[p1.x, p1.y], [p2.x, p2.y], [p3.x, p3.y], [p4.x, p4.y]], pal.flag.base);
    poly(a, [[p1.x, p1.y], [p2.x, p2.y], [p2.x - nx * 2 + wave * .4, p2.y - ny * 2], [p1.x - nx * 2 + wave * .4, p1.y - ny * 2]], pal.flag.hi);
    poly(a, [[p3.x, p3.y], [p4.x, p4.y], [p4.x - nx * 2, p4.y - ny * 2], [p3.x - nx * 2, p3.y - ny * 2]], pal.flag.sh);
    /* crescent + star */
    const cxm = (p1.x + p3.x) / 2 - nx * 1.5, cym = (p1.y + p3.y) / 2 - ny * 1.5;
    disc(a, cxm, cym, 3.7 * s, pal.white.base);
    disc(a, cxm + 1.5 * s, cym - .4 * s, 2.9 * s, pal.flag.base);
    rect(a, cxm + 2.9 * s, cym - 1.7 * s, 1.9 * s, 1.9 * s, pal.white.base);
  } else if (kit.weapon === 'mic') {
    const r = ang * Math.PI / 180, hx = hand.x + Math.cos(r) * 4 * s, hy = hand.y + Math.sin(r) * 4 * s;
    capsule(a, hand.x, hand.y, hx, hy, 2.0 * s, 1.8 * s, pal.mic);
    const ex = hx + Math.cos(r) * 5.8 * s, ey = hy + Math.sin(r) * 5.8 * s;
    disc(a, ex, ey, 4.4 * s, pal.mic.base);
    disc(a, ex - 1.1 * s, ey - 1.3 * s, 2.1 * s, pal.mic.hi);
    clipEllipse(a, ex + 1.4 * s, ey + 1.5 * s, 1.9 * s, 1.5 * s, pal.mic.sh);
    /* mesh bands */
    for (let i = -1; i <= 1; i++) {
      const px = ex + Math.cos(r + Math.PI / 2) * i * 2.1 * s, py = ey + Math.sin(r + Math.PI / 2) * i * 2.1 * s;
      put(a, px, py, pal.mic.dk);
    }
    /* cable from mic to the hip */
    const hipP = J.hip, c0 = { x: ex, y: ey }, c1 = { x: (ex + hipP.x) / 2 - 6 * s, y: (ey + hipP.y) / 2 + 16 * s }, c2 = { x: hipP.x - 2 * s, y: hipP.y + 6 * s };
    let lx = c0.x, ly = c0.y;
    for (let i = 1; i <= 16; i++) {
      const t = i / 16, it = 1 - t;
      const x = it * it * c0.x + 2 * it * t * c1.x + t * t * c2.x;
      const y = it * it * c0.y + 2 * it * t * c1.y + t * t * c2.y;
      line(a, lx, ly, x, y, pal.cord.base); lx = x; ly = y;
    }
  } else if (kit.weapon === 'salami') {
    const r = ang * Math.PI / 180;
    const L = 38 * s, half = 7.3 * s;
    capsule(a, hand.x - Math.cos(r) * 5 * s, hand.y - Math.sin(r) * 5 * s, hand.x + Math.cos(r) * (L - 2), hand.y + Math.sin(r) * (L - 2), half * .8, half, pal.salami);
    /* rounded cut end + string */
    const ex = hand.x + Math.cos(r) * (L - 2), ey = hand.y + Math.sin(r) * (L - 2);
    disc(a, ex, ey, half * .96, pal.salami.base);
    clipEllipse(a, ex - 1.2 * s, ey - 1.2 * s, half * .5, half * .5, pal.speck.base);
    clipEllipse(a, ex + .6 * s, ey + 1.4 * s, half * .34, half * .34, pal.speck.sh);
    for (let i = 0; i < 9; i++) {
      const t = .14 + (i % 5) * .17, off = (i % 3 - 1) * half * .45;
      const px = hand.x + Math.cos(r) * L * t - Math.sin(r) * off, py = hand.y + Math.sin(r) * L * t + Math.cos(r) * off;
      put(a, px, py, pal.speck.base); if (i % 2) put(a, px + 1, py, pal.speck.sh);
    }
    /* the far hand is aimed onto the salami by renderFrame (see gripArm) */
  } else if (kit.weapon === 'baton') {
    const r = ang * Math.PI / 180;
    const bt = pal.mic || pal.steel || pal.suit || pal.coat || pal.vest;
    capsule(a, hand.x, hand.y, hand.x + Math.cos(r) * 16 * s, hand.y + Math.sin(r) * 16 * s, 1.8 * s, 1.6 * s, bt);
    capsule(a, hand.x + Math.cos(r) * 14 * s, hand.y + Math.sin(r) * 14 * s, hand.x + Math.cos(r) * 17 * s, hand.y + Math.sin(r) * 17 * s, 2.1 * s, 2.1 * s, pal.gold || pal.band || bt);
  } else if (kit.weapon === 'book') {
    const r = ang * Math.PI / 180, cx = hand.x + Math.cos(r) * 6 * s, cy = hand.y + Math.sin(r) * 6 * s;
    rrect(a, cx, cy, 6.5 * s, 8 * s, r, pal.book.base);
    rrect(a, cx - 1.2 * s, cy, 5.2 * s, 7 * s, r, pal.paper.base);
    for (let i = -2; i <= 2; i++) { const p = { x: cx - 4 * s, y: cy + i * 2.2 * s }; put(a, p.x, p.y, pal.paper.sh); }
  } else if (kit.weapon === 'case') {
    const r = ang * Math.PI / 180, cx = hand.x + Math.cos(r) * 8 * s, cy = hand.y + Math.sin(r) * 8 * s;
    rrect(a, cx, cy, 7 * s, 5 * s, r, pal.case.base);
    rrect(a, cx - 1.2 * s, cy - 1 * s, 4.6 * s, 2 * s, r, pal.case.hi);
    put(a, cx, cy, pal.gold ? pal.gold.base : pal.case.sh);
  } else if (kit.weapon === 'bottle') {
    const r = ang * Math.PI / 180, hx2 = hand.x + Math.cos(r) * 7 * s, hy2 = hand.y + Math.sin(r) * 7 * s;
    capsule(a, hand.x, hand.y, hx2, hy2, 2.3 * s, 1.5 * s, pal.glass);
  }
}

/* ---------------- kit render ---------------- */
function renderFrame(kit, anim, fi) {
  const buf = newBuf(CW, CH);
  const poses = kit._poses || (kit._poses = Art.posesFor(kit));
  const list = poses[anim] || poses.idle;
  const P = list[Math.min(fi, list.length - 1)];
  kit._P = P; kit._f = fi;
  const J = solve(kit, P);
  const s = kit.b.s;
  /* two-handed weapons: pull the far hand onto the shaft so it can never float */
  if (kit.weapon === 'salami') {
    const r = (P.wpn || 0) * Math.PI / 180, L = 36 * s;
    const grip = { x: J.armF.ha.x + Math.cos(r) * L * .34, y: J.armF.ha.y + Math.sin(r) * L * .34 };
    gripArm(kit, J, grip);
  }
  /* weapon behind the body for windups */
  const wb = (P.wbehind || P.wpn < -115);
  if (wb) drawWeapon(buf, kit, J, P);
  arm(buf, kit, J.armB.sh, J.armB.el, J.armB.ha, kit.pal, true);
  leg(buf, kit, J.legB.hip, J.legB.kn, J.legB.an, kit.pal, true);
  drawTorso(buf, kit, J);
  head(buf, kit, J);
  leg(buf, kit, J.legF.hip, J.legF.kn, J.legF.an, kit.pal, false);
  arm(buf, kit, J.armF.sh, J.armF.el, J.armF.ha, kit.pal, false);
  if (!wb) drawWeapon(buf, kit, J, P);
  const outBuf = newBuf(CW, CH);
  /* apply body rotation for knockdown frames */
  if (P.rot) {
    const rad = P.rot * Math.PI / 180, cx = J.hip.x, cy = J.hip.y;
    const c = Math.cos(rad), sn = Math.sin(rad);
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      const i = y * CW + x; if (!buf.m[i]) continue;
      const dx = x - cx, dy = y - cy;
      const nx = Math.round(cx + dx * c - dy * sn), ny = Math.round(cy + dx * sn + dy * c);
      if (nx < 0 || ny < 0 || nx >= CW || ny >= CH) continue;
      const k = ny * CW + nx; outBuf.d[k] = buf.d[i]; outBuf.m[k] = 1;
    }
  } else { outBuf.d.set(buf.d); outBuf.m.set(buf.m); }
  outline(outBuf, hex(OUT));
  return outBuf;
}

function trim(buf) {
  let x0 = buf.w, y0 = buf.h, x1 = -1, y1 = -1;
  for (let y = 0; y < buf.h; y++) for (let x = 0; x < buf.w; x++) {
    if (!buf.m[y * buf.w + x]) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) return { w: 1, h: 1, ox: 0, oy: 0, data: new Uint32Array([0]) };
  const w = x1 - x0 + 1, h = y1 - y0 + 1, data = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[y * w + x] = buf.d[(y + y0) * buf.w + (x + x0)];
  return { w: w, h: h, ox: x0 - AX, oy: y0 - AY, data: data };
}

/** Render every animation for a kit and return trimmed frames + timing. */
Art.buildKit = function (id) {
  const kit = KITS[id];
  const anims = kit.kind === 'hero' ? ANIMS.hero : ANIMS.enemy;
  const out = { id: id, name: kit.name, kind: kit.kind, anims: {} };
  anims.forEach(a => {
    const poses = (kit._poses = Art.posesFor(kit))[a] || POSE.idle;
    const frames = [];
    for (let i = 0; i < poses.length; i++) frames.push(trim(renderFrame(kit, a, i)));
    out.anims[a] = { timing: TIMING[a].slice(0, poses.length), frames: frames };
  });
  out.portrait = portrait(kit);
  return out;
};

/* ---------------- portraits ---------------- */
function portrait(kit) {
  const W = 48, H = 48, buf = newBuf(W, H);
  const mainC = kit.pal.coat || kit.pal.suit || kit.pal.denim || kit.pal.top || kit.pal.vest;
  const shirtC = kit.pal.shirt || kit.pal.tee || kit.pal.top || mainC;
  const k2 = Object.assign({}, kit, { _f: 0 });
  const P = p({ lean: 2, head: -3, sf: -30, ef: -50, sb: 30, eb: 50 });
  k2._P = P;
  const s = kit.b.s * 1.34;
  const J = { sh: { x: 24, y: 31 }, hip: { x: 24, y: 52 }, head: { x: 26, y: 18 }, armF: { el: { x: 20, y: 40 }, ha: { x: 17, y: 48 } }, armB: { el: { x: 30, y: 40 }, ha: { x: 34, y: 48 } }, lean: 2 };
  k2.b = Object.assign({}, kit.b, { s: s });
  k2._P = Object.assign({}, P, { wpn: -90 });
  /* shoulders + chest */
  poly(buf, [[8, H], [12, 33], [22, 30], [26, 30], [36, 33], [40, H]], mainC.base);
  if (kit.id === 'ricky') {
    for (let i = 0; i < 6; i++) disc(buf, 12 + i * 5, 33 + (i % 2), 2.6, i % 2 ? kit.pal.fleece.base : kit.pal.fleece.hi);
    rect(buf, 14, 38, 22, 2, kit.pal.fleece.sh);
    poly(buf, [[20, 34], [28, 34], [26, H], [22, H]], kit.pal.shirt.base);
  } else if (kit.id === 'vv') {
    rect(buf, 10, 34, 28, 2, kit.skin.base);
    rect(buf, 12, 38, 24, 2, kit.pal.belt.base);
  } else if (kit.id === 'johnny') {
    poly(buf, [[20, 33], [28, 33], [30, H], [18, H]], kit.pal.tee.base);
    poly(buf, [[8, H], [12, 33], [20, 33], [18, H]], kit.pal.denim.base);
    poly(buf, [[40, H], [36, 33], [28, 33], [30, H]], kit.pal.denim.base);
  } else {
    poly(buf, [[20, 33], [28, 33], [29, H], [19, H]], shirtC.base);
    if (kit.pal.tie) poly(buf, [[22.5, 35], [25.5, 35], [25, 46], [23, 46]], kit.pal.tie.base);
  }
  /* head bigger, centred */
  const hk = Object.assign({}, kit, { b: Object.assign({}, kit.b, { s: s, headR: kit.b.headR * 1.12 }) });
  hk._P = Object.assign({}, P, { head: -4 });
  hk._f = 0;
  const HJ = { sh: { x: 24, y: 30 }, hip: { x: 24, y: 54 }, head: { x: 25, y: 20 }, lean: 4 };
  head(buf, hk, HJ);
  outline(buf, hex(OUT));
  const t = trim(buf);
  t.data = scale2(t.data, t.w, t.h);
  return { w: t.w * 2, h: t.h * 2, ox: t.ox, oy: t.oy, data: t.data };
}
function scale2(data, w, h) {
  const out = new Uint32Array(w * 2 * h * 2);
  for (let y = 0; y < h * 2; y++) for (let x = 0; x < w * 2; x++) out[y * w * 2 + x] = data[(y >> 1) * w + (x >> 1)];
  return out;
}

/* ---------------- props / food / fx ---------------- */
function propBuf(w, h, fn) { const b = newBuf(w, h); fn(b); outline(b, hex(OUT)); return trim(b); }
Art.buildProps = function () {
  const out = {};
  out.crate = propBuf(34, 30, (a) => {
    const wood = pal(0xa8763c, 0xc08f52, 0x7c5326);
    rect(a, 3, 3, 28, 24, wood.base);
    rect(a, 3, 3, 28, 3, wood.hi); rect(a, 3, 24, 28, 3, wood.sh);
    rect(a, 3, 3, 3, 24, wood.sh);
    for (let i = 0; i < 4; i++) rect(a, 6, 7 + i * 6, 22, 1, wood.sh);
    for (let i = 0; i < 3; i++) rect(a, 8 + i * 8, 4, 2, 22, wood.hi);
    rect(a, 12, 11, 10, 8, pal(0xd8b878, 0xf0d090, 0xa88a50).base);
  });
  out.barrel = propBuf(28, 34, (a) => {
    const blue = pal(0x2f5f92, 0x4179b0, 0x1d3f66);
    rect(a, 4, 6, 20, 26, blue.base);
    rect(a, 4, 6, 20, 3, blue.hi); rect(a, 4, 29, 20, 3, blue.sh);
    rect(a, 4, 6, 4, 26, blue.hi); rect(a, 20, 6, 4, 26, blue.sh);
    rect(a, 2, 12, 24, 3, pal(0x8a909c, 0xb8c0cc, 0x5a606c).base);
    rect(a, 2, 24, 24, 3, pal(0x8a909c, 0xb8c0cc, 0x5a606c).base);
    rect(a, 10, 16, 8, 6, pal(0xe8d890, 0xfff0b8, 0xb0a060).base);
  });
  out.bin = propBuf(26, 30, (a) => {
    const g = pal(0x5a6068, 0x7c848e, 0x3a4048);
    rect(a, 4, 6, 18, 22, g.base);
    rect(a, 4, 6, 18, 2, g.hi); rect(a, 4, 4, 18, 2, g.sh);
    for (let i = 0; i < 4; i++) rect(a, 6 + i * 4, 8, 1, 20, g.sh);
    rect(a, 4, 6, 2, 22, g.hi);
    rect(a, 2, 2, 22, 3, g.sh);
  });
  out.boxes = propBuf(48, 26, (a) => {
    const k = pal(0xb08a54, 0xc8a468, 0x846034), k2 = pal(0x9c7848, 0xb08e5c, 0x705030);
    rect(a, 2, 10, 22, 15, k.base); rect(a, 2, 10, 22, 2, k.hi);
    rect(a, 22, 4, 22, 21, k2.base); rect(a, 22, 4, 22, 2, k2.hi);
    rect(a, 8, 14, 10, 2, k.sh); rect(a, 28, 9, 10, 2, k2.sh);
    rect(a, 2, 10, 2, 15, k.hi); rect(a, 22, 4, 2, 21, k2.hi);
  });
  return out;
};

Art.buildFood = function () {
  const out = {};
  const plate = (a, w) => { ellipse(a, 17, 19, w, 3.4, pal(0xe8e4d8, 0xffffff, 0xb8b4a8).base); ellipse(a, 17, 18, w * .8, 2.4, pal(0xf6f2e6, 0xffffff, 0xd0ccbe).base); };
  out.adana = propBuf(34, 24, (a) => {
    plate(a, 15);
    const m = pal(0xa8402a, 0xc45a3c, 0x7c2a1a);
    capsule(a, 8, 16, 27, 12, 3.6, 3.2, m);
    for (let i = 0; i < 4; i++) capsule(a, 9 + i * 5, 15.5 - i * .8, 12 + i * 5, 14.5 - i * .8, 1.5, 1.5, pal(0xe8d8b0, 0xfff0d0, 0xc0ac84));
    line(a, 4, 19, 31, 9, pal(0xd0d4dc, 0xeff2f8, 0x9098a4).base);
  });
  out.shish = propBuf(34, 24, (a) => {
    plate(a, 15);
    const m = pal(0x8a5a34, 0xa87044, 0x643c20);
    for (let i = 0; i < 3; i++) capsule(a, 9 + i * 6, 14, 14 + i * 6, 13, 3.4, 3.4, m);
    line(a, 5, 17, 31, 12, pal(0xd0d4dc, 0xeff2f8, 0x9098a4).base);
    rect(a, 8, 12, 3, 2, pal(0x5a8a3a, 0x76a84e, 0x3a6024).base);
  });
  out.doner = propBuf(36, 26, (a) => {
    plate(a, 16);
    const m = pal(0x8a4a2a, 0xa86238, 0x622f18);
    for (let i = 0; i < 4; i++) capsule(a, 9 + i * 5, 15 - i * .6, 13 + i * 5, 14 - i * .6, 2.8, 2.4, m);
    rect(a, 12, 8, 12, 4, pal(0xe8d8b0, 0xfff0d0, 0xc0ac84).base);
  });
  out.lahmacun = propBuf(34, 24, (a) => {
    ellipse(a, 17, 15, 13, 6.4, pal(0xd8a860, 0xf0c47e, 0xa87c3c).base);
    ellipse(a, 17, 14, 10, 4.4, pal(0xa8402a, 0xc45a3c, 0x7c2a1a).base);
    for (let i = 0; i < 5; i++) put(a, 11 + i * 3, 12 + (i % 2) * 3, pal(0x5a8a3a, 0x76a84e, 0x3a6024).base);
  });
  out.kunefe = propBuf(34, 24, (a) => {
    plate(a, 14);
    const k = pal(0xc88a2a, 0xe8ac4a, 0x946018);
    rect(a, 8, 11, 18, 6, k.base); rect(a, 8, 11, 18, 2, k.hi);
    for (let i = 0; i < 6; i++) put(a, 9 + i * 3, 10, k.hi);
    rect(a, 13, 8, 8, 3, pal(0xf0ead8, 0xffffff, 0xc8c2b0).base);
  });
  out.spit = propBuf(36, 46, (a) => {
    const m = pal(0x8a3a24, 0xaa5236, 0x5e2412);
    capsule(a, 18, 8, 18, 42, 7.4, 5.4, m);
    for (let i = 0; i < 8; i++) capsule(a, 12, 12 + i * 3.4, 24, 13 + i * 3.4, 1.1, 1.1, pal(0xd8a878, 0xf2c89a, 0xa87c4c));
    line(a, 18, 6, 18, 44, pal(0xd0d4dc, 0xeff2f8, 0x9098a4).base);
    rect(a, 14, 2, 8, 4, pal(0xd8262c, 0xf0464a, 0x9c1418).base);
  });
  return out;
};

Art.buildFx = function () {
  const out = { spark: [], boom: [], dust: [], star: [] };
  const sparkCols = [0xfff6c8, 0xffd23a, 0xff8a2a];
  for (let f = 0; f < 3; f++) {
    const b = newBuf(40, 40), n = 4 + f * 2, r0 = 4 + f * 5, r1 = 13 + f * 4;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + .3, w = 1.6;
      line(b, 20 + Math.cos(a) * r0, 20 + Math.sin(a) * r0, 20 + Math.cos(a) * r1, 20 + Math.sin(a) * r1, hex(f === 0 ? sparkCols[0] : sparkCols[Math.min(2, f)]), 2);
    }
    disc(b, 20, 20, 3.4 - f * .6, hex(0xffffff));
    out.spark.push(trim(b));
  }
  for (let f = 0; f < 3; f++) {
    const b = newBuf(56, 56);
    const r = 10 + f * 8;
    disc(b, 28, 28, r, hex(f === 0 ? 0xffd23a : f === 1 ? 0xff8a2a : 0xd8402a));
    disc(b, 28, 28, r * .62, hex(f === 0 ? 0xfff6c8 : 0xffc060));
    disc(b, 28, 28, r * .3, hex(0xffffff));
    const t = trim(b); out.boom.push(t);
  }
  for (let f = 0; f < 3; f++) {
    const b = newBuf(36, 20);
    for (let i = 0; i < 5; i++) {
      const x = 18 + (i - 2) * (4 + f * 3), y = 10 + (i % 2 ? -2 : 2) * (1 + f);
      ellipse(b, x, y, 4 + f * 1.6, 3 + f, hex(0xd8d0c0));
    }
    out.dust.push(trim(b));
  }
  for (let f = 0; f < 3; f++) {
    const b = newBuf(22, 22);
    const c = hex(f === 1 ? 0xfff6c8 : 0xffd23a);
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * Math.PI * 2 + Math.PI / 4;
      line(b, 11, 11, 11 + Math.cos(a) * (4 + f * 2), 11 + Math.sin(a) * (4 + f * 2), c, 2);
    }
    out.star.push(trim(b));
  }
  return out;
};

/* ---------------- pack + export ---------------- */
Art.pack = function (items) {
  /* items: [{key, frame:{w,h,data}}] -> shelf-packed sheet */
  const pad = 2, maxW = 1024;
  let x = pad, y = pad, rowH = 0;
  const placed = [];
  items.forEach(it => {
    const f = it.frame;
    if (x + f.w + pad > maxW) { x = pad; y += rowH + pad; rowH = 0; }
    placed.push({ key: it.key, x: x, y: y, w: f.w, h: f.h, ox: f.ox, oy: f.oy, frame: f });
    x += f.w + pad; rowH = Math.max(rowH, f.h);
  });
  const W = maxW, H = y + rowH + pad;
  const data = new Uint32Array(W * H);
  placed.forEach(p => {
    for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) data[(p.y + j) * W + (p.x + i)] = p.frame.data[j * p.w + i];
  });
  return { w: W, h: H, data: data, placed: placed };
};
Art.encodePng = function (sheet) {
  /* Node only: @napi-rs/canvas */
  const { createCanvas } = require('@napi-rs/canvas');
  const c = createCanvas(sheet.w, sheet.h), ctx = c.getContext('2d');
  const img = ctx.createImageData(sheet.w, sheet.h);
  const u8 = new Uint8Array(sheet.data.buffer, sheet.data.byteOffset, sheet.data.byteLength);
  img.data.set(u8);
  ctx.putImageData(img, 0, 0);
  return c.toBuffer('image/png');
};
Art._test = { renderFrame: renderFrame, solve: solve, newBuf: newBuf, trim: trim, KITS: KITS, posesFor: Art.posesFor, capsule: capsule, poly: poly, head: head, drawTorso: drawTorso, arm: arm, leg: leg, put: put };
})(globalThis.GG = globalThis.GG || {});
