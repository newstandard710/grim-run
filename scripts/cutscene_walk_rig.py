"""Articulate the vendor painting while retaining its original armor and weapon."""

import math

import cv2
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import distance_transform_edt

CELL = 224
FLOOR = 214
TRAVEL = 400 / 3
SAMPLES = 192
FLOOR_KEYS = ((0, 0, 46), (.45, 27, 65), (.95, 59, 63),
              (1.50, 92, 60), (2.10, 125, 42), (2.26, TRAVEL, 0))
# Time, fixed flat-sole x, and final loaded instant. Alternate feet are
# independently posed so the two braking steps do not replay the opening.
FAR = ((-.52, 135, .12), (.45, 202, 1.07), (1.50, 267, 2.20), (2.50, 275, 4))
NEAR = ((0, 169, .56), (.95, 234, 1.63), (2.10, 300, 4))


def ease(t):
    t = min(1, max(0, t))
    return t * t * (3 - 2 * t)


def rotate(angle):
    c, s = math.cos(angle), math.sin(angle)
    return np.array([[c, -s], [s, c]])


def polygon(outline):
    selection = np.zeros((CELL, CELL), np.uint8)
    cv2.fillPoly(selection, [np.asarray(outline, np.int32)], 1)
    return selection.astype(bool)


def warp(paint, rotation, offset):
    result = cv2.warpAffine(paint, np.column_stack([rotation, offset]), (CELL, CELL), flags=cv2.INTER_LINEAR)
    result[:, :, :3] /= np.maximum(result[:, :, 3:4], 1 / 255)
    return Image.fromarray(np.uint8(np.clip(result * 255 + .5, 0, 255)))


def segment(paint, a, b, start, end):
    turn = complex(*(end - start)) / complex(*(b - a))
    matrix = np.array([[turn.real, -turn.imag], [turn.imag, turn.real]])
    return warp(paint, matrix, start - matrix @ a)


def near_greave_amount(frame):
    return .10 * max(
        ease((frame - start) / (full_in - start)) *
        ease((end - frame) / (end - full_out))
        for start, full_in, full_out, end in (
            (8, 14, 18, 25), (65, 72, 79, 86), (106, 113, 123, 130))
    )


def near_greave(paint, knee, ankle, frame):
    """Soften the broad front plate only as the two legs pass."""
    amount = near_greave_amount(frame)
    if not amount:
        return paint
    y, x = np.indices(paint.shape[:2], dtype=np.float32)
    dx, dy = ankle - knee
    along = ((x - knee[0]) * dx + (y - knee[1]) * dy) / (dx**2 + dy**2)
    fade = np.clip(along / .3, 0, 1) * np.clip((1 - along) / .3, 0, 1)
    width = 1 - amount * fade**2 * (3 - 2 * fade)
    axis_x, axis_y = knee[0] + along * dx, knee[1] + along * dy
    return cv2.remap(paint, (axis_x + (x - axis_x) / width).astype(np.float32),
                     (axis_y + (y - axis_y) / width).astype(np.float32), cv2.INTER_LINEAR)


def leather_joins(hip, knee, ankle):
    """Repaint the undersuit exposed when the gold plates change angle."""
    leg = Image.new('RGBA', (CELL*2, CELL*2))
    ink = ImageDraw.Draw(leg)
    points = [tuple(np.rint(p*2).astype(int)) for p in (hip, knee, ankle)]
    ink.line(points, fill=(35, 23, 27, 255), width=18, joint='curve')
    ink.line([(x+2, y) for x,y in points], fill=(73, 45, 36, 255), width=6, joint='curve')
    return leg.resize((CELL, CELL), Image.Resampling.LANCZOS)


def travel_at(t):
    for (a, x, dx), (b, z, dz) in zip(FLOOR_KEYS, FLOOR_KEYS[1:]):
        if t <= b:
            u = (t-a)/(b-a)
            return ((2*u**3-3*u*u+1)*x + (u**3-2*u*u+u)*dx*(b-a)
                    + (-2*u**3+3*u*u)*z + (u**3-u*u)*dz*(b-a))
    return TRAVEL


def foot(t, steps):
    """Use the heel to take load, the flat sole for support, and the ball to leave."""
    k = max(i for i, (hit, _, _) in enumerate(steps) if t >= hit)
    hit, x, release = steps[k]
    final = k == len(steps)-1
    lift = 0
    if t <= release:
        if t < hit+.105:
            pitch, pivot, state = -.23 * (1-ease((t-hit)/.105)), -12, 'heel'
        elif not final and t > release-.145:
            pitch, pivot, state = .54 * ease((t-release+.145)/.145), 9, 'toe'
        else:
            pitch, pivot, state = 0, 0, 'flat'
    else:
        next_hit, target, _ = steps[k+1]
        u = (t-release)/(next_hit-release)
        x += (target-x)*ease(u)
        pitch = .54*(1-ease(u/.52)) - .23*ease((u-.39)/.61)
        pivot = 9 - 21*ease(u)
        lift = (12 if k+1 == len(steps)-1 and steps == FAR else 16)*math.sin(math.pi*u)**1.55
        state = 'swing'
    return x, FLOOR-lift, pitch, pivot, state


