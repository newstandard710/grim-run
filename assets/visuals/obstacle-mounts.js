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
  function triangle(ctx,source,sourceX,sourceY,du,dv,a,b,c){
    ctx.save();
    const overlap=.55;
    const cx=(a.x+b.x+c.x)/3,cy=(a.y+b.y+c.y)/3;
    const expanded=p=>{
      const scale=overlap/Math.max(1,Math.hypot(p.x-cx,p.y-cy));
      return [p.x+(p.x-cx)*scale,p.y+(p.y-cy)*scale];
    };
    ctx.beginPath();
    ctx.moveTo(...expanded(a));ctx.lineTo(...expanded(b));ctx.lineTo(...expanded(c));
    ctx.closePath();ctx.clip();
    const xx=(b.x-a.x)/du,yx=(b.y-a.y)/du,xy=(c.x-a.x)/dv,yy=(c.y-a.y)/dv;
    ctx.transform(xx,yx,xy,yy,a.x-xx*sourceX-xy*sourceY,a.y-yx*sourceX-yy*sourceY);
    ctx.drawImage(source,0,0);
    ctx.restore();
  }
  function drawSlideMount(scene,ob,skin,x,underside,width,height,rotation){
    const record=scope.GRIM_OBSTACLE_MOUNTS?.[skin.id];
    const texture=scene.textures.get(skin.supportKey);
    const source=texture?.getSourceImage?.();
    if(!record||!source||!scene.textures.createCanvas)return false;
    const [seam,ul,vl,ur,vr]=record,span=width*1.4;
    const leftFoot=supportFoot(scene.terrain,x+(ul-.5)*span,x);
    const rightFoot=supportFoot(scene.terrain,x+(ur-.5)*span,x);
    if(!leftFoot||!rightFoot)return false;
    const joint=underside-height*(1-seam);
    const x0=x-span*.5,x1=x+span*.5;
    const top=u=>joint-48+Math.sin(rotation)*(u-.5)*span;
    const at=u=>{
      const xx=u<ul?lerp(x0,leftFoot.x,u/ul):u>ur?
        lerp(rightFoot.x,x1,(u-ur)/(1-ur)):lerp(leftFoot.x,rightFoot.x,(u-ul)/(ur-ul));
      const weight=Math.max(0,Math.min(1,(u-ul)/(ur-ul)));
      const line=top(u),foot=lerp(leftFoot.y,rightFoot.y,weight);
      return [{x:xx,y:line},{x:xx,y:line+(foot-line)/lerp(vl,vr,weight)}];
    };
    const columns=[...new Set([0,ul,.25,.5,.75,ur,1])].sort((a,b)=>a-b);
    const dest=columns.map(at);
    const originX=Math.floor(x0)-1;
    const originY=Math.floor(Math.min(...dest.map(strip=>strip[0].y)))-1;
    const cutH=Math.ceil(Math.max(...dest.map(strip=>strip[1].y))-originY)+1;
    const cutW=Math.ceil(x1-originX)+1;
    const key='obstacle-mounted-'+skin.id+'-'+ob.x;
    const signature=[height,originY,underside,rotation,leftFoot.x,leftFoot.y,rightFoot.x,rightFoot.y].join(':');
    let view=scene.obstacleSupportObjects.get(ob);
    if(view?.mountSignature===signature){view.setVisible(true);return true;}
    if(view){view.destroy();scene.obstacleSupportObjects.delete(ob);}
    const assembled=scene.textures.createCanvas(key,cutW,cutH);
    if(!assembled)return false;
    const ctx=assembled.getContext();
    const local=p=>({x:p.x-originX,y:p.y-originY});
    for(let i=0;i<columns.length-1;i++){
      const sx0=columns[i]*source.width,sx1=columns[i+1]*source.width,du=sx1-sx0;
      const [a,c]=dest[i].map(local),[b,d]=dest[i+1].map(local);
      triangle(ctx,source,sx0,0,du,source.height,a,b,c);
      triangle(ctx,source,sx1,source.height,-du,-source.height,d,c,b);
    }
    // Keep the recessed plate clear in the actual traversable opening.
    // The front hazard supplies the hanging teeth, bark or masonry here.
    ctx.globalCompositeOperation='destination-out';
    ctx.beginPath();
    const from=ob.x-9,to=ob.x+ob.width+9;
    for(let xx=from;xx<=to;xx+=5){
      const y=scope.GRIM_CORE.slideCeilingBottomAt(scene.terrain.groundAt,xx,scope.GRIM_CONFIG.slideClearancePx)??underside;
      if(xx===from)ctx.moveTo(xx-originX,y-originY);
      else ctx.lineTo(xx-originX,y-originY);
    }
    const edgeY=scope.GRIM_CORE.slideCeilingBottomAt(scene.terrain.groundAt,to,scope.GRIM_CONFIG.slideClearancePx)??underside;
    ctx.lineTo(to-originX,edgeY-originY);
    ctx.lineTo(to-originX,cutH);ctx.lineTo(from-originX,cutH);ctx.closePath();ctx.fill();
    ctx.globalCompositeOperation='source-over';
    assembled.refresh();
    view=scene.add.image(originX,originY,key).setOrigin(0).setDepth(.53)
      .setTint(0xbfc6bf).setAlpha(.95);
    view.mountSignature=signature;
    view.mountFeet=[leftFoot,rightFoot];
    view.mountSource=skin.supportKey;
    view.once('destroy',()=>{if(scene.textures.exists(key))scene.textures.remove(key);});
    scene.obstacleSupportObjects.set(ob,view);
    return true;
  }

  const REGISTERED_SLIDE_FRONTS=new Set([
    'lava_slide_basalt-lip','foothills_slide_rock-lip','tundra_slide_snow-shelf'
  ]);
  const slideFrontProfiles=new WeakMap();

  function slideFrontProfile(source){
    let profile=slideFrontProfiles.get(source);
    if(profile)return profile;
    const canvas=document.createElement('canvas');
    canvas.width=source.width;canvas.height=source.height;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(source,0,0);
    const alpha=ctx.getImageData(0,0,source.width,source.height).data;
    const edge=new Int16Array(source.width).fill(-1);
    let top=source.height;
    for(let y=0;y<source.height;y++){
      for(let x=0;x<source.width;x++){
        const opacity=alpha[(y*source.width+x)*4+3];
        if(opacity>0)top=Math.min(top,y);
        if(opacity>128)edge[x]=y;
      }
    }
    profile={top,join:top+Math.round(source.height*.05),edge};
    slideFrontProfiles.set(source,profile);
    return profile;
  }

  function registerSlideFront(scene,ob,skin,image,placement){
    if(!(skin?.slideSize||REGISTERED_SLIDE_FRONTS.has(skin?.id))||!scene.textures.createCanvas)return;
    const {x,y,width,height,rotation}=placement;
    const old=image.slideFront;
    if(x<scene.cameraX-180||x>scene.cameraX+scene.width+180){
      if(old){
        image.setTexture(skin.key).setOrigin(.5,1).setDisplaySize(width,height);
        scene.textures.remove(old.key);
        image.slideFront=null;
      }
      return;
    }
    const ceiling=worldX=>scope.GRIM_CORE.slideCeilingBottomAt(
      scene.terrain.groundAt,worldX,scope.GRIM_CONFIG.slideClearancePx)??y;
    const halfSpan=ob.width/2,shoulder=20;
    const samples=[-1,-.5,0,.5,1].map(u=>ceiling(x+u*halfSpan));
    const signature=[y,width,height,rotation,...samples].join(':');
    if(old?.signature===signature){
      image.setOrigin(.5,old.origin).setDisplaySize(width,old.height);
      return;
    }
    const source=scene.textures.get(skin.key).getSourceImage();
    const {top,join,edge}=slideFrontProfile(source);
    const scaleY=height/source.height,cos=Math.cos(rotation),sin=Math.sin(rotation);
    const columns=[];
    let bottom=source.height;
    for(let u=0;u<source.width;u++){
      const last=edge[u];
      if(last<=join)continue;
      const localX=((u+.5)/source.width-.5)*width;
      let localY=0;
      // Solve the existing local clearance in the already rotated image.
      // Leave a small amount of the source's irregular edge in the cue.
      const detail=Math.max(0,Math.min(1.7,(edge[Math.max(0,u-3)]+edge[Math.min(edge.length-1,u+3)]-2*last)*.18));
      for(let i=0;i<3;i++){
        const worldX=x+cos*localX-sin*localY;
        localY=(ceiling(worldX)-y-sin*localX-1.35-detail)/cos;
      }
      const distance=Math.abs(cos*localX-sin*localY);
      const weight=Math.max(0,Math.min(1,(halfSpan+shoulder-distance)/shoulder));
      if(!weight)continue;
      const blend=weight*weight*(3-2*weight);
      const target=lerp(last+1,source.height+localY/scaleY,blend);
      const end=Math.min(source.height,last+5);
      const destHeight=(end-join)*(target-join)/(last+1-join);
      columns.push([u,end-join,destHeight]);
      bottom=Math.max(bottom,Math.ceil(join+destHeight));
    }
    const key='obstacle-registered-'+skin.id+'-'+ob.x;
    if(old){
      image.setTexture(skin.key);
      scene.textures.remove(old.key);
      image.slideFront=null;
    }
    const texture=scene.textures.createCanvas(key,source.width,bottom-top);
    if(!texture)return;
    const ctx=texture.getContext();
    ctx.drawImage(source,0,-top);
    // Keep the rest of the painted front and the original source scale.
    for(const [u,sourceHeight,displayHeight] of columns){
      ctx.clearRect(u,join-top,1,bottom-join);
      ctx.drawImage(source,u,join,1,sourceHeight,u,join-top,1,displayHeight);
    }
    texture.refresh();
    const origin=(source.height-top)/(bottom-top),registeredHeight=(bottom-top)*scaleY;
    image.setTexture(key).setOrigin(.5,origin).setDisplaySize(width,registeredHeight);
    image.slideFront={key,source:skin.key,signature,origin,height:registeredHeight};
    if(!image.slideFrontCleanup){
      image.once('destroy',()=>{
        const front=image.slideFront;
        if(front&&scene.textures.exists(front.key))scene.textures.remove(front.key);
      });
      image.slideFrontCleanup=true;
    }
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
  scope.GRIM_OBSTACLE_ART={drawSlideMount,registerSlideFront,mountBramble,seatPlantRoot};
})(typeof window!=='undefined'?window:globalThis);
