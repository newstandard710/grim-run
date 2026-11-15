"""Register visible feet and ground contacts from the production obstacle paintings."""
import json
from pathlib import Path
from statistics import median
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / 'assets/visuals/obstacle-catalog.js'
source = CATALOG.read_text()
skins, _ = json.JSONDecoder().raw_decode(source[source.index('['):])


def alpha(path):
    return Image.open(ROOT / path).convert('RGBA').getchannel('A')


def foot_patch(channel, left, right):
    clip = channel.crop((left, 0, right, channel.height))
    visible = clip.point(lambda value: 255 if value > 42 else 0)
    _, _, _, bottom = visible.getbbox()
    pixels = visible.load()
    contact_x = [left+x for x in range(visible.width)
                 if sum(pixels[x, y] > 0 for y in range(max(0, bottom-12), bottom)) >= 2]
    return [round(median(contact_x) / channel.width, 4), round(bottom / channel.height, 4)]


records = {}
for skin in skins:
    family = skin['category']
    if family == 'slide':
        support = alpha(skin['supportSrc'])
        backing = alpha(skin['backSrc'])
        seam = backing.point(lambda value: 255 if value > 32 else 0).getbbox()[3] / backing.height
        records[skin['id']] = [round(seam, 4), *foot_patch(support, 0, 196), *foot_patch(support, 316, 512)]
    elif family in ('jump', 'cut', 'fire'):
        art = alpha(skin['src'])
        records[skin['id']] = foot_patch(art, 0, art.width)
with (ROOT / 'assets/visuals/obstacle-mount-data.js').open('w') as output:
    print('/* Source-alpha registration. Regenerate with scripts/register-obstacle-mounts.py. */', file=output)
    print('window.GRIM_OBSTACLE_MOUNTS={', file=output)
    for key, value in records.items():
        print(f'  {json.dumps(key)}:{json.dumps(value, separators=(",", ":"))},', file=output)
    print('};', file=output)
