// ============================================================
// app.js — Entry point สำหรับ GolfMate v11
// import ทั้งหมดต้องอยู่บนสุดเท่านั้น (ES Module rule)
// ============================================================

// ── config ──
import { players, scores, pars, G,
         olympicData, farNearData, srikrungData, skipData, teamSoloPlayers,
         setPlayers, setScores, setGameStarted, setCurrentHole,
         isGameStarted, getCurrentHole, LS_KEY, FB_URL } from './config.js';

// ── ui ──
import { initTheme, toggleTheme, applyFontScale, initFontScale,
         showExportModal, hideExportModal,
         setExportWho, doExport } from './ui/alerts.js';
import { initSwipe, goTab, goGuide, goResults, goMoney,
         buildParGrid, renderPlayerRows, buildTurboGrid,
         buildProgressBar, updateProgressBar, holeNav, toggleTH,
         changeCoursePreset, applyParsFromPreset } from './ui/tabs.js';
import { showHole, updateTotals, drSet, _refreshOlyInline,
         getTeamBadgeHTML, getTeamBadgeProps,
         setHoleMatrixPill, setMatrixPill, lbToggleMatrix,
         buildResults, buildMoney, showMoneyDetail } from './ui/render.js';

// ── modules ──
import { initHcapPairs, addHcapPairsForPlayer, buildHcapUI,
         hcapTogglePair, hcapFlipDir, hcapSetStroke, hcapSetField } from './modules/handicap.js';
import { updateBiteMultUI, toggleBiteMult, setBiteMult,
         toggleGameMidPlay, olyAct, olyReset, olyRenderHole,
         fnChangeMode, fnToggleSank, fnSelectPlayer, fnRenderHole } from './modules/games.js';
import { sgToggle, sgChPutt, sgSetPutt1, sgRenderHole,
         sgToggleFocus, getSgFocusPlayer } from './modules/srikrung.js';
import { joinRoomLookup, selectJoinPlayer, restoreJoinSrikrung,
         loadOnlineRooms, joinFromRoomList } from './modules/join.js';
import { chScore, startRpt, stopRpt, sws, swm, swe,
         setParAll, chPar } from './modules/scoring.js';
import { goLeaderboard, lbGoPrev, lbGoNext,
         lbSetTab, lbSetRoom, lbFetch } from './modules/leaderboard.js';

// ── firebase ──
import { toggleSyncSw, updateRoomCode, syncEnabled, getRoomCode } from './firebase/init.js';
import { loadOnlineSetting, goOnlineSetup, saveOnlineSetup, testConnection } from './firebase/room.js';
import { createRoom, syncFullBackup, restoreFromFirebase,
         deleteRoomFromFirebase } from './firebase/sync.js';

// ── Debounce backup 10 วินาที หลัง autoSave ──
let _backupTimer = null;
function scheduleBackup(){
  if(!navigator.onLine) return; // ออฟไลน์ → ข้าม
  clearTimeout(_backupTimer);
  _backupTimer = setTimeout(()=>{ syncFullBackup(); }, 10000);
}


