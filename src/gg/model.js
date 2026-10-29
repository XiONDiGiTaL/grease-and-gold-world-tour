/* Grease & Gold - 3D model art pipeline.
 *
 * The fighters are built as low-poly solids (frusta, prisms, spheres) on a
 * jointed skeleton, lit with a quantised three-tone ramp and rasterised with a
 * depth buffer, then trimmed into the exact frame format the game already
 * consumes. Nothing here runs at play time: `node tools/gg_art.js --3d`
 * pre-renders the atlas, so the shipped game still draws plain sprites.
 *
 * This replaces the 2D bone rig for production art: volume, overlap and weapon
 * attachment are resolved by geometry instead of being faked with cut-outs.
 */
(function (G) {
'use strict';
const Art = G.Art;
const CW = 132, CH = 116, AX = 66, AY = 104;
const DEG = Math.PI / 180;
const OUT = 0x140d18;

/* ---------------- small vector helpers ---------------- */
const v3 = (x, y, z) => ({ x: x, y: y, z: z });
const add = (a, b) => v3(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a, b) => v3(a.x - b.x, a.y - b.y, a.z - b.z);
const mul = (a, k) => v3(a.x * k, a.y * k, a.z * k);
const cross = (a, b) => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const norm = (a) => { const l = Math.hypot(a.x, a.y, a.z) || 1; return v3(a.x / l, a.y / l, a.z / l); };
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
/* pose angle: 0 = straight down, positive = forward (+x) */
const dir = (deg) => v3(Math.sin(deg * DEG), -Math.cos(deg * DEG), 0);
/* rotate in the screen plane (x forward, y up) */
function rot(v, deg) { const c = Math.cos(deg * DEG), s = Math.sin(deg * DEG); return v3(v.x * c - v.y * s, v.x * s + v.y * c, v.z); }

/* ---------------- colour ---------------- */
function shade(col, i) {
  let r = col & 255, g = (col >> 8) & 255, b = (col >> 16) & 255;
  r = Math.max(0, Math.min(255, Math.round(r * i)));
  g = Math.max(0, Math.min(255, Math.round(g * i)));
  b = Math.max(0, Math.min(255, Math.round(b * i)));
  return (0xFF000000 | (b << 16) | (g << 8) | r) >>> 0;
}
function tone(pal, n) {
  /* three-tone cel ramp: highlight / base / shadow, quantised so flat faces
     stay flat instead of turning into a muddy gradient */
  if (!pal || !pal.base) return 0xFF6a5a70;
  const l = dot(norm(n), LIGHT);
  if (l > 0.55) return pal.hi || pal.base;
  if (l > 0.08) return pal.base;
  return pal.sh || pal.base;
}

/* ---------------- primitives ---------------- */
function emit(tris, a, b, c, pal, shadeIt) {
  const n = norm(cross(sub(b, a), sub(c, a)));
  tris.push({ a: a, b: b, c: c, col: tone(pal, n), flat: shadeIt ? shade(pal.base, shadeIt) : 0 });
}
/* tapered rectangular solid between two centres (torso, limbs, hair) */
function frustum(tris, a, b, w0, d0, w1, d1, pal, dark) {
  const corners = (p, w, d) => [v3(p.x - w, p.y, p.z - d), v3(p.x + w, p.y, p.z - d), v3(p.x + w, p.y, p.z + d), v3(p.x - w, p.y, p.z + d)];
  const A = corners(a, w0, d0), B = corners(b, w1, d1);
  const p = dark ? { base: shade(pal.base, .8), hi: shade(pal.hi || pal.base, .8), sh: shade(pal.sh || pal.base, .8) } : pal;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    emit(tris, A[i], A[j], B[j], p); emit(tris, A[i], B[j], B[i], p);
  }
  emit(tris, A[3], A[2], A[1], p); emit(tris, A[3], A[1], A[0], p);
  emit(tris, B[3], B[2], B[1], p); emit(tris, B[3], B[1], B[0], p);
}
/* round limb segment */
function prism(tris, a, b, r0, r1, pal, sides, dark) {
  const axis = norm(sub(b, a));
  let up = Math.abs(axis.y) > .9 ? v3(0, 0, 1) : v3(0, 1, 0);
  const u = norm(cross(axis, up)), w = norm(cross(axis, u));
  const n = sides || 6;
  const p = dark ? { base: shade(pal.base, .82), hi: shade(pal.hi || pal.base, .82), sh: shade(pal.sh || pal.base, .82) } : pal;
  for (let i = 0; i < n; i++) {
    const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
    const o0 = add(mul(u, Math.cos(a0) * r0), mul(w, Math.sin(a0) * r0));
    const o1 = add(mul(u, Math.cos(a1) * r0), mul(w, Math.sin(a1) * r0));
    const o2 = add(mul(u, Math.cos(a1) * r1), mul(w, Math.sin(a1) * r1));
    const o3 = add(mul(u, Math.cos(a0) * r1), mul(w, Math.sin(a0) * r1));
    emit(tris, add(a, o0), add(a, o1), add(b, o2), p);
    emit(tris, add(a, o0), add(b, o2), add(b, o3), p);
    emit(tris, a, add(a, o1), add(a, o0), p);
    emit(tris, b, add(b, o3), add(b, o2), p);
  }
}
function sphere(tris, c, r, pal, squash) {
  const LAT = 5, LON = 8, sy = squash || 1;
  const pt = (lat, lon) => {
    const th = lat / LAT * Math.PI, ph = lon / LON * Math.PI * 2;
    return v3(c.x + Math.sin(th) * Math.cos(ph) * r, c.y + Math.cos(th) * r * sy, c.z + Math.sin(th) * Math.sin(ph) * r);
  };
  for (let i = 0; i < LAT; i++) for (let j = 0; j < LON; j++) {
    const a = pt(i, j), b = pt(i + 1, j), d = pt(i + 1, j + 1), e = pt(i, j + 1);
    if (i > 0) emit(tris, a, b, e, pal);
    if (i < LAT - 1) emit(tris, b, d, e, pal);
  }
}
function quad(tris, a, b, c, d, pal) { emit(tris, a, b, c, pal); emit(tris, a, c, d, pal); }

/* ---------------- skeleton ---------------- */
function skeleton(kit, P) {
  const b = kit.b, s = b.s;
  const hipY = b.hipY * s, torso = b.torso * s;
  const pelvis = v3(0, hipY, 0);
  const top = add(pelvis, rot(v3(0, torso, 0), -P.lean));
  const sw = b.shW * s, hw = b.hipW * s, headR = b.headR * s;
  const head = add(top, rot(v3(0, b.headY * s + 1.5, 0), -(P.lean + P.head)));
  /* limbs sit outside the torso volume so arms and legs keep their own
     silhouette instead of melting into the body */
  const legSide = 3.1 * s, armSide = 5.6 * s;
  const lunge = (P.dx || 0) * s;
  const hipF = add(add(pelvis, v3(lunge + hw * .18, -1.5, legSide)), v3(0, 0, 0));
  const hipB = add(pelvis, v3(lunge - hw * .18, -1.5, -legSide));
  const knee = (h, ang) => add(h, mul(dir(ang), b.legU * s));
  const shin = (k, ang) => add(k, mul(dir(ang), b.legL * s));
  const shF = add(add(top, v3(lunge + sw * .47, -2.2, armSide)), v3(0, 0, 0));
  const shB = add(top, v3(lunge - sw * .47, -2.2, -armSide));
  const elbow = (sh, ang) => add(sh, mul(dir(ang), b.armU * s));
  const hand = (el, ang) => add(el, mul(dir(ang), b.armL * s));
  const kF = knee(hipF, P.hf), aF = shin(kF, P.kf);
  const kB = knee(hipB, P.hb), aB = shin(kB, P.kb);
  const eF = elbow(shF, P.sf), hF = hand(eF, P.ef);
  const eB = elbow(shB, P.sb), hB = hand(eB, P.eb);
  return { pelvis: pelvis, top: top, head: head, hipF: hipF, kneeF: kF, anF: aF, hipB: hipB, kneeB: kB, anB: aB,
    shF: shF, elF: eF, haF: hF, shB: shB, elB: eB, haB: hB, headR: headR, sw: sw, hw: hw, s: s, lean: P.lean };
}

/* ---------------- garments ---------------- */
function buildBody(tris, kit, J, P) {
  const pal = kit.pal, s = J.s, b = kit.b;
  const cloth = pal.coat || pal.suit || pal.denim || pal.top || pal.vest || pal.shirt;
  const pants = pal.pants || pal.leather || pal.denimLt || pal.suit || cloth;
  const shoe = pal.boot || pal.shoe || pal.suit || pants;

  /* legs: far leg first, slightly darker to push it back */
  prism(tris, J.hipB, J.kneeB, 4.2 * s, 3.2 * s, pants, 6, true);
  prism(tris, J.kneeB, J.anB, 3.2 * s, 2.6 * s, pants, 6, true);
  prism(tris, J.hipF, J.kneeF, 4.4 * s, 3.3 * s, pants, 6, false);
  prism(tris, J.kneeF, J.anF, 3.3 * s, 2.6 * s, pants, 6, false);
  /* boots: sole + upper, toe along +x */
  [[J.anB, true], [J.anF, false]].forEach(([a, far]) => {
    const p = far ? { base: shade(shoe.base, .8), hi: shade(shoe.hi || shoe.base, .8), sh: shade(shoe.sh || shoe.base, .8) } : shoe;
    /* rounded boot plus a thin dark sole; toes point +x */
    sphere(tris, add(a, v3(1.8 * s, -1.7 * s, 0)), 3.4 * s, p, .82);
    sphere(tris, add(a, v3(2.0 * s, -3.3 * s, 0)), 3.3 * s, { base: shade(shoe.base, .42), hi: shade(shoe.base, .48), sh: shade(shoe.sh || shoe.base, .4) }, .3);
  });

  /* hips + torso */
  frustum(tris, add(J.pelvis, v3(0, -2 * s, 0)), add(J.pelvis, v3(0, 3 * s, 0)), J.hw * .52, 4.4 * s, J.hw * .5, 4.6 * s, pants);
  frustum(tris, J.pelvis, J.top, J.hw * .5, 4.4 * s, J.sw * .5, 4.8 * s, cloth);

  if (kit.id === 'ricky') {
    /* open shearling jacket: two front panels, black shirt and a BB chain */
    const mid = add(J.pelvis, rot(v3(0, (b.torso * s) * .18, 0), -P.lean));
    frustum(tris, mid, J.top, J.hw * .56, 5.0 * s, J.sw * .54, 5.2 * s, pal.coat);
    /* fleece collar ring */
    for (let i = -2; i <= 2; i++) sphere(tris, add(J.top, rot(v3(i * 4.2 * s, -1.5 * s, 2.6 * s), -P.lean)), 2.5 * s, pal.fleece);
    /* shirt + chain links on the chest front */
    const front = add(add(J.pelvis, rot(v3(0, b.torso * s * .55, 0), -P.lean)), v3(0, 0, 5.1 * s));
    frustum(tris, add(front, v3(0, -4 * s, 0)), add(front, v3(0, 5 * s, 0)), 2.4 * s, .5, 2.2 * s, .5, pal.shirt);
    for (let i = 0; i < 6; i++) sphere(tris, add(front, v3(Math.sin(i * .9) * 1.4 * s, (i - 3) * 1.7 * s, .8)), .75 * s, pal.gold);
  } else if (kit.id === 'vv') {
    /* crop top leaves the midriff bare, leather trousers below */
    const hem = add(J.pelvis, rot(v3(0, b.torso * s * .42, 0), -P.lean));
    frustum(tris, hem, J.top, J.hw * .47, 4.2 * s, J.sw * .5, 4.6 * s, pal.top);
    frustum(tris, J.pelvis, hem, J.hw * .48, 4.2 * s, J.hw * .47, 4.2 * s, kit.skin);
    frustum(tris, add(J.pelvis, v3(0, -.5 * s, 0)), add(J.pelvis, v3(0, 3.4 * s, 0)), J.hw * .5, 4.7 * s, J.hw * .5, 4.7 * s, pal.belt);
  } else if (kit.id === 'johnny') {
    /* denim jacket open over a white tee */
    frustum(tris, J.pelvis, J.top, J.hw * .53, 4.7 * s, J.sw * .53, 5.1 * s, pal.denim);
    const front = add(add(J.pelvis, rot(v3(0, b.torso * s * .52, 0), -P.lean)), v3(0, 0, 5.2 * s));
    frustum(tris, add(front, v3(0, -7 * s, 0)), add(front, v3(0, 7 * s, 0)), 3.4 * s, .5, 3.2 * s, .5, pal.tee);
    for (let i = 0; i < 7; i++) sphere(tris, add(front, v3(Math.sin(i) * 2 * s, (i - 3.5) * 1.8 * s, .9)), .75 * s, pal.gold);
    frustum(tris, add(J.pelvis, v3(0, -.5 * s, 0)), add(J.pelvis, v3(0, 2.6 * s, 0)), J.hw * .51, 4.9 * s, J.hw * .51, 4.9 * s, pal.leather || pal.denim);
  } else {
    /* enemy suits: lapels, shirt wedge, tie */
    if (pal.shirt) {
      const front = add(add(J.pelvis, rot(v3(0, b.torso * s * .6, 0), -P.lean)), v3(0, 0, 4.9 * s));
      frustum(tris, add(front, v3(0, -5 * s, 0)), add(front, v3(0, 5 * s, 0)), 2.6 * s, .4, 2.6 * s, .4, pal.shirt);
      if (pal.tie) frustum(tris, add(front, v3(0, -5 * s, 0)), add(front, v3(0, 2 * s, 0)), .9 * s, .5, .7 * s, .5, pal.tie);
    }
    if (pal.vest) {
      frustum(tris, J.pelvis, J.top, J.hw * .53, 4.8 * s, J.sw * .53, 5.0 * s, pal.vest);
    }
  }

  /* arms (far first) */
  const skin = kit.skin;
  const sleeve = pal.coat || pal.suit || pal.denim || pal.top || pal.vest || pal.shirt || skin;
  [[J.shB, J.elB, J.haB, true], [J.shF, J.elF, J.haF, false]].forEach(([sh, el, ha, far]) => {
    prism(tris, sh, el, 4.0 * s, 3.2 * s, sleeve, 6, far);
    const bare = kit.id === 'vv' || (kit.id === 'johnny' && false);
    prism(tris, el, ha, 3.0 * s, 2.6 * s, bare ? skin : sleeve, 6, far);
    sphere(tris, ha, 3.0 * s, skin);
    if (kit.id === 'ricky') sphere(tris, el, 3.2 * s, pal.fleece);
  });

  /* head, hair, face */
  prism(tris, add(J.top, v3(0, -1, 0)), add(J.head, v3(0, -J.headR * .7, 0)), 2.6 * s, 2.4 * s, skin);
  /* hair sits behind/above the face so the silhouette stays full */
  const hairC = add(J.head, v3(0, 1.2 * s, -2.6 * s));
  sphere(tris, hairC, J.headR * .98, pal.hair || pal.beard || pal.hat || skin, 1.06);
  sphere(tris, J.head, J.headR, skin, 1.0);
  if (kit.hair === 'long') {
    frustum(tris, add(J.head, v3(0, 0, -2.5 * s)), add(J.top, v3(-2 * s, -3 * s, -3.5 * s)), J.headR * .85, 3.2 * s, 4.2 * s, 2.6 * s, pal.hair);
  }
  if (kit.hair === 'beanie') {
    sphere(tris, add(J.head, v3(0, J.headR * .35, -1 * s)), J.headR * 1.08, pal.hat, .72);
  }
  /* ears */
  sphere(tris, add(J.head, v3(0, -.4 * s, -J.headR * .92)), 1.5 * s, skin);
  sphere(tris, add(J.head, v3(0, -.4 * s, J.headR * .92)), 1.5 * s, skin);
  /* nose */
  sphere(tris, add(J.head, v3(J.headR * .82, -.5 * s, J.headR * .95)), 1.4 * s, skin, 1.2);
  /* sunglasses: dark lens bar with a gold top rail */
  if (kit.face === 'mustache' || kit.face === 'beard' || kit.face === 'lips' || kit.face === 'glasses' || kit.face === 'plain' || kit.face === 'jowls' || kit.face === 'stubble') {
    const eyeY = J.head.y + J.headR * .22, fz = J.headR * 1.0;
    frustum(tris, add(v3(0, eyeY, fz), v3(-J.headR * .84, 0, 0)), add(v3(0, eyeY, fz), v3(J.headR * .84, 0, 0)), .55 * s, 1.1 * s, .55 * s, 1.1 * s, { base: 0xFF181820, hi: 0xFF2a2a34, sh: 0xFF0d0d12 });
    frustum(tris, add(v3(0, eyeY + J.headR * .30, fz), v3(-J.headR * .86, 0, 0)), add(v3(0, eyeY + J.headR * .30, fz), v3(J.headR * .86, 0, 0)), .22 * s, 1.2 * s, .22 * s, 1.2 * s, pal.gold || { base: 0xFF40b0d8, hi: 0xFFe0f0ff, sh: 0xFF207090 });
    /* bridge + temple bars read at 1x */
    frustum(tris, add(v3(0, eyeY, fz), v3(-J.headR * .16, 0, 0)), add(v3(0, eyeY, fz), v3(J.headR * .16, 0, 0)), .12 * s, 1.3 * s, .12 * s, 1.3 * s, pal.gold || { base: 0xFF40b0d8, hi: 0xFFe0f0ff, sh: 0xFF207090 });
  }
  if (kit.face === 'mustache') {
    /* a proper handlebar: two wings lifted off the lip */
    frustum(tris, add(J.head, v3(J.headR * .40, -J.headR * .24, J.headR * .98)), add(J.head, v3(J.headR * .95, -J.headR * .34, J.headR * .72)), 1.0 * s, .8 * s, .55 * s, .6 * s, pal.hair);
    frustum(tris, add(J.head, v3(J.headR * .40, -J.headR * .24, J.headR * .98)), add(J.head, v3(J.headR * .40, -J.headR * .58, J.headR * .86)), .9 * s, .8 * s, .5 * s, .6 * s, pal.hair);
  } else if (kit.face === 'beard') {
    sphere(tris, add(J.head, v3(J.headR * .22, -J.headR * .62, J.headR * .62)), J.headR * .78, pal.beard, .62);
    frustum(tris, add(J.head, v3(J.headR * .22, -J.headR * .42, J.headR * .92)), add(J.head, v3(J.headR * .58, -J.headR * .46, J.headR * .80)), .5 * s, .5 * s, .3 * s, .4 * s, pal.hair);
  } else if (kit.face === 'lips') {
    frustum(tris, add(J.head, v3(J.headR * .35, -J.headR * .38, J.headR * .98)), add(J.head, v3(J.headR * .88, -J.headR * .40, J.headR * .80)), .5 * s, .4 * s, .3 * s, .35 * s, pal.lip);
  } else if (kit.face === 'jowls') {
    sphere(tris, add(J.head, v3(J.headR * .18, -J.headR * .38, J.headR * .95)), J.headR * .62, skin, .6);
  } else if (kit.face === 'bandana') {
    frustum(tris, add(J.head, v3(0, J.headR * .30, -2.2 * s)), add(J.head, v3(0, J.headR * .30, 2.2 * s)), .9 * s, J.headR * .98, .6 * s, J.headR * .9, pal.band);
  }
}

/* ---------------- weapons ---------------- */
function buildWeapon(tris, kit, J, P) {
  const s = J.s, pal = kit.pal;
  const hand = J.haF;
  const ang = P.wpn || 0;
  const wd = dir(ang);
  if (kit.weapon === 'flag') {
    const tip = add(hand, mul(wd, 43 * s));
    prism(tris, hand, tip, 1.5 * s, 1.3 * s, pal.steel, 5);
    sphere(tris, tip, 2.3 * s, pal.gold);
    const base = add(hand, mul(wd, 28 * s));
    const perp = rot(wd, 90); /* hangs down-screen from the pole */
    const f1 = add(base, mul(perp, 2 * s)), f2 = add(base, mul(perp, 19 * s));
    const f3 = add(f2, mul(wd, 13 * s)), f4 = add(f1, mul(wd, 12 * s));
    quad(tris, f1, f2, f3, f4, pal.flag);
    /* crescent + star as raised white plates on the cloth */
    const c = add(mul(add(f1, f3), .5), mul(wd, -1.5 * s));
    const cn = norm(cross(sub(f2, f1), sub(f4, f1)));
    sphere(tris, add(c, mul(cn, .8)), 3.2 * s, pal.white);
    sphere(tris, add(add(c, mul(cn, 1.2)), add(mul(wd, 1.5 * s), mul(perp, -.4 * s))), 2.4 * s, pal.flag);
    sphere(tris, add(add(c, mul(cn, 1.5)), mul(wd, 3 * s)), 1.3 * s, pal.white);
  } else if (kit.weapon === 'mic') {
    const head = add(hand, mul(wd, 9 * s));
    prism(tris, hand, head, 2.0 * s, 1.8 * s, pal.mic, 6);
    sphere(tris, add(head, mul(wd, 3.6 * s)), 4.2 * s, pal.mic);
    /* cord: two-segment tube back to the hip */
    const hip = add(J.pelvis, v3(-2 * s, 4 * s, 3 * s));
    const mid = add(mul(add(head, hip), .5), v3(0, -6 * s, -7 * s));
    prism(tris, head, mid, .7 * s, .7 * s, pal.cord, 4);
    prism(tris, mid, hip, .7 * s, .7 * s, pal.cord, 4);
  } else if (kit.weapon === 'salami') {
    const front = add(hand, mul(wd, 38 * s));
    prism(tris, add(hand, mul(wd, -3 * s)), front, 7.2 * s, 7.0 * s, pal.salami, 8);
    sphere(tris, front, 7.0 * s, pal.salami);
    /* cut face + speckles */
    sphere(tris, add(front, mul(wd, .6 * s)), 5.6 * s, pal.speck);
    for (let i = 0; i < 7; i++) sphere(tris, add(add(hand, mul(wd, (8 + i * 4) * s)), v3((i % 3 - 1) * 3 * s, (i % 2) * 2 * s, 5.6 * s)), .8 * s, pal.speck);
  } else if (kit.weapon === 'baton') {
    const tip = add(hand, mul(wd, 16 * s));
    prism(tris, hand, tip, 1.6 * s, 1.4 * s, pal.mic || pal.steel || pal.suit || pal.band || pal.vest || pal.coat, 5);
    sphere(tris, tip, 1.9 * s, pal.gold || pal.band || pal.steel || pal.suit);
  } else if (kit.weapon === 'bottle') {
    prism(tris, hand, add(hand, mul(wd, 8 * s)), 2.2 * s, 1.4 * s, pal.glass, 5);
  } else if (kit.weapon === 'book') {
    frustum(tris, add(hand, mul(wd, 4 * s)), add(hand, mul(wd, 13 * s)), 6 * s, 1.6 * s, 6 * s, 1.6 * s, pal.book);
  } else if (kit.weapon === 'case') {
    frustum(tris, add(hand, mul(wd, 6 * s)), add(hand, mul(wd, 15 * s)), 5 * s, 7 * s, 4 * s, 6 * s, pal.case);
  }
}

/* ---------------- camera + raster ---------------- */
const YAW = 24 * DEG, COS = Math.cos(YAW), SIN = Math.sin(YAW);
const LIGHT = norm(v3(-0.45, 0.75, 0.5));
function project(p) {
  return { x: AX + (p.x * COS + p.z * SIN), y: AY - p.y, d: p.z * COS - p.x * SIN };
}
function raster(buf, tris) {
  /* +z is toward the camera, so larger depth wins */
  const zb = new Float32Array(CW * CH).fill(-1e9);
  for (const t of tris) {
    const a = project(t.a), b = project(t.b), c = project(t.c);
    const minx = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x))), maxx = Math.min(CW - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
    const miny = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y))), maxy = Math.min(CH - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
    const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if (Math.abs(area) < 1e-6) continue;
    for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
      const px = x + .5, py = y + .5;
      const w0 = ((b.x - px) * (c.y - py) - (b.y - py) * (c.x - px)) / area;
      const w1 = ((c.x - px) * (a.y - py) - (c.y - py) * (a.x - px)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const d = w0 * a.d + w1 * b.d + w2 * c.d;
      const k = y * CW + x;
      if (d <= zb[k]) continue;
      zb[k] = d; buf.d[k] = t.flat || t.col; buf.m[k] = 1;
    }
  }
}
function outline(buf) {
  const m = buf.m.slice();
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    const i = y * CW + x; if (!m[i]) continue;
    if ((x > 0 && !m[i - 1]) || (x < CW - 1 && !m[i + 1]) || (y > 0 && !m[i - CW]) || (y < CH - 1 && !m[i + CW])) buf.d[i] = OUT;
  }
}

