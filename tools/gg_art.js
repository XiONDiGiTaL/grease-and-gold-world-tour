/* Builds the production sprite atlases + a contact sheet for art review.
   Usage: node tools/gg_art.js [--sheet]  */
const fs = require('fs');
const path = require('path');
require('../src/gg/core.js');
require('../src/gg/art.js');
const USE_3D = process.argv.includes('--3d');
if (USE_3D) require('../src/gg/model.js');
const { createCanvas } = require('@napi-rs/canvas');
const G = globalThis.GG, Art = G.Art;
const buildKit = USE_3D ? Art.buildKit3D : Art.buildKit;

const outDir = path.join(__dirname, '..', 'assets', 'gg');
fs.mkdirSync(outDir, { recursive: true });

const t0 = Date.now();
const kits = [...Art.HEROES, ...Art.ENEMIES];
const built = {};
for (const id of kits) {
  built[id] = buildKit(id);
  process.stdout.write('built ' + id + ' ');
}
console.log('\nkit render: ' + (Date.now() - t0) + 'ms');

/* pack all fighter frames into one atlas */
const items = [], meta = { version: 2, kits: {} };
for (const id of kits) {
  const k = built[id];
  const entry = { id: k.id, name: k.name, kind: k.kind, anims: {} };
  for (const a of Object.keys(k.anims)) {
    const an = k.anims[a];
    entry.anims[a] = { timing: an.timing, frames: [] };
    an.frames.forEach((f, i) => {
      const key = id + ':' + a + ':' + i;
      items.push({ key, frame: f });
      entry.anims[a].frames.push({ key });
    });
  }
  items.push({ key: id + ':portrait', frame: k.portrait });
  entry.portrait = id + ':portrait';
  meta.kits[id] = entry;
}
const sheet = Art.pack(items);
const byKey = {};
sheet.placed.forEach(p => { byKey[p.key] = { x: p.x, y: p.y, w: p.w, h: p.h, ox: p.ox, oy: p.oy }; });
for (const id of kits) {
  for (const a of Object.keys(meta.kits[id].anims)) meta.kits[id].anims[a].frames =
    meta.kits[id].anims[a].frames.map(f => Object.assign({}, byKey[f.key]));
  meta.kits[id].portrait = Object.assign({}, byKey[meta.kits[id].portrait]);
}
fs.writeFileSync(path.join(outDir, 'fighters.png'), Art.encodePng(sheet));
fs.writeFileSync(path.join(outDir, 'fighters.json'), JSON.stringify(meta));

/* props + food + fx atlas */
const pItems = [], pMeta = { props: {}, food: {}, fx: {} };
const props = Art.buildProps(), food = Art.buildFood(), fx = Art.buildFx();
Object.keys(props).forEach(k => { pItems.push({ key: 'prop:' + k, frame: props[k] }); pMeta.props[k] = 'prop:' + k; });
Object.keys(food).forEach(k => { pItems.push({ key: 'food:' + k, frame: food[k] }); pMeta.food[k] = 'food:' + k; });
Object.keys(fx).forEach(k => fx[k].forEach((f, i) => { pItems.push({ key: 'fx:' + k + ':' + i, frame: f }); }));
const pSheet = Art.pack(pItems);
const pBy = {}; pSheet.placed.forEach(p => { pBy[p.key] = { x: p.x, y: p.y, w: p.w, h: p.h, ox: p.ox, oy: p.oy }; });
Object.keys(pMeta.props).forEach(k => pMeta.props[k] = pBy[pMeta.props[k]]);
Object.keys(pMeta.food).forEach(k => pMeta.food[k] = pBy[pMeta.food[k]]);
pMeta.fx = {};
Object.keys(fx).forEach(k => { pMeta.fx[k] = fx[k].map((f, i) => pBy['fx:' + k + ':' + i]); });
fs.writeFileSync(path.join(outDir, 'props.png'), Art.encodePng(pSheet));
fs.writeFileSync(path.join(outDir, 'props.json'), JSON.stringify(pMeta));

/* stage layers */
require('../src/gg/stages.js');
const stageInfo = [];
for (let i = 0; i < globalThis.GG.STAGES.length; i++) {
  const s = globalThis.GG.buildStage(i);
  ['far', 'mid', 'floor'].forEach(layer => {
    fs.writeFileSync(path.join(outDir, 'stage' + i + '_' + layer + '.png'), Art.encodePng({ w: s[layer].w, h: s[layer].h, data: s[layer].d }));
  });
  stageInfo.push({ id: i, name: globalThis.GG.STAGES[i].name, len: s.len });
  console.log('stage ' + i + ' ' + s.far.w + 'x' + s.far.h + ' / ' + s.mid.w + ' / ' + s.floor.w);
}
fs.writeFileSync(path.join(outDir, 'stages.json'), JSON.stringify(stageInfo));

console.log('fighters.png ' + sheet.w + 'x' + sheet.h + '  props.png ' + pSheet.w + 'x' + pSheet.h);

/* contact sheet: every animation of the three heroes, scaled 2x, on a dark grid */
if (process.argv.includes('--sheet')) {
  const allAnim = ['idle', 'walk', 'a1', 'a2', 'a3', 'special', 'jump', 'jatk', 'jdown', 'grab', 'throw', 'hurt', 'knock', 'down', 'getup', 'win'];
  const cellW = 78, cellH = 74, cols = 8, rows = Math.ceil(allAnim.length / cols);
  const per = 3, sheetW = cols * cellW * per + 140, sheetH = kits.length * 0;
  const C2 = createCanvas(3 * (cols * cellW) + 30, allAnim.length * cellH + 20);
  const ctx = C2.getContext('2d');
  ctx.fillStyle = '#1b1424'; ctx.fillRect(0, 0, C2.width, C2.height);
  ctx.imageSmoothingEnabled = false;
  const atlas = createCanvas(sheet.w, sheet.h);
  const actx = atlas.getContext('2d');
  const img = actx.createImageData(sheet.w, sheet.h);
  img.data.set(new Uint8Array(sheet.data.buffer, sheet.data.byteOffset, sheet.data.byteLength));
  actx.putImageData(img, 0, 0);
  ['ricky', 'vv', 'johnny'].forEach((id, hi) => {
    allAnim.forEach((a, ri) => {
      const m = meta.kits[id].anims[a]; if (!m) return;
      m.frames.forEach((f, fi) => {
        const bx = hi * (cols * cellW) + 10 + fi * cellW;
        const by = 10 + ri * cellH;
        const x = bx + cellW / 2 + f.ox;
        const y = by + cellH - 12 + f.oy;
        ctx.drawImage(atlas, f.x, f.y, f.w, f.h, x, y, f.w, f.h);
      });
      ctx.fillStyle = '#8f84a3'; ctx.font = '9px sans-serif';
      ctx.fillText(id + ' ' + a, hi * (cols * cellW) + 4, 10 + ri * cellH + 4);
    });
  });
  fs.writeFileSync(path.join(__dirname, '..', 'docs', 'art_sheet.png'), C2.toBuffer('image/png'));
  console.log('docs/art_sheet.png written');
}
