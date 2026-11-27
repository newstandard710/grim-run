"""Render the two wordless Forest cutaways from the game's painted art (Pillow, ffmpeg)."""
from math import sin
from pathlib import Path
from subprocess import Popen, PIPE
from PIL import Image, ImageDraw, ImageOps, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1] / 'assets'
W, H, FPS = 960, 540, 24
SIZE = W, H
RESAMPLE = Image.Resampling.LANCZOS


def sprite(path, height):
    art = Image.open(ROOT / path).convert('RGBA')
    art = art.crop(art.getbbox())
    return art.resize((round(height * art.width / art.height), height), RESAMPLE)


forest, hills = [Image.open(ROOT / f'visuals/biomes/{name}.webp').convert('RGB').resize(SIZE, RESAMPLE)
                for name in ('forest', 'foothills')]
reaper = sprite('characters/illustrated-v2/reaper/reaper_idle_v1.png', 139)
# Build a pair of interwoven, grounded root masses. The lower wood stays planted
# while the long branches unwind away from the opening.
wood = 'obstacles/slide-landforms/forest/'
limbs = [sprite(wood + name + '.webp', height) for name, height in
         [('root-shelf', 186), ('dead-bough-curtain', 181), ('thorn-canopy', 132)]]
for i, limb in enumerate(limbs):
    shade = ImageEnhance.Color(limb.convert('RGB')).enhance(.69)
    shade = ImageEnhance.Brightness(shade).enhance(.85)
    shade.putalpha(limb.getchannel('A'))
    limbs[i] = shade


def ease(t):
    t = max(0, min(1, t))
    return t*t*(3-2*t)


def pilgrim(picture, x, y, size, phase, opacity):
    """A travelling spirit has a face, a hood and two streaming cloth tails."""
    tile = Image.new('RGBA', (120, 80))
    d = ImageDraw.Draw(tile)
    wave = 4 * sin(phase)
    d.polygon([(76,31),(65,42),(47,49+wave),(25,47+wave),(4,54+wave),
               (26,41+wave),(51,41),(62,30)], fill=(150,130,215,174))
    d.polygon([(72,36),(66,49),(47,56-wave),(24,59-wave),(42,50-wave),
               (54,46),(60,31)], fill=(207,192,239,214))
    d.polygon([(55,43),(61,29),(61,21),(65,23),(71,13),(75,21),(79,20),(82,29),(79,36),(70,42)], fill=(234,225,250,252))
    d.polygon([(70,29),(78,26),(76,32),(71,35)], fill=(107,91,147,255))
    d.point((77,29), fill=(255,255,255,255))
    glow = tile.filter(ImageFilter.GaussianBlur(5))
    glow.alpha_composite(tile)
    glow = glow.resize((round(120*size),round(80*size)), RESAMPLE)
    glow.putalpha(glow.getchannel('A').point(lambda a: round(a*opacity)))
    picture.alpha_composite(glow, (round(x-72*size),round(y-29*size)))


def roots(picture, openness):
    for side in (1, -1):
        pivot = 548 if side == 1 else 707
        for i, (limb, dx, floor, angle) in enumerate(zip(limbs, [15,3,2], [391,387,385], [0,38,62])):
            bend = (-8 + openness*(13+i*7) + angle*.40) * side
            # Register each painted root at its outer lower corner before rotation.
            image = ImageOps.mirror(limb) if side == 1 else limb
            anchor = (image.width*(.18 if side==1 else .82), image.height*.93)
            pad = 300
            layer = Image.new('RGBA', (pad*2,pad*2))
            layer.alpha_composite(image,(round(pad-anchor[0]),round(pad-anchor[1])))
            layer = layer.rotate(bend, Image.Resampling.BICUBIC, center=(pad,pad))
            x = pivot + side*(dx-openness*174)
            picture.alpha_composite(layer,(round(x-pad),floor-pad))


def render(ending, t):
    opened = ease((t-.20)/1.38) if ending else 1-ease((t-1.95)/.92)
    picture = Image.blend(forest, hills, opened*.95 if ending else .03).convert('RGBA')
    # The souls cross the threshold in depth, then dwindle into the ridgeline.
    for i in range(3):
        age = (t-(.64 if ending else -.13)-i*.30)/(2.22 if ending else 1.62)
        if not 0 <= age <= 1:
            continue
        p = ease(age)
        if ending:
            x, y = 610+169*p, 322-151*p
            size = 1.02-.68*p
        else:
            x, y = 365+279*p, 317-66*p
            size = 1.1-.72*p
        fade = min(1, age*10, (1-age)*8)
        pilgrim(picture, x, y+sin(age*9+i)*8, size, age*11+i, fade)
    roots(picture, opened)
    picture.alpha_composite(reaper,(211,396-reaper.height+round(sin(t*2)*.7)))
    # A slow push towards the gap keeps the subjects inside the phone-safe frame.
    inset = round(7*ease(t/3.6))
    if inset:
        picture = picture.crop((inset,inset,W-inset,H-inset)).resize(SIZE, RESAMPLE)
    return picture.convert('RGB')


def encode(name, duration):
    target = ROOT / 'campaign' / (name+'.webm')
    cmd = ['ffmpeg','-loglevel','error','-y','-f','rawvideo','-pixel_format','rgb24',
           '-video_size',f'{W}x{H}','-framerate',str(FPS),'-i','pipe:0','-an','-pix_fmt','yuv420p',
           '-c:v','libvpx-vp9','-b:v','0','-crf','34','-row-mt','1','-threads','3',str(target)]
    with Popen(cmd, stdin=PIPE) as proc:
        for frame in range(round(duration*FPS)):
            proc.stdin.write(render(name=='passage-open', frame/FPS).tobytes())
        proc.stdin.close()
        if proc.wait():
            raise RuntimeError(f'Encoding failed for {target}')


if __name__ == '__main__':
    encode('passage-sealed', 3.25)
    encode('passage-open', 3.75)
