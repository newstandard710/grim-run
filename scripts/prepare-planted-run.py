"""Build a distance-registered running gait from the accepted Reaper paintings."""
from pathlib import Path
import hashlib
import json
import math

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'assets/motion/v0194'
SOURCE = ROOT / 'assets/motion/v0193/reaper-run.png'
CELL, COLUMNS, FRAMES, GAITS = 192, 16, 192, 2
STRIDE, SCALE = 202, 13/15
ANCHOR = np.array([123,168],dtype=float)
STANCE = 1/3
HIP = np.array([103,128],dtype=float)
THIGH, SHIN = 29, 28.5
SOLE = np.array([125,166.5],dtype=float)
SUBPIXELS = 2
CV = cv2.INTER_LINEAR


def source_pose(atlas, frame):
    x,y = frame%COLUMNS*CELL,frame//COLUMNS*CELL
    return atlas[y:y+CELL,x:x+CELL].copy()


def mask(paint, points):
    selection = np.zeros((CELL,CELL),dtype=np.uint8)
    cv2.fillPoly(selection,[np.asarray(points,dtype=np.int32)],255)
    part = paint*selection[:,:,None].astype(np.float32)/255
    return part


def image(pixels):
    pixels[:,:,:3] /= np.maximum(pixels[:,:,3:4],1/255)
    return Image.fromarray(np.uint8(np.clip(pixels*255+.5,0,255)))


def warp(paint, transform):
    return image(cv2.warpAffine(paint,transform*SUBPIXELS,(CELL*SUBPIXELS,CELL*SUBPIXELS),
                                flags=CV,borderMode=cv2.BORDER_CONSTANT))


def similarity(start, end, target_start, target_end):
    """Rotate and uniformly rescale the painted segment around its joint."""
    a = complex(*(end-start))
    b = complex(*(target_end-target_start))
    q = b/a
    r = np.array([[q.real,-q.imag],[q.imag,q.real]])
    return np.column_stack((r,target_start-r@start))


def foot(q, hip_x):
    """Travel backward at world speed during support, then swing back to contact."""
    travel = STRIDE/SCALE
    half_stance = STANCE*travel/2
    hip_x += 4.3
    if q<STANCE:
        return np.array([hip_x+half_stance-q*travel,ANCHOR[1]-.35]),0,True
    u = (q-STANCE)/(1-STANCE)
    ease = u*u*(3-2*u)
    # Carry the stance velocity through toe-off and touchdown. Lift the boot
    # on the return stroke with zero vertical velocity at the two contacts.
    stroke = -half_stance+2*half_stance*ease-travel*(1-STANCE)*u*(1-u)*((1-u)**11-u**11)
    lift = math.sin(math.pi*u)**2*(24+10*(1-u))
    pitch = -.38*math.sin(2*math.pi*u)*math.sin(math.pi*u)
    return np.array([hip_x+stroke,ANCHOR[1]-.35-lift]),pitch,False


def draw_leg(out, paint, hip, contact, pitch, planted):
    upper,lower,boot = paint
    c,s = math.cos(pitch),math.sin(pitch)
    rotation = np.array([[c,-s],[s,c]])
    ankle = contact+rotation@(OLD_ANKLE-SOLE)
    direction = ankle-hip
    distance = np.linalg.norm(direction)
    unit = direction/distance
    assert abs(THIGH-SHIN)<distance<THIGH+SHIN, (hip, contact, distance)
    along = (THIGH**2-SHIN**2+distance**2)/(2*distance)
    bend = math.sqrt(max(0,THIGH**2-along**2))
    knee = hip+unit*along+np.array([unit[1],-unit[0]])*bend
    for pixels,a,b,x,y in (
        (upper,OLD_HIP,OLD_KNEE,hip,knee),
        (lower,OLD_KNEE,OLD_ANKLE,knee,ankle),
        (boot,SOLE,SOLE+np.array([16,0]),contact,contact+rotation@np.array([16,0])),
    ):
        layer=warp(pixels,similarity(a,b,x,y))
        if planted and pixels is lower:
            layer.paste((0,0,0,0),(0,163*SUBPIXELS,layer.width,layer.height))
        out.alpha_composite(layer)


