'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),w={};w.window=w;vm.createContext(w);
for(const p of ['assets/visuals/cutscene-motion.js','assets/cutscenes/v0197/animation-data.js'])vm.runInContext(fs.readFileSync(path.join(root,p),'utf8'),w);
const A=w.GRIM_CUTSCENES,D=w.GRIM_CUTSCENE_DATA;
assert.equal(A.SHRINE_MS,4000);assert.equal(A.HOLD_SECONDS,1);assert.equal(A.HOLD_START,3);assert.equal(A.INTRO_MS,10000);
let last=-1;const frames=new Set();
for(let ms=0;ms<4000;ms++){
 const p=A.relicMotionAt(ms/1000);frames.add(p.frame);assert(p.frame>=last&&p.frame-last<=1);last=p.frame;
 assert.equal(p.hold,ms>=3000);if(ms<3000){assert.equal(p.glow,0);assert(p.frame<168,'The final raised drawing cannot be selected before the hold starts');}
}
assert.equal(frames.size,169);
for(const t of [3,3.1,3.5,3.999])assert.equal(A.relicMotionAt(t).frame,168);
assert.equal(A.relicMotionAt(4).hold,false);assert.equal(A.relicMotionAt(1.649).grabbed,false);assert(A.relicMotionAt(1.65).grabbed);
const low=D.bow.hands[72][0],high=D.bow.hands[168][0];assert(high[1]<low[1]-130,'The bow is physically lifted from the low chest reach to overhead');
assert.equal(D.bow.rig.length,169);
for(let i=0;i<169;i++){
 const p=D.bow.rig[i];assert(p.eye.every(Number.isFinite));
 if(i){const a=D.bow.rig[i-1].eye;assert(Math.hypot(p.eye[0]-a[0],p.eye[1]-a[1])<2,'One rigid painted head follows a continuous body hinge');}
 for(let j=0;j<2;j++){
  const length=Math.hypot(p.elbows[j][0]-p.shoulders[j][0],p.elbows[j][1]-p.shoulders[j][1]);
  assert(Math.abs(length-(j?30:32))<.001,'Upper arms retain fixed lengths');
 }
}
for(const devil of [false,true]){
 const before=A.merchantPoint(.47,.20,6,devil),after=A.merchantPoint(.47,.20,9.5,devil);
 assert(after.x<before.x&&after.y>before.y,'Face turns down and toward the Reaper');
 assert(A.merchantPose(9.5,devil).headAngle<-.24);assert.equal(A.merchantPose(6,devil).dip,0);
 for(const t of [0,1,4,8,9.9])for(const x of [.3,.5,.7])assert.equal(A.merchantPoint(x,1,t,devil).y,1,'Feet stay planted');
 for(let i=0;i<10000;i++){
  const a=A.merchantPoint(.47,.2,i/1000,devil),b=A.merchantPoint(.47,.2,(i+1)/1000,devil);
  assert(Math.hypot(a.x-b.x,a.y-b.y)<.0002,'Head motion has no discontinuity');
 }
}
const m=JSON.parse(fs.readFileSync(path.join(root,'assets/cutscenes/v0197/manifest.json')));
for(const [kind,entries]of Object.entries(m).filter(([k])=>['sources','runtime'].includes(k)))for(const [name,meta]of Object.entries(entries)){
 const b=fs.readFileSync(path.join(root,'assets/cutscenes/v0197',kind==='sources'?'source':'',name));
 assert.equal(b.length,meta.bytes);assert.equal(crypto.createHash('sha256').update(b).digest('hex'),meta.sha256);assert.equal(b[25],6);
 if(meta.bounds)assert(meta.bounds.every(([l,t,r,b])=>l>=2&&t>=2&&r<223&&b<223),'Every interpolated silhouette stays within its cell');
}
assert.equal(m.runtime['reaper-bow.png'].frames,A.BOW_FRAMES);assert.equal(m.runtime['reaper-vendor.png'].frames,A.VENDOR_FRAMES);
console.log('PASS cutscenes: complete source/runtime hashes, 169 solid bow poses, 241 vendor poses, physical reach/lift, exact one-second final hold, continuous downward gaze and planted merchant feet.');
