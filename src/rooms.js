import { t, translateText } from './i18n.js';
import { MAPS } from '../shared/layout.js';

const $=id=>document.getElementById(id);
export function createRooms(game,openMenu) {
  const select=$('public-room'),code=$('room-code'),status=$('room-connection'),leave=$('room-leave');
  let room=null;
  async function refresh(){
    try{
      const response=await fetch('./api/rooms',{credentials:'same-origin'});
      if(!response.ok)throw Error();
      const data=await response.json();
      const value=select.value;
      select.replaceChildren(...data.rooms.map(r=>{
        const option=document.createElement('option');
        option.value=r.code;option.textContent=`${translateText(r.name)} · ${t('{count} players',{count:r.players})} · ${translateText(MAPS[r.map]?.name??r.map)}${r.running?' · '+t('in progress'):''}`;
        return option;
      }));
      select.disabled=!data.rooms.length;
      if(!data.rooms.length){const empty=document.createElement('option');empty.value='';empty.textContent=t('No public rooms available. Create one or use an invitation.');select.append(empty);}
      if([...select.options].some(o=>o.value===value))select.value=value;
    }catch{status.textContent=t("Could not refresh the room list.");}
  }
  function options(){
    return {room:code.value.trim().toUpperCase()||select.value||'PUBLIC'};
  }
  function joined(message){
    room=message;
    $('room-options').hidden=true;leave.hidden=false;
    status.textContent=`${message.private?t("Private room"):t("Public room")} · ${message.room}`;
    $('room-chat-log').replaceChildren();
  }
  function lobby(message) {
    const own=game.me.id;
    $('start').disabled=message.host!==own || !message.canStart;
    if(message.host!==own && ['lobby','end'].includes(message.phase))$('room-status').textContent=t("Wait for the room host to start the match.");
  }
  function clear(){
    room=null;leave.hidden=true;$('room-options').hidden=false;
    status.textContent='';refresh();
  }
  $('room-refresh').addEventListener('click',refresh);
  $('room-create-private').addEventListener('click',()=>{
    game.join($('name').value.trim()||t("Guest"),{create:true,private:true});
  });
  $('room-create-public').addEventListener('click',()=>{
    game.join($('name').value.trim()||t("Guest"),{create:true,private:false});
  });
  leave.addEventListener('click',()=>{game.leave();openMenu();});
  $('room-chat-form').addEventListener('submit',event=>{
    event.preventDefault();
    const text=$('room-chat-text').value.trim();
    if(text){game.chat(text,'room');$('room-chat-text').value='';}
  });
  window.addEventListener('language-change',()=>{refresh();if(room)joinedLabel();});
  function joinedLabel(){status.textContent=`${room.private?t('Private room'):t('Public room')} · ${room.room}`;}
  refresh();
  return {options,joined,lobby,clear,get room(){return room;}};
}
