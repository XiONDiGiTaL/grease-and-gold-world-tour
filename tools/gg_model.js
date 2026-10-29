/* 3D model contact sheet for art review.
   Usage: node tools/gg_model.js [scale] [ids]  */
const fs = require('fs');
require('../src/gg/core.js');
require('../src/gg/art.js');
require('../src/gg/model.js');
const { createCanvas } = require('@napi-rs/canvas');
const G = globalThis.GG, Art = G.Art;

const scale = Number(process.argv[2] || 2);
const ids = (process.argv[3] || 'ricky,vv,johnny').split(',');
const anims = ['idle', 'walk', 'a1', 'a2', 'special', 'hurt'];

const meta = { kits: {} };
const items = [];
for (const id of ids) {
  const built = Art.buildKit3D(id);
  meta.kits[id] = { anims: {} };
  for (const a of anims) {
    const an = built.anims[a];
    if (!an) continue;
    meta.kits[id].anims[a] = { frames: [] };
    an.frames.forEach((f, i) => {
      const key = id + ':' + a + ':' + i;
      meta.kits[id].anims[a].frames.push({ key });
      items.push({ key, frame: f });
    });
  }
  meta.kits[id].portrait = built.portrait;
}
const sheet = Art.pack(items);
const byKey = {};
sheet.placed.forEach(p => { byKey[p.key] = p; });

const cols = Math.max(...Object.values(meta.kits).map(k => Object.values(k.anims).reduce((n, a) => n + a.frames.length, 0)));
const cw = 132 * scale, ch = 116 * scale;
const C = createCanvas(cols * cw + 20, ids.length * ch + 16);
const ctx = C.getContext('2d');
ctx.imageSmoothingEnabled = false;
ctx.fillStyle = '#7b8a95'; ctx.fillRect(0, 0, C.width, C.height);
const atlas = createCanvas(sheet.w, sheet.h);
const actx = atlas.getContext('2d');
const img = actx.createImageData(sheet.w, sheet.h);
img.data.set(new Uint8Array(sheet.data.buffer, sheet.data.byteOffset, sheet.data.byteLength));
actx.putImageData(img, 0, 0);

ids.forEach((id, ri) => {
  let col = 0;
  ctx.fillStyle = ri % 2 ? '#73828d' : '#82919c';
  ctx.fillRect(0, ri * ch, C.width, ch);
  ctx.fillStyle = '#4d5a63'; ctx.fillRect(0, ri * ch + ch - 6, C.width, 2);
  Object.keys(meta.kits[id].anims).forEach(a => {
    meta.kits[id].anims[a].frames.forEach(f => {
      const p = byKey[f.key];
      const x = col * cw + cw - 82 + (p.ox) * scale;
      const y = ri * ch + (ch - 8) - 60 + (p.oy) * scale;
      ctx.drawImage(atlas, p.x, p.y, p.w, p.h, x, y, p.w * scale, p.h * scale);
      ctx.fillStyle = '#1b2228'; ctx.font = 'bold 12px sans-serif';
      ctx.fillText(a, col * cw + 6, ri * ch + 14);
      col++;
    });
  });
});
fs.writeFileSync('./docs/model_sheet.png', C.toBuffer('image/png'));
console.log('docs/model_sheet.png ' + C.width + 'x' + C.height);
