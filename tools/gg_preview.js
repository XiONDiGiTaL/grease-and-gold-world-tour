/* Art review sheet: node tools/gg_preview.js [scale] [ids] [anims] */
const fs = require('fs');
require('../src/gg/core.js');
require('../src/gg/art.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const meta = require('../assets/gg/fighters.json');

const scale = Number(process.argv[2] || 4);
const ids = (process.argv[3] || 'ricky,vv,johnny,jooce,hobo,turd,heavy,ledger').split(',');
const anims = (process.argv[4] || 'idle,walk,a1,a2,a3,special').split(',');

(async () => {
  const img = await loadImage('./assets/gg/fighters.png');
  const cw = 104 * scale, ch = 108 * scale;
  const cols = anims.length * 5 + 1;
  const C = createCanvas(cols * cw * 0 + anims.length * 5 * cw + 20, ids.length * ch + 16);
  const ctx = C.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#7b8a95'; ctx.fillRect(0, 0, C.width, C.height);
  ids.forEach((id, ri) => {
    ctx.fillStyle = ri % 2 ? '#73828d' : '#82919c';
    ctx.fillRect(0, ri * ch, C.width, ch);
    ctx.fillStyle = '#4d5a63'; ctx.fillRect(0, ri * ch + ch - 28, C.width, 2);
    anims.forEach((a, ai) => {
      const an = meta.kits[id] && meta.kits[id].anims[a];
      if (!an) return;
      an.frames.forEach((f, fi) => {
        const bx = ai * 5 * cw + fi * cw + 8;
        const by = ri * ch;
        const x = bx + (cw - 8) / 2 + f.ox * scale;
        const y = by + ch - 28 + f.oy * scale;
        ctx.drawImage(img, f.x, f.y, f.w, f.h, x, y, f.w * scale, f.h * scale);
      });
      ctx.fillStyle = '#1b2228'; ctx.font = 'bold 13px sans-serif';
      ctx.fillText(id + '  ' + a, ai * 5 * cw + 8, ri * ch + 16);
    });
  });
  fs.writeFileSync('./docs/art_zoom.png', C.toBuffer('image/png'));
  console.log('docs/art_zoom.png ' + C.width + 'x' + C.height);
})();
