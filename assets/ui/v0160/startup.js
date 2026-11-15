/* Phaser 3.90.0, kept at a stable same-origin URL for repeat visits. */
(function(scope){
  'use strict';
  const engine='assets/vendor/phaser-3.90.0/phaser.min.js';
  const error=document.getElementById('error');
  const retry=document.getElementById('engine-retry-btn');
  let pending=false,attempt=0;

  function start(launch){
    function failed(){
      pending=false;
      document.getElementById('error-message').textContent=
        'The game engine could not load. Check your connection and try again.';
      error.classList.remove('hidden');
      retry.disabled=false;
      retry.focus({preventScroll:true});
    }
    function load(){
      if(pending||scope.grimRun)return;
      if(scope.Phaser?.VERSION==='3.90.0'){
        launch(scope.Phaser);
        return;
      }
      pending=true;
      retry.disabled=true;
      error.classList.add('hidden');
      const script=document.createElement('script');
      script.src=attempt===0?engine:engine+'?retry='+attempt;
      attempt++;
      script.onload=()=>{
        if(scope.Phaser?.VERSION!=='3.90.0'){failed();return;}
        pending=false;
        launch(scope.Phaser);
      };
      script.onerror=()=>{script.remove();failed();};
      document.head.appendChild(script);
    }
    retry.addEventListener('click',load);
    load();
  }
  scope.GRIM_STARTUP={start};
})(window);
