/* Grim Run — Shared mist formation for surviving falls and portal arrivals. */
(function(scope){
  'use strict';
  const key='reaper-formation-mist';
  const clamp=t=>Math.max(0,Math.min(1,t));
  const ease=t=>{t=clamp(t);return t*t*(3-2*t);};
  const fall=Object.freeze({lock:1500,start:240,duration:900});
  const portal=Object.freeze({lock:1450,start:100,duration:1200});

  function preload(scene){
    scene.load.image(key,'assets/visuals/portal-summit/reaper-mist-v1.webp');
  }

  class ReaperFormation{
    constructor(scene){
      this.scene=scene;
      this.ready=scene.textures?.exists?.(key)&&Boolean(scene.add?.image);
      if(!this.ready)return;
      this.rear=scene.add.image(0,0,key).setDepth(11.9).setVisible(false);
      this.front=scene.add.image(0,0,key).setDepth(14.9).setFlipX(true).setVisible(false);
      scene.events.once('shutdown',()=>{
        this.rear.destroy();this.front.destroy();
        scene.textures.remove(key);
      });
    }

    ownsFall(){
      const s=this.scene;
      return this.ready&&s.state==='respawning'&&s.respawnNextMode==='playing'&&Boolean(s.respawnCamera);
    }

    hide(){
      if(this.rear?.visible)this.rear.setVisible(false);
      if(this.front?.visible)this.front.setVisible(false);
      if(this.proceduralBody){
        this.scene.actor.setAlpha(1);
        this.proceduralBody=false;
      }
    }

    render(){
      const s=this.scene;
      if(!this.ready)return;
      const arriving=s.state==='portal';
      if(!arriving&&!this.ownsFall()){this.hide();return;}
      const sequence=arriving?portal:fall;
      const age=sequence.lock-(arriving?s.portalMs:s.respawnMs);
      const phase=clamp((age-sequence.start)/sequence.duration);
      const {x,y}=s.player;
      const gather=ease(phase/.68);
      const settle=ease((phase-.60)/.40);
      const lastCurl=1-ease((age-sequence.start-sequence.duration)/(sequence.lock-sequence.start-sequence.duration));
      const density=ease(phase/.22)*lastCurl;
      const rearAlpha=density*(.76-.67*settle);
      const frontAlpha=density*(.94-.64*settle);
      this.rear.setPosition(x-43+29*gather,y-51-5*gather+27*settle)
        .setDisplaySize(139-25*gather+14*settle,79+14*gather-52*settle)
        .setRotation(.20-.43*gather).setAlpha(rearAlpha).setVisible(rearAlpha>.003);
      this.front.setPosition(x+42-35*gather,y-45-11*gather+37*settle)
        .setDisplaySize(145-32*gather+23*settle,76+18*gather-63*settle)
        .setRotation(-.24+.48*gather).setAlpha(frontAlpha).setVisible(frontAlpha>.003);

      const reveal=ease((phase-.35)/.65);
      // Reveal one registered body. Let live play own the protection flicker
      // from the first playable frame.
      const visuals=s.visuals;
      const body=visuals?.reaperPoseSprites?.idle?.visible?visuals.reaperPoseSprites.idle:visuals?.reaper;
      if(body?.visible){
        body.setAlpha(reveal).setVisible(reveal>0);
      }else if(!visuals?.reaperReady){
        s.actor.setAlpha(reveal);
        this.proceduralBody=true;
      }
    }
  }

  scope.GRIM_REAPER_FORMATION={preload,ReaperFormation};
})(typeof window!=='undefined'?window:globalThis);
