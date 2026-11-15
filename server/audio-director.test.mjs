import test from 'node:test';import assert from 'node:assert/strict';import {createAudioDirector} from '../src/audio-director.js';
const focus={x:0,y:0,z:0},me={id:1};
function input(phase='day1',players=[],extra={}){return {focus,me,state:{phase,pt:200,night:Number(phase.startsWith('night')||phase==='final'),players,...extra}}}
test('day, final-day warning, blackout and extraction follow the authoritative snapshot',()=>{
 const director=createAudioDirector();assert.equal(director.update(.1,input()).mode,'day');assert.equal(director.update(.1,input('day1',[],{pt:30})).mode,'preblackout');assert.equal(director.update(.1,input('night1')).mode,'blackout');assert.equal(director.update(.1,input('final',[],{extractionOpen:true})).mode,'extraction');assert.equal(director.update(.1,input('end')).volume,0);
});
test('a stationary nearby monster is not a chase; visible closing movement can trigger one',()=>{
 const director=createAudioDirector(),monster={id:2,x:0,y:0,z:10,f:Math.PI,form:1,st:0};assert.equal(director.update(.1,input('night1',[monster])).mode,'nearby');assert.equal(director.update(.1,input('night1',[monster])).mode,'nearby');assert.equal(director.update(.1,input('night1',[{...monster,z:9}])).mode,'chase');
});
test('occlusion removes tracking immediately and only a bounded post-chase release remains',()=>{
 const director=createAudioDirector(),monster={id:2,x:0,y:0,z:10,f:Math.PI,form:1,st:0};director.update(.1,input('night1',[monster]));director.update(.1,input('night1',[{...monster,z:9}]));assert.equal(director.update(.1,input('night1')).mode,'postchase');assert.equal(director.update(9,input('night1')).mode,'blackout');director.event({k:'claw'});assert.equal(director.update(.1,input('night1')).mode,'blackout','An anonymous hidden sound must not create a tracked threat');
});
test('self/spectated monster, ordinary humans and dead bodies never masquerade as nearby threats',()=>{
 const director=createAudioDirector(),self={id:1,x:0,y:0,z:0,f:0,form:1,st:0};assert.equal(director.update(.1,input('night1',[self,{...self,id:2,form:0},{...self,id:3,st:2}])).mode,'blackout');assert.equal(director.update(.1,input('night1',[{...self,id:4}],{watching:4})).mode,'blackout');director.reset();assert.equal(director.state,'day');
});
