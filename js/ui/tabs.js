// ============================================================
// ui/tabs.js — navigation, setup, course, players, turbo, progress
// ============================================================
import { G, players, scores, pars, courseDB,
         isGameStarted, getCurrentHole, setCurrentHole,
         LS_KEY } from '../config.js';
import { buildHcapUI } from '../modules/handicap.js';
import { updateBiteMultUI } from '../modules/games.js';
import { buildResults, buildMoney, showHole, updateTotals } from './render.js';
import { syncAll } from '../firebase/sync.js';
import { lbStopTimers } from '../modules/leaderboard.js';

// ── clearSession ไม่ import จาก app.js เพราะ circular
// ใช้ window.clearSession() ที่ถูก expose ใน app.js DOMContentLoaded แทน
function _clearSession(){ window.clearSession?.(); }

// ============================================================
// NAVIGATION
// ============================================================
export function goTab(n){
  if(n !== 'lb'){ lbStopTimers(); }
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.ti').forEach(b => b.classList.remove('on'));
  document.getElementById(`scr-${n}`)?.classList.add('active');
  const tabEl = document.getElementById(`tab-${n}`);
  if(tabEl) tabEl.classList.add('on');
  const titles = {setup:'ตั้งค่า',scorecard:'สกอร์',results:'ผลลัพธ์',money:'ยอดเงิน',guide:'คู่มือ',online:'Online'};
  const titleEl = document.getElementById('hdr-title');
  if(titleEl) titleEl.textContent = titles[n] || n;
  if(n === 'setup'){
    const subEl = document.getElementById('hdr-sub');
    if(subEl) subEl.textContent = 'เลือกสนาม · ผู้เล่น · เกม';
    ['bite','turbo','olympic','team','farNear','doubleRe','srikrung','hcap'].forEach(k => {
      const sw = document.getElementById(`sw-${k}`);
      if(sw) sw.classList.toggle('on', !!G[k]?.on);
      const body = document.getElementById(`gb-${k}`);
      if(body) body.style.display = G[k]?.on ? 'block' : 'none';
    });
    if(G.hcap.on) buildHcapUI();
    updateBiteMultUI();
  }
}

export function goGuide(){
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.ti').forEach(b => b.classList.remove('on'));
  document.getElementById('scr-guide')?.classList.add('active');
  const titleEl = document.getElementById('hdr-title');
  const subEl   = document.getElementById('hdr-sub');
  if(titleEl) titleEl.textContent = 'คู่มือ';
  if(subEl)   subEl.textContent   = 'GolfMate ฉบับสมบูรณ์';
  window.scrollTo(0, 0);
}

export function goResults(){
  if(!isGameStarted()){ alert('กรุณาเริ่มเกมก่อนครับ'); return; }
  buildResults(); goTab('results');
}

export function goMoney(){
  if(!isGameStarted()){ alert('กรุณาเริ่มเกมก่อนครับ'); return; }
  buildMoney(); goTab('money');
}

// ============================================================
// COURSE PRESET
// ============================================================
export function changeCoursePreset(){
  const sel = document.getElementById('course-preset');
  if(!sel) return;
  const v  = sel.value;
  const nm = sel.options[sel.selectedIndex].text;
  const sub     = document.getElementById('course-sub-wrap');
  const nameRow = document.getElementById('course-name-row');
  const nameEl  = document.getElementById('course-name');
  if(v === 'custom'){
    if(nameEl) nameEl.value = '';
    if(nameRow) nameRow.style.display = 'flex';
    if(sub)     sub.style.display = 'none';
  } else if(v === 'panya' || v === 'narai'){
    if(nameEl) nameEl.value = nm;
    if(nameRow) nameRow.style.display = 'none';
    if(sub)     sub.style.display = 'flex';
    applyParsFromPreset();
  } else {
    if(nameEl) nameEl.value = nm;
    if(nameRow) nameRow.style.display = 'none';
    if(sub)     sub.style.display = 'none';
    pars.splice(0, 18, ...courseDB[v]);
    buildParGrid();
  }
}

export function applyParsFromPreset(){
  const v = document.getElementById('course-preset')?.value;
  if(v === 'panya' || v === 'narai'){
    const f9 = document.getElementById('course-f9')?.value || 'A';
    const b9 = document.getElementById('course-b9')?.value || 'B';
    const newPars = [...courseDB[v][f9], ...courseDB[v][b9]];
    pars.splice(0, 18, ...newPars);
    buildParGrid();
  }
}

// ============================================================
// GRIDS
// ============================================================
export function buildParGrid(){
  ['par-front','par-back'].forEach((id, half) => {
    const el = document.getElementById(id); if(!el) return;
    el.innerHTML = '';
    for(let i = half*9; i < half*9+9; i++){
      el.innerHTML += `<div class="par-hole">
        <div class="par-hole-num">H${i+1}</div>
        <input type="number" min="3" max="5" value="${pars[i]}"
          onchange="pars[${i}]=Math.max(3,Math.min(5,parseInt(this.value)||4))">
      </div>`;
    }
  });
}