// ── Auto Generate Room Code ──
function autoGenRoomCode(){
  const letters='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const letter=letters[Math.floor(Math.random()*26)];
  const day=new Date().getDate();
  const d1=Math.floor(day/10).toString();
  const d2=(day%10).toString();
  const sl=document.getElementById('room-code-letter');
  const sn=document.getElementById('room-code-num');
  const sn2=document.getElementById('room-code-num2');
  for(let i=0;i<sl.options.length;i++) if(sl.options[i].value===letter){sl.selectedIndex=i;break;}
  for(let i=0;i<sn.options.length;i++) if(sn.options[i].value===d1){sn.selectedIndex=i;break;}
  for(let i=0;i<sn2.options.length;i++) if(sn2.options[i].value===d2){sn2.selectedIndex=i;break;}
  updateRoomCode();
}
// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initFontScale();
  setTimeout(() => document.getElementById('splash')?.classList.add('hide'), 1200);
  setToday();
  const preset = document.getElementById('course-preset');
  if(preset){ preset.value = 'mthb13'; changeCoursePreset(); }
  buildParGrid();
  renderPlayerRows();
  buildTurboGrid();
  // ── Auto-expire: ล้างเกมเก่าช่วง 04:00–05:59 ──
  try{
    const saved = JSON.parse(localStorage.getItem(LS_KEY)||'{}');
    if(saved.gameDate){
      const now   = new Date();
      const hour  = now.getHours();
      const today = now.toISOString().split('T')[0];
      if(saved.gameDate !== today && hour >= 4 && hour < 6){
        localStorage.removeItem(LS_KEY);
      }
    }
  }catch(e){}
  setTimeout(()=>{
    const hadLocal = loadSession();
    if(!hadLocal){
      // ไม่มีข้อมูลในเครื่อง → ลองดึง Firebase อัตโนมัติ
      try{
        const online = JSON.parse(localStorage.getItem('golfmate_online')||'{}');
        if(online.room && online.room !== 'DEFAULT'){
          restoreFromFirebase(true); // silent=true ไม่ถาม
        }
      }catch(e){}
    }
  }, 400);
  loadOnlineSetting();
  initRestoreBtn();
  initSwipe();
  updateBiteMultUI();

  document.getElementById('add-player-modal')?.addEventListener('click', function(e){
    if(e.target === this) hideAddPlayerModal();
  });
  document.getElementById('export-modal')?.addEventListener('click', function(e){
    if(e.target === this) hideExportModal();
  });
  document.addEventListener('visibilitychange', () => {
    if(document.visibilityState === 'hidden') saveSession();
  });
  window.addEventListener('beforeunload', () => saveSession());

  // bridge สำหรับ config.js ที่ใช้ window._autoSave()
  window._autoSave = saveSession;
  window._updateAddPlayerBtn = updateAddPlayerBtn;

  // expose ทุก function ที่ HTML onclick เรียก
  Object.assign(window, {
    // app
    setToday, fmtDate, toggleSw, toggleSkipPlayer, toggleSkipGame,
    toggleTeamSolo, toggleTeamScorecard, setTeamMode, setH2HSize, startGame, newGame,
    showAddPlayerModal, hideAddPlayerModal, confirmAddPlayer,
    updateAddPlayerBtn, saveSession, loadSession, clearSession, clearGameData, initRestoreBtn, autoSave,
    shareToLine,
    // course
    changeCoursePreset, applyParsFromPreset,
    // tabs/nav
    goTab, goGuide, goResults, goMoney, showMoneyDetail,
    buildParGrid, renderPlayerRows, buildTurboGrid,
    buildProgressBar, updateProgressBar, holeNav, toggleTH,
    // scoring
    chScore, startRpt, stopRpt, sws, swm, swe,
    setParAll, chPar, drSet,
    // games
    toggleGameMidPlay, olyAct, olyReset, olyRenderHole,
    fnChangeMode, fnToggleSank, fnSelectPlayer, fnRenderHole,
    toggleBiteMult, setBiteMult, updateBiteMultUI,
    setHoleMatrixPill, setMatrixPill, lbToggleMatrix,
    // handicap
    hcapTogglePair, hcapFlipDir, hcapSetStroke, hcapSetField, buildHcapUI,
    // srikrung
    sgToggle, sgChPutt, sgSetPutt1,
    sgSetFocusAll, sgSetFocusMe,
    // leaderboard
    goLeaderboard, lbGoPrev, lbGoNext, lbSetTab, lbSetRoom, lbFetch,
    // firebase
    toggleSyncSw, updateRoomCode, autoGenRoomCode,
    goOnlineSetup, saveOnlineSetup, testConnection, createRoom,
    restoreFromFirebase, restoreJoinSrikrung,
    deleteRoomFromFirebase,
    // join
    joinRoomLookup, selectJoinPlayer, restoreJoinSrikrung,
    loadOnlineRooms, joinFromRoomList,
    // export / share
    showExportModal, hideExportModal, setExportWho, doExport,
    toggleTheme, applyFontScale,
    // collapse
    toggleSkipSection, toggleMatrixSection, chParNav,
  });
});

// ============================================================
// HELPERS
// ============================================================
export function setToday(){
  const d = new Date(Date.now() + 7*3600000);
  const el = document.getElementById('game-date');
  if(el) el.value = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}
export function fmtDate(v){
  if(!v) return '';
  const [y,m,d] = v.split('-');
  const mn = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  return `${+d} ${mn[+m-1]}${+y+543}`;
}

// ============================================================
// TOGGLE GAME SWITCH
// ============================================================
export function toggleSw(id){
  G[id].on = !G[id].on;
  document.getElementById(`sw-${id}`)?.classList.toggle('on', G[id].on);
  const body = document.getElementById(`gb-${id}`);
  if(body) body.style.display = G[id].on ? 'block' : 'none';
  // Srikrung: แสดง/ซ่อน focus row และสร้างปุ่มเลือกคน
  if(id === 'srikrung'){
    const row = document.getElementById('sg-focus-row');
    if(row) row.style.display = G.srikrung.on ? 'block' : 'none';
    if(G.srikrung.on) _sgBuildFocusBtns();
  }
  if(isGameStarted()){
    const sy = window.scrollY;
    showHole(getCurrentHole());
    requestAnimationFrame(() => window.scrollTo(0, sy));
  }
  autoSave();
}

// ============================================================
// SKIP
// ============================================================
// ── TEAM SCORECARD TOGGLE ──
// กด badge ทีม → วนรอบ: A → B → Solo → ไม่เล่น → A
export function toggleTeamScorecard(h, p){
  const isSolo = teamSoloPlayers.has(p);
  const isOut  = skipData[h]?.[p]?.has('team');
  const cur    = G.team.domoTeams[h]?.[p] || 'A';

  if(isOut){
    // ไม่เล่น → กลับ A
    skipData[h][p].delete('team');
    teamSoloPlayers.delete(p);
    G.team.domoTeams[h][p] = 'A';
    // propagate A ไปหลุมถัดไป
    for(let i=h+1;i<18;i++) G.team.domoTeams[i][p]='A';
  } else if(isSolo){
    // Solo → ไม่เล่น
    teamSoloPlayers.delete(p);
    if(!skipData[h]){ skipData[h]=Array(players.length).fill(null).map(()=>new Set()); }
    else { while(skipData[h].length<players.length) skipData[h].push(new Set()); }
    if(!skipData[h][p]) skipData[h][p]=new Set();
    skipData[h][p].add('team');
  } else if(cur==='B'){
    // B → Solo
    teamSoloPlayers.add(p);
  } else {
    // A → B — propagate ไปทุกหลุมถัดไป
    G.team.domoTeams[h][p] = 'B';
    for(let i=h+1;i<18;i++) G.team.domoTeams[i][p]='B';
  }
  // อัปเดต badge ทุกหลุมที่เปลี่ยน
  for(let i=h;i<18;i++){
    const el=document.getElementById(`tb-${i}-${p}`);
    if(el){
      const {bg,cl,label}=getTeamBadgeProps(i,p);
      el.style.background=bg; el.style.color=cl; el.textContent=label;
    }
  }
  updateTotals(); autoSave();
}

