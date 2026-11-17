"""Author the visual-only trailing carry from the preserved forward-motion source."""

import argparse
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import sys
import tempfile

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ART = Path('assets/motion/v0200')
BODY_ANGLE = -math.pi / 2
CARRY = 'reaper-forward-carry.webp'


def read_data(directory):
    text = (directory / 'animation-data.js').read_text()
    header, _, js = text.partition('window.GRIM_FORWARD_SCYTHE=')
    return header, json.loads(js.strip().rstrip(';'))


def sheet_frame(sheet, art, i):
    w, h, cols = art['width'], art['height'], art['columns']
    x, y = i % cols * w, i // cols * h
    return sheet.crop((x, y, x + w, y + h))


def protected_paint(released, reference, changed):
    """Apply only the newly authored composite difference to the shipped cel."""
    a, b = np.asarray(reference), np.asarray(changed)
    edit = np.any(a != b, axis=-1)
    out = released.copy()
    out.paste(changed, (0, 0), Image.fromarray(edit))
    return out


def run_cel(body, i, *, run_anatomy=True):
    R = body.R
    palm, shoulder, _ = body.run_hold(R, i)
    s = R.grip
    # The RUN source keeps its exact leg contacts, pelvis, hood and cloak.
    try:
        R.grip = Image.new('RGBA', R.grip.size)
        clean = R.draw(i, with_weapon=False, run_anatomy=run_anatomy)[0]
    finally:
        R.grip = s
    base = Image.new('RGBA', (body.W, body.H))
    base.paste(clean, tuple(body.anchor_delta))
    arm, hand, _ = body.draw_limbs(
        R.ANCHOR + shoulder / R.SCALE, R.ANCHOR + palm[:2] / R.SCALE,
        BODY_ANGLE, hold=1)
    base.alpha_composite(body.to_cell(arm))
    base.alpha_composite(body.to_cell(hand))
    return base, palm[:2]


def air_cel(body, i):
    R = body.R
    palm, shoulder = body.air_hold(i)
    arm, hand, _ = body.draw_limbs(
        R.ANCHOR + shoulder / R.SCALE, R.ANCHOR + palm[:2] / R.SCALE,
        -1.4, hold=1)
    base = body.air_body(i).copy()
    for layer in (arm, hand):
        base.alpha_composite(layer)
    return body.to_cell(base), palm[:2]


def carry_outline(body, weapon):
    """Sample the real opaque silhouette at most 3.0 world pixels apart."""
    alpha = np.asarray(body.weapon.getchannel('A'))
    y, x = np.where(alpha >= 32)
    hull = body.cv2.convexHull(np.c_[x, y].astype('int32')).reshape(-1, 2)
    points = (hull - np.asarray(weapon['anchor'])) * weapon['scale']
    contour = []
    for a, b in zip(points, np.roll(points, -1, axis=0)):
        n = max(1, math.ceil(np.linalg.norm(b - a) / 3.0))
        contour.extend(np.linspace(a, b, n, endpoint=False).round(4).tolist())
    return contour


def main(baseline):
    sys.path.insert(0, str(ROOT / 'scripts/forward-scythe'))
    spec = importlib.util.spec_from_file_location('forward_baker', ROOT / 'scripts/prepare-forward-scythe.py')
    author = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(author)
    source, out = baseline / ART, ROOT / ART
    header, data = read_data(source)
    art = data['carry']
    manifest = json.loads((source / 'manifest.json').read_text())
    released = Image.open(source / CARRY).convert('RGBA')
    result = released.copy()
    scale = data['scale']
    original = (source / CARRY).read_bytes()
    assert hashlib.sha256(original).hexdigest() == manifest['carry']['sha256']
    rows = []
    changed_upper = 0
    with tempfile.TemporaryDirectory(prefix='grim-rear-carry-') as temp:
        os.environ['GRIM_FORWARD_BAKE'] = temp
        import weapon
        import body

        # Author against the exact compact scythe paint shipped with PR96.
        assert hashlib.sha256((Path(temp) / 'weapon.webp').read_bytes()).hexdigest() == manifest['weapon']['sha256']
        left, top = (int(a-b) for a,b in zip(body.ANCHOR, art['anchor']))
        box = left, top, left + art['width'], top + art['height']
        seq = []
        for i in range(96):
            cel, palm = run_cel(body, i)
            seq.append((cel, body.carried(i, run_anatomy=True), palm))
        for i in range(26):
            cel, palm = air_cel(body, i)
            seq.append((cel, body.carried_air(i)[0], palm))
        for i in (0, 48):
            run, palm = run_cel(body, i, run_anatomy=False)
            mark = Image.new('RGBA', (body.W, body.H))
            x, y = body.ANCHOR + palm / scale
            ImageDraw.Draw(mark).ellipse((x - 1, y - 1, x + 1, y + 1), fill='white')
            mark_rise = np.asarray(author.forward_slide_rise(body, mark).getchannel('A'), dtype=float)
            iy, ix = np.indices(mark_rise.shape)
            mapped = (np.array([(ix*mark_rise).sum(), (iy*mark_rise).sum()]) /
                      mark_rise.sum() - body.ANCHOR) * scale
            seq.append((author.forward_slide_rise(body, run),
                        author.forward_slide_rise(body, body.carried(i)), mapped))
        assert len(seq) == art['frames']
        for i, (a, b, palm) in enumerate(seq):
            orig = sheet_frame(released, art, i)
            cel = protected_paint(orig, b.crop(box), a.crop(box))
            # The lower leg/contact domain must stay byte-identical.
            cut_y = 143
            changed_upper += int(np.any(np.asarray(cel)[:cut_y] != np.asarray(orig)[:cut_y], axis=-1).sum())
            assert np.array_equal(np.asarray(orig)[cut_y:], np.asarray(cel)[cut_y:]), f'lower rows changed at {i}'
            result.paste(cel, (i % art['columns'] * art['width'], i // art['columns'] * art['height']))
            rows.append(palm.round(5).tolist())
        outline = carry_outline(body, data['weapon'])
        data['rear'] = {'hands': rows, 'outline': outline}
        print('protected rows 143–183 across', len(rows), 'frames; changed upper pixels', changed_upper,
              'silhouette samples', len(outline), flush=True)
        pending = Path(temp) / CARRY
        result.save(pending, lossless=True, quality=100, method=4, exact=True)
        blob = pending.read_bytes()
        with Image.open(pending) as reloaded:
            assert np.array_equal(np.asarray(result), np.asarray(reloaded.convert('RGBA')))
    sha = hashlib.sha256(blob).hexdigest()
    art['url'] = art['url'].partition('?')[0] + '?v=' + sha[:12]
    manifest['carry'].update(bytes=len(blob), sha256=sha)
    (out / CARRY).write_bytes(blob)
    (out / 'animation-data.js').write_text(header + 'window.GRIM_FORWARD_SCYTHE=' +
                                          json.dumps(data, separators=(',', ':')) + ';\n')
    (out / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print('wrote', len(blob), 'bytes', sha, flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('baseline', type=Path, help='checkout containing the exact released carry art')
    main(parser.parse_args().baseline.resolve())
