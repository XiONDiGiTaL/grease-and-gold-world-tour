/* Stages: data + authored layered backgrounds (pixel-authored, deterministic). */
(function (G) {
'use strict';
const Art = G.Art, C = Art.C, AX = Art.CELL.ax;
function newBuf(w, h) { return { w: w, h: h, d: new Uint32Array(w * h), m: new Uint8Array(w * h) }; }
function put(b, x, y, c) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= b.w || y >= b.h) return; b.d[y * b.w + x] = c; b.m[y * b.w + x] = 1; }
function rect(b, x, y, w, h, c) { x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(b, x + i, y + j, c); }
function disc(b, cx, cy, r, c) { for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) { const dx = x + .5 - cx, dy = y + .5 - cy; if (dx * dx + dy * dy <= r * r) put(b, x, y, c); } }
function ellipse(b, cx, cy, rx, ry, c) { for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) { const dx = (x + .5 - cx) / rx, dy = (y + .5 - cy) / ry; if (dx * dx + dy * dy <= 1) put(b, x, y, c); } }
function tri(b, x0, y0, x1, y1, x2, y2, c) {
  const miny = Math.floor(Math.min(y0, y1, y2)), maxy = Math.ceil(Math.max(y0, y1, y2));
  const pts = [[x0, y0], [x1, y1], [x2, y2]];
  for (let y = miny; y <= maxy; y++) {
    const xs = [];
    for (let i = 0; i < 3; i++) { const p = pts[i], q = pts[(i + 1) % 3]; if ((p[1] <= y && q[1] > y) || (q[1] <= y && p[1] > y)) xs.push(p[0] + (y - p[1]) / (q[1] - p[1]) * (q[0] - p[0])); }
    xs.sort((a, b2) => a - b2);
    for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.ceil(xs[i]); x < xs[i + 1]; x++) put(b, x, y, c);
  }
}
function band(b, y0, y1, cols) {
  const n = cols.length;
  for (let y = y0; y < y1; y++) {
    const t = (y - y0) / Math.max(1, y1 - y0 - 1) * (n - 1), i = Math.min(n - 2, Math.floor(t)), f = t - i;
    const a = cols[i], c2 = cols[i + 1];
    const mix = (sh) => Math.round(((a >> sh) & 255) * (1 - f) + ((c2 >> sh) & 255) * f);
    const r = mix(16), g = mix(8), bl = mix(0);
    for (let x = 0; x < b.w; x++) put(b, x, y, C(r, g, bl));
  }
}
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