export function toggleSkipPlayer(h, p){
  toggleSkipGame(h,p,'bite');
  toggleSkipGame(h,p,'olympic');
  toggleSkipGame(h,p,'farNear');
}
export function toggleSkipGame(h, p, k){
  // init แบบปลอดภัย — ไม่ล้าง slot เดิมที่มีอยู่
  if(!skipData[h]){
    skipData[h] = Array(players.length).fill(null).map(()=>new Set());
  } else {
    // ถ้า array สั้นกว่า players ปัจจุบัน (เพิ่มคนระหว่างแมท) → ต่อ slot
    while(skipData[h].length < players.length) skipData[h].push(new Set());
  }
  if(!skipData[h][p]) skipData[h][p] = new Set();
  if(skipData[h][p].has(k)) skipData[h][p].delete(k);
  else skipData[h][p].add(k);
  updateTotals(); autoSave();
  // จำสถานะ skip section ก่อน render ใหม่
  const skipOpen = document.getElementById(`skip-body-${h}`)?.style.display === 'block';
  showHole._noScroll = true; // ไม่ scroll ขึ้นบนเสมอเมื่อกด skip
  showHole(h);
  // คืนสถานะ skip section เหมือนเดิม
  const body = document.getElementById(`skip-body-${h}`);
  const arr  = document.getElementById(`skip-arr-${h}`);
  if(body) body.style.display = skipOpen ? 'block' : 'none';
  if(arr)  arr.textContent    = skipOpen ? '▼' : '▶';
}

// ============================================================
// TEAM SOLO
// ============================================================
export function toggleTeamSolo(p){
  if(teamSoloPlayers.has(p)) teamSoloPlayers.delete(p);
  else teamSoloPlayers.add(p);
  showHole(getCurrentHole()); updateTotals(); autoSave();
}
export function setTeamMode(mode){ G.team.mode = 'h2h'; }
export function setH2HSize(sz){}

// ============================================================
// NEW GAME
// ============================================================
export function sgSetFocusAll(){
  sgToggleFocus(null); // รีเซ็ตเป็น ทุกคน
  _sgUpdateFocusBtns(null);
  // re-render ทุกหลุม
  for(let h=0;h<18;h++){ if(document.getElementById('sg-players-'+h)) sgRenderHole(h); }
}
export function sgSetFocusMe(p){
  sgToggleFocus(p);
  _sgUpdateFocusBtns(p);
  for(let h=0;h<18;h++){ if(document.getElementById('sg-players-'+h)) sgRenderHole(h); }
}
function _sgBuildFocusBtns(){
  const wrap=document.getElementById('sg-focus-btns'); if(!wrap) return;
  const focus=getSgFocusPlayer();
  wrap.innerHTML=`<button onclick="sgSetFocusAll()" id="sg-focus-all"
    style="padding:6px 14px;border-radius:999px;border:1.5px solid ${focus===null?'rgba(52,199,89,0.45)':'var(--bg4)'};
    background:${focus===null?'rgba(52,199,89,0.12)':'transparent'};
    color:${focus===null?'var(--green)':'var(--lbl2)'};
    font-family:inherit;font-size:12px;font-weight:700;cursor:pointer">ทุกคน (Host)</button>`
    +players.map((pl,i)=>`<button onclick="sgSetFocusMe(${i})" id="sg-focus-${i}"
      style="padding:6px 14px;border-radius:999px;border:1.5px solid ${focus===i?'rgba(10,132,255,0.45)':'var(--bg4)'};
      background:${focus===i?'rgba(10,132,255,0.12)':'transparent'};
      color:${focus===i?'var(--blue)':'var(--lbl2)'};
      font-family:inherit;font-size:12px;font-weight:700;cursor:pointer">${pl.name}</button>`).join('');
}
function _sgUpdateFocusBtns(focus){
  const all=document.getElementById('sg-focus-all');
  if(all){all.style.background=focus===null?'rgba(52,199,89,0.12)':'transparent';all.style.borderColor=focus===null?'rgba(52,199,89,0.45)':'var(--bg4)';all.style.color=focus===null?'var(--green)':'var(--lbl2)';}
  players.forEach((_,i)=>{const b=document.getElementById('sg-focus-'+i);if(!b)return;const on=focus===i;b.style.background=on?'rgba(10,132,255,0.12)':'transparent';b.style.borderColor=on?'rgba(10,132,255,0.45)':'var(--bg4)';b.style.color=on?'var(--blue)':'var(--lbl2)';});
}

