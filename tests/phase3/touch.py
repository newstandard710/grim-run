"""Compare original enemies through ordinary phone touch controls on matched builds."""
import json
import sys
from pathlib import Path
from statistics import median
from playwright.sync_api import sync_playwright

fixtures = Path(__file__).resolve().parents[1] / "phase2"
renderer = sys.argv[1]
rows = {}
performance = {}
with sync_playwright() as playwright:
    args = ["--disable-webgl"] if renderer == "canvas" else ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
    browser = playwright.chromium.launch(args=args)
    for build, url in zip(("before", "after"), sys.argv[2:]):
        page = browser.new_page(viewport={"width": 844, "height": 390}, has_touch=True)
        page.goto(url + "?seed=33")
        page.locator("#home-enter-btn").tap()
        page.locator("#start-btn").tap()
        page.wait_for_function("grimRun.scene.scenes[0].motionArt?.cutWeaponReady")
        assert page.evaluate("grimRun.renderer.type === Phaser.CANVAS") == (renderer == "canvas")
        page.evaluate((fixtures / "encounter.js").read_text())
        page.evaluate((fixtures / "pressure.js").read_text())
        page.evaluate("""() => {
          window.events=[];
          const play=GRIM_ACTION_AUDIO.play.bind(GRIM_ACTION_AUDIO);
          GRIM_ACTION_AUDIO.play=name=>{events.push(name);play(name)};
          window.oscillators=0;
          const create=AudioContext.prototype.createOscillator;
          AudioContext.prototype.createOscillator=function(){oscillators++;return create.call(this)};
        }""")
        for muted in (False, True):
            page.evaluate("""muted => {const toggle=document.querySelector('#mute-actions');
              toggle.checked=muted;toggle.dispatchEvent(new Event('change'));}""", muted)
            # Replay the same generated pair and ordinary inputs on both builds.
            start = Path(__file__).with_name("tundra.js").read_text()

            def play_pair(pair, lead):
                for name in ("plant", "next"):
                    page.evaluate("x=>travelTo(x)", pair[name]-(lead if name=="plant" else 90))
                    page.locator("#attack-btn").tap()
                return page.evaluate("x=>travelTo(x)", pair["next"]+115)

            if build == "before" and not muted:
                winning_lead = None
                for lead in (180, 160, 200, 220, 240, 190, 170, 210, 150, 130, 110, 90, 70, 50):
                    pair = page.evaluate(start)
                    result = play_pair(pair, lead)
                    print("natural Tundra baseline", lead, result, flush=True)
                    if result["hp"] == 3 and result["plant"] and result["nextCut"]:
                        winning_lead = lead
                        break
                assert winning_lead is not None, "No clean two-Cut reference run"
            pair = page.evaluate(start)
            result = play_pair(pair, winning_lead)
            print(build, "natural Tundra", 27, pair, winning_lead, result, flush=True)
            assert result["hp"] == 3 and result["plant"] and result["nextCut"], result
            for enemy, button, timings in [
                ("plant", "attack", (30, 50, 59, None)),
                ("crawler", "attack", (300, 128, 5, None)),
                ("skeletalBat", "crossbow", (350, 220, 5, None)),
                ("imp", "crossbow", (350, 220, 5, None)),
            ]:
                for seed in (3, 33):
                    for timing in timings:
                        page.evaluate("([k,s])=>{pressure(k,s);events=[];oscillators=0}", [enemy, seed])
                        if timing is not None:
                            page.evaluate("([k,n])=>k==='plant'?approach(n,null):approach(180,n)", [enemy, timing])
                            page.locator("#" + button + "-btn").tap()
                        row = page.evaluate("({...approach(180,null),events,oscillators})")
                        performance.setdefault((build, muted), []).append(row["p95"])
                        key = (enemy, seed, timing, muted)
                        print(build, key, json.dumps(row), flush=True)
                        if muted:
                            assert row["oscillators"] == 0
                        if build == "before":
                            rows[key] = row
                        else:
                            for field in ("hp","dead","enemyHp","windup","warning","release","damage"):
                                assert row.get(field) == rows[key].get(field), (key,field,row,rows[key])
                            if enemy == "imp" and seed == 3 and timing is None:
                                assert rows[key]["stale"] > 0 and row["stale"] <= 1
                            if timing is None:
                                assert row["events"].count("damage") == 3-row["hp"]
                                if enemy != "crawler":
                                    assert row["events"].count({"plant":"plant","imp":"imp","skeletalBat":"bat"}[enemy]) >= 1
                            if not muted and row["events"]:
                                assert row["oscillators"] > 0
            # On the steeper approach, measure where a safe Cut or Jump is available.
            if not muted:
                steep = []
                for button in ("attack", "jump"):
                    for frame in range(32, 66, 3):
                        page.evaluate("pressure('plant',3)")
                        page.evaluate("n=>approach(n,null)", frame)
                        control = page.locator("#" + button + "-btn")
                        if button == "jump":
                            box = control.bounding_box()
                            touch = page.context.new_cdp_session(page)
                            touch.send("Input.dispatchTouchEvent", {"type":"touchStart","touchPoints":[
                                {"x":box["x"]+box["width"]/2,"y":box["y"]+box["height"]/2}]})
                            outcome = page.evaluate("approach(125,null)")
                            touch.send("Input.dispatchTouchEvent", {"type":"touchEnd","touchPoints":[]})
                            touch.detach()
                        else:
                            control.tap()
                            outcome = page.evaluate("approach(125,null)")
                        if outcome["hp"] == 3:
                            steep.append((button,frame))
                print(build, "steep plant", steep, flush=True)
                assert steep, "No clean response on the steep Tundra approach"
            # Two-hit enemies also get an ordinary winning sequence with a fresh bow.
            for enemy in ("skeletalBat", "imp"):
                page.evaluate("kind=>pressure(kind,33)", enemy)
                page.locator("#crossbow-btn").tap()
                page.evaluate("approach(61,null)")
                page.locator("#crossbow-btn").tap()
                outcome = page.evaluate("approach(180,null)")
                print(build, enemy, "two shots", outcome, flush=True)
                if enemy == "skeletalBat":
                    assert outcome["hp"] == 3 and outcome["enemyHp"] <= 0
            survived = []
            for frame in (40, 46, 52, 58):
                page.evaluate("pressure('imp',33)")
                page.locator("#crossbow-btn").tap()
                page.evaluate("n=>approach(n,null)", frame)
                page.locator("#attack-btn").tap()
                result = page.evaluate("approach(180,null)")
                if result["hp"] == 3 and result["enemyHp"] <= 0:
                    survived.append(frame)
            print(build, "Imp shot and Cut", survived, flush=True)
            assert survived
        page.close()
    browser.close()

for group, values in performance.items():
    print("SUMMARY", renderer, group, "median trial p95 ms", median(values), flush=True)
