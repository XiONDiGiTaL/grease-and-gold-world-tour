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
    P={}
    def piece(nm,mask): P[nm]=np.where(mask&sil,idx,0).astype(np.uint8)
    for k,fn in spec['derive'].items(): piece(k,fn(M,yy,xx,Y,skin,sil,h,s,v))
    # torso fill: inside torso region where the near arm / far arm used to be, copy nearest torso colour
    tor=P['torso'].copy(); hole=(M['nearArm']|M['farArm']|M.get('weaponArea',np.zeros_like(sil)))&(xx>=int(spec['torsoLeft']*Q))&(xx<=int(spec['torsoRight']*Q))&(yy>=int(spec['torsoTop']*Q))&(yy<=int(spec['torsoBot']*Q))
    keep=(tor>0)&~hole; 
    if hole.any():
        filled=tor.copy(); Hh,Ww=tor.shape
        for y in range(Hh):
            xs=np.where(hole[y])[0]
            for x in xs:
                nx=x
                while nx<Ww and not keep[y,nx] and nx-x<60: nx+=1       # continue the garment texture from the right
                if nx<Ww and keep[y,nx]: filled[y,x]=tor[y,nx]
                else: filled[y,x]=0
        tor=np.where(hole,filled,tor)
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
R=dict(colors=56,torsoLeft=335,torsoRight=800,torsoTop=330,torsoBot=1190,fillMax=70)
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
 'torso':lambda M,yy,xx,Y,sk,sil,h,s,v: M['torsoP']&~(M['weaponP']&~M['fist']&(xx>Y(815)))&~((M['farArm'])&(xx>Y(745))),
 'upperNear':lambda M,yy,xx,Y,sk,sil,h,s,v: M['nearArm']&(yy<=Y(770)),
 'foreNear':lambda M,yy,xx,Y,sk,sil,h,s,v: M['nearArm']&(yy>=Y(745)),
 'foreFar':lambda M,yy,xx,Y,sk,sil,h,s,v: M['farArm'],
 'weapon':lambda M,yy,xx,Y,sk,sil,h,s,v: M['weaponP']&~M['fist'],
 'thighB':lambda M,yy,xx,Y,sk,sil,h,s,v: M['backLeg']&(yy<=Y(1325)),
 'shinB':lambda M,yy,xx,Y,sk,sil,h,s,v: M['backLeg']&(yy>=Y(1300)),
 'footB':lambda M,yy,xx,Y,sk,sil,h,s,v: (yy>=Y(1462))&(xx<Y(508))&(xx>=Y(295)),
 'thighF':lambda M,yy,xx,Y,sk,sil,h,s,v: M['frontLeg']&(yy<=Y(1325)),
 'shinF':lambda M,yy,xx,Y,sk,sil,h,s,v: M['frontLeg']&(yy>=Y(1300)),
 'footF':lambda M,yy,xx,Y,sk,sil,h,s,v: (yy>=Y(1446))&(xx>=Y(508))&(xx<Y(760))}
R['joints']={'hip':(520,1100),'neck':(520,415),'shN':(330,500),'elN':(265,760),'haN':(345,1015),'shF':(690,650),'elF':(715,800),'haF':(830,690),'grip':(850,700),
 'hipB':(410,1150),'knB':(405,1312),'anB':(400,1470),'soleB':(415,1575),'hipF':(590,1150),'knF':(595,1312),'anF':(590,1452),'soleF':(620,1555),'belt':(560,880)}
R['order']=['weapon','upperNear','shinB','thighB','footB','torso','shinF','thighF','footF','head','foreNear','foreFar']
# ------------------------------------------------------------------ V.V.
V=dict(colors=56,torsoLeft=330,torsoRight=745,torsoTop=545,torsoBot=1190,fillMax=70)
V['poly']={
 'head':[(290,85),(712,85),(712,572),(300,572)],
 'hairArea':rect(112,395,485,945),
 'torsoP':rect(300,545,745,1190),
 'nearArm':[(285,575),(440,575),(458,700),(440,900),(425,1040),(425,1250),(435,1332),(405,1402),(305,1402),(287,1322),(282,1100),(292,800),(300,640)],
 'farArm':[(640,760),(700,745),(755,700),(785,610),(850,568),(892,610),(908,690),(868,732),(830,792),(760,892),(700,938),(650,938),(628,860)],
 'micP':[(685,395),(852,395),(948,640),(948,708),(800,708),(690,525)],
 'backLeg':[(335,1170),(562,1170),(550,1300),(542,1450),(527,1844),(316,1844),(333,1500),(336,1300)],
 'frontLeg':[(528,1170),(748,1170),(762,1300),(770,1500),(748,1700),(707,1844),(534,1844),(536,1700),(552,1450),(546,1300)]}
