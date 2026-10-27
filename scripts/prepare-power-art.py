"""Register generated poses and component roots without changing source artwork."""
from pathlib import Path
from PIL import Image
import numpy as np
from scipy import ndimage
import hashlib, json

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/powers'
SRC=OUT/'source'
manifest={'version':'0.15.0','sources':{},'atlases':{}}
for p in sorted(SRC.glob('*.png')):
    manifest['sources'][p.name]={'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}

def isolated(sheet, point):
    # Select one connected authored silhouette, including its anti-aliased edge.
    # The generated layout has uneven gutters: rectangular cuts alone can pick
    # up a neighboring robe or crop a wide swing. Never modify the source PNG.
    source=Image.open(SRC/sheet).convert('RGBA');pixels=np.array(source)
    labels,n=ndimage.label(pixels[:,:,3]>90)
    x,y=point
    nearby=labels[max(0,y-12):y+13,max(0,x-12):x+13]
    counts=np.bincount(nearby.ravel(),minlength=n+1);counts[0]=0
    label=int(counts.argmax());mask=labels==label
    yy,xx=np.where(mask)
    if len(xx)<100:raise ValueError((sheet,point,'No connected sprite'))
    box=(max(0,int(xx.min())-4),max(0,int(yy.min())-4),min(source.width,int(xx.max())+5),min(source.height,int(yy.max())+5))
    edge=ndimage.binary_dilation(mask,iterations=3)
    pixels[:,:,3]=np.where(edge,pixels[:,:,3],0)
    return Image.fromarray(pixels).crop(box),box

def registered(sheet, rect, eye, factor, target=(400,250)):
    # All poses have the same virtual foot/collision anchor (360, 500).
    im,rect=isolated(sheet,eye)
    im=im.resize((round(im.width*factor),round(im.height*factor)),Image.Resampling.LANCZOS)
    canvas=Image.new('RGBA',(640,640))
    xy=(round(target[0]-(eye[0]-rect[0])*factor),round(target[1]-(eye[1]-rect[1])*factor))
    canvas.alpha_composite(im,xy)
    return canvas.resize((512,512),Image.Resampling.LANCZOS)

actions=[]
tucks=[((0,0,836,510),(490,165)),((836,0,1536,510),(1195,205)),
       ((0,510,835,1024),(469,715)),((835,510,1536,1024),(1220,660))]
for i,(rect,eye) in enumerate(tucks):
    actions.append(registered('air-tuck.png',rect,eye,.63,(400,340 if i<3 else 305)))
attacks=[((0,0,362,576),(293,322)),((362,0,780,576),(642,320)),
         ((780,0,1247,576),(1024,325)),((1247,0,1536,576),(1413,335)),
         ((0,576,363,1024),(285,810)),((363,576,787,1024),(645,803)),
         ((787,576,1238,1024),(1035,815)),((1238,576,1536,1024),(1417,815))]
for i,(rect,eye) in enumerate(attacks):
    actions.append(registered('air-scythe.png',rect,eye,1.05 if i<4 else .88,(400,250 if i<4 else 375)))
for rect,eye in [((0,0,536,1024),(342,374)),((536,0,1034,1024),(872,370)),((1034,0,1536,1024),(1360,374))]:
    actions.append(registered('relic-acquisition.png',rect,eye,.70,(350,132)))
atlas=Image.new('RGBA',(2048,2048))
for i,im in enumerate(actions): atlas.alpha_composite(im,((i%4)*512,(i//4)*512))
atlas.save(OUT/'reaper-actions.png',optimize=True)
manifest['atlases']['reaper-actions']={'file':'reaper-actions.png','cell':[512,512],'frames':15,'anchor':[288,400],'scale':.375}

wing_rects=[
 ((0,0,352,350),(185,259)),((352,0,737,350),(550,265)),((737,0,1215,350),(960,278)),((1215,0,1536,350),(1384,259)),
 ((0,350,350,715),(185,605)),((350,350,740,715),(555,605)),((740,350,1214,715),(960,638)),((1214,350,1536,715),(1386,610)),
 ((0,715,349,1024),(185,890)),((349,715,739,1024),(555,885)),((739,715,1215,1024),(959,906)),((1215,715,1536,1024),(1391,889))]
atlas=Image.new('RGBA',(2048,1152))
for i,(rect,root) in enumerate(wing_rects):
    # Fixed source scale preserves spread amplitude instead of fitting each pose.
    tile=Image.new('RGBA',(512,384));im,rect=isolated('wings.png',root)
    tile.alpha_composite(im,(256-root[0]+rect[0],260-root[1]+rect[1]))
    atlas.alpha_composite(tile,((i%4)*512,(i//4)*384))
atlas.save(OUT/'wings.png',optimize=True)
manifest['atlases']['wings']={'file':'wings.png','cell':[512,384],'frames':12,'root':[256,260]}

if (SRC/'power-effects.png').exists():
    im=Image.open(SRC/'power-effects.png').convert('RGBA')
    atlas=Image.new('RGBA',(1024,768))
    for i in range(12):
        x=(i%4)*im.width//4;y=(i//4)*im.height//3
        cell=im.crop((x,y,(i%4+1)*im.width//4,(i//4+1)*im.height//3))
        box=cell.getchannel('A').point(lambda v:255 if v>35 else 0).getbbox()
        if box: cell=cell.crop(box)
        cell.thumbnail((220,220),Image.Resampling.LANCZOS)
        atlas.alpha_composite(cell,((i%4)*256+(256-cell.width)//2,(i//4)*256+(256-cell.height)//2))
    atlas.save(OUT/'power-effects.png',optimize=True)
    manifest['atlases']['power-effects']={'file':'power-effects.png','cell':[256,256],'frames':12}
for name,max_size in [('summit-shrine',(1024,768)),('summit-shrine-open',(1024,768)),('bone-crossbow',(512,512))]:
    p=SRC/(name+'.png')
    if p.exists():
        im=Image.open(p).convert('RGBA');im.thumbnail(max_size,Image.Resampling.LANCZOS)
        im.save(OUT/(name+'.png'),optimize=True)
for p in OUT.glob('*.png'):
    manifest.setdefault('runtime',{})[p.name]={'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'size':list(Image.open(p).size)}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Registered',len(actions),'Reaper poses and 12 wing frames; original source PNGs preserved.')
