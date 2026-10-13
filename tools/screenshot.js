// Renders real game frames headlessly to shots/*.png (for visual review).
const fs = require('fs'), path = require('path'); const { createCanvas } = require('@napi-rs/canvas');
['sprites', 'input', 'audio', 'stages', 'game', 'ui'].forEach(n => require('../src/' + n + '.js'));
const G = globalThis.GG, I = G.Input; G.makeCanvas = (w, h) => createCanvas(w, h);
const SC = 3, view = createCanvas(384 * SC, 216 * SC), low = createCanvas(384, 216);
const g = new G.Game(); g.initAssets(G.makeCanvas);
const out = (n) => fs.writeFileSync(path.join(__dirname, '..', 'shots', n + '.png'), view.toBuffer('image/png'));
const draw = () => { g.renderLow(low); g.renderUI(view, low); };
const step = (n) => { for (let i = 0; i < n; i++) g.update(); };
g.state = 'title'; g.t = 40; draw(); out('01_title');
g.state = 'select'; g.t = 30; draw(); out('02_select');
const stage = (si, ch, setup, name, ticks) => { I.clear(); g.startRun(ch); g.startStage(si); const p = g.players[0]; p.invuln = 0; setup(g, p); step(ticks || 0); draw(); out(name); };
stage(0, 'ricky', (g, p) => { g.banner = 0; p.x = 130; g.cam.x = 70; const a = g.makeEnemy('exec', 200, 175), b = g.makeEnemy('guard', 250, 160); a.state = b.state = 'idle'; a.cool = b.cool = 999; g.enemies.push(a, b); g.items.push({ type: 'adana', x: 170, y: 190, z: 0, life: 900, t: 5 }, { type: 'shish', x: 330, y: 150, z: 0, life: 900, t: 30 }); }, '03_stage1_ricky', 1);
stage(1, 'vv', (g, p) => { g.banner = 0; p.x = 150; p.y = 180; g.cam.x = 90; const a = g.makeEnemy('brawler', 215, 178); a.state = 'idle'; a.cool = 999; g.enemies.push(a); I.set('attack', true); }, '04_stage2_vv_attack', 8); I.clear();
stage(2, 'johnny', (g, p) => { g.banner = 0; p.x = 150; p.y = 170; g.cam.x = 90; ['raider', 'heavy'].forEach((t, i) => { const e = g.makeEnemy(t, 210 + i * 70, 165 + i * 18); e.state = 'idle'; e.cool = 999; g.enemies.push(e); }); g.items.push({ type: 'doner', x: 120, y: 195, z: 0, life: 900, t: 12 }, { type: 'lahmacun', x: 300, y: 190, z: 0, life: 900, t: 40 }); }, '05_stage3_johnny', 1);
stage(3, 'ricky', (g, p) => { g.banner = 0; p.x = 150; p.y = 172; g.cam.x = 90; const e = g.makeEnemy('auditor', 230, 172); e.state = 'idle'; e.cool = 999; g.enemies.push(e); g.hp = 0; }, '06_stage4_auditor', 1);
// special in action + hit sparks
stage(0, 'vv', (g, p) => { g.banner = 0; p.x = 150; p.y = 172; g.cam.x = 90; p.hype = 80; for (let i = 0; i < 3; i++) { const e = g.makeEnemy('guard', 175 + i * 22, 160 + i * 12); e.state = 'idle'; e.cool = 999; e.hp = e.maxhp = 500; g.enemies.push(e); } I.set('special', true); }, '07_vv_special', 20); I.clear();
stage(0, 'johnny', (g, p) => { g.banner = 0; p.x = 150; p.y = 172; g.cam.x = 90; p.hype = 80; const e = g.makeEnemy('heavy', 200, 172); e.state = 'idle'; e.cool = 999; g.enemies.push(e); I.set('special', true); }, '08_johnny_special', 30); I.clear();
// hud: boss bar + hit combo
stage(1, 'ricky', (g, p) => { g.banner = 0; p.x = 150; p.y = 172; g.cam.x = 90; const e = g.makeEnemy('bigtony', 235, 172); e.state = 'idle'; e.cool = 999; e.hp = 220; g.enemies.push(e); g.combo = { n: 5, t: 90, pop: 0 }; g.score = 4200; p.hp = 62; p.hype = 55; }, '09_boss_hud', 1);
// pause
g.state = 'pause'; g.menu = 2; g.showHelp = true; draw(); out('10_pause');
g.state = 'gameover'; draw(); out('11_gameover');
console.log('shots done');
