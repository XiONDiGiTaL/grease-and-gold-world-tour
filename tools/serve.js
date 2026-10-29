/* Zero-dependency static server for local play/testing.
   node tools/serve.js [port] [dir]  */
const http = require('http'), fs = require('fs'), path = require('path');
const port = Number(process.argv[2] || 8080);
const root = path.resolve(process.argv[3] || path.join(__dirname, '..', 'dist'));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css', '.mp3': 'audio/mpeg', '.ico': 'image/x-icon' };
http.createServer((req, res) => {
  const u = decodeURIComponent((req.url || '/').split('?')[0]);
  let p = path.join(root, u === '/' ? 'index.html' : u);
  if (!p.startsWith(root)) { res.writeHead(403); return res.end('forbidden'); }
  fs.stat(p, (err, st) => {
    if (!err && st.isDirectory()) p = path.join(p, 'index.html');
    fs.readFile(p, (e, buf) => {
      if (e) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('not found: ' + u); }
      res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(buf);
    });
  });
}).listen(port, () => console.log('serving ' + root + ' on http://localhost:' + port + '/'));
