# Cuts the supplied enemy sheet (4 parody enemies) into game frames: component/box segmentation, per-frame scale
# normalisation, feet-on-ground alignment, upper-body hit reactions composited onto the idle legs, shared palette,
# boss/variant recolours -> src/enemyart.js
import json, base64, colorsys, sys
import numpy as np
from PIL import Image
from scipy import ndimage
SRC=sys.argv[1]; keep=np.load('enemy_src/keep.npy')
im=np.array(Image.open(SRC).convert('RGB')).astype(int); H,W=keep.shape
lab,n=ndimage.label(keep,structure=np.ones((3,3))); objs=ndimage.find_objects(lab)
cent={i:(ndimage.center_of_mass(keep,lab,i)) for i in range(1,n+1)}
BG=np.array([151,152,151])
CFG={
 'juice':dict(idle=(44,38,124,245),walk=[(149,70,196,245),(206,70,246,245)],atk=[(257,74,391,243)],hit=[(423,62,508,246)],full=True,lie=[(526,172,660,245)],air=(524,91,663,152),k={'walk':1.18}),
 'hobo':dict(idle=(42,316,112,498),walk=[(149,330,200,498),(206,332,252,499),(251,338,327,498)],atk=[(329,313,415,498,'cut'),(416,313,496,498,'cut')],hit=[(518,314,587,406),(588,313,664,406)],full=False,lie=[(513,433,667,499)],k={'walk':1.08}),
 'poop':dict(idle=(38,558,117,753),walk=[(142,577,213,753)],atk=[(219,579,329,753),(301,582,436,753)],hit=[(516,566,577,659),(585,567,656,659)],full=False,lie=[(507,694,668,753)],k={'walk':1.1,'atk':1.1,'hit':1.1}),
 'biz':dict(idle=(28,830,127,1008),walk=[(144,831,235,1008)],atk=[(265,834,399,1007),(396,833,489,1008)],hit=[(512,831,583,905),(591,831,663,905)],full=False,lie=[(516,916,659,1008)],k={})}
def grab(box,clean=False):
    x0,y0,x1,y1=box[:4]; cut=len(box)>4
    m=np.zeros((H,W),bool)
    if cut: m[y0:y1+1,x0:x1+1]=keep[y0:y1+1,x0:x1+1]
    else:
        for i,sl in enumerate(objs,1):
            cy,cx=cent[i]
            if x0<=cx<=x1 and y0<=cy<=y1 and (lab[sl]==i).sum()>25: m|=(lab==i)
    ys,xs=np.where(m); bx0,bx1,by0,by1=xs.min(),xs.max()+1,ys.min(),ys.max()+1
    mm=ndimage.binary_fill_holes(m[by0:by1,bx0:bx1]); col=im[by0:by1,bx0:bx1]
    if clean:   # drop 1px panel-border lines from cropped reaction portraits, keep the largest body
        mm=ndimage.binary_opening(mm,structure=np.ones((3,3)))
        l2,n2=ndimage.label(mm,structure=np.ones((3,3)))
        if n2>1: sizes=ndimage.sum(mm,l2,range(1,n2+1)); mm=l2==(1+int(np.argmax(sizes)))
    d=np.abs(col-BG).sum(2); fr=mm&~ndimage.binary_erosion(mm); mm=mm&~(fr&(d<70))   # drop grey anti-alias fringe
    rgba=np.zeros(mm.shape+(4,),np.uint8); rgba[...,:3]=col; rgba[...,3]=mm*255; return rgba
def scale(rgba,s):
    h,w=rgba.shape[:2]; a=rgba.astype(float); al=a[...,3:4]/255; pm=np.concatenate([a[...,:3]*al,a[...,3:4]],2)
    sz=(max(1,round(w*s)),max(1,round(h*s))); r=np.array(Image.fromarray(pm.astype(np.uint8),'RGBA').resize(sz,Image.LANCZOS)).astype(float)
    alpha=r[...,3]; rgb=np.where(alpha[...,None]>8,r[...,:3]/np.maximum(alpha[...,None]/255,1e-3),0); out=np.zeros(r.shape,np.uint8); out[...,:3]=np.clip(rgb,0,255); out[...,3]=np.where(alpha>=128,255,0); return out
