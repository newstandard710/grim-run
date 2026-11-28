"""Paint the Colossus from the fractured stone of the Lava terrain."""
from pathlib import Path
import random

import numpy as np
from PIL import Image, ImageDraw, ImageOps

assets = Path(__file__).resolve().parents[1] / "assets"
width, height = 320, 288
tile = Image.new("RGBA", (width, height))
pen = ImageDraw.Draw(tile)
rock = Image.open(assets / "visuals/terrain/ground-lava-v1.webp").convert("L")
grain = np.asarray(ImageOps.autocontrast(rock.resize((width, height))), float)/255
y, x = np.mgrid[:height, :width]
rng = random.Random(710)


def stone(points, peak, shade):
    mask = Image.new("L", tile.size)
    ImageDraw.Draw(mask).polygon(points, fill=255)
    cx, cy = peak
    facet = np.clip(1 - abs(x-cx+(y-cy)*.19)/44, 0, 1)
    value = np.clip(.48*grain+.45*facet+.14*(1-y/height), 0, 1)
    color = np.array((27, 24, 34)) + np.array(shade)*value[:, :, None]
    tile.paste(Image.fromarray(color.astype("uint8")), (0, 0), mask)
    pen.line(points[:3], fill="#a48a83", width=2)


# Tilted hexagonal columns rise out of the shoulders like cooling lava pipes.
for i in reversed(range(8)):
    bx, by = 98+21*i, 99-i*9+rng.randrange(-9, 9)
    pts = [(bx-12, by+8), (bx-9, by), (bx+6, by-4), (bx+16, by+3),
           (bx+12, by+61), (bx-6, by+76), (bx-17, by+65)]
    stone(pts, (bx-8, by+30), (110, 92, 91))
    pen.polygon(pts[:4], fill="#897775")
    pen.line([(bx+5, by+5), (bx+3, by+25), (bx-1, by+42)], fill="#57404a", width=3)
# The chest is a hanging mass of overlapping, irregular armour around a hot core.
stone([(61,117),(95,84),(158,81),(217,102),(256,139),(244,193),
       (201,217),(178,261),(137,276),(99,229),(64,203),(46,155)],
      (99,132), (140,107,98))
for i in range(5):
    px, py = 84+i*28, 121+abs(i-2)*8
    stone([(px-19,py+5),(px-7,py-16),(px+15,py-13),(px+26,py-1),
           (px+14,py+54),(px-4,py+75),(px-15,py+41)], (px-3,py), (119,97,96))
    if i in (1,2,3):
        pen.line([(px-11,py+18),(px-2,py+35),(px-9,py+53),(px-5,py+60)],
                 fill="#c96540",width=4)
        pen.line([(px-2,py+35),(px-7,py+49)], fill="#ffd397",width=2)
# An undercut brow and projecting jaw give the sentinel a left-facing profile.
stone([(17,87),(32,59),(55,43),(91,46),(111,67),(100,98),
       (77,114),(68,139),(38,143),(29,130),(22,119),(31,109),(12,102)],
      (43,71),(154,121,107))
pen.polygon([(14,94),(54,81),(78,80),(62,98),(31,107)],fill="#251c27")
pen.line([(23,98),(48,90),(59,89)],fill="#ffdb94",width=5)
pen.line([(32,124),(48,125),(63,114)],fill="#543138",width=3)
tile.save(assets / "campaign/basalt-colossus.webp", quality=91, method=6)
