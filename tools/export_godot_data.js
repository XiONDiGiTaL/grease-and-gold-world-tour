// Exports the single source of truth (tables, atlases, backdrops, fx) for the Godot port.
const fs = require('fs'), path = require('path'); const { createCanvas } = require('@napi-rs/canvas');
['foodart', 'rigart', 'sprites', 'rig', 'enemyart', 'sheetkit', 'input', 'audio', 'stages', 'game'].forEach(n => require('../src/' + n + '.js'));
const G = globalThis.GG, S = G.Sprites; G.makeCanvas = (w, h) => createCanvas(w, h);
const root = path.join(__dirname, '..', 'godot'); const mk = (w, h) => createCanvas(w, h);
const atlas = {}; [...S.PLAYERS, ...S.ENEMIES].forEach(id => { const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'assets', 'sprites', id + '.json'))); atlas[id] = j.anims; fs.copyFileSync(path.join(__dirname, '..', 'assets', 'sprites', id + '.png'), path.join(root, 'assets', 'sprites', id + '.png')); fs.copyFileSync(path.join(__dirname, '..', 'assets', 'sprites', id + '_portrait.png'), path.join(root, 'assets', 'sprites', id + '_portrait.png')); });
const kits = {}; Object.keys(S.K).forEach(k => kits[k] = { scale: S.K[k].scale, name: S.K[k].name, strideMul: S.K[k].strideMul || 40 });
const data = { GS: S.GS, cell: S.CELL, anchor: [S.AX, S.AY], const: G.CONST, CH: G.CH, ED: G.ED, EM: G.EM, FOOD: G.FOOD, MV: G.MV, STAGES: G.STAGES, TIMING: S.TIMING, atlas, kits, players: S.PLAYERS, enemies: S.ENEMIES, help: null };
fs.writeFileSync(path.join(root, 'data', 'game_data.json'), JSON.stringify(data));
const save = (b, p) => fs.writeFileSync(path.join(root, 'assets', p), b.toCanvas(mk).toBuffer('image/png'));
['crate', 'barrel', 'bin', 'boxes'].forEach(t => save(S.makeProp(t), 'prop_' + t + '.png'));
['adana', 'shish', 'doner', 'lahmacun', 'kunefe', 'spit'].forEach(t => save(S.makeFood(t), 'food_' + t + '.png')); save(S.makeEmptyPlate(), 'food_empty.png');
const fx = S.makeFx(); fx.spark.forEach((b, i) => save(b, 'fx_spark' + i + '.png')); fx.boom.forEach((b, i) => save(b, 'fx_boom' + i + '.png')); fx.dust.forEach((b, i) => save(b, 'fx_dust' + i + '.png')); fx.sparkle.forEach((b, i) => save(b, 'fx_sparkle' + i + '.png')); save(fx.ko, 'fx_ko.png'); save(fx.glow, 'fx_glow.png');
G.STAGES.forEach((st, i) => { const bg = G.buildBackdrop(st, i); ['far', 'mid', 'floor'].forEach(l => fs.writeFileSync(path.join(root, 'assets', 'bg', `stage${i}_${l}.png`), bg[l].toBuffer('image/png'))); });
console.log('godot data exported');
