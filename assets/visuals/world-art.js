/* Grim Run — Biome Transitions and Ground Art, v0.12.0
 * Backgrounds use the approved biome images; these helpers draw only ground details.
 */
(function(scope){
  'use strict';
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const smooth=t=>{
    const v=clamp(t,0,1);
    return v*v*(3-2*v);
  };
  const mix=(a,b,t)=>{
    const v=clamp(t,0,1),channel=shift=>
      Math.round(((a>>shift)&255)*(1-v)+((b>>shift)&255)*v);
    return (channel(16)<<16)|(channel(8)<<8)|channel(0);
  };

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
        // Painted lava seams are rendered inside the canyon opening, not as detached surface marks.
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
    // A few soft frost strokes sit just below the tiled material's snow crust.
    const first=Math.ceil(from/132)*132,startX=scene.startX??200;
    for(let x=first;x<to-22;x+=132){
      const y=scene.terrain.groundAt(x);
      if(y===null||!Number.isFinite(y))continue;
      const n=Math.floor(x/132),variation=(Math.sin(n*6.73)+1)*.5;
      g.lineStyle(1.5,0xc7dce5,.22);
      g.lineBetween(x+8,y+5,x+28+variation*8,y+6);
      if(n%2===0){
        g.lineStyle(1,0xe1edf1,.18);
        g.lineBetween(x+52,y+8,x+62+variation*5,y+8);
      }
    }
  }

  scope.GRIM_WORLD_ART=Object.freeze({
    openingGroundPalette,drawOpeningGround,
    foothillsGroundPalette,drawFoothillsGround,
    tundraGroundPalette,drawTundraGround,
    SURFACE_BIOMES,UNDERWORLD_BIOMES,WORLD_BIOMES,biomeWeights,underworldWeights,
    worldGroundPalette,underworldGroundPalette,
    drawUnderworldGround
  });
})(typeof window!=='undefined'?window:globalThis);
