"""Pack authored v0.18 poses, retaining source pixels and explicit registration.

No procedural replacement drawings or generated in-between images are used.
Only crop, registration and atlas assembly happen here.
"""
from pathlib import Path
import hashlib, json
import numpy as np
from PIL import Image
from scipy import ndimage
import os, math

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/motion/v0180'
CELL=320
manifest={'version':'0.18.0','sources':{},'runtime':{},'registration':{}}
data={'cell':[CELL,CELL],'anchor':[205,280],'frames':24,'sheets':{},'grips':[]}
# Front fist centers, measured in each original 256px pose cell.
GRIPS=[(235,146),(141,79),(124,65),(126,57),(139,38),(133,26),
       (145,72),(226,86),(246,114),(242,120),(230,126),(237,139),
       (210,145),(214,149),(218,151),(225,152),(222,151),(226,151),
       (218,155),(232,152),(233,154),(140,81),(145,65),(239,154)]

def save_png(im,path):
    temp=path.with_suffix('.tmp')
    with temp.open('wb') as f:
        im.save(f,format='PNG',optimize=True);f.flush();os.fsync(f.fileno())
    Image.open(temp).load()
    temp.replace(path)

def eye(a):
    r,g,b,v=[a[:,:,i].astype(float) for i in range(4)]
    mask=(g>135)&(b>125)&(r<g*.75)&(v>80)
    labels,n=ndimage.label(mask)
    sizes=ndimage.sum(mask,labels,range(1,n+1))
    assert len(sizes) and max(sizes)>=1,'Missing cyan eye'
    y,x=np.where(labels==1+int(np.argmax(sizes)))
    return float(np.median(x)),float(np.median(y))

for name in ['reaper-run','reaper-jump','reaper-cut-body']:
    src=Image.open(OUT/'source'/f'{name}.png').convert('RGBA')
    canvas=Image.new('RGBA',(CELL*6,CELL*4))
    poses=[]
    for i in range(24):
        box=(i%6*256,i//6*256,i%6*256+256,i//6*256+256)
        tile=src.crop(box)
        source_file=name+'.png';source_scale=1
        if name=='reaper-run' and i==13:
            # Replace the generated sheet's overlong-leg outlier with a
            # separately authored contact pose, normalized at the body root.
            correction=Image.open(OUT/'source/reaper-run-contact-correction.png').convert('RGBA')
            cx,cy=eye(np.array(correction))
            cb=correction.getchannel('A').point(lambda v:255 if v>64 else 0).getbbox()
            source_scale=126/(cb[3]-cy)
            tile=correction.resize((round(correction.width*source_scale),round(correction.height*source_scale)),Image.Resampling.LANCZOS)
            box=(0,0,correction.width,correction.height);source_file='reaper-run-contact-correction.png'
        a=np.array(tile);ex,ey=eye(a)
        bounds=tile.getchannel('A').point(lambda v:255 if v>64 else 0).getbbox()
        assert bounds and bounds[2]-bounds[0]>100
        if name=='reaper-run':
            foot=max(bounds[3],ey+126-3.5*math.sin(i/24*4*math.pi))
        elif name=='reaper-jump':
            foot=bounds[3] if i>=18 else ey+126
        else:
            foot=bounds[3]
        px,py=round(205-ex),round(280-foot)
        # The full transparent source cell, rather than alpha outline, controls
        # registration. Crop any redundant empty margin only at atlas packing.
        canvas.alpha_composite(tile,(i%6*CELL+px,i//6*CELL+py))
        poses.append({'sourceFile':source_file,'sourceScale':source_scale,'sourceBox':box,'sourceEye':[ex,ey],'foot':foot,'position':[px,py]})
        if name=='reaper-cut-body':data['grips'].append([round(GRIPS[i][0]+px,2),round(GRIPS[i][1]+py,2)])
    path=OUT/f'{name}.png';save_png(canvas,path)
    data['sheets'][name]={'frames':24,'cell':[CELL,CELL],'anchor':[205,280]}
    manifest['registration'][name]=poses

weapon=Image.open(OUT/'source/scythe.png').convert('RGBA')
save_png(weapon.resize((384,384),Image.Resampling.LANCZOS),OUT/'scythe.png')
factor=384/1254
data['weapon']={'size':[384,384],'pivot':[805*factor,990*factor],
                'tip':[201*factor,500*factor],'socket':[865*factor,250*factor],
                'scale':.14/factor}
for group,folder in [('sources',OUT/'source'),('runtime',OUT)]:
    for p in sorted(folder.glob('*.png')):
        im=Image.open(p);im.load();assert im.mode=='RGBA'
        manifest[group][p.name]={'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'size':list(im.size)}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
(OUT/'animation-data.js').write_text('/* Authored v0.18 motion registration. */\nwindow.GRIM_MOTION_DATA='+json.dumps(data,separators=(',',':'))+';\n')
print(json.dumps({k:sum(v['bytes'] for v in manifest[k].values()) for k in ['sources','runtime']}))
