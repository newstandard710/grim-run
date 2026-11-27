// Timers use simulation time. The approach stores its marker and phase on the
// player, and the arena stores its source and destination in the guardian frame.
const TRAVEL=1380, ERUPT=340, SHORT_OPEN=1050, LONG_OPEN=2150;
const lengths={arrival:1450,travel:TRAVEL,erupt:ERUPT,open:SHORT_OPEN,stunned:LONG_OPEN,recover:600,struck:700,fall:1400};
const clamp=n=>Math.max(0,Math.min(1,n));
const mix=(a,b,t)=>a+(b-a)*clamp(t);
const coal=0x302633,iron=0x66515a,copper=0xba7750,amber=0xffb05c,white=0xffedd0;

function brazier(g,x,y,lit){
  g.fillStyle(coal).fillRoundedRect(x-15,y-5,30,5,2);
  g.fillStyle(iron).fillRect(x-4,y-21,8,17);
  g.fillStyle(coal).fillTriangle(x-20,y-27,x+20,y-27,x,y-10);
  g.fillStyle(copper).fillTriangle(x-16,y-25,x+15,y-25,x-2,y-16);
  g.fillStyle(coal).fillEllipse(x,y-27,41,9);
  g.lineStyle(2,lit?amber:copper).strokeEllipse(x,y-27,40,9);
  if(lit)g.fillStyle(amber).fillEllipse(x,y-28,19,5);
}

function wraith(g,x,y,size,time,boss){
  g.save().translateCanvas(x,y).scaleCanvas(size,size);
  // Torn mantle, porcelain face and a hollow furnace under the ribs.
  for(const side of [-1,1]){
    const drift=Math.sin(time*5+side)*4;
    g.fillStyle(0x493742).fillTriangle(side*12,-17,side*28,4,side*(19+drift),34);
    g.fillStyle(coal).fillTriangle(side*16,-8,side*19,13,side*(9+drift),40);
    g.lineStyle(2,copper,.8).lineBetween(side*14,-6,side*20,9);
    if(boss){
      g.fillStyle(iron).fillTriangle(side*8,-19,side*27,-43,side*19,-12);
      g.lineStyle(2,amber).lineBetween(side*12,-23,side*26,-40);
    }
  }
  g.fillStyle(coal).fillEllipse(0,-5,35,47);
  g.fillStyle(0x978781).fillTriangle(-12,-17,11,-20,2,1);
  g.fillStyle(0xd9c3a2).fillTriangle(-10,-18,0,-22,2,-2);
  g.lineStyle(3,coal).lineBetween(-8,-13,6,-13);
  g.fillStyle(white).fillCircle(4,-13,2);
  g.fillStyle(amber).fillEllipse(0,11,10,13);
  for(let i=0;i<3;i++)g.lineStyle(2,iron).lineBetween(-9,4+i*5,7,8+i*4);
  g.restore();
}

