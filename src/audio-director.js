const levels={day:[0,1],preblackout:[.035,.85],blackout:[.075,.82],nearby:[.11,.94],chase:[.18,1.15],postchase:[.05,.86],extraction:[.12,1.04],prep:[0,1],result:[0,1]};
export function createAudioDirector(){
  let previous=new Map(),hold=0,recovery=0,pressure=0,mode='day';
  function reset(){previous.clear();hold=recovery=pressure=0;mode='day'}
  function event(message){if(message.k==='hurt'||message.k==='claw')pressure=1}
  function update(dt,{state,focus,me,night=false}){
    const phase=state?.phase??(night?'night':'day'),dark=Boolean(state?.night??night),observed=state?.watching??me?.id;
    hold=Math.max(0,hold-dt);recovery=Math.max(0,recovery-dt);pressure=Math.max(0,pressure-dt);
    let nearest=Infinity,trigger=false;const current=new Map();
    for(const player of state?.players??[]){
      if(!player.form||player.st>=2||player.id===observed)continue;
      const dx=focus.x-player.x,dz=focus.z-player.z,distance=Math.hypot(dx,dz),old=previous.get(player.id);
      current.set(player.id,{x:player.x,z:player.z,distance});nearest=Math.min(nearest,distance);
      const speed=old?Math.hypot(player.x-old.x,player.z-old.z)/Math.max(.01,dt):0;
      const closing=old?(old.distance-distance)/Math.max(.01,dt):0;
      const facing=distance>0?(Math.sin(player.f)*dx+Math.cos(player.f)*dz)/distance:1;
      if(distance<12&&((speed>2&&closing>.5&&facing>.4)||pressure>0))trigger=true;
    }
    previous=current;
    if(dark&&trigger){hold=2.5;recovery=8}
    if(phase==='lobby'||phase==='end'){mode='result';hold=recovery=0}
    else if(phase==='prep'){mode='prep';hold=recovery=0}
    else if(dark&&nearest<14&&hold>0)mode='chase';
    else if(dark&&nearest<20)mode='nearby';
    else if(dark&&recovery>0)mode='postchase';
    else if(state?.extractionOpen)mode='extraction';
    else if(dark)mode='blackout';
    else {hold=recovery=0;mode=state&&phase.startsWith('day')&&state.pt<=30?'preblackout':'day'}
    const [volume,rate]=levels[mode];return {mode,volume,rate};
  }
  return {update,event,reset,get state(){return mode}};
}
