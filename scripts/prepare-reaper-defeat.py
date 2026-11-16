"""Bake the defeat poses from Grim Runner's registered Reaper plates.

Only the reaction atlas is written. Gameplay and the published carry, Cut,
Slide and respawn sheets are inputs or remain with their original owners.
"""
import importlib.util
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance
from scipy.interpolate import PchipInterpolator


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/combat/v0201'
CELL = (224, 168)
ANCHOR = (110, 155)
COLS = 8
TIMES = (0, 50, 120, 230, 380, 540, 680, 850, 1040, 1280, 1500, 1700, 1920)
POSE = (
    # Pelvis x/y, body turn, near sole x/y/pitch, far sole x/y/pitch,
    # scythe turn, and forward glove x/y.
    (104, 118, -.02, 137, 165, -.05, 91, 155, .40, .23, 132, 121),
    (102, 120, -.14, 136, 167, .00, 88, 157, .38, .34, 129, 124),
    (102, 122, -.11, 136, 167, .00, 86, 159, .39, .38, 129, 127),
    (107, 128,  .12, 136, 167, .02, 84, 165, .46, .25, 139, 137),
    (109, 136,  .39, 135, 167, .09, 83, 166, .62, -.10, 147, 152),
    (112, 144,  .55, 131, 167, .28, 81, 164, .55, -.44, 151, 160),
    (113, 145,  .69, 124, 164, .44, 79, 162, .48, -.77, 154, 165),
    (114, 147,  .89, 115, 162, .54, 76, 161, .39, -.95, 160, 165),
    (114, 142, 1.09, 103, 162, .59, 73, 161, .32, -1.14, 167, 166),
    (111, 140, 1.28, 95, 158, .38, 69, 166, .26, -1.30, 176, 166),
    (110, 140, 1.25, 94, 158, .36, 68, 166, .24, -1.34, 175, 166),
    (110, 140, 1.29, 93, 158, .34, 68, 166, .24, -1.39, 175, 166),
    (110, 140, 1.30, 93, 158, .34, 68, 166, .24, -1.40, 175, 166),
)
SAMPLES = (0, 35, 70, 105, 140, 175, 210, 245, 280, 315, 350, 385, 420, 455,
           490, 525, 560, 595, 630, 665, 700, 735, 770, 805, 840, 880, 920,
           960, 1000, 1040, 1080, 1120, 1170, 1220, 1270, 1320, 1380, 1440,
           1510, 1590, 1680, 1800, 1920)
LOW_SAMPLES = (0, 45, 90, 145, 200, 255, 310, 365, 430, 500, 575, 660,
               750, 850, 970, 1110, 1280, 1500, 1710, 1920)


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


cut = load_module('cut_paint', ROOT / 'scripts/prepare-continuous-cut.py')
run = cut.run
track = PchipInterpolator(TIMES, POSE, axis=0)
forward_dir = ROOT / 'assets/motion/v0200'
metadata = json.loads((forward_dir / 'animation-data.js').read_text().partition('=')[2].rstrip().rstrip(';'))
weapon_info = metadata['weapon']
weapon = Image.open(forward_dir / 'reaper-forward-scythe.webp').convert('RGBA')
weapon_pivot = np.array(weapon_info['anchor'])
scale = run.SCALE
ss = run.SUPERSAMPLE
paint_size = (280 * ss, 222 * ss)
paint_offset = run.point(41, 14)
cuff = run.point(87, 107)
joint_marks = run.point(104, 118)


def rotate_paint(paint, matrix, offset):
    inverse = np.linalg.inv(matrix * ss)
    transform = np.column_stack((inverse, -inverse @ ((offset + paint_offset) * ss)))
    return paint.transform(paint_size, Image.Transform.AFFINE, tuple(transform.ravel()), Image.Resampling.BICUBIC)


def piece(paint, source_a, source_b, target_a, target_b):
    z = complex(*(target_b - target_a)) / complex(*(source_b - source_a))
    matrix = np.array([[z.real, -z.imag], [z.imag, z.real]])
    return rotate_paint(paint, matrix, target_a - matrix @ source_a)


def leg(out, plates, hip, sole, pitch, far):
    (old_hip, old_knee, old_ankle), thigh, shin, boot, heel, ball = plates
    rotation = run.rotation(pitch - math.atan2(*(ball - heel)[::-1]))
    destination = sole + run.point(6 if far else 8, 0) - rotation @ ball
    ankle = rotation @ old_ankle + destination
    delta = ankle - hip
    span = np.linalg.norm(delta)
    if span >= run.THIGH + run.SHIN - 1:
        reach = run.THIGH + run.SHIN - 1
        destination += delta / span * (reach - span)
        ankle = rotation @ old_ankle + destination
        delta, span = ankle - hip, reach
    axis = delta / span
    length = (run.THIGH ** 2 - run.SHIN ** 2 + span ** 2) / (2 * span)
    bend = math.sqrt(max(0, run.THIGH ** 2 - length ** 2))
    knee = hip + axis * length + run.point(axis[1], -axis[0]) * bend
    for layer in (piece(thigh, old_hip, old_knee, hip, knee),
                  piece(shin, old_knee, old_ankle, knee, ankle),
                  rotate_paint(boot, rotation, destination)):
        out.alpha_composite(ImageEnhance.Brightness(layer).enhance(.78) if far else layer)
    return knee


