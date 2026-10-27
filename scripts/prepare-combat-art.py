"""Register authored v0.17 animation drawings; preserve generated source bytes."""
from pathlib import Path
from PIL import Image, ImageDraw
from scipy import ndimage
import numpy as np
import hashlib, json

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/combat/v0170'
SRC=OUT/'source'
manifest={'version':'0.17.0','sources':{},'runtime':{},'registration':{}}
for p in SRC.glob('*.png'):
    manifest['sources'][p.name]={'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}

def components(name):
    im=Image.open(SRC/(name+'.png')).convert('RGBA'); a=np.array(im)
    lab,n=ndimage.label(a[:,:,3]>32)
    entries=[]
    for k,sl in enumerate(ndimage.find_objects(lab),1):
        if sl and (lab[sl]==k).sum()>15000:
            entries.append((k,(sl[1].start,sl[0].start,sl[1].stop,sl[0].stop)))
    return im,a,lab,entries

def select(name, rows, excluded=()):
    im,a,lab,entries=components(name); result=[]
    for lo,hi in rows:
        group=sorted([(k,b) for k,b in entries if lo<=(b[1]+b[3])/2<hi],key=lambda t:t[1][0])
        for k,b in group:
            if b in excluded:continue
            mask=ndimage.binary_dilation(lab==k,iterations=3)
            p=a.copy();p[:,:,3]=np.where(mask,p[:,:,3],0)
            box=(max(0,b[0]-3),max(0,b[1]-3),min(im.width,b[2]+3),min(im.height,b[3]+3))
            result.append((Image.fromarray(p).crop(box),box))
    return result

def eye(im,kind):
    a=np.asarray(im).astype(float);r,g,b,alpha=[a[:,:,i] for i in range(4)]
    if kind=='cyan':m=(g>150)&(b>135)&(r<g*.72)&(alpha>120)
    elif kind=='pink':m=(r>225)&(b>180)&(g>75)&(g<210)&(alpha>120)
    else:m=(r>230)&(g>75)&(g<180)&(b<130)&(alpha>120)
    labels,n=ndimage.label(m)
    groups=[(k,s) for k,s in enumerate(ndimage.find_objects(labels),1) if s and (labels[s]==k).sum()>2]
    if groups:
        k,sl=min(groups,key=lambda v:v[1][1].start)
        m=labels==k
    y,x=np.where(m)
    return (float(np.median(x)),float(np.median(y))) if len(x)>2 else (im.width*.66,im.height*.36)

def atlas(name,frames,kind,factors,anchor=(280,456),eye_anchor=None):
    canvas=Image.new('RGBA',(2048,512*((len(frames)+3)//4)))
    registrations=[]
    for i,(im,box) in enumerate(frames):
        factor=factors[i] if isinstance(factors,list) else factors
        ex,ey=eye(im,kind)
        if eye_anchor is not None:
            ax,ay=ex,ey;tx,ty=eye_anchor
        else:
            # Place the virtual collision foot behind the face; do not center
            # each frame by the changing weapon/wing outline.
            ax,ay=(im.width*.5 if name in ['crawler-response','imp-response'] else ex-26),im.height-3;tx,ty=anchor
        w,h=round(im.width*factor),round(im.height*factor)
        xy=(round(tx-ax*factor),round(ty-ay*factor))
        assert min(xy)>=0 and xy[0]+w<=512 and xy[1]+h<=512,(name,i,xy,(w,h))
        tile=Image.new('RGBA',(512,512));tile.alpha_composite(im.resize((w,h),Image.Resampling.LANCZOS),xy)
        canvas.alpha_composite(tile,((i%4)*512,(i//4)*512))
        registrations.append({'sourceBox':list(map(int,box)),'sourceEye':[round(ex,2),round(ey,2)],'factor':factor,'position':xy})
    target=OUT/(name+'.png');temp=target.with_suffix('.tmp')
    canvas.save(temp,format='PNG',optimize=True)
    Image.open(temp).load()
    temp.replace(target)
    manifest['registration'][name]={'frames':len(frames),'cell':[512,512],'anchor':list(eye_anchor or anchor),'poses':registrations}
    return canvas

# Two central slide drawings and two air-bow drawings overlap in the generated
# originals. Exclude those drawings instead of publishing clipped silhouettes.
slide=select('reaper-slide-cut',[(0,420),(420,710),(710,1086)],excluded=((721,498,1441,684),))
atlas('reaper-slide-cut',slide,'cyan',1.02)
soul=select('reaper-soul-cleave',[(0,280),(280,548),(548,766),(766,1024)])
atlas('reaper-soul-cleave',soul,'cyan',.84)
hurt=select('reaper-hurt-death',[(0,380),(380,720),(720,1024)])
atlas('reaper-hurt-death',hurt,'cyan',.96)
bow=select('reaper-crossbow',[(0,300),(300,580),(580,800),(800,1024)])
atlas('reaper-crossbow',bow,'cyan',[1.02]*8+[.94]*8)
air=select('reaper-air-crossbow',[(0,530),(530,1024)],excluded=((396,562,1161,895),))
atlas('reaper-air-crossbow',air,'cyan',.92)
bat=select('bat-flight',[(0,280),(280,520),(520,765),(765,1024)])
atlas('bat-flight',bat,'pink',.70,eye_anchor=(330,292))
for name,kind,factor in [('bat-response','pink',.51),('skeletal-response','amber',.60),('crawler-response','amber',.72),('imp-response','amber',.67)]:
    if name=='skeletal-response':
        # Keep disconnected authored bones in the last three cells.
        src=Image.open(SRC/(name+'.png')).convert('RGBA'); frames=select(name,[(0,500)])
        for row in [1]:
            for col in range(4):
                box=(round(col*src.width/4),0 if row==0 else 500,round((col+1)*src.width/4),500 if row==0 else src.height)
                cell=src.crop(box);bb=cell.getchannel('A').point(lambda v:255 if v>32 else 0).getbbox()
                cell=cell.crop(bb);frames.append((cell,(box[0]+bb[0],box[1]+bb[1],box[0]+bb[2],box[1]+bb[3])))
    elif name=='imp-response':
        src=Image.open(SRC/(name+'.png')).convert('RGBA');frames=[]
        for row in range(2):
            for col in range(4):
                box=(col*384,row*512,(col+1)*384,(row+1)*512);cell=src.crop(box)
                bb=cell.getchannel('A').point(lambda v:255 if v>32 else 0).getbbox();frames.append((cell.crop(bb),(box[0]+bb[0],box[1]+bb[1],box[0]+bb[2],box[1]+bb[3])))
    else:frames=select(name,[(0,510),(510,1000)])
    # Ground creatures keep a foot baseline; bats keep the skull registered.
    atlas(name,frames,kind,factor,eye_anchor=(310,270) if 'bat' in name or 'skeletal' in name else None)

src=Image.open(SRC/'combat-effects.png').convert('RGBA');canvas=Image.new('RGBA',(1024,1536))
ys=[0,215,410,552,740,896,1086]
for i in range(24):
    r,c=divmod(i,4);box=(round(c*src.width/4),ys[r],round((c+1)*src.width/4),ys[r+1]);im=src.crop(box)
    bb=im.getchannel('A').point(lambda v:255 if v>20 else 0).getbbox()
    if bb:im=im.crop(bb)
    im.thumbnail((232,232),Image.Resampling.LANCZOS)
    canvas.alpha_composite(im,(c*256+(256-im.width)//2,r*256+(256-im.height)//2))
canvas.save(OUT/'combat-effects.png',optimize=True)
manifest['registration']['combat-effects']={'frames':24,'cell':[256,256],'anchor':[128,128]}
for p in sorted(OUT.glob('*.png')):
    Image.open(p).load()
    manifest['runtime'][p.name]={'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'size':list(Image.open(p).size)}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
data={'version':'0.17.0','sheets':{n:{'frames':m['frames'],'cell':m['cell'],'anchor':m['anchor']} for n,m in manifest['registration'].items()}}
(OUT/'animation-data.js').write_text('window.GRIM_COMBAT_DATA='+json.dumps(data,separators=(',',':'))+';\n')
print('Registered:',{n:m['frames'] for n,m in manifest['registration'].items()})
