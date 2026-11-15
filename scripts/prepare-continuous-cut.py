"""Bake the Reaper cut from the same painted profile and joints as the run."""

import importlib.util
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.interpolate import PchipInterpolator

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('planted_run', ROOT / 'scripts/prepare-planted-run.py')
run = importlib.util.module_from_spec(spec)
spec.loader.exec_module(run)
ART = ROOT / 'assets/motion/v0180'
CELL, COLUMNS, ROWS = 320, 6, 4
BODY_SCALE = .43
BODY_ANCHOR = run.point(213, 254)
WEAPON_PIVOT = run.point(70, 250)
WEAPON_SCALE = .4571875 * .60
GRIP_SOURCE = run.point(87, 107)
HANDOFF_CELL, HANDOFF_COLUMNS, RUN_PHASES = 168, 12, 12
HANDOFF_CROP = (10, 18)
HANDOFF_WEIGHTS = {0: 1, 1: .68, 2: .32, 21: .32, 22: .68, 23: 1}
ASSIGNMENT = 'window.GRIM_MOTION_DATA='
KEYS = (0, 3, 6, 9, 13, 17, 20, 23)


def run_foot(phase, far):
    sole, pitch, _ = run.foot((phase + (.5 if far else 0)) % 1)
    return (*sole, pitch)


def track(points):
    return PchipInterpolator(KEYS, points, axis=0)


# The windup gathers the free foot, the reach plants the lead boot, and the
# trailing heel releases during recovery. The run remains distance driven.
near_foot = track([run_foot(.125, False), (103, 167.2, .08), (107, 167.2, .16),
                   (132, 156, -.19), (151, 167.2, .04), (141, 167.2, .10),
                   (128, 167.2, .23), run_foot(.35, False)])
far_foot = track([run_foot(.125, True), (92, 153, -.18), (79, 160, .15),
                  (78, 167.2, .27), (85, 167.2, .55), (82, 162, .66),
                  (89, 156, .20), run_foot(.35, True)])
hips = track([(0, 0), (-1, -.2), (-2, .5), (0, -.5), (5, 2),
              (3, 2), (1, -.8), (0, -1)])
lean = track([0, -.05, -.09, .04, .12, .08, .02, 0])
hands = track([(103, 103), (100, 85), (106, 76), (144, 83), (153, 105),
               (142, 114), (119, 110), (103, 103)])
AIR_FOOT = (
    ((125, 154, -.30), (104, 141, -.48)),
    ((133, 145, -.50), (101, 141, -.55)),
    ((138, 163, -.09), (96, 147, .04)),
)


def blend(cut_value, carry_value, amount):
    return np.asarray(cut_value) * (1 - amount) + np.asarray(carry_value) * amount


def gait_offset(phase):
    beat = phase * math.tau
    return run.point(1.3 * math.sin(beat - .32),
                     2.6 * math.cos(2 * beat) + .68 * math.sin(2 * beat))


def rotate_canvas(paint, matrix, pivot):
    """Transform a supersampled torso or cloak around the pelvis."""
    inverse = np.linalg.inv(matrix)
    center = pivot * run.SUPERSAMPLE
    return paint.transform(paint.size, Image.Transform.AFFINE,
                           tuple(np.column_stack((inverse, center - inverse @ center)).ravel()),
                           resample=Image.Resampling.BICUBIC)


UPPER = run.mask(run.arm, [(108, 102), (121, 102), (132, 110),
                           (133, 120), (126, 123), (109, 117)])
FOREARM = run.mask(run.arm, [(122, 108), (142, 104), (145, 116),
                             (138, 124), (126, 125), (122, 119)])
SHOULDER, ELBOW, WRIST = run.point(113, 109), run.point(128, 116), run.point(140, 113)


def draw_reach(paint, shoulder, hand):
    heading = hand - shoulder
    axis = heading / np.linalg.norm(heading)
    elbow = (hand + shoulder) / 2 + run.point(-axis[1], axis[0]) * min(14, 26 - np.linalg.norm(heading) / 2)
    paint.alpha_composite(run.segment(UPPER, SHOULDER, ELBOW, shoulder, elbow))
    paint.alpha_composite(run.segment(FOREARM, ELBOW, WRIST, elbow, hand))


