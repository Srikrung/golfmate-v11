// ============================================================
// firebase/sync.js — syncToFirebase, syncToSheets, syncAll, registerAllPlayers
// ============================================================
import { FB_URL } from '../config.js';
import { getRoomCode, getApiUrl, showSyncBar,
         syncEnabled, joinMode, joinPlayerName } from './init.js';
import { getRoomConfig, lockRoom } from './room.js';

// ── state ที่ใช้ร่วมกัน (import จาก config) ──
import { players, scores, pars, srikrungData, G } from '../config.js';

export async function syncToFirebase(){
  if(!syncEnabled)return;
  const room=getRoomCode();
  if(!room||room==='DEFAULT')return;
  const cn=document.getElementById('course-name').value||'—';
  const gameDate=document.getElementById('game-date').value||new Date().toISOString().split('T')[0];
  const safeDateKey=gameDate.replace(/-/g,'');

  const config=await getRoomConfig(room,safeDateKey);
  if(config&&config.dateKey===safeDateKey){
    const lockedNames=config.players||[];
    const myNames=players.map(p=>p.name);
    const notAllowed=myNames.filter(n=>!lockedNames.includes(n));
    if(notAllowed.length>0){
      showSyncBar(`🔒 ห้อง ${room} ถูกล็อคแล้ว ชื่อ "${notAllowed[0]}" ไม่ได้รับอนุญาต`,'rgba(255,69,58,0.9)',4000);
      return;
    }
  }

  players.forEach(async(pl,p)=>{
    const scores18=scores[p];
    const hcp=pl.hcp||0;
    const total=scores18.reduce((s,v)=>s+(v||0),0);
    const net=total-hcp;
    const holesPlayed=scores18.filter(v=>v!==null).length;
    const sg=G.srikrung.on?(srikrungData.map(h=>h[p]||{fw:null,gir:null,putt:0})):[];
    const payload={
      room, name:pl.name, hcp, course:cn, gameDate,
      scores:scores18, pars, holesPlayed, total, net,
      fw:sg.reduce((s,h)=>s+(h&&h.fw?1:0),0),
      gir:sg.reduce((s,h)=>s+(h&&h.gir?1:0),0),
      putt:sg.some(h=>h&&h.putt!==null)?sg.reduce((s,h)=>s+(h&&h.putt!==null?h.putt:0),0):null,
      srikrung:sg, updatedAt:Date.now()
    };
    const safeName=pl.name.replace(/[.#$/[\]]/g,'_');
    const path=`scores/${safeDateKey}/${room}/${safeName}.json`;
    try{
      showSyncBar('⟳ กำลัง Sync...','rgba(10,132,255,0.9)',0);
      const res=await fetch(`${FB_URL}/${path}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      if(res.ok){showSyncBar(`✓ Sync สำเร็จ`,'rgba(48,209,88,0.9)',2000);}
      else{showSyncBar('⚠ Sync ล้มเหลว','rgba(255,159,10,0.9)',2500);}
    }catch(e){showSyncBar('✗ ไม่มีสัญญาณ','rgba(255,69,58,0.9)',2500);}
  });
}

export async function syncToSheets(){
  if(!syncEnabled)return;
  const url=getApiUrl();
  if(!url||!url.startsWith('http'))return;
  const room=getRoomCode();
  const cn=document.getElementById('course-name').value||'—';
  players.forEach(async(pl,p)=>{
    const payload={
      action:'sync', room, name:pl.name, hcp:pl.hcp||0, course:cn, pars,
      scores:scores[p],
      gameDate:document.getElementById('game-date').value||new Date().toISOString().split('T')[0],
      srikrung:G.srikrung.on?(srikrungData.map(h=>h[p]||{fw:null,gir:null,putt:0})):[]
    };
    try{await fetch(url,{method:'POST',body:JSON.stringify(payload)});}catch(e){}
  });
}

export function syncAll(){
  if(joinMode) syncJoinToFirebase();
  else syncToFirebase();
  syncToSheets();
}

export async function registerAllPlayers(){
  const room=getRoomCode();
  if(!room||room==='DEFAULT')return;
  const cn=document.getElementById('course-name').value||'—';
  const gameDate=document.getElementById('game-date').value||new Date().toISOString().split('T')[0];
  const safeDateKey=gameDate.replace(/-/g,'');
  showSyncBar('⟳ กำลังเช็คห้อง...','rgba(10,132,255,0.9)',0);
  const config=await getRoomConfig(room,safeDateKey);
  if(config&&config.dateKey===safeDateKey){
    showSyncBar(`🔒 ห้อง ${room} ถูกใช้แล้ววันนี้ ไม่สามารถเพิ่มผู้เล่นใหม่ได้`,'rgba(255,69,58,0.9)',4000);
    return;
  }
  const myNames=players.map(p=>p.name);
  await lockRoom(room,safeDateKey,myNames);
  for(const pl of players){
    const safeName=pl.name.replace(/[.#$/[\]]/g,'_');
    try{
      await fetch(`${FB_URL}/players/${safeDateKey}/${room}/${safeName}.json`,{
        method:'PUT',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({name:pl.name,hcp:pl.hcp||0,course:cn,room,registeredAt:Date.now()})
      });
    }catch(e){}
  }
  showSyncBar(`🔒 ล็อคห้อง ${room} สำเร็จ · ${myNames.length} คน`,'rgba(48,209,88,0.9)',3000);
  const url=getApiUrl();
  if(url&&url.startsWith('http')){
    for(const pl of players){
      try{await fetch(url,{method:'POST',body:JSON.stringify({action:'register',room,name:pl.name,hcp:pl.hcp||0,course:cn})});}catch(e){}
    }
  }
}

// import นี้อยู่ด้านล่างเพื่อหลีกเลี่ยง circular import
import { syncJoinToFirebase } from '../modules/join.js';