def top_row(a): return int(np.where(a[...,3].any(1))[0][0])
def head_cx(a):
    t=top_row(a); hh=max(4,int(a.shape[0]*.22)); sub=a[t:t+hh,:,3]>0; xs=np.where(sub.any(0))[0]; return xs.mean()
def composite_hit(idle,hit):
    ti,th=top_row(idle),top_row(hit); hb=int(np.where(hit[...,3].any(1))[0][-1])+1
    dx=int(round(head_cx(idle)-head_cx(hit))); Wc=max(idle.shape[1],hit.shape[1]+abs(dx))+4; out=np.zeros((idle.shape[0],Wc,4),np.uint8); out[:,:idle.shape[1]]=idle
    cut=ti+(hb-th); out[ti:cut,:,3]=0
    for y in range(th,hb):
        for x in range(hit.shape[1]):
            if hit[y,x,3]:
                X=x+dx; Y=ti+(y-th)
                if 0<=X<Wc and 0<=Y<out.shape[0]: out[Y,X]=hit[y,x]
    return out
def trim(a):
    ys,xs=np.where(a[...,3]>0); return a[ys.min():ys.max()+1,xs.min():xs.max()+1]
def anchor_x(a,standing=True):
    h=a.shape[0]
    if standing:
        sub=a[int(h*.55):int(h*.95),:,3]>0
    else: sub=a[:,:,3]>0
    xs=np.where(sub.any(0))[0]; return float((xs.min()+xs.max())/2) if len(xs) else a.shape[1]/2
def build(name,cfg,target):
    idle_n=grab(cfg['idle']); s0=target/idle_n.shape[0]; frames={}
    k=cfg['k']
    def S(rgba,kind): return trim(scale(rgba,s0*k.get(kind,1.0)))
    frames['idle']=(S(idle_n,'idle'),True)
    for i,b in enumerate(cfg['walk']): frames[f'walk{i}']=(S(grab(b),'walk'),True)
    for i,b in enumerate(cfg['atk']): frames[f'atk{i}']=(S(grab(b),'atk'),True)
    if cfg['full']:
        for i,b in enumerate(cfg['hit']): frames[f'hit{i}']=(S(grab(b),'hit'),True)
    else:   # the sheet only has upper-body portraits for these reactions: recoil the full-body sprite instead (no seams)
        idle=frames['idle'][0]
        for i,ang in enumerate((10,5)):
            img=Image.fromarray(idle,'RGBA').rotate(ang,resample=Image.NEAREST,expand=True,center=(idle.shape[1]/2,idle.shape[0]))
            frames[f'hit{i}']=(trim(np.array(img)),True)
    for i,b in enumerate(cfg['lie']): frames[f'lie{i}']=(S(grab(b),'lie'),False)
    if 'air' in cfg: frames['air']=(S(grab(cfg['air']),'lie'),False)
    return frames
def rgb2hsv(c): return colorsys.rgb_to_hsv(*[v/255 for v in c])
def hsv2rgb(h,s,v): return tuple(int(round(x*255)) for x in colorsys.hsv_to_rgb(h%1.0,min(1,max(0,s)),min(1,max(0,v))))
def recolor(c,rule):
    h,s,v=rgb2hsv(c)
    if rule is None: return c
    suit=(v<.3 and s<.55); tie=((h>.94 or h<.04) and s>.55 and v>.35)
    if rule=='orange':  # orange-juice box + navy suit
        if tie: return hsv2rgb(.08,s,v)
        if suit: return hsv2rgb(.62,.55,v*1.5+.08)
    if rule=='gold':    # black & gold auditor
        if tie: return hsv2rgb(.125,.85,min(1,v*1.05))
        if suit: return hsv2rgb(.1,.25,v*.9)
    if rule=='ledger':  # green suit, gold tie
        if tie: return hsv2rgb(.125,.85,min(1,v*1.05))
        if suit: return hsv2rgb(.38,.65,v*1.7+.05)
    if rule=='tony':    # burgundy suit, cream tie
        if tie: return hsv2rgb(.12,.25,min(1,v*1.25))
        if suit: return hsv2rgb(.97,.75,v*2.0+.06)
    return c
