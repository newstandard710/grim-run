"""Play the draft route with Chromium touch input; save timings and two game-speed clips."""
import json
import subprocess
import sys
from pathlib import Path

from controls import check_controls

import imageio_ffmpeg
from playwright.sync_api import sync_playwright

renderer = sys.argv[1]
out = Path("grave-review") / renderer
out.mkdir(parents=True, exist_ok=True)
rows = []
with sync_playwright() as runner:
    flags = ["--disable-webgl"] if renderer == "canvas" else ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
    browser = runner.chromium.launch(args=flags)
    for width, height, seed in [(844, 390, 33), (390, 844, 7)]:
        context = browser.new_context(viewport={"width": width, "height": height}, has_touch=True)
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(f"http://localhost:8765/prototypes/gravebreaker/?seed={seed}")
        page.get_by_role("button", name="Start course").tap(timeout=90000)
        frame = page.frames[1]
        assert frame.evaluate("grimRun.renderer.type===Phaser.CANVAS") == (renderer == "canvas")
        page.evaluate("""() => {
          const s=scene,g=w.grimRun;
          g.loop.sleep();clearInterval(s.loopWatchdogId);s.wakeGameLoop=()=>{};s.sys.sceneUpdate=()=>{};
          window.step=()=>{
            s.update(0,1000/60);g.step(performance.now(),0);
            for(const key of ['wall','crawler']){
              const o=trial[key];
              const px=o.x+o.width*.5-s.cameraX,py=o.y+o.height*.33-s.renderCameraY;
              const el=w.document.elementFromPoint(px,py);
              if(!visible[key] && el && !el.closest('button') && o.x+o.width<=s.cameraX+s.width &&
                  o.y>=s.renderCameraY && o.y+o.height<=s.renderCameraY+s.height){
                visible[key]={x:s.player.x,seconds:s.elapsed};
              }
            }
          };
          window.advance=(x,count=500)=>{while(!trial.done&&s.player.x<x&&count-->0)step()};
          window.reset=(target,muted)=>{
            s.startRun();window.voices=0;window.visible={};
            const m=w.document.querySelector('#mute-actions');m.checked=muted;m.dispatchEvent(new w.Event('change'));
            if(target){
              const x=trial[target].x-400;
              s.player.x=x;s.player.y=s.terrain.groundAt(x);s.cameraX=x-s.width*.32;s.cameraY=s.player.y-s.groundY;
              s.distance=(x-s.startX)/12;s.speed=w.GRIM_CORE.runSpeed(s.distance);s.syncWorldScroll();s.drawScene();
            }
          };
          const proto=w.AudioContext.prototype, original=proto.createOscillator;
          proto.createOscillator=function(){voices++;return original.call(this)};
        }""")
        cut_box = frame.locator("#attack-btn").bounding_box()
        heavy_box = frame.locator("#heavy-btn").bounding_box()
        assert heavy_box["x"]+heavy_box["width"] <= cut_box["x"] and heavy_box["width"]>=44
        cdp = context.new_cdp_session(page)

        def touch(action, down=True):
            points = []
            if down:
                box = frame.locator("#" + action + "-btn").bounding_box()
                assert box, action
                points = [{"x": box["x"] + box["width"]/2, "y": box["y"] + box["height"]/2}]
            cdp.send("Input.dispatchTouchEvent", {"type": "touchStart" if down else "touchEnd", "touchPoints": points})

        def reset(target=None, muted=False):
            page.evaluate("([target,mute])=>reset(target,mute)", [target, muted])

        def scan(target, action, leads):
            passed = []
            for lead in leads:
                reset(target)
                x = page.evaluate("t=>trial[t].x", target)
                page.evaluate("x=>advance(x)", x-lead)
                accepted = page.evaluate("scene.player.x")
                if action != "miss":
                    touch(action)
                page.evaluate("x=>advance(x)", x+150)
                if action != "miss":
                    touch(action, False)
                data = page.evaluate("""key=>{const o=trial[key];return {hp:scene.player.hp,
                  success:!!(o.broken||o.staggered),hit:!!(o.hit||o.dealtDamage),voices,
                  view:scene.width,speed:scene.speed}}""", target)
                row = dict(seed=seed, width=width, target=target, action=action, lead=lead,
                           actualLead=round(x-accepted, 1), **data)
                rows.append(row)
                print(json.dumps(row), flush=True)
                if not row["hit"] and (action != "heavy" or row["success"]):
                    passed.append(lead)
            return passed

        timing = {}
        for target in ["wall", "crawler"]:
            timing[target] = {}
            for action, leads in [("heavy", [300,240,210,180,155,130,105,80,55,30,0]),
                                  ("jump", [300,150,115,95,75,55,0])]:
                wins = scan(target, action, leads)
                assert wins and len(wins)<len(leads), (target,action,wins)
                timing[target][action] = wins[len(wins)//2]
                # Refine the late edge to about one 60 Hz frame of travel.
                latest = min(wins)
                if action == "heavy":
                    scan(target, action, range(latest-5, max(0,latest-25), -5))
            assert not scan(target, "miss", [0])
            assert not scan(target, "attack", [75])
        assert not scan("branch", "heavy", [150])
        assert rows[-1]["hit"] and rows[-1]["hp"]==2
        assert scan("branch", "slide", [55])
        for action, muted in [("heavy", False), ("jump", True)]:
            reset(muted=muted)
            frames = out / "frames"
            capture = renderer == "canvas" and ((width==844)==(action=="heavy"))
            if capture:
                frames.mkdir(exist_ok=True)
            counter = 0

            def travel(x):
                global counter
                if not capture:
                    page.evaluate("x=>advance(x)", x)
                    return
                while page.evaluate("x=>!trial.done && scene.player.x<x", x):
                    page.evaluate("x=>advance(x,2)", x)
                    page.screenshot(path=frames/f"{counter:04d}.jpg", type="jpeg", quality=84)
                    counter += 1

            for target in ["wall", "crawler", "branch"]:
                x = page.evaluate("t=>trial[t].x", target)
                move = "slide" if target=="branch" else action
                lead = 55 if target=="branch" else timing[target][action]
                travel(x-lead)
                touch(move)
                travel(x+145)
                touch(move, False)
            travel(x+450)
            result = page.evaluate("""()=>({done:trial.done,hp:scene.player.hp,voices,
                visible,wallX:trial.wall.x,crawlerX:trial.crawler.x,wall:!!trial.wall.broken,stagger:!!trial.crawler.staggered})""")
            assert result["done"] and result["hp"]==3, result
            assert (result["voices"]==0)==muted, result
            assert result["wall"]==result["stagger"]==(action=="heavy")
            print("course", width, action, result, flush=True)
            if capture:
                subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-loglevel","error","-y","-framerate","30",
                    "-i",str(frames/"%04d.jpg"),"-pix_fmt","yuv420p",str(out/f"{action}.mp4")],check=True)
                for f in frames.glob("*.jpg"):
                    f.unlink()
            page.get_by_role("button",name="Replay course").tap()
        if renderer=="canvas":
            # Let Phaser own the clock on a fresh entry; send touches through the same CDP device.
            page.reload()
            page.get_by_role("button",name="Start course").tap(timeout=90000)
            frame=page.frames[1]
            for target, move in [("wall","heavy"),("crawler","heavy"),("branch","slide")]:
                lead=65 if move=="slide" else timing[target]["heavy"]
                page.wait_for_function("([key,lead])=>trial[key].x-scene.player.x<=lead",
                                       arg=[target,lead], polling="raf")
                touch(move)
                if move=="slide":
                    page.wait_for_function("scene.player.x>trial.branch.x+trial.branch.width+25")
                touch(move,False)
            page.get_by_role("button",name="Replay course").wait_for()
            assert page.evaluate("scene.player.hp===3 && trial.wall.broken && trial.crawler.staggered")
            print("Native-loop touch course cleared",width,flush=True)
        assert not errors, errors
        context.close()
    check_controls(browser, "http://localhost:8765/")
    browser.close()
(out/"timing.json").write_text(json.dumps(rows,indent=2))
