// Bundles src/*.js into the game shell (src/shell.html).
// Output: play-v<N>.html (single self-contained file, N = package.json "playVersion") and play-dev.html (loads src/*.js).
const fs = require('fs'), path = require('path'); const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')); const N = pkg.playVersion || 10;
const order = ['font', 'foodart', 'rigart', 'sprites', 'rig', 'input', 'audio', 'stages', 'game', 'ui', 'boot'];
const html = fs.readFileSync(path.join(root, 'src', 'shell.html'), 'utf8');
const tags = order.map(n => '<script>\n' + fs.readFileSync(path.join(root, 'src', n + '.js'), 'utf8') + '\n</script>').join('\n');
const dev = order.map(n => '<script src="src/' + n + '.js"></script>').join('\n');
const out = path.join(root, 'play-v' + N + '.html');
fs.writeFileSync(out, html.replace('<!--SCRIPTS-->', () => tags)); fs.writeFileSync(path.join(root, 'play-dev.html'), html.replace('<!--SCRIPTS-->', () => dev));
console.log('built', path.basename(out), (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