SETS={'juice84':('juice',84),'juice116':('juice',116),'hobo80':('hobo',80),'poop82':('poop',82),'biz82':('biz',82),'biz112':('biz',112),'biz122':('biz',122)}
KITS={'guard':('juice84',None),'exec':('juice84','orange'),'auditor':('juice116','gold'),'brawler':('hobo80',None),'raider':('poop82',None),'heavy':('biz82',None),'ledger':('biz112','ledger'),'bigtony':('biz122','tony')}
out={'sets':{},'kits':{}}; preview=[]
for sname,(en,target) in SETS.items():
    frames=build(en,CFG[en],target)
    # shared palette
    px=np.concatenate([f[0][f[0][...,3]>0][:,:3] for f in frames.values()]); side=int(np.ceil(np.sqrt(len(px))))
    mos=np.zeros((side*side,3),np.uint8); mos[:len(px)]=px; q=Image.fromarray(mos.reshape(side,side,3),'RGB').quantize(colors=44,method=Image.MEDIANCUT,dither=Image.NONE)
    pal=np.array(q.getpalette()[:44*3]).reshape(-1,3); palimg=Image.new('P',(1,1)); palimg.putpalette(q.getpalette())
    fo={}
    for fn,(a,standing) in frames.items():
        h,w=a.shape[:2]; ax=anchor_x(a,standing); rgb=Image.fromarray(np.ascontiguousarray(a[...,:3]),'RGB').quantize(palette=palimg,dither=Image.NONE); idx=np.array(rgb).astype(np.uint8)+1; idx[a[...,3]==0]=0
        fo[fn]={'x':int(round(-ax)),'y':-h,'w':w,'h':h,'d':base64.b64encode(idx.tobytes()).decode()}
    out['sets'][sname]={'pal':['%02x%02x%02x'%tuple(c) for c in pal],'frames':fo}
    preview.append((sname,frames))
for k,(sname,rule) in KITS.items():
    pal=out['sets'][sname]['pal']; out['kits'][k]={'set':sname,'pal':['%02x%02x%02x'%recolor(tuple(int(p[i:i+2],16) for i in (0,2,4)),rule) for p in pal]}
open('src/enemyart.js','w').write('/* Enemy frames cut from the supplied enemy sheet (tools/extract_enemies.py). Palette-indexed, feet on y=0, x offset from the body anchor. */\n(function(G){G.ENEMYART='+json.dumps(out,separators=(',',':'))+';})(globalThis.GG=globalThis.GG||{});\n')
import os; print(os.path.getsize('src/enemyart.js')//1024,'KB')
# contact sheet for review (base sets only, each frame on a 140x130 tile)
tiles=[(sn,fn,a) for sn,fr in preview if sn in('juice84','hobo80','poop82','biz82') for fn,(a,_) in fr.items()]
cols=10; rows=(len(tiles)+cols-1)//cols; sheet=Image.new('RGBA',(cols*130,rows*125),(70,70,96,255))
from PIL import ImageDraw; d=ImageDraw.Draw(sheet)
for i,(sn,fn,a) in enumerate(tiles):
    t=Image.fromarray(a,'RGBA'); x=(i%cols)*130+65-t.width//2; y=(i//cols)*125+112-t.height; sheet.alpha_composite(t,(max(x,(i%cols)*130),max(y,(i//cols)*125))); d.text(((i%cols)*130+2,(i//cols)*125+2),f'{sn[:4]}:{fn}',fill=(255,255,0,255))
sheet.convert('RGB').save('/home/claude/enemy_frames.png'); print(sheet.size,len(tiles))
