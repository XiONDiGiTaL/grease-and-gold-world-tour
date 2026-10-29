/* Builds the production fighter atlas from the approved sprite sheets in
   assets/sprites (frame tables + packed PNGs + portraits).
   Run: node tools/gg_import.js
   Output: assets/gg/fighters.png + assets/gg/fighters.json (engine format). */
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

const root = path.join(__dirname, '..');
const spriteDir = path.join(root, 'assets', 'sprites');
const outDir = path.join(root, 'assets', 'gg');

/* source sheet -> engine kit id. Every playable and enemy kit the simulation
   references must exist here or it renders invisible. */
const KITS = [
  ['ricky', 'ricky'], ['vv', 'vv'], ['johnny', 'johnny'],
  ['jooce', 'guard'], ['hobo', 'brawler'], ['turd', 'exec'],
  ['heavy', 'heavy'], ['ledger', 'ledger'], ['bigtony', 'bigtony'],
  ['mara', 'mara'], ['auditor', 'auditor'],
];
const S = 0.34;              /* source frames are ~210 px tall, the world is ~74 */
const MAXW = 1024;
const PAD = 2;
const PORTRAIT = 44;

const sheets = {};
for (const [kit, src] of KITS) {
  const jsonPath = path.join(spriteDir, src + '.json');
  if (!fs.existsSync(jsonPath)) { console.error('missing ' + jsonPath); process.exit(1); }
  sheets[kit] = { src: src, data: JSON.parse(fs.readFileSync(jsonPath, 'utf8')) };
}

/* ---- measure + shelf pack ---- */
const items = [];
const meta = { version: 3, kits: {} };
for (const [kit, src] of KITS) {
  const d = sheets[kit].data;
  const out = { id: kit, name: d.name || kit, kind: kit === 'ricky' || kit === 'vv' || kit === 'johnny' ? 'hero' : 'enemy', anims: {} };
  for (const anim in d.frames) {
    const name = anim === 'hit' ? 'hurt' : anim;
    const frames = d.frames[anim];
    const list = [];
    frames.forEach((f, i) => {
      const w = Math.max(1, Math.round(f.w * S)), h = Math.max(1, Math.round(f.h * S));
      const it = { kit: kit, src: src, anim: name, i: i, sx: f.x, sy: f.y, sw: f.w, sh: f.h,
        w: w, h: h, ox: Math.round(f.ox * S), oy: Math.round(f.oy * S) };
      items.push(it); list.push(it);
    });
    out.anims[name] = { timing: (d.timing && d.timing[anim]) || frames.map(() => 8), frames: list };
  }
  /* the engine expects a turn animation; the sheets express it with the idle
  frames, which the renderer mirrors per facing */
  if (!out.anims.turn) out.anims.turn = { timing: [6, 6], frames: out.anims.idle.frames.slice(0, 2) };
  out.portrait = { kit: kit, src: src, portrait: true, w: PORTRAIT, h: PORTRAIT };
  items.push(out.portrait);
  meta.kits[kit] = out;
}

let x = PAD, y = PAD, rowH = 0;
for (const it of items) {
  if (x + it.w + PAD > MAXW) { x = PAD; y += rowH + PAD; rowH = 0; }
  it.x = x; it.y = y;
  x += it.w + PAD; rowH = Math.max(rowH, it.h);
}
const W = MAXW, H = y + rowH + PAD;

/* ---- draw ---- */
(async () => {
  const canvas = createCanvas(W, H), ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const imgs = {};
  for (const [kit, s] of Object.entries(sheets)) {
    imgs[kit] = await loadImage(path.join(spriteDir, s.src + '.png'));
    const pp = path.join(spriteDir, s.src + '_portrait.png');
    if (fs.existsSync(pp)) imgs[kit + ':portrait'] = await loadImage(pp);
  }
  for (const it of items) {
    if (it.portrait) {
      const p = imgs[it.kit + ':portrait'];
      if (!p) { it.w = 1; it.h = 1; it.empty = true; continue; }
      ctx.drawImage(p, 0, 0, p.width, p.height, it.x, it.y, it.w, it.h);
    } else {
      ctx.drawImage(imgs[it.kit], it.sx, it.sy, it.sw, it.sh, it.x, it.y, it.w, it.h);
    }
  }
  /* write frame rects back into the JSON (positions only, dims already set) */
  for (const kit in meta.kits) {
    const k = meta.kits[kit];
    for (const anim in k.anims) {
      k.anims[anim].frames = k.anims[anim].frames.map(f => ({ x: f.x, y: f.y, w: f.w, h: f.h, ox: f.ox, oy: f.oy }));
    }
    k.portrait = { x: k.portrait.x, y: k.portrait.y, w: k.portrait.w, h: k.portrait.h };
  }
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'fighters.png'), canvas.toBuffer('image/png'));
  fs.writeFileSync(path.join(outDir, 'fighters.json'), JSON.stringify(meta));
  console.log('fighters.png ' + W + 'x' + H + ' | kits ' + KITS.length + ' | frames ' + (items.length - KITS.length));
})();
