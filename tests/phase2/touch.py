"""Matched phone-size touch trials on a candidate, its parent, or deployed Pages."""
import json
import os
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

base, label, renderer = sys.argv[1:4]
baseline = label == "before"
output = Path("test-results/phase2") / (label + "-" + renderer)
output.mkdir(parents=True, exist_ok=True)
logs = []
with sync_playwright() as w:
    args = ["--disable-webgl"] if renderer == "canvas" else ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
    browser = w.chromium.launch(args=args)
    page = browser.new_page(viewport={"width":844,"height":390},has_touch=True)
    page.set_default_timeout(50000)
    page.add_init_script("""window.notes=[];
      const create=AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator=function(){
        const osc=create.call(this); const start=osc.start.bind(osc);
        osc.start=(...args)=>{notes.push({frame:window.sample?.frame,state:this.state,type:osc.type});return start(...args)};
        return osc;
      };""")
    page.goto(base + "?seed=33")
    page.locator("#home-enter-btn").tap()
    page.locator("#start-btn").tap()
    page.wait_for_function("grimRun.scene.scenes[0].motionArt?.cutWeaponReady")
    assert page.evaluate("grimRun.renderer.type===Phaser.CANVAS") == (renderer=="canvas")
    page.evaluate(Path(__file__).with_name("encounter.js").read_text())
    cdp = page.context.new_cdp_session(page)

    def touch(action, down):
        points=[]
        if down:
            box=page.locator("#"+action+"-btn").bounding_box()
            points=[{"x":box["x"]+box["width"]/2,"y":box["y"]+box["height"]/2}]
        cdp.send("Input.dispatchTouchEvent",{"type":"touchStart" if down else "touchEnd","touchPoints":points})

    def run(zone, timing, seed=33, capture=False):
        page.evaluate("([seed,zone])=>begin(seed,zone)",[seed,zone])
        trial=page.evaluate("trial")
        target=trial.get("targetX")
        events=[]
        for x in trial["gaps"]:
            events += [(x-58,"jump",True),(x+190,"jump",False)]
        if target and timing!="miss":
            offset={"early":-260,"timed":-90,"late":8}[timing]
            events += [(target+offset,"attack",True),(target+offset+8,"attack",False)]
        events.sort()
        if capture:
            # Inspect playable motion at 1x. Capture alternate physics frames for 30 fps.
            folder=output/"motion"
            folder.mkdir(exist_ok=True)
        for x,action,down in events+[(trial["end"],None,None)]:
            if capture:
                while page.evaluate("scene.player.x")<x and page.evaluate("scene.state==='playing'"):
                    page.evaluate("x=>advanceUntil(x,true)",x)
                    frame=page.evaluate("sample.frame")
                    if frame%2==0: page.screenshot(path=folder/f"{frame//2:04}.jpg",type="jpeg",quality=71)
            else:
                page.evaluate("x=>advanceUntil(x)",x)
            if action:
                touch(action,down)
                page.evaluate("e=>sample.events.push([sample.frame,...e])",[action,down])
        result=page.evaluate("""()=>{const times=sample.costs.sort((a,b)=>a-b);
          return {...sample,costs:undefined,hp:scene.player.hp,state:scene.state,
            p95:times[Math.floor(times.length*.95)],p99:times[Math.floor(times.length*.99)]};}""")
        result.update(zone=zone,timing=timing,seed=seed)
        logs.append(result)
        print(json.dumps(result),flush=True)
        if timing=="timed" and (not baseline or zone=="foothills"):
            assert result["hp"]==result["before"]==3 and result["state"]=="playing",result
            if not baseline: assert result["tree"]["destroyed"] and not result["tree"]["hit"],result
        if not baseline and timing!="timed":
            assert result["hp"]<result["before"] and result["tree"]["hit"],result
        return result

    run("foothills","timed",capture=os.getenv("CAPTURE")=="1")
    if not baseline:
        for zone in ("forest","practice","foothills","chain"):
            for timing in ("early","timed","late","miss"):
                run(zone,timing)
        assert page.evaluate("notes.some(n=>n.state==='running')")
        page.evaluate("scene.togglePause()")
        page.locator("#mute-actions").check()
        page.locator("#resume-btn").tap()
        assert page.evaluate("scene.state==='countdown'")
        count=page.evaluate("notes.length")
        page.set_viewport_size({"width":390,"height":844})
        run("foothills","timed")
        assert page.evaluate("notes.length")==count
    (output/"touch.json").write_text(json.dumps(logs,indent=2))
    browser.close()
