"""Bake phone-scale firing and enemy turn poses from the game's painted parts."""
import json
import runpy
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

SCRIPT = Path(__file__).resolve().parent
ASSETS = SCRIPT.parent / 'assets'
motion = runpy.run_path(str(SCRIPT / 'prepare-opaque-transitions.py'))
register, between = motion['register'], motion['between']
cv2.setNumThreads(1)


def atlas(path):
    return Image.open(ASSETS / path).convert('RGBA')


def cell(image, size, frame):
    w, h = size
    x, y = frame % (image.width//w)*w, frame//(image.width//w)*h
    return image.crop((x, y, x+w, y+h))


def pixels(image):
    return np.asarray(image, dtype=np.float32)/255


def image(array):
    return Image.fromarray(np.uint8(np.clip(array*255+.5, 0, 255)))


def save(frames, cols, file):
    w, h = frames[0].size
    sheet = Image.new('RGBA', (w*cols, h*((len(frames)+cols-1)//cols)))
    for i, tile in enumerate(frames):
        sheet.paste(tile, (i%cols*w, i//cols*h))
    sheet.save(ASSETS / file, quality=90, alpha_quality=100, method=6)


def shots():
    size, anchor = (192, 144), np.array([112., 132.])
    ground = atlas('motion/v0200/reaper-rising-body.webp')
    carry = atlas('motion/v0200/reaper-forward-carry.webp')
    standing = atlas('combat/v0170/reaper-crossbow.png')
    flying = atlas('combat/v0170/reaper-air-crossbow.png')
    slide = atlas('motion/v01912/ground-slide.webp')
    tuck = atlas('motion/v0180/reaper-air-registration.webp')
    rig = json.loads((ASSETS/'motion/v0200/rising-cut-data.js').read_text().split('=',1)[1].strip().rstrip(';'))['paint']
    frames = []
    # Keep the actual running legs. Match the firing torso to the belt on each
    # gait phase, letting the shoulders take recoil while the soles stay put.
    # The spare cloth below/behind the belt covers the division between paints.
    coat = Image.new('L', (512,512))
    ImageDraw.Draw(coat).polygon([(0,0),(511,0),(511,360),(346,360),(311,342),(282,357),
                                  (254,353),(234,374),(210,394),(184,417),(75,412),(0,429)],fill=255)
    for band in range(21):
        gait = band < 16
        air = 16 <= band <= 18
        if gait:
            source_frame = band*6
            base = image(register(pixels(cell(ground,(200,184),source_frame)),size,anchor,[125,168],13/15))
            target = register(pixels(cell(carry,(200,184),source_frame)),size,anchor,[125,168],13/15)
            pivot = anchor + rig['poses'][source_frame]['waist'] + [7,1]
        elif air:
            source_frame = (97,106,111)[band-16]
            target = register(pixels(cell(carry,(200,184),source_frame)),size,anchor,[125,168],13/15)
        else:
            target = (register(pixels(cell(slide,(224,144),7)),size,anchor,[180,132],1)
                      if band==19 else register(pixels(cell(tuck,(224,184),28)),size,anchor,[125,168],13/15))
        for k in range(7):
            sheet = flying if air else standing
            idx = (0,2,3,4,3,2,1)[k] if air else (0,2,4,5,4,2,1)[k]+(8 if band>=19 else 0)
            src = cell(sheet,(512,512),idx)
            kick = (0,.82,1,.57,.19,0,0)[k]
            lower = (0,0,0,.04,.12,.25,.38)[k]
            if gait:
                src.putalpha(Image.fromarray(np.minimum(np.asarray(src)[:,:,3], np.asarray(coat))))
                top = image(register(pixels(src),size,pivot+[-1.9*kick,0],[271,333],.358,-.115-.064*kick+lower))
                body = base.copy()
                body.alpha_composite(top)
            else:
                # Anchor the low shot at its boots; keep the aerial body with
                # the current climb, apex or descent as it takes the recoil.
                lift = (-4,0,4)[band-16] if air else (0 if band==19 else -7)
                body = image(register(pixels(src),size,anchor+[-2*kick,lift],
                                      [280,456],.35 if air else .33,-.03*kick))
            frames.append(body)
        # Two registered recovery shapes before handing back to the real gait.
        frames.extend(between(pixels(body),target,(.38,.76),lock_paint=True))
    save(frames, 16, 'combat/v0201/reaper-crossbow-motion.webp')


def air_cloak():
    # The long gathered pose also owns sustained hover. Warp just the loose
    # trailing hem; the root, face, hands, knees and weapon stay registered.
    src=cell(atlas('motion/v0200/reaper-forward-carry.webp'),(200,184),115)
    yy,xx=np.mgrid[:184,:200].astype(np.float32)
    weight=np.clip((105-xx)/56,0,1)**1.35 * np.clip((yy-90)/16,0,1)
    rgba=pixels(src)
    rgba[:,:,:3]*=rgba[:,:,3:4]
    frames=[]
    for i in range(17):
        a=(i-8)/8
        dy=a*weight*(2.2+2.7*np.sin(xx*.057+yy*.052))
        dx=a*weight*1.6
        paint=cv2.remap(rgba,xx-dx,yy-dy,cv2.INTER_CUBIC)
        paint[:,:,:3]/=np.maximum(paint[:,:,3:4],1/255)
        frames.append(src if i==8 else image(paint))
    save(frames,8,'motion/v0200/reaper-air-cloth.webp')


def enemy_turns():
    size, origin = (128,128), np.array([64.,90.])
    skeleton = atlas('enemies/illustrated-v2/skeletal-bat/skeletal_bat_atlas_v1.png')
    imp = atlas('enemies/illustrated-v2/ember-imp/ember_imp_atlas_v1.png')
    def bat(slot):
        h=(313,314,313)[slot//2]
        x,y=slot%2*627,(0,313,627)[slot//2]
        return register(pixels(skeleton.crop((x,y,x+627,y+h))),size,origin,[313.5,h*.64],58/314)
    def sprite(slot):
        return register(pixels(cell(imp,(256,256),slot)),size,origin,[128,245],55/175)
    frames = []
    def join(first,last,n):
        frames.extend([image(first),*between(first,last,[i/(n-1) for i in range(1,n-1)],lock_paint=True),image(last)])
    # Four wing phases feed the warning and accept the recovery. The diving
    # paint itself leads with the skull; the wing membrane closes behind it.
    for phase in range(4):
        join(bat(phase),bat(4),6)
    join(bat(4),bat(5),8)
    for phase in range(4):
        join(bat(5),bat(phase),7)
    # Build a three-quarter passing pose. The head turns first, followed
    # by the ribs, while the legs keep their forward-running silhouette.
    run = sprite(1)
    warn = sprite(3)
    y,x=np.mgrid[:128,:128].astype(np.float32)
    def twist(pose,head,body):
        upper=np.clip((89-y)/26,0,1)
        hood=np.clip((69-y)/14,0,1)
        width=1-(body*upper+(head-body)*hood)
        return cv2.remap(pose,(64+(x-64)/width).astype(np.float32),y,cv2.INTER_LINEAR)
    looking=twist(run,.49,.18)
    turned=twist(warn,.26,.41)
    join(run,looking,4)
    join(looking,turned,5)
    join(turned,warn,5)
    join(sprite(4),turned,4)
    join(turned,looking,3)
    join(looking,run,2)
    save(frames,12,'enemies/illustrated-v2/attack-turns.webp')
    # Match the surviving-hit color on both renderers to the exact current cel.
    tint=runpy.run_path(str(SCRIPT/'prepare-break-enemy-effects.py'))['muted_red']
    save([tint(f) for f in frames],12,'enemies/illustrated-v2/attack-turns-hit.webp')


if __name__ == '__main__':
    shots()
    enemy_turns()
    air_cloak()
