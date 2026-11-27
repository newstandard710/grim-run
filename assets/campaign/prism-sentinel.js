// Timers are simulation time. Route state uses scalar player fields, so the
// existing exact-attempt and Rewind snapshots capture each discharge and bolt.
const durations={arrival:1400,warning:1250,beam:140,open:1500,broken:1850,recover:700,struck:750,fall:1550};
const edge=0x211b3b,teal=0x7cf4e1,violet=0x9468d9,light=0xffefbb;
const clamp=t=>Math.min(1,Math.max(0,t));

export class PrismSentinel {
  constructor(campaign){this.campaign=campaign;this.scene=campaign.scene;}
  enter(){
    const s=this.scene;
    this.campaign.guardian={phase:'arrival',hp:3,cycle:0,ms:0,musicStart:s.elapsed,
      high:false,second:false,pursuit:true,scrollRate:.54};
    s.player.prismPhase=null;
    s.obstacles=[];s.enemies=[];s.bullets=[];s.fireballs=[];
    for(const tip of s.tips)tip.label.destroy();
    s.tips=[];
  }
  discharge(high){
    const s=this.scene,p=s.player,floor=s.terrain.anchorAt(p.x);
    const box=window.GRIM_CORE.collisionBox(p.x,s.feetY,s.lowProfile);
    const y=floor-(high?55:14);
    if(p.invulMs<=0&&!s.graveRush&&box.y<y+4&&box.y+box.height>y-4){
      p.invulMs=window.GRIM_CONFIG.damageInvulnerabilityMs;
      s.takeDamage(1,'prism beam');
    }
  }
  crossing(dt){
    const s=this.scene,p=s.player,index=p.nextPrism??0;
    if(!p.prismPhase){
      if(!(p.x>=s.forestRoute.prisms[index]?.x))return;
      p.nextPrism=index+1;p.prismPhase='warning';p.prismMs=0;p.prismRepeat=false;
      p.prismHigh=s.forestRoute.prisms[index].high;
    }
    p.prismMs+=dt;
    if(p.prismMs<durations[p.prismPhase])return;
    p.prismMs-=durations[p.prismPhase];
    switch(p.prismPhase){
      case 'warning':p.prismPhase='beam';this.discharge(p.prismHigh);break;
      case 'beam':p.prismPhase=p.prismRepeat?null:'open';break;
      case 'open':p.prismRepeat=true;p.prismPhase='warning';break;
    }
  }
  step(dt){
    const b=this.campaign.guardian;
    if(b.phase==='cleared')return;
    b.ms+=dt;
    if(b.ms<durations[b.phase])return;
    b.ms-=durations[b.phase];
    switch(b.phase){
      case 'arrival':case 'recover':case 'struck':
        b.high=b.hp===2||b.hp===1&&b.cycle%2===1;b.second=false;b.phase='warning';break;
      case 'warning':b.phase='beam';this.discharge(b.high);break;
      case 'beam':
        if(b.hp===1&&!b.second){b.high=!b.high;b.second=true;b.phase='warning';}
        else b.phase='open';
        break;
      case 'open':case 'broken':b.cycle++;b.phase='recover';break;
      case 'fall':b.phase='cleared';break;
    }
  }
  position(){
    const s=this.scene,b=this.campaign.guardian;
    const far=Math.min(176,s.width*.33);
    const near=b?.phase==='broken'?clamp(b.ms/320):b?.phase==='struck'?1-clamp(b.ms/500):0;
    const x=s.player.x+far+(61-far)*near;
    return {x,y:s.terrain.anchorAt(s.player.x)-95+44*near+4*Math.sin(s.elapsed*3)};
  }
  target(){
    const b=this.campaign.guardian,p=this.scene.player;
    if((b?.phase??p.prismPhase)!=='open')return null;
    return {...this.position(),id:b?'facet'+b.cycle:'prism'+p.nextPrism};
  }
  strike(aim){
    if(aim.id!==this.target()?.id)return;
    this.scene.puff(aim.x,aim.y,teal,11);
    window.GRIM_ACTION_AUDIO?.play('knot');
    const b=this.campaign.guardian;
    if(b){b.phase='broken';b.ms=0;}
    else this.scene.player.prismPhase=null;
  }
  cut(hits){
    const b=this.campaign.guardian;
    if(b?.phase!=='broken'||b.ms<260)return;
    const {x,y}=this.position();
    if(!hits({x:x-17,y:y-18,width:34,height:36}))return;
    this.scene.puff(x,y,light,14);window.GRIM_ACTION_AUDIO?.play('impact');
    b.hp--;b.cycle++;b.phase=b.hp?'struck':'fall';b.ms=0;
  }
  hide(){this.ink?.setVisible(false);this.label?.setVisible(false);}
  render(){
    const s=this.scene,b=this.campaign.guardian,p=s.player,phase=b?.phase??p.prismPhase;
    if(!this.campaign.active||!phase){this.hide();return;}
    if(!this.ink){
      this.ink=s.add.graphics().setDepth(7.8);
      this.label=s.add.text(0,0,'',{fontFamily:'Georgia, serif',fontSize:'14px',fontStyle:'bold',
        color:'#fff5db',stroke:'#19122d',strokeThickness:4}).setOrigin(.5,1).setDepth(12);
    }
    const g=this.ink.setVisible(true).clear(),pos=this.position(),ms=b?.ms??p.prismMs;
    const high=b?.high??p.prismHigh,open=phase==='open',broken=phase==='broken';
    const x=pos.x,y=pos.y+(phase==='fall'?ms*.035:0);
    const fade=phase==='fall'?1-clamp(ms/durations.fall):1;
    g.setAlpha(fade);
    // A hinged, six-bladed lantern. The shell opens radially for a shot,
    // then splinters outward while the exposed heart falls into scythe range.
    const size=b?1.0:.52;
    g.save().translateCanvas(x,y).scaleCanvas(size,size);
    if(b){
      // The dark iron spine stays upright as the refracting blades turn.
      // Three copper sockets mark the crown, with a keystone beneath the eye.
      g.fillStyle(0x282138).fillTriangle(-24,-12,0,-56,24,-12);
      g.fillStyle(0x786282).fillTriangle(-20,-13,0,-50,-4,-15);
      g.fillStyle(0x39324f).fillTriangle(0,-50,20,-13,1,-11);
      g.lineStyle(2,0xe4bb8d,.85).lineBetween(-17,-15,0,-45);
      for(const side of [-1,1]){
        g.fillStyle(0x49415b).fillTriangle(side*20,-10,side*44,-29,side*26,10);
        g.fillStyle(0xc49c84).fillTriangle(side*26,-9,side*41,-25,side*31,-3);
        g.lineStyle(2,0x746276).lineBetween(side*24,0,side*15,33);
      }
      g.fillStyle(0x322e48).fillTriangle(-16,13,0,49,16,13);
      g.fillStyle(0x9d84a5).fillTriangle(-12,15,0,43,-2,20);
      g.fillStyle(0x4a5475).fillTriangle(0,43,12,15,-2,20);
    }
    g.fillStyle(edge).fillCircle(0,0,20);
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3+s.elapsed*(broken?.24:.52);
      const spread=broken?29:open?16:3;
      g.save().rotateCanvas(a).translateCanvas(0,-spread);
      g.fillStyle(edge).fillTriangle(-14,-9,2,-54,19,-18);
      g.fillStyle(i%2?0x8463b9:0x467d9c).fillTriangle(-11,-11,2,-49,3,-20);
      g.fillStyle(i%2?0xcea7f2:teal).fillTriangle(2,-49,15,-19,3,-20);
      g.fillStyle(0x5e507a).fillTriangle(-9,-14,3,-20,13,-18);
      g.lineStyle(1.4,light,.8).lineBetween(2,-49,15,-19);
      g.lineStyle(1,0xeee1f8,.6).lineBetween(-4,-25,2,-42);
      g.fillStyle(0x4c394c).fillCircle(1,-14,4);
      g.fillStyle(0xd5af85).fillCircle(0,-15,2);

      g.restore();
    }
    g.fillStyle(0x4d394a).fillEllipse(0,0,33,28);
    g.lineStyle(2,0xb79378,.93).strokeEllipse(0,0,31,25);
    g.fillStyle(0x242339).fillEllipse(0,0,24,18);
    const r=broken?15:open?11:7;
    g.fillStyle(broken?light:open?teal:violet).fillTriangle(-r,0,0,-r*1.4,r,0);
    g.fillStyle(broken?0xe39a66:0x44869c).fillTriangle(-r,0,0,r*1.4,r,0);
    if(open||broken)g.lineStyle(2,light,.85).strokeCircle(0,0,r+6);
    g.restore();
    if(phase==='warning'||phase==='beam'){
      const lane=s.terrain.anchorAt(p.x)-(high?55:14),left=s.cameraX-5;
      g.lineStyle(2,teal,.7).lineBetween(x,y,x,lane);
      if(phase==='warning'){
        for(let at=left;at<x;at+=18)g.lineStyle(2,light,.8).lineBetween(at,lane,Math.min(x,at+9),lane);
        const arrow=p.x+43,dir=high?1:-1;
        g.lineStyle(3,teal,1).beginPath().moveTo(arrow-7,lane+dir*6).lineTo(arrow,lane+dir*14).lineTo(arrow+7,lane+dir*6).strokePath();
        g.lineStyle(2,light,1).strokeCircle(x,lane,4+12*(1-clamp(ms/durations.warning)));
      }else{
        g.lineStyle(9,violet,.9).lineBetween(left,lane,x,lane);
        g.lineStyle(4,light,1).lineBetween(left,lane,x,lane);
      }
    }
    const cue=phase==='warning'?(high?'HIGH BEAM · SLIDE':'LOW BEAM · JUMP'):open?'OPEN FACET · SHOOT':
      broken?'SHELL BROKEN · CUT':phase==='arrival'?'THE PRISM SENTINEL':'';
    const lx=Math.max(s.cameraX+83,Math.min(x,s.cameraX+s.width-88)),ly=Math.max(s.renderCameraY+92,y-(b?64:40));
    this.label.setText(cue).setPosition(lx,ly).setVisible(Boolean(cue)).setAlpha(fade);
    if(b)for(let i=0;i<3;i++)g.fillStyle(i<b.hp?teal:edge).fillRoundedRect(lx-23+i*16,ly+2,12,4,2);
  }
}
