/* Cut-out rig renderer. Frames are assembled from pieces cut out of the supplied reference sprites (src/rigart.js),
   posed with the same pose tables as before: 2-bone IK on the pieces' real bone lengths, shared foot anchor, 2x supersampled
   box filtering, 5-bit palette posterise and a 1px outline. Johnny and every enemy are recolours/variants of those pieces. */
(function (G) {
'use strict';
const S = G.Sprites, Buf = S.Buf, CELL = S.CELL, AX = S.AX, AY = S.AY, SS = 1, Z = S.Z;
const b64 = (s) => typeof atob !== 'undefined' ? atob(s) : Buffer.from(s, 'base64').toString('binary');
const rad = (d) => d * Math.PI / 180;

/* ---- art decode (once per reference) ---- */
const ART = {};
function art(name) {
  if (ART[name]) return ART[name]; const A = G.RIGART[name]; const pal = A.pal.map(h => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]); const parts = {};
  for (const [n, p] of Object.entries(A.parts)) { const d = b64(p.d), c = b64(p.c), idx = new Uint8Array(d.length), cl = new Uint8Array(c.length); for (let i = 0; i < d.length; i++) { idx[i] = d.charCodeAt(i); cl[i] = c.charCodeAt(i); } parts[n] = { x: p.x, y: p.y, w: p.w, h: p.h, idx, cl }; }
  const J = A.joints; const top = parts.head ? parts.head.y : Math.min(...Object.values(parts).map(p => p.y)); const bottom = J.soleB[1];
  return ART[name] = { pal, parts, J, H: bottom - top };
}
const rgb2hsv = (r, g, b) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; } return [((h * 60) + 360) % 360, mx ? d / mx : 0, mx]; };
const hsv2rgb = (h, s, v) => { const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c; let r = 0, g = 0, b = 0; if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; } else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; } return [(r + m) * 255, (g + m) * 255, (b + m) * 255]; };
function tint(r, g, b, sp) {
  if (!sp) return [r, g, b]; if (sp.fill) return sp.fill;
  let [h, s, v] = rgb2hsv(r, g, b); if (sp.vMap) v = Math.min(1, sp.vMap[0] + v * sp.vMap[1]); else if (sp.vMul) v = Math.min(1, v * sp.vMul);
  if (sp.h !== undefined) h = sp.h; if (sp.s !== undefined) s = sp.s; else if (sp.sMul) s = Math.min(1, s * sp.sMul); return hsv2rgb(h, s, v);
}
/* class ids: 1 skin 2 coat 3 fleece 4 shirt 5 pants 6 shoes 7 hair 8 shades 9 mustache */
const CLS = ['', 'skin', 'coat', 'fleece', 'shirt', 'pants', 'shoes', 'hair', 'shades', 'mustache'];

/* ---- kit variants (recolour + head variant + width) ---- */
const SK = { h: 22, s: .45, vMul: .95 };
const V = {
  ricky: { art: 'ricky', pw: 'flag', restW: 90, ws: 1.45, tint: { pants: { h: 235, s: .25, vMul: .62 } } },
  vv: { art: 'vv', pw: 'mic', restW: 114, ws: 1.3, tint: { hair: { h: 30, s: .52, vMul: 1.32 } } },
  johnny: { art: 'johnny', pw: 'salami', restW: 53, ws: .66, twoHand: 88, stanceX: 2.7, weapon: 'salami' },
  mara: { art: 'vv', tint: { coat: { h: 350, s: .66, vMul: 1.15 }, hair: { h: 18, s: .5, vMul: .62 }, pants: { h: 24, s: .5, vMap: [0, 1.7] }, skin: { h: 22, s: .45, vMul: .92 } } },
};

