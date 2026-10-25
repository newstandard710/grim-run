/* Grim Run — Biome Transitions and Grounded Terrain Art, v0.11.15
 * Approved biome paintings supply distant scenery; separate biome sprite
 * atlases dress the moving terrain while its existing geometry stays intact.
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
  const WORLD_GROUND_BODY_ALPHA=1;
  const WORLD_GROUND_SHADE_ALPHA=.08;
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

  scope.GRIM_WORLD_ART=Object.freeze({
    WORLD_GROUND_BODY_ALPHA,WORLD_GROUND_SHADE_ALPHA,
    openingGroundPalette,
    foothillsGroundPalette,
    tundraGroundPalette,
    SURFACE_BIOMES,UNDERWORLD_BIOMES,WORLD_BIOMES,biomeWeights,underworldWeights,
    worldGroundPalette,underworldGroundPalette,
  });
})(typeof window!=='undefined'?window:globalThis);
