"""Register authored cutscene poses and bake solid, motion-compensated in-betweens.

Original built-in Imagegen outputs remain intact. Requires Pillow, numpy, scipy,
and opencv-python-headless 4.12.0.88; no runtime flow or image readback is needed.
"""
from pathlib import Path
import argparse
import json
import hashlib
import cv2
import numpy as np
from PIL import Image
from scipy.ndimage import label, distance_transform_edt
from cutscene_walk_rig import make_walk
from bow_rig import build as build_bow

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/cutscenes/v0197'
CELL, COLS, SUB, SCALE = 224, 16, 24, .4
ANCHOR = np.array([136., 214.])
HANDS = np.array([[200, 334, 310, 321], [251, 337, 303, 345],
                  [300, 392, 335, 398], [298, 423, 330, 430],
                  [282, 290, 337, 290], [301, 198, 337, 195],
                  [225, 107, 262, 105], [223, 74, 266, 74]], dtype=float).reshape(8, 2, 2)
cv2.setNumThreads(1)
cv2.setRNGSeed(0)
yy, xx = np.mgrid[:CELL, :CELL].astype(np.float32)
GRID = np.stack([xx, yy], axis=-1)
engine = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
engine.setFinestScale(0)

def digest(path):
    data = path.read_bytes()
    return {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}

