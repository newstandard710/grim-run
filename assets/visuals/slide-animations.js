/* Ground slide paint only. The input and combat systems own low-profile state. */
(function(scope){
  'use strict';
  const KEY='ground-slide-paint',WIDTH=224,HEIGHT=144,COUNT=16;
  const ENTRY=6,BRACE=4,RECOVERY=3,RECOVERY_MS=66;
  const WIDTH_SHEET=WIDTH*4,HEIGHT_SHEET=HEIGHT*4;
  const ART={key:KEY,url:'assets/motion/v01912/ground-slide.webp?v=1',
    width:WIDTH,height:HEIGHT,columns:4,frames:COUNT};
  class GroundSlideAnimations{
    constructor(scene){
      this.scene=scene;
      this.sprite=null;
      this.player=null;
      this.source=null;
      this.previousSlideMs=0;
      this.recoveryAt=null;
      this.painted=false;
      this.fromTuck=false;
      scene.events?.once?.('shutdown',()=>this.sprite?.destroy());
      scope.GRIM_ACTOR_TEXTURES?.load(scene,ART,()=>{});
    }
    chooseSource(){
      const s=this.scene;
      if(!this.sprite&&s.textures?.exists?.(KEY)){
        const texture=s.textures.get(KEY),image=texture.getSourceImage();
        if(image.width===WIDTH_SHEET&&image.height===HEIGHT_SHEET&&
          Array.from({length:COUNT},(_,index)=>index).every(index=>texture.has(index))){
          this.sprite=s.add.image(0,0,KEY,0).setOrigin(180/WIDTH,132/HEIGHT).setDepth(12.09).setVisible(false);
        }
      }
      if(this.sprite)return 'strip';
      return s.visuals?.reaperPoseSprites?.slide?'original':'procedural';
    }
    get rejoinsRun(){
      const s=this.scene,p=s.player;
      return this.player===p&&this.fromTuck&&p.grounded&&!s.lowProfile&&s.state==='playing'&&
        (this.painted||this.recoveryAt!==null);
    }
    draw(frame,runner=null,covered=null){
      const s=this.scene,p=s.player;
      for(const v of Object.values(s.visuals?.reaperPoseSprites||{}))v.setVisible(false);
      s.visuals?.reaper?.setVisible(false);
      runner?.setVisible(false);
      covered?.setVisible(false);
      const forward=scope.GRIM_FORWARD_SCYTHE;
      const recovery=frame-ENTRY-BRACE;
      const rising=runner?.texture.key===forward?.carry.key&&recovery>=0&&recovery%RECOVERY===RECOVERY-1;
      if(rising){
        const art=forward.carry;
        this.sprite.setTexture(art.key,forward.slideRise[Math.floor(recovery/RECOVERY)])
          .setOrigin(art.anchor[0]/art.width,art.anchor[1]/art.height).setScale(forward.scale);
      }else this.sprite.setTexture(KEY,frame).setOrigin(180/WIDTH,132/HEIGHT).setScale(1);
      this.sprite.setPosition(p.x,runner?.y??s.feetY)
        .setAlpha(runner?.alpha??(p.invulMs>0&&Math.floor(s.frame/5)%2===0?.58:1))
        .setTint(p.slowMs>0?0xb9ecff:0xffffff).setVisible(true);
      return 'painted';
    }
    render(sliding,higherAction,tuckLanding){
      const s=this.scene,p=s.player,now=s.elapsed*1000;
      this.sprite?.setVisible(false);
      if(this.player!==p){
        this.player=p;
        this.source=null;
        this.recoveryAt=null;
        this.painted=false;
        this.fromTuck=false;
      }
      if(sliding){
        if(!this.source||p.slideMs<this.previousSlideMs){
          this.source=this.chooseSource();
          this.painted=false;
          this.fromTuck=tuckLanding&&this.source==='strip';
        }
        this.previousSlideMs=p.slideMs;
        this.recoveryAt=null;
        if(higherAction){this.painted=false;return null;}
        if(this.source!=='strip')return this.source;
        // Compress from the first low input frame and then shift the lower
        // cloak and braced legs gently while the world moves beneath them.
        const age=p.slideMs;
        const frame=age<96?Math.min(ENTRY-1,Math.floor(age/16)):
          ENTRY+Math.floor((age-96)/68)%BRACE;
        this.painted=true;
        // The registered tuck contact is the fallback. A ready strip can
        // continue straight into low Slide paint on the contact tick.
        return this.draw(frame,null,tuckLanding?s.motionArt.body[0]:null);
      }
      if(this.source){
        this.source=null;
        this.recoveryAt=this.painted?now:null;
        this.painted=false;
      }
      if(this.recoveryAt===null)return null;
      const age=now-this.recoveryAt,runner=s.motionArt?.body?.[0];
      const texture=runner?.texture.key;
      const forward=scope.GRIM_FORWARD_SCYTHE;
      if(age<0||age>=RECOVERY_MS||s.state!=='playing'||s.lowProfile||higherAction||
         p.attackMs>0||p.visualFireMs>0||p.visualHurtMs>0||!runner?.visible||
         (texture!=='motion-reaper-run-solid'&&texture!==forward?.carry.key)){
        this.recoveryAt=null;
        return null;
      }
      const lead=Math.floor(s.motionArt.state.atlasFrame/48)%2;
      return this.draw(ENTRY+BRACE+lead*RECOVERY+Math.floor(age/22),runner);
    }
  }
  scope.GRIM_SLIDE_ART={GroundSlideAnimations};
})(typeof window!=='undefined'?window:globalThis);
