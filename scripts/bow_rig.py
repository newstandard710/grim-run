"""Bake the summit retrieval from a single painted body and articulated arms.

The hood, skull, scythe, cloth and body are one coherent painted layer. Arm
segments use separate matching painted components, with two-link IK and registered
closed fists. No full-character crossfade or optical-flow estimate is involved.
"""
import numpy as np
import cv2
from PIL import Image
from scipy.interpolate import LinearNDInterpolator, CubicHermiteSpline

CELL=224
ANCHOR=np.array([136.,214.])

def smooth(t):
    t=np.clip(t,0,1)
    return t*t*t*(10+t*(-15+6*t))

def opaque(a):
    a=a.copy()
    a[a[:,:,3]<8]=0
    inside=a[:,:,3]>40
    distance=cv2.distanceTransform(inside.astype('uint8'),cv2.DIST_L2,5)
    a[:,:,3][distance>1.5]=255
    a[a[:,:,3]==0]=0
    return a

def prepare_body(path):
    a=opaque(np.array(Image.open(path).convert('RGBA')))
    mask=(a[:,:,1]>140)&(a[:,:,2]>120)&(a[:,:,0]<140)&(a[:,:,3]>140)
    n,labels,stats,centers=cv2.connectedComponentsWithStats(mask.astype('uint8'))
    eye=centers[1+np.argmax(stats[1:,4])]
    foot=np.where(a[:,:,3]>80)[0].max()
    scale=114/(foot-eye[1])
    M=np.array([[scale,0,150-eye[0]*scale],[0,scale,100-eye[1]*scale]],dtype='float32')
    return cv2.warpAffine(a,M,(CELL,CELL),flags=cv2.INTER_AREA)

def body_point(points,bend):
    p=np.asarray(points,dtype=float)
    dx,dy=p[...,0]-141,p[...,1]-161
    angle=.85*bend
    return np.stack([141+dx*np.cos(angle)-dy*np.sin(angle)-4*bend,
                     161+dx*np.sin(angle)+dy*np.cos(angle)+13*bend],axis=-1)