/* ---- piece bitmaps (recoloured, head variants, prescaled to SS x final px) ---- */
function colorize(A, part, tintSpec) {
  const n = part.w * part.h, out = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { const id = part.idx[i]; if (!id) continue; const p = A.pal[id - 1], c = part.cl[i]; const col = c && tintSpec ? tint(p[0], p[1], p[2], tintSpec[CLS[c]]) : p; out[i * 4] = col[0]; out[i * 4 + 1] = col[1]; out[i * 4 + 2] = col[2]; out[i * 4 + 3] = 1; }
  return out;
}
function headVariant(A, part, px, kind, capC, tintSpec) {
  if (!kind) return; const w = part.w, h = part.h; let hy1 = 0, hx0 = 1e9, hx1 = 0, hy0 = 1e9, sy0 = 1e9;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = part.cl[y * w + x]; if (c === 7) { hy1 = Math.max(hy1, y); hx0 = Math.min(hx0, x); hx1 = Math.max(hx1, x); hy0 = Math.min(hy0, y); } if (c === 8) sy0 = Math.min(sy0, y); }
  const skinC = tintSpec && tintSpec.skin ? tint(225, 175, 130, tintSpec.skin) : [225, 175, 130]; const cut = sy0 < 1e8 ? sy0 - 2 : Math.round(h * .42);
  const set = (x, y, c) => { if (x < 0 || y < 0 || x >= w || y >= h) return; const i = (y * w + x) * 4; px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 1; };
  const sil = (x, y) => px[(y * w + x) * 4 + 3] > 0;
  if (kind === 'bald') { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (part.cl[y * w + x] === 7) { const sh = .88 + .12 * Math.cos((x - w * .55) / w * 3); set(x, y, [skinC[0] * sh, skinC[1] * sh, skinC[2] * sh]); } }
  if (kind === 'cap' || kind === 'beanie') { const cc = capC || [60, 60, 90]; for (let y = 0; y <= cut + (kind === 'beanie' ? 1 : 0); y++) for (let x = 0; x < w; x++) if (sil(x, y)) { const sh = .8 + .35 * (1 - y / Math.max(1, cut)) * (x > w * .55 ? .6 : 1); set(x, y, [Math.min(255, cc[0] * sh), Math.min(255, cc[1] * sh), Math.min(255, cc[2] * sh)]); }
    if (kind === 'cap') for (let x = Math.round(w * .5); x < w; x++) for (let y = cut; y <= cut + 2; y++) if (sil(x, y)) set(x, y, [cc[0] * .6, cc[1] * .6, cc[2] * .6]);
    if (kind === 'beanie') for (let x = 0; x < w; x++) if (sil(x, cut + 1)) set(x, cut + 1, [Math.min(255, cc[0] * 1.5), Math.min(255, cc[1] * 1.5), Math.min(255, cc[2] * 1.5)]); }
  if (kind === 'afro') for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (part.cl[y * w + x] === 7) { const t = ((x * 7 + y * 13) % 5 === 0) ? 1.9 : 1; set(x, y, [22 * t, 16 * t, 14 * t]); }
}
function prescale(px, w, h, fs) {
  const W = Math.max(1, Math.ceil(w * fs)), H = Math.max(1, Math.ceil(h * fs)), acc = new Float32Array(W * H * 4), cnt = new Float32Array(W * H);
  for (let y = 0; y < h; y++) { const dy = Math.min(H - 1, Math.floor((y + .5) * fs)); for (let x = 0; x < w; x++) { const dx = Math.min(W - 1, Math.floor((x + .5) * fs)), di = dy * W + dx; cnt[di]++; const i = (y * w + x) * 4; if (px[i + 3] > 0) { acc[di * 4] += px[i]; acc[di * 4 + 1] += px[i + 1]; acc[di * 4 + 2] += px[i + 2]; acc[di * 4 + 3] += 1; } } }
  const out = new Float32Array(W * H * 4); for (let i = 0; i < W * H; i++) { const a = acc[i * 4 + 3]; if (a > 0) { out[i * 4] = acc[i * 4] / a; out[i * 4 + 1] = acc[i * 4 + 1] / a; out[i * 4 + 2] = acc[i * 4 + 2] / a; out[i * 4 + 3] = Math.min(1, a / Math.max(1, cnt[i])); } }
  return { W, H, d: out, fs };
}
const CACHE = {};
function kitPieces(id) {
  if (CACHE[id]) return CACHE[id]; const v = V[id], A = art(v.art), k = S.K[id], f = (64 * k.scale * Z) / A.H, fs = f * SS, P = {};
  for (const [n, part] of Object.entries(A.parts)) { const px = colorize(A, part, v.tint); if (n === 'head') headVariant(A, part, px, v.head, v.capC, v.tint); P[n] = Object.assign(prescale(px, part.w, part.h, fs), { ox: part.x, oy: part.y }); }
  return CACHE[id] = { A, f, fs, P, v };
}