def body_frame(i, phase=None, air=None, weight=0):
    out = Image.new('RGBA', (run.CELL * run.SUPERSAMPLE,) * 2)
    has_phase = phase is not None
    cut_phase = .125 + i / 115
    paint_phase = float(blend(cut_phase, phase, weight)) if has_phase else cut_phase
    offset = blend(hips(i), gait_offset(phase), weight) if has_phase else hips(i)
    pelvis = run.point(104, 118) + offset
    turn = run.rotation(float(lean(i)) * (1 - weight))
    for far, points, plate in [(True, far_foot, run.FAR), (False, near_foot, run.NEAR)]:
        sole = points(i)
        if has_phase:
            sole = blend(sole, run_foot(phase, far), weight)
        if air is not None:
            tucked = (117, 143, -.34) if far else (137, 152, -.32)
            sole = blend(tucked, AIR_FOOT[air][far], weight)
        x, y, pitch = sole
        hip = run.point(102 if far else 105, 117 if far else 118) + offset
        cuff_trim = run.ankle_trim(phase, far) * weight if has_phase else 0
        run.draw_leg(out, plate, hip, run.point(x, y), pitch, False, far, cuff_trim)

    free_joint = run.point(113, 106)
    dx, dy = run.torso_offset(free_joint[1])
    free_angle = .28 + .52 * math.sin(i / 23 * math.tau - 1)
    if has_phase:
        carry_arm = math.radians(27 - 36 * math.cos(phase * math.tau - .18))
        free_angle = float(blend(free_angle, carry_arm, weight))
    free_swing = run.rotation(free_angle)
    destination = free_joint + run.point(dx, dy) + offset
    out.alpha_composite(run.warp(run.arm, free_swing, destination - free_swing @ free_joint))
    torso = run.torso_frame(paint_phase, offset).resize(out.size, Image.Resampling.BICUBIC)
    out.alpha_composite(rotate_canvas(torso, turn, pelvis))

    shoulder = pelvis + turn @ (run.point(123, 103) + offset - pelvis)
    hand = hands(i)
    carry_angle = 0
    if has_phase:
        dx, dy = run.torso_offset(GRIP_SOURCE[1])
        hand = blend(hand, GRIP_SOURCE + run.point(dx, dy) + gait_offset(phase), weight)
        carry_angle = math.radians(2.1 * math.sin(2 * phase * math.tau - .75))
    if air is not None:
        hand = blend(hand, run.point(108, 104), weight)
        carry_angle = .14
    reach = Image.new('RGBA', out.size)
    draw_reach(reach, shoulder, hand)
    reach.putalpha(reach.getchannel('A').point(lambda opacity: round(opacity * (1 - weight))))
    out.alpha_composite(reach)
    palm_angle = math.atan2(*(hand - shoulder)[::-1]) + .3
    palm = run.rotation(float(blend(palm_angle, carry_angle, weight)))
    out.alpha_composite(run.warp(run.grip, palm, hand - palm @ GRIP_SOURCE))
    out.paste((0, 0, 0, 0), (0, 169 * run.SUPERSAMPLE, out.width, out.height))
    return out, (hand - run.ANCHOR) * run.SCALE, carry_angle * weight


def atlas_cell(body):
    # Sample the same world scale as the run into the existing cut sheet.
    ratio = run.SCALE / BODY_SCALE / run.SUPERSAMPLE
    offset = run.ANCHOR * run.SUPERSAMPLE - BODY_ANCHOR / ratio
    return body.transform((CELL, CELL), Image.Transform.AFFINE,
                          (1 / ratio, 0, offset[0], 0, 1 / ratio, offset[1]),
                          resample=Image.Resampling.BICUBIC)


def weapon_paint():
    # The runtime retains its negative X scale. Pre-mirror the carry paint
    # here so it has the exact same handedness at the run handoff.
    ratio = run.SCALE / WEAPON_SCALE
    return run.weapon.transform((384, 384), Image.Transform.AFFINE,
                                (-1 / ratio, 0, GRIP_SOURCE[0] + WEAPON_PIVOT[0] / ratio,
                                 0, 1 / ratio, GRIP_SOURCE[1] - WEAPON_PIVOT[1] / ratio),
                                resample=Image.Resampling.BICUBIC)


