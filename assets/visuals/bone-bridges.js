/* Brittle Bones bridge art. The terrain section remains the source of contact. */
(function(scope){
  'use strict';
  const FACE = 172, TILE = 128, MAX_VIEWS = 12;
  const BONE_INK = 0xd9c49d;
  const frameBounds = [
    [11,18,116,109], [14,11,113,116], [11,14,116,114], [11,21,116,106],
    [11,22,116,105], [11,14,116,113], [11,15,116,112], [15,11,113,116],
    [12,11,115,116], [11,24,116,103], [11,14,116,113], [11,20,116,107]
  ];
  function variation(seed){
    let value = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b);
    value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
    return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
  }
  function paint(ctx, width, rise, sectionX, atlas){
    const upper = Math.min(0, rise), y = x => rise * x / width - upper;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, y(0));
    ctx.lineTo(width, y(width));
    ctx.lineTo(width, y(width) + FACE);
    ctx.lineTo(0, y(0) + FACE);
    ctx.closePath();
    ctx.clip();
    // Flatten the existing linear rubble contour while drawing. Local layers
    // run continuously from the same lip as collision, even on sloped bridges.
    ctx.transform(1, rise / width, 0, 1, 0, -upper);
    ctx.fillStyle = '#2d251f';
    ctx.fillRect(0, 0, width, FACE);
    const seed = Math.floor(sectionX);
    for(let row = 6; row >= 0; row--){
      for(let col = -1; col <= Math.ceil(width / 32); col++){
        const key = seed + row * 113 + col * 1723;
        const f = Math.floor(variation(key) * frameBounds.length);
        const x = col * 32 + (row % 2) * 13 + variation(key + 3) * 14;
        const depth = 8 + row * 23 + variation(key + 5) * 9;
        const angle = (variation(key + 9) - .5) * 1.8;
        const size = 39 + variation(key + 11) * 28;
        ctx.save();
        ctx.translate(x, depth);
        ctx.rotate(angle);
        ctx.globalAlpha = 1 - row * .062;
        if(atlas){
          const [l,t,r,b] = frameBounds[f], scale = size / Math.max(r-l,b-t);
          const w = (r-l)*scale, h = (b-t)*scale;
          ctx.drawImage(atlas, (f%4)*TILE+l, Math.floor(f/4)*TILE+t, r-l, b-t, -w/2, -h/2, w, h);
        }else{
          ctx.strokeStyle = '#dac9a3';
          ctx.lineWidth = size * .095;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-size*.34, 0);
          ctx.lineTo(size*.34, 0);
          ctx.stroke();
          ctx.fillStyle = '#dac9a3';
          for(const end of [-1,1]){
            ctx.beginPath();
            ctx.ellipse(end*size*.36, 0, size*.091, size*.14, 0, 0, 2*Math.PI);
            ctx.fill();
          }
        }
        ctx.restore();
      }
    }
    const shade = ctx.createLinearGradient(0,0,0,FACE);
    shade.addColorStop(0,'#211b1600');
    shade.addColorStop(.45,'#211b163d');
    shade.addColorStop(1,'#211b16');
    ctx.fillStyle = shade;
    ctx.fillRect(0,0,width,FACE);
    ctx.fillStyle = '#d8c39a';
    ctx.fillRect(0,0,width,1.5);
    ctx.restore();
  }
  class BoneBridges {
    constructor(scene){
      this.scene = scene;
      this.views = new Map();
      this.serial = 0;
    }
    draw(section, from, to){
      const s = this.scene;
      const width = section.end - section.start, rise = section.y1 - section.y0;
      if(width <= 0) return;
      const boneTexture = s.textures?.exists?.('power-bones') ? s.textures.get('power-bones') : null;
      const atlas = boneTexture?.getSourceImage();
      let view = this.views.get(section);
      if(view && (view.rise !== rise || view.atlas !== atlas)){
        this.remove(section);
        view = null;
      }
      if(!view && this.views.size < MAX_VIEWS && s.textures?.createCanvas && s.add?.image){
        const key = 'brittle-bridge-' + this.serial++;
        const texture = s.textures.createCanvas(key, Math.ceil(width), Math.ceil(FACE + Math.abs(rise)));
        if(texture){
          paint(texture.getContext(), width, rise, section.start, atlas);
          texture.refresh();
          const image = s.add.image(section.start, Math.min(section.y0, section.y1), key)
            .setOrigin(0,0).setDepth(.89);
          view = {image, key, rise, atlas};
          this.views.set(section, view);
        }
      }
      if(view){
        view.image.setPosition(section.start,Math.min(section.y0,section.y1));
        return;
      }
      // Also convey the bridge when CanvasTextures are unavailable.
      const g = s.world;
      for(let x = Math.ceil((from-section.start+12)/25)*25+section.start; x < to-12; x += 25){
        const y = s.terrain.surfaceAt(section, x) + 10;
        g.lineStyle(3,BONE_INK,.95).lineBetween(x-7,y+4,x+7,y);
        g.fillStyle(BONE_INK,.95).fillCircle(x-7,y+4,3).fillCircle(x+7,y,3);
      }
    }
    remove(section){
      const view = this.views.get(section);
      view.image.destroy();
      this.scene.textures.remove(view.key);
      this.views.delete(section);
    }
    prune(sections){
      for(const section of this.views.keys()) if(section.kind !== 'rubble' || !sections.includes(section)) this.remove(section);
    }
    clear(){
      for(const section of this.views.keys()) this.remove(section);
    }
  }
  scope.GRIM_BONE_BRIDGES = {BoneBridges};
})(typeof window !== 'undefined' ? window : globalThis);
