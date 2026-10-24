
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),w={};
vm.runInNewContext(fs.readFileSync(path.join(root,'assets/visuals/visual-system.js'),'utf8'),{window:w});
const V=w.GRIM_VISUALS,toArray=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.length);
let count=0;
for(const [base,poses] of [['assets/characters/illustrated-v2/reaper/',V.V2_REAPER],['assets/enemies/illustrated-v2/bat/',V.V2_BAT]]){
 for(const meta of Object.values(poses)){
  const b=fs.readFileSync(path.join(root,base,meta.file)),expected=V.REVIEW_INTEGRITY[meta.file];
  assert.equal(b.length,expected.bytes,meta.file+' size');
  assert.equal(crypto.createHash('sha256').update(b).digest('hex'),expected.sha256,meta.file+' SHA-256');
  assert.equal(V.validateReviewPNG(toArray(b),expected),true);
  assert.throws(()=>V.validateReviewPNG(toArray(b.subarray(0,Math.floor(b.length/2))),expected),'truncation must fail');
  const corrupt=Buffer.from(b);corrupt[Math.floor(b.length/2)]^=1;
  assert.throws(()=>V.validateReviewPNG(toArray(corrupt),expected),'same-length corruption must fail');
  count++;
 }
}
console.log('PASS '+count+' review PNGs: exact SHA-256, sizes, PNG chunk checksums; truncated and same-size corrupted images rejected.');

const originals=require('./recovery-originals.json');
for(const [name,expected] of Object.entries(originals)){
 const b=fs.readFileSync(path.join(root,name)),actual=crypto.createHash('sha256').update(b).digest('hex');
 assert.equal(b.length,expected.bytes,name+' size');assert.equal(actual,expected.sha256,name+' SHA-256');
 V.validateReviewPNG(toArray(b),expected);
 const chunks=[];let pos=8;
 while(pos+12<=b.length){const n=b.readUInt32BE(pos),type=b.toString('ascii',pos+4,pos+8);if(type==='IDAT')chunks.push(b.subarray(pos+8,pos+8+n));pos+=n+12;}
 const pixels=require('zlib').inflateSync(Buffer.concat(chunks));
 assert.ok(pixels.length>0,name+' image decompression');
 console.log('VERIFIED ORIGINAL '+name+' '+b.length+' bytes SHA256 '+actual);
}
