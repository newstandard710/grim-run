"""Bake motion-compensated in-betweens from the accepted painted run poses.

Requires numpy, Pillow, scipy and opencv-python-headless 4.12.0.88. No model,
new painting, runtime optical flow or whole-character opacity crossfade is used.
The original v0.18 PNGs are retained byte-for-byte.
"""
from pathlib import Path
import hashlib
import json
import cv2
import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/motion/v0193'
SOURCE = ROOT / 'assets/motion/v0180/reaper-run.png'
CELL, SUBFRAMES, COLUMNS = 192, 8, 16
# The separately painted pose 13 changes hood, boot and weapon proportions.
# Bridge its two accepted neighbours over the same distance instead.
KEYS = [i for i in range(24) if i != 13]
cv2.setNumThreads(1)
cv2.setRNGSeed(0)
sheet = np.array(Image.open(SOURCE).convert('RGBA'))
poses = [sheet[i//6*320:(i//6+1)*320, i%6*320:(i%6+1)*320].astype(np.float32)/255 for i in range(24)]
y, x = np.mgrid[:320, :320].astype(np.float32)
grid = np.stack([x, y], axis=-1)
flow_engine = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
flow_engine.setFinestScale(0)

def track_image(rgba):
    # Alpha edges carry motion through the dark cloak as well as bright bones.
    gray = cv2.cvtColor(rgba[:, :, :3], cv2.COLOR_RGB2GRAY)
    return np.uint8(np.clip((gray*.45+.55)*rgba[:, :, 3]*255, 0, 255))

def remap(image, coords):
    return cv2.remap(image, coords[:, :, 0], coords[:, :, 1], cv2.INTER_LINEAR,
                     borderMode=cv2.BORDER_CONSTANT)

def pull(flow, amount):
    # Solve target = source + amount*flow(source), rather than assuming the
    # flow measured at a target pixel is its inverse. Limit folds at occlusions.
    coords = grid.copy()
    for _ in range(5):
        coords = grid-amount*remap(flow, coords)
    return coords

def sdf(alpha):
    inside = alpha > .5
    return (distance_transform_edt(inside)-distance_transform_edt(~inside)).astype(np.float32)

def interpolate(a, b, forward, backward, t):
    if t == 0:
        return np.uint8(np.round(a*255))
    pa, pb = pull(forward, t), pull(backward, 1-t)
    aa, bb = remap(a[:, :, 3], pa), remap(b[:, :, 3], pb)
    ca = remap(a[:, :, :3]*a[:, :, 3:4], pa)
    cb = remap(b[:, :, :3]*b[:, :, 3:4], pb)
    coverage = aa*(1-t)+bb*t
    color = (ca*(1-t)+cb*t)/np.maximum(coverage[:, :, None], .0001)
    # Interpolate the moving silhouette boundary, not sprite opacity. Interior
    # pixels stay solid while the contour moves between registered drawings.
    boundary = remap(sdf(a[:, :, 3]), pa)*(1-t)+remap(sdf(b[:, :, 3]), pb)*t
    alpha = np.clip(boundary+.5, 0, 1)
    color[coverage < .01] = 0
    alpha[coverage < .01] = 0
    return np.uint8(np.clip(np.dstack([color, alpha])*255+.5, 0, 255))

frames, bounds, key_records = [], [], []
for j, first in enumerate(KEYS):
    second = KEYS[(j+1) % len(KEYS)]
    span = (second-first) % 24
    a, b = poses[first], poses[second]
    forward = flow_engine.calc(track_image(a), track_image(b), None)
    backward = flow_engine.calc(track_image(b), track_image(a), None)
    # Correspondence noise is smoothed in source space before baking.
    forward = cv2.GaussianBlur(forward, (0, 0), .8)
    backward = cv2.GaussianBlur(backward, (0, 0), .8)
    key_records.append({'from': first, 'to': second, 'subframes': span*SUBFRAMES})
    for k in range(span*SUBFRAMES):
        tile = Image.fromarray(interpolate(a, b, forward, backward, k/(span*SUBFRAMES)))
        tile = tile.resize((CELL, CELL), Image.Resampling.LANCZOS)
        # Keep antialiasing, remove numerical motion specks outside the art.
        pixels = np.array(tile)
        mask = pixels[:, :, 3] > 32
        count, labels, stats, _ = cv2.connectedComponentsWithStats(np.uint8(mask), 8)
        keep = np.zeros_like(mask)
        for component in range(1, count):
            if stats[component, cv2.CC_STAT_AREA] >= 8:
                keep |= labels == component
        support = cv2.dilate(np.uint8(keep), np.ones((3, 3), np.uint8)) > 0
        pixels[~support] = 0
        tile = Image.fromarray(pixels)
        yy, xx = np.where(pixels[:, :, 3] > 64)
        bounds.append([int(xx.min()), int(yy.min()), int(xx.max()), int(yy.max())])
        frames.append(tile)

assert len(frames) == 192
atlas = Image.new('RGBA', (CELL*COLUMNS, CELL*((len(frames)+COLUMNS-1)//COLUMNS)))
for i, tile in enumerate(frames):
    atlas.paste(tile, (i % COLUMNS*CELL, i//COLUMNS*CELL))
OUT.mkdir(parents=True, exist_ok=True)
path = OUT/'reaper-run.png'
atlas.save(path, optimize=True)
digest = lambda p: {'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
metadata = {'version': '0.19.3', 'cell': CELL, 'frames': len(frames), 'columns': COLUMNS,
            'anchor': [123, 168], 'scale': .52*320/CELL,
            'pixelsPerGait': 188, 'gaitsPerSheet': 4, 'distancePerSheet': 752,
            'source': {'path': str(SOURCE.relative_to(ROOT)), **digest(SOURCE)},
            'keys': key_records, 'runtime': {'reaper-run.png': {**digest(path), 'bounds': bounds}}}
(OUT/'manifest.json').write_text(json.dumps(metadata, indent=2)+'\n')
runtime = {k: metadata[k] for k in ['cell', 'frames', 'columns', 'anchor', 'scale', 'pixelsPerGait', 'gaitsPerSheet', 'distancePerSheet']}
(OUT/'animation-data.js').write_text('/* Solid, registered painted run frames. */\nwindow.GRIM_RUN_DATA='+json.dumps(runtime, separators=(',', ':'))+';\n')
print(f'Baked {len(frames)} solid run poses; {path.stat().st_size:,} bytes; original source retained.')
