/* v0.19.8 — shared presentation time, dense solid poses and articulated merchants. */
(function(scope){
  'use strict';
  const CELL=224,ANCHOR=[136,214],BOW_FRAMES=169;
  const SHRINE_MS=4000,HOLD_START=3,HOLD_SECONDS=1,VENDOR_ANIMATION_SECONDS=3;
  const ROOT='assets/cutscenes/v0197/';
  const clamp=v=>Math.max(0,Math.min(1,v));
  const smooth=v=>{v=clamp(v);return v*v*v*(10+v*(-15+v*6));};
  function preload(s){
    for(const [key,file,cell] of [['cutscene-bow','reaper-bow.png',CELL],['cutscene-hands','bow-hands.png',64]])
      s.load.spritesheet(key,ROOT+file+'?v=character-motion1',
        {frameWidth:cell,frameHeight:cell,endFrame:BOW_FRAMES-1});
    const layout=scope.GRIM_CUTSCENE_DATA?.vendor;
    if(layout?.cell)s.load.spritesheet('cutscene-vendor',ROOT+'reaper-vendor.webp?v=vendor-greetings1',
      {frameWidth:layout.cell[0],frameHeight:layout.cell[1],endFrame:layout.frames-1});
  }
  function relicMotionAt(t){
    t=Math.max(0,t);
    // Carry some velocity through contact. The hands start taking the load
    // as the body finishes bending, then the legs and arms lift it together.
    const reach=clamp(t/1.65), lift=clamp((t-1.65)/1.35);
    const pose=t<1.65?72*reach*reach*(3-2*reach)+49.5*reach*reach*(reach-1):
      72+96*lift*lift*(3-2*lift)+40.5*lift*(1-lift)*(1-lift);
    const hold=t>=HOLD_START&&t<HOLD_START+HOLD_SECONDS;
    // Quantization must not select the final painting early: the raised
    // drawing, glow clock and one-second exit all begin on the same boundary.
    return {pose,frame:t<1.65?Math.min(71,Math.round(pose)):t<HOLD_START?Math.min(167,Math.round(pose)):168,hold,grabbed:t>=1.65,
      glow:hold?smooth((t-HOLD_START)/.16)*(.90+.10*Math.sin((t-HOLD_START)*Math.PI)):0};
  }
  const WALK_DISTANCE=400/3;
  const vendorTravel=h=>WALK_DISTANCE*h/420;
  function approachAt(t,devil=false){
    const rig=scope.GRIM_CUTSCENE_DATA?.vendor?.[devil?'devil':'angel'];
    const presence=t>=VENDOR_ANIMATION_SECONDS?1:smooth((t-2.1)/.9);
    if(!rig?.length)return {frame:0,travel:smooth(t/2.2),presence};
    const end=rig.length-1,sample=clamp(t/VENDOR_ANIMATION_SECONDS)*end;
    const i=Math.min(end-1,Math.floor(sample)),fraction=sample-i;
    const travel=rig[i].travel+(rig[i+1].travel-rig[i].travel)*fraction;
    const paint=t>=VENDOR_ANIMATION_SECONDS?end:Math.min(end-1,Math.round(sample));
    return {frame:rig[paint].frame,travel:travel/WALK_DISTANCE,presence};
  }
  function vendorVisualTime(elapsed,reduced=false){
    return reduced?VENDOR_ANIMATION_SECONDS:Math.min(VENDOR_ANIMATION_SECONDS,Math.max(0,elapsed));
  }
  function vendorAmbientTime(t){
    if(t<=2.5)return t;
    const u=clamp((t-2.5)/.5);
    return 2.5+.5*(u+u*u-u*u*u);
  }
  function merchantPose(t,devil=false){
    const beat=(start,duration)=>smooth((t-start)/duration);
    const notice=devil?beat(.20,.69):beat(.10,.62);
    const shoulder=devil?beat(.74,.70):beat(.40,.76);
    const dip=devil?beat(1.34,.80):beat(1.07,.96);
    const answer=beat(2.13,.70);
    const headAngle=devil?-.12*notice-.23*dip+.08*answer:-.15*notice-.29*dip+.13*answer;
    const offer=beat(1.24,.92),wrist=beat(1.57,.80),fingers=beat(1.83,.70);
    const armAngle=-.68*(1-offer);
    const ambient=vendorAmbientTime(t);
    // The lantern is suspended from its hook. Its last arc damps out
    // after the shoulder has stopped responding to the arriving Reaper.
    const lantern=-.15*beat(.48,.53)+.27*beat(.96,.67)-.18*beat(1.57,.57)
      +.088*beat(2.12,.44)-.028*beat(2.55,.38);
    return {dip,notice,shoulder,offer,wrist,fingers,lantern,
      headAngle,headCos:Math.cos(headAngle),headSin:Math.sin(headAngle),
      lean:devil?.032*shoulder-.086*offer+.013*answer:-.072*shoulder-.028*dip+.039*answer,
      breath:Math.sin(ambient*1.45)*.003,cloth:Math.sin(ambient*1.15-.5)*.002,
      armCos:Math.cos(armAngle),armSin:Math.sin(armAngle)};
  }
  function deformMerchant(u,v,p,devil){
    const upper=1-smooth((v-.34)/.55);
    // The Angel's hand and the length of the planted staff stay registered.
    const staffX=.326+.122*v;
    const body=devil?1:smooth((Math.abs(u-staffX)-.019)/.039)*smooth((u-.29)/.065);
    let x=u-(v-.83)*p.lean*upper*body,y=v-p.breath*upper*body;
    x+=p.cloth*smooth((v-.49)/.36)*(1-smooth((v-.80)/.12))*Math.sin(u*Math.PI)*body;
    const head=(1-smooth((v-.24)/.12))*smooth((u-.32)/.08)*(1-smooth((u-.66)/.09));
    const dx=u-.53,dy=v-.335;
    x+=(dx*p.headCos-dy*p.headSin-dx-.013*p.dip)*head;
    y+=(dx*p.headSin+dy*p.headCos-dy+.019*p.dip)*head;
    if(devil){
      const arm=(1-smooth((u-.34)/.13))*smooth((v-.25)/.085)*(1-smooth((v-.49)/.11));
      const ax=u-.423,ay=v-.35;
      x+=(ax*p.armCos-ay*p.armSin-ax+.032*(1-p.offer))*arm;
      y+=(ax*p.armSin+ay*p.armCos-ay)*arm;
      const palm=arm*(1-smooth((u-.27)/.08));
      y+=palm*(.060*(p.offer-p.wrist)+.033*(p.wrist-p.fingers));
      x-=.034*p.fingers*palm;
    }else{
      const suspended=(1-smooth((u-.315)/.039))*smooth((v-.145)/.06)*(1-smooth((v-.468)/.065));
      const lx=u-.285,ly=v-.155,c=Math.cos(p.lantern),s=Math.sin(p.lantern);
      x+=(lx*c-ly*s-lx)*suspended;
      y+=(lx*s+ly*c-ly)*suspended;
    }
    return {x,y};
  }
  const MERCHANT_CELLS=32;
  function merchantSampleTime(i){return i*VENDOR_ANIMATION_SECONDS/(MERCHANT_CELLS-1);}
  function merchantCellAt(t){
    return t>=VENDOR_ANIMATION_SECONDS?MERCHANT_CELLS-1:
      Math.min(MERCHANT_CELLS-2,Math.round(clamp(t/VENDOR_ANIMATION_SECONDS)*(MERCHANT_CELLS-1)));
  }
  function merchantPoint(u,v,t,devil=false){
    return deformMerchant(u,v,merchantPose(t,devil),devil);
  }
  function createMerchantMesh(s,key,depth){
    if(!s.add.mesh||s.sys?.game?.renderer?.type!==scope.Phaser?.WEBGL)return null;
    const m=s.add.mesh(0,0,key).setDepth(depth).setScrollFactor(0).setVisible(false);
    m.hideCCW=false;m.setOrtho(m.width,m.height);
    const vertices=[],uvs=[],indices=[],nx=24,ny=28;
    for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
      vertices.push(i/nx,1-j/ny);uvs.push(i/nx,j/ny);
      if(i<nx&&j<ny){const k=j*(nx+1)+i;indices.push(k,k+nx+1,k+1,k+1,k+nx+1,k+nx+2);}
    }
    m.addVertices(vertices,uvs,indices);
    m.cutscenePoints=m.vertices.map(v=>({u:v.u,v:v.v}));
    return m;
  }
  function placeMerchant(m,s,key,x,ground,width,height,t,devil){
    if(!m)return false;
    if(m.texture.key!==key)m.setTexture(key);
    if(m.width!==s.width||m.height!==s.height){m.setSize(s.width,s.height);m.setOrtho(s.width,s.height);}
    m.setPosition(x,ground).setVisible(true);
    const pose=merchantPose(t,devil);
    for(let i=0;i<m.vertices.length;i++){
      const uv=m.cutscenePoints[i],p=deformMerchant(uv.u,uv.v,pose,devil),v=m.vertices[i];
      v.x=(p.x-.5)*width;v.y=(1-p.y)*height;
    }
    m.dirtyCache[9]=-1;m.preUpdate();
    m.cutscenePose=pose;
    return true;
  }
  scope.GRIM_CUTSCENES={CELL,ANCHOR,BOW_FRAMES,MERCHANT_CELLS,SHRINE_MS,HOLD_START,HOLD_SECONDS,VENDOR_ANIMATION_SECONDS,
    vendorVisualTime,vendorAmbientTime,
    vendorTravel,WALK_DISTANCE,merchantSampleTime,merchantCellAt,preload,relicMotionAt,approachAt,merchantPose,merchantPoint,createMerchantMesh,placeMerchant};
})(typeof window!=='undefined'?window:globalThis);
