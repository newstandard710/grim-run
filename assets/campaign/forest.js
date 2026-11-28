import {BasaltColossus} from './basalt-colossus.js?v=1fa2ef9a706d';
import {CinderKeeper} from './cinder-keeper.js?v=fde6937bc070';
import {PrismSentinel} from './prism-sentinel.js?v=8d6ca4290ea8';
import {Broodmother} from './broodmother.js?v=e635a13845b5';
import {FrostCrown} from './frost-crown.js?v=ae5176d81a91';
import {StoneGuardian} from './stone-guardian.js?v=311b7559c68b';
import {ForestScore} from '../audio/forest-score.js?v=689897823a22';
import {ForestGuardian} from './guardian.js?v=7c5c7044c30f';

import {forestRoute} from './route.js?v=8275b2e64856';

(function(scope){
  'use strict';
  const LEGACY_END=900;
  const meta=()=>scope.GRIM_META;
  const slot=chapter=>meta().saveKey('grim-run-'+chapter+'-attempt-v1');
  const title=chapter=>chapter[0].toUpperCase()+chapter.slice(1);
  const nextChapter={forest:'foothills',foothills:'tundra',tundra:'caves',caves:'crystals',crystals:'ashlands',ashlands:'lava',lava:'finalRealm'};
  const tracks={forest:['walk','guardian'],foothills:['climb','pursuit'],tundra:['crossing','crown'],caves:['descent','brood'],crystals:['gallery','sentinel'],ashlands:['march','keeper'],lava:['causeway','colossus']};
  const openingKey=chapter=>meta().saveKey(chapter==='forest'?'grim-run-forest-opening-seen-v1':'grim-run-'+chapter+'-intro-seen');
  const canEnter=(chapter,record)=>Object.hasOwn(nextChapter,chapter)&&(meta().testSave||chapter==='forest'||
    record[chapter+'Unlocked']||Object.keys(nextChapter).some(previous=>nextChapter[previous]===chapter&&record[previous]?.cleared));
  const progress=()=>JSON.parse(localStorage.getItem(meta().CAMPAIGN_PROGRESS)||'{}');
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
    const chapter=JSON.parse(record.forestRecovery).chapter;
    if(!['forest','foothills','tundra','caves','crystals','ashlands','lava'].includes(chapter))throw Error('Invalid Campaign recovery record.');
    localStorage.setItem(slot(chapter),record.forestRecovery);
    delete record.forestRecovery;
    localStorage.setItem(meta().KEY,JSON.stringify(record));
    try{localStorage.setItem(meta().LEGACY,String(record.souls));}catch(_){}
  }
  function readAttempt(chapter){
    recoverWallet();
    const raw=localStorage.getItem(slot(chapter));
    if(!raw)return null;
    const d=JSON.parse(raw);
    // Completion is authoritative even if cleanup was interrupted during a menu transition.
    if(typeof d?.id==='string'&&progress()[chapter]?.attempt===d.id)return null;
    if((d.routeVersion!==undefined&&![1,2].includes(d.routeVersion))||d.version!==1||d.chapter!==chapter||typeof d.id!=='string'||!Number.isInteger(d.seed)||
      !MODES.has(d.mode)||!Number.isFinite(d.world?.player?.x)||!Array.isArray(d.history))
      throw Error('This '+title(chapter)+' save could not be read.');
    return d;
  }

  class ForestCampaign {
    constructor(scene){
      this.scene=scene;
      this.score=new ForestScore();
      scene.ui.actions.syncCampaignScore=mode=>this.syncScore(mode);
      el('music-settings').dataset.available='1';
      this.chapter='forest';
      this.encounters={forest:new ForestGuardian(this),foothills:new StoneGuardian(this),tundra:new FrostCrown(this),caves:new Broodmother(this),crystals:new PrismSentinel(this),ashlands:new CinderKeeper(this),lava:new BasaltColossus(this)};
      this.encounter=this.encounters.forest;
      this.active=false;
      this.frozen=false;
      this.historyIds=new WeakMap();
      this.historySerial=0;
      this.actions=[];
      const listen=(node,event,fn,options)=>{
        node.addEventListener(event,fn,options);
        scene.events.once('shutdown',()=>node.removeEventListener(event,fn,options));
      };
      for(const [index,id] of ['campaign-primary','campaign-secondary'].entries())
        listen(el(id),'click',()=>this.actions[index]?.());
      listen(el('campaign-lava'),'click',()=>this.enter('lava'));
      listen(el('campaign-ashlands'),'click',()=>this.enter('ashlands'));
      listen(el('campaign-crystals'),'click',()=>this.enter('crystals'));
      listen(el('campaign-caves'),'click',()=>this.enter('caves'));
      listen(el('campaign-tundra'),'click',()=>this.enter('tundra'));
      listen(el('campaign-save-menu'),'click',()=>{
        if(!this.active||!this.save())return;
        this.release();
        scene.goToMenu();
      });
      listen(el('campaign-story-replay'),'click',()=>this.playStory(false,()=>this.chapters()));
      listen(el('forest-story-skip'),'click',()=>this.finishStory?.());
      const suspend=()=>{
        this.finishStory?.();
        if(!this.active)return false;
        if(this.guardian?.phase!=='cleared')this.pause();
        return true;
      };
      scene.ui.actions.suspendCampaign=suspend;
      listen(document,'visibilitychange',()=>{if(document.hidden)suspend();},true);
      listen(scope,'pagehide',suspend,true);
      // Button actions can happen between simulation frames (including a
      // purchase, a paid revival or the beginning of a jump).
      const a=scene.ui.actions;
      for(const name of ['jump','jumpEnd','slideStart','slideEnd','attack','fireCrossbow','rush','rewind',
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
      scene.events.once('shutdown',()=>{
        this.stopStory?.();
        this.release();
        this.score.dispose();
        delete el('music-settings').dataset.available;
      });
    }
    syncScore(mode){
      if(this.showingVictory&&(mode==='campaignMenu'||mode==='forestStory'))return;
      if(!this.active||this.frozen||mode!=='playing'){this.score.select(null);return;}
      const b=this.guardian;
      if(b?.phase==='fall'||b?.phase==='cleared')this.score.select('victory',b.ms/1000);
      else if(b)this.score.select(tracks[this.chapter][1],this.scene.elapsed-(b.musicStart??this.scene.elapsed));
      else this.score.select(tracks[this.chapter][0],this.scene.elapsed);
    }
    playStory(ending,done,chapter='forest'){
      const s=this.scene,film=el('forest-story-film');
      const camera=s.cameras.main,worldVisible=camera.visible;
      s.state='forestStory';s.ui.setMode(s.state);
      camera.visible=false;
      el('forest-story').setAttribute('aria-label',chapter==='lava'?'Beyond the cooling river, the gates of the final realm appear.':chapter==='ashlands'?'The last coals blow across the ash and reveal a river of lava.':chapter==='crystals'?'A seam of ember light opens through the crystals onto the Ashlands.':ending
        ? 'The roots part. Escaped Souls climb into the Foothills.'
        : 'Escaped Souls slip past tangled roots before the passage closes.');
      el('forest-story-skip').focus({preventScroll:true});
      // A missing or stalled decorative film must always yield to the run or reward.
      const finish=()=>{
        if(this.finishStory!==finish)return;
        this.stopStory();
        done();
      };
      const timer=setTimeout(finish,8000);
      this.finishStory=finish;
      this.stopStory=()=>{
        this.finishStory=null;this.stopStory=null;
        camera.visible=worldVisible;
        clearTimeout(timer);
        film.onended=null;film.onerror=null;
        film.pause();film.removeAttribute('src');film.load();
      };
      film.onended=finish;film.onerror=finish;
      film.src=new URL(chapter==='lava'?'./final-realm-passage.webm':chapter==='ashlands'?'./lava-passage.webm':chapter==='crystals'?'./ashlands-passage.webm':ending?'./passage-open.webm':'./passage-sealed.webm',import.meta.url).href;
      film.play().catch(finish);
    }
    screen(title,detail,primary,secondary,back){
      const s=this.scene;
      s.state='campaignMenu';s.ui.setMode('campaignMenu');
      el('campaign-title').textContent=title;el('campaign-detail').textContent=detail;
      visible('campaign-story-replay',false);visible('campaign-tundra',false);visible('campaign-caves',false);visible('campaign-crystals',false);visible('campaign-ashlands',false);visible('campaign-lava',false);
      this.actions=[primary[1],secondary?.[1]];
      this.back=back;
      el('campaign-primary').textContent=primary[0];
      el('campaign-secondary').textContent=secondary?.[0]||'';
      el('campaign-secondary').disabled=!secondary?.[1];
      visible('campaign-secondary',Boolean(secondary));visible('campaign-back',Boolean(back));
      el('campaign-title').focus({preventScroll:true});
    }
    chapters(){
      try{
        const record=progress(),foothills=canEnter('foothills',record);
        const savedLabel=(chapter,fresh,replay)=>{
          try{return readAttempt(chapter)?'RESUME '+title(chapter).toUpperCase():record[chapter]?.cleared?replay:fresh;}
          catch{return 'OPEN '+title(chapter).toUpperCase()+' SAVE';}
        };
        const forest=savedLabel('forest','START FOREST','REPLAY FOREST');
        const tundra=canEnter('tundra',record);
        const caves=canEnter('caves',record);
        const crystals=canEnter('crystals',record),ashlands=canEnter('ashlands',record),lava=canEnter('lava',record);
        const detail=meta().testSave?'Test save · Choose any playable chapter.':record.finalRealmUnlocked?'Lava cleared. The final realm is in development.':lava?'Ashlands cleared. Lava is unlocked. Cross the cooling basalt.':ashlands?'Crystals cleared. Ashlands is unlocked. Follow the embers.':crystals?'Caves cleared. Crystals is unlocked. Follow the light.':caves?'Tundra cleared. Caves is unlocked. Follow the silk underground.':tundra?'Foothills cleared. Tundra is unlocked. Cross the ice field.':
          foothills?'Forest cleared. Foothills is unlocked. Follow the Souls up the ridge.':'A guardian keeps watch at the edge of the woods.';
        this.screen('CAMPAIGN',detail,[forest,()=>this.enter('forest')],
          foothills?[savedLabel('foothills','START FOOTHILLS','REPLAY FOOTHILLS'),()=>this.enter('foothills')]:
            ['FOOTHILLS · LOCKED',null],()=>this.scene.closeCampaignMenu());
        visible('campaign-lava',ashlands||lava);
        el('campaign-lava').disabled=!lava;
        el('campaign-lava').textContent=lava?savedLabel('lava','START LAVA','REPLAY LAVA'):'LAVA · LOCKED';
        visible('campaign-ashlands',crystals||ashlands);
        el('campaign-ashlands').disabled=!ashlands;
        el('campaign-ashlands').textContent=ashlands?savedLabel('ashlands','START ASHLANDS','REPLAY ASHLANDS'):'ASHLANDS · LOCKED';
        visible('campaign-crystals',caves||crystals);
        el('campaign-crystals').disabled=!crystals;
        el('campaign-crystals').textContent=crystals?savedLabel('crystals','START CRYSTALS','REPLAY CRYSTALS'):'CRYSTALS · LOCKED';
        visible('campaign-caves',tundra||caves);
        el('campaign-caves').disabled=!caves;
        el('campaign-caves').textContent=caves?savedLabel('caves','START CAVES','REPLAY CAVES'):'CAVES · LOCKED';
        visible('campaign-tundra',foothills);
        el('campaign-tundra').disabled=!tundra;
        el('campaign-tundra').textContent=tundra?savedLabel('tundra','START TUNDRA','REPLAY TUNDRA'):'TUNDRA · LOCKED';
        visible('campaign-story-replay',Boolean(forest==='RESUME FOREST'||record.forest?.cleared||record.foothillsUnlocked||this.openingSeen||localStorage.getItem(openingKey('forest'))==='1'));
      }catch(e){this.unreadable(e);}
    }
    unreadable(error){
      console.warn(title(this.chapter)+' save:',error.message);
      this.screen(title(this.chapter).toUpperCase()+' SAVE UNAVAILABLE','You can retry loading, or discard this attempt and keep your bank and Reliquaries.',
        ['TRY AGAIN',()=>this.chapters()],['DISCARD ATTEMPT…',()=>this.confirmDiscard()],()=>this.scene.goToMenu());
    }
    confirmDiscard(){
      this.screen('DISCARD THIS ATTEMPT?','Your next '+title(this.chapter)+' attempt will start at the beginning.',
        ['KEEP SAVE',()=>this.chapters()],['DISCARD ATTEMPT',async()=>{
          try{
            await navigator.locks.request(slot('forest'),{ifAvailable:true},lock=>{
              if(!lock)throw Error('Another tab has this attempt open.');
              recoverWallet();this.endAttempt();this.chapters();
            });
          }catch(e){this.unreadable(e);}
        }]);
    }
    resetMenu(){
      this.retryForest=false;
      visible('music-settings',false);
      el('retry-btn').textContent='RUN AGAIN ↻';
      visible('campaign-save-menu',false);el('resume-btn').disabled=false;
      el('god-mode-checkbox').closest('label').classList.remove('hidden');
      document.querySelector('.god-mode-desc').classList.remove('hidden');
    }
    async enter(chapter=this.chapter){
      if(this.busy||this.active)return;
      if(!canEnter(chapter,progress()))return;
      this.chapter=chapter;this.encounter=this.encounters[chapter];
      const name=title(chapter),label=name.toUpperCase();
      this.busy=true;
      try{
        if(!navigator.locks)throw Error('Exclusive save access is unavailable.');
        await navigator.locks.request(slot('forest'),{ifAvailable:true},async lock=>{
          if(!lock){
            this.screen(label+' IS OPEN','Return to the tab with the active Campaign attempt.',
              ['TRY AGAIN',()=>this.enter()],['MAIN MENU',()=>this.scene.goToMenu()]);
            return;
          }
          const d=readAttempt(chapter),s=this.scene;
          if(s.reactionLoadFailed||s.portalArtLoadFailed){s.goToMenu();return;}
          const held=new Promise(resolve=>{this.unlock=resolve;});
          try{
            s.meta=meta().load();
            this.id=d?.id||crypto.randomUUID();
            this.active=true;this.frozen=false;this.walletDirty=false;this.retryForest=true;
            this.encounter.prepare?.();
            s.frame=0;s.lastRevivePayment=null;s.lastResurrection=null;
            this.routeVersion=d?(d.routeVersion??1):2;
            s.startRun(d?.seed);
            // Items and preplaced obstacles in later biomes never enter this chapter.
            const limit=this.entranceX+1500;
            for(const key of ['coins','souls','obstacles'])s[key]=s[key].filter(o=>o.x<limit);
            el('retry-btn').textContent='RETRY '+label;
            visible('campaign-save-menu',true);visible('music-settings',true);
            el('god-mode-checkbox').closest('label').classList.add('hidden');
            document.querySelector('.god-mode-desc').classList.add('hidden');
            if(d){this.openingSeen=true;this.restore(d);this.pause();}
            else if(this.save()){
              if(['tundra','caves','crystals','ashlands','lava'].includes(chapter)&&!localStorage.getItem(openingKey(chapter)))this.chapterOpening();
              if(chapter==='forest'&&!this.openingSeen&&!progress().forest&&localStorage.getItem(openingKey('forest'))!=='1'){
                this.openingSeen=true;
                // The attempt is durable at the starting frame before the first image.
                try{localStorage.setItem(openingKey('forest'),'1');}catch{}
                this.frozen=true;this.resumeMode=s.state;
                this.playStory(false,()=>{
                  this.frozen=false;s.state=this.resumeMode;s.ui.setMode(s.state);
                  s.wakeGameLoop();
                });
              }
            }
            await held;
          }catch(e){this.release();throw e;}
        });
      }catch(e){this.unreadable(e);}
      finally{this.busy=false;}
    }
    chapterOpening(){
      const s=this.scene;
      const lava=this.chapter==='lava',ash=this.chapter==='ashlands',crystals=this.chapter==='crystals',caves=this.chapter==='caves',sceneArt=lava?'lava':ash?'ash':crystals?'prism':caves?'silk':'crossbow';
      localStorage.setItem(openingKey(this.chapter),'1');
      this.resumeMode=s.state;this.frozen=true;
      const finish=()=>{
        if(this.finishStory!==finish)return;
        clearTimeout(timer);this.finishStory=null;delete el('campaign-screen').dataset[sceneArt];
        this.frozen=false;s.state=this.resumeMode;s.ui.setMode(s.state);s.wakeGameLoop();
      };
      this.finishStory=finish;
      el('campaign-screen').dataset[sceneArt]='1';
      this.screen(lava?'THE BASALT CAUSEWAY':ash?'THE CINDER ROAD':crystals?'THE GLASS GALLERY':caves?'BENEATH THE SILK':'THE BONE CROSSBOW',lava?'The crust splits from the near edge. Jump the fracture and land on solid basalt.':ash?'An ember moves beneath the ash. Shoot it, or jump as the ring at your feet closes.':crystals?'A line of light crosses the gallery. Jump a low beam. Slide beneath a high one.':caves?'A thread trembles in the still air. Something above you lets go.':'At the ice line, a frost wisp stirs. Press Shoot when its light gathers. The crossbow aims for you.',
        ['SKIP',finish]);
      const timer=setTimeout(finish,4200);
    }
    release(keepVictory=false){
      if(!keepVictory)this.score.select(null);
      this.finalePrepared=false;
      this.active=false;this.frozen=false;this.walletDirty=false;this.reconnect=null;
      this.guardian=null;this.encounter.hide();
      this.requiredArt=null;cancelAnimationFrame(this.artWait);
      this.unlock?.();this.unlock=null;
    }
    endAttempt(keepVictory=false){
      localStorage.removeItem(slot(this.chapter));
      for(let i=0;i<256;i++)localStorage.removeItem(slot(this.chapter)+'-rewind-'+i);
      this.release(keepVictory);
    }
    prepareRoute(seed,origin,unit){
      return this.routeVersion===2?forestRoute(seed,origin,unit,this.chapter):null;
    }
    get entranceX(){return this.scene.startX+(this.scene.forestRoute?.end??LEGACY_END)*scope.GRIM_CONFIG.pxPerMeter;}
    afterFrame(){
      if(!this.active)return;
      const s=this.scene;
      if(this.guardian?.phase==='cleared'){this.finishChapter();return;}
      if(!this.guardian&&s.player.x>=this.entranceX&&s.state==='playing'&&!s.graveRush)
        this.encounter.enter();
      if(!this.finalePrepared&&s.player.x>=this.entranceX-200*scope.GRIM_CONFIG.pxPerMeter&&this.score.enabled){
        this.score.prepareFinale(tracks[this.chapter][1]);this.finalePrepared=true;
      }
      this.syncScore(s.state);
      this.save();
    }
    finishChapter(){
      if(!this.active||this.guardian?.phase!=='cleared')return;
      const chapter=this.chapter,name=title(chapter),label=name.toUpperCase();
      let bonus,balance;
      try{
        const record=progress();
        if(record[chapter]?.attempt!==this.id){
          const prior=record[chapter]?.bonusTotal||0;
          bonus=prior?1:3;
          record[chapter]={...record[chapter],cleared:true,attempt:this.id,bonus,bonusTotal:prior+bonus};
          record[nextChapter[chapter]+'Unlocked']=true;
          localStorage.setItem(meta().CAMPAIGN_PROGRESS,JSON.stringify(record));
        }else bonus=record[chapter].bonus;
        // The wallet can derive its balance from the committed chapter record
        // even if the tab closes before the wallet mirror or cleanup finishes.
        this.scene.meta=meta().load();
        meta().save(this.scene.meta);
        balance=this.scene.totalSouls=this.scene.meta.souls;
        el('banked-souls').textContent=String(balance);
        this.endAttempt(true);
      }catch(e){
        this.frozen=true;
        this.screen(label+' CLEAR PENDING','Free some browser storage to record your victory.',
          ['RETRY SAVE',()=>this.finishChapter()]);
        return;
      }
      const reward=bonus===3?'First '+name+' clear · +3 Souls':name+' cleared · +1 Soul';
      const destination=chapter==='lava'?'Final realm unlocked · chapter in development.':title(nextChapter[chapter])+' unlocked.';
      const victory=()=>{
        this.screen(label+' CLEARED',reward+' · Wallet: '+balance+' Souls. '+destination,
          ['REPLAY '+label,()=>this.enter(chapter)],['CHAPTERS',()=>this.chapters()],()=>this.scene.goToMenu());
        this.showingVictory=false;
      };
      this.showingVictory=true;
      if(chapter==='forest'||chapter==='crystals'||chapter==='ashlands'||chapter==='lava')this.playStory(true,victory,chapter);
      else victory();
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
      localStorage.setItem(slot(this.chapter)+'-rewind-'+id,JSON.stringify([frame,this.scene.downhillCamera?.rewindOffsets.get(frame)||0]));
      this.historySerial++;this.historyIds.set(frame,id);
      return id;
    }
    snapshot(){
      const s=this.scene,r=s.graveRush,clip=s.rewindPlayback;
      return {version:1,chapter:this.chapter,routeVersion:this.routeVersion,id:this.id,seed:s.seed,mode:this.frozen?this.resumeMode:s.state,
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
      if(!this.active||this.guardian?.phase==='cleared')return false;
      try{
        const raw=JSON.stringify(this.snapshot());
        if(this.walletDirty){
          const record=meta().normalize(this.scene.meta);
          record.forestRecovery=raw;
          localStorage.setItem(meta().KEY,JSON.stringify(record));
          recoverWallet();
          this.walletDirty=false;
        }else localStorage.setItem(slot(this.chapter),raw);
        return true;
      }catch(e){
        if(!this.frozen)this.resumeMode=this.scene.state;
        this.frozen=true;
        this.screen(title(this.chapter).toUpperCase()+' SAVE PAUSED','Free some browser storage, then retry saving this attempt.',
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
      if(this.guardian&&!Number.isFinite(this.guardian.musicStart))this.guardian.musicStart=s.elapsed;
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
          const [value,offset]=JSON.parse(localStorage.getItem(slot(this.chapter)+'-rewind-'+id));
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
