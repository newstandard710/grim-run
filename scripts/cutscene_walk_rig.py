"""Articulate the vendor painting while retaining its original armor and weapon."""

import math

import cv2
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import distance_transform_edt

CELL = 224
FLOOR = 214
TRAVEL = 400 / 3
FPS = 48
# (time, stage travel, speed) for the hips; boot marks are independent.
ANGEL_TRAVEL = ((0,0,52),(.49,30,67),(1.04,67,68),(1.62,103,52),
                (2.18,127,29),(2.57,TRAVEL,0))
DEVIL_TRAVEL = ((0,0,52),(.49,30,67),(.97,58,48),(1.43,77,34),
                (2.00,101,32),(2.31,107,0))
ANGEL_FEET = (((-.52,131,.14),(.49,198,1.16),(1.62,267,2.28),(2.58,282,4)),
              ((0,164,.59),(1.04,234,1.76),(2.18,299,4)))
DEVIL_FEET = (((-.52,131,.14),(.49,198,1.07),(1.43,244,4)),
              ((0,164,.59),(.97,227,1.57),(2.00,286,4)))


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


def travel_at(t, keys):
    for (a, x, dx), (b, z, dz) in zip(keys, keys[1:]):
        if t <= b:
            u = (t-a)/(b-a)
            return ((2*u**3-3*u*u+1)*x + (u**3-2*u*u+u)*dx*(b-a)
                    + (-2*u**3+3*u*u)*z + (u**3-u*u)*dz*(b-a))
    return keys[-1][1]


def foot(t, steps):
    """Use the heel to take load, the flat sole for support, and the ball to leave."""
    k = max(i for i, (hit, _, _) in enumerate(steps) if t >= hit)
    hit, x, release = steps[k]
    final = k == len(steps)-1
    lift = 0
    # Compress the whole foot roll as the remaining distance shortens.
    # The rear boot's low gather is a short transfer of support.
    incoming = steps[k][1] - steps[k-1][1] if k else 60
    outgoing = steps[k+1][1] - x if not final else 0
    heel_pitch = -.22 * min(1, incoming / 45)
    toe_pitch = .49 * min(1, outgoing / 50)
    if t <= release:
        if t < hit+.105:
            pitch, pivot, state = heel_pitch * (1-ease((t-hit)/.105)), -12, 'heel'
        elif not final and t > release-.14:
            pitch, pivot, state = toe_pitch * ease((t-release+.14)/.14), 9, 'toe'
        else:
            pitch, pivot, state = 0, 0, 'flat'
    else:
        next_hit, target, _ = steps[k+1]
        u = (t-release)/(next_hit-release)
        x += (target-x)*ease(u)
        pitch = toe_pitch*(1-ease(u/.51)) - .22*min(1,outgoing/45)*ease((u-.37)/.63)
        pivot = 9 - 21*ease(u)
        lift = min(13, outgoing*.19)*math.sin(math.pi*u)**1.65
        state = 'swing'
    return x, FLOOR-lift, pitch, pivot, state


def body_pose(t, keys, devil):
    step = max(i for i, key in enumerate(keys[:-1]) if t >= key[0])
    start, end = keys[step][0], keys[step+1][0]
    u = min(1, (t-start)/(end-start))
    phase = math.pi * (step + u)
    brake_start = 1.87 if devil else 2.03
    settle = ease((t-brake_start)/(.80 if devil else .75))
    catch = ease((t-brake_start)/.32)*(1-ease((t-brake_start-.32)/.47))
    load = math.sin(math.pi*min(1,u/.34))**2
    rise = math.sin(math.pi*max(0,(u-.24)/.76))**2
    stride = 1-settle
    pelvis = np.array([(3.4*math.sin(phase-.24)+1.3*load)*stride,
                       (3.1*load-3.4*rise)*stride])
    pelvis += [(-8.8 if devil else 4.4)*settle + 2.8*catch,
               (5.5 if devil else -4.2)*settle + 4.0*catch]
    # Shoulder counterturn arrives after heel contact. The skull stabilizes
    # independently while the ribcage absorbs the weight of the scythe.
    chest_angle = (.025+.084*math.sin(phase+.72))*stride + .080*catch
    chest_angle += (.125 if devil else -.145)*settle
    chest = rotate(chest_angle)
    pivot = np.array([154.,153.])
    offset = pivot + pelvis - chest @ pivot
    if devil:
        claw = ease((t-.52)/.61)
        face = ease((t-1.73)/.79)
        gaze = .14*claw - .37*face
    else:
        gaze = -.12*ease((t-.50)/.63) - .16*ease((t-1.63)/1.02)
    head = rotate(gaze + .35*chest_angle)
    neck = np.array([164.,101.])
    head_offset = chest @ neck + offset - head @ neck
    return phase, settle, catch, pelvis, chest, offset, head, head_offset


