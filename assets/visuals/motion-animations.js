/* Solid distance-driven gait, physical jumps and a rigid cutting edge. */
(function(scope){
  'use strict';
  const DATA=scope.GRIM_MOTION_DATA,RUN=scope.GRIM_RUN_DATA,ROOT='assets/motion/v0180/';
  const FORWARD=scope.GRIM_FORWARD_SCYTHE;
  // Each gait is a full left/right cycle. The atlas and snow contacts
  // use the same distance along the run.
  const GAITS_PER_SHEET=RUN?.gaitsPerSheet||4,PIXELS_PER_GAIT=RUN?.pixelsPerGait||188,
    STRIDE_PX=GAITS_PER_SHEET*PIXELS_PER_GAIT,LAND_MS=175,COUNT=24;
  const AIR_KEYS=Object.freeze([0,4,12,16,18,20,23]),AIR_STEPS=4;
  const AIR_ART={
    key:'motion-reaper-jump-deliberate',url:ROOT+'reaper-air-registration.webp?v=2',
    width:224,height:184,columns:8,frames:48,anchor:[125,168],scale:13/15
  };
  const AIR_CLOTH={key:'motion-reaper-air-cloth',url:'assets/motion/v0200/reaper-air-cloth.webp?v=1',
    width:200,height:184,columns:8,frames:17};
  const AIR_CUT_ART={
    key:'motion-reaper-air-cut-joins',url:ROOT+'reaper-air-cut-joins.webp?v=2',
    width:192,height:160,columns:6,frames:18,anchor:[125,148],scale:13/15
  };
  // Pommel-side fingers in each source air band. prepare-air-cut-joins.py
  // registers the matching painted body to these world-space grips.
  const AIR_CUT_HANDS=[[-46,-54],[-43,-53],[-43,-53]];
  const AIR_KEY_START=18,AIR_CONTACT=25,TUCK_START=26,TUCK_RELEASE=29,
    TUCK_EXIT_START=30,TUCK_ENTRY_START=39,TUCK_TOUCHDOWN=45,TUCK_TO_SLIDE=47;
  const CUT_HANDOFF=DATA?.visualCutHandoff,CUT_HANDOFF_KEY='motion-reaper-cut-handoffs';
  // The old 0.14-source scale was sized for the damage reach, making the
  // cutting weapon larger than the carried one. One carry-matched scale is
  // immutable throughout windup, swing and recovery; reach belongs to the arc.
  const SWEEP_SCALE=DATA?.weapon?.scale??(.14/(384/1254)),WEAPON_SCALE=SWEEP_SCALE*.60;
  const EDGE=[[201,500],[360,310],[520,265],[690,280]].map(v=>v.map(n=>n*384/1254));
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const mix=(a,b,t)=>a+(b-a)*t;
  function sample(t,loop=false){
    t=loop?((t%COUNT)+COUNT)%COUNT:clamp(t,0,COUNT-1);
    const a=Math.floor(t);return {a,b:loop?(a+1)%COUNT:Math.min(COUNT-1,a+1),mix:t-a};
  }
  function runFrame(distance){return ((distance/STRIDE_PX*COUNT)%COUNT+COUNT)%COUNT;}
  function runAtlasFrame(distance){
    const count=RUN?.frames||COUNT;
    return Math.floor(((distance/STRIDE_PX*count)%count+count)%count);
  }
  function runSupportRise(s,p,frame){
    if(p.onSoulPlatform!==false||!RUN?.groundX||!s.terrain?.groundAt)return 0;
    const ground=s.terrain.groundAt(p.x),underfoot=s.terrain.groundAt(p.x+RUN.groundX[frame]);
    if(!Number.isFinite(ground)||!Number.isFinite(underfoot)||Math.abs(s.feetY-ground)>2)return 0;
    // Keep the planted boot on ordinary slopes without moving the collision
    // root, or letting steep terrain pull the entire painted body too far.
    return clamp(underfoot-ground,-12,12);
  }
  function ease(t){t=clamp(t);return t*t*(3-2*t);}
  // The rigid handle and cast socket use their own hull. The hooked plate is
  // free to travel through the ground. Subdivide the hull at asset load only.
  const shaft=[];
  const hull=FORWARD?.rear?.shaft||[];
  for(let i=0;i<hull.length;i++){
    const [x,y]=hull[i],[u,v]=hull[(i+1)%hull.length];
    const n=Math.ceil(Math.hypot(u-x,v-y)/2);
    for(let j=0;j<n;j++)shaft.push([mix(x,u,j/n),mix(y,v,j/n)]);
  }
  function floorAt(s,x,ledge){
    const ground=s.terrain?.groundAt(x);
    const y=Number.isFinite(ground)?ground:Infinity;
    return ledge&&x>=ledge.x&&x<=ledge.x+ledge.width?Math.min(y,ledge.y):y;
  }
  function levelDragAngle(height){
    const [u,v]=FORWARD.rear.dragMark;
    return -Math.PI-Math.atan2(v,-u)-Math.asin(clamp(height/Math.hypot(u,v),-1,1));
  }
  function dragAngle(s,x,y,ledge){
    const [u,v]=FORWARD.rear.dragMark;
    // Solve at the actual world x of the turned blade, including on a bank.
    // Over empty space the grip hangs freely at its level-ground angle.
    const free=levelDragAngle(s.feetY-y);
    const error=angle=>{
      const c=Math.cos(angle),sn=Math.sin(angle);
      const at=x-u*c-v*sn;
      let level=floorAt(s,at,ledge);
      if(ledge)level=Math.min(level,ledge.y);
      if(!Number.isFinite(level)){
        // Across a gap let gravity hold the drag angle between the two lips.
        // Only solid ground occludes the steel or constrains the shaft.
        const gap=s.terrain.sectionAt?.(at);
        const left=gap&&s.terrain.groundAt(gap.start-.01),right=gap&&s.terrain.groundAt(gap.end+.01);
        level=Number.isFinite(left)&&Number.isFinite(right)
          ?mix(left,right,(at-gap.start)/(gap.end-gap.start)):s.feetY;
      }
      return y-u*sn+v*c-level;
    };
    const flat=error(free);
    if(Math.abs(flat)<.015)return free;
    let low=flat>0?free:-3.07,high=flat>0?-.04:free;
    for(let i=0;i<13;i++){
      const angle=(low+high)*.5;
      if(error(angle)>0)low=angle;
      else high=angle;
    }
    return (low+high)*.5;
  }
  function rearCarryRotation(s,x,y,preferred,outline=FORWARD.rear.outline,clearancePx=6){
    const p=s.player;
    const ledge=p.onSoulPlatform===false?null:(s.soulPlatform||[]).find(v=>v.id===p.onSoulPlatform);
    const clearance=angle=>{
      const cos=Math.cos(angle),sin=Math.sin(angle);
      let margin=Infinity;
      for(const [u,v] of outline){
        const px=x-u*cos-v*sin,py=y-u*sin+v*cos;
        margin=Math.min(margin,floorAt(s,px,ledge)-py);
        if(margin<clearancePx)return margin;
      }
      return margin;
    };
    // Select the smallest lift that clears the rear ground profile. No
    // accumulated animation state is needed to reproduce the pose on rewind.
    if(clearance(preferred)>=clearancePx)return preferred;
    let low=preferred,high=-.16;
    if(clearance(high)<clearancePx){
      // The tip can clear a steep bank at an intermediate side-on angle,
      // even where the full upright swing crosses the old lip.
      for(let i=1;i<=12;i++){
        const test=mix(preferred,high,i/12);
        if(clearance(test)>=clearancePx){high=test;break;}
        if(i===12)return high;
        low=test;
      }
    }
    for(let i=0;i<8;i++){
      const mid=(low+high)*.5;
      if(clearance(mid)>=clearancePx)high=mid;
      else low=mid;
    }
    return high;
  }
  function jumpFrame(p){
    if(p.grounded){
      const elapsed=LAND_MS-(p.visualLandingMs||0);
      if(elapsed<36)return mix(16,18,ease(elapsed/36));
      if(elapsed<86)return mix(18,20,ease((elapsed-36)/50));
      return mix(20,23,ease((elapsed-86)/(LAND_MS-86)));
    }
    if(p.hovering)return 4;
    const age=p.jumpAgeMs||0,vy=p.velocityY||0;
    if(vy<0){
      // Both jump types settle into the same gathered stance and hold it.
      // A second impulse gathers the extended airborne leg instead of
      // replaying a ground push-off.
      return p.airJumpUsed?mix(12,4,ease(age/110)):mix(0,4,ease(age/105));
    }
    // The extension is one movement. Hold at the apex and ease the reaching
    // foot out as the fall develops, including after walking off a ledge.
    return vy<245?mix(4,12,ease((vy-85)/160)):mix(12,16,ease((vy-245)/130));
  }
  function airPose(t,hasDetails){
    const right=AIR_KEYS.findIndex(key=>key>=t);
    if(right<=0||AIR_KEYS[right]===t)return {frame:AIR_KEYS[Math.max(0,right)],tween:false};
    const left=right-1,a=AIR_KEYS[left],b=AIR_KEYS[right];
    const step=Math.round((t-a)/(b-a)*AIR_STEPS);
    if(!hasDetails||step===0||step===AIR_STEPS)
      return {frame:step<AIR_STEPS/2?a:b,tween:false};
    return {frame:left*(AIR_STEPS-1)+step-1,tween:true};
  }
  function airBand(t){return t<8?0:t<14?1:2;}
  function tuckPose(s,t,tucked,release){
    const p=s.player;
    if(tucked){
      const hold=scope.GRIM_POWER_ART.actionFrame(s);
      // A latched takeoff already starts in a low action. An airborne press
      // begins with a low registered join from the current jump band.
      const age=p.visualTuckMs||0;
      if(!p.airTuck&&age<40)return TUCK_ENTRY_START+airBand(t)*2+(age>=20?1:0);
      return TUCK_START+hold;
    }
    const step=Math.min(3,Math.floor((scope.GRIM_POWER_ART.TUCK_RELEASE_MS-release)/20));
    return step===0?TUCK_RELEASE:TUCK_EXIT_START+airBand(t)*3+step-1;
  }
  function cutFrame(progress){
    const t=clamp(progress);
    return t<.20?t/.20*6:t<.79?6+(t-.20)/.59*12:18+(t-.79)/.21*5;
  }
  function cutRig(progress){
    const t=cutFrame(progress),f=sample(t),a=DATA.grips[f.a],b=DATA.grips[f.b];
    const gripX=(mix(a[0],b[0],f.mix)-DATA.anchor[0])*.38;
    const y=(mix(a[1],b[1],f.mix)-DATA.anchor[1])*.38;
    const start=(DATA.grips[6][0]-DATA.anchor[0])*.38;
    const active=clamp((progress-.2)/.59),ease=active*active*(3-2*active);
    // A short full-body lunge keeps the grip attached while the point advances
    // continuously. Raw hand registration must not pull the cutting edge back.
    const x=progress<.2?gripX:progress<=.79?mix(start,30,ease):mix(30,gripX,clamp((progress-.79)/.21));
    // A mirrored rigid blade has its point ahead of its socket during this
    // clockwise sweep. It is never flipped or reshaped during the action.
    const angle=progress<.2?mix(-1.15,0,clamp(progress/.2)):
      progress<.79?mix(0,.90,clamp((progress-.2)/.59)):
      mix(.90,-1.15,clamp((progress-.79)/.21));
    return {x,y,angle,bodyX:x-gripX};
  }
  function visualCutRig(progress,sharedWeapon=!!DATA.visualCutWeapon){
    const frame=cutFrame(progress),grip=DATA.visualCutGrips[Math.round(frame)];
    // The painted hand drives the rigid weapon. Keep the small weight shift
    // separate from the original grip and angle that drive the damage arc.
    const bodyX=8*ease((progress-.2)/.39)*(1-ease((progress-.68)/.32));
    const carry=sharedWeapon?0:-.30,windup=sharedWeapon?-.16:0,end=sharedWeapon?1.43:.90;
    const angle=progress<.2?mix(carry,windup,ease(progress/.2)):
      progress<.79?mix(windup,end,clamp((progress-.2)/.59)):
      mix(end,carry,ease((progress-.79)/.21));
    return {frame,bodyX,angle,x:(grip[0]-DATA.anchor[0])*.38+bodyX,
      y:(grip[1]-DATA.anchor[1])*.38};
  }
  function cutAirBand(t){return t<3?0:t<9?1:2;}
  function cutHandoff(s,p,frame,runFrame){
    const {edgeFrames,edgeWeights,phases,poses}=CUT_HANDOFF;
    const edge=edgeFrames.indexOf(frame);
    if(p.grounded&&edge<0)return null;
    const air=p.grounded?0:jumpFrame(p);
    const phase=(runFrame%(RUN.frames/RUN.gaitsPerSheet))/(RUN.frames/RUN.gaitsPerSheet);
    const group=p.grounded?Math.round(phase*phases)%phases:phases+cutAirBand(air);
    const index=edge<0?(phases+3)*edgeFrames.length+frame:group*edgeFrames.length+edge;
    const rise=p.grounded?runSupportRise(s,p,runFrame)*edgeWeights[edge]:0;
    return {index,rise,grip:poses[index]};
  }
  function registeredCutJoin(handoff){
    const {phases,edgeWeights}=CUT_HANDOFF,n=edgeWeights.length;
    const index=handoff.index-phases*n;
    if(index<0||index>=AIR_CUT_ART.frames)return handoff;
    const [x,y]=AIR_CUT_HANDS[Math.floor(index/n)],w=edgeWeights[index%n];
    const [baseX,baseY,angle]=handoff.grip;
    return {index,rise:0,art:AIR_CUT_ART,grip:[mix(baseX,x,w),mix(baseY,y,w),mix(angle,.54,w)]};
  }
  function weaponPoint(rig,point,scale=WEAPON_SCALE){
    const w=DATA.weapon,dx=-(point[0]-w.pivot[0])*scale,dy=(point[1]-w.pivot[1])*scale;
    return {x:rig.x+dx*Math.cos(rig.angle)-dy*Math.sin(rig.angle),
      y:rig.y+dx*Math.sin(rig.angle)+dy*Math.cos(rig.angle)};
  }
  function sweepPoint(rig,point){return weaponPoint(rig,point,SWEEP_SCALE);}
  function drawSwingArc(g,s,progress,alpha=1){
    if(progress<.20||progress>.79)return;
    const broad=scope.GRIM_CORE.attackBox(s.player.x,s.feetY,0,false),rig=cutRig(progress);
    const points=EDGE.map(v=>sweepPoint(rig,v)).map(p=>({
      x:clamp(s.player.x+p.x,broad.x,broad.x+broad.width),
      y:clamp(s.feetY+p.y,broad.y,s.feetY-10)}));
    // A restrained spectral cutting arc supplies the preserved attack reach.
    // Its centerline is the same edge sampled by swept collision below.
    const strength=.32+.28*Math.sin(clamp((progress-.2)/.59)*Math.PI);
    for(const [width,opacity]of [[14,.10],[7,.22],[2.5,.75]]){
      g.lineStyle(width,0xb9f4ea,alpha*strength*opacity).beginPath();
      for(let i=0;i<points.length;i++)i?g.lineTo(points[i].x,points[i].y):g.moveTo(points[i].x,points[i].y);
      g.strokePath();
    }
    g.lineStyle(2,0xb9f4ea,.20*alpha).beginPath();
    const begin=Math.max(.20,progress-.09);
    for(let i=0;i<8;i++){const tip=sweepPoint(cutRig(mix(begin,progress,i/7)),DATA.weapon.tip);
      const x=clamp(s.player.x+tip.x,broad.x,broad.x+broad.width),y=clamp(s.feetY+tip.y,broad.y,s.feetY-10);
      i?g.lineTo(x,y):g.moveTo(x,y);}
    g.strokePath();
  }
  function sweepBoxes(s,previousMs){
    const p=s.player,C=scope.GRIM_CONFIG,broad=scope.GRIM_CORE.attackBox(p.x,s.feetY,0,false);
    const end=clamp(1-p.attackMs/C.attackDurationMs,.20,.79);
    const begin=clamp(1-(previousMs??p.attackMs)/C.attackDurationMs,.20,.79);
    const boxes=[],steps=Math.max(1,Math.ceil(Math.abs(end-begin)*80));
    // Sample the cutting edge continuously between updates. No damage can
    // leak outside the old reach envelope or outside the 20%–79% action window.
    for(let i=0;i<=steps;i++){
      const rig=cutRig(mix(begin,end,i/steps)),points=EDGE.map(v=>sweepPoint(rig,v));
      for(let j=1;j<points.length;j++){
        const a=points[j-1],b=points[j],pad=7;
        const x=Math.max(broad.x,p.x+Math.min(a.x,b.x)-pad),y=Math.max(broad.y,s.feetY+Math.min(a.y,b.y)-pad);
        const right=Math.min(broad.x+broad.width,p.x+Math.max(a.x,b.x)+pad),bottom=Math.min(broad.y+broad.height,s.feetY+Math.max(a.y,b.y)+pad);
        if(right>x&&bottom>y)boxes.push({x,y,width:right-x,height:bottom-y});
      }
    }
    return boxes;
  }
  function preload(s){
    if(!DATA||!s.load?.spritesheet)return;
    for(const [name,m]of Object.entries(DATA.sheets))s.load.spritesheet('motion-'+name,
      ROOT+name+'.png?v='+(name==='reaper-cut-body'?'0.19.10-cut2':'0.18.0'),
      {frameWidth:m.cell[0],frameHeight:m.cell[1],endFrame:m.frames-1});
    s.load.image('motion-scythe',ROOT+'scythe.png?v=0.18.0');
    if(DATA.visualCutWeapon)s.load.image('motion-cut-scythe',ROOT+'reaper-cut-scythe.png?v=1');
    if(CUT_HANDOFF)s.load.spritesheet(CUT_HANDOFF_KEY,ROOT+'reaper-cut-handoffs.webp?v=2',
      {frameWidth:CUT_HANDOFF.cell,frameHeight:CUT_HANDOFF.cell,endFrame:CUT_HANDOFF.poses.length-1});
    if(RUN)s.load.spritesheet('motion-reaper-run-solid','assets/motion/v0194/reaper-run.webp?v=5',
      {frameWidth:RUN.cell,frameHeight:RUN.cell,endFrame:RUN.frames-1});
  }
  function queueAirDetails(s){
    const motion=s.motionArt,loader=scope.GRIM_ACTOR_TEXTURES;
    if(!motion||!loader)return;
    loader.load(s,AIR_ART,()=>{motion.airReady=motion.airDetailsValid(AIR_ART);});
    loader.load(s,AIR_CUT_ART,()=>{motion.airCutReady=motion.airDetailsValid(AIR_CUT_ART);});
    if(FORWARD){
      loader.load(s,AIR_CLOTH,()=>{motion.airClothReady=true;});
      const stages=[FORWARD.carry,FORWARD.cut,FORWARD.weapon],available=new Set();
      for(const art of stages)loader.load(s,art,()=>{
        const isWeapon=art===FORWARD.weapon;
        if(motion.airDetailsValid(art,isWeapon?100:25,isWeapon?850:280))available.add(art.key);
        motion.forwardReady=available.size===stages.length;
      });
      scope.GRIM_RISING_CUT?.preload(s,motion);
    }
  }
  class MotionAnimations{
    constructor(s){
      this.scene=s;this.body=[];this.ready=false;this.state=null;
      this.airReady=false;this.registeredAir=null;
      if(!DATA||!s.add?.image||!s.textures?.exists)return;
      this.ready=Object.keys(DATA.sheets).every(name=>s.textures.exists('motion-'+name)&&
        Array.from({length:COUNT},(_,i)=>s.textures.get('motion-'+name).has(i)).every(Boolean))&&s.textures.exists('motion-scythe');
      if(this.ready&&typeof document!=='undefined'){
        try{
          const c=document.createElement('canvas');c.width=c.height=80;
          const g=c.getContext('2d',{willReadFrequently:true});
          for(const name of Object.keys(DATA.sheets)){
            const image=s.textures.get('motion-'+name).getSourceImage();
            if(image.width!==1920||image.height!==1280)throw Error('Motion atlas dimensions: '+name);
            for(let i=0;i<COUNT;i++){
              g.clearRect(0,0,80,80);g.drawImage(image,i%6*320,Math.floor(i/6)*320,320,320,0,0,80,80);
              const bytes=g.getImageData(0,0,80,80).data;let opaque=0;
              for(let p=3;p<bytes.length;p+=4)if(bytes[p]>64)opaque++;
              if(opaque<150||opaque>5000)throw Error('Blank or invalid motion pose: '+name+' '+i);
            }
          }
        }catch(e){this.ready=false;s.visuals?.failedAssets?.push(String(e));}
      }
      if(!this.ready)return;
      this.runReady=!!RUN&&s.textures.exists('motion-reaper-run-solid')&&
        Array.from({length:RUN.frames},(_,i)=>s.textures.get('motion-reaper-run-solid').has(i)).every(Boolean);
      this.cutHandoffReady=this.runReady&&!!CUT_HANDOFF&&s.textures.exists(CUT_HANDOFF_KEY)&&
        CUT_HANDOFF.poses.every((_,i)=>s.textures.get(CUT_HANDOFF_KEY).has(i));
      this.body=[0,1].map(()=>s.add.image(0,0,'motion-reaper-run',0).setDepth(12.09)
        .setOrigin(DATA.anchor[0]/DATA.cell[0],DATA.anchor[1]/DATA.cell[1]).setVisible(false));
      // This visual paint is independent of the legacy collision-readiness assets.
      this.cutWeaponReady=!!DATA.visualCutWeapon&&s.textures.exists('motion-cut-scythe');
      const weaponPaint=this.cutWeaponReady?DATA.visualCutWeapon:DATA.weapon;
      this.weapon=s.add.image(0,0,this.cutWeaponReady?'motion-cut-scythe':'motion-scythe')
        .setOrigin(weaponPaint.pivot[0]/384,weaponPaint.pivot[1]/384)
        .setDepth(12.08).setVisible(false);
      this.trail=s.add.graphics().setDepth(12.07);
      s.events?.once?.('shutdown',()=>this.destroy());
    }
    airDetailsValid(art,minOpaque=25,maxOpaque=280){
      const {key,width,height,columns,frames}=art;
      const texture=this.scene.textures.get(key),image=texture?.getSourceImage?.();
      const rows=Math.ceil(frames/columns);
      if(image?.width!==width*columns||image.height!==height*rows||
         !Array.from({length:frames},(_,i)=>texture.has(i)).every(Boolean))return false;
      try{
        // Check occupancy once. A valid-looking response with blank or solid
        // tiles cannot replace the original key poses. This is cosmetic only.
        const sample=document.createElement('canvas'),w=width/8,h=height/8;
        sample.width=w*columns;sample.height=h*rows;
        const g=sample.getContext('2d',{willReadFrequently:true});
        g.drawImage(image,0,0,sample.width,sample.height);
        for(let i=0;i<frames;i++){
          const {data}=g.getImageData(i%columns*w,Math.floor(i/columns)*h,w,h);
          let opaque=0;
          for(let k=3;k<data.length;k+=4)if(data[k]>64)opaque++;
          if(opaque<minOpaque||opaque>maxOpaque)return false;
        }
        return true;
      }catch(_){return false;}
    }
    airSequence(p){
      const active=!p.grounded||(p.visualLandingMs||0)>0;
      if(this.airPlayer!==p||!active){
        this.airPlayer=p;
        this.registeredAir=null;
      }
      if(active&&this.registeredAir===null){
        this.registeredAir=this.airReady;
        this.registeredAirCut=this.airReady&&this.airCutReady&&this.cutWeaponReady;
      }
      return this.registeredAir;
    }
    forwardSequence(p,tucked,release,registered){
      const s=this.scene,newPlayer=this.forwardPlayer!==p;
      const airSequence=!p.grounded||(p.visualLandingMs||0)>0;
      if(newPlayer){
        this.forwardPlayer=p;
        this.forwardAir=null;
        this.forwardSwing=null;
      }
      // After an early Start, adopt the complete family on settled running.
      // Keep an in-progress jump, slide recovery, or attack on its own paint.
      if(newPlayer||(!this.forwardActive&&s.state==='playing'&&!airSequence&&!s.lowProfile&&
        !p.sliding&&!p.holdSlide&&!p.attackMs&&!p.visualFireMs&&!p.visualHurtMs&&
        !s.slideArt?.painted&&s.slideArt?.recoveryAt==null)){
        this.forwardActive=Boolean(this.rising&&this.forwardReady&&this.cutHandoffReady&&this.cutWeaponReady&&
          this.airReady&&this.airCutReady);
      }
      if(airSequence){
        if(this.forwardAir===null)this.forwardAir=Boolean(this.forwardActive&&registered);
        if(tucked||release)this.forwardAir=false;
      }else this.forwardAir=null;
      if(p.attackMs>0){
        if(this.forwardSwing!==s.swingSequence){
          this.forwardSwing=s.swingSequence;
          this.forwardAttack=Boolean(this.forwardActive&&!s.lowProfile&&!p.sliding&&
            (p.grounded||this.forwardAir&&this.registeredAirCut));
        }
        if(tucked||release)this.forwardAttack=false;
      }
    }
    forwardPose(p,name,progress,runCell,registeredFrame,solidRun){
      if(!this.forwardActive)return null;
      const body=FORWARD.carry;
      if(name==='reaper-run'&&solidRun)return {art:body,frame:runCell%(RUN.frames/RUN.gaitsPerSheet)};
      if(name==='reaper-jump'&&this.forwardAir&&registeredFrame!==null&&registeredFrame<26)
        return {art:body,frame:96+registeredFrame};
      if(name!=='reaper-cut-body'||!this.forwardAttack)return null;
      const step=clamp(Math.round(progress*scope.GRIM_CONFIG.attackDurationMs/FORWARD.stepMs),0,FORWARD.ground.length-1);
      const options=(p.grounded?FORWARD.ground:FORWARD.air)[step];
      const phase=p.grounded?Math.round((runCell%96)/8)%12:cutAirBand(jumpFrame(p));
      const frame=options.length===1?options[0]:options[phase];
      return {art:FORWARD.cut,frame,grip:FORWARD.grips[frame]};
    }
    trailingRotation(x,y,drag=this.scene.player.grounded&&!this.scene.player.visualLandingMs){
      const s=this.scene,p=s.player,floor=s.terrain?.groundAt(p.x);
      if(drag){
        const ledge=p.onSoulPlatform===false?null:s.soulPlatform?.find(v=>v.id===p.onSoulPlatform);
        return rearCarryRotation(s,x,y,dragAngle(s,x,y,ledge),shaft,2);
      }
      const airborne=!p.grounded&&p.onSoulPlatform===false;
      const lift=airborne?ease((Number.isFinite(floor)?floor-s.feetY:46)/46):0;
      // Shift the rest angle before the blade reaches a downhill crest.
      // The rigid outline still handles the exact floor and gap lips.
      let downhill=0;
      if(Number.isFinite(floor)){
        for(const offset of [62,84,106]){
          const behind=s.terrain.groundAt(p.x-offset);
          if(Number.isFinite(behind))downhill+=Math.max(0,floor-behind)/3;
        }
        const ahead=s.terrain.groundAt(p.x+26);
        if(Number.isFinite(ahead))downhill+=Math.max(0,ahead-floor)*.9;
      }
      const bank=ease((downhill-5)/58);
      const phase=(p.x-(s.startX||0))/PIXELS_PER_GAIT*Math.PI*2;
      const rest=-Math.PI/2+Math.max(lift*.29,bank*1.16)+.035*Math.sin(phase-.4);
      return rearCarryRotation(s,x,y,rest);
    }
    clearRearRecoil(x,y,rotation){
      return rearCarryRotation(this.scene,x,y,rotation);
    }
    showRearCarry(frame,y,alpha,tint,owner){
      const hand=FORWARD?.rear?.hands[frame];
      if(!hand)return;
      const [x,dy]=hand,s=this.scene;
      const rotation=this.trailingRotation(s.player.x+x,y+dy,frame<96&&s.player.grounded);
      this.showForwardWeapon([x,dy,rotation],y-s.feetY,alpha,tint);
      this.weapon.setScale(-FORWARD.weapon.scale,FORWARD.weapon.scale);
      // Solid terrain and one-way platforms already paint their exact silhouette.
      if(frame<96&&s.player.grounded)this.weapon.setDepth(.61);
      this.rearOwner=owner;
    }
    hideRearCarry(){
      if(!this.rearOwner)return;
      this.weapon?.setVisible(false);
      this.rearOwner=null;
    }
    rearWeaponFor(owner){
      return owner&&this.rearOwner===owner&&this.weapon?.visible?this.weapon:null;
    }
    carryCutGrip(grip,rise,progress){
      if(!FORWARD.rear||progress>=.20&&progress<=.79)return grip;
      const [x,y,angle]=grip,s=this.scene;
      const trailing=this.trailingRotation(s.player.x+x,s.feetY+y+rise);
      const ramp=progress<.20?progress/.20:(1-progress)/.21;
      const blend=mix(ramp,ease(ramp),.22);
      return [x,y,mix(trailing,angle,blend)];
    }
    showForwardWeapon(grip,rise,alpha,tint){
      const s=this.scene,art=FORWARD.weapon;
      const [x,y,angle]=grip;
      this.weapon.setDepth(12.08).setTexture(art.key,0).setOrigin(art.anchor[0]/art.width,art.anchor[1]/art.height)
        .setPosition(s.player.x+x,s.feetY+y+rise).setRotation(angle).setScale(art.scale)
        .setAlpha(alpha).setTint(tint).setVisible(true);
      this.forwardWeapon=true;
    }
    restoreWeaponPaint(){
      if(!this.forwardWeapon)return;
      const paint=this.cutWeaponReady?DATA.visualCutWeapon:DATA.weapon;
      this.weapon.setDepth(12.08).setTexture(this.cutWeaponReady?'motion-cut-scythe':'motion-scythe')
        .setOrigin(paint.pivot[0]/384,paint.pivot[1]/384);
      this.forwardWeapon=false;
    }
    hide(){for(const v of this.body)v.setVisible(false);this.weapon?.setVisible(false);this.trail?.clear();this.state=null;this.rearOwner=null;}
    handlesCut(){
      const s=this.scene,p=s.player;
      return this.ready&&s.visuals?.reviewV2&&!s.lowProfile&&s.powerManager.level('soulCleave')===0&&p.attackMs>0;
    }
    attackBoxes(previousMs){return this.handlesCut()?sweepBoxes(this.scene,previousMs):null;}
    render(){
      this.rising?.clear();
      const upright=this.rising?.upright();
      this.renderRegistered(upright);
      if(upright)this.rising.renderUpright();
      else this.rising?.renderHandoff();
    }
    renderRegistered(rising=false){
      this.hide();const s=this.scene,p=s.player;
      if(!this.ready||!p||!s.visuals?.reviewV2||!['playing','paused','rewinding','countdown'].includes(s.state))return;
      const attackMs=rising?0:p.attackMs;
      const registered=this.airSequence(p);
      const tucked=!p.grounded&&(p.airTuck||p.holdSlide)&&p.onSoulPlatform===false;
      const release=!tucked&&!p.grounded&&p.onSoulPlatform===false&&
        (p.visualTuckMs>0?scope.GRIM_POWER_ART.TUCK_RELEASE_MS:p.visualTuckReleaseMs||0);
      if(FORWARD)this.forwardSequence(p,tucked,release,registered);
      const landAge=LAND_MS-p.visualLandingMs;
      const tuckLanding=registered&&p.grounded&&s.powerArt?.tuckLanding&&landAge<36&&attackMs<=0;
      const registeredTuck=registered&&tucked&&attackMs<=0;
      if(((s.lowProfile||p.airTuck)&&!registeredTuck&&!tuckLanding)||(p.sliding&&!tuckLanding)||
         (p.visualFireMs>0&&attackMs<=0&&!rising))return;
      const distance=p.x-(s.startX||0);
      let name,t,scale=.52,loop=false,rig=null,progress,handoff=null;
      if(attackMs>0){
        if(!this.handlesCut())return;
        name='reaper-cut-body';progress=1-p.attackMs/scope.GRIM_CONFIG.attackDurationMs;
        rig=visualCutRig(progress,this.cutWeaponReady);t=rig.frame;scale=DATA.visualCutBody?.scale??.38;
        if(this.cutHandoffReady){
          handoff=cutHandoff(s,p,Math.round(t),runAtlasFrame(distance));
          if(this.registeredAirCut&&!p.grounded&&handoff)handoff=registeredCutJoin(handoff);
        }
      }
      else if(!p.grounded||((p.visualLandingMs||0)>0&&!(this.runReady&&s.slideArt?.rejoinsRun))){
        // When details are absent, leave the authored PowerAnimations
        // release visible. An available strip draws the whole handoff here.
        if(release&&!registered&&s.powerArt?.action?.visible)return;
        name=tuckLanding&&p.sliding?'reaper-tuck-slide':tucked?'reaper-tuck':'reaper-jump';
        t=jumpFrame(p);
      }
      else {name='reaper-run';t=runFrame(distance);loop=true;}
      s.powerArt?.hideBase();s.powerArt?.action?.setVisible(false);
      for(const v of s.combatArt?.reaper||[])v.setVisible(false);
      const lowFlicker=tucked||name==='reaper-tuck-slide'||(release&&name==='reaper-jump');
      const flicker=lowFlicker?Math.floor(s.frame/5):Math.floor((s.elapsed||0)/.083333);
      const alpha=p.invulMs>0&&flicker%2===0?.58:1;
      const solidRun=name==='reaper-run'&&this.runReady;
      const air=name==='reaper-jump'||name==='reaper-tuck'||name==='reaper-tuck-slide'?airPose(t,registered):null;
      const registeredFrame=registered&&air?(tuckLanding?
        p.sliding?TUCK_TO_SLIDE:landAge<12?TUCK_RELEASE:TUCK_TOUCHDOWN+(landAge>=24?1:0):
        tucked||release?tuckPose(s,t,tucked,release):air.tween?air.frame:p.grounded&&air.frame===16?AIR_CONTACT:
        AIR_KEY_START+AIR_KEYS.indexOf(air.frame)):null;
      const atlasFrame=handoff?handoff.index:solidRun?runAtlasFrame(distance):
        registeredFrame??(air?air.frame:(loop?Math.round(t)%COUNT:Math.round(t)));
      const texture=handoff?(handoff.art?.key||CUT_HANDOFF_KEY):solidRun?'motion-reaper-run-solid':
        registeredFrame!==null?AIR_ART.key:'motion-'+name;
      const anchor=handoff?(handoff.art?.anchor||CUT_HANDOFF.anchor):solidRun?RUN.anchor:
        registeredFrame!==null?AIR_ART.anchor:(rig&&DATA.visualCutBody?.anchor)||DATA.anchor;
      const cell=handoff?CUT_HANDOFF.cell:solidRun?RUN.cell:DATA.cell[0];
      const sizedArt=handoff?.art||(registeredFrame!==null?AIR_ART:null);
      const rise=handoff?.rise??(solidRun?runSupportRise(s,p,atlasFrame):0);
      const tint=p.slowMs>0?0xb9ecff:0xffffff;
      const forward=FORWARD?this.forwardPose(p,name,progress,runAtlasFrame(distance),registeredFrame,solidRun):null;
      if(forward){
        const {art,frame,grip}=forward;
        let key=art.key,cell=frame;
        if(this.airClothReady&&art===FORWARD.carry&&frame===115&&!p.grounded){
          const age=p.jumpAgeMs||0;
          const weight=ease((age-105)/90)*(p.hovering?1:1-ease(((p.velocityY||0)-15)/80));
          const wave=Math.sin((age-105)*.0105)*weight;
          key=AIR_CLOTH.key;
          cell=8+Math.round(8*wave);
        }
        this.body[0].setTexture(key,cell).setOrigin(art.anchor[0]/art.width,art.anchor[1]/art.height)
          .setPosition(p.x,s.feetY+rise).setScale(FORWARD.scale).setAlpha(alpha).setTint(tint).setVisible(true);
        if(grip){
          this.showForwardWeapon(this.carryCutGrip(grip,rise,progress),rise,alpha,tint);
          drawSwingArc(this.trail,s,progress,alpha);
        }else if(art===FORWARD.carry){
          this.showRearCarry(frame,s.feetY+rise,alpha,tint,this.body[0]);
        }
        this.state={name,frame:t,atlasFrame,phase:loop?t/COUNT:null,texture:key};
        return;
      }
      const renderScale=handoff?CUT_HANDOFF.scale:solidRun?RUN.scale:registeredFrame!==null?AIR_ART.scale:scale;
      // One opaque registered painting at a time, including the derived
      // transitions. Keep the same apparent size and feet anchor.
      this.body[0].setTexture(texture,atlasFrame)
        .setOrigin(anchor[0]/(sizedArt?.width||cell),anchor[1]/(sizedArt?.height||cell))
        .setPosition(p.x+(rig?.bodyX||0),s.feetY+rise).setScale(renderScale)
        .setAlpha(alpha).setTint(tint).setVisible(true);
      if(rig){
        this.restoreWeaponPaint();
        const [gripX,gripY,carryAngle]=handoff?.grip??[rig.x-rig.bodyX,rig.y,0];
        this.weapon.setPosition(p.x+gripX+rig.bodyX,s.feetY+gripY+rise)
          .setRotation(rig.angle+(this.cutWeaponReady?carryAngle:0))
          .setScale(-WEAPON_SCALE,WEAPON_SCALE).setAlpha(alpha).setTint(tint).setVisible(true);
        drawSwingArc(this.trail,s,progress,alpha);
      }
      this.state={name,frame:t,atlasFrame,phase:loop?t/COUNT:null,texture};
    }
    destroy(){for(const v of this.body)v.destroy();this.body=[];this.weapon?.destroy();this.trail?.destroy();this.rising?.destroy();}
  }
  scope.GRIM_MOTION_ART={MotionAnimations,shaft,floorAt,levelDragAngle,preload,queueAirDetails,runFrame,runAtlasFrame,runSupportRise,jumpFrame,cutFrame,cutRig,visualCutRig,weaponPoint,sweepPoint,drawSwingArc,sweepBoxes,sample,STRIDE_PX,PIXELS_PER_GAIT,GAITS_PER_SHEET,WEAPON_SCALE,LAND_MS};
})(typeof window!=='undefined'?window:globalThis);
