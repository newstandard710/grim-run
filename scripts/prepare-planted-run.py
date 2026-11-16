"""Bake the shared Reaper profile and articulated, distance-registered run."""

import hashlib
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter
from scipy.ndimage import distance_transform_edt, map_coordinates

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'assets/motion/v0194'
SOURCE = ROOT / 'assets/motion/v0193/reaper-run.png'
GUIDE = ROOT / 'docs/reaper-motion-pose-guide.md'
CELL, COLUMNS, FRAMES, GAITS = 192, 16, 192, 2
STRIDE, SCALE = 202, 13 / 15
ANCHOR = np.array([123., 168.])
STANCE = 1 / 3
THIGH, SHIN = 29.1, 27.4
SUPERSAMPLE = 2

atlas = Image.open(SOURCE).convert('RGBA')


def point(x, y):
    return np.array([x, y], dtype=float)


def source_pose(frame):
    x, y = frame % COLUMNS * CELL, frame // COLUMNS * CELL
    return atlas.crop((x, y, x + CELL, y + CELL))


def mask(paint, outline):
    selection = Image.new('L', paint.size)
    ImageDraw.Draw(selection).polygon(outline, fill=255)
    return Image.composite(paint, Image.new('RGBA', paint.size), selection)


def remove(paint, outline):
    selection = Image.new('L', paint.size, 255)
    ImageDraw.Draw(selection).polygon(outline, fill=0)
    return Image.composite(paint, Image.new('RGBA', paint.size), selection)


def rotation(angle):
    c, s = math.cos(angle), math.sin(angle)
    return np.array([[c, -s], [s, c]])


def warp(paint, matrix, offset):
    inverse = np.linalg.inv(matrix * SUPERSAMPLE)
    return paint.transform(
        (CELL * SUPERSAMPLE,) * 2, Image.Transform.AFFINE,
        tuple(np.column_stack((inverse, -inverse @ (offset * SUPERSAMPLE))).ravel()),
        resample=Image.Resampling.BICUBIC,
    )


def segment(paint, start, end, target_start, target_end):
    """Overlap the painted joints while rotating each segment at fixed length."""
    scale_turn = complex(*(target_end - target_start)) / complex(*(end - start))
    matrix = np.array([[scale_turn.real, -scale_turn.imag], [scale_turn.imag, scale_turn.real]])
    return warp(paint, matrix, target_start - matrix @ start)


def ease(t):
    t = min(1, max(0, t))
    return t * t * (3 - 2 * t)


near_source = source_pose(96)
far_source = source_pose(176)

# Two independently painted boots, greaves and thighs. Include the painted
# sockets at both ends so the composites can articulate without gaps.
NEAR = (
    (point(101, 126), point(114, 143), point(123, 157)),
    remove(mask(near_source, [(97, 122), (108, 120), (113, 129), (121, 142),
                              (119, 149), (111, 150), (104, 146), (97, 136)]),
           [(90, 115), (94, 114), (101, 132), (100, 141), (95, 139), (91, 125)]),
    mask(near_source, [(110, 139), (119, 138), (123, 145), (128, 154),
                       (132, 159), (122, 163), (115, 159), (111, 151), (108, 145)]),
    mask(near_source, [(121, 151), (128, 152), (131, 157), (139, 157),
                       (146, 155), (148, 161), (139, 167), (125, 168), (116, 166), (116, 160)]),
    point(121, 165), point(141.5, 159.5),
)
FAR = (
    (point(99, 125), point(110, 142), point(117, 154)),
    mask(far_source, [(93, 120), (106, 119), (113, 131), (117, 138),
                      (115, 146), (107, 149), (100, 143), (94, 135)]),
    mask(far_source, [(104, 136), (114, 135), (119, 144), (124, 153),
                      (120, 160), (112, 160), (107, 151), (103, 145)]),
    mask(far_source, [(112, 149), (119, 146), (125, 152), (130, 151),
                      (137, 147), (140, 151), (138, 158), (128, 165), (116, 169), (111, 161)]),
    point(117, 164), point(129, 157.5),
)

# Keep the accepted hood, arm armour, exposed grip and rigid weapon paint.
body = mask(near_source, [(0, 64), (119, 62), (191, 71), (191, 129), (112, 128),
                          (106, 132), (100, 137), (97, 145), (91, 146), (84, 142),
                          (72, 144), (58, 146), (39, 148), (0, 148)])
arm = mask(body, [(111, 103), (118, 105), (123, 108), (133, 109), (144, 107),
                  (145, 121), (137, 128), (126, 124), (118, 121), (109, 116)])
