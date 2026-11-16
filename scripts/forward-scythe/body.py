"""Source-derived, representative body and forward-carry cels."""
import importlib.util
import json
import math
from pathlib import Path
import numpy as np
import cv2
from PIL import Image
from scipy.interpolate import make_interp_spline
from geometry import BASE, ROOT, OUT, source_shoulder, smooth
from carry import (run_hold, air_hold, stock_air, strip_air_weapon,
                   bell, endpoints, palm_age, HOLD_ANGLE)

spec=importlib.util.spec_from_file_location('pr91_cut',BASE/'scripts/prepare-continuous-cut.py')
cut=importlib.util.module_from_spec(spec)
spec.loader.exec_module(cut)
R=cut.run
cv2.setNumThreads(1)
m=json.loads((ROOT/'scythe-poses.json').read_text())
wm=json.loads((OUT/'weapon.json').read_text())
t_curve=make_interp_spline(m['anchors'],m['control'],bc_type='natural')
advance,rise=m['shoulderParameters']
weapon=Image.open(OUT/'weapon.webp').convert('RGBA')
air_sheet=Image.open(BASE/'assets/motion/v0180/reaper-air-registration.webp').convert('RGBA')
PIV=np.array(wm['pivot'])
W,H=224,188
ANCHOR=np.array([125.,168.])
anchor_delta=(ANCHOR-R.ANCHOR).astype(int)
SUP=R.SUPERSAMPLE
SIZE=(R.CELL*SUP,)*2
su,sv=np.meshgrid(np.arange(SIZE[0],dtype='float32'),np.arange(SIZE[1],dtype='float32'))
UPPER,FORE=16.15,12.25
SOURCE=cut.GRIP_SOURCE

def rgba():
    return Image.new('RGBA',SIZE)
def fixed_elbow(s,p):
    arm=np.asarray(p)-s
    span=np.linalg.norm(arm)
    a=arm/span
    along=(UPPER**2-FORE**2+span**2)/(2*span)
    bend=math.sqrt(max(0,UPPER**2-along**2))
    return s+a*along+np.array([-a[1],a[0]])*bend
def scythe_sprite(p,angle):
    # At source scale a single texture is placed at one rigid palm pivot.
    mat=R.rotation(angle)*wm['scale']/R.SCALE*SUP
    inv=np.linalg.inv(mat)
    delta=p*SUP-mat@PIV
    return weapon.transform(SIZE,Image.Transform.AFFINE,np.c_[inv,-inv@delta].ravel(),
              Image.Resampling.BICUBIC)
def draw_limbs(shoulder,palm,angle,hold=0):
    arm,hand=rgba(),rgba()
    span=np.linalg.norm(shoulder-palm)*R.SCALE
    assert abs(UPPER-FORE)<span<UPPER+FORE,span
    E=fixed_elbow(shoulder*R.SCALE,palm*R.SCALE)/R.SCALE
    arm.alpha_composite(R.segment(cut.UPPER,cut.SHOULDER,cut.ELBOW,shoulder,E))
    arm.alpha_composite(R.segment(cut.FOREARM,cut.ELBOW,cut.WRIST,E,palm))
    raw_angle=math.atan2(*((palm-E)[::-1]))
    # The fist closes around the stock, with a gradual small turn as the
    # forearm pronates. It must never rotate through a hidden second flip.
    striking=.77*angle+.23*(raw_angle+.28)
    near=striking*(1-hold)+(angle-math.radians(HOLD_ANGLE))*hold
    M=R.rotation(near)
    hand.alpha_composite(R.warp(R.grip,M,palm-M@SOURCE))
    return arm,hand,E
def to_cell(img):
    dest=Image.new('RGBA',(W,H))
    dest.paste(img.resize((R.CELL,R.CELL),Image.Resampling.LANCZOS),tuple(anchor_delta))
    return dest
