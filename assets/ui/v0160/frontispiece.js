/* Existing painted characters inhabit the new forest threshold. No gameplay RNG. */
(function(scope){
  'use strict';
  const stage=document.getElementById('frontispiece'),canvas=document.getElementById('title-art');
  const ctx=canvas.getContext('2d'),root='assets/';
  const files={reaper:'characters/illustrated-v2/reaper/reaper_idle_v1.png',
    crawler:'enemies/illustrated-v2/bone-crawler/crawler_crawl_01_v1.png',
    imp:'enemies/illustrated-v2/ember-imp/ember_imp_atlas_v1.png'};
  const bats=['bat_wings_raised_v1.png','bat_flap_mid_up_v1.png','bat_neutral_v1.png','bat_flap_mid_down_v1.png','bat_wings_lowered_v1.png','bat_flap_mid_down_v1.png','bat_neutral_v1.png','bat_flap_mid_up_v1.png'];
  for(const file of new Set(bats))files[file]='enemies/illustrated-v2/bat/'+file;
  const images={},bounds={};let mode='home',frame=0,last=0,clock=0,loaded=false;
  const reduced=scope.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function alphaBounds(im,sx=0,sy=0,sw=im.width,sh=im.height){
    const c=document.createElement('canvas');c.width=sw;c.height=sh;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(im,sx,sy,sw,sh,0,0,sw,sh);
    const d=g.getImageData(0,0,sw,sh).data;let left=sw,top=sh,right=0,bottom=0;
    for(let y=0;y<sh;y++)for(let x=0;x<sw;x++)if(d[(y*sw+x)*4+3]>20){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    return {x:sx+left,y:sy+top,w:right-left+1,h:bottom-top+1};
  }
  const loadedImages=Object.entries(files).map(([id,path])=>new Promise(resolve=>{
    const im=new Image();im.onload=()=>{images[id]=im;bounds[id]=id==='imp'?alphaBounds(im,0,0,256,256):alphaBounds(im);resolve();};im.onerror=resolve;im.src=root+path;
  }));
  function actor(id,x,feet,height,flip=false,alpha=1){
    const im=images[id],b=bounds[id];if(!im||!b||!b.h)return;
    const width=height*b.w/b.h;ctx.save();ctx.globalAlpha=alpha;ctx.translate(x,feet);if(flip)ctx.scale(-1,1);
    ctx.drawImage(im,b.x,b.y,b.w,b.h,-width/2,-height,width,height);ctx.restore();
  }
  function draw(t){
    frame=0;if(!['home','menu'].includes(mode)||document.hidden)return;
    const dt=Math.min(.06,(t-last)/1000||0);last=t;if(!reduced)clock+=dt;
    const w=stage.clientWidth,h=stage.clientHeight,dpr=Math.min(scope.devicePixelRatio||1,1.5);
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const portrait=h>w;
    const x=portrait?w*.23:w*.21,feet=portrait?h*.91:h*.92,rh=portrait?h*.43:h*.77;
    ctx.save();ctx.translate(x,feet);ctx.scale(1,.2);const shadow=ctx.createRadialGradient(0,0,0,0,0,rh*.4);shadow.addColorStop(0,'#020409cc');shadow.addColorStop(1,'#02040900');ctx.fillStyle=shadow;ctx.fillRect(-rh*.4,-rh*.4,rh*.8,rh*.8);ctx.restore();
    actor('reaper',x,feet,rh*(1+Math.sin(clock*1.8)*.0025));
    const bat=bats[Math.floor(clock*9)%bats.length];actor(bat,w*.84,h*(portrait?.67:.36)+Math.sin(clock*1.3)*h*.025,h*(portrait?.14:.24),true,.9);
    actor('crawler',w*.86,h*.91,h*(portrait?.17:.28),true,.9);
    actor('imp',w*.69,h*.91+Math.sin(clock*2)*.8,h*(portrait?.12:.2),true,.88);
    // Dim moving motes sit below typography, independently of the run RNG.
    for(let i=0;i<19;i++){const phase=(clock*(.012+i%3*.003)+i*.173)%1,px=w*((i*.618+.07)%1),py=h*(.2+(1-phase)*.64);ctx.globalAlpha=Math.sin(phase*Math.PI)*.35;ctx.fillStyle=i%4?'#bed5c7':'#d9b275';ctx.beginPath();ctx.arc(px+Math.sin(clock*.2+i)*10,py,i%3?.8:1.25,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
    if(!reduced)frame=requestAnimationFrame(draw);
  }
  function schedule(){if(loaded&&!frame&&!document.hidden&&['home','menu'].includes(mode)){last=performance.now();frame=requestAnimationFrame(draw);}}
  scope.GRIM_FRONTEND={setMode(next){mode=next;stage.classList.toggle('hidden',!['home','menu'].includes(next));if(frame){cancelAnimationFrame(frame);frame=0;}schedule();},get ready(){return loaded;}};
  Promise.all(loadedImages).then(()=>{loaded=true;stage.dataset.ready='true';schedule();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&frame){cancelAnimationFrame(frame);frame=0;}else schedule();});
  scope.addEventListener('resize',()=>{if(reduced)schedule();});
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
