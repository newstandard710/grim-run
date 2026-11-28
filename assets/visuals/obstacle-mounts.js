/* Immediate-background mounts share the hazard's upper joint and the real tread. */
(function(scope){
  'use strict';
  const lerp=(a,b,t)=>a+(b-a)*t;
  function supportFoot(terrain,x,center){
    for(let i=0;i<=6;i++){
      const footX=lerp(x,center,i/7);
      const y=terrain.groundAt(footX);
      if(Number.isFinite(y))return {x:footX,y:y+13};
    }
    return null;
  }
  // Both depths come from one painting. The common canvas keeps the shelves,
  // seams and footing continuous, even on a curved piece of terrain.
  let nextMount=0;
  // These two shaded undersides lose their edge against the rear roots and ribs.
  const shadedLips=new Set(['forest_slide_dead-bough-curtain','caves_slide_fossil-rib-arch']);
  function liftLip(image,left,ob){
    const {data,width,height}=image;
    for(let x=0;x<width;x++){
      const worldX=left+x+.5;
      const inset=Math.min(worldX-ob.x,ob.x+ob.width-worldX);
      if(inset<=0)continue;
      const taper=Math.min(1,inset/8);
      let y=height-1;
      while(y>=0 && data[(y*width+x)*4+3]===0)y--;
      // Keep the outermost painted row dark against the scenery below.
      y--;
      for(let row=1;row<3 && y>=0;row++,y--){
        const offset=(y*width+x)*4;
        if(!data[offset+3])break;
        const lift=(3-row)*.06*taper;
        for(let c=offset;c<offset+3;c++)data[c]+=(255-data[c])*lift;
      }
    }
  }
  function readSlidePaint(scene,source,art){
    // Keep one biome's working set. An active mount owns its finished textures.
    const cache=scene.slidePaintCache??=new Map();
    if(cache.has(source))return cache.get(source);
    const canvas=document.createElement('canvas');
    canvas.width=Math.round(source.width*art.scale);
    canvas.height=Math.round(source.height*art.scale);
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(source,0,0,canvas.width,canvas.height);
    const lipX=art.lip[0]*art.scale,lipY=Math.round(art.lip[1]*art.scale);
    const footY=Math.round(art.footY*art.scale);
    const alpha=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    const edge=new Int16Array(canvas.width);
    for(let x=0;x<canvas.width;x++){
      let y=Math.min(canvas.height-1,lipY+10);
      while(y>0 && alpha[(y*canvas.width+x)*4+3]<100)y--;
      edge[x]=y+1;
    }
    const paint={width:canvas.width,height:canvas.height,pixels:new Uint32Array(alpha.buffer),lipX,lipY,footY,edge};
    if(cache.size>=5)cache.delete(cache.keys().next().value);
    cache.set(source,paint);
    return paint;
  }
  function fitBank(scene,center,offsets,halfSpan,leftExtent,rightExtent){
    const terrain=scene.terrain,C=scope.GRIM_CONFIG;
    // Keep the toe and the whole collision lane the same size. Beside a gap
    // prefer a full return on the opposite bank, then shorten only its rear.
    for(const breadth of [1,.8,.6,.4,.2]){
      for(const facing of [1,-1]){
        const project=dx=>facing*Math.sign(dx)*(Math.min(Math.abs(dx),halfSpan)+
          Math.max(0,Math.abs(dx)-halfSpan)*breadth);
        const a=project(leftExtent),b=project(rightExtent);
        if(scope.GRIM_CORE.intersectsVendorCorridor?.(center+Math.min(a,b),Math.abs(b-a),
          scene.startX,scene.vendorInterval??C.vendorEveryMeters,C.pxPerMeter,scene.vendorCount??14))continue;
        const feet=offsets.map(dx=>center+project(dx));
        if(feet.every(x=>[.25,.5,.75,1].every(t=>Number.isFinite(terrain.groundAt(lerp(center,x,t))))))
          return {breadth,facing,project,feet:feet.map(x=>({x,y:terrain.groundAt(x)+13}))};
      }
    }
    return null;
  }
  function drawLandform(scene,ob,skin,underside){
    const art=skin?.landform;
    if(!art||!scene.textures?.exists?.(skin.key)||!scene.textures.createCanvas)return false;
    const center=ob.x+ob.width/2;
    if(ob.x+550<scene.cameraX||ob.x-550>scene.cameraX+scene.width)return true;
    const terrain=scene.terrain,groundAt=terrain.groundAt;
    const prior=scene.obstacleSupportObjects.get(ob),texture=scene.textures.get(skin.key);
    // A cropped trunk or vault continues above a tall viewport. Only its top
    // band extends; the lip, footing and terrain registration stay fixed.
    const extension=art.openTop?Math.max(0,Math.ceil(scene.height+96-art.lip[1]*art.scale)):0;
    const left=groundAt(ob.x),right=groundAt(ob.x+ob.width);
    if(prior && prior.mountExtension===extension && prior.mountTexture===texture && prior.mountTerrain===terrain &&
      prior.mountFloor===groundAt && prior.mountLip===underside && prior.mountLeft===left &&
      prior.mountRight===right && prior.mountFeet.every(p=>{const floor=groundAt(p.x);return floor!==null && floor+13===p.y;})){
      return true;
    }
    const source=texture.getSourceImage();
    const {width,height,pixels,lipX,lipY,footY,edge}=readSlidePaint(scene,source,art);
    const offsets=art.feet.map(x=>x*art.scale-lipX);
    const halfSpan=ob.width/2+2;
    const bank=fitBank(scene,center,offsets,halfSpan,-lipX,width-lipX);
    if(!bank)return false;
    const {facing,breadth,feet}=bank;
    const a=bank.project(-lipX),b=bank.project(width-lipX);
    const originX=center+Math.min(a,b),displayWidth=Math.ceil(Math.abs(b-a));
    const slope=Math.max(-.20,Math.min(.20,(right-left)/ob.width));
    const columns=[];
    let minY=Infinity,maxY=-Infinity;
    for(let i=0;i<displayWidth;i++){
      const x=originX+i+.5,dx=x-center,distance=Math.abs(dx);
      const sourceOffset=Math.sign(dx)*facing*(Math.min(distance,halfSpan)+Math.max(0,distance-halfSpan)/breadth);
      const sx=Math.min(width-1,Math.max(0,Math.floor(lipX+sourceOffset)));
      const weight=Math.max(0,Math.min(1,(ob.width/2+18-distance)/18));
      const ground=groundAt(x)??terrain.anchorAt(x);
      const crown=underside+Math.max(-40,Math.min(40,slope*dx));
      // On a steep uphill bank lift the far shoulder with its foot. Keeping
      // at least 64px of visible return prevents the heel collapsing underground.
      const natural=lerp(Math.min(crown,ground-64),crown,weight);
      const ceiling=weight?(scope.GRIM_CORE.slideCeilingBottomAt(groundAt,x,
        scope.GRIM_CONFIG.slideClearancePx)??natural):natural;
      const lip=Math.floor(lerp(natural,ceiling-1,weight));
      const constrained=distance<=ob.width/2+.5;
      const srcLip=Math.round(lerp(lipY,Math.max(lipY-35,edge[sx]),weight));
      const join=Math.max(0,Math.min(srcLip-1,lipY-42));
      const top=Math.floor(natural-lipY);
      const floor=ground+13;
      const foot=Math.max(lip+1,Math.round(floor));
      const bottom=Math.ceil(foot+(height-footY)*(foot-lip)/(footY-srcLip));
      columns.push({sx,top,join,srcLip,lip,bottom,constrained});
      minY=Math.min(minY,top-extension);
      maxY=Math.max(maxY,lip,bottom);
    }
    const id=++nextMount,keys=['obstacle-mounted-'+id,'obstacle-registered-'+id];
    const frontLeft=Math.max(0,Math.floor(center-ob.width/2-8-originX));
    const frontRight=Math.min(displayWidth,Math.ceil(center+ob.width/2+8-originX));
    const frontTop=Math.min(...columns.slice(frontLeft,frontRight).map(c=>c.lip))-42;
    const frontBottom=Math.max(...columns.slice(frontLeft,frontRight).map(c=>c.lip));
    const rear=scene.textures.createCanvas(keys[0],displayWidth,maxY-minY+1);
    const front=scene.textures.createCanvas(keys[1],frontRight-frontLeft,frontBottom-frontTop+1);
    if(!front||!rear){
      keys.forEach(key=>{if(scene.textures.exists(key))scene.textures.remove(key);});
      return false;
    }
    const backCtx=rear.getContext(),frontCtx=front.getContext();
    const backData=backCtx.createImageData(displayWidth,maxY-minY+1);
    const frontWidth=frontRight-frontLeft;
    const frontData=frontCtx.createImageData(frontWidth,frontBottom-frontTop+1);
    const backPixels=new Uint32Array(backData.data.buffer);
    const frontPixels=new Uint32Array(frontData.data.buffer);
    for(let x=0;x<columns.length;x++){
      const {sx,top,join,srcLip,lip,bottom,constrained}=columns[x];
      const upper=top+join,inFront=x>=frontLeft && x<frontRight;
      const rimScale=(srcLip-join)/Math.max(1,lip-upper);
      const footScale=(height-srcLip)/Math.max(1,bottom-lip);
      const end=constrained?lip:bottom;
      // One nearest-row copy of already filtered, world-resolution paint.
      // This avoids re-reading a live GPU canvas for every pixel column.
      // Above the fitted rim, the rear wall keeps its source rows. A straight
      // copy avoids testing depth and recalculating a scale for each tower pixel.
      const straightEnd=Math.min(end,upper,inFront?frontTop:upper);
      let copyTop=top;
      if(extension){
        const band=Math.min(96,straightEnd-top);
        const step=band/(extension+band);
        let row=0;
        for(let y=top-extension;y<top+band;y++,row+=step)
          backPixels[(y-minY)*displayWidth+x]=pixels[Math.floor(row)*width+sx];
        copyTop+=band;
      }
      let src=(copyTop-top)*width+sx,dst=(copyTop-minY)*displayWidth+x;
      for(let y=copyTop;y<straightEnd;y++,src+=width,dst+=displayWidth)backPixels[dst]=pixels[src];
      for(let y=Math.max(top,straightEnd);y<end;y++){
        const v=y<upper?y-top:y<lip?join+(y-upper+.5)*rimScale:srcLip+(y-lip+.5)*footScale;
        const pixel=pixels[(v|0)*width+sx];
        if(inFront && y>=frontTop && y<lip)frontPixels[(y-frontTop)*frontWidth+x-frontLeft]=pixel;
        else backPixels[(y-minY)*displayWidth+x]=pixel;
      }
    }
    if(shadedLips.has(skin.id))liftLip(frontData,originX+frontLeft,ob);
    backCtx.putImageData(backData,0,0);frontCtx.putImageData(frontData,0,0);
    rear.refresh();front.refresh();
    function replace(map,texture,x,y,depth){
      map.get(ob)?.destroy();
      const image=scene.add.image(x,y,texture.key).setOrigin(0).setDepth(depth);
      image.once('destroy',()=>{if(scene.textures.exists(texture.key))scene.textures.remove(texture.key);});
      map.set(ob,image);
      return image;
    }
    const mount=replace(scene.obstacleSupportObjects,rear,originX,minY,.53);
    Object.assign(mount,{mountTexture:texture,mountSource:skin.key,mountFeet:feet,mountTerrain:terrain,mountFloor:groundAt,
      mountLip:underside,mountLeft:left,mountRight:right,mountExtension:extension});
    replace(scene.obstacleSpriteObjects,front,originX+frontLeft,frontTop,16);
    return true;
  }

  const BRAMBLE_JOINTS=Object.freeze({
    foothills:[.90,.19,.60,.20],tundra:[.90,.18,.65,.19],caves:[.91,.20,.62,.20],
    crystals:[.92,.18,.61,.19],ashlands:[.91,.18,.54,.18],lava:[.90,.20,.56,.18]
  });
  function mountBramble(scene,image,ob,skin){
    const [u,v,jx,jy]=BRAMBLE_JOINTS[skin.biome];
    const bank=scene.terrain.sectionAt(ob.x);
    const footX=bank?.kind==='gap'?bank.start-35:ob.x-105;
    const foot=supportFoot(scene.terrain,footX,ob.x-100);
    if(!foot)return false;
    const source=image.texture.getSourceImage();
    const fx=.24,fy=.935,dx=(u-fx)*source.width,dy=(v-fy)*source.height;
    const targetX=ob.x+ob.width*.5+(jx-.5)*148;
    const targetY=ob.y+ob.height*.5+(jy-.5)*218;
    const tx=targetX-foot.x,ty=targetY-foot.y;
    const scale=Math.hypot(tx,ty)/Math.hypot(dx,dy);
    const rotation=Math.atan2(ty,tx)-Math.atan2(dy,dx);
    image.setOrigin(fx,fy).setPosition(foot.x,foot.y).setScale(scale).setRotation(rotation)
      .setTint(0x89929b).setAlpha(.85);
    image.mountFeet=[foot];image.mountJoint={x:targetX,y:targetY};
    return true;
  }

  function seatPlantRoot(scene,image,x,y,width,height){
    const frameW=384,frameH=400,rootTop=340,rootBottom=376,origin=[245,375];
    const floor=scene.terrain.groundAt(x);
    const naturalBottom=y+(rootBottom-origin[1])*height/frameH;
    if(!Number.isFinite(floor)||floor<=naturalBottom){
      if(image.plantRoot?.visible){
        image.plantRoot.setVisible(false);
        image.setCrop();image.plantNext.setCrop();
      }
      return;
    }
    if(!image.plantRoot){
      // The lower strip is identical in all 16 frames. Stretch only that
      // strip and leave the jaw, painted strike silhouette and collision fixed.
      image.plantRoot=scene.add.image(x,y,image.texture.key,0).setDepth(image.depth)
        .setOrigin(origin[0]/frameW,rootTop/frameH).setCrop(0,rootTop,frameW,rootBottom-rootTop);
      image.once('destroy',()=>image.plantRoot.destroy());
    }
    const joint=y+(rootTop-origin[1])*height/frameH;
    image.setCrop(0,0,frameW,rootTop);image.plantNext.setCrop(0,0,frameW,rootTop);
    image.plantRoot.setPosition(x,joint).setScale(width/frameW,(floor+3-joint)/(rootBottom-rootTop))
      .setVisible(true);
  }
  scope.GRIM_OBSTACLE_ART={drawLandform,mountBramble,seatPlantRoot};
})(typeof window!=='undefined'?window:globalThis);
