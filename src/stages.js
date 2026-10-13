/* Stage data (waves, props, tokens) + procedural parallax backdrops (far / mid / floor layers). */
(function (G) {
'use strict';
const GW = 384, GH = 216, FLOOR_TOP = 134, FLOOR_BOT = 204;
G.GW = GW; G.GH = GH; G.FLOOR_TOP = FLOOR_TOP; G.FLOOR_BOT = FLOOR_BOT;
G.STAGES = [
  { name: 'Skyline Plaza', tour: 'WORLD TOUR  -  STOP 1', len: 1700, theme: 'plaza', tokens: 2,
    waves: [{ x: 200, e: [['exec', 'R'], ['guard', 'R']] }, { x: 560, e: [['guard', 'L'], ['guard', 'R'], ['exec', 'R']] }, { x: 930, e: [['exec', 'R'], ['exec', 'L'], ['heavy', 'R']] }, { x: 1290, boss: true, e: [['ledger', 'R', 0], ['guard', 'L', 240], ['guard', 'R', 360]] }],
    props: [['crate', 330, 170], ['barrel', 470, 150], ['bin', 760, 180], ['crate', 1060, 160], ['barrel', 1180, 190], ['boxes', 1480, 160]] },
  { name: 'Harbor Docks', tour: 'WORLD TOUR  -  STOP 2', len: 1900, theme: 'docks', tokens: 2,
    waves: [{ x: 200, e: [['brawler', 'R'], ['brawler', 'R'], ['brawler', 'L']] }, { x: 590, e: [['guard', 'R'], ['guard', 'L'], ['brawler', 'R'], ['brawler', 'L']] }, { x: 980, e: [['heavy', 'R'], ['brawler', 'L'], ['brawler', 'R']] }, { x: 1340, e: [['exec', 'R'], ['exec', 'L'], ['brawler', 'R'], ['raider', 'L']] }, { x: 1590, boss: true, e: [['bigtony', 'R', 0], ['brawler', 'L', 300]] }],
    props: [['crate', 300, 160], ['boxes', 520, 185], ['barrel', 760, 150], ['barrel', 860, 190], ['crate', 1130, 175], ['bin', 1250, 160], ['boxes', 1520, 190]] },
  { name: 'Ashfall Pass', tour: 'WORLD TOUR  -  STOP 3', len: 2000, theme: 'pass', tokens: 3,
    waves: [{ x: 220, e: [['raider', 'R'], ['raider', 'L'], ['brawler', 'R']] }, { x: 620, e: [['raider', 'R'], ['raider', 'R'], ['raider', 'L']] }, { x: 1000, e: [['heavy', 'R'], ['raider', 'L'], ['raider', 'R'], ['brawler', 'L']] }, { x: 1400, e: [['raider', 'R'], ['raider', 'L'], ['raider', 'R'], ['heavy', 'L']] }, { x: 1690, boss: true, e: [['mara', 'R', 0], ['raider', 'L', 240], ['raider', 'R', 360]] }],
    props: [['barrel', 340, 170], ['crate', 560, 150], ['barrel', 800, 190], ['boxes', 1100, 160], ['barrel', 1250, 180], ['crate', 1500, 165]] },
  { name: 'Gold Tower', tour: 'WORLD TOUR  -  FINAL STOP', len: 2200, theme: 'tower', tokens: 3,
    waves: [{ x: 220, e: [['exec', 'R'], ['exec', 'L'], ['guard', 'R'], ['guard', 'L']] }, { x: 600, e: [['heavy', 'R'], ['raider', 'L'], ['raider', 'R']] }, { x: 980, e: [['brawler', 'R'], ['brawler', 'L'], ['brawler', 'R'], ['exec', 'L'], ['exec', 'R']] }, { x: 1380, e: [['heavy', 'R'], ['heavy', 'L'], ['guard', 'R'], ['guard', 'L']] }, { x: 1890, boss: true, e: [['auditor', 'R', 0], ['guard', 'L', 400]] }],
    props: [['crate', 360, 160], ['bin', 560, 190], ['boxes', 820, 170], ['barrel', 1150, 150], ['crate', 1300, 185], ['bin', 1650, 165]] }
];
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const mkc = (w, h) => G.makeCanvas(w, h);
function bands(c, y0, y1, cols, w) { const n = cols.length, h = (y1 - y0) / n; cols.forEach((col, i) => { c.fillStyle = col; c.fillRect(0, Math.floor(y0 + i * h), w, Math.ceil(h) + 1); }); }
function windows(c, x, y, w, h, on, off, r, gap) { for (let yy = y + 4; yy < y + h - 4; yy += gap) for (let xx = x + 4; xx < x + w - 4; xx += gap) { c.fillStyle = r() < .3 ? on : off; c.fillRect(xx, yy, gap - 3, gap - 3); } }
G.buildBackdrop = function (st, idx) {
  const L = st.len, r = rng(77 + idx * 31), farW = Math.ceil(GW + (L - GW) * .2), midW = Math.ceil(GW + (L - GW) * .5);
  const far = mkc(farW, GH), mid = mkc(midW, GH), flo = mkc(L, GH), f = far.getContext('2d'), m = mid.getContext('2d'), g = flo.getContext('2d');
  [f, m, g].forEach(c => c.imageSmoothingEnabled = false);
  const T = st.theme;
  if (T === 'plaza') {
    bands(f, 0, 132, ['#4f66b8', '#6578c4', '#8088cc', '#a090c4', '#c898b0', '#e8a89a', '#f4bb90', '#f8cc92'], farW);
    f.fillStyle = '#ffe9b0'; f.beginPath(); f.arc(farW * .6, 108, 18, 0, 7); f.fill();
    for (let x = 0, k = 0; x < farW; k++) { const w = 18 + r() * 26, h = 40 + r() * 70; f.fillStyle = k % 2 ? '#8f86b6' : '#7d74a6'; f.fillRect(x, 132 - h, w, h); for (let y = 132 - h + 4; y < 128; y += 6) if (r() < .5) { f.fillStyle = '#c9c0e0'; f.fillRect(x + 3 + Math.floor(r() * (w - 6)), y, 2, 2); } x += w + 2; }
    for (let x = 0; x < midW; ) { const w = 46 + r() * 40, h = 70 + r() * 36; m.fillStyle = '#2b4565'; m.fillRect(x, 134 - h, w, h); m.fillStyle = '#3a5b82'; m.fillRect(x, 134 - h, 3, h); windows(m, x, 134 - h, w, h - 22, '#f6e08a', '#74b9de', r, 9); m.fillStyle = '#1b2d44'; m.fillRect(x + w / 2 - 9, 134 - 22, 18, 22); m.fillStyle = '#74b9de'; m.fillRect(x + w / 2 - 7, 134 - 20, 6, 20); m.fillRect(x + w / 2 + 1, 134 - 20, 6, 20); m.fillStyle = '#d4a31c'; m.fillRect(x + 2, 134 - h + 3, w - 4, 3); x += w + 4 + r() * 20; if (r() < .6) { m.fillStyle = '#5b3b24'; m.fillRect(x + 6, 118, 3, 16); m.fillStyle = '#3f8a3a'; m.fillRect(x, 102, 15, 18); m.fillStyle = '#58a84a'; m.fillRect(x + 2, 104, 8, 8); x += 24; } }
    g.fillStyle = '#c4bcad'; g.fillRect(0, FLOOR_TOP - 6, L, GH); g.fillStyle = '#9f988a'; g.fillRect(0, FLOOR_TOP - 6, L, 6); g.fillStyle = '#b4ad9e'; g.fillRect(0, FLOOR_TOP - 2, L, 2);
    [140, 150, 162, 176, 192, 210].forEach((y, i, a) => { g.fillStyle = '#a9a294'; g.fillRect(0, y, L, 1); const sp = 34 + i * 6, nxt = a[i + 1] || 216; for (let x = (i % 2) * sp / 2; x < L; x += sp) g.fillRect(Math.floor(x), y, 1, nxt - y); });
    for (let x = 80; x < L; x += 260 + r() * 140) { g.fillStyle = '#6a5a48'; g.fillRect(x, FLOOR_TOP - 16, 34, 12); g.fillStyle = '#3f8a3a'; g.fillRect(x + 2, FLOOR_TOP - 22, 30, 7); g.fillStyle = '#58a84a'; g.fillRect(x + 6, FLOOR_TOP - 24, 8, 4); }
  } else if (T === 'docks') {
    bands(f, 0, 100, ['#141a44', '#1c2456', '#2a2f68', '#4a3a78', '#7a4a84', '#b0607c', '#e08a6a'], farW);
    f.fillStyle = '#fff2c4'; for (let i = 0; i < 40; i++) f.fillRect(Math.floor(r() * farW), Math.floor(r() * 60), 1, 1);
    f.fillStyle = '#1f3a68'; f.fillRect(0, 100, farW, 32); for (let i = 0; i < 90; i++) { f.fillStyle = '#4a6aa0'; f.fillRect(Math.floor(r() * farW), 102 + Math.floor(r() * 28), 6 + Math.floor(r() * 8), 1); }
    for (let x = 30; x < farW; x += 170 + r() * 90) { f.fillStyle = '#0c0f2a'; f.fillRect(x, 30, 4, 70); f.fillRect(x - 40, 34, 84, 4); f.fillRect(x - 40, 34, 3, 22); f.fillRect(x + 30, 38, 1, 18); }
    for (let x = 0; x < midW; ) { const w = 72 + r() * 40; const cols = ['#b03a2e', '#2e6ab0', '#d4a31c', '#2f8a5a', '#8a3a8a']; const stack = 1 + Math.floor(r() * 3); for (let s = 0; s < stack; s++) { const c = cols[Math.floor(r() * cols.length)]; m.fillStyle = c; m.fillRect(x, 134 - (s + 1) * 24, w, 24); m.fillStyle = 'rgba(0,0,0,.25)'; for (let i = 0; i < w; i += 6) m.fillRect(x + i, 134 - (s + 1) * 24, 1, 24); m.fillStyle = 'rgba(255,255,255,.2)'; m.fillRect(x, 134 - (s + 1) * 24, w, 2); } x += w + 8; if (r() < .35) { m.fillStyle = '#4a4a58'; m.fillRect(x, 96, 70, 38); windows(m, x, 96, 70, 38, '#f6e08a', '#2a2f48', r, 8); x += 80; } }
    g.fillStyle = '#7a5a3a'; g.fillRect(0, FLOOR_TOP - 6, L, GH); g.fillStyle = '#4a3622'; g.fillRect(0, FLOOR_TOP - 6, L, 4); for (let y = FLOOR_TOP; y < GH; y += 9 + (y - FLOOR_TOP) / 18) { g.fillStyle = '#5c4228'; g.fillRect(0, Math.floor(y), L, 1); for (let x = (y * 7) % 60; x < L; x += 60 + (y % 23)) g.fillRect(Math.floor(x), Math.floor(y), 1, 9); } for (let x = 120; x < L; x += 300) { g.fillStyle = '#2a2a34'; g.fillRect(x, FLOOR_TOP - 12, 8, 14); g.fillStyle = '#c8c0a0'; g.fillRect(x - 1, FLOOR_TOP - 14, 10, 3); }
  } else if (T === 'pass') {
    bands(f, 0, 132, ['#3f78c0', '#5b92cc', '#82aad0', '#b0c0cc', '#e8d2a0', '#f6c880', '#f09a58'], farW);
    for (let k = 0; k < 2; k++) for (let x = -20; x < farW; ) { const w = 60 + r() * 90, h = 30 + r() * 40 + k * 10; f.fillStyle = k ? '#b86a4a' : '#d08a60'; f.fillRect(x + 8, 132 - h, w - 16, h); f.fillRect(x, 132 - h + 12, w, h); f.fillStyle = 'rgba(0,0,0,.18)'; f.fillRect(x + w / 2, 132 - h, w / 2, h); x += w - 10; }
    m.fillStyle = '#8a5a3a'; for (let x = 0; x < midW; ) { const w = 40 + r() * 70, h = 50 + r() * 50; m.fillRect(x, 134 - h, w, h); m.fillStyle = '#6a4228'; for (let y = 134 - h + 8; y < 134; y += 9) m.fillRect(x, y, w, 2); m.fillStyle = '#a56f48'; m.fillRect(x, 134 - h, w, 3); m.fillStyle = '#8a5a3a'; x += w + r() * 12; }
    for (let x = 0; x < midW; x += 20) { m.fillStyle = '#9aa3b2'; m.fillRect(x, 120, 2, 14); } m.fillStyle = '#b4bcc8'; m.fillRect(0, 122, midW, 3); m.fillRect(0, 128, midW, 3);
    for (let x = 140; x < midW; x += 420) { m.fillStyle = '#3a3a44'; m.fillRect(x + 20, 88, 3, 34); m.fillRect(x + 66, 88, 3, 34); m.fillStyle = '#d0402f'; m.fillRect(x, 60, 90, 30); m.fillStyle = '#f6d060'; m.fillRect(x + 4, 64, 82, 4); m.fillRect(x + 14, 74, 40, 3); }
    g.fillStyle = '#4c4c56'; g.fillRect(0, FLOOR_TOP - 6, L, GH); g.fillStyle = '#b89a6a'; g.fillRect(0, FLOOR_TOP - 6, L, 6); for (let i = 0; i < 400; i++) { g.fillStyle = r() < .5 ? '#5a5a66' : '#3c3c46'; g.fillRect(Math.floor(r() * L), FLOOR_TOP + Math.floor(r() * 80), 2 + Math.floor(r() * 4), 1); }
    for (let x = 0; x < L; x += 60) { g.fillStyle = '#e8c840'; g.fillRect(x, 172, 34, 3); } g.fillStyle = '#e8e8e8'; g.fillRect(0, 205, L, 2); g.fillStyle = 'rgba(0,0,0,.35)'; for (let x = 100; x < L; x += 330) { g.fillRect(x, 150 + (x % 40), 50, 1); g.fillRect(x + 20, 151 + (x % 40), 1, 12); }
  } else {
    bands(f, 0, 132, ['#0a0818', '#150f2c', '#22163e', '#331f52', '#4a2860', '#68306e'], farW);
    for (let i = 0; i < 70; i++) { f.fillStyle = '#fff2c4'; f.fillRect(Math.floor(r() * farW), Math.floor(r() * 70), 1, 1); }
    for (let x = 0, k = 0; x < farW; k++) { const w = 20 + r() * 30, h = 50 + r() * 70; f.fillStyle = k % 2 ? '#1c1430' : '#241a3c'; f.fillRect(x, 132 - h, w, h); for (let y = 132 - h + 4; y < 128; y += 5) for (let xx = x + 3; xx < x + w - 3; xx += 5) if (r() < .35) { f.fillStyle = '#d4a31c'; f.fillRect(xx, y, 2, 2); } x += w + 2; }
    for (let x = 0; x < midW; ) { const w = 120; m.fillStyle = '#16121f'; m.fillRect(x, 20, w, 114); m.fillStyle = '#d4a31c'; m.fillRect(x, 20, w, 3); m.fillRect(x, 130, w, 4); for (let c = 0; c < 4; c++) { m.fillStyle = '#242030'; m.fillRect(x + 8 + c * 28, 28, 14, 100); m.fillStyle = '#d4a31c'; m.fillRect(x + 8 + c * 28, 28, 14, 2); m.fillRect(x + 8 + c * 28, 124, 14, 3); m.fillStyle = '#34304a'; m.fillRect(x + 10 + c * 28, 32, 2, 90); } m.fillStyle = '#f0c43c'; m.beginPath(); m.arc(x + 60, 58, 14, 0, 7); m.fill(); m.fillStyle = '#16121f'; m.beginPath(); m.arc(x + 60, 58, 10, 0, 7); m.fill(); m.fillStyle = '#f0c43c'; m.fillRect(x + 56, 54, 8, 8); x += w + 6; }
    g.fillStyle = '#1e1a28'; g.fillRect(0, FLOOR_TOP - 6, L, GH); g.fillStyle = '#d4a31c'; g.fillRect(0, FLOOR_TOP - 6, L, 3); for (let y = FLOOR_TOP; y < GH; y += 12 + (y - FLOOR_TOP) / 10) { g.fillStyle = '#2c2638'; g.fillRect(0, Math.floor(y), L, 1); for (let x = ((y * 5) % 40); x < L; x += 40) g.fillRect(Math.floor(x), Math.floor(y), 1, 14); } g.fillStyle = '#d4a31c'; g.fillRect(0, 169, L, 1); g.fillRect(0, 203, L, 1); g.strokeStyle = '#d4a31c'; g.lineWidth = 2; g.beginPath(); g.ellipse(L - 220, 170, 90, 28, 0, 0, 7); g.stroke();
  }
  const R_=(c,x,y,w,h,col)=>{ c.fillStyle=col; c.fillRect(Math.round(x),Math.round(y),w,h); };
  const lamp=(x,glow)=>{ R_(g,x,96,3,38,'#23202e'); R_(g,x-7,92,17,4,'#23202e'); R_(g,x-5,96,13,2,glow); g.fillStyle=glow.replace(')',',.18)').replace('rgb','rgba'); };
  if (T === 'plaza') {
    for (let x = 30; x < midW; x += 160 + r() * 70) { const w = 74, awn = ['#d8402f', '#f4e8c8']; R_(m, x, 96, w, 38, '#2a2438'); for (let i = 0; i < w; i += 6) R_(m, x + i, 94, 6, 9, awn[(i / 6) & 1]); R_(m, x, 103, w, 2, '#1a1424'); R_(m, x + 5, 108, w - 10, 24, '#ffd88a'); R_(m, x + 5, 108, w - 10, 3, '#b0801e'); for (let i = 0; i < 4; i++) R_(m, x + 10 + i * 16, 116, 8, 14, i % 2 ? '#8a5a3a' : '#c8884a'); R_(m, x + w / 2 - 14, 86, 28, 7, '#1a1424'); R_(m, x + w / 2 - 12, 88, 24, 3, '#f0c43c'); }
    for (let x = 90; x < L; x += 230 + r() * 40) { lamp(x, 'rgb(255,233,160)'); }
    for (let x = 300; x < L; x += 520) { for (let i = 0; i < 44; i += 8) R_(g, x + i, 172, 5, 28, '#ece6d6'); }
    for (let x = 180; x < L; x += 410) { R_(g, x, 188, 14, 6, '#2c2c34'); R_(g, x + 1, 189, 12, 1, '#555563'); }
    for (let x = 60; x < L; x += 300) R_(g, x, 126, 6, 8, '#c8321f');
  } else if (T === 'docks') {
    R_(g, 0, 118, L, 3, '#2a1c10'); for (let x = 0; x < L; x += 24) R_(g, x, 108, 3, 12, '#2a1c10'); R_(g, 0, 108, L, 2, '#3a281a');
    for (let x = 140; x < L; x += 260) { R_(g, x, 90, 3, 30, '#23202e'); R_(g, x - 2, 86, 7, 5, '#f6e08a'); R_(g, x - 5, 91, 13, 3, 'rgba(246,224,138,.25)'); }
    for (let x = 60; x < L; x += 330) { g.fillStyle = '#b89a6a'; g.beginPath(); g.ellipse(x, 126, 9, 4, 0, 0, 7); g.fill(); g.fillStyle = '#8a6c3c'; g.beginPath(); g.ellipse(x, 124, 6, 2.5, 0, 0, 7); g.fill(); }
  } else if (T === 'pass') {
    for (let x = 60; x < midW; x += 230) { R_(m, x, 70, 3, 64, '#2a2430'); R_(m, x - 14, 74, 31, 2, '#2a2430'); R_(m, x - 12, 79, 27, 2, '#2a2430'); }
    m.strokeStyle = '#2a2430'; m.lineWidth = 1; for (let x = 60; x < midW - 230; x += 230) { m.beginPath(); m.moveTo(x + 17, 75); m.quadraticCurveTo(x + 115, 92, x + 213, 75); m.stroke(); }
    for (let x = 120; x < L; x += 340) { R_(g, x, 116, 4, 18, '#3a7a3a'); R_(g, x - 5, 120, 4, 8, '#3a7a3a'); R_(g, x + 4, 118, 4, 8, '#3a7a3a'); R_(g, x - 5, 126, 12, 2, '#3a7a3a'); }
    for (let x = 200; x < L; x += 500) { R_(g, x, 108, 2, 26, '#8a8a96'); R_(g, x - 7, 100, 16, 12, '#e8c840'); R_(g, x - 5, 102, 12, 8, '#2a2a32'); }
  } else {
    for (let x = 60; x < L; x += 200) { R_(g, x, 70, 9, 64, '#2a2438'); R_(g, x - 2, 66, 13, 5, '#d4a31c'); R_(g, x - 2, 130, 13, 4, '#d4a31c'); R_(g, x + 3, 80, 3, 5, '#f6d060'); R_(g, x + 3, 96, 3, 5, '#f6d060'); R_(g, x + 3, 112, 3, 5, '#f6d060'); }
    R_(g, 0, 168, L, 36, 'rgba(120,20,30,.35)'); for (let x = 0; x < L; x += 90) R_(g, x, 168, 2, 36, 'rgba(212,163,28,.4)');
  }
  return { far, mid, floor: flo };
};
})(globalThis.GG = globalThis.GG || {});
