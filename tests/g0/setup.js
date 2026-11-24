() => {
 const game=window.grimRun, s=game.scene.scenes[0];
 game.loop.sleep(); clearInterval(s.loopWatchdogId);
 window.S=s; window.ms=1000/60;
 window.paint=s.drawScene.bind(s);
 s.wakeGameLoop=()=>{}; s.drawScene=()=>{};
 window.start=(seed,meta={})=>{
   history.replaceState({},'', '?renderer=canvas&seed='+seed);
   localStorage.clear();s.meta=GRIM_META.normalize(meta); GRIM_META.save(s.meta);
   s.startRun(); if(s.state!=='playing') throw Error(s.state);
 };
 window.step=()=>s.update(0,ms);
}
