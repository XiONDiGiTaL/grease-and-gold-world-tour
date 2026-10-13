# Step 1 for tools/extract_enemies.py: builds enemy_src/keep.npy (foreground of the supplied enemy sheet with the label text removed).
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage
A=np.array(Image.open(sys.argv[1]).convert('RGB')).astype(int); bg=np.array([151,152,151]); fg=np.abs(A-bg).sum(2)>36
labels=[(0,5,260,40),(140,35,255,72),(285,36,375,62),(400,36,525,62),(530,36,650,62),(0,262,345,296),(110,284,262,322),(338,288,422,312),(524,284,652,312),
 (0,514,372,546),(140,540,252,577),(318,540,398,563),(524,540,652,563),(430,612,508,698),(0,768,462,802),(165,800,222,820),(330,800,400,820),(524,800,652,820)]
lab,n=ndimage.label(fg,structure=np.ones((3,3))); keep=np.zeros_like(fg)
for i,sl in enumerate(ndimage.find_objects(lab),1):
    y0,y1,x0,x1=sl[0].start,sl[0].stop,sl[1].start,sl[1].stop
    inlab=any(x0>=a-2 and x1<=c+2 and y0>=b-2 and y1<=d+2 for a,b,c,d in labels)
    if not inlab and (y1-y0)*(x1-x0)>30: keep|=(lab==i)
os.makedirs('enemy_src',exist_ok=True); np.save('enemy_src/keep.npy',keep); print('mask saved',keep.sum())
