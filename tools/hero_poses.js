/* Dumps the engine's hero pose tables + timings so the offline hero compositor (tools/hero_render.py) animates exactly what the sim expects.
   node tools/hero_poses.js > build/hero_poses.json */
require('../src/gg/core.js'); require('../src/gg/art.js');
const G = globalThis.GG, Art = G.Art, T = Art._test, out = { anims: Art.ANIMS.hero, timing: {}, kits: {} };
Art.ANIMS.hero.forEach(a => { out.timing[a] = Art.TIMING[a]; });
Art.HEROES.forEach(id => {
  const kit = T.KITS[id], poses = Art.posesFor(kit); out.kits[id] = { weapon: kit.weapon, poses: {} };
  Art.ANIMS.hero.forEach(a => { out.kits[id].poses[a] = (poses[a] || poses.idle).map(P => Object.assign({}, P)); });
});
process.stdout.write(JSON.stringify(out));