export function newGame(){
  if(confirm('เริ่มเกมใหม่?')){
    setGameStarted(false);
    setPlayers([]); setScores([]); setCurrentHole(0);
    clearSession(); goTab('setup');
  }
}

// ============================================================
// START GAME
// ============================================================
export function startGame(){
  // เตือนถ้าไม่มี Room Code
  const room = getRoomCode();
  if(!room || room==='DEFAULT'){
    const go = confirm(
      '⚠️ ยังไม่ได้ตั้ง Room Code\n\nข้อมูลสกอร์จะไม่ถูก backup ขึ้น Cloud\nถ้ารีเฟรชพลาดข้อมูลอาจหาย\n\nกด ตกลง เพื่อเล่นต่อโดยไม่ backup\nกด ยกเลิก เพื่อไปตั้ง Room Code ก่อน'
    );
    if(!go){ goOnlineSetup(); return; }
  }
  const n = +document.getElementById('num-players').value;
  setPlayers([...document.querySelectorAll('.pn')].slice(0,n).map((el,i) => ({
    name: el.value.trim() || el.placeholder || `ผู้เล่น ${i+1}`,
    hcp:  Math.max(0, +(document.querySelectorAll('.ph')[i]?.value) || 0)
  })));
  setScores(Array(n).fill(null).map(() => Array(18).fill(null)));

  ['bite','olympic','team','farNear'].forEach(k => {
    const ve = document.getElementById(`gv-${k}`);
    if(ve) G[k].val = Math.max(1, +ve.value || 20);
  });
  G.team.chuanVal = Math.max(1, +(document.getElementById('gv-team-chuan')?.value) || 4);
  G.team.mode = 'h2h'; G.team.swapType = 'domo';
  for(let i=0; i<n; i++){ if(!G.team.baseTeams[i]) G.team.baseTeams[i] = i%2===0?'A':'B'; }
  G.team.domoTeams = Array(18).fill(null).map(() => [...G.team.baseTeams]);
  G.doubleRe.mults = Array(18).fill(1);
  G.doubleRe.on = G.team.on; // เบิ้ล-รีเปิดพร้อมทีมเสมอ

  olympicData.splice(0, olympicData.length,
    ...Array(18).fill(null).map(() => ({order:[],status:{}})));
  farNearData.splice(0, farNearData.length,
    ...Array(18).fill(null).map(() => ({mode:'none',far:null,near:null,farSank:null,nearSank:null,solo:null,soloSank1:null,soloSank2:null})));
  srikrungData.splice(0, srikrungData.length,
    ...Array(18).fill(null).map(() => players.map(() => ({fw:null,gir:null,putt:null}))));
  skipData.splice(0, skipData.length,
    ...Array(18).fill(null).map(() => Array(n).fill(null).map(() => new Set())));
  teamSoloPlayers.clear();

  initHcapPairs(n);
  setGameStarted(true); setCurrentHole(0);
  buildProgressBar(); showHole(0); goTab('scorecard');
  autoSave();
}

// ============================================================
// ADD PLAYER
// ============================================================
const ADD_MAX = 8;

export function showAddPlayerModal(){
  if(!isGameStarted()) return;
  if(players.length >= ADD_MAX){
    alert(`ไม่สามารถเพิ่มได้\nผู้เล่นครบ ${ADD_MAX} คนแล้ว`); return;
  }
  const modal = document.getElementById('add-player-modal');
  const sheet = document.getElementById('add-player-sheet');
  document.getElementById('new-player-name').value = '';
  document.getElementById('new-player-hcp').value = '0';
  const badge = document.getElementById('ap-slot-badge');
  if(badge) badge.textContent = `เหลือ ${ADD_MAX-players.length} ช่อง`;
  const cta = document.querySelector('#add-player-sheet .cta');
  if(cta) cta.textContent = `เพิ่มผู้เล่น (${players.length+1}/${ADD_MAX})`;
  modal.style.display = 'flex';
  requestAnimationFrame(() => requestAnimationFrame(() => { sheet.style.transform = 'translateY(0)'; }));
}
export function hideAddPlayerModal(){
  const sheet = document.getElementById('add-player-sheet');
  sheet.style.transform = 'translateY(100%)';
  setTimeout(() => { document.getElementById('add-player-modal').style.display = 'none'; }, 300);
}
export function confirmAddPlayer(){
  if(players.length >= ADD_MAX){ alert('ไม่สามารถเพิ่มผู้เล่นได้'); hideAddPlayerModal(); return; }
  const name = document.getElementById('new-player-name').value.trim();
  const hcp  = Math.max(0, +(document.getElementById('new-player-hcp').value) || 0);
  if(!name){ document.getElementById('new-player-name').focus(); return; }
  const p = players.length;
  players.push({name, hcp});
  scores.push(Array(18).fill(null));
  srikrungData.forEach(hd => hd.push({fw:null,gir:null,putt:null}));
  G.team.baseTeams.push(p%2===0?'A':'B');
  G.team.domoTeams.forEach(hd => hd.push(p%2===0?'A':'B'));
  addHcapPairsForPlayer(p);
  // เพิ่ม skipData slot สำหรับคนใหม่ทุกหลุม
  for(let h=0; h<18; h++){
    if(!skipData[h]) skipData[h] = Array(p+1).fill(null).map(()=>new Set());
    else if(!skipData[h][p]) skipData[h][p] = new Set();
  }
  updateAddPlayerBtn(); hideAddPlayerModal();
  showHole(getCurrentHole()); autoSave();
  // auto อัปเดต _room_config ถ้าห้องเปิดอยู่
  if(syncEnabled) createRoom();
}
export function updateAddPlayerBtn(){
  const btn = document.getElementById('btn-add-player'); if(!btn) return;
  if(players.length >= ADD_MAX){
    btn.textContent = `✋ ผู้เล่นครบ ${ADD_MAX} คนแล้ว`;
    btn.style.opacity = '0.4'; btn.style.pointerEvents = 'none';
    btn.style.color = 'var(--lbl2)'; btn.style.borderColor = 'var(--sep)';
  } else {
    btn.textContent = `+ เพิ่มผู้เล่น (เหลือ ${ADD_MAX-players.length} ช่อง)`;
    btn.style.opacity = '1'; btn.style.pointerEvents = 'auto';
    btn.style.color = 'var(--blue)'; btn.style.borderColor = 'rgba(10,132,255,0.3)';
  }
}