def settle_at_floor(paint):
    # Preserve the rigid body above the ankles. Ease the small lower-envelope
    # overhang into the contact line as cloth, boot heels and gloves bear down.
    floor = (run.ANCHOR[1] + paint_offset[1]) * ss
    alpha = paint.getchannel('A')
    bounds = alpha.point(lambda x: 255 if x >= 64 else 0).getbbox()
    if bounds[3] <= floor + 1:
        return paint
    onset = round(floor - 25 * ss)
    lower = paint.crop((0, onset, paint.width, bounds[3]))
    fitted = lower.resize((paint.width, round(floor + 1) - onset), Image.Resampling.BICUBIC)
    paint.paste((0, 0, 0, 0), (0, onset, paint.width, paint.height))
    paint.paste(fitted, (0, onset))
    return paint


def draw(age, entry=None):
    hx, hy, turn, nx, ny, npitch, fx, fy, fpitch, angle, gx, gy = track(age)
    hip = run.point(hx, hy)
    near = run.point(nx, ny)
    far = run.point(fx, fy)
    if entry is not None:
        # Carry the entering stance until the body catches itself.
        weight = 1 - run.ease(age / 350)
        if entry == 'air':
            first_near, first_far = (136, 150, -.50), (104, 145, -.46)
            hip += run.point(2.2, -3.7) * weight
        elif entry == 'low':
            first_near, first_far = (151, 166, .05), (83, 160, .55)
            hip += run.point(4, 19) * weight
            turn += .48 * weight
            angle = -1.30 - .18 * run.ease(age / 1060)
        else:
            qa = entry
            a, ap, _ = run.foot(qa)
            b, bp, _ = run.foot((qa+.5) % 1)
            first_near, first_far = (*a, ap), (*b, bp)
        near = near * (1 - weight) + np.array(first_near[:2]) * weight
        far = far * (1 - weight) + np.array(first_far[:2]) * weight
        npitch = npitch * (1 - weight) + first_near[2] * weight
        fpitch = fpitch * (1 - weight) + first_far[2] * weight

    out = Image.new('RGBA', paint_size)
    knee_far = leg(out, run.RUN_FAR, hip + run.point(-3, -2), far, fpitch, True)
    knee_near = leg(out, run.RUN_NEAR, hip + run.point(1, 0), near, npitch, False)
    turn_matrix = run.rotation(turn)
    offset = hip - turn_matrix @ joint_marks
    torso = run.torso_frame(.12 + age / 2500, run.point(0, 0))
    # The cape is anchored to the same shoulder. Its weight drops the hem
    # independently as the upper body rotates into contact.
    fall = run.ease((age - 400) / 710)
    pivot = run.point(105, 105)
    cape = run.mask(torso, [(0, 62), (96, 69), (114, 96), (105, 116), (94, 137), (0, 151)])
    chest = run.remove(torso, [(0, 60), (87, 71), (100, 96), (95, 116), (86, 144), (0, 154)])
    cape_turn = run.rotation(turn * (1 - .84 * fall) + .23 * math.sin(math.pi * fall))
    cape_turn[:, 1] *= 1 - .38 * fall
    out.alpha_composite(rotate_paint(cape, cape_turn, turn_matrix @ pivot + offset - cape_turn @ pivot))
    out.alpha_composite(rotate_paint(chest, turn_matrix, offset))

    shoulder = turn_matrix @ run.point(123, 103) + offset
    glove = run.point(gx, gy)
    if entry == 'low':
        glove += run.point(4, 12) * (1 - run.ease(age / 350))
    axis = glove - shoulder
    span = np.linalg.norm(axis)
    if span > 29:
        glove = shoulder + axis / span * 29
        axis, span = glove - shoulder, 29
    elbow = shoulder + axis * .56 + run.point(-axis[1], axis[0]) / span * (12 * max(0, 1-span/31))
    out.alpha_composite(piece(cut.UPPER, cut.SHOULDER, cut.ELBOW, shoulder, elbow))
    out.alpha_composite(piece(cut.FOREARM, cut.ELBOW, cut.WRIST, elbow, glove))
    free_glove = run.mask(run.arm, [(134, 110),(144, 107),(145, 118),(139, 124),(133, 121)])
    glove_turn = run.rotation(min(.45, turn * .4))
    out.alpha_composite(rotate_paint(free_glove, glove_turn, glove - glove_turn @ cut.WRIST))

    palm = turn_matrix @ (cuff + run.torso_offset(cuff[1])) + offset
    palm += run.point(-2, -4) * run.ease(age / 800)
    wm = run.rotation(angle) * weapon_info['scale'] / scale
    if entry == 'low':
        wm[:, 0] *= -1
    woffset = palm - wm @ weapon_pivot
    metal = rotate_paint(weapon, wm, woffset)
    # Keep the rigid haft above the support plane when the body lowers.
    box = metal.getchannel('A').point(lambda x:255 if x>=90 else 0).getbbox()
    floor = (run.ANCHOR[1] + paint_offset[1] + 1) * ss
    if box and box[3] > floor:
        lift = (box[3] - floor) / ss
        palm[1] -= lift
        metal = rotate_paint(weapon, wm, palm - wm @ weapon_pivot)
    # The gripping sleeve follows the same palm as the scythe.
    root = turn_matrix @ run.point(105, 107) + offset
    wrist = palm
    mid = root * .49 + wrist * .51 + run.point(-1, 6)
    out.alpha_composite(piece(cut.UPPER, cut.SHOULDER, cut.ELBOW, root, mid))
    out.alpha_composite(piece(cut.FOREARM, cut.ELBOW, cut.WRIST, mid, wrist))
    settle_at_floor(out)
    out.alpha_composite(metal)
    hand_turn = run.rotation(angle - .23)
    out.alpha_composite(rotate_paint(run.grip, hand_turn, palm - hand_turn @ cuff))

    # World-sized output. The fixed atlas origin is the real support line.
    transform_scale = ss / scale
    ox, oy = (run.ANCHOR + paint_offset) * ss - np.array(ANCHOR) * transform_scale
    out = out.transform(CELL, Image.Transform.AFFINE,
                        (transform_scale, 0, ox, 0, transform_scale, oy), Image.Resampling.BICUBIC)
    return out, {'palm':list((palm - run.ANCHOR) * scale),
                 'hood':list((turn_matrix @ run.point(123, 72) + offset - run.ANCHOR) * scale),
                 'knee':list((knee_near - run.ANCHOR) * scale),
                 'farKnee':list((knee_far - run.ANCHOR) * scale),
                 'glove':list((glove - run.ANCHOR) * scale), 'angle':float(angle)}


