"""Register authored cutscene artwork and bake solid, articulated poses.

Original built-in Imagegen outputs remain intact. Requires Pillow, numpy, scipy,
and opencv-python-headless 4.12.0.88; no runtime flow or image readback is needed.
"""
from pathlib import Path
import argparse
import json
import hashlib
import subprocess
from io import BytesIO
import cv2
import numpy as np
from PIL import Image
from scipy.ndimage import label, distance_transform_edt
from cutscene_walk_rig import hood_underpaint, make_walk, place_hood, upper_body_pose
from bow_rig import build as build_bow

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/cutscenes/v0197'
CELL, COLS, SCALE = 224, 16, .4
ANCHOR = np.array([136., 214.])
HANDS = np.array([[200, 334, 310, 321], [251, 337, 303, 345],
                  [300, 392, 335, 398], [298, 423, 330, 430],
                  [282, 290, 337, 290], [301, 198, 337, 195],
                  [225, 107, 262, 105], [223, 74, 266, 74]], dtype=float).reshape(8, 2, 2)
cv2.setNumThreads(1)
cv2.setRNGSeed(0)

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

def restore_vendor_hood(path, base, frames):
    """Paint behind the raised shaft using the PR96 vendor atlas as the base."""
    # The released blob already includes the approved PR93 greave alpha.
    blob = 'f05e4b7bf10e82094a483401d75f94333ae0060a'
    released = subprocess.check_output(['git', 'cat-file', 'blob', blob], cwd=ROOT)
    with Image.open(BytesIO(released)) as image:
        sheet = np.array(image.convert('RGBA'))
    assert sheet.shape == (((frames+COLS-1)//COLS)*CELL, COLS*CELL, 4)
    patch = hood_underpaint(base)
    bounds = []
    for frame in range(frames):
        x, y = frame % COLS * CELL, frame // COLS * CELL
        tile = sheet[y:y+CELL, x:x+CELL]
        t = frame * 3 / (frames-1)
        _, _, _, chest, offset = upper_body_pose(t)
        backing = place_hood(patch, t, chest, offset)
        # Preserve opaque fabric, face and scythe. Only add paint where the
        # rejected shaft overlap left transparent or antialiased pixels.
        uncovered = (tile[:,:,3] < 255) & (np.asarray(backing)[:,:,3] >= 8)
        composite = np.asarray(Image.alpha_composite(backing, Image.fromarray(tile)))
        tile[uncovered] = composite[uncovered]
        bounds.append(Image.fromarray(tile[:,:,3]).getbbox())
    # Quantize RGB by at most one code value, then encode losslessly. Keep
    # exact alpha and avoid a second lossy YUV resampling of the whole atlas.
    rgb = sheet[:,:,:3]
    rgb[:] = ((rgb.astype(np.uint16)+1)//3)*3
    Image.fromarray(sheet).save(path, lossless=True, quality=90, method=6)
    return bounds


def build(kind):
    name = 'reaper-' + kind + '-keyposes.png'
    poses, hands, registration = register(name)
    frames, grips = [], []
    rig = None
    if kind == 'bow':
        frames, grips, rig = build_bow(OUT/'source/reaper-rig-body.png')
    else:
        vendor_base = np.uint8(poses[0]*255+.5)
        frames, grips, rig = make_walk(vendor_base)
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
    file = OUT / ('reaper-bow.png' if kind == 'bow' else 'reaper-vendor.webp')
    if kind == 'bow':
        sheet.save(file, optimize=True)
    else:
        bounds = restore_vendor_hood(file, vendor_base, len(frames))
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
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument('--bow-only',action='store_true',help='Retain the vendor atlas and registration byte-for-byte')
    modes.add_argument('--vendor-only',action='store_true',help='Retain the Bow atlases and registration byte-for-byte')
    args=parser.parse_args()
    if args.vendor_only or args.bow_only:
        prior=json.loads((OUT/'manifest.json').read_text())
        code=(OUT/'animation-data.js').read_text()
        prior_data=json.loads(code.split('=',1)[1].strip().rstrip(';'))
    if args.vendor_only:
        bow=prior['runtime']['reaper-bow.png']
        overlay=prior['runtime']['bow-hands.png']
        bow_data=prior_data['bow']
        assert digest(OUT/'reaper-bow.png')['sha256']==bow['sha256']
        assert digest(OUT/'bow-hands.png')['sha256']==overlay['sha256']
    else:
        bow, overlay, bow_data = build('bow')
    if args.bow_only:
        vendor=prior['runtime']['reaper-vendor.webp']
        vendor_data=prior_data['vendor']
        assert digest(OUT/'reaper-vendor.webp')['sha256']==vendor['sha256']
    else:
        vendor, _, vendor_data = build('vendor')
    source_paths = OUT.joinpath('source').glob('*.png')
    if args.vendor_only or args.bow_only:
        source_paths = [OUT/'source'/name for name in prior['sources']]
    manifest = {'version':'0.19.11', 'sources': {p.name:digest(p) for p in source_paths},
                'runtime': {'reaper-bow.png':bow, 'reaper-vendor.webp':vendor, 'bow-hands.png':overlay}}
    (OUT/'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
    data = {'version':'0.19.11', 'cell':CELL, 'anchor':ANCHOR.tolist(), 'bow':bow_data, 'vendor':vendor_data}
    (OUT/'animation-data.js').write_text('/* Generated by scripts/prepare-cutscene-art.py */\nwindow.GRIM_CUTSCENE_DATA='+json.dumps(data, separators=(',',':'))+';\n')
    print('Bow:', bow['frames'], 'poses; vendor:', vendor['frames'], 'poses.')

if __name__=='__main__':main()
