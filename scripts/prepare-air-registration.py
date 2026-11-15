"""Bake the visual-only jump and tuck registration strip from PR90 paintings.

The original motion and action atlases remain the gameplay-readiness and
missing-art references. World scale is shared with the jump detail strip.
"""
from hashlib import sha256
from pathlib import Path
import importlib.util
import json

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'assets/motion/v0180'
WIDTH, HEIGHT, COLUMNS = 224, 184, 8
ANCHOR = (125, 168)
SCALE = 13 / 15
KEYS = (0, 4, 12, 16, 18, 20, 23)
# World-space axes picked from the painted ferrules. The deformation falls
# away at the shaft and below the upper body, so it does not resize the blade,
# change the hand contact, or drag the toe along with the upper silhouette.
POMMELS = ((-59, -27), (-53, -24), (-54, -34), (-54, -26), (-38, -28),
           (-59, -19), (-54, -33))
COLLARS = ((-23, -90), (-22, -88), (-18, -87), (-23, -91), (-23, -95),
           (-22, -79), (-22, -93))
HEAD_Y = (-65, -65, -64, -67, -68, -53, -66)
HEAD_X_OFFSET = (10, 7, 7, 8, 8, 9, 12)
HEAD_Y_OFFSET = (-3, -2, -1, -1, -2, -2, -3)
# Pommel-side hand and blade-side hand in world coordinates.
JUMP_HANDS = (((-42, -50), (-31, -70)), ((-40, -55), (-29, -75)),
              ((-42, -53), (-31, -73)))
TUCK_HANDS = ((-10, -47), (11, -49))
TUCK_COLLAR, TUCK_POMMEL = (35, -51), (-39, -46)
WEAPON_GRIP = (251, 247)
WEAPON_SCALE = .286

cv2.setNumThreads(1)


def pixel_array(image):
    return np.asarray(image, dtype=np.float32) / 255


def straight(premultiplied):
    premultiplied[:, :, :3] /= np.maximum(premultiplied[:, :, 3:4], 1 / 255)
    return Image.fromarray(np.uint8(np.clip(premultiplied * 255 + .5, 0, 255)))


def premultiply(image):
    rgba = pixel_array(image)
    rgba[:, :, :3] *= rgba[:, :, 3:4]
    return rgba


def cell(sheet, index, columns, width, height):
    x, y = index % columns * width, index // columns * height
    return sheet.crop((x, y, x + width, y + height))


def fit(image, origin, scale):
    ratio = scale / SCALE
    matrix = np.float32([[ratio, 0, ANCHOR[0] - ratio * origin[0]],
                         [0, ratio, ANCHOR[1] - ratio * origin[1]]])
    return straight(cv2.warpAffine(premultiply(image), matrix, (WIDTH, HEIGHT),
                                   flags=cv2.INTER_LANCZOS4))


def smooth(t):
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)


y_px, x_px = np.indices((HEIGHT, WIDTH), dtype=np.float32)
x_world = (x_px - ANCHOR[0]) * SCALE
y_world = (y_px - ANCHOR[1]) * SCALE


def registered(image, segment, t=0, contact=0):
    def between(values):
        return np.asarray(values[segment]) * (1 - t) + np.asarray(values[min(segment + 1, 6)]) * t

    a, b = between(COLLARS), between(POMMELS)
    u = np.clip(((x_world - a[0]) * (b[0] - a[0]) + (y_world - a[1]) * (b[1] - a[1])) /
                np.sum((b - a) ** 2), 0, 1)
    shaft_distance = np.hypot(x_world - a[0] - u * (b[0] - a[0]),
                              y_world - a[1] - u * (b[1] - a[1]))
    eye = between(HEAD_Y)
    upper = smooth((y_world - eye + 24) / 10) * smooth((eye + 36 - y_world) / 30)
    body = upper * smooth((x_world + 49) / 24) * smooth((shaft_distance - 5) / 8)
    dx = body * between(HEAD_X_OFFSET)
    dy = body * between(HEAD_Y_OFFSET) - contact * smooth((y_world + 27) / 24)
    return straight(cv2.remap(premultiply(image), (x_px - dx / SCALE).astype(np.float32),
                              (y_px - dy / SCALE).astype(np.float32), cv2.INTER_CUBIC))