weapon = mask(near_source, [(0, 79), (15, 52), (39, 40), (69, 32), (78, 25),
                            (83, 40), (97, 24), (98, 39), (112, 38), (107, 58),
                            (99, 68), (85, 72), (92, 96), (96, 114), (101, 133),
                            (101, 145), (92, 139), (90, 125), (85, 115), (84, 104),
                            (78, 76), (73, 71), (59, 71)])
grip = mask(body, [(74, 108), (78, 100), (82, 98), (88, 98), (94, 102),
                   (93, 109), (90, 115), (79, 117), (75, 114)])
yy, xx = np.mgrid[:CELL, :CELL].astype(np.float32)
paint = np.array(body)
shaft = mask(body, [(75, 71), (85, 68), (91, 91), (97, 114), (102, 136),
                    (100, 142), (90, 138), (87, 120), (82, 100)])
cut = np.maximum.reduce([np.array(layer.getchannel('A')) for layer in (arm, shaft, weapon, grip)]) > 0
under = cut & (xx > 69) & (xx < 112) & (yy > 78) & (yy < 139)
valid = (paint[:, :, 3] > 100) & ~cut
neighbors = distance_transform_edt(~valid, return_distances=False, return_indices=True)
paint[cut] = 0
paint[under] = paint[tuple(k[under] for k in neighbors)]
torso_pixels = paint.astype(np.float32)
torso_pixels[:, :, :3] *= torso_pixels[:, :, 3:4] / 255

# From the source belt to the raised pelvis, and from the visibly rearward
# pauldron to the forward chest. The hood keeps its original silhouette.
def torso_offset(y):
    dx = np.interp(y, [62, 86, 98, 110, 124, 137, 149], [15, 16, 20, 15, 4, 2, 2])
    dy = np.interp(y, [62, 91, 112, 128, 149], [-1, -2, -5, -10, -7])
    return dx, dy


def torso_frame(q, offset):
    phase = 2 * math.pi * q
    sx, sy = xx - offset[0], yy - offset[1]
    # Invert the row-wise torso warp and the smooth displacement of just the
    # trailing folds. Keep the chest, coat attachment and hood fully opaque.
    for _ in range(5):
        dx, dy = torso_offset(sy)
        trailing = np.clip((83 - sx) / 81, 0, 1) ** 1.4
        ripple = math.sin(phase) * np.cos(sy * .08) + math.cos(phase) * np.sin(sy * .08)
        sx = xx - offset[0] - dx - trailing * (12 + 2.6 * ripple)
        sy = yy - offset[1] - dy - trailing * (6 + 2.2 * np.sin(phase - sx * .06))
    sampled = np.stack([map_coordinates(channel, [sy, sx], order=1)
                        for channel in torso_pixels.transpose(2, 0, 1)], axis=-1)
    sampled[:, :, :3] *= 255 / np.maximum(sampled[:, :, 3:4], 1)
    return Image.fromarray(np.uint8(np.clip(sampled + .5, 0, 255)))


def foot(q):
    travel = STRIDE / SCALE
    contact_x = 143.
    if q < STANCE:
        t = q / STANCE
        pitch = .70 * ease((t - .64) / .36)
        return point(contact_x - q * travel, 167.2), pitch, True

    u = (q - STANCE) / (1 - STANCE)
    # Keep the stance velocity at the transition and the return to contact.
    edge = u * (1 - u) * ((1 - u) ** 11 - u ** 11)
    x = contact_x - STANCE * travel * (1 - ease(u)) - travel * (1 - STANCE) * edge
    lift = math.sin(math.pi * u) ** 1.2 * (15 + 8 * (1 - u))
    lift += 9 * math.exp(-((u - .18) / .15) ** 2) * math.sin(math.pi * u)
    pitch = .70 * (1 - ease(u / .25)) - .34 * math.sin(math.pi * u) ** 2
    return point(x, 167.2 - lift), pitch, False


def run_swing(frame, far, sole):
    """Lower the late swing while leaving the contact and recovery paths intact."""
    start, full_in, full_out, end = (16, 27, 32, 40) if far else (68, 79, 85, 91)
    weight = ease((frame - start) / (full_in - start)) * ease((end - frame) / (end - full_out))
    return sole + weight * point(-2.4, 3.6)


