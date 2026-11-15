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
      s.load.spritesheet(key,ROOT+file+'?v='+(key==='cutscene-vendor'?'0.19.11':'0.19.8'),{frameWidth:cell,frameHeight:cell,endFrame:count-1});
  }
  function relicMotionAt(t){
    t=Math.max(0,t);
    const pose=t<.4?0:t<1.5?72*smooth((t-.4)/1.1):t<1.8?72:t<3?72+96*smooth((t-1.8)/1.2):168;
    const hold=t>=HOLD_START&&t<HOLD_START+HOLD_SECONDS;
    // Quantization must not select the final painting early: the raised
    // drawing, glow clock and one-second exit all begin on the same boundary.
    return {pose,frame:t<HOLD_START?Math.min(167,Math.round(pose)):168,hold,grabbed:t>=1.65,
      glow:hold?smooth((t-HOLD_START)/.16)*(.90+.10*Math.sin((t-HOLD_START)*Math.PI)):0};
  }
  const WALK_STRIDE=100/.6;
  const vendorTravel=h=>2*WALK_STRIDE*.4*h/420;
  function approachAt(t){
    if(t>=VENDOR_ANIMATION_SECONDS)return {frame:VENDOR_SETTLED_FRAME,travel:1,presence:1};
    const travel=smooth(t/2.2);
    // Two complete gait cycles join the existing planted settle sequence.
    const frame=t<2.2?Math.floor(travel*192)%96:
      96+Math.min(95,Math.floor(smooth((t-2.2)/.8)*96));
    return {frame,travel,presence:smooth((t-2.1)/.9)};
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
    const dip=devil?smooth((t-1.56)/1.03):smooth((t-1.50)/.96);
    const greet=smooth((t-1.92)/.75),offer=smooth((t-2.25)/.53);
    const ambient=vendorAmbientTime(t),rest=1-smooth((t-2.55)/.45);
    const swing=Math.sin((t-1.88)*9)*smooth((t-1.88)/.33)*rest;
    const headAngle=-(devil?.29:.25)*dip;
    const armAngle=-.51*(1-offer);
    return {dip,headAngle,headCos:Math.cos(headAngle),headSin:Math.sin(headAngle),
      lean:devil?-.019*offer-.009*dip:-.026*greet,
      breath:Math.sin(ambient*1.45)*.0025,cloth:Math.sin(ambient*1.15-.5)*.002,
      armCos:Math.cos(armAngle),armSin:Math.sin(armAngle),offer,lantern:.012*swing};
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
    }else{
      // Weight the lantern below its hook and exclude the hand on the staff.
      const suspended=smooth((v-.17)/.17)*(1-smooth((u-.318)/.051))*(1-smooth((v-.46)/.11));
      x+=p.lantern*suspended;
    }
    return {x,y};
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
    vendorTravel,WALK_STRIDE,preload,relicMotionAt,approachAt,merchantPose,merchantPoint,createMerchantMesh,placeMerchant};
})(typeof window!=='undefined'?window:globalThis);
