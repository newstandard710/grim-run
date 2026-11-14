"""Pack Grim Run scenery and render contact sheets from the preserved originals."""
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
import scipy
from PIL import Image, ImageDraw, __version__ as PILLOW_VERSION, features
from scipy.ndimage import binary_dilation, distance_transform_edt, label

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'assets/visuals/biome-midground'
REVIEW = DEST / 'review'
PADDING = 8
BASE_ALPHA = 48
MIN_EDGE_ALPHA = 8
CONNECTIVITY = np.ones((3, 3), dtype=bool)

# Region layout is measured from the source sheets, which vary slightly from
# the requested grid. Entries name the physical contact in the cropped art.
SURFACE_LAYOUT = ((0, 362, 725, 1087, 1448), (0, 325, 540, 835, 1086))
CAVE_LAYOUT = ((0, 443, 887, 1330, 1774), (0, 443, 887))
LAVA_LAYOUT = ((0, 443, 887, 1330, 1774), (0, 438, 887))
BOSS_LAYOUT = ((0, 441, 891, 1331, 1774), (0, 440, 887))
LAYOUTS = {
    'foothills': (SURFACE_LAYOUT, [
        (0, 'far-slate-spur', .56, .93), (1, 'far-heather-terrace', .51, .93),
        (2, 'far-fractured-ridge', .57, .94), (3, 'far-scrub-bank', .47, .93),
        (4, 'far-heather-spur', .46, .93), (5, 'far-low-heather', .48, .92),
        (6, 'far-slate-boulder', .48, .90), (7, 'far-scree-bank', .52, .9),
        (8, 'near-rock-shoulder', .56, .94), (9, 'near-windbent-tree', .43, .93),
        (10, 'near-slate-bed', .52, .94), (11, 'near-slate-twins', .57, .94),
        ((0, 835, 725, 1086), 'near-heather-bed', .48, .94),
        ((725, 835, 1448, 1086), 'near-shale-talus', .54, .9),
    ]),
    'tundra': (SURFACE_LAYOUT, [
        (0, 'far-snow-ridge', .52, .93), (1, 'far-rock-fin', .57, .94),
        (2, 'far-snowy-crags', .52, .91), (3, 'far-drift-bank', .54, .94),
        (4, 'far-moraine', .53, .87), (5, 'far-scree', .53, .9),
        (6, 'far-snowy-outcrop', .45, .92), (7, 'far-buried-ridge', .52, .89),
        (8, 'near-escarpment', .42, .93), (9, 'near-ice-face', .57, .94),
        (10, 'near-boulder-drift', .57, .94), (11, 'near-frost-pinnacle', .53, .94),
        (12, 'near-low-snowdrift', .50, .91), (13, 'near-buried-ledge', .50, .93),
        (14, 'near-brush-boulder', .51, .93), (15, 'near-snowy-rock-bed', .53, .93),
    ]),
    'caves': (CAVE_LAYOUT, [
        (2, 'far-organ-pipes', .56, .95), (3, 'far-limestone-cluster', .56, .94),
        (4, 'far-limestone-scree', .51, .9), (6, 'far-ceiling-fan', .50, .16),
        (0, 'near-buttress', .45, .93), (1, 'near-joined-columns', .50, .93),
        (5, 'near-layered-shelf', .54, .92), (7, 'near-ceiling-terrace', .51, .19),
    ]),
    'crystals': (CAVE_LAYOUT, [
        (1, 'far-cobalt-vein', .53, .92), (2, 'far-amethyst-bed', .53, .91),
        (5, 'far-inset-crystals', .55, .95), (7, 'far-ceiling-socket', .61, .23),
        (0, 'near-wall-geode', .41, .92), (3, 'near-fused-fan', .48, .94),
        (4, 'near-geode-shelf', .49, .92), (6, 'near-ceiling-ledge', .54, .15),
    ]),
    'ashlands': (CAVE_LAYOUT, [
        (0, 'far-smoke-ridge', .49, .94), (1, 'far-basalt-shoulder', .58, .93),
        (2, 'far-cinder-mound', .51, .94), (4, 'far-ash-terrace', .51, .94),
        (3, 'near-scorched-shelf', .59, .92), (5, 'near-toppled-slabs', .63, .92),
        (6, 'near-cliff-foot', .59, .93), (7, 'near-basalt-bank', .55, .94),
    ]),
    'lava': (LAVA_LAYOUT, [
        (0, 'far-cooled-columns', .52, .94), (1, 'far-slag-shelf', .34, .92),
        (2, 'far-lavafall', .46, .96), (3, 'far-basalt-shoulder', .54, .94),
        (4, 'near-basalt-pillar', .43, .92), (5, 'near-layered-shelf', .49, .93),
        (6, 'near-crust-island', .53, .94), (7, 'near-basalt-talus', .55, .94),
    ]),
    'boss': (BOSS_LAYOUT, [
        (2, 'far-fortress-buttress', .52, .95), (3, 'far-fortress-terrace', .57, .96),
        (5, 'far-courtyard-wall', .52, .96), (7, 'far-masonry-rubble', .61, .96),
        (0, 'near-broken-tower', .45, .95), (1, 'near-ruined-arch', .50, .96),
        (4, 'near-fortress-pier', .46, .95), (6, 'near-crenellated-rampart', .58, .96),
    ]),
}