// ============================================================
// SESSION
// ============================================================
export function saveSession(){
  if(!isGameStarted()) return;
  try{
    localStorage.setItem(LS_KEY, JSON.stringify({
      v:1, players, scores, pars,
      saveDate: new Date().toISOString().slice(0,10), // YYYY-MM-DD
      currentHole: getCurrentHole(),
      gameStarted: isGameStarted(),
      G:{
        bite:    {on:G.bite.on,    val:G.bite.val,    mults:G.bite.mults},
        olympic: {on:G.olympic.on, val:G.olympic.val},
        team:    {on:G.team.on,    val:G.team.val,    chuanVal:G.team.chuanVal,
                  mode:G.team.mode, swapType:G.team.swapType,
                  baseTeams:G.team.baseTeams, domoTeams:G.team.domoTeams},
        farNear: {on:G.farNear.on, val:G.farNear.val},
        turbo:   {on:G.turbo.on,   holes:[...G.turbo.holes], mult:G.turbo.mult},
        doubleRe:{on:G.doubleRe.on,mults:G.doubleRe.mults},
        srikrung:{on:G.srikrung.on},
        hcap:    {on:G.hcap.on,    pairs:G.hcap.pairs.map(p => ({...p}))}
      },
      olympicData, farNearData, srikrungData,
      skipData: skipData.map(row => row.map(s => [...s])),
      teamSoloPlayers: [...teamSoloPlayers],
      courseName: document.getElementById('course-name')?.value,
      gameDate:   document.getElementById('game-date')?.value
    }));
    scheduleBackup(); // debounce backup 10 วิ
  } catch(e){}
}

export function loadSession(){
  try{
    const raw = localStorage.getItem(LS_KEY); if(!raw) return false;
    const data = JSON.parse(raw);
    if(!data?.v || !data.players?.length) return false;
    // ตรวจข้ามวัน — ถ้าบันทึกคนละวัน ล้างอัตโนมัติ
    const today = new Date().toISOString().slice(0,10);
    if(data.saveDate && data.saveDate !== today){
      localStorage.removeItem(LS_KEY);
      return false;
    }
    setPlayers(data.players);
    setScores(data.scores);
    pars.splice(0, pars.length, ...data.pars);
    setCurrentHole(data.currentHole || 0);
    setGameStarted(data.gameStarted);

    olympicData.splice(0, olympicData.length,
      ...(data.olympicData || Array(18).fill(null).map(() => ({order:[],status:{}}))));
    farNearData.splice(0, farNearData.length,
      ...(data.farNearData || Array(18).fill(null).map(() => ({mode:'none',far:null,near:null,farSank:null,nearSank:null,solo:null,soloSank1:null,soloSank2:null}))));
    srikrungData.splice(0, srikrungData.length,
      ...(data.srikrungData || Array(18).fill(null).map(() => players.map(() => ({fw:null,gir:null,putt:1})))));
    skipData.splice(0, skipData.length,
      ...(data.skipData
        ? data.skipData.map(row => row.map(s => {
            const set = new Set(s);
            set.delete('team'); // team ไม่เก็บใน skipData แล้ว — ใช้ teamSoloPlayers แทน
            return set;
          }))
        : Array(18).fill(null).map(() => Array(players.length).fill(null).map(() => new Set()))));
    teamSoloPlayers.clear();
    (data.teamSoloPlayers || []).forEach(v => teamSoloPlayers.add(v));

    const gd = data.G;
    if(gd){
      Object.assign(G.bite,    gd.bite);
      G.bite.mults = {...{hio:10,albatross:5,eagle:3,birdie:2}, ...(gd.bite?.mults||{})};
      // migrate: ถ้า mults เป็น default เก่า → อัปเกรดเป็น default ใหม่
      if(G.bite.mults.hio===50) G.bite.mults.hio=10;
      if(G.bite.mults.albatross===4) G.bite.mults.albatross=5;
      Object.assign(G.olympic, gd.olympic);
      Object.assign(G.team,    gd.team);
      Object.assign(G.farNear, gd.farNear);
      Object.assign(G.turbo,   gd.turbo);
      G.turbo.holes = new Set(gd.turbo?.holes || []);
      Object.assign(G.doubleRe,gd.doubleRe);
      if(gd.srikrung) Object.assign(G.srikrung, gd.srikrung);
      if(gd.hcap){ Object.assign(G.hcap, gd.hcap); setTimeout(buildHcapUI, 300); }
    }

    const cnEl = document.getElementById('course-name');
    const gdEl = document.getElementById('game-date');
    if(data.courseName && cnEl) cnEl.value = data.courseName;
    if(data.gameDate   && gdEl) gdEl.value = data.gameDate;

    // ── ใส่ชื่อ/HCP กลับเข้าช่อง Setup ──
    const numEl = document.getElementById('num-players');
    if(numEl) numEl.value = players.length;
    renderPlayerRows();
    setTimeout(()=>{
      const pns = document.querySelectorAll('.pn');
      const phs = document.querySelectorAll('.ph');
      players.forEach((p,i)=>{
        if(pns[i]) pns[i].value = p.name;
        if(phs[i]) phs[i].value = p.hcp ?? 0;
      });
    }, 50);

    updateBiteMultUI();
    buildParGrid();
    buildProgressBar();
    showHole(getCurrentHole());
    goTab('scorecard');
    return true;
  } catch(e){ localStorage.removeItem(LS_KEY); return false; }
}

