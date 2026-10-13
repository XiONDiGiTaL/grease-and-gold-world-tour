# Downscales the cutouts in assets/food_src to game size (crisp, limited palette, 1px outline) and writes
# assets/food/*.png and src/foodart.js (palette-indexed, decoded synchronously by sprites.js).
import os, json, base64
from PIL import Image
import numpy as np
SRC='assets/food_src'; OUT='assets/food'; os.makedirs(OUT, exist_ok=True)
TARGET={'adana':(54,None),'shish':(54,None),'doner':(54,None),'lahmacun':(54,None),'kunefe':(52,None),'spit':(None,64),'empty':(60,None),'glow':(30,None)}
OUTLINE=(27,18,38)
art={}
for name,(tw,th) in TARGET.items():
    im=Image.open(f'{SRC}/{name}.png').convert('RGBA'); w,h=im.size
    if tw: sz=(tw, max(1,round(h*tw/w)))
    else: sz=(max(1,round(w*th/h)), th)
    # premultiplied resize so edges don't pick up purple
    a=np.array(im).astype(float); al=a[...,3:4]/255.0; pm=np.concatenate([a[...,:3]*al, a[...,3:4]],axis=2)
    pmi=Image.fromarray(pm.astype(np.uint8),'RGBA').resize(sz, Image.LANCZOS)
    p=np.array(pmi).astype(float); alpha=p[...,3:4]/255.0
    rgb=np.where(alpha>0.01, p[...,:3]/np.maximum(alpha,0.01), 0); mask=(p[...,3]>=140)
    rgb=np.clip(rgb,0,255).astype(np.uint8)
    # pad 2px, quantize colours (limited 16-bit palette), outline
    H,W=mask.shape; pad=2; M=np.zeros((H+pad*2,W+pad*2),bool); C=np.zeros((H+pad*2,W+pad*2,3),np.uint8); M[pad:-pad,pad:-pad]=mask; C[pad:-pad,pad:-pad]=rgb
    q=Image.fromarray(C,'RGB').quantize(colors=28,method=Image.MEDIANCUT,dither=Image.NONE).convert('RGB'); C=np.array(q)
    out=np.zeros(M.shape+(4,),np.uint8); out[M,:3]=C[M]; out[M,3]=255
    o=np.zeros_like(M)
    for dy,dx in ((1,0),(-1,0),(0,1),(0,-1)): o|=np.roll(np.roll(M,dy,0),dx,1)
    ol=o&~M; out[ol,:3]=OUTLINE; out[ol,3]=255
    img=Image.fromarray(out,'RGBA'); bb=img.getbbox(); img=img.crop(bb); pd=Image.new('RGBA',(img.width+2,img.height+2),(0,0,0,0)); pd.paste(img,(1,1)); img=pd; img.save(f'{OUT}/{name}.png')
    arr=np.array(img); h,w=arr.shape[:2]; pal=[]; idx=np.zeros((h,w),np.uint8)
    for y in range(h):
        for x in range(w):
            if arr[y,x,3]:
                c='%02x%02x%02x'%tuple(arr[y,x,:3])
                if c not in pal: pal.append(c)
                idx[y,x]=pal.index(c)+1
    art[name]={'w':w,'h':h,'pal':pal,'data':base64.b64encode(idx.tobytes()).decode()}
    print(name,img.size,len(pal),'colours')
open('src/foodart.js','w').write('/* Pickup art cut from the supplied reference sheet (tools/extract_food.py + make_food_assets.py). */\n(function(G){G.FOODART='+json.dumps(art,separators=(',',':'))+';})(globalThis.GG=globalThis.GG||{});\n')
# preview @4x
names=list(TARGET); ims=[Image.open(f'{OUT}/{n}.png') for n in names]
W=sum(i.width for i in ims)+10*len(ims); H=max(i.height for i in ims)+8
s=Image.new('RGBA',(W,H),(110,50,130,255)); x=4
for i in ims: s.alpha_composite(i,(x,H-i.height-4)); x+=i.width+10
s=s.resize((s.width*4,s.height*4),Image.NEAREST); s.save('/home/claude/food_game.png'); print(s.size)