# Normalized coordinates on the exported, trimmed frame. A two-foot support
# keeps separate physical contacts even when its projection origin is between them.
SPECIAL_SUPPORTS = {
    ('foothills', 'near-windbent-tree'): ('root', ((.43, .93),)),
    ('caves', 'near-joined-columns'): ('arch', ((.21, .94), (.77, .94))),
    ('boss', 'near-ruined-arch'): ('arch', ((.22, .96), (.77, .96))),
}
REVIEW_BATCHES = {
    'surface': ('foothills', 'tundra'),
    'underground': ('caves', 'crystals'),
    'volcanic-and-boss': ('ashlands', 'lava', 'boss'),
}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main_silhouette(mask, region):
    components, _ = label(mask, structure=CONNECTIVITY)
    counts = np.bincount(components.ravel())
    counts[0] = 0
    assert counts.max() >= 5000, region
    return components == counts.argmax()


def clear_alpha_noise(pixels):
    pixels[pixels[:, :, 3] <= MIN_EDGE_ALPHA] = 0
    return Image.fromarray(pixels)


def crop(source, region, dematte):
    pixels = np.array(source.crop(region))
    alpha = pixels[:, :, 3]
    if dematte:
        # The Boss sheet has translucent near-neutral gray/white outside the
        # architecture, including its windows. Recover a mask using both color
        # and alpha. Extend painted RGB into feather pixels to clear matte spill.
        darkest = pixels[:, :, :3].min(axis=2).astype(float)
        core = main_silhouette((darkest <= 158) & (alpha >= 195), region)
        feather = binary_dilation(core, iterations=2) & ~core
        edge_alpha = np.clip(np.minimum((211 - darkest) / 53,
                                       (alpha.astype(float) - 171) / 61), 0, 1)
        nearest_y, nearest_x = distance_transform_edt(
            ~core, return_distances=False, return_indices=True)
        pixels[feather, :3] = pixels[nearest_y[feather], nearest_x[feather], :3]
        alpha[:] = 0
        alpha[core] = 255
        alpha[feather] = np.rint(255 * edge_alpha[feather]).astype(np.uint8)
    else:
        core = main_silhouette(alpha >= BASE_ALPHA, region)
        # Keep connected painted edges and their immediate antialiasing.
        alpha[~binary_dilation(core, iterations=2)] = 0
    image = clear_alpha_noise(pixels)
    bounds = image.getchannel('A').getbbox()
    assert (bounds[0] > 0 and bounds[1] > 0 and bounds[2] < image.width
            and bounds[3] < image.height), (region, bounds)
    return image.crop(bounds), bounds


def region_for(layout, index):
    if isinstance(index, tuple):
        return index
    xs, ys = layout
    y, x = divmod(index, len(xs) - 1)
    return xs[x], ys[y], xs[x + 1], ys[y + 1]


def verify_atlas(atlas, frames):
    alpha = np.array(Image.open(atlas).getchannel('A'))
    assert not np.any((alpha > 0) & (alpha <= MIN_EDGE_ALPHA)), atlas
    gutter = np.ones(alpha.shape, dtype=bool)
    for name, spec in frames.items():
        frame = spec['frame']
        x, y, w, h = (frame[key] for key in ('x', 'y', 'w', 'h'))
        gutter[y:y + h, x:x + w] = False
        for px, py in spec['support']['points']:
            contact_alpha = alpha[y + round(py * (h - 1)), x + round(px * (w - 1))]
            assert contact_alpha >= 160, (atlas, name, px, py, contact_alpha)
        if spec['support']['kind'] == 'arch':
            assert alpha[y + round(.55 * (h - 1)), x + round(.5 * (w - 1))] == 0, name
    assert not alpha[gutter].any(), atlas


