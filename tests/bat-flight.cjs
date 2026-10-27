'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),w={};w.window=w;vm.createContext(w);
vm.runInContext(read('assets/visuals/bat-flight.js'),w);const A=w.GRIM_BAT_FLIGHT;
assert.equal(A.CYCLE_SECONDS,1.6);assert.equal(A.FRAMES,96);assert.equal(.96/A.CYCLE_SECONDS,.6);
for(const [width,height]of [[320,740],[430,932],[950,430],[1440,900],[1920,1080]])for(const clock of [0,1,3,5]){
 const p=A.homePlacement(width,height,clock),left=p.x-(A.BOUNDS[2]-A.ANCHOR[0])*p.scale,right=p.x+(A.ANCHOR[0]-A.BOUNDS[0])*p.scale;
 assert(left>=12&&right<=width-11,'Every wing extreme stays inside the home viewport');
}
for(const phase of [0,.7,Math.PI,6.1])for(const seconds of [-2,0,.01,.8,1.599,24]){
 const m=A.motion(seconds,phase),next=A.motion(seconds+A.CYCLE_SECONDS,phase);
 assert(Math.abs((m.a+m.mix)-(next.a+next.mix))<1e-9);
 assert(m.a>=0&&m.a<96&&m.b===(m.a+1)%96);
}
const near=(a,b,eps=1e-7)=>assert(Math.abs(a-b)<eps,[a,b]);
for(const k of Object.keys(A.pose(0))){near(A.pose(0)[k],A.pose(1)[k]);
 near((A.pose(1e-5)[k]-A.pose(0)[k])/1e-5,(A.pose(1)[k]-A.pose(1-1e-5)[k])/1e-5,.0005);}
for(const side of ['near','far'])for(let i=0;i<96;i++){
 const tip=side==='near'?[115,220]:[398,265],a=A.wingPoint(...tip,side,A.pose(i/96)),b=A.wingPoint(...tip,side,A.pose((i+1)/96));
 assert(Math.hypot(a[0]-b[0],a[1]-b[1])<7,'Wing tip moves continuously, including last-to-first');
}
const m=JSON.parse(read('assets/bat/v0192/manifest.json'));
for(const [p,meta]of [[m.source.path,m.source],...Object.entries(m.runtime).map(([p,v])=>['assets/bat/v0192/'+p,v])]){
 const b=fs.readFileSync(path.join(root,p));assert.equal(b.length,meta.bytes);assert.equal(crypto.createHash('sha256').update(b).digest('hex'),meta.sha256);
}
assert.equal(m.runtime['bat-flight.png'].frames,96);assert(m.runtime['bat-flight.png'].bounds.every(([l,t,r,b,n])=>l>=3&&t>=3&&r<=252&&b<=252&&n>3000));
vm.runInContext(read('assets/combat/v0170/animation-data.js'),w);vm.runInContext(read('assets/visuals/combat-animations.js'),w);
for(let i=0;i<160;i++)assert.equal(JSON.stringify(w.GRIM_COMBAT_ART.batMotion(i*.01,1.2)),JSON.stringify(A.motion(i*.01,1.2)));
console.log('PASS fluid bat: slower single flap, 96 registered poses, periodic pose/velocity, bounded wing-tip travel, complete source/runtime hashes and identical home/game clock.');
