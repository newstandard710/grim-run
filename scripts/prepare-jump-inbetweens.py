"""Bake targeted solid transitions from the registered source jump sheet.

Requires Pillow, numpy, scipy and opencv-python-headless 4.12.0.88.
"""
from pathlib import Path
import cv2
import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/motion/v0180/reaper-jump.png'
OUT = ROOT / 'assets/motion/v0180/reaper-jump-inbetweens.webp'
CELL, RUNTIME_CELL = 320, 192
PAIRS = (4, 5, 7, 9, 11, 12, 16, 17, 18, 19, 20, 21, 22)
AIR_KEYS = (0, 4, 12, 16, 18, 20, 23)
SHEET = np.asarray(Image.open(SOURCE).convert('RGBA'), dtype=np.float32) / 255
y, x = np.mgrid[:CELL, :CELL].astype(np.float32)
grid = np.stack([x, y], axis=-1)
cv2.setNumThreads(1)
cv2.setRNGSeed(0)
flow_engine = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
flow_engine.setFinestScale(0)


def key_pose(index):
    x, y = index % 6 * CELL, index // 6 * CELL
    return SHEET[y:y+CELL, x:x+CELL]


def track_image(rgba):
    value = cv2.cvtColor(rgba[:, :, :3], cv2.COLOR_RGB2GRAY)
    return np.uint8((value*.45+.55)*rgba[:, :, 3]*255)


def remap(image, coords):
    return cv2.remap(image, coords[:, :, 0], coords[:, :, 1], cv2.INTER_LINEAR,
                     borderMode=cv2.BORDER_CONSTANT)


def warp_toward(source, target, fraction):
    flow = flow_engine.calc(track_image(source), track_image(target), None)
    flow = cv2.GaussianBlur(flow, (0, 0), .8)
    coords = grid
    for _ in range(5):
        coords = grid - fraction*remap(flow, coords)
    alpha = source[:, :, 3]
    mask = alpha > .5
    signed = (distance_transform_edt(mask)-distance_transform_edt(~mask)).astype(np.float32)
    return (remap(source[:, :, :3]*alpha[:, :, None], coords),
            remap(alpha, coords), remap(signed, coords))


def bake_pair(a, b, fraction=.5):
    color_a, alpha_a, edge_a = warp_toward(a, b, fraction)
    color_b, alpha_b, edge_b = warp_toward(b, a, 1-fraction)
    keep = 1-fraction
    coverage = alpha_a*keep + alpha_b*fraction
    color = (color_a*keep+color_b*fraction) / np.maximum(coverage[:, :, None], .0001)
    alpha = np.clip(edge_a*keep+edge_b*fraction+.5, 0, 1)
    alpha[coverage < .01] = 0
    # Remove disconnected motion specks, retaining the painted main silhouette.
    _, labels, stats, _ = cv2.connectedComponentsWithStats(np.uint8(alpha > .15), 8)
    for label in range(1, len(stats)):
        if stats[label, cv2.CC_STAT_AREA] < 20:
            alpha[labels == label] = 0
    pixels = np.uint8(np.clip(np.dstack([color, alpha])*255+.5, 0, 255))
    return Image.fromarray(pixels).resize((RUNTIME_CELL, RUNTIME_CELL), Image.Resampling.LANCZOS)


def bake_jump():
    atlas = Image.new('RGBA', (6*RUNTIME_CELL, 4*RUNTIME_CELL))
    for index in PAIRS:
        tile = bake_pair(key_pose(index), key_pose(index+1))
        atlas.paste(tile, (index % 6 * RUNTIME_CELL, index // 6 * RUNTIME_CELL))
    atlas.save(OUT, lossless=True, method=6)
    print(f'{len(PAIRS)} solid intermediate poses, {OUT.stat().st_size:,} bytes')


def bake_deliberate_jump():
    atlas = Image.new('RGBA', (6*RUNTIME_CELL, 3*RUNTIME_CELL))
    for pair, (a, b) in enumerate(zip(AIR_KEYS, AIR_KEYS[1:])):
        for step in range(3):
            tile = bake_pair(key_pose(a), key_pose(b), (step+1)/4)
            index = pair*3+step
            atlas.paste(tile, (index % 6 * RUNTIME_CELL, index // 6 * RUNTIME_CELL))
    output = OUT.with_name('reaper-jump-deliberate.webp')
    atlas.save(output, lossless=True, method=6)
    print(f'18 registered air and landing transitions, {output.stat().st_size:,} bytes')


def bake_enemies():
    enemy_root = ROOT / 'assets/enemies/illustrated-v2'
    crawler = [Image.open(p).convert('RGBA').resize((295, 213), Image.Resampling.LANCZOS)
               for p in sorted((enemy_root / 'bone-crawler').glob('crawler_crawl_*.png'))]
    imp_atlas = Image.open(enemy_root / 'ember-imp/ember_imp_atlas_v1.png').convert('RGBA')
    imp = [imp_atlas.crop((x, y, x+256, y+256)) for x, y in ((0,0),(256,0),(512,0),(512,256))]

    def pad(tile):
        layer = Image.new('RGBA', (CELL, CELL))
        layer.paste(tile, ((CELL-tile.width)//2, (CELL-tile.height)//2))
        return np.asarray(layer, dtype=np.float32) / 255

    atlas = Image.new('RGBA', (4*RUNTIME_CELL, 2*RUNTIME_CELL))
    for row, frames in enumerate((crawler, imp)):
        poses = [pad(frame) for frame in frames]
        for i in range(4):
            atlas.paste(bake_pair(poses[i], poses[(i+1)%4]), (i*RUNTIME_CELL,row*RUNTIME_CELL))
    output = enemy_root / 'ground-inbetweens.webp'
    atlas.save(output, lossless=True, method=6)
    print(f'8 solid ground enemy transitions, {output.stat().st_size:,} bytes')


if __name__ == '__main__':
    import sys
    if '--enemies' in sys.argv:
        bake_enemies()
    elif '--deliberate' in sys.argv:
        bake_deliberate_jump()
    else:
        bake_jump()
