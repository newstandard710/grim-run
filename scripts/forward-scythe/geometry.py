"""Source coordinates for the authored forward carry and scythe profile."""
import json
import os
from pathlib import Path

import numpy as np

ROOT=Path(__file__).resolve().parent
BASE=ROOT.parents[1]
OUT=Path(os.environ['GRIM_FORWARD_BAKE'])
paint=json.loads((ROOT/'scythe-poses.json').read_text())['paint']
SCALE=paint['worldScale']
FLIP=np.array([-1.,1.])
marks=paint['landmarks']
old=np.asarray(marks['edge'])*FLIP*SCALE
grip=(np.array([44.,310.])-np.array([70.,250.]))*FLIP*SCALE
axis=(old[-1]-old[0])/np.linalg.norm(old[-1]-old[0])
basis=np.outer(axis,axis)
profile_transform=.65*basis+.80*(np.eye(2)-basis)
EDGE=old[0]+(old-old[0])@profile_transform.T-grip
SOCKET=np.array(marks['socket'])*FLIP*SCALE-grip
POMMEL=np.array(marks['pommel'])*FLIP*SCALE-grip

def smooth(v):
    u=np.clip(v,0,1)
    return u*u*(3-2*u)

def rotate(values,a):
    x,y=np.asarray(values).T
    c=np.cos(a)[...,None]
    s=np.sin(a)[...,None]
    return np.stack([c*x-s*y,s*x+c*y],axis=-1)

def source_shoulder():
    from scipy.interpolate import PchipInterpolator
    k=(0,3,6,9,13,17,20,23)
    hip=PchipInterpolator(k,[(0,0),(-1,-.2),(-2,.5),(0,-.5),(5,2),(3,2),(1,-.8),(0,-1)],axis=0)
    lean=PchipInterpolator(k,[0,-.05,-.09,.04,.12,.08,.02,0])
    def at(t):
        p=t/260
        f=np.where(p<.2,p/.2*6,np.where(p<.79,6+(p-.2)/.59*12,18+(p-.79)/.21*5))
        p=np.clip(p,0,1)
        adv=8*smooth((p-.2)/.39)*(1-smooth((p-.68)/.32))
        s=(np.array([104,118])+hip(f)+rotate([[19,-15]],lean(f))[:,0,:]-[123,168])*13/15
        return s+np.column_stack([adv,np.zeros(len(t))])
    return at

