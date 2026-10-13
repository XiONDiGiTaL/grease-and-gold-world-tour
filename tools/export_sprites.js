// Renders every kit to assets/sprites/: <id>.png + <id>.json (trimmed-frame atlas, same packer the game uses),
// <id>_rows.png (artist sheet, one animation per row, full 360x360 cells), portraits, props, food, FX.
const fs = require('fs'), path = require('path'); const { createCanvas } = require('@napi-rs/canvas');
['foodart', 'rigart', 'sprites', 'rig', 'enemyart', 'sheetkit'].forEach(n => require('../src/' + n + '.js'));
const S = globalThis.GG.Sprites, mk = (w, h) => createCanvas(w, h);
const out = path.join(__dirname, '..', 'assets', 'sprites'); fs.mkdirSync(out, { recursive: true });
const save = (cv, name) => fs.writeFileSync(path.join(out, name), cv.toBuffer('image/png'));
const ids = [...S.PLAYERS.map(i => [i, true]), ...S.ENEMIES.map(i => [i, false])];
for (const [id, isP] of ids) {
  const rk = S.renderKit(id, isP), at = S.pack(rk, mk);
  save(at.canvas, id + '.png'); fs.writeFileSync(path.join(out, id + '.json'), JSON.stringify({ cell: S.CELL, anchor: [S.AX, S.AY], z: S.Z, frames: at.frames, timing: S.TIMING }));
  const rows = S.packRows(rk, mk); save(rows.canvas, id + '_rows.png');
  save(S.portrait(rk).toCanvas(mk), id + '_portrait.png');
}
['crate', 'barrel', 'bin', 'boxes'].forEach(t => save(S.makeProp(t).toCanvas(mk), 'prop_' + t + '.png'));
['adana', 'shish', 'doner', 'lahmacun', 'kunefe', 'spit'].forEach(t => save(S.makeFood(t).toCanvas(mk), 'food_' + t + '.png'));
const fx = S.makeFx(); fx.spark.forEach((b, i) => save(b.toCanvas(mk), 'fx_spark' + i + '.png')); fx.boom.forEach((b, i) => save(b.toCanvas(mk), 'fx_boom' + i + '.png'));
console.log('exported', ids.length, 'kits');
