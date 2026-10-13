/* Frame-based kits: enemies built from the frames of the supplied enemy sheet (src/enemyart.js).
   Each animation is a sequence of those hand-drawn frames (feet on the shared ground anchor); boss/variant kits are palette recolours. */
(function (G) {
'use strict';
const S = G.Sprites, Buf = S.Buf, CELL = S.CELL, AX = S.AX, AY = S.AY, EA = G.ENEMYART;
const b64 = (s) => typeof atob !== 'undefined' ? atob(s) : Buffer.from(s, 'base64').toString('binary');
const HEIGHT = { guard: 84, exec: 84, brawler: 80, raider: 82, heavy: 82, ledger: 96, bigtony: 104, auditor: 98 };
const decoded = {};
function frameBuf(kit, name) {
  const key = kit + ':' + name; if (decoded[key]) return decoded[key];
  const K = EA.kits[kit], set = EA.sets[K.set], f = set.frames[name], pal = K.pal.map(h => { const n = parseInt(h, 16); return ((255 << 24) | ((n & 255) << 16) | (((n >> 8) & 255) << 8) | ((n >> 16) & 255)) >>> 0; });
  const bin = b64(f.d), b = new Buf(CELL, CELL), x0 = AX + f.x, y0 = AY + f.y;
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) { const v = bin.charCodeAt(y * f.w + x); if (v) b.set(x0 + x, y0 + y, pal[v - 1]); }
  b.outline(0xff261218 >>> 0); b.outline(0xff261218 >>> 0); return decoded[key] = b;
}
function sequence(list, n) { const out = []; for (let i = 0; i < n; i++) out.push(list[Math.min(list.length - 1, Math.floor(i * list.length / n))]); return out; }
function renderSheetKit(id, isPlayer) {
  const k = S.K[id], set = EA.sets[EA.kits[id].set].frames, has = (n) => !!set[n], names = Object.keys(set);
  const walk = names.filter(n => /^walk\d+$/.test(n)), atk = names.filter(n => /^atk\d+$/.test(n)), lie = names.filter(n => /^lie\d+$/.test(n)), hit = names.filter(n => /^hit\d+$/.test(n));
  const wseq = walk.length >= 2 ? (walk.length === 2 ? [walk[0], 'idle', walk[1], 'idle'] : walk) : ['idle', walk[0]];
  const A0 = atk[0], A1 = atk[atk.length - 1], L0 = lie[0], air = has('air') ? 'air' : L0;
  const spec = { idle: ['idle', 'idle', 'idle', 'idle'], walk: sequence(wseq, 8), run: sequence(wseq, 6), a1: ['idle', A0, A1, 'idle'], a2: ['idle', A1, A1, 'idle'], a3: ['idle', A0, A1, A1, 'idle'],
    hit: [hit[0], hit[hit.length - 1]], knock: [hit[0], air], down: [L0, L0], getup: [L0, hit[hit.length - 1], 'idle'], dead: [L0, L0], held: [hit[hit.length - 1]] };
  const frames = {}, rigs = {}, poses = {}; const fi = set.idle;
  for (const a of S.ENEMY_ANIMS) { frames[a] = spec[a].map(n => frameBuf(id, n)); rigs[a] = spec[a].map(n => { const f = set[n]; return { hip: [AX, AY], sh: [AX, AY - f.h * .5], head: [AX + f.x + f.w * .5, AY - f.h + Math.max(10, f.h * .14)], hand: [AX, AY] }; }); poses[a] = spec[a].map(() => ({ hip: [0, 25], lean: 0, head: 0, fF: [0, 0], fB: [0, 0], hF: [12, 37], hB: [6, 35], wang: 60, ext: 0 })); }
  return { id, kit: k, frames, rigs, poses };
}
S.renderSheetKit = renderSheetKit;
Object.keys(EA.kits).forEach(id => { const k = S.K[id]; if (!k) return; k.sheet = EA.kits[id].set; k.weapon = null; k.scale = HEIGHT[id] / 64; k.strideMul = 46; k.art = null; });
})(globalThis.GG = globalThis.GG || {});
