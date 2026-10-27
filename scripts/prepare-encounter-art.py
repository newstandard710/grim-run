"""Register v0.19 generated drawings; preserve source bytes and publish exact hashes."""
from pathlib import Path
from PIL import Image
from scipy import ndimage
import numpy as np
import hashlib,json

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/encounters/v0190';SRC=OUT/'source'
manifest={'version':'0.19.0','sources':{},'runtime':{},'registration':{}}
def save(im,name):
    target=OUT/name;temp=target.with_suffix('.tmp')
    im.save(temp,format='PNG',optimize=True);Image.open(temp).load();temp.replace(target)
    manifest['runtime'][name]={'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'size':list(im.size)}
def drawings(name,count,rows):
    im=Image.open(SRC/(name+'.png')).convert('RGBA');a=np.array(im)
    labels,n=ndimage.label(a[:,:,3]>80);sizes=np.bincount(labels.ravel());sizes[0]=0
    selected=np.argsort(sizes)[-count:];items=[]
    for k in selected:
        assert sizes[k]>1000,(name,k)
        y,x=np.where(labels==k);box=(max(0,int(x.min())-3),max(0,int(y.min())-3),min(im.width,int(x.max())+4),min(im.height,int(y.max())+4))
        pixels=a.copy();pixels[:,:,3]=np.where(ndimage.binary_dilation(labels==k,iterations=3),pixels[:,:,3],0)
        items.append((min(rows-1,int((y.min()+y.max())/2/im.height*rows)),float(x.mean()),Image.fromarray(pixels).crop(box),box))
    items.sort(key=lambda x:(x[0],x[1]))
    assert all(sum(v[0]==r for v in items)==4 for r in range(rows)),(name,[v[:2] for v in items])
    return [(v[2],v[3]) for v in items]

# The root is a single fixed painting; only the stalk/head move between poses.
plants=drawings('plant-attack',16,4)
factor=min(300/max(im.width for im,_ in plants),350/max(im.height for im,_ in plants))
atlas=Image.new('RGBA',(1536,1600));jaws=[];registration=[]
base_source=plants[0][0];base_alpha=np.array(base_source)[:,:,3]>100
base_x=float(np.where(base_alpha[-8:])[1].mean());base_h=46
base=base_source.crop((0,base_source.height-base_h,base_source.width,base_source.height))
for i,(im,box) in enumerate(plants):
    a=np.array(im);alpha=a[:,:,3]>100;root_x=float(np.where(alpha[-8:])[1].mean());root_y=im.height-1
    xy=(round(245-root_x*factor),round(375-root_y*factor))
    # Remove the varying root art at a narrow stem junction, retain the full head.
    cut=min(im.height-1,im.height-base_h)
    moving=im.crop((0,0,im.width,cut))
    moving=moving.resize((round(moving.width*factor),round(moving.height*factor)),Image.Resampling.LANCZOS)
    tile=Image.new('RGBA',(384,400));tile.alpha_composite(moving,xy)
    root=base.resize((round(base.width*factor),round(base.height*factor)),Image.Resampling.LANCZOS)
    tile.alpha_composite(root,(round(245-base_x*factor),round(375-(base_h-1)*factor)))
    assert tile.getchannel('A').getbbox()[0]>0 and tile.getchannel('A').getbbox()[2]<384,(i,tile.getchannel('A').getbbox())
    # Ivory teeth bound the jaw; the root is a separate small contact shape.
    r,g,b,aa=[a[:,:,k].astype(float) for k in range(4)]
    teeth=(r>130)&(g>100)&(b<g*.91)&(aa>100)
    teeth[round(im.height*.77):]=False
    yy,xx=np.where(teeth);assert len(xx)>30,(i,'jaw registration')
    jaw=[round(xy[0]+(int(xx.min())-7)*factor,2),round(xy[1]+(int(yy.min())-6)*factor,2),
         round((int(xx.max()-xx.min())+15)*factor,2),round((int(yy.max()-yy.min())+14)*factor,2)]
    jaws.append(jaw);registration.append({'sourceBox':box,'root':[root_x,root_y],'position':xy,'factor':factor,'jaw':jaw})
    atlas.alpha_composite(tile,((i%4)*384,(i//4)*400))
save(atlas,'plant-attack.png')
manifest['registration']['plant']={'frames':16,'cell':[384,400],'anchor':[245,375],'scale':.768,'jaws':jaws,'poses':registration}

# Anatomical shoulder joints, measured on the original twelve complete drawings.
roots=[(201,233),(623,242),(1058,202),(1467,180),
       (205,486),(625,481),(1058,477),(1462,488),
       (206,729),(625,753),(1057,768),(1467,728)]
wings=drawings('gravewing',12,3);atlas=Image.new('RGBA',(2048,1152));registrations=[]
for i,((im,box),(rx,ry)) in enumerate(zip(wings,roots)):
    ax,ay=rx-box[0],ry-box[1]
    factor=min(.99,244/max(ax,im.width-ax),246/max(1,ay),116/max(1,im.height-ay))
    xy=(round(256-ax*factor),round(260-ay*factor))
    tile=Image.new('RGBA',(512,384));tile.alpha_composite(im.resize((round(im.width*factor),round(im.height*factor)),Image.Resampling.LANCZOS),xy)
    bb=tile.getchannel('A').getbbox();assert bb and bb[0]>0 and bb[1]>0 and bb[2]<512 and bb[3]<384,(i,bb)
    atlas.alpha_composite(tile,((i%4)*512,(i//4)*384))
    registrations.append({'sourceBox':box,'sourceRoot':[rx,ry],'position':xy,'factor':factor})
save(atlas,'gravewing.png')
manifest['registration']['gravewing']={'frames':12,'cell':[512,384],'anchor':[256,260],'poses':registrations}

# Keep the accepted wing drawings. Correct only the two misidentified eye anchors.
bat=Image.open(ROOT/'assets/combat/v0170/bat-flight.png').convert('RGBA');fixed=Image.new('RGBA',bat.size)
offsets={6:(-34,-23),8:(-33,-18)}
for i in range(16):
    tile=bat.crop(((i%4)*512,(i//4)*512,(i%4+1)*512,(i//4+1)*512))
    dst=Image.new('RGBA',(512,512));dst.alpha_composite(tile,offsets.get(i,(0,0)))
    fixed.alpha_composite(dst,((i%4)*512,(i//4)*512))
save(fixed,'bat-flight.png')
manifest['registration']['bat']={'frames':16,'cell':[512,512],'anchor':[330,292],'corrections':offsets,
    'cause':'Original eye finder selected an ear highlight in frames 6 and 8; align their true near eye.'}
for p in sorted(SRC.glob('*.png')):
    manifest['sources'][p.name]={'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
data={'version':'0.19.0','plant':{k:manifest['registration']['plant'][k] for k in ['frames','cell','anchor','scale','jaws']}}
(OUT/'animation-data.js').write_text('window.GRIM_ENCOUNTER_DATA='+json.dumps(data,separators=(',',':'))+';\n')
print('Registered sixteen rooted bite poses, twelve integrated wing poses and corrected bat frames 6/8.')
