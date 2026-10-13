# Cleans the supplied Johnny reference (210x273): removes the magenta backdrop and the mic on the floor, sharpens and flattens the
# colours (the source is soft), and repaints the chain medallion from "DOC" to "G&G". Output: rig_src/johnny_full.png
import sys
import numpy as np
from PIL import Image, ImageFilter, ImageDraw
from scipy import ndimage
im=Image.open(sys.argv[1]).convert('RGB'); A=np.array(im).astype(int); r,g,b=A[...,0],A[...,1],A[...,2]
bg=(r>120)&(b>85)&(g<120)&((r-g)>55)&((b-g)>35)&(abs(r-b)<95)
fr=ndimage.binary_dilation(bg,iterations=2)&(r>110)&(b>80)&((r-g)>40)&((b-g)>25); bg=bg|fr
fg=~bg; lab,n=ndimage.label(fg); sizes=ndimage.sum(fg,lab,range(1,n+1)); big=1+int(np.argmax(sizes)); keep=lab==big
keep=ndimage.binary_fill_holes(keep)
# drop the mic on the floor (bottom-right, detached from the figure by a gap) - largest component already excludes it if disconnected
sharp=im.filter(ImageFilter.UnsharpMask(radius=1.2,percent=140,threshold=2))
q=sharp.quantize(colors=44,method=Image.MEDIANCUT,dither=Image.NONE).convert('RGB'); out=np.array(q)
rgba=np.zeros(out.shape[:2]+(4,),np.uint8); rgba[...,:3]=out; rgba[...,3]=keep*255
I=Image.fromarray(rgba,'RGBA')
# chain medallion: find the light plate near (57..80, 85..97) and repaint "G&G"
reg=np.array(I)[84:99,54:82]; light=(reg[...,:3].sum(2)>520)&(reg[...,3]>0); print('plate light px',light.sum())
d=ImageDraw.Draw(I); plate=(236,232,226,255); ink=(52,46,58,255)
d.rectangle([58,86,77,96],fill=plate); d.rectangle([58,86,77,86],fill=(190,186,182,255)); d.rectangle([58,96,77,96],fill=(190,186,182,255))
G=["0111","1000","1011","1001","0110"]; AMP=["0110","1001","0110","1011","0101"]
def glyph(g,x0,y0):
    for yy,row in enumerate(g):
        for xx,c in enumerate(row):
            if c=='1': d.rectangle([x0+xx,y0+yy*1,x0+xx,y0+yy*1],fill=ink)
# 5-row glyphs, 4 wide, 1px gaps -> 14 wide, placed centred in the 20x11 plate
x0=58+3; y0=89
glyph(G,x0,y0); glyph(AMP,x0+5,y0); glyph(G,x0+10,y0)
I.save('rig_src/johnny_full.png'); print(I.size,I.getbbox())
big=Image.new('RGBA',I.size,(70,70,96,255)); big.alpha_composite(I); big=big.resize((I.width*4,I.height*4),Image.NEAREST)
from PIL import ImageDraw as D2
dd=D2.Draw(big)
for x in range(0,I.width,20): dd.line([(x*4,0),(x*4,big.height)],fill=(255,255,0)); dd.text((x*4+2,2),str(x),fill=(255,255,0))
for y in range(0,I.height,20): dd.line([(0,y*4),(big.width,y*4)],fill=(0,255,255)); dd.text((2,y*4+2),str(y),fill=(0,255,255))
big.convert('RGB').save('/home/claude/johnny_grid.png'); print(big.size)
