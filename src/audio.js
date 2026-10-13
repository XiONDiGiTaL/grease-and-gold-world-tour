/* 8-bit style WebAudio SFX (synthesised, no files). Muted with M. */
(function (G) {
'use strict';
let ac = null; const A = G.Audio = {};
A.unlock = () => { if (typeof window === 'undefined') return; if (G.Music) G.Music.retry(); if (!ac) { const C = window.AudioContext || window.webkitAudioContext; if (C) ac = new C(); } if (ac && ac.state === 'suspended') ac.resume(); };
function tone(f0, f1, dur, type, vol) { if (!ac || G.Input.mute) return; const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + dur); }
function noise(dur, vol, lp) { if (!ac || G.Input.mute) return; const t = ac.currentTime, n = Math.floor(ac.sampleRate * dur), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n); const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); f.type = 'lowpass'; f.frequency.value = lp; g.gain.value = vol; s.buffer = b; s.connect(f); f.connect(g); g.connect(ac.destination); s.start(t); }
const S = { swing: () => noise(.08, .12, 3000), hit: () => { noise(.07, .25, 1800); tone(180, 60, .09, 'square', .12); }, heavy: () => { noise(.16, .35, 900); tone(120, 40, .2, 'square', .2); },
  jump: () => tone(260, 520, .12, 'square', .07), land: () => noise(.05, .12, 500), pick: () => { tone(660, 990, .08, 'square', .1); setTimeout(() => tone(990, 1320, .1, 'square', .1), 70); },
  smash: () => { noise(.2, .3, 2200); tone(200, 80, .15, 'sawtooth', .1); }, ko: () => { tone(420, 70, .4, 'sawtooth', .15); noise(.25, .2, 1200); }, special: () => tone(200, 400, .1, 'sawtooth', .08),
  throw: () => tone(500, 160, .18, 'square', .1), go: () => { tone(520, 520, .1, 'square', .09); setTimeout(() => tone(780, 780, .15, 'square', .09), 120); }, ui: () => tone(440, 660, .06, 'square', .07), warn: () => tone(300, 300, .06, 'square', .05) };
/* background music: two embedded tracks (src/music.js). Browsers need a user gesture; play() retries on the next input. */
const M = G.Music = { cur: null, els: {}, pend: false };
function el(name) { if (M.els[name]) return M.els[name]; if (typeof Audio === 'undefined' || !G.MUSIC || !G.MUSIC[name]) return null; const a = new Audio(G.MUSIC[name]); a.loop = true; a.preload = 'auto'; a.volume = .55; M.els[name] = a; return a; }
M.play = (name) => { if (M.cur === name) return; M.stop(); const a = el(name); if (!a) return; M.cur = name; try { a.currentTime = 0; const p = a.play(); if (p && p.catch) p.catch(() => { M.pend = true; }); } catch (e) { M.pend = true; } };
M.stop = () => { if (M.cur && M.els[M.cur]) { try { M.els[M.cur].pause(); } catch (e) { } } M.cur = null; };
M.duck = (d) => { const a = M.els[M.cur]; if (a) a.volume = d ? .18 : .55; };
M.sync = () => { for (const k in M.els) M.els[k].muted = !!G.Input.mute; };
M.retry = () => { const a = M.els[M.cur]; if (M.cur && a && a.paused) { try { const p = a.play(); if (p && p.catch) p.catch(() => { }); } catch (e) { } } };
A.play = (n) => { try { S[n] && S[n](); } catch (e) { } };
})(globalThis.GG = globalThis.GG || {});
