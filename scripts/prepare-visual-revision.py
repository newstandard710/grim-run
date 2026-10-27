"""Build registered v0.15.1 production atlases; keep every generated source intact."""
from pathlib import Path
from PIL import Image
from scipy import ndimage
import numpy as np
import json,hashlib,os

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'assets/powers/source/revision-v2'
OUT=ROOT/'assets/powers/revision-v2';OUT.mkdir(exist_ok=True)
def save(im,path):
    temp=path.with_name(path.name+'.tmp');im.save(temp,format='PNG',optimize=True);os.replace(temp,path)

def components(name,count,rows,cols):
    im=Image.open(SOURCE/name).convert('RGBA');pixels=np.array(im)
    labels,n=ndimage.label(pixels[:,:,3]>90);sizes=np.bincount(labels.ravel());sizes[0]=0
    biggest=np.argsort(sizes)[-count:];items=[]
    for label in biggest:
        if sizes[label]<1000:raise ValueError((name,'Insufficient components'))
        m=labels==label;y,x=np.where(m)
        rect=(max(0,int(x.min())-4),max(0,int(y.min())-4),min(im.width,int(x.max())+5),min(im.height,int(y.max())+5))
        data=pixels.copy();data[:,:,3]=np.where(ndimage.binary_dilation(m,iterations=3),data[:,:,3],0)
        cy=(y.min()+y.max())/2;cx=(x.min()+x.max())/2
        row=min(rows-1,int(cy/im.height*rows));items.append((row,cx,Image.fromarray(data).crop(rect),rect))
    items.sort(key=lambda v:(v[0],v[1]))
    return [(v[2],v[3]) for v in items]

hand_points={
 'reach.png':[(291,304),(683,271),(1073,252),(1477,211),(357,692),(711,664),(1128,661),(1506,664)],
 'lift.png':[(333,205),(709,181),(1062,158),(1445,145),(301,621),(672,613),(1051,605),(1393,561)],
 'lower.png':[(285,49),(672,66),(1057,112),(1452,141),(357,694),(689,716),(1061,718),(1440,717)]}
