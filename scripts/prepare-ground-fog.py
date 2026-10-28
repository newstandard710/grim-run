"""Extract the four built-in Imagegen mist rows, preserving their alpha."""
from pathlib import Path
import hashlib
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'assets/visuals/ground-fog'
SOURCE = DEST / 'source/mist-atlas-v2.png'
ROWS = {'drift': (0, 266), 'curl': (266, 474),
        'veil': (474, 615), 'shreds': (615, 793)}

image = Image.open(SOURCE).convert('RGBA')
assert image.size == (1983, 793)
manifest = {'source': str(SOURCE.relative_to(ROOT)),
            'source_sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
            'runtime': {}}
for name, (top, bottom) in ROWS.items():
    # Register the painted fog, not the transparent gutter around its row.
    # Threshold is only used to find bounds: never modify generated alpha.
    bank = image.crop((0, top, image.width, bottom))
    bounds = bank.getchannel('A').point(lambda a: 255 if a >= 16 else 0).getbbox()
    left, y0, right, y1 = bounds
    crop = (max(0, left-2), max(0, top+y0-2),
            min(image.width, right+2), min(bottom, top+y1+2))
    bank = image.crop(crop)
    source_size = bank.size
    bank = bank.resize((900, round(900*bank.height/bank.width)), Image.Resampling.LANCZOS)
    target = DEST / f'mist-{name}-v3.webp'
    bank.save(target, 'WEBP', lossless=True, exact=True, method=6)
    manifest['runtime'][str(target.relative_to(ROOT))] = {
        'crop': list(crop), 'source_size': list(source_size), 'size': list(bank.size),
        'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
        'bytes': target.stat().st_size}
(DEST / 'manifest-v3.json').write_text(json.dumps(manifest, indent=2) + '\n')
print('Prepared four mist banks with original generated transparency.')
