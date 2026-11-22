'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),w={};w.window=w;vm.createContext(w);
for(const p of ['assets/visuals/cutscene-motion.js','assets/visuals/vendor-art-data.js','assets/cutscenes/v0197/animation-data.js'])vm.runInContext(fs.readFileSync(path.join(root,p),'utf8'),w);
const A=w.GRIM_CUTSCENES,D=w.GRIM_CUTSCENE_DATA;
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert(html.includes('assets/cutscenes/v0197/animation-data.js?v=vendor-greetings1'));
assert(html.includes('assets/visuals/power-animations.js?v=tuck-scale1"></script>'),'Bow uses the versioned power renderer');
assert(html.includes('assets/visuals/cutscene-motion.js?v=vendor-greetings1"></script>'));
const loaded=[];A.preload({load:{spritesheet:(key,url)=>loaded.push([key,url])}});
assert.equal(loaded.length,3);
assert(loaded.every(([key,url])=>url.endsWith(key==='cutscene-vendor'?'?v=vendor-greetings1':'?v=character-motion1')));
assert.equal(A.SHRINE_MS,4000);assert.equal(A.HOLD_SECONDS,1);assert.equal(A.HOLD_START,3);assert.equal(A.VENDOR_ANIMATION_SECONDS,3);
let last=-1;const frames=new Set();
for(let ms=0;ms<4000;ms++){
 const p=A.relicMotionAt(ms/1000);frames.add(p.frame);assert(p.frame>=last&&p.frame-last<=1);last=p.frame;
 assert.equal(p.hold,ms>=3000);if(ms<3000){assert.equal(p.glow,0);assert(p.frame<168,'The final raised drawing cannot be selected before the hold starts');}
}
assert.equal(frames.size,169);
const contactFrames=new Set(Array.from({length:431},(_,i)=>A.relicMotionAt(1.454+i/1000).frame));
assert(contactFrames.size>=14,'Weight continues moving through the clasp');
for(const t of [3,3.1,3.5,3.999])assert.equal(A.relicMotionAt(t).frame,168);
assert.equal(A.relicMotionAt(4).hold,false);assert.equal(A.relicMotionAt(1.649).grabbed,false);assert(A.relicMotionAt(1.65).grabbed);
const low=D.bow.hands[72][0],high=D.bow.hands[168][0];
assert(low[1]>D.bow.rig[72].eye[1]+35&&high[1]<D.bow.rig[168].eye[1]-20&&low[1]-high[1]>100,'Palms move from below the bent head to above the upright head');
const grip=w.GRIM_VENDOR_DATA,span=grip.bowForwardGrip.map((v,j)=>(v-grip.bowStockGrip[j])*370*.19),dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
assert.equal(D.bow.rig.length,169);
for(let i=0;i<169;i++){
 const p=D.bow.rig[i];assert(p.eye.every(Number.isFinite));
 if(i){const a=D.bow.rig[i-1].eye;assert(Math.hypot(p.eye[0]-a[0],p.eye[1]-a[1])<2,'One rigid painted head follows a continuous body hinge');}
 for(let j=0;j<2;j++){
  const shoulder=p.shoulders[j],elbow=p.elbows[j],hand=D.bow.hands[i][j];
  assert(Math.abs(dist(elbow,shoulder)-25)<.001&&Math.abs(dist(hand,elbow)-30)<.001,'Both painted arm segments retain fixed lengths');
  const cross=(hand[0]-shoulder[0])*(elbow[1]-shoulder[1])-(hand[1]-shoulder[1])*(elbow[0]-shoulder[0]);
  assert(cross>0,'Each elbow keeps the same bend side through the complete lift');
  const quality=p.paint[j];assert(quality.connected>.97&&quality.upperWidth>=7&&quality.upperWidth<=20&&quality.foreWidth>=7&&quality.foreWidth<=20&&quality.elbowAlpha>240&&quality.handAlpha>240,'Rasterized arms retain connected, substantial opaque paint at sleeves, bracers, elbows and fists');
  if(i)assert(dist(elbow,D.bow.rig[i-1].elbows[j])<3&&dist(hand,D.bow.hands[i-1][j])<3,'No elbow flip or hand jump between poses');
 }
 if(i>=72){
  const a=p.bowAngle,c=Math.cos(a),s=Math.sin(a),actual=D.bow.hands[i][1].map((v,j)=>v-D.bow.hands[i][0][j]);
  assert(dist(actual,[span[0]*c-span[1]*s,span[0]*s+span[1]*c])<.001,'Both hands match the actual rear stock and forward support artwork throughout retrieval/lift');
 }
}
for(const devil of [false,true]){
 const before=A.merchantPoint(.47,.20,0,devil),after=A.merchantPoint(.47,.20,3,devil);
 assert(after.x<before.x&&after.y>before.y,'Face turns down and toward the Reaper');
 assert(A.merchantPose(3,devil).headAngle<-.24);assert(A.merchantPose(.65,devil).notice>.40);
 for(const t of [0,1,4,8,9.9])for(const x of [.3,.5,.7])assert.equal(A.merchantPoint(x,1,t,devil).y,1,'Feet stay planted');
 for(let i=0;i<10000;i++){
  const a=A.merchantPoint(.47,.2,i/1000,devil),b=A.merchantPoint(.47,.2,(i+1)/1000,devil);
  assert(Math.hypot(a.x-b.x,a.y-b.y)<.0003,'Head motion has no discontinuity');
 }
}

