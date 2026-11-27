"""Paint the Keeper's scorched linen, funeral mask, and bronze censer crown."""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageOps

assets = Path(__file__).resolve().parents[1] / "assets"
size = 256
yy, xx = np.mgrid[:size, :size]
char = Image.open(assets / "visuals/terrain/ground-ashlands-v1.webp").convert("L")
grain = np.asarray(ImageOps.autocontrast(char.resize((size, size))), float)/255 - .5
tile = Image.new("RGBA", (size, size))
pen = ImageDraw.Draw(tile)

def fold(points, ridge, span, dark, light):
    mask = Image.new("L", (size, size))
    ImageDraw.Draw(mask).polygon(points, fill=255)
    distance = abs(xx-ridge[0]-(yy-ridge[1])*ridge[2]) / span
    value = np.clip(.06+.91*np.exp(-distance**1.4)+.29*grain, 0, 1)
    rgb = np.array(dark) + (np.array(light)-dark)*value[:, :, None]
    tile.paste(Image.fromarray(rgb.astype("uint8")), (0, 0), mask)

cloth, silk, metal, gold = (28,24,32), (107,80,83), (56,38,43), (200,143,94)
# Wind carries the longest tatters away from the Reaper, exposing the ribs.
for i, (x,y,slant) in enumerate([(91,213,-.21),(102,237,-.12),(114,225,.09),
                                 (132,232,.17),(151,212,.23),(162,224,.35)]):
    fold([(125,100),(x+11,128),(x+21,165),(x+13,y-20),(x+21,y-9),
          (x+9,y),(x+2,y-29),(x-9,y-4),(x-13,159)], (x+4,168,slant), 14, cloth, silk)
# Two arms of a cast, blackened crown. Their lit edges have small broken teeth.
for x,sign in [(110,-1),(155,1)]:
    for i in range(3):
        w=10+i*3
        px=x+sign*i*9; py=75+i*6
        fold([(px-sign*6,py+15),(px+sign*4,py-11),(px+sign*w,py-41+i*3),
              (px+sign*(w+3),py-49+i*3),(px+sign*(w+4),py-17),(px+sign*11,py+11)],
             (px+sign*9,py-9,-sign*.29),6,metal,gold)
# The hood is asymmetric in profile. The left seam rims the carved ivory mask.
fold([(83,117),(85,89),(97,63),(122,48),(145,50),(162,66),(167,98),(180,122),
      (153,146),(115,131)],(115,79,-.52),30,cloth,(147,100,84))
fold([(87,89),(105,69),(127,63),(140,78),(130,108),(115,131),(98,122)],
     (111,86,-.35),17,(20,19,27),(70,49,48))
fold([(89,90),(101,79),(117,76),(131,80),(127,91),(122,98),(119,111),
      (108,123),(97,120),(98,108),(88,106),(86,100)],(101,87,-.22),19,
     (94,70,63),(230,202,160))
pen.polygon([(88,94),(104,91),(99,99),(90,99)],fill="#30252a")
pen.polygon([(108,92),(122,86),(116,95),(107,98)],fill="#33262b")
pen.line([(91,95),(98,94)],fill="#ffce84",width=2)
pen.line([(110,94),(118,90)],fill="#ffda95",width=2)
pen.line([(104,97),(100,106),(104,107)],fill="#8b6857",width=2)
pen.line([(96,112),(103,114),(114,109)],fill="#694d49",width=2)
for k in range(3):
    pen.line([(99+k*4,110),(100+k*4,117)],fill="#896b59",width=1)
fold([(135,73),(151,83),(155,109),(171,126),(158,151),(134,131),(122,115)],
     (141,98,.28),17,cloth,silk)
fold([(83,103),(93,119),(115,129),(132,122),(155,104),(172,109),(189,137),
      (178,150),(148,142),(124,150),(101,141),(77,145),(61,156),(67,130)],
     (88,124,-.6),26,metal,(155,108,83))
for y,w in [(128,31),(134,26),(140,21)]:
    pen.line([(108-w,y-9),(106,y+4),(120,y+8),(141+w//2,y-5)],
             fill="#c18e68",width=2)
# A deep furnace behind overlapping bronze ribs.
pen.ellipse((109,143,139,177),fill="#493139")
pen.ellipse((114,148,134,174),fill="#e1783c")
pen.ellipse((118,152,128,167),fill="#ffdc92")
for i in range(4):
    y=145+i*8
    pen.line([(99+i,y-3),(111,y+4),(124,y+7),(146-i,y-5)],fill="#423239",width=5)
    pen.line([(99+i,y-4),(112,y+2),(123,y+4)],fill="#cc9c70",width=2)
for x,y in [(84,124),(154,119),(120,138)]:
    pen.ellipse((x-4,y-4,x+4,y+4),fill="#50363a",outline="#dbae79",width=2)
tile.save(assets / "campaign/cinder-keeper.webp", lossless=True, method=6)