def torso_shift(torso, shoulder, shift, waist):
    # Rigidly turn the hood, pauldron and chest together. The waist overlap
    # absorbs the displacement underneath the plate instead of stretching it.
    angle=math.atan2(float(shift[0]), max(22., float(waist[1]-shoulder[1])+17))*.67
    rot=R.rotation(angle)
    dst=shoulder+shift
    image=np.array(torso)
    uv=np.stack((su/SUP,sv/SUP),axis=-1)
    inv=(uv-dst)@rot+shoulder
    # The chest remains rigid through the breastplate and arm root. Only the
    # lower cloak and leather waist are blended into the original paint.
    tail=1-smooth((uv[:,:,1]-114)/35)
    sample=uv+(inv-uv)*tail[:,:,None]
    return Image.fromarray(cv2.remap(image,(sample[:,:,0]*SUP).astype(np.float32),
              (sample[:,:,1]*SUP).astype(np.float32),interpolation=cv2.INTER_CUBIC,
              borderMode=cv2.BORDER_CONSTANT))
def stock_layers(i,phase,air,weight):
    legs,top=rgba(),rgba()
    w=weight
    gait=phase is not None
    cut_phase=.125+i/115
    local_phase=float(cut.blend(cut_phase,phase,w)) if gait else cut_phase
    offset=cut.blend(cut.hips(i),cut.gait_offset(phase),w) if gait else cut.hips(i)
    pelvis=R.point(104,118)+offset
    turn=R.rotation(float(cut.lean(i))*(1-w))
    for far,curve,plate in [(True,cut.far_foot,R.FAR),(False,cut.near_foot,R.NEAR)]:
        sole=curve(i)
        if gait:sole=cut.blend(sole,cut.run_foot(phase,far),w)
        if air is not None:
            tucked=(117,143,-.34) if far else (137,152,-.32)
            sole=cut.blend(tucked,cut.AIR_FOOT[air][far],w)
        x,y,a=sole
        hip=R.point(102 if far else 105,117 if far else 118)+offset
        trim=R.ankle_trim(phase,far)*w if gait else 0
        R.draw_leg(legs,plate,hip,R.point(x,y),a,False,far,trim)
    joint=R.point(113,106)
    dx,dy=R.torso_offset(joint[1])
    theta=.28+.52*math.sin(i/23*math.tau-1)
    if gait:theta=float(cut.blend(theta,math.radians(27-36*math.cos(phase*math.tau-.18)),w))
    M=R.rotation(theta)
    top.alpha_composite(R.warp(R.arm,M,joint+R.point(dx,dy)+offset-M@joint))
    torso=R.torso_frame(local_phase,offset).resize(SIZE,Image.Resampling.BICUBIC)
    top.alpha_composite(cut.rotate_canvas(torso,turn,pelvis))
    shoulder=pelvis + turn @ (R.point(123,103)+offset-pelvis)
    return legs,top,shoulder,pelvis

def cut_frame(age):
    p=age/260
    return p/.20*6 if p<.20 else 6+(p-.20)/.59*12 if p<.79 else 18+(p-.79)/.21*5
ASSETS={
 'motion-reaper-cut-handoffs':('reaper-cut-handoffs.webp',168,168,12),
 'motion-reaper-air-cut-joins':('reaper-air-cut-joins.webp',192,160,6),
 'motion-reaper-cut-body':('reaper-cut-body.png',320,320,6)}
textures={}
def stock_pixels(row):
    a=next(v for v in row['sprites'] if v[0] in ASSETS)
    name,frame,x,y,scale,_,ox,oy,_,_=a
    filename,w,h,cols=ASSETS[name]
    if name not in textures:
        textures[name]=Image.open(BASE/'assets/motion/v0180'/filename).convert('RGBA')
    u=int(frame)%cols*w;v=int(frame)//cols*h
    tile=textures[name].crop((u,v,u+w,v+h))
    factor=scale/R.SCALE*SUP
    inv=np.eye(2)/factor
    delta=(R.ANCHOR+[(x-row['x'])/R.SCALE,(y-row['fx'])/R.SCALE])*SUP-np.array([ox*w,oy*h])*factor
    return tile.transform(SIZE,Image.Transform.AFFINE,np.c_[inv,-inv@delta].ravel(),Image.Resampling.BICUBIC)

air_layers={}
def air_body(index):
    if index not in air_layers:
        paint=strip_air_weapon(stock_air(air_sheet,index),index,R.SCALE)
        inverse=np.eye(2)/SUP
        shift=(ANCHOR-R.ANCHOR)
        normalized=paint.transform(SIZE, Image.Transform.AFFINE,np.c_[inverse,shift].ravel(),
                    Image.Resampling.BICUBIC)
        air_layers[index]=normalized
    return air_layers[index]

