#!/usr/bin/env python3
"""Cut one hero (tools/hero/<id>.json + assets/hero/src/<id>_rest.png) into rig pieces.
   Pieces: head, torso, armF, armB, legF, legB, weapon -> assets/hero/<id>/<piece>.png (+ pieces.json, debug_assign.png).
   Limbs are capsule masks around their joints; the garment hidden behind them is rebuilt by diffusion inpainting."""
import sys, json, numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
hid = sys.argv[1]; D = json.load(open(f'tools/hero/{hid}.json'))
img = Image.open(f'assets/hero/src/{D["img"]}').convert('RGBA'); A = np.array(img).astype(np.float32); H, W = A.shape[:2]
alpha = A[..., 3] > 40
# keep only this hero: watershed between seeds of this hero and its neighbours (the source crop contains neighbours)
if D.get('own') and D.get('others'):
    from skimage.segmentation import watershed
    dist = ndi.distance_transform_edt(alpha); mk = np.zeros(alpha.shape, np.int32)
    for x, y in D['own']: mk[max(0, y - 3):y + 4, max(0, x - 3):x + 4] = 1
    for x, y in D['others']: mk[max(0, y - 3):y + 4, max(0, x - 3):x + 4] = 2
    lab = watershed(-dist, mk, mask=alpha, connectivity=2); alpha = lab == 1
    A[..., 3] = np.where(alpha, A[..., 3], 0)
for ez in D.get('erase', []):    # warm-coloured thin things (rope/string) removed outright
    m_ = Image.new('L', (W, H), 0); ImageDraw.Draw(m_).polygon([tuple(p) for p in ez], fill=255)
    alpha &= ~((np.array(m_) > 0) & (A[..., 0] > A[..., 2] + 14) & (A[..., 0] > A[..., 1] - 8))
A[..., 3] = np.where(alpha, A[..., 3], 0)
# optional hand-drawn exclusions (neighbour bits that touch the hero) + drop tiny stray specks
for pl in D.get('exclude', []):
    m_ = Image.new('L', (W, H), 0); ImageDraw.Draw(m_).polygon([tuple(p) for p in pl], fill=255); alpha &= ~(np.array(m_) > 0)
lab_s, n_s = ndi.label(alpha, structure=np.ones((3, 3)))
if n_s:
    sizes = ndi.sum(alpha, lab_s, range(1, n_s + 1)); keep = np.zeros(n_s + 1, bool); keep[1:] = sizes >= 400; alpha &= keep[lab_s]
A[..., 3] = np.where(alpha, A[..., 3], 0)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32); J = D['J']

def seg_norm(p, a, b, ra, rb):
    """normalised distance (d/r) from every pixel to a tapered capsule a->b"""
    a = np.array(a, np.float32); b = np.array(b, np.float32); ab = b - a; L2 = float((ab ** 2).sum()) or 1.0
    t = np.clip(((xx - a[0]) * ab[0] + (yy - a[1]) * ab[1]) / L2, 0, 1)
    px = a[0] + ab[0] * t; py = a[1] + ab[1] * t; d = np.hypot(xx - px, yy - py); r = ra + (rb - ra) * t
    return d / np.maximum(r, 1)
def limb_mask(chain, R):
    pts = [J[k] for k in chain]; n = np.full((H, W), 9.0, np.float32)
    for i in range(len(pts) - 1): n = np.minimum(n, seg_norm(None, pts[i], pts[i + 1], R[i], R[i + 1]))
    r = R[-1] + 3; n = np.minimum(n, np.hypot(xx - pts[-1][0], yy - pts[-1][1]) / r)   # round end cap (hand / ankle)
    return n <= 1.0
def poly_mask(pts):
    m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon([tuple(p) for p in pts], fill=255); return np.array(m) > 0

claims = {}
claims['armF'] = limb_mask(['shF', 'elF', 'haF'], D['R']['armF']); claims['armB'] = limb_mask(['shB', 'elB', 'haB'], D['R']['armB'])
claims['legF'] = limb_mask(['hipF', 'knF', 'anF'], D['R']['legF']); claims['legB'] = limb_mask(['hipB', 'knB', 'anB'], D['R']['legB'])
for s in ('F', 'B'):
    if D.get('boots', {}).get(s): claims['leg' + s] |= poly_mask(D['boots'][s])
