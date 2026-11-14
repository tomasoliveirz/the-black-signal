import test from 'node:test';import assert from 'node:assert/strict';import {Rooms} from './rooms.mjs';
const socket={readyState:1},first='a'.repeat(64),other='b'.repeat(64);
test('a guest reload restores the same player through its protected browser identity',()=>{
 const rooms=new Rooms(()=>{}),member=rooms.join(socket,{create:true,private:true,name:'Reload'},null,first);rooms.disconnect(member.room,member.player);
 const resumed=rooms.join(socket,{room:member.room.code,player:member.player.id},null,first);assert.equal(resumed.player.id,member.player.id);assert.equal(member.room.game.players.size,1);
});
test('knowing a room and player id does not let another guest resume that player',()=>{
 const rooms=new Rooms(()=>{}),member=rooms.join(socket,{create:true,private:true,name:'Reload'},null,first);rooms.disconnect(member.room,member.player);
 assert.throws(()=>rooms.join(socket,{room:member.room.code,player:member.player.id},null,other));
});
test('an active connection cannot be displaced by a reload admission request',()=>{
 const rooms=new Rooms(()=>{}),member=rooms.join(socket,{create:true,private:true,name:'Reload'},null,first);
 assert.throws(()=>rooms.join(socket,{room:member.room.code,player:member.player.id},null,first));
});
test('authenticated recovery requires the same account and does not send a bearer token',()=>{
 const messages=[],rooms=new Rooms((p,m)=>messages.push(m)),member=rooms.join(socket,{create:true,private:true},{id:7,username:'Owner'},first);rooms.disconnect(member.room,member.player);
 assert.throws(()=>rooms.join(socket,{room:member.room.code,player:member.player.id},{id:8,username:'Other'},first));
 const resumed=rooms.join(socket,{room:member.room.code,player:member.player.id},{id:7,username:'Owner'},other);assert.equal(resumed.player.id,member.player.id);assert.ok(messages.filter(m=>m.t==='welcome').every(m=>!('resume'in m)));
});
