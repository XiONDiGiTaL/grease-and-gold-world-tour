// Bundles src/*.js + index.html into dist/grease-and-gold.html (single self-contained file).
const fs = require('fs'), path = require('path'); const root = path.join(__dirname, '..');
const order = ['sprites', 'input', 'audio', 'stages', 'game', 'ui', 'boot'];
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const tags = order.map(n => '<script>\n' + fs.readFileSync(path.join(root, 'src', n + '.js'), 'utf8') + '\n</script>').join('\n');
const scriptsSrc = order.map(n => '<script src="src/' + n + '.js"></script>').join('\n');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'grease-and-gold.html'), html.replace('<!--SCRIPTS-->', tags));
// index.html keeps working from source (multi-file) when opened directly:
fs.writeFileSync(path.join(root, 'play-dev.html'), html.replace('<!--SCRIPTS-->', scriptsSrc));
console.log('built dist/grease-and-gold.html', (fs.statSync(path.join(root, 'dist', 'grease-and-gold.html')).size / 1024).toFixed(0) + ' KB');
