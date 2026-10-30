#!/usr/bin/env python3
"""Hero compositor. Animates the pieces cut by tools/hero_cut.py with the ENGINE's own pose tables
(build/hero_poses.json from tools/hero_poses.js), using each character's real bone lengths from the art.
Rigid parts (head, torso, weapon) get one transform; limbs are skinned (continuous bend, feathered blend at the
elbow / knee) so nothing hinges like a paper doll.  Output: assets/gg/heroes.png + heroes.json (3x resolution atlas).
    python3 tools/hero_render.py [hero ...]  [--sheet]"""
import sys, json, math, os
import numpy as np, cv2
from PIL import Image

RES, SUP = 3, 2                 # atlas px per logical unit, supersample factor
CW = CH = 600; AX, AY = 300, 470  # cell (atlas px) and the feet anchor inside it
POSES = json.load(open('build/hero_poses.json'))
rad = math.radians

class Hero:
    def __init__(s, hid):
        s.id = hid; D = s.D = json.load(open(f'tools/hero/{hid}.json')); s.J = D['J']
        meta = json.load(open(f'assets/hero/{hid}/pieces.json'))
        Hart = s.J['soleY'] - D['headTop']; s.k = D['height'] * RES / Hart; s.S = s.k * SUP
        s.P = {}
        for nm, bb in meta.items():
            if not bb: continue
            im = np.array(Image.open(f'assets/hero/{hid}/{nm}.png').convert('RGBA')).astype(np.float32) / 255
            im[..., :3] *= im[..., 3:4]
            h, w = im.shape[:2]
            im = cv2.resize(im, (max(1, round(w * s.S)), max(1, round(h * s.S))), interpolation=cv2.INTER_AREA)
            s.P[nm] = (im, (bb[0] * s.S, bb[1] * s.S))
        if D.get('armFClone'):
            for t in ('u', 'l'): s.P['armF_' + t] = s.P['armB_' + t]
        s.rest = {  # rest chains (art coords)
            'armF': ['shB', 'elB', 'haB'] if D.get('armFClone') else ['shF', 'elF', 'haF'],
            'armB': ['shB', 'elB', 'haB'], 'legF': ['hipF', 'knF', 'anF'], 'legB': ['hipB', 'knB', 'anB']}
        W = D['weapon']; g = np.array(W.get('grip', s.J['haF']), float); t = np.array(W['tip'], float)
        s.wgrip = g; s.wrest = math.atan2(t[1] - g[1], t[0] - g[0])

def dist(a, b): return math.hypot(a[0] - b[0], a[1] - b[1])

def joints(h, P):
    """posed joint positions in supersampled canvas px"""
    J, k, u = h.J, h.S, RES * SUP
    gx, gy = AX * SUP, AY * SUP
    hipH = (J['soleY'] - J['hip'][1]) * k
    hip = np.array([gx + P['dx'] * u, gy - hipH + P['dy'] * u])
    th = rad(P['lean']); c, s = math.cos(th), math.sin(th)
    def att(pt):
        v = ((pt[0] - J['hip'][0]) * k, (pt[1] - J['hip'][1]) * k)
        return hip + np.array([c * v[0] - s * v[1], s * v[0] + c * v[1]])
    out = {'hip': hip, 'neck': att(J['neck']), 'lean': th}
    def chain(name, root, a1, a2):
        ks = h.rest[name]; l1 = dist(J[ks[0]], J[ks[1]]) * k; l2 = dist(J[ks[1]], J[ks[2]]) * k
        r0 = att(J[root]); el = r0 + np.array([math.sin(rad(a1)) * l1, math.cos(rad(a1)) * l1])
        ha = el + np.array([math.sin(rad(a2)) * l2, math.cos(rad(a2)) * l2]); out[name] = [r0, el, ha]
    chain('armF', 'shF', P['sf'], P['ef']); chain('armB', 'shB', P['sb'], P['eb'])
    chain('legF', 'hipF', P['hf'], P['kf']); chain('legB', 'hipB', P['hb'], P['kb'])
    # weapon: grip on the front hand, rotated from its art rest direction to the pose angle
    out['wrot'] = rad(P['wpn']) - h.wrest; out['grip'] = out['armF'][2]
    if h.D.get('twoHand'):  # back hand rides the weapon exactly as in the art, then 2-bone IK for the arm
        d = (np.array(J['haB'], float) - np.array(J['haF'], float)) * k; cr, sr = math.cos(out['wrot']), math.sin(out['wrot'])
        T = out['grip'] + np.array([cr * d[0] - sr * d[1], sr * d[0] + cr * d[1]])
        out['armB'] = ik(out['armB'][0], T, h, 'armB')
    return out

