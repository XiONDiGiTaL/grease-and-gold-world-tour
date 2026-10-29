/* Audio: WebAudio arcade SFX + a small original chiptune sequencer.
   No external audio files, so the game boots instantly and stays offline. */
(function (G) {
'use strict';
const A = G.Audio = { ctx: null, musicVol: .55, sfxVol: .8, ducked: false, current: null, _step: 0, _next: 0, enabled: false };

A.unlock = function () {
  if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  A.ctx = new AC();
  A.master = A.ctx.createGain(); A.master.gain.value = .9; A.master.connect(A.ctx.destination);
  A.musicBus = A.ctx.createGain(); A.musicBus.gain.value = A.musicVol * .34; A.musicBus.connect(A.master);
  A.sfxBus = A.ctx.createGain(); A.sfxBus.gain.value = A.sfxVol; A.sfxBus.connect(A.master);
  A.noise = A.ctx.createBuffer(1, A.ctx.sampleRate * .5, A.ctx.sampleRate);
  const d = A.noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  A.enabled = true;
  if (A._wanted) A.music(A._wanted);
  A._next = A.ctx.currentTime + .1;
};
A.applySettings = function (s) {
  A.musicVol = s.music; A.sfxVol = s.sfx;
  if (A.musicBus) A.musicBus.gain.value = A.musicVol * .34 * (A.ducked ? .25 : 1);
  if (A.sfxBus) A.sfxBus.gain.value = A.sfxVol;
  if (A.el) A.el.volume = trackVol();
};
A.duck = function (on) {
  A.ducked = on;
  if (A.musicBus) A.musicBus.gain.value = A.musicVol * .34 * (on ? .2 : 1);
  if (A.el) A.el.volume = trackVol();
};
function tone(freq, dur, type, gain, slide, when) {
  if (!A.enabled) return;
  const t = when || A.ctx.currentTime;
  const o = A.ctx.createOscillator(), g = A.ctx.createGain();
  o.type = type || 'square';
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain || .25, t + .008);
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g); g.connect(A.sfxBus);
  o.start(t); o.stop(t + dur + .02);
}
function noise(dur, gain, hp, when) {
  if (!A.enabled) return;
  const t = when || A.ctx.currentTime;
  const s = A.ctx.createBufferSource(); s.buffer = A.noise;
  const f = A.ctx.createBiquadFilter(); f.type = hp ? 'highpass' : 'lowpass';
  f.frequency.value = hp || 2600;
  const g = A.ctx.createGain();
  g.gain.setValueAtTime(gain || .3, t);
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(A.sfxBus);
  s.start(t); s.stop(t + dur + .02);
}
A.sfx = function (name) {
  if (!A.ctx || !A.enabled) return;
  const t = A.ctx.currentTime;
  switch (name) {
    case 'hit': tone(150, .07, 'square', .18, -60); noise(.05, .12, 2000); break;
    case 'heavy': tone(90, .14, 'sawtooth', .26, -40); noise(.12, .22, 900); break;
    case 'swing': noise(.1, .1, 3200); break;
    case 'jump': tone(260, .12, 'square', .13, 160); break;
    case 'land': noise(.09, .16, 500); tone(70, .08, 'square', .12, -20); break;
    case 'pick': tone(660, .07, 'square', .16); tone(990, .09, 'square', .14, 0, t + .07); break;
    case 'smash': noise(.22, .3, 700); tone(70, .2, 'sawtooth', .2, -30); break;
    case 'ui': tone(520, .045, 'square', .1); break;
    case 'go': [392, 523, 659, 784].forEach((f, i) => tone(f, .1, 'square', .14, 0, t + i * .07)); break;
    case 'ko': tone(200, .35, 'sawtooth', .22, -150); noise(.3, .2, 500); break;
    case 'warn': tone(880, .06, 'square', .1); break;
    case 'special': tone(330, .2, 'square', .15, 300); noise(.16, .12, 2800); break;
    case 'grab': tone(240, .06, 'square', .14, 60); break;
    case 'throw': noise(.14, .18, 1600); tone(420, .1, 'square', .1, -220); break;
  }
};
/* ---------------- music ----------------
   Real soundtrack, streamed from assets/music: the two tracks that ship with
   the project (arcade_tune, i_dont_kneel). The browser fetches them lazily, so
   the bundle stays small and a missing track only costs silence, not a boot
   failure. The chiptune sequencer below is the fallback when a file cannot be
   loaded or autoplay stays blocked. */
