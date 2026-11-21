/* The contact event belongs to the scene. These drawings use its world point
   and the supporting boot to carry the landing into the distance-driven gait. */
(function(scope){
  'use strict';
  const art=scope.GRIM_LANDING_POSES,run=scope.GRIM_RUN_DATA,carry=scope.GRIM_FORWARD_SCYTHE;
  const clamp=n=>Math.max(0,Math.min(1,n));
  const ease=n=>{const t=clamp(n);return t*t*(3-2*t);};
  const mix=(a,b,t)=>a+(b-a)*t;
  const cycle=run.frames/run.gaitsPerSheet,step=run.pixelsPerGait/cycle;
  const lookAhead=.100,joinDistance=24*step,settledDistance=132;
  function phase(s,x){return (x-s.startX)/step;}
  function ground(s,x,platform){
    if(platform&&x>=platform.x&&x<=platform.x+platform.width)return platform.y;
    return s.terrain.groundAt(x);
  }
  function supportAt(s,platform,x,points){
    let y=Infinity;
    for(const [offset,sole] of points){
      const floor=platform?platform.y:ground(s,x+offset,null);
      if(Number.isFinite(floor))y=Math.min(y,floor-sole);
    }
    return Number.isFinite(y)?y:s.feetY;
  }
  function nearestLead(s,x){
    const current=phase(s,x);
    return Math.round(current/(cycle/2))*(cycle/2);
  }
  function activeAction(s){
    const p=s.player;
    return p.attackMs>0||p.visualFireMs>0||p.hovering||s.motionArt.rising?.sprite?.visible;
  }
  class LandingMotion{
    constructor(scene){
      this.scene=scene;
      this.ready=false;
      this.approach=null;
      this.owner=null;
      if(!scene.add?.image)return;
      const loader=scope.GRIM_ACTOR_TEXTURES;
      let decoded=0;
      for(const sheet of [art.body,art.low,art.steel])loader.load(scene,sheet,()=>{this.ready=++decoded===3;});
    }
    forecast(){
      const s=this.scene,p=s.player;
      let floor=s.terrain.groundAt(p.x);
      let ahead=s.terrain.groundAt(p.x+8);
      let slope=Number.isFinite(floor)&&Number.isFinite(ahead)?(ahead-floor)/8:0;
      const speed=s.speed*(p.slowMs>0?s.powerManager.slowEffect().multiplier:1);
      let platform=null;
      for(const top of s.soulPlatform||[]){
        if(p.velocityY<0||p.y>top.y+2||top.y>(floor??Infinity)||
           p.x+speed*lookAhead+14<top.x||p.x-14>top.x+top.width)continue;
        floor=top.y;slope=0;platform=top;
      }
      if(!Number.isFinite(floor)||p.hovering)return null;
      const closing=p.velocityY-speed*slope;
      const h=Math.max(0,floor-p.y),g=scope.GRIM_CONFIG.gravity;
      const time=(Math.sqrt(closing*closing+2*g*h)-closing)/g;
      if(time>lookAhead||closing<0&&p.jumpAgeMs<50)return null;
      const x=p.x+speed*time;
      if(ground(s,x,platform)==null)return null;
      return {time,x,slope,platform};
    }
    entry(x,vy,slope){
      const s=this.scene,p=s.player,m=s.motionArt;
      const low=p.airTuck||p.holdSlide;
      const lead=nearestLead(s,x);
      let source,load;
      if(low){source='compact';load='soft';}
      else if(m.forwardAir===false){
        source=p.visualTuckReleaseMs>47?'compact':'legacy';
        load=source==='compact'?'soft':vy>605?'drop':'step';
      }else if(vy<220){source='gather';load='soft';}
      else if(vy<335){source='open';load=slope<-.18?'soft':'step';}
      else{source='reach';load=vy>630||slope>.25?'drop':'step';}
      return {source,load,lead,side:((lead%cycle)+cycle)%cycle,
        angle:m.weapon?.visible?m.weapon.rotation:null};
    }
    contact(vy){
      const s=this.scene,p=s.player,m=s.motionArt;
      p.visualTouchdown=null;
      if(!this.ready||!m?.forwardActive||activeAction(s))return;
      const last=this.owner===p?this.approach:null;
      const grade=s.terrain.groundAt(p.x+3)-s.terrain.groundAt(p.x);
      const entry=last&&(!p.holdSlide||last.source==='compact')?last:
        this.entry(p.x,vy,Number.isFinite(grade)?grade/3:0);
      const lead=entry.lead;
      // Store an immutable sample. Rewind's existing player snapshot can
      // reuse it without retaining the renderer or mutating an older frame.
      p.visualTouchdown={...entry,x:p.x,at:s.elapsed,lead,
        contactAngle:m.weapon?.visible?m.weapon.rotation:null,
        held:p.holdSlide,platform:p.onSoulPlatform};
      this.approach=null;
    }
    body(frame,low,x,y){
      const s=this.scene,m=s.motionArt,p=s.player;
      const runner=m.body[0],slide=s.slideArt?.sprite;
      const view=low&&p.sliding&&slide?slide:runner;
      if(slide&&slide!==view)slide.setVisible(false);
      if(view!==runner)runner.setVisible(false);
      const spec=low?art.low:art.body;
      const anchor=low?[170,146]:[105,106];
      const flicker=low||s.lowProfile?Math.floor(s.frame/5):Math.floor(s.elapsed/.083333);
      view.setTexture(spec.key,frame).setOrigin(anchor[0]/spec.width,anchor[1]/spec.height)
        .setPosition(x,y).setScale(1).setAlpha(p.invulMs>0&&flicker%2===0?.58:1)
        .setTint(p.slowMs>0?0xb9ecff:0xffffff).setVisible(true);
      m.weapon.setVisible(false);m.rearOwner=null;
      return view;
    }
    weapon(view,hand,angle,drag){
      const s=this.scene,m=s.motionArt;
      const grip=[view.x+hand[0]-s.player.x,hand[1],angle];
      m.showForwardWeapon(grip,view.y-s.feetY,view.alpha,view.tintTopLeft);
      m.weapon.setScale(-carry.weapon.scale,carry.weapon.scale);
      if(drag)m.weapon.setDepth(.61);
      m.rearOwner=view;
    }
    arrival(entry,t,platform){
      const s=this.scene,p=s.player;
      if(entry.source==='compact'){
        const frame=Math.round(7*t);
        const floor=ground(s,p.x,platform);
        const rise=Number.isFinite(floor)?supportAt(s,platform,p.x,art.lowSoles[7])-floor:0;
        this.body(frame,true,p.x,s.feetY+rise*ease(t));
        return;
      }
      const key=entry.load+entry.side;
      const frame=art.ranges[entry.source+key]+Math.round(t*6);
      const target=art.soles[art.ranges[key]];
      const now=ground(s,p.x,platform);
      const rise=Number.isFinite(now)?supportAt(s,platform,p.x,target)-now:0;
      const view=this.body(frame,false,p.x,p.y+rise*ease(t));
      const hand=art.hands[frame];
      const air=s.motionArt.trailingRotation(p.x+hand[0],view.y+hand[1],false);
      const start=entry.source==='legacy'?.04:entry.angle??air;
      const angle=mix(start,air,ease(t*.76));
      this.weapon(view,hand,angle,false);
    }
    landed(entry,platform){
      const s=this.scene,p=s.player,m=s.motionArt;
      const d=p.x-entry.x,age=(s.elapsed-entry.at)*1000;
      if(entry.source==='compact'&&entry.held){
        if(p.sliding&&age<120){
          const t=clamp(age/120),frame=7+Math.round(9*t);
          const rise=supportAt(s,platform,p.x,art.lowSoles[frame])-p.y;
          this.body(frame,true,p.x,p.y+rise*(1-ease(t)));
        }
        return;
      }
      if(p.sliding)return;
      const key=entry.load+entry.side;
      const offset=phase(s,entry.x)-entry.lead;
      const corrected=entry.lead+d/step+offset*ease((d-joinDistance)/(settledDistance-joinDistance));
      const cell=((Math.floor(corrected)%cycle)+cycle)%cycle;
      if(d>=settledDistance||d<-.01||age<-.01)return;
      if(d>=joinDistance){
        const rise=scope.GRIM_MOTION_ART.runSupportRise(s,p,cell);
        const view=m.body[0];
        view.setTexture(carry.carry.key,cell).setOrigin(carry.carry.anchor[0]/carry.carry.width,
          carry.carry.anchor[1]/carry.carry.height).setPosition(p.x,p.y+rise).setScale(carry.scale).setVisible(true);
        m.showRearCarry(cell,p.y+rise,view.alpha,view.tintTopLeft,view);
        m.state={name:'reaper-run',atlasFrame:cell,phase:cell/cycle,texture:carry.carry.key};
        return;
      }
      const progress=clamp(d/joinDistance);
      const slot=Math.min(12,Math.round(d/(2*step)));
      const unroll=entry.source==='compact'&&slot<8;
      const frame=unroll?art.ranges['rise'+entry.side]+slot:art.ranges[key]+slot;
      // Sub-cell correction keeps the boot on its world point between painted
      // samples. Ease the small correction out as the live gait takes over.
      const x=p.x+(slot*2*step-d)*(1-ease(progress));
      const support=supportAt(s,platform,x,art.soles[frame]);
      const runRise=scope.GRIM_MOTION_ART.runSupportRise(s,p,cell);
      const y=mix(support,p.y+runRise,ease((progress-.65)/.35));
      const view=this.body(frame,false,x,y);
      const hand=art.hands[frame],gx=x+hand[0],gy=y+hand[1];
      const air=m.trailingRotation(gx,gy,false);
      const start=entry.source==='compact'?art.compactAngle:entry.contactAngle??
        (entry.source==='legacy'?mix(.04,air,ease(.76)):air);
      const drag=m.trailingRotation(gx,gy,true);
      this.weapon(view,hand,mix(start,drag,ease(progress)),progress>=.64);
      if(unroll){
        m.weapon.setTexture(art.steel.key,slot).setOrigin(98/art.steel.width,104/art.steel.height).setScale(1);
      }
    }
    render(){
      const s=this.scene,p=s.player,m=s.motionArt;
      if(!this.ready||!m?.forwardActive||!p)return;
      if(this.owner!==p){this.owner=p;this.approach=null;}
      if(!['playing','paused','rewinding','countdown'].includes(s.state)||activeAction(s)){
        this.approach=null;
        if(s.state==='playing')p.visualTouchdown=null;
        return;
      }
      if(!p.grounded){
        p.visualTouchdown=null;
        const next=this.forecast();
        if(!next){this.approach=null;return;}
        if(!this.approach||p.holdSlide&&this.approach.source!=='compact'){
          // Let a release already in progress finish its painted aerial turn.
          if(!p.holdSlide&&!p.airTuck&&p.visualTuckReleaseMs>0)return;
          this.approach=this.entry(next.x,p.velocityY,next.slope);
          this.approach.window=this.approach.source==='legacy'?next.time:lookAhead;
        }
        const t=1-next.time/Math.max(.001,this.approach.window);
        this.arrival(this.approach,clamp(t),next.platform);
      }else if(p.visualTouchdown){
        const entry=p.visualTouchdown;
        if(entry.platform!==p.onSoulPlatform||p.x<entry.x||p.x-entry.x>=settledDistance||
           (p.sliding&&!entry.held)){p.visualTouchdown=null;return;}
        const platform=entry.platform===false?null:s.soulPlatform.find(v=>v.id===entry.platform);
        this.landed(entry,platform);
      }else this.approach=null;
    }
  }
  scope.GRIM_LANDING_MOTION=LandingMotion;
})(typeof window!=='undefined'?window:globalThis);
