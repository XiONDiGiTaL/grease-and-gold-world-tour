// Embeds Press Start 2P (SIL OFL) as base64 -> src/font.js, and copies it for Godot.
const fs = require('fs'), path = require('path'); const root = path.join(__dirname, '..');
const f = path.join(root, 'node_modules/@fontsource/press-start-2p/files/press-start-2p-latin-400-normal.woff2'); const b = fs.readFileSync(f).toString('base64');
fs.writeFileSync(path.join(root, 'src/font.js'), `/* Press Start 2P (c) 2012 The Press Start 2P Project Authors, SIL Open Font License 1.1. Embedded so the game is one file. */
(function (G) { G.FONT_B64 = '${b}';
G.loadFont = function () { if (typeof FontFace === 'undefined' || typeof document === 'undefined' || !document.fonts) return Promise.resolve(false);
  const ff = new FontFace('PS2P', 'url(data:font/woff2;base64,' + G.FONT_B64 + ')'); document.fonts.add(ff); return ff.load().then(() => true, () => false); }; })(globalThis.GG = globalThis.GG || {});\n`);
fs.mkdirSync(path.join(root, 'assets/fonts'), { recursive: true }); fs.copyFileSync(f, path.join(root, 'assets/fonts/PressStart2P.woff2'));
fs.copyFileSync(path.join(root, 'node_modules/@fontsource/press-start-2p/LICENSE'), path.join(root, 'assets/fonts/OFL-PressStart2P.txt'));
fs.mkdirSync(path.join(root, 'godot/assets'), { recursive: true }); fs.copyFileSync(f, path.join(root, 'godot/assets/PressStart2P.woff2')); console.log('font embedded', b.length);