assert.equal(A.vendorVisualTime(0,true),3);
const final=A.approachAt(3);
assert.equal(final.frame,D.vendor.angel.at(-1).frame);assert(Math.abs(final.travel-1)<1e-6);assert.equal(final.presence,1);
for(const t of [3,3.001,5,7.999]){
 const visual=A.vendorVisualTime(t);
 assert.equal(visual,3);assert.deepEqual(A.approachAt(visual),final);
 assert.deepEqual(A.merchantPose(visual,true),A.merchantPose(3,true));
 assert.equal(A.vendorAmbientTime(visual),3);
}
const m=JSON.parse(fs.readFileSync(path.join(root,'assets/cutscenes/v0197/manifest.json')));
for(const [kind,entries]of Object.entries(m).filter(([k])=>['sources','runtime'].includes(k)))for(const [name,meta]of Object.entries(entries)){
 const b=fs.readFileSync(path.join(root,'assets/cutscenes/v0197',kind==='sources'?'source':'',name));
 assert.equal(b.length,meta.bytes);assert.equal(crypto.createHash('sha256').update(b).digest('hex'),meta.sha256);if(name.endsWith('.webp')){
   assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WEBP');
 }else assert.equal(b[25],6);
 if(meta.bounds)assert(meta.bounds.every(([l,t,r,b])=>l>=2&&t>=2&&r<223&&b<223),'Every interpolated silhouette stays within its cell');
}
assert.equal(m.runtime['reaper-bow.png'].frames,A.BOW_FRAMES);assert.equal(m.runtime['reaper-vendor.webp'].frames,D.vendor.frames);
assert(m.runtime['reaper-vendor.webp'].bytes<=5252880,'Vendor approach stays within the prior transfer budget');
assert(m.runtime['reaper-vendor.webp'].size.every(v=>v<=3584),'Vendor atlas stays inside the existing texture limit');
assert(Object.values(m.runtime).reduce((bytes,asset)=>bytes+asset.bytes,0)<=9874079,'The three dense atlases stay within the PR87 transfer budget');
assert(fs.statSync(path.join(root,'assets/cutscenes/v0197/vendor-canvas.webp')).size<=602944,'Canvas merchant atlas stays within the prior transfer budget');
for(const kind of ['angel','devil']){
 const devil=kind==='devil',vendor=D.vendor[kind];
 assert.equal(vendor.length,145);
 const heels=[],end=vendor.at(-1),lastStates=[null,null];
 assert(Math.max(...vendor.map(p=>p.pelvis[1]))-Math.min(...vendor.map(p=>p.pelvis[1]))>4);
 assert.equal(A.approachAt(3,devil).frame,end.frame);
 for(const [i,p] of vendor.entries()){
  assert(p.frame>=0&&p.frame<D.vendor.frames);
  assert(p.feet.some(f=>f.state!=='swing'&&f.contact[1]===214));
  assert(i===0||p.travel>=vendor[i-1].travel);
  for(const [j,f] of p.feet.entries()){
   const prev=vendor[i-1],state=lastStates[j];
   if(i&&f.state==='heel'&&state==='swing')heels.push([j,i/48]);
   if(prev&&f.state===state&&state!=='swing'){
    assert(Math.abs(f.contact[0]+p.travel-prev.feet[j].contact[0]-prev.travel)<.002,'The active part of the sole stays on its floor mark');
   }
   assert(Math.abs(dist(f.hip,f.knee)-31)<.002&&Math.abs(dist(f.knee,f.ankle)-30)<.002);
   lastStates[j]=f.state;
  }
 }
 assert.deepEqual(heels.map(([j])=>j),devil?[0,1,0,1]:[0,1,0,1,0]);
 const expected=devil?[.49,.97,1.43,2]:[.49,1.04,1.62,2.18,2.58];
 expected.forEach((t,i)=>assert(Math.abs(heels[i][1]-t)<1/48));
 for(let ms=0;ms<3000;ms++){
  const t=ms/1000,pose=A.approachAt(t,devil),paint=vendor[Math.min(143,Math.round(t*48))];
  assert.equal(pose.frame,paint.frame);
  assert(Math.abs(pose.travel*A.WALK_DISTANCE-paint.travel)*430/420<.85);
 }
 const spread=end.feet[1].contact[0]-end.feet[0].contact[0];
 assert(devil?spread>=40:spread<=20);
 if(devil)assert(vendor.slice(75).every(p=>p.feet[0].state==='flat'),'Rear support stays planted through the checking step');
 else assert(vendor.slice(110).every(p=>p.feet[0].contact[1]>210.8),'The short gather stays close to the floor');
}
assert(A.merchantPose(1.75,true).offer>A.merchantPose(1.75,true).wrist);
assert(A.merchantPose(2.12,true).wrist>A.merchantPose(2.12,true).fingers);
assert.equal(A.merchantPose(3,true).fingers,1);
assert(Math.abs(A.merchantPose(3,false).lantern)<1e-6);
assert(Math.abs(A.merchantPose(1.05,false).lantern)>.10);
console.log('PASS cutscenes: both vendor performances, separate heel contacts and closing stances, early merchant recognition, landed Bow registration and transfer budgets.');