def distance_to_segment(a, b):
    direction = np.subtract(b, a)
    along = np.clip(((x_world - a[0]) * direction[0] + (y_world - a[1]) * direction[1]) /
                    (direction @ direction), 0, 1)
    return np.hypot(x_world - a[0] - along * direction[0],
                    y_world - a[1] - along * direction[1])


def mask_blade(collar):
    return y_world < collar[1] + 3


def grip_mask(hands, radius):
    a, b = hands
    return np.minimum(np.hypot(x_world - a[0], y_world - a[1]),
                      np.hypot(x_world - b[0], y_world - b[1])) < radius


def separate_weapon(paint, shaft, hands, blade):
    # Keep the fists in the body paint and retouch the narrow wood strip
    # underneath them. The exposed blade is an independent rigid silhouette.
    rgba = np.array(paint)
    wood = (distance_to_segment(*shaft) < 4.3) & ~grip_mask(hands, 4.3)
    pommel = np.hypot(x_world - shaft[1][0], y_world - shaft[1][1]) < 7.1
    mask = np.uint8((wood | pommel) & ~blade) * 255
    rgba[:, :, :3] = cv2.inpaint(rgba[:, :, :3], mask, 3, cv2.INPAINT_TELEA)
    rgba[:, :, 3] = cv2.inpaint(rgba[:, :, 3], mask, 3, cv2.INPAINT_TELEA)
    rgba[blade] = 0
    return rgba.astype(np.float32) / 255


def armed_transition(body, hands, weapon):
    rear, front = hands
    heading = front - rear
    radians = np.arctan2(heading[0], -heading[1])
    factor = WEAPON_SCALE / SCALE
    c, s = np.cos(radians) * factor, np.sin(radians) * factor
    matrix = np.float32([[c, -s, 0], [s, c, 0]])
    matrix[:, 2] = np.asarray(ANCHOR) + rear / SCALE - matrix[:, :2] @ WEAPON_GRIP
    blade = straight(cv2.warpAffine(weapon, matrix, (WIDTH, HEIGHT), flags=cv2.INTER_LANCZOS4))
    hand = np.array(body)
    hand[:, :, 3] *= grip_mask(hands, 4.2)
    body.alpha_composite(blade)
    body.alpha_composite(Image.fromarray(hand))
    rgba = np.array(body)
    solid = np.uint8(rgba[:, :, 3] > 64)
    _, labels, sizes, _ = cv2.connectedComponentsWithStats(solid, connectivity=8)
    specks = np.isin(labels, np.flatnonzero(sizes[:, cv2.CC_STAT_AREA] < 26))
    rgba[specks] = 0
    return Image.fromarray(rgba)


