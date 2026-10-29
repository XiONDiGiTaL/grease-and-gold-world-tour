/* Zero-dependency WebSocket room relay for online co-op.
   node tools/relay.js [port]
   Rooms are ephemeral in-memory pairs: {host, guest}. Messages are opaque JSON
   forwarded to the other seat. This is transport only - the host browser owns
   all game state, so there is no server authority to protect. */
const http = require('http'), crypto = require('crypto');
const PORT = Number(process.argv[2] || 8787);
const rooms = new Map();
let nextId = 1;

function handshake(req, socket) {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.write('HTTP/1.1 400 Bad Request\r\n\r\n'); socket.destroy(); return null; }
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  return true;
}
function encode(str) {
  const payload = Buffer.from(str);
  const len = payload.length;
  let head;
  if (len < 126) head = Buffer.from([0x81, len]);
  else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x81; head[1] = 126; head.writeUInt16BE(len, 2); }
  else { head = Buffer.alloc(10); head[0] = 0x81; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([head, payload]);
}
function parseFrames(state, chunk, onMessage, onClose) {
  state.buf = Buffer.concat([state.buf, chunk]);
  for (;;) {
    const b = state.buf;
    if (b.length < 2) return;
    const op = b[0] & 0x0f, masked = b[1] & 0x80;
    let len = b[1] & 0x7f, off = 2;
    if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
    else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); off = 10; }
    const need = off + (masked ? 4 : 0) + len;
    if (b.length < need) return;
    const mask = masked ? b.slice(off, off + 4) : null;
    if (masked) off += 4;
    const payload = Buffer.from(b.slice(off, off + len));
    if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
    state.buf = b.slice(need);
    if (op === 8) { onClose(); return; }
    if (op === 1) onMessage(payload.toString('utf8'));
  }
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Grease & Gold relay. WebSocket endpoint: ws://this-host:' + PORT + '/relay\n');
});
server.on('upgrade', (req, socket) => {
  if (!handshake(req, socket)) return;
  const ws = {
    id: nextId++, socket: socket, room: null, role: null, alive: true,
    send(obj) { if (!this.alive) return; try { socket.write(encode(JSON.stringify(obj))); } catch (e) { this.alive = false; } },
    close() { if (!this.alive) return; this.alive = false; try { socket.end(); } catch (e) {} }
  };
  const state = { buf: Buffer.alloc(0) };
  socket.on('data', chunk => parseFrames(state, chunk, txt => {
    let m; try { m = JSON.parse(txt); } catch (e) { return; }
    if (m.t === 'join') {
      const code = String(m.room || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
      if (code.length !== 5) { ws.send({ t: 'err', code: 'not-found' }); return; }
      let r = rooms.get(code);
      if (!r) { r = { host: null, guest: null }; rooms.set(code, r); }
      if (r[m.role === 'guest' ? 'guest' : 'host'] && r[m.role === 'guest' ? 'guest' : 'host'].alive) {
        if (m.role === 'guest') { ws.send({ t: 'err', code: 'full' }); return; }
      }
      ws.room = code; ws.role = m.role === 'guest' ? 'guest' : 'host';
      r[ws.role] = ws;
      ws.send({ t: 'joined', role: ws.role, code: code });
      const other = r[ws.role === 'host' ? 'guest' : 'host'];
      if (other && other.alive) { other.send({ t: 'peer', present: true }); ws.send({ t: 'peer', present: true }); }
      else ws.send({ t: 'peer', present: false });
      return;
    }
    if (m.t === 'msg' && ws.room) {
      const r = rooms.get(ws.room);
      const other = r && r[ws.role === 'host' ? 'guest' : 'host'];
      if (other && other.alive) other.send({ t: 'msg', m: m.m });
      return;
    }
  }, () => { ws.alive = false; drop(ws); }));
  socket.on('close', () => { ws.alive = false; drop(ws); });
  socket.on('error', () => { ws.alive = false; drop(ws); });
});
function drop(ws) {
  if (!ws.room) return;
  const r = rooms.get(ws.room);
  if (!r) return;
  if (r.host === ws) r.host = null;
  if (r.guest === ws) r.guest = null;
  const other = r.host || r.guest;
  if (other && other.alive) other.send({ t: 'peer', present: false });
  if (!r.host && !r.guest) rooms.delete(ws.room);
}
setInterval(() => { for (const ws of [] ) {} }, 30000);
server.listen(PORT, () => console.log('relay listening ws://localhost:' + PORT + '/relay'));
