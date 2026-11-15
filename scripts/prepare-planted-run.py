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
CELL, COLUMNS, FRAMES, GAITS = 192, 16, 192, 4
STRIDE, SCALE = 188, 13/15
ANCHOR = np.array([123,168],dtype=float)
STANCE = 1/3
HIP = np.array([103,128],dtype=float)
THIGH, SHIN = 27, 26
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
    hip_x += 2.5
    if q<STANCE:
        return np.array([hip_x+half_stance-q*travel,ANCHOR[1]-.35]),0,True
    u = (q-STANCE)/(1-STANCE)
    ease = u*u*(3-2*u)
    # Carry the stance velocity through toe-off and touchdown. Lift the boot
    # on the return stroke with zero vertical velocity at the two contacts.
    stroke = -half_stance+2*half_stance*ease-travel*(1-STANCE)*u*(1-u)*((1-u)**11-u**11)
    lift = math.sin(math.pi*u)**2*(19+10*(1-u))
    pitch = -.38*math.sin(2*math.pi*u)*math.sin(math.pi*u)
    return np.array([hip_x+stroke,ANCHOR[1]-.35-lift]),pitch,False


def draw_leg(out, paint, hip, contact, pitch):
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
        out.alpha_composite(warp(pixels,similarity(a,b,x,y)))


atlas = np.asarray(Image.open(SOURCE).convert('RGBA'),dtype=np.float32)/255
atlas[:,:,:3] *= atlas[:,:,3:4]
paint = source_pose(atlas,96)
OLD_HIP, OLD_KNEE, OLD_ANKLE = (np.array(p,dtype=float) for p in [(103,128),(115,144),(124,160)])
upper = mask(paint,[(98,124),(107,123),(113,131),(119,139),(120,146),
                    (113,152),(106,149),(102,142),(97,136)])
lower = mask(paint,[(111,139),(119,139),(123,146),(125,153),(130,159),
                    (127,165),(121,166),(116,160),(114,150),(109,146)])
boot = mask(paint,[(120,152),(127,152),(130,159),(140,158),(146,158),
                   (146,162),(141,165),(130,168),(119,169),(117,163)])
near = upper,lower,boot
far = tuple(p*np.array([.67,.68,.73,1],dtype=np.float32) for p in near)
# This mask keeps the moving silhouette and scythe tip in the accepted coat
# painting while removing the two original legs below its folds.
body = mask(paint,[(0,0),(191,0),(191,130),(116,130),(110,130),(105,134),(101,140),
                   (100,148),(94,150),(91,144),(82,143),(74,144),(67,143),
                   (61,145),(54,145),(41,147),(30,148),(0,148)])
yy,xx = np.mgrid[:CELL,:CELL].astype(np.float32)
cloth = np.clip((83-xx)/65,0,1)*np.clip((yy-67)/37,0,1)


def draw(frame):
    cycle = FRAMES//GAITS
    phase = frame/cycle
    q = (frame%cycle)/cycle
    # Each planted beat takes weight before rising into a short flight.
    bob = 1.5*math.sin(4*math.pi*q+.5)
    tilt = 1.45*math.cos(4*math.pi*q-.45)
    transform = cv2.getRotationMatrix2D(tuple(HIP),tilt,1)
    transform[:,2] += np.array([.9*math.sin(2*math.pi*q),bob])
    remap_x = xx-cloth*(2.4*np.sin(2*math.pi*phase/2-yy*.085)+.8*math.cos(2*math.pi*phase))
    torso = cv2.remap(body,remap_x,yy,CV,borderMode=cv2.BORDER_CONSTANT)
    out = Image.new('RGBA',(CELL*SUBPIXELS,CELL*SUBPIXELS))
    support = None
    for back,step,parts in [(True,((frame+cycle//2)%cycle)/cycle,far),(False,q,near)]:
        hip = HIP+[-4 if back else 2,1 if back else 0]
        pin = transform[:,:2]@hip+transform[:,2]
        sole,angle,planted = foot(step,hip[0])
        draw_leg(out,parts,pin,sole,angle)
        if planted:
            x = round((sole[0]-ANCHOR[0])*SCALE,4)
            support = {'x':x,'foot':'far' if back else 'near'}
    out.alpha_composite(warp(torso,transform))
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
    out.save(path,quality=86,method=5,exact=False)
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
