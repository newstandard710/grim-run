'use strict';
/* Run: node tests/world-biome-transitions.cjs */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','assets/visuals/world-art.js'),'utf8');
const scope={};
vm.runInNewContext(source,{window:scope,globalThis:scope});
const art=scope.GRIM_WORLD_ART;
const root=path.join(__dirname,'..');
const biomeIds=['forest','foothills','tundra','caves','crystals','ashlands','lava','boss'];
assert.equal(art.GROUND_TEXTURES,undefined,'no tiled ground textures can cover the concept foregrounds');
assert.equal(art.groundTextureWeights,undefined,'ground does not switch to repeated biome texture tiles');
assert.equal(art.WORLD_GROUND_BODY_ALPHA,1,
  'opaque terrain body hides the stationary painted floor beneath the collision path');
assert.ok(art.WORLD_GROUND_SHADE_ALPHA>=0&&art.WORLD_GROUND_SHADE_ALPHA<.1,
  'background shade beneath the terrain stays light');
assert.equal(fs.existsSync(path.join(root,'assets/visuals/ground')),false,
  'obsolete repeating ground tile assets are removed');
const near=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<1e-9,`${label}: expected ${expected}, got ${actual}`);
const total=weights=>Object.values(weights).reduce((sum,value)=>sum+value,0);

// Exercise every live crossfade at its entrance, midpoint, and exit. Ground
// appearance follows the approved biome art on a moving surface layer.
for(const [edge,leftId,rightId] of [
  [900,'forest','foothills'],[2300,'foothills','tundra'],
  [6000,'caves','crystals'],[7000,'crystals','ashlands'],
  [8000,'ashlands','lava'],[9999,'lava','boss']
]){
  const before=art.biomeWeights(edge-180),middle=art.biomeWeights(edge),after=art.biomeWeights(edge+180);
  near(before[leftId],1,`${edge}m fade entrance`);
  near(middle[leftId],.5,`${edge}m fade midpoint ${leftId}`);
  near(middle[rightId],.5,`${edge}m fade midpoint ${rightId}`);
  near(after[rightId],1,`${edge}m fade exit`);
  for(const weights of [before,middle,after]){
    near(total(weights),1,`${edge}m biome weights sum`);
    assert.ok(Object.values(weights).every(weight=>weight>=0&&weight<=1),`${edge}m weights stay bounded`);
  }
  const underworld=art.underworldWeights(edge);
  if(edge>=6000){
    near(underworld[leftId],.5,`${edge}m underworld fade midpoint ${leftId}`);
    near(underworld[rightId],.5,`${edge}m underworld fade midpoint ${rightId}`);
    near(total(underworld),1,`${edge}m underworld weights sum`);
  }
  const palette=art.worldGroundPalette(edge);
  assert.equal(palette.length,4,`${edge}m ground palette has four layers`);
  assert.ok(palette.every(Number.isInteger),`${edge}m ground palette renders numeric colors`);
}

// The portal must remain a hard handoff, with Tundra before 5,000m and Caves
// on arrival; all underworld art is ready at its start.
near(art.biomeWeights(4999.99).tundra,1,'Tundra immediately before portal');
near(art.biomeWeights(5000).caves,1,'Caves on portal arrival');
near(art.biomeWeights(5000.01).caves,1,'Caves immediately after portal');
near(art.underworldWeights(5000).caves,1,'underworld palette on portal arrival');

// Cover the user's early-run freeze location as well as non-transition areas.
for(const meters of [0,641,1200,4200,5500,6500,9000,15000,20000]){
  const weights=art.biomeWeights(meters),palette=art.worldGroundPalette(meters);
  near(total(weights),1,`${meters}m weights sum`);
  assert.equal(palette.length,4,`${meters}m palette length`);
}

// Exercise the actual ground drawing helper and confirm all legacy background
// drawing routines are removed from GameScene and the World Art module.
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
assert.ok(!html.includes('drawAtmosphere('),'GameScene does not render the legacy atmosphere');
for(const legacyBackground of ['drawRidge','drawPines','drawRollingHills','drawMountainRange',
  'drawOpeningForest','drawFoothills(','drawTundra(','drawCavernSilhouettes',
  'drawAshlandSilhouettes','drawLavaAtmosphere','drawCastleSilhouettes',
  'drawUnderworldDetails','drawSurfaceDetails','drawWorldDetails'])
  assert.ok(!source.includes(legacyBackground),`World Art removed ${legacyBackground}`);
const storage=new Map(),nodes=new Map();
function node(){
  let value;
  value=new Proxy({style:{setProperty(){}},classList:{toggle(){},add(){},remove(){},contains(){return false}},
    addEventListener(){},setAttribute(){},appendChild(){},replaceChildren(){},destroy(){}},
    {get(target,key){return key in target?target[key]:(...args)=>value;},
     set(target,key,v){target[key]=v;return true;}});
  return value;
}
const getNode=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);};
const gameScope={document:{getElementById:getNode,createElement:node,addEventListener(){},write(){}},
  localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value))},
  Phaser:{Scene:class{},Game:class{},AUTO:1,Scale:{RESIZE:1,CENTER_BOTH:1}},
  location:{search:'?seed=33'},URLSearchParams,innerWidth:950,innerHeight:430,addEventListener(){}};
gameScope.window=gameScope;
vm.createContext(gameScope);
vm.runInContext(source,gameScope);
for(const [,attrs,script] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g))
  if(!/\bsrc\s*=/.test(attrs))vm.runInContext(script,gameScope,{filename:'index.html'});
const drawGame=Object.create(gameScope.GrimGameScene.prototype);
const commands=[];
let graphics;
graphics=new Proxy({}, {get(_target,key){
  if(key==='commands')return commands;
  return (...args)=>{commands.push([key,args]);return graphics;};
}});
for(const meters of [641,720,900,1080,2120,2300,2480,4820,4999.99,5000,
  5820,6000,6180,6820,7000,7180,7820,8000,8180,9819,9999,10179,15000,20000]){
  const from=200+meters*12-5,to=from+10;
  drawGame.width=950;drawGame.height=430;drawGame.groundY=330;drawGame.cameraY=0;
  drawGame.cameraX=from-100;drawGame.startX=200;drawGame.distance=meters;
  drawGame.elapsed=2;drawGame.hasTeleported=meters>=5000;drawGame.biomeBackdropReady=true;
  drawGame.world=graphics;
  drawGame.terrain={sequences:[{startX:from,endX:to}],
    visibleSections:()=>[{kind:'ground',start:from,end:to}],
    groundAt:()=>300,anchorAt:()=>300};
  commands.length=0;
  drawGame.drawGround();
  assert.ok(commands.length>0,`${meters}m ground renderer produced drawing commands`);
  assert.ok(commands.some(([name,args])=>name==='fillStyle'&&args[1]===art.WORLD_GROUND_BODY_ALPHA),
    `${meters}m terrain body is opaque beneath its biome art`);
  assert.ok(commands.some(([name])=>name==='lineBetween'),
    `${meters}m collision path keeps a light surface contour`);
}

console.log('PASS: opaque moving terrain base, biome fades, portal handoff, and palettes');
