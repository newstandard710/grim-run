"""Run with a repository-root server on port 8765. All player actions use touch."""
import argparse
import json
import os
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument("renderer", choices=["canvas", "webgl"])
parser.add_argument("--width", type=int, choices=[390, 844], required=True)
parser.add_argument("--seed", type=int, choices=[7, 33], required=True)
parser.add_argument("--native", action="store_true")
args = parser.parse_args()
width = args.width
height = 844 if width == 390 else 390
base = "http://localhost:8765/"
stored = {
    "grim-run-v07-meta": '{"version":1,"souls":41,"openingSouls":5,"levels":{"boneheart":2}}',
    "grim-run-v05-souls": "41", "grim-run-v03-best": "1029", "grimRun.actionSoundsMuted": "0"
}

with sync_playwright() as runner:
    flags = ["--disable-webgl"] if args.renderer == "canvas" else ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
    browser = runner.chromium.launch(executable_path=os.environ.get("FLAME_CHROMIUM"), args=flags)
    context = browser.new_context(viewport={"width":width,"height":height}, has_touch=True)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(base+"README.md")
    page.evaluate("v=>Object.assign(localStorage,v)", stored)
    page.goto(f"{base}prototypes/flame-bolt/?seed={args.seed}")
    page.get_by_role("button", name="Start course").wait_for(timeout=90000)
    frame = page.frames[1]
    cdp = context.new_cdp_session(page)
    assert frame.evaluate("grimRun.renderer.type===Phaser.CANVAS") == (args.renderer=="canvas")
    assert page.evaluate("scene.meta.souls===0 && scene.meta.openingSouls===0")
    page.evaluate("""native=>{
      const s=scene,g=w.grimRun;
      window.presses=[];window.damage=[];
      w.document.addEventListener('pointerdown',event=>{
        if(trial)presses.push([event.target.closest('button')?.id,s.player.x-trial.web.x,s.elapsed]);
      },true);
      const take=s.takeDamage.bind(s);
      s.takeDamage=(amount,kind,...args)=>{damage.push([kind,s.elapsed]);return take(amount,kind,...args)};
      window.shots=[];window.hits=[];window.frameTimes=[];window.cues={};
      const fire=s.fireSoulcaster.bind(s),hit=s.hitEnemy.bind(s);
      s.fireSoulcaster=target=>{
        fire(target);const b=s.bullets.at(-1);
        shots.push([b.ref?.kind||(b.ref?.silk?'web':'free'),s.elapsed]);
      };
      s.hitEnemy=(e,d,gun)=>{
        hit(e,d,gun); hits.push([e.kind,e.hp,d,gun,s.elapsed]);
      };
      const create=w.AudioContext.prototype.createOscillator;
      window.voices=0;w.AudioContext.prototype.createOscillator=function(){voices++;return create.call(this)};
      let previous;
      const observe=()=>{
        if(!trial||trial.done||s.state!=='playing'){previous=null;return}
        const now=performance.now();if(previous!==null && previous!==undefined)frameTimes.push(now-previous);
        previous=now;
        for(const key of ['web','crawler','pair','bat']){
          const o=trial[key];if(!o||o.dead||o.destroyed||cues[key])continue;
          const x=o.x+(o.silk?30:0)-s.cameraX,y=o.y+(o.silk?26:-8)-s.renderCameraY;
          const el=w.document.elementFromPoint(x,y);
          if(el && !el.closest('button') && x>0 && x<s.width && y>0 && y<s.height)cues[key]=s.elapsed;
        }
      };
      if(native)g.events.on('poststep',observe);
      else {
        g.loop.sleep();clearInterval(s.loopWatchdogId);s.wakeGameLoop=()=>{};s.sys.sceneUpdate=()=>{};
      }
      window.advance=async([condition,value])=>{
        const match=()=>{
          if(condition==='ticks')return false;
          if(condition==='end')return trial.done;
          if(condition==='playing')return s.state==='playing';
          if(condition==='burn')return trial.burnLeft>0;
          if(condition==='dead')return trial.crawler?.dead;
          const ob=trial[condition];return ob && ob.x-s.player.x<=value;
        };
        if(native){
          const deadline=performance.now()+18000;
          await new Promise((resolve,reject)=>{
            function next(){
              if(match())return resolve();
              if(trial.done||performance.now()>deadline)return reject(Error(condition+' unavailable'));
              requestAnimationFrame(next);
            } next();
          });return;
        }
        for(let i=0;i<(condition==='ticks'?value:1100);i++){
          if(match()||trial.done)return;
          s.update(0,1000/60);g.step(performance.now(),0);observe();
        }
        if(condition!=='ticks'&&!match())throw Error(condition+' unavailable');
      };
    }""", args.native)

    def advance(key, value=0):
        page.evaluate("arg=>advance(arg)", [key,value])

    points = {}

    def touch(key, hold=False):
        cdp.send("Input.dispatchTouchEvent", {"type":"touchStart","touchPoints":[points[key]]})
        if not hold:
            release()

    def release():
        cdp.send("Input.dispatchTouchEvent", {"type":"touchEnd","touchPoints":[]})

    def start(ammo):
        page.get_by_label(ammo,exact=True).tap()
        page.evaluate("()=>{shots=[];hits=[];damage=[];presses=[];frameTimes=[];cues={};voices=0}")
        page.locator("main button").tap()
        assert page.evaluate("scene.state==='playing' && !trial.burnLeft && !scene.bullets.length")
        if not points:
            points.update(frame.evaluate("""()=>Object.fromEntries(['attack','crossbow','slide','pause'].map(key=>{
              const r=document.querySelector('#'+key+'-btn').getBoundingClientRect();return [key,{x:r.x+r.width/2,y:r.y+r.height/2}];}))"""))
        return page.evaluate("""()=>[trial.web.x,trial.pair.x,trial.branch.x,trial.crawlerX,
          ...[trial.web,trial.pair,trial.branch].map(o=>o.y-scene.groundY)]""")

    def stop():
        touch("pause")
        frame.locator("#quit-btn").tap()
        assert page.get_by_role("button",name="Replay course").is_visible()

    def shoot_at(key, lead, target):
        advance(key,lead)
        touch("crossbow")
        assert page.evaluate("shots.at(-1)[0]") == target, page.evaluate("shots")

    def summary():
        return page.evaluate("""()=>({
          hp:scene.player.hp,web:trial.web.clear,pair:trial.pair.clear,solid:!trial.branch.destroyed,
          collided:!!trial.branch.dealtDamage,kills:scene.encounterTelemetry.kills,wallet:scene.meta.souls,
          shots:shots.map(s=>s[0]),damage,presses,cues,voices,frames:frameTimes.length,
          p95:frameTimes.slice().sort((a,b)=>a-b)[Math.floor(frameTimes.length*.95)],
          p99:frameTimes.slice().sort((a,b)=>a-b)[Math.floor(frameTimes.length*.99)]})""")

    geometry = None
    for ammo in ["Standard","Flame"]:
        layout = start(ammo)
        if geometry is not None:
            assert layout == geometry, (layout,geometry)
        geometry = layout
        if ammo=="Flame" and not args.native:
            touch("pause"); frame.locator("#mute-actions").tap(); frame.locator("#resume-btn").tap()
            advance("playing")
        if ammo=="Standard":
            shoot_at("web",200,"free")
            advance("web",100)
            touch("attack")
        else:
            shoot_at("web",200,"web")
        shoot_at("crawler",225,"crawler")
        if ammo=="Flame" and not args.native:
            advance("burn")
            assert page.evaluate("trial.crawler.hp===1 && !trial.crawler.dead")
            before = page.evaluate("shots.length")
            touch("crossbow")
            assert page.evaluate("shots.length")==before
            touch("pause")
            paused=page.evaluate("[trial.burnLeft,trial.crawler.hp,scene.player.x]")
            advance("ticks",150)
            assert page.evaluate("[trial.burnLeft,trial.crawler.hp,scene.player.x]")==paused
            frame.locator("#resume-btn").tap()
            advance("playing")
        advance("dead")
        assert page.evaluate("!trial.crawler.contactDone"), (ammo,"contact",page.evaluate("hits"))
        assert page.evaluate("hits.filter(h=>h[0]==='crawler')[0].slice(1,3)") == ([0,2] if ammo=="Standard" else [1,1])
        # Both the silk and the bat must be eligible for the same Flame shot.
        advance("pair",195)
        assert page.evaluate("""()=>trial.bat && !trial.bat.dead && trial.pair.x<
            scene.player.x+scene.width*(1-w.GRIM_CONFIG.reaperXRatio)-25 && cue.textContent==='Aim · Bat'""")
        touch("crossbow")
        assert page.evaluate("shots.at(-1)[0]")== "bat"
        advance("pair",100)
        touch("attack")
        shoot_at("branch",180,"free")
        advance("branch",85)
        touch("slide",hold=True)
        advance("end")
        release()
        data=summary()
        assert data["hp"]==3 and data["kills"]==2 and data["wallet"]==0, data
        assert data["pair"]=="cut" and data["web"]==("cut" if ammo=="Standard" else "burned"),data
        if not args.native:
            assert (data["voices"] == 0) == (ammo=="Flame"), data
        assert data["solid"] and not data["collided"] and len(data["cues"])==4, data
        print("Full course",args.renderer,width,args.seed,ammo,json.dumps(data),flush=True)

    if not args.native:
        # A burning target on the old course must never tick or award a kill on replay.
        start("Flame"); shoot_at("crawler",225,"crawler"); advance("burn"); stop()
        start("Standard")
        assert page.evaluate("scene.encounterTelemetry.kills===0 && trial.crawler===null")
        stop()
        for ammo in ["Standard","Flame"]:
            start(ammo)
            shoot_at("web",630,"free")  # Beyond both phone viewports.
            advance("web",-75)
            assert page.evaluate("trial.web.dealtDamage && !trial.web.destroyed")
            shoot_at("crawler",105,"crawler")
            advance("dead")
            assert page.evaluate("!!trial.crawler.contactDone") == (ammo=="Flame")
            # No action at second web; fire at the solid lip and run into it.
            advance("pair",-80)
            assert page.evaluate("!trial.pair.destroyed && trial.pair.dealtDamage")
            if page.evaluate("trial.done"):  # Earlier collisions may have exhausted HP.
                start(ammo)
                advance("web",100); touch("attack")
                shoot_at("crawler",225,"crawler")
                advance("pair",195); touch("crossbow"); advance("pair",100); touch("attack")
            shoot_at("branch",180,"free"); advance("end")
            assert page.evaluate("trial.branch.dealtDamage && !trial.branch.destroyed")
        start("Flame")
        advance("web",5); touch("crossbow"); advance("web",-90)
        assert page.evaluate("trial.web.dealtDamage && !trial.web.destroyed")
        advance("end")
        assert page.get_by_role("button",name="Replay course").is_visible()
        print("Early/late/missed inputs, repeat Fire, overhang hit, pause and replay passed",flush=True)
    assert page.evaluate("({...localStorage})") == stored
    assert not errors, errors
    print("Matched geometry",geometry,"persistent save unchanged",flush=True)
    browser.close()
