"""Source-registered forward carry for existing RUN and ordinary air cels."""
import math

import cv2
import numpy as np
from PIL import Image

SOURCE_SHOULDER = np.array([123., 103.])
HOLD_ANGLE = 13
CUT_END = 260
ACTIVE_END = 205.4
AIR_KEYS = (0, 4, 12, 16, 18, 20, 23)
AIR_COLLARS = ((-23, -90), (-22, -88), (-18, -87), (-23, -91), (-23, -95),
               (-22, -79), (-22, -93))
AIR_POMMELS = ((-59, -27), (-53, -24), (-54, -34), (-54, -26), (-38, -28),
               (-59, -19), (-54, -33))
# Each value is an existing airy hold band, including the first landing frame.
# Match the new forward running silhouette, then let the jump gather it closer.
AIR_PALMS = ((-18, -57, 14), (-22, -56, 18), (-21, -56, 17), (-17, -58, 14),
             (-17, -56, 13), (-18, -54, 14), (-17, -57, 13))
AIR_HOOD_TOP = (71, 72, 72, 72, 68, 82, 66)
AIR_SHOULDERS = ((1, -60), (1, -59), (3, -58), (2, -61), (1, -57), (1, -56), (2, -60))


def ease(u):
    u = min(1, max(0, u))
    return u * u * (3 - 2 * u)


def bell(age, start, center, end):
    """Smooth peak for a small linked pose adjustment."""
    u = ease((age - start) / (center - start)) if age < center else ease((end - age) / (end - center))
    return u * u * (3 - 2 * u)


def palm_age(age):
    """Move the return earlier inside its own window, with matched endpoint tangents."""
    u = (age - ACTIVE_END) / (CUT_END - ACTIVE_END)
    if 0 < u < 1:
        return age + 4.5 * math.sin(math.pi * u) ** 2
    return age


def endpoints(age):
    if age < 52:
        return ease(1 - age / 52), 0
    if age > ACTIVE_END:
        return ease((age - ACTIVE_END) / (CUT_END - ACTIVE_END)), CUT_END
    return 0., None


def run_hold(run, frame):
    q = (frame % (run.FRAMES // run.GAITS)) / (run.FRAMES // run.GAITS)
    beat = math.tau * q
    offset = np.array([1.3 * math.sin(beat - .32),
                       2.6 * math.cos(2 * beat) + .68 * math.sin(2 * beat)])
    palm = (np.array([87, 107]) + run.torso_offset(107) + offset - run.ANCHOR) * run.SCALE
    angle = 2.1 * math.sin(2 * beat - .75)
    shoulder = (SOURCE_SHOULDER + offset - run.ANCHOR) * run.SCALE
    return np.r_[palm, HOLD_ANGLE + angle], shoulder, q


def air_key(frame):
    if frame >= 18:
        i = min(frame - 18, len(AIR_KEYS) - 1) if frame < 25 else 3
        return i, 0.
    return frame // 3, (frame % 3 + 1) / 4


def between(values, frame):
    i, t = air_key(frame)
    a, b = np.asarray(values[i]), np.asarray(values[min(i + 1, len(values) - 1)])
    return a * (1 - t) + b * t


def air_hold(frame):
    return between(AIR_PALMS, frame), between(AIR_SHOULDERS, frame)


def stock_air(sheet, frame):
    x, y = frame % 8 * 224, frame // 8 * 184
    return sheet.crop((x, y, x + 224, y + 184))


def strip_air_weapon(paint, frame, scale):
    """Remove exposed old steel and retouch the wood crossing the cape."""
    rgba = np.array(paint)
    yy, xx = np.indices(rgba.shape[:2])
    x, y = (xx-125)*scale, (yy-168)*scale
    a, b = between(AIR_COLLARS, frame), between(AIR_POMMELS, frame)
    delta = b - a
    u = np.clip(((x-a[0])*delta[0]+(y-a[1])*delta[1]) / (delta @ delta), 0., 1.)
    series = np.hypot(x-a[0]-u*delta[0], y-a[1]-u*delta[1])
    # Head is in clear air. The old hands and the straight shaft are masked
    # only over the cloak so the new sleeve settles onto the original torso.
    blade = (y < a[1]+9) & (x < a[0]+14)
    pommel = np.hypot(x-b[0], y-b[1]) < 8
    wood = (series < np.where(u > .37, 6.2, 4.8)) & ~blade & ~pommel
    mask = np.uint8(wood | pommel) * 255
    for offset, size in ((0, 3), (3, 1)):
        part = rgba[:, :, offset:offset+size]
        rgba[:, :, offset:offset+size] = cv2.inpaint(part, mask, 3, cv2.INPAINT_TELEA).reshape(part.shape)
    rgba[blade] = 0
    # Near the exposed pommel the old bone hand sometimes sticks below the cape.
    near_tip = pommel & (x < -46)
    rgba[near_tip & (rgba[:, :, 3] < 200)] = 0
    # A cast prong can project away from the old shaft above the hood.
    # Remove those disconnected pieces, including their antialiased edge,
    # only in the band above the top of the original body.
    _, labels, stats, _ = cv2.connectedComponentsWithStats(np.uint8(rgba[:, :, 3] > 105), 8)
    main = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
    edge = stats[main, cv2.CC_STAT_TOP]
    remnants = (labels != 0) & (labels != main) & (yy <= edge + 5)
    collar = cv2.dilate(np.uint8(remnants), np.ones((3, 3), np.uint8)) > 0
    rgba[collar & (labels != main)] = 0
    hood_y = float(between(AIR_HOOD_TOP, frame))
    # When the prong touches the outline, its knot lies to the left or above
    # the measured hood crown. Keep the right side of the original hood.
    above_crown = (yy < hood_y - 1) & (xx < 139)
    at_back = (yy < hood_y + 4) & (xx < 125)
    rgba[above_crown | at_back] = 0
    return Image.fromarray(rgba)