def make_walk(base):
    base = base.astype(np.float32) / 255
    base[:, :, :3] *= base[:, :, 3:4]

    far = [
        ([147, 152], [128, 182], [104, 199]),
        [(137,156),(157,159),(151,172),(137,183),(126,189),(118,181),(128,170)],
        [(121,177),(137,181),(130,188),(112,202),(99,207),(92,199),(103,190)],
        [(95,194),(105,193),(112,199),(127,211),(122,216),(104,215),(93,210),(91,201)],
    ]
    near = [
        ([162, 151], [172, 179], [176, 199]),
        [(160,153),(172,153),(179,172),(179,183),(161,184),(158,173)],
        [(160,174),(179,175),(181,184),(183,194),(184,204),(168,209),(165,194)],
        [(169,196),(185,194),(191,199),(207,206),(209,213),(188,217),(167,217),(166,208)],
    ]
    scythe = polygon([(88,107),(88,66),(105,47),(122,38),(149,29),(164,24),(176,40),
                      (177,64),(166,73),(158,73),(158,126),(159,155),(158,195),(156,214),
                      (148,214),(144,192),(148,155),(149,85),(147,71),(120,71),(102,85)])
    # Keep the exposed fingers in the hand layer where the shaft passes behind it.
    hand = polygon([(124,118),(137,119),(146,123),(160,124),(163,132),(160,140),
                    (149,141),(140,139),(130,138),(121,137),(119,128)])
    free_arm = polygon([(166,129),(174,132),(178,140),(185,143),(192,151),(187,162),
                        (179,162),(174,153),(171,148),(164,141)])
    hood = polygon([(123,90),(145,73),(177,70),(188,85),(190,97),(179,106),
                    (162,111),(151,105),(139,101),(123,103)])

    plates = []
    legs_removed = np.zeros((CELL, CELL), bool)
    for spec, *outlines in (far, near):
        masks = [polygon(outline) & ~scythe for outline in outlines]
        images = [np.where(mask[:, :, None], base, 0) for mask in masks]
        plates.append((np.array(spec), images))
        legs_removed |= np.logical_or.reduce(masks)

    torso = base.copy()
    removed = scythe | hand | free_arm | hood
    torso[removed | legs_removed] = 0
    # Fill the narrow exposed sockets under the detached hand, shaft and hood.
    yy, xx = np.mgrid[:CELL, :CELL]
    interior = removed & (xx >= 141) & (xx <= 169) & (yy >= 96) & (yy <= 161)
    valid = torso[:, :, 3] > .75
    nearest = distance_transform_edt(~valid, return_distances=False, return_indices=True)
    torso[interior] = torso[tuple(k[interior] for k in nearest)]
    lining = Image.new('RGBA', (CELL, CELL))
    ink = ImageDraw.Draw(lining)
    # Redraw the coat lining newly exposed by raising the carried scythe.
    ink.polygon([(124,122),(143,126),(148,144),(133,152),(117,146),(119,132)],
                fill=(40, 27, 34, 255))
    ink.line([(122,127),(127,138),(135,145)], fill=(66, 45, 47, 255), width=2)
    lining = np.array(lining).astype(np.float32)/255
    lining[:,:,:3] *= lining[:,:,3:4]
    weapon = np.where((scythe & ~hand)[:, :, None], base, 0)
    # Restore the strip of shaft concealed by the hand in the source drawing.
    weapon[123:142, 149:157] = weapon[142, 149:157]
    hand_paint = np.where(hand[:, :, None], base, 0)
    free_paint = np.where(free_arm[:, :, None], base, 0)
    hood_paint = np.where((hood & ~scythe)[:, :, None], base, 0)
    hand_at = np.array([151., 132.])
    neck = np.array([164., 101.])
    free_shoulder = np.array([165., 131.])
    grid_x, grid_y = xx.astype(np.float32), yy.astype(np.float32)
    trailing = np.clip((135 - grid_x) / 73, 0, 1) ** 1.4
    frames, contacts, grips = [], [], []

    for i in range(SAMPLES + 1):
        t = i * 3 / SAMPLES
        travel = travel_at(t)
        step = max(j for j, (hit, *_) in enumerate(FLOOR_KEYS[:5]) if t >= hit)
        hit, up, load = FLOOR_KEYS[step][0], FLOOR_KEYS[step+1][0], .13 if step < 4 else .16
        phase = math.pi*(step + min(1, (t-hit)/(up-hit)))
        settle = ease((t-2.13)/.64)
        look = ease((t-2.40)/.60)
        pulse = 3.5*math.sin(math.pi*min(1,(t-hit)/load))
        # The pelvis yields under each new heel, then rises over the stance leg.
        single = math.sin(math.pi*min(1,max(0,(t-hit-load)/(up-hit-load)))) if step < 4 else 0
        pelvis = np.array([1.9 * math.sin(phase)*(1-settle) + settle * 2.0,
                           pulse - 2.5*single - 1.7*settle])
        chest = rotate(.045 + .037 * math.sin(phase + .65)*(1-settle) - settle * .11)
        chest_pivot = np.array([154., 153.])
        body_offset = chest_pivot + pelvis - chest @ chest_pivot
        legs = []
        feet = []
        for j, (pivots, paints) in enumerate(plates):
            old_hip, old_knee, old_ankle = pivots
            x, y, pitch, pivot, state = foot(t, (FAR, NEAR)[j])
            # Shorten the original long toe in profile, keeping the actual
            # armor paint. Keep the nearer sole forward of the far sole in depth.
            shoe = rotate(pitch) @ np.diag([.70 if j else .65, .91])
            ball = np.array(([112, 213], [187, 213])[j])
            shoe_pivot = ball + np.array([pivot / (.70 if j else .65), 0])
            anchor = np.array([x-travel+pivot, y])
            shift = anchor - shoe @ shoe_pivot
            # Place the shin at the boot collar, not at the old foreshortened
            # ankle. The pelvis locators sit under the tunic above the knee.
            ankle = shoe @ (ball + np.array([-7,-13])) + shift
            hip = np.array(([146, 147], [158, 145])[j], dtype=float) + pelvis
            max_reach = 60.0
            hip[1] = max(hip[1], ankle[1]-math.sqrt(max_reach**2-(ankle[0]-hip[0])**2))
            direction = ankle - hip
            distance = np.linalg.norm(direction)
            thigh, shin = 31., 30.
            assert abs(thigh - shin) < distance < thigh + shin, (i, j, distance)
            unit = direction / distance
            along = (thigh**2 - shin**2 + distance**2) / (2 * distance)
            bend = math.sqrt(thigh**2 - along**2)
            knee = hip + unit * along + np.array([unit[1], -unit[0]]) * bend
            leg = leather_joins(hip, knee, ankle)
            leg.alpha_composite(segment(paints[0], old_hip, old_knee, hip, knee))
            shin_paint = near_greave(paints[1], old_knee, old_ankle, i) if j else paints[1]
            leg.alpha_composite(segment(shin_paint, old_knee, old_ankle, knee, ankle))
            leg.alpha_composite(warp(paints[2], shoe, shift))
            if j == 0:
                pixels = np.array(leg)
                pixels[:,:,:3] = np.uint8(pixels[:,:,:3] * .84)
                leg = Image.fromarray(pixels)
            legs.append(leg)
            feet.append({'contact': anchor.round(3).tolist(), 'state': state,
                         'hip': hip.round(3).tolist(), 'knee': knee.round(3).tolist(),
                         'ankle': ankle.round(3).tolist()})
        cloth_wave = trailing * (2.4 * math.sin(phase - .9) * (1 - settle))
        cloth_drop = trailing * (1.4 * math.cos(phase - 1.15) * (1 - settle) + 2.2 * settle)
        cloth = cv2.remap(torso, grid_x - cloth_wave, grid_y - cloth_drop, cv2.INTER_LINEAR)
        out = Image.new('RGBA', (CELL,CELL))
        out.alpha_composite(legs[0])
        out.alpha_composite(legs[1])
        out.alpha_composite(warp(lining, chest, body_offset))
        out.alpha_composite(warp(cloth, chest, body_offset))
        head = chest @ rotate(-.18 * look)
        out.alpha_composite(warp(hood_paint, head, chest @ neck + body_offset - head @ neck))
        free = chest @ rotate(.29 * math.sin(phase - .25) * (1 - settle))
        out.alpha_composite(warp(free_paint, free, chest @ free_shoulder + body_offset - free @ free_shoulder))
        grip = chest @ hand_at + body_offset + np.array([1., -15.0 + 2 * settle])
        carry = rotate(.245 + .026 * math.sin(phase - .18)*(1-settle) - .035 * settle)
        out.alpha_composite(warp(weapon, carry, grip - carry @ hand_at))
        out.alpha_composite(warp(hand_paint, chest, grip - chest @ hand_at))
        out.paste((0, 0, 0, 0), (0, FLOOR + 1, CELL, CELL))
        pixels = np.array(out)
        _, labels, stats, _ = cv2.connectedComponentsWithStats(np.uint8(pixels[:,:,3] > 7))
        tiny = np.flatnonzero(stats[1:,cv2.CC_STAT_AREA] < 55)+1
        pixels[np.isin(labels,tiny)] = 0
        out = Image.fromarray(pixels)
        frames.append(out)
        contacts.append({'feet': feet, 'pelvis': pelvis.round(3).tolist(), 'travel': round(travel, 5)})
        grips.append([grip.round(3).tolist(), (chest @ free_shoulder + body_offset).round(3).tolist()])
    return frames, grips, contacts