/* ---- compositing ---- */
function drawPiece(hi, HW, pc, J, pivot, world, rot, mul, clipY) {
  const px = (pivot[0] - pc.ox) * pc.fs, py = (pivot[1] - pc.oy) * pc.fs, wx = world[0] * SS, wy = world[1] * SS, c = Math.cos(rot), s = Math.sin(rot), m = mul || 1;
  const corners = [[0, 0], [pc.W, 0], [0, pc.H], [pc.W, pc.H]].map(q => { const u = [(q[0] - px) * m, (q[1] - py) * m]; return [wx + u[0] * c - u[1] * s, wy + u[0] * s + u[1] * c]; });
  const yMax = clipY === undefined ? HW - 1 : clipY; const x0 = Math.max(0, Math.floor(Math.min(...corners.map(q => q[0])))), x1 = Math.min(HW - 1, Math.ceil(Math.max(...corners.map(q => q[0])))), y0 = Math.max(0, Math.floor(Math.min(...corners.map(q => q[1])))), y1 = Math.min(yMax, Math.ceil(Math.max(...corners.map(q => q[1]))));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const vx = x + .5 - wx, vy = y + .5 - wy, u = (vx * c + vy * s) / m + px, w2 = (-vx * s + vy * c) / m + py, sx = Math.floor(u), sy = Math.floor(w2); if (sx < 0 || sy < 0 || sx >= pc.W || sy >= pc.H) continue;
    // bilinear (premultiplied) sample of the prescaled piece
    const fx = u - .5, fy = w2 - .5, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0; let cr = 0, cg = 0, cb = 0, ca = 0;
    for (let jy = 0; jy < 2; jy++) for (let jx = 0; jx < 2; jx++) { const qx = x0 + jx, qy = y0 + jy; if (qx < 0 || qy < 0 || qx >= pc.W || qy >= pc.H) continue; const wgt = (jx ? tx : 1 - tx) * (jy ? ty : 1 - ty), qi = (qy * pc.W + qx) * 4, qa = pc.d[qi + 3] * wgt; if (qa > 0) { cr += pc.d[qi] * qa; cg += pc.d[qi + 1] * qa; cb += pc.d[qi + 2] * qa; ca += qa; } }
    if (ca < .5) continue; const a = Math.min(1, ca * 1.15), di = (y * HW + x) * 4, ia = 1 - a, il = 1 / ca;
    hi[di] = cr * il * a + hi[di] * ia; hi[di + 1] = cg * il * a + hi[di + 1] * ia; hi[di + 2] = cb * il * a + hi[di + 2] * ia; hi[di + 3] = a + hi[di + 3] * ia;
  }
}
const ang = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
const smooth = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
/* Linear-blend skinning of one limb texture over a 3-joint chain (root, mid, end): the limb bends continuously at the knee/elbow and,
   optionally, blends into the torso transform near the root so hips/shoulders never tear. Forward-splats 2x2 into the hi-res buffer. */
function skinLimb(hi, HW, pc, f, A0, B0, C0, Aw, Bw, Cw, torsoFn, clipY) {
  const ax = C0[0] - A0[0], ay = C0[1] - A0[1], len = Math.hypot(ax, ay), ux = ax / len, uy = ay / len, tk = (B0[0] - A0[0]) * ux + (B0[1] - A0[1]) * uy, r = .13 * len, rh = .2 * len;
  const th1 = ang(Aw, Bw) - ang(A0, B0), th2 = ang(Bw, Cw) - ang(B0, C0), c1 = Math.cos(th1), s1 = Math.sin(th1), c2 = Math.cos(th2), s2 = Math.sin(th2), yMax = clipY === undefined ? HW - 1 : clipY;
  for (let sy = 0; sy < pc.H; sy++) for (let sx = 0; sx < pc.W; sx++) {
    const si = (sy * pc.W + sx) * 4, al = pc.d[si + 3]; if (al <= 0) continue;
    const px = pc.ox + (sx + .5) / pc.fs, py = pc.oy + (sy + .5) / pc.fs, tau = (px - A0[0]) * ux + (py - A0[1]) * uy, w2 = smooth((tau - (tk - r)) / (2 * r));
    const d1x = (px - A0[0]) * f, d1y = (py - A0[1]) * f, d2x = (px - B0[0]) * f, d2y = (py - B0[1]) * f;
    let X = (Aw[0] + d1x * c1 - d1y * s1) * (1 - w2) + (Bw[0] + d2x * c2 - d2y * s2) * w2, Y = (Aw[1] + d1x * s1 + d1y * c1) * (1 - w2) + (Bw[1] + d2x * s2 + d2y * c2) * w2;
    if (torsoFn) { const wt = 1 - smooth(tau / rh); if (wt > 0) { const T = torsoFn(px, py); X = T[0] * wt + X * (1 - wt); Y = T[1] * wt + Y * (1 - wt); } }
    const hx = Math.floor(X * SS), hy = Math.floor(Y * SS);
    for (let oy = 0; oy < 2; oy++) for (let ox = 0; ox < 2; ox++) { const x = hx + ox, y = hy + oy; if (x < 0 || y < 0 || x >= HW || y > yMax) continue; const di = (y * HW + x) * 4, ia = 1 - al; hi[di] = pc.d[si] * al + hi[di] * ia; hi[di + 1] = pc.d[si + 1] * al + hi[di + 1] * ia; hi[di + 2] = pc.d[si + 2] * al + hi[di + 2] * ia; hi[di + 3] = al + hi[di + 3] * ia; }
  }
}
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

