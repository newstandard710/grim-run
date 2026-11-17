/* Existing painted characters inhabit the new forest threshold. No gameplay RNG. */
(function(scope){
  'use strict';
  const stage=document.getElementById('frontispiece'),canvas=document.getElementById('title-art');
  const canopyCanvas=document.getElementById('canopy-art'),home=document.getElementById('home-screen');
  const ctx=canvas.getContext('2d'),canopy=canopyCanvas.getContext('2d'),root='assets/';
  const files={forest:'ui/v0160/veil-forest.webp',reaper:'characters/illustrated-v2/reaper/reaper_idle_v1.png',
    crawler:'enemies/illustrated-v2/bone-crawler/crawler_crawl_01_v1.png',
    imp:'enemies/illustrated-v2/ember-imp/ember_imp_atlas_v1.png',
    batFlight:(scope.GRIM_BAT_FLIGHT?.FILE||'assets/encounters/v0190/bat-flight.png?v=0.19.0').replace(/^assets\//,'')};
  const bats=['bat_wings_raised_v1.png','bat_flap_mid_up_v1.png','bat_neutral_v1.png','bat_flap_mid_down_v1.png','bat_wings_lowered_v1.png','bat_flap_mid_down_v1.png','bat_neutral_v1.png','bat_flap_mid_up_v1.png'];
  for(const file of new Set(bats))files[file]='enemies/illustrated-v2/bat/'+file;
  const images={},bounds={};let mode='home',frame=0,last=0,clock=0,loaded=false;
  stage.dataset.mode=mode;
  const motionPreference=scope.matchMedia('(prefers-reduced-motion: reduce)');
  let reduced=motionPreference.matches;
  function alphaBounds(im,sx=0,sy=0,sw=im.width,sh=im.height){
    const c=document.createElement('canvas');c.width=sw;c.height=sh;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(im,sx,sy,sw,sh,0,0,sw,sh);
    const d=g.getImageData(0,0,sw,sh).data;let left=sw,top=sh,right=0,bottom=0;
    for(let y=0;y<sh;y++)for(let x=0;x<sw;x++)if(d[(y*sw+x)*4+3]>20){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    return {x:sx+left,y:sy+top,w:right-left+1,h:bottom-top+1};
  }
  const loadedImages=Object.entries(files).map(([id,path])=>new Promise(resolve=>{
    const im=new Image();
    im.onload=()=>{
      images[id]=im;
      if(id!=='batFlight'&&id!=='forest')bounds[id]=id==='imp'?alphaBounds(im,0,0,256,256):alphaBounds(im);
      homeDirty=true;
      schedule();
      resolve();
    };
    im.onerror=resolve;
    im.src=root+path;
  }));
  function actor(id,x,feet,height,flip=false,alpha=1,paint=null){
    const im=images[id],b=bounds[id];if(!im||!b||!b.h)return;
    const width=height*b.w/b.h;
    ctx.save();ctx.globalAlpha=alpha;ctx.translate(x,feet);if(flip)ctx.scale(-1,1);
    if(paint&&!reduced)paint(im,b,width,height);
    else ctx.drawImage(im,b.x,b.y,b.w,b.h,-width/2,-height,width,height);
    ctx.restore();
  }
  function paintCloak(im,b,w,h){
    const scale=h/b.h, left=-w*.5, top=-h;
    const start=780,end=1340;
    const slice=(y,n)=>ctx.drawImage(im,b.x,y,b.w,n,left,top+(y-b.y)*scale,w,n*scale);
    if(b.y>=start||b.y+b.h<=end){slice(b.y,b.h);return;}
    slice(b.y,start-b.y);
    for(let y=start;y<end;y+=20){
      const n=Math.min(20,end-y),u=(y+n*.5-start)/(end-start);
      // Stop left of the scythe shaft and boots. The unwarped right
      // boundary shares the cape's painted attachment to the shoulder.
      const cut=940-35*Math.max(0,(y-1210)/130)-b.x;
      const dx=(Math.sin(clock*1.8-u*5)*10+Math.sin(clock*.76-u*3)*5)
        * Math.sin(Math.PI*u)*scale;
      const y0=top+(y-b.y)*scale;
      ctx.drawImage(im,b.x,y,cut,n,left+dx,y0,cut*scale-dx,n*scale);
      ctx.drawImage(im,b.x+cut,y,b.w-cut,n,left+cut*scale,y0,(b.w-cut)*scale,n*scale);
    }
    slice(end,b.y+b.h-end);
  }
  function paintIdle(period,phase,strength){
    return (im,b,w,h)=>{
      const breath=Math.sin(clock*2*Math.PI/period+phase);
      const heightAt=u=>-h+h*u-h*strength*breath*Math.sin(Math.PI*u)*Math.max(0,1-u/.90);
      for(let row=0;row<8;row++){
        const a=row/8,bottom=(row+1)/8,top=heightAt(a);
        const flex=strength*w*.48*Math.sin(Math.PI*a)*(1-a)*breath;
        ctx.drawImage(im,b.x,b.y+a*b.h,b.w,(bottom-a)*b.h,-w*.5+flex,top,w,heightAt(bottom)-top);
      }
    };
  }
  const crawlerIdle=paintIdle(3.7,.34,.045),impIdle=paintIdle(2.9,1.9,.053);
  // Paint only foliage. The base and these patches share the CSS shade,
  // while the actors remain above it. A fixed feather hides the patch edges.
  const crowns=[
    {box:[360,2,650,170],phase:0,amp:6,edge:[[15,90],[67,42],[120,8],[522,8],
      [598,31],[620,81],[610,111],[551,109],[504,149],[382,153],[342,105],[230,97],[119,84],[38,112]]},
    {box:[1140,0,532,146],phase:1.9,amp:5,edge:[[28,40],[78,12],[522,8],[522,129],
      [481,121],[419,95],[354,97],[312,73],[264,87],[228,55],[201,66],[170,41],[124,43],[97,51]]},
    {box:[93,282,205,112],phase:3.4,amp:5,edge:[[59,30],[118,12],[162,16],[148,45],
      [115,55],[152,76],[181,99],[123,99],[83,79],[67,58]]}
  ];
  function prepareCrown(crown){
    const [, , w,h]=crown.box;
    const make=()=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
    crown.tile=make();crown.ctx=crown.tile.getContext('2d');crown.mask=make();
    const mask=crown.mask.getContext('2d');
    mask.filter='blur(6px)';
    mask.beginPath();crown.edge.forEach(([x,y],i)=>i?mask.lineTo(x,y):mask.moveTo(x,y));
    mask.closePath();mask.fill();
  }
  function drawCanopy(w,h,dpr,cover){
    const im=images.forest;
    if(!im||reduced){
      if(canopyCanvas.width!==1||canopyCanvas.height!==1)canopyCanvas.width=canopyCanvas.height=1;
      return;
    }
    resizeCanvas(canopyCanvas,w,h,dpr);
    canopy.setTransform(dpr,0,0,dpr,0,0);canopy.clearRect(0,0,w,h);
    const scale=cover?.scale??Math.max(w/im.width,h/im.height);
    const left=cover?.left??(w-im.width*scale)*.5,top=cover?.top??(h-im.height*scale)*.5;
    for(const crown of crowns){
      const {box:[x,y,sw,sh],phase,amp}=crown;
      const x0=left+x*scale,y0=top+y*scale;
      if(x0>=w||x0+sw*scale<=0||y0>=h||y0+sh*scale<=0)continue;
      if(!crown.tile)prepareCrown(crown);
      const g=crown.ctx,half=sw*.5;
      g.globalCompositeOperation='source-over';g.clearRect(0,0,sw,sh);
      for(let row=0;row<8;row++){
        const sy=Math.round(row*sh/8),n=Math.round((row+1)*sh/8)-sy;
        const dx=Math.sin(row*Math.PI/7)*Math.sin(clock*1.24+phase-row/8*1.7)*amp;
        g.drawImage(im,x,y+sy,half,n,0,sy,half+dx,n);
        g.drawImage(im,x+half,y+sy,half,n,half+dx,sy,half-dx,n);
      }
      g.globalCompositeOperation='destination-in';g.drawImage(crown.mask,0,0);
      canopy.drawImage(crown.tile,x0,y0,sw*scale,sh*scale);
    }
  }
  function resizeCanvas(target,w,h,dpr){
    const width=Math.round(w*dpr),height=Math.round(h*dpr);
    if(target.width!==width||target.height!==height){target.width=width;target.height=height;}
  }

  // Home's composition is registered to the original forest and idle paintings.
  // The separate Menu path below keeps its original placement and motion.
  const reaperRect=[346,228,1454,1428],cloakRect=[346,752,976,1400];
  const cloakCell=192,cloakInset=2,cloakColumns=12,cloakSlots=96,homePaintMs=1000/30;
  const tread=[[0,672],[170,674],[308,688],[493,699],[638,711],[798,722],
    [969,735],[1124,744],[1307,749],[1497,755],[1672,765]];
  const homeActors={
    reaper:{center:939.5,bottom:1421,height:1185,contacts:[[1067,1418],[1370,1407]],shadow:[.11,.023]},
    imp:{center:127.5,bottom:245,height:175,contacts:[[50,240],[147,244]],shadow:[.16,.036],flip:true},
    crawler:{center:773,bottom:842,height:545,contacts:[[646,841],[1084,840]],shadow:[.14,.036]}
  };
  const homeArt={};
  let homeLayout,homeDirty=true,nextHomePaint=0,nextCanopyPaint=0,homeTime=0,clothStart=0;

  function loadHomeArt(name){
    if(homeArt[name])return;
    const asset={controller:new AbortController()};
    homeArt[name]=asset;
    fetch(root+'ui/v0160/home-v1/'+name+'.webp',{signal:asset.controller.signal,priority:'low'})
      .then(response=>{
        if(!response.ok)throw new Error('HTTP '+response.status);
        return response.blob();
      })
      .then(blob=>homeArt[name]===asset?createImageBitmap(blob):null)
      .then(bitmap=>{
        if(!bitmap)return;
        if(homeArt[name]!==asset){bitmap.close();return;}
        asset.bitmap=bitmap;
        if(name!=='tread'&&homeArt.cloak?.bitmap&&homeArt['reaper-plate']?.bitmap)clothStart=homeTime;
        homeDirty=true;
        schedule();
      })
      .catch(error=>{
        if(homeArt[name]===asset)console.error('Grim Run: Home '+name+' failed to load',error);
      });
  }

  function releaseHomeArt(names){
    for(const name of names){
      const asset=homeArt[name];
      if(!asset)continue;
      delete homeArt[name];
      asset.controller.abort();
      asset.bitmap?.close();
    }
  }

  function groundAt(cover,x){
    const sourceX=Math.max(0,Math.min(1672,(x-cover.left)/cover.scale));
    const index=tread.findIndex(([end])=>end>=sourceX&&end>0);
    const [a,y0]=tread[index-1],[b,y1]=tread[index];
    return cover.top+cover.scale*(y0+(y1-y0)*(sourceX-a)/(b-a));
  }

  function planted(id,x,h,cover){
    const {center,bottom,height,contacts,flip,shadow}=homeActors[id];
    const scale=h/height;
    const soles=contacts.map(([sx,sy])=>[(sx-center)*scale*(flip?-1:1),(sy-bottom)*scale]);
    const [[ax,ay],[bx,by]]=soles;
    const angle=Math.atan((groundAt(cover,x+bx)-groundAt(cover,x+ax))/(bx-ax))
      -Math.atan((by-ay)/(bx-ax));
    const c=Math.cos(angle),s=Math.sin(angle);
    const feet=soles.map(([dx,dy])=>[x+dx*c-dy*s,dx*s+dy*c]);
    const y=feet.reduce((sum,[px,dy])=>sum+groundAt(cover,px)-dy,0)/feet.length;
    return {x,y,h,scale,angle,shadow,feet:feet.map(([px,dy])=>[px,y+dy])};
  }

  function layoutHome(){
    const w=stage.clientWidth,h=stage.clientHeight,dpr=Math.min(scope.devicePixelRatio||1,1.5);
    const safe=getComputedStyle(home);
    const left=parseFloat(safe.paddingLeft),right=w-parseFloat(safe.paddingRight);
    const top=parseFloat(safe.paddingTop),bottom=h-parseFloat(safe.paddingBottom);
    const width=right-left,height=bottom-top,portrait=h>w;
    const x=fraction=>left+fraction*width;
    const y=fraction=>top+fraction*height;
    const scale=Math.max(w/1672,h/941);
    const focusX=portrait?.78:.5;
    const extraY=h-941*scale;
    const focusY=extraY<0?Math.min(1,Math.max(.5,(bottom-4-765*scale)/extraY)):.5;
    const cover={scale,left:(w-1672*scale)*focusX,top:extraY*focusY};
    const copyWidth=portrait?Math.min(.86*width,360):.346*width-16;
    const copyTop=y(portrait?.10:.115),copyBottom=y(portrait?.49:.72);
    home.style.setProperty('--home-copy-width',copyWidth+'px');
    home.style.setProperty('--home-copy-x',x(.499)+'px');
    home.style.setProperty('--home-copy-y',(copyTop+copyBottom)/2+'px');
    home.style.setProperty('--home-safe-width',width+'px');
    stage.style.setProperty('--home-forest-x',focusX*100+'%');
    stage.style.setProperty('--home-forest-y',focusY*100+'%');

    const reaperX=x(portrait?.235:.163);
    const reaperHeight=Math.min((portrait?.36:.72)*height,.93*width*(portrait?.47:.326)/.92,520,
      groundAt(cover,reaperX)-(portrait?copyBottom+14:top+7));
    const reaper=planted('reaper',reaperX,reaperHeight,cover);

    const enemyLeft=x(portrait?.53:.672),enemyRight=right-4,spacing=portrait?10:12;
    const impSize=(portrait?.09:.19)*height,crawlerSize=(portrait?.115:.27)*height;
    const enemyWidth=impSize*1.07+crawlerSize*1.78;
    const enemyScale=Math.min(1,(enemyRight-enemyLeft-spacing)/enemyWidth);
    const impWidth=impSize*1.07*enemyScale,crawlerWidth=crawlerSize*1.78*enemyScale;
    const groupStart=(enemyLeft+enemyRight-impWidth-crawlerWidth-spacing)/2;
    const imp=planted('imp',groupStart+impWidth/2,impSize*enemyScale,cover);
    const crawler=planted('crawler',groupStart+impWidth+spacing+crawlerWidth/2,crawlerSize*enemyScale,cover);
    const batScale=Math.min((.32/.72)*(portrait?.13:.22)*height/52,(right-enemyLeft-16)/224);
    const batX=Math.min((enemyLeft+right)/2-56*batScale,right-8-168*batScale);
    const bob=height*.015;
    const batY=portrait?Math.max(copyBottom+10+88*batScale+bob,y(.625)):y(.35);
    const bat={x:batX,y:batY,scale:batScale,bob,left:enemyLeft,right};
    return {w,h,dpr,cover,reaper,imp,crawler,bat};
  }

  function shadowFeet(figure){
    const [wide,deep]=figure.shadow;
    for(const [x,y] of figure.feet){
      ctx.save();
      ctx.translate(x,y+figure.h*.01);
      ctx.scale(figure.h*wide,Math.max(2,figure.h*deep));
      const shade=ctx.createRadialGradient(0,0,0,0,0,1);
      shade.addColorStop(0,'#08080be6');shade.addColorStop(.35,'#09080baa');shade.addColorStop(1,'#09080b00');
      ctx.fillStyle=shade;ctx.fillRect(-1,-1,2,2);
      ctx.restore();
    }
  }

  function drawHomeReaper(figure){
    const plate=homeArt['reaper-plate']?.bitmap,cloak=homeArt.cloak?.bitmap;
    ctx.save();
    ctx.translate(figure.x,figure.y);
    ctx.rotate(figure.angle);
    if(reduced||!plate||!cloak)actor('reaper',0,0,figure.h,false,1,paintCloak);
    else{
      const {center,bottom}=homeActors.reaper,{scale}=figure;
      const projected=([l,t,r,b])=>[(l-center)*scale,(t-bottom)*scale,(r-l)*scale,(b-t)*scale];
      const pose=Math.floor(Math.max(0,homeTime-clothStart)*30)%cloakSlots;
      const tileX=pose%cloakColumns*cloakCell+cloakInset;
      const tileY=Math.floor(pose/cloakColumns)*cloakCell+cloakInset;
      const tileSize=cloakCell-2*cloakInset;
      ctx.drawImage(plate,...projected(reaperRect));
      ctx.drawImage(cloak,tileX,tileY,tileSize,tileSize,...projected(cloakRect));
    }
    ctx.restore();
  }

  function drawHomeEnemy(id,figure,flip,paint){
    ctx.save();
    ctx.translate(figure.x,figure.y);
    ctx.rotate(figure.angle);
    actor(id,0,0,figure.h,flip,.96,paint);
    ctx.restore();
  }

  function drawHomeBat({x,y,scale,bob,left,right}){
    const eyeY=y+Math.sin(clock*1.3)*bob,art=scope.GRIM_BAT_FLIGHT;
    if(images.batFlight&&art){
      ctx.save();ctx.translate(x,eyeY);ctx.scale(-1,1);
      ctx.globalAlpha=.9;art.drawFrame(ctx,images.batFlight,clock,0,0,scale);
      ctx.restore();
    }else{
      const bat=bats[Math.floor(clock*8/.96)%bats.length],b=bounds[bat];
      if(b)actor(bat,(left+right)*.5,eyeY+74*scale,
        Math.min(162*scale,(right-left-16)*b.h/b.w),true,.9);
    }
  }

  function drawHome(t){
    if(!homeDirty&&t+1<nextHomePaint)return;
    nextHomePaint=t+homePaintMs-Math.max(0,Math.min(t-nextHomePaint,homePaintMs*.5));
    const wasDirty=homeDirty;
    homeDirty=false;
    const {w,h,dpr,cover,reaper,imp,crawler,bat}=homeLayout??=layoutHome();
    if(w<=0||h<=0)return;
    resizeCanvas(canvas,w,h,dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    if(wasDirty||t>=nextCanopyPaint){
      drawCanopy(w,h,dpr,cover);
      nextCanopyPaint=t+1000/15-1;
    }
    const path=homeArt.tread?.bitmap;
    if(path)ctx.drawImage(path,cover.left,cover.top+626*cover.scale,1672*cover.scale,224*cover.scale);
    shadowFeet(reaper);shadowFeet(imp);shadowFeet(crawler);
    drawHomeReaper(reaper);
    drawHomeBat(bat);
    drawHomeEnemy('imp',imp,true,impIdle);
    drawHomeEnemy('crawler',crawler,false,crawlerIdle);

    // Keep the existing opening preload presentation and readiness handshake.
    if(images.forest)loadHomeArt('tread');
    if(!reduced&&images.reaper){
      loadHomeArt('reaper-plate');
      loadHomeArt('cloak');
    }
  }

  function draw(t){
    frame=0;if(!['home','menu'].includes(mode)||document.hidden)return;
    const elapsed=Math.max(0,(t-last)/1000||0);
    last=t;
    if(!reduced)clock+=Math.min(.06,elapsed);
    if(mode==='home'){
      if(!reduced)homeTime+=elapsed;
      drawHome(t);
      if(!reduced)frame=requestAnimationFrame(draw);
      return;
    }
    const w=stage.clientWidth,h=stage.clientHeight,dpr=Math.min(scope.devicePixelRatio||1,1.5);
    resizeCanvas(canvas,w,h,dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    drawCanopy(w,h,dpr);
    const portrait=h>w;
    const x=portrait?w*.23:w*.21,feet=portrait?h*.91:h*.92,rh=portrait?h*.43:h*.77;
    ctx.save();ctx.translate(x,feet);ctx.scale(1,.2);const shadow=ctx.createRadialGradient(0,0,0,0,0,rh*.4);shadow.addColorStop(0,'#020409cc');shadow.addColorStop(1,'#02040900');ctx.fillStyle=shadow;ctx.fillRect(-rh*.4,-rh*.4,rh*.8,rh*.8);ctx.restore();
    actor('reaper',x,feet,rh,false,1,paintCloak);
    const batHeight=h*(portrait?.14:.24),batY=h*(portrait?.67:.36)+Math.sin(clock*1.3)*h*.025;
    if(images.batFlight&&scope.GRIM_BAT_FLIGHT){
      const art=scope.GRIM_BAT_FLIGHT,placement=art.homePlacement(w,h,clock);
      ctx.save();ctx.translate(placement.x,placement.y);ctx.scale(-1,1);
      ctx.globalAlpha=.9;art.drawFrame(ctx,images.batFlight,clock,0,0,placement.scale);
      ctx.restore();
    }else {const bat=bats[Math.floor(clock*8/.96)%bats.length];actor(bat,w*.84,batY,batHeight,true,.9);}
    actor('imp',w*.69,h*.91,h*(portrait?.12:.2),true,.88,impIdle);
    actor('crawler',w*.86,h*.91,h*(portrait?.17:.28),false,.9,crawlerIdle);
    // Dim moving motes sit below typography, independently of the run RNG.
    for(let i=0;i<19;i++){const phase=(clock*(.012+i%3*.003)+i*.173)%1,px=w*((i*.618+.07)%1),py=h*(.2+(1-phase)*.64);ctx.globalAlpha=Math.sin(phase*Math.PI)*.35;ctx.fillStyle=i%4?'#bed5c7':'#d9b275';ctx.beginPath();ctx.arc(px+Math.sin(clock*.2+i)*10,py,i%3?.8:1.25,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
    if(!reduced)frame=requestAnimationFrame(draw);
  }
  function schedule(){
    if(!frame&&!document.hidden&&['home','menu'].includes(mode)){last=performance.now();frame=requestAnimationFrame(draw);}
  }
  motionPreference.addEventListener('change',event=>{
    reduced=event.matches;
    if(reduced)releaseHomeArt(['cloak','reaper-plate']);
    homeDirty=true;
    if(frame){cancelAnimationFrame(frame);frame=0;}
    schedule();
  });
  scope.GRIM_FRONTEND={
    setMode(next){
      if(mode==='home'&&next!=='home'){
        releaseHomeArt(['cloak','reaper-plate','tread']);
        homeLayout=null;
        homeDirty=true;
        nextHomePaint=nextCanopyPaint=homeTime=0;
      }
      mode=next;
      stage.dataset.mode=mode;
      const shown=['home','menu'].includes(mode);
      stage.classList.toggle('hidden',!shown);
      if(frame){cancelAnimationFrame(frame);frame=0;}
      if(!shown){
        canvas.width=canvas.height=canopyCanvas.width=canopyCanvas.height=1;
        for(const crown of crowns)crown.tile=crown.ctx=crown.mask=null;
      }
      schedule();
    },
    get ready(){return loaded;}
  };
  Promise.all(loadedImages).then(()=>{loaded=true;stage.dataset.ready='true';schedule();});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden&&frame){cancelAnimationFrame(frame);frame=0;}
    else {homeDirty=true;schedule();}
  });
  scope.addEventListener('resize',()=>{
    homeLayout=null;
    homeDirty=true;
    if(mode==='home'||reduced)schedule();
  });
  const shapes={
    'attack-btn':'<path d="M13 49 36 11M12 46l8 5M31 12c9-8 21-6 24 1-10-3-16 1-23 8l2-8Z"/><path d="m18 40 3 2M23 31l3 2M28 23l3 2"/>',
    'crossbow-btn':'<path d="m13 48 34-34M10 50l7-2-5-5-2 7ZM29 10c20 2 25 8 25 25M29 10l1 16 24 9M30 26l-5 5M43 6l9 2-1 9M32 30l5 5"/>',
    'jump-btn':'<path d="M30 48V16M17 29l13-15 13 15M12 50h36"/><path d="M10 37v-8M50 37v-8"/>',
    'slide-btn':'<path d="M11 49h40M18 42l9-12 13 1 9 10M27 30l-8-4-8 10M10 18h12M7 24h8"/><circle cx="34" cy="18" r="6"/>',
    'rewind-btn':'<path d="M15 22a20 20 0 1 1-2 22M15 10v15H2M32 17v16l-10 6"/>',
    'practice-slow-btn':'<circle cx="30" cy="30" r="22"/><path d="M30 15v16l-10 8"/>'
  };
  for(const [id,shape]of Object.entries(shapes)){
    const symbol=document.querySelector('#'+id+' .symbol');if(symbol)symbol.innerHTML='<svg viewBox="0 0 60 60" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+shape+'</svg>';
  }
})(window);
