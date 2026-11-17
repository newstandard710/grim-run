#!/usr/bin/env python3
"""Derive the Home foreground and cloak from the accepted paintings."""
from hashlib import sha256
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/ui/v0160/home-v1'
IDLE = ROOT / 'assets/characters/illustrated-v2/reaper/reaper_idle_v1.png'
FOREST = ROOT / 'assets/ui/v0160/veil-forest.webp'
BODY = (346, 228, 1454, 1428)
CLOAK = (346, 752, 976, 1400)
TREAD = [(0, 672), (170, 674), (308, 688), (493, 699), (638, 711),
         (798, 722), (969, 735), (1124, 744), (1307, 749), (1497, 755), (1672, 765)]
CELL, GUTTER, COLUMNS, ROWS = 192, 2, 12, 8
FPS, SECONDS = 30, 3.2


def smooth(value):
    value = np.clip(value, 0, 1)
    return value * value * (3 - 2 * value)


def pulse(time, start, peak, end):
    return smooth((time - start) / (peak - start)) * smooth((end - time) / (end - peak))


def digest(path):
    data = path.read_bytes()
    return {'path': str(path.relative_to(ROOT)), 'bytes': len(data),
            'sha256': sha256(data).hexdigest()}


def build_cloak():
    source = Image.open(IDLE).convert('RGBA')
    still = source.crop(BODY)
    # Keep a small overlap inside the undisplaced fabric. This preserves the
    # opaque join without baking any second hood, fingers, steel or boots.
    still.paste((0, 0, 0, 0), (0, 770 - BODY[1], 953 - BODY[0], 1380 - BODY[1]))
    still.resize((554, 600), Image.Resampling.LANCZOS).save(
        OUT / 'reaper-plate.webp', quality=94, method=6)

    inner = CELL - GUTTER * 2
    x0, y0, x1, y1 = CLOAK
    xs = x0 + (np.arange(inner) + .5) * (x1 - x0) / inner - .5
    ys = y0 + (np.arange(inner) + .5) * (y1 - y0) / inner - .5
    x, y = np.meshgrid(xs, ys)
    raw = np.array(source, dtype=np.float32) / 255
    raw[..., :3] *= raw[..., 3:]
    span = smooth((944 - x) / 510)
    area = span * smooth((y - 782) / 80) * smooth((1375 - y) / 61)
    follow = np.clip((y - 808) / 500, 0, 1) * .145 + (1 - span) * .035
    atlas = Image.new('RGBA', (CELL * COLUMNS, CELL * ROWS))
    displacement_maxima = [0, 0]

    for frame in range(COLUMNS * ROWS):
        local = frame / FPS - follow
        gust = pulse(local, .38, 1.16, 1.99)
        snap = pulse(local, 1.02, 1.17, 1.37)
        rebound = pulse(local, 1.24, 1.74, 2.61)
        settling = pulse(local, 2.19, 2.54, 3.00)
        fold = np.sin((y - 807) / 91 + 2.3 * span)
        dx = area * (-52 * gust - 12 * snap + 12 * rebound - 8 * settling
                     + 5 * fold * gust)
        dy = area * (-27 * gust - 7 * snap + 12 * rebound - 4 * settling
                     + 6 * fold * gust)
        # Inverse sampling keeps the same connected fabric and painterly folds.
        # The entire border at the arm/shoulder and the base overlap are fixed.
        coord = [y - dy, x - dx]
        rgba = np.stack([map_coordinates(raw[..., channel], coord, order=1) for channel in range(4)], axis=-1)
        alpha = rgba[..., 3:]
        np.divide(rgba[..., :3], alpha, out=rgba[..., :3], where=alpha > 0)
        tile = Image.fromarray(np.uint8(np.clip(rgba * 255 + .5, 0, 255)))
        atlas.paste(tile, (frame % COLUMNS * CELL + GUTTER, frame // COLUMNS * CELL + GUTTER))
        displacement_maxima[0] = max(displacement_maxima[0], float(np.abs(dx).max()))
        displacement_maxima[1] = max(displacement_maxima[1], float(np.abs(dy).max()))

    atlas.save(OUT / 'cloak.webp', quality=87, method=6, alpha_quality=97)
    return [round(value, 2) for value in displacement_maxima]


def build_path():
    # Trace the visible tread from the accepted forest painting. This is a
    # registered overlay in forest image coordinates, so the path reinforces
    # the existing rock faces through either cover crop.
    y0, y1 = 626, 850
    image = Image.open(FOREST).convert('RGB').crop((0, y0, 1672, y1))
    pixels = np.array(image, dtype=np.float32)
    width, height = image.size
    x = np.arange(width)
    center = np.interp(x, *np.array(TREAD).T)
    across = np.arange(y0, y1)[:, None] - center
    contour = 5 * np.sin(x / 71) + 4 * np.sin(x / 26) + 1.5 * np.sin(x / 8.8)
    alpha = smooth((across + 32 + contour) / 28) * smooth((72 - across + contour) / 35)
    alpha *= smooth(x / 140) * smooth((width - x) / 111)
    elevation = .94 + .22 * np.exp(-((across + 4) / 20) ** 2)
    pixels = pixels * elevation[:, :, None] + np.array([7, 6, 5]) * np.exp(-((across + 8) / 30) ** 2)[:, :, None]
    rgba = np.dstack((pixels.clip(0, 255), alpha * 255)).astype('uint8')
    Image.fromarray(rgba).resize((1280, 172), Image.Resampling.LANCZOS).save(
        OUT / 'tread.webp', quality=90, method=6)


def main():
    OUT.mkdir(exist_ok=True)
    peaks = build_cloak()
    build_path()
    manifest = {
        'source': [digest(IDLE), digest(FOREST)],
        'exports': [digest(OUT / name) for name in ('reaper-plate.webp', 'cloak.webp', 'tread.webp')],
        'bodyRect': BODY, 'cloakRect': CLOAK, 'treadRect': [0, 626, 1672, 850], 'treadContact': TREAD,
        'cell': CELL, 'gutter': GUTTER, 'columns': COLUMNS, 'frames': COLUMNS * ROWS,
        'fps': FPS, 'seconds': SECONDS, 'maxSourcePixelDisplacement': peaks
    }
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')


if __name__ == '__main__':
    main()
