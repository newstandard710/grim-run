"""Two-link painted leg rig: fixed planted boots, smooth swing and one rigid scythe."""
import numpy as np
import cv2
from PIL import Image

def make_walk(base):
    C=224;S=.4;offset=np.array([40,20.4])
    def pt(v):return np.array(v)*S+offset
    def poly(v):return np.round(np.array(v)*S+offset).astype('int32')
    specs=[{'hip':[276,349],'knee':[225,404],'ankle':[166,442],'polygon':[[280,344],[301,354],[278,379],[264,405],[240,416],[221,429],[203,442],[209,462],[213,481],[200,488],[166,487],[145,476],[127,460],[121,443],[135,427],[150,413],[166,412],[207,391],[233,373]],'phase':.5}, {'hip':[318,349],'knee':[337,391],'ankle':[340,438],'polygon':[[304,334],[340,346],[352,388],[351,414],[368,438],[410,465],[405,484],[351,485],[316,469],[308,430],[311,402],[295,376]],'phase':0}]
    for s in specs:
     mask=np.zeros((C,C),'uint8');cv2.fillPoly(mask,[poly(s['polygon'])],255);mask[:,round(273*S+40):round(294*S+40)]=0;s['mask']=mask
     s['image']=base.copy();s['image'][mask==0]=0
    body=base.copy();body[(specs[0]['mask']>0)|(specs[1]['mask']>0)]=0
    
    
    def warp(part,a,b,c,d):
     a,b,c,d=map(lambda v:np.array(v,dtype='float32'),[a,b,c,d]);n=b-a;n=np.array([-n[1],n[0]])/np.linalg.norm(n)*8
     m=d-c;m=np.array([-m[1],m[0]])/np.linalg.norm(m)*8
     matrix=cv2.getAffineTransform(np.array([a,b,a+n]),np.array([c,d,c+m]));return Image.fromarray(cv2.warpAffine(part,matrix,(C,C),flags=cv2.INTER_LINEAR))
    # Source-space foot travel cancels body advance during the 60% stance.
    # Hermite swing endpoints retain stance velocity; vertical velocity is zero
    # at toe-off/contact. Upper/shin/boot layers are painted pixels, not lines.
    def foot(q):
     if q<.6:return 50-q/.6*100,0,0
     t=(q-.6)/.4;return (-50*(2*t**3-3*t*t+1)-66.6667*(t**3-2*t*t+t)+50*(-2*t**3+3*t*t)-66.6667*(t**3-t*t),-40*np.sin(np.pi*t)**2,-.18*np.sin(np.pi*t))
    for q in [0,.1,.3,.59]:
        x,y,_=foot(q)
        assert abs(x+(100/.6)*q-50)<1e-6 and y==0
    def draw(phase):
     out=Image.new('RGBA',(C,C))
     for s in specs:
      x,lift,angle=foot((phase+s['phase'])%1);a,b,c=map(pt,[s['hip'],s['knee'],s['ankle']]);hip=np.array([s['hip'][0],s['hip'][1]],float);ankle=hip+np.array([x,s['ankle'][1]-hip[1]+lift]);L=54;v=ankle-hip;dist=np.linalg.norm(v);unit=v/dist;mid=hip+unit*dist/2+np.array([unit[1],-unit[0]])*np.sqrt(max(0,L*L-dist*dist/4));newa,newb,newc=map(pt,[hip,mid,ankle]);im=s['image'];yy=np.arange(C)[:,None]
      upper=im.copy();upper[yy.repeat(C,1)>b[1]+5]=0
      lower=im.copy();lower[(yy.repeat(C,1)<b[1]-5)|(yy.repeat(C,1)>c[1]+3)]=0
      boot=im.copy();boot[yy.repeat(C,1)<c[1]-3]=0
      out.alpha_composite(warp(upper,a,b,newa,newb));out.alpha_composite(warp(lower,b,c,newb,newc))
      newtoe=newc+np.array([np.cos(angle),np.sin(angle)])*12
      out.alpha_composite(warp(boot,c,c+np.array([12,0]),newc,newtoe))
     out.alpha_composite(Image.fromarray(body));a=np.array(out);n,lab,stats,_=cv2.connectedComponentsWithStats(np.uint8(a[:,:,3]>32));keep=np.zeros((C,C),bool)
     for j in range(1,n):
      if stats[j,cv2.CC_STAT_AREA]>20:keep|=lab==j
     a[~cv2.dilate(keep.astype('uint8'),np.ones((3,3),'uint8')).astype(bool)]=0
     return Image.fromarray(a)
    return [draw(i/96) for i in range(96)]
