import test from 'node:test';import assert from 'node:assert/strict';import {Game} from './game.mjs';
function fixture(){const game=new Game(()=>{}),a=game.addPlayer('A',false,{readyState:1}),b=game.addPlayer('B',false,{readyState:1});return {game,a,b}}
test('each seated human must explicitly ready; bots do not need consent',()=>{
 const {game,a,b}=fixture();game.addPlayer('BOT',true);assert.equal(game.canStart(),false);a.ready=true;assert.equal(game.canStart(),false);b.ready=true;assert.equal(game.canStart(),true);b.connected=false;assert.equal(game.canStart(),false);
});
test('map/reset clears readiness and spectators cannot block seated players',()=>{
 const {game,a,b}=fixture();a.ready=b.ready=true;for(let i=0;i<5;i++)game.addPlayer('Spectator '+i,false,{readyState:1});
 for(const p of game.players.values())if(p.slot<6)p.ready=true;assert.equal(game.canStart(),true);game.setMap('foundry');assert.equal(game.canStart(),false);assert.ok([...game.players.values()].every(p=>p.ready===false));
});
