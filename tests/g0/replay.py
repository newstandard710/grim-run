from playwright.sync_api import sync_playwright
from pathlib import Path
import json, sys, os
root=Path(__file__).resolve().parent
with sync_playwright() as w:
    b=w.chromium.launch(executable_path=os.getenv("CHROMIUM"),args=["--no-sandbox","--disable-webgl"])
    page=b.new_page(viewport={"width":844,"height":390},has_touch=True)
    page.set_default_timeout(60000)
    page.goto(os.getenv("GAME_URL","http://127.0.0.1:8765/")+"?seed=33&renderer=canvas")
    page.locator("#home-enter-btn").click()
    page.locator("#start-btn").click()
    page.wait_for_function("window.grimRun?.scene.scenes[0]?.state==='playing'")
    page.wait_for_function("window.grimRun.scene.scenes[0].motionArt?.forwardReady")
    print("Ready",flush=True)
    page.evaluate((root/"setup.js").read_text())
    for name in sys.argv[1:]:
        data=page.evaluate((root/(name+".js")).read_text())
        (root/(name+".json")).write_text(json.dumps(data,indent=1))
        print(name, len(data),flush=True)
