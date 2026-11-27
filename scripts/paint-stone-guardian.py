"""Paint the articulated guardian from the Foothills' own weathered slate."""
from pathlib import Path
import random
from PIL import Image, ImageDraw, ImageOps, ImageFilter

root = Path(__file__).resolve().parents[1]
slate = Image.open(root / "assets/visuals/terrain/ground-foothills-v1.webp").convert("L")
cell = 192
sheet = Image.new("RGBA", (cell * 6, cell))
rng = random.Random(710)
# Contours and plate seams are authored on a 96px grid. Left faces catch moonlight.
parts = [
    # Torso with deep overlapping breastplates.
    ([(8,26),(21,12),(47,5),(73,12),(89,27),(84,54),(71,80),(45,94),(23,76),(13,59)],
     [[(9,28),(27,15),(50,11),(43,30),(27,49),(16,46)],
      [(30,50),(45,32),(52,11),(74,16),(68,40),(49,62)],
      [(16,48),(28,54),(45,70),(42,84),(26,74)],
      [(49,65),(71,42),(84,32),(77,56),(62,76),(48,88)]]),
    # Brow, projecting nose and recessed jaw, facing the runner.
    ([(5,32),(17,19),(15,6),(36,15),(52,9),(74,5),(70,18),(91,31),(87,59),(73,78),(51,92),(28,83),(17,66),(5,60),(12,44)],
     [[(7,32),(27,20),(54,17),(45,30),(25,38),(8,40)],
      [(48,32),(58,17),(77,18),(84,30),(68,42),(51,44)],
      [(12,46),(22,41),(29,56),(21,62),(7,58)],
      [(30,61),(47,49),(75,47),(67,69),(51,80),(34,76)],
      [(27,69),(35,79),(55,84),(51,89),(32,81)]]),
    # Shoulder mantle.
    ([(5,42),(15,24),(43,7),(67,12),(88,27),(93,48),(78,74),(54,88),(30,81),(13,66)],
     [[(7,40),(23,25),(48,12),(68,18),(54,38),(30,48)],
      [(16,51),(38,51),(58,41),(81,31),(76,51),(48,73),(23,71)]]),
    # Clenched hand, with separately chipped knuckles.
    ([(4,48),(12,31),(26,23),(44,12),(67,15),(88,32),(93,51),(82,67),(72,66),(60,80),(47,78),(37,85),(21,76),(9,66)],
     [[(9,45),(20,32),(33,29),(34,44),(20,60),(11,59)],
      [(23,59),(35,44),(44,25),(58,19),(55,44),(38,69),(29,73)],
      [(42,72),(59,47),(64,21),(79,30),(72,52),(56,73)],
      [(61,69),(76,53),(84,38),(88,49),(80,62),(71,64)]]),
    # Tall shin plates and a wedge-shaped foot.
    ([(18,12),(45,4),(73,12),(84,28),(69,55),(65,78),(44,93),(25,82),(24,59),(10,40)],
     [[(14,38),(24,16),(45,10),(57,18),(39,51),(25,55)],
      [(30,59),(45,50),(65,24),(71,35),(57,73),(41,85),(30,78)]]),
    ([(2,59),(18,42),(35,35),(52,12),(70,11),(87,33),(94,59),(85,76),(57,82),(22,84),(6,76)],
     [[(6,58),(21,44),(38,39),(56,19),(66,18),(56,43),(31,60)],
      [(13,65),(39,62),(60,46),(81,36),(83,54),(58,70),(23,75)]])
]
def points(poly):
    return [(2*x, 2*y) for x,y in poly]

for i,(outline,faces) in enumerate(parts):
    tile = Image.new("RGBA", (cell, cell))
    draw = ImageDraw.Draw(tile)
    def plate(poly, dark, light, edge):
        x,y = rng.randrange(800),rng.randrange(800)
        grain = slate.crop((x,y,x+300,y+300)).resize((cell,cell))
        grain = ImageOps.autocontrast(grain, cutoff=2)
        paint = ImageOps.colorize(grain, dark, light)
        mask = Image.new("L",tile.size)
        ImageDraw.Draw(mask).polygon(points(poly),fill=255)
        tile.paste(paint,(0,0),mask)
        draw.line(points(poly+[poly[0]]),fill=edge,width=3)
        draw.line(points(poly[:3]),fill="#a6a394",width=2)
    plate(outline,"#202329","#596268","#202531")
    for face in faces:
        plate(face,"#3a4145","#a6a598","#333a3c")
    # Oxidised mineral freckles and hairline fractures stay within the plates.
    for j in range(90):
        x,y=rng.randrange(cell),rng.randrange(cell)
        if tile.getpixel((x,y))[3] and all(tile.getpixel((min(cell-1,x+d),y))[3] for d in (2,4)):
            draw.line((x,y,x+2,y-1),fill=rng.choice(["#6c6756","#b6a784","#404642"]))
    if i==1:
        draw.polygon(points([(10,40),(34,34),(43,34),(32,45),(16,48)]),fill="#211f1b")
        draw.line(points([(13,43),(27,39),(35,38)]),fill="#f2bd64",width=5)
        draw.line(points([(14,42),(25,39)]),fill="#fff2c5",width=2)
    if i==3:
        draw.line(points([(46,23),(40,38),(48,46),(37,61),(38,71)]),fill="#282925",width=5)
    sheet.alpha_composite(tile,(i*cell,0))
sheet.save(root/"assets/campaign/stone-guardian.webp",lossless=True,method=6)