atlas = np.asarray(Image.open(SOURCE).convert('RGBA'),dtype=np.float32)/255
atlas[:,:,:3] *= atlas[:,:,3:4]
paint = source_pose(atlas,96)
OLD_HIP, OLD_KNEE, OLD_ANKLE = (np.array(p,dtype=float) for p in [(103,128),(115,144),(124,160)])
upper = mask(paint,[(98,124),(107,123),(113,131),(119,139),(120,146),
                    (113,152),(106,149),(102,142),(97,136)])
lower = mask(paint,[(111,139),(119,139),(123,146),(125,153),(130,159),
                    (125,161),(121,162),(116,160),(114,150),(109,146)])
boot = mask(paint,[(120,152),(127,152),(130,159),(140,158),(146,158),
                   (146,162),(141,165),(130,168),(119,169),(117,163)])
near = upper,lower,boot
far = tuple(p*np.array([.67,.68,.73,1],dtype=np.float32) for p in near)
# This mask keeps the moving silhouette and scythe tip in the accepted coat
# painting while removing the two original legs below its folds.
body = mask(paint,[(0,0),(191,0),(191,130),(116,130),(110,130),(105,134),(101,140),
                   (100,148),(94,150),(91,144),(82,143),(74,144),(67,143),
                   (61,145),(54,145),(41,147),(30,148),(0,148)])
# Keep the same painting at the shoulder and grip. The free forearm moves
# under the pauldron, while the head and lower end of the scythe stay rigid.
free_arm = mask(body,[(107,103),(115,106),(120,110),(125,113),(131,109),(142,110),
                      (143,121),(134,128),(127,126),(122,122),(112,123),(105,115)])
weapon = (
    mask(body,[(0,79),(15,52),(39,40),(69,32),(78,25),(83,40),(97,24),(98,39),(112,38),
               (107,58),(99,68),(85,72),(93,101),(85,104),(78,76),(73,71),(59,71)] )
    + mask(body,[(89,113),(94,112),(101,133),(101,145),(92,139),(91,132)])
)
yy,xx = np.mgrid[:CELL,:CELL].astype(np.float32)
# Fill the narrow shaft underpaint using neighboring cloak pixels. Preserve
# the hand and leave the space outside the hood and coat transparent.
shaft = (weapon[:,:,3] > 0) & (yy>=72) & (xx >= 80+(yy-72)*.22) & (yy<137)
shaft &= (yy>=93) | (xx>89)
cut = np.maximum(free_arm[:,:,3],weapon[:,:,3])>0
straight = np.uint8(np.clip(body[:,:,:3]/np.maximum(body[:,:,3:4],1/255)*255+.5,0,255))
underpaint = cv2.inpaint(straight,np.uint8(shaft)*255,3,cv2.INPAINT_TELEA).astype(np.float32)/255
body[cut] = 0
body[shaft,:3] = underpaint[shaft]
body[shaft,3] = 1
cloth = np.clip((90-xx)/71,0,1)*np.clip((yy-65)/46,0,1)


def local_rotation(parent,pivot,angle):
    local = cv2.getRotationMatrix2D(pivot,angle,1)
    return parent[:,:2] @ local + np.column_stack((np.zeros((2,2)),parent[:,2]))


