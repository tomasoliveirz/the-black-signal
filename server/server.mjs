import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {WebSocketServer} from 'ws';
import {Rooms} from './rooms.mjs';
import {createAuth} from './auth.mjs';
import {TICK,VOICE_RANGE,VOICE_SAMPLES} from '../shared/sim.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const PORT=Number(process.env.PORT)||5173, HOST=process.env.HOST||'127.0.0.1';
const BASE=(process.env.BASE_PATH||'').replace(/\/$/,'');
if(BASE&&!/^\/[a-zA-Z0-9_/-]+$/.test(BASE))throw Error('Invalid BASE_PATH');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css',
  '.json':'application/json','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.bin':'application/octet-stream',
  '.png':'image/png','.jpg':'image/jpeg','.ogg':'audio/ogg','.md':'text/plain; charset=utf-8'};
const PUBLIC=new Set(['index.html','src','shared','assets']);
const auth=createAuth({basePath:BASE||'/'});
const send=(p,message)=>{
  if(p.conn?.readyState!==1)return;
  if(p.conn.bufferedAmount>512000){p.conn.close(1013,'Conexão lenta');return;}
  if(message.t==='snap'&&p.conn.bufferedAmount>64000)return;
  p.conn.send(JSON.stringify(message));
};
const rooms=new Rooms(send);
const json=(res,status,value)=>res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}).end(JSON.stringify(value));
const originOK=req=>{
  const proto=process.env.TRUST_PROXY==='1'&&req.headers['x-forwarded-proto']==='https'?'https':'http';
  return req.headers.origin===`${proto}://${req.headers.host}`;
};
const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('Permissions-Policy','camera=(), microphone=(self), geolocation=()');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://cdn.jsdelivr.net; media-src 'self' blob:; worker-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  try {
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(BASE&&pathname===BASE){res.writeHead(308,{location:BASE+'/'}).end();return;}
    if(BASE&&!pathname.startsWith(BASE+'/')){res.writeHead(404).end();return;}
    const route=pathname.slice(BASE.length);
    if(await auth.handle(req,res,route))return;
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405).end();return;}
    if(route==='/api/rooms')return json(res,200,{rooms:rooms.list()});
    if(route==='/api/health')return json(res,200,{ok:true,version:'0.5.0'});
    let relative;
    try{relative=decodeURIComponent(route).replace(/^\/+/, '')||'index.html';}catch{res.writeHead(400).end();return;}
    if(relative.includes('\0')||!PUBLIC.has(relative.split('/')[0])){res.writeHead(404).end();return;}
    const file=path.resolve(ROOT,relative);
    if(!file.startsWith(ROOT+path.sep)){res.writeHead(404).end();return;}
    const real=await fs.realpath(file);
    if(!real.startsWith(ROOT+path.sep)){res.writeHead(404).end();return;}
    const stat=await fs.stat(real);
    if(!stat.isFile()){res.writeHead(404).end();return;}
    res.writeHead(200,{'content-type':MIME[path.extname(file)]||'application/octet-stream','cache-control':'no-cache','content-length':stat.size});
    if(req.method==='HEAD')res.end();else res.end(await fs.readFile(real));
  }catch(error){
    if(!res.headersSent)res.writeHead(error.code==='ENOENT'?404:500);
    res.end();
  }
});
const wss=new WebSocketServer({noServer:true,maxPayload:8192,perMessageDeflate:false});
const connections=new Map();
server.on('upgrade',(req,socket,head)=>{
  const route=new URL(req.url,'http://localhost').pathname;
  if(![BASE+'/',BASE+'/ws'].includes(route)||!originOK(req)||wss.clients.size>=120){
    socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');socket.destroy();return;
  }
  const ip=process.env.TRUST_PROXY==='1'?String(req.headers['x-real-ip']||req.socket.remoteAddress):req.socket.remoteAddress;
  if((connections.get(ip)||0)>=12){socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');socket.destroy();return;}
  wss.handleUpgrade(req,socket,head,ws=>{
    connections.set(ip,(connections.get(ip)||0)+1);
    ws.once('close',()=>{const n=(connections.get(ip)||1)-1;n?connections.set(ip,n):connections.delete(ip);});
    wss.emit('connection',ws,req);
  });
});
const number=n=>Number.isFinite(n)?Math.max(-1,Math.min(1,n)):0;
wss.on('connection',(ws,req)=>{
  let membership=null,budget=90,updated=performance.now(),voiceBudget=6,voiceAt=updated,chatAt=-1000,lastAuthAt=0;
  ws.alive=true;ws.on('pong',()=>{ws.alive=true;});
  const failure=message=>ws.readyState===1&&ws.send(JSON.stringify({t:'error',message}));
  ws.on('message',(raw,binary)=>{
    const now=performance.now();
    if(membership?.player.accountId && now-lastAuthAt>1000) {
      lastAuthAt=now;
      if(auth.user(req)?.id!==membership.player.accountId){ws.close(4001,'Sessão terminada');return;}
    }
    if(binary){
      const current=membership;if(!current)return;
      const {player:p,room}=current;
      if(p.spectator||p.st>=2||!room.game.running||raw.length!==VOICE_SAMPLES*2)return;
      voiceBudget=Math.min(6,voiceBudget+(now-voiceAt)*.028);voiceAt=now;
      if(voiceBudget<1)return;voiceBudget--;
      const recipients=[...room.game.players.values()].filter(q=>q!==p&&!q.bot&&!q.spectator&&q.st<2&&q.conn?.readyState===1&&q.conn.bufferedAmount<16384&&Math.hypot(q.s.x-p.s.x,q.s.z-p.s.z)<VOICE_RANGE);
      if(!recipients.length)return;
      const frame=Buffer.allocUnsafe(raw.length+4);frame.writeUInt32LE(p.id);raw.copy(frame,4);
      for(const q of recipients)q.conn.send(frame);
      return;
    }
    budget=Math.min(90,budget+(now-updated)*.06);updated=now;
    if(--budget<0)return;
    let m;try{m=JSON.parse(raw);}catch{return;}
    if(!m||typeof m!=='object'||Array.isArray(m))return;
    if(m.t==='join'&&!membership){
      try{membership=rooms.join(ws,m,auth.user(req));}catch(error){failure(error.message);}
      return;
    }
    if(!membership)return;
    const {room,player:p}=membership,g=room.game;g.activate();
    if(m.t==='start'||m.t==='map'){
      if(room.host!==p.id)return failure('Só quem criou a sala pode iniciar ou escolher o mapa.');
      if(m.t==='start')g.start();else g.setMap(String(m.id));
    }else if(m.t==='leave'){
      rooms.leave(room,p);membership=null;ws.send(JSON.stringify({t:'left'}));
    }else if(m.t==='in'){
      const target=m.target&&Number.isSafeInteger(m.target.id)&&['player','item','tx','blood'].includes(m.target.kind)?{kind:m.target.kind,id:m.target.id}:null;
      p.inp={mx:number(m.mx),mz:number(m.mz),sprint:!!m.sprint,crouch:!!m.crouch,jump:!!m.jump,use:!!m.use,
        aim:Number.isFinite(m.aim)?Math.atan2(Math.sin(m.aim),Math.cos(m.aim)):undefined,target};
    }else if(m.t==='act')g.act(p,m);
    else if(m.t==='chat'&&now-chatAt>850){
      chatAt=now;g.chat(p,m.text,m.ch==='echo'?'echo':g.running?'prox':'room');
    }
  });
  ws.on('close',()=>{if(membership){membership.room.game.activate();rooms.disconnect(membership.room,membership.player);}});
  ws.on('error',()=>{});
});
const heartbeat=setInterval(()=>{
  for(const ws of wss.clients){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}
},20000);
let last=performance.now(),accumulator=0;
const timer=setInterval(()=>{
  const now=performance.now();accumulator+=Math.min(.25,(now-last)/1000);last=now;
  while(accumulator>=TICK){rooms.tick(TICK);accumulator-=TICK;}
},1000/60);
function stop(){clearInterval(timer);clearInterval(heartbeat);for(const ws of wss.clients)ws.close(1001,'Servidor a reiniciar');server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),1500).unref();}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
server.listen(PORT,HOST,()=>console.log(`THE BLACK SIGNAL 0.5.0 http://${HOST}:${PORT}${BASE}/`));
