// The crossing uses the terrain engine's seeded gaps. Both the split rock and
// the far lip are drawn from the same edges the player must actually clear.
const basalt=0x302c39, face=0x504854, rim=0x93858a, dark=0x1c1924;
const magma=0xed713d, hot=0xffdfa0;
const clamp=t=>Math.max(0,Math.min(1,t));

function fracture(g,left,right,y,progress){
  // Five plates shear down and apart. The pale far lip remains level.
  const width=(right-left)/5;
  for(let i=0;i<5;i++){
    const drop=clamp(progress*2-i*.12);
    const x=left+i*width,top=y+drop*drop*(14+i%3*5);
    g.fillStyle(dark).fillTriangle(x,top,x+width,top+1,x+width*.6,top+13);
    g.fillStyle(face).fillTriangle(x+2,top-2,x+width-1,top+1,x+width*.6,top+6);
    g.lineStyle(2,drop>.1?hot:rim).lineBetween(x+1,top-2,x+width*.46,top+1)
      .lineBetween(x+width*.46,top+1,x+width*.6,top+5);
    if(drop>.28)g.lineStyle(2,magma).lineBetween(x,top+3,x+3,top+12);
  }
  g.lineStyle(3,rim).lineBetween(right,y,right+20,y-1);
}

// Faceted columns overlap like the natural basalt organs on the causeway.
// Their changing length and angle describe the planted feet and striking arm.
function column(g,x,y,ex,ey,width){
  const length=Math.max(1,Math.hypot(ex-x,ey-y)),nx=-(ey-y)/length*width,ny=(ex-x)/length*width;
  const pts=[{x:x+nx,y:y+ny},{x:x-nx,y:y-ny},{x:ex-nx*.76,y:ey-ny*.76},{x:ex+nx*.76,y:ey+ny*.76}];
  g.fillStyle(basalt).fillPoints(pts,true);
  g.fillStyle(face).fillTriangle(x+nx,y+ny,x,y,ex+nx*.76,ey+ny*.76);
  g.lineStyle(1,0x695458).lineBetween(x-nx*.45,y-ny*.45,ex-nx*.43,ey-ny*.43);
  g.lineStyle(2,rim,.82).lineBetween(x+nx,y+ny,ex+nx*.76,ey+ny*.76);
}