export function clearSession(){ try{ localStorage.removeItem(LS_KEY); } catch(e){} }

export async function initRestoreBtn(){
  try{
    const online = JSON.parse(localStorage.getItem('golfmate_online')||'{}');
    const room = online.room || '';
    if(!room || room==='DEFAULT') return;
    const today = new Date().toISOString().split('T')[0].replace(/-/g,'');
    const res = await fetch(`${FB_URL}/backup/${today}/${room}/session.json`);
    if(!res.ok) return;
    const data = await res.json();
    if(!data?.players?.length) return;
    const names = data.players.map(p=>p.name).join(', ');
    const holes = data.scores?.[0]?.filter(v=>v!==null).length||0;
    const dateStr = data.gameDate ? new Date(data.gameDate).toLocaleDateString('th-TH',{day:'numeric',month:'short'}) : '';
    const btn=document.getElementById('restore-game-btn');
    const roomLbl=document.getElementById('restore-room-lbl');
    const infoLbl=document.getElementById('restore-info-lbl');
    if(btn){ btn.style.display='block'; }
    if(roomLbl) roomLbl.textContent = room;
    if(infoLbl) infoLbl.textContent = `${dateStr} · ${names} · ${holes}/18 หลุม`;
  }catch(e){}
}

export function clearGameData(){
  if(!confirm('ล้างข้อมูลเกมเก่า?\n\nสกอร์ในเครื่องจะหาย\n(Firebase backup ยังอยู่ — กู้คืนได้ภายหลัง)')) return;
  localStorage.removeItem(LS_KEY);
  setPlayers([]); setScores([]); setCurrentHole(0); setGameStarted(false);
  location.reload();
}
export function autoSave(){ saveSession(); }

