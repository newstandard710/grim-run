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

export function forestRoute(seed,origin,unit){
  const rng=window.GRIM_CORE.makeRng(seed ^ 0x476c6164);
  const beats=opening.map(([m,type])=>[m+(m===205?seed%13:m===365?seed%17:0),type]);
  function section(start,count,stride,phrases){
    let bag=[],last;
    for(let i=0;i<count;i++){
      if(!bag.length){
        bag=phrases.slice();
        for(let j=bag.length-1;j>0;j--){
          const k=rng.integer(0,j);
          [bag[j],bag[k]]=[bag[k],bag[j]];
        }
        if(bag.at(-1)===last)[bag[0],bag[bag.length-1]]=[bag.at(-1),bag[0]];
      }
      last=bag.pop();
      const at=start+i*stride+rng.integer(-9,9);
      for(const [offset,type] of last)beats.push([at+offset,type]);
    }
  }
  section(940,6,251,practice);
  section(2460,10,244,combinations);
  section(4925,5,255,approach);
  beats.push([6205,'gap'],[6242,'branch'],[6285,'bramble'],
    [6358,'rock'],[6394,'branch'],[6438,'bramble']);
  const entries=beats.map(([m,type])=>({x:origin+m*unit,type}));
  const obstacles=entries.filter(e=>e.type!=='gap');
  const gaps=entries.filter(e=>e.type==='gap');
  const encounters=new Map(obstacles.map((ob,i)=>[ob.x,{type:ob.type,
    nextX:obstacles[i+1]?.x??origin+(END+500)*unit}]));
  return {
    end:END, first:obstacles[0].x, gaps,
    encounters,
    // Generate fixed world geometry once so reload, rotation and Rewind all use
    // the terrain engine's existing segment identities and interpolation.
    terrain(add,cursor,baseY,sequences){
      const phase=rng.next()*2*Math.PI;
      const elevation=x=>{
        const m=(x-origin)/unit;
        if(m<110 || (m>=625&&m<=713) || m>=6460)return baseY;
        return baseY+23*Math.sin(x/470+phase)+10*Math.sin(x/233+phase);
      };
      function hills(to){
        while(cursor()<to){
          const end=Math.min(to,cursor()+310);
          add(end,elevation(end));
        }
      }
      for(const [id,gap] of gaps.entries()){
        hills(gap.x-200);
        const y=elevation(gap.x-200);
        add(gap.x,y);
        const end=gap.x+(id===0?88:92+rng.integer(0,22));
        add(end,y,'gap',id);
        sequences.push({id,startX:gap.x,endX:end,respawnX:end+155,initialY:y});
        add(end+190,y);
      }
      hills(origin+(END+240)*unit);
    }
  };
}
