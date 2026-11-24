"""Use actual Chromium touch events with the game paused between fixed update steps."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json

with sync_playwright() as w:
    b=w.chromium.launch(args=["--no-sandbox","--disable-webgl"])
    p=b.new_page(viewport={"width":844,"height":390},has_touch=True)
    p.goto("http://127.0.0.1:8765/?seed=33")
    p.locator("#home-enter-btn").tap()
    p.locator("#start-btn").tap()
    p.wait_for_function("window.grimRun?.scene.scenes[0].state==='playing'")
    p.wait_for_function("window.grimRun.scene.scenes[0].motionArt?.cutWeaponReady")
    p.evaluate((Path(__file__).parent/"setup.js").read_text())
    p.evaluate("""() => {grimRun.scene.scenes[0].sys.sceneUpdate=()=>{};
      window.drawFrame=()=>{paint();grimRun.step(performance.now(),0)};
    }""")
    c=p.context.new_cdp_session(p)
    output=[]
    for label,seed,action,delays in [
        ("natural Forest rock",1,"jump",[0,147,164]),
        ("natural Forest tree",3,"attack",[0,147,164]),
        ("natural Forest arch",33,"slide",[0,148,166]),
        ("isolated Tundra snapping plant",33,"attack",list(range(-1,100,3)))]:
        for delay in delays:
            plant=label.startswith("isolated")
            p.evaluate("""({seed,plant})=>{
              start(seed);const s=S,p=s.player;
              if(plant){
                const x=200+3260*12;
                if(s.terrain.groundAt(x)===null)throw Error('fixture needs solid ground');
                p.x=x-520;p.y=s.terrain.groundAt(p.x)??s.terrain.anchorAt(p.x);
                s.distance=(p.x-200)/12;s.speed=GRIM_CORE.runSpeed(s.distance);
                s.cameraY=p.y-s.groundY;s.cameraX=p.x-s.width*.32;s.syncWorldScroll();
                s.obstacles=[{type:'snappingBramble',x,y:s.terrain.groundAt(x)-62,width:62,height:62,variant:0}];
                s.coins=[];s.souls=[];s.nextEncounterX=s.nextSnapSpawnX=s.nextGroundSpawnX=s.nextEnemySpawnX=1e9;
              }
              window.target=plant?s.obstacles[0]:null;
              window.frame=0;window.beforeHp=p.hp;window.firstHit=null;window.windup=null;
              window.advance=(to)=>{
               for(;frame<to;frame++){
                step();drawFrame();
                target=target||s.obstacles.find(o=>Math.abs(o.x-1050)<1);
                if(windup===null && target?.plantState==='windup')windup=frame;
                if(firstHit===null && target?.dealtDamage)firstHit=frame;
               }
              };
              drawFrame();
            }""",{"seed":seed,"plant":plant})
            if delay>=0:
                p.evaluate("v=>advance(v)",delay)
                rect=p.locator("#"+action+"-btn").bounding_box()
                c.send("Input.dispatchTouchEvent",{"type":"touchStart","touchPoints":[{"x":rect["x"]+rect["width"]/2,"y":rect["y"]+rect["height"]/2}]})
                accepted=p.evaluate("()=>({slide:S.player.holdSlide,jump:S.player.jumpHeld,cut:S.player.attackMs,owner:S.player.risingCut?.mode})")
            else:
                accepted=None
            p.evaluate("v=>advance(v)",120 if plant else 198)
            if delay>=0:c.send("Input.dispatchTouchEvent",{"type":"touchEnd","touchPoints":[]})
            obs=p.evaluate("()=>({version:GRIM_CONFIG.version,type:target?.type,hp:S.player.hp,firstHit,windup,destroyed:target?.destroyed,x:S.player.x,passed:target&&S.player.x>target.x+target.width+26})")
            output.append(dict(label=label,seed=seed,inputFrame=delay,accepted=accepted,**obs))
    (Path(__file__).parent/"touch.json").write_text(json.dumps(output,indent=1))
    print("Actual touch and fully drawn scene",len(output),"trials")