def register(name):
    raw = np.array(Image.open(OUT / 'source' / name).convert('RGBA'))
    labels, count = label(raw[:, :, 3] > 80)
    sizes = np.bincount(labels.ravel())
    ids = np.where(sizes > 5000)[0]
    ids = ids[ids != 0]
    assert len(ids) == 8, (name, len(ids))
    # Ownership follows connected character silhouettes, not grid cuts. The
    # authored leading boot slightly crosses the first cell in the vendor sheet.
    seeds = np.where(np.isin(labels, ids), labels, 0)
    nearest = distance_transform_edt(seeds == 0, return_distances=False, return_indices=True)
    owners = seeds[tuple(nearest)]
    records, poses, hands = [], [], []
    for index in ids:
        ys, xs = np.where(labels == index)
        col, row = min(3, int(xs.mean() // 384)), int(ys.mean() // 512)
        records.append((row * 4 + col, index, int(ys.max()), [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]))
    records.sort()
    assert [r[0] for r in records] == list(range(8))
    for i, index, foot, bounds in records:
        rgba = raw.copy()
        rgba[owners != index] = 0
        # Source interior alpha is 253/254. Preserve antialiasing and restore
        # opaque paint; otherwise the original generation adds an opacity veil.
        rgba[:, :, 3] = np.minimum(255, np.round(rgba[:, :, 3].astype(float) * 255 / 253)).astype('uint8')
        tx = ANCHOR[0] - (i % 4 * 384 + 240) * SCALE
        ty = ANCHOR[1] - foot * SCALE
        matrix = np.array([[SCALE, 0, tx], [0, SCALE, ty]], dtype=np.float32)
        tile = cv2.warpAffine(rgba, matrix, (CELL, CELL), flags=cv2.INTER_AREA)
        poses.append(tile.astype(np.float32) / 255)
        h = HANDS[i].copy()
        h[:, 0] = (h[:, 0] - 240) * SCALE + ANCHOR[0]
        h[:, 1] = (h[:, 1] + i // 4 * 512 - foot) * SCALE + ANCHOR[1]
        hands.append(h)
        records[i] = {'pose': i, 'foot': foot, 'sourceBounds': bounds}
    return poses, hands, records

def remap(a, coords):
    return cv2.remap(a, coords[:, :, 0], coords[:, :, 1], cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)

def pull(flow, t):
    coords = GRID.copy()
    for _ in range(5):
        coords = GRID - t * remap(flow, coords)
    return coords

def tracked(rgba):
    gray = cv2.cvtColor(rgba[:, :, :3], cv2.COLOR_RGB2GRAY)
    return np.uint8(np.clip((gray * .45 + .55) * rgba[:, :, 3] * 255, 0, 255))

def boundary(alpha):
    inside = alpha > .5
    return (distance_transform_edt(inside) - distance_transform_edt(~inside)).astype(np.float32)

def segment(a, b):
    forward = cv2.GaussianBlur(engine.calc(tracked(a), tracked(b), None), (0, 0), .8)
    backward = cv2.GaussianBlur(engine.calc(tracked(b), tracked(a), None), (0, 0), .8)
    sa, sb = boundary(a[:, :, 3]), boundary(b[:, :, 3])
    for k in range(SUB):
        t = k / SUB
        if k == 0:
            yield np.uint8(a * 255 + .5)
            continue
        pa, pb = pull(forward, t), pull(backward, 1-t)
        aa, bb = remap(a[:, :, 3], pa), remap(b[:, :, 3], pb)
        coverage = aa * (1-t) + bb * t
        color = (remap(a[:, :, :3] * a[:, :, 3:4], pa) * (1-t) +
                 remap(b[:, :, :3] * b[:, :, 3:4], pb) * t) / np.maximum(coverage[:, :, None], .0001)
        alpha = np.clip(remap(sa, pa) * (1-t) + remap(sb, pb) * t + .5, 0, 1)
        alpha[coverage < .01] = 0
        yield np.uint8(np.clip(np.dstack([color, alpha]) * 255 + .5, 0, 255))

def build(kind):
    name = 'reaper-' + kind + '-keyposes.png'
    poses, hands, registration = register(name)
    frames, grips = [], []
    rig = None
    if kind == 'bow':
        frames, grips, rig = build_bow(OUT/'source/reaper-rig-body.png')
    else:
        frames = make_walk(np.uint8(poses[0]*255+.5))
        grips = [hands[0].tolist() for _ in frames]
        poses[0] = np.array(frames[0]).astype(np.float32)/255
        for a, b in [(0,4),(4,5),(5,6),(6,7)]:
            for k, tile in enumerate(segment(poses[a], poses[b])):
                frames.append(Image.fromarray(tile))
                grips.append((hands[a] * (1-k/SUB) + hands[b] * (k/SUB)).tolist())
        frames.append(Image.fromarray(np.uint8(poses[7] * 255 + .5)))
        grips.append(hands[7].tolist())
    if kind == 'vendor':
        # Quiet planted breathing from the final painting. Exclude the gripped
        # staff and boots; the body/hood/cloth move rather than the whole sprite.
        source = np.uint8(poses[7] * 255 + .5)
        for i in range(48):
            phase = i / 48 * np.pi * 2
            hood = np.exp(-((xx-177)/24)**4 - ((yy-78)/37)**4)
            cloth = np.clip((136-xx)/55, 0, 1) * np.exp(-((yy-155)/41)**4)
            torso = np.exp(-((xx-167)/19)**4 - ((yy-139)/36)**4)
            fixed_staff = 1 - np.exp(-((xx-147)/7)**4)
            dx = (.40*np.sin(phase)*hood + .7*np.sin(phase)*cloth + .2*np.sin(phase)*torso)*fixed_staff
            dy = (-.45*np.sin(phase)*hood - .35*np.sin(phase)*torso)*fixed_staff
            tile = remap(source, np.stack([xx-dx, yy-dy], axis=-1).astype(np.float32))
            frames.append(Image.fromarray(tile))
            grips.append(hands[7].tolist())
    sheet = Image.new('RGBA', (COLS * CELL, ((len(frames)+COLS-1)//COLS) * CELL))
    overlay = Image.new('RGBA', (COLS * 64, ((len(frames)+COLS-1)//COLS) * 64))
    offsets, bounds = [], []
    for i, tile in enumerate(frames):
        pixels = np.array(tile)
        pixels[pixels[:,:,3]<8] = 0
        pixels[pixels[:,:,3] == 0] = 0
        tile = Image.fromarray(pixels)
        box = tile.getbbox()
        assert box and box[0] >= 2 and box[1] >= 2 and box[2] < CELL-1 and box[3] < CELL-1, (kind, i, box)
        bounds.append(box)
        sheet.paste(tile, (i % COLS * CELL, i // COLS * CELL))
        center = np.mean(grips[i], axis=0)
        offset = [int(round(center[0])) - 32, int(round(center[1])) - 28]
        offsets.append(offset)
        palm = np.array(tile.crop((offset[0], offset[1], offset[0]+64, offset[1]+64)))
        py, px = np.mgrid[:64, :64]
        palm_mask = np.zeros((64,64), dtype=float)
        for hand in grips[i]:
            # Only the closed fingers cover the weapon. Copying the whole
            # rectangle would repaint the hood/cloak over the held crossbow.
            hx, hy = hand[0]-offset[0], hand[1]-offset[1]-1.6
            radius = ((px-hx)/5.6)**2 + ((py-hy)/6.4)**2
            palm_mask = np.maximum(palm_mask, np.clip((1-radius)*4, 0, 1))
        palm[:,:,3] = np.uint8(palm[:,:,3]*palm_mask)
        palm[palm[:,:,3] == 0] = 0
        overlay.paste(Image.fromarray(palm), (i % COLS * 64, i // COLS * 64))
    file = OUT / ('reaper-' + kind + '.png')
    sheet.save(file, optimize=True)
    meta = {**digest(file), 'size': sheet.size, 'frames': len(frames), 'cell': [CELL,CELL], 'anchor': ANCHOR.tolist(), 'bounds': bounds}
    if kind == 'bow':
        file = OUT / 'bow-hands.png'
        overlay.save(file, optimize=True)
        hand_meta = {**digest(file), 'size': overlay.size, 'frames': len(frames), 'cell': [64,64]}
    else:
        hand_meta = None
    return meta, hand_meta, {'hands': grips, 'handOffsets': offsets, 'registration': registration, 'rig':rig}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--bow-only',action='store_true',help='Retain the accepted vendor atlas and registration byte-for-byte')
    args=parser.parse_args()
    bow, overlay, bow_data = build('bow')
    if args.bow_only:
        prior=json.loads((OUT/'manifest.json').read_text())
        code=(OUT/'animation-data.js').read_text()
        prior_data=json.loads(code.split('=',1)[1].strip().rstrip(';'))
        vendor=prior['runtime']['reaper-vendor.png']
        vendor_data=prior_data['vendor']
        assert digest(OUT/'reaper-vendor.png')['sha256']==vendor['sha256']
    else:
        vendor, _, vendor_data = build('vendor')
    manifest = {'version':'0.19.8', 'sources': {p.name:digest(p) for p in (OUT/'source').glob('*.png')},
                'runtime': {'reaper-bow.png':bow, 'reaper-vendor.png':vendor, 'bow-hands.png':overlay}}
    (OUT/'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
    data = {'version':'0.19.8', 'cell':CELL, 'anchor':ANCHOR.tolist(), 'bow':bow_data, 'vendor':vendor_data}
    (OUT/'animation-data.js').write_text('/* Generated by scripts/prepare-cutscene-art.py */\nwindow.GRIM_CUTSCENE_DATA='+json.dumps(data, separators=(',',':'))+';\n')
    print('Baked', bow['frames'], 'bow poses; retained', vendor['frames'], 'accepted vendor poses.')

if __name__=='__main__':main()
