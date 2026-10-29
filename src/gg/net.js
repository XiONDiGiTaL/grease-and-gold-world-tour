/* Online co-op: host-authoritative rooms over a byte-relay.
   Transports: WebSocket relay (tools/relay.js or your own) and BroadcastChannel
   (two tabs, no server). The host runs the simulation; the guest sends an
   input bitmask and renders authoritative snapshots. No privileged keys. */
(function (G) {
'use strict';
const PROTO = G.PROTO, ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function code5() { let s = ''; for (let i = 0; i < 5; i++) s += ALPHA[(Math.random() * ALPHA.length) | 0]; return s; }
function normCode(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5); }

/* ---------------- transports ---------------- */
function BCTransport(code, role, cbs) {
  let ch = null, open = false;
  try { ch = new BroadcastChannel('gg-room-' + code); } catch (e) { cbs.onError && cbs.onError('relay-unavailable'); return null; }
  ch.onmessage = (ev) => {
    const m = ev.data;
    if (!m || m.__role === role) return;
    if (!open) { open = true; cbs.onOpen && cbs.onOpen(); }
    cbs.onMessage && cbs.onMessage(m);
  };
  setTimeout(() => { if (!open) cbs.onError && cbs.onError('not-found'); }, 2500);
  return {
    kind: 'local',
    send(m) { try { ch.postMessage(Object.assign({}, m, { __role: role })); } catch (e) {} },
    close() { try { ch.close(); } catch (e) {} }
  };
}
function WSTransport(code, role, cbs, url) {
  let ws = null, open = false, closed = false;
  try { ws = new WebSocket(url); } catch (e) { cbs.onError && cbs.onError('relay-unavailable'); return null; }
  const watchdog = setTimeout(() => { if (!open) cbs.onError && cbs.onError('timeout'); }, 12000);
  ws.onopen = () => { ws.send(JSON.stringify({ t: 'join', room: code, role: role, v: PROTO })); };
  ws.onmessage = (ev) => {
    let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (m.t === 'joined') { clearTimeout(watchdog); open = true; cbs.onOpen && cbs.onOpen(); return; }
    if (m.t === 'peer') { cbs.onPeer && cbs.onPeer(m.present); return; }
    if (m.t === 'err') { cbs.onError && cbs.onError(m.code); return; }
    if (m.t === 'msg') cbs.onMessage && cbs.onMessage(m.m);
  };
  ws.onerror = () => { if (!closed) cbs.onError && cbs.onError('relay-unavailable'); };
  ws.onclose = () => { if (!closed) { closed = true; cbs.onClose && cbs.onClose(); } };
  return {
    kind: 'relay',
    send(m) { try { if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'msg', m: m })); } catch (e) {} },
    close() { closed = true; clearTimeout(watchdog); try { ws.close(); } catch (e) {} }
  };
}
G.inviteUrl = function (code) {
  try {
    const u = new URL(location.href);
    u.searchParams.set('room', code);
    u.searchParams.delete('local');
    return u.toString();
  } catch (e) { return '?room=' + code; }
};
G.roomFromUrl = function () {
  try { return normCode(new URLSearchParams(location.search).get('room')); } catch (e) { return ''; }
};
G.relayFromUrl = function () {
  try {
    const p = new URLSearchParams(location.search);
    return p.get('relay') || (location.protocol === 'https:' ? 'wss://' + location.host + '/relay' : 'ws://' + location.host + '/relay');
  } catch (e) { return 'ws://localhost:8787'; }
};

