import test from 'node:test';import assert from 'node:assert/strict';
import {Game} from './game.mjs';import {captureLayout,activateLayout} from '../shared/layout.js';
function fixture(run){
 const saved=captureLayout(),messages=[];
 try{
  activateLayout({...saved,MAP:{...saved.MAP,kind:'factory',amp:0},MAP_RADIUS:30,BOXES:[{x:0,z:0,w:.4,d:8,h:4,gy:0}],LAYOUT:{...saved.LAYOUT,colliders:[],tx:[],items:[],blood:[]}});
  const game=new Game((p,m)=>messages.push({id:p.id,message:m}));
  const viewer=game.addPlayer('Viewer'),hidden=game.addPlayer('Hidden'),friend=game.addPlayer('Friend');
  for(const [p,x,z] of [[viewer,-3,0],[hidden,3,0],[friend,-4,2]])Object.assign(p.s,{x,y:0,z,grounded:true});
  game.phase='day1';game.phaseIndex=1;messages.length=0;
  const snap=p=>messages.findLast(m=>m.id===p.id&&m.message.t==='snap')?.message;
  run({game,viewer,hidden,friend,messages,snap});
 }finally{activateLayout(saved)}
}
test('living clients receive visible entities and their own state, not a hidden position',()=>fixture(({game,viewer,hidden,friend,snap})=>{
 game.snapshot();assert.ok(snap(viewer).players.some(p=>p.id===viewer.id));assert.ok(snap(viewer).players.some(p=>p.id===friend.id));assert.ok(!snap(viewer).players.some(p=>p.id===hidden.id));
}));
test('reveal and occlusion update immediately without retaining hidden tracking',()=>fixture(({game,viewer,hidden,snap})=>{
 hidden.s.x=-2;game.snapshot();assert.ok(snap(viewer).players.some(p=>p.id===hidden.id));hidden.s.x=3;game.snapshot();assert.ok(!snap(viewer).players.some(p=>p.id===hidden.id));
}));
test('forged camera origins across cover or outside its range cannot reveal a player',()=>fixture(({game,viewer,hidden,snap})=>{
 for(const camera of [[3,1.5,0],[1000,2,0],[NaN,1,0]]){viewer.inp.camera=camera;game.snapshot();assert.ok(!snap(viewer).players.some(p=>p.id===hidden.id));}
}));
test('hidden shots and transformation events do not expose actor identity or exact position',()=>fixture(({game,viewer,hidden,messages})=>{
 game.broadcast({t:'ev',k:'shot',id:hidden.id,a:[3,1.5,0],b:[-10,1.5,0]});game.broadcast({t:'ev',k:'transform',id:hidden.id});
 const own=messages.filter(m=>m.id===viewer.id).map(m=>m.message);
 assert.ok(!own.some(m=>m.k==='shot'||m.k==='transform'));assert.ok(own.some(m=>m.k==='sound'));assert.ok(own.every(m=>m.id!==hidden.id));
}));
test('occluded footsteps are coarse hearing cues rather than exact hidden tracking',()=>fixture(({game,viewer,hidden,messages})=>{
 game.footstep(hidden,2,1/30,true,'human');const own=messages.filter(m=>m.id===viewer.id).map(m=>m.message);assert.ok(own.length);assert.ok(own.every(m=>m.id!==hidden.id&&m.x!==hidden.s.x));
}));
test('spectators follow one authorised viewpoint rather than receiving the whole map',()=>fixture(({game,viewer,hidden,friend,snap})=>{
 viewer.spectator=true;viewer.st=2;viewer.watch=friend.id;game.snapshot();assert.ok(!snap(viewer).players.some(p=>p.id===hidden.id));assert.ok(snap(viewer).players.some(p=>p.id===friend.id));
}));
test('dropped cells behind cover are absent from recipient-specific world state',()=>fixture(({game,viewer,snap})=>{
 game.items.push({id:0,type:'cell',x:3,y:0,z:0,zone:0,dropped:true,available:true});game.snapshot();assert.equal(snap(viewer).extraDrops.length,0);
}));

test('static interest cache invalidates when the authorised observer moves',()=>fixture(({game,viewer,snap})=>{
 game.items.push({id:0,type:'cell',x:3,y:0,z:0,zone:0,dropped:true,available:true});game.snapshot();assert.equal(snap(viewer).extraDrops.length,0);
 viewer.s.x=4;game.snapshot();assert.equal(snap(viewer).extraDrops.length,1);
}));
