// The guardian runs alongside the Reaper. Its arm and the ground wave use the
// same moving coordinates for the artwork, collision and scythe contact.
const lengths={arrival:1500,ridge:1050,break:320,pace:850,draw:980,sweep:320,drag:1650,recover:760,struck:720,fall:1100};
const next={arrival:'ridge',ridge:'break',break:'pace',pace:'draw',draw:'sweep',sweep:'drag',drag:'recover',recover:'ridge',struck:'ridge',fall:'cleared'};
const clamp=t=>Math.min(1,Math.max(0,t));
const ease=t=>{const k=clamp(t);return k*k*(3-2*k);};

export class StoneGuardian {
  constructor(campaign){this.campaign=campaign;this.scene=campaign.scene;}
  enter(){
    const s=this.scene;
    this.campaign.guardian={phase:'arrival',ms:0,hp:3,round:0,hit:false,musicStart:s.elapsed,pursuit:true};
    for(const t of s.tips)t.label.destroy();
    s.tips=[];s.obstacles=[];s.enemies=[];s.fireballs=[];s.bullets=[];
  }
  length(b){return b.phase==='pace'?lengths.pace-b.round*130:lengths[b.phase];}
  geometry(b){
    const s=this.scene,p=s.player,x=p.x,y=s.terrain.anchorAt(x);
    const span=Math.min(210,s.width*.42),t=b.ms/this.length(b);
    const body=x+span+(b.phase==='arrival'?(1-ease(t))*130:0);
    let fist=body-32,high=72;
    if(b.phase==='draw'){fist+=ease(t)*38;high+=ease(t)*24;}
    if(b.phase==='sweep'){const swing=ease(b.ms/185);fist=body+6-(span+31)*swing;high=96-42*swing;}
    if(b.phase==='drag'){const drag=ease(b.ms/200);fist=x-25+91*drag;high=54-15*drag;}
    if(b.phase==='recover'||b.phase==='struck'){const pull=ease(t);fist=x+66+(span-98)*pull;high=39+33*pull;}
    const ridge=x+(b.phase==='ridge'?85*(1-ease(t)): -35*ease(t));
    return {body,y,fist,high,ridge};
  }
  step(dt){
    const b=this.campaign.guardian,s=this.scene,p=s.player;
    if(b.phase==='cleared')return;
    b.ms+=dt;
    if(!b.hit&&p.invulMs<=0&&(b.phase==='break'||b.phase==='sweep')){
      const {ridge,y,fist,high}=this.geometry(b);
      const box=b.phase==='break'?{x:ridge-16,y:y-35,width:32,height:35}
        :{x:fist-20,y:y-high-12,width:40,height:24};
      if(window.GRIM_CORE.overlaps(window.GRIM_CORE.collisionBox(p.x,p.y,s.lowProfile),box)){
        b.hit=true;p.invulMs=window.GRIM_CONFIG.damageInvulnerabilityMs;
        s.takeDamage(1,b.phase==='break'?'scree ridge':'stone arm');
        if(s.state!=='playing')return;
      }
    }
    if(b.ms>=this.length(b)){b.ms-=this.length(b);b.phase=next[b.phase];b.hit=false;}
  }
  cut(hits){
    const b=this.campaign.guardian;
    if(b.phase!=='drag'||b.ms<200)return;
    const {fist,y,high}=this.geometry(b);
    if(!hits({x:fist-16,y:y-high-17,width:32,height:34}))return;
    b.hp--;b.round++;b.phase=b.hp?'struck':'fall';b.ms=0;
    this.scene.puff(fist,y-high,0xf6ce90,11);
    window.GRIM_ACTION_AUDIO?.play('cut');
  }
  hide(){this.rocks?.setVisible(false);this.label?.setVisible(false);}
  render(){
    const s=this.scene,b=this.campaign.guardian;
    if(!this.campaign.active){this.hide();return;}
    if(!this.rocks){
      this.rocks=s.add.graphics().setDepth(7.5);
      this.label=s.add.text(0,0,'',{fontFamily:'Georgia, serif',fontStyle:'bold',fontSize:'14px',color:'#fff2d3',stroke:'#172027',strokeThickness:4}).setOrigin(.5,1).setDepth(12);
    }
    const g=this.rocks;g.setVisible(true).clear();
    if(!b){
      this.label.setVisible(false);
      // The three souls from the Forest exit lead the runner up the first rise.
      if(s.distance<110)for(let i=0;i<3;i++){
        const x=s.player.x+58+24*i+s.distance*1.3,y=s.terrain.anchorAt(x)-69-i*10+5*Math.sin(s.elapsed*3+i);
        g.fillStyle(0x96eddf,.22).fillEllipse(x,y,15,20);
        g.fillStyle(0xcefff0,.9).fillEllipse(x,y,6,10);
      }
      return;
    }
    const {body,y,fist,high,ridge}=this.geometry(b),phase=b.phase,t=clamp(b.ms/this.length(b));
    const drop=phase==='fall'?ease(t)*57:0,alpha=phase==='fall'?1-t:1;
    const stride=Math.sin(s.elapsed*7),shoulder=y-98+drop+3*Math.abs(stride),fy=y-high+drop;
    const stone=(x,cy,w,h,shade=0x546170)=>{
      const pts=[{x:x-w*.5,y:cy-h*.22},{x:x-w*.18,y:cy-h*.52},{x:x+w*.4,y:cy-h*.35},{x:x+w*.53,y:cy+h*.2},{x:x+w*.11,y:cy+h*.5},{x:x-w*.43,y:cy+h*.36}];
      g.fillStyle(shade,alpha).fillPoints(pts,true);
      g.fillStyle(0x889296,alpha).fillTriangle(pts[0].x,pts[0].y,pts[1].x,pts[1].y,pts[2].x,pts[2].y);
      g.fillStyle(0x303d47,alpha).fillTriangle(pts[2].x,pts[2].y,pts[3].x,pts[3].y,pts[4].x,pts[4].y);
    };
    for(const side of [-1,1]){
      const foot=body+side*stride*30,ankle=y-8-13*Math.max(0,side*stride);
      stone((body+foot)/2+side*10,shoulder+46,29,54);stone(foot,ankle,43,19);
    }
    stone(body,shoulder+18,63,73);stone(body-5,shoulder-28,41,36);
    g.lineStyle(3,0xffde93,alpha).lineBetween(body-20,shoulder-29,body-9,shoulder-31);
    stone(body-18,shoulder,47,35);
    const elbow=(body+fist)/2,ey=Math.min(fy,shoulder+14);
    g.lineStyle(17,0x3b4956,alpha).lineBetween(body-18,shoulder,elbow,ey).lineBetween(elbow,ey,fist,fy);
    stone(elbow,ey,30,30);stone(fist,fy,42,33);
    if(phase==='drag'&&b.ms>=200)g.lineStyle(4,0xffd48c,alpha).lineBetween(fist-9,fy-11,fist+2,fy).lineBetween(fist+2,fy,fist-5,fy+10);
    if(phase==='ridge'||phase==='break'){
      const h=phase==='break'?38:5+8*t;
      for(const offset of [-16,0,14])g.fillStyle(0x849094,1).fillTriangle(ridge+offset-8,y,ridge+offset+4,y-h+Math.abs(offset)*.35,ridge+offset+10,y);
      g.lineStyle(2,0xffd48c,.9).lineBetween(ridge-25,y-2,ridge+27,y-3);
    }
    const cues={arrival:'STONE GUARDIAN',ridge:'RIDGE · JUMP',draw:'ARM SWEEP · SLIDE',drag:b.ms>=200?'CRACKED WRIST · CUT':''};
    const lx=Math.min(s.cameraX+s.width-84,body-12),ly=Math.max(s.renderCameraY+70,shoulder-51);
    this.label.setText(cues[phase]||'').setPosition(lx,ly).setVisible(Boolean(cues[phase]));
    for(let i=0;i<3;i++)g.fillStyle(i<b.hp?0xffd48c:0x555b60,alpha).fillRoundedRect(lx-24+i*17,ly+4,13,4,2);
  }
}
