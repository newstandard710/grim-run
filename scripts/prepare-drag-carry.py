"""Repose the 96 running cels using the existing split Cut artwork and joints."""
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.spatial import ConvexHull

ART = Path(__file__).resolve().parents[1] / 'assets/motion/v0200'
data_path = ART / 'animation-data.js'
header, payload = data_path.read_text().split('window.GRIM_FORWARD_SCYTHE=')
data = json.loads(payload.strip().rstrip(';'))
cut = json.loads((ART / 'rising-cut-data.js').read_text().split('=', 1)[1].strip().rstrip(';'))
art, paint = data['carry'], cut['paint']
atlas_path = ART / art['url'].split('?')[0].split('/')[-1]
atlas = Image.open(atlas_path).convert('RGBA')
body = Image.open(ART / 'reaper-rising-body.webp').convert('RGBA')
limbs = Image.open(ART / 'reaper-rising-arm.webp').convert('RGBA')
anchor, scale = np.array(paint['anchor']), paint['scale']
w, h = paint['size']
part = paint['partSize']
arm_parts = [limbs.crop((0, i*part, part, (i+1)*part)) for i in range(3)]


def rotate(angle):
    c, s = math.cos(angle), math.sin(angle)
    return np.array([[c, -s], [s, c]])


def layer(source, matrix, offset):
    inv = np.linalg.inv(matrix)
    return source.transform((w, h), Image.Transform.AFFINE, np.c_[inv, -inv @ offset].ravel(),
                            resample=Image.Resampling.BICUBIC)


def cell(slot):
    x, y = slot % paint['columns'] * w, slot // paint['columns'] * h
    return body.crop((x, y, x+w, y+h))


def segment(painting, a, b, target_a, target_b):
    delta = complex(*(np.array(b) - a))
    turn = complex(*(target_b - target_a)) / delta
    matrix = np.array([[turn.real, -turn.imag], [turn.imag, turn.real]])
    return layer(painting, matrix, target_a - matrix @ a)


lean = math.radians(-14)
data['rear']['dragLean'] = lean
edge = np.array(cut['spec']['edge'])
lengths = np.linalg.norm(np.diff(edge,axis=0),axis=1)
length = .15*sum(lengths)
for n, size in enumerate(lengths):
    if length <= size:
        mark = edge[n]+(edge[n+1]-edge[n])*length/size
        break
    length -= size
data['rear']['dragMark'] = mark.round(6).tolist()
for i in range(96):
    pose = paint['poses'][i]
    waist = np.array(pose['waist'])
    shoulder = waist + rotate(lean) @ (pose['shoulder'] - waist)
    phase = math.tau*i/96
    palm = shoulder + [-27.94+.13*math.sin(phase), -1.9+.6*math.cos(phase)]
    data['rear']['hands'][i] = palm.round(5).tolist()
    rest = cell(i)
    pivot = anchor + waist/scale
    rest.alpha_composite(layer(cell(i+122), rotate(lean), pivot-rotate(lean)@pivot))
    delta = palm-shoulder
    span = np.linalg.norm(delta)
    along = (16.15**2-12.25**2+span**2)/(2*span)
    bend = math.sqrt(max(0, 16.15**2-along**2))
    elbow = shoulder + (delta*along + np.array([-delta[1], delta[0]])*bend)/span
    shoulder, elbow, grip = [anchor+p/scale for p in (shoulder, elbow, palm)]
    rest.alpha_composite(segment(arm_parts[0], *paint['upper'], shoulder, elbow))
    rest.alpha_composite(segment(arm_parts[1], *paint['fore'], elbow, grip))
    # Neutral flat-ground shaft angle. Small terrain adjustments turn within the glove.
    local = np.array([-mark[0], mark[1]])
    bank = -math.pi-math.asin(-palm[1]/np.linalg.norm(local))-math.atan2(local[1], local[0])
    wrist = rotate(bank+.227)
    rest.alpha_composite(layer(arm_parts[2], wrist, grip-wrist@paint['grip']))
    # Only the upper pose changes. Retain the released lower leg and toe pixels.
    atlas.paste(rest.crop((0, 0, w, 142)), (i%art['columns']*w, i//art['columns']*h))

# Convex boundary of the painted handle, pommel and cast socket. Omit the cutting plate.
steel = np.array(Image.open(ART/'reaper-forward-scythe.webp').convert('RGBA'))[:,:,3]
y, x = np.where(steel >= 15)
shaft = (y >= 130) | (x <= 106 + (y-60)*.27)
pixels = np.column_stack((x[shaft], y[shaft]))
hull = pixels[ConvexHull(pixels).vertices]
world = (hull-data['weapon']['anchor'])*data['weapon']['scale']
data['rear']['shaft'] = world.round(5).tolist()
atlas.save(atlas_path, lossless=True, method=6, exact=True)
encoded = atlas_path.read_bytes()
digest = hashlib.sha256(encoded).hexdigest()
art['url'] = art['url'].split('?')[0]+'?v='+digest[:12]
data_path.write_text(header+'window.GRIM_FORWARD_SCYTHE='+json.dumps(data,separators=(',', ':'))+';\n')
manifest_path = ART/'manifest.json'
manifest = json.loads(manifest_path.read_text())
manifest['carry'].update(bytes=len(encoded),sha256=digest)
manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