// ============================================================
// SHARE
// ============================================================
export async function shareToLine(tid){
  const ov = document.getElementById('saving-ov');
  if(ov) ov.classList.add('show');
  try{
    const L = document.body.classList.contains('light');
    const A4_W = 794;
    const n = players.length;
    const HW=46, PW=38, NW_MAX=Math.round((A4_W-32-HW-PW)/8);
    const nW = NW_MAX;
    const tblW = Math.min(HW+PW+n*nW, A4_W-32);
    const par9a=pars.slice(0,9).reduce((a,b)=>a+b,0);
    const par9b=pars.slice(9).reduce((a,b)=>a+b,0);
    const cn=document.getElementById('course-name')?.value||'ไม่ระบุสนาม';
    const ds=fmtDate(document.getElementById('game-date')?.value||'');

    const thBg=L?'#1a4a8a':'#1a3a6e', thCl=L?'#fff':'#ffd700';
    const tdBd=L?'1px solid #bbb':'1px solid #333';
    const rowO=L?'#fff':'#131f30', rowE=L?'#f5f7fa':'#0f1a28';
    const hcBg=L?'#eef2fa':'#0a1520', hcCl=L?'#555':'#ffd700';
    const subBg=L?'#ddeeff':'rgba(255,215,0,0.1)', subCl=L?'#1a4a8a':'#ffd700';
    const totBg=L?'#1a4a8a':'rgba(255,215,0,0.22)', totCl=L?'#fff':'#ffd700';
    const ovP=L?'#cc4400':'#ff9966', ovN=L?'#004fc4':'#4da3ff';
    const totOvP=L?'#ffbb88':'#ff9966', totOvN=L?'#88ddff':'#4da3ff';

    function scHTML(s,par){
      if(s===null||s===undefined) return`<td style="border:${tdBd};padding:6px 2px;text-align:center;background:inherit"><span style="font-size:20px;color:rgba(150,150,150,.3)">—</span></td>`;
      const d=s-par;
      if(d>=2) return`<td style="border:${tdBd};padding:6px 2px;text-align:center;background:inherit"><span style="font-size:24px;font-weight:700;color:${L?'#444':'rgba(255,255,255,.6)'}">${s}</span></td>`;
      if(d===1) return`<td style="border:${tdBd};padding:6px 2px;text-align:center;background:inherit"><span style="font-size:22px;font-weight:600;color:${L?'#ccc':'rgba(255,255,255,.28)'}">${s}</span></td>`;
      if(d===0) return`<td style="border:${tdBd};padding:6px 2px;text-align:center;background:inherit"><span style="font-size:24px;font-weight:800;color:${L?'#004fc4':'#4da3ff'}">${s}</span></td>`;
      const bg=d===-1?(L?'#cc0000':'#7a1a1a'):d===-2?(L?'#004fc4':'#1a3560'):(L?'#8a5c00':'#7a5800');
      const cl=d===-1?(L?'#fff':'#ff8080'):d===-2?(L?'#fff':'#60b4ff'):'#fff';
      return`<td style="border:${tdBd};padding:6px 2px;text-align:center;background:inherit"><span style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;font-size:16px;font-weight:800;background:${bg};color:${cl}">${s}</span></td>`;
    }
    function ovDiv(d,tot){
      const oc=d>0?(tot?totOvP:ovP):d<0?(tot?totOvN:ovN):'rgba(150,150,150,.6)';
      const ot=d===0?'E':(d>0?'+':'')+d;
      return`<div style="font-size:10px;font-weight:700;color:${oc}">เกิน ${ot}</div>`;
    }

    const thS=`background:${thBg};color:${thCl};border:1px solid #333;padding:9px 2px;font-size:13px;font-weight:700;text-align:center`;
    const colgroup=`<colgroup><col style="width:${HW}px"><col style="width:${PW}px">${players.map(()=>`<col style="width:${nW}px">`).join('')}</colgroup>`;
    const thead=`<thead><tr><th style="${thS}">H</th><th style="${thS}">P</th>${players.map(p=>`<th style="${thS};overflow:hidden;white-space:nowrap;text-overflow:ellipsis;max-width:0">${p.name.slice(0,4)}</th>`).join('')}</tr></thead>`;

    let tbody='<tbody>';
    for(let h=0;h<18;h++){
      const par=pars[h], bg=h%2===0?rowO:rowE;
      tbody+=`<tr style="background:${bg}"><td style="background:${hcBg};color:${hcCl};border:${tdBd};padding:8px 2px;font-size:13px;font-weight:600;text-align:center">${h+1}</td><td style="background:${hcBg};color:${hcCl};border:${tdBd};padding:8px 2px;font-size:13px;font-weight:600;text-align:center">${par}</td>${players.map((_,p)=>scHTML(scores[p][h],par)).join('')}</tr>`;
      if(h===8){
        const f9s=players.map((_,p)=>({v:scores[p].slice(0,9).reduce((s,v)=>s+(v||0),0),valid:scores[p].slice(0,9).some(v=>v!==null)}));
        tbody+=`<tr style="background:${subBg}"><td colspan="2" style="border:1px solid ${L?'#999':'#444'};padding:8px 2px;font-size:13px;font-weight:800;color:${subCl};text-align:center">9 แรก</td>${f9s.map(({v,valid})=>{const d=v-par9a;return`<td style="border:1px solid ${L?'#999':'#444'};padding:6px 2px;text-align:center;background:${subBg}">${valid?`<div style="font-size:18px;font-weight:800;color:${subCl}">${v}</div>${ovDiv(d,false)}`:`<span style="font-size:18px;color:rgba(150,150,150,.4)">—</span>`}</td>`;}).join('')}</tr>`;
      }
    }
    const b9s=players.map((_,p)=>scores[p].slice(9).reduce((s,v)=>s+(v||0),0));
    const tots=players.map((_,p)=>scores[p].reduce((s,v)=>s+(v||0),0));
    tbody+=`<tr style="background:${subBg}"><td colspan="2" style="border:1px solid ${L?'#999':'#444'};padding:8px 2px;font-size:13px;font-weight:800;color:${subCl};text-align:center">9 หลัง</td>${b9s.map((v,p)=>{const valid=scores[p].slice(9).some(s=>s!==null);const d=v-par9b;return`<td style="border:1px solid ${L?'#999':'#444'};padding:6px 2px;text-align:center;background:${subBg}">${valid?`<div style="font-size:18px;font-weight:800;color:${subCl}">${v}</div>${ovDiv(d,false)}`:`<span style="font-size:18px;color:rgba(150,150,150,.4)">—</span>`}</td>`;}).join('')}</tr>`;
    tbody+=`<tr style="background:${totBg}"><td colspan="2" style="border:1px solid #333;padding:9px 2px;font-size:13px;font-weight:800;color:${totCl};text-align:center">รวม</td>${tots.map((v,p)=>{const pl=pars.reduce((s,pv,h)=>s+(scores[p][h]!==null&&scores[p][h]!==undefined?pv:0),0);const d=v-pl;return`<td style="border:1px solid #333;padding:6px 2px;text-align:center;background:${totBg}"><div style="font-size:22px;font-weight:800;color:${totCl}">${v}</div>${ovDiv(d,true)}</td>`;}).join('')}</tr></tbody>`;

    const html=`<div style="text-align:center;margin-bottom:14px"><div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${L?'#888':'#555'};margin-bottom:3px">⛳ ผลการแข่งขัน</div><div style="font-size:22px;font-weight:800;color:${L?'#111':'#fff'}">${cn}</div><div style="font-size:12px;color:${L?'#888':'#555'};margin-top:2px">${ds}</div></div><div style="display:flex;justify-content:center;border-radius:12px;overflow:hidden;margin-bottom:14px"><table style="width:${tblW}px;border-collapse:collapse;table-layout:fixed">${colgroup}${thead}${tbody}</table></div><div style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:linear-gradient(135deg,#1a6a3a,#2d9e5c);border-radius:12px"><span style="font-size:22px">⛳</span><div style="flex:1;font-size:12px;font-weight:700;color:#fff">ประกันกอล์ฟ ครอบคลุม Hole-in-One<br><span style="font-size:10px;opacity:.8">ศรีกรุงโบรคเกอร์ · www.ศรีกรุง.com</span></div><span style="padding:6px 12px;border-radius:8px;background:rgba(255,255,255,0.2);border:1.5px solid rgba(255,255,255,0.5);color:#fff;font-size:11px;font-weight:700">ดูเลย</span></div>`;

    const wrap=document.createElement('div');
    wrap.style.cssText=`position:fixed;left:-9999px;top:0;width:${A4_W}px;padding:16px;font-family:'Noto Sans Thai',-apple-system,sans-serif;background:${L?'#f2f2f7':'#111827'};z-index:-1;box-sizing:border-box`;
    wrap.innerHTML=html;
    document.body.appendChild(wrap);

    const c=await html2canvas(wrap,{backgroundColor:L?'#f2f2f7':'#111827',scale:2,useCORS:true,logging:false,width:A4_W});
    document.body.removeChild(wrap);

    c.toBlob(async b=>{
      const f=new File([b],'golfmate.png',{type:'image/png'});
      if(ov) ov.classList.remove('show');
      if(navigator.canShare&&navigator.canShare({files:[f]})){
        try{ await navigator.share({files:[f]}); }catch(e){}
      } else { alert('ไม่สามารถแชร์ตรงๆ ได้ โปรดบันทึกหน้าจอแทนครับ'); }
    },'image/png');
  } catch(e){ if(ov) ov.classList.remove('show'); }
}

