"""Construct the isolated forward scythe from the PR91 painted weapon layers."""
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter

from geometry import BASE, OUT, EDGE, SOCKET, POMMEL, SCALE, FLIP, old, grip, profile_transform

ROOT = Path(__file__).resolve().parents[1]
LAYERS = OUT/'layers'
LAYERS.mkdir(exist_ok=True)
S = 640
G = np.array([201.,406.])
pivot = np.array([70.,250.])
shaft_axis = np.array([.226,-.974])
shaft_axis /= np.linalg.norm(shaft_axis)
F = np.diag(FLIP)
face = 2*np.outer(shaft_axis,shaft_axis)-np.eye(2)
image = Image.open(BASE/'assets/motion/v0180/reaper-cut-scythe.png').convert('RGBA')
def mask(points):
    alpha=Image.new('L',image.size)
    ImageDraw.Draw(alpha).polygon(points,fill=255)
    return alpha
head_mask=mask([(0,0),(384,0),(384,175),(108,175),(109,140),(0,140)])
# Keep the large cast collar and its prongs. The cutting plate begins just
# beyond the socket; its old edge is removed before the compact one is placed.
ferrule_mask=mask([(0,0),(107,0),(124,42),(120,74),(111,107),(106,138),(0,146)])
ferrule_mask=ImageChops.multiply(head_mask,ferrule_mask)
plate_mask=ImageChops.subtract(head_mask,ferrule_mask)
shaft_mask=ImageChops.invert(head_mask)
def warp(alpha,m,b):
    t=image.copy()
    t.putalpha(ImageChops.multiply(alpha,image.getchannel('A')))
    inverse=np.linalg.inv(m)
    return t.transform((S,S),Image.Transform.AFFINE,np.c_[inverse,-inverse@b].ravel(),
                       resample=Image.Resampling.BICUBIC)
O=G-grip/SCALE
shaft_m=F
head_m=F@face
plate_m=profile_transform@head_m
shaft=warp(shaft_mask,shaft_m,O-shaft_m@pivot)
ferrule=warp(ferrule_mask,head_m,O-head_m@pivot)
tip=old[0]/SCALE
plate=warp(plate_mask,plate_m,O+tip-profile_transform@tip-plate_m@pivot)
# A blunt steel heel joins the new plate to the retained cast collar.
def src(p):
    return O+head_m@(np.asarray(p)-pivot)
def dst(p):
    return O+tip+profile_transform@(head_m@(np.asarray(p)-pivot)-tip)
heel=Image.new('RGBA',(S,S))
draw=ImageDraw.Draw(heel)
def poly(points):return [tuple(map(float,q)) for q in points]
def bezier(a,b,c,d):
    t=np.linspace(0,1,20)[:,None]
    return (1-t)**3*a+3*(1-t)**2*t*b+3*(1-t)*t*t*c+t**3*d
# Continuous curved heel under the rim and cast collar. Transfer the PR91
# blade's dark steel grain into this small connecting patch.
neck_top=bezier(src([99,63]),src([129,37]),dst([150,53]),dst([176,57]))
neck_lower=bezier(dst([141,102]),dst([107,89]),src([118,76]),src([94,101]))
shape=Image.new('L',(S,S))
ImageDraw.Draw(shape).polygon(poly(np.vstack([neck_top,neck_lower])),fill=255)
left,up,right,down=shape.getbbox()
grain=image.crop((155,43,219,84)).resize((right-left,down-up),Image.Resampling.BICUBIC)
neutral=Image.new('RGBA',grain.size,(114,102,87,255))
grain=Image.blend(neutral,grain,.58)
heel.paste(grain,(left,up))
heel.putalpha(shape.filter(ImageFilter.GaussianBlur(.7)))
draw=ImageDraw.Draw(heel)
draw.line(poly(neck_top[3:18]),fill=(151,131,104,255),width=4)
draw.line(poly(neck_lower[3:17]),fill=(81,65,55,250),width=3)
inner=neck_top*.65+neck_lower[::-1]*.35
draw.line(poly(inner[3:17]),fill=(117,106,92,180),width=2)
heel=heel.filter(ImageFilter.GaussianBlur(.42))
final=Image.new('RGBA',(S,S))
for name,layer in [('shaft',shaft),('steel-heel',heel),('compact-blade',plate),('ferrule',ferrule)]:
    layer.save(LAYERS/(name+'.png'),optimize=True)
    layer.getchannel('A').save(LAYERS/(name+'-mask.png'),optimize=True)
    final.alpha_composite(layer)
bounds=final.getbbox()
assert bounds and all(b>0 for b in bounds) and max(bounds)<S
final=final.crop(bounds)
final.save(OUT/'weapon.webp',lossless=True,method=6)
final.save(OUT/'weapon.png',optimize=True)
metadata={'pivot':(G-bounds[:2]).tolist(),'width':final.width,'height':final.height,'scale':SCALE,
    'edge':EDGE.tolist(),'socket':SOCKET.tolist(),'pommel':POMMEL.tolist(),
    'shaftImageGrip':[44,310],'bladeChord':[float(np.linalg.norm(old[-1]-old[0])),float(np.linalg.norm(EDGE[-1]-EDGE[0]))],
    'layers':{'origins':G.tolist(),'shaft':{'matrix':shaft_m.tolist(),'offset':(O-shaft_m@pivot).tolist()},
              'ferrule':{'matrix':head_m.tolist(),'offset':(O-head_m@pivot).tolist()},
              'blade':{'matrix':plate_m.tolist(),'offset':(O+tip-profile_transform@tip-plate_m@pivot).tolist()}}}
(OUT/'weapon.json').write_text(json.dumps(metadata,indent=2))
print('weapon',final.size,'encoded',*(p.stat().st_size for p in [OUT/'weapon.png',OUT/'weapon.webp']),
      'body length unchanged, visible blade chord',metadata['bladeChord'])
