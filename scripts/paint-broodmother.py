"""Paint a closed and exposed Broodmother carapace. Legs and silk move in-game."""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageOps

root = Path(__file__).resolve().parents[1]
size = 256
yy, xx = np.mgrid[:size, :size]
grain = Image.open(root / 'assets/visuals/terrain/ground-caves-v1.webp').convert('L')
grain = np.asarray(ImageOps.autocontrast(grain.resize((size, size))), float) / 255
atlas = Image.new('RGBA', (size * 2, size))

def plate(points, center, radii, dark, light, edge):
    mask = Image.new('L', (size, size))
    pen = ImageDraw.Draw(mask)
    pen.polygon(points, fill=255)
    x, y = (xx-center[0])/radii[0], (yy-center[1])/radii[1]
    dome = np.sqrt(np.maximum(0, 1-x*x-y*y))
    value = np.clip(.12+.60*dome-.22*x-.16*y+.34*(grain-.5), 0, 1)
    color = np.array(dark)+(np.array(light)-dark)*value[:,:,None]
    tile.paste(Image.fromarray(color.astype('uint8')), (0, 0), mask)
    pen = ImageDraw.Draw(tile)
    pen.line(points[:3], fill=edge, width=2)

for opened in (False, True):
    tile = Image.new('RGBA', (size, size))
    pen = ImageDraw.Draw(tile)
    for side in (-1, 1):
        def mirror(points):
            return [(128+side*x,y) for x,y in points]
        # Tall hooked spines and small secondary teeth around the outer shield.
        for x,y,length in [(36,75,48),(57,88,33),(66,108,22)]:
            plate(mirror([(x-9,y+13),(x+7,y-length//2),(x+19,y-length),
                          (x+14,y-6),(x+2,y+17)]),(128+side*x,y),(23,49),
                  (26,21,34),(166,144,146),(211,193,171))
    for side in (-1, 1):
        offset = 10 if opened else 0
        # Each overlapping lamella catches a narrow rim of cave light.
        for i in range(5):
            y = 65+i*17
            width = [43,59,65,60,48][i]
            points = [(3+offset,y-12),(width*.68+offset,y-19),(width+offset,y-2),
                      (width+offset-5,y+17),(width*.58+offset,y+26),(5+offset,y+11)]
            plate(mirror(points),(128+side*(width*.45+offset),y),(width*.82,30),
                  (33,22,36),(156,107+i*4,112+i*4),(192,159,144))
            pen.line(mirror([(width*.92+offset,y+1),(width*.63+offset,y+11),
                             (width*.43+offset,y+9)]),fill=(205,162,134),width=2)
    core = [(128,69),(138,96),(136,125),(128,148),(120,125),(118,96)]
    plate(core,(126,104),(14,49),(37,21,31),(255,188,105) if opened else (125,77,79),
          (255,226,144) if opened else (173,133,119))
    for side in (-1,1):
        plate(mirror([(5,158),(26,145),(36,161),(34,181),(16,211),(20,184),(11,177)]),
              (128+side*24,168),(19,37),(49,35,44),(207,174,133),(230,200,158))
    plate([(89,153),(106,135),(127,142),(151,135),(170,153),(161,178),(129,191),(98,178)],
          (123,156),(48,31),(25,21,31),(125,96,109),(192,155,151))
    for side in (-1,1):
        for x,y,r in [(11,166,7),(26,159,4),(34,152,3)]:
            x = 128 + side*x
            pen.ellipse((x-r-2,y-r-2,x+r+2,y+r+2),fill='#261c28')
            pen.ellipse((x-r,y-r,x+r,y+r),fill='#ba7753')
            pen.ellipse((x-r//2,y-r,x+r//2,y+2),fill='#ffdf9b')
            pen.point((x-1,y-r+1),fill='#fff6cd')
    atlas.alpha_composite(tile,(size*opened,0))
atlas.save(root / 'assets/campaign/broodmother.webp', lossless=True, method=6)
