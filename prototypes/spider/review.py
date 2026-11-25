"""Render deterministic encounter steps and deliver ordinary touch to the iframe."""
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

renderer=sys.argv[1]
out=Path("spider-results")/renderer
out.mkdir(parents=True,exist_ok=True)
rows=[]
with sync_playwright() as runner:
    args=["--disable-webgl"] if renderer=="canvas" else ["--use-angle=swiftshader","--enable-unsafe-swiftshader"]
    browser=runner.chromium.launch(args=args)
    for seed,width,pair,control in [(33,844,1,0),(33,844,1,1),(7,390,0,0),(7,390,0,1)]:
        page=browser.new_page(viewport={"width":width,"height":390 if width==844 else 844},has_touch=True)
        page.goto(f"http://127.0.0.1:8765/prototypes/spider/?seed={seed}&pair={pair}&control={control}")
        page.wait_for_function("typeof scene!=='undefined' && !!scene?.ui && !!replay.onclick")
        game=page.frames[1]
        game.locator("#home-enter-btn").tap()
        game.locator("#start-btn").tap()
        game.wait_for_function("grimRun.scene.scenes[0].motionArt?.cutWeaponReady")
        page.evaluate("""()=>{
          const s=scene,g=gameWindow.grimRun;g.loop.sleep();clearInterval(s.loopWatchdogId);
          s.wakeGameLoop=()=>{};s.sys.sceneUpdate=()=>{};
          window.resetTrial=()=>{
            s.startRun();window.t=0;window.warn=null;window.visibleWarn=false;window.clearance=null;window.hurt=null;window.cost=[];window.cues=[];
            window.tick=(lead,max=500)=>{
              while(spider.x-s.player.x>lead && max-->0 && t<430){
                const begin=performance.now();s.update(0,1000/60);g.step(performance.now(),0);
                cost.push(performance.now()-begin);++t;
                if(warn===null && spider.phase==='warn'){
                  warn=t;visibleWarn=spider.x+42<s.cameraX+s.width && spider.y-15>s.cameraY
                    && spider.y+16<s.cameraY+s.height;
                }
                if(s.player.sliding && Math.abs(spider.x-s.player.x)<20){
                  const gap=(s.feetY-29)-(spider.y+16);
                  clearance=clearance===null?gap:Math.min(clearance,gap);
                }
                if(hurt===null && spider.hit)hurt=t;
              }
            };
          };
          const original=gameWindow.GRIM_ACTION_AUDIO.play.bind(gameWindow.GRIM_ACTION_AUDIO);
          gameWindow.GRIM_ACTION_AUDIO.play=n=>{window.cues?.push(n);original(n)};
          window.voices=0;const proto=gameWindow.AudioContext.prototype,make=proto.createOscillator;
          proto.createOscillator=function(){voices++;return make.call(this)};
        }""")
        assert game.evaluate("grimRun.renderer.type===Phaser.CANVAS")== (renderer=="canvas")
        cdp=page.context.new_cdp_session(page)
        def touch(button,down):
            box=game.locator("#"+button+"-btn").bounding_box()
            cdp.send("Input.dispatchTouchEvent",{"type":"touchStart" if down else "touchEnd","touchPoints":[{"x":box["x"]+box["width"]/2,"y":box["y"]+box["height"]/2}] if down else []})
        def run(action,lead,muted=False,capture=False):
            page.evaluate("""mute=>{resetTrial();const m=gameWindow.document.querySelector('#mute-actions');
              m.checked=mute;m.dispatchEvent(new gameWindow.Event('change'));voices=0}""",muted)
            if pair: assert page.evaluate("!!next")
            def advance(end):
                if not capture:
                    page.evaluate("x=>tick(x)",end)
                    return
                while page.evaluate("x=>spider.x-scene.player.x>x&&t<430",end):
                    page.evaluate("x=>tick(x,2)",end)
                    folder=out/action
                    folder.mkdir(exist_ok=True)
                    page.screenshot(path=folder/f"{len(list(folder.glob('*.jpg'))):04d}.jpg",type="jpeg",quality=82)
            advance(lead)
            if action!="miss": touch(action,True)
            advance(-85)
            if action!="miss": touch(action,False)
            if pair:
                advance(-225)
                touch("jump",True)
                advance(-500)
                touch("jump",False)
            result=page.evaluate("""()=>({hp:scene.player.hp,hit:spider.hit,dead:spider.dead,warn,hurt,visibleWarn,clearance,
              rock:next?.dealtDamage||false,grade:scene.terrain.groundAt(spider.x+30)-scene.terrain.groundAt(spider.x-30),
              p95:cost.sort((a,b)=>a-b)[Math.floor(cost.length*.95)],voices,cues})""")
            rows.append(dict(seed=seed,width=width,control=control,action=action,lead=lead,muted=muted,**result))
            print(json.dumps(rows[-1]),flush=True)
            if muted: assert result["voices"]==0
            return result
        miss=run("miss",-65)
        run("miss",-65)
        assert miss["hit"] != bool(control)
        if not control:
            assert miss["visibleWarn"] and miss["cues"].count("silk")==1
            assert miss["cues"].count("damage")==1 and miss["hurt"]>miss["warn"]
            for action in ("attack","slide"):
                winner=None
                for lead in ([290,110,85,65,145,45,-38] if action=="attack" else [290,92,35,-38]):
                    row=run(action,lead)
                    if lead>0 and row["hp"]==3 and (row["dead"] if action=="attack" else not row["hit"]):
                        if winner is None or lead==92:winner=lead
                assert winner is not None,(seed,action)
                row=run(action,winner,True,capture=renderer=="canvas" and width==844)
                assert row["hp"]==3
                if action=="slide": assert row["clearance"]>0
        page.close()
    browser.close()
(out/"results.json").write_text(json.dumps(rows,indent=2))