// ── EXPOSE ทันทีที่ module โหลด (ไม่รอ DOMContentLoaded) ──
// เพื่อให้ HTML onclick เรียกได้ก่อน DOM ready
Object.assign(window, {
  setToday, fmtDate, toggleSw, toggleSkipPlayer, toggleSkipGame,
  toggleTeamSolo, toggleTeamScorecard, setTeamMode, setH2HSize, startGame, newGame,
  showAddPlayerModal, hideAddPlayerModal, confirmAddPlayer,
  updateAddPlayerBtn, saveSession, loadSession, clearSession, clearGameData, initRestoreBtn, autoSave,
  shareToLine,
  changeCoursePreset, applyParsFromPreset,
  goTab, goGuide, goResults, goMoney, showMoneyDetail,
  buildParGrid, renderPlayerRows, buildTurboGrid,
  buildProgressBar, updateProgressBar, holeNav, toggleTH,
  chScore, startRpt, stopRpt, sws, swm, swe, setParAll, chPar, drSet,
  toggleGameMidPlay, olyAct, olyReset, olyRenderHole,
  fnChangeMode, fnToggleSank, fnSelectPlayer, fnRenderHole,
  toggleBiteMult, setBiteMult, updateBiteMultUI,
  setHoleMatrixPill, setMatrixPill, lbToggleMatrix,
  hcapTogglePair, hcapFlipDir, hcapSetStroke, hcapSetField, buildHcapUI,
  sgToggle, sgChPutt, sgSetPutt1,
  goLeaderboard, lbGoPrev, lbGoNext, lbSetTab, lbSetRoom, lbFetch,
  toggleSyncSw, updateRoomCode, autoGenRoomCode,
  goOnlineSetup, saveOnlineSetup, testConnection, createRoom,
  joinRoomLookup, selectJoinPlayer,
  showExportModal, hideExportModal, setExportWho, doExport,
  toggleTheme, _refreshOlyInline, toggleSkipSection, toggleMatrixSection, chParNav,
});

// ── COLLAPSE HELPERS ──
export function toggleSkipSection(h){
  const body=document.getElementById(`skip-body-${h}`);
  const arr=document.getElementById(`skip-arr-${h}`);
  if(!body||!arr)return;
  const open=body.style.display==='block';
  body.style.display=open?'none':'block';
  arr.textContent=open?'▶':'▼';
}
export function toggleMatrixSection(h){
  const body=document.getElementById(`sum-rows-${h}`);
  const pills=document.getElementById(`sum-pills-${h}`);
  const arr=document.getElementById(`mx-arr-${h}`);
  if(!body)return;
  const open=body.style.display==='none'||body.style.display==='';
  body.style.display=open?'block':'none';
  if(pills)pills.style.display=open?'flex':'none';
  if(arr)arr.textContent=open?'▼':'▶';
}

// ── chParNav: แก้ PAR จาก nav bar ──
export function chParNav(d){
  const h = getCurrentHole();
  chPar(h, d);
}
