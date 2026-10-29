/* Input: emulator-pad keyboards per player, standard-mapping gamepads with a
   remappable beat-'em-up layout, touch and remote (net) players.
   Every button is edge-latched for a few ticks so buffered combos work. */
(function (G) {
'use strict';
const ACT = G.ACT;
/* the buttons that travel over the wire: same order as the net input mask */
const GAME = ['left', 'right', 'up', 'down', 'attack', 'heavy', 'jump', 'grab', 'special'];
const BUF = 10, DEADZONE = .38, TRIGGER = .45;
/* W3C standard-mapping button names */
const PAD_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'BACK', 'START', 'L3', 'R3',
  'D-UP', 'D-DOWN', 'D-LEFT', 'D-RIGHT', 'HOME'];

const I = G.Input = {
  held: { p1: {}, p2: {} }, buf: { p1: {}, p2: {} }, edge: { p1: {}, p2: {} },
  remoteHeld: { p1: {}, p2: {} }, remoteJust: { p1: {}, p2: {} },
  keys: {}, touch: {}, pads: {}, padIds: {}, settings: null, waitingFor: null, padMap: {},
  padName: (i) => PAD_NAMES[i] || ('B' + i)
};
const P = ['p1', 'p2'];
P.forEach(p => ACT.forEach(a => {
  I.held[p][a] = false; I.buf[p][a] = 0; I.edge[p][a] = false;
  I.remoteHeld[p][a] = false; I.remoteJust[p][a] = false;
}));

I.init = function (settings) {
  I.settings = settings;
  I.refresh();
  if (typeof window === 'undefined') return;
  window.addEventListener('keydown', e => {
    if (I.waitingFor) { I._captured = e.code; e.preventDefault(); return; }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter', 'Tab'].indexOf(e.code) >= 0) e.preventDefault();
    if (!I.keys[e.code]) I.pressCode(e.code);
    I.keys[e.code] = true;
  });
  window.addEventListener('keyup', e => { I.keys[e.code] = false; });
  window.addEventListener('blur', () => { I.keys = {}; I.touch = {}; I.clear(); });
  /* plug-and-play: a connected standard pad needs no setup step */
  window.addEventListener('gamepadconnected', (e) => {
    I.padJustConnected = (e && e.gamepad && e.gamepad.id) || 'CONTROLLER';
  });
  window.addEventListener('gamepaddisconnected', () => { I.padJustConnected = null; });
};

/** Rebuild the key -> action lookup and pick up the current pad map. */
I.refresh = function () {
  const s = I.settings; if (!s) return;
  I._rev = { p1: {}, p2: {} };
  P.forEach(p => {
    const map = s.keys[p] || {};
    for (const a in map) if (map[a]) I._rev[p][map[a]] = a;
  });
  I.padMap = s.pad || (G.DEFAULTS && G.DEFAULTS.pad) || {};
};

/* ---------------- keyboard ---------------- */
I.captureKey = function () {
  const c = I._captured; I._captured = null;
  if (c === 'Escape') return null;
  return c;
};
I.setWaiting = function (on) { I.waitingFor = !!on; I._captured = null; };
I.pressCode = function (code) {
  if (!I._rev) return;
  P.forEach(p => { const a = I._rev[p][code]; if (a) I.setEdge(p, a); });
};

/* ---------------- shared latches ---------------- */
I.setEdge = function (p, a) { I.buf[p][a] = BUF; I.edge[p][a] = true; };
I.isHeld = function (p, a) { return !!I.held[p][a] || !!I.remoteHeld[p][a]; };
I.just = function (p, a) { return !!I.edge[p][a] || !!I.remoteJust[p][a]; };
I.consume = function (p, a) {
  if (I.buf[p][a] > 0) { I.buf[p][a] = 0; return true; }
  if (I.remoteJust[p][a]) { I.remoteJust[p][a] = false; return true; }
  return false;
};
I.setRemote = function (idx, heldMask, justMask) {
  const p = idx === 0 ? 'p1' : 'p2';
  GAME.forEach((a, i) => {
    I.remoteHeld[p][a] = !!(heldMask & (1 << i));
    if (justMask & (1 << i)) { I.remoteJust[p][a] = true; I.buf[p][a] = BUF; }
  });
};
I.clearRemote = function (idx) {
  const p = idx === 0 ? 'p1' : 'p2';
  ACT.forEach(a => { I.remoteHeld[p][a] = false; I.remoteJust[p][a] = false; I.buf[p][a] = 0; });
};

/* ---------------- gamepads ---------------- */
function activePads() {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return [];
  let list = [];
  try { list = Array.prototype.slice.call(navigator.getGamepads()).filter(g => g && g.connected); } catch (e) { return []; }
  return list;
}
/** Read one standard-mapping pad into the game's own action names. */
function readPad(g) {
  const b = (i) => !!(g.buttons[i] && (g.buttons[i].pressed || g.buttons[i].value > TRIGGER));
  const ax = (g.axes && g.axes.length) ? (g.axes[0] || 0) : 0;
  const ay = (g.axes && g.axes.length > 1) ? (g.axes[1] || 0) : 0;
  const map = I.padMap || {};
  const out = {};
  ACT.forEach(a => { out[a] = map[a] !== undefined && map[a] !== null ? b(map[a]) : false; });
  /* D-pad and the left stick always move, whatever the buttons are bound to */
  out.left = out.left || ax < -DEADZONE || b(14);
  out.right = out.right || ax > DEADZONE || b(15);
  out.up = out.up || ay < -DEADZONE || b(12);
  out.down = out.down || ay > DEADZONE || b(13);
  return out;
}
I.pollPads = function () {
  const list = activePads();
  I._raw = list.slice(0, 2);
  /* rebinding: the next button pressed on any pad is the binding, and the pad
     is swallowed so the menus do not move while we listen */
  if (I._padCap) {
    for (const g of list) {
      for (let i = 0; i < 17; i++) {
        if (g.buttons[i] && (g.buttons[i].pressed || g.buttons[i].value > TRIGGER)) {
          I._padCaptured = { index: i, id: g.id || 'CONTROLLER' };
          I._padCap = false;
          break;
        }
      }
      if (!I._padCap) break;
    }
    if (I._padCap) { I.pads = {}; return; }
  }
  I.pads = {}; I.padIds = {};
  I._raw.forEach((g, slot) => {
    const p = slot === 0 ? 'p1' : 'p2';
    I.pads[p] = readPad(g);
    I.padIds[p] = g.id || 'CONTROLLER';
  });
};
I.setPadWaiting = function (on) { I._padCap = !!on; I._padCaptured = null; };
I.takePadCapture = function () { const v = I._padCaptured; I._padCaptured = null; return v; };
I.padConnected = function () { return !!I.pads.p1 || !!I.pads.p2; };
I.actionForPad = function (index) {
  const m = I.padMap || {};
  for (const a of ACT) if (m[a] === index) return a;
  return null;
};
I.setPadBinding = function (a, index) {
  if (!I.settings) return;
  const m = Object.assign({}, I.padMap);
  m[a] = index;
  I.settings.pad = m; I.padMap = m;
  G.saveSettings(I.settings);
};
I.resetBindings = function () {
  if (!I.settings) return;
  I.settings.keys = JSON.parse(JSON.stringify(G.DEFAULTS.keys));
  I.settings.pad = Object.assign({}, G.DEFAULTS.pad);
  G.saveSettings(I.settings);
  I.refresh();
  P.forEach(p => ACT.forEach(a => { I.buf[p][a] = 0; }));
};
I.rumble = function (strength) {
  if (!I.settings || !I.settings.rumble) return;
  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  if (now - (I._rumbleAt || 0) < 60) return;
  I._rumbleAt = now;
  const s = Math.max(0, Math.min(1, strength || .4));
  (I._raw || []).forEach(g => {
    try {
      const act = g.vibrationActuator;
      if (act && act.playEffect) {
        act.playEffect('dual-rumble', { startDelay: 0, duration: 90, weakMagnitude: s * .7, strongMagnitude: s });
      }
    } catch (e) {}
  });
};

/* ---------------- frame ---------------- */
I.compute = function () {
  if (!I.settings) return;
  P.forEach(p => {
    const rev = I._rev[p] || {}, pad = I.pads[p] || {};
    const on = {};
    ACT.forEach(a => { on[a] = false; });
    for (const code in I.keys) if (I.keys[code] && rev[code]) on[rev[code]] = true;
    if (p === 'p1') ACT.forEach(a => { if (I.touch[a]) on[a] = true; });
    ACT.forEach(a => { if (pad[a]) on[a] = true; });
    ACT.forEach(a => { if (on[a] && !I.held[p][a]) I.setEdge(p, a); I.held[p][a] = on[a]; });
  });
};
I.endFrame = function () {
  P.forEach(p => ACT.forEach(a => { I.edge[p][a] = false; I.remoteJust[p][a] = false; }));
};
I.tick = function () {
  P.forEach(p => ACT.forEach(a => { if (I.buf[p][a] > 0) I.buf[p][a]--; }));
};
I.clear = function () {
  I.keys = {}; I.touch = {};
  P.forEach(p => ACT.forEach(a => { I.held[p][a] = false; I.buf[p][a] = 0; I.edge[p][a] = false; }));
};
I.mask = function (p) {
  let m = 0;
  GAME.forEach((a, i) => { if (I.held[p][a]) m |= 1 << i; });
  return m;
};
I.justMask = function (p) {
  let m = 0;
  GAME.forEach((a, i) => { if (I.edge[p][a] || I.buf[p][a] === BUF) m |= 1 << i; });
  return m;
};
I.ACTIONS = GAME;
I.PAD_NAMES = PAD_NAMES;
})(globalThis.GG = globalThis.GG || {});