def taper_plate(paint, start, end, amount):
    """Narrow a donor across its axis while leaving both painted sockets full."""
    y, x = np.indices((paint.height, paint.width), dtype=np.float32)
    delta = end - start
    along = ((x - start[0]) * delta[0] + (y - start[1]) * delta[1]) / (delta @ delta)
    fade = np.clip(along / .28, 0, 1) * np.clip((1 - along) / .28, 0, 1)
    fade = fade**2 * (3 - 2 * fade)
    axis_x, axis_y = start[0] + along * delta[0], start[1] + along * delta[1]
    width = 1 - amount * fade
    coords = [axis_y + (y - axis_y) / width, axis_x + (x - axis_x) / width]
    source = np.asarray(paint, dtype=np.float32) / 255
    source[:, :, :3] *= source[:, :, 3:]
    sample = np.stack([map_coordinates(channel, coords, order=1) for channel in source.transpose(2, 0, 1)], axis=-1)
    sample[:, :, :3] /= np.maximum(sample[:, :, 3:], 1 / 255)
    return Image.fromarray(np.uint8(np.clip(sample * 255 + .5, 0, 255)))


def run_plates(plates):
    (hip, knee, ankle), thigh, greave, boot, heel, ball = plates
    return ((hip, knee, ankle), taper_plate(thigh, hip, knee, .06),
            taper_plate(greave, knee, ankle, .12), boot, heel, ball)


RUN_FAR, RUN_NEAR = run_plates(FAR), run_plates(NEAR)


