"""Bake only the 18 standard air-Cut edge pictures from the shipped poses."""
from pathlib import Path
import importlib.util
import json

import cv2
import numpy as np
from PIL import Image

SCRIPT = Path(__file__).with_name('prepare-air-registration.py')
spec = importlib.util.spec_from_file_location('air_registration', SCRIPT)
air = importlib.util.module_from_spec(spec)
spec.loader.exec_module(air)

WIDTH, HEIGHT, COLUMNS = 192, 160, 6
CROP = (0, 20, WIDTH, 20 + HEIGHT)
JUMP_HANDS = ((-35, -74), (-31, -73), (-32, -73))
JUMP_REAR = ((-46, -54), (-43, -53), (-43, -53))
JUMP_KEYS = (0, 1, 3)


def move(paint, delta):
    x, y = delta / air.SCALE
    matrix = np.float32([[1, 0, x], [0, 1, y]])
    return air.straight(cv2.warpAffine(air.premultiply(paint),matrix,(air.WIDTH,air.HEIGHT),
                                      flags=cv2.INTER_LINEAR))


def build():
    art = air.ART
    air_sheet = Image.open(art/'reaper-air-registration.webp').convert('RGBA')
    cut_sheet = Image.open(art/'reaper-cut-handoffs.webp').convert('RGBA')
    data = json.loads((art/'animation-data.js').read_text().split('window.GRIM_MOTION_DATA=',1)[1].strip().removesuffix(';'))
    poses = data['visualCutHandoff']
    cell, anchor, scale = (poses[name] for name in ('cell','anchor','scale'))
    columns = cut_sheet.width // cell
    count = len(poses['edgeFrames'])
    start = poses['phases'] * count
    blend = air.transition_module().between
    output = Image.new('RGBA',(COLUMNS*WIDTH,3*HEIGHT))
    for group,key in enumerate(JUMP_KEYS):
        jump = air.cell(air_sheet,18+key,air.COLUMNS,air.WIDTH,air.HEIGHT)
        hands = (JUMP_REAR[group], JUMP_HANDS[group])
        jump_body = air.separate_weapon(jump,(air.COLLARS[key],air.POMMELS[key]),hands,
                                        air.mask_blade(air.COLLARS[key]))
        jump_grip = np.float32(hands[0])
        for edge,weight in enumerate(poses['edgeWeights']):
            index = start + group*count + edge
            cut = air.fit(air.cell(cut_sheet,index,columns,cell,cell),anchor,scale)
            cut_grip = np.float32(poses['poses'][index][:2])
            grip = jump_grip*weight + cut_grip*(1-weight)
            jump_aligned = move(Image.fromarray(np.uint8(jump_body*255+.5)),grip-jump_grip)
            if weight==1:
                tile = jump_aligned
            else:
                cut = move(cut,grip-cut_grip)
                tile = next(blend(air.pixel_array(cut),air.pixel_array(jump_aligned),(weight,),lock_paint=True))
            cropped = tile.crop(CROP)
            x0,y0,x1,y1 = cropped.getchannel('A').point(lambda value: 255 if value>128 else 0).getbbox()
            assert x0>0 and y0>0 and x1<WIDTH and y1<HEIGHT,(group,edge,(x0,y0,x1,y1))
            output.paste(cropped,(edge*WIDTH,group*HEIGHT))
    output.save(art/'reaper-air-cut-joins.webp',lossless=True,method=6,exact=True)


if __name__=='__main__':
    build()
