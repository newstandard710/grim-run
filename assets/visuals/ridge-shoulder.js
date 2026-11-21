// Project the existing painted terrain onto the near slope. The reusable strip
// follows the world's x axis; the section canvas supplies the actual hill shape.
(function(scope){
  'use strict';
  const plates=new WeakMap();
  const width=544,height=96;

  function projectedPlate(source){
    let plate=plates.get(source);
    if(plate)return plate;
    plate=document.createElement('canvas');
    plate.width=width;plate.height=height;
    const ctx=plate.getContext('2d');
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
    plates.set(source,plate);
    return plate;
  }

  function paint(ctx,source,from,to,surfaceY,extent,walls,blend){
    const pattern=ctx.createPattern(projectedPlate(source),'repeat-x');
    ctx.save();
    ctx.fillStyle=pattern;
    // Integer strip boundaries meet without antialiased triangle seams.
    // Sampling absolute world coordinates keeps the roll continuous at joins.
    const span=Math.ceil(to-from);
    for(let x=0;x<span;x+=3){
      const end=Math.min(span,x+3),worldX=from+(x+end)*.5;
      const shoulder=extent*(.64+.18*Math.sin(worldX*.0051)+.115*Math.sin(worldX*.0127+1.1)
        +.055*Math.sin(worldX*.027-.8)+.025*Math.sin(worldX*.073));
      const bankDistance=Math.min(walls?.start?worldX-from:Infinity,walls?.end?to-worldX:Infinity);
      const depth=Math.min(shoulder,bankDistance*.75);
      if(depth<1)continue;
      if(blend)ctx.globalAlpha=blend(worldX);
      const y=surfaceY(x),slope=(surfaceY(end)-y)/(end-x);
      const phase=((from+x)%width+width)%width;
      ctx.setTransform(1,slope,0,depth/height,x-phase,y-slope*phase);
      ctx.fillRect(phase,0,end-x,height);
    }
    ctx.restore();
  }
  scope.GRIM_RIDGE_SHOULDER={paint};
})(window);
