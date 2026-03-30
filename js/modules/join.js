// ============================================================
// modules/join.js — Join Room
// คนเข้าร่วม: กรอก Room Code → เลือกชื่อจาก Firebase dropdown
// sync เฉพาะ fw, gir, putt, srikrung (ไม่แตะ score fields)
// ============================================================
import { FB_URL } from '../config.js';
import { players, srikrungData, G } from '../config.js';
import { getRoomCode, showSyncBar, syncEnabled } from '../firebase/init.js';
import { getRoomConfig } from '../firebase/room.js';

// ── state ──
let _joinMode = false;
let _joinPlayerName = '';

export function isJoinMode(){ return _joinMode; }
export function getJoinPlayerName(){ return _joinPlayerName; }
export function setJoinMode(v){ _joinMode = v; }
export function setJoinPlayerName(v){ _joinPlayerName = v; }

export async function joinRoomLookup(){
  const room = getRoomCode();
  if(!room || room==='DEFAULT'){
    const s = document.getElementById('join-status');
    if(!s) return;
    s.style.display='block';
    s.style.background='rgba(255,69,58,0.12)';
    s.style.color='var(--red)';
    s.textContent='⚠️ กรุณาเลือก Room Code ก่อน';
    return;
  }
  const gameDate = document.getElementById('game-date')?.value || new Date().toISOString().split('T')[0];
  const safeDateKey = gameDate.replace(/-/g,'');
  const s = document.getElementById('join-status');
  if(s){
    s.style.display='block';
    s.style.background='rgba(10,132,255,0.1)';
    s.style.color='var(--blue)';
    s.textContent='⟳ กำลังค้นหาห้อง...';
  }

  const config = await getRoomConfig(room, safeDateKey);
  if(!config || config.dateKey !== safeDateKey){
    if(s){
      s.style.background='rgba(255,69,58,0.12)';
      s.style.color='var(--red)';
      s.textContent=`❌ ไม่พบห้อง ${room} วันนี้ — กรุณาตรวจสอบ Room Code`;
    }
    const list = document.getElementById('join-player-list');
    if(list) list.style.display='none';
    return;
  }

  const names = config.players || [];
  if(s) s.style.display='none';
  const list = document.getElementById('join-player-list');
  const namesDiv = document.getElementById('join-names');
  if(!namesDiv) return;

  namesDiv.innerHTML = names.map(n=>`
    <button onclick="selectJoinPlayer('${n.replace(/'/g,"\\'")}')"
      id="join-btn-${n.replace(/[^a-zA-Z0-9ก-ฮ]/g,'_')}"
      style="padding:10px 14px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;
      border:1.5px solid ${_joinPlayerName===n?'var(--green)':'var(--bg4)'};
      background:${_joinPlayerName===n?'rgba(48,209,88,0.12)':'var(--bg3)'};
      color:${_joinPlayerName===n?'var(--green)':'var(--lbl)'};text-align:left">
      ${_joinPlayerName===n?'✓ ':''} ${n}
    </button>`).join('');
  if(list) list.style.display='block';
}

export function selectJoinPlayer(name){
  _joinMode = true;
  _joinPlayerName = name;
  const s = document.getElementById('join-status');
  if(s){
    s.style.display='block';
    s.style.background='rgba(48,209,88,0.12)';
    s.style.color='var(--green)';
    s.textContent=`✅ เลือกแล้ว: ${name} — กด "บันทึกการตั้งค่า" เพื่อเปิดใช้งาน`;
  }
  document.querySelectorAll('#join-names button').forEach(btn=>{
    const n = btn.textContent.trim().replace(/^✓\s*/,'');
    const sel = n === name;
    btn.style.borderColor = sel?'var(--green)':'var(--bg4)';
    btn.style.background  = sel?'rgba(48,209,88,0.12)':'var(--bg3)';
    btn.style.color       = sel?'var(--green)':'var(--lbl)';
    btn.textContent       = (sel?'✓ ':'')+n;
  });
}

export async function syncJoinToFirebase(){
  if(!syncEnabled || !_joinMode || !_joinPlayerName) return;
  const room = getRoomCode();
  if(!room || room==='DEFAULT') return;
  const gameDate = document.getElementById('game-date')?.value || new Date().toISOString().split('T')[0];
  const safeDateKey = gameDate.replace(/-/g,'');

  const myIdx = players.findIndex(p=>p.name===_joinPlayerName);
  if(myIdx<0){
    showSyncBar('⚠ ไม่พบชื่อ '+_joinPlayerName+' ในเกม','rgba(255,159,10,0.9)',3000);
    return;
  }

  const sg = G.srikrung.on
    ? srikrungData.map(h=>h[myIdx]||{fw:null,gir:null,putt:null})
    : [];
  const payload = {
    fw:  sg.reduce((s,h)=>s+(h&&h.fw?1:0),0),
    gir: sg.reduce((s,h)=>s+(h&&h.gir?1:0),0),
    putt:sg.some(h=>h&&h.putt!==null)
      ? sg.reduce((s,h)=>s+(h&&h.putt!==null?h.putt:0),0)
      : null,
    srikrung: sg,
    updatedAt: Date.now()
  };

  const safeName = _joinPlayerName.replace(/[.#$/[\]]/g,'_');
  try{
    showSyncBar('⟳ Sync FW/GIR/PUTT...','rgba(10,132,255,0.9)',0);
    const res = await fetch(`${FB_URL}/scores/${safeDateKey}/${room}/${safeName}.json`,{
      method:'PATCH',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload)
    });
    if(res.ok){
      showSyncBar(`✓ Sync FW/GIR/PUTT สำเร็จ (${_joinPlayerName})`,'rgba(48,209,88,0.9)',2000);
    } else {
      showSyncBar('⚠ Sync ล้มเหลว','rgba(255,159,10,0.9)',2500);
    }
  } catch(e){
    showSyncBar('✗ ไม่มีสัญญาณ','rgba(255,69,58,0.9)',2500);
  }
}
