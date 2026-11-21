// Project the existing painted terrain onto the near slope. The reusable strip
// follows the world's x axis; the section canvas supplies the actual hill shape.
(function(scope){
  'use strict';
  const plates=new WeakMap();
  const width=544,height=96;

  function projectedPlate(texture){
    const cached=plates.get(texture);
    if(cached)return cached;
    const source=texture.getSourceImage();
    const plate=document.createElement('canvas');
    plate.width=width;plate.height=height;
    const ctx=plate.getContext('2d',{willReadFrequently:true});
    // Far rows cover more ground per pixel. A small oblique offset lets roots
    // and rock strata lead the eye down the shoulder toward the viewer.
    for(let row=0;row<height;row++){
      const t=row/(height-1);
      const v=(.32+.24*Math.log1p(3*t)/Math.log(4))*source.height;
      const sampleHeight=Math.min(source.height-v,source.height*.24*3/(Math.log(4)*height*(1+3*t)));
      const skew=Math.round(8*t+11*t*t);
      ctx.drawImage(source,0,v,source.width,sampleHeight,skew,row,width,1);
      if(skew)ctx.drawImage(source,0,v,source.width,sampleHeight,skew-width,row,width,1);
    }
    // Light on the upward-facing surface rolls into shade as the bank turns.
    const light=ctx.createLinearGradient(0,0,0,height);
    light.addColorStop(0,'rgba(216,202,165,.19)');
    light.addColorStop(.22,'rgba(213,205,183,.14)');
    light.addColorStop(.55,'rgba(193,193,187,.08)');
    light.addColorStop(.8,'rgba(32,30,31,.10)');
    light.addColorStop(1,'rgba(14,15,19,.35)');
    ctx.fillStyle=light;ctx.fillRect(0,0,width,height);
    const fade=ctx.createLinearGradient(0,0,0,height);
    fade.addColorStop(0,'#fff');fade.addColorStop(.84,'#fff');
    fade.addColorStop(1,'transparent');
    ctx.globalCompositeOperation='destination-in';
    ctx.fillStyle=fade;ctx.fillRect(0,0,width,height);
    const pixels=ctx.getImageData(0,0,width,height).data;
    plates.set(texture,pixels);
    return pixels;
  }

  function paint(ctx,sources,from,to,surfaceY,extent,walls,blendAt){
    const first=projectedPlate(sources[0]);
    const second=sources.length>1?projectedPlate(sources[1]):null;
    const firstWords=new Uint32Array(first.buffer,first.byteOffset,first.length/4);
    const output=ctx.createImageData(ctx.canvas.width,ctx.canvas.height);
    const words=new Uint32Array(output.data.buffer);
    // Bake once into the existing section texture. World-space samples keep
    // the roll continuous at joins and a gap rim constrains its maximum depth.
    for(let x=0;x<output.width;x++){
      const worldX=from+x+.5;
      const shoulder=extent*(.64+.18*Math.sin(worldX*.0051)+.115*Math.sin(worldX*.0127+1.1)
        +.055*Math.sin(worldX*.027-.8)+.025*Math.sin(worldX*.073));
      const bankDistance=Math.min(walls?.start?worldX-from:Infinity,walls?.end?to-worldX:Infinity);
      const depth=Math.min(shoulder,bankDistance*.75);
      if(depth<1)continue;
      const top=surfaceY(x+.5),column=((Math.floor(worldX)%width)+width)%width;
      const end=Math.min(output.height,Math.ceil(top+depth-.5));
      const weight=second?blendAt(worldX):0;
      for(let y=Math.max(0,Math.ceil(top-.5));y<end;y++){
        const row=Math.min(height-1,Math.floor((y+.5-top)*height/depth));
        const sample=row*width+column,destination=y*output.width+x;
        words[destination]=firstWords[sample];
        if(weight>0){
          const src=sample*4,dst=destination*4;
          for(let c=0;c<3;c++)output.data[dst+c]=first[src+c]+weight*(second[src+c]-first[src+c]);
        }
      }
    }
    ctx.putImageData(output,0,0);
  }
  scope.GRIM_RIDGE_SHOULDER={paint};
})(window);
