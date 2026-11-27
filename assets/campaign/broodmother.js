// World X positions and simulation timers survive interruption and Rewind.
// Vertical positions follow the terrain after a screen rotation.
const phaseMs={arrival:1400,silk:1200,drop:460,rockWarning:900,rock:510,grounded:1680,recover:680,struck:720,fall:1100};
const clamp=t=>Math.max(0,Math.min(1,t));
const smooth=t=>clamp(t)**2*(3-2*clamp(t));
const silk=0xefe4da, amber=0xffc582;
function body(x,y,w,h){return {x:x-w/2,y:y-h/2,width:w,height:h};}

// Jointed legs and the split dorsal stripe from the Caves Spider study.
function paintSpider(g,x,y,size,fold,time,queen,exposed){
  g.save().translateCanvas(x,y).scaleCanvas(size,size);
  for(const side of [-1,1])for(let leg=0;leg<4;leg++){
    const stride=Math.sin(time*.012+leg*1.7+side)*1.8*(1-fold);
    const knee=side*(18+leg*2.8-fold*8),kneeY=-20+leg*7+stride;
    const ankle=side*(30+leg*2-fold*13),ankleY=-17+leg*8+stride;
    g.lineStyle(3.6,0x261d2b,1).beginPath().moveTo(side*7,leg-2)
      .lineTo(knee,kneeY).lineTo(ankle,ankleY).lineTo(ankle+side*3,ankleY+8).strokePath();
    g.lineStyle(1.5,0xba9c90,1).lineBetween(side*8,leg-3,knee,kneeY-1);
    g.lineStyle(1.1,0x94818b,1).lineBetween(knee,kneeY-1,ankle,ankleY);
  }
  g.fillStyle(0x221b29).fillEllipse(1,-4,35,27);
  g.fillStyle(queen?0x79576b:0x675764).fillEllipse(0,-6,30,20);
  g.fillStyle(0x473440).fillEllipse(1,-4,25,16);
  for(const side of [-1,1]){
    g.fillStyle(0xc3947e).fillTriangle(side*12,-12,side*3,-9,side*5,-2);
    g.fillStyle(0x99828a).fillTriangle(side*12,-5,side*8,-2,side*10,1);
    g.fillStyle(0xe1c8a7).fillTriangle(side*7,8,side*4,16,side*2,10);
    if(queen){
      for(let i=0;i<3;i++)g.fillStyle(0xbda3a6).fillEllipse(side*(7+i*3),-11+i*4,5,7);
      g.fillStyle(0xb8a5b3).fillTriangle(side*11,-11,side*17,-24,side*4,-15);
    }
  }
  g.fillStyle(0x302535).fillEllipse(-1,5,19,14);
  for(const dx of [-7,-3,1,5])g.fillStyle(amber).fillCircle(dx,6,1.45);
  if(exposed)g.lineStyle(1.6,silk,1).strokeEllipse(0,-4,17,17).fillStyle(amber).fillEllipse(0,-4,11,13);
  g.restore();
}

