() => {
 const s=S, out=[];
 for(const seed of [1,2,3,17,33,73]) for(const style of ['miss','late','timed','practice']){
   start(seed); const practice=style==='practice';
   if(practice && seed!==33)continue;
   if(practice)s.godMode=true;
   let hits=[], inputs=[], vendors=[], last=null, length=0, groups={}, seen=new Set(), gapDone=null, tips=[], measures=[];
   const damage=s.takeDamage.bind(s);
   s.takeDamage=function(a,k,...args){hits.push([Math.round(s.distance),k,s.player.hp,t]);return damage(a,k,...args)};
   let t=0;
   for(;t<30000;t++){
    if(s.state==='revive'){s.declineRevive();break;}
    if(s.state==='dead'||s.state==='won'||s.distance>10400)break;
    if(s.state==='vendorIntro')s.finishVendorIntro();
    if(s.state==='upgrade'){vendors.push([Math.round(s.distance),s.vendorType,s.coinCount]);s.leaveVendor();}
    if(s.state==='chest')s.finishChest();
    if(s.state==='playing'){
     const p=s.player, speed=s.speed, x=p.x;
     for(const ob of s.obstacles)if(!ob.destroyed && !seen.has(ob)&&ob.x<=s.cameraX+s.width&&ob.x+ob.width>x){
       seen.add(ob);groups[ob.type]=(groups[ob.type]||0)+1;
       const tip=s.tips.find(v=>v.atX===ob.x);
       if(tip)tips.push([Math.round((ob.x-200)/12),tip.label.text,tip.label.y-s.cameraY]);
     }
     const lead=(style==='late'?.045:.32)*speed;
     const gap=s.terrain.segments.find(z=>z.kind==='gap'&&z.start>=x&&z.start-x<speed*.20);
     let ob=s.obstacles.filter(o=>!o.destroyed&&!o.dealtDamage&&o.x+o.width>=x-15&&o.x-x<=lead+22).sort((a,b)=>a.x-b.x)[0];
     if(style!=='miss'){
      let action=null;
      if(p.holdSlide && (!ob||ob.type!=='branch')&&p.grounded)s.endSlide();
      if(gap && gap!==gapDone && p.grounded){s.jump();gapDone=gap;action='gap jump';if(s.obstacles.some(o=>o.type==='tuckGate'&&Math.abs(o.x-gap.start)<160)){s.startSlide();}}
      if(ob!==last&&ob){
       if(ob.type==='rock'||ob.type==='fire'){s.jump();action='jump';}
       else if(ob.type==='branch'){s.startSlide();action='slide';}
       else {s.attack();action='cut';}
       last=ob;
      }
      if(s.gunUnlocked&&s.enemies.some(e=>!e.dead&&e.x>x)&&s.fireCrossbow())action='crossbow';
      if(action)inputs.push([t,Math.round(s.distance),action]);
     }
     length++;
     if(t%120===0)measures.push([t,Math.round(s.distance),p.hp,s.coinCount,s.soulCount]);
    }
    step();
   }
   delete s.takeDamage;
   out.push({seed,style,simSeconds:+(t/60).toFixed(2),playSeconds:+(length/60).toFixed(2),end:s.state,distance:Math.round(s.distance),collectedGold:s.goldCollected,wallet:s.meta.souls,groups,tips,hits,inputs,vendors,measures});
 }
 return out;
}
