"""Bake touchdown drawings in world pixels from the released Reaper paintings.

The receiving foot is registered separately from the hips, hood and trailing
cloth. The two compact weapons rotate about the moving grip before their paint
is reconciled in the same orientation. Gameplay never samples these drawings.
"""
from pathlib import Path
from functools import lru_cache
import hashlib
import json
import math

import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt, map_coordinates
from scipy.spatial import Delaunay

ROOT = Path(__file__).resolve().parents[1]
MOTION = ROOT / 'assets/motion'
OUT = MOTION / 'landing'
SIZE = (284, 170)
ORIGIN = np.array([170., 146.])
Y, X = np.indices(SIZE[::-1], dtype=float) - ORIGIN[::-1, None, None]
GRID = np.stack([X, Y], axis=-1)
SCALE = 13 / 15


def read_data(path):
    return json.loads(path.read_text().split('=', 1)[1].strip().rstrip(';'))


forward = read_data(MOTION / 'v0200/animation-data.js')
run = read_data(MOTION / 'v0194/animation-data.js')


@lru_cache(maxsize=None)
def sheet(path):
    return Image.open(MOTION / path).convert('RGBA')


def sample(pixels, xy):
    coords = [xy[:, :, 1] + ORIGIN[1], xy[:, :, 0] + ORIGIN[0]]
    return np.stack([map_coordinates(c, coords, order=1, mode='constant')
                     for c in pixels.transpose(2, 0, 1)], axis=2)


def cel(path, frame, columns, size, anchor, scale):
    w, h = size
    x, y = frame % columns*w, frame//columns*h
    tile = sheet(path).crop((x, y, x+w, y+h))
    transform = (1/scale, 0, anchor[0]-ORIGIN[0]/scale,
                 0, 1/scale, anchor[1]-ORIGIN[1]/scale)
    im = tile.transform(SIZE, Image.Transform.AFFINE, transform, Image.Resampling.BICUBIC)
    a = np.asarray(im).astype('float32') / 255
    a[:, :, :3] *= a[:, :, 3:]
    return a


def carry(i):
    return cel('v0200/reaper-forward-carry.webp', i, 9, (200,184), (125,168), SCALE)


def air(i, scale=SCALE):
    return cel('v0180/reaper-air-registration.webp', i, 8, (224,184), (125,168), scale)


def slide(i):
    return cel('v01912/ground-slide.webp', i, 4, (224,144), (180,132), 1)


def smooth(t):
    t = np.clip(t, 0, 1)
    return t*t*(3-2*t)


def mix(a, b, t):
    return (1-t)*np.asarray(a) + t*np.asarray(b)


def opaque_mix(a, b, t):
    """Keep a single painted contour while two registered pieces meet."""
    if t <= 0: return a
    if t >= 1: return b
    col = mix(a, b, t)
    distances = [distance_transform_edt(im[:,:,3]>.40)-distance_transform_edt(im[:,:,3]<=.40)
                 for im in (a,b)]
    alpha = np.clip(mix(*distances,t)+.5, 0, 1) * (col[:,:,3]>.025)
    col[:,:,:3] *= alpha[:,:,None] / np.maximum(.001,col[:,:,3:])
    col[:,:,3] = alpha
    return col


def warp(im, original, target):
    border = [(-169,-145),(112,-145),(112,22),(-169,22)]
    src = np.vstack((original,border))
    dest = np.vstack((target,border))
    tri = Delaunay(dest)
    face = tri.find_simplex(GRID)
    mat = tri.transform[face]
    weights = np.einsum('...ij,...j->...i', mat[:,:,:2], GRID-mat[:,:,2])
    weights = np.concatenate([weights,1-weights.sum(axis=2,keepdims=True)],axis=2)
    xy = np.einsum('...i,...ij->...j',weights,src[tri.simplices[face]])
    return sample(im,xy)


def passage(a, b, start, end, t):
    if t <= 0:return a
    if t >= 1:return b
    mid = mix(start,end,t)
    return opaque_mix(warp(a,start,mid),warp(b,end,mid),t)


# Hood crown, eyes, shoulder, belt, working hand, free hand, both boots,
# upper pennant, cloak tip. All coordinates use the game's world scale.
MARKS = {
    'reach':[(5,-81),(12,-67),(-2,-58),(-16,-40),(-17,-58),(14,-34),(9,3),(-10,-1),(-74,-75),(-71,-28)],
    'open':[(6,-81),(13,-66),(-1,-58),(-16,-40),(-21,-56),(16,-43),(6,-8),(-16,-8),(-71,-72),(-73,-33)],
    'gather':[(8,-81),(14,-68),(0,-59),(-15,-43),(-22,-56),(17,-58),(-9,-20),(-22,-10),(-70,-76),(-71,-35)],
    'tuck':[(9,-84),(13,-67),(-12,-60),(-12,-40),(0,-52),(19,-54),(-14,-15),(-5,-19),(-60,-87),(-75,-43)],
    'legacy':[(5,-81),(12,-67),(-2,-59),(-16,-40),(-43,-53),(-30,-73),(9,3),(-10,-1),(-74,-75),(-71,-28)],
    'slide':[(-20,-64),(-10,-49),(-51,-40),(-50,-22),(-80,-35),(0,-24),(-2,-2),(-62,-3),(-110,-42),(-134,-11)]
}
MARKS = {k:np.array(v,dtype=float) for k,v in MARKS.items()}


