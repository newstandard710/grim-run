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

# All landmarks below are measured in the original 1254px arm painting.
# Joint pivots sit in cloth folds, not through the forearm armor plates.
ARM_LENGTHS=(25.0,30.0)
ARM_SPECS={
    'near':{'shoulder':[400,250],'elbow':[400,540],'hand':[442,1060],'sleeveTop':350},
    'far':{'shoulder':[900,280],'elbow':[906,585],'hand':[902,1060],'sleeveTop':370},
}
STOCK_SPAN=np.array([272.,28.])*(370*.19/512)
SUPERSAMPLE=4

class PaintedPart:
    def __init__(self,rgba):
        alpha=rgba[:,:,3]
        ys,xs=np.where(alpha>8)
        self.origin=np.array([xs.min(),ys.min()],dtype=float)
        self.size=np.array([xs.max()-xs.min()+1,ys.max()-ys.min()+1],dtype=float)
        x,y=self.origin.astype(int);w,h=self.size.astype(int)
        image=rgba[y:y+h,x:x+w].astype(np.float32)/255
        image[:,:,:3]*=image[:,:,3:4]
        self.image=image

    def draw(self,pivot,target,angle,scale):
        # Uniform native-resolution scaling and rotation preserve the painted
        # silhouette. Downsample premultiplied RGBA only after rasterization.
        c,s=np.cos(angle),np.sin(angle)
        A=scale*np.array([[c,-s],[s,c]])
        pivot=np.array(pivot,dtype=float);target=np.array(target,dtype=float)
        offset=target+A@(self.origin-pivot)
        corners=np.array([[0,0],[self.size[0],0],self.size,[0,self.size[1]]])@A.T+offset
        lo=np.maximum(0,np.floor(corners.min(axis=0)-2)).astype(int)
        hi=np.minimum(CELL,np.ceil(corners.max(axis=0)+2)).astype(int)
        w,h=hi-lo
        out=Image.new('RGBA',(CELL,CELL))
        if w<=0 or h<=0:return out
        M=np.column_stack([A,offset-lo])*SUPERSAMPLE
        high=cv2.warpAffine(self.image,M.astype('float32'),(w*SUPERSAMPLE,h*SUPERSAMPLE),flags=cv2.INTER_LINEAR)
        low=cv2.resize(high,(w,h),interpolation=cv2.INTER_AREA)
        color=low[:,:,:3]/np.maximum(low[:,:,3:4],1e-7)
        rgba=np.uint8(np.clip(np.dstack([color,low[:,:,3]])*255+.5,0,255))
        rgba[rgba[:,:,3]<8]=0
        out.paste(Image.fromarray(rgba),(int(lo[0]),int(lo[1])))
        return out