def hood_underpaint(base):
    """Continue the original crown slope through the old shaft cutout."""
    # Registered keypose 0. The cloth under the original shaft is occluded.
    # Join the two visible slopes and sample their adjacent folds for color.
    outline = [(137, 84), (144, 79), (152, 76), (158, 75), (164, 75),
               (164, 101), (158, 102), (146, 104), (139, 99)]
    coverage = Image.new('L', (CELL*4, CELL*4))
    ImageDraw.Draw(coverage).polygon([(x*4, y*4) for x,y in outline], fill=255)
    alpha = np.asarray(coverage.resize((CELL, CELL), Image.Resampling.LANCZOS),
                       dtype=np.float32) / 255
    patch = np.zeros((CELL, CELL, 4), dtype=np.float32)
    for y, x in np.argwhere(alpha >= 8/255):
        rear_x = min(143, max(132, 139 + (87-y)//2))
        rear = base[min(101, max(83, y+2)), rear_x, :3]
        front = base[min(101, max(80, y)), 160, :3]
        u = np.clip((x-142) / 19, 0, 1)
        patch[y,x,:3] = (rear*(1-u) + front*u) * alpha[y,x]
        patch[y,x,3] = alpha[y,x]
    return patch


def make_walk(base, devil):
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
    free_arm = polygon([(165,127),(180,130),(196,143),(195,165),(179,164),
                        (176,153),(169,148),(163,142)])
    hood = polygon([(114,92),(144,70),(178,68),(190,82),(192,102),(179,110),
                    (166,112),(152,106),(139,102),(116,102)])

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
    eye_y, eye_x = np.where((hood_paint[:,:,1]-hood_paint[:,:,0]>.18) & (hood_paint[:,:,1]>.5))
    eye_at = np.array([eye_x.mean(), eye_y.mean()])
    backing = hood_underpaint(base)
    bare_cloth = np.uint8((hood_paint[:,:,3] < .05) & (backing[:,:,3] > .99))
    hood_paint += backing * (1-hood_paint[:,:,3:4])
    hand_at = np.array([151., 132.])
    free_shoulder = np.array([165., 131.])
    grid_x, grid_y = xx.astype(np.float32), yy.astype(np.float32)
    trailing = np.clip((135 - grid_x) / 73, 0, 1) ** 1.4
    frames, contacts = [], []

    marks = DEVIL_FEET if devil else ANGEL_FEET
    keys = DEVIL_TRAVEL if devil else ANGEL_TRAVEL
    for i in range(3*FPS + 1):
        t = i / FPS
        travel = travel_at(t, keys)
        phase, settle, brake, pelvis, chest, body_offset, head, head_offset = body_pose(t, keys, devil)
        legs = []
        feet = []
        for j, (pivots, paints) in enumerate(plates):
            old_hip, old_knee, old_ankle = pivots
            x, y, pitch, pivot, state = foot(t, marks[j])
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
            shin_paint = near_greave(paints[1], old_knee, old_ankle, i*64/FPS) if j else paints[1]
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
        cloth_drop = trailing * (1.4 * math.cos(phase - 1.15) * (1 - settle) + (0.9 if devil else 3.9) * settle)
        cloth_wave += 5.2 * trailing * brake
        cloth_drop -= 3.7 * trailing * brake
        cloth_drop += trailing*(2.8 if devil else 4.4)*ease((t-2.48)/.52)
        cloth = cv2.remap(torso, grid_x - cloth_wave, grid_y - cloth_drop, cv2.INTER_LINEAR)
        out = Image.new('RGBA', (CELL,CELL))
        out.alpha_composite(legs[0])
        out.alpha_composite(legs[1])
        out.alpha_composite(warp(lining, chest, body_offset))
        out.alpha_composite(warp(cloth, chest, body_offset))
        out.alpha_composite(warp(hood_paint, head, head_offset))
        free = chest @ rotate(.41*math.sin(phase-.42)*(1-settle) + (-.46 if devil else .49)*settle)
        out.alpha_composite(warp(free_paint, free, chest @ free_shoulder + body_offset - free @ free_shoulder))
        guard = ease((t-.55)/.72) if devil else 0
        grip = chest @ hand_at + body_offset + np.array([
            -2.2*math.sin(phase-.58)*(1-settle) - 2*guard,
            -6.5 + (-4*guard if devil else 4.1*settle)])
        carry = rotate(.035 + .052*math.sin(phase-.58)*(1-settle)
                       + (.067*guard if devil else -.16*settle) - .05*brake)
        carried = warp(weapon, carry, grip - carry @ hand_at)
        out.alpha_composite(carried)
        out.alpha_composite(warp(hand_paint, chest, grip - chest @ hand_at))
        out.paste((0, 0, 0, 0), (0, FLOOR + 1, CELL, CELL))
        pixels = np.array(out)
        _, labels, stats, _ = cv2.connectedComponentsWithStats(np.uint8(pixels[:,:,3] > 7))
        tiny = np.flatnonzero(stats[1:,cv2.CC_STAT_AREA] < 55)+1
        pixels[np.isin(labels,tiny)] = 0
        out = Image.fromarray(pixels)
        frames.append(out)
        eye = head @ eye_at + head_offset
        # Register an exposed cloth pixel independently of its paint color.
        visible = cv2.warpAffine(bare_cloth, np.column_stack([head,head_offset]),
                                 (CELL,CELL), flags=cv2.INTER_NEAREST).astype(bool)
        visible &= np.array(carried)[:,:,3] < 8
        depth = distance_transform_edt(visible)
        cy,cx = np.unravel_index(depth.argmax(), depth.shape)
        crown = [int(cx),int(cy)] if depth[cy,cx] >= 1.5 else None
        contacts.append({'eye': eye.round(3).tolist(), 'crown': crown, 'feet': feet, 'pelvis': pelvis.round(3).tolist(), 'travel': round(travel, 5)})
    return frames, contacts