def action(age,scene,row):
    i=math.floor(cut_frame(age)+.5)
    weight,boundary=endpoints(age)
    air=1 if scene=='air' else None
    hold,index=(air_hold(row['airFrame']),row['airFrame']) if air else (run_hold(R,row['gait']),None)
    carry_pose,carry_shoulder=hold[:2]
    phase=None if air else hold[2]
    legs,torso,Q,pelvis=stock_layers(i,phase,air,weight)
    kinematic_age=palm_age(age)
    model_p=t_curve(kinematic_age)
    model_p[2]-=.53*bell(age,52,58+1/3,66+2/3)
    if weight:
        model_p+=weight*(carry_pose-t_curve(boundary))
    angle=math.radians(model_p[2])
    P=model_p[:2]
    stock=source_shoulder()(np.array([kinematic_age]))[0]
    post_shift=np.array([advance*smooth((kinematic_age-146)/59.4)*(1-smooth((kinematic_age-205.4)/54.6)),
                         -rise*np.exp(-((age-57)/20)**2)])
    shoulder=(stock+post_shift)*(1-weight)+carry_shoulder*weight
    # The pauldron follows the hand into the first recovery beats, then
    # rises before the bent elbow passes in front of the belt.
    shoulder+=np.array([4.6,1.6])*bell(age,205.4,216+2/3,233+1/3)
    shoulder+=np.array([2.1,-2.2])*bell(age,229,241+2/3,254)
    visual_source=R.ANCHOR+shoulder/R.SCALE
    T=torso_shift(torso,Q,visual_source-Q,pelvis)
    arm,hand,_=draw_limbs(visual_source,R.ANCHOR+P/R.SCALE,angle,weight)
    result=legs.copy()
    result.alpha_composite(T)
    if air and weight:
        # The ordinary-air body supplies the exact endpoint and returns with
        # the same blade-free source and shoulder, so no weapon face swaps.
        result=Image.blend(result,air_body(index),weight*weight)
    elif weight:
        arm.putalpha(arm.getchannel('A').point(lambda x:round(x*(1-weight*weight))))
    result.alpha_composite(arm)
    result.alpha_composite(hand)
    original=stock_pixels(row)
    blend=Image.fromarray(np.uint8(np.broadcast_to(smooth((sv/SUP-138)/11)*255, (SIZE[1],SIZE[0]))),'L')
    result=Image.composite(original,result,blend)
    if air and weight>.9:
        result=Image.blend(result,air_body(index),max(0.,weight-.9)*10*(1-weight))
    out=to_cell(result)
    assert out.getbbox()
    ready=to_cell(original)
    toe_rows=151
    out.paste(ready.crop((0,toe_rows,W,H)),(0,toe_rows))
    invariant=bool(np.array_equal(np.array(out)[toe_rows:168],np.array(ready)[toe_rows:168]))
    assert invariant
    return out,[*P.tolist(),angle]
def carried(f):
    target=R.point(87,107)
    original=R.weapon
    try:
        # draw() will first apply the nominal carry rotation, then repaint
        # the same fingers over the prepared rigid lower-grip weapon.
        # Author in the original local sheet about the exact palm center.
        M=R.rotation(math.radians(13))*(wm['scale']/R.SCALE)
        inv=np.linalg.inv(M)
        m=target-M@PIV
        R.weapon=weapon.transform((R.CELL,R.CELL),Image.Transform.AFFINE,np.c_[inv,-inv@m].ravel(),
                                   Image.Resampling.BICUBIC)
        change=R.draw(f)[0]
    finally:R.weapon=original
    dst=Image.new('RGBA',(W,H));dst.paste(change,tuple(anchor_delta))
    return dst

def carried_air(f):
    pose,shoulder=air_hold(f)
    palm=R.ANCHOR+pose[:2]/R.SCALE
    radians=math.radians(pose[2])
    image=air_body(f).copy()
    arm,hand,_=draw_limbs(R.ANCHOR+shoulder/R.SCALE,palm,radians,1)
    for layer in (arm,scythe_sprite(palm,radians),hand):
        image.alpha_composite(layer)
    return to_cell(image),[pose[:2].tolist(),radians,shoulder.tolist()]

