"""Bake the forward RUN, ordinary air, and phase-registered upright Cut family."""

import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import sys
import tempfile

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'assets/motion/v0200'
sys.path.insert(0, str(ROOT / 'scripts/forward-scythe'))


def stock_metadata():
    text = (ROOT / 'assets/motion/v0180/animation-data.js').read_text()
    return json.loads(text.split('=', 1)[1].strip().rstrip(';'))


def stock_cel(data, body, age, gait, air):
    """Use the released actor's lower-body cel and original anchor."""
    frame = math.floor(body.cut_frame(age) + .5)
    handoff = data['visualCutHandoff']
    edge = handoff['edgeFrames']
    if frame in edge or air is not None:
        group = (math.floor((gait % 96) / 8 + .5) % 12) if air is None else 12 + air
        if frame in edge and air is not None:
            texture = 'motion-reaper-air-cut-joins'
            index = air * len(edge) + edge.index(frame)
            anchor = (125, 148)
        else:
            texture = 'motion-reaper-cut-handoffs'
            index = group * len(edge) + edge.index(frame) if frame in edge else 90 + frame
            anchor = handoff['anchor']
        scale = handoff['scale']
    else:
        texture = 'motion-reaper-cut-body'
        index = frame
        anchor = data['visualCutBody']['anchor']
        scale = data['visualCutBody']['scale']
    _, width, height, _ = body.ASSETS[texture]
    p = age / 260
    x = 8 * body.smooth((p - .2) / .39) * (1 - body.smooth((p - .68) / .32))
    return [texture, index, x, 0, scale, scale, anchor[0] / width, anchor[1] / height, 0, 1]


def atlas(name, frames, anchor):
    bounds = [img.getbbox() for img in frames]
    left = max(0, min(b[0] for b in bounds) - 2)
    top = max(0, min(b[1] for b in bounds) - 2)
    right = max(b[2] for b in bounds) + 2
    bottom = max(b[3] for b in bounds) + 2
    width, height = right - left, bottom - top
    # Dimensions aligned to the validation grid in the existing loader.
    width = math.ceil(width / 8) * 8
    height = math.ceil(height / 8) * 8
    sizes = [(n, math.ceil(len(frames) / n)) for n in range(1, 4096 // width + 1)
             if math.ceil(len(frames) / n) * height <= 4096]
    columns, rows = min(sizes, key=lambda nr: (nr[0] * nr[1], max(nr[0] * width, nr[1] * height)))
    assert rows * height <= 4096
    sheet = Image.new('RGBA', (width * columns, height * rows))
    for i, img in enumerate(frames):
        cell = img.crop((left, top, left + width, top + height))
        sheet.paste(cell, (i % columns * width, i // columns * height))
    path = ART / (name + '.webp')
    sheet.save(path, quality=85, method=5)
    payload = path.read_bytes()
    print(path.name, len(frames), sheet.size, len(payload), flush=True)
    shape = dict(key='motion-' + name, url='assets/motion/v0200/' + path.name + '?v=1',
                 width=width, height=height, columns=columns, frames=len(frames),
                 anchor=[float(anchor[0]) - left, float(anchor[1]) - top])
    return shape, dict(bytes=len(payload), sha256=hashlib.sha256(payload).hexdigest(),
                       rgbaBytes=sheet.width * sheet.height * 4, dimensions=sheet.size)


def forward_slide_rise(body, pose):
    """Reuse the last standing recovery pose with the matching RUN carry."""
    spec = importlib.util.spec_from_file_location('source_slide', ROOT/'scripts/prepare-slide-art.py')
    slide = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(slide)
    pixels = np.asarray(pose, dtype=np.float32) / 255
    pixels[:, :, :3] *= pixels[:, :, 3:4]
    target = slide.place(pixels, body.R.SCALE, body.ANCHOR)
    raised = slide.ended(slide.leaning(target, -13, -1))
    x,y = np.asarray(slide.ANCHOR) - body.ANCHOR * body.R.SCALE
    return raised.transform((body.W,body.H), Image.Transform.AFFINE,
        (body.R.SCALE,0,x,0,body.R.SCALE,y), resample=Image.Resampling.BICUBIC)


def bake():
    with tempfile.TemporaryDirectory(prefix='grim-forward-bake-') as temp:
        os.environ['GRIM_FORWARD_BAKE'] = temp
        import weapon
        import body

        native = stock_metadata()
        cut_frames, poses, ground, air = [], [], [], []
        for i in range(32):
            age = i * 1000 / 120
            weight, _ = body.endpoints(age)
            for table, scene, variants in ((ground, 'ground', range(12)), (air, 'air', range(3))):
                indices = []
                for key in variants if weight >= .35 else (0,):
                    airt = (0, 1, 2)[key] if scene == 'air' else None
                    air_frame = (18, 19, 20)[key] if scene == 'air' and weight else 19
                    gait = key * 8 if scene == 'ground' else 0
                    row = dict(x=0, fx=0, gait=gait, airFrame=air_frame,
                               sprites=[stock_cel(native, body, age, gait, airt)])
                    pose, grip = body.action(age, scene, row)
                    indices.append(len(cut_frames))
                    cut_frames.append(pose)
                    poses.append(grip)
                table.append(indices)

        # The authored two gait cycles repeat the same 96 cels, with the same
        # support/footfall lookup in the game. Store each painted tile once.
        carry_frames = [body.carried(i) for i in range(96)]
        carry_frames.extend(body.carried_air(i)[0] for i in range(26))
        slide_frames = list(range(len(carry_frames), len(carry_frames) + 2))
        carry_frames.extend(forward_slide_rise(body, carry_frames[i]) for i in (0,48))
        carry_shape, carry_manifest = atlas('reaper-forward-carry', carry_frames, body.ANCHOR)
        cut_shape, cut_manifest = atlas('reaper-forward-cut', cut_frames, body.ANCHOR)

        path = ART / 'reaper-forward-scythe.webp'
        payload = (Path(temp) / 'weapon.webp').read_bytes()
        path.write_bytes(payload)
        wm = json.loads((Path(temp) / 'weapon.json').read_text())
        weapon_shape = dict(key='motion-reaper-forward-scythe',
                            url='assets/motion/v0200/' + path.name + '?v=1',
                            width=wm['width'],height=wm['height'],
                            columns=1,frames=1,anchor=wm['pivot'],scale=wm['scale'])
        data = dict(carry=carry_shape, cut=cut_shape, weapon=weapon_shape, scale=body.R.SCALE,
                    ground=ground, air=air, slideRise=slide_frames, grips=[[round(v,6) for v in p] for p in poses],
                    stepMs=1000/120)
        (ART / 'animation-data.js').write_text(
            '/* Forward scythe visual poses. Combat authority stays in the original sweep. */\n'
            'window.GRIM_FORWARD_SCYTHE=' + json.dumps(data, separators=(',', ':')) + ';\n')
        manifest = {'carry': carry_manifest, 'cut':cut_manifest, 'weapon': {
            'bytes':len(payload), 'sha256':hashlib.sha256(payload).hexdigest(),
            'rgbaBytes':wm['width']*wm['height']*4, 'dimensions':[wm['width'],wm['height']]}}
        (ART / 'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
        print('encoded',sum(r['bytes'] for r in manifest.values()),
              'texture bytes',sum(r['rgbaBytes'] for r in manifest.values()),flush=True)


if __name__ == '__main__':
    bake()
