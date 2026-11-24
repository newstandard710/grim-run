// Use the real scene and its seeded generator. Fast-forward to the approach, then
// paint every physics step while the driver presses the normal on-screen buttons.
() => {
  const game = window.grimRun, s = game.scene.scenes[0], dt = 1000/60;
  game.loop.sleep();
  clearInterval(s.loopWatchdogId);
  s.wakeGameLoop = () => {};
  s.sys.sceneUpdate = () => {};
  const paint = s.drawScene.bind(s);
  window.scene = s;
  window.begin = (seed, zone) => {
    history.replaceState({}, '', '?seed=' + seed);
    s.startRun();
    s.drawScene = () => {};
    const firstTree = 205 + seed%13, secondTree = 365 + seed%17;
    const start = {forest:firstTree-40, practice:secondTree-40, foothills:923, chain:1565}[zone];
    let gapDone, last;
    // G0 geometric response policy, no purchases. Invulnerability is only for
    // reaching the sample; the scored interval starts with ordinary base HP.
    s.godMode = true;
    while (s.distance < start) {
      if (s.state === 'vendorIntro') s.finishVendorIntro();
      if (s.state === 'upgrade') s.leaveVendor();
      const p = s.player, x = p.x;
      const gap = s.terrain.segments.find(z => z.kind==='gap' && z.start>=x && z.start-x<s.speed*.20);
      const ob = s.obstacles.find(o => !o.destroyed && !o.dealtDamage && o.x+o.width>=x-15 && o.x-x<=s.speed*.32+22);
      if (p.holdSlide && ob?.type!=='branch') s.endSlide();
      if (p.grounded && gap && gap!==gapDone) { s.jump(); gapDone=gap; }
      if (ob && ob!==last) {
        if (ob.type==='rock'||ob.type==='fire') s.jump();
        else if (ob.type==='branch') s.startSlide();
        else s.attack();
        last=ob;
      }
      s.update(0,dt);
    }
    s.godMode=false;
    window.sample={frame:0, landed:[], cues:[], costs:[], events:[], before:s.player.hp};
    const group = s.terrain.sequences[zone==='chain'?4:1];
    const targetX = zone==='forest'||zone==='practice'
      ? s.startX+12*(zone==='forest'?firstTree:secondTree) : group.treeX;
    const gaps = zone==='foothills'||zone==='chain'
      ? s.terrain.segments.filter(z=>z.kind==='gap'&&z.group===group.id) : [];
    window.trial={targetX,gaps:gaps.map(z=>z.start), end:(targetX??group.endX)+115};
    if (zone==='forest'||zone==='practice') trial.end=targetX+115;
    s.drawScene=paint;
    paint();
  };
  window.advanceUntil = (x, capture=false) => {
    const v=sample;
    while(scene.player.x<x && scene.state==='playing'){
      const was=scene.player.grounded, t=performance.now();
      scene.update(0,dt);
      game.step(performance.now(),0);
      v.costs.push(performance.now()-t);
      ++v.frame;
      if(!was&&scene.player.grounded)v.landed.push(v.frame);
      const ob=scene.obstacles.find(o=>o.x===trial.targetX);
      if(ob && !v.cues.length && ob.x<=scene.cameraX+scene.width)v.cues.push(v.frame);
      if(ob) v.tree={type:ob.type, destroyed:ob.destroyed, hit:ob.dealtDamage};
      if(v.frame>1800)throw Error('sample did not advance');
      if(capture)break;
    }
    return scene.player.x;
  };
}
