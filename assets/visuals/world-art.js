/* Grim Run — Full Route World Art, v0.11.5
 * Pure presentation helpers. They never write terrain, collision or game state.
 */
(function(scope){
  'use strict';
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const mix=(a,b,t)=>{
    const v=clamp(t,0,1),channel=shift=>
      Math.round(((a>>shift)&255)*(1-v)+((b>>shift)&255)*v);
    return (channel(16)<<16)|(channel(8)<<8)|channel(0);
  };

  function drawRidge(scene,g,w,baseY,spacing,factor,color,alpha,seed){
    const offset=scene.cameraX*factor;
    const first=Math.floor(offset/spacing)-2;
    const last=first+Math.ceil(w/spacing)+4;
    g.fillStyle(color,alpha);
    for(let n=first;n<last;n++){
      const x=n*spacing-offset;
      const h=(.16+((Math.sin(n*8.23+seed)+1)*.5)*.20)*scene.height;
      const notch=(Math.sin(n*4.11+seed*2)+1)*.035*scene.height;
      const peakY=baseY-h;
      g.fillPoints([
        {x:x-spacing*.15,y:baseY},
        {x:x+spacing*.16,y:peakY+notch},
        {x:x+spacing*.31,y:peakY},
        {x:x+spacing*.43,y:peakY+notch*.55},
        {x:x+spacing,y:baseY}
      ],true);
    }
  }

  function drawPines(scene,g,w,baseY,maxHeight,spacing,factor,color,alpha,highlight){
    if(alpha<=.01)return;
    const offset=scene.cameraX*factor;
    const first=Math.floor(offset/spacing)-2;
    const last=first+Math.ceil(w/spacing)+4;
    for(let n=first;n<last;n++){
      const x=n*spacing-offset;
      const variation=(Math.sin(n*19.17+factor*41)+1)*.5;
      const height=maxHeight*(.68+variation*.47);
      const width=height*(.28+variation*.09);
      const trunk=2.4+variation*2.3;
      const top=baseY-height;
      g.fillStyle(mix(color,0x0b171b,.22),alpha*.78);
      g.fillRect(x-trunk*.5,top+height*.19,trunk,height*.85);
      for(let tier=0;tier<4;tier++){
        const y=top+height*(.04+tier*.18);
        const spread=width*(.25+tier*.205);
        const bottom=y+height*(.25-tier*.018);
        g.fillStyle(tier%2===0?color:mix(color,0x263b3b,.16),alpha);
        g.fillTriangle(x,y,x-spread,bottom,x+spread,bottom);
        if(tier>0){
          g.lineStyle(1.35,highlight,alpha*.29);
          g.lineBetween(x-spread*.78,bottom-height*.025,x,bottom-height*.075);
        }
      }
      if(variation>.66){
        g.lineStyle(1.4,highlight,alpha*.25);
        g.lineBetween(x-trunk*.5,baseY-height*.34,x-width*.52,baseY-height*.42);
      }
    }
  }

  function drawRollingHills(scene,g,w,baseY,spacing,factor,amplitude,color,alpha,highlight,seed){
    const offset=scene.cameraX*factor;
    const first=Math.floor(offset/spacing)-2;
    const last=first+Math.ceil(w/spacing)+4;
    for(let n=first;n<last;n++){
      const x=n*spacing-offset;
      const variation=(Math.sin(n*13.37+seed)+1)*.5;
      const rise=amplitude*(.48+variation*.42);
      const peakX=x+spacing*(.34+variation*.18);
      const peakY=baseY-rise;
      g.fillStyle(color,alpha);
      g.fillPoints([
        {x:x-spacing*.12,y:baseY+22},
        {x:x-spacing*.08,y:baseY-rise*.18},
        {x:x+spacing*.16,y:baseY-rise*.68},
        {x:peakX,y:peakY},
        {x:x+spacing*.73,y:baseY-rise*.73},
        {x:x+spacing*1.08,y:baseY+22}
      ],true);
      g.lineStyle(1.4,highlight,alpha*.32);
      g.lineBetween(x-spacing*.08,baseY-rise*.18,peakX,peakY+rise*.06);
      g.lineBetween(peakX,peakY+rise*.06,x+spacing*.73,baseY-rise*.73);
    }
  }

  function drawMountainRange(scene,g,w,baseY,spacing,factor,maxHeight,color,alpha,snowColor,snowAlpha,seed){
    const offset=scene.cameraX*factor;
    const first=Math.floor(offset/spacing)-2;
    const last=first+Math.ceil(w/spacing)+4;
    for(let n=first;n<last;n++){
      const x=n*spacing-offset;
      const variation=(Math.sin(n*14.23+seed)+1)*.5;
      const height=maxHeight*(.64+variation*.30);
      const peakX=x+spacing*(.42+variation*.12);
      const peakY=baseY-height;
      const leftShoulderX=x+spacing*(.19+variation*.035);
      const leftShoulderY=baseY-height*(.48+variation*.08);
      const rightShoulderX=x+spacing*(.71+variation*.045);
      const rightShoulderY=baseY-height*(.53+variation*.09);
      const rightFaceX=x+spacing*.87;
      const rightFaceY=baseY-height*.25;
      g.fillStyle(color,alpha);
      g.fillPoints([
        {x:x-spacing*.08,y:baseY+20},
        {x:x+spacing*.055,y:baseY-height*.22},
        {x:leftShoulderX,y:leftShoulderY},
        {x:peakX,y:peakY},
        {x:x+spacing*.60,y:baseY-height*.37},
        {x:rightShoulderX,y:rightShoulderY},
        {x:rightFaceX,y:rightFaceY},
        {x:x+spacing*1.06,y:baseY+20}
      ],true);
      g.fillStyle(mix(color,0x0c1722,.30),alpha*.62);
      g.fillPoints([
        {x:peakX,y:peakY},
        {x:x+spacing*.60,y:baseY-height*.37},
        {x:rightShoulderX,y:rightShoulderY},
        {x:rightFaceX,y:rightFaceY},
        {x:x+spacing*1.06,y:baseY+20},
        {x:peakX+spacing*.035,y:baseY+18}
      ],true);
      g.lineStyle(1.5,mix(color,0xb5c3cc,.34),alpha*.36);
      g.lineBetween(leftShoulderX,leftShoulderY,peakX,peakY);
      g.lineBetween(peakX,peakY,rightShoulderX,rightShoulderY);
      if(snowAlpha>.01){
        // The compact cap shares the apex and remains within both rising slopes.
        const capWidth=Math.min(spacing*.08,(peakX-leftShoulderX)*.36,
          (rightShoulderX-peakX)*.30);
        g.fillStyle(snowColor,snowAlpha);
        g.fillPoints([
          {x:peakX,y:peakY},
          {x:peakX-capWidth*.52,y:peakY+height*.16},
          {x:peakX-capWidth*.94,y:peakY+height*.22},
          {x:peakX-capWidth*.52,y:peakY+height*.20},
          {x:peakX-capWidth*.13,y:peakY+height*.245},
          {x:peakX+capWidth*.34,y:peakY+height*.18},
          {x:peakX+capWidth*.88,y:peakY+height*.22},
          {x:peakX+capWidth*.62,y:peakY+height*.14}
        ],true);
        g.lineStyle(1.1,0xe2ebee,snowAlpha*.42);
        g.lineBetween(peakX-capWidth*.54,peakY+height*.15,
          peakX+capWidth*.48,peakY+height*.16);
      }
    }
  }

  function drawOpeningForest(scene,g,w,h,groundY){
    const meters=clamp(scene.distance||0,0,1200);
    const climb=clamp(meters/1200,0,1);
    const forest=1-clamp((meters-760)/520,0,.82);
    for(let band=0;band<10;band++){
      const t=band/9;
      g.fillStyle(mix(0x0b1524,0x26383b,t*.86),1);
      g.fillRect(0,h*band/10,w,h/10+1);
    }
    const moonX=w*.76-scene.cameraX*.004;
    const moonY=h*.215;
    g.fillStyle(0xb6cad0,.07);g.fillCircle(moonX,moonY,49);
    g.fillStyle(0xced8d1,.92);g.fillCircle(moonX,moonY,24);
    g.fillStyle(0x34434a,.92);g.fillCircle(moonX-9,moonY-7,21);
    for(let i=0;i<20;i++){
      const x=((i*173+53-scene.cameraX*.012)%(w+80)+(w+80))%(w+80)-40;
      const y=(i*97+31)%(Math.max(1,groundY*.77));
      g.fillStyle(i%4===0?0xe0e6d8:0xa8bac0,.16+(i%3)*.035);
      g.fillCircle(x,y,i%7===0?1.7:1);
    }
    // Quiet ridgelines sit behind the trees and keep the horizon from reading flat.
    drawRidge(scene,g,w,groundY*.88,290,.035,0x34444a,.44,.4);
    drawRidge(scene,g,w,groundY*.91,235,.075,0x293b41,.62,1.6);
    const mountainReveal=clamp((meters-520)/680,0,.52);
    drawRidge(scene,g,w,groundY*.94,320,.12,
      mix(0x202f38,0x354451,mountainReveal),.52,.9);
    // Thin cloud banks and low mist soften the silhouettes without veiling hazards.
    for(let i=0;i<6;i++){
      const period=w+260;
      const x=((i*213-scene.cameraX*(.018+i*.003)+period)%period)-130;
      const y=h*(.30+(i%3)*.105);
      g.fillStyle(0x80918d,.035+(i%2)*.012);
      g.fillEllipse(x,y,190+(i%3)*48,18+(i%2)*8);
      g.fillEllipse(x+62,y+5,120,13);
    }
    drawPines(scene,g,w,groundY*.91,groundY*.48,188,.045,0x35464a,.58*forest,0x82918a);
    drawPines(scene,g,w,groundY+10,groundY*.71,132,.145,0x25383c,.88*forest,0x61776f);
    drawPines(scene,g,w,groundY+30,groundY*.68,177,.31,0x1b2c30,.96*forest,0x506760);
    for(let i=0;i<4;i++){
      const y=groundY-66+i*21;
      g.fillStyle(mix(0x566b6a,0x83917d,climb),.045-i*.006);
      g.fillRect(0,y,w,18);
    }
    for(let i=0;i<9;i++){
      const x=((i*131-scene.cameraX*.21+(scene.elapsed||0)*5)%(w+40)+(w+40))%(w+40)-20;
      const y=groundY*(.55+(i%4)*.075)+Math.sin((scene.elapsed||0)*1.4+i)*5;
      g.fillStyle(0xc0c58c,.24);
      g.fillCircle(x,y,1.35+(i%3)*.25);
    }
  }

  function drawFoothills(scene,g,w,h,groundY){
    const meters=clamp(scene.distance||0,900,2300);
    const climb=clamp((meters-900)/1300,0,1);
    const pines=.72-climb*.55;
    const top=mix(0x0b1524,0x111b2b,climb);
    const low=mix(0x26383b,0x34414b,climb);
    for(let band=0;band<10;band++){
      const t=band/9;
      g.fillStyle(mix(top,low,t*.86),1);
      g.fillRect(0,h*band/10,w,h/10+1);
    }
    const moonX=w*.76-scene.cameraX*.004;
    const moonY=h*.215;
    g.fillStyle(0xb6cad0,.07);
    g.fillCircle(moonX,moonY,49);
    g.fillStyle(0xced8d1,.9-climb*.18);
    g.fillCircle(moonX,moonY,24);
    g.fillStyle(0x34434a,.92);
    g.fillCircle(moonX-9,moonY-7,21);
    for(let i=0;i<24;i++){
      const x=((i*173+53-scene.cameraX*.012)%(w+80)+(w+80))%(w+80)-40;
      const y=(i*97+31)%(Math.max(1,groundY*.77));
      g.fillStyle(i%4===0?0xe0e6d8:0xa8bac0,.12+(i%3)*.025);
      g.fillCircle(x,y,i%7===0?1.7:1);
    }
    // The old tree line thins as rounded foothills and sharper mountain ridges rise behind it.
    drawRidge(scene,g,w,groundY*.87,355,.035,mix(0x34464a,0x3a4758,climb),.5,.7);
    drawRidge(scene,g,w,groundY*.91,280,.075,mix(0x2b3d42,0x2a3949,climb),.66,1.9);
    const peaks=clamp((meters-1100)/1150,0,1);
    drawRidge(scene,g,w,groundY*.94,330,.12,
      mix(0x27383e,0x344155,peaks),.66,.3);
    drawRollingHills(scene,g,w,groundY*.88,420,.08,groundY*.20,
      mix(0x293c3e,0x34424d,climb),.68,0x718076,1.4);
    drawRollingHills(scene,g,w,groundY*.97,310,.20,groundY*.14,
      mix(0x233638,0x2b3944,climb),.88,0x65746f,2.2);
    drawPines(scene,g,w,groundY*.96,groundY*.39,270,.15,0x2a3d3d,.55*pines,0x738276);
    drawPines(scene,g,w,groundY+12,groundY*.47,330,.29,0x1d3032,.75*pines,0x596c62);
    for(let i=0;i<5;i++){
      const period=w+260;
      const x=((i*239-scene.cameraX*(.018+i*.003)+period)%period)-130;
      const y=h*(.31+(i%3)*.10);
      g.fillStyle(0x89958f,.03+(i%2)*.012);
      g.fillEllipse(x,y,180+(i%3)*44,17+(i%2)*7);
      g.fillEllipse(x+58,y+4,116,12);
    }
  }

  function drawTundra(scene,g,w,h,groundY){
    const meters=clamp(scene.distance||0,1900,3400);
    const climb=clamp((meters-1900)/1500,0,1);
    const skyTop=mix(0x0b1524,0x101a2b,climb);
    const skyLow=mix(0x26383b,0x354454,climb);
    for(let band=0;band<10;band++){
      const t=band/9;
      g.fillStyle(mix(skyTop,skyLow,t*.88),1);
      g.fillRect(0,h*band/10,w,h/10+1);
    }
    const moonX=w*.77-scene.cameraX*.003;
    const moonY=h*.20;
    g.fillStyle(0xb8cbd3,.055);g.fillCircle(moonX,moonY,50);
    g.fillStyle(0xd8e0df,.78);g.fillCircle(moonX,moonY,23);
    g.fillStyle(0x283746,.92);g.fillCircle(moonX-9,moonY-7,20);
    for(let i=0;i<34;i++){
      const x=((i*193+31-scene.cameraX*.011)%(w+70)+(w+70))%(w+70)-35;
      const y=(i*109+23)%(Math.max(1,groundY*.71));
      const opacity=.13+(i%4)*.035+climb*.08;
      g.fillStyle(i%5===0?0xd6e3e8:0xa9bac5,opacity);
      g.fillCircle(x,y,i%8===0?1.7:1);
    }
    const snow=.32+climb*.30;
    drawMountainRange(scene,g,w,groundY*.87,470,.035,groundY*.54,
      mix(0x2c3d4b,0x344256,climb),.68,0xc2d1d8,snow*.72,2.1);
    drawMountainRange(scene,g,w,groundY*.96,350,.105,groundY*.62,
      mix(0x233347,0x2a394c,climb),.90,0xb7c8d0,snow,5.3);
    const treeLine=1-clamp((meters-1950)/610,0,1);
    drawPines(scene,g,w,groundY*.94,groundY*.35,300,.13,0x2a3d3e,.42*treeLine,0x71817d);
    drawPines(scene,g,w,groundY+9,groundY*.40,355,.27,0x1d2e32,.60*treeLine,0x566b68);
    for(let i=0;i<5;i++){
      const period=w+220;
      const x=((i*251-scene.cameraX*(.018+i*.003)+period)%period)-110;
      const y=groundY*(.64+(i%3)*.07);
      g.fillStyle(0xa9b9c5,.025+(i%2)*.012);
      g.fillEllipse(x,y,190+(i%3)*36,17+(i%2)*7);
    }
    // Sparse windblown snow stays in the background, away from the play surface.
    for(let i=0;i<11;i++){
      const period=w+40;
      const x=((i*121-scene.cameraX*.08+(scene.elapsed||0)*11+period)%period)-20;
      const y=groundY*(.46+(i%4)*.065)+Math.sin((scene.elapsed||0)*.7+i)*3;
      g.lineStyle(1,0xd1dde1,.12);
      g.lineBetween(x,y,x+5+(i%3)*2,y-1);
    }
  }

  const SURFACE_BIOMES=Object.freeze([
    {id:'forest',start:0,end:900},
    {id:'foothills',start:900,end:2300},
    {id:'tundra',start:2300,end:5000}
  ]);
  const UNDERWORLD_BIOMES=Object.freeze([
    {id:'caves',start:5000,end:6000},
    {id:'crystals',start:6000,end:7000},
    {id:'ashlands',start:7000,end:8000},
    {id:'lava',start:8000,end:9999},
    {id:'boss',start:9999,end:20000}
  ]);
  const WORLD_BIOMES=Object.freeze([...SURFACE_BIOMES,...UNDERWORLD_BIOMES]);
  const BIOME_FADE_HALF_WIDTH=180;
  const UNDERWORLD_PALETTES=Object.freeze({
    caves:[0x171821,0x414555,0x818495,0x343844],
    crystals:[0x17212a,0x4a6475,0x87c8d8,0x354c5c],
    ashlands:[0x20181a,0x584248,0x9a6e65,0x442d31],
    lava:[0x211216,0x8e3b2b,0xff9251,0x5d2924],
    boss:[0x1c151d,0x58404e,0xc3795e,0x4c2d3a]
  });

  function biomeWeights(meters,fadeHalfWidth=BIOME_FADE_HALF_WIDTH){
    const m=Math.max(0,Number(meters)||0);
    for(let i=0;i<WORLD_BIOMES.length-1;i++){
      const edge=WORLD_BIOMES[i].end,left=edge-fadeHalfWidth,right=edge+fadeHalfWidth;
      // The 5,000m boundary is a portal cut: remain fully in Tundra until
      // arrival, then show fully formed Caves on the far side.
      if(edge===5000)continue;
      if(m>=left&&m<=right){
        const t=smooth((m-left)/(right-left));
        return {[WORLD_BIOMES[i].id]:1-t,[WORLD_BIOMES[i+1].id]:t};
      }
    }
    const index=m<900?0:m<2300?1:m<5000?2:m<6000?3:m<7000?4:m<8000?5:m<9999?6:7;
    return {[WORLD_BIOMES[index].id]:1};
  }

  function underworldWeights(meters,fadeHalfWidth=BIOME_FADE_HALF_WIDTH){
    const m=Math.max(5000,Number(meters)||5000),edges=[6000,7000,8000,9999];
    for(let i=0;i<edges.length;i++){
      const edge=edges[i],left=edge-fadeHalfWidth,right=edge+fadeHalfWidth;
      if(m>=left&&m<=right){
        const t=smooth((m-left)/(right-left));
        return {[UNDERWORLD_BIOMES[i].id]:1-t,[UNDERWORLD_BIOMES[i+1].id]:t};
      }
    }
    const index=m<6000?0:m<7000?1:m<8000?2:m<9999?3:4;
    return {[UNDERWORLD_BIOMES[index].id]:1};
  }

  function drawCavernSilhouettes(scene,g,w,h,groundY,alpha,crystal=false){
    const time=scene.elapsed||0;
    for(let layer=0;layer<2;layer++){
      const spacing=layer===0?250:172,factor=layer===0?.075:.16;
      const offset=scene.cameraX*factor,first=Math.floor(offset/spacing)-2;
      const last=first+Math.ceil(w/spacing)+4;
      for(let n=first;n<last;n++){
        const x=n*spacing-offset,shape=(Math.sin(n*18.7+layer*6.1)+1)*.5;
        const peak=groundY*(.70+shape*.10),width=spacing*(.40+shape*.25);
        g.fillStyle(layer===0?0x111827:0x0c111a,alpha*(layer===0?.58:.76));
        g.fillPoints([
          {x:x-width*.5,y:groundY*.94},{x:x-width*.12,y:peak+22},
          {x:x+width*.05,y:peak},{x:x+width*.19,y:peak+31},
          {x:x+width*.5,y:groundY*.94}
        ],true);
        if(crystal&&n%2===0){
          const base=groundY*(.81+shape*.09),height=h*(.10+shape*.12),cw=15+shape*20;
          const hue=n%4===0?0x967dcb:0x5abbd1;
          g.fillStyle(hue,alpha*.28);g.fillPoints([
            {x:x-cw,y:base},{x:x-cw*.18,y:base-height*.68},
            {x:x,y:base-height},{x:x+cw*.14,y:base-height*.70},
            {x:x+cw,y:base}
          ],true);
          g.lineStyle(1.2,0xd5f6ff,alpha*(.12+.08*(.5+.5*Math.sin(time*1.8+n))));
          g.lineBetween(x,base-height+3,x-cw*.18,base-height*.68);
        }
      }
    }
    // Ceiling teeth move at a different rate from the distant rock shelves.
    const spacing=118,factor=.11,offset=scene.cameraX*factor;
    for(let n=Math.floor(offset/spacing)-2;n<Math.ceil((offset+w)/spacing)+2;n++){
      const x=n*spacing-offset,shape=(Math.sin(n*21.3)+1)*.5;
      const length=22+shape*h*.19;
      g.fillStyle(0x090d15,alpha*.76);
      g.fillTriangle(x-20,-3,x+18,-3,x-2,length);
      if(n%3===0){
        const stalagmite=groundY*(.86+shape*.06);
        g.fillTriangle(x+40,groundY+10,x+68,groundY+10,x+55,stalagmite);
      }
    }
  }

  function drawAshlandSilhouettes(scene,g,w,h,groundY,alpha){
    const spacing=190,factor=.20,offset=scene.cameraX*factor;
    for(let n=Math.floor(offset/spacing)-2;n<Math.ceil((offset+w)/spacing)+2;n++){
      const x=n*spacing-offset,shape=(Math.sin(n*13.7)+1)*.5;
      const base=groundY*(.86+shape*.045),height=h*(.20+shape*.15);
      const trunkX=x+shape*18;
      g.lineStyle(5+shape*3,0x100e12,alpha*.91);
      g.lineBetween(trunkX,base,trunkX-4,base-height);
      for(let branch=0;branch<4;branch++){
        const y=base-height*(.27+branch*.16),side=branch%2===0?-1:1;
        const reach=28+shape*35+branch*5;
        g.lineStyle(2.4,0x110d12,alpha*.88);
        g.lineBetween(trunkX-3,y,trunkX+side*reach,y-height*(.10+shape*.06));
        g.lineBetween(trunkX+side*reach,y-height*(.10+shape*.06),
          trunkX+side*(reach+12),y-height*(.18+shape*.05));
      }
      if(n%3===0){
        g.fillStyle(0x571f24,alpha*.30);
        g.fillEllipse(trunkX+22,base-height*.78,36+shape*22,8+shape*5);
      }
    }
    // Faint ember seams and drifting ash give the enclosed region slow motion.
    for(let i=0;i<8;i++){
      const period=w+90;
      const x=((i*137-scene.cameraX*.085-timeDrift(scene)*5+period)%period+period)%period-45;
      const y=groundY*(.28+(i%5)*.105)+Math.sin((scene.elapsed||0)*.35+i)*5;
      g.fillStyle(i%3===0?0xff8552:0xbab0a3,alpha*(i%3===0?.38:.20));
      g.fillCircle(x,y,i%3===0?1.8:1.2);
    }
  }

  function timeDrift(scene){return scene.elapsed||0;}

  function drawLavaAtmosphere(scene,g,w,h,groundY,alpha,boss=false){
    const time=scene.elapsed||0,heat=boss?0.75:1;
    for(let band=0;band<5;band++){
      const y=groundY*(.43+band*.085);
      g.fillStyle(boss?0x742719:0x9d2b16,alpha*(.045+band*.018)*heat);
      g.fillRect(0,y,w,h*.055);
    }
    // Distant lava falls and pools scroll behind the main game lane.
    const spacing=boss?390:315,factor=.10,offset=scene.cameraX*factor;
    for(let n=Math.floor(offset/spacing)-2;n<Math.ceil((offset+w)/spacing)+2;n++){
      const x=n*spacing-offset,shape=(Math.sin(n*16.7)+1)*.5;
      const top=groundY*(.36+shape*.17),bottom=groundY*(.78+shape*.08);
      const width=8+shape*16;
      g.fillStyle(0xff4a20,alpha*(.22+shape*.10));
      g.fillRect(x,top,width,bottom-top);
      g.fillStyle(0xffbc56,alpha*(.10+shape*.07));
      g.fillRect(x+width*.28,top,width*.22,bottom-top);
      g.fillStyle(boss?0x21111a:0x1e1117,alpha*.72);
      g.fillTriangle(x-58,top+5,x+width+48,top+5,x+width*.5,top+44+shape*25);
    }
    for(let i=0;i<11;i++){
      const period=w+80;
      const x=((i*149-scene.cameraX*.12+time*(8+i%4)*heat+period)%period+period)%period-40;
      const y=groundY*(.23+(i%6)*.095)+Math.sin(time*.8+i*2.4)*7;
      g.fillStyle(i%3===0?0xffd071:0xff6038,alpha*(.28+(i%3)*.06));
      g.fillCircle(x,y,1.3+(i%3)*.7);
    }
    if(boss)drawCastleSilhouettes(scene,g,w,h,groundY,alpha);
  }

  function drawCastleSilhouettes(scene,g,w,h,groundY,alpha){
    const spacing=285,factor=.17,offset=scene.cameraX*factor;
    for(let n=Math.floor(offset/spacing)-2;n<Math.ceil((offset+w)/spacing)+2;n++){
      const x=n*spacing-offset,variation=(Math.sin(n*11.2)+1)*.5;
      const width=95+variation*75,height=h*(.22+variation*.20),base=groundY*.86;
      g.fillStyle(0x130e19,alpha*.72);
      g.fillRect(x-width*.5,base-height,width,height);
      g.fillTriangle(x-width*.58,base-height+5,x,base-height-38-variation*34,
        x+width*.58,base-height+5);
      g.fillRect(x-width*.75,base-height*.61,width*.28,height*.61);
      g.fillTriangle(x-width*.81,base-height*.61,x-width*.61,base-height*.78,
        x-width*.48,base-height*.61);
      g.fillRect(x+width*.45,base-height*.52,width*.26,height*.52);
      g.fillTriangle(x+width*.41,base-height*.52,x+width*.58,base-height*.67,
        x+width*.75,base-height*.52);
      g.fillStyle(0xff7944,alpha*(.24+variation*.12));
      for(let window=0;window<3;window++){
        const wy=base-height*(.34+window*.16);
        g.fillRoundedRect(x-4,wy,8,15,4);
        g.fillRoundedRect(x-width*.36,wy+10,5,11,3);
      }
    }
    // Chains and small hanging silhouettes sit high in the frame, away from the runner.
    for(let i=0;i<4;i++){
      const x=((i*213-scene.cameraX*.09)%(w+100)+(w+100))%(w+100)-50;
      const length=h*(.12+(i%3)*.035),top=h*.04;
      g.lineStyle(2,0x17121b,alpha*.84);
      g.lineBetween(x,top,x,top+length);
      g.lineStyle(2,0x8b796d,alpha*.60);
      g.strokeEllipse(x,top+length+10,14,22);
      g.lineBetween(x,top+length+20,x-8,top+length+39);
      g.lineBetween(x,top+length+20,x+8,top+length+39);
      g.lineBetween(x-8,top+length+39,x-11,top+length+56);
      g.lineBetween(x+8,top+length+39,x+11,top+length+56);
    }
  }

  function drawUnderworldDetails(scene,g,w,h,groundY,weights){
    for(const [id,weight] of Object.entries(weights||{})){
      if(weight<=.005)continue;
      g.setAlpha(weight);
      if(id==='caves')drawCavernSilhouettes(scene,g,w,h,groundY,.65,false);
      else if(id==='crystals')drawCavernSilhouettes(scene,g,w,h,groundY,.76,true);
      else if(id==='ashlands')drawAshlandSilhouettes(scene,g,w,h,groundY,.90);
      else if(id==='lava')drawLavaAtmosphere(scene,g,w,h,groundY,.88,false);
      else if(id==='boss')drawLavaAtmosphere(scene,g,w,h,groundY,.80,true);
      g.setAlpha(1);
    }
  }

  function drawSurfaceDetails(scene,g,w,h,groundY,id,alpha){
    if(alpha<=.005)return;
    const time=scene.elapsed||0,offset=scene.cameraX||0;
    g.setAlpha(alpha);
    if(id==='forest'||id==='foothills'){
      for(let i=0;i<10;i++){
        const period=w+70,x=((i*139-offset*(id==='forest' ? .045 : .07)+time*(5+i%3)+period)%period+period)%period-35;
        const y=groundY*(.30+(i%6)*.075)+Math.sin(time*.58+i*1.9)*5;
        g.fillStyle(id==='forest'?0xe5dba9:0xc8cec1,id==='forest' ? .22 : .15);
        g.fillCircle(x,y,1.1+(i%3)*.45);
      }
      if(id==='foothills'){
        for(let i=0;i<3;i++){
          const y=groundY*(.53+i*.10);
          g.fillStyle(0xb9c6c7,.025+i*.008);
          g.fillEllipse(w*.5,y,w*.72,10+i*3);
        }
      }
    }else if(id==='tundra'){
      for(let i=0;i<12;i++){
        const period=w+50,x=((i*121-offset*.08+time*10+period)%period+period)%period-25;
        const y=groundY*(.31+(i%6)*.085)+Math.sin(time*.7+i)*3;
        g.lineStyle(1,0xd1dde1,.12);g.lineBetween(x,y,x+6+(i%3)*2,y-1);
      }
    }
    g.setAlpha(1);
  }

  function drawWorldDetails(scene,g,w,h,groundY,weights){
    const underworld={};
    for(const [id,weight] of Object.entries(weights||{})){
      if(weight<=.005)continue;
      if(UNDERWORLD_BIOMES.some(biome=>biome.id===id))underworld[id]=weight;
      else drawSurfaceDetails(scene,g,w,h,groundY,id,weight);
    }
    drawUnderworldDetails(scene,g,w,h,groundY,underworld);
  }

  function underworldGroundPalette(meters){
    const weights=underworldWeights(meters);
    return blendGroundPalettes(weights,id=>UNDERWORLD_PALETTES[id]);
  }

  function blendGroundPalettes(weights,paletteFor){
    const channels=color=>[(color>>16)&255,(color>>8)&255,color&255];
    return [0,1,2,3].map(index=>{
      const total=[0,0,0],weightSum=Object.values(weights).reduce((sum,value)=>sum+value,0)||1;
      for(const [id,weight] of Object.entries(weights)){
        const palette=paletteFor(id);
        if(!palette)continue;
        const color=channels(palette[index]);
        for(let channel=0;channel<3;channel++)total[channel]+=color[channel]*weight/weightSum;
      }
      return (Math.round(total[0])<<16)|(Math.round(total[1])<<8)|Math.round(total[2]);
    });
  }

  function worldGroundPalette(meters){
    return blendGroundPalettes(biomeWeights(meters),id=>{
      if(id==='forest')return openingGroundPalette();
      if(id==='foothills')return foothillsGroundPalette(meters);
      if(id==='tundra')return tundraGroundPalette(meters);
      return UNDERWORLD_PALETTES[id];
    });
  }

  function drawUnderworldGround(scene,g,from,to){
    const startX=scene.startX||200,pxPerMeter=scope.GRIM_CONFIG?.pxPerMeter||12;
    for(let x=Math.ceil(from/64)*64;x<to-10;x+=64){
      const y=scene.terrain.groundAt(x);
      if(y===null||!Number.isFinite(y))continue;
      const meters=(x-startX)/pxPerMeter,n=Math.floor(x/64),v=(Math.sin(n*8.37)+1)*.5;
      if(meters<6000){
        g.lineStyle(1.5,0x9aa0ad,.20);g.lineBetween(x+12,y+10,x+18+v*8,y+21);
        g.fillStyle(0x080d14,.34);g.fillEllipse(x+43,y+29+v*6,8+v*4,3);
      }else if(meters<7000){
        if(n%3===0){
          g.fillStyle(n%2?0x60b9d1:0x8d80c7,.45);
          g.fillPoints([{x:x+28,y:y+2},{x:x+32,y:y-9-v*8},
            {x:x+36,y:y+2}],true);
        }
        g.lineStyle(1.2,0xaee8f2,.24);g.lineBetween(x+8,y+8,x+26,y+9);
      }else if(meters<8000){
        g.fillStyle(0x120d10,.40);g.fillEllipse(x+25,y+10+v*3,18+v*12,4+v*2);
        g.lineStyle(1.4,0xff7448,.15);g.lineBetween(x+48,y+15,x+56,y+21);
      }else if(meters<9999){
        g.lineStyle(2.2,0xff7136,.44);g.lineBetween(x+13,y+16,x+20+v*7,y+25);
        g.lineBetween(x+20+v*7,y+25,x+28,y+18);
      }else{
        g.lineStyle(1.3,0x9c766c,.29);g.lineBetween(x+7,y+13,x+21,y+12);
        g.lineBetween(x+21,y+12,x+21,y+26);
        if(n%4===0){g.fillStyle(0xff8a52,.30);g.fillRoundedRect(x+42,y+11,3,8,1);}
      }
    }
  }

  function openingGroundPalette(){
    return [0x202a28,0x52675a,0x87947a,0x39433d];
  }

  function foothillsGroundPalette(meters){
    const t=clamp((meters-900)/1200,0,1);
    const forest=openingGroundPalette();
    const stone=[0x242e31,0x687a78,0xa1ada0,0x4c5757];
    return forest.map((color,i)=>mix(color,stone[i],t));
  }

  function tundraGroundPalette(meters){
    const t=clamp((meters-1900)/1200,0,1);
    const foothills=foothillsGroundPalette(meters);
    const frost=[0x252e37,0x657883,0x9eafb8,0x485861];
    return foothills.map((color,i)=>mix(color,frost[i],t));
  }

  function drawOpeningGround(scene,g,from,to){
    const first=Math.ceil(from/58)*58;
    for(let x=first;x<to-8;x+=58){
      const y=scene.terrain.groundAt(x);
      if(y===null||!Number.isFinite(y))continue;
      const n=Math.floor(x/58);
      const variation=(Math.sin(n*12.8)+1)*.5;
      g.lineStyle(1.7,0xa1a884,.57);
      g.lineBetween(x+7,y-2,x+9,y-7-variation*4);
      g.lineBetween(x+10,y-2,x+14,y-5-variation*5);
      if(n%2===0)g.lineBetween(x+13,y-2,x+18,y-6-variation*3);
      g.fillStyle(0x687368,.36);
      g.fillEllipse(x+31,y+17+variation*7,8+variation*6,3.3);
      g.fillStyle(0x3c4742,.58);
      g.fillEllipse(x+45,y+26+(1-variation)*8,5+variation*4,2.6);
      g.lineStyle(1.7,0x101a19,.39);
      g.lineBetween(x+17,y+12,x+20+variation*3,y+30);
      g.lineStyle(1.2,0x849082,.19);
      g.lineBetween(x+26,y+45+variation*5,x+42,y+48+(1-variation)*5);
    }
  }

  function drawFoothillsGround(scene,g,from,to){
    const first=Math.ceil(from/76)*76;
    const startX=scene.startX??200;
    for(let x=first;x<to-10;x+=76){
      const y=scene.terrain.groundAt(x);
      if(y===null||!Number.isFinite(y))continue;
      const n=Math.floor(x/76);
      const variation=(Math.sin(n*8.17)+1)*.5;
      const meters=(x-startX)/(scope.GRIM_CONFIG?.pxPerMeter||12);
      const scrub=1-clamp((meters-950)/1000,0,1);
      g.fillStyle(0x182326,.36);
      g.fillTriangle(x+16,y+12,x+22+variation*5,y+18,x+29,y+12);
      g.fillStyle(0x89938a,.29);
      g.fillEllipse(x+21+variation*7,y+14,5+variation*3,2.3);
      g.fillStyle(0x56625c,.31);
      g.fillEllipse(x+52,y+28+(1-variation)*7,8+variation*5,3);
      g.lineStyle(1.35,0x111c1e,.32);
      g.lineBetween(x+38,y+18,x+41+variation*4,y+33);
      if(n%3===0&&scrub>.02){
        g.lineStyle(1.4,0x9da589,.27*scrub);
        g.lineBetween(x+5,y-2,x+8,y-5-variation*3);
        g.lineBetween(x+8,y-2,x+13,y-4-variation*3);
      }
    }
  }

  function drawTundraGround(scene,g,from,to){
    const first=Math.ceil(from/72)*72;
    for(let x=first;x<to-12;x+=72){
      const y=scene.terrain.groundAt(x);
      if(y===null||!Number.isFinite(y))continue;
      const n=Math.floor(x/72);
      const variation=(Math.sin(n*10.41)+1)*.5;
      g.fillStyle(0x1c2831,.38);
      g.fillTriangle(x+14,y+13,x+22+variation*6,y+19,x+31,y+13);
      g.fillStyle(0x8598a0,.3);
      g.fillEllipse(x+21+variation*6,y+15,6+variation*4,2.2);
      g.fillStyle(0x465660,.38);
      g.fillEllipse(x+51,y+29+(1-variation)*6,8+variation*5,3);
      g.lineStyle(1.2,0xa8bac2,.17);
      g.lineBetween(x+5,y+5,x+22+variation*4,y+6);
      g.lineStyle(1.35,0x101b22,.34);
      g.lineBetween(x+36,y+18,x+40+variation*4,y+33);
    }
  }

  scope.GRIM_WORLD_ART=Object.freeze({
    drawOpeningForest,openingGroundPalette,drawOpeningGround,
    drawFoothills,foothillsGroundPalette,drawFoothillsGround,
    drawTundra,tundraGroundPalette,drawTundraGround,
    SURFACE_BIOMES,UNDERWORLD_BIOMES,WORLD_BIOMES,biomeWeights,underworldWeights,
    worldGroundPalette,underworldGroundPalette,
    drawUnderworldDetails,drawWorldDetails,drawUnderworldGround
  });
})(typeof window!=='undefined'?window:globalThis);
