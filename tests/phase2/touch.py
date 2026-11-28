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
failures = []
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
      };
      const startBuffer=AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start=function(...args){
        notes.push({frame:window.sample?.frame,state:this.context.state,type:'buffer'});
        return startBuffer.apply(this,args);
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
            if not box:
                raise AssertionError(page.evaluate("()=>({state:scene.state,x:scene.player.x,hp:scene.player.hp,trial,sample})"))
            points=[{"x":box["x"]+box["width"]/2,"y":box["y"]+box["height"]/2}]
        cdp.send("Input.dispatchTouchEvent",{"type":"touchStart" if down else "touchEnd","touchPoints":points})

    def run(zone, timing, seed=33, capture=False, offset_override=None):
        page.evaluate("([seed,zone])=>begin(seed,zone)",[seed,zone])
        trial=page.evaluate("trial")
        target=trial.get("targetX")
        events=[]
        for x in trial["gaps"]:
            events += [(x-58,"jump",True),(x+190,"jump",False)]
        if target and timing!="miss":
            offset={"early":-260,"timed":-90,"late":8}[timing]
            if offset_override is not None: offset=offset_override
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
        if offset_override is not None: return result
        if timing=="timed":
            if result["hp"]!=3 or result["before"]!=3 or result["state"]!="playing":
                failures.append(result)
            if not baseline and (not result.get("tree",{}).get("destroyed") or result["tree"]["hit"]):
                failures.append(result)
        if not baseline and timing!="timed":
            if result["hp"]>=result["before"] or not result.get("tree",{}).get("hit"):
                failures.append(result)
        return result

    run("foothills","timed",capture=os.getenv("CAPTURE")=="1")
    if not baseline:
        # This Endless encounter has one Cut and no score. The blade plays one
        # sampled swish even when a separate oscillator supplies the contact.
        assert page.evaluate("notes.filter(n=>n.type==='buffer' && n.frame!=null).length") == 1
    if baseline: run("chain","timed")
    if not baseline:
        if renderer=="canvas":
            for seed in (1,2,3,17,73):
                run("foothills","timed",seed)
            for offset in (-180,-150,-120,-60,-48,-36,-24,-12):
                run("foothills","timed",offset_override=offset)
        for zone in ("forest","practice","foothills","chain"):
            for timing in ("early","timed","late","miss"):
                run(zone,timing)
        page.evaluate(Path(__file__).with_name("pressure.js").read_text())
        for frame in [47,50,53,56,59,None]:
            page.evaluate("pressure('plant')")
            if frame is not None:
                page.evaluate("n=>approach(n,null)",frame)
                touch("attack",True)
                touch("attack",False)
            outcome=page.evaluate("approach(120,null)")
            print("Tundra",frame,outcome,flush=True)
            assert outcome["windup"]==29 and outcome["tip"]
            assert outcome["hp"]==(3 if frame in (47,50,53,56) else 2)
            assert outcome["dead"]==(frame is not None)
        for action,lead in [("jump",105),("attack",128),("crossbow",310),(None,0)]:
            page.evaluate("pressure('crawler')")
            if action:
                page.evaluate("lead=>approach(300,lead)",lead)
                touch(action,True)
            outcome=page.evaluate("approach(180,null)")
            if action: touch(action,False)
            print("Lava",action,outcome,flush=True)
            if action=="crossbow": assert outcome["dead"] and outcome["hp"]==3
            if action is None: assert outcome["hp"]<3
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
    assert not failures,failures