G.STAGES = [
  { id: 'plaza', name: 'Skyline Plaza', tour: 'WORLD TOUR / STOP 1', len: 1760, theme: 'plaza', music: 'arcade', tokens: 2,
    waves: [{ x: 210, e: [['jooce', 'R'], ['jooce', 'R']] }, { x: 560, e: [['jooce', 'L'], ['jooce', 'R'], ['hobo', 'R']] },
      { x: 930, e: [['hobo', 'L'], ['jooce', 'R'], ['heavy', 'R']] }, { x: 1290, e: [['hobo', 'R'], ['jooce', 'L'], ['jooce', 'R'], ['heavy', 'L']] },
      { x: 1580, boss: 'ledger', e: [['ledger', 'R', 0], ['jooce', 'L', 260], ['jooce', 'R', 380]] }],
    props: [['crate', 330, 186], ['barrel', 470, 168], ['bin', 760, 196], ['crate', 1060, 174], ['barrel', 1170, 200], ['boxes', 1460, 180]] },
  { id: 'docks', name: 'Harbor Docks', tour: 'WORLD TOUR / STOP 2', len: 1900, theme: 'docks', music: 'arcade', tokens: 2,
    waves: [{ x: 220, e: [['hobo', 'R'], ['hobo', 'R'], ['hobo', 'L']] }, { x: 600, e: [['jooce', 'R'], ['jooce', 'L'], ['turd', 'R']] },
      { x: 990, e: [['heavy', 'R'], ['hobo', 'L'], ['turd', 'R']] }, { x: 1350, e: [['turd', 'R'], ['turd', 'L'], ['jooce', 'R'], ['hobo', 'L']] },
      { x: 1660, boss: 'bigtony', e: [['bigtony', 'R', 0], ['turd', 'L', 300]] }],
    props: [['crate', 300, 176], ['boxes', 520, 198], ['barrel', 760, 166], ['barrel', 870, 204], ['crate', 1130, 188], ['bin', 1250, 172], ['boxes', 1520, 200]] },
  { id: 'pass', name: 'Ashfall Pass', tour: 'WORLD TOUR / STOP 3', len: 1960, theme: 'pass', music: 'kneel', tokens: 3,
    waves: [{ x: 220, e: [['turd', 'R'], ['turd', 'L'], ['hobo', 'R']] }, { x: 620, e: [['turd', 'R'], ['turd', 'R'], ['turd', 'L']] },
      { x: 1010, e: [['heavy', 'R'], ['turd', 'L'], ['jooce', 'R'], ['hobo', 'L']] }, { x: 1400, e: [['turd', 'R'], ['hobo', 'L'], ['turd', 'R'], ['heavy', 'L']] },
      { x: 1700, boss: 'mara', e: [['mara', 'R', 0], ['turd', 'L', 240], ['turd', 'R', 360]] }],
    props: [['barrel', 340, 184], ['crate', 560, 168], ['barrel', 810, 202], ['boxes', 1100, 176], ['barrel', 1260, 192], ['crate', 1500, 180]] },
  { id: 'tower', name: 'Gold Tower', tour: 'WORLD TOUR / FINAL STOP', len: 2060, theme: 'tower', music: 'arcade', tokens: 3,
    waves: [{ x: 220, e: [['jooce', 'R'], ['jooce', 'L'], ['hobo', 'R'], ['hobo', 'L']] }, { x: 610, e: [['heavy', 'R'], ['turd', 'L'], ['turd', 'R']] },
      { x: 1000, e: [['hobo', 'R'], ['hobo', 'L'], ['jooce', 'R'], ['turd', 'L'], ['jooce', 'R']] }, { x: 1380, e: [['heavy', 'R'], ['heavy', 'L'], ['turd', 'R'], ['turd', 'L']] },
      { x: 1830, boss: 'auditor', e: [['auditor', 'R', 0], ['jooce', 'L', 400]] }],
    props: [['crate', 360, 174], ['bin', 560, 200], ['boxes', 830, 184], ['barrel', 1150, 166], ['crate', 1300, 196], ['bin', 1650, 178]] }
];

