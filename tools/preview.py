import json,sys
from PIL import Image
D='/home/claude/grease-and-gold/assets/sprites/'
def sheet(id, anims, bg=(70,70,96,255)):
    im=Image.open(D+id+'.png').convert('RGBA'); j=json.load(open(D+id+'.json')); C=j['cell']
    cols=max(j['anims'][a]['n'] for a in anims)
    out=Image.new('RGBA',(cols*C,len(anims)*C),bg)
    for r,a in enumerate(anims):
        row=j['anims'][a]['row']
        for i in range(j['anims'][a]['n']):
            out.alpha_composite(im.crop((i*C,row*C,(i+1)*C,(row+1)*C)),(i*C,r*C))
    return out
if __name__=='__main__':
    id=sys.argv[1]; anims=sys.argv[2].split(','); out=sheet(id,anims); out.save(sys.argv[3]); print(out.size)
