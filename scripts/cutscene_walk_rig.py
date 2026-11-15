"""Articulate the vendor painting while retaining its original armor and weapon."""

import math

import cv2
import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt

CELL = 224
FLOOR = 214
STRIDE = 100 * .4 / .6
STANCE = .61
SAMPLES = 96


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


def foot(q, center):
    """Keep the forefoot locked in world x through support and toe-off."""
    contact = center - q * STRIDE
    if q <= STANCE:
        heel_rise = .52 * ease((q - .35) / (STANCE - .35))
        return contact, FLOOR, heel_rise
    u = (q - STANCE) / (1 - STANCE)
    # Preserve travel derivative at release and on the next touchdown.
    edge = u * (1 - u) * ((1 - u) ** 5 - u ** 5)
    x = center - STANCE * STRIDE * (1 - ease(u)) - STRIDE * (1 - STANCE) * edge
    lift = 13 * math.sin(math.pi * u) ** 1.5
    pitch = .52 * (1 - ease(u / .35)) - .21 * math.sin(math.pi * u) ** 2
    return x, FLOOR - lift, pitch


def make_walk(base):
    base = base.astype(np.float32) / 255
    base[:, :, :3] *= base[:, :, 3:4]

    far = [
        ([148, 159], [129, 182], [103, 199], [110, 213], 160),
        [(137,156),(157,159),(151,172),(137,183),(126,189),(118,181),(128,170)],
        [(121,177),(137,181),(130,188),(112,202),(99,207),(92,199),(103,190)],
        [(95,194),(105,193),(112,199),(127,211),(122,216),(104,215),(93,210),(91,201)],
    ]
    near = [
        ([164, 159], [170, 178], [176, 199], [187, 213], 174),
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
        born_hip, born_knee, born_ankle, born_ball, center = spec
        images = [np.where(mask[:, :, None], base, 0) for mask in masks]
        plates.append((np.array([born_hip, born_knee, born_ankle, born_ball]), center, images))
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
    weapon = np.where((scythe & ~hand)[:, :, None], base, 0)
    hand_paint = np.where(hand[:, :, None], base, 0)
    free_paint = np.where(free_arm[:, :, None], base, 0)
    hood_paint = np.where((hood & ~scythe)[:, :, None], base, 0)
    hand_at = np.array([151., 132.])
    neck = np.array([164., 101.])
    free_shoulder = np.array([165., 131.])
    grid_x, grid_y = xx.astype(np.float32), yy.astype(np.float32)
    trailing = np.clip((135 - grid_x) / 73, 0, 1) ** 1.4
    frames, contacts, grips = [], [], []

    for i in range(2 * SAMPLES + 1):
        walk = i < SAMPLES
        q = i / SAMPLES if walk else 0
        phase = 2 * math.pi * q
        stop = 0 if walk else (i - SAMPLES) / SAMPLES
        settle = ease(stop)
        look = ease((stop - .32) / .68)
        pelvis = np.array([1.9 * math.sin(phase) + settle * 1.3,
                           2.5 * math.cos(2 * phase - .63) - settle * 9.2])
        chest = rotate(.065 + .078 * math.sin(phase + .65) - settle * .16)
        chest_pivot = np.array([154., 153.])
        body_offset = chest_pivot + pelvis - chest @ chest_pivot
        out = Image.new('RGBA', (CELL, CELL))
        feet = []
        for j, (pivots, center, paints) in enumerate(plates):
            old_hip, old_knee, old_ankle, ball = pivots
            foot_phase = (q + (.5 if j == 0 else 0)) % 1
            x, y, pitch = foot(foot_phase, center)
            if not walk and j == 0:
                gather = ease(stop / .64)
                x += 18 * gather
                y -= 9 * math.sin(math.pi * gather)
                pitch *= 1 - gather
            if not walk and j == 1:
                pitch = 0
            shoe = rotate(pitch)
            anchor = np.array([x, y])
            shift = anchor - shoe @ ball
            ankle = shoe @ old_ankle + shift
            hip = old_hip + pelvis + np.array([(-1 if j == 0 else 1) * 2.5 * math.sin(phase), -4.0])
            direction = ankle - hip
            distance = np.linalg.norm(direction)
            thigh, shin = 30., 29.5
            assert abs(thigh - shin) < distance < thigh + shin, (i, j, distance)
            unit = direction / distance
            along = (thigh**2 - shin**2 + distance**2) / (2 * distance)
            bend = math.sqrt(thigh**2 - along**2)
            knee = hip + unit * along + np.array([unit[1], -unit[0]]) * bend
            out.alpha_composite(segment(paints[0], old_hip, old_knee, hip, knee))
            out.alpha_composite(segment(paints[1], old_knee, old_ankle, knee, ankle))
            out.alpha_composite(warp(paints[2], shoe, shift))
            feet.append({'forefoot': anchor.round(3).tolist(), 'knee': knee.round(3).tolist()})
        cloth_wave = trailing * (2.4 * math.sin(phase - .9) * (1 - settle))
        cloth_drop = trailing * (1.4 * math.cos(phase - 1.15) * (1 - settle) + 2.2 * settle)
        cloth = cv2.remap(torso, grid_x - cloth_wave, grid_y - cloth_drop, cv2.INTER_LINEAR)
        out.alpha_composite(warp(cloth, chest, body_offset))
        head = chest @ rotate(-.18 * look)
        out.alpha_composite(warp(hood_paint, head, chest @ neck + body_offset - head @ neck))
        free = chest @ rotate(.29 * math.sin(phase - .25) * (1 - settle))
        out.alpha_composite(warp(free_paint, free, chest @ free_shoulder + body_offset - free @ free_shoulder))
        grip = chest @ hand_at + body_offset - np.array([0., 8.0 - 2 * settle])
        carry = rotate(.045 * math.sin(phase - .18) + .025 * settle)
        out.alpha_composite(warp(weapon, carry, grip - carry @ hand_at))
        out.alpha_composite(warp(hand_paint, chest, grip - chest @ hand_at))
        out.paste((0, 0, 0, 0), (0, FLOOR + 1, CELL, CELL))
        frames.append(out)
        contacts.append({'feet': feet, 'pelvis': pelvis.round(3).tolist()})
        grips.append([grip.round(3).tolist(), (chest @ free_shoulder + body_offset).round(3).tolist()])
    return frames, grips, contacts
