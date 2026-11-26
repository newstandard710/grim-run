"""Exercise the Forest reward via real touch controls on a fresh browser profile."""
import hashlib
import json
import os
import time
from pathlib import Path
from urllib.request import urlopen

from playwright.sync_api import sync_playwright

base = os.environ.get("GAME_URL", "http://127.0.0.1:8765/")
expected = (Path(__file__).resolve().parents[1] / "index.html").read_bytes()
digest = hashlib.sha256(expected).hexdigest()
# A push and its Pages deployment run independently.
for attempt in range(100):
    try:
        with urlopen(base + "?opening-release=" + digest, timeout=20) as response:
            if response.read() == expected:
                break
    except OSError:
        pass
    time.sleep(5)
else:
    raise AssertionError("Served index.html does not match the tested release")

with sync_playwright() as runner:
    browser = runner.chromium.launch(args=["--disable-webgl"])
    page = browser.new_page(viewport={"width": 844, "height": 390}, has_touch=True)
    page.goto(base + "?seed=33&opening-release=" + digest)
    page.locator("#home-enter-btn").tap()
    page.locator("#start-btn").tap()
    page.wait_for_function("window.grimRun?.scene.scenes[0]?.motionArt?.cutWeaponReady")
    page.evaluate("""() => {
      const g=window.grimRun,s=g.scene.scenes[0];
      g.loop.sleep();clearInterval(s.loopWatchdogId);
      s.wakeGameLoop=()=>{};s.sys.sceneUpdate=()=>{};
      window.begin=seed=>{
        history.replaceState({},'', '?seed='+seed);
        s.startRun();
        if(s.state!=='playing')throw Error(s.state);
      };
      window.advance=n=>{for(let i=0;i<n;i++){s.update(0,1000/60);g.step(performance.now(),0);}};
    }""")
    cdp = page.context.new_cdp_session(page)
    def play(seed, action, frame):
        page.evaluate("seed=>begin(seed)", seed)
        page.evaluate("n=>advance(n)", frame)
        if action:
            box = page.locator("#" + action + "-btn").bounding_box()
            cdp.send("Input.dispatchTouchEvent", {"type":"touchStart","touchPoints":[{
                "x": box["x"] + box["width"]/2, "y": box["y"] + box["height"]/2}]})
        page.evaluate("n=>advance(n)", 238-frame)
        if action:
            cdp.send("Input.dispatchTouchEvent", {"type":"touchEnd","touchPoints":[]})
        return page.evaluate("""() => {
          const s=grimRun.scene.scenes[0],m=GRIM_META.load();
          return {bank:m.souls,count:m.openingSouls,hp:s.player.hp,run:s.soulCount,
            meters:Math.round(s.distance),remaining:s.souls.filter(o=>o.kind==='optional').length};
        }""")
    logs=[]
    for seed,action in [(1,"jump"),(3,"attack"),(33,"slide")]:
        miss=play(seed,None,145)
        assert miss["hp"]==2 and miss["count"]==0,miss
        logs.append(miss)
    for i,(seed,action) in enumerate([(1,"jump"),(3,"attack"),(33,"slide"),(1,"jump"),(3,"attack")],1):
        success=play(seed,action,147 if seed!=33 else 148)
        assert success["hp"]==3 and success["bank"]==success["count"]==i and success["run"]==1,success
        assert success["remaining"]==2,success
        logs.append(success)
    page.evaluate("""() => {const s=grimRun.scene.scenes[0];s.goToMenu();s.openReliquary();
      s.purchaseMeta('boneheart');s.closeReliquary();}""")
    sixth=play(1,"jump",147)
    assert sixth["bank"]==0 and sixth["count"]==5 and sixth["hp"]==4 and sixth["run"]==0,sixth
    # The opening cap is exhausted. Take the opening hit, then try the authored
    # Forest Cut at 212 m. Inspect the visible pickup before running through it.
    def advance_to(meters):
        page.evaluate("""meters=>{
          const s=grimRun.scene.scenes[0];
          while(s.distance<meters && s.state==='playing')advance(1);
          if(s.distance<meters)throw Error('Run ended at '+s.distance);
        }""", meters)

    def bramble_trial(cut):
        page.evaluate("begin(33)")
        advance_to(205)
        before = page.evaluate("grimRun.scene.scenes[0].player.hp")
        assert before < 4
        if cut:
            page.locator("#attack-btn").tap()
        advance_to(215)
        visible = page.evaluate("grimRun.scene.scenes[0].souls.some(o=>o.kind==='bramble'&&!o.taken)")
        assert visible == cut
        advance_to(245)
        return page.evaluate("""()=>{const s=grimRun.scene.scenes[0];
          return {hp:s.player.hp,run:s.soulCount,meta:GRIM_META.load()};}""")

    missed = bramble_trial(False)
    assert missed["run"] == 0 and missed["meta"]["brambleSouls"] == 0, missed
    recovery = bramble_trial(True)
    assert recovery["hp"] == missed["hp"]+1 and recovery["run"] == 1, recovery
    assert recovery["meta"]["souls"] == recovery["meta"]["brambleSouls"] == 1, recovery
    page.reload()
    page.wait_for_function("window.grimRun?.scene.scenes[0]?.meta")
    saved=page.evaluate("()=>GRIM_META.load()")
    assert saved["openingSouls"]==5 and saved["levels"]["boneheart"]==1 and saved["souls"]==saved["brambleSouls"]==1,saved
    print(json.dumps({"url":base,"sha256":digest,"trials":logs,"sixth":sixth,"missedBramble":missed,"recovery":recovery,"reloaded":saved}))
    browser.close()
