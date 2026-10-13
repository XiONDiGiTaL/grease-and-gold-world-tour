# Cuts the pickup art out of the user's reference sheet (uploads/food sheet), removes the purple panel background,
# and writes native-resolution cutouts to assets/food_src/*.png
import sys, os
from PIL import Image
import numpy as np
from collections import deque
SRC = sys.argv[1]; OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
im = Image.open(SRC).convert('RGB'); A = np.array(im).astype(int)
R = {  # name: (x0,y0,x1,y1) crop rectangles on the 1024x988 sheet
 'spit': (55, 70, 235, 455), 'adana': (312, 125, 585, 298), 'shish': (322, 318, 585, 485),
 'doner': (28, 548, 282, 722), 'lahmacun': (28, 792, 282, 968), 'kunefe': (330, 792, 585, 968),
 'empty': (705, 792, 990, 968), 'glow': (670, 560, 815, 680)}
def is_bg(p):
    r, g, b = p; return (b - g) > 22 and (r - g) > 8 and b > 70      # purple family
for name, (x0, y0, x1, y1) in R.items():
    c = A[y0:y1, x0:x1]; h, w, _ = c.shape; bg = np.zeros((h, w), bool); q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if is_bg(c[y, x]): bg[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if is_bg(c[y, x]) and not bg[y, x]: bg[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not bg[ny, nx] and is_bg(c[ny, nx]): bg[ny, nx] = True; q.append((ny, nx))
    # thin panel-border lines: also drop light-purple lines connected to bg (already handled by is_bg); keep the rest
    rgba = np.zeros((h, w, 4), np.uint8); rgba[..., :3] = c; rgba[..., 3] = np.where(bg, 0, 255)
    img = Image.fromarray(rgba, 'RGBA'); bb = img.getbbox(); img = img.crop(bb); img.save(os.path.join(OUT, name + '.png')); print(name, img.size)
# preview
names = list(R); ims = [Image.open(os.path.join(OUT, n + '.png')) for n in names]
W = sum(i.width for i in ims) + 12 * len(ims); H = max(i.height for i in ims) + 12
sheet = Image.new('RGBA', (W, H), (40, 40, 60, 255)); x = 6
for i in ims: sheet.alpha_composite(i, (x, 6)); x += i.width + 12
sheet.save(os.path.join(OUT, '_preview.png'))