def split_weapon(im, name):
    if name=='tuck':
        head=(X>28)&(Y<-30)
        axis=-51.4-(X-1)*.182
        wood=(X>-44)&(X<48)&(np.abs(Y-axis)<4.1)
        hands=((X+1)**2+(Y+52)**2<5**2)|((X-19)**2+(Y+54)**2<4.4**2)
    elif name=='slide':
        head=(X<-100)&(Y<-25+np.maximum(0,-113-X)*.56)
        axis=-23+(X+21)*.205
        wood=(X>-117)&(X<3)&(np.abs(Y-axis)<3.9)
        hands=((X+80)**2+(Y+35)**2<5**2)|((X+28)**2+(Y+24)**2<4.5**2)
    else:
        # Registered released jump, with its upright painted weapon.
        head=(Y<-82)&(X<-5)
        axis=-91-(X+23)*1.86
        wood=(X>-62)&(X<-14)&(np.abs(Y-axis)<8.6)
        hands=((X+43)**2+(Y+53)**2<4.7**2)|((X+31)**2+(Y+73)**2<4.2**2)
    blade=im.copy();blade[~(head|wood)]=0
    body=im.copy();body[(head|wood)&~hands]=0
    # Fill only the thin shaft over opaque cloth. The silhouette stays open.
    valid=(im[:,:,3]>.55)&~(head|wood)
    dist,idx=distance_transform_edt(~valid,return_indices=True)
    fill=wood&~head&~hands&(dist<4.7)&(im[:,:,3]>.48)
    body[fill]=im[idx[0][fill],idx[1][fill]]
    top=im.copy();top[~hands]=0
    return body,blade,top


def image(pixels):
    p=pixels.copy()
    p[:,:,:3]/=np.maximum(.001,p[:,:,3:])
    p[p[:,:,3]<.014]=0
    return Image.fromarray(np.uint8(np.clip(p,0,1)*255+.5))


def over(a,b):
    return b+a*(1-b[:,:,3:])


def turn_layer(im, pivot, angle, destination):
    c,s=np.cos(angle),np.sin(angle)
    rot=np.array([[c,-s],[s,c]])
    return sample(im,(GRID-destination)@rot+np.asarray(pivot))


def boot_samples(im,center):
    samples=[]
    for x in range(round(center)-10,round(center)+13,3):
        ys=np.nonzero(im[:,round(ORIGIN[0]+x),3]>.45)[0]
        if len(ys) and ys[-1]>ORIGIN[1]-9:
            samples.append([x,int(ys[-1]-ORIGIN[1])])
    return samples or [[round(center),0]]