def bake():
    frames = []
    marks = []
    entries = ((.10, 'near'), (.60, 'far'), ('air', 'air'))
    first = SAMPLES.index(350)
    sequences = {}
    for entry, name in entries:
        idx = len(frames)
        for age in SAMPLES[:first]:
            paint, joints = draw(age, entry)
            frames.append(paint)
            marks.append(joints)
        sequences[name] = list(range(idx, idx + first))
    idx = len(frames)
    for age in SAMPLES[first:]:
        paint, joints = draw(age)
        frames.append(paint)
        marks.append(joints)
    common = list(range(idx, len(frames)))
    sequences = {name:indices+common for name,indices in sequences.items()}
    sequences['low'] = list(range(len(frames), len(frames) + len(LOW_SAMPLES)))
    for age in LOW_SAMPLES:
        paint, joints = draw(age, 'low')
        frames.append(paint)
        marks.append(joints)
    sheet = Image.new('RGBA', (CELL[0] * COLS, CELL[1] * math.ceil(len(frames) / COLS)))
    for i, pose in enumerate(frames):
        bounds = pose.getchannel('A').point(lambda x:255 if x>=40 else 0).getbbox()
        assert bounds and bounds[0] > 0 and bounds[1] > 0 and bounds[2] < CELL[0] and bounds[3] < CELL[1], (i, bounds)
        sheet.paste(pose, (i % COLS * CELL[0], i // COLS * CELL[1]))
    OUT.mkdir(exist_ok=True)
    sheet.save(OUT / 'reaper-defeat.webp', lossless=True, method=6)
    manifest = dict(width=CELL[0], height=CELL[1], columns=COLS, frames=len(frames),
                    anchor=ANCHOR, times=SAMPLES, lowTimes=LOW_SAMPLES, poses=sequences, landmarks=marks)
    (OUT / 'reaper-defeat.json').write_text(json.dumps(manifest, separators=(',', ':')) + '\n')
    runtime = {k:v for k,v in manifest.items() if k!='landmarks'}
    (OUT / 'animation-data.js').write_text('window.GRIM_DEFEAT_DATA='+json.dumps(runtime,separators=(',', ':'))+';\n')


if __name__ == '__main__':
    bake()
