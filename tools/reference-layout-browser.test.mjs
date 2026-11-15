import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {tab,sleep} from './browser-harness.mjs';

// The teleport/phase fixture exists only in this child process, never in the shipped server.
const root=fileURLToPath(new URL('../',import.meta.url)),scratch=await fs.mkdtemp(path.join(os.tmpdir(),'bs-layout-qa-'));
const listener=net.createServer();await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
const fixture=path.join(scratch,'fixture.mjs');
await fs.writeFile(fixture,`import {Game} from ${JSON.stringify(new URL('../server/game.mjs',import.meta.url).href)};
import {LAYOUT} from ${JSON.stringify(new URL('../shared/layout.js',import.meta.url).href)};
import {newMove} from ${JSON.stringify(new URL('../shared/sim.js',import.meta.url).href)};
const snapshot=Game.prototype.snapshot;
Game.prototype.snapshot=function(){
 if(this.phase==='prep')this.enterPhase(1);
 if(this.phase==='day1')for(const p of this.players.values())if(!p.bot&&p.name.includes('Layout QA')){
  const item=p.name.endsWith('item'),target=item?LAYOUT.items.find(i=>i.zone===1):LAYOUT.tx[1];
  p.s=newMove(target.x+(item?1.4:1.8),target.z);p.st=0;
 }
 return snapshot.call(this);
};`);
const server=spawn(process.execPath,['--import',fixture,'server/server.mjs'],{cwd:root,env:{...process.env,HOST:'127.0.0.1',PORT:String(port),DATA_DIR:path.join(scratch,'db')},stdio:['ignore','pipe','pipe']});
let logs='';server.stdout.on('data',chunk=>logs+=chunk);server.stderr.on('data',chunk=>logs+=chunk);
const pages=[],results=[];
if(process.env.QA_OUTPUT_DIR)await fs.mkdir(process.env.QA_OUTPUT_DIR,{recursive:true});
try{
 let ready=false;for(let n=0;n<100;n++){try{ready=(await fetch('http://127.0.0.1:'+port+'/api/health')).ok}catch{}if(ready)break;await sleep(100)}assert.ok(ready,logs);
 for(const kind of ['tx','item']){
  const page=await tab(1280,720);pages.push(page);
  await page.call('Page.addScriptToEvaluateOnNewDocument',{source:`sessionStorage.removeItem('bs.room');localStorage.setItem('bs.language','en');const send=WebSocket.prototype.send;window.__inputPackets=[];WebSocket.prototype.send=function(data){if(typeof data==='string'){const packet=JSON.parse(data);if(packet.t==='in')__inputPackets.push(packet)}return send.call(this,data)};`});
  await page.go('http://127.0.0.1:'+port+'/');await page.front();await page.until('Boolean(window.__bs?.game.online)&&document.querySelector("#asset-status").hidden',35000);
  await page.ev(`document.querySelector('#name').value='Layout QA ${kind}'`);await page.click('#nav-play');await page.click('#room-create-private');await page.until('__bs.game.joined');
  await page.ev("__bs.game.setMap('foundry')");await page.until('document.querySelector("#selection").textContent.includes("Foundry")');await page.ev('__bs.world.ready');await page.until('document.querySelector("#asset-status").hidden');await page.click('#ready');await page.until('!document.querySelector("#start").disabled');await page.click('#start');await page.until('__bs.game.state?.phase==="day1"');await page.ev('__bs.view.yaw=Math.PI/2;__bs.view.pitch=.14');
  const english=kind==='tx'?'Power arrives on Day 2':'Sealed until Day 2',portuguese=kind==='tx'?'A energia chega no Dia 2':'Selado até ao Dia 2';
  await page.until(`document.querySelector('#prompt').textContent===${JSON.stringify(english)}`);
  await page.ev('__inputPackets.length=0;__bs.keys.add("KeyE")');await sleep(350);await page.ev('__bs.keys.delete("KeyE")');
  const packets=await page.ev('__inputPackets');assert.ok(packets.length>3);assert.ok(packets.every(packet=>packet.use===false));assert.equal(await page.ev('__bs.game.state.you.action'),null);
  await page.ev("import('/src/i18n.js').then(m=>m.setLanguage('pt-PT'))");await page.until(`document.querySelector('#prompt').textContent===${JSON.stringify(portuguese)}`);
  if(process.env.QA_OUTPUT_DIR){await fs.mkdir(process.env.QA_OUTPUT_DIR,{recursive:true});await page.capture(path.join(process.env.QA_OUTPUT_DIR,'locked-'+kind+'-pt.png'))}
  results.push({kind,english,portuguese,inputPackets:packets.length,allUseDisabled:true,noServerAction:true});assert.deepEqual(page.errors,[]);assert.deepEqual(page.failed,[]);await page.close();pages.pop();
 }
 if(process.env.QA_EVIDENCE_FILE)await fs.writeFile(process.env.QA_EVIDENCE_FILE,JSON.stringify(results,null,2));console.log('PASS actual bilingual locked-object feedback and non-actionable input',results);
}catch(error){
 for(const page of pages){console.error('Fixture diagnostics',await page.ev(`({prompt:document.querySelector('#prompt').textContent,me:__bs.game.me.s,state:__bs.game.state?.you,phase:__bs.game.state?.phase,view:__bs.view,language:document.documentElement.lang})`));if(process.env.QA_OUTPUT_DIR)await page.capture(path.join(process.env.QA_OUTPUT_DIR,'locked-failure.png'))}throw error;
}finally{
 for(const page of pages)await page.close();server.kill('SIGTERM');await new Promise(resolve=>{if(server.exitCode!==null)resolve();else server.once('exit',resolve)});await fs.rm(scratch,{recursive:true,force:true});
}