/* ---------------- frame API ---------------- */
function render(kitId, anim, fi) {
  const kit = Art.KITS[kitId];
  const poses = kit._poses || (kit._poses = Art.posesFor(kit));
  const list = poses[anim] || poses.idle;
  const P = list[Math.min(fi, list.length - 1)];
  kit._P = P; kit._f = fi;
  const J = skeleton(kit, P);
  const tris = [];
  buildBody(tris, kit, J, P);
  buildWeapon(tris, kit, J, P);
  /* plant the lowest boot on the feet anchor: the 3D legs are solved from
     joint angles and lift a foot in some poses, but sprites are ground-locked
     (jump height lives in entity z, not in the frame). */
  if (!P.rot) {
    const foot = Math.min(J.anF.y, J.anB.y) - 4.5 * J.s;
    tris.forEach(t => { t.a = add(t.a, v3(0, -foot, 0)); t.b = add(t.b, v3(0, -foot, 0)); t.c = add(t.c, v3(0, -foot, 0)); });
  }
  /* knockdown / get-up / defeat: rotate the whole solid body about the hips,
     the same convention the 2D pose data uses, and drop it by dy */
  if (P.rot || P.dy) {
    const pv = J.pelvis;
    const tf = (v) => {
      const r = rot(sub(v, pv), P.rot || 0);
      return v3(pv.x + r.x, pv.y + r.y - (P.dy || 0), pv.z + r.z);
    };
    tris.forEach(t => { t.a = tf(t.a); t.b = tf(t.b); t.c = tf(t.c); });
  }
  const buf = { w: CW, h: CH, d: new Uint32Array(CW * CH), m: new Uint8Array(CW * CH) };
  raster(buf, tris);
  outline(buf);
  return Art.trim(buf);
}
Art.renderModelFrame = render;

Art.buildKit3D = function (id) {
  const kit = Art.KITS[id];
  const anims = kit.kind === 'hero' ? Art.ANIMS.hero : Art.ANIMS.enemy;
  const out = { id: id, name: kit.name, kind: kit.kind, anims: {} };
  anims.forEach(a => {
    const poses = (kit._poses = Art.posesFor(kit))[a] || Art.POSE.idle;
    const frames = [];
    for (let i = 0; i < poses.length; i++) frames.push(render(id, a, i));
    out.anims[a] = { timing: Art.TIMING[a].slice(0, poses.length), frames: frames };
  });
  out.portrait = Art.portrait(kit);
  return out;
};
})(globalThis.GG = globalThis.GG || {});