def ik(root, T, h, name):
    J, k = h.J, h.S; ks = h.rest[name]
    l1 = dist(J[ks[0]], J[ks[1]]) * k; l2 = dist(J[ks[1]], J[ks[2]]) * k
    v = T - root; d = float(np.hypot(*v)) or 1.0; d = min(max(d, abs(l1 - l2) + .5), l1 + l2 - .5)
    base = math.atan2(v[1], v[0]); a = math.acos(max(-1, min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))))
    r1 = np.array(J[ks[1]], float) - np.array(J[ks[0]], float); r2 = np.array(J[ks[2]], float) - np.array(J[ks[1]], float)
    rest_sign = np.sign(r1[0] * r2[1] - r1[1] * r2[0]) or 1
    best = None
    for sg in (1, -1):
        el = root + l1 * np.array([math.cos(base + sg * a), math.sin(base + sg * a)])
        e2 = root + (T - root) / (np.hypot(*(T - root)) or 1) * d - el
        e1 = el - root; sgn = np.sign(e1[0] * e2[1] - e1[1] * e2[0]) or 1
        if sgn == rest_sign: best = el
    if best is None: best = root + l1 * np.array([math.cos(base + a), math.sin(base + a)])
    ha = best + (T - best) / (np.hypot(*(T - best)) or 1) * l2
    return [root, best, ha]

def over(dst, src): dst[...] = src + dst * (1 - src[..., 3:4])

def rigid(h, nm, pivot_art, pivot_px, theta):
    im, org = h.P[nm]; c, s = math.cos(theta), math.sin(theta); R = np.array([[c, -s], [s, c]])
    t = np.array(pivot_px) + R @ (np.array(org) - np.array(pivot_art) * h.S)
    M = np.array([[c, -s, t[0]], [s, c, t[1]]], np.float32)
    return cv2.warpAffine(im, M, (CW * SUP, CH * SUP), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)

def smooth(x): x = np.clip(x, 0, 1); return x * x * (3 - 2 * x)

def limb(h, nm, posed, canvas):
    """two rigid segment pieces with overlapping round joints (each only ever samples its own pixels)"""
    ks = h.rest[nm]; k = h.S
    for sidx, tag in ((0, 'u'), (1, 'l')):
        key = nm + '_' + tag
        if key not in h.P: continue
        a0 = np.array(h.J[ks[sidx]], float); a1 = np.array(h.J[ks[sidx + 1]], float)
        p0 = np.array(posed[sidx], float); p1 = np.array(posed[sidx + 1], float)
        th = math.atan2(p1[1] - p0[1], p1[0] - p0[0]) - math.atan2(a1[1] - a0[1], a1[0] - a0[0])
        over(canvas, rigid(h, key, a0, p0, th))

BASE = dict(lean=1, hf=13, kf=7, hb=-13, kb=-5, sf=-9, ef=-7, sb=9, eb=7, wpn=-78)
CARRY = ('idle', 'walk', 'turn', 'land', 'tired', 'win')   # poses that start from the art's own stance
def seg_angle(a, b): return math.degrees(math.atan2(b[0] - a[0], b[1] - a[1]))   # engine convention: 0 = down, + = forward
def carry(h, P, anim):
    if anim not in CARRY: return P
    J = h.J; P = dict(P)
    rest = dict(sf=seg_angle(J['shF'], J['elF']), ef=seg_angle(J['elF'], J['haF']), sb=seg_angle(J['shB'], J['elB']), eb=seg_angle(J['elB'], J['haB']),
                hf=seg_angle(J['hipF'], J['knF']), kf=seg_angle(J['knF'], J['anF']), hb=seg_angle(J['hipB'], J['knB']), kb=seg_angle(J['knB'], J['anB']),
                wpn=math.degrees(h.wrest))
    for k, v in rest.items(): P[k] = v + (P[k] - BASE[k])
    return P

