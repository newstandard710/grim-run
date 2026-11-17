/* The Reaper's reaction poses use the playing and defeat clocks owned by the scene. */
(function(scope){
  'use strict';
  const DATA=scope.GRIM_DEFEAT_DATA;
  const KEY='combat-reaper-defeat';
  const URL='assets/combat/v0201/reaper-defeat.webp?v=1';
  const HURT_MS=340;
  const clamp=(n,min=0,max=1)=>Math.max(min,Math.min(max,n));
  const mix=(a,b,t)=>a+(b-a)*t;
  const ease=u=>{const t=clamp(u);return t*t*(3-2*t);};
  const visible=v=>v?.visible&&v.alpha>0;
  const LIVE=['playing','paused','rewinding'];
  const DEFEAT=['dying','revive','dead'];
  function preload(scene){
    if(!DATA||!scene.load?.spritesheet)return;
    scene.load.spritesheet(KEY,URL,{frameWidth:DATA.width,frameHeight:DATA.height,endFrame:DATA.frames-1});
  }
  function ready(scene){
    if(!DATA||!scene.textures.exists(KEY))return false;
    const texture=scene.textures.get(KEY),image=texture.getSourceImage();
    return image?.width===DATA.width*DATA.columns&&image.height===DATA.height*Math.ceil(DATA.frames/DATA.columns)&&
      Array.from({length:DATA.frames},(_,i)=>texture.has(i)).every(Boolean);
  }
  function takePose(sprite,x,y){
    if(!visible(sprite))return null;
    return {key:sprite.texture.key,frame:sprite.frame.name,originX:sprite.originX,originY:sprite.originY,
      sx:sprite.scaleX,sy:sprite.scaleY,dx:sprite.x-x,dy:sprite.y-y,
      rotation:sprite.rotation,flip:!!sprite.flipX,tint:sprite.tintTopLeft};
  }
  function place(view,pose,x,y,angle,alpha){
    view.setTexture(pose.key,pose.frame).setOrigin(pose.originX,pose.originY)
      .setPosition(x,y).setScale(pose.sx,pose.sy).setRotation(angle).setFlipX(pose.flip)
      .setAlpha(alpha).setVisible(true);
    if(pose.tint!==undefined)view.setTint(pose.tint);
    else view.clearTint();
  }
  function atlasFrame(track,age){
    const times=track==='low'?DATA.lowTimes:DATA.times;
    let i=1;
    while(i<times.length&&age>times[i])i++;
    if(i===times.length||age-times[i-1]<times[i]-age)i--;
    return DATA.poses[track][i];
  }
  class ReaperReaction{
    constructor(scene){
      this.scene=scene;this.defeat=null;this.impactParticles=null;this.active=false;
      this.reduced=scope.matchMedia?.('(prefers-reduced-motion: reduce)');
      this.ready=ready(scene);
      if(!this.ready){
        console.error('Grim Run: required Reaper defeat art failed validation',URL);
        return;
      }
      const image=depth=>scene.add.image(0,0,KEY,0).setDepth(depth).setVisible(false);
      this.body=image(12.12);
      this.weapon=image(12.11);
      this.effects=scene.add.graphics().setDepth(12.17);
      scene.events.once('shutdown',()=>{
        this.body.destroy();this.weapon.destroy();this.effects.destroy();
      });
    }
    liveBody(){
      const s=this.scene;
      const slide=s.slideArt?.sprite,motion=s.motionArt?.body?.[0],combat=s.combatArt?.reaper?.[0],
        action=s.powerArt?.action,base=s.visuals?.reaper;
      if(visible(slide))return slide;
      if(visible(s.motionArt?.rising?.sprite)&&!s.player.visualFireMs)return s.motionArt.rising.sprite;
      if(visible(motion))return motion;
      if(visible(combat))return combat;
      if(visible(action))return action;
      if(visible(base))return base;
      const illustrated=s.visuals?.reaperPoseSprites;
      for(const pose in illustrated)if(visible(illustrated[pose]))return illustrated[pose];
      return null;
    }
    reset(){
      this.defeat=null;this.impactParticles=null;this.active=false;
      this.body?.setVisible(false);this.weapon?.setVisible(false);this.effects?.clear();
    }
    finishDefeat(){
      this.defeat=null;this.active=false;this.body?.setVisible(false);this.weapon?.setVisible(false);this.effects?.clear();
    }
    beginDefeat(kind,lipX,impactStart){
      if(!this.ready)return;
      const s=this.scene,p=s.player;
      this.impactParticles=Number.isInteger(impactStart)?new Set(s.particles.slice(impactStart,impactStart+9)):null;
      const moved=Number.isFinite(lipX);
      const low=s.lowProfile;
      const floor=s.terrain.groundAt(p.x);
      let support=p.grounded?p.y:Number.isFinite(floor)&&floor>=p.y?floor:null;
      if(!p.grounded){
        for(const ledge of s.soulPlatform||[]){
          if(p.x>=ledge.x&&p.x<=ledge.x+ledge.width&&ledge.y>=p.y&&(support===null||ledge.y<support))support=ledge.y;
        }
      }
      const phase=scope.GRIM_MOTION_ART?.runAtlasFrame(p.x-s.startX)||0;
      const track=low?'low':!p.grounded?'air':phase%96<48?'near':'far';
      const view=this.liveBody();
      const entry=takePose(view,p.x,p.y);
      const weaponView=s.motionArt?.rearWeaponFor?.(view)||(view===s.motionArt?.body?.[0]?s.motionArt.weapon:null);
      const weapon=takePose(weaponView,p.x,p.y);
      const gap=s.terrain.segments?.find(v=>v.kind==='gap'&&p.x>=v.start&&p.x<=v.end);
      // Fall clear of a foreground rock that would cover the final head and
      // hand. The visual anchor moves on the same terrain; the player stays put.
      const recoil=p.grounded&&p.onSoulPlatform===false&&kind==='rock'&&
        s.obstacles.some(ob=>ob.type==='rock'&&ob.dealtDamage&&Math.abs(ob.x-p.x)<35)&&
        Number.isFinite(s.terrain.groundAt(p.x-29))?-29:0;
      this.defeat={x:p.x,y:p.y,support,track,entry,weapon,recoil,
        void:moved||support===null,lip:moved?lipX:null,
        fogX:moved?lipX-9:Math.min(p.x,gap?.end??p.x)};
    }
    resize(dy){
      if(!this.defeat)return;
      this.defeat.y+=dy;
      if(this.defeat.support!==null)this.defeat.support+=dy;
    }
    impactAlpha(p){
      if(!this.impactParticles?.has(p))return 1;
      if(!this.defeat)return 0;
      return this.reduced?.matches?0:1-ease(this.scene.deathPoseMs/350);
    }
    hideLiveBody(){
      const s=this.scene;
      s.powerArt?.hideBase();
      s.powerArt?.action?.setVisible(false);s.powerArt?.weapon?.setVisible(false);
      s.visuals?.reaper?.setVisible(false);s.actor?.clear();
      for(const v of s.combatArt?.reaper||[])v.setVisible(false);
    }
    renderDefeat(age){
      const s=this.scene,d=this.defeat;
      this.hideLiveBody();
      const still=this.reduced?.matches;
      if(d.lip!==null){
        if(!still){
          const edge=s.terrain.anchorAt(d.lip);
          this.renderAsh(d.fogX,edge+4,age,1.4,true);
          const fall=ease(age/630),alpha=(1-fall)*ease((age+36)/100);
          // A falling charcoal wake marks the void below the lip. The
          // recovery bank stays empty until the actual resurrection.
          if(alpha>0){
            const x=d.fogX-10-24*fall,y=edge+8+53*fall;
            this.effects.fillStyle(0x241d28,.52*alpha).fillEllipse(x,y,43+fall*31,13+fall*19);
            this.effects.fillStyle(0x53474c,.32*alpha).fillEllipse(x-8,y+11,35+fall*27,10+fall*18);
            this.effects.fillStyle(0xa3949a,.2*alpha).fillEllipse(x+9,y-4,25,7);
          }
        }
        return;
      }
      const grounded=d.support===d.y, x=d.x+d.recoil*(still?1:ease((age-120)/560));
      const fallMs=grounded?1:clamp(180+Math.sqrt(Math.max(0,(d.support??d.y+145)-d.y))*22,220,530);
      const fall=ease((age-70)/fallMs);
      const ledgeY=d.recoil&&s.terrain.groundAt(x);
      const y=grounded&&Number.isFinite(ledgeY)&&d.recoil?ledgeY:
        still?(d.support??d.y):mix(d.y,d.support??d.y+190,fall);
      if(d.void&&(still||age>640)){
        if(!still)this.renderAsh(d.fogX,y-46,age,.6,true);
        return;
      }
      if(!still&&d.entry&&age<65){
        const recoil=-.10*Math.sin(Math.PI*age/130),pose=d.entry;
        place(this.body,pose,x+pose.dx,y+pose.dy,pose.rotation+recoil,1);
        if(d.weapon){
          const weapon=d.weapon,dx=weapon.dx-pose.dx,dy=weapon.dy-pose.dy;
          place(this.weapon,weapon,x+pose.dx+dx*Math.cos(recoil)-dy*Math.sin(recoil),
            y+pose.dy+dx*Math.sin(recoil)+dy*Math.cos(recoil),weapon.rotation+recoil,1);
        }
        return;
      }
      const poseAge=still?1920:grounded?age:age<fallMs?age/fallMs*385:385+(age-fallMs);
      const atlas=atlasFrame(d.track,poseAge);
      const left=s.terrain.groundAt(x-27),right=s.terrain.groundAt(x+27);
      const onSlope=d.support!==null&&Number.isFinite(left)&&Number.isFinite(right)&&
        Math.abs(d.support-(s.terrain.groundAt(x)??Infinity))<2;
      const slope=(onSlope||d.recoil&&Number.isFinite(left)&&Number.isFinite(right))?clamp(Math.atan2(right-left,54),-.34,.34):0;
      this.body.setTexture(KEY,atlas).setOrigin(DATA.anchor[0]/DATA.width,DATA.anchor[1]/DATA.height)
        .setPosition(x,y).setScale(1).setRotation(slope*(still?1:ease((age-190)/500)))
        .setFlipX(false).setAlpha(1).clearTint().setVisible(true);
      if(!still)this.renderAsh(x+34,y-4,age,.65,false);
    }
    renderAsh(x,y,age,weight,voidFall){
      const start=voidFall?80:480,end=voidFall?940:1680;
      if(age<=start||age>=end)return;
      const t=(age-start)/(end-start),alpha=Math.sin(Math.PI*t)*weight;
      for(let i=0;i<5;i++){
        const dx=(i-2)*(voidFall?11:7)*(1+t);
        const drift=(voidFall?38:-20)*t+(i%2?7:0);
        this.effects.fillStyle(i%2?0xa1a0a5:0x65707c,alpha*(.10-i*.009))
          .fillEllipse(x+dx+18*t,y+drift,13+i*4+t*26,6+i*2+t*7);
      }
    }
    renderHurt(p){
      const s=this.scene,age=HURT_MS-p.visualHurtMs;
      const low=s.lowProfile,air=!p.grounded;
      const impact=ease((age+9)/44)*(1-ease((age-47)/102));
      const catchUp=ease((age-95)/72)*(1-ease((age-180)/145));
      // Existing attacks retain their actor, registered blade, muzzle, and arc.
      const action=p.attackMs>0||p.visualFireMs>0;
      const view=this.liveBody();
      const wings=air&&(s.powerArt?.wingSprites?.some(visible)||s.powerArt?.nearWings?.some(visible));
      if(!action&&!wings&&visible(view)&&!this.reduced?.matches){
        const angle=(low?-.13:air?-.24:-.22)*impact+(low?.036:air?.08:.065)*catchUp;
        const gait=s.motionArt?.state;
        const support=gait?.name==='reaper-run'?scope.GRIM_RUN_DATA?.supportX?.[gait.atlasFrame]:null;
        const foot=low?22:typeof support==='number'?support:0;
        const anchorX=p.x+(air?0:foot),anchorY=air?p.y-(low?27:44):view.y;
        const dx=view.x-anchorX,dy=view.y-anchorY,cos=Math.cos(angle),sin=Math.sin(angle);
        this.body.setTexture(view.texture.key,view.frame.name).setOrigin(view.originX,view.originY)
          .setPosition(anchorX+dx*cos-dy*sin,anchorY+dx*sin+dy*cos)
          .setScale(view.scaleX,view.scaleY).setRotation(view.rotation+angle)
          .setFlipX(view.flipX).setAlpha(p.invulMs>0&&Math.floor(s.frame/5)%2===0?.58:1)
          .setTint(view.tintTopLeft).setVisible(true);
        const attached=s.motionArt?.rearWeaponFor?.(view);
        const weapon=takePose(attached,anchorX,anchorY);
        if(weapon){
          const x=anchorX+weapon.dx*cos-weapon.dy*sin,y=anchorY+weapon.dx*sin+weapon.dy*cos;
          const rotation=s.motionArt.clearRearRecoil(x,y,weapon.rotation+angle);
          place(this.weapon,weapon,x,y,rotation,this.body.alpha);
          s.motionArt.hideRearCarry();
        }
        view.setVisible(false);
      }
      const accent=(1-ease(age/117))*ease((age+12)/28);
      if(accent>0)this.effects.fillStyle(0xb49387,.25*accent)
        .fillEllipse(p.x-(low?14:17)-age*.055,p.y-(low?21:air?47:55),9+age*.12,6+age*.05);
    }
    render(){
      if(!this.ready)return;
      const s=this.scene,p=s.player;
      const dying=this.defeat&&DEFEAT.includes(s.state),hurt=p?.visualHurtMs>0&&LIVE.includes(s.state);
      if(this.active){this.body.setVisible(false);this.weapon.setVisible(false);this.effects.clear();}
      this.active=Boolean(dying||hurt);
      if(dying)this.renderDefeat(s.deathPoseMs);
      else if(hurt)this.renderHurt(p);
    }
  }
  scope.GRIM_REAPER_REACTION={ReaperReaction,preload,HURT_MS};
})(typeof window!=='undefined'?window:globalThis);
