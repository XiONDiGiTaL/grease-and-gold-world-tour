/* Bundles the game into dist/ (single html + assets). Subpath-safe: all URLs are relative.
   Usage: node tools/build.js   */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');

const order = ['core', 'art', 'stages', 'input', 'audio', 'net', 'sim', 'render', 'main'];
let js = '';
for (const name of order) {
  const file = path.join(root, 'src', 'gg', name + '.js');
  const src = fs.readFileSync(file, 'utf8');
  js += '\n/* ---- ' + name + '.js ---- */\n' + src + '\n';
}
const shell = fs.readFileSync(path.join(root, 'src', 'gg', 'shell.html'), 'utf8');
/* function replacer: a string replacement would treat `$'` in "Johnny $" as a
   replacement pattern and corrupt the bundle (the v10 black-screen bug). */
const block = '<script>\n' + js.replace(/<\/script/gi, '<\\/script') + '\n</script>';

/* Content hash of the generated art. The atlas PNG and its frame table must be
   requested as one build-consistent pair, otherwise a cached table can point
   into newer pixels and fighters draw as garbage. */
const artDir = path.join(root, 'assets', 'gg');
const hash = require('crypto').createHash('sha1');
fs.readdirSync(artDir).sort().forEach(f => { hash.update(f); hash.update(fs.readFileSync(path.join(artDir, f))); });
const assetHash = hash.digest('hex').slice(0, 12);
const head = '<script>window.GG_ASSET_HASH=' + JSON.stringify(assetHash) + ';</script>\n';
const html = shell.replace('<!--SCRIPTS-->', () => head + block);

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, 'index.html'), html);

/* copy generated art */
const art = path.join(root, 'assets', 'gg');
if (!fs.existsSync(art)) { console.error('assets/gg missing - run npm run art first'); process.exit(1); }
fs.cpSync(art, path.join(dist, 'assets', 'gg'), { recursive: true });

/* GitHub Pages serves the repository root, so the root index.html is the game.
   The original marketing page is preserved as landing.html. */
fs.writeFileSync(path.join(root, 'index.html'), html);
fs.writeFileSync(path.join(root, 'play-v11.html'), html);

const kb = (fs.statSync(path.join(dist, 'index.html')).size / 1024).toFixed(0);
console.log('dist/index.html ' + kb + ' KB; assets ' + fs.readdirSync(art).length + ' files');
