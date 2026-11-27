"""Render the Sentinel's broken facets opening on the Ashlands."""
from pathlib import Path
import subprocess
import numpy as np
from PIL import Image, ImageOps

assets = Path(__file__).resolve().parents[1] / "assets"
width, height = 672, 400
def backdrop(name):
    image = Image.open(assets / "visuals" / "biomes" / name).convert("RGB")
    return np.asarray(ImageOps.fit(image, (width, height)), dtype=float)

glass = backdrop("deep-underground-ravine-v1.webp")
ash = backdrop("ashlands-ravine-v1.webp")
y, x = np.mgrid[:height, :width]
seam = np.interp(np.arange(height), [0, 74, 163, 228, 342, 399], [305, 325, 294, 344, 315, 330])[:, None]
process = subprocess.Popen(["ffmpeg", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
    "-s", f"{width}x{height}", "-r", "20", "-i", "-", "-an", "-c:v", "libvpx-vp9", "-b:v", "0",
    "-crf", "38", "-pix_fmt", "yuv420p", str(assets / "campaign/ashlands-passage.webm")], stdin=subprocess.PIPE)
for frame in range(70):
    t = np.clip((frame - 9) / 48, 0, 1)
    opening = int(width * .66 * t * t * (3 - 2*t))
    distance = np.abs(x-seam) - opening
    source_x = np.clip(x - np.where(x < seam, -opening, opening), 0, width-1)
    color = np.where((distance < 0)[:, :, None], ash, glass[y, source_x])
    glow = np.exp(-np.abs(distance) / 4) * min(1, frame/8)
    color = color + glow[:, :, None] * [180, 104, 45]
    process.stdin.write(np.uint8(np.clip(color, 0, 255)).tobytes())
process.stdin.close()
if process.wait():
    raise RuntimeError("Passage encoding failed")