export class BasaltColossus {
  constructor(campaign){this.campaign=campaign;this.scene=campaign.scene;}
  prepare(){
    const s=this.scene,key='lava-colossus-body';
    if(this.loading||s.textures.exists(key))return;
    this.loading=true;
    const art=new Image();
    art.onload=()=>{
      this.loading=false;
      if(s.sys.isActive()&&!s.textures.exists(key))s.textures.addImage(key,art);
    };
    art.onerror=()=>{this.loading=false;};
    art.src=new URL('./basalt-colossus.webp',import.meta.url).href;
  }
  enter(){
    const s=this.scene;
    this.campaign.guardian={phase:'arrival',hp:3,ms:0,pursuit:true,scrollRate:.56,musicStart:s.elapsed};
    s.obstacles=[];s.enemies=[];s.bullets=[];s.fireballs=[];
    for(const tip of s.tips)tip.label.destroy();
    s.tips=[];
  }
  startStrike(b){
    const s=this.scene;
    b.phase='raise';b.ms=0;b.missed=false;
    // Once the fist selects a plate, the landing never tracks the player.
    b.left=s.player.x+Math.min(s.width*.57,[170,192,183][3-b.hp]);
    b.right=b.left+[58,70,78][3-b.hp];
  }
  step(dt){
    const s=this.scene,p=s.player,b=this.campaign.guardian;
    b.ms+=dt;
    switch(b.phase){
      case 'arrival':case 'recover':case 'struck':
        if(b.ms>=(b.phase==='arrival'?1400:880))this.startStrike(b);
        break;
      case 'raise':
        if(b.left-p.x<=76){b.phase='split';b.ms=0;window.GRIM_ACTION_AUDIO?.play('impact');}
        break;
      case 'split':
        if(p.x>=b.left&&p.x<=b.right&&s.feetY>=s.terrain.anchorAt(p.x)-8&&!b.missed){
          b.missed=true;
          if(p.invulMs<=0){
            p.invulMs=window.GRIM_CONFIG.damageInvulnerabilityMs;s.takeDamage(1,'broken basalt');
          }
        }
        if(p.x>b.right&&p.grounded){b.phase=b.missed?'recover':'exposed';b.ms=0;}
        break;
      case 'exposed':
        if(b.ms>=1500){b.phase='recover';b.ms=0;}
        break;
      case 'fall':
        if(b.ms>=1450)b.phase='cleared';
        break;
    }
  }
  wrist(){
    const s=this.scene,p=s.player,b=this.campaign.guardian,y=s.terrain.anchorAt(p.x);
    const shoulder=p.x+Math.min(s.width*.38,154);
    if(b.phase==='raise')return {x:shoulder-42,y:y-133};
    if(b.phase==='split')return {x:Math.max(p.x+54,b.left),y:y-20};
    return {x:b.phase==='exposed'?p.x+57:shoulder-38,y:y-(b.phase==='exposed'?37:65)};
  }
  cut(hits){
    const b=this.campaign.guardian;
    if(b?.phase!=='exposed')return;
    const {x,y}=this.wrist();
    if(!hits({x:x-15,y:y-14,width:30,height:28}))return;
    b.hp--;b.phase=b.hp?'struck':'fall';b.ms=0;
    this.scene.puff(x,y,hot,12);window.GRIM_ACTION_AUDIO?.play('impact');
  }
  hide(){this.body?.setVisible(false);this.ink?.setVisible(false);this.label?.setVisible(false);}
  render(){
    const s=this.scene,p=s.player,b=this.campaign.guardian;
    if(!this.campaign.active){this.hide();return;}
    if(!this.ink){
      this.ink=s.add.graphics().setDepth(7.7);
      this.label=s.add.text(0,0,'',{fontFamily:'Georgia, serif',fontSize:'14px',fontStyle:'bold',
        color:'#fff0ce',stroke:'#211b28',strokeThickness:4}).setOrigin(.5,1).setDepth(12);
    }
    const g=this.ink.clear().setVisible(true);
    this.body?.setVisible(false);
    if(!b){
      this.label.setVisible(false);
      for(const gap of s.terrain.sequences){
        if(gap.startX>s.cameraX+s.width+15)break;
        if(gap.endX<s.cameraX-8)continue;
        fracture(g,gap.startX,gap.endX,gap.initialY,clamp(1-(gap.startX-p.x)/170));
      }
      return;
    }
    const floor=s.terrain.anchorAt(p.x),phase=b.phase;
    const collapse=phase==='fall'?clamp(b.ms/1450):0;
    const x=p.x+Math.min(s.width*.38,154),y=floor+collapse*82;
    const stride=Math.sin(s.elapsed*6),bob=3*Math.abs(stride);
    for(const side of [-1,1]){
      const knee=x+side*(15+stride*16),heel=x+side*stride*30;
      const sole=y-7-Math.max(0,side*stride)*14;
      column(g,x+side*12,y-62+bob,knee,y-36,12);
      column(g,knee,y-36,heel,sole,10);column(g,heel+5,sole,heel-15,sole+1,6);
    }
    if(s.textures.exists('lava-colossus-body')){
      if(!this.body)this.body=s.add.image(0,0,'lava-colossus-body').setDepth(7.71);
      this.body.setVisible(true).setPosition(x-1,y-99+bob).setDisplaySize(119,109)
        .setRotation(collapse*.55).setAlpha(1-collapse);
    }else{
      // Jagged organ pipes form a sloped back above the glowing furnace ribs.
      for(let i=0;i<6;i++){
        const bx=x-21+i*9,top=y-101-i*6+bob;
        column(g,bx,top,bx-5,y-54+bob,7);
        g.lineStyle(2,magma,.85).lineBetween(bx-2,y-90+bob,bx-4,y-79+i%3*2+bob);
      }
      column(g,x-13,y-130+bob,x-20,y-104+bob,14);
      g.lineStyle(3,hot).lineBetween(x-32,y-118+bob,x-19,y-121+bob);
    }
    const wrist=this.wrist(),wx=wrist.x,wy=wrist.y+collapse*82;
    const elbowX=phase==='raise'?x+9:(x+wx)*.5,elbowY=phase==='raise'?y-145:y-89;
    column(g,x-4,y-101+bob,elbowX,elbowY,13);
    column(g,elbowX,elbowY,wx,wy,11);
    for(let i=0;i<3;i++)column(g,wx-8+i*7,wy-8,wx-10+i*7,wy+9+i%2*4,5);
    if(phase==='exposed'){
      g.lineStyle(4,hot).lineBetween(wx-11,wy-8,wx+1,wy).lineBetween(wx+1,wy,wx-4,wy+10);
    }
    if(phase==='raise'||phase==='split'){
      if(phase==='split')g.fillStyle(dark).fillRect(b.left,floor-2,b.right-b.left,19);
      fracture(g,b.left,b.right,floor,phase==='raise'?clamp(b.ms/800)*.4:clamp(.4+b.ms/300));
    }
    const cue={arrival:'BASALT COLOSSUS',raise:'WATCH THE FIST',split:'JUMP THE SPLIT',exposed:'EXPOSED WRIST · CUT'}[phase];
    const lx=Math.min(s.cameraX+s.width-85,x-18),ly=Math.max(s.renderCameraY+65,floor-160);
    this.label.setText(cue||'').setPosition(lx,ly).setVisible(!!cue);
    for(let i=0;i<3;i++)g.fillStyle(i<b.hp?hot:basalt).fillRoundedRect(lx-23+i*16,ly+4,12,4,2);
  }
}