def ankle_trim(phase, far):
    """Taper the cuff correction in and out around the bulky swing poses."""
    frame = phase * (FRAMES // GAITS)
    start, peak_in, peak_out, end = (31, 36, 41, 46) if far else (53, 57, 64, 68)
    return ease((frame - start) / (peak_in - start)) * ease((end - frame) / (end - peak_out))


def trim_greave(shin, knee, ankle, strength):
    """Take a little volume out of the outer distal edge, leaving the boot plate intact."""
    radius = 15 * SUPERSAMPLE
    cx, cy = ankle * SUPERSAMPLE
    x0, y0 = max(0, math.floor(cx - radius)), max(0, math.floor(cy - radius))
    x1 = min(shin.width, math.ceil(cx + radius))
    y1 = min(shin.height, math.ceil(cy + radius))
    y, x = np.mgrid[y0:y1, x0:x1] / SUPERSAMPLE
    dx, dy = x - ankle[0], y - ankle[1]
    axis = (ankle - knee) / SHIN
    along = dx * axis[0] + dy * axis[1]
    distal = np.clip((along + 12) / 8, 0, 1)
    local = np.clip((14 - np.hypot(dx, dy)) / 5, 0, 1)
    alpha = shin.getchannel('A')
    original = np.asarray(alpha.crop((x0, y0, x1, y1)), dtype=float)
    inset = np.asarray(alpha.filter(ImageFilter.MinFilter(7)).crop((x0, y0, x1, y1)))
    corrected = original + (inset - original) * (strength * distal * local)
    alpha.paste(Image.fromarray(np.uint8(np.round(corrected))), (x0, y0))
    shin.putalpha(alpha)
    return shin


def draw_leg(out, plates, hip, sole, pitch, planted, far, cuff_trim=0):
    (old_hip, old_knee, old_ankle), thigh, shin, boot, heel, ball = plates
    sole_pitch = math.atan2(*(ball - heel)[::-1])
    rotate = rotation(pitch - sole_pitch)
    # Both boots pivot around the plate's painted forefoot during push-off.
    # The physical forward patch is stationary even as its heel rises.
    destination = sole + point(6 if far else 8, 0) - rotate @ ball
    ankle = rotate @ old_ankle + destination
    direction = ankle - hip
    distance = np.linalg.norm(direction)
    assert abs(THIGH - SHIN) < distance < THIGH + SHIN, (hip, sole, pitch, distance)
    axis = direction / distance
    along = (THIGH ** 2 - SHIN ** 2 + distance ** 2) / (2 * distance)
    bend = math.sqrt(THIGH ** 2 - along ** 2)
    knee = hip + axis * along + point(axis[1], -axis[0]) * bend

    greave = segment(shin, old_knee, old_ankle, knee, ankle)
    if cuff_trim:
        greave = trim_greave(greave, knee, ankle, cuff_trim)
    layers = (
        segment(thigh, old_hip, old_knee, hip, knee),
        greave,
        warp(boot, rotate, destination),
    )
    for layer in layers:
        if far:
            layer = ImageEnhance.Brightness(layer).enhance(.79)
        out.alpha_composite(layer)
    if planted:
        return {'x': round((sole[0] - ANCHOR[0]) * SCALE, 4), 'foot': 'far' if far else 'near'}
    return None


def draw(frame, with_weapon=True, *, run_anatomy=False):
    cycle = FRAMES // GAITS
    q = (frame % cycle) / cycle
    beat = 2 * math.pi * q
    offset = point(1.3 * math.sin(beat - .32),
                   2.6 * math.cos(2 * beat) + .68 * math.sin(2 * beat))
    out = Image.new('RGBA', (CELL * SUPERSAMPLE,) * 2)
    support = None
    far_plates, near_plates = (RUN_FAR, RUN_NEAR) if run_anatomy else (FAR, NEAR)
    for far, phase, plates in ((True, (q + .5) % 1, far_plates), (False, q, near_plates)):
        hip = point(102 if far else 105, 117 if far else 118) + offset
        sole, pitch, planted = foot(phase)
        if run_anatomy and not planted:
            sole = run_swing(frame % cycle, far, sole)
        contact = draw_leg(out, plates, hip, sole, pitch, planted, far, ankle_trim(q, far))
        if contact:
            support = contact

    free_shoulder = point(113, 106)
    dx, dy = torso_offset(free_shoulder[1])
    free_swing = rotation(math.radians(27 - 36 * math.cos(beat - .18)))
    out.alpha_composite(warp(arm, free_swing, free_shoulder + point(dx, dy) + offset - free_swing @ free_shoulder))
    out.alpha_composite(torso_frame(q, offset).resize(out.size, Image.Resampling.BICUBIC))
    hand = point(87, 107)
    dx, dy = torso_offset(hand[1])
    carry = rotation(math.radians(2.1 * math.sin(2 * beat - .75)))
    carry_offset = hand + point(dx, dy) + offset - carry @ hand
    if with_weapon:
        out.alpha_composite(warp(weapon, carry, carry_offset))
    out.alpha_composite(warp(grip, carry, carry_offset))
    # Transparent padding begins just below the support line.
    out.paste((0, 0, 0, 0), (0, 169 * SUPERSAMPLE, out.width, out.height))
    return out.resize((CELL, CELL), Image.Resampling.LANCZOS), support


def digest(path):
    return {'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}


def build():
    OUTPUT.mkdir(parents=True,exist_ok=True)
    out = Image.new('RGBA',(CELL*COLUMNS,(FRAMES//COLUMNS)*CELL))
    support = []
    bounds = []
    for i in range(FRAMES):
        tile,plant = draw(i, run_anatomy=True)
        bounds.append(tile.getchannel('A').point(lambda p:255 if p>64 else 0).getbbox())
        out.paste(tile,(i%COLUMNS*CELL,i//COLUMNS*CELL))
        support.append(plant)
    path = OUTPUT/'reaper-run.webp'
    out.save(path,quality=83,method=5,exact=False)
    contacts = [[i,support[i]['x']] for i in range(0,FRAMES,FRAMES//(GAITS*2))]
    data = {'cell':CELL,'frames':FRAMES,'columns':COLUMNS,'anchor':ANCHOR.tolist(),'scale':SCALE,
            'pixelsPerGait':STRIDE,'gaitsPerSheet':GAITS,'distancePerSheet':STRIDE*GAITS,
            'contacts':contacts,'supportX':[p['x'] if p else None for p in support]}
    step = STRIDE*GAITS/FRAMES
    ground = data['supportX'].copy()
    # In flight, move the terrain reference smoothly from old support to the
    # next touchdown so a hillside cannot jolt the torso on a phase boundary.
    for i,value in enumerate(ground):
        if value is not None:
            continue
        last = next(j for j in range(i-1,i-FRAMES,-1) if support[j%FRAMES])
        following = next(j for j in range(i+1,i+FRAMES) if support[j%FRAMES])
        u = (i-last)/(following-last)
        u = u*u*(3-2*u)
        a = last*step+support[last%FRAMES]['x']
        b = following*step+support[following%FRAMES]['x']
        ground[i] = round(a+(b-a)*u-i*step,4)
    data['groundX'] = ground
    manifest = {**data,'sources':{str(SOURCE.relative_to(ROOT)):digest(SOURCE), str(GUIDE.relative_to(ROOT)):digest(GUIDE)},
                'runtime':{path.name:{**digest(path),'bounds':bounds}}}
    (OUTPUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    (OUTPUT/'animation-data.js').write_text('/* Planted and registered solid run poses. */\nwindow.GRIM_RUN_DATA='+json.dumps(data,separators=(',',':'))+';\n')
    print(f'{path.name}: {out.size} and {path.stat().st_size:,} bytes; {len(contacts)} footfalls')


if __name__=='__main__':
    build()
