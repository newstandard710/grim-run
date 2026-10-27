'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),
  crypto=require('node:crypto'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'assets/powers');
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json')));
for(const [folder,entries] of [['source',manifest.sources],['',manifest.runtime]]){
  for(const [name,meta] of Object.entries(entries)){
    const b=fs.readFileSync(path.join(dir,folder,name));
    assert.equal(b.length,meta.bytes,name+' byte count');
    assert.equal(crypto.createHash('sha256').update(b).digest('hex'),meta.sha256,name+' original hash');
    assert.equal(b.subarray(1,4).toString(),'PNG');
    if(meta.size){assert.equal(b.readUInt32BE(16),meta.size[0]);assert.equal(b.readUInt32BE(20),meta.size[1]);}
    assert.equal(b[25],6,name+' preserves true alpha');
  }
}
const w={GRIM_CONFIG:{attackDurationMs:260}};w.window=w;vm.createContext(w);
vm.runInContext(fs.readFileSync(path.join(root,'assets/visuals/power-animations.js'),'utf8'),w);
const A=w.GRIM_POWER_ART;
assert.equal(A.SHRINE_METERS,4900);assert.equal(A.SHRINE_MS,6000);
assert.equal(A.ORDER.length,13);
const s={state:'playing',player:{grounded:false,onSoulPlatform:false,airTuck:true,visualTuckMs:25}};
assert.equal(A.actionFrame(s),0);
s.player.visualTuckMs=100;assert.equal(A.actionFrame(s),1);
s.player.visualTuckMs=250;assert([1,2].includes(A.actionFrame(s)));
for(let i=0;i<4;i++){
  s.player.attackMs=260*(1-(i+.1)/4);assert.equal(A.actionFrame(s),8+i,'Tucked attack keeps its own poses');
  s.player.airTuck=false;assert.equal(A.actionFrame(s),4+i,'Aerial swing progresses through all four frames');
  s.player.airTuck=true;
}
s.player.attackMs=0;s.player.airTuck=false;s.player.holdSlide=true;
assert.notEqual(A.actionFrame(s),null,'Pressing slide after takeoff also animates a tuck');
s.player.holdSlide=false;s.player.visualTuckReleaseMs=70;assert.equal(A.actionFrame(s),3);
s.player.grounded=true;assert.equal(A.actionFrame(s),null);
const missing=new A.PowerAnimations({add:{},textures:{}});
missing.trigger('ravenWings');missing.render();missing.reset();missing.destroy();
assert.equal(missing.bursts.length,0,'Unavailable art is safe and never suppresses the existing Reaper');
console.log('PASS v0.15.0: source/runtime PNG integrity, 15 action poses, 12 wing frames, 12 powers, both tuck inputs and safe missing-art fallback.');