def hairpix(M,yy,xx,Y,sk,sil,h,s,v): return M['hairArea']&~(M['head']&(xx>=Y(290)))&~M['nearArm']&~sk&((v<.7)&(h<60)|(v<.28))
V['derive']={
 'head':lambda M,yy,xx,Y,sk,sil,h,s,v: M['head'],
 'hair':hairpix,
 'torso':lambda M,yy,xx,Y,sk,sil,h,s,v: M['torsoP']&~M['micP']&~hairpix(M,yy,xx,Y,sk,sil,h,s,v)&~(M['farArm']&(xx>Y(700))),
 'upperNear':lambda M,yy,xx,Y,sk,sil,h,s,v: M['nearArm']&(yy<=Y(1010)),
 'foreNear':lambda M,yy,xx,Y,sk,sil,h,s,v: M['nearArm']&(yy>=Y(985)),
 'foreFar':lambda M,yy,xx,Y,sk,sil,h,s,v: M['farArm'],
 'weapon':lambda M,yy,xx,Y,sk,sil,h,s,v: M['micP']&~sk&~(M['farArm']&sk),
 'thighB':lambda M,yy,xx,Y,sk,sil,h,s,v: M['backLeg']&(yy<=Y(1500)),
 'shinB':lambda M,yy,xx,Y,sk,sil,h,s,v: M['backLeg']&(yy>=Y(1470)),
 'footB':lambda M,yy,xx,Y,sk,sil,h,s,v: (yy>=Y(1846))&(xx<Y(560)),
 'thighF':lambda M,yy,xx,Y,sk,sil,h,s,v: M['frontLeg']&(yy<=Y(1500)),
 'shinF':lambda M,yy,xx,Y,sk,sil,h,s,v: M['frontLeg']&(yy>=Y(1470)),
 'footF':lambda M,yy,xx,Y,sk,sil,h,s,v: (yy>=Y(1846))&(xx>=Y(560))}
V['joints']={'hip':(540,1110),'neck':(520,540),'hairP':(400,540),'shN':(385,620),'elN':(370,1000),'haN':(360,1330),'shF':(640,720),'elF':(700,900),'haF':(845,640),'grip':(835,640),
 'hipB':(440,1190),'knB':(430,1500),'anB':(425,1842),'soleB':(450,2052),'hipF':(640,1190),'knF':(665,1500),'anF':(625,1840),'soleF':(690,2042),'belt':(560,1060)}
V['order']=['hair','upperNear','shinB','thighB','footB','torso','shinF','thighF','footF','head','foreNear','foreFar','weapon']

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
    elif nm in('upperNear','foreNear','foreFar'):
        c[a&coat]=2; c[a&fleece]=3
        hand=(yy>=985*Q) if nm=='foreNear' else inpoly([(768,612),(902,612),(902,742),(858,778),(795,762),(768,700)],arr.shape)
        c[a&hand&sk&~fleece]=1
    elif nm.startswith(('thigh','shin')): c[a&(h>190)&(h<290)&(v>.15)]=5
    elif nm.startswith('foot'): c[a&(h<40)&(s>.4)&(v>.3)]=6; c[a&(h>190)&(h<290)&(v>.15)]=5
    return c
def classify_vv(nm,arr,rgb,h,s,v,xx,yy):
    c=np.zeros(arr.shape,np.uint8); a=arr>0; sk=(h<45)&(s>.15)&(v>.62)
    brown=(h>=10)&(h<=50)&(s>.3)&(v<.7)
    if nm in('head','hair'): c[a&brown]=7; c[a&sk]=1
    elif nm=='torso':
        c[a&(s<.28)&(v>.25)&(v<.8)&(yy<1000*Q)]=2; c[a&sk]=1; c[a&(yy>=1000*Q)&(v<.4)]=5
    elif nm in('upperNear','foreNear','foreFar'): c[a&sk]=1
    elif nm.startswith(('thigh','shin')): c[a&(v<.45)]=5
    return c
R['classify']=classify_ricky; V['classify']=classify_vv
art={'ricky':build('ricky',R),'vv':build('vv',V)}
open('src/rigart.js','w').write('/* Rig pieces cut from the supplied reference sprites (tools/cut_parts.py). 1/4-resolution, palette-indexed. */\n(function(G){G.RIGART='+json.dumps(art,separators=(',',':'))+';})(globalThis.GG=globalThis.GG||{});\n')
for n in art: print(n,len(art[n]['parts']),'parts',art[n]['size'])
import os; print(os.path.getsize('src/rigart.js')//1024,'KB')