function renderFrame(id, pose, anim) {
  const K = kitPieces(id), A = K.A, J = A.J, f = K.f, P = K.P, k = S.K[id], s = k.scale * Z, v = K.v;
  const lean = rad(pose.lean), cl = Math.cos(lean), sl = Math.sin(lean), HW = CELL * SS, hi = new Float32Array(HW * HW * 4);
  const L = (a, b) => dist(J[a], J[b]) * f;
  const Lth = (L('hipB', 'knB') + L('hipF', 'knF')) / 2, Lsh = (L('knB', 'anB') + L('knF', 'anF')) / 2, totB = L('hipB', 'knB') + L('knB', 'anB') + (J.soleB[1] - J.anB[1]) * f, totF = L('hipF', 'knF') + L('knF', 'anF') + (J.soleF[1] - J.anF[1]) * f, lamL = Math.min(totB, totF) / (26 * s); /* both legs must reach the ground: size to the shorter */
  const upperLen = dist(J.shN, J.elN) * f, foreN = dist(J.elN, J.haN) * f, foreF = dist(J.elF, J.haF) * f;
  const lamAN = (upperLen + foreN) / (18 * s), lamAF = (upperLen + foreF) / (18 * s);
  const legDrop = (((J.hipB[1] + J.hipF[1]) / 2) - J.hip[1]) * f, hipS = [AX + pose.hip[0] * s * lamL, AY - pose.hip[1] * s * lamL - legDrop]; /* pose hip height is the height of the LEG joints, so lift the torso pivot by the drop to them */
  const tp = (Q) => { const dx = (Q[0] - J.hip[0]) * f, dy = (Q[1] - J.hip[1]) * f; return [hipS[0] + dx * cl - dy * sl, hipS[1] + dx * sl + dy * cl]; };
  const oldHip = [pose.hip[0] * s, pose.hip[1] * s], oldSh = [oldHip[0] + Math.sin(lean) * 18 * s, oldHip[1] + Math.cos(lean) * 18 * s];
  const handTarget = (sh, h, lam) => [sh[0] + (h[0] * s - oldSh[0]) * lam, sh[1] - (h[1] * s - oldSh[1]) * lam];
  const groundClip = AY * SS - 1, clipOn = !(anim === 'down' || anim === 'dead' || anim === 'knock');
  const draw = (nm, pivot, world, rot, mul) => { if (P[nm]) drawPiece(hi, HW, P[nm], J, pivot, world, rot, mul, clipOn ? groundClip : undefined); };
  // legs
  const sx_ = v.stanceX || 1, leg = (sfx, foot0) => { const dxp = foot0[0] - pose.hip[0], mul = Math.abs(dxp) <= 6 ? sx_ : 1 + (sx_ - 1) * .35, foot = [pose.hip[0] + dxp * mul, foot0[1]]; /* a wide-stance source keeps its stance when standing, but strides stay moderate */ const hp = tp(J['hip' + sfx]), sole = [AX + foot[0] * s * lamL, AY - foot[1] * s * lamL], offA = [(J['an' + sfx][0] - J['sole' + sfx][0]) * f, (J['an' + sfx][1] - J['sole' + sfx][1]) * f];
    const L1 = dist(J['hip' + sfx], J['kn' + sfx]) * f, L2 = dist(J['kn' + sfx], J['an' + sfx]) * f; let tx = sole[0] + offA[0], ty = sole[1] + offA[1];
    { const dyy = ty - hp[1], dxx = tx - hp[0], mx = Math.sqrt(Math.max(0, ((L1 + L2) * .985) ** 2 - dyy * dyy)); if (Math.abs(dxx) > mx) { const nx = hp[0] + Math.sign(dxx) * mx; sole[0] += nx - tx; tx = nx; } } /* never stretch a leg past its length: the foot stays planted */
    const r = S.ik(hp[0], hp[1], tx, ty, L1, L2, pose.legBend); if (r.mid[1] > AY - 3) r.mid[1] = AY - 3;
    return { hp, knee: r.mid, ankle: r.end, sole: [r.end[0] - offA[0], r.end[1] - offA[1]], tR: ang(hp, r.mid) - ang(J['hip' + sfx], J['kn' + sfx]), sR: ang(r.mid, r.end) - ang(J['kn' + sfx], J['an' + sfx]), sfx }; };
  const lB = leg('B', pose.fB), lF = leg('F', pose.fF);
  const tilt = (l, foot) => { const lift = Math.min(8, Math.max(0, foot[1])); return lift > .5 ? rad((foot[0] < 0 ? 1 : -.45) * lift * 3.2) : 0; };
  const drawLeg = (l, foot) => { if (P['leg' + l.sfx]) skinLimb(hi, HW, P['leg' + l.sfx], f, J['hip' + l.sfx], J['kn' + l.sfx], J['an' + l.sfx], l.hp, l.knee, l.ankle, (x, y) => tp([x, y]), clipOn ? groundClip : undefined); draw('foot' + l.sfx, J['an' + l.sfx], l.ankle, tilt(l, foot)); };
  // arms
  const shN = tp(J.shN), shF = tp(J.shF), hN = handTarget(shN, pose.hB, lamAN), hF = handTarget(shF, pose.hF, lamAF);
  const aF = S.ik(shF[0], shF[1], hF[0], hF[1], upperLen, foreF, [-.4, 1]);
  const rotF = ang(aF.mid, aF.end) - ang(J.elF, J.haF), gx = (J.grip[0] - J.elF[0]) * f, gy = (J.grip[1] - J.elF[1]) * f, gripW = [aF.mid[0] + gx * Math.cos(rotF) - gy * Math.sin(rotF), aF.mid[1] + gx * Math.sin(rotF) + gy * Math.cos(rotF)];
  const wdx = Math.cos(rad(pose.wang)), wdy = -Math.sin(rad(pose.wang)), hN2 = v.twoHand ? [gripW[0] - wdx * v.twoHand * f * (v.ws || 1) + (pose.ext || 0) * s * wdx, gripW[1] - wdy * v.twoHand * f * (v.ws || 1) + (pose.ext || 0) * s * wdy] : hN;
  const aN = S.ik(shN[0], shN[1], hN2[0], hN2[1], upperLen, foreN, [-.4, 1]);
  const neck = tp(J.neck), headRot = rad(pose.head), hairP = J.hairP ? tp(J.hairP) : null;
  // draw order (back to front)
  if (P.hair) draw('hair', J.hairP, hairP, headRot * .5 - lean * .35);
  drawLeg(lB, pose.fB);
  draw('torso', J.hip, hipS, lean);
  drawLeg(lF, pose.fF);
  draw('head', J.neck, neck, headRot);
  if (P.armN) skinLimb(hi, HW, P.armN, f, J.shN, J.elN, J.haN, shN, aN.mid, aN.end, (x, y) => tp([x, y]), clipOn ? groundClip : undefined);
  const wk = k.weapon, ext = (pose.ext || 0) * s;
  if (P.weapon && v.pw && wk === v.pw) {
    const restW = v.restW, ws = v.ws, dxs = Math.cos(rad(pose.wang)), dys = -Math.sin(rad(pose.wang)), wpos = [gripW[0] + dxs * ext, gripW[1] + dys * ext];
    if (wk === 'mic') { const belt = tp(J.belt), sag = 9 * s * Math.max(0, 1 - ext / (22 * s)) + 2, B2 = wpos; const C = [(belt[0] + B2[0]) / 2, (belt[1] + B2[1]) / 2 + sag]; for (let i = 0; i <= 30; i++) { const u = i / 30, x = (1 - u) * (1 - u) * belt[0] + 2 * u * (1 - u) * C[0] + u * u * B2[0], y = (1 - u) * (1 - u) * belt[1] + 2 * u * (1 - u) * C[1] + u * u * B2[1]; const hx = Math.round(x * SS), hy = Math.round(y * SS); for (let ox = 0; ox < 2; ox++) for (let oy = 0; oy < 2; oy++) { const q = ((hy + oy) * HW + hx + ox) * 4; if (q >= 0 && q < hi.length) { hi[q] = 40; hi[q + 1] = 40; hi[q + 2] = 50; hi[q + 3] = 1; } } } }
    draw('weapon', J.grip, wpos, rad(restW - pose.wang), ws);
  }
  draw('upperNear', J.shN, shF, ang(shF, aF.mid) - ang(J.shN, J.elN)); draw('foreFar', J.elF, aF.mid, rotF);
  // downsample hi -> cell (with optional horizontal stretch), threshold, posterise
  const buf = new Buf(CELL, CELL), xs = pose.lean > -30 ? (v.xs || 1) : 1;
  for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
    let r = 0, g = 0, b = 0, a = 0; const sx0 = (AX + (x - AX) / xs) * SS, sx1 = (AX + (x + 1 - AX) / xs) * SS;
    for (let yy = 0; yy < SS; yy++) for (let xx = 0; xx < SS; xx++) { const hx = Math.min(HW - 1, Math.floor(sx0 + (sx1 - sx0) * (xx + .5) / SS)), q = ((y * SS + yy) * HW + hx) * 4, al = hi[q + 3]; if (al > 0) { r += hi[q] * al; g += hi[q + 1] * al; b += hi[q + 2] * al; a += al; } }
    if (a >= SS * SS * .5) { r = Math.round(r / a) & 0xf8; g = Math.round(g / a) & 0xf8; b = Math.round(b / a) & 0xf8; buf.d[y * CELL + x] = ((255 << 24) | (Math.min(255, b + 4) << 16) | (Math.min(255, g + 4) << 8) | Math.min(255, r + 4)) >>> 0; }
  }
  // procedural weapons that are not part of the reference art (salami, baton, case, cane)
  if (wk && !(P.weapon && v.pw && wk === v.pw)) { const hand = [aF.end[0], aF.end[1]]; const tmp = new Buf(CELL, CELL); S.drawWeapon(tmp, k, pose, hand, hipS, s); for (let i = 0; i < tmp.d.length; i++) if (tmp.d[i] && (!clipOn || i < AY * CELL)) buf.d[i] = tmp.d[i]; }
  if (anim === 'down' || anim === 'dead') { let bot = 0; for (let y = CELL - 1; y >= 0 && !bot; y--) for (let x = 0; x < CELL; x++) if (buf.d[y * CELL + x]) { bot = y; break; } const dy = bot - (AY - 1); if (dy > 0) { for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) buf.d[y * CELL + x] = y + dy < CELL ? buf.d[(y + dy) * CELL + x] : 0; } }
  buf.outline(0xff261218 >>> 0); buf.outline(0xff261218 >>> 0);
  return { buf, rig: { hip: hipS, sh: neck, head: [neck[0] - sl * 6 * s, neck[1] - cl * 9 * s], hand: aF.end, lF, lB } };
}

function renderRigKit(id, isPlayer) {
  const k = S.K[id], poses = S.buildPoses(k, isPlayer), frames = {}, rigs = {};
  for (const a in poses) { frames[a] = []; rigs[a] = []; poses[a].forEach(p => { const r = renderFrame(id, p, a); frames[a].push(r.buf); rigs[a].push(r.rig); }); }
  return { id, kit: k, frames, rigs, poses };
}
S.renderRigKit = renderRigKit; S.RIGVARIANTS = V;
Object.keys(V).forEach(id => { if (S.K[id]) { S.K[id].art = V[id].art; if (V[id].weapon) S.K[id].weapon = V[id].weapon; } });
})(globalThis.GG = globalThis.GG || {});
