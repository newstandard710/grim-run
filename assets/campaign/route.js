// Forest Campaign distances are real run metres. Each phrase reserves its landing
// and recovery space. A seed changes the order inside a section, never its lesson.
const END = 6500;
const opening = [
  [70,'rock'], [143,'branch'], [205,'bramble'], [290,'rock'], [365,'bramble'],
  [445,'branch'], [525,'rock'], [581,'branch'], [766,'gap'], [830,'bramble']
];
const practice = [
  [[0,'rock'],[50,'branch'],[130,'bramble']],
  [[0,'branch'],[77,'rock'],[125,'bramble']],
  [[0,'gap'],[54,'bramble'],[134,'branch']],
  [[0,'bramble'],[62,'branch'],[126,'rock']]
];
const combinations = [
  [[0,'gap'],[33,'branch'],[100,'bramble'],[162,'rock']],
  [[0,'bramble'],[58,'rock'],[93,'branch'],[151,'bramble']],
  [[0,'branch'],[57,'gap'],[95,'bramble'],[158,'branch']],
  [[0,'rock'],[45,'bramble'],[107,'gap'],[144,'branch']]
];
const approach = [
  [[0,'rock'],[37,'branch'],[81,'bramble'],[153,'gap']],
  [[0,'gap'],[35,'branch'],[79,'bramble'],[153,'rock']],
  [[0,'bramble'],[62,'rock'],[98,'branch'],[141,'bramble']]
];

// At the first ravine the shelf is visible across the gap. Subsequent pairs
// gradually shorten the landing while keeping time to release Jump and slide.
const foothillsOpening=[
  [58,'rock'],[130,'branch'],[218,'gap'],[236,'branch'],[332,'bramble'],
  [405,'gap'],[431,'branch'],[531,'rock'],[577,'branch'],[780,'gap'],[806,'branch']
];
const terraces=[
  [[0,'gap'],[26,'branch'],[102,'bramble']],
  [[0,'rock'],[34,'branch'],[119,'gap']],
  [[0,'branch'],[78,'gap'],[105,'branch']],
  [[0,'bramble'],[63,'rock'],[118,'branch']]
];
const ridges=[
  [[0,'gap'],[23,'branch'],[94,'rock'],[141,'bramble']],
  [[0,'bramble'],[62,'gap'],[86,'branch'],[150,'rock']],
  [[0,'rock'],[35,'branch'],[108,'gap'],[134,'branch']],
  [[0,'branch'],[58,'rock'],[117,'gap'],[142,'bramble']]
];

// Anchors select complete encounter phrases. Their internal warning and landing
// distances stay the same at game speed, even on the shorter routes.
const chapters={
  forest:    {end:3500, sections:[[1100,1380,1660],[2110,2390],[2690]]},
  foothills: {end:3700, sections:[[1100,1380,1660],[2110,2390,2690]]},
  tundra:    {end:3900, sections:[[1100,1380,1660,2110,2390,2690,3110,3380]]},
  caves:     {end:4100, sections:[[1080,1340,1590],[2020,2280,2540,2960,3220,3480]],vendorInterval:950},
  crystals:  {end:4300, sections:[[1100,1380,1660,2110],[2390,2690,3110,3390,3670]]},
  ashlands:  {end:4500, sections:[[1100,1380,1660,2110],[2390,2690,3110,3390,3670]]},
  lava:      {end:4700, sections:[[1100,1380,1660,2110],[2390,2690,3110,3390,3670,4090]]},
  finalRealm:{end:6666, sections:[[1100,1380,1660],[2530,2780,3110,3390,3670],
                                  [4640,5100,5380,5660]],gates:[155,868,2150,2390,4250,4510,6230]}
};

