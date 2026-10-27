/* v0.18 — distance-driven gait, physical jump phases and one rigid cutting edge. */
(function(scope){
  'use strict';
  const DATA=scope.GRIM_MOTION_DATA,ROOT='assets/motion/v0180/';
  const STRIDE_PX=188,LAND_MS=175,COUNT=24;
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const mix=(a,b,t)=>a+(b-a)*t;
  function sample(t,loop=false){
    t=loop?((t%COUNT)+COUNT)%COUNT:clamp(t,0,COUNT-1);
    const a=Math.floor(t);return {a,b:loop?(a+1)%COUNT:Math.min(COUNT-1,a+1),mix:t-a};
  }
  function runFrame(distance){return ((distance/STRIDE_PX*COUNT)%COUNT+COUNT)%COUNT;}
  function jumpFrame(p){
    if(p.grounded)return 18+clamp(1-(p.visualLandingMs||0)/LAND_MS)*5;
    if(p.hovering)return 10.5;
    const age=p.jumpAgeMs||0,vy=p.velocityY||0;
    if(age<55&&vy<0)return age/55*4;
    if(vy<-100)return 4+6*clamp(1-(-vy-100)/Math.max(1,(p.visualLaunchVelocity||610)-100));
    if(vy<=100)return 10+clamp((vy+100)/200)*2;
    return 12+6*clamp((vy-100)/550);
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
  function weaponPoint(rig,point){
    const w=DATA.weapon,dx=-(point[0]-w.pivot[0])*w.scale,dy=(point[1]-w.pivot[1])*w.scale;
    return {x:rig.x+dx*Math.cos(rig.angle)-dy*Math.sin(rig.angle),
      y:rig.y+dx*Math.sin(rig.angle)+dy*Math.cos(rig.angle)};
  }
  function sweepBoxes(s,previousMs){
    const p=s.player,C=scope.GRIM_CONFIG,broad=scope.GRIM_CORE.attackBox(p.x,s.feetY,0,false);
    const end=clamp(1-p.attackMs/C.attackDurationMs,.20,.79);
    const begin=clamp(1-(previousMs??p.attackMs)/C.attackDurationMs,.20,.79);
    const boxes=[],steps=Math.max(1,Math.ceil(Math.abs(end-begin)*80));
    // Sample the cutting edge continuously between updates. No damage can
    // leak outside the old reach envelope or outside the 20%–79% action window.
    const factor=384/1254,edge=[[201,500],[360,310],[520,265],[690,280]].map(v=>v.map(n=>n*factor));
    for(let i=0;i<=steps;i++){
      const rig=cutRig(mix(begin,end,i/steps)),points=edge.map(v=>weaponPoint(rig,v));
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
    for(const [name,m]of Object.entries(DATA.sheets))s.load.spritesheet('motion-'+name,ROOT+name+'.png?v=0.18.0',
      {frameWidth:m.cell[0],frameHeight:m.cell[1],endFrame:m.frames-1});
    s.load.image('motion-scythe',ROOT+'scythe.png?v=0.18.0');
  }
  class MotionAnimations{
    constructor(s){
      this.scene=s;this.body=[];this.ready=false;this.state=null;
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
      this.body=[0,1].map(()=>s.add.image(0,0,'motion-reaper-run',0).setDepth(12.09)
        .setOrigin(DATA.anchor[0]/DATA.cell[0],DATA.anchor[1]/DATA.cell[1]).setVisible(false));
      this.weapon=s.add.image(0,0,'motion-scythe').setOrigin(DATA.weapon.pivot[0]/384,DATA.weapon.pivot[1]/384)
        .setDepth(12.08).setVisible(false);
      this.trail=s.add.graphics().setDepth(12.07);
      s.events?.once?.('shutdown',()=>this.destroy());
    }
    hide(){for(const v of this.body)v.setVisible(false);this.weapon?.setVisible(false);this.trail?.clear();this.state=null;}
    handlesCut(){
      const s=this.scene,p=s.player;
      return this.ready&&s.visuals?.reviewV2&&!s.lowProfile&&s.powerManager.level('soulCleave')===0&&p.attackMs>0;
    }
    attackBoxes(previousMs){return this.handlesCut()?sweepBoxes(this.scene,previousMs):null;}
    render(){
      this.hide();const s=this.scene,p=s.player;
      if(!this.ready||!p||!s.visuals?.reviewV2||!['playing','paused','rewinding','countdown'].includes(s.state))return;
      if(s.lowProfile||p.sliding||p.airTuck||(p.visualFireMs>0&&p.attackMs<=0)||(p.visualHurtMs||0)>0)return;
      let name,t,scale=.52,loop=false;
      if(p.attackMs>0){if(!this.handlesCut())return;name='reaper-cut-body';t=cutFrame(1-p.attackMs/scope.GRIM_CONFIG.attackDurationMs);scale=.38;}
      else if(!p.grounded||(p.visualLandingMs||0)>0){name='reaper-jump';t=jumpFrame(p);}
      else {name='reaper-run';t=runFrame(p.x-(s.startX||0));loop=true;}
      s.powerArt?.hideBase();s.powerArt?.action?.setVisible(false);
      for(const v of s.combatArt?.reaper||[])v.setVisible(false);
      const rig=name==='reaper-cut-body'?cutRig(1-p.attackMs/scope.GRIM_CONFIG.attackDurationMs):null;
      const f=sample(t,loop),alpha=p.invulMs>0&&Math.floor((s.elapsed||0)/.083333)%2===0?.58:1;
      for(let i=0;i<2;i++){
        const weight=i?f.mix:1-f.mix,v=this.body[i];
        v.setTexture('motion-'+name,i?f.b:f.a).setPosition(p.x+(rig?.bodyX||0),s.feetY).setScale(scale)
          .setAlpha(alpha*weight).setTint(p.slowMs>0?0xb9ecff:0xffffff).setVisible(weight>.001);
      }
      if(name==='reaper-cut-body'){
        const progress=1-p.attackMs/scope.GRIM_CONFIG.attackDurationMs;
        this.weapon.setPosition(p.x+rig.x,s.feetY+rig.y).setRotation(rig.angle)
          .setScale(-DATA.weapon.scale,DATA.weapon.scale).setAlpha(alpha).setTint(p.slowMs>0?0xb9ecff:0xffffff).setVisible(true);
        if(progress>=.20&&progress<=.79){
          const g=this.trail,begin=Math.max(.20,progress-.09);g.lineStyle(2,0xb9f4ea,.35).beginPath();
          for(let i=0;i<8;i++){const tip=weaponPoint(cutRig(mix(begin,progress,i/7)),DATA.weapon.tip);
            if(i===0)g.moveTo(p.x+tip.x,s.feetY+tip.y);else g.lineTo(p.x+tip.x,s.feetY+tip.y);}
          g.strokePath();
        }
      }
      this.state={name,frame:t,phase:loop?t/COUNT:null};
    }
    destroy(){for(const v of this.body)v.destroy();this.body=[];this.weapon?.destroy();this.trail?.destroy();}
  }
  scope.GRIM_MOTION_ART={MotionAnimations,preload,runFrame,jumpFrame,cutFrame,cutRig,weaponPoint,sweepBoxes,sample,STRIDE_PX,LAND_MS};
})(typeof window!=='undefined'?window:globalThis);