G.buildStage = function (i) {
  const st = G.STAGES[i], L = st.len, r = rng(9173 + i * 733);
  const farW = Math.ceil(480 + (L - 480) * .18), midW = Math.ceil(480 + (L - 480) * .45);
  const far = newBuf(farW, 270), mid = newBuf(midW, 270), flo = newBuf(L, 270);
  const T = st.theme;
  const FT = G.FT;
  if (T === 'plaza') {
    band(far, 0, FT + 4, [0x2f3f7a, 0x4a5090, 0x74609a, 0xa06f92, 0xc98380, 0xe6a077, 0xf3bd88]);
    disc(far, farW * .62, 96, 26, 0xffe6ac); disc(far, farW * .62, 96, 21, 0xfff2cc);
    for (let x = 0; x < farW;) {
      const w = 26 + r() * 40, h = 42 + r() * 78;
      const col = r() < .5 ? 0x5d5680 : 0x6a618c;
      rect(far, x, FT - h, w, h, C((col >> 16) & 255, (col >> 8) & 255, col & 255));
      for (let y = FT - h + 5; y < FT - 8; y += 7) for (let xx = x + 4; xx < x + w - 4; xx += 6) if (r() < .35) rect(far, xx, y, 2, 3, C(255, 226, 150));
      rect(far, x, FT - h, w, 2, C(150, 140, 190));
      x += w + 2;
    }
    for (let x = 0; x < midW;) {
      const w = 60 + r() * 46, h = 66 + r() * 44;
      rect(mid, x, FT - h, w, h, C(38, 54, 82));
      rect(mid, x, FT - h, 3, h, C(54, 74, 106));
      rect(mid, x, FT - h, w, 3, C(24, 36, 60));
      for (let y = FT - h + 10; y < FT - 20; y += 11) for (let xx = x + 6; xx < x + w - 8; xx += 12) rect(mid, xx, y, 8, 6, r() < .45 ? C(246, 216, 128) : C(112, 168, 196));
      // storefront
      const aw = w - 10;
      for (let k = 0; k < aw; k += 8) rect(mid, x + 5 + k, FT - 22, 8, 8, ((k / 8) | 0) % 2 ? C(214, 64, 52) : C(244, 232, 208));
      rect(mid, x + 6, FT - 14, aw - 2, 14, C(255, 214, 138));
      rect(mid, x + 6, FT - 14, aw - 2, 2, C(176, 124, 36));
      rect(mid, x + w / 2 - 20, FT - h - 12, 40, 10, C(24, 22, 34));
      rect(mid, x + w / 2 - 18, FT - h - 10, 36, 6, C(240, 196, 60));
      x += w + 6;
    }
    rect(mid, 0, FT - 4, midW, 6, C(22, 30, 44));
    rect(flo, 0, FT - 6, L, 6, C(150, 146, 136));
    rect(flo, 0, FT - 6, L, 2, C(184, 180, 168));
    rect(flo, 0, FT, L, 270 - FT, C(196, 192, 178));
    for (let y = FT + 10; y < 270; y += 14) { rect(flo, 0, y, L, 1, C(176, 172, 158)); for (let x = ((y / 14) | 0) % 2 * 20; x < L; x += 44) rect(flo, x, y, 1, 14, C(176, 172, 158)); }
    for (const y of [FT + 16, FT + 44, FT + 76]) { rect(flo, 0, y, L, 2, C(214, 210, 196)); }
    for (let x = 60; x < L; x += 260) { rect(flo, x, FT - 22, 5, 24, C(52, 50, 58)); rect(flo, x - 8, FT - 26, 21, 4, C(52, 50, 58)); rect(flo, x - 6, FT - 24, 17, 2, C(255, 238, 176)); }
    for (let x = 90; x < L; x += 230) { // planters
      rect(flo, x, FT - 14, 34, 12, C(94, 78, 58)); rect(flo, x + 2, FT - 20, 30, 7, C(62, 118, 58)); rect(flo, x + 8, FT - 24, 9, 5, C(88, 146, 70));
    }
    for (let x = 0; x < L; x += 90) { rect(flo, x, 246, 44, 3, C(214, 210, 196)); }
  } else if (T === 'docks') {
    band(far, 0, FT, [0x0b1030, 0x121a44, 0x1e2a5c, 0x3a3270, 0x6a3a70, 0x9a4a68]);
    for (let i = 0; i < 90; i++) rect(far, Math.floor(r() * farW), Math.floor(r() * 90), 1, 1, C(255, 246, 204));
    disc(far, farW * .28, 60, 17, 0xfff2c4); disc(far, farW * .28 - 5, 58, 14, C(18, 26, 62));
    rect(far, 0, FT - 26, farW, 30, C(24, 46, 82));
    for (let i = 0; i < 120; i++) { const x = Math.floor(r() * farW), y = FT - 22 + Math.floor(r() * 22); rect(far, x, y, 4 + Math.floor(r() * 10), 1, C(74, 108, 154)); }
    for (let x = 20; x < farW; x += 150) { rect(far, x, 46, 5, 80, C(10, 14, 30)); rect(far, x - 34, 52, 74, 4, C(10, 14, 30)); rect(far, x - 34, 52, 3, 18, C(10, 14, 30)); rect(far, x + 33, 56, 2, 14, C(10, 14, 30)); }
    for (let x = 0; x < midW;) {
      const w = 80 + r() * 50, stack = 1 + ((r() * 3) | 0);
      const cols = [0x8e3226, 0x2a5a8e, 0xb08a28, 0x2c6a50, 0x6a3a72];
      for (let sy = 0; sy < stack; sy++) {
        const col = C((cols[(r() * cols.length) | 0] >> 16) & 255, (cols[(r() * cols.length) | 0] >> 8) & 255, 0);
        const base = cols[(r() * cols.length) | 0];
        rect(mid, x, FT - 24 - sy * 22, w, 22, C((base >> 16) & 255, (base >> 8) & 255, base & 255));
        for (let i = 0; i < w; i += 7) rect(mid, x + i, FT - 24 - sy * 22, 1, 22, C(0, 0, 0));
        rect(mid, x, FT - 24 - sy * 22, w, 2, C(255, 255, 255));
      }
      x += w + 10;
      if (r() < .4) { rect(mid, x, FT - 40, 54, 40, C(58, 54, 62)); for (let y = FT - 36; y < FT - 8; y += 7) for (let xx = x + 5; xx < x + 49; xx += 8) rect(mid, xx, y, 5, 4, C(246, 224, 148)); x += 62; }
    }
    rect(mid, 0, FT - 5, midW, 7, C(26, 34, 56));
    rect(flo, 0, FT - 8, L, 8, C(76, 56, 34));
    rect(flo, 0, FT - 8, L, 2, C(104, 78, 46));
    rect(flo, 0, FT, L, 270 - FT, C(96, 70, 42));
    for (let y = FT + 8; y < 270; y += 11) { rect(flo, 0, y, L, 1, C(74, 52, 30)); for (let x = (y * 7) % 60; x < L; x += 60) rect(flo, x, y, 1, 11, C(74, 52, 30)); }
    for (let x = 120; x < L; x += 300) { rect(flo, x, FT - 16, 7, 18, C(34, 34, 44)); rect(flo, x - 2, FT - 20, 11, 5, C(230, 220, 180)); rect(flo, x - 2, FT - 19, 11, 2, C(255, 244, 200)); }
    for (let x = 40; x < L; x += 380) { // ropes
      for (let i = 0; i < 9; i++) ellipse(flo, x + i * 6, FT + 2, 8, 2.4, C(176, 148, 96));
    }
  } else if (T === 'pass') {
    band(far, 0, FT, [0x2a4a86, 0x4a6a9a, 0x7c88a2, 0xc09a86, 0xe8b47e, 0xf6cf94]);
    for (let k = 0; k < 2; k++) for (let x = -20; x < farW;) {
      const w = 70 + r() * 90, h = 34 + r() * 44 + k * 12;
      tri(far, x, FT, x + w / 2, FT - h, x + w, FT, C(k ? 0xa86a4c : 0xc4845e, 0, 0));
      tri(far, x + w / 2, FT, x + w / 2 + w * .3, FT - h * .8, x + w, FT, C(k ? 0x94583e : 0xb0704e, 0, 0));
      x += w - 8;
    }
    for (let x = 0; x < midW;) {
      const w = 52 + r() * 70, h = 46 + r() * 46;
      rect(mid, x, FT - h, w, h, C(122, 78, 48));
      for (let y = FT - h + 7; y < FT; y += 9) rect(mid, x, y, w, 2, C(96, 58, 34));
      rect(mid, x, FT - h, w, 3, C(152, 104, 66));
      for (let xx = x + 6; xx < x + w - 8; xx += 14) rect(mid, xx, FT - h + 12, 7, 8, C(60, 38, 24));
      x += w + 8;
    }
    for (let x = 30; x < midW; x += 26) rect(mid, x, FT - 26, 2, 26, C(154, 163, 178));
    rect(mid, 0, FT - 28, midW, 3, C(186, 194, 208)); rect(mid, 0, FT - 22, midW, 3, C(186, 194, 208));
    for (let x = 150; x < midW; x += 420) { rect(mid, x + 24, 74, 3, 56, C(58, 54, 62)); rect(mid, x + 70, 74, 3, 56, C(58, 54, 62)); rect(mid, x, 44, 98, 32, C(196, 58, 44)); rect(mid, x + 4, 48, 90, 4, C(246, 210, 96)); }
    rect(flo, 0, FT - 8, L, 8, C(176, 152, 112));
    rect(flo, 0, FT - 8, L, 2, C(206, 182, 138));
    rect(flo, 0, FT, L, 270 - FT, C(84, 84, 96));
    for (let i = 0; i < 900; i++) rect(flo, Math.floor(r() * L), FT + Math.floor(r() * 110), 2 + Math.floor(r() * 4), 1, r() < .5 ? C(60, 60, 72) : C(104, 104, 116));
    for (let x = 0; x < L; x += 64) rect(flo, x, FT + 58, 36, 3, C(232, 200, 64));
    for (let x = 30; x < L; x += 300) { rect(flo, x, FT - 12, 4, 14, C(52, 58, 50)); rect(flo, x - 4, FT - 16, 12, 5, C(72, 118, 56)); rect(flo, x - 3, FT - 20, 9, 5, C(94, 140, 66)); }
  } else {
    band(far, 0, FT, [0x0a0714, 0x140c22, 0x22122f, 0x34183c, 0x4a1e44]);
    for (let i = 0; i < 70; i++) rect(far, Math.floor(r() * farW), Math.floor(r() * 80), 1, 1, C(255, 240, 200));
    for (let x = 0; x < farW;) { const w = 26 + r() * 34, h = 54 + r() * 70; rect(far, x, FT - h, w, h, C(28, 20, 40)); for (let y = FT - h + 5; y < FT - 10; y += 6) for (let xx = x + 4; xx < x + w - 4; xx += 6) if (r() < .28) rect(far, xx, y, 2, 2, C(212, 163, 28)); x += w + 3; }
    for (let x = 0; x < midW; x += 128) {
      rect(mid, x, 18, 112, 132, C(22, 16, 30));
      rect(mid, x, 18, 112, 4, C(212, 163, 28));
      for (let c = 0; c < 4; c++) {
        rect(mid, x + 9 + c * 26, 28, 13, 112, C(38, 30, 46));
        rect(mid, x + 9 + c * 26, 28, 13, 2, C(212, 163, 28));
        rect(mid, x + 11 + c * 26, 34, 2, 100, C(54, 44, 64));
        rect(mid, x + 18 + c * 26, 34, 2, 100, C(28, 22, 36));
      }
      rect(mid, x + 40, 62, 32, 2, C(212, 163, 28));
      disc(mid, x + 56, 52, 8, C(240, 196, 60)); disc(mid, x + 56, 52, 5, C(22, 16, 30)); rect(mid, x + 53, 49, 6, 6, C(240, 196, 60));
    }
    rect(flo, 0, FT - 6, L, 6, C(212, 163, 28));
    rect(flo, 0, FT, L, 270 - FT, C(32, 26, 40));
    for (let y = FT + 8; y < 270; y += 12) { rect(flo, 0, y, L, 1, C(44, 36, 54)); for (let x = (y * 5) % 40; x < L; x += 40) rect(flo, x, y, 1, 12, C(44, 36, 54)); }
    rect(flo, 0, FT + 34, L, 1, C(212, 163, 28)); rect(flo, 0, FT + 78, L, 1, C(212, 163, 28));
    for (let x = 60; x < L; x += 190) { rect(flo, x, 96, 10, 54, C(34, 26, 44)); rect(flo, x - 3, 92, 16, 5, C(212, 163, 28)); rect(flo, x - 3, 148, 16, 4, C(212, 163, 28)); }
  }
  /* contact shadow strip under the play line so sprites sit on the floor */
  for (let x = 0; x < flo.w; x++) { rect(flo, x, FT, 1, 2, C(0, 0, 0)); }
  return { far: far, mid: mid, floor: flo, len: L };
};
})(globalThis.GG = globalThis.GG || {});
