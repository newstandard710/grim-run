/* Grim Run — Stone gates and the distant Tundra summit sky. */
(function(scope){
  'use strict';
  const gateKey='portal-stone-gate';
  const skyKey='tundra-summit-stars';
  const gateCell={frameWidth:144,frameHeight:176};
  const skyStart=2480,skyEnd=4200;
  const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};

  function preload(scene){
    scene.load.spritesheet(gateKey,'assets/visuals/portal-summit/stone-gate-v1.webp',gateCell);
    scene.load.image(skyKey,'assets/visuals/portal-summit/summit-stars-v1.webp');
  }

  class PortalSummitArt{
    constructor(scene){
      this.scene=scene;
      const textures=scene.textures;
      this.ready=Boolean(scene.add?.image&&textures?.exists?.(skyKey)&&textures.exists(gateKey)&&
        [0,1,2].every(frame=>textures.get(gateKey).has(frame)));
      if(!this.ready)return;
      this.sky=scene.add.image(0,0,skyKey).setScrollFactor(0).setDepth(-31).setVisible(false);
      this.aperture=scene.add.image(0,0,gateKey,1).setOrigin(.5,172/gateCell.frameHeight).setDepth(1.82).setVisible(false);
      this.gate=scene.add.image(0,0,gateKey,0).setOrigin(.5,172/gateCell.frameHeight).setDepth(1.83).setVisible(false);
      this.overlay=scope.document.getElementById('portal-overlay');
      scene.events.once('shutdown',()=>{
        this.sky.destroy();this.aperture.destroy();this.gate.destroy();
        textures.remove(gateKey);textures.remove(skyKey);
      });
    }

    hideGate(){
      if(this.gate?.visible){this.gate.setVisible(false);this.aperture.setVisible(false);}
    }

    hide(){
      this.hideGate();
      if(this.sky?.visible)this.sky.setVisible(false);
    }

    drawGate(){
      if(!this.ready)return;
      const s=this.scene,underworld=s.hasTeleported;
      const x=underworld?s.terrain.portalExitX-60:s.terrain.portalX-12;
      if(x+64<s.cameraX||x-64>s.cameraX+s.width){this.hideGate();return;}
      const y=s.terrain.groundAt(x)??s.terrain.anchorAt(x);
      const frame=underworld?2:1;
      if(this.aperture.frame.name!==frame)this.aperture.setFrame(frame);
      this.aperture.setPosition(x,y).setVisible(true);
      this.gate.setPosition(x,y).setVisible(true);
    }

    drawSky(tundra){
      if(!this.ready)return;
      const s=this.scene;
      if(s.hasTeleported||!tundra?.visible||s.distance<=skyStart){
        if(this.sky.visible)this.sky.setVisible(false);
        return;
      }
      const mix=ease((s.distance-skyStart)/(skyEnd-skyStart));
      if(this.sky.displayWidth!==tundra.displayWidth||this.sky.displayHeight!==tundra.displayHeight)
        this.sky.setDisplaySize(tundra.displayWidth,tundra.displayHeight);
      this.sky.setPosition(tundra.x,s.height*.5).setVisible(true);
      tundra.setAlpha(1-mix).setVisible(mix<1);
      tundra.y+=s.height*.10*mix;
    }

    drawOverlay(){
      if(!this.ready||this.scene.state!=='portal')return;
      const age=1450-this.scene.portalMs;
      this.overlay.style.setProperty('--portal-veil',1-ease((age-100)/260));
      this.overlay.style.setProperty('--portal-heading',1-ease((age-100)/180));
    }
  }

  scope.GRIM_PORTAL_SUMMIT={preload,PortalSummitArt};
})(typeof window!=='undefined'?window:globalThis);
