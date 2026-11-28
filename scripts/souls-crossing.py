"""Render the finale with the painted Reaper and the spirits from the Forest opening."""
from math import sin
from pathlib import Path
import runpy
import subprocess

from PIL import Image, ImageDraw, ImageOps

forest = runpy.run_path(str(Path(__file__).with_name("forest-passage.py")))
assets, pilgrim, ease = (forest[key] for key in ("ROOT", "pilgrim", "ease"))
size = (672, 400)
castle = ImageOps.fit(Image.open(assets / "visuals/biomes/boss-castle.webp").convert("RGB"), size)
dawn = ImageOps.fit(Image.open(assets / "visuals/biomes/foothills.webp").convert("RGB"), size)
reaper = forest["sprite"]("characters/illustrated-v2/reaper/reaper_idle_v1.png", 148)


def render(t):
    opening = ease((t-.35)/1.25)
    frame = Image.blend(castle, dawn, .18*opening).convert("RGBA")
    # The pale country beyond the iron gate becomes visible between its leaves.
    slit = round(95*opening)
    if slit:
        rect = (381-slit, 70, 381+slit, 306)
        frame.paste(dawn.crop(rect), rect[:2])
    pen = ImageDraw.Draw(frame)
    for side in (-1, 1):
        x = 381+side*slit
        for i in range(8):
            bar = x+side*(i*12*(1-opening)+1)
            pen.line([(bar, 70), (bar, 305)], fill='#4a3b48', width=4)
        pen.line([(x, 75), (x, 305)], fill='#d0a776', width=4)
    for i in range(9):
        age = (t-.6-i*.32)/2.45
        if 0 < age < 1:
            a = ease(age)
            pilgrim(frame, 144+257*a, 284-105*a+sin(age*10+i)*9,
                    .92-.68*a, t*4+i, min(1, age*8, (1-age)*7))
    # The Reaper yields the foreground path as the Souls pass through.
    frame.alpha_composite(reaper, (round(185-82*ease((t-.24)/1.26)), 326-reaper.height))
    return frame.convert("RGB")


command = ["ffmpeg", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
           "-s", "672x400", "-r", "20", "-i", "-", "-an", "-c:v", "libvpx-vp9", "-threads", "3",
           "-crf", "35", "-b:v", "0", "-pix_fmt", "yuv420p", str(assets / "campaign/souls-crossing.webm")]
with subprocess.Popen(command, stdin=subprocess.PIPE) as encoder:
    for frame_number in range(120):
        encoder.stdin.write(render(frame_number/20).tobytes())
    encoder.stdin.close()
    if encoder.wait():
        raise RuntimeError("Souls crossing encoding failed")