def transition_module():
    script = Path(__file__).with_name('prepare-opaque-transitions.py')
    spec = importlib.util.spec_from_file_location('opaque_transitions', script)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def build():
    base = Image.open(ART / 'reaper-jump.png').convert('RGBA')
    detail = Image.open(ART / 'reaper-jump-deliberate.webp').convert('RGBA')
    actions = Image.open(ROOT / 'assets/powers/reaper-actions.png').convert('RGBA')
    # The established jump samples retain their phase and only receive the
    # same localized registration correction as their corresponding keys.
    tweens = [registered(fit(cell(detail, index, 6, 192, 192), (123, 168), SCALE),
                         index // 3, (index % 3 + 1) / 4,
                         contact=5.2 * (1 - (index % 3 + 1) / 4) ** 2 if index // 3 == 3 else 0)
              for index in range(18)]
    native = [fit(cell(base, key, 6, 320, 320), (205, 280), .52) for key in KEYS]
    keys = [registered(image, idx) for idx, image in enumerate(native)]
    contact = [registered(native[3], 3, contact=5.2)]
    tuck = [fit(cell(actions, idx, 4, 512, 512), (288, 400), .375) for idx in range(4)]
    # Optical flow improves the cloth and body contours only. The scythe is
    # composited separately so the transition can never erase half the blade.
    between = transition_module().between
    weapon = premultiply(Image.open(ART / 'scythe.png').convert('RGBA'))
    release = []
    entry = []
    tuck_low = (x_world > 27) | ((x_world > 20) & (y_world > -56) & (y_world < -45))
    tuck_release = separate_weapon(tuck[3], (TUCK_COLLAR, TUCK_POMMEL), TUCK_HANDS, tuck_low)
    tuck_entry_hands = ((-6, -38), (18, -40))
    tuck_entry = separate_weapon(tuck[0], ((35, -43), (-39, -30)), tuck_entry_hands,
                                 (x_world > 29) | ((x_world > 22) & (y_world > -47) & (y_world < -34)))
    for idx, hands in zip((1, 2, 3), JUMP_HANDS):
        jump_body = separate_weapon(keys[idx], (COLLARS[idx], POMMELS[idx]), hands,
                                    mask_blade(COLLARS[idx]))
        for i, frame in enumerate(between(tuck_release, jump_body, (.25, .50, .75), lock_paint=True), 1):
            t = i / 4
            grip = np.float32(TUCK_HANDS) * (1 - t) + np.float32(hands) * t
            release.append(armed_transition(frame, grip, weapon))
        for t, frame in zip((.58, .79), between(jump_body, tuck_entry, (.58, .79), lock_paint=True)):
            grip = np.float32(hands) * (1 - t) + np.float32(tuck_entry_hands) * t
            entry.append(armed_transition(frame, grip, weapon))
    # Leave the physical landing clock alone. These paintings occupy only its
    # initial compression window, before the existing landing or slide track.
    landing_hands = ((-35, -49), (-28, -73))
    landing_body = separate_weapon(keys[4], (COLLARS[4], POMMELS[4]), landing_hands,
                                   mask_blade(COLLARS[4]))
    touchdown = []
    for t, frame in zip((.39, .74), between(tuck_release, landing_body, (.39, .74), lock_paint=True)):
        grip = np.float32(TUCK_HANDS) * (1 - t) + np.float32(landing_hands) * t
        touchdown.append(armed_transition(frame, grip, weapon))
    slide_sheet = Image.open(ROOT / 'assets/motion/v01912/ground-slide.webp').convert('RGBA')
    slide = fit(cell(slide_sheet, 2, 4, 224, 144), (180, 132), 1)
    # In this cut the rear blade falls outside the body silhouette. Strip it
    # and its attached shaft before composing the bridging weapon.
    slide_hands = ((-18, -28), (-42, -39))
    slide_body = separate_weapon(slide, ((-81, -48), (-2, -23)), slide_hands, x_world < -89)
    slide_join = next(between(tuck_release, slide_body, (.61,), lock_paint=True))
    touchdown.append(armed_transition(slide_join, np.float32(((-12, -36), (-27, -59))), weapon))
    poses = tweens + keys + contact + tuck + release + entry + touchdown
    canvas = Image.new('RGBA', (WIDTH * COLUMNS, HEIGHT * ((len(poses) + COLUMNS - 1) // COLUMNS)))
    for index, pose in enumerate(poses):
        alpha = np.asarray(pose.getchannel('A'))
        ys, xs = np.where(alpha >= 128)
        assert len(xs) > 2700 and xs.min() > 0 and ys.min() > 0 and xs.max() < WIDTH - 1, index
        canvas.paste(pose, (index % COLUMNS * WIDTH, index // COLUMNS * HEIGHT))
    output = ART / 'reaper-air-registration.webp'
    canvas.save(output, lossless=True, method=6, exact=True)
    digest = sha256(output.read_bytes()).hexdigest()
    print(json.dumps({'file': output.name, 'frames': len(poses), 'size': canvas.size,
                      'bytes': output.stat().st_size, 'sha256': digest}))


if __name__ == '__main__':
    build()