def draw(frame):
    cycle = FRAMES//GAITS
    phase = frame/cycle
    q = (frame%cycle)/cycle
    # Sink over the loading boot, then rise through the push and keep the
    # chest moving forward out of flight. The hips stay near the support path.
    beat = 4*math.pi*q
    stride = 2*math.pi*q
    bob = 1.9*math.sin(beat+.26)
    tilt = -7.0+1.8*math.cos(beat-.65)
    pelvis = cv2.getRotationMatrix2D(tuple(HIP),-1.0+1.2*math.cos(stride),1)
    pelvis[:,2] += [1.1*math.sin(stride-.2),bob]
    transform = cv2.getRotationMatrix2D(tuple(HIP),tilt,1)
    transform[:,2] += pelvis[:,2]-(HIP-pelvis[:,:2]@HIP)
    remap_x = xx-cloth*(3.4*np.sin(2*math.pi*phase/2-yy*.085-.6)
                       +1.2*np.cos(beat-yy*.026))
    remap_y = yy-cloth*1.7*np.sin(stride-xx*.051-.9)
    torso = cv2.remap(body,remap_x,remap_y,CV,borderMode=cv2.BORDER_CONSTANT)
    out = Image.new('RGBA',(CELL*SUBPIXELS,CELL*SUBPIXELS))
    support = None
    for back,step,parts in [(True,((frame+cycle//2)%cycle)/cycle,far),(False,q,near)]:
        hip = HIP+[-4 if back else 2,1 if back else 0]
        pin = pelvis[:,:2]@hip+pelvis[:,2]
        sole,angle,planted = foot(step,hip[0])
        draw_leg(out,parts,pin,sole,angle,planted)
        if planted:
            x = round((sole[0]-ANCHOR[0])*SCALE,4)
            support = {'x':x,'foot':'far' if back else 'near'}
    arm = local_rotation(transform,(110,108),-1.8+7.8*math.sin(stride+.65))
    carry = local_rotation(transform,(89.5,108),-1.3*math.sin(beat-.9))
    out.alpha_composite(warp(free_arm,arm))
    out.alpha_composite(warp(torso,transform))
    out.alpha_composite(warp(weapon,carry))
    return out.resize((CELL,CELL),Image.Resampling.LANCZOS),support


def digest(path):
    return {'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}


def build():
    OUTPUT.mkdir(parents=True,exist_ok=True)
    out = Image.new('RGBA',(CELL*COLUMNS,(FRAMES//COLUMNS)*CELL))
    support = []
    bounds = []
    for i in range(FRAMES):
        tile,plant = draw(i)
        bounds.append(tile.getchannel('A').point(lambda p:255 if p>64 else 0).getbbox())
        out.paste(tile,(i%COLUMNS*CELL,i//COLUMNS*CELL))
        support.append(plant)
    path = OUTPUT/'reaper-run.webp'
    out.save(path,quality=83,method=5,exact=False)
    contacts = [[i,support[i]['x']] for i in range(0,FRAMES,FRAMES//(GAITS*2))]
    data = {'cell':CELL,'frames':FRAMES,'columns':COLUMNS,'anchor':ANCHOR.tolist(),'scale':SCALE,
            'pixelsPerGait':STRIDE,'gaitsPerSheet':GAITS,'distancePerSheet':STRIDE*GAITS,
            'contacts':contacts,'supportX':[p['x'] if p else None for p in support]}
    step = STRIDE*GAITS/FRAMES
    ground = data['supportX'].copy()
    # In flight, move the terrain reference smoothly from old support to the
    # next touchdown so a hillside cannot jolt the torso on a phase boundary.
    for i,value in enumerate(ground):
        if value is not None:
            continue
        last = next(j for j in range(i-1,i-FRAMES,-1) if support[j%FRAMES])
        following = next(j for j in range(i+1,i+FRAMES) if support[j%FRAMES])
        u = (i-last)/(following-last)
        u = u*u*(3-2*u)
        a = last*step+support[last%FRAMES]['x']
        b = following*step+support[following%FRAMES]['x']
        ground[i] = round(a+(b-a)*u-i*step,4)
    data['groundX'] = ground
    manifest = {**data,'sources':{str(SOURCE.relative_to(ROOT)):digest(SOURCE)},
                'runtime':{path.name:{**digest(path),'bounds':bounds}}}
    (OUTPUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    (OUTPUT/'animation-data.js').write_text('/* Planted and registered solid run poses. */\nwindow.GRIM_RUN_DATA='+json.dumps(data,separators=(',',':'))+';\n')
    print(f'{path.name}: {out.size} and {path.stat().st_size:,} bytes; {len(contacts)} footfalls')


if __name__=='__main__':
    build()
