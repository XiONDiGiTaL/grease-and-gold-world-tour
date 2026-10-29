/* Input: two keyboard layouts, two gamepads, touch, remote (net) players.
   Every button is edge-latched for a few ticks so buffered combos work. */
(function (G) {
'use strict';
const ACT = ['left', 'right', 'up', 'down', 'attack', 'jump', 'special', 'grab', 'start', 'pause'];
const BUF = 10;
const I = G.Input = {
  held: { p1: {}, p2: {} }, buf: { p1: {}, p2: {} }, edge: { p1: {}, p2: {} },
  remoteHeld: { p1: {}, p2: {} }, remoteJust: { p1: {}, p2: {} },
  keys: {}, touch: {}, pads: {}, settings: null, waitingFor: null, _captured: null
};
['p1', 'p2'].forEach(p => ACT.forEach(a => { I.held[p][a] = false; I.buf[p][a] = 0; I.edge[p][a] = false; I.remoteHeld[p][a] = false; I.remoteJust[p][a] = false; }));

I.init = function (settings) {
  I.settings = settings;
  if (typeof window === 'undefined') return;
  window.addEventListener('keydown', e => {
    if (I.waitingFor) { I._captured = e.code; e.preventDefault(); return; }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
    if (!I.keys[e.code]) I.pressCode(e.code);
    I.keys[e.code] = true;
  });
  window.addEventListener('keyup', e => { I.keys[e.code] = false; });
  window.addEventListener('blur', () => { I.keys = {}; I.touch = {}; I.clear(); });
};
I.captureKey = function () {
  const c = I._captured; I._captured = null;
  if (c === 'Escape') return null;
  return c;
};
I.setWaiting = function (on) { I.waitingFor = on; I._captured = null; };
I.pressCode = function (code) {
  if (!I.settings) return;
  for (const p of ['p1', 'p2']) {
    const map = I.settings.keys[p];
    for (const a of ACT) if (map[a] === code) I.setEdge(p, a);
  }
};
I.setEdge = function (p, a) { I.buf[p][a] = BUF; I.edge[p][a] = true; };
I.isHeld = function (p, a) { return !!I.held[p][a] || !!I.remoteHeld[p][a]; };
I.just = function (p, a) { return !!I.edge[p][a] || !!I.remoteJust[p][a]; };
I.consume = function (p, a) {
  if (I.buf[p][a] > 0) { I.buf[p][a] = 0; return true; }
  if (I.remoteJust[p][a]) { I.remoteJust[p][a] = false; return true; }
  return false;
};
I.setRemote = function (idx, heldMask, justMask, actions) {
  const p = idx === 0 ? 'p1' : 'p2';
  (actions || ['left', 'right', 'up', 'down', 'attack', 'jump', 'special', 'grab']).forEach((a, i) => {
    I.remoteHeld[p][a] = !!(heldMask & (1 << i));
    if (justMask & (1 << i)) { I.remoteJust[p][a] = true; I.buf[p][a] = BUF; }
  });
};
I.clearRemote = function (idx) {
  const p = idx === 0 ? 'p1' : 'p2';
  ACT.forEach(a => { I.remoteHeld[p][a] = false; I.remoteJust[p][a] = false; I.buf[p][a] = 0; });
};
I.pollPads = function () {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
  const pads = [...navigator.getGamepads()].filter(Boolean);
  I.pads = {};
  pads.slice(0, 2).forEach((g, idx) => {
    const ax = g.axes[0] || 0, ay = g.axes[1] || 0, b = (i) => !!(g.buttons[i] && g.buttons[i].pressed);
    I.pads['p' + (idx + 1)] = {
      left: ax < -.35 || b(14), right: ax > .35 || b(15), up: ay < -.35 || b(12), down: ay > .35 || b(13),
      attack: b(2), jump: b(0), special: b(1), grab: b(3), start: b(9), pause: b(8)
    };
  });
  /* pad edges feed the same buffer as keys */
  ['p1', 'p2'].forEach(p => {
    const pad = I.pads[p]; if (!pad) return;
    ACT.forEach(a => { if (pad[a] && !I._padPrev || !I._padPrev) {} });
  });
  if (!I._padPrev) I._padPrev = { p1: {}, p2: {} };
  ['p1', 'p2'].forEach(p => {
    const pad = I.pads[p] || {};
    ACT.forEach(a => { if (pad[a] && !I._padPrev[p][a]) I.setEdge(p, a); });
    I._padPrev[p] = Object.assign({}, pad);
  });
};
I.compute = function () {
  if (!I.settings) return;
  ['p1', 'p2'].forEach(p => {
    const map = I.settings.keys[p], pad = I.pads[p] || {};
    ACT.forEach(a => {
      let on = false;
      for (const code in map) if (map[code] === undefined) continue;
      for (const code2 in I.keys) if (I.keys[code2] && I.settings.keys[p][a] === code2) on = true;
      if (p === 'p1' && I.touch[a]) on = true;
      if (pad[a]) on = true;
      if (on && !I.held[p][a]) I.setEdge(p, a);
      I.held[p][a] = on;
    });
  });
};
I.endFrame = function () {
  ['p1', 'p2'].forEach(p => {
    ACT.forEach(a => { I.edge[p][a] = false; I.remoteJust[p][a] = false; });
  });
};
I.tick = function () {
  ['p1', 'p2'].forEach(p => ACT.forEach(a => { if (I.buf[p][a] > 0) I.buf[p][a]--; }));
};
I.clear = function () {
  I.keys = {}; I.touch = {};
  ['p1', 'p2'].forEach(p => {
    ACT.forEach(a => { I.held[p][a] = false; I.buf[p][a] = 0; I.edge[p][a] = false; });
  });
};
I.mask = function (p) {
  let m = 0;
  ['left', 'right', 'up', 'down', 'attack', 'jump', 'special', 'grab'].forEach((a, i) => { if (I.held[p][a]) m |= 1 << i; });
  return m;
};
I.justMask = function (p) {
  let m = 0;
  ['left', 'right', 'up', 'down', 'attack', 'jump', 'special', 'grab'].forEach((a, i) => { if (I.edge[p][a] || I.buf[p][a] === BUF) m |= 1 << i; });
  return m;
};
I.ACTIONS = ['left', 'right', 'up', 'down', 'attack', 'jump', 'special', 'grab'];
})(globalThis.GG = globalThis.GG || {});