export function forestRoute(seed,origin,unit,chapter='forest',version=3){
  const final=chapter==='finalRealm',lava=chapter==='lava',ash=chapter==='ashlands',crystal=chapter==='crystals';
  const hills=chapter==='foothills',ice=chapter==='tundra',cave=chapter==='caves',legacyEnd=final?16300:lava?12380:ash?12420:crystal?11420:cave?10000:ice?9050:hills?8100:END;
  const plan=version===3?chapters[chapter]:null;
  const end=plan?.end??legacyEnd,vendorInterval=plan?.vendorInterval??1000;
  let sectionIndex=0;
  const wisps=[],spiders=[],prisms=[],embers=[];
  const rng=window.GRIM_CORE.makeRng(seed ^ 0x476c6164);
  const iceOpening=[[45,'wisp'],[135,'rock'],[170,'wisp'],[265,'branch'],[300,'wisp'],
    [414,'gap'],[451,'wisp'],[557,'bramble'],[790,'branch'],[831,'wisp']];
  const caveOpening=[[65,'spider'],[157,'spider'],[228,'rock'],[305,'branch'],[398,'spider'],[432,'rock'],
    [546,'bramble'],[778,'gap'],[861,'spider'],[897,'rock']];
  const crystalOpening=[[52,'low'],[208,'high'],[365,'low'],[463,'rock'],[552,'branch'],
    [766,'gap'],[811,'high'],[918,'bramble']];
  const ashOpening=[[52,'ember'],[168,'ember'],[286,'rock'],[374,'ember'],[474,'branch'],
    [566,'bramble'],[776,'gap'],[824,'ember'],[934,'rock']];
  const lavaOpening=[[58,'gap'],[164,'gap'],[262,'rock'],[352,'gap'],[386,'branch'],
    [484,'bramble'],[575,'gap'],[775,'rock'],[831,'gap'],[868,'bramble']];
  const finalOpening=[[70,'rock'],[260,'branch'],[395,'bramble'],[550,'rock'],[790,'gap']];
  const beats=(final?finalOpening:lava?lavaOpening:ash?ashOpening:crystal?crystalOpening:cave?caveOpening:ice?iceOpening:hills?foothillsOpening:opening).map(([m,type])=>[m+(m===205?seed%13:m===365?seed%17:0),type]);
  function section(start,count,stride,phrases){
    const anchors=plan?.sections[sectionIndex++];
    let bag=[],last;
    for(let i=0;i<(anchors?.length??count);i++){
      if(!bag.length){
        bag=phrases.slice();
        for(let j=bag.length-1;j>0;j--){
          const k=rng.integer(0,j);
          [bag[j],bag[k]]=[bag[k],bag[j]];
        }
        if(bag.at(-1)===last)[bag[0],bag[bag.length-1]]=[bag.at(-1),bag[0]];
      }
      last=bag.pop();
      const at=(anchors?anchors[i]:start+i*stride)+rng.integer(-9,9);
      for(const [offset,type] of last)beats.push([at+offset,type]);
    }
  }
  function finish(...phrase){
    // Leave the final shop before the rehearsal in Caves and Crystals.
    const shift=plan?end-legacyEnd+(cave?110:crystal?145:0):0;
    for(const [m,type] of phrase)beats.push([m+shift,type]);
  }
  if(final){
    // The three courts leave a level, empty approach on either side of each gate.
    section(1020,16,255,practice);
    section(5590,18,260,combinations);
    section(11040,19,260,approach);
    finish([16012,'gap'],[16065,'branch'],[16150,'bramble']);
  }else if(lava){
    const shelves=[
      [[0,'gap'],[52,'rock'],[146,'branch']],
      [[0,'branch'],[54,'gap'],[112,'bramble']],
      [[0,'rock'],[71,'gap'],[118,'branch']],
      [[0,'gap'],[80,'gap'],[155,'bramble']]
    ];
    const bridges=[
      [[0,'gap'],[36,'branch'],[104,'gap'],[155,'rock']],
      [[0,'rock'],[48,'gap'],[89,'bramble'],[164,'gap']],
      [[0,'gap'],[44,'bramble'],[112,'gap'],[149,'branch']],
      [[0,'branch'],[59,'gap'],[101,'rock'],[164,'gap']]
    ];
    section(1020,16,264,shelves);section(5360,25,260,bridges);
    finish([12020,'gap'],[12061,'branch'],[12162,'gap'],[12210,'bramble']);
  }else if(ash){
    const gullies=[
      [[0,'ember'],[96,'rock'],[153,'branch']],
      [[0,'branch'],[46,'ember'],[143,'bramble']],
      [[0,'gap'],[52,'ember'],[158,'rock']],
      [[0,'bramble'],[58,'rock'],[114,'ember']]
    ];
    const kilns=[
      [[0,'gap'],[36,'ember'],[115,'rock'],[162,'branch']],
      [[0,'ember'],[66,'bramble'],[114,'gap'],[154,'branch']],
      [[0,'branch'],[43,'ember'],[115,'gap'],[164,'rock']],
      [[0,'rock'],[45,'ember'],[116,'branch'],[175,'bramble']]
    ];
    section(1020,16,265,gullies);section(5330,25,260,kilns);
    finish([12010,'ember'],[12082,'gap'],[12125,'ember'],[12224,'rock'],[12275,'ember']);
  }else if(crystal){
    const galleries=[
      [[0,'low'],[115,'rock'],[177,'branch']],
      [[0,'branch'],[43,'high'],[169,'bramble']],
      [[0,'gap'],[39,'low'],[164,'rock']],
      [[0,'high'],[116,'gap'],[167,'bramble']]
    ];
    const vaults=[
      [[0,'gap'],[25,'low'],[142,'rock'],[189,'branch']],
      [[0,'rock'],[29,'high'],[144,'gap'],[187,'bramble']],
      [[0,'branch'],[31,'low'],[138,'bramble'],[184,'rock']],
      [[0,'bramble'],[54,'high'],[166,'branch'],[204,'rock']]
    ];
    section(1030,15,270,galleries);section(5150,22,265,vaults);
    finish([11060,'gap'],[11089,'low'],[11234,'high']);
  }else if(cave){
    const galleries=[
      [[0,'spider'],[39,'rock'],[118,'branch']],
      [[0,'gap'],[56,'spider'],[117,'bramble']],
      [[0,'branch'],[64,'bramble'],[132,'spider']],
      [[0,'rock'],[72,'spider'],[112,'rock']]
    ];
    const shafts=[
      [[0,'gap'],[54,'spider'],[85,'rock'],[158,'branch']],
      [[0,'bramble'],[55,'spider'],[86,'rock'],[159,'gap']],
      [[0,'branch'],[61,'gap'],[117,'spider'],[149,'rock']]
    ];
    section(1010,15,248,galleries);section(4800,19,251,shafts);
    finish([9660,'gap'],[9720,'spider'],[9752,'rock'],[9830,'spider'],[9862,'rock']);
  }else if(ice){
    const floes=[
      [[0,'gap'],[36,'wisp'],[125,'branch']],
      [[0,'branch'],[31,'wisp'],[128,'rock']],
      [[0,'rock'],[36,'wisp'],[128,'bramble']],
      [[0,'bramble'],[70,'gap'],[109,'wisp']]
    ];
    section(955,30,256,floes);
    finish([8720,'gap'],[8756,'wisp'],[8860,'branch'],[8894,'wisp']);
  }else if(hills){
    section(930,10,248,terraces);
    section(3440,17,240,ridges);
    finish([7580,'gap'],[7603,'branch'],[7680,'bramble'],[7772,'rock'],
      [7806,'branch'],[7890,'gap'],[7915,'branch'],[7990,'bramble']);
  }else{
    section(940,6,251,practice);
    section(2460,10,244,combinations);
    section(4925,5,255,approach);
    finish([6205,'gap'],[6242,'branch'],[6285,'bramble'],
      [6358,'rock'],[6394,'branch'],[6438,'bramble']);
  }
  const entries=beats.map(([m,type])=>({x:origin+m*unit,type}));
  const obstacles=entries.filter(e=>e.type!=='ember'&&e.type!=='gap'&&e.type!=='wisp'&&e.type!=='spider'&&e.type!=='high'&&e.type!=='low');
  for(const e of entries)if(e.type==='high'||e.type==='low')prisms.push({x:e.x,high:e.type==='high'});
  for(const e of entries)if(e.type==='ember')embers.push(e.x);
  for(const e of entries)if(e.type==='wisp')wisps.push(e.x);
  for(const e of entries)if(e.type==='spider')spiders.push(e.x);
  const gaps=entries.filter(e=>e.type==='gap');
  const encounters=new Map(obstacles.map((ob,i)=>[ob.x,{type:ob.type,
    nextX:obstacles[i+1]?.x??origin+(end+500)*unit}]));
  return {
    end, vendorInterval:plan?vendorInterval:666, vendorCount:plan?Math.floor(end/vendorInterval):1, biome:final?'boss':chapter,
    gates:final?(plan?.gates??[155,868,5160,5390,10460,10730,15840]).map(m=>origin+m*unit):[],
    artMeters:final?10500:lava?8950:ash?7470:crystal?6500:cave?5510:ice?3270:hills?1530:0, wisps, spiders, prisms, embers, crossbow:ice||cave||crystal||ash||lava||final, pursuit:hills||ice||cave||crystal||ash||lava||final, first:obstacles[0].x, gaps,
    encounters,
    // Generate fixed world geometry once so reload, rotation and Rewind all use
    // the terrain engine's existing segment identities and interpolation.
    terrain(add,cursor,baseY,sequences){
      const phase=rng.next()*2*Math.PI;
      const elevation=x=>{
        const m=(x-origin)/unit;
        const vendor=Math.round(m/vendorInterval);
        const onPad=plan? (vendor>=1&&vendor<=Math.floor(end/vendorInterval)&&Math.abs(m-vendor*vendorInterval)<80)
          : (m>=625&&m<=713);
        if(m<110||onPad||m>=end-40)return baseY;
        if(final)return baseY+13*Math.sin(x/830+phase)+8*Math.cos(x/510+phase);
        if(lava)return baseY+12*Math.sin(x/660+phase)+7*Math.cos(x/370+phase);
        if(ash)return baseY+18*Math.sin(x/810+phase)-12*Math.cos(x/425+phase);
        if(crystal)return baseY+17*Math.sin(x/730+phase)+9*Math.cos(x/440+phase);
        if(cave)return baseY+22*Math.sin(x/680+phase)-14*Math.cos(x/320+phase);
        if(ice)return baseY+14*Math.sin(x/790+phase)+7*Math.sin(x/360+phase);
        if(hills)return baseY-55*Math.min(1,m/250)+35*Math.sin(x/640+phase)+13*Math.sin(x/275+phase);
        return baseY+23*Math.sin(x/470+phase)+10*Math.sin(x/233+phase);
      };
      function slopes(to){
        while(cursor()<to){
          const end=Math.min(to,cursor()+310);
          add(end,elevation(end));
        }
      }
      for(const [id,gap] of gaps.entries()){
        slopes(gap.x-200);
        const y=elevation(gap.x-200);
        add(gap.x,y);
        const end=gap.x+(lava ? [64,82,94,74,100][id%5] : id===0?88:92+rng.integer(0,22));
        add(end,y,'gap',id);
        sequences.push({id,startX:gap.x,endX:end,respawnX:end+155,initialY:y});
        add(end+190,y);
      }
      slopes(origin+(end+240)*unit);
    }
  };
}