for k, v in (D.get('extra') or {}).items(): claims[k] = claims.get(k, np.zeros((H, W), bool)) | poly_mask(v)
e = D['head']
if 'poly' in e: hm = poly_mask(e['poly'])
else: ex, ey, rx, ry = e['ellipse']; hm = ((xx - ex) / rx) ** 2 + ((yy - ey) / ry) ** 2 <= 1
if e.get('clipBelowY'): hm &= yy < e['clipBelowY']
for pl in e.get('extra', []): hm |= poly_mask(pl)
claims['head'] = hm
wm = np.zeros((H, W), bool); WD = D['weapon']
for a_, b_, ra, rb in WD.get('capsules', []): wm |= seg_norm(None, a_, b_, ra, rb) <= 1
for cx, cy, rx, ry in WD.get('ellipses', []): wm |= ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1
for pl in WD.get('polys', []): wm |= poly_mask(pl)
if WD.get('color') == 'redflag':
    red = (A[..., 0] > 140) & (A[..., 1] < 80) & (A[..., 2] < 80) & alpha & (yy < WD.get('flagMaxY', 380))
    red = ndi.binary_closing(red, iterations=3); red = ndi.binary_fill_holes(red)
    lab_, n_ = ndi.label(red); sx, sy = WD.get('flagSeed', [150, 200]); red = lab_ == lab_[sy, sx]
    wm |= ndi.binary_dilation(red, iterations=3) & alpha
if WD.get('color') == 'salami':
    r_, g_, b_ = A[..., 0], A[..., 1], A[..., 2]
    sal = (r_ > g_ + 25) & (r_ > b_ + 15) & (r_ < 215) & alpha
    sal = ndi.binary_closing(sal, iterations=5); sal = ndi.binary_fill_holes(sal); wm |= ndi.binary_dilation(sal, iterations=2) & alpha
for cp in WD.get('warmPolys', []):   # warm (rope/string) pixels inside a box; blue jeans etc. stay with their limb
    wm |= poly_mask(cp) & alpha & (A[..., 0] > A[..., 2] + 22) & (A[..., 0] > A[..., 1] - 5)
for pl in WD.get('exclude', []): wm &= ~poly_mask(pl)
claims['weapon'] = wm
assign = np.full((H, W), -1, np.int8); names = D['order']
for i, nm in enumerate(names):
    if nm == 'torso': continue
    m = claims[nm] & alpha & (assign < 0); assign[m] = i
ti = names.index('torso'); sup = poly_mask(D['torsoSupport'])
# leftovers outside the body support go to the nearest limb (capsule radii are only approximate)
lmb = {'armF': ['shF', 'elF', 'haF'], 'armB': ['shB', 'elB', 'haB'], 'legF': ['hipF', 'knF', 'anF'], 'legB': ['hipB', 'knB', 'anB']}
best = np.full((H, W), 99.0, np.float32); bi = np.full((H, W), -1, np.int8)
for nm, ch in lmb.items():
    if nm not in names: continue
    pts = [J[k] for k in ch]; n = np.full((H, W), 99.0, np.float32)
    for i in range(len(pts) - 1): n = np.minimum(n, seg_norm(None, pts[i], pts[i + 1], D['R'][nm][i], D['R'][nm][i + 1]))
    upd = n < best; best = np.where(upd, n, best); bi = np.where(upd, names.index(nm), bi)
left = alpha & (assign < 0) & ~sup & (best < D.get('leftoverReach', 2.4)); assign[left] = bi[left]
assign[alpha & (assign < 0)] = ti

# --- rebuild the garment hidden behind limbs/head/weapon (diffusion inpainting, multi-scale) ---
tor = assign == ti; rgb = A[..., :3].copy(); lum = rgb.sum(2)
src = tor & (lum > 150)
if D.get('fillFilter') == 'denim': src &= (rgb[..., 2] > rgb[..., 0] + 6)
hole = sup & ~tor
kn = src.astype(np.float32); unknown = hole.copy(); out = rgb.copy()
for sg in (1.5, 2.5, 4, 7, 12, 20, 32, 50):
    num = np.stack([ndi.gaussian_filter(out[..., c] * kn, sg) for c in range(3)], -1); den = ndi.gaussian_filter(kn, sg)
    take = unknown & (den > 0.05); est = num / np.maximum(den[..., None], 1e-6)
    out[take] = est[take]; kn[take] = 1.0; unknown &= ~take
