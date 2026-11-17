"""Derive frost chips and registered hit-flash cels from released game art."""

from pathlib import Path

from PIL import Image, ImageChops, ImageOps


ASSETS = Path(__file__).resolve().parents[1] / "assets"
FRAGMENTS = ASSETS / "world-polish/v0153"
ENEMIES = ASSETS / "enemies/illustrated-v2"


def frost_chips():
    original = Image.open(FRAGMENTS / "cut-fragments.png").convert("RGBA")
    assert original.size == (384, 384)
    crystal = original.crop((0, 192, 384, 288))
    luminance = ImageOps.grayscale(crystal)
    # A cool highlight with limited chroma keeps ice distinct from purple crystal.
    luminance = luminance.point(lambda value: min(255, (value // 20) * 21 + 22))
    frost = ImageOps.colorize(luminance, "#153c58", "#f3fbff")
    frost.putalpha(crystal.getchannel("A").point(lambda value: 255 if value > 245 else round(value / 4) * 4))
    atlas = Image.new("RGBA", (384, 480))
    atlas.paste(original, (0, 0))
    atlas.paste(frost, (0, 384))
    atlas.save(FRAGMENTS / "cut-fragments-v2.png", optimize=True)


def muted_red(cel):
    luminance = ImageOps.grayscale(cel)
    red = ImageOps.colorize(luminance, "#642226", "#ff7970")
    paint = Image.blend(cel.convert("RGB"), red, .44)
    paint.putalpha(cel.getchannel("A"))
    return paint


def flash_cels():
    skeleton = Image.open(ENEMIES / "skeletal-bat/skeletal_bat_atlas_v1.png").convert("RGBA")
    imp = Image.open(ENEMIES / "ember-imp/ember_imp_atlas_v1.png").convert("RGBA")
    twins = Image.open(ENEMIES / "ground-inbetweens.webp").convert("RGBA")
    assert (skeleton.size, imp.size, twins.size) == ((1254, 1254), (768, 512), (768, 384))
    atlas = Image.new("RGBA", (1024, 256))

    def place(src, box, slot, scale, origin):
        cel = src.crop(box)
        ox, oy = cel.width * origin[0], cel.height * origin[1]
        # Every packed cel has the same world-space origin as its live pose.
        transform = (1 / scale, 0, ox - 64 / scale, 0, 1 / scale, oy - 90 / scale)
        paint = muted_red(cel).transform((128, 128), Image.Transform.AFFINE, transform, Image.Resampling.BICUBIC)
        assert ImageChops.difference(paint.getchannel("A"), cel.getchannel("A").transform(
            (128, 128), Image.Transform.AFFINE, transform, Image.Resampling.BICUBIC)).getbbox() is None
        bounds = paint.getchannel("A").getbbox()
        assert bounds and bounds[0] > 0 and bounds[1] > 0 and bounds[2] < 128 and bounds[3] < 128
        atlas.paste(paint, (slot % 8 * 128, slot // 8 * 128))

    for slot in range(6):
        x, y = slot % 2 * 627, (0, 313, 627)[slot // 2]
        height = (313, 314, 313)[slot // 2]
        place(skeleton, (x, y, x + 627, y + height), slot, 58 / 314, (.5, .64))
    for slot in range(6):
        x, y = slot % 3 * 256, slot // 3 * 256
        place(imp, (x, y, x + 256, y + 256), slot + 6, 55 / 175, (.5, 245 / 256))
    for slot in range(4):
        x = slot * 192
        place(twins, (x, 192, x + 192, 384), slot + 12, 55 / 175 / .6, (.5, 277 / 320))
    atlas.save(ENEMIES / "enemy-hit-flash-v1.webp", lossless=True, method=6)


if __name__ == "__main__":
    frost_chips()
    flash_cels()