export function renderPlayerRows(){
  const n = +(document.getElementById('num-players')?.value || 4);
  const wrap = document.getElementById('player-rows'); if(!wrap) return;
  const prev = [...wrap.querySelectorAll('[data-prow]')].map(r => ({
    name: r.querySelector('.pn')?.value || '',
    hcp:  r.querySelector('.ph')?.value || '0'
  }));
  wrap.innerHTML = '';
  for(let i = 0; i < n; i++){
    const vName = prev[i]?.name || '';
    const vHcp  = prev[i]?.hcp  || '0';
    wrap.innerHTML += `<div class="group" style="margin-bottom:8px" data-prow>
      <div class="row">
        <div style="width:26px;height:26px;border-radius:50%;background:var(--blue);
          display:flex;align-items:center;justify-content:center;
          font-size:12px;font-weight:700;color:#fff;flex-shrink:0;margin-right:12px">${i+1}</div>
        <input type="text" class="pn" value="${vName}" placeholder="ผู้เล่น ${i+1}"
          style="flex:1;background:transparent;border:none;padding:0;border-radius:0;font-size:15px;color:var(--lbl)">
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
          <span style="font-size:12px;color:var(--lbl2)">HCP</span>
          <input type="number" class="ph" min="0" value="${vHcp}"
            style="width:56px;border-radius:8px;padding:6px;text-align:center;font-size:14px">
        </div>
      </div>
    </div>`;
  }
}

export function buildTurboGrid(){
  ['tg-front','tg-back'].forEach((id, half) => {
    const el = document.getElementById(id); if(!el) return;
    el.innerHTML = '';
    for(let i = half*9; i < half*9+9; i++){
      el.innerHTML += `<div class="t-cell">
        <div class="t-cell-num">H${i+1}</div>
        <div class="t-cb${G.turbo.holes.has(i)?' on':''}" id="tc-${i}" onclick="toggleTH(${i})">⚡</div>
      </div>`;
    }
  });
}

export function toggleTH(h){
  if(G.turbo.holes.has(h)) G.turbo.holes.delete(h);
  else G.turbo.holes.add(h);
  const on = G.turbo.holes.has(h);
  document.getElementById(`tc-${h}`)?.classList.toggle('on', on);
  const t2 = document.getElementById(`tc2-${h}`);
  if(t2){ t2.classList.toggle('on', on); t2.textContent = on ? 'เทอร์โบ ON' : 'เทอร์โบ'; }
  updateTotals();
}

// ============================================================
// PROGRESS BAR
// ============================================================
export function buildProgressBar(){
  const dots = document.getElementById('progress-dots'); if(!dots) return;
  dots.innerHTML = '';
  for(let h = 0; h < 18; h++){
    const d = document.createElement('div');
    d.className = 'pd'; d.id = `pd-${h}`;
    d.onclick = () => { setCurrentHole(h); showHole(h); };
    dots.appendChild(d);
  }
  updateProgressBar();
}

export function updateProgressBar(){
  const cur = getCurrentHole();
  for(let h = 0; h < 18; h++){
    const d = document.getElementById(`pd-${h}`); if(!d) continue;
    d.className = 'pd';
    const has = players.some((_,p) => scores[p] && scores[p][h] !== null);
    if(h === cur)       d.classList.add('cur');
    else if(has)        d.classList.add('scored');
    else if(h < cur)    d.classList.add('done');
  }
  const lblEl  = document.getElementById('prog-label');
  const totEl  = document.getElementById('prog-total');
  const subEl  = document.getElementById('hdr-sub');
  const cnEl   = document.getElementById('course-name');
  if(lblEl) lblEl.textContent = `${cur+1} / 18`;
  if(totEl) totEl.textContent = `Par ${pars[cur]}`;
  if(subEl) subEl.textContent = `${cnEl?.value||'—'} · หลุม ${cur+1}`;
}

// ============================================================
// HOLE NAVIGATION
// ============================================================
export function holeNav(dir){
  const cur  = getCurrentHole();
  const next = cur + dir;
  if(next < 0) return;
  if(next > 17){ syncAll(); goResults(); return; }
  syncAll(); setCurrentHole(next); showHole(next);
}

// ============================================================
// SWIPE GESTURE (สลับ tab)
// ============================================================
const TABS = ['setup','scorecard','results','money'];
let _swX = 0, _swY = 0, _swOK = false;

export function initSwipe(){
  document.addEventListener('touchstart', e => {
    if(e.target.closest('.stepper,.h-par-ctrl,.oly-r-row,.fn-wrap,.dr-row,.score-rows,.ta-btns,input,select,button')) return;
    _swX = e.touches[0].clientX;
    _swY = e.touches[0].clientY;
    _swOK = true;
  }, {passive:true});

  document.addEventListener('touchend', e => {
    if(!_swOK) return; _swOK = false;
    const dx = e.changedTouches[0].clientX - _swX;
    const dy = e.changedTouches[0].clientY - _swY;
    if(Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)*0.65) return;
    const cur = TABS.findIndex(t => document.getElementById(`scr-${t}`)?.classList.contains('active'));
    if(cur === -1) return;
    const next = dx < 0 ? cur+1 : cur-1;
    if(next < 0 || next >= TABS.length) return;
    const dest = TABS[next];
    if((dest==='scorecard'||dest==='results'||dest==='money') && !isGameStarted()) return;
    if(dest === 'results') goResults();
    else if(dest === 'money') goMoney();
    else goTab(dest);
  }, {passive:true});
}
