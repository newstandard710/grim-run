"""Compare real button transitions in the ordinary game and in the preview."""
from playwright.sync_api import expect


def check_controls(browser, base):
    traces = []
    for preview in [False, True]:
        page = browser.new_page(viewport={"width": 844, "height": 390}, has_touch=True)
        page.goto(base + ("prototypes/gravebreaker/" if preview else "") + "?seed=33")
        if preview:
            page.get_by_role("button", name="Start course").tap(timeout=90000)
            frame = page.frames[1]
        else:
            frame = page.main_frame
            frame.locator("#home-enter-btn").tap()
            frame.locator("#start-btn").tap()
        frame.wait_for_function("grimRun.scene.scenes[0].motionArt?.cutWeaponReady")
        frame.evaluate("""() => {
          const g=grimRun,s=g.scene.scenes[0];
          g.loop.sleep();clearInterval(s.loopWatchdogId);s.wakeGameLoop=()=>{};s.sys.sceneUpdate=()=>{};
          window.sc=s;window.advanceFrames=n=>{for(let i=0;i<n;i++){s.update(0,1000/60);g.step(performance.now(),0)}};
          window.prepare=(cleave=false)=>{
            s.startRun();const p=s.player;
            p.x=12140-500;p.y=s.terrain.groundAt(p.x);s.distance=(p.x-s.startX)/12;s.speed=GRIM_CORE.runSpeed(s.distance);
            s.cameraX=p.x-s.width*.32;s.cameraY=p.y-s.groundY;s.syncWorldScroll();
            s.obstacles=[];s.coins=[];s.nextEncounterX=s.nextGroundSpawnX=s.nextEnemySpawnX=s.nextSnapSpawnX=Infinity;
            s.placeEncounter('bramble',p.x+85);window.tree=s.obstacles[0];
            s.gunUnlocked=true;s.gunCooldownMs=0;s.ui.showGun(true);
            if(cleave)s.powerManager.apply('soulCleave',p,()=>{},1);
            s.drawScene();
          };
        }""")
        session = page.context.new_cdp_session(page)

        def press(key, release=True):
            target = frame.locator("#"+key+"-btn")
            expect(target).to_be_visible()
            b = target.bounding_box()
            session.send("Input.dispatchTouchEvent", {"type":"touchStart","touchPoints":[
                {"x": b["x"]+b["width"]/2, "y": b["y"]+b["height"]/2}]})
            if release:
                session.send("Input.dispatchTouchEvent", {"type":"touchEnd","touchPoints":[]})

        outcomes = []
        for cleave in [False, True]:
            frame.evaluate("v=>prepare(v)", cleave)
            press("attack")
            immediate = frame.evaluate("[sc.player.attackMs,sc.player.attackCooldownMs,sc.swingSequence]")
            assert immediate == [260, 405, 1], immediate
            press("crossbow")
            assert frame.evaluate("sc.bullets.length") == 1
            for tick in range(1, 30):
                frame.evaluate("advanceFrames(1)")
                if frame.evaluate("tree.destroyed"):
                    break
            assert frame.evaluate("tree.destroyed"), (preview,cleave)
            for index in range(tick, 25):
                frame.evaluate("advanceFrames(1)")
            press("attack")
            assert frame.evaluate("sc.swingSequence") == 2
            outcomes.append([cleave, tick, immediate])
        for move, check in [("jump","!sc.player.grounded"), ("slide","sc.player.sliding")]:
            frame.evaluate("prepare()")
            press("attack")
            press(move, release=False)
            assert frame.evaluate(check)
            session.send("Input.dispatchTouchEvent", {"type":"touchEnd","touchPoints":[]})
        if preview:
            for move, check in [("attack","sc.swingSequence===2"),("jump","!sc.player.grounded"),("slide","sc.player.sliding")]:
                frame.evaluate("prepare()")
                press("heavy")
                frame.evaluate("advanceFrames(38)")
                press(move)
                assert not frame.evaluate(check), move
                frame.evaluate("advanceFrames(2)")
                press(move, release=False)
                assert frame.evaluate(check), move
                session.send("Input.dispatchTouchEvent", {"type":"touchEnd","touchPoints":[]})
        traces.append(outcomes)
        page.close()
    assert traces[0] == traces[1], traces
    print("Ordinary and prototype Cut, Soul Cleave, Jump, Slide and crossbow follow-up", traces, flush=True)
