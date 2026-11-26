/* The review route uses the ordinary game scene. No progression flag is awarded
   at the edge of the existing Forest. */
(function(scope){
  'use strict';
  const KEY='grim-run-forest-attempt-v1', HISTORY=KEY+'-rewind-', END=900;
  const MODES=new Set(['playing','countdown','dying','revive','respawning','vendorIntro','upgrade','rewinding']);
  const fields=[
    'runLoadout','soulCount','runSoulsAvailable','freeLifeAvailable','freeLifeUsed','reviveUsed',
    'lastRevivePayment','lastResurrection','openingSoulClaimed','brambleSoulClaimed','rerollsRemaining',
    'lastVendorNumber','nextVendorNumber','vendorType','vendorPhase','vendorPurchased','vendorAcquiredId',
    'pendingOffers','vendorIntroMs','vendorIntroSeen','rushCooldownMs','rushNoticeMs','rewindClockMs',
    'rewindSampleMs','rewindCooldownMs','rewindFlashMs','respawnMs','respawnCamera','respawnNextMode',
    'deathPoseMs','fallCount','countdownMs','goFlashMs','encounterTelemetry'
  ];
  const motionFlags=['registeredAir','registeredAirCut','forwardActive','forwardAir','forwardSwing','forwardAttack'];
  const artAssets=['forwardReady','airReady','airCutReady','cutHandoffReady','cutWeaponReady'];
  const el=id=>document.getElementById(id);
  const visible=(id,on)=>el(id).classList.toggle('hidden',!on);
  const meta=()=>scope.GRIM_META;

  // The wallet and the exact frame containing its pickup/debit are committed in
  // one atomic write. Fold the frame into its ordinary slot before clearing the
  // recovery copy. Any interruption between those writes is safe to repeat.
  function recoverWallet(){
    let record;
    try{record=JSON.parse(localStorage.getItem(meta().KEY)||'null');}catch(error){
      if(error instanceof SyntaxError)return; // The wallet has its own legacy fallback.
      throw error;
    }
    if(!record?.forestRecovery)return;
    localStorage.setItem(KEY,record.forestRecovery);
    delete record.forestRecovery;
    localStorage.setItem(meta().KEY,JSON.stringify(record));
    try{localStorage.setItem(meta().LEGACY,String(record.souls));}catch(_){}
  }
  function readAttempt(){
    recoverWallet();
    const raw=localStorage.getItem(KEY);
    if(!raw)return null;
    const d=JSON.parse(raw);
    if(d.version!==1||d.chapter!=='forest'||typeof d.id!=='string'||!Number.isInteger(d.seed)||
      !MODES.has(d.mode)||!Number.isFinite(d.world?.player?.x)||!Array.isArray(d.history))
      throw Error('This Forest save could not be read.');
    return d;
  }

  class ForestCampaign {
    constructor(scene){
      this.scene=scene;
      this.active=false;
      this.frozen=false;
      this.historyIds=new WeakMap();
      this.historySerial=0;
      this.actions=[];
      const listen=(node,event,fn,options)=>{
        node.addEventListener(event,fn,options);
        scene.events.once('shutdown',()=>node.removeEventListener(event,fn,options));
      };
      for(const [index,id] of ['campaign-primary','campaign-secondary','campaign-back'].entries())
        listen(el(id),'click',()=>this.actions[index]?.());
      listen(el('campaign-save-menu'),'click',()=>{
        if(!this.active||!this.save())return;
        this.release();
        scene.goToMenu();
      });
      const suspend=()=>{
        if(!this.active)return false;
        this.pause();
        return true;
      };
      scene.ui.actions.suspendCampaign=suspend;
      listen(document,'visibilitychange',()=>{if(document.hidden)suspend();},true);
      listen(scope,'pagehide',suspend,true);
      // Button actions can happen between simulation frames (including a
      // purchase, a paid revival or the beginning of a jump).
      const a=scene.ui.actions;
      for(const name of ['jump','jumpEnd','slideStart','slideEnd','attack','rush','rewind',
        'chooseUpgrade','reroll','heal','declineDeal','leaveVendor','finishVendorIntro','revive','declineRevive']){
        const perform=a[name];
        a[name]=(...args)=>{
          if(this.active&&this.frozen)return;
          // Touch IDs do not survive a closed tab. Let the first matching
          // press reconnect to a held jump/slide without spending another use.
          if(this.active&&this.reconnect?.delete(name)){
            if(name==='jump'&&scene.player.jumpHeld&&!scene.player.grounded)return;
            if(name==='slideStart'&&scene.player.holdSlide)return;
          }
          const value=perform(...args);
          if(this.active)this.save();
          return value;
        };
      }
      scene.ui.holdActions={jump:[a.jump,a.jumpEnd],slide:[a.slideStart,a.slideEnd]};
      scene.events.once('shutdown',()=>this.release());
    }
    screen(title,detail,primary,secondary,back){
      const s=this.scene;
      s.state='campaignMenu';s.ui.setMode('campaignMenu');
      el('campaign-title').textContent=title;el('campaign-detail').textContent=detail;
      this.actions=[primary[1],secondary?.[1],back];
      el('campaign-primary').textContent=primary[0];
      el('campaign-secondary').textContent=secondary?.[0]||'';
      el('campaign-secondary').disabled=!secondary?.[1];
      visible('campaign-secondary',Boolean(secondary));visible('campaign-back',Boolean(back));
      el('campaign-title').focus({preventScroll:true});
    }
    modes(){
      this.screen('CHOOSE A MODE','',
        ['CAMPAIGN',()=>this.chapters()],['ENDLESS',()=>{this.resetMenu();this.scene.startRun();}],
        ()=>this.scene.goToMenu());
    }
    chapters(){
      try{
        const d=readAttempt();
        this.screen('CAMPAIGN','Forest review ends at the edge of the woods.',
          [d?'RESUME FOREST':'START FOREST',()=>this.enter()],
          ['FOOTHILLS · LOCKED',null],()=>this.modes());
      }catch(e){this.unreadable(e);}
    }
    unreadable(error){
      console.warn('Forest save:',error.message);
      this.screen('FOREST SAVE UNAVAILABLE','You can retry loading, or discard this attempt and keep your bank and Reliquaries.',
        ['TRY AGAIN',()=>this.chapters()],['DISCARD ATTEMPT…',()=>this.confirmDiscard()],()=>this.scene.goToMenu());
    }
    confirmDiscard(){
      this.screen('DISCARD THIS ATTEMPT?','Your next Forest attempt will start at the beginning.',
        ['KEEP SAVE',()=>this.chapters()],['DISCARD ATTEMPT',async()=>{
          try{
            await navigator.locks.request(KEY,{ifAvailable:true},lock=>{
              if(!lock)throw Error('Another tab has this attempt open.');
              recoverWallet();this.endAttempt();this.chapters();
            });
          }catch(e){this.unreadable(e);}
        }]);
    }
    resetMenu(){
      this.retryForest=false;
      el('retry-btn').textContent='RUN AGAIN ↻';
      visible('campaign-save-menu',false);el('resume-btn').disabled=false;
      el('god-mode-checkbox').closest('label').classList.remove('hidden');
      document.querySelector('.god-mode-desc').classList.remove('hidden');
    }
    startAction(){
      if(this.retryForest&&this.scene.state==='dead')return this.enter();
      if(this.scene.state==='menu')return this.modes();
      return this.scene.startRun();
    }
    openSavedOnLoad(){
      try{if(readAttempt())this.enter();}
      catch(e){this.unreadable(e);}
    }
    async enter(){
      if(this.busy||this.active)return;
      this.busy=true;
      try{
        if(!navigator.locks)throw Error('Exclusive save access is unavailable.');
        await navigator.locks.request(KEY,{ifAvailable:true},async lock=>{
          if(!lock){
            this.screen('FOREST IS OPEN','Return to the tab with your Forest attempt.',
              ['TRY AGAIN',()=>this.enter()],['MAIN MENU',()=>this.scene.goToMenu()]);
            return;
          }
          const d=readAttempt(),s=this.scene;
          if(s.reactionLoadFailed||s.portalArtLoadFailed){s.goToMenu();return;}
          const held=new Promise(resolve=>{this.unlock=resolve;});
          try{
            s.meta=meta().load();
            this.id=d?.id||crypto.randomUUID();
            this.active=true;this.frozen=false;this.walletDirty=false;this.retryForest=true;
            s.frame=0;s.lastRevivePayment=null;s.lastResurrection=null;
            s.startRun(d?.seed);
            // Items and preplaced obstacles in later biomes never enter this chapter.
            const limit=s.startX+END*scope.GRIM_CONFIG.pxPerMeter+1500;
            for(const key of ['coins','souls','obstacles'])s[key]=s[key].filter(o=>o.x<limit);
            el('retry-btn').textContent='RETRY FOREST';
            visible('campaign-save-menu',true);
            el('god-mode-checkbox').closest('label').classList.add('hidden');
            document.querySelector('.god-mode-desc').classList.add('hidden');
            if(d){this.restore(d);this.pause();}
            else this.save();
            await held;
          }catch(e){this.release();throw e;}
        });
      }catch(e){this.unreadable(e);}
      finally{this.busy=false;}
    }
    release(){
      this.active=false;this.frozen=false;this.walletDirty=false;this.reconnect=null;
      this.requiredArt=null;cancelAnimationFrame(this.artWait);
      this.unlock?.();this.unlock=null;
    }
    endAttempt(){
      localStorage.removeItem(KEY);
      for(let i=0;i<256;i++)localStorage.removeItem(HISTORY+i);
      this.release();
    }
    afterFrame(){
      if(!this.active)return;
      if(this.scene.distance>=END&&this.scene.state==='playing'){
        this.endAttempt();
        this.screen('FOREST REVIEW COMPLETE','The Forest boss will guard the path to Foothills.',
          ['RETRY FOREST',()=>this.enter()],['MAIN MENU',()=>this.scene.goToMenu()]);
      }else this.save();
    }
    togglePause(){
      if(this.frozen)this.continueAttempt();
      else if(['playing','countdown'].includes(this.scene.state))this.pause();
    }
    pause(){
      if(!this.frozen){
        if(!MODES.has(this.scene.state))return;
        this.resumeMode=this.scene.state;this.frozen=true;
      }
      this.scene.state='paused';this.scene.ui.setMode('paused');
      this.scene.drawScene();
      this.save();
    }
    continueAttempt(){
      if(!this.frozen||this.scene.state!=='paused'||this.requiredArt)return;
      const s=this.scene;
      this.reconnect=new Set();
      if(s.player.jumpHeld)this.reconnect.add('jump');
      if(s.player.holdSlide)this.reconnect.add('slideStart');
      this.frozen=false;s.state=this.resumeMode;s.cutsceneLastAt=null;
      s.ui.setMode(s.state);
      if(s.state==='upgrade')s.showVendor();
      if(s.state==='revive')s.ui.offerRevive(s.meta.souls,s.runSoulsAvailable);
      if(s.state==='countdown')s.ui.updateCountdown(s.countdownMs/1000);
      s.ui.showRewindPlayback(s.state==='rewinding');
      s.ui.showTimeSlow(s.player.slowMs>0);
      s.ui.showFallNotice(s.fallFeedbackMs>0);s.refreshHud();s.updateRewindButton();
      s.syncWorldScroll();s.drawScene();s.wakeGameLoop();
    }
    rotateHistory(dy,widthDelta){
      const s=this.scene,dx=widthDelta*scope.GRIM_CONFIG.reaperXRatio;
      for(const f of new Set([...s.rewindFrames,...(s.rewindPlayback?.frames||[])])){
        this.historyIds.delete(f);
        f.player.y+=dy;f.cameraY+=dy;f.cameraX-=dx;
        for(const e of f.enemies){e.y+=dy;e.homeY+=dy;}
        for(const b of [...f.bullets,...f.fireballs,...f.combatViews])b.y+=dy;
        for(const item of [...f.coins,...f.souls])item.baseY+=dy;
        for(const tile of f.rubble){tile.y0+=dy;tile.y1+=dy;}
        s.resizeObstacles(f.obstacles,dy);
      }
      if(s.graveRush){s.graveRush.fromY+=dy;s.graveRush.departure.y+=dy;}
    }
    historyId(frame){
      if(this.historyIds.has(frame))return this.historyIds.get(frame);
      // At 10Hz the active Rewind window retains at most 86 frames.
      const id=this.historySerial%256;
      localStorage.setItem(HISTORY+id,JSON.stringify([frame,this.scene.downhillCamera?.rewindOffsets.get(frame)||0]));
      this.historySerial++;this.historyIds.set(frame,id);
      return id;
    }
    snapshot(){
      const s=this.scene,r=s.graveRush,clip=s.rewindPlayback;
      return {version:1,chapter:'forest',id:this.id,seed:s.seed,mode:this.frozen?this.resumeMode:s.state,
        width:s.width,height:s.height,world:s.worldSnapshot(),
        run:Object.fromEntries(fields.map(k=>[k,s[k]])),powers:s.powerManager.levels,
        terrain:[...s.rewindTerrainBase],downhill:s.downhillCamera?.offset||0,
        history:s.rewindFrames.map(f=>this.historyId(f)),
        playback:clip?{elapsedMs:clip.elapsedMs,durationMs:clip.durationMs,lastIndex:clip.lastIndex,
          frames:clip.frames.map(f=>this.historyId(f)),target:this.historyId(clip.target)}:null,
        rush:r?{...r,hit:[...r.hit].map(e=>s.enemies.indexOf(e)).filter(i=>i>=0)}:null,
        motion:Object.fromEntries(motionFlags.map(k=>[k,s.motionArt?.[k]])),
        art:this.requiredArt||artAssets.filter(k=>s.motionArt?.[k]),
        particles:s.particles,chainArcs:s.chainArcs,defeat:s.reactionArt?.defeat,
        tipped:[...s.tipped],tips:s.tips.map(t=>[t.atX,t.baseY,t.label.x,t.label.text]),
        nextHistory:this.historySerial};
    }
    save(){
      if(!this.active)return false;
      try{
        const raw=JSON.stringify(this.snapshot());
        if(this.walletDirty){
          const record=meta().normalize(this.scene.meta);
          record.forestRecovery=raw;
          localStorage.setItem(meta().KEY,JSON.stringify(record));
          recoverWallet();
          this.walletDirty=false;
        }else localStorage.setItem(KEY,raw);
        return true;
      }catch(e){
        if(!this.frozen)this.resumeMode=this.scene.state;
        this.frozen=true;
        this.screen('FOREST SAVE PAUSED','Free some browser storage, then retry saving this attempt.',
          ['RETRY SAVE',()=>this.pause()]);
        return false;
      }
    }
    restore(d){
      const s=this.scene,w=d.world,current={width:s.width,height:s.height};
      // Recreate the seeded geometry in the original coordinate space, then use
      // the standard rotation path once if this device now has another viewport.
      if(d.width!==s.width||d.height!==s.height)s.handleResize({width:d.width,height:d.height});
      s.rewindTerrainBase=new Map(d.terrain);
      Object.assign(s.powerManager.levels,d.powers);
      for(const name of fields)s[name]=d.run[name];
      s.applyRewindSnapshot(w);
      Object.assign(s.player,w.player); // Rewind cancels held actions. A resumed frame preserves them.
      s.goFlashMs=d.run.goFlashMs;s.downhillCamera&&(s.downhillCamera.offset=d.downhill);
      s.graveRush=d.rush?{...d.rush,hit:new Set(d.rush.hit.map(i=>s.enemies[i]))}:null;
      s.particles=d.particles;s.chainArcs=d.chainArcs;
      if(s.reactionArt)s.reactionArt.defeat=d.defeat;
      s.tipped=new Set(d.tipped);
      for(const t of s.tips)t.label.destroy();
      s.tips=d.tips.map(([atX,baseY,x,text])=>{
        const label=s.add.text(x,baseY,text,{fontFamily:'system-ui,Arial,sans-serif',fontSize:'20px',
          fontStyle:'900',color:'#e2fff7',stroke:'#09101c',strokeThickness:6,align:'center'}).setOrigin(.5).setDepth(35);
        label.setShadow(0,2,'#081017',5,true,true);
        return {label,atX,baseY};
      });
      const frames=new Map();
      const frame=id=>{
        if(!frames.has(id)){
          const [value,offset]=JSON.parse(localStorage.getItem(HISTORY+id));
          frames.set(id,value);this.historyIds.set(value,id);s.downhillCamera?.rewindOffsets.set(value,offset);
        }
        return frames.get(id);
      };
      this.historySerial=d.nextHistory;
      s.rewindFrames=d.history.map(frame);
      s.rewindPlayback=d.playback?{...d.playback,frames:d.playback.frames.map(frame),target:frame(d.playback.target)}:null;
      s.state=d.mode;
      if(s.motionArt){
        Object.assign(s.motionArt,d.motion);
        s.motionArt.airPlayer=s.player;s.motionArt.forwardPlayer=s.player;
      }
      // Some painted swing families own the contact geometry. A cold reload
      // must finish loading the family already in use before accepting Cut.
      if(d.art.some(k=>!s.motionArt?.[k])){
        this.requiredArt=d.art;
        el('resume-btn').disabled=true;
        const ready=()=>{
          if(!this.active)return;
          if(this.requiredArt.some(k=>!s.motionArt?.[k])){
            this.artWait=requestAnimationFrame(ready);return;
          }
          this.requiredArt=null;el('resume-btn').disabled=false;s.drawScene();
        };
        this.artWait=requestAnimationFrame(ready);
      }
      if(d.width!==current.width||d.height!==current.height)s.handleResize(current);
      s.totalSouls=s.meta.souls;s.updateRewindButton();s.refreshHud();s.syncWorldScroll();
    }
  }
  scope.GrimForestCampaign=ForestCampaign;
})(window);
