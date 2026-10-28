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
    # Crop and export only; the generated painting and its alpha are retained.
    bank = image.crop((0, top, image.width, bottom))
    bank = bank.resize((900, 300), Image.Resampling.LANCZOS)
    target = DEST / f'mist-{name}-v2.webp'
    bank.save(target, 'WEBP', lossless=True, exact=True, method=6)
    manifest['runtime'][str(target.relative_to(ROOT))] = {
        'crop': [0, top, image.width, bottom], 'size': list(bank.size),
        'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
        'bytes': target.stat().st_size}
(DEST / 'manifest-v2.json').write_text(json.dumps(manifest, indent=2) + '\n')
print('Prepared four mist banks with original generated transparency.')