def compose(h, P, anim='idle'):
    P = carry(h, P, anim)
    jt = joints(h, P); cv = np.zeros((CH * SUP, CW * SUP, 4), np.float32); D = h.D
    th = jt['lean']; behind = bool(P.get('wbehind')) or P['wpn'] < -115
    def weapon(): over(cv, rigid(h, 'weapon', h.wgrip, jt['grip'], jt['wrot']))
    if behind: weapon()
    for nm in D['layers']:
        if nm == 'weapon':
            if not behind: weapon()
        elif nm == 'torso': over(cv, rigid(h, 'torso', h.J['hip'], jt['hip'], th))
        elif nm == 'head': over(cv, rigid(h, 'head', h.J['neck'], jt['neck'], th + rad(P['head'])))
        else: limb(h, nm, jt[nm], cv)
    if P.get('rot'):   # knockdown: whole body rotates about the hip
        a = rad(P['rot']); c, s = math.cos(a), math.sin(a); hp = jt['hip']
        M = np.array([[c, -s, hp[0] - c * hp[0] + s * hp[1]], [s, c, hp[1] - s * hp[0] - c * hp[1]]], np.float32)
        cv = cv2.warpAffine(cv, M, (CW * SUP, CH * SUP), flags=cv2.INTER_LINEAR)
    cv = cv2.resize(cv, (CW, CH), interpolation=cv2.INTER_AREA)
    a = cv[..., 3:4]; rgb = np.where(a > 1e-4, cv[..., :3] / np.maximum(a, 1e-4), 0)
    out = np.concatenate([np.clip(rgb, 0, 1), np.clip(a, 0, 1)], -1)
    return (out * 255 + .5).astype(np.uint8)

def trim(img):
    ys, xs = np.where(img[..., 3] > 3)
    if not len(ys): return img[:1, :1], 0, 0
    x0, x1, y0, y1 = max(0, xs.min() - 1), xs.max() + 2, max(0, ys.min() - 1), ys.max() + 2
    return img[y0:y1, x0:x1], int(x0 - AX), int(y0 - AY)

def portrait(h):
    """head + shoulders crop from the art (square), at atlas scale"""
    D = h.D; img = Image.open(f'assets/hero/src/{D["img"]}').convert('RGBA'); J = h.J
    cx, cy, half = D['portrait']; box = (cx - half, cy - half, cx + half, cy + half)
    c = img.crop(box); size = 168
    return np.array(c.resize((size, size), Image.LANCZOS))

def pack(items, width=2048):
    x = y = rowh = 2; placed = []
    for key, im, ox, oy in items:
        h_, w_ = im.shape[:2]
        if x + w_ + 2 > width: x = 2; y += rowh + 2; rowh = 0
        placed.append((key, x, y, w_, h_, ox, oy)); x += w_ + 2; rowh = max(rowh, h_)
    H = 1
    while H < y + rowh + 2: H *= 2
    atlas = np.zeros((H, width, 4), np.uint8); by = {k: im for k, im, _, _ in items}
    for key, px, py, w_, h_, ox, oy in placed: atlas[py:py + h_, px:px + w_] = by[key]
    return atlas, {k: dict(x=px, y=py, w=w_, h=h_, ox=ox, oy=oy) for k, px, py, w_, h_, ox, oy in placed}

if __name__ == '__main__':
    ids = [a for a in sys.argv[1:] if not a.startswith('--')] or ['ricky', 'vv', 'johnny']
    names = {'ricky': 'Ricky B', 'vv': 'V.V.', 'johnny': 'Johnny $'}
    items, kits = [], {}
    for hid in ids:
        h = Hero(hid); entry = {'id': hid, 'name': names[hid], 'kind': 'hero', 'res': RES, 'smooth': True, 'anims': {}}
        for a in POSES['anims']:
            fr = []
            for i, P in enumerate(POSES['kits'][hid]['poses'][a]):
                im, ox, oy = trim(compose(h, P, a)); key = f'{hid}:{a}:{i}'; items.append((key, im, ox, oy)); fr.append(key)
            entry['anims'][a] = {'timing': POSES['timing'][a][:len(fr)], 'frames': fr}
        pk = f'{hid}:portrait'; items.append((pk, portrait(h), 0, 0)); entry['portrait'] = pk; kits[hid] = entry
        print('rendered', hid, flush=True)
    atlas, byk = pack(items)
    for e in kits.values():
        for a in e['anims'].values(): a['frames'] = [byk[k] for k in a['frames']]
        e['portrait'] = byk[e['portrait']]
    os.makedirs('assets/gg', exist_ok=True)
    Image.fromarray(atlas, 'RGBA').save('assets/gg/heroes.png', optimize=True)
    json.dump({'version': 3, 'res': RES, 'kits': kits}, open('assets/gg/heroes.json', 'w'))
    print('heroes.png', atlas.shape[1], 'x', atlas.shape[0], os.path.getsize('assets/gg/heroes.png') // 1024, 'KB')
