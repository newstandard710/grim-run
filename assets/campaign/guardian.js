// A Forest-only encounter. All coordinates that survive a save are world X
// positions; Y is sampled from the seeded terrain after a rotation or restore.
const duration={arrival:1300,roots:900,eruption:230,breath:950,bough:900,sweep:240,
  exposed:1550,recover:700,struck:700,fall:950};
const next={arrival:'roots',roots:'eruption',eruption:'breath',breath:'bough',bough:'sweep',
  sweep:'exposed',exposed:'recover',recover:'roots',struck:'roots',fall:'cleared'};
const cues={arrival:'FOREST GUARDIAN',roots:'ROOTS STIR',eruption:'',breath:'',
  bough:'BOUGH RISES',sweep:'',exposed:'EXPOSED · CUT',recover:'',struck:'',fall:'',cleared:''};
const clamp=t=>Math.max(0,Math.min(1,t));
const smooth=t=>clamp(t)**2*(3-2*clamp(t));
const artKey='forest-guardian-trunk';

export class ForestGuardian {
  constructor(campaign){
    this.campaign=campaign;
    this.scene=campaign.scene;
    const scene=this.scene;
    const art=new Image();
    art.onload=()=>{
      if(scene.sys.isActive()&&!scene.textures.exists(artKey))scene.textures.addImage(artKey,art);
    };
    art.src=new URL('./guardian.webp',import.meta.url).href;
  }
  enter(){
    const s=this.scene,p=s.player;
    // Reserve continuous ground beneath both actors, including the guardian's
    // widest root spread. An airborne arrival finishes its jump in the clearing.
    const rootMargin=270;
    let edge=p.x-32;
    const limit=p.x+88+rootMargin;
    while(edge<limit){
      const section=s.terrain.sectionAt(edge);
      if(!section||section.kind==='gap')break;
      edge=section.end;
    }
    if(edge<p.x+rootMargin)return;
    const standX=Math.min(p.x+88,edge-rootMargin);
    this.campaign.guardian={standX,phase:'arrival',ms:0,hp:3,hit:false,round:0};
    s.enemies=[];s.obstacles=[];s.fireballs=[];s.bullets=[];
    s.coins=[];s.souls=[];
    for(const tip of s.tips)tip.label.destroy();
    s.tips=[];
  }
  phaseLength(b){
    if(b.phase==='breath'&&b.round>0)return b.round===1?540:300;
    return duration[b.phase]||1;
  }
  step(dt){
    const b=this.campaign.guardian,s=this.scene,p=s.player;
    if(b.phase==='cleared')return;
    b.ms+=dt;
    const phase=b.phase;
    const strike=phase==='eruption'||phase==='sweep';
    if(strike&&!b.hit&&p.invulMs<=0){
      const floor=s.terrain.groundAt(p.x);
      const shape=phase==='eruption'
        ? {x:b.standX-24,y:floor-this.rootHeight(b),width:48,height:this.rootHeight(b)}
        : {x:this.boughTip(b).x-7,y:floor-87,width:86,height:42};
      if(window.GRIM_CORE.overlaps(window.GRIM_CORE.collisionBox(p.x,p.y,s.lowProfile),shape)){
        b.hit=true;p.invulMs=window.GRIM_CONFIG.damageInvulnerabilityMs;
        s.takeDamage(1,phase==='eruption'?'guardian roots':'guardian bough');
        if(s.state!=='playing')return;
      }
    }
    const length=this.phaseLength(b);
    if(b.ms>=length){b.ms-=length;b.phase=next[phase];b.hit=false;}
  }
  rootHeight(b){return 9+35*smooth(b.ms/65);}
  boughTip(b){
    const s=this.scene,span=Math.min(198,Math.max(110,s.width*.40));
    const x=b.standX+span,y=s.terrain.anchorAt(x),floor=s.terrain.anchorAt(b.standX);
    const h=192*Math.min(1,Math.max(.7,s.height/350));
    const baseX=x-22,baseY=y-h*.42;
    const restX=x-54,restY=baseY+25;
    const windX=x-45,windY=baseY-36;
    const sweepX=b.standX-30,sweepY=floor-53;
    const k=this.knot(),knotX=k.x+k.width/2,knotY=k.y+k.height/2;
    let fromX=restX,fromY=restY,toX=restX,toY=restY,t=0;
    switch(b.phase){
      case 'bough': toX=windX;toY=windY;t=smooth(b.ms/duration.bough);break;
      case 'sweep': fromX=windX;fromY=windY;toX=sweepX;toY=sweepY;t=smooth(b.ms/105);break;
      case 'exposed': fromX=sweepX;fromY=sweepY;toX=knotX;toY=knotY;t=smooth(b.ms/120);break;
      case 'struck': case 'recover': fromX=knotX;fromY=knotY;t=smooth(b.ms/360);break;
    }
    return {x:fromX+(toX-fromX)*t,y:fromY+(toY-fromY)*t,baseX,baseY};
  }
  knot(){
    const b=this.campaign.guardian;
    return {x:b.standX+54,y:this.scene.terrain.anchorAt(b.standX)-63,width:36,height:48};
  }
  cut(hits){
    const b=this.campaign.guardian;
    if(b.phase!=='exposed'||b.ms<120||!hits(this.knot()))return;
    const k=this.knot();
    b.hp--;b.round++;b.phase=b.hp?'struck':'fall';b.ms=0;
    this.scene.puff(k.x+17,k.y+17,0xe5bd70,9);
    window.GRIM_ACTION_AUDIO?.play('cut');
  }
  hide(){
    this.limbs?.setVisible(false);this.body?.setVisible(false);this.label?.setVisible(false);
  }
  render(){
    const b=this.campaign.guardian;
    if(!b){if(this.limbs?.visible)this.hide();return;}
    const s=this.scene;
    if(!this.limbs){
      this.limbs=s.add.graphics().setDepth(7.5);
      this.label=s.add.text(0,0,'',{fontFamily:'Georgia, serif',fontStyle:'bold',fontSize:'15px',
        color:'#fff1c4',stroke:'#111e23',strokeThickness:4,align:'center'}).setOrigin(.5,1).setDepth(12);
    }
    const g=this.limbs;g.setVisible(true).clear();
    const phase=b.phase,t=clamp(b.ms/this.phaseLength(b));
    const span=Math.min(198,Math.max(110,s.width*.40));
    const x=b.standX+span,y=s.terrain.anchorAt(x),floor=s.terrain.anchorAt(b.standX);
    const scale=Math.min(1,Math.max(.70,s.height/350));
    const falling=phase==='fall'?smooth(t):0;
    const recoil=phase==='struck'?Math.sin(t*Math.PI)*8:0;
    const h=192*scale;
    if(!this.body&&s.textures.exists(artKey))
      this.body=s.add.image(0,0,artKey).setOrigin(.5,.95).setDepth(7);
    if(this.body){
      const body=this.body;
      const lean=phase==='bough'?-4*smooth(t):phase==='exposed'?3:0;
      body.setVisible(true).setPosition(x+recoil,y+6+12*falling)
        .setScale(h/body.height).setAngle(lean+falling*17).setAlpha(1-falling);
    }else{
      // A slow or unavailable art download still leaves a rooted silhouette.
      g.fillStyle(0x243b3b,1).fillTriangle(x-48,y,x-24,y-h,x+40,y);
      g.fillStyle(0xdeb978,1).fillEllipse(x-9,y-h*.72,17,5);
    }
    const alpha=1-falling;
    const tip=this.boughTip(b),bx=tip.baseX,by=tip.baseY,tx=tip.x,ty=tip.y;
    const ex=bx+(tx-bx)*.48+4,ey=by+(ty-by)*.42-12;
    // Taper the bough from the trunk out to its forked fingers. The same
    // animated tip drives impact, including its travel across the clearing.
    const shape=(color,points)=>{
      g.fillStyle(color,alpha).beginPath().moveTo(points[0],points[1]);
      for(let i=2;i<points.length;i+=2)g.lineTo(points[i],points[i+1]);
      g.closePath().fillPath();
    };
    shape(0x243432,[bx+6,by-12,ex+5,ey-9,ex-5,ey-25,ex-2,ey-5,tx+7,ty-6,
      tx-10,ty-18,tx-7,ty-4,tx-17,ty+1,tx-3,ty+5,ex,ey+8,bx+8,by+13]);
    shape(0x665c48,[bx,by-7,ex,ey-7,tx+5,ty-4,tx-10,ty+1,tx,ty+2,ex+1,ey+3,bx+4,by+4]);
    shape(0xb8a278,[bx-4,by-7,ex+4,ey-7,ex-1,ey-4,tx+4,ty-3,ex,ey-1]);
    shape(0x3c4a3b,[bx+3,by-12,bx-12,by-8,bx-6,by-3,bx-18,by+1,bx-5,by+6,bx+7,by-1]);
    const knot=this.knot(),kx=knot.x+knot.width/2,ky=knot.y+knot.height/2;
    if(phase==='roots'||phase==='eruption'){
      const rise=phase==='roots'?4+6*t:this.rootHeight(b);
      for(const dx of [-23,-7,12,25]){
        const at=b.standX+dx,top=floor-rise*(dx===-7?1:.83);
        g.fillStyle(0x233936,1).fillTriangle(at-8,floor+3,at+3,top,at+9,floor+3);
        g.fillStyle(0xc3aa7a,1).fillTriangle(at-5,floor,at+3,top,at+1,floor);
      }
      if(phase==='roots')g.lineStyle(2,0xfde0a3,.7).lineBetween(b.standX-31,floor-1,b.standX+31,floor-1);
    }
    if(phase==='exposed'&&b.ms>=120){
      g.fillStyle(0x372a22,1).fillEllipse(kx,ky,34,33);
      g.lineStyle(3,0xf0c17c,1).strokeEllipse(kx,ky,29,28);
      g.fillStyle(0xffdd8f,1).fillTriangle(kx-5,ky-5,kx+6,ky-6,kx-2,ky+9);
    }
    const labelX=Math.max(s.cameraX+86,Math.min(x-7,s.cameraX+s.width-80));
    const labelY=Math.max(s.renderCameraY+76,y-h-2);
    let cue=cues[phase];
    if(phase==='roots'&&b.ms>=600)cue='HOLD JUMP';
    if(phase==='bough'&&b.ms>=600)cue='HOLD SLIDE';
    if(this.label.text!==cue)this.label.setText(cue);
    this.label.setPosition(labelX,labelY).setVisible(Boolean(cue));
    for(let i=0;i<3;i++){
      g.fillStyle(i<b.hp?0xf3c984:0x555649,alpha).fillRoundedRect(labelX-24+i*17,labelY+4,13,4,2);
    }
  }
}
