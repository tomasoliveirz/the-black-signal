import { randomInt } from 'node:crypto';
import { LAYOUT, EXTRACT, MAP, MAPS, MAP_ID, MAP_RADIUS, BOXES, captureLayout, activateLayout, setMap, height, inBox } from '../shared/layout.js';
import '../shared/maps/index.js';
import { stepMove, newMove, SPEED, TICK, VOICE_RANGE } from '../shared/sim.js';
import { RULES as R, PHASES } from '../shared/rules.js';
import { eye, obstacle } from '../shared/sight.js';
import * as combat from './combat.mjs';
import { interact, interactionPoint, resolveInteractions } from './interactions.mjs';
import { think } from './bots.mjs';

export function chooseEchoes(players, next = randomInt) {
  const pool = [...players];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = next(i + 1);
    [pool[i],pool[j]]=[pool[j],pool[i]];
  }
  return pool.slice(0,2);
}
const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
export class Game {
  constructor(send = () => {}, options = {}) {
    this.send = send; this.options = options; this.players = new Map(); this.nextId = 1;
    this.layout=captureLayout(); this.time = 0; this.tickN = 0; this.phaseIndex = -1; this.reset();
  }
  reset() {
    this.phase = 'lobby'; this.phaseStartedAt = this.time; this.phaseEndsAt = this.time;
    this.phaseIndex = -1; this.gameStartedAt=null; this.matchT = 0; this.result = null; this.zone = 0; this.tickN = 0;
    this.tx = LAYOUT.tx.map(t=>({...t,p:0,fuse:false,on:false}));
    this.items = LAYOUT.items.map(i=>({...i,available:true}));
    this.blood = LAYOUT.blood.map(b=>({...b,used:false,clue:0}));
    this.flares=[]; this.events=[]; this.metrics={revives:0,drains:0,pickups:0,wallBlocks:0};
    for (const [id,p] of this.players) if (p.bot) this.players.delete(id);
    const used = new Set([...this.players.values()].filter(p=>p.slot<6).map(p=>p.slot));
    for (const p of this.players.values()) {
      if (p.slot>=6) { const free=LAYOUT.spawns.findIndex((_,i)=>!used.has(i)); if(free>=0){p.slot=free;used.add(free);} }
      p.spectator=p.slot>=6; this.initPlayer(p);
    }
  }
  activate(){activateLayout(this.layout);}
  get mapId(){return this.layout.MAP_ID;}
  get running(){return this.phase!=='lobby'&&this.phase!=='end';}
  get phaseT(){return Math.max(0,this.phaseEndsAt-this.time);}
  get unlocked(){return this.zone;}
  get nightIndex(){return PHASES[this.phaseIndex]?.night ?? -1;}
  get night(){return this.nightIndex>=0;}
  get combatOpen(){return this.options.firstDayCombat===true || this.phaseIndex>=2;}
  get extractionOpen(){return this.phase==='final'&&this.time-this.phaseStartedAt>=R.extractWarmup&&this.tx.every(t=>t.on);}
  active(){return [...this.players.values()].filter(p=>!p.spectator);}
  record(kind,data={}){if(this.events.length<2000)this.events.push({kind,t:+this.matchT.toFixed(3),...data});}
  initPlayer(p){
    const sp=LAYOUT.spawns[p.slot%6];
    Object.assign(p,{s:newMove(sp.x,sp.z),inp:{mx:0,mz:0,use:false,target:null},face:Math.PI,st:p.spectator?2:0,
      form:0,hp:100,mhp:0,role:'operative',partner:null,energy:0,ammo:R.ammoStart,med:0,flare:1,cell:0,
      cdFire:0,cdAtk:0,cdEmpty:0,stun:0,protect:0,bleed:0,rv:0,extT:0,nightUsed:-1,
      ready:false,visibilityCache:null,watch:null,footDistance:0,footSample:0,interaction:null,executing:null,windup:0,damageVersion:0,ai:{},connected:p.conn?true:p.connected});
  }
  addPlayer(name,bot=false,conn=null){
    const used=new Set([...this.players.values()].map(p=>p.slot));let slot=0;while(used.has(slot))slot++;
    const p={id:this.nextId++,name:String(name||'Player').replace(/[\u0000-\u001f]/g,'').slice(0,24),bot,conn,slot,spectator:this.running||slot>=6};
    this.initPlayer(p);this.players.set(p.id,p);this.lobby();return p;
  }
  removePlayer(id){
    const p=this.players.get(id);if(!p)return;
    this.dropCell(p);this.players.delete(id);
    if(![...this.players.values()].some(q=>!q.bot))this.reset();
    this.lobby();
  }
  setMap(id){
    if(this.running||!MAPS[id]||id===MAP_ID)return false;
    setMap(id);this.layout=captureLayout();this.reset();this.lobby();return true;
  }
  lobby(){
    this.broadcast({t:'lobby',version:'0.5.0',map:MAP_ID,phase:this.phase,host:this.roomInfo?.host,canStart:this.canStart(),players:[...this.players.values()].map(p=>({
      id:p.id,name:p.name,bot:p.bot,slot:p.slot,spectator:p.spectator,connected:p.connected!==false,ready:p.ready===true
    }))});
  }
  observer(p) {
    if (!p.spectator && p.st < 2) return p;
    const chosen=this.players.get(p.watch);
    return chosen && !chosen.spectator && chosen.st<2 ? chosen : this.active().find(q=>q.st<2) ?? null;
  }
  observationOrigin(p) {
    const origin=eye(p.s,p.inp.crouch),camera=p.inp.camera;
    if(Array.isArray(camera)&&camera.length===3&&camera.every(Number.isFinite)) {
      const proposed={x:camera[0],y:camera[1],z:camera[2]};
      if(Math.hypot(proposed.x-origin.x,proposed.y-origin.y,proposed.z-origin.z)<=10&&obstacle(origin,proposed,false)>.995)return proposed;
    }
    return origin;
  }
  canObservePoint(viewer,point,key) {
    const night=Math.max(Number(this.night),MAP.theme.minNight??0),indoor=MAP.kind==='factory'||MAP.kind==='mesh';
    const range=(MAP.theme.fog?.[1]??150)*(1-night*(indoor?.27:.37));
    if(!viewer||distance(viewer.s,point)>range)return false;
    const origin=this.observationOrigin(viewer);
    if(key===undefined)return obstacle(origin,point,true,true)>.995;
    const stamp=`${MAP_ID}:${origin.x}:${origin.y}:${origin.z}`;
    if(viewer.visibilityCache?.stamp!==stamp)viewer.visibilityCache={stamp,points:new Map()};
    const cache=viewer.visibilityCache.points,old=cache.get(key);
    if(old&&old.x===point.x&&old.y===point.y&&old.z===point.z)return old.visible;
    const visible=obstacle(origin,point,true,true)>.995;
    if(cache.size>=128)cache.delete(cache.keys().next().value);
    cache.set(key,{...point,visible});return visible;
  }
  canObserve(viewer,target) {
    if(!viewer)return false;
    if(viewer===target)return true;
    const top=target.form?2.1:target.st===1?.5:target.inp.crouch?1.15:1.65;
    for(const [dx,dz,y] of [[0,0,top],[0,0,top*.55],[-.3,0,top*.6],[.3,0,top*.6],[0,-.3,top*.6],[0,.3,top*.6]]) {
      if(this.canObservePoint(viewer,{x:target.s.x+dx,y:target.s.y+y,z:target.s.z+dz}))return true;
    }
    return false;
  }
  soundPoint(point) {return {x:Math.round(point.x/4)*4,y:Math.round((point.y??0)/2)*2,z:Math.round(point.z/4)*4};}
  broadcast(msg){
    const cue={shot:'shot',claw:'growl-2',transform:'growl-1',revert:'growl-3'}[msg.k];
    const actor=cue?this.players.get(msg.id):null;
    for(const p of this.players.values())if(!p.bot) {
      const observer=this.observer(p);
      if(!actor||actor===p||this.canObserve(observer,actor))this.send(p,msg);
      else if(observer&&distance(observer.s,actor.s)<(msg.k==='shot'?50:24))this.send(p,{t:'ev',k:'sound',sound:cue,...this.soundPoint({...actor.s,y:actor.s.y+1})});
    }
  }
  canStart(){
    const humans=[...this.players.values()].filter(p=>!p.bot&&p.slot<6);
    return humans.length>0&&humans.every(p=>p.connected!==false&&p.ready===true);
  }
  start(){
    if(this.running)return;
    this.reset();let n=0;
    while(this.players.size<6)this.addPlayer(['BOT Ada','BOT Bram','BOT Cleo','BOT Dov','BOT Esme','BOT Finn'][n++],true);
    const list=this.active(),echoes=chooseEchoes(list);
    for(const p of echoes){p.role='echo';p.partner=echoes.find(q=>q!==p).id;}
    this.enterPhase(0);
    this.lobby();
    for(const p of list)if(!p.bot)this.send(p,{t:'role',role:p.role,partner:p.partner});
    this.snapshot();
  }
  enterPhase(index,at=this.time){
    const phase=PHASES[index];this.phaseIndex=index;this.phase=phase.id;
    this.phaseStartedAt=at;this.phaseEndsAt=at+phase.duration;
    this.zone=phase.zone;
    for(const p of this.active()){
      p.interaction=null;p.executing=null;p.windup=0;
      if(p.form)combat.revert(this,p,false);
      if(phase.night>=0)p.mhp=R.monsterHp;
    }
    this.record('phase',{phase:this.phase});
    this.broadcast({t:'ev',k:'phase',phase:this.phase,zone:this.zone});
  }
  finish(winner,reason='time'){
    if(this.result)return;
    this.result=winner;this.phase='end';this.phaseStartedAt=this.time;this.phaseEndsAt=this.time+R.resultsTime;
    this.record('result',{winner,reason});
    this.lastMatch={map:MAP_ID,winner,reason,duration:this.matchT,...this.metrics,events:[...this.events]};
    this.snapshot();
    this.broadcast({t:'ev',k:'end',winner,reason,roles:this.active().map(p=>({id:p.id,name:p.name,role:p.role,st:p.st}))});
  }
  visible(a,b){return obstacle(a,b,false)>.995;}
  canReach(p,point,range=R.useRange){return distance(p.s,point)<=range&&Math.abs(p.s.y-point.y)<2.4&&this.visible(eye(p.s,p.inp.crouch),point);}
  interactionPoint(p,target){return interactionPoint(this,p,target);}
  interact(p,target,dt){interact(this,p,target,dt,new Map(),new Set());}
  act(p,m){combat.act(this,p,m);}
  hurt(q,n,p){combat.hurt(this,q,n,p);}
  kill(p){combat.kill(this,p);}
  fire(p,d){combat.fire(this,p,d);}
  attack(p){combat.claw(this,p);}
  revert(p,force){combat.revert(this,p,force);}
  think(p,dt){think(this,p,dt);}
  dropCell(p){
    if(!p.cell)return;
    let point={x:p.s.x,z:p.s.z,y:height(p.s.x,p.s.z)};
    if(inBox(point.x,point.z,.65)||distance(point,{x:0,z:0})>MAP_RADIUS-1)point=LAYOUT.recovery[this.zone];
    const old=this.items.find(i=>i.dropped&&!i.available);
    if(old)Object.assign(old,point,{zone:this.zone,available:true});
    else this.items.push({...point,zone:this.zone,id:this.items.length,type:'cell',available:true,dropped:true});
    p.cell=0;this.record('drop',{id:p.id});
  }
  footstep(p,distanceMoved,dt,grounded,mode){
    if(mode==='frozen'||p.st!==0||(!p.form&&p.inp.crouch)||!p.s.grounded){p.footDistance=0;return;}
    const speed=distanceMoved/dt;
    if(grounded&&speed<.55){p.footDistance=0;return;}
    const gait=!grounded?3:p.form?2:speed>(SPEED.sprint+SPEED.walk)/2?1:0,stride=[1.35,1.68,1.85,0][gait];
    p.footDistance+=distanceMoved;if(p.footDistance<stride)return;p.footDistance=Math.max(0,p.footDistance-stride);
    const {x,y,z}=p.s,event={t:'ev',k:'step',id:p.id,x,y,z,gait,sample:p.footSample++%3};
    for(const q of this.players.values())if(!q.bot) {
      const observer=this.observer(q);
      if(!observer||distance(observer.s,p.s)>=32)continue;
      this.send(q,q===p||this.canObserve(observer,p)?event:{...event,id:0,...this.soundPoint(p.s)});
    }
  }
  tick(dt=TICK){
    this.time+=dt;this.tickN++;
    if(this.phase==='lobby')return;
    if(this.phase==='end'){if(this.time+1e-7>=this.phaseEndsAt){this.reset();this.lobby();}return;}
    this.matchT=Math.max(0,this.time-(this.gameStartedAt??this.time));
    if(this.phase==='prep'&&this.time+1e-7>=this.phaseEndsAt)this.gameStartedAt=this.phaseEndsAt;
    while(this.phaseIndex<PHASES.length-1&&this.time+1e-7>=this.phaseEndsAt)this.enterPhase(this.phaseIndex+1,this.phaseEndsAt);
    this.matchT=this.gameStartedAt===null?0:Math.max(0,this.time-this.gameStartedAt);
    const repairs=new Map(),revives=new Set();
    for(const b of this.blood)b.clue=Math.max(0,b.clue-dt);
    for(const p of this.active()){
      for(const key of ['cdFire','cdAtk','cdEmpty','stun','protect'])p[key]=Math.max(0,p[key]-dt);
      if(p.st>=2)continue;
      if(p.bot)this.think(p,dt);
      if(p.st===1){p.bleed-=dt;if(p.bleed<=0)this.kill(p);}
      if(p.st>=2)continue;
      if(this.phase==='prep')continue;
      const frozen=p.stun>0||p.executing!==null;
      const mode=frozen?'frozen':p.st===1?'downed':p.form?'monster':'human';
      const x=p.s.x,z=p.s.z,grounded=p.s.grounded;
      const slow=p.form&&this.flares.some(f=>distance(f,p.s)<R.flareRadius)? .5:1;
      stepMove(p.s,p.inp,dt,mode,slow);
      this.footstep(p,Math.hypot(p.s.x-x,p.s.z-z),dt,grounded,mode);
      if(Number.isFinite(p.inp.aim))p.face=p.inp.aim;
      else if(Math.hypot(p.s.vx,p.s.vz)>.4)p.face=Math.atan2(p.s.vx,p.s.vz);
      if(p.role==='echo'){
        if(p.form){p.energy=Math.max(0,p.energy-R.energyDrain*dt);if(!p.energy)combat.revert(this,p,false);}
        else if(!this.night&&p.st===0)p.energy=Math.min(100,p.energy+R.passiveEnergy*dt);
      }
      if(p.windup>0){p.windup-=dt;if(p.windup<=0)combat.resolveClaw(this,p);}
      if(p.inp.use&&p.st===0&&p.stun<=0)interact(this,p,p.inp.target,dt,repairs,revives);
      else {p.interaction=null;p.executing=null;}
      if(this.extractionOpen&&p.role==='operative'&&p.st===0&&distance(p.s,EXTRACT)<EXTRACT.r){
        p.extT+=dt;if(p.extT+1e-7>=R.extractTime){p.st=3;this.dropCell(p);this.record('escape',{id:p.id});this.broadcast({t:'ev',k:'escaped',id:p.id});}
      }else p.extT=0;
    }
    resolveInteractions(this,repairs,revives,dt);
    this.flares=this.flares.filter(f=>(f.t-=dt)>0);
    if(this.combatOpen){
      const ops=this.active().filter(p=>p.role==='operative'),echoes=this.active().filter(p=>p.role==='echo');
      if(ops.some(p=>p.st===3))return this.finish('operatives','escape');
      if(echoes.length===2&&echoes.every(p=>p.st===2))return this.finish('operatives','echoes_eliminated');
      if(ops.length&&!ops.some(p=>p.st<2))return this.finish('echoes','operatives_eliminated');
    }
    if(this.phase==='final'&&this.time+1e-7>=this.phaseEndsAt)return this.finish('echoes','timeout');
    if(this.tickN%2===0)this.snapshot();
  }
  chat(p,text,ch){
    text=String(text??'').replace(/[\u0000-\u001f]/g,'').slice(0,280).trim();if(!text)return;
    for(const q of this.players.values()){
      if(q.bot)continue;
      const dead=p.spectator||p.st>=2,otherDead=q.spectator||q.st>=2;
      const ok=!this.running||ch==='room'&&!this.running||
        (ch==='echo'?p.role==='echo'&&q.role==='echo'&&!dead&&!otherDead:dead?otherDead:!otherDead&&distance(p.s,q.s)<VOICE_RANGE);
      if(ok)this.send(q,{t:'ev',k:'chat',id:p.id,name:p.name,text,ch:!this.running?'room':dead?'dead':ch==='echo'?'echo':'prox'});
    }
  }
  snapshot(){
    const round=n=>Math.round(n*100)/100;
    const publicState={
      t:'snap',version:'0.5.0',phase:this.phase,pt:Math.max(0,Math.ceil(this.phaseT)),zone:this.zone,unlocked:this.zone,
      elapsed:round(this.matchT),combatOpen:this.combatOpen,night:Number(this.night),nightIndex:this.nightIndex,
      extractionOpen:this.extractionOpen,warmup:this.phase==='final'?Math.max(0,Math.ceil(R.extractWarmup-(this.time-this.phaseStartedAt))):R.extractWarmup,
      players:this.active().map(p=>({id:p.id,x:round(p.s.x),y:round(p.s.y),z:round(p.s.z),f:p.face,st:p.st,form:p.form,cr:Number(p.inp.crouch),rv:round(p.rv),ex:p.executing!==null?1:0})),
      tx:this.tx.map(t=>({fuse:Number(t.fuse),on:Number(t.on),p:round(t.p)})),
      items:this.items.slice(0,LAYOUT.items.length).map(i=>i.available?'1':'0').join(''),
      extraDrops:this.items.filter(i=>i.dropped&&i.available).map(({id,type,x,y,z,zone})=>({id,type,x,y,z,zone})),
      blood:this.blood.map(b=>Math.ceil(b.clue)),
      flares:this.flares.map(f=>[round(f.x),round(f.z)])
    };
    for(const p of this.players.values())if(!p.bot){
      const observer=this.observer(p);
      const visible=new Set(this.active().filter(q=>q===p||this.canObserve(observer,q)).map(q=>q.id));
      const pointVisible=(point,key)=>this.canObservePoint(observer,{...point,y:point.y+.9},key);
      this.send(p,{...publicState,
        players:publicState.players.filter(q=>visible.has(q.id)),
        watching:p.spectator||p.st>=2?observer?.id??null:null,
        extraDrops:publicState.extraDrops.filter(p=>pointVisible(p,'drop:'+p.id)),
        items:this.items.slice(0,LAYOUT.items.length).map(i=>pointVisible(i,'item:'+i.id)?i.available?'1':'0':'?').join(''),
        blood:this.blood.map(b=>pointVisible(b,'blood:'+b.id)?Math.ceil(b.clue):0),
        you:p.spectator?null:{
        x:p.s.x,y:p.s.y,z:p.s.z,vy:p.s.vy,stam:round(p.s.stam),hp:Math.ceil(p.form?p.mhp:p.hp),ammo:p.ammo,med:p.med,flare:p.flare,cell:p.cell,
        energy:p.role==='echo'?round(p.energy):undefined,nightUsed:p.role==='echo'?p.nightUsed:undefined,
        stun:Number(p.stun>0),protect:round(p.protect),bleed:Math.ceil(p.bleed),ext:round(p.extT/R.extractTime),
        action:p.interaction?{...p.inp.target,progress:round(p.interaction.progress)}:null,
        bloodUsed:p.role==='echo'?this.blood.map(b=>pointVisible(b,'blood:'+b.id)?Number(b.used):'?').join(''):undefined
      }});
    }
  }
}
