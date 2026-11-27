// Wisp timing lives on the runner. The ordinary world snapshot consequently
// restores the warning, shot and next scheduled encounter together.
const duration={arrival:1450,warning:1120,cast:380,open:1750,recover:720,struck:740,fall:1150};
const ice=0xa4def5,white=0xf5ffff,shadow=0x304568,signal=0xffce79;
const fraction=t=>Math.max(0,Math.min(1,t));

export class FrostCrown {
  constructor(campaign){this.campaign=campaign;this.scene=campaign.scene;}
  prepare(){
    const s=this.scene,key='tundra-frost-crown';
    if(this.loading||s.textures.exists(key))return;
    this.loading=true;
    const art=new Image();
    art.onload=()=>{
      if(!s.sys.isActive()||s.textures.exists(key))return;
      const texture=s.textures.addImage(key,art);
      texture.add('crown',0,0,0,256,256);texture.add('wisp',0,256,0,256,256);
    };
    art.onerror=()=>{this.loading=false;};
    art.src=new URL('./frost-crown.webp',import.meta.url).href;
  }
  crossing(dt){
    const s=this.scene,p=s.player,markers=s.forestRoute.wisps;
    const next=p.nextWisp??0;
    if(p.wispMs==null&&next<markers.length&&p.x>=markers[next]){
      p.nextWisp=next+1;p.wispMs=0;
    }
    if(p.wispMs==null)return;
    p.wispMs+=dt;
    if(p.wispMs>=1440&&p.wispMs<1780&&p.nextWisp>1&&!p.wispHit){
      const dart=this.dart(),box=window.GRIM_CORE.collisionBox(p.x,p.y,s.lowProfile);
      if(window.GRIM_CORE.overlaps(box,{x:dart.x-11,y:dart.y-7,width:22,height:14})){
        p.wispHit=true;
        if(!s.graveRush&&p.invulMs<=0){
          p.invulMs=window.GRIM_CONFIG.damageInvulnerabilityMs;s.takeDamage(1,'frost wisp');
        }
      }
    }
    if(p.wispMs>=1800){p.wispMs=null;p.wispHit=false;}
  }
  dart(){
    const s=this.scene,p=s.player,center=this.center(),t=fraction((p.wispMs-1440)/300);
    return {x:center.x+(p.x-54-center.x)*t,
      y:s.terrain.anchorAt(p.x)-(p.nextWisp===1?107:p.nextWisp%2?16:57)};
  }
  enter(){
    const s=this.scene;
    this.campaign.guardian={phase:'arrival',ms:0,hp:3,cycle:0,hit:false,
      musicStart:s.elapsed,pursuit:true,scrollRate:.38};
    s.player.wispMs=null;s.obstacles=[];s.enemies=[];s.bullets=[];s.fireballs=[];
    for(const tip of s.tips)tip.label.destroy();
    s.tips=[];
  }
  center(){
    const s=this.scene,p=s.player,b=this.campaign.guardian;
    return {x:p.x+Math.min(s.width*.38,215),y:s.terrain.anchorAt(p.x)-(b?109:89)+4*Math.sin(s.elapsed*3)};
  }
  target(){
    const b=this.campaign.guardian,p=this.scene.player;
    if(b?b.phase!=='open':p.wispMs==null||p.wispMs>=1440)return null;
    return {...this.center(),id:b?'core'+b.cycle:'wisp'+p.nextWisp};
  }
  strike(aim){
    const s=this.scene,b=this.campaign.guardian;
    s.puff(aim.x,aim.y,white,b?15:8);
    if(!b){s.player.wispMs=null;return;}
    b.hp--;b.phase=b.hp?'struck':'fall';b.ms=0;
  }
  cut(){} // The airborne core sits beyond scythe reach.
  step(dt){
    const b=this.campaign.guardian,s=this.scene;
    if(b.phase==='cleared')return;
    b.ms+=dt;
    if(b.phase==='cast'&&!b.hit){
      const wave=this.wave(b),p=s.player;
      const box=window.GRIM_CORE.collisionBox(p.x,p.y,s.lowProfile);
      if(window.GRIM_CORE.overlaps(box,{x:wave.x-13,y:wave.y-9,width:26,height:18})){
        b.hit=true;
        if(p.invulMs<=0){
          p.invulMs=window.GRIM_CONFIG.damageInvulnerabilityMs;s.takeDamage(1,'ice wave');
          if(s.state!=='playing')return;
        }
      }
    }
    if(b.ms<duration[b.phase])return;
    b.ms-=duration[b.phase];
    switch(b.phase){
      case 'arrival':b.phase='warning';break;
      case 'warning':b.phase='cast';b.hit=false;break;
      case 'cast':b.phase='open';break;
      case 'open':b.phase='recover';break;
      case 'recover':case 'struck':b.cycle++;b.phase='warning';break;
      case 'fall':b.phase='cleared';break;
    }
  }
  wave(b){
    const s=this.scene,p=s.player,start=this.center().x;
    const travel=b.phase==='cast'?fraction(b.ms/300):0;
    const x=start+(p.x-54-start)*travel;
    return {x,y:s.terrain.anchorAt(p.x)-(b.cycle%2?57:16)};
  }
  hide(){this.carving?.setVisible(false);this.ink?.setVisible(false);this.label?.setVisible(false);}
  render(){
    const s=this.scene,b=this.campaign.guardian,p=s.player;
    if(!this.campaign.active||(!b&&p.wispMs==null)){this.hide();return;}
    if(!this.ink){
      this.ink=s.add.graphics().setDepth(7.8);
      this.label=s.add.text(0,0,'',{fontFamily:'Georgia, serif',fontStyle:'bold',fontSize:'14px',
        color:'#fff3d4',stroke:'#162133',strokeThickness:4}).setOrigin(.5,1).setDepth(12);
    }
    const g=this.ink.setVisible(true).clear();
    const pos=this.center(),x=pos.x,y=pos.y+(b?.phase==='fall'?b.ms*.055:0);
    const open=b?b.phase==='open':p.wispMs<1440,fade=b?.phase==='fall'?1-fraction(b.ms/1150):1;
    const radius=b?15:6,pulse=.5+.5*Math.sin(s.elapsed*(open?8:3));
    // Split facets and dark edges keep the white crystal readable against snow.
    function shard(cx,cy,w,h,lean,tint){
      g.fillStyle(shadow,fade).fillTriangle(cx-w,cy+4,cx+lean,cy-h,cx+w,cy);
      g.fillStyle(tint,fade).fillTriangle(cx-w+2,cy+1,cx+lean,cy-h+3,cx,cy-2);
      g.lineStyle(1.5,white,.8*fade).lineBetween(cx+lean,cy-h+2,cx+w-1,cy);
    }
    const painted=s.textures.exists('tundra-frost-crown');
    if(painted){
      const frame=b?'crown':'wisp',size=b?124:42;
      if(!this.carving)this.carving=s.add.image(x,y,'tundra-frost-crown',frame).setDepth(7.7);
      this.carving.setFrame(frame).setPosition(x,y).setDisplaySize(size,size)
        .setAngle(3*Math.sin(s.elapsed*2)).setAlpha(fade).setVisible(true);
    }
    if(b&&!painted){
      const spread=open?16:0;
      for(const side of [-1,1]){
        shard(x+side*(28+spread),y+10,14,43,side*27,ice);
        shard(x+side*(17+spread*.7),y-5,12,46,side*10,0x79b8d8);
        shard(x+side*19,y+25,10,24,side*19,0x6089af);
      }
      shard(x,y-12,11,48,0,white);
    }else if(!b){
      for(let i=1;i<5;i++)g.fillStyle(ice,(1-i/5)*.54).fillCircle(x+7*i,y-4*Math.sin(s.elapsed*5-i),5-i*.6);
    }
    g.fillStyle(shadow,fade).fillCircle(x,y,radius+3);
    const charge=b?pulse:fraction(p.wispMs/1480);
    g.fillStyle(open?signal:0x6a97ba,fade).fillCircle(x,y,radius*(open?.72+.2*charge:.7));
    if(open)g.lineStyle(2,white,.6+.4*charge).strokeCircle(x,y,radius+4+4*charge);
    let cue=b?({arrival:'THE FROST CROWN',open:'EXPOSED CORE · SHOOT',warning:b.cycle%2?'HIGH SWEEP · SLIDE':'LOW WAVE · JUMP'}[b.phase]||''):'FROST WISP · SHOOT';
    if(!b){
      const dart=this.dart(),charging=p.wispMs<1440;
      g.lineStyle(charging?1.5:3,ice,charging?.65:1).lineBetween(s.player.x-18,dart.y,dart.x,dart.y);
      shard(dart.x,dart.y+6,9,14,-7,white);
      if(!charging)cue=p.nextWisp===1?'':p.nextWisp%2?'LOW WAVE · JUMP':'HIGH SWEEP · SLIDE';
    }
    if(b&&['warning','cast'].includes(b.phase)){
      const wave=this.wave(b);
      g.lineStyle(b.phase==='cast'?5:2,ice,b.phase==='cast'?1:.6).lineBetween(s.player.x-18,wave.y,wave.x,wave.y);
      shard(wave.x,wave.y+8,13,19,-9,white);
    }
    const lx=Math.min(s.cameraX+s.width-85,x),ly=Math.max(s.renderCameraY+80,y-(b?63:22));
    this.label.setText(cue).setPosition(lx,ly).setVisible(Boolean(cue));
    if(b)for(let i=0;i<3;i++)g.fillStyle(i<b.hp?signal:shadow,fade).fillRoundedRect(lx-24+i*17,ly+3,13,4,2);
  }
}