def arm_parts(path,side):
    raw=opaque(np.array(Image.open(path).convert('RGBA')))
    if side=='near':raw[:,raw.shape[1]//2:]=0
    else:raw[:,:raw.shape[1]//2]=0
    spec=ARM_SPECS[side]
    shoulder,elbow,hand=[np.array(spec[k],dtype=float) for k in ['shoulder','elbow','hand']]
    upper=raw.copy();upper[:spec['sleeveTop']]=0;upper[int(elbow[1]+40):]=0
    fore=raw.copy();fore[:int(elbow[1]-40)]=0;fore[int(hand[1]-70):]=0
    fist=raw.copy();fist[:int(hand[1]-120)]=0
    return [PaintedPart(a) for a in [upper,fore,fist]],shoulder,elbow,hand


def ik(shoulder,hand,lengths,side):
    delta=hand-shoulder
    distance=np.linalg.norm(delta)
    assert abs(lengths[0]-lengths[1])+.01<distance<sum(lengths)-.01, ('Unreachable wrist',distance,lengths)
    unit=delta/distance
    a=(lengths[0]**2-lengths[1]**2+distance**2)/(2*distance)
    h=np.sqrt(max(0,lengths[0]**2-a*a))
    return shoulder+unit*a+np.array([unit[1],-unit[0]])*h*side


T=np.array([0,.4,.7,.86,1])
PATH=np.array([[160,187],[147,151],[137,116],[128,91],[125,70]],dtype=float)
TANGENTS=np.zeros_like(PATH)
for i in range(1,len(T)-1):TANGENTS[i]=(PATH[i+1]-PATH[i-1])/(T[i+1]-T[i-1])
WRIST=CubicHermiteSpline(T,PATH,TANGENTS)


def pose(frame):
    if frame<=72:
        q=np.clip(frame/72,0,1)
        bend=q
        near=np.array([125.,174.])*(1-q)+PATH[0]*q
        far=np.array([160.,171.])*(1-q)+(PATH[0]+STOCK_SPAN)*q
        angle=0.0
    else:
        q=(frame-72)/96
        bend=1-smooth(q/.65)
        near=WRIST(q)
        angle=.05*smooth(q)
        c,s=np.cos(angle),np.sin(angle)
        far=near+STOCK_SPAN@np.array([[c,s],[-s,c]])
    # The pivots remain registered to the painted shoulder armor at all times.
    shoulders=body_point(np.array([[125,124],[154,126]]),bend)
    return bend,near,far,shoulders,angle


def measure_arm(parts,shoulder,elbow,hand):
    composite=Image.new('RGBA',(CELL,CELL))
    for p in parts:composite.alpha_composite(p)
    alpha=np.array(composite)[:,:,3]
    count,labels,stats,_=cv2.connectedComponentsWithStats(np.uint8(alpha>80),8)
    largest=1+np.argmax(stats[1:,cv2.CC_STAT_AREA])
    connected=float(stats[largest,cv2.CC_STAT_AREA]/max(1,(alpha>80).sum()))
    def sample(a,b,fraction,image):
        center=a+(b-a)*fraction;v=b-a;normal=np.array([-v[1],v[0]])/np.linalg.norm(v)
        points=center+np.arange(-20,21)[:,None]*normal
        points=np.rint(points).astype(int);inside=(points[:,0]>=0)&(points[:,0]<CELL)&(points[:,1]>=0)&(points[:,1]<CELL)
        points=points[inside]
        return int((np.array(image)[:,:,3][points[:,1],points[:,0]]>120).sum())
    upper_width=sample(shoulder,elbow,.6,parts[0])
    fore_width=sample(elbow,hand,.45,parts[1])
    def covered(point):
        x,y=np.rint(point).astype(int)
        return int(alpha[max(0,y-1):min(CELL,y+2),max(0,x-1):min(CELL,x+2)].max())
    assert connected>.97, ('Detached arm paint',connected)
    assert 7<=upper_width<=20, ('Upper sleeve width',upper_width)
    assert 7<=fore_width<=20, ('Forearm width',fore_width)
    assert covered(elbow)>240 and covered(hand)>240, 'Unpainted elbow or fist'
    return {'connected':round(connected,5),'upperWidth':upper_width,'foreWidth':fore_width,
            'elbowAlpha':covered(elbow),'handAlpha':covered(hand)}


def build(body_path):
    body=prepare_body(body_path)
    sources=[arm_parts(body_path.parent/'reaper-rig-arms.png',side) for side in ['near','far']]
    yy,xx=np.mgrid[:CELL,:CELL]
    cap=body.copy();cap[((xx-125)/12)**2+((yy-124)/12)**2>1]=0
    frames=[];hands=[];landmarks=[]
    # Test the whole continuous trajectory, including between baked samples.
    for frame in np.linspace(0,168,1001):
        _,near,far,shoulders,_=pose(frame)
        for j,hand in enumerate([near,far]):ik(shoulders[j],hand,ARM_LENGTHS,1 if j==0 else -1)
    for i in range(169):
        bend,near,far,shoulders,bow_angle=pose(i)
        elbows=[ik(shoulders[j],hand,ARM_LENGTHS,1 if j==0 else -1) for j,hand in enumerate([near,far])]
        painted=[];quality=[]
        for j,hand in enumerate([near,far]):
            parts,source_shoulder,source_elbow,source_hand=sources[j]
            upper_angle=np.arctan2(*(elbows[j]-shoulders[j])[::-1])-np.arctan2(*(source_elbow-source_shoulder)[::-1])
            fore_angle=np.arctan2(*(hand-elbows[j])[::-1])-np.arctan2(*(source_hand-source_elbow)[::-1])
            upper=parts[0].draw(source_shoulder,shoulders[j],upper_angle,ARM_LENGTHS[0]/np.linalg.norm(source_elbow-source_shoulder))
            fore=parts[1].draw(source_elbow,elbows[j],fore_angle,ARM_LENGTHS[1]/np.linalg.norm(source_hand-source_elbow))
            fist=parts[2].draw(source_hand,hand,fore_angle,.05)
            painted.append([upper,fore,fist]);quality.append(measure_arm([upper,fore,fist],shoulders[j],elbows[j],hand))
        canvas=Image.new('RGBA',(CELL,CELL))
        # Rear sleeve and forearm belong behind the torso. Both closed hands
        # emerge in front where they grip the stock and front support.
        for p in painted[1][:2]:canvas.alpha_composite(p)
        canvas.alpha_composite(Image.fromarray(body_warp(body,bend)))
        for p in painted[0][:2]:canvas.alpha_composite(p)
        angle=.85*bend;c,s=np.cos(angle),np.sin(angle)
        matrix=np.array([[c,-s,141-141*c+161*s-4*bend],[s,c,161-141*s-161*c+13*bend]],dtype='float32')
        canvas.alpha_composite(Image.fromarray(cv2.warpAffine(cap,matrix,(CELL,CELL),flags=cv2.INTER_LINEAR)))
        canvas.alpha_composite(painted[1][2]);canvas.alpha_composite(painted[0][2])
        frames.append(canvas);hands.append([near.tolist(),far.tolist()])
        landmarks.append({'shoulders':shoulders.tolist(),'elbows':[e.tolist() for e in elbows],
                          'eye':body_point([150,100],bend).tolist(),'bend':float(bend),
                          'bowAngle':float(bow_angle),'paint':quality})
    return frames,hands,landmarks
