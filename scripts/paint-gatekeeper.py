"""Paint the Last Gate's articulated iron armour from the realm's stone grain."""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageOps

assets = Path(__file__).resolve().parents[1] / 'assets'
size = (240, 280)
yy, xx = np.mgrid[:size[1], :size[0]]
grain = Image.open(assets / 'visuals/terrain/ground-boss-v1.webp').convert('L')
grain = np.asarray(ImageOps.autocontrast(grain.resize(size)), float)/255-.5
body = Image.new('RGBA', size)
draw = ImageDraw.Draw(body)
steel, silver = (33, 31, 43), (155, 152, 155)
bronze, gilt = (61, 41, 43), (220, 174, 104)
cloth, wine = (34, 24, 34), (122, 66, 80)


def plate(points, ridge, shades, width=10, slope=-.2):
    mask = Image.new('L', size)
    ImageDraw.Draw(mask).polygon(points, fill=255)
    ox, oy = points[0]
    distance = np.abs(xx-ridge-slope*(yy-oy))
    value = np.clip(.12+.82*np.exp(-(distance/width)**1.25)+.27*grain, 0, 1)
    dark, light = map(np.array, shades)
    body.paste(Image.fromarray((dark+value[:, :, None]*(light-dark)).astype('uint8')), (0, 0), mask)
    draw.line(points+[points[0]], fill='#352c37', width=2)


def trim(points, color='#d5aa7b', width=2):
    draw.line(points, fill=color, width=width)


# The split mantle frames greaves, articulated knees and square iron sabatons.
plate([(117,83),(158,88),(178,142),(180,197),(204,242),(173,232),(160,252),(138,221),
       (117,234),(84,248),(103,180),(90,125)], 146, (cloth,wine), 24, .31)
for x, shift in [(113,-12),(144,12)]:
    plate([(x-14,162),(x+12,161),(x+9,207),(x+shift+8,243),(x+shift-12,244),(x-12,208)],x-5,(steel,silver))
    plate([(x-13,191),(x+3,184),(x+14,197),(x+5,211),(x-11,208)],x-5,(bronze,gilt))
    plate([(x+shift-9,237),(x+shift+8,236),(x+shift+13,251),(x+shift-19,254),
           (x+shift-27,249),(x+shift-21,243)],x+shift-10,(steel,silver))
for i in range(3):
    y=150+i*10
    plate([(91+i*3,y),(145,y-4),(155,y+9),(129,y+22),(91+i*3,y+14)],114,(steel,silver),22)
    trim([(95+i*3,y+12),(128,y+18),(151,y+8)],'#bda17d')
# Convex breastplate, recessed keyhole and gorget.
plate([(95,88),(140,85),(158,102),(150,139),(126,159),(96,147),(86,115)],109,(steel,silver),19)
for x,y in [(88,111),(143,105),(140,132),(94,134)]:
    draw.ellipse((x-2,y-2,x+2,y+2),fill='#d9af7c')
for i in range(3):
    trim([(94,110+i*9),(117,120+i*9),(141,105+i*9)],'#746365',3)
draw.ellipse((108,114,125,131),fill='#373242',outline='#dca66b',width=3)
trim([(117,123),(117,135)],'#dfb77f',3)
for x,side in [(89,-1),(146,1)]:
    plate([(x-14,93),(x+8,84),(x+side*27,93),(x+side*35,115),(x+side*25,120),
           (x,111),(x-7,114)],x+side*11,(steel,silver),12,side*.38)
    trim([(x+side*32,113),(x+side*23,116),(x,108)],'#d8b080')
    plate([(x+side*16-8,115),(x+side*16+9,114),(x+side*19+11,151),
           (x+side*19+4,161),(x+side*19-7,154)],x+side*19-3,(steel,silver))
# A key-shaped halberd, angled behind the warding hand.
trim([(168,208),(184,60)],'#3a333e',7);trim([(166,206),(182,60)],'#b1997e')
plate([(181,79),(171,70),(169,51),(180,60),(186,42),(192,35),(190,65),
       (202,60),(197,73)],181,(bronze,gilt),9)
# A closed helm with a narrow eye-slit, fluted bevor and a key-bit crown.
plate([(90,62),(98,45),(120,38),(139,47),(142,70),(131,88),(111,99),(95,86),(87,75)],108,(steel,silver),16)
plate([(85,65),(99,60),(126,60),(134,66),(118,74),(96,77),(87,73)],100,(bronze,gilt),23)
trim([(89,69),(100,70),(115,66)],'#221d2b',5)
trim([(89,68),(102,69),(111,66)],'#c2faf1')
for i in range(4):
    trim([(98+i*5,77),(100+i*5,86-i)],'#443b46',2)
for x,h in [(93,22),(107,12),(126,17),(139,26)]:
    plate([(x-4,53),(x-6,h),(x-1,h+4),(x+3,h-5),(x+7,h+1),(x+5,51)],x-2,(bronze,gilt),5)
trim([(91,50),(107,54),(138,45)],'#cfa26e',4)
# Kite shield is a separate layer so the hinge exposes the strike point.
shield = Image.new('RGBA',size)
body, knight = shield, body
draw = ImageDraw.Draw(body)
outline=[(69,102),(90,95),(111,105),(109,137),(94,161),(82,172),(68,154),(60,129)]
plate(outline,80,(bronze,gilt),16)
plate([(72,107),(89,101),(105,109),(103,137),(84,163),(72,150),(66,129)],80,(steel,silver),10)
trim([(84,153),(84,117),(92,111)],'#d4ac75',3)
draw.ellipse((77,116,91,130),outline='#edc28b',width=3)
for x,y in [(72,109),(102,110),(83,156)]:
    draw.ellipse((x-2,y-2,x+2,y+2),fill='#e9cba1')
for name,picture in [('gatekeeper',knight),('gatekeeper-shield',shield)]:
    picture.save(assets/'campaign'/(name+'.webp'),lossless=True,method=6)
