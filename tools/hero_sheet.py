#!/usr/bin/env python3
"""Contact sheet of hero frames from assets/gg/heroes.png: python3 tools/hero_sheet.py out.png hero anim:frame ..."""
import sys, json
from PIL import Image
out, hid = sys.argv[1], sys.argv[2]; sel = sys.argv[3:]
M = json.load(open('assets/gg/heroes.json')); A = Image.open('assets/gg/heroes.png').convert('RGBA'); K = M['kits'][hid]
tw, th, cols = 440, 520, 4; rows = (len(sel) + cols - 1) // cols
S = Image.new('RGBA', (cols * tw, rows * th), (88, 92, 118, 255))
for i, s in enumerate(sel):
    a, f = s.split(':'); fr = K['anims'][a]['frames'][int(f)]
    c = A.crop((fr['x'], fr['y'], fr['x'] + fr['w'], fr['y'] + fr['h']))
    sc = 0.95; c = c.resize((max(1, int(c.width * sc)), max(1, int(c.height * sc))), Image.LANCZOS)
    X = (i % cols) * tw + tw // 2 + int(fr['ox'] * sc); Y = (i // cols) * th + th - 40 + int(fr['oy'] * sc)
    S.alpha_composite(c, (max(0, X), max(0, Y)))
S.convert('RGB').save(out); print(out, S.size)
