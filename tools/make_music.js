// Embeds the two re-encoded songs (assets/music/*.mp3, 80 kbps) into src/music.js as data URIs.
const fs = require('fs'), path = require('path'); const root = path.join(__dirname, '..');
const t = (f) => 'data:audio/mpeg;base64,' + fs.readFileSync(path.join(root, 'assets/music', f)).toString('base64');
fs.writeFileSync(path.join(root, 'src/music.js'), `/* Music: "V.V. - Arcade Tune (BOMO)" and "Ricky Bendova - I Don't Kneel (YM2612)", supplied by the project owner. */\n(function (G) { G.MUSIC = { arcade: '${t('arcade_tune.mp3')}', kneel: '${t('i_dont_kneel.mp3')}' }; })(globalThis.GG = globalThis.GG || {});\n`);
console.log('music embedded', (fs.statSync(path.join(root, 'src/music.js')).size / 1024 / 1024).toFixed(1) + ' MB');
