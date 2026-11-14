import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Game } from './game.mjs';
import { setMap } from '../shared/layout.js';

const secret = () => randomBytes(24).toString('base64url');
export class Rooms {
  constructor(send) {
    this.rooms = new Map(); this.send = send;
    this.make('PUBLIC',false,'Amberwood public');
  }
  make(code,privateRoom,title='Room') {
    if(this.rooms.size>=20)throw Error('Limite de salas atingido. Tenta uma sala pública.');
    setMap('amberwood');
    const room={code,private:privateRoom,title,game:new Game(this.send),host:0,touched:Date.now()};
    room.game.roomInfo=room;this.rooms.set(code,room);return room;
  }
  list() {
    return [...this.rooms.values()].filter(r=>!r.private).map(r=>({
      code:r.code,name:r.title,players:[...r.game.players.values()].filter(p=>!p.bot&&p.connected!==false).length,
      map:r.game.mapId,running:r.game.running,
    }));
  }
  join(socket,message,user){
    let room;
    if(message.create) {
      const code=randomBytes(5).toString('hex').toUpperCase();
      room=this.make(code,Boolean(message.private),String(message.title||(message.private?'Private room':'Public room')).replace(/[\u0000-\u001f]/g,'').slice(0,40));
    } else room=this.rooms.get(String(message.room||'PUBLIC').toUpperCase());
    if(!room)throw Error('Sala inexistente. Confirma o código.');
    room.game.activate();
    const humans=[...room.game.players.values()].filter(p=>!p.bot);
    let player=null;
    if(typeof message.resume==='string'&&message.resume.length<90) {
      player=humans.find(p=>p.resume && p.resume.length===message.resume.length&&timingSafeEqual(Buffer.from(p.resume),Buffer.from(message.resume))&&p.accountId===(user?.id??null));
      if(player?.connected)player=null;
    }
    if(!player) {
      if(humans.length>=10)throw Error('Sala cheia.');
      if(user&&humans.some(p=>p.accountId===user.id))throw Error('Esta conta já está na sala.');
      player=room.game.addPlayer(user?.username||('Guest '+String(message.name||'Player').slice(0,14)),false,socket);
      player.resume=secret();player.accountId=user?.id??null;
    }
    player.conn=socket;player.connected=true;player.disconnectAt=0;
    if(!room.host||!room.game.players.has(room.host))room.host=player.id;
    room.touched=Date.now();
    this.send(player,{t:'welcome',version:'0.5.0',map:room.game.mapId,id:player.id,slot:player.slot,spectator:player.spectator,
      room:room.code,private:room.private,host:room.host,resume:player.resume});
    room.game.lobby();
    if(room.game.running){
      this.send(player,{t:'role',role:player.role,partner:player.partner});
      room.game.snapshot();
    }
    return {room,player};
  }
  leave(room,p) {
    room.game.activate();room.game.removePlayer(p.id);
    if(room.host===p.id)room.host=[...room.game.players.values()].find(q=>!q.bot&&q.connected)?.id??0;
    room.game.lobby();
  }
  disconnect(room,p){
    if(!room||!p)return;
    p.connected=false;p.conn=null;p.disconnectAt=Date.now();
    p.inp={mx:0,mz:0,use:false,target:null};p.interaction=null;p.executing=null;
    const next=[...room.game.players.values()].find(q=>!q.bot&&q.connected);
    if(room.host===p.id&&next)room.host=next.id;
    room.game.lobby();
  }
  tick(dt){
    const now=Date.now();
    for(const [code,room] of this.rooms){
      room.game.activate();
      for(const p of room.game.players.values())if(!p.bot&&!p.connected&&now-p.disconnectAt>45000) {
        if(room.game.running) { room.game.kill(p); p.spectator=true; }
        room.game.removePlayer(p.id);
      }
      room.game.tick(dt);
      if(code!=='PUBLIC'&&![...room.game.players.values()].some(p=>!p.bot)&&now-room.touched>60000)this.rooms.delete(code);
    }
  }
}
