"""Carve the Frost Crown and its smaller wisp from the Tundra's painted ice."""
from pathlib import Path
from random import Random

from PIL import Image, ImageDraw, ImageOps

root = Path(__file__).resolve().parents[1]
grain = Image.open(root / "assets/visuals/terrain/ground-tundra-v3.webp").convert("L")
rng = Random(391)
cell = 256
atlas = Image.new("RGBA", (cell * 2, cell))

def facet(points, dark, light, rim):
    left = rng.randrange(grain.width - 180)
    top = rng.randrange(grain.height - 180)
    texture = grain.crop((left, top, left + 180, top + 180)).resize((cell, cell))
    texture = ImageOps.colorize(ImageOps.autocontrast(texture), dark, light)
    mask = Image.new("L", (cell, cell))
    ImageDraw.Draw(mask).polygon(points, fill=255)
    tile.paste(texture, (0, 0), mask)
    draw.line(points[:2], fill=rim, width=2)

# Chipped translucent blades around a hollow, lantern-like mineral heart.
for frame in range(2):
    tile = Image.new("RGBA", (cell, cell))
    draw = ImageDraw.Draw(tile)
    shards = [(61,134,9,52,96,108), (87,102,48,21,105,85),
              (105,83,90,6,126,74), (69,151,30,116,86,145),
              (100,176,62,215,117,158), (116,188,108,242,132,165)]
    if frame:
        shards = [(67,119,12,62,105,108),(91,151,37,192,116,143),
                  (107,87,89,31,126,100)]
    for mirror in (False, True):
        def pts(*points):
            return [(256-x if mirror else x, y) for x,y in points]
        for bx,by,tx,ty,ex,ey in shards:
            mx,my=(bx+2*ex+tx)//4,(by+2*ey+ty)//4
            facet(pts((tx,ty),(bx,by),(ex,ey)), "#16263b","#85adc0","#daffff")
            facet(pts((tx,ty),(mx,my),(bx,by)), "#658b9a","#d4eee9","#e9ffff")
            facet(pts((mx,my),(ex,ey),(bx,by)), "#293954","#8199a7","#a9cdc9")
        facet(pts((59,116),(98,80),(129,92),(112,135),(83,149)),
              "#243449","#c9dcdd","#d3edef")
        facet(pts((69,120),(108,109),(120,126),(95,130)),
              "#102338","#294759","#8ab9ce")
        facet(pts((73,141),(101,152),(122,170),(109,186),(92,165)),
              "#21344b","#adc6cc","#d7edf0")
    facet([(128,146),(141,163),(128,205),(115,163)],"#243a4b","#adcdcf","#cde3df")
    atlas.alpha_composite(tile,(frame*cell,0))
atlas.save(root / "assets/campaign/frost-crown.webp", lossless=True, method=6)