const TRACKS = {
  title: 'arcade_tune', arcade: 'arcade_tune', kneel: 'i_dont_kneel',
  training: 'arcade_tune', victory: 'i_dont_kneel'
};
const MUSIC_DIR = 'assets/music/';
A.el = null; A.tracks = {}; A._wanted = null; A._fallback = false;
function trackVol() { return Math.max(0, Math.min(1, A.musicVol)) * (A.ducked ? .22 : 1) * .9; }
function audioEl(file) {
  let el = A.tracks[file];
  if (el) return el;
  if (typeof Audio === 'undefined') return null;
  el = new Audio();
  el.src = MUSIC_DIR + file + '.mp3';
  el.loop = true; el.preload = 'auto'; el.volume = trackVol();
  el.addEventListener('error', () => { A._fallback = true; startChiptune(A._wanted); });
  A.tracks[file] = el;
  return el;
}
A.music = function (name) {
  name = TRACKS[name] ? name : 'arcade';
  A._wanted = name;
  const el = audioEl(TRACKS[name]);
  if (!el) { startChiptune(name); return; }
  if (A.el === el && !el.paused) { el.volume = trackVol(); return; }
  if (A.el && A.el !== el) { try { A.el.pause(); A.el.currentTime = 0; } catch (e) {} }
  A._fallback = false;
  stopChiptune();
  A.el = el;
  el.volume = trackVol();
  const p = el.play();
  if (p && p.catch) p.catch(() => { /* autoplay blocked until unlock() */ });
};
A.stop = function () {
  A._wanted = null;
  if (A.el) { try { A.el.pause(); } catch (e) {} }
  stopChiptune();
};
A.tick = function () { if (A._fallback) chiptuneTick(); };

/* ---- chiptune fallback ---- */
const PATTERNS = {
  title: { bpm: 96, root: 45, lead: [0, 3, 5, 7, 5, 3, 0, -2, 0, 5, 7, 10, 7, 5, 3, 0], bass: [0, 0, 5, 5, 3, 3, 7, 7], hat: 1 },
  arcade: { bpm: 132, root: 40, lead: [0, 7, 5, 3, 0, 10, 7, 5, 3, 5, 7, 10, 12, 10, 7, 5], bass: [0, 0, 3, 3, 5, 5, 7, 7], hat: 1 },
  kneel: { bpm: 112, root: 38, lead: [0, 0, 3, 5, 7, 5, 3, 0, -2, 0, 3, 7, 5, 3, 0, -2], bass: [0, 0, 0, 3, 5, 5, 3, 0], hat: 0 },
  training: { bpm: 100, root: 43, lead: [0, 3, 5, 3, 7, 5, 3, 0, 5, 7, 10, 7, 5, 3, 0, 0], bass: [0, 0, 5, 5, 3, 3, 7, 7], hat: 0 }
};
function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }
let chiptuneName = null;
function startChiptune(name) {
  if (!PATTERNS[name]) name = 'arcade';
  chiptuneName = name; A._step = 0; A._next = A.ctx ? A.ctx.currentTime + .06 : 0;
}
function stopChiptune() { chiptuneName = null; }
function chiptuneTick() {
  if (!A.enabled || !chiptuneName) return;
  const pat = PATTERNS[chiptuneName];
  const spb = 60 / pat.bpm / 2;      /* eighth notes */
  const now = A.ctx.currentTime;
  if (A._next < now - .5) A._next = now + .02;
  while (A._next < now + .12) {
    const s = A._step, t = A._next;
    const lead = pat.lead[s % pat.lead.length];
    const bass = pat.bass[s % pat.bass.length];
    if (s % 2 === 0 || pat.lead[(s + 1) % pat.lead.length] !== lead) {
      const o = A.ctx.createOscillator(), g = A.ctx.createGain();
      o.type = 'square'; o.frequency.value = midi(pat.root + 24 + lead);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.06, t + .01);
      g.gain.exponentialRampToValueAtTime(.0001, t + spb * .9);
      o.connect(g); g.connect(A.musicBus); o.start(t); o.stop(t + spb);
    }
    if (s % 2 === 0) {
      const o = A.ctx.createOscillator(), g = A.ctx.createGain();
      o.type = 'triangle'; o.frequency.value = midi(pat.root + bass);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.1, t + .01);
      g.gain.exponentialRampToValueAtTime(.0001, t + spb * 1.8);
      o.connect(g); g.connect(A.musicBus); o.start(t); o.stop(t + spb * 2);
    }
    if (pat.hat && s % 2 === 1) {
      const src = A.ctx.createBufferSource(); src.buffer = A.noise;
      const f = A.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
      const g = A.ctx.createGain(); g.gain.setValueAtTime(.05, t); g.gain.exponentialRampToValueAtTime(.0001, t + .05);
      src.connect(f); f.connect(g); g.connect(A.musicBus); src.start(t); src.stop(t + .06);
    }
    A._next += spb; A._step++;
  }
}
})(globalThis.GG = globalThis.GG || {});