def bake():
    OUT.mkdir(exist_ok=True)
    poses=[];low=[];low_soles=[];ranges={};hands=[];soles=[];unroll_targets={}
    def add_pose(im,palm,sole):
        poses.append(image(im).crop((65,40,216,154)))
        hands.append(list(np.round(palm,2)));soles.append(sole)

    sources={'gather':carry(115),'open':carry(116),'reach':carry(117)}
    tuck=air(28,SCALE*1.24)
    sources['tuck'],tuck_blade,tuck_hand=split_weapon(tuck,'tuck')
    legacy=air(21)
    sources['legacy'],_,_=split_weapon(legacy,'legacy')
    low_slide=slide(6)
    slide_body,slide_blade,slide_hand=split_weapon(low_slide,'slide')
    for kind,load,shorten in [('soft',7,10),('step',11,4),('drop',16,0)]:
        for lead in (0,48):
            key=f'{kind}{lead}'
            ranges[key]=len(poses)
            for i in range(13):
                f=lead+2*i
                u=i/12
                # Compression crests after contact. The pennants trail the
                # hips and then lift as the support leg drives the body away.
                weight=np.sin(np.pi*u)**1.18*(1.42-.84*u)
                lag=np.sin(np.pi*u)**1.55*(.54+.8*u)
                upper=smooth((-Y-3)/48)
                cloth=smooth((-X-34)/52)*smooth((-Y-6)/25)
                dy=load*weight*upper-6*lag*cloth
                dx=(2.5*weight+3*(1-smooth(u)))*upper-5*lag*cloth
                sole0=run['groundX'][f];settle=shorten*(1-smooth(u))
                toe=smooth((X-sole0+26)/21)*(1-smooth((-Y-3)/41))
                xy=np.stack([X-dx+settle*toe,Y-dy],axis=2)
                im=sample(carry(f),xy)
                hand=forward['rear']['hands'][f]+np.array([2.5*weight+3*(1-smooth(u)),load*weight])
                sole=boot_samples(im,sole0-settle)
                if i==0:
                    plant=im; plant_hand=hand; plant_sole=sole
                    marks=np.array([(10,-88),(15,-74),(-2,-64),(-14,-43),hand,(19,-58),
                                    (19-shorten,-1),(-35,-17),(-72,-68),(-79,-27)],float)
                if kind=='soft' and i==8:
                    unroll_targets[lead]=(im,hand,sole)
                add_pose(im,hand,sole)
            for src in {'soft':['gather','open'],'step':['reach','open','legacy'],
                        'drop':['reach','legacy']}[kind]:
                ranges[src+key]=len(poses)
                for j in range(7):
                    t=j/6
                    im=passage(sources[src],plant,MARKS[src],marks,t)
                    h=mix(MARKS[src][4],plant_hand,t)
                    add_pose(im,h,plant_sole)
    # Held Slide keeps its own anatomy, sword-side grip and low clearance.
    # Bring the hands in as the scythe passes above the shoulder, then extend
    # into the released sliding painting. Contact occurs at sample 7 of 16.
    for i in range(17):
        t=i/16
        body_t=smooth(min(1,t/.94))
        p0,p1=MARKS['tuck'],MARKS['slide']
        mid=mix(p0,p1,body_t)
        # Feet make contact first; the head sinks later and less.
        mid[6:8]=mix(p0[6:8],p1[6:8],smooth(min(1,t/(7/16))))
        mid[:5,1]+=2.5*np.sin(np.pi*t)**2
        mid[8:,1]-=4*np.sin(np.pi*t)**2
        body=opaque_mix(warp(sources['tuck'],p0,mid),warp(slide_body,p1,mid),body_t)
        grip=mix(p0[4],p1[4],body_t)
        angle0,angle1=np.radians([-10,-168])
        turn=smooth(t)
        a=(1-turn)*angle0+turn*angle1
        first=turn_layer(tuck_blade,p0[4],a-angle0,grip)
        last=turn_layer(slide_blade,p1[4],a-angle1,grip)
        steel=opaque_mix(first,last,smooth((t-.20)/.63))
        glove=opaque_mix(warp(tuck_hand,p0,mid),warp(slide_hand,p1,mid),body_t)
        final=over(over(body,steel),glove)
        if i==0:final=tuck
        if i==16:final=low_slide
        low.append(image(final))
        low_soles.append(boot_samples(body,mid[6,0]))
        if i==7:
            opening=over(body,glove)
            opening_marks=mid.copy()
            opening_angle=a+np.radians(64)
            opening_steel=turn_layer(steel,grip,-opening_angle,(0,0))
    for lead,(end,end_hand,sole) in unroll_targets.items():
        ranges['rise'+str(lead)]=len(poses)
        end_marks=np.array([(9,-78),(14,-66),(-3,-54),(-14,-32),end_hand,(18,-48),
                            (-14,-1),(-19,-16),(-74,-62),(-79,-23)],float)
        for j in range(9):
            t=j/8
            im=passage(opening,end,opening_marks,end_marks,smooth(t))
            hand=mix(opening_marks[4],end_hand,smooth(t))
            supported=boot_samples(im,mix(opening_marks[6,0],-14,t))
            add_pose(im,hand,supported)
    steel_spec=forward['weapon']
    native=cel('v0200/reaper-forward-scythe.webp',0,1,(337,361),steel_spec['anchor'],steel_spec['scale'])
    canonical=sample(native,np.stack([-X,Y],axis=2))
    steels=[image(opaque_mix(opening_steel,canonical,smooth(j/8))).crop((72,42,247,173))
            for j in range(9)]
    def save(name,images,cols):
        w,h=images[0].size
        atlas=Image.new('RGBA',(cols*w,math.ceil(len(images)/cols)*h))
        for i,im in enumerate(images):atlas.paste(im,(i%cols*w,i//cols*h))
        path=OUT/(name+'.webp')
        atlas.save(path,quality=92,alpha_quality=100,method=5)
        v=hashlib.sha256(path.read_bytes()).hexdigest()[:12]
        return dict(key=name,url=f'assets/motion/landing/{name}.webp?v={v}',width=w,height=h,
                    columns=cols,frames=len(images))
    data=dict(body=save('reaper-landing',poses,12),low=save('reaper-tuck-landing',low,5),
              steel=save('reaper-landing-steel',steels,3),compactAngle=round(opening_angle,6),
              ranges=ranges,hands=hands,soles=soles,lowSoles=low_soles)
    (OUT/'poses.js').write_text('window.GRIM_LANDING_POSES='+json.dumps(data,separators=(',',':'))+';\n')


if __name__=='__main__':
    bake()
