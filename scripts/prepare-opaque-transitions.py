"""Bake registered opaque actor transitions from accepted paintings.

The contour moves between registered drawings. Interior alpha stays solid.
Uses the same offline optical-flow and distance-field approach as prepare-reaper-run.py.
"""
from pathlib import Path
import argparse

import cv2
import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt

ASSETS = Path(__file__).resolve().parents[1] / 'assets'
OUT = ASSETS / 'combat/v01912'
OUT.mkdir(exist_ok=True)
cv2.setNumThreads(1)
cv2.setRNGSeed(0)


def load(path):
    return np.array(Image.open(path).convert('RGBA'),dtype=np.float32)/255


def register(image, size, anchor, origin, scale, angle=0):
    c,s = np.cos(angle)*scale,np.sin(angle)*scale
    transform = np.float32([[c,-s],[s,c]])
    matrix = np.column_stack((transform,np.array(anchor)-transform@origin))
    rgba = np.dstack((image[:,:,:3]*image[:,:,3:4],image[:,:,3]))
    shaped = cv2.warpAffine(rgba,matrix,size,flags=cv2.INTER_LINEAR)
    shaped[:,:,:3] /= np.maximum(shaped[:,:,3:4],1/255)
    return shaped


def remap(image, coords):
    return cv2.remap(image,coords[:,:,0],coords[:,:,1],cv2.INTER_LINEAR)


def signed_distance(alpha):
    inside=alpha>.5
    return (distance_transform_edt(inside)-distance_transform_edt(~inside)).astype(np.float32)


def light(image):
    gray=cv2.cvtColor(image[:,:,:3],cv2.COLOR_RGB2GRAY)
    return np.uint8((gray*.45+.55)*image[:,:,3]*255)


def between(first, last, fractions, lock_paint=False):
    engine=cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    engine.setFinestScale(0)
    a,b=light(first),light(last)
    forward=cv2.GaussianBlur(engine.calc(a,b,None),(0,0),.85)
    backward=cv2.GaussianBlur(engine.calc(b,a,None),(0,0),.85)
    y,x=np.mgrid[:a.shape[0],:a.shape[1]].astype(np.float32)
    grid=np.dstack((x,y))
    def pull(flow, amount):
        coords=grid.copy()
        for _ in range(5):
            coords=grid-amount*remap(flow,coords)
        return coords

    sdf_a,sdf_b=signed_distance(first[:,:,3]),signed_distance(last[:,:,3])
    pma=first[:,:,:3]*first[:,:,3:4]
    pmb=last[:,:,:3]*last[:,:,3:4]
    for t in fractions:
        pa,pb=pull(forward,t),pull(backward,1-t)
        ca,cb=remap(first[:,:,3],pa),remap(last[:,:,3],pb)
        coverage=ca*(1-t)+cb*t
        rgb=(remap(pma,pa)*(1-t)+remap(pmb,pb)*t)/np.maximum(coverage[:,:,None],.0001)
        if lock_paint:
            # The two hurt drawings disagree on where the edge and fingers
            # belong. Choose a single source wherever that paint can cover.
            preferred,coords=(first,pa) if t<.5 else (last,pb)
            color=remap(preferred,coords)
            keep=color[:,:,3]>.44
            rgb[keep]=color[keep,:3]
        boundary=remap(sdf_a,pa)*(1-t)+remap(sdf_b,pb)*t
        alpha=np.clip(boundary+.5,0,1)
        alpha[coverage<.02]=0
        rgba=np.uint8(np.clip(np.dstack((rgb,alpha))*255+.5,0,255))
        rgba[rgba[:,:,3]<8]=0
        yield Image.fromarray(rgba)


def tile(sheet,index,columns,size):
    row,col=divmod(index,columns)
    w,h=size
    return sheet[row*h:(row+1)*h,col*w:(col+1)*w]


def write(filename,frames,columns):
    width,height=frames[0].size
    sheet=Image.new('RGBA',(width*columns,height*((len(frames)+columns-1)//columns)))
    for index,image in enumerate(frames):
        blank=image.getbbox()
        assert blank and blank[0]>0 and blank[1]>0 and blank[2]<width and blank[3]<height,(filename,index,blank)
        sheet.paste(image,(index%columns*width,index//columns*height))
    sheet.save(OUT/filename,quality=92,alpha_quality=100,method=6)


def caverns():
    size,anchor=(192,128),(126,65)
    flight=load(ASSETS/'bat/v0192/bat-flight.png')
    dive=load(ASSETS/'enemies/illustrated-v2/bat/bat_dive_v1.png')
    # Both published sources already register to the enemy's world origin.
    end=register(dive,size,anchor,(1500,720),52/766,.1)
    frames=[]
    for index in range(0,96,8):
        part=tile(flight,index,8,(256,256))
        start=register(part,size,anchor,(178,128),.32/.72)
        frames.extend(between(start,end,(.25,.5,.75)))
    write('cavern-bat-handoff.webp',frames,6)


def reaper():
    size,anchor=(224,168),(112,157)
    originals=load(ASSETS/'combat/v0170/reaper-hurt-death.png')
    poses=[register(tile(originals,i,4,(512,512)),size,anchor,(280,456),.45) for i in range(12)]
    frames=[]
    # Hurt and death are separate action ranges. Never bridge between them.
    for i in (0,1,2,4,5,6,7,8,9,10):
        # These widely separated keys move the weapon across the entire
        # silhouette. Keep the actual single weapon painting on either side.
        if i in (1,8):
            for pose in poses[i:i+2]:
                pixels=np.uint8(pose*255+.5)
                alpha=pixels[:,:,3]
                alpha[alpha>=250]=255
                frames.append(Image.fromarray(pixels))
            continue
        for image in between(poses[i],poses[i+1],(1/3,2/3),lock_paint=True):
            pixels=np.array(image)
            _,labels,stats,_=cv2.connectedComponentsWithStats(np.uint8(pixels[:,:,3]>40))
            main=1+np.argmax(stats[1:,cv2.CC_STAT_AREA])
            bottom=np.nonzero(labels==main)[0].max()
            tiny=np.flatnonzero(stats[1:,cv2.CC_STAT_AREA]<16)+1
            pixels[np.isin(labels,tiny)]=0
            result=Image.new('RGBA',size)
            result.paste(Image.fromarray(pixels),(0,157-bottom))
            result.paste((0,0,0,0),(0,158,size[0],size[1]))
            frames.append(result)
    write('reaper-hurt-death-handoff.webp',frames,5)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('actor',choices=('bat','reaper'))
    args=parser.parse_args()
    (caverns if args.actor=='bat' else reaper)()
