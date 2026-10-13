/* 8-bit style WebAudio SFX (synthesised, no files). Muted with M. */
(function (G) {
'use strict';
let ac = null; const A = G.Audio = {};
A.unlock = () => { if (typeof window === 'undefined') return; if (!ac) { const C = window.AudioContext || window.webkitAudioContext; if (C) ac = new C(); } if (ac && ac.state === 'suspended') ac.resume(); };
function tone(f0, f1, dur, type, vol) { if (!ac || G.Input.mute) return; const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + dur); }
function noise(dur, vol, lp) { if (!ac || G.Input.mute) return; const t = ac.currentTime, n = Math.floor(ac.sampleRate * dur), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n); const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); f.type = 'lowpass'; f.frequency.value = lp; g.gain.value = vol; s.buffer = b; s.connect(f); f.connect(g); g.connect(ac.destination); s.start(t); }
const S = { swing: () => noise(.08, .12, 3000), hit: () => { noise(.07, .25, 1800); tone(180, 60, .09, 'square', .12); }, heavy: () => { noise(.16, .35, 900); tone(120, 40, .2, 'square', .2); },
  jump: () => tone(260, 520, .12, 'square', .07), land: () => noise(.05, .12, 500), pick: () => { tone(660, 990, .08, 'square', .1); setTimeout(() => tone(990, 1320, .1, 'square', .1), 70); },
  smash: () => { noise(.2, .3, 2200); tone(200, 80, .15, 'sawtooth', .1); }, ko: () => { tone(420, 70, .4, 'sawtooth', .15); noise(.25, .2, 1200); }, special: () => tone(200, 400, .1, 'sawtooth', .08),
  throw: () => tone(500, 160, .18, 'square', .1), go: () => { tone(520, 520, .1, 'square', .09); setTimeout(() => tone(780, 780, .15, 'square', .09), 120); }, ui: () => tone(440, 660, .06, 'square', .07), warn: () => tone(300, 300, .06, 'square', .05) };
A.play = (n) => { try { S[n] && S[n](); } catch (e) { } };
})(globalThis.GG = globalThis.GG || {});
