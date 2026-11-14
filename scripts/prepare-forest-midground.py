"""Pack the two preserved ImageGen sheets into the Forest Phaser atlas."""
import hashlib
import json
from pathlib import Path

from PIL import Image, __version__ as PILLOW_VERSION, features

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets/visuals/forest-midground/v1'
ATLAS = ASSETS / 'forest-midground.webp'
CELL_W, CELL_H, PADDING = 320, 288, 8
SHEETS = {
    'far': {
        'name': 'forest-far.png',
        'splitY': 530,
        'rowsX': [[0, 515, 1015, 1536], [0, 515, 1025, 1536]],
        'pieces': ['leaning-ash', 'shadow-grove', 'open-oak', 'bare-pair', 'low-canopy', 'wooded-bank'],
    },
    'near': {
        'name': 'forest-near.png',
        'splitY': 553,
        'rowsX': [[0, 566, 1008, 1536], [0, 507, 1008, 1536]],
        'pieces': ['curved-oak', 'split-trunk', 'twin-trunks', 'bent-oak', 'fern-brush', 'mossy-roots'],
    },
}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build():
    atlas = Image.new('RGBA', (CELL_W * 4, CELL_H * 3))
    frames = {}
    sources = {}
    for band, spec in SHEETS.items():
        path = ASSETS / 'source' / spec['name']
        sheet = Image.open(path)
        assert sheet.mode == 'RGBA' and sheet.size == (1536, 1024), path
        sources[spec['name']] = {'sha256': sha(path), 'size': list(sheet.size)}
        for local_index, name in enumerate(spec['pieces']):
            row, column = divmod(local_index, 3)
            edges = spec['rowsX'][row]
            y_edges = [0, spec['splitY'], sheet.height]
            region = (edges[column], y_edges[row], edges[column + 1], y_edges[row + 1])
            tile = sheet.crop(region)
            # Clear only the near-invisible sheet residue in the generated alpha.
            alpha = tile.getchannel('A').point(lambda value: value if value > 3 else 0)
            tile.putalpha(alpha)
            bounds = alpha.getbbox()
            assert bounds and all(distance >= 2 for distance in (
                bounds[0], bounds[1], tile.width - bounds[2], tile.height - bounds[3]
            )), (name, region, bounds)
            tile = tile.crop(bounds)
            tile.thumbnail((CELL_W - 2 * PADDING, CELL_H - 2 * PADDING), Image.Resampling.LANCZOS)
            index = len(frames)
            x = index % 4 * CELL_W + PADDING
            y = index // 4 * CELL_H + PADDING
            atlas.paste(tile, (x, y))
            frames[f'{band}-{name}'] = {
                'frame': {'x': x, 'y': y, 'w': tile.width, 'h': tile.height},
                'rotated': False,
                'trimmed': False,
                'sourceSize': {'w': tile.width, 'h': tile.height},
                'source': spec['name'],
                'sheetRegion': list(region),
                'alphaBoundsInRegion': list(bounds),
            }

    atlas.save(ATLAS, 'WEBP', quality=81, method=6)
    assert ATLAS.stat().st_size <= 500 * 1024, 'Forest atlas exceeded the transfer target'
    meta = {
        'image': ATLAS.name,
        'format': 'RGBA8888',
        'size': {'w': atlas.width, 'h': atlas.height},
        'scale': '1',
        'padding': PADDING,
        'alphaNoiseCutoff': 3,
        'pillow': PILLOW_VERSION,
        'libwebp': features.version('webp'),
        'sources': sources,
        'referenceSha256': sha(ASSETS.parent.parent / 'biomes/forest.webp'),
        'atlasSha256': sha(ATLAS),
        'atlasBytes': ATLAS.stat().st_size,
    }
    (ASSETS / 'forest-midground.json').write_text(
        json.dumps({'frames': frames, 'meta': meta}, indent=2) + '\n', encoding='utf-8'
    )
    print(f'{len(frames)} RGBA frames, {atlas.width}×{atlas.height}, {meta["atlasBytes"]:,} bytes')


if __name__ == '__main__':
    build()
