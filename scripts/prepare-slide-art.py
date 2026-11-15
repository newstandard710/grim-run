"""Derive the registered slide strip from the released crouch and run paint."""
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets'
WIDTH, HEIGHT = 224, 144
ANCHOR = (180, 132)
ENTRY, BRACE, RISERS, LEADS = 6, 4, 3, 2
Y, X = np.mgrid[:HEIGHT,:WIDTH].astype(np.float32)


def paint(path):
    pixels = np.array(Image.open(path).convert('RGBA'), dtype=np.float32)/255
    pixels[:,:,:3] *= pixels[:,:,3:4]
    return pixels


def place(pixels, scale, origin):
    dx, dy = np.array(ANCHOR) - np.array(origin)*scale
    result = cv2.warpAffine(pixels, np.float32([[scale,0,dx],[0,scale,dy]]),
                            (WIDTH, HEIGHT), flags=cv2.INTER_AREA)
    result[ANCHOR[1]+1:] = 0
    return result


def ended(pixels):
    alpha = pixels[:,:,3:4]
    rgb = pixels[:,:,:3] / np.maximum(alpha, 1/255)
    output = np.uint8(np.clip(np.concatenate((rgb,alpha),axis=2)*255+.5,0,255))
    output[output[:,:,3]<10] = 0
    return Image.fromarray(output)


def slide_pose(base, compression, drift=0):
    """Keep the leading sole fixed and let the hips and cape respond."""
    from_sole = np.clip((132-Y)/49,0,1)
    cape = np.clip((130-X)/90,0,1)*np.clip((132-Y)/23,0,1)
    local_x = compression*3.5*from_sole + drift*1.8*cape
    local_y = compression*7.5*from_sole + drift*2.1*cape
    return cv2.remap(base, X-local_x, Y-local_y, cv2.INTER_LINEAR)


def leaning(base, rise, forward):
    from_sole = np.clip((132-Y)/55,0,1)
    return cv2.remap(base, X-forward*from_sole, Y+rise*from_sole, cv2.INTER_LINEAR)


def gather(low, rise, tilt, reach):
    """Bring the trailing silhouette up toward the planted leading boot."""
    separated = np.minimum(X-150,0)
    shorten = -separated*(1/reach-1)
    raised = np.clip((132-Y)/46,0,1)
    return cv2.remap(low, X-shorten, Y+rise*raised-tilt*separated, cv2.INTER_LINEAR)


def recover(low, run):
    first = gather(low, 9,.13,.87)
    second = gather(low, 16,.25,.68)
    third = leaning(run, -13,-1)
    return (first, second, third)


def main():
    crouch = place(paint(ASSETS/'characters/illustrated-v2/reaper/slide-mobile-v1.png'),
                  .414,(421,288.8))
    run_path = ASSETS/'motion/v0194'
    raw = (run_path/'animation-data.js').read_text()
    data = json.loads(raw.split('=',1)[1].strip().rstrip(';'))
    run = paint(run_path/'reaper-run.webp')
    cell = data['cell']
    images = []
    for i in range(ENTRY):
        u = i/(ENTRY-1)
        compression = u*u*(3-2*u)
        images.append(slide_pose(crouch, compression))
    for wave in (0,1,0,-1):
        images.append(slide_pose(crouch, 1-.055*wave, wave))
    for index in (0, 48):
        row, column = divmod(index,data['columns'])
        target = place(run[row*cell:(row+1)*cell,column*cell:(column+1)*cell],
                       data['scale'],data['anchor'])
        images.extend(recover(images[ENTRY-1], target))
    assert len(images) == ENTRY+BRACE+RISERS*LEADS
    sheet = Image.new('RGBA',(WIDTH*4,HEIGHT*4))
    for index,image in enumerate(images):
        tile=ended(image)
        box=tile.getbbox()
        assert box and box[0]>0 and box[2]<WIDTH and box[3]<=ANCHOR[1]+1,(index,box)
        sheet.paste(tile,(index%4*WIDTH,index//4*HEIGHT))
    output = ASSETS/'motion/v01912'
    output.mkdir(exist_ok=True)
    sheet.save(output/'ground-slide.webp', quality=93, alpha_quality=100, method=6)


if __name__ == '__main__':
    main()
