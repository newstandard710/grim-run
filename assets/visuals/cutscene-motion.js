/* v0.19.7 — shared presentation time, dense solid poses and articulated merchants. */
(function(scope){
  'use strict';
  const CELL=224,ANCHOR=[136,214],BOW_FRAMES=169,VENDOR_FRAMES=241;
  const SHRINE_MS=4000,HOLD_START=3,HOLD_SECONDS=1,INTRO_MS=10000;
  const ROOT='assets/cutscenes/v0197/';
  const clamp=v=>Math.max(0,Math.min(1,v));
  const smooth=v=>{v=clamp(v);return v*v*v*(10+v*(-15+v*6));};
  function preload(s){
    for(const [key,file,cell,count] of [['cutscene-bow','reaper-bow.png',CELL,BOW_FRAMES],
      ['cutscene-vendor','reaper-vendor.png',CELL,VENDOR_FRAMES],['cutscene-hands','bow-hands.png',64,BOW_FRAMES]])
      s.load.spritesheet(key,ROOT+file+'?v=0.19.7',{frameWidth:cell,frameHeight:cell,endFrame:count-1});
  }
  function relicMotionAt(t){
    t=Math.max(0,t);
    const pose=t<.4?0:t<1.5?72*smooth((t-.4)/1.1):t<1.8?72:t<3?72+96*smooth((t-1.8)/1.2):168;
    const hold=t>=HOLD_START&&t<HOLD_START+HOLD_SECONDS;
    return {pose,frame:Math.round(pose),hold,grabbed:t>=1.65,
      glow:hold?smooth((t-HOLD_START)/.16)*(.90+.10*Math.sin((t-HOLD_START)*Math.PI)):0};
  }
  const WALK_STRIDE=100/.6;
  const vendorTravel=h=>2*WALK_STRIDE*.4*h/420;
  function approachAt(t){
    const travel=smooth(t/2.2);
    // Two complete gait cycles end on the exact painting that begins settling.
    const frame=t<2.2?Math.floor(travel*192)%96:t<3.4?96+Math.floor(smooth((t-2.2)/1.2)*96):193+Math.floor((t-3.4)/3.2*48)%48;
    return {frame,travel,presence:smooth((t-2.1)/1.3)};
  }
  function merchantPose(t,devil=false){
    const dip=smooth((t-7.0)/2.25),presence=smooth((t-2.4)/1.2);
    return {dip,headAngle:-(devil?.29:.25)*dip,
      lean:-.012*presence-.012*dip,breath:Math.sin(t*1.45)*.0025,cloth:Math.sin(t*1.15-.5)*.002};
  }
  function merchantPoint(u,v,t,devil=false){
    const p=merchantPose(t,devil),upper=1-smooth((v-.32)/.55);
    // Grounded legs, hip-led torso tilt, delayed cloth. No whole-body scaling.
    let x=u-(v-.75)*p.lean*upper,y=v-p.breath*upper;
    x+=p.cloth*smooth((v-.48)/.38)*Math.sin(u*Math.PI);
    const head=(1-smooth((v-.245)/.12))*smooth((u-.32)/.085)*(1-smooth((u-.69)/.09));
    const dx=u-.53,dy=v-.335,c=Math.cos(p.headAngle),s=Math.sin(p.headAngle);
    x+=(dx*c-dy*s-dx-.008*p.dip)*head;
    y+=(dx*s+dy*c-dy+.012*p.dip)*head;
    return {x,y};
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
    for(let i=0;i<m.vertices.length;i++){
      const uv=m.cutscenePoints[i],p=merchantPoint(uv.u,uv.v,t,devil),v=m.vertices[i];
      v.x=(p.x-.5)*width;v.y=(1-p.y)*height;
    }
    m.dirtyCache[9]=-1;m.preUpdate();
    m.cutscenePose=merchantPose(t,devil);
    return true;
  }
  scope.GRIM_CUTSCENES={CELL,ANCHOR,BOW_FRAMES,VENDOR_FRAMES,SHRINE_MS,HOLD_START,HOLD_SECONDS,INTRO_MS,
    vendorTravel,WALK_STRIDE,preload,relicMotionAt,approachAt,merchantPose,merchantPoint,createMerchantMesh,placeMerchant};
})(typeof window!=='undefined'?window:globalThis);
