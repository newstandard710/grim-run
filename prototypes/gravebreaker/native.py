"""Test a full native-clock run without pausing or manually advancing Phaser."""
from playwright.sync_api import sync_playwright

with sync_playwright() as runner:
    browser = runner.chromium.launch(args=["--disable-webgl"])
    for width,height,seed in [(844,390,33),(390,844,7)]:
        context=browser.new_context(viewport={"width":width,"height":height},has_touch=True)
        page=context.new_page()
        page.goto(f"http://localhost:8765/prototypes/gravebreaker/?seed={seed}")
        page.get_by_role("button",name="Start course").wait_for(timeout=90000)
        page.evaluate("""()=>{
          window.received=[];
          w.document.addEventListener('pointerdown',e=>{
            received.push({button:e.target.closest('button')?.id, at:scene.player.x, seconds:scene.elapsed, state:scene.state});
          },true);
          window.courseState=()=>({received,hp:scene.player.hp,state:scene.state,x:scene.player.x,
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
        context.close()
    browser.close()
