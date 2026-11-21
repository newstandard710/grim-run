"""Paint the three registered surface layers at twice gameplay resolution."""
from pathlib import Path
from random import Random
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
W, H, SCALE = 64, 32, 4
BIOMES = ('forest', 'foothills', 'tundra', 'caves', 'crystals', 'ashlands', 'lava', 'boss')
# Shadow, body, broken edge light, and mineral/organic accent.
COLORS = [
    ('#292c22', '#51553b', '#88815d', '#794845'),
    ('#2b3235', '#505763', '#86909a', '#795453'),
    ('#434e5e', '#7b8c9c', '#bdc7ca', '#687781'),
    ('#292a37', '#4a4b57', '#79747a', '#665c52'),
    ('#2c313e', '#485569', '#8093a4', '#766982'),
    ('#292428', '#51454a', '#827377', '#40373c'),
    ('#251e22', '#453638', '#72605a', '#694a41'),
    ('#302a31', '#50454c', '#82716e', '#62575a'),
]


def paint(biome, variant, layer):
    rng = Random(1031 + 141 * biome + 17 * variant + layer)
    im = Image.new('RGBA', (W*SCALE, H*SCALE))
    draw = ImageDraw.Draw(im)
    dark, mid, light, accent = COLORS[biome]

    def points(coords):
        return [(round(x*SCALE), round(y*SCALE)) for x, y in coords]

    def poly(coords, color):
        draw.polygon(points(coords), fill=color)

    def stroke(coords, color, weight=.6):
        draw.line(points(coords), fill=color, width=max(1, round(weight*SCALE)), joint='curve')

    def chip(x, y, w, h, color=mid):
        crown = x + w*rng.uniform(-.12, .17)
        ridge = y-h*rng.uniform(.36, .66)
        poly([(x-w*.55,y-.3),(x-w*.27,y-h*.8),(crown,y-h),
              (x+w*.38,ridge),(x+w*.5,y),(x-w*.17,y+.8)], dark)
        poly([(x-w*.5,y-.4),(x-w*.25,y-h*.78),(crown,y-h),
              (x+w*.35,ridge),(x+w*.03,ridge+.6)], color)
        stroke([(x-w*.23,y-h*.76),(crown,y-h+.3),(crown+w*.12,y-h*.79)],light,.48)

    def leaf(x, y, w, h):
        poly([(x-w*.5,y),(x-w*.28,y-h*.65),(x+w*.12,y-h),
              (x+w*.48,y-h*.63),(x+w*.32,y-.45),(x,y+.3)], '#472e32')
        poly([(x-w*.42,y-.4),(x-w*.22,y-h*.68),(x+w*.12,y-h),
              (x+w*.4,y-h*.67),(x,y-h*.36)], accent)
        stroke([(x-w*.42,y),(x,y-h*.4),(x+w*.16,y-h*.72)], '#97675a',.48)

    def grass(x, y, h, spread, count, dry=False):
        for i in range(count):
            base = x + rng.uniform(-spread,spread)
            tip = base + rng.uniform(-.46,.8)*h + (.32*h if dry else 0)
            top = y-h*rng.uniform(.38,1)
            knee = (base*.69+tip*.31, y*.48+top*.52)
            color = rng.choice([mid, mid, dark, '#626547' if not dry else '#726a5a'])
            poly([(base-1.05,y), (knee[0]-.7,knee[1]), (tip,top),
                  (knee[0]+.35,knee[1]+.6), (base+.8,y)],color)
            if i%3==0:
                stroke([(base,y-.5),knee,(tip,top)],light,.43)
            if dry and i%4==0:
                stroke([knee,(tip-2.4,top+2.6)],accent,1.15)
    if layer == 0:  # Material lying on the inclined shoulder.
        for _ in range(9 if biome != 7 else 4):
            x,y = rng.uniform(6,58),rng.uniform(11,19)
            w = rng.uniform(2.5,8.5)
            if biome==0:
                if rng.random()<.4: leaf(x,y,w,rng.uniform(1.5,3))
                else:
                    poly([(x-w,y),(x-w*.45,y-1.4),(x+w*.15,y-2),(x+w,y-.5),(x+.5*w,y+.6)],mid)
            elif biome in (2,5):
                stroke([(x-w,y+1),(x-w*.15,y),(x+w*.28,y+.2),(x+w,y-1.1)],mid,1.15)
                stroke([(x-w*.24,y+.2),(x+w*.38,y-.3)],light,.47)
            else: chip(x,y,w,rng.uniform(1,2.2),accent if rng.random()<.35 else mid)
        if biome in (0,5,7):
            x=rng.uniform(13,24)
            stroke([(x,16),(x+7,14),(x+15,14.3),(x+21,12.4)],dark,1.5)
            stroke([(x+7,13.8),(x+14,14)],accent,.65)
    elif biome in (0,1):
        if layer==1 or (biome==0 and variant%2==0):
            grass(32,24, (14+variant*.9) if layer==1 else 7, 6 if layer==1 else 3,
                  14 if layer==1 else 6,dry=biome==1)
        elif biome==0: leaf(32,24,9,4.8)
        else: chip(32,24,10,3.4)
    elif biome==2:
        if layer==1 and variant==0: grass(30,24,7,4,5,True)
        chip(32,24,22 if layer==1 else 12,4.5 if layer==1 else 2.5)
        stroke([(24 if layer==1 else 28,22.8),(31,21),(35,21.5)],'#b2bdc5',1)
    elif biome==5:
        if layer==1:
            chip(28,24,13,3.1,accent)
            stroke([(24,24),(30,21),(34,16),(38,14)],dark,1.8)
            stroke([(33,17.5),(31,15.3)],mid,.8)
        else:
            for x in (29,31,34):
                chip(x,24+rng.uniform(-.4,.4),rng.uniform(4,7),rng.uniform(1.4,2.4))
    else:
        height={3:5.5,4:7,6:4.6,7:3.8}[biome]
        chip(32,24,16 if layer==1 else 9.5,height if layer==1 else height*.56,
             accent if biome==4 and variant%2 else mid)
        if layer==1: chip(24,24.5,8,height*.48)
    return im.resize((W*2,H*2),Image.Resampling.LANCZOS)


sheet=Image.new('RGBA',(W*2*12,H*2*len(BIOMES)))
for row in range(len(BIOMES)):
    for variant in range(4):
        for layer in range(3):
            sheet.paste(paint(row,variant,layer),((variant*3+layer)*W*2,row*H*2))
sheet.save(ROOT/'assets/visuals/surface-dressing.png', optimize=True)
