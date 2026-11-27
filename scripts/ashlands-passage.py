"""Wind strips the ash from the valley to reveal the lava river below."""
from pathlib import Path
import subprocess

import numpy as np
from PIL import Image, ImageOps

assets = Path(__file__).resolve().parents[1] / "assets"
width, height = 672, 400
def landscape(name):
    image = Image.open(assets / "visuals/biomes" / name).convert("RGB")
    return np.asarray(ImageOps.fit(image, (width, height)), dtype=float)

ash = landscape("ashlands-ravine-v1.webp")
lava = landscape("lava-ravine-v1.webp")
y, x = np.mgrid[:height, :width]
command = ["ffmpeg", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
           "-s", f"{width}x{height}", "-r", "20", "-i", "-", "-an", "-c:v", "libvpx-vp9",
           "-crf", "38", "-b:v", "0", "-pix_fmt", "yuv420p", str(assets / "campaign/lava-passage.webm")]
with subprocess.Popen(command, stdin=subprocess.PIPE) as encoder:
    for frame in range(76):
        t = np.clip((frame-6)/61, 0, 1)
        edge = -130 + (width+260)*t - .18*(y-height/2) + 24*np.sin(y/46+t*6)
        distance = edge-x
        reveal = np.clip((distance+23)/46, 0, 1)[:, :, None]
        color = ash*(1-reveal) + lava*reveal
        glow = np.exp(-abs(distance)/13)*(.4+.4*np.sin(x*.08+y*.35+t*20)**2)
        color += glow[:, :, None]*[114, 53, 16]
        encoder.stdin.write(np.uint8(np.clip(color, 0, 255)).tobytes())
    encoder.stdin.close()
    if encoder.wait():
        raise RuntimeError("Lava passage encoding failed")
