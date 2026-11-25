"""Test a full native-clock run without pausing or manually advancing Phaser."""
import hashlib
import os
import time
from pathlib import Path
from urllib.request import urlopen
from playwright.sync_api import sync_playwright

base=os.environ.get("GAME_URL","http://localhost:8765/").rstrip("/")+"/"
assets=["index.html"]+["prototypes/gravebreaker/"+name for name in
        ["index.html","course.js","armored-crawler.webp","fault-stone.webp"]]
root=Path(__file__).resolve().parents[2]
if "GAME_URL" in os.environ:
    expected={path:hashlib.sha256((root/path).read_bytes()).digest() for path in assets}
    deadline=time.monotonic()+550
    while True:
        try:
            for path,digest in expected.items():
                with urlopen(base+path+"?build="+os.environ["GITHUB_SHA"],timeout=12) as response:
                    if hashlib.sha256(response.read()).digest()!=digest:
                        raise ValueError(path+" still has the earlier deployment")
            print("Verified public game and course files",os.environ["GITHUB_SHA"],flush=True)
            break
        except (ValueError,OSError):
            if time.monotonic()>=deadline:
                raise
            time.sleep(6)


with sync_playwright() as runner:
    browser = runner.chromium.launch(args=["--disable-webgl"])
    for width,height,seed in [(844,390,33),(390,844,7)]:
        context=browser.new_context(viewport={"width":width,"height":height},has_touch=True)
        page=context.new_page()
        page.goto(f"{base}prototypes/gravebreaker/?seed={seed}")
        page.get_by_role("button",name="Start course").wait_for(timeout=90000)
        page.evaluate("""()=>{
          window.received=[];window.sawWarning=false;
          w.grimRun.events.on('poststep',()=>{
            if(w.document.querySelector('.crawler-warning')?.getBoundingClientRect().width>0)sawWarning=true;
          });
          w.document.addEventListener('pointerdown',e=>{
            received.push({button:e.target.closest('button')?.id, at:scene.player.x, seconds:scene.elapsed, state:scene.state});
          },true);
          window.courseState=()=>({received,sawWarning,hp:scene.player.hp,state:scene.state,x:scene.player.x,
            broken:!!trial.wall.broken,staggered:!!trial.crawler.staggered,branchHit:!!trial.branch.dealtDamage,
            positions:[trial.wall.x,trial.crawler.x,trial.branch.x],summary:panel.textContent.trim()});
          // Sample after Phaser advances. Dispatch from the already-measured screen positions.
          window.approach=(key,lead)=>new Promise((resolve,reject)=>{
            const check=()=>{
              if(trial.done || trial[key].x-scene.player.x<=lead){
                w.grimRun.events.off('poststep',check);resolve(courseState());
              }
            };
            w.grimRun.events.on('poststep',check);check();
          });
        }""")
        session=context.new_cdp_session(page)
        page.get_by_role("button",name="Start course").tap()
        frame=page.frames[1]
        points={}
        for move in ("heavy","slide"):
            b=frame.locator("#"+move+"-btn").bounding_box()
            assert b, page.evaluate("courseState()")
            points[move]=[{"x":b["x"]+b["width"]/2,"y":b["y"]+b["height"]/2}]
        for key,move,lead in [("wall","heavy",185),("crawler","heavy",185),("branch","slide",120)]:
            state=page.evaluate("([key,lead])=>approach(key,lead)",[key,lead])
            print("at input",width,key,state,flush=True)
            session.send("Input.dispatchTouchEvent",{"type":"touchStart","touchPoints":points[move]})
            if move=="slide":
                page.evaluate("approach('branch',-115)")
            session.send("Input.dispatchTouchEvent",{"type":"touchEnd","touchPoints":[]})
        page.get_by_role("button",name="Replay course").wait_for(timeout=15000)
        result=page.evaluate("courseState()")
        print("Native-loop finish",width,result,flush=True)
        assert result["hp"]==3 and result["broken"] and result["staggered"] and not result["branchHit"],result
        assert result["sawWarning"]==(height>width), result
        context.close()
    browser.close()
