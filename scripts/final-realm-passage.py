"""Render the lava cooling to black glass as the gate beyond it emerges."""
from pathlib import Path
import subprocess

import numpy as np
from PIL import Image, ImageOps

assets = Path(__file__).resolve().parents[1] / "assets"
width, height = 672, 400


def landscape(name):
    source = Image.open(assets / "visuals/biomes" / name).convert("RGB")
    return np.asarray(ImageOps.fit(source, (width, height)), dtype=float)


river = landscape("lava-ravine-v1.webp")
gate = landscape("boss-castle-ravine-v1.webp")
y, x = np.mgrid[:height, :width]
radius = np.hypot((x - width*.63)*.91, y-height*.39)
command = ["ffmpeg", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
           "-s", f"{width}x{height}", "-r", "20", "-i", "-", "-an", "-c:v", "libvpx-vp9",
           "-crf", "38", "-b:v", "0", "-pix_fmt", "yuv420p", str(assets / "campaign/final-realm-passage.webm")]
with subprocess.Popen(command, stdin=subprocess.PIPE) as encoder:
    for frame in range(76):
        t = np.clip((frame-6)/60, 0, 1)
        cooled = river * (1 - .68*np.clip(t*3, 0, 1))
        edge = 570*t-45-radius+8*np.sin(y/12+x/33)
        reveal = np.clip(edge/32, 0, 1)[:, :, None]
        color = cooled*(1-reveal)+gate*reveal
        encoder.stdin.write(np.uint8(np.clip(color, 0, 255)).tobytes())
    encoder.stdin.close()
    if encoder.wait():
        raise RuntimeError("Final realm passage encoding failed")