filled = hole & (kn > 0)
# fill only up to a margin inside the silhouette the limb pixels cover (keep it tight to what is hidden)
tor_rgba = np.zeros((H, W, 4), np.float32); tor_rgba[..., :3] = rgb; tor_rgba[..., 3] = np.where(tor, A[..., 3], 0)
tor_rgba[filled, :3] = out[filled]; tor_rgba[filled, 3] = 255

def save(nm, rgba, mask=None):
    a = rgba.copy()
    if mask is not None: a[..., 3] = np.where(mask, a[..., 3], 0)
    ys, xs = np.where(a[..., 3] > 0)
    if not len(ys): return None
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    Image.fromarray(a[y0:y1, x0:x1].astype(np.uint8), 'RGBA').save(f'assets/hero/{hid}/{nm}.png'); return [int(x0), int(y0), int(x1 - x0), int(y1 - y0)]
import os; os.makedirs(f'assets/hero/{hid}', exist_ok=True)
for f_ in os.listdir(f'assets/hero/{hid}'):
    if f_.endswith('.png'): os.remove(f'assets/hero/{hid}/{f_}')
meta = {}
# weapon: rebuild the shaft where hands/arms cover it (diffusion fill inside the weapon capsules)
wi = names.index('weapon'); wrgba = A.copy(); wmask = assign == wi
caps = np.zeros((H, W), bool)
for a_, b_, ra, rb in D['weapon'].get('capsules', []): caps |= seg_norm(None, a_, b_, ra, rb) <= 1
whole = caps & ~wmask & (assign >= 0) & (assign != ti)
if whole.any():
    kn_ = wmask.astype(np.float32); o_ = A[..., :3].copy(); unk = whole.copy()
    for sg in (1.2, 2, 3.5, 6, 10):
        num = np.stack([ndi.gaussian_filter(o_[..., c] * kn_, sg) for c in range(3)], -1); den = ndi.gaussian_filter(kn_, sg)
        take = unk & (den > 0.04); est = num / np.maximum(den[..., None], 1e-6); o_[take] = est[take]; kn_[take] = 1; unk &= ~take
    fillw = whole & (kn_ > 0); wrgba[fillw, :3] = o_[fillw]; wrgba[fillw, 3] = 255; wmask = wmask | fillw
LIMBS = {'armF': ['shF', 'elF', 'haF'], 'armB': ['shB', 'elB', 'haB'], 'legF': ['hipF', 'knF', 'anF'], 'legB': ['hipB', 'knB', 'anB']}
for i, nm in enumerate(names):
    if nm == 'torso': meta[nm] = save(nm, tor_rgba)
    elif nm == 'weapon': meta[nm] = save(nm, wrgba, wmask)
    elif nm in LIMBS:
        ch = [J[k] for k in LIMBS[nm]]; R_ = D['R'][nm]; own = assign == i
        norms = []
        for sidx in range(2):
            n = seg_norm(None, ch[sidx], ch[sidx + 1], R_[sidx], R_[sidx + 1])
            if sidx == 0: n = np.minimum(n, np.hypot(xx - ch[0][0], yy - ch[0][1]) / (R_[0] + 2))
            else: n = np.minimum(n, np.hypot(xx - ch[2][0], yy - ch[2][1]) / (R_[2] + 3))
            norms.append(n)
        seg_id = np.argmin(np.stack(norms), 0)
        for sidx, tag in ((0, 'u'), (1, 'l')):
            m = own & ((seg_id == sidx) | (norms[sidx] <= 1.0))     # own region + overlap into the neighbour (round joint)
            if sidx == 1 and nm.startswith('leg'): m = m | (own & claims[nm] & (yy > ch[1][1]) & (seg_id == 1))
            meta[nm + '_' + tag] = save(nm + '_' + tag, A, m)
    else: meta[nm] = save(nm, A, assign == i)
json.dump(meta, open(f'assets/hero/{hid}/pieces.json', 'w'))
# debug: coloured assignment
pal = [(230, 60, 60), (60, 160, 230), (240, 200, 40), (160, 90, 220), (60, 200, 110), (240, 120, 40), (200, 200, 200)]
dbg = np.zeros((H, W, 3), np.uint8) + 235
for i in range(len(names)): dbg[assign == i] = pal[i % len(pal)]
dbg[filled & ~tor] = (255, 0, 255)
Image.fromarray(dbg).save(f'/home/claude/hero/{hid}_assign.png')
print(hid, {k: v for k, v in meta.items()}, 'filled px', int(filled.sum()))