def build_handoffs():
    # Distance buckets only affect the six edge paintings. The active cut
    # keeps one legible silhouette, with a separate gathered air stance.
    edge_frames = list(HANDOFF_WEIGHTS)
    variants = [(i, q / RUN_PHASES, None, HANDOFF_WEIGHTS[i])
                for q in range(RUN_PHASES) for i in edge_frames]
    variants += [(i, None, air, HANDOFF_WEIGHTS[i]) for air in range(3) for i in edge_frames]
    variants += [(i, None, 1, 0) for i in range(COLUMNS * ROWS)]
    height = math.ceil(len(variants) / HANDOFF_COLUMNS) * HANDOFF_CELL
    atlas = Image.new('RGBA', (HANDOFF_COLUMNS * HANDOFF_CELL, height))
    details = []
    x, y = HANDOFF_CROP
    for n, (i, phase, air, weight) in enumerate(variants):
        body, grip, angle = body_frame(i, phase, air, weight)
        tile = body.resize((run.CELL, run.CELL), Image.Resampling.LANCZOS)
        tile = tile.crop((x, y, x + HANDOFF_CELL, y + HANDOFF_CELL))
        atlas.paste(tile, (n % HANDOFF_COLUMNS * HANDOFF_CELL, n // HANDOFF_COLUMNS * HANDOFF_CELL))
        details.append([*np.round(grip, 3).tolist(), round(angle, 4)])
    return atlas, {'anchor': (run.ANCHOR - HANDOFF_CROP).tolist(), 'cell': HANDOFF_CELL,
                   'scale': run.SCALE, 'phases': RUN_PHASES, 'edgeFrames': edge_frames,
                   'edgeWeights': list(HANDOFF_WEIGHTS.values()), 'poses': details}


def build():
    data_file = ART / 'animation-data.js'
    manifest_file = ART / 'manifest.json'
    data = json.loads(data_file.read_text().split(ASSIGNMENT)[1].strip().rstrip(';'))
    manifest = json.loads(manifest_file.read_text())
    atlas = Image.new('RGBA', (COLUMNS * CELL, ROWS * CELL))
    grips = []
    for i in range(COLUMNS * ROWS):
        body, grip, _ = body_frame(i)
        tile = atlas_cell(body)
        atlas.paste(tile, (i % COLUMNS * CELL, i // COLUMNS * CELL))
        grips.append(np.round(grip / .38 + data['anchor'], 3).tolist())

    for name, image in [('reaper-cut-body.png', atlas), ('reaper-cut-scythe.png', weapon_paint())]:
        output = ART / name
        image.save(output, optimize=True)
        manifest['runtime'][name] = {**run.digest(output), 'size': list(image.size)}

    data['visualCutGrips'] = grips
    data['visualCutBody'] = {'anchor': BODY_ANCHOR.tolist(), 'scale': BODY_SCALE}
    data['visualCutWeapon'] = {'pivot': WEAPON_PIVOT.tolist(), 'size': 384}
    handoffs, data['visualCutHandoff'] = build_handoffs()
    handoff_file = ART / 'reaper-cut-handoffs.webp'
    handoffs.save(handoff_file, quality=82, method=5, exact=False)
    data_file.write_text('/* Authored v0.18 motion and visual cut registration. */\n' +
                         ASSIGNMENT + json.dumps(data, separators=(',', ':')) + ';\n')
    manifest['visualCut'] = {'source': str(run.SOURCE.relative_to(ROOT)),
                             'sourceSha256': run.digest(run.SOURCE)['sha256'],
                             'profileBuilder': 'scripts/prepare-planted-run.py',
                             'keyframes': KEYS, 'grips': grips, 'body': data['visualCutBody'],
                             'weapon': data['visualCutWeapon'],
                             'handoffs': {'file': handoff_file.name, **run.digest(handoff_file),
                                          'size': list(handoffs.size), 'frames': len(data['visualCutHandoff']['poses'])}}
    manifest_file.write_text(json.dumps(manifest, indent=2) + '\n')
    print(f'{len(grips)} shared-profile cut poses, {manifest["runtime"]["reaper-cut-body.png"]["bytes"]:,} bytes')


if __name__ == '__main__':
    build()