/* ---------------- session ---------------- */
class Net {
  constructor() { this.transport = null; this.role = 'host'; this.code = ''; this.peer = false; this.lobby = null;
    this.seq = 0; this.lastGuestSeq = -1; this.snapEvery = 3; this.snapT = 0; this.pingT = 0; this.rtt = 0;
    this.status = 'idle'; this.kind = 'relay'; this.game = null; this.guestReady = false; this.hostStart = null; }
  isHost() { return this.role === 'host'; }
  host(game, kind) {
    this.game = game; this.role = 'host'; this.kind = kind || 'relay'; this.code = code5();
    this.status = 'connecting';
    const url = G.relayFromUrl();
    this.transport = kind === 'local' ? BCTransport(this.code, 'host', this.cbs()) : WSTransport(this.code, 'host', this.cbs(), url);
    game.mode = 'online'; game.invite = G.inviteUrl(this.code);
    game.screen = 'lobby'; game.menu = 0;
    if (!this.transport) { game.netError('relay-unavailable'); this.status = 'failed'; }
  }
  join(game, code, kind) {
    this.game = game; this.role = 'guest'; this.code = normCode(code); this.status = 'connecting';
    this.transport = kind === 'local' ? BCTransport(this.code, 'guest', this.cbs()) : WSTransport(this.code, 'guest', this.cbs(), G.relayFromUrl());
    game.mode = 'online'; game.screen = 'lobby'; game.menu = 0;
    this.send({ t: 'hello', v: PROTO, char: G.CH_ORDER[game.sel] });
    if (!this.transport) { game.netError('relay-unavailable'); this.status = 'failed'; }
  }
  cbs() {
    return {
      onOpen: () => { this.status = 'online'; this.send({ t: 'hello', v: PROTO, char: G.CH_ORDER[this.game.sel] }); },
      onMessage: (m) => this.onMessage(m),
      onClose: () => {
        if (this.status === 'online' && this.role === 'guest') { this.game.netError('host-left'); this.status = 'closed'; }
        else if (this.role === 'host') { this.peer = false; this.pushLobby(); }
      },
      onError: (k) => { this.status = 'failed'; this.game.netError(k); },
      onPeer: (present) => { this.peer = present; this.pushLobby(); }
    };
  }
  leave() {
    try { if (this.transport) { this.send({ t: 'bye' }); this.transport.close(); } } catch (e) {}
    this.transport = null; this.status = 'idle'; this.peer = false; this.lobby = null; this.role = 'host';
    if (this.game) G.Input.clearRemote(1);
  }
  send(m) { if (this.transport) this.transport.send(m); }
  onMessage(m) {
    const g = this.game;
    if (!m || typeof m !== 'object') return;
    if (m.t === 'hello') {
      if (this.role !== 'host') return;
      if (m.v !== PROTO) { this.send({ t: 'err', code: 'version' }); return; }
      this.peer = true; this.guestChar = m.char || 'vv';
      this.send({ t: 'welcome', v: PROTO, code: this.code, stage: g.settings.stage | 0 });
      this.pushLobby();
      return;
    }
    if (m.t === 'err') { g.netError(m.code || 'online_failed'); return; }
    if (this.role === 'host') {
      if (m.t === 'input') {
        if (!this.peer) return;
        if (m.s <= this.lastGuestSeq) return;
        this.lastGuestSeq = m.s;
        G.Input.setRemote(1, m.h | 0, m.j | 0);
        this.lastGuestAt = performance.now();
        return;
      }
      if (m.t === 'ready') { this.guestReady = !!m.r; this.pushLobby(); return; }
      if (m.t === 'pick') { if (G.CH[m.f]) g.p2 = m.f; this.pushLobby(); return; }
      if (m.t === 'pause') { this.send({ t: 'paused', on: g.screen === 'pause' }); return; }
      if (m.t === 'resume-req') { if (g.screen === 'pause' && g.isHost()) g.resumeNet(); return; }
      if (m.t === 'restart-req') { if (g.isHost()) { g.mode = 'online'; g.newGame('online', { stage: g.stageIdx }); this.sendScreen('play', g); } return; }
      return;
    }
    /* guest */
    if (m.t === 'welcome') { this.status = 'online'; g.screen = 'lobby'; this.pushLobby(); return; }
    if (m.t === 'lobby') { this.lobby = m; g.lobby = m; g.screen = 'lobby'; return; }
    if (m.t === 'start') { g.startGuest(this, m); return; }
    if (m.t === 'snap') { g.applySnapshot(m.s); this.lastSnapAt = performance.now(); return; }
    if (m.t === 'paused') { if (m.on) { g.screen = 'pause'; g.menu = 0; } else { g.screen = 'play'; G.Input.clear(); } return; }
    if (m.t === 'screen') { g.screen = m.scr; g.menu = 0; return; }
    if (m.t === 'over') { g.screen = 'over'; return; }
    if (m.t === 'bye') { g.netError('host-left'); return; }
  }
  beginLobby(g) {
    this.role = 'host'; this.code = code5(); this.peer = false; this.status = 'online'; this.guestReady = false;
    g.mode = 'online'; g.screen = 'lobby'; g.menu = 0; g.code = this.code; g.invite = G.inviteUrl(this.code);
    this.transport = BCTransport(this.code, 'host', this.cbs());
    this.pushLobby();
  }
  pushLobby() {
    const g = this.game; if (!g) return;
    const msg = { t: 'lobby', code: this.code, host: g.p1, guest: g.p2, guestHere: !!this.peer, guestReady: !!this.guestReady,
      hostReady: true, diff: g.diff, stage: g.settings.stage | 0 };
    this.lobby = msg; g.lobby = msg;
    this.send(msg);
  }
  canStart() { return this.peer && this.guestReady; }
  start() {
    const g = this.game;
    if (!this.canStart()) return;
    g.mode = 'online';
    g.p2 = this.guestChar || g.p2;
    g.newGame('online', { stage: g.settings.stage | 0 });
    this.send({ t: 'start', v: PROTO, p1: g.p1, p2: g.p2, stage: g.stageIdx, diff: g.diff, seed: (Math.random() * 1e9) | 0 });
    this.sendScreen('play', g);
    this.snapT = 0;
  }
  /* guest asks the host for a pause */
  requestPause(on) { this.send({ t: on ? 'pause' : 'resume-req' }); }
  requestRestart() { this.send({ t: 'restart-req' }); }
  sendPause(on) { if (this.isHost()) this.send({ t: 'paused', on: on }); }
  sendRestart(g) { if (this.isHost()) this.sendScreen('play', g); }
  sendScreen(scr, g) { if (this.isHost()) this.send({ t: 'screen', scr: scr }); }
  sendOver(g) { if (this.isHost()) this.send({ t: 'over' }); }
  sendShake() {}
  /* snapshot packing: short arrays, stable ids/order */
  pack(g) {
    const snap = {
      t: 'snap', k: g.tick, scr: g.screen, st: g.stageIdx, cam: Math.round(g.cam.x), cmx: Math.round(g.cam.max),
      wv: g.waveIdx, ws: g.waveState, cl: g.clearT, ban: g.banner, score: g.score, lives: g.lives, cb: g.combo.n,
      tr: g.training ? 1 : 0,
      p: g.players.map(p => [p.charId, p.pid, Math.round(p.x * 2) / 2, Math.round(p.y * 2) / 2, Math.round(p.z * 2) / 2, p.face, p.anim, p.frame, Math.round(p.hp), p.maxhp, Math.round(p.hype), p.lives, p.state, p.invuln]),
      e: g.enemies.filter(e => !e.remove).map(e => [e.type, e.uid, Math.round(e.x * 2) / 2, Math.round(e.y * 2) / 2, Math.round(e.z * 2) / 2, e.face, e.anim, e.frame, Math.round(e.hp), e.maxhp, e.state]),
      pr: g.props.map(p => [p.type, Math.round(p.x), Math.round(p.y), p.hp]),
      it: g.items.map(i => [i.type, Math.round(i.x), Math.round(i.y), Math.round(i.z), Math.round(i.t / 6)]),
      pj: g.projs.map(p => [Math.round(p.x), Math.round(p.y), Math.round(p.z), Math.round(p.vx * 4)])
    };
    return snap;
  }
  tick(g) {
    if (this.role === 'guest') {
      const now = performance.now();
      const mask = G.Input.mask('p1'), jm = G.Input.justMask('p1');
      if (mask !== this._lastMask || jm) {
        this.send({ t: 'input', s: ++this.seq, h: mask, j: jm });
        this._lastMask = mask;
      }
      if (this.status === 'online' && this.lastSnapAt && now - this.lastSnapAt > 6000) { this.game.netError('host-left'); this.lastSnapAt = now; }
      return;
    }
    if (this.role !== 'host' || !this.peer) return;
    if (this.game.screen !== 'play' && this.game.screen !== 'pause' && this.game.screen !== 'clear') return;
    if (++this.snapT % this.snapEvery !== 0) return;
    this.send({ t: 'snap', s: this.pack(this.game) });
    if (this.peer && !this.game.isHost()) this.peer = false;
  }
}
G.Net = Net;
G.normCode = normCode;
})(globalThis.GG = globalThis.GG || {});
