"""Register the painted standard cut while preserving its original damage data."""
from functools import lru_cache
import hashlib
import importlib.util
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'assets/motion/v0180'
CELL = 320
DATA_FILE = ART / 'animation-data.js'
MANIFEST = ART / 'manifest.json'
ASSIGNMENT = 'window.GRIM_MOTION_DATA='
SOURCE = ART / 'source/reaper-cut-body.png'
# Frame numbers refer to the original painting. Fractions are baked motion
# intermediates, with the recovery continuing toward carry instead of rewinding.
SEQUENCE = (0,(0,1,.43),1,(1,3,.54),3,(3,6,.48),6,(6,7,.52),7,8,
            (9,10,.5),11,(11,12,.48),12,13,14,15,16,17,(17,18,.55),
            18,(18,19,.52),19,20)
EYE_HEIGHT = (176,177,177,179,180,181,181,178,177,176,174,172,172,170,168,166,168,171,174,176,177)
CARRY_GRIPS = {0:(187,170),18:(200,172),19:(187,153),20:(178,143)}
yy, xx = np.mgrid[:CELL,:CELL].astype(np.float32)


def read_data():
    return json.loads(DATA_FILE.read_text().split(ASSIGNMENT)[1].strip().rstrip(';'))


def main_paint(tile):
    """Strip loose duplicate hands, cape fragments and source-sheet flecks."""
    pixels = np.asarray(tile).copy()
    alpha = pixels[:,:,3]
    _, labels, stats, _ = cv2.connectedComponentsWithStats(np.uint8(alpha > 36), 8)
    main = 1 + int(np.argmax(stats[1:,cv2.CC_STAT_AREA]))
    edge = cv2.dilate(np.uint8(labels == main), np.ones((3,3),np.uint8)) > 0
    return pixels * edge[:,:,None]


def build():
    data = read_data()
    manifest = json.loads(MANIFEST.read_text())
    source = Image.open(SOURCE).convert('RGBA')
    registration = manifest['registration']['reaper-cut-body']
    # Reuse the existing offline optical-flow and solid-alpha baker. The cut
    # stays at its original resolution and renders one opaque painted pose.
    spec = importlib.util.spec_from_file_location('paint_transitions',ROOT/'scripts/prepare-jump-inbetweens.py')
    flow = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(flow)

    @lru_cache
    def pose(i):
        record = registration[i]
        tile = Image.new('RGBA',(CELL,CELL))
        tile.alpha_composite(source.crop(record['sourceBox']),tuple(record['position']))
        pixels = main_paint(tile).astype(np.float32)/255
        # Keep the head and shoulders' painting in proportion, then blend the
        # height correction through the knee down to the registered sole.
        eye = record['sourceEye'][1] + record['position'][1]
        delta = 280 - EYE_HEIGHT[i] - eye
        initial = [0, eye+31, 280, 320]
        final = [delta, eye+31+delta, 280, 320]
        ymap = np.interp(yy,final,initial).astype(np.float32)
        pixels[:,:,:3] *= pixels[:,:,3:4]
        rgba = cv2.remap(pixels,xx,ymap,cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
        rgba[:,:,:3] /= np.maximum(rgba[:,:,3:4],1/255)
        grip = CARRY_GRIPS.get(i,data['grips'][i])
        grip = [grip[0],float(np.interp(grip[1],initial,final))]
        return rgba,grip

    flow.RUNTIME_CELL = CELL
    atlas = Image.new('RGBA',(CELL*6,CELL*4))
    grips = []
    for index, frame in enumerate(SEQUENCE):
        if isinstance(frame, tuple):
            start,end,amount = frame
            rgba,grip = pose(start)
            next_rgba,next_grip = pose(end)
            tile = flow.bake_pair(rgba,next_rgba,amount)
            grip = [a+(b-a)*amount for a,b in zip(grip,next_grip)]
        else:
            rgba,grip = pose(frame)
            tile = Image.fromarray(np.uint8(np.clip(rgba*255+.5,0,255)))
        rgba = main_paint(tile)
        # Keep alpha intact. Drop a single low RGB bit for PNG size.
        rgba[:,:,:3] &= 254
        atlas.paste(Image.fromarray(rgba), (index%6*CELL,index//6*CELL))
        grips.append([round(p,2) for p in grip])

    output = ART / 'reaper-cut-body.png'
    atlas.save(output,optimize=True)
    data['visualCutGrips'] = grips
    DATA_FILE.write_text('/* Authored v0.18 motion and visual cut registration. */\n'+
                         ASSIGNMENT+json.dumps(data,separators=(',',':'))+';\n')
    manifest['visualCut'] = {'sourcePoses':SEQUENCE,'eyeToSoleTargets':EYE_HEIGHT}
    manifest['runtime'][output.name] = {'bytes':output.stat().st_size,
       'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'size':list(atlas.size)}
    MANIFEST.write_text(json.dumps(manifest,indent=2)+'\n')
    print(f'{len(grips)} registered visual cut poses, {output.stat().st_size:,} bytes')


if __name__ == '__main__':
    build()
