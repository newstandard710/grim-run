/* v0.19.8 — shared presentation time, dense solid poses and articulated merchants. */
(function(scope){
  'use strict';
  const CELL=224,ANCHOR=[136,214],BOW_FRAMES=169,VENDOR_FRAMES=193;
  const SHRINE_MS=4000,HOLD_START=3,HOLD_SECONDS=1,VENDOR_ANIMATION_SECONDS=3,VENDOR_SETTLED_FRAME=192;
  const ROOT='assets/cutscenes/v0197/';
  const clamp=v=>Math.max(0,Math.min(1,v));
  const smooth=v=>{v=clamp(v);return v*v*v*(10+v*(-15+v*6));};
  function preload(s){
    for(const [key,file,cell,count] of [['cutscene-bow','reaper-bow.png',CELL,BOW_FRAMES],
      ['cutscene-vendor','reaper-vendor.webp',CELL,VENDOR_FRAMES],['cutscene-hands','bow-hands.png',64,BOW_FRAMES]])
      s.load.spritesheet(key,ROOT+file+'?v=character-motion1',
        {frameWidth:cell,frameHeight:cell,endFrame:count-1});
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
  function approachAt(t){
    if(t>=VENDOR_ANIMATION_SECONDS)return {frame:VENDOR_SETTLED_FRAME,travel:1,presence:1};
    const rig=scope.GRIM_CUTSCENE_DATA?.vendor?.rig;
    const presence=smooth((t-2.1)/.9);
    if(!Number.isFinite(rig?.[0]?.travel))return {frame:0,travel:smooth(t/2.2),presence};
    const sample=clamp(t/3)*VENDOR_SETTLED_FRAME,first=Math.floor(sample);
    const frame=Math.min(VENDOR_SETTLED_FRAME-1,Math.round(sample));
    // World travel is authored alongside the sole registration. Interpolate
    // the root between paint samples, keeping its offset within half a pose.
    const x=rig[first].travel,next=rig[first+1].travel;
    const travel=(x+(next-x)*(sample-first))/WALK_DISTANCE;
    return {frame,travel,presence};
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
    const dip=smooth((t-(devil?1.53:1.50))/(devil?.77:.62));
    const answer=smooth((t-2.12)/.72);
    const offer=smooth((t-2.02)/.79), wrist=smooth((t-2.22)/.61);
    const rest=t>=3?0:1-smooth((t-2.56)/.44);
    const swing=Math.sin((t-1.69)*8.4)*smooth((t-1.69)/.35)*rest;
    const headAngle=devil?-.31*dip+.045*answer:-.36*dip+.10*answer;
    const armAngle=-.55*(1-offer);
    const ambient=vendorAmbientTime(t);
    return {dip,headAngle,headCos:Math.cos(headAngle),headSin:Math.sin(headAngle),
      lean:devil?-.027*offer-.014*dip:-.038*dip+.012*answer,
      breath:Math.sin(ambient*1.45)*.003,cloth:Math.sin(ambient*1.15-.5)*.002,
      armCos:Math.cos(armAngle),armSin:Math.sin(armAngle),offer,wrist,
      lantern:.029*swing};
  }
  function deformMerchant(u,v,p,devil){
    const upper=1-smooth((v-.32)/.55);
    // Weight remains over the planted feet while the face and arms respond.
    let x=u-(v-.75)*p.lean*upper,y=v-p.breath*upper;
    x+=p.cloth*smooth((v-.48)/.38)*Math.sin(u*Math.PI);
    const head=(1-smooth((v-.245)/.12))*smooth((u-.32)/.085)*(1-smooth((u-.69)/.09));
    const dx=u-.53,dy=v-.335;
    x+=(dx*p.headCos-dy*p.headSin-dx-.008*p.dip)*head;
    y+=(dx*p.headSin+dy*p.headCos-dy+.012*p.dip)*head;
    if(devil){
      // The claw starts inside the offer, opening through the elbow and wrist.
      const zone=(1-smooth((u-.346)/.135))*smooth((v-.25)/.08)*(1-smooth((v-.49)/.13));
      const ax=u-.42,ay=v-.37;
      x+=(ax*p.armCos-ay*p.armSin-ax+.023*(1-p.offer))*zone;
      y+=(ax*p.armSin+ay*p.armCos-ay)*zone;
      // Let the fingertips trail the elbow as the open palm turns upward.
      y+=.055*(p.offer-p.wrist)*zone*(1-smooth((u-.25)/.09));
    }else{
      // Weight the lantern below its hook and exclude the hand on the staff.
      const suspended=smooth((v-.17)/.17)*(1-smooth((u-.318)/.051))*(1-smooth((v-.46)/.11));
      x+=p.lantern*suspended;
    }
    return {x,y};
  }
  // Spend most Canvas samples in the greeting; the first seconds have
  // only a little breathing. Both renderers use the same authored clock.
  function merchantSampleTime(i){
    return i<=4?i*1.5/4:1.5+(i-4)*1.5/19;
  }
  function merchantCellAt(t){
    return Math.min(t<3?22:23,Math.round(t<=1.5?t*4/1.5:4+(t-1.5)*19/1.5));
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
  scope.GRIM_CUTSCENES={CELL,ANCHOR,BOW_FRAMES,VENDOR_FRAMES,SHRINE_MS,HOLD_START,HOLD_SECONDS,VENDOR_ANIMATION_SECONDS,VENDOR_SETTLED_FRAME,
    vendorVisualTime,vendorAmbientTime,
    vendorTravel,WALK_DISTANCE,merchantSampleTime,merchantCellAt,preload,relicMotionAt,approachAt,merchantPose,merchantPoint,createMerchantMesh,placeMerchant};
})(typeof window!=='undefined'?window:globalThis);
