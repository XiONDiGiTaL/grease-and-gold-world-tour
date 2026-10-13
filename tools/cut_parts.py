# Cuts the two supplied reference sprites (V.V., Ricky B) into rig pieces at 1/4 resolution, builds a shared palette,
# fills the areas the arms covered, and writes src/rigart.js + rig_src/debug_*.png
import json, base64, colorsys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
Q=0.25
def poly_mask(pts, size):
    m=Image.new('L',size,0); ImageDraw.Draw(m).polygon([(x*Q,y*Q) for x,y in pts],fill=255); return np.array(m)>0
def hsv(img):
    a=img[...,:3].astype(float)/255; mx=a.max(2); mn=a.min(2); d=mx-mn+1e-9
    r,g,b=a[...,0],a[...,1],a[...,2]
    h=np.where(mx==r,((g-b)/d)%6,np.where(mx==g,(b-r)/d+2,(r-g)/d+4))*60
    return h,np.where(mx>0,d/(mx+1e-9),0),mx
def build(name, spec):
    full=Image.open(f'rig_src/{name}_full.png'); W,H=full.size; size=(int(W*Q),int(H*Q))
    # box downscale on premultiplied alpha
    a=np.array(full).astype(float); al=a[...,3:4]/255; pm=np.concatenate([a[...,:3]*al,a[...,3:4]],2)
    sm=np.array(Image.fromarray(pm.astype(np.uint8),'RGBA').resize(size,Image.BOX)).astype(float)
    alpha=sm[...,3]; rgb=np.where(alpha[...,None]>1, sm[...,:3]/np.maximum(alpha[...,None]/255,1e-3),0); rgb=np.clip(rgb,0,255).astype(np.uint8)
    sil=alpha>=128
    # shared palette (quantize silhouette colours)
    q=Image.fromarray(rgb,'RGB').quantize(colors=spec.get('colors',56),method=Image.MEDIANCUT,dither=Image.NONE)
    qa=np.array(q); pal=np.array(q.getpalette()[:spec.get('colors',56)*3]).reshape(-1,3)
    idx=np.where(sil,qa+1,0).astype(np.uint8)       # 0 = transparent
    h,s,v=hsv(rgb)
    skin=(h<45)&(s>.15)&(s<.65)&(v>.62)
    M={k:poly_mask(p,size) for k,p in spec['poly'].items()}
    yy,xx=np.mgrid[0:size[1],0:size[0]]; Y=lambda y:int(y*Q)
    if spec.get('weaponHole'):
        wm=spec['derive']['weapon'](M,yy,xx,Y,skin,sil,h,s,v); M['weaponArea']=ndimage.binary_dilation(wm,iterations=2)
    P={}
    def piece(nm,mask): P[nm]=np.where(mask&sil,idx,0).astype(np.uint8)
    for k,fn in spec['derive'].items(): piece(k,fn(M,yy,xx,Y,skin,sil,h,s,v))
    # torso fill: inside torso region where the near arm / far arm used to be, copy nearest torso colour
    tor=P['torso'].copy(); hole=sil&(M['nearArm']|M['farArm']|M.get('weaponArea',np.zeros_like(sil)))&(xx>=int(spec['torsoLeft']*Q))&(xx<=int(spec['torsoRight']*Q))&(yy>=int(spec['torsoTop']*Q))&(yy<=int(spec['torsoBot']*Q))
    keep=(tor>0)&~hole; 
    if hole.any():
        # Diffusion inpainting: fill hidden garment from the surrounding visible pixels (multi-scale normalised convolution),
        # then snap to the palette. Replaces the old row/nearest/texture fills that left streaks and patches.
        rgbf=np.zeros(tor.shape+(3,),float)
        for k,c in enumerate(pal): rgbf[tor==k+1]=c
        srcok=(rgbf.sum(2)>170)&(spec['fillFilter'](rgbf) if spec.get('fillFilter') else True); kn=((tor>0)&~hole&srcok).astype(float); unknown=hole&(M['torsoP'] if 'torsoP' in M else True)
        for sg in (1.2,2,3.5,6,10,16,26):
            num=np.stack([ndimage.gaussian_filter(rgbf[...,c]*kn,sg) for c in range(3)],-1); den=ndimage.gaussian_filter(kn,sg)
            take=unknown&(den>0.06); est=num/np.maximum(den[...,None],1e-6)
            rgbf[take]=est[take]; kn[take]=1.0; unknown=unknown&~take
        fill=hole&(kn>0)&(M['torsoP'] if 'torsoP' in M else True)
        d2=((rgbf[fill][:,None,:]-pal[None,:,:])**2).sum(2); q=d2.argmin(1)+1
        tor=np.where(hole,0,tor); tor[fill]=q.astype(tor.dtype)
        if spec.get('fillFilter'):   # light denim texture so the filled area is not a flat gradient
            rng=np.random.default_rng(5); sl=np.where((P['armN']>0)&(yy<int(130*Q)),P['armN'],0); sv=sl[sl>0]
            if len(sv): r2=rng.random(tor.shape); tor=np.where(fill&(r2<.06),rng.choice(sv,size=tor.shape).astype(tor.dtype),tor)
    P['torso']=tor.astype(np.uint8)
    CL={}
    cls_fn=spec['classify']
    for nm,arr in P.items():
        CL[nm]=cls_fn(nm,arr,rgb,h,s,v,xx,yy)
    out={'pal':['%02x%02x%02x'%tuple(c) for c in pal],'parts':{},'joints':{k:[v[0]*Q,v[1]*Q] for k,v in spec['joints'].items()},'size':size}
    dbg=Image.new('RGBA',(size[0]*3,size[1]),(60,60,80,255))
    for nm,arr in P.items():
        ys,xs=np.where(arr>0)
        if len(xs)==0: print('EMPTY',nm); continue
        x0,x1,y0,y1=xs.min(),xs.max()+1,ys.min(),ys.max()+1; sub=arr[y0:y1,x0:x1]; csub=CL[nm][y0:y1,x0:x1].astype(np.uint8)
        out['parts'][nm]={'x':int(x0),'y':int(y0),'w':int(x1-x0),'h':int(y1-y0),'d':base64.b64encode(sub.tobytes()).decode(),'c':base64.b64encode(csub.tobytes()).decode()}
    # debug: rest assembly in spec draw order
    rest=np.zeros((size[1],size[0],4),np.uint8)
    for nm in spec['order']:
        if nm not in P: continue
        a=P[nm]; m=a>0; rest[m,:3]=pal[a[m]-1]; rest[m,3]=255
    Image.fromarray(rest,'RGBA').save(f'rig_src/debug_{name}_rest.png')
    orig=Image.fromarray(np.dstack([rgb,(sil*255).astype(np.uint8)]),'RGBA'); orig.save(f'rig_src/debug_{name}_orig.png')
    cs=Image.new('RGBA',(size[0]*4,size[1]*2),(50,50,70,255)); i=0
    for nm,arr in P.items():
        m=arr>0
        if not m.any(): continue
        t=np.zeros((size[1],size[0],4),np.uint8); t[m,:3]=pal[arr[m]-1]; t[m,3]=255; cs.alpha_composite(Image.fromarray(t,'RGBA'),((i%4)*size[0],(i//4)*size[1])); ImageDraw.Draw(cs).text(((i%4)*size[0]+4,(i//4)*size[1]+4),nm,fill=(255,255,0,255)); i+=1
    cs.save(f'rig_src/debug_{name}_parts.png')
    return out
def rect(x0,y0,x1,y1): return [(x0,y0),(x1,y0),(x1,y1),(x0,y1)]
# ------------------------------------------------------------------ RICKY
R=dict(colors=56,torsoLeft=150,torsoRight=800,torsoTop=330,torsoBot=1190,fillMax=70)
R['poly']={
 'head':rect(325,40,715,430),
 'torsoP':[(150,340),(450,335),(460,432),(790,432),(790,1190),(150,1190)],
 'nearArm':[(170,500),(215,455),(300,440),(350,470),(380,520),(378,700),(372,840),(380,895),(405,935),(428,985),(428,1040),(405,1078),(290,1078),(265,1022),(235,1002),(205,992),(212,925),(195,880),(170,790),(160,640)],
 'farArm':[(690,650),(750,640),(775,610),(810,598),(868,605),(898,650),(895,735),(860,770),(825,800),(755,812),(712,800),(690,745)],
 'fist':[(768,612),(902,612),(902,742),(858,778),(795,762),(768,700)],
 'weaponP':[(815,380),(1050,380),(1050,605),(905,605),(885,778),(815,778)],
 'backLeg':[(318,1140),(515,1140),(500,1200),(492,1320),(490,1478),(306,1478),(316,1320)],
 'frontLeg':[(488,1140),(702,1140),(710,1200),(700,1320),(692,1458),(498,1458),(492,1320),(486,1200)],
 'weaponArea':[(815,380),(1050,380),(1050,605),(905,605),(885,778),(815,778)]}
R['derive']={
 'head':lambda M,yy,xx,Y,sk,sil,h,s,v: M['head'],
 'torso':lambda M,yy,xx,Y,sk,sil,h,s,v: M['torsoP']&~(M['weaponP']&~M['fist']&(xx>Y(815)))&~((M['farArm'])&(xx>Y(745)))&~M['nearArm'],
 'armN':lambda M,yy,xx,Y,sk,sil,h,s,v: M['nearArm'],
 'upperNear':lambda M,yy,xx,Y,sk,sil,h,s,v: M['nearArm']&(yy<=Y(770)),
 'foreNear':lambda M,yy,xx,Y,sk,sil,h,s,v: M['nearArm']&(yy>=Y(745)),
 'foreFar':lambda M,yy,xx,Y,sk,sil,h,s,v: M['farArm'],
 'weapon':lambda M,yy,xx,Y,sk,sil,h,s,v: M['weaponP']&~M['fist'],
 'legB':lambda M,yy,xx,Y,sk,sil,h,s,v: M['backLeg']&(yy<=Y(1466)),
 'footB':lambda M,yy,xx,Y,sk,sil,h,s,v: (yy>=Y(1462))&(xx<Y(508))&(xx>=Y(295)),
 'legF':lambda M,yy,xx,Y,sk,sil,h,s,v: M['frontLeg']&(yy<=Y(1450)),
 'footF':lambda M,yy,xx,Y,sk,sil,h,s,v: (yy>=Y(1446))&(xx>=Y(508))&(xx<Y(760))}
R['joints']={'hip':(520,1100),'neck':(520,415),'shN':(330,500),'elN':(265,760),'haN':(345,1015),'shF':(690,650),'elF':(715,800),'haF':(830,690),'grip':(850,700),
 'hipB':(410,1150),'knB':(405,1312),'anB':(400,1470),'soleB':(415,1575),'hipF':(590,1150),'knF':(595,1312),'anF':(590,1452),'soleF':(620,1555),'belt':(560,880)}
R['order']=['weapon','upperNear','legB','footB','torso','legF','footF','head','foreNear','foreFar']
# ------------------------------------------------------------------ V.V.
V=dict(colors=56,torsoLeft=338,torsoRight=745,torsoTop=545,torsoBot=1190,fillMax=70)
V['poly']={
 'head':[(290,85),(712,85),(712,572),(300,572)],
 'hairArea':rect(112,395,485,945),
 'torsoP':rect(338,545,745,1190),
 'nearArm':[(285,575),(440,575),(458,700),(440,900),(425,1040),(425,1250),(435,1332),(405,1402),(305,1402),(287,1322),(282,1100),(292,800),(300,640)],
 'farArm':[(640,760),(700,745),(755,700),(785,610),(850,568),(892,610),(908,690),(868,732),(830,792),(760,892),(700,938),(650,938),(628,860)],
 'micP':[(685,395),(852,395),(948,640),(948,708),(800,708),(690,525)],
 'backLeg':[(335,1170),(562,1170),(550,1300),(542,1450),(527,1844),(316,1844),(333,1500),(336,1300)],
 'frontLeg':[(528,1170),(748,1170),(762,1300),(770,1500),(748,1700),(707,1844),(534,1844),(536,1700),(552,1450),(546,1300)]}
def hairpix(M,yy,xx,Y,sk,sil,h,s,v): return M['hairArea']&~(M['head']&(xx>=Y(290)))&~M['nearArm']&~sk&((v<.7)&(h<60)|(v<.28))
V['derive']={
 'head':lambda M,yy,xx,Y,sk,sil,h,s,v: M['head'],
 'hair':hairpix,
 'torso':lambda M,yy,xx,Y,sk,sil,h,s,v: M['torsoP']&~M['micP']&~hairpix(M,yy,xx,Y,sk,sil,h,s,v)&~(M['farArm']&(xx>Y(700)))&~M['nearArm'],
 'armN':lambda M,yy,xx,Y,sk,sil,h,s,v: M['nearArm'],
 'upperNear':lambda M,yy,xx,Y,sk,sil,h,s,v: M['nearArm']&(yy<=Y(1010)),
 'foreNear':lambda M,yy,xx,Y,sk,sil,h,s,v: M['nearArm']&(yy>=Y(985)),
 'foreFar':lambda M,yy,xx,Y,sk,sil,h,s,v: M['farArm']&ndimage.binary_dilation(sk&M['farArm'],iterations=2),
 'weapon':lambda M,yy,xx,Y,sk,sil,h,s,v: M['micP']&~sk&~(M['farArm']&sk),
 'legB':lambda M,yy,xx,Y,sk,sil,h,s,v: M['backLeg']&(yy<=Y(1850)),
 'footB':lambda M,yy,xx,Y,sk,sil,h,s,v: (yy>=Y(1846))&(xx<Y(560)),
 'legF':lambda M,yy,xx,Y,sk,sil,h,s,v: M['frontLeg']&(yy<=Y(1850)),
 'footF':lambda M,yy,xx,Y,sk,sil,h,s,v: (yy>=Y(1846))&(xx>=Y(560))}
V['joints']={'hip':(540,1110),'neck':(520,540),'hairP':(400,540),'shN':(385,620),'elN':(370,1000),'haN':(360,1330),'shF':(640,720),'elF':(700,900),'haF':(845,640),'grip':(835,640),
 'hipB':(440,1190),'knB':(430,1500),'anB':(425,1842),'soleB':(450,2052),'hipF':(640,1190),'knF':(665,1500),'anF':(625,1840),'soleF':(690,2042),'belt':(560,1060)}
V['order']=['hair','upperNear','legB','footB','torso','legF','footF','head','foreNear','foreFar','weapon']

def inrect(xx,yy,x0,y0,x1,y1): return (xx>=x0*Q)&(xx<x1*Q)&(yy>=y0*Q)&(yy<y1*Q)
def inpoly(pts,shape):
    m=Image.new('L',(shape[1],shape[0]),0); ImageDraw.Draw(m).polygon([(x*Q,y*Q) for x,y in pts],fill=255); return np.array(m)>0
# class ids: 1 skin 2 coat/garment 3 fleece/light garment 4 shirt 5 pants 6 shoes 7 hair 8 shades 9 mustache
def classify_ricky(nm,arr,rgb,h,s,v,xx,yy):
    c=np.zeros(arr.shape,np.uint8); a=arr>0; sk=(h<45)&(s>.15)&(v>.5); dark=v<.32
    fleece=(s<.36)&(v>.88); coat=(h>=15)&(h<=48)&(s>.28)&(v>.38)&(v<=.9)
    if nm=='head':
        c[a&sk]=1; hair=inpoly([(340,50),(640,50),(640,215),(560,215),(520,300),(450,310),(340,320)],arr.shape)&dark; c[a&hair]=7
        c[a&inrect(xx,yy,440,170,668,282)&(s>.5)&(v>.42)&(h>12)&(h<55)]=8
        c[a&inrect(xx,yy,552,255,688,340)&dark]=9
    elif nm=='torso':
        c[a&coat]=2; c[a&fleece]=3
        c[a&inrect(xx,yy,460,395,590,445)&sk&~fleece]=1
        c[a&inpoly([(480,520),(630,520),(630,850),(480,850)],arr.shape)&dark]=4
        c[a&(yy>=880*Q)&(h>190)&(h<290)&(v>.15)]=5
    elif nm in('upperNear','foreNear','foreFar','armN'):
        c[a&coat]=2; c[a&fleece]=3
        hand=(yy>=985*Q) if nm in('foreNear','armN') else inpoly([(768,612),(902,612),(902,742),(858,778),(795,762),(768,700)],arr.shape)
        c[a&hand&sk&~fleece]=1
    elif nm.startswith('leg'): c[a&(h>190)&(h<290)&(v>.15)]=5
    elif nm.startswith('foot'): c[a&(h<40)&(s>.4)&(v>.3)]=6; c[a&(h>190)&(h<290)&(v>.15)]=5
    return c
def classify_vv(nm,arr,rgb,h,s,v,xx,yy):
    c=np.zeros(arr.shape,np.uint8); a=arr>0; sk=(h<45)&(s>.15)&(v>.62)
    brown=(h>=10)&(h<=50)&(s>.3)&(v<.7)
    if nm in('head','hair'): c[a&brown]=7; c[a&sk]=1
    elif nm=='torso':
        c[a&(s<.28)&(v>.25)&(v<.8)&(yy<1000*Q)]=2; c[a&sk]=1; c[a&(yy>=1000*Q)&(v<.4)]=5
    elif nm in('upperNear','foreNear','foreFar','armN'): c[a&sk]=1
    elif nm.startswith('leg'): c[a&(v<.45)]=5
    return c
R['classify']=classify_ricky; V['classify']=classify_vv

# ------------------------------------------------------------------ JOHNNY (own reference, native 210x273 resolution)
import colorsys as _cs
J=dict(colors=48,torsoLeft=0,torsoRight=130,torsoTop=40,torsoBot=190,fillMax=90,weaponHole=True,fillFilter=lambda c:(c[...,2]>c[...,0]+8)&(c[...,2]>c[...,1]-4))
J['poly']={
 'head':[(36,0),(88,0),(88,52),(80,66),(44,66),(36,52)],
 'torsoP':[(0,52),(60,44),(106,48),(112,66),(104,104),(100,150),(96,188),(0,188)],
 'nearArm':[(2,62),(24,50),(40,58),(37,85),(29,112),(33,128),(46,144),(66,148),(68,172),(52,178),(38,172),(30,158),(22,142),(10,128),(0,108),(0,80)],
 'farArm':[(118,100),(148,102),(160,114),(158,136),(142,142),(126,134),(116,118)],
 'salamiP':[(55,112),(75,95),(110,72),(140,40),(160,18),(190,14),(208,30),(210,70),(190,98),(165,128),(135,150),(105,160),(75,162),(55,152)],
 'weaponArea':[(50,2),(212,2),(212,162),(50,162)],
 'backLeg':[(12,164),(86,164),(82,196),(62,226),(50,242),(14,242),(20,216),(20,190)],
 'frontLeg':[(80,164),(132,166),(144,200),(148,238),(130,244),(118,222),(100,196),(84,178)]}
def _salami(M,yy,xx,Y,sk,sil,h,s,v):
    skin=(h>=14)&(h<=42)&(s>.3)&(v>.4)
    return M['salamiP']&~skin&~M['head']&~M['farArm']
J['derive']={
 'head':lambda M,yy,xx,Y,sk,sil,h,s,v: M['head'],
 'weapon':_salami,
 'torso':lambda M,yy,xx,Y,sk,sil,h,s,v: M['torsoP']&~_salami(M,yy,xx,Y,sk,sil,h,s,v)&~M['nearArm']&~M['farArm']&(yy<=Y(188)),
 'armN':lambda M,yy,xx,Y,sk,sil,h,s,v: M['nearArm']&~_salami(M,yy,xx,Y,sk,sil,h,s,v),
 'upperNear':lambda M,yy,xx,Y,sk,sil,h,s,v: M['nearArm']&(yy<=Y(112))&~_salami(M,yy,xx,Y,sk,sil,h,s,v),
 'foreFar':lambda M,yy,xx,Y,sk,sil,h,s,v: M['farArm']&sil,
 'armF':lambda M,yy,xx,Y,sk,sil,h,s,v: M['nearArm']&(yy<Y(138))&~_salami(M,yy,xx,Y,sk,sil,h,s,v),
 'legB':lambda M,yy,xx,Y,sk,sil,h,s,v: M['backLeg']&(yy<=Y(240)),
 'legF':lambda M,yy,xx,Y,sk,sil,h,s,v: M['frontLeg']&(yy<=Y(242)),
 'footB':lambda M,yy,xx,Y,sk,sil,h,s,v: (yy>=Y(238))&(xx<Y(64)),
 'footF':lambda M,yy,xx,Y,sk,sil,h,s,v: (yy>=Y(241))&(xx>=Y(110))}
J['joints']={'hip':(78,162),'neck':(62,60),'belt':(78,160),'shN':(45,56),'elN':(14,112),'haN':(52,158),'shF':(100,58),'elF':(118,108),'haF':(142,124),'grip':(142,124),'wrN':(46,138),
 'hipB':(60,168),'knB':(42,205),'anB':(34,238),'soleB':(22,262),'hipF':(98,170),'knF':(122,206),'anF':(136,240),'soleF':(142,272)}
J['order']=['legB','footB','torso','legF','footF','head','armN','weapon','foreFar']
J['classify']=lambda nm,arr,rgb,h,s,v,xx,yy: np.zeros(arr.shape,np.uint8)
art={'ricky':build('ricky',R),'vv':build('vv',V)}
Q=1.0
art['johnny']=build('johnny',J)
Q=0.25
open('src/rigart.js','w').write('/* Rig pieces cut from the supplied reference sprites (tools/cut_parts.py). 1/4-resolution, palette-indexed. */\n(function(G){G.RIGART='+json.dumps(art,separators=(',',':'))+';})(globalThis.GG=globalThis.GG||{});\n')
for n in art: print(n,len(art[n]['parts']),'parts',art[n]['size'])
import os; print(os.path.getsize('src/rigart.js')//1024,'KB')