export class CinderKeeper {
  constructor(campaign){this.campaign=campaign;this.scene=campaign.scene;}
  crossing(dt){
    const s=this.scene,p=s.player,index=p.nextEmber??0;
    if(!p.ashPhase){
      if(!(p.x>=s.forestRoute.embers[index]))return;
      p.nextEmber=index+1;p.ashPhase='travel';p.ashMs=0;
    }
    p.ashMs+=dt;
    if(p.ashPhase==='travel'&&p.ashMs>=TRAVEL){
      p.ashPhase='erupt';p.ashMs-=TRAVEL;this.erupt();
    }else if(p.ashPhase==='erupt'&&p.ashMs>=ERUPT)p.ashPhase=null;
  }
  erupt(){
    const s=this.scene,p=s.player,floor=s.terrain.anchorAt(p.x);
    s.puff(p.x,floor-6,amber,7);window.GRIM_ACTION_AUDIO?.play('impact');
    if(s.feetY>floor-31&&p.invulMs<=0&&!s.graveRush){
      p.invulMs=window.GRIM_CONFIG.damageInvulnerabilityMs;s.takeDamage(1,'wraith eruption');
    }
  }
  enter(){
    const s=this.scene;
    this.campaign.guardian={phase:'arrival',ms:0,hp:3,cycle:0,standX:s.player.x+62,musicStart:s.elapsed};
    s.player.ashPhase=null;s.obstacles=[];s.enemies=[];s.bullets=[];s.fireballs=[];
    for(const tip of s.tips)tip.label.destroy();
    s.tips=[];
  }
  step(dt){
    const b=this.campaign.guardian;
    if(b.phase==='cleared')return;
    b.ms+=dt;
    if(b.ms<lengths[b.phase])return;
    b.ms-=lengths[b.phase];
    switch(b.phase){
      case 'arrival':case 'recover':case 'struck':b.phase='travel';break;
      case 'travel':b.phase='erupt';this.erupt();break;
      case 'erupt':b.phase='open';break;
      case 'stunned':case 'open':b.cycle++;b.phase='recover';break;
      case 'fall':b.phase='cleared';break;
    }
  }
  vessel(slot){
    const s=this.scene,b=this.campaign.guardian;
    return b.standX+[-Math.min(63,s.width*.14),55,Math.min(174,s.width*.38)][slot];
  }
  ember(){
    const s=this.scene,b=this.campaign.guardian,p=s.player;
    const t=(b?b.ms:p.ashMs)/TRAVEL;
    const x=b?mix(this.vessel(b.cycle%3),this.vessel((b.cycle+1)%3),t):
      p.x+mix(Math.min(192,s.width*.44),0,t);
    return {x,y:s.terrain.anchorAt(x)-10-5*Math.sin(Math.PI*clamp(t))};
  }
  target(){
    const b=this.campaign.guardian,p=this.scene.player;
    if((b?.phase??p.ashPhase)!=='travel')return null;
    return {...this.ember(),kind:'ember',id:b?'brazier-'+b.cycle:'wraith-'+p.nextEmber};
  }
  strike(aim){
    if(aim.id!==this.target()?.id)return;
    this.scene.puff(aim.x,aim.y,white,10);window.GRIM_ACTION_AUDIO?.play('knot');
    const b=this.campaign.guardian;
    if(b){b.emergeX=aim.x;b.phase='stunned';b.ms=0;}
    else this.scene.player.ashPhase=null;
  }
  keeper(){
    const b=this.campaign.guardian,source=this.vessel((b.cycle+1)%3);
    const x=mix(b.phase==='stunned'?b.emergeX:source,b.standX+59,b.ms/220);
    return {x,y:this.scene.terrain.anchorAt(x)-48};
  }
  cut(hits){
    const b=this.campaign.guardian;
    if(!b||!['stunned','open'].includes(b.phase))return;
    const {x,y}=this.keeper();
    if(!hits({x:x-16,y:y-23,width:32,height:46}))return;
    this.scene.puff(x,y,amber,14);window.GRIM_ACTION_AUDIO?.play('impact');
    b.hp--;b.cycle++;b.ms=0;b.phase=b.hp?'struck':'fall';
  }
  hide(){this.ink?.setVisible(false);this.label?.setVisible(false);}
  render(){
    const s=this.scene,b=this.campaign.guardian,p=s.player,phase=b?.phase??p?.ashPhase;
    if(!this.campaign.active||!phase){this.hide();return;}
    if(!this.ink){
      this.ink=s.add.graphics().setDepth(7.8);
      this.label=s.add.text(0,0,'',{fontFamily:'Georgia, serif',fontSize:'14px',fontStyle:'bold',
        color:'#ffead1',stroke:'#261b25',strokeThickness:4}).setOrigin(.5,1).setDepth(12);
    }
    const g=this.ink.clear().setVisible(true),ms=b?.ms??p.ashMs;
    const floor=s.terrain.anchorAt(p.x),destination=b?this.vessel((b.cycle+1)%3):p.x;
    if(b)for(let i=0;i<3;i++){
      const x=this.vessel(i);
      brazier(g,x,s.terrain.anchorAt(x),x===destination&&['travel','erupt'].includes(phase));
    }
    if(phase==='travel'){
      const {x,y}=this.ember(),dir=b?Math.sign(destination-this.vessel(b.cycle%3)):-1;
      for(let i=3;i>0;i--)g.fillStyle(copper,.72-i*.13).fillEllipse(x-dir*i*6,y-i%2,12-i,5);
      g.fillStyle(coal).fillCircle(x,y,9);g.fillStyle(amber).fillCircle(x,y,6);
      g.fillStyle(white).fillCircle(x,y-1,3);
      const ring=1-clamp(ms/TRAVEL);
      g.lineStyle(2,white,.92).strokeEllipse(p.x,floor-2,19+37*ring,7+7*ring);
    }else if(phase==='erupt'){
      g.lineStyle(4,amber,.96).beginPath().moveTo(p.x-26,floor-3).lineTo(p.x-13,floor-22)
        .lineTo(p.x-7,floor-8).lineTo(p.x+1,floor-30).lineTo(p.x+12,floor-9).lineTo(p.x+24,floor-2).strokePath();
      wraith(g,destination,s.terrain.anchorAt(destination)-mix(11,41,ms/150),b?1:.71,s.elapsed,!!b);
    }else if(b&&['stunned','open','struck','fall'].includes(phase)){
      const pos=this.keeper();
      wraith(g,pos.x,pos.y+(phase==='fall'?40*clamp(ms/1400):0),1.15,s.elapsed,true);
    }
    const cue=phase==='arrival'?'THE CINDER KEEPER':phase==='travel'?'SHOOT EMBER · OR JUMP':
      phase==='stunned'?'INTERCEPTED · CUT':phase==='open'?'EXPOSED · CUT':'';
    const x=Math.min(s.cameraX+s.width-91,Math.max(s.cameraX+90,p.x+62));
    const y=Math.max(s.renderCameraY+72,floor-111);
    this.label.setText(cue).setPosition(x,y).setVisible(!!cue);
    if(b)for(let i=0;i<3;i++)g.fillStyle(i<b.hp?amber:coal).fillRoundedRect(x-23+16*i,y+4,12,4,2);
  }
}
