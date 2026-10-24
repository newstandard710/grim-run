/* Grim Run — Macabre Storybook visual system, v0.10.4
 * The legacy SVG atlas remains available as an experimental option. The
 * illustrated runtime uses anchored PNG poses and short Reaper/Bat cycles.
 * NO movement, collision, currency or gameplay changes.
 */
(function(scope){
  'use strict';
  const REAPER={
    idle:[0,1],run:[2,3,4,5,15],jump:[6],fall:[7],
    slide:[8],slash:[9,10],fire:[11],hurt:[12],death:[13],hover:[14]
  };
  const BAT={
    flap:[0,1,2,3,2,1],dive:[4,5],hurt:[6],death:[7]
  };
  const ILLUSTRATED_RUN=Object.freeze(['run_02','run_03','run_04','run_05']);
  const ILLUSTRATED_BAT_FLAP=Object.freeze(['raised','midstroke','lowered','neutral']);
  const ILLUSTRATED_RUN_FPS=10;
  const ILLUSTRATED_BAT_FPS=9;
  const CDN_PATHS=Object.freeze({
    reaper:'assets/characters/reaper/reaper-sheet.svg',
    bat:'assets/enemies/cavern-bat/bat-sheet.svg'
  });
  // Transparent PNG poses with per-image anchors documented in manifest.json.
  const ILLUSTRATED=Object.freeze({
    reaper:{
      master:{key:'gr_ill_reaper_master',file:'reaper_master.png',scale:.157895,anchor:[320,827.5]},
      idle:{key:'gr_ill_reaper_idle',file:'reaper_idle.png',scale:.157687,anchor:[320,827.5]},
      run:{key:'gr_ill_reaper_run',file:'reaper_run.png',scale:.186047,anchor:[320,827.5]},
      run_02:{key:'gr_ill_reaper_run_02',file:'reaper_run_02.png',scale:.183486,anchor:[512,710]},
      run_03:{key:'gr_ill_reaper_run_03',file:'reaper_run_03.png',scale:.180451,anchor:[512,710]},
      run_04:{key:'gr_ill_reaper_run_04',file:'reaper_run_04.png',scale:.180451,anchor:[512,710]},
      run_05:{key:'gr_ill_reaper_run_05',file:'reaper_run_05.png',scale:.180451,anchor:[512,710]},
      jump:{key:'gr_ill_reaper_jump',file:'reaper_jump.png',scale:.167131,anchor:[320,827.5]},
      fall:{key:'gr_ill_reaper_fall',file:'reaper_fall.png',scale:.180451,anchor:[320,827.5]},
      slide:{key:'gr_ill_reaper_slide',file:'reaper_slide_crouch_v2.png',scale:.078585,anchor:[768,798]},
      scythe_attack:{key:'gr_ill_reaper_scythe_attack_clean',file:'reaper_scythe_attack_clean_v2.png',scale:.162822,anchor:[768,894]},
      crossbow_fire:{key:'gr_ill_reaper_crossbow_fire',file:'reaper_crossbow_fire.png',scale:.26087,anchor:[512,920]},
      hurt:{key:'gr_ill_reaper_hurt',file:'reaper_hurt.png',scale:.243902,anchor:[512,920]},
      death:{key:'gr_ill_reaper_death',file:'reaper_death.png',scale:.364742,anchor:[512,920]},
      hover:{key:'gr_ill_reaper_hover',file:'reaper_hover.png',scale:.159574,anchor:[512,920]}
    },
    bat:{
      neutral:{key:'gr_ill_bat_neutral',file:'bat_neutral.png',scale:.121281,anchor:[512,320]},
      raised:{key:'gr_ill_bat_raised',file:'bat_wings_raised.png',scale:.122827,anchor:[512,320]},
      midstroke:{key:'gr_ill_bat_midstroke',file:'bat_flap_midstroke.png',scale:.111579,anchor:[512,320]},
      lowered:{key:'gr_ill_bat_lowered',file:'bat_wings_lowered.png',scale:.127557,anchor:[443.5,222]},
      dive_anticipation:{key:'gr_ill_bat_dive_anticipation',file:'bat_dive_anticipation.png',scale:.111579,anchor:[512,320]},
      dive:{key:'gr_ill_bat_dive',file:'bat_dive.png',scale:.155198,anchor:[512,320]},
      hit:{key:'gr_ill_bat_hit',file:'bat_hit.png',scale:.125296,anchor:[443.5,222]},
      death:{key:'gr_ill_bat_death',file:'bat_death.png',scale:.167987,anchor:[512,320]}
    }
  });
  // v2 review art uses shared transparent canvases and visual anchors. Its
  // run and flap cycles are opt-in until phone playtesting accepts them.
  // Phone playtest showed the review Reaper read too small next to low
  // overhead hazards. Enlarge standard poses to the existing 120px target
  // (1.875×) while preserving the shared ground anchor; the crouched slide
  // pose is independently sized to stay inside the unchanged 48px clearance.
  const V2_REAPER_BASE_SCALE=64/1111;
  const V2_REAPER_SCALE=120/1111;
  const V2_BAT_SCALE=52/766;
  // Normalize the visible pixels to one 120px target and keep the cyan eye
  // registered in screen space. The original run poses differed in both size
  // and horizontal eye position despite sharing the same canvas dimensions.
  const V2_REAPER_RUN_SCALES=Object.freeze({
    run_contact:120/990,run_airborne:120/1071,run_recovery:120/1011,run:120/1110,
    run_transition_01:120/1110,run_transition_02:120/1109,
    run_transition_03:120/1110,run_transition_04:120/1110
  });
  const V2_REAPER_RUN_ANCHORS=Object.freeze({
    run_contact:Object.freeze([1248,1330]),
    run_airborne:Object.freeze([1271,1419]),
    run_recovery:Object.freeze([1433,1413]),
    run:Object.freeze([1256,1420]),
    run_transition_01:Object.freeze([1251,1420]),
    run_transition_02:Object.freeze([1251,1420]),
    run_transition_03:Object.freeze([1250,1420]),
    run_transition_04:Object.freeze([1250,1420])
  });
  const V2_REAPER_BASE=Object.freeze(Object.fromEntries([
    ['run','reaper_run_v1.png',V2_REAPER_SCALE],
    ['run_contact','reaper_run_contact_v1.png',V2_REAPER_SCALE],
    ['run_airborne','reaper_run_airborne_v1.png',V2_REAPER_SCALE],
    ['run_recovery','reaper_run_recovery_v1.png',V2_REAPER_SCALE],
    ['run_transition_01','reaper_run_transition_01_v1.png',V2_REAPER_SCALE],
    ['run_transition_02','reaper_run_transition_02_v1.png',V2_REAPER_SCALE],
    ['run_transition_03','reaper_run_transition_03_v1.png',V2_REAPER_SCALE],
    ['run_transition_04','reaper_run_transition_04_v1.png',V2_REAPER_SCALE],
    ['idle','reaper_idle_v1.png',V2_REAPER_SCALE],
    ['jump','reaper_jump_v1.png',V2_REAPER_SCALE],
    ['fall','reaper_fall_v1.png',V2_REAPER_SCALE],
    ['slide','reaper_slide_v1.png',V2_REAPER_BASE_SCALE*1.25],
    ['scythe_attack','reaper_scythe_attack_v1.png',V2_REAPER_SCALE],
    ['crossbow_fire','reaper_crossbow_fire_v1.png',V2_REAPER_SCALE],
    ['hurt','reaper_hurt_v1.png',V2_REAPER_SCALE],
    ['death','reaper_death_v1.png',V2_REAPER_SCALE],
    ['hover','reaper_hover_v1.png',V2_REAPER_SCALE]
  ].map(([name,file,scale])=>[name,Object.freeze({
    key:'gr_v2_reaper_'+name,file,scale:V2_REAPER_RUN_SCALES[name]||scale,anchor:V2_REAPER_RUN_ANCHORS[name]||Object.freeze([1250,1420])
  })])));
  const V2_REAPER_RUN_MOBILE=Object.freeze({
    run_contact:Object.freeze({key:'gr_v2_reaper_run_contact',file:'run-cycle-mobile-v1/run_contact_mobile_v1.png',scale:0.44117647,anchor:Object.freeze([308.731,279.725])}),
    run_contact_mid:Object.freeze({key:'gr_v2_reaper_run_contact_mid',file:'run-cycle-mobile-v1/run_contact_mid_mobile_v1.png',scale:0.44117647,anchor:Object.freeze([308.691,279.985])}),
    run_transition_01:Object.freeze({key:'gr_v2_reaper_run_transition_01',file:'run-cycle-mobile-v1/run_transition_01_mobile_v1.png',scale:0.44117647,anchor:Object.freeze([309.06,280.245])}),
    run_airborne:Object.freeze({key:'gr_v2_reaper_run_airborne',file:'run-cycle-mobile-v1/run_airborne_mobile_v1.png',scale:0.44117647,anchor:Object.freeze([297.511,286.135])}),
    run_airborne_mid:Object.freeze({key:'gr_v2_reaper_run_airborne_mid',file:'run-cycle-mobile-v1/run_airborne_mid_mobile_v1.png',scale:0.44117647,anchor:Object.freeze([313.025,288.954])}),
    run_transition_02:Object.freeze({key:'gr_v2_reaper_run_transition_02',file:'run-cycle-mobile-v1/run_transition_02_mobile_v1.png',scale:0.44117647,anchor:Object.freeze([318.195,291.773])}),
    run_recovery:Object.freeze({key:'gr_v2_reaper_run_recovery',file:'run-cycle-mobile-v1/run_recovery_mobile_v1.png',scale:0.44117647,anchor:Object.freeze([287.722,300.198])}),
    run_recovery_mid:Object.freeze({key:'gr_v2_reaper_run_recovery_mid',file:'run-cycle-mobile-v1/run_recovery_mid_mobile_v1.png',scale:0.44117647,anchor:Object.freeze([323.607,299.533])}),
    run_transition_03:Object.freeze({key:'gr_v2_reaper_run_transition_03',file:'run-cycle-mobile-v1/run_transition_03_mobile_v1.png',scale:0.44117647,anchor:Object.freeze([322.193,298.868])}),
    run:Object.freeze({key:'gr_v2_reaper_run',file:'run-cycle-mobile-v1/run_mobile_v1.png',scale:0.44117647,anchor:Object.freeze([274.082,280.0])}),
    run_stride_mid:Object.freeze({key:'gr_v2_reaper_run_stride_mid',file:'run-cycle-mobile-v1/run_stride_mid_mobile_v1.png',scale:0.44117647,anchor:Object.freeze([310.48,280.245])}),
    run_transition_04:Object.freeze({key:'gr_v2_reaper_run_transition_04',file:'run-cycle-mobile-v1/run_transition_04_mobile_v1.png',scale:0.44117647,anchor:Object.freeze([305.245,280.49])})
  });
  const V2_REAPER=Object.freeze({...V2_REAPER_BASE,...V2_REAPER_RUN_MOBILE});
  const V2_BAT=Object.freeze(Object.fromEntries([
    ['neutral','bat_neutral_v1.png'],['raised','bat_wings_raised_v1.png'],
    ['mid_up','bat_flap_mid_up_v1.png'],['mid_down','bat_flap_mid_down_v1.png'],
    ['lowered','bat_wings_lowered_v1.png'],['dive','bat_dive_v1.png'],
    ['hit','bat_hit_v1.png'],['death','bat_death_v1.png']
  ].map(([name,file])=>[name,Object.freeze({
    key:'gr_v2_bat_'+name,file,scale:V2_BAT_SCALE,anchor:Object.freeze([1500,720])
  })])));
  // The main game uses the approved eight run poses plus four new in-between
  // poses. Compact mobile PNGs keep the first pose and the full run cycle fast.
  const V2_REAPER_RUN=Object.freeze([
    'run_contact','run_contact_mid','run_transition_01','run_airborne',
    'run_airborne_mid','run_transition_02','run_recovery','run_recovery_mid',
    'run_transition_03','run','run_stride_mid','run_transition_04'
  ]);
  const V2_BAT_FLAP=Object.freeze(['raised','mid_up','neutral','mid_down','lowered','mid_down','neutral','mid_up']);
  const V2_REAPER_RUN_FPS=18;
  const V2_BAT_FLAP_FPS=12;
  const snapFrame=(arr,time,fps)=>arr[Math.floor(Math.max(0,time)*fps)%arr.length];

  function reaperPose(scene){
    const p=scene.player;
    if(!p)return {name:'idle',frame:0};
    if(scene.state==='dead'||scene.state==='revive')return {name:'death',frame:13};
    if(scene.state==='won')return {name:'idle',frame:0};
    if(p.sliding||p.airTuck)return {name:'slide',frame:8};
    if(p.attackMs>0){
      const progress=1-p.attackMs/scene.attackDurationMs;
      return {name:'slash',frame:progress<.47?9:10};
    }
    if(p.visualFireMs>0)return {name:'fire',frame:11};
    if(scene.damageFlashMs>0&&p.invulMs>0)return {name:'hurt',frame:12};
    if(!p.grounded&&!p.onSoulPlatform){
      if(p.hovering)return {name:'hover',frame:14};
      return {name:p.velocityY<0?'jump':'fall',frame:p.velocityY<0?6:7};
    }
    const moving=['playing','rewinding','countdown'].includes(scene.state);
    if(moving){
      return {name:'run',frame:snapFrame(REAPER.run,scene.elapsed,10)};
    }
    return {name:'idle',frame:snapFrame(REAPER.idle,scene.elapsed,2.4)};
  }
  function cavernBatFrame(enemy,elapsed){
    if(enemy.dead)return 7;
    if(enemy.hp<=0)return 6;
    if(enemy.mode==='dive')return snapFrame(BAT.dive,enemy.timer||0,7);
    if(enemy.mode==='recover')return snapFrame(BAT.flap,elapsed+(enemy.phase||0),6);
    return snapFrame(BAT.flap,elapsed+(enemy.phase||0),9);
  }


  // Review-only integrity gate. Validate the exact bytes handed to Phaser,
  // rather than trusting an image load event (Chrome can display partial PNGs).
  const REVIEW_INTEGRITY=Object.freeze({"reaper_run_transition_01_v1.png":{"bytes":1432602,"sha256":"141cf50436a62789629cd8a488f6bc8da70992b442683572526f561711fc394a"},"reaper_run_transition_02_v1.png":{"bytes":1381487,"sha256":"6aa4b4f225bc67d702e16dc3d89a6a9f1d89c6b6cbd075efc9c4d53401d1216b"},"reaper_run_transition_03_v1.png":{"bytes":1521275,"sha256":"46e0e128ff50f2c988608eb92c8966ab3441bc396bcd2edb248ad96a224d3f70"},"reaper_run_transition_04_v1.png":{"bytes":1380002,"sha256":"c11a9085037ebbdacd2d18d2f74e61051af713d087f59b38a8c71713b37bf572"},"reaper_run_airborne_v1.png":{"bytes":1350570,"sha256":"3bdb142a58b89d59014e0b8ccbda9cafdcfb130844d5a741f52491a06c8687b4"},"reaper_run_recovery_v1.png":{"bytes":1179770,"sha256":"0fe01ec415e4f3af63a9db4bbb0adf2dfef8a220c517fd44d9eeef3cc6ffef10"},"reaper_fall_v1.png":{"bytes":1404482,"sha256":"a1859b8b51dac28d3d08d04cf7aa3fe9fbf262676f12abeda91b12bf34eb6218"},"reaper_jump_v1.png":{"bytes":1350180,"sha256":"aecd58ad785f1cf5d0f08e8cd9489bc39be236e32fdffcd4c263796ccbb05d3f"},"reaper_death_v1.png":{"bytes":727130,"sha256":"f0b71de8c58a670ec85bd663d8e096d590fe864417df1e136cde70dba4333915"},"reaper_crossbow_fire_v1.png":{"bytes":820955,"sha256":"8df8c45253c880c2b2cec44bcd68c20a5b2ba0aa9781bf5c41e0955b03f06a09"},"reaper_run_contact_v1.png":{"bytes":1200830,"sha256":"976dd7516acd5fe8a9f44dcb339b3284186360f323a89e9e573f3801aed3521a"},"reaper_hover_v1.png":{"bytes":952384,"sha256":"de4a4a8ec36540bf06313b6d140351aa3ddc02871600de868aa13ad806d2eb1d"},"reaper_slide_v1.png":{"bytes":995383,"sha256":"70c9a7c6e13132801eb02939b7a9bc3d466aa6216bff759b2863e82aa059baa8"},"reaper_run_v1.png":{"bytes":1444963,"sha256":"873cd968a4b4c56e21d46d1db634bd0a602cbd9c212738f593fbcaf295f10243"},"reaper_idle_v1.png":{"bytes":1306891,"sha256":"253cddc5467f3dd914e679ad64d1a95060181538174cc5621a0f1f8436474cca"},"reaper_scythe_attack_v1.png":{"bytes":1167906,"sha256":"7b13d15a6b6de3f88a4d64a8d08b46325d227af68c31cc8018baa9ac320b866f"},"reaper_hurt_v1.png":{"bytes":1102948,"sha256":"5c091e89477790ba47e985e71abde99581b3b88854836f60e84c3b4fec3341bc"},"bat_neutral_v1.png":{"bytes":972200,"sha256":"91bd27d39d7fa71f698563fafbac02eeb40ee9e3fb8590ec13a8f587b182eb94"},"bat_wings_raised_v1.png":{"bytes":793683,"sha256":"4b818264821d70908bfb5f882ace67e509e0b334520c6d683dfe9becccd85cd9"},"bat_hit_v1.png":{"bytes":801324,"sha256":"86fbb1025e86e36e7cbfd81b6ccd71ce88fb866fadcdf6a3febf3b2d6e72407e"},"bat_death_v1.png":{"bytes":605422,"sha256":"e912d431c1614ad5127edbdf8b817e0ab6e16571f4e852b45503204dd219cfda"},"bat_flap_mid_down_v1.png":{"bytes":536563,"sha256":"c568978e463b93cea21af3ecf18b0322c88e99a4ed463582760442261e02dcd4"},"bat_wings_lowered_v1.png":{"bytes":875269,"sha256":"87cc9202294f325eea8bd2cf4e4fcf01018fbe191eef72492ba90522c428886a"},"bat_dive_v1.png":{"bytes":873768,"sha256":"d946f909b05d8f2d79b28275c1b654b4761c1a196a69e9d54dec27e7b201a18b"},"bat_flap_mid_up_v1.png":{"bytes":608831,"sha256":"952debf01be31561941e34adb3b7ce5b00f2364a1e7ed37ddf9bf32472df9b34"},"run-cycle-mobile-v1/run_contact_mobile_v1.png":{"bytes":24116,"sha256":"dc2e276c8535e2816d4bea34597b764697ab9a7a7fb210c28e72a13fa460b7f8"},"run-cycle-mobile-v1/run_contact_mid_mobile_v1.png":{"bytes":26157,"sha256":"6da0069905f2088ab880daa335771c41a0a4225da0927e84c19625149480830e"},"run-cycle-mobile-v1/run_transition_01_mobile_v1.png":{"bytes":25093,"sha256":"5126d1e2ad5423bdac383771b9c1f54edcd0cdd3351ae446cc2dabb8283c9aa3"},"run-cycle-mobile-v1/run_airborne_mobile_v1.png":{"bytes":24883,"sha256":"bc3fcbc9f58523400e857b59a409c63f6e062a172ea41669d32d5c5e7eab2e96"},"run-cycle-mobile-v1/run_airborne_mid_mobile_v1.png":{"bytes":27005,"sha256":"57397cd636131afb3d0f95d6a279182fd87c256903b2d1895054b79cb0c7fd0a"},"run-cycle-mobile-v1/run_transition_02_mobile_v1.png":{"bytes":24601,"sha256":"50acb5314237c2b19085cc08f0713ec69db5d9b4414d8242892e0e4e44a08719"},"run-cycle-mobile-v1/run_recovery_mobile_v1.png":{"bytes":24186,"sha256":"a09b103aaa1857f56dbf5774d5486067bd17ecf5600c3670154d5c4094de25f3"},"run-cycle-mobile-v1/run_recovery_mid_mobile_v1.png":{"bytes":26220,"sha256":"c46856e62a410e71382db84c673acf997f3ae4340c7cd79257f08a6e16851e58"},"run-cycle-mobile-v1/run_transition_03_mobile_v1.png":{"bytes":25816,"sha256":"02a7a71cb0ec6f914455b6902f4bde1d0f22c78e3cdfb12276722d9837707014"},"run-cycle-mobile-v1/run_mobile_v1.png":{"bytes":23318,"sha256":"ec02c70f52c9e380a8984c00ed05862d617f8fa378b94a0d61c2ea47411578c3"},"run-cycle-mobile-v1/run_stride_mid_mobile_v1.png":{"bytes":24973,"sha256":"54796f149b6864875a384bb2d45f8926d2f9ddfde33cbb7f12fcfcbf58b3c604"},"run-cycle-mobile-v1/run_transition_04_mobile_v1.png":{"bytes":24175,"sha256":"b0b4e671fe9a2f4160229b24db0d6cf0ae88b8ee9cd818a59b788d2256985651"}});
  function validateReviewPNG(buffer,meta){
    const b=new Uint8Array(buffer),v=new DataView(buffer);
    if(b.length!==meta.bytes)throw new Error('PNG byte count mismatch');
    if(b.length<33||v.getUint32(0)!==0x89504e47||v.getUint32(4)!==0x0d0a1a0a)throw new Error('Invalid PNG signature');
    let p=8,end=false;
    while(p+12<=b.length){
      const n=v.getUint32(p);if(n>b.length-p-12)throw new Error('Incomplete PNG chunk');
      let crc=0xffffffff;
      for(let i=p+4;i<p+8+n;i++){crc^=b[i];for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
      if(((crc^0xffffffff)>>>0)!==v.getUint32(p+8+n))throw new Error('PNG checksum mismatch');
      const type=String.fromCharCode(...b.subarray(p+4,p+8));p+=n+12;
      if(type==='IEND'){end=true;break;}
    }
    if(!end||p!==b.length)throw new Error('PNG end marker missing or trailing data');
    return true;
  }
  async function verifiedReviewURL(path,meta){
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
    try{
      const response=await fetch(path+'?sha256='+meta.sha256,{cache:'no-store',signal:controller.signal});
      if(!response.ok)throw new Error('HTTP '+response.status);
      const buffer=await response.arrayBuffer();validateReviewPNG(buffer,meta);
      if(scope.crypto&&scope.crypto.subtle){
        const digest=await scope.crypto.subtle.digest('SHA-256',buffer);
        const hex=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
        if(hex!==meta.sha256)throw new Error('PNG SHA-256 mismatch');
      }
      return URL.createObjectURL(new Blob([buffer],{type:'image/png'}));
    }finally{clearTimeout(timeout);}
  }

  class GrimVisualSystem{
    constructor(scene){
      this.scene=scene;
      this.reaperReady=false;
      this.batReady=false;
      this.loaded=false;
      this.reaper=null;
      this.batPool=[];
      this.failedAssets=[];
      this.loadRequested=false;
      this.illustrated=false;
      this.reviewV2=false;
      this.disposed=false;
      this.reaperPoseSprites={};
    }
    begin(){
      const s=this.scene;
      // No loader/texture manager in simulation harness or unsupported hosts:
      // retain original procedural art and never block gameplay.
      if(!s.load||typeof s.load.svg!=='function'||
         !s.textures||typeof s.textures.addSpriteSheet!=='function'||
         !s.add||typeof s.add.sprite!=='function')return false;
      if(this.loadRequested)return true;
      this.loadRequested=true;
      const errors=new Set();
      const fail=file=>{if(file&&file.key)errors.add(file.key);};
      const done=()=>{
        if(typeof s.load.off==='function')s.load.off('loaderror',fail);
        if(s.textures.exists('gr_reaper_sheet_source')&&!errors.has('gr_reaper_sheet_source')){
          try{
            const sourceTexture=s.textures.get('gr_reaper_sheet_source');
            const sourceImage=sourceTexture.getSourceImage();
            // Phaser 3.90 expects an image/canvas source when adding a new
            // sprite-sheet key, NOT a Phaser Texture (unless key is '').
            // Passing the Texture previously yielded the tiny green missing-
            // texture square, while incorrectly disabling the old drawing.
            if(!sourceImage||!sourceImage.width||!sourceImage.height)
              throw new Error('SVG image was not rasterized');
            const sheet=s.textures.addSpriteSheet('gr_reaper_frames',sourceImage,
              {frameWidth:192,frameHeight:192,endFrame:15});
            if(!sheet||!s.textures.exists('gr_reaper_frames')||
                !sheet.has(0)||!sheet.has(8)||!sheet.has(15))
              throw new Error('Reaper sprite sheet has missing animation frames');
            const sprite=s.add.sprite(0,0,'gr_reaper_frames',0)
              .setOrigin(.5,1).setScale(.74).setDepth(12).setVisible(false);
            if(!sprite.texture||sprite.texture.key!=='gr_reaper_frames'||
               !sprite.frame||sprite.frame.name==='__MISSING'){
              sprite.destroy();
              throw new Error('Reaper resolved to Phaser missing texture');
            }
            this.reaper=sprite;
            this.reaperReady=true;
          }catch(e){
            if(this.reaper){this.reaper.destroy();this.reaper=null;}
            this.reaperReady=false;
            this.failedAssets.push('Reaper texture: '+String(e));
          }
        }else this.failedAssets.push('Reaper SVG unavailable');
        if(s.textures.exists('gr_bat_sheet_source')&&!errors.has('gr_bat_sheet_source')){
          try{
            const sourceTexture=s.textures.get('gr_bat_sheet_source');
            const sourceImage=sourceTexture.getSourceImage();
            if(!sourceImage||!sourceImage.width||!sourceImage.height)
              throw new Error('Bat SVG image was not rasterized');
            const sheet=s.textures.addSpriteSheet('gr_bat_frames',sourceImage,
              {frameWidth:160,frameHeight:128,endFrame:7});
            if(!sheet||!s.textures.exists('gr_bat_frames')||
               !sheet.has(0)||!sheet.has(4)||!sheet.has(7))
              throw new Error('Bat sprite sheet has missing animation frames');
            for(let i=0;i<12;i++){
              const sprite=s.add.sprite(0,0,'gr_bat_frames',0)
                .setScale(.66).setDepth(9).setVisible(false);
              if(!sprite.texture||sprite.texture.key!=='gr_bat_frames'||
                !sprite.frame||sprite.frame.name==='__MISSING'){
                sprite.destroy();
                throw new Error('Bat resolved to Phaser missing texture');
              }
              this.batPool.push(sprite);
            }
            this.batReady=true;
          }catch(e){
            for(const sprite of this.batPool)sprite.destroy();
            this.batPool=[];
            this.batReady=false;
            this.failedAssets.push('Bat texture: '+String(e));
          }
        }else this.failedAssets.push('Bat SVG unavailable');
        this.loaded=true;
      };
      try{
        if(typeof s.load.on==='function')s.load.on('loaderror',fail);
        s.load.once('complete',done);
        s.load.svg('gr_reaper_sheet_source',CDN_PATHS.reaper,{width:768,height:768});
        s.load.svg('gr_bat_sheet_source',CDN_PATHS.bat,{width:640,height:256});
        s.load.start();
      }catch(e){
        this.failedAssets.push('Loader: '+String(e));
        return false;
      }
      return true;
    }
    beginIllustrated(){
      const s=this.scene;
      if(!s.load||typeof s.load.image!=='function'||!s.textures||
         typeof s.textures.exists!=='function'||!s.add||typeof s.add.image!=='function')return false;
      if(this.loadRequested)return true;
      this.loadRequested=true;this.illustrated=true;
      // Load current state poses plus the short run and Bat wing cycles.
      const runtimeReaper=['idle',...ILLUSTRATED_RUN,'jump','fall','slide','scythe_attack',
        'crossbow_fire','hurt','death','hover'].map(name=>ILLUSTRATED.reaper[name]);
      const runtimeBat=['neutral','raised','midstroke','lowered','dive'].map(name=>ILLUSTRATED.bat[name]);
      const all=[...runtimeReaper,...runtimeBat];
      const errors=new Set();
      const fail=file=>{if(file&&file.key)errors.add(file.key);};
      const done=()=>{
        if(typeof s.load.off==='function')s.load.off('loaderror',fail);
        try{
          for(const name of ['idle',...ILLUSTRATED_RUN,'jump','fall','slide','scythe_attack',
            'crossbow_fire','hurt','death','hover']){
            const meta=ILLUSTRATED.reaper[name];
            if(errors.has(meta.key)||!s.textures.exists(meta.key))continue;
            const image=s.add.image(0,0,meta.key).setOrigin(0,0).setDepth(12).setVisible(false);
            this.reaperPoseSprites[name]=image;
          }
          if(this.reaperPoseSprites.idle){this.reaper=this.reaperPoseSprites.idle;this.reaperReady=true;}
          for(const name of ['neutral','raised','midstroke','lowered','dive']){
            const meta=ILLUSTRATED.bat[name];
            if(errors.has(meta.key)||!s.textures.exists(meta.key))this.failedAssets.push('Bat PNG unavailable: '+name);
          }
          if(runtimeBat.every(meta=>s.textures.exists(meta.key)&&!errors.has(meta.key))){
            for(let i=0;i<12;i++)this.batPool.push(s.add.image(0,0,ILLUSTRATED.bat.neutral.key)
              .setOrigin(0,0).setDepth(9).setVisible(false));
            this.batReady=true;
          }
          if(!this.reaperReady)this.failedAssets.push('Illustrated Reaper PNGs unavailable');
          this.loaded=true;
        }catch(e){
          for(const sprite of Object.values(this.reaperPoseSprites))sprite.destroy();
          this.reaperPoseSprites={};this.reaper=null;this.reaperReady=false;
          for(const sprite of this.batPool)sprite.destroy();this.batPool=[];this.batReady=false;
          this.failedAssets.push('Illustrated sprite creation: '+String(e));
        }
      };
      try{
        if(typeof s.load.on==='function')s.load.on('loaderror',fail);
        s.load.once('complete',done);
        for(const meta of all)s.load.image(meta.key,'assets/characters/illustrated/'+
          (meta.key.includes('_bat_')?'bat/':'reaper/')+meta.file);
        s.load.start();
      }catch(e){this.failedAssets.push('Illustrated loader: '+String(e));return false;}
      return true;
    }
    beginReviewV2(){
      const s=this.scene;
      if(!s.load||typeof s.load.image!=='function'||!s.textures||
         typeof s.textures.exists!=='function'||!s.add||typeof s.add.image!=='function')return false;
      if(this.loadRequested)return true;
      this.loadRequested=true;this.reviewV2=true;
      const errors=new Set(),urls=[];
      const startButton=typeof document!=='undefined'?document.getElementById('start-btn'):null;
      const originalStartHTML=startButton?.innerHTML;
      const setStartReady=ready=>{
        if(!startButton)return;
        startButton.disabled=!ready;
        if(ready){if(originalStartHTML!==undefined)startButton.innerHTML=originalStartHTML;}
        else startButton.textContent='PREPARING REAPER…';
      };
      setStartReady(false);
      const fail=file=>{if(file&&file.key)errors.add(file.key);};
      const reaperBase='assets/characters/illustrated-v2/reaper/';
      const batBase='assets/enemies/illustrated-v2/bat/';
      const fetchVerified=async(base,meta)=>{
        try{
          const url=await verifiedReviewURL(base+meta.file,REVIEW_INTEGRITY[meta.file]);
          urls.push(url);return {meta,url};
        }catch(e){errors.add(meta.key);this.failedAssets.push(meta.file+': '+String(e));return null;}
      };
      const loadEntries=async entries=>{
        if(!entries.length)return;
        await new Promise(resolve=>{
          const complete=()=>{
            if(typeof s.load.off==='function')s.load.off('loaderror',fail);
            resolve();
          };
          if(typeof s.load.on==='function')s.load.on('loaderror',fail);
          s.load.once('complete',complete);
          for(const {meta,url} of entries)s.load.image(meta.key,url);
          s.load.start();
        });
        for(const {url} of entries){const i=urls.indexOf(url);if(i>=0)urls.splice(i,1);URL.revokeObjectURL(url);}
      };
      const installReaper=names=>{
        for(const name of names){
          const meta=V2_REAPER[name];
          if(errors.has(meta.key)||!s.textures.exists(meta.key))continue;
          if(!this.reaperPoseSprites[name])
            this.reaperPoseSprites[name]=s.add.image(0,0,meta.key)
              .setOrigin(0,0).setDepth(12).setVisible(false);
        }
        this.reaper=this.reaperPoseSprites.idle||
          V2_REAPER_RUN.find(name=>this.reaperPoseSprites[name])&&
            this.reaperPoseSprites[V2_REAPER_RUN.find(name=>this.reaperPoseSprites[name])]||null;
        this.reaperReady=Boolean(this.reaper);
        if(this.reaperReady)setStartReady(true);
      };
      const loadNames=async(base,entries)=>{
        const fetched=await Promise.all(entries.map(([,meta])=>fetchVerified(base,meta)));
        const valid=fetched.filter(Boolean);
        await loadEntries(valid);
        return valid;
      };
      this.reviewLoad=(async()=>{
        // Fetch and install a compact contact pose first. Do not let the other
        // large character and Bat images compete with the player's first image.
        const initial=await fetchVerified(reaperBase,V2_REAPER.run_contact);
        if(initial){await loadEntries([initial]);installReaper(['run_contact']);}
        if(this.disposed)return;

        // Finish all twelve compact run drawings before starting secondary art.
        const runNames=V2_REAPER_RUN.filter(name=>name!=='run_contact');
        await loadNames(reaperBase,runNames.map(name=>[name,V2_REAPER[name]]));
        installReaper(V2_REAPER_RUN);
        if(this.disposed)return;
        if(!this.reaperReady){
          this.reviewV2=false;setStartReady(true);
          this.failedAssets.push('No verified run pose loaded; using the built-in character fallback');
        }

        // Idle, jump, combat, and Bat artwork can load after the run cycle is ready.
        const otherReaper=Object.entries(V2_REAPER).filter(([name])=>!V2_REAPER_RUN.includes(name));
        const batEntries=Object.values(V2_BAT).map(meta=>[meta.key,meta]);
        const rest=await Promise.all([
          loadNames(reaperBase,otherReaper),
          loadNames(batBase,batEntries)
        ]);
        installReaper(otherReaper.map(([name])=>name));
        for(const [name,meta] of Object.entries(V2_BAT))
          if(errors.has(meta.key)||!s.textures.exists(meta.key))
            this.failedAssets.push('v2 Bat PNG unavailable: '+name);
        if(Object.values(V2_BAT).every(meta=>s.textures.exists(meta.key)&&!errors.has(meta.key))){
          for(let i=0;i<12;i++)this.batPool.push(s.add.image(0,0,V2_BAT.neutral.key)
            .setOrigin(0,0).setDepth(9).setVisible(false));
          this.batReady=true;
        }
        this.loaded=true;
      })().catch(e=>{
        for(const url of urls)URL.revokeObjectURL(url);
        this.reviewV2=false;setStartReady(true);
        this.failedAssets.push('v2 loader: '+String(e));this.loaded=true;
      });
      return true;
    }
    illustratedReaperPose(){
      const s=this.scene,p=s.player;
      if(!p)return 'idle';
      if(s.state==='dead'||s.state==='revive')return 'death';
      if(s.state==='won')return 'idle';
      if(p.sliding||p.airTuck)return 'slide';
      if(p.attackMs>0)return 'scythe_attack';
      if(p.visualFireMs>0)return 'crossbow_fire';
      if(s.damageFlashMs>0&&p.invulMs>0)return 'hurt';
      if(!p.grounded&&!p.onSoulPlatform){if(p.hovering)return 'hover';return p.velocityY<0?'jump':'fall';}
      if(['playing','rewinding','countdown'].includes(s.state))return 'run';
      return 'idle';
    }
    renderIllustrated(){
      const s=this.scene,p=s.player;
      const pose=this.illustratedReaperPose();
      let resolvedPose=pose;
      if(pose==='run'){
        const available=ILLUSTRATED_RUN.filter(name=>this.reaperPoseSprites[name]);
        if(available.length){
          const frame=Math.floor(Math.max(0,s.elapsed||0)*ILLUSTRATED_RUN_FPS)%available.length;
          resolvedPose=available[frame];
        }
      }
      resolvedPose=this.reaperPoseSprites[resolvedPose]?resolvedPose:
        (this.reaperPoseSprites.idle?'idle':Object.keys(this.reaperPoseSprites)[0]);
      const playerVisible=Boolean(p)&&this.reaperReady&&
        !['reliquary','refundConfirm'].includes(s.state);
      for(const [name,sprite] of Object.entries(this.reaperPoseSprites))
        sprite.setVisible(name===resolvedPose&&playerVisible);
      const image=this.reaperPoseSprites[resolvedPose];
      if(image&&p&&!['reliquary','refundConfirm'].includes(s.state)){
        const resolvedMeta=ILLUSTRATED.reaper[resolvedPose],scale=resolvedMeta.scale,[ax,ay]=resolvedMeta.anchor;
        image.setScale(scale).setPosition(p.x-ax*scale,(s.feetY||p.y)-ay*scale)
          .setVisible(true).setAlpha(p.invulMs>0&&Math.floor(s.frame/5)%2===0?.58:1)
          .setTint(p.slowMs>0?0xb9ecff:0xffffff);
      }
      let used=0;
      if(!['menu','reliquary','refundConfirm'].includes(s.state)){
        const left=s.cameraX-100,right=s.cameraX+s.width+100;
        for(const e of s.enemies||[]){
          if(e.kind!=='bat'||e.dead||e.x<left||e.x>right||used>=this.batPool.length)continue;
          const flapFrame=Math.floor(Math.max(0,s.elapsed||0)*ILLUSTRATED_BAT_FPS+
            (e.phase||0))%ILLUSTRATED_BAT_FLAP.length;
          const name=e.mode==='dive'?'dive':ILLUSTRATED_BAT_FLAP[flapFrame];
          const meta=ILLUSTRATED.bat[name],sprite=this.batPool[used++];
          const [ax,ay]=meta.anchor;
          sprite.setTexture(meta.key).setOrigin(0,0).setScale(meta.scale)
            .setPosition(e.x-ax*meta.scale,e.y-ay*meta.scale).setVisible(true)
            .setAlpha(e.hp<1?.5:1).setRotation(e.mode==='dive'?.10:0);
        }
      }
      for(let i=used;i<this.batPool.length;i++)this.batPool[i].setVisible(false);
    }
    renderReviewV2(){
      const s=this.scene,p=s.player;
      let pose=this.illustratedReaperPose();
      if(pose==='run'){
        const frame=Math.floor(Math.max(0,s.elapsed||0)*V2_REAPER_RUN_FPS)%V2_REAPER_RUN.length;
        pose=V2_REAPER_RUN[frame];
      }
      if(!this.reaperPoseSprites[pose])pose=this.reaperPoseSprites.idle?'idle':
        (V2_REAPER_RUN.find(name=>this.reaperPoseSprites[name])||Object.keys(this.reaperPoseSprites)[0]);
      const playerVisible=Boolean(p)&&!['reliquary','refundConfirm'].includes(s.state);
      for(const [name,sprite] of Object.entries(this.reaperPoseSprites))
        sprite.setVisible(name===pose&&playerVisible);
      const image=this.reaperPoseSprites[pose],meta=V2_REAPER[pose];
      if(image&&meta&&p&&playerVisible){
        const scale=meta.scale,[ax,ay]=meta.anchor;
        image.setScale(scale).setPosition(p.x-ax*scale,(s.feetY||p.y)-ay*scale)
          .setVisible(true).setAlpha(p.invulMs>0&&Math.floor(s.frame/5)%2===0?.58:1)
          .setTint(p.slowMs>0?0xb9ecff:0xffffff);
      }
      let used=0;
      if(!['menu','reliquary','refundConfirm'].includes(s.state)){
        const left=s.cameraX-100,right=s.cameraX+s.width+100;
        for(const e of s.enemies||[]){
          if(e.kind!=='bat'||e.dead||e.x<left||e.x>right||used>=this.batPool.length)continue;
          const flapFrame=Math.floor(Math.max(0,s.elapsed||0)*V2_BAT_FLAP_FPS+
            (e.phase||0))%V2_BAT_FLAP.length;
          const name=e.mode==='dive'?'dive':V2_BAT_FLAP[flapFrame];
          const bm=V2_BAT[name],sprite=this.batPool[used++],[ax,ay]=bm.anchor;
          sprite.setTexture(bm.key).setOrigin(0,0).setScale(bm.scale)
            .setPosition(e.x-ax*bm.scale,e.y-ay*bm.scale).setVisible(true)
            .setAlpha(e.hp<1?.5:1).setRotation(e.mode==='dive'?.10:0);
        }
      }
      for(let i=used;i<this.batPool.length;i++)this.batPool[i].setVisible(false);
    }
    render(){
      const s=this.scene;
      const p=s.player;
      if(this.reviewV2){this.renderReviewV2();return;}
      if(this.illustrated){this.renderIllustrated();return;}
      if(this.reaperReady&&this.reaper){
        const visible=Boolean(p)&&!['reliquary','refundConfirm'].includes(s.state);
        this.reaper.setVisible(visible);
        if(visible){
          const pose=reaperPose({
            player:p,state:s.state,elapsed:s.elapsed,
            attackDurationMs:s.attackDurationMs||260,
            damageFlashMs:s.damageFlashMs
          });
          this.reaper.setFrame(pose.frame);
          // Frame cell is 192px high, feet in drawn art are at Y~176.
          // Origin bottom + 12px offset places boots on gameplay terrain.
          this.reaper.setPosition(p.x,s.feetY+12);
          this.reaper.setAlpha(p.invulMs>0&&Math.floor(s.frame/5)%2===0?.58:1);
          this.reaper.setTint(p.slowMs>0?0xb9ecff:0xffffff);
          this.reaper.setScale(.74);
        }
      }
      if(!this.batReady)return;
      let used=0;
      if(!['menu','reliquary','refundConfirm'].includes(s.state)){
        const left=s.cameraX-100,right=s.cameraX+s.width+100;
        for(const e of s.enemies||[]){
          if(e.kind!=='bat'||e.dead||e.x<left||e.x>right)continue;
          if(used>=this.batPool.length)break;
          const sprite=this.batPool[used++];
          sprite.setVisible(true).setPosition(e.x,e.y);
          sprite.setFrame(cavernBatFrame(e,s.elapsed));
          sprite.setAlpha(e.hp<1?.5:1);
          sprite.setRotation(e.mode==='dive'?.10:0);
        }
      }
      for(let i=used;i<this.batPool.length;i++)
        this.batPool[i].setVisible(false);
    }
    shutdown(){
      this.disposed=true;
      if(this.reaper){this.reaper.destroy();this.reaper=null;}
      for(const sprite of Object.values(this.reaperPoseSprites))if(sprite!==this.reaper)sprite.destroy();
      this.reaperPoseSprites={};
      for(const sprite of this.batPool)sprite.destroy();
      this.batPool=[];
      this.reaperReady=false;this.batReady=false;
    }
  }
  scope.GRIM_VISUALS={GrimVisualSystem,reaperPose,cavernBatFrame,REAPER,BAT,CDN_PATHS,ILLUSTRATED,
    ILLUSTRATED_RUN,ILLUSTRATED_BAT_FLAP,ILLUSTRATED_RUN_FPS,ILLUSTRATED_BAT_FPS,
    V2_REAPER,V2_BAT,V2_REAPER_RUN,V2_BAT_FLAP,V2_REAPER_RUN_FPS,V2_BAT_FLAP_FPS,
    V2_REAPER_SCALE,V2_BAT_SCALE,REVIEW_INTEGRITY,validateReviewPNG};
})(typeof window!=='undefined'?window:globalThis);