relic=Image.new('RGBA',(2048,3072));hands=[];registrations=[]
for file in ['reach.png','lift.png','lower.png']:
    for n,(im,rect) in enumerate(components(file,8,2,4)):
        a=np.array(im);alpha=a[:,:,3]>180
        cyan=alpha&(a[:,:,1]>115)&(a[:,:,2]>125)&(a[:,:,0]<a[:,:,1]*.75)
        yy,xx=np.where(cyan)
        if not len(xx):raise ValueError((file,n,'Missing cyan eye'))
        eye=(float(np.median(xx)),float(np.median(yy)))
        rows=np.where(alpha.any(axis=1))[0];foot_y=float(rows[-1]);low=alpha[max(0,int(foot_y)-5):int(foot_y)+1,:]
        foot_x=float(np.where(low)[1].mean())
        factor=285/(foot_y-eye[1])
        xy=(320-foot_x*factor,570-foot_y*factor)
        tile=Image.new('RGBA',(640,640))
        resized=im.resize((round(im.width*factor),round(im.height*factor)),Image.Resampling.LANCZOS)
        tile.alpha_composite(resized,(round(xy[0]),round(xy[1])))
        tile=tile.resize((512,512),Image.Resampling.LANCZOS)
        index=len(hands);relic.alpha_composite(tile,((index%4)*512,(index//4)*512))
        hx,hy=hand_points[file][n]
        hands.append([round((xy[0]+(hx-rect[0])*factor)*.8,2),round((xy[1]+(hy-rect[1])*factor)*.8,2)])
        registrations.append({'source':file,'frame':n,'eye':[round(eye[0],2),round(eye[1],2)],'factor':round(factor,5)})
save(relic,OUT/'relic-motion.png')

bones=Image.new('RGBA',(512,384))
for i,(im,_) in enumerate(components('bones.png',12,3,4)):
    im.thumbnail((105,105),Image.Resampling.LANCZOS)
    bones.alpha_composite(im,((i%4)*128+(128-im.width)//2,(i//4)*128+(128-im.height)//2))
save(bones,OUT/'bone-fragments.png')
cloak=Image.new('RGBA',(384,128))
for i,(im,_) in enumerate(components('cloak.png',3,1,3)):
    im.thumbnail((120,104),Image.Resampling.LANCZOS)
    cloak.alpha_composite(im,(i*128+(128-im.width)//2,(128-im.height)//2))
save(cloak,OUT/'cloak-roots.png')

# Preserve jaw and root proportions. Adjust only the connecting stem slice,
# which matches the existing rising/retracting collision-height cycle.
plants=components('plant.png',8,2,4);atlas=Image.new('RGBA',(1024,640))
heights=[46,51,62,73,78,73,62,51];scale=.32
factor=190/max(item[0].width for item in plants)
plants=[(im.resize((round(im.width*factor),round(im.height*factor)),Image.Resampling.LANCZOS),rect) for im,rect in plants]
def root_x(im):
    a=np.array(im)[:,:,3]>100;last=np.where(a.any(axis=1))[0][-1]
    return float(np.where(a[max(0,last-5):last+1])[1].mean())
base_h=42;base_source=plants[3][0];base_root=root_x(base_source)
base=base_source.crop((0,base_source.height-base_h,base_source.width,base_source.height))
base_pixels=np.array(base)
for y in range(8):
    for x in range(base.width):
        if abs(x-base_root)>12:base_pixels[y,x,3]=round(int(base_pixels[y,x,3])*y/8)
base=Image.fromarray(base_pixels)
# Jaw boundaries were inspected on the source sheet; they deliberately vary
# with the open/closed mouth. Only a narrow stem section is extended.
head_fractions=[.72,.58,.64,.68,.50,.58,.74,.84]
template=base_source.crop((max(0,round(base_root)-29),round(base_source.height*.68),min(base_source.width,round(base_root)+29),base_source.height-base_h))
for i,(im,_) in enumerate(plants):
    root=root_x(im);head_h=round(im.height*head_fractions[i])
    head=im.crop((0,0,im.width,head_h))
    hp=np.array(head)
    for y in range(max(0,head.height-4),head.height):
        for x in range(head.width):
            if abs(x-root)>23:hp[y,x,3]=round(int(hp[y,x,3])*(head.height-1-y)/4)
    head=Image.fromarray(hp)
    middle=im.crop((max(0,round(root)-29),head_h,min(im.width,round(root)+29),max(head_h+1,im.height-base_h)))
    if middle.height<3 or np.array(middle)[:,:,3].sum()<300:middle=template
    target_h=round(heights[i]/scale);stem_h=max(1,target_h-head_h-base_h)
    tile=Image.new('RGBA',(256,320));x=round(128-root);y=300-target_h
    tile.alpha_composite(middle.resize((middle.width,stem_h),Image.Resampling.LANCZOS),(128-middle.width//2,y+head_h-2))
    tile.alpha_composite(head,(x,y))
    tile.alpha_composite(base,(round(128-base_root),300-base_h))
    atlas.alpha_composite(tile,((i%4)*256,(i//4)*320))
save(atlas,OUT/'snapping-plant.png')

for biome in ['foothills','tundra','caves','crystals','ashlands','lava']:
    p=SOURCE/('support-'+biome+'.png')
    if not p.exists():continue
    im,_=components(p.name,1,1,1)[0]
    im.thumbnail((480,360),Image.Resampling.LANCZOS)
    tile=Image.new('RGBA',(512,384));tile.alpha_composite(im,(16,384-im.height-12))
    target=ROOT/'assets/obstacles/air-bramble-support-v2'/biome
    target.mkdir(parents=True,exist_ok=True);save(tile,target/(biome+'-curved-support.png'))

metadata={'version':'0.15.1','relicHands':hands,'relicRegistrations':registrations,
          'relicAnchor':[256,456],'plantHeights':heights,'plantScale':scale}
(ROOT/'assets/visuals/revision-art.js').write_text('/* Generated by scripts/prepare-visual-revision.py */\n(function(s){s.GRIM_REVISION_ART='+json.dumps(metadata,separators=(',',':'))+';})(typeof window!=="undefined"?window:globalThis);\n')
manifest={'version':'0.15.1','sources':{},'runtime':{}}
for p in sorted(SOURCE.glob('*.png')):
    manifest['sources'][p.name]={'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
for p in sorted(list(OUT.glob('*.png'))+list((ROOT/'assets/obstacles/air-bramble-support-v2').rglob('*.png'))):
    manifest['runtime'][str(p.relative_to(ROOT))]={'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'size':list(Image.open(p).size)}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Built 24 acquisition poses, 12 bone fragments, 3 cloak roots and 8 carnivorous-plant poses.')
