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


def midpoint(source, target):
    flow = flow_engine.calc(track_image(source), track_image(target), None)
    flow = cv2.GaussianBlur(flow, (0, 0), .8)
    coords = grid
    for _ in range(5):
        coords = grid - .5*remap(flow, coords)
    alpha = source[:, :, 3]
    mask = alpha > .5
    signed = (distance_transform_edt(mask)-distance_transform_edt(~mask)).astype(np.float32)
    return (remap(source[:, :, :3]*alpha[:, :, None], coords),
            remap(alpha, coords), remap(signed, coords))


atlas = Image.new('RGBA', (6*RUNTIME_CELL, 4*RUNTIME_CELL))
for index in PAIRS:
    a, b = key_pose(index), key_pose(index+1)
    color_a, alpha_a, edge_a = midpoint(a, b)
    color_b, alpha_b, edge_b = midpoint(b, a)
    coverage = alpha_a + alpha_b
    color = (color_a+color_b) / np.maximum(coverage[:, :, None], .0001)
    alpha = np.clip((edge_a+edge_b)*.5+.5, 0, 1)
    alpha[coverage < .02] = 0
    # Remove disconnected motion specks, retaining the painted main silhouette.
    _, labels, stats, _ = cv2.connectedComponentsWithStats(np.uint8(alpha > .15), 8)
    for label in range(1, len(stats)):
        if stats[label, cv2.CC_STAT_AREA] < 20:
            alpha[labels == label] = 0
    pixels = np.uint8(np.clip(np.dstack([color, alpha])*255+.5, 0, 255))
    tile = Image.fromarray(pixels).resize((RUNTIME_CELL, RUNTIME_CELL), Image.Resampling.LANCZOS)
    atlas.paste(tile, (index % 6 * RUNTIME_CELL, index // 6 * RUNTIME_CELL))
atlas.save(OUT, lossless=True, method=6)
print(f'{len(PAIRS)} solid intermediate poses, {OUT.stat().st_size:,} bytes')
