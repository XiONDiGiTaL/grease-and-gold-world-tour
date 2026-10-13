/* Input: keyboard + gamepad + touch all feed the same button table with a short press buffer. */
(function (G) {
'use strict';
const BUF = 9, B = ['left', 'right', 'up', 'down', 'attack', 'jump', 'special', 'grab', 'pause', 'start', 'back'];
const I = G.Input = { held: {}, buf: {}, edge: {}, mute: false };
B.forEach(b => { I.held[b] = false; I.buf[b] = 0; I.edge[b] = false; });
const KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  KeyJ: 'attack', KeyZ: 'attack', KeyK: 'jump', KeyX: 'jump', Space: 'jump', KeyL: 'special', KeyC: 'special', KeyU: 'grab', KeyV: 'grab', KeyI: 'grab',
  Escape: 'pause', KeyP: 'pause', Enter: 'start', Backspace: 'back' };
I.set = (b, v) => { if (v && !I.held[b]) { I.buf[b] = BUF; I.edge[b] = true; } I.held[b] = v; };
I.pressed = (b) => I.buf[b] > 0; I.consume = (b) => { if (I.buf[b] > 0) { I.buf[b] = 0; return true; } return false; };
I.just = (b) => I.edge[b]; I.axisX = () => (I.held.right ? 1 : 0) - (I.held.left ? 1 : 0); I.axisY = () => (I.held.down ? 1 : 0) - (I.held.up ? 1 : 0);
I.endFrame = () => { for (const b of B) { I.edge[b] = false; } };
I.tick = () => { for (const b of B) if (I.buf[b] > 0) I.buf[b]--; };
I.clear = () => { B.forEach(b => { I.held[b] = false; I.buf[b] = 0; I.edge[b] = false; }); };
const kb = {}; I._kb = kb, I._pad = {}, I._touch = {};
function recompute() { const t = {}; B.forEach(b => t[b] = false); for (const c in kb) if (kb[c] && KEYS[c]) t[KEYS[c]] = true; for (const b in I._pad) if (I._pad[b]) t[b] = true; for (const b in I._touch) if (I._touch[b]) t[b] = true; B.forEach(b => I.set(b, t[b])); }
I.recompute = recompute;
I.pollPad = () => { if (typeof navigator === 'undefined' || !navigator.getGamepads) return; const g = [...navigator.getGamepads()].find(x => x); if (!g) { if (Object.keys(I._pad).length) { I._pad = {}; recompute(); } return; }
  const ax = g.axes[0] || 0, ay = g.axes[1] || 0, bt = (i) => g.buttons[i] && g.buttons[i].pressed;
  I._pad = { left: ax < -.4 || bt(14), right: ax > .4 || bt(15), up: ay < -.4 || bt(12), down: ay > .4 || bt(13), jump: bt(0), special: bt(1), attack: bt(2), grab: bt(3), pause: bt(9), start: bt(9) || bt(0) }; recompute(); };
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', e => { if (KEYS[e.code]) e.preventDefault(); if (e.code === 'KeyM') { I.mute = !I.mute; } if (e.code === 'F3') { G.debug = !G.debug; } kb[e.code] = true; recompute(); });
  window.addEventListener('keyup', e => { kb[e.code] = false; recompute(); });
  window.addEventListener('blur', () => { for (const c in kb) kb[c] = false; I._touch = {}; recompute(); });
}
})(globalThis.GG = globalThis.GG || {});
