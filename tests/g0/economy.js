() => {
 const s=S,result=[];
 start(33,{souls:18});s.goToMenu();s.openReliquary();s.purchaseMeta('deathDenied');s.closeReliquary();s.startRun();
 const record=event=>result.push({event,state:s.state,bank:GRIM_META.load().souls,rank:s.meta.levels.deathDenied,runSouls:s.runSoulsAvailable,gold:s.coinCount,hp:s.player.hp,free:s.freeLifeUsed,paid:s.reviveUsed,powers:{...s.powerManager.levels}});
 record('Buy Death Denied at 15 from a seeded wallet of 18');
 const soul=s.souls[0],p=s.player;p.x=soul.x;p.y=soul.baseY+soul.offset+43;
 s.checkCollectibles();s.checkCollectibles();record('Collect first placed Soul twice at its actual location');
 s.coinCount=20;s.triggerVendor(1);s.finishVendorIntro();
 const offer=s.pendingOffers.find(o=>o.id!=='vitalEssence')||s.pendingOffers[0];
 record('Open Angel with 20 fixture Gold');s.chooseUpgrade(offer.id);record('Buy '+offer.id);s.leaveVendor();
 function fatal(){s.takeDamage(p.hp,'rock');for(let i=0;i<10;i++)s.update(0,250);}
 function resume(){for(let i=0;i<20;i++)s.update(0,250);}
 fatal();record('First fatal hit');resume();fatal();record('Second fatal hit');s.revive();record('Pay 3');resume();fatal();record('Third fatal hit');s.startRun();record('Start next run');
 return result;
}