def body_warp(body,bend):
    yy,xx=np.mgrid[:CELL,:CELL]
    upper_mask=((yy<124)|((xx>112)&(yy<169)))
    upper=body.copy();upper[~upper_mask]=0
    lower=body.copy();lower[(yy<124)|((xx>118)&(yy<154))]=0
    angle=.85*bend;c,s=np.cos(angle),np.sin(angle)
    M=np.array([[c,-s,141-141*c+161*s-4*bend],
                [s,c,161-141*s-161*c+13*bend]],dtype='float32')
    top=cv2.warpAffine(upper,M,(CELL,CELL),flags=cv2.INTER_LINEAR)
    cloak_mask=np.zeros((CELL,CELL),'uint8')
    cv2.fillPoly(cloak_mask,[np.array([[44,124],[112,124],[125,141],[133,159],[115,174],[104,182],[98,198],[73,202],[52,187],[44,164]],dtype='int32')],255)
    cloak=lower.copy();cloak[cloak_mask==0]=0
    legs=lower.copy();legs[cloak_mask>0]=0
    gy,gx=np.mgrid[0:225:8,0:225:8]
    points=np.stack([gx.ravel(),gy.ravel()],axis=-1).astype(float)
    x,y=points[:,0],points[:,1]
    attachment=body_point([119,125],bend)-[119,125]
    weight=smooth((x-45)/80)*(1-smooth((y-130)/75))
    cloak_dest=points+weight[:,None]*attachment
    knee=np.sin(np.pi*np.clip((y-162)/52,0,1))
    legs_dest=points+np.stack([6*np.tanh((x-141)/10)*bend*knee,13*bend*(1-smooth((y-162)/52))],axis=-1)
    grid=np.stack([xx,yy],axis=-1)
    out=Image.new('RGBA',(CELL,CELL))
    for image,dest in [(cloak,cloak_dest),(legs,legs_dest)]:
        coords=LinearNDInterpolator(dest,points,fill_value=-100)(grid).astype('float32')
        view=cv2.remap(image,coords[:,:,0],coords[:,:,1],cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
        out.alpha_composite(Image.fromarray(view))
    out.alpha_composite(Image.fromarray(top))
    return np.array(out)

def cut(image,points):
    mask=np.zeros((CELL,CELL),'uint8')
    cv2.fillPoly(mask,[np.array(points,dtype='int32')],255)
    a=image.copy();a[mask==0]=0
    return a

def warp(part,a,b,c,d):
    a,b,c,d=[np.array(v,dtype='float32') for v in [a,b,c,d]]
    va=b-a;vb=d-c
    na=np.array([-va[1],va[0]])/np.linalg.norm(va)*8
    nb=np.array([-vb[1],vb[0]])/np.linalg.norm(vb)*8
    M=cv2.getAffineTransform(np.array([a,b,a+na]),np.array([c,d,c+nb]))
    return Image.fromarray(cv2.warpAffine(part,M,(CELL,CELL),flags=cv2.INTER_LINEAR))

def ik(shoulder,hand,lengths,side):
    delta=hand-shoulder
    distance=np.clip(np.linalg.norm(delta),.1,sum(lengths)-.001)
    unit=delta/max(.1,np.linalg.norm(delta))
    a=(lengths[0]**2-lengths[1]**2+distance**2)/(2*distance)
    h=np.sqrt(max(0,lengths[0]**2-a*a))
    return shoulder+unit*a+np.array([unit[1],-unit[0]])*h*side

T=np.array([0,.4,.7,.86,1])
PATH=np.array([[179,194],[180,150],[187,122],[155,70],[128,62]],dtype=float)
TANGENTS=np.zeros_like(PATH)
for i in range(1,len(T)-1):TANGENTS[i]=(PATH[i+1]-PATH[i-1])/(T[i+1]-T[i-1])
WRIST=CubicHermiteSpline(T,PATH,TANGENTS)

def pose(frame):
    if frame<=72:
        q=np.clip(frame/72,0,1)
        bend=q
        near=np.array([125.,174.])*(1-q)+np.array([179.,194.])*q
        far=np.array([160.,171.])*(1-q)+np.array([193.,194.])*q
        shoulder_up=0
    else:
        q=(frame-72)/96
        bend=1-smooth(q/.65)
        near=WRIST(q);far=near+[16,0]
        shoulder_up=9*smooth((q-.4)/.6)
    shoulders=body_point(np.array([[125,127],[154,128]]),bend)
    shoulders[:,1]-=shoulder_up
    if frame>72:
        q=(frame-72)/96
        delta=near-shoulders[0];distance=np.linalg.norm(delta)
        if distance>61.999 or .67<=q<=.73:
            near=shoulders[0]+delta/distance*61.999
        far=near+[16,0]
    return bend,near,far,shoulders

def build(body_path,raised):
    body=prepare_body(body_path)
    raw=opaque(np.array(Image.open(body_path.parent/'reaper-rig-arms.png').convert('RGBA')))
    def arm(side):
        a=raw.copy()
        if side=='near':
            a[:,640:]=0;origin=np.array([400.,360.]);elbow=[402,660];hand=[451,1045]
        else:
            a[:,:640]=0;origin=np.array([900.,400.]);elbow=[906,711];hand=[905,1050]
        scale=np.array([.04,.07]);anchor=np.array([120.,90.])
        M=np.array([[scale[0],0,anchor[0]-origin[0]*scale[0]],[0,scale[1],anchor[1]-origin[1]*scale[1]]],dtype='float32')
        tile=cv2.warpAffine(a,M,(CELL,CELL),flags=cv2.INTER_AREA)
        elbow=(np.array(elbow)-origin)*scale+anchor;hand=(np.array(hand)-origin)*scale+anchor
        upper=tile.copy();upper[int(elbow[1]+5):]=0;upper[:86]=0
        fore=tile.copy();fore[:int(elbow[1]-4)]=0;fore[int(hand[1]-6):]=0
        fist=tile.copy();fist[:int(hand[1]-8)]=0
        return upper,fore,fist,anchor,elbow,hand
    near_parts,far_parts=arm('near'),arm('far')
    yy,xx=np.mgrid[:CELL,:CELL]
    cap=body.copy();cap[((xx-125)/12)**2+((yy-124)/12)**2>1]=0
    frames=[];hands=[];landmarks=[]
    for i in range(169):
        bend,near,far,shoulders=pose(i)
        elbows=[ik(shoulders[0],near,[32,30],-1 if i<=72+96*.7 else 1),ik(shoulders[1],far,[30,29],1)]
        canvas=Image.new('RGBA',(CELL,CELL))
        # Rear sleeve, coherent body, near sleeve, armor cap, then forearms.
        for parts,j in [(far_parts,1)]:
            canvas.alpha_composite(warp(parts[0],parts[3],parts[4],shoulders[j],elbows[j]))
        canvas.alpha_composite(Image.fromarray(body_warp(body,bend)))
        canvas.alpha_composite(warp(near_parts[0],near_parts[3],near_parts[4],shoulders[0],elbows[0]))
        angle=.85*bend;c,s=np.cos(angle),np.sin(angle)
        matrix=np.array([[c,-s,141-141*c+161*s-4*bend],[s,c,161-141*s-161*c+13*bend]],dtype='float32')
        canvas.alpha_composite(Image.fromarray(cv2.warpAffine(cap,matrix,(CELL,CELL),flags=cv2.INTER_LINEAR)))
        for parts,j,hand in [(far_parts,1,far),(near_parts,0,near)]:
            canvas.alpha_composite(warp(parts[1],parts[4],parts[5],elbows[j],hand))
            canvas.alpha_composite(warp(parts[2],parts[4],parts[5],elbows[j],hand))
        frames.append(canvas);hands.append([near.tolist(),far.tolist()]);landmarks.append({'shoulders':shoulders.tolist(),'elbows':[e.tolist() for e in elbows],'eye':body_point([150,100],bend).tolist(),'bend':float(bend)})
    return frames,hands,landmarks