def pack(biome, production):
    layout, sprites = LAYOUTS[biome]
    reference = ROOT / production['reference']
    source_name = production['source']
    source_path = DEST / source_name
    source = Image.open(source_path)
    assert source.mode == 'RGBA', source_path
    count = len(sprites)
    cols = 4
    rows = (count + cols - 1) // cols
    cell_w, cell_h = 320, 255 if rows > 2 else 350
    width, height = cols * cell_w, rows * cell_h
    sheet = Image.new('RGBA', (width, height))
    frames = {}
    for i, (region_index, name, x, y) in enumerate(sprites):
        region = region_for(layout, region_index)
        image, bounds = crop(source, region, dematte=biome == 'boss')
        image.thumbnail((cell_w - 2 * PADDING, cell_h - 2 * PADDING), Image.Resampling.LANCZOS)
        image = clear_alpha_noise(np.array(image))
        band, _ = name.split('-', maxsplit=1)
        default_support = 'ceiling' if 'ceiling' in name else 'floor'
        support, points = SPECIAL_SUPPORTS.get((biome, name), (default_support, ((x, y),)))
        left, top = i % cols * cell_w + PADDING, i // cols * cell_h + PADDING
        sheet.paste(image, (left, top))
        frames[name] = {
            'frame': {'x': left, 'y': top, 'w': image.width, 'h': image.height},
            'sourceSize': {'w': image.width, 'h': image.height},
            'rotated': False, 'trimmed': False,
            'source': source_name, 'crop': region, 'alphaBoundsInCrop': bounds,
            'band': band, 'contact': [x, y], 'support': {'kind': support, 'points': points},
        }
    atlas = DEST / (biome + '.webp')
    for quality in (83, 79, 75, 71, 67, 63):
        sheet.save(atlas, 'WEBP', quality=quality, method=6)
        if atlas.stat().st_size <= 500 * 1024:
            break
    assert atlas.stat().st_size <= 500 * 1024, atlas
    verify_atlas(atlas, frames)
    source_digest = sha(source_path)
    meta = {
        'image': atlas.name, 'size': {'w': width, 'h': height}, 'format': 'RGBA8888', 'scale': '1',
        'atlasBytes': atlas.stat().st_size, 'atlasSha256': sha(atlas), 'padding': PADDING,
        'sources': {source_name: {'sha256': source_digest, 'size': source.size}},
        'primarySource': source_name, 'primarySourceSha256': source_digest,
        'reference': production['reference'], 'referenceSha256': sha(reference),
        'alphaCleanup': 'boss-luma-alpha-dematte' if biome == 'boss' else 'connected-alpha',
        'pillow': PILLOW_VERSION, 'webp': features.version('webp'), 'quality': quality,
        'numpy': np.__version__, 'scipy': scipy.__version__,
    }
    (DEST / (biome + '.json')).write_text(json.dumps({'frames': frames, 'meta': meta}, indent=2) + '\n')
    print(biome, count, meta['atlasBytes'], quality, flush=True)


def review(batch, biomes):
    cell_w, cell_h = 146, 132
    heading, cols = 24, 8
    atlases = []
    height = 0
    for biome in biomes:
        packed = json.loads((DEST / f'{biome}.json').read_text())
        atlases.append((biome, Image.open(DEST / packed['meta']['image']).convert('RGBA'),
                        packed['frames']))
        height += heading + cell_h * ((len(packed['frames']) + cols - 1) // cols)

    sheet = Image.new('RGB', (cell_w * cols, height), '#141621')
    draw = ImageDraw.Draw(sheet)
    y = 0
    for biome, atlas, frames in atlases:
        draw.text((8, y + 5), f'{biome.title()}  |  {len(frames)} sprites  |  cyan: support',
                  fill='#e3e8f4')
        y += heading
        for index, (name, spec) in enumerate(frames.items()):
            x = index % cols * cell_w
            top = y + index // cols * cell_h
            draw.rectangle((x + 2, top, x + cell_w - 3, top + cell_h - 3), fill='#293040')
            draw.rectangle((x + cell_w // 2, top, x + cell_w - 3, top + cell_h - 3),
                           fill='#686674')
            frame = spec['frame']
            sprite = atlas.crop((frame['x'], frame['y'], frame['x'] + frame['w'],
                                 frame['y'] + frame['h']))
            sprite.thumbnail((cell_w - 14, cell_h - 22), Image.Resampling.LANCZOS)
            sx = x + (cell_w - sprite.width) // 2
            sy = top + (cell_h - 18 - sprite.height) // 2
            sheet.paste(sprite, (sx, sy), sprite)
            for px, py in spec['support']['points']:
                cx, cy = sx + px * (sprite.width - 1), sy + py * (sprite.height - 1)
                draw.ellipse((cx - 2, cy - 2, cx + 2, cy + 2), outline='#88f2ec')
            draw.text((x + 6, top + cell_h - 16), name, fill='#ffffff',
                      font_size=10, stroke_width=1, stroke_fill='#232434')
        y += cell_h * ((len(frames) + cols - 1) // cols)
    REVIEW.mkdir(exist_ok=True)
    sheet.save(REVIEW / f'{batch}.jpg', quality=89, optimize=True)


if __name__ == '__main__':
    prompts = json.loads((DEST / 'production-prompts.json').read_text())
    selected = sys.argv[1:] or LAYOUTS.keys()
    for biome in selected:
        pack(biome, prompts[biome])
    for batch, biomes in REVIEW_BATCHES.items():
        if set(biomes) & set(selected):
            review(batch, biomes)
