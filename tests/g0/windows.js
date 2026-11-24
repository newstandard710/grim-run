() => {
 const s=S, out=[];
 // First naturally generated Forest obstacle. Frame 0 is the first edge of
 // the obstacle's visible sprite bounds. The tip is a separate visual cue.
 for(const [seed,type] of [[1,'rock'],[3,'bramble'],[33,'branch']]){
  let screen=null, contact=null, warn=null, samples=[];
  for(let press=-1;press<=157;press+=press===-1?1:2){
   start(seed); const hp=s.player.hp;
   // Prime the forward-carry pose before restoring automatic painting only
   // around the Cut. Empty inputs and release use the same update sequence.
   if(typeof paint==='function')paint();
   let ob=null, fired=null, owner=null;
   for(let frame=0;frame<310;frame++){
    step();
    ob=ob||s.obstacles.find(o=>o.type===type&&Math.abs(o.x-1050)<1);
    if(!ob)continue;
    if(press===-1 && frame%2===0 && (warn===null||screen===null) && typeof paint==='function'){
      paint();
      const obj=s.obstacleSpriteObjects?.get(ob), tip=s.tips.find(t=>t.atX===ob.x);
      const box=obj?.visible&&obj.getBounds();
      if(box&&box.left<s.cameraX+s.width&&box.right>s.cameraX&&box.top<s.cameraY+s.height&&box.bottom>s.cameraY)screen??=frame;
      if(tip&&tip.label.getBounds().left<s.cameraX+s.width)warn??=frame;
    }
    if(press===-1 && screen===null && ob.x<=s.cameraX+s.width && typeof paint!=='function')screen=frame;
    if(press>=0 && frame===(warn??screen??0)+press){
      if(type==='rock')s.jump();else if(type==='branch')s.startSlide();else s.attack();
      fired=frame;owner=s.player.risingCut?.mode||null;
    }
    if(type==='bramble' && fired!==null && frame<=fired+18 && typeof paint==='function')paint();
    if(ob.dealtDamage||ob.destroyed||s.player.x>ob.x+ob.width+55){
      if(press===-1)contact=frame;
      samples.push({press,fired,success:s.player.hp===hp,owner});break;
    }
   }
  }
  out.push({seed,type,firstSpriteBoundsFrame:screen,firstHintBoundsFrame:warn,missContactFrame:contact,samples});
 }
 return out;
}
