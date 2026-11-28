// The portcullis, its seal and the Keeper occupy fixed world positions. Opening
// the gate moves the actual runner and camera through it before Cut can connect.
const times={arrival:1050,warning:1280,sweep:210,seal:1750,recover:670,exposed:1850,struck:740,fall:1450};
const iron=0x302a39,stone=0x665864,copper=0xcb985e,gold=0xffe091,soul=0xb1f6ee;
const courts=['COURT OF IRON','COURT OF BELLS','COURT OF SOULS'];
const clamp=t=>Math.min(1,Math.max(0,t));

export class Gatekeeper {
  constructor(campaign){this.campaign=campaign;this.scene=campaign.scene;}
  prepare(){
    const s=this.scene;
    if(this.prepared)return;
    this.prepared=true;
    for(const key of ['gatekeeper','gatekeeper-shield']){
      if(s.textures.exists(key))continue;
      const source=new Image();
      source.onload=()=>{if(s.sys.isActive()&&!s.textures.exists(key))s.textures.addImage(key,source);};
      source.onerror=()=>{this.prepared=false;};
      source.src=new URL('./'+key+'.webp',import.meta.url).href;
    }
  }
  newGate(x,index,boss=false){
    const s=this.scene,reach=Math.min(138,s.width*.32);
    return {phase:'arrival',ms:0,index,high:boss?index===1:index%2===1,
      second:false,double:boss?index===2:index>=5,anchor:x+reach,standX:x,cycle:0};
  }
  enter(){
    const s=this.scene;
    this.campaign.guardian={...this.newGate(s.player.x,0,true),hp:3,musicStart:s.elapsed,pursuit:false};
    s.player.gate=null;
    s.obstacles=[];s.enemies=[];s.bullets=[];s.fireballs=[];
    for(const tip of s.tips)tip.label.destroy();
    s.tips=[];
  }
  crossing(dt){
    const s=this.scene,p=s.player,i=p.nextGate||0,x=s.forestRoute.gates[i];
    if(!p.gate&&!(p.x>=x))return;
    // Rewind takes shallow player snapshots. Give each frame its own gate state.
    p.gate=p.gate?{...p.gate}:this.newGate(p.x,i);
    if(i===p.gate.index)p.nextGate=i+1;
    this.update(p.gate,dt,false);
  }
  step(dt){this.update(this.campaign.guardian,dt,true);}
  update(g,dt,boss){
    const s=this.scene,p=s.player;
    if(g.phase==='cleared')return;
    g.ms+=dt;
    if(g.phase==='passage'){
      if(p.x<g.standX-1)return;
      if(boss){g.phase='exposed';g.ms=0;}
      else p.gate=null;
      return;
    }
    if(g.ms<times[g.phase])return;
    g.ms=0;
    switch(g.phase){
      case 'struck':
        Object.assign(g,this.newGate(p.x,3-g.hp,true));
        break;
      case 'arrival':case 'recover':
        g.phase='warning';g.high=g.index%2===1;g.second=false;g.cycle++;break;
      case 'warning':{
        g.phase='sweep';
        const lane=s.terrain.anchorAt(p.x)-(g.high?55:14);
        const hit=window.GRIM_CORE.collisionBox(p.x,s.feetY,s.lowProfile);
        g.missed=hit.y<lane+4&&hit.y+hit.height>lane-4;
        if(g.missed&&p.invulMs<=0&&!s.graveRush){
          p.invulMs=window.GRIM_CONFIG.damageInvulnerabilityMs;
          s.takeDamage(1,'gate sweep');
        }
        break;
      }
      case 'sweep':
        if(g.missed)g.phase='recover';
        else if(g.double&&!g.second){g.high=!g.high;g.second=true;g.phase='warning';}
        else g.phase='seal';
        break;
      case 'seal':g.phase='recover';break;
      case 'exposed':
        // The Keeper retreats to the *next* gate. Another opening can be earned.
        Object.assign(g,this.newGate(p.x,3-g.hp,true));break;
      case 'fall':g.phase='cleared';break;
    }
  }
  target(){
    const s=this.scene,g=this.campaign.guardian||s.player.gate;
    if(g?.phase!=='seal')return null;
    return {x:g.anchor,y:s.terrain.anchorAt(g.anchor)-83,kind:'seal',id:g.anchor+':'+g.cycle};
  }
  strike(aim){
    if(this.target()?.id!==aim.id)return;
    const s=this.scene,b=this.campaign.guardian;
    const g=b||(s.player.gate={...s.player.gate});
    g.phase='passage';g.ms=0;g.standX=g.anchor+27;
    s.puff(aim.x,aim.y,soul,12);window.GRIM_ACTION_AUDIO?.play('knot');
  }
  cut(hits){
    const b=this.campaign.guardian;
    if(b?.phase!=='exposed')return;
    const x=b.anchor+83,y=this.scene.terrain.anchorAt(x)-50;
    if(!hits({x:x-16,y:y-22,width:32,height:44}))return;
    b.hp--;b.phase=b.hp?'struck':'fall';b.ms=0;
    this.scene.puff(x,y,gold,12);window.GRIM_ACTION_AUDIO?.play('impact');
  }
  hide(){this.body?.setVisible(false);this.shield?.setVisible(false);this.ink?.setVisible(false);this.label?.setVisible(false);}
  render(){
    const s=this.scene,b=this.campaign.guardian;
    if(!this.campaign.active){this.hide();return;}
    let state=b||s.player?.gate;
    if(!state){
      const trigger=s.forestRoute?.gates[s.player?.nextGate||0];
      const anchor=trigger+Math.min(138,s.width*.32);
      if(!(anchor<=s.cameraX+s.width+36)){this.hide();return;}
      state={phase:'approach',ms:0,anchor};
    }
    if(!this.ink){
      this.ink=s.add.graphics().setDepth(7.8);
      this.label=s.add.text(0,0,'',{fontFamily:'Georgia, serif',fontSize:'14px',fontStyle:'bold',
        color:'#fff5db',stroke:'#161322',strokeThickness:4}).setOrigin(.5,1).setDepth(12);
    }
    const g=this.ink.setVisible(true).clear(),{phase,ms,anchor:x,high}=state;
    const floor=s.terrain.anchorAt(x),opened=['exposed','struck','fall','cleared'].includes(phase)?1:phase==='passage'?clamp(ms/330):0;
    // Heavy jambs and an iron grille. The teeth rise from the floor when hit.
    for(const offset of [-27,27]){
      const a=x+offset;
      g.fillStyle(iron).fillRect(a-8,floor-130,16,132);
      for(let i=0;i<6;i++){
        g.fillStyle(i%2?0x776571:0x514551).fillRect(a-7,floor-21*i-19,13,17);
        g.fillStyle(0x352e3c).fillTriangle(a+6,floor-21*i-19,a+6,floor-21*i-2,a+2,floor-21*i-3);
        g.lineStyle(1,0xa99191,.6).lineBetween(a-6,floor-21*i-17,a-6,floor-21*i-5);
        g.lineStyle(1,copper,.56).lineBetween(a-7,floor-21*i-19,a+5,floor-21*i-19);
      }
      g.fillStyle(stone).fillTriangle(a-13,floor-123,a,floor-148,a+13,floor-123);
    }
    g.fillStyle(iron).fillRect(x-34,floor-131,68,12);
    g.lineStyle(2,copper).lineBetween(x-33,floor-128,x+33,floor-128);
    for(let i=-2;i<=2;i++){
      const top=x+i*12,h=12-Math.abs(i)*2;
      g.fillStyle(stone).fillTriangle(top-6,floor-131,top,floor-132-h,top+6,floor-131);
      g.lineStyle(1,copper).lineBetween(top-6,floor-131,top,floor-132-h);
    }
    const tip=floor-4-opened*106;
    for(let i=-2;i<=2;i++){
      const a=x+i*9;
      g.fillStyle(0x92808a).fillRect(a-2,floor-120,4,Math.max(0,tip-floor+112));
      g.fillStyle(copper).fillTriangle(a-4,tip-9,a+4,tip-9,a,tip);
    }
    const sealY=floor-83-opened*30;
    g.fillStyle(iron).fillCircle(x,sealY,12);
    g.lineStyle(2,phase==='seal'?soul:copper).strokeCircle(x,sealY,11);
    if(phase==='seal'){
      g.lineStyle(2,gold).strokeCircle(x,sealY,17+2*Math.sin(ms/95));
      g.fillStyle(soul).fillTriangle(x,sealY-7,x-5,sealY+4,x+5,sealY+4);
    }
    this.body?.setVisible(false);this.shield?.setVisible(false);
    if(b)this.drawKeeper(g,x+83,s.terrain.anchorAt(x+83),phase,ms);
    if(phase==='warning'||phase==='sweep'){
      const y=s.terrain.anchorAt(s.player.x)-(high?55:14),left=s.cameraX;
      if(phase==='warning'){
        for(let at=left;at<x;at+=20)g.lineStyle(2,gold,.8).lineBetween(at,y,Math.min(x,at+10),y);
        const direction=high?1:-1,ax=s.player.x+40;
        g.lineStyle(3,soul).beginPath().moveTo(ax-7,y+direction*6).lineTo(ax,y+direction*15).lineTo(ax+7,y+direction*6).strokePath();
        g.lineStyle(2,gold).strokeCircle(x,y,4+14*(1-clamp(ms/times.warning)));
      }else{
        g.lineStyle(10,iron).lineBetween(left,y,x,y);
        g.lineStyle(4,gold).lineBetween(left,y,x,y);
      }
    }
    const cue=phase==='arrival'?(b?'THE GATEKEEPER':courts[state.index<2?0:state.index<4?1:2]):
      phase==='warning'?(high?'HIGH SWEEP · SLIDE':'LOW SWEEP · JUMP'):phase==='seal'?'EXPOSED SEAL · SHOOT':
      phase==='exposed'?'KEEPER EXPOSED · CUT':phase==='passage'?'GATE OPEN':'';
    const lx=Math.max(s.cameraX+88,Math.min(x,s.cameraX+s.width-94)),ly=Math.max(s.renderCameraY+77,floor-152);
    this.label.setVisible(Boolean(cue)).setText(cue).setPosition(lx,ly);
    if(b)for(let i=0;i<3;i++)g.fillStyle(i<b.hp?gold:iron).fillRect(lx-22+i*16,ly+3,12,4);
  }
  drawKeeper(g,x,y,phase,ms){
    const fall=phase==='fall'?clamp(ms/times.fall):0;
    const exposed=['exposed','struck','fall'].includes(phase);
    const s=this.scene;
    if(s.textures.exists('gatekeeper')&&s.textures.exists('gatekeeper-shield')){
      if(!this.body){
        this.body=s.add.image(0,0,'gatekeeper').setDepth(7.6).setOrigin(.5,254/280);
        this.shield=s.add.image(0,0,'gatekeeper-shield').setDepth(7.7).setOrigin(.5,254/280);
      }
      const recoil=phase==='struck'?Math.sin(Math.PI*clamp(ms/times.struck))*8:0;
      this.body.setVisible(true).setPosition(x+recoil,y).setScale(.61).setRotation(fall*1.22).setAlpha(1-fall*.8);
      this.shield.setVisible(true).setPosition(x+recoil+(exposed?34:0),y+(exposed?5:0))
        .setScale(.61).setRotation(fall*1.35).setAlpha(1-fall*.8);
      if(phase==='exposed'){
        g.lineStyle(2,gold,.9).strokeCircle(x-3,y-54,11+2*Math.sin(ms/110));
        g.fillStyle(soul).fillCircle(x-3,y-54,4);
      }
      return;
    }
    // Outline fallback while the painted armour is loading.
    g.save().translateCanvas(x,y).rotateCanvas(fall*.98);
    g.fillStyle(0x241e2a).fillTriangle(-9,-96,-29,-1,28,-4);
    g.fillStyle(0x675166).fillTriangle(3,-90,15,-65,25,-9);
    for(const side of [-1,1]){
      g.fillStyle(0x524857).fillRect(side*9-5,-38,10,34);
      g.fillStyle(iron).fillRect(side*10-8,-7,17,7);
      g.fillStyle(stone).fillTriangle(side*8,-88,side*28,-72,side*16,-59);
    }
    g.fillStyle(0x9c857c).fillTriangle(-17,-77,18,-77,2,-38);
    g.fillStyle(iron).fillTriangle(-17,-76,2,-38,-9,-42);
    g.fillStyle(0x453d4d).fillEllipse(0,-92,28,31);
    g.lineStyle(3,soul).lineBetween(-11,-93,1,-95);
    g.fillStyle(copper).fillTriangle(-14,-104,-16,-123,-4,-109);
    g.fillStyle(gold).fillTriangle(-5,-105,1,-126,7,-104);
    g.fillStyle(copper).fillTriangle(5,-105,17,-119,14,-101);
    const shield=exposed?21:-12;
    g.fillStyle(iron).fillRoundedRect(shield-12,-77,24,43,5);
    g.lineStyle(2,copper).strokeRoundedRect(shield-12,-77,24,43,5);
    if(exposed){g.fillStyle(gold).fillCircle(-3,-54,7);g.lineStyle(2,soul).strokeCircle(-3,-54,12);}
    g.restore();
  }
}
