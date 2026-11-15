'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),w={};w.window=w;vm.createContext(w);
for(const p of ['assets/visuals/cutscene-motion.js','assets/visuals/vendor-art-data.js','assets/cutscenes/v0197/animation-data.js'])vm.runInContext(fs.readFileSync(path.join(root,p),'utf8'),w);
const A=w.GRIM_CUTSCENES,D=w.GRIM_CUTSCENE_DATA;
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert(html.includes('assets/cutscenes/v0197/animation-data.js?v='+D.version+'-vendor1'));
assert(html.includes('assets/visuals/power-animations.js?v='+D.version),'Bow keeps its matched metadata and renderer cache versions');
assert(html.includes('assets/visuals/cutscene-motion.js?v=0.19.11'));
const loaded=[];A.preload({load:{spritesheet:(key,url)=>loaded.push([key,url])}});
assert(loaded.filter(([key])=>key!=='cutscene-vendor').every(([,url])=>url.endsWith('?v='+D.version)));
assert.equal(A.SHRINE_MS,4000);assert.equal(A.HOLD_SECONDS,1);assert.equal(A.HOLD_START,3);assert.equal(A.VENDOR_ANIMATION_SECONDS,3);assert.equal(A.VENDOR_SETTLED_FRAME,192);
let last=-1;const frames=new Set();
for(let ms=0;ms<4000;ms++){
 const p=A.relicMotionAt(ms/1000);frames.add(p.frame);assert(p.frame>=last&&p.frame-last<=1);last=p.frame;
 assert.equal(p.hold,ms>=3000);if(ms<3000){assert.equal(p.glow,0);assert(p.frame<168,'The final raised drawing cannot be selected before the hold starts');}
}
assert.equal(frames.size,169);
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
  assert(j?cross>0:cross<0,'Each elbow keeps the same bend side through the complete lift');
  const quality=p.paint[j];assert(quality.connected>.97&&quality.upperWidth>=7&&quality.upperWidth<=20&&quality.foreWidth>=7&&quality.foreWidth<=20&&quality.elbowAlpha>240&&quality.handAlpha>240,'Rasterized arms retain connected, substantial opaque paint at sleeves, bracers, elbows and fists');
  if(i)assert(dist(elbow,D.bow.rig[i-1].elbows[j])<3&&dist(hand,D.bow.hands[i-1][j])<3,'No elbow flip or hand jump between poses');
 }
 if(i>=72){
  const a=p.bowAngle,c=Math.cos(a),s=Math.sin(a),actual=D.bow.hands[i][1].map((v,j)=>v-D.bow.hands[i][0][j]);
  assert(dist(actual,[span[0]*c-span[1]*s,span[0]*s+span[1]*c])<.001,'Both hands match the actual rear stock and forward support artwork throughout retrieval/lift');
 }
}
for(const devil of [false,true]){
 const before=A.merchantPoint(.47,.20,1.5,devil),after=A.merchantPoint(.47,.20,3,devil);
 assert(after.x<before.x&&after.y>before.y,'Face turns down and toward the Reaper');
 assert(A.merchantPose(3,devil).headAngle<-.24);assert.equal(A.merchantPose(1.5,devil).dip,0);
 for(const t of [0,1,4,8,9.9])for(const x of [.3,.5,.7])assert.equal(A.merchantPoint(x,1,t,devil).y,1,'Feet stay planted');
 for(let i=0;i<10000;i++){
  const a=A.merchantPoint(.47,.2,i/1000,devil),b=A.merchantPoint(.47,.2,(i+1)/1000,devil);
  assert(Math.hypot(a.x-b.x,a.y-b.y)<.0003,'Head motion has no discontinuity');
 }
}
assert(A.approachAt(2.999).frame<192);
assert.equal(A.vendorVisualTime(0,true),3);
const final=A.approachAt(3);
assert.equal(final.frame,192);assert.equal(final.travel,1);assert.equal(final.presence,1);
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
assert.equal(m.runtime['reaper-bow.png'].frames,A.BOW_FRAMES);assert.equal(m.runtime['reaper-vendor.webp'].frames,A.VENDOR_FRAMES);
assert(m.runtime['reaper-vendor.webp'].bytes<=5252880,'Vendor approach stays within the prior transfer budget');
assert(m.runtime['reaper-vendor.webp'].size.every(v=>v<=3584),'Vendor atlas stays inside the existing texture limit');
assert(fs.statSync(path.join(root,'assets/cutscenes/v0197/vendor-canvas.webp')).size<=602944,'Canvas merchant atlas stays within the prior transfer budget');
const vendor=D.vendor.rig, walk=vendor.slice(0,96);
assert.equal(vendor.length,193);
assert(Math.max(...walk.map(p=>p.pelvis[1]))-Math.min(...walk.map(p=>p.pelvis[1]))>4,'The upper body participates in both walking loads');
for(const [i,p] of walk.entries()){
 assert(p.feet.some(f=>f.forefoot[1]===214),'At least one boot bears weight throughout the walk');
 for(const j of [0,1]){
  const q=(i/96+(j===0?.5:0))%1;
  const [x,y]=p.feet[j].forefoot;
  if(q<=.61)assert(y===214&&Math.abs(x+q*A.WALK_STRIDE*.4-(j===0?160:174))<.002,'The loaded forefoot stays in the same stage position');
 }
}
assert.deepEqual(vendor[96],vendor[0],'Settle begins in the exact last touchdown drawing');
assert(vendor.slice(96).every(p=>p.feet[1].forefoot[0]===vendor[96].feet[1].forefoot[0]),'The lead boot brakes and holds while the trailing boot gathers');
assert.equal(A.merchantPose(2.2,true).offer,0);
assert(A.merchantPose(2.55,true).offer>.45);
assert.equal(A.merchantPose(3,true).offer,1);
assert(A.merchantPose(3,false).lantern===0);
assert(Math.abs(A.merchantPose(2.35,false).lantern)>.005);
console.log('PASS cutscenes: source/runtime hashes, 169 connected painted bow poses, stable elbow bend/segment lengths, actual two-hand stock span, physical reach/lift, exact one-second hold, 193 articulated vendor poses, locked toe contact, separate merchant responses and texture budgets.');
