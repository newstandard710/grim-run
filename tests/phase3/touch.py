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
            # Use the real Tundra generator, restoring normal health before scoring.
            start = (Path(__file__).with_name("tundra.js")).read_text()
            if build == "before" and not muted:
                route = None
                for seed in (33, 3, 73, 17, *range(1, 33)):
                    pair = page.evaluate(start, seed)
                    if pair:
                        route = (seed, pair)
                        break
                assert route, "No generated plant and bramble pair found"
            seed, expected = route
            pair = page.evaluate(start, seed)
            assert pair == expected, (pair, expected)
            for name in ("plant", "next"):
                page.evaluate("x=>travelTo(x)", pair[name]-90)
                page.locator("#attack-btn").tap()
            result = page.evaluate("x=>travelTo(x)", pair["next"]+115)
            print(build, "natural Tundra", seed, pair, result, flush=True)
            assert result["hp"] == 3 and result["plant"] and result["nextCut"], result
        page.close()
    browser.close()

for group, values in performance.items():
    print("SUMMARY", renderer, group, "median trial p95 ms", median(values), flush=True)
