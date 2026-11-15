"""Bake the Canvas vendor animation from the WebGL mesh and accepted paintings."""
import hashlib
import json
from pathlib import Path
import subprocess

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / 'assets/cutscenes/v0197/vendor-canvas.webp'
ACTORS = ('angel', 'demon')
FRAMES, COLUMNS = 24, 8
W, H, MARGIN = 256, 208, 8
NX, NY = 24, 28

# Sample the production deformation, including the motionless three-second pose.
sample = '''
require('./assets/visuals/cutscene-motion.js');
const A = global.GRIM_CUTSCENES;
const [frames, nx, ny] = process.argv.slice(1).map(Number);
const poses = [false,true].flatMap(devil => Array.from({length:frames},(_,i)=>{
  const t = i/(frames-1)*A.VENDOR_ANIMATION_SECONDS;
  return Array.from({length:(nx+1)*(ny+1)},(_,j)=>{
    const p = A.merchantPoint((j%(nx+1))/nx,Math.floor(j/(nx+1))/ny,t,devil);
    return [p.x,p.y];
  });
}));
process.stdout.write(JSON.stringify(poses));
'''
poses = json.loads(subprocess.check_output(
    ['node', '-e', sample, str(FRAMES), str(NX), str(NY)], cwd=ROOT
))

source_points = np.asarray(
    [(x/NX*W - .5, y/NY*H - .5) for y in range(NY+1) for x in range(NX+1)],
    dtype=np.float32,
)
triangles = []
for y in range(NY):
    for x in range(NX):
        a = y*(NX+1)+x
        triangles.extend(((a,a+NX+1,a+1),(a+1,a+NX+1,a+NX+2)))


def paint(source, points):
    """Map each destination triangle back to its original UV coordinates."""
    mx = np.full((H+2*MARGIN,W+2*MARGIN), -100, dtype=np.float32)
    my = mx.copy()
    destination = np.asarray(points,dtype=np.float32)*[W,H]+MARGIN-.5
    for triangle in triangles:
        indices = list(triangle)
        screen = np.float32(destination[indices])
        back = cv2.getAffineTransform(screen,source_points[indices])
        x0,y0 = np.maximum(0,np.floor(screen.min(axis=0)).astype(int))
        x1,y1 = np.minimum([mx.shape[1],mx.shape[0]],np.ceil(screen.max(axis=0)).astype(int)+1)
        mask = np.zeros((y1-y0,x1-x0),dtype=np.uint8)
        cv2.fillConvexPoly(mask,np.round((screen-[x0,y0])*256).astype(np.int32),1,shift=8)
        y,x = np.where(mask)
        x,y = x+x0,y+y0
        mx[y,x] = back[0,0]*x+back[0,1]*y+back[0,2]
        my[y,x] = back[1,0]*x+back[1,1]*y+back[1,2]
    tile = cv2.remap(source,mx,my,cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
    tile[:,:,:3] /= np.maximum(tile[:,:,3:4],1/255)
    return Image.fromarray(np.uint8(np.clip(tile*255+.5,0,255)))


cell = (W+2*MARGIN,H+2*MARGIN)
atlas = Image.new('RGBA',(cell[0]*COLUMNS,cell[1]*(len(poses)//COLUMNS)))
for kind,actor in enumerate(ACTORS):
    texture = ROOT / f'assets/characters/vendors/{actor}-vendor-v1.webp'
    source = np.asarray(Image.open(texture).convert('RGBA').resize((W,H),Image.Resampling.LANCZOS),
                        dtype=np.float32)/255
    source[:,:,:3] *= source[:,:,3:4]
    for i in range(FRAMES):
        k = kind*FRAMES+i
        atlas.paste(paint(source,poses[k]),(k%COLUMNS*cell[0],k//COLUMNS*cell[1]))
atlas.save(DESTINATION,quality=79,method=6,exact=False)
raw = DESTINATION.read_bytes()
print(f'{DESTINATION.name}: {atlas.size}, {len(raw):,} bytes, SHA-256 {hashlib.sha256(raw).hexdigest()}')