export class Broodmother {
  constructor(campaign){this.campaign=campaign;this.scene=campaign.scene;}
  crossing(dt){
    const s=this.scene,p=s.player,markers=s.forestRoute.spiders;
    const index=p.nextSpider??0,x=markers[index];
    if(p.spiderX==null&&x!=null&&x-p.x<=s.speed*1.30){
      p.nextSpider=index+1;p.spiderX=x;p.silkMs=0;p.spiderHit=false;
      window.GRIM_ACTION_AUDIO?.play('silk');
    }
    if(p.spiderX==null)return;
    p.silkMs+=dt;
    if(p.x>p.spiderX+80)p.spiderX=null;
  }
  spider(){
    const s=this.scene,p=s.player,x=p.spiderX,floor=s.terrain.anchorAt(x);
    const perch=Math.max(floor-212,Math.min(floor-138,s.renderCameraY+50));
    const drop=smooth((p.silkMs-365)/330);
    return {x,y:perch+(floor-65-perch)*drop};
  }
  damage(shape,cause){
    const s=this.scene,p=s.player;
    if(!window.GRIM_CORE.overlaps(shape,window.GRIM_CORE.collisionBox(p.x,s.feetY,s.lowProfile)))return false;
    if(p.invulMs<=0&&!s.graveRush){
      p.invulMs=window.GRIM_CONFIG.damageInvulnerabilityMs;s.takeDamage(1,cause);
    }
    return true;
  }
  contact(){
    const p=this.scene.player;
    if(p.spiderHit)return;
    const a=this.spider();
    if(this.damage(body(a.x,a.y,32,24),'cave spider'))p.spiderHit=true;
  }
  enter(){
    const s=this.scene;
    this.campaign.guardian={standX:s.player.x+72,phase:'arrival',hp:3,cycle:0,ms:0,hit:false,musicStart:s.elapsed};
    s.player.spiderX=null;s.obstacles=[];s.enemies=[];s.bullets=[];s.fireballs=[];
    for(const tip of s.tips)tip.label.destroy();
    s.tips=[];
  }
  queen(){
    const s=this.scene,b=this.campaign.guardian,x=b.standX,ground=s.terrain.anchorAt(x);
    const perch={x:x+Math.min(160,s.width*.34),y:ground-176},low={x:x+62,y:ground-47};
    if(b.phase==='drop'){
      const t=smooth(b.ms/300);
      return {x:perch.x+(x-perch.x)*t,y:perch.y+(ground-68-perch.y)*t};
    }
    if(b.phase==='rock'||b.phase==='rockWarning')return low;
    if(['grounded','struck','fall'].includes(b.phase))return low;
    if(b.phase==='recover'){
      const t=smooth(b.ms/phaseMs.recover);
      return {x:low.x+(perch.x-low.x)*t,y:low.y+(perch.y-low.y)*t};
    }
    return perch;
  }
  rock(){
    const b=this.campaign.guardian,from=b.standX+Math.min(182,this.scene.width*.40);
    const x=from+(b.standX-65-from)*clamp(b.ms/450);
    return {x,y:this.scene.terrain.anchorAt(x)-13};
  }
  target(){
    const b=this.campaign.guardian;
    return b?.phase==='grounded'?{...this.queen(),id:'brood-'+b.cycle}:null;
  }
  strike(aim){
    const b=this.campaign.guardian;
    if(!b||b.phase!=='grounded')return;
    this.scene.puff(aim.x,aim.y,amber,13);window.GRIM_ACTION_AUDIO?.play('impact');
    b.hp--;b.phase=b.hp?'struck':'fall';b.ms=0;
  }
  cut(hits){
    const b=this.campaign.guardian;
    if(b){
      const aim=this.target();
      if(aim&&hits(body(aim.x,aim.y,41,39)))this.strike(aim);
    }else{
      const a=this.spider();
      if(!hits(body(a.x,a.y,32,24)))return;
      this.scene.player.spiderX=null;this.scene.puff(a.x,a.y,amber,8);window.GRIM_ACTION_AUDIO?.play('defeat');
    }
  }
  step(dt){
    const b=this.campaign.guardian;
    if(b.phase==='cleared')return;
    b.ms+=dt;
    if(!b.hit&&b.phase==='drop'){
      const pos=this.queen();b.hit=this.damage(body(pos.x,pos.y,40,25),'Broodmother drop');
    }else if(!b.hit&&b.phase==='rock'){
      const pos=this.rock();b.hit=this.damage(body(pos.x,pos.y,28,26),'cave rock');
    }
    if(this.scene.state!=='playing'||b.ms<phaseMs[b.phase])return;
    b.ms-=phaseMs[b.phase];b.hit=false;
    switch(b.phase){
      case 'arrival':case 'recover': b.phase='silk';window.GRIM_ACTION_AUDIO?.play('silk');break;
      case 'struck': b.cycle++;b.phase='recover';break;
      case 'silk':b.phase='drop';break;
      case 'drop':b.phase=b.cycle?'rockWarning':'grounded';break;
      case 'rockWarning':b.phase='rock';break;
      case 'rock':b.phase='grounded';break;
      case 'grounded':b.cycle++;b.phase='recover';break;
      case 'fall':b.phase='cleared';break;
    }
    if(b.phase==='grounded')window.GRIM_ACTION_AUDIO?.play('knot');
  }
  hide(){this.ink?.setVisible(false);this.label?.setVisible(false);}
  render(){
    const s=this.scene,p=s.player,b=this.campaign.guardian;
    if(!this.campaign.active||(!b&&p.spiderX==null)){this.hide();return;}
    if(!this.ink){
      this.ink=s.add.graphics().setDepth(7.8);
      this.label=s.add.text(0,0,'',{fontFamily:'Georgia, serif',fontSize:'14px',fontStyle:'bold',
        color:'#fff2dc',stroke:'#1d1425',strokeThickness:4}).setDepth(12).setOrigin(.5,1);
    }
    const g=this.ink.setVisible(true).clear(),pos=b?this.queen():this.spider();
    const top=s.renderCameraY,right=s.cameraX+s.width;
    // Show a moving thread at the viewport edge until its ceiling anchor enters.
    // This gives portrait the same initial warning interval as landscape.
    const anchor=b?b.standX+(b.phase==='silk'?0:34):pos.x;
    const visibleX=Math.min(right-22,anchor);
    const floor=s.terrain.anchorAt(anchor),t=b?.ms??p.silkMs;
    const wave=4*Math.sin(t*.012);
    g.lineStyle(2,silk,.88).beginPath().moveTo(visibleX,top).lineTo(visibleX+wave,top+52)
      .lineTo(Math.min(right-18,pos.x),pos.y-12).strokePath();
    if(b?.phase==='silk'||!b){
      g.lineStyle(1.5,silk,.78).lineBetween(visibleX-12,floor-4,visibleX+12,floor-4);
    }
    g.setAlpha(b?.phase==='fall'?1-clamp(b.ms/phaseMs.fall):1);
    paintSpider(g,pos.x,pos.y,b?2.15:1,b?.phase==='silk'?.8:!b?1-smooth(t/620):0,t,Boolean(b),b?.phase==='grounded');
    if(b?.phase==='rockWarning'||b?.phase==='rock'){
      const a=b.phase==='rock'?this.rock():{x:b.standX+Math.min(182,s.width*.40),y:floor-14};
      g.fillStyle(0x574a63).fillTriangle(a.x-20,a.y+12,a.x-5,a.y-19,a.x+18,a.y+7);
      g.fillStyle(0xc2afbb).fillTriangle(a.x-20,a.y+12,a.x-5,a.y-19,a.x+1,a.y-6);
      g.lineStyle(2,amber,.8).lineBetween(a.x-12,a.y+10,a.x+15,a.y+7);
    }
    const cue=b?({arrival:'THE BROODMOTHER',silk:'SILK ABOVE · SLIDE',rockWarning:'FALLING STONE · JUMP',
      grounded:'EXPOSED · CUT OR SHOOT'}[b.phase]||''):'SILK · CUT OR SLIDE';
    const lx=Math.min(right-88,Math.max(s.cameraX+90,visibleX)),ly=Math.max(top+92,Math.min(pos.y-35,floor-145));
    this.label.setText(cue).setPosition(lx,ly).setVisible(Boolean(cue));
    if(b)for(let i=0;i<3;i++)g.fillStyle(i<b.hp?amber:0x4c3c51).fillRoundedRect(lx-23+i*16,ly+2,12,4,2);
  }
}
