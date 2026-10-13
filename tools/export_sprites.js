// Renders every kit to assets/sprites/<id>.png (one animation per row) + <id>.json atlas, plus props/food/fx.
const fs = require('fs'), path = require('path'); const { createCanvas } = require('@napi-rs/canvas');
require('../src/foodart.js'); require('../src/rigart.js'); require('../src/sprites.js'); require('../src/rig.js'); require('../src/enemyart.js'); require('../src/sheetkit.js'); const S = globalThis.GG.Sprites, mk = (w, h) => createCanvas(w, h);
const out = path.join(__dirname, '..', 'assets', 'sprites'); fs.mkdirSync(out, { recursive: true });
const save = (cv, name) => fs.writeFileSync(path.join(out, name), cv.toBuffer('image/png'));
const ids = [...S.PLAYERS.map(i => [i, true]), ...S.ENEMIES.map(i => [i, false])];
for (const [id, isP] of ids) {
  const rk = S.renderKit(id, isP), sh = S.packRows(rk, mk);
  save(sh.canvas, id + '.png');
  fs.writeFileSync(path.join(out, id + '.json'), JSON.stringify({ cell: S.CELL, anchor: [S.AX, S.AY], cols: S.COLS, anims: sh.rows, timing: S.TIMING }, null, 1));
  save(S.portrait(rk).toCanvas(mk), id + '_portrait.png');
}
['crate', 'barrel', 'bin', 'boxes'].forEach(t => save(S.makeProp(t).toCanvas(mk), 'prop_' + t + '.png'));
['adana', 'shish', 'doner', 'lahmacun', 'kunefe', 'spit'].forEach(t => save(S.makeFood(t).toCanvas(mk), 'food_' + t + '.png'));
save(S.makeEmptyPlate().toCanvas(mk), 'food_empty.png');
const fx = S.makeFx(); fx.spark.forEach((b, i) => save(b.toCanvas(mk), 'fx_spark' + i + '.png')); fx.boom.forEach((b, i) => save(b.toCanvas(mk), 'fx_boom' + i + '.png'));
console.log('exported', ids.length, 'kits');
