'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const zlib=require('node:zlib');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');

const root=path.resolve(__dirname,'..');
const scope={};
vm.runInNewContext(fs.readFileSync(path.join(root,'assets/visuals/obstacle-catalog.js'),'utf8'),{window:scope});
const skins=scope.GRIM_OBSTACLE_SPRITES;
assert.equal(skins.length,93,'all planned obstacle skins are cataloged');

const counts={jump:24,slide:24,cut:24,fire:15,'air-tuck':2,'air-bramble':3,'snapping-bramble':1};
const dimensions={jump:[54,48],slide:[74,70],cut:[60,288],fire:[58,41],
  'air-tuck':[80,340],'air-bramble':[80,143],'snapping-bramble':[62,78]};
const biomeCounts={
  jump:{forest:3,foothills:3,tundra:3,caves:3,crystals:3,ashlands:3,lava:3,boss:3},
  slide:{forest:3,foothills:3,tundra:3,caves:3,crystals:3,ashlands:3,lava:3,boss:3},
  cut:{forest:3,foothills:3,tundra:3,caves:3,crystals:3,ashlands:3,lava:3,boss:3},
  fire:{caves:3,crystals:3,ashlands:3,lava:3,boss:3},
  'air-tuck':{ashlands:1,lava:1},
  'air-bramble':{foothills:1,crystals:1,lava:1},
  'snapping-bramble':{tundra:1}
};
const files=new Set(),keys=new Set(),ids=new Set(),hashes=new Set();
function crc32(buf){
  let crc=0xffffffff;
  for(const byte of buf){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  return (crc^0xffffffff)>>>0;
}
for(const [category,count] of Object.entries(counts)){
  const group=skins.filter(s=>s.category===category);
  assert.equal(group.length,count,category+' sprite count');
  const perBiome={};
  for(const skin of group){
    perBiome[skin.biome]=(perBiome[skin.biome]||0)+1;
    assert.deepEqual([skin.gameW,skin.gameH],dimensions[category],skin.id+' game footprint');
    if(skin.groundAnchorY!==undefined){
      assert.ok(Number.isFinite(skin.groundAnchorY)&&skin.groundAnchorY>.5&&skin.groundAnchorY<=1,
        skin.id+' has a normalized illustrated baseline');
    }
    assert.ok(!files.has(skin.src),'a file is not assigned to multiple catalog entries: '+skin.src);
    assert.ok(!keys.has(skin.key),'texture keys are unique: '+skin.key);
    assert.ok(!ids.has(skin.id),'sprite ids are unique: '+skin.id);
    files.add(skin.src);keys.add(skin.key);ids.add(skin.id);

    const filename=path.resolve(root,skin.src);
    assert.ok(filename.startsWith(root+path.sep),'sprite path stays inside the project');
    assert.equal(path.basename(path.dirname(filename)),skin.biome,skin.id+' biome folder');
    assert.equal(path.basename(path.dirname(path.dirname(filename))),
      category==='slide'?'slide-v3':category,skin.id+' category folder');
    const bytes=fs.readFileSync(filename);
    const digest=crypto.createHash('sha256').update(bytes).digest('hex');
    assert.ok(!hashes.has(digest),'sprite art is unique across biome/category entries: '+skin.id);
    hashes.add(digest);
    if(category==='slide'){
      assert.ok(skin.backSrc&&skin.backKey,skin.id+' has a matched upper painting');
      assert.ok(!files.has(skin.backSrc)&&!keys.has(skin.backKey),skin.id+' backing is unique');
      files.add(skin.backSrc);keys.add(skin.backKey);
      const backing=fs.readFileSync(path.resolve(root,skin.backSrc));
      assert.equal(bytes.toString('ascii',0,4),'RIFF',skin.id+' front WebP');
      assert.equal(bytes.toString('ascii',8,12),'WEBP',skin.id+' front image');
      assert.equal(backing.toString('ascii',8,12),'WEBP',skin.id+' upper image');
      assert.ok(bytes.length>1000&&backing.length>1000,skin.id+' both painted layers present');
      if(skin.biome==='forest'){
        assert.ok(skin.supportSrc&&skin.supportKey,skin.id+' has its own terrain connection');
        assert.ok(!files.has(skin.supportSrc)&&!keys.has(skin.supportKey),skin.id+' support is unique');
        files.add(skin.supportSrc);keys.add(skin.supportKey);
        const support=fs.readFileSync(path.resolve(root,skin.supportSrc));
        assert.equal(support.toString('ascii',0,4),'RIFF',skin.id+' support WebP');
        assert.equal(support.toString('ascii',8,12),'WEBP',skin.id+' support image');
        assert.ok(support.length>1000,skin.id+' painted forest connection present');
      }else assert.ok(!skin.supportSrc&&!skin.supportKey,skin.id+' unchanged outside forest');
      continue;
    }
    assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10],skin.id+' PNG signature');
    let pos=8,width=0,height=0,colorType=0,bitDepth=0,ended=false;
    const imageData=[];
    while(pos<bytes.length){
      assert.ok(pos+12<=bytes.length,skin.id+' complete PNG chunk');
      const length=bytes.readUInt32BE(pos),type=bytes.toString('ascii',pos+4,pos+8);
      const chunkEnd=pos+12+length;
      assert.ok(chunkEnd<=bytes.length,skin.id+' chunk bounds');
      const chunk=bytes.subarray(pos+4,pos+8+length);
      assert.equal(crc32(chunk),bytes.readUInt32BE(pos+8+length),skin.id+' '+type+' CRC');
      if(type==='IHDR'){
        width=bytes.readUInt32BE(pos+8);height=bytes.readUInt32BE(pos+12);
        bitDepth=bytes[pos+16];colorType=bytes[pos+17];
      }else if(type==='IDAT')imageData.push(bytes.subarray(pos+8,pos+8+length));
      else if(type==='IEND'){ended=true;assert.equal(length,0);assert.equal(chunkEnd,bytes.length);}
      pos=chunkEnd;
      if(ended)break;
    }
    assert.ok(ended,skin.id+' IEND chunk');
    assert.deepEqual([width,height],[skin.gameW*3,skin.gameH*3],skin.id+' authored at 3x game size');
    assert.equal(bitDepth,8,skin.id+' 8-bit channels');
    assert.equal(colorType,6,skin.id+' transparent RGBA');
    const scanlines=zlib.inflateSync(Buffer.concat(imageData));
    assert.equal(scanlines.length,(width*4+1)*height,skin.id+' decoded pixel extent');
    assert.ok(scanlines.some((_,i)=>i%(width*4+1)===0&&scanlines[i]<=4),skin.id+' valid PNG filter stream');
  }
  assert.deepEqual(perBiome,biomeCounts[category],category+' biome coverage');
}

assert.equal(files.size,120);
assert.equal(keys.size,120);
assert.equal(ids.size,93);
assert.equal(hashes.size,93);
console.log('PASS v0.14.5: 93 biome-exclusive skins, three paired forest connections, and original PNG integrity verified.');
