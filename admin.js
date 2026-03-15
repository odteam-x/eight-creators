/**
 * EIGHT CREATORS LABs — Lógica Panel de Administración
 */
'use strict';

let CU=null, D=null, aPE='PE1', aMember=null, _arTimer=null, _lastUpdated=null, _menuOpen=false;
let _pendingScores={}, _pendingFeedback={};

const CRITERIOS_DEFAULT = [
  { key:'pla', label:'Planificación',       abbr:'PLA', color:'#E05A6A' },
  { key:'rev', label:'Revisión',            abbr:'REV', color:'#38BDF8' },
  { key:'edi', label:'Edición Creativa',    abbr:'EDI', color:'#2ECC71' },
  { key:'dis', label:'Diseño Creativo',     abbr:'DIS', color:'#5B7FFF' },
  { key:'flu', label:'Fluidez Oral',        abbr:'FLU', color:'#C084FC' },
  { key:'nar', label:'Narrativa / Guión',   abbr:'NAR', color:'#F0C040' },
  { key:'eje', label:'Ejecución en Redes',  abbr:'EJE', color:'#FB923C' },
];

const getCriterios = () => D?.criterios?.length ? D.criterios : CRITERIOS_DEFAULT;
const getMaxScore  = () => getCriterios().length * 4;
const MAX_TOTAL    = () => getMaxScore() + 2;

/* ── BOOT ── */
document.addEventListener('DOMContentLoaded', async () => {
  CU = Auth.requireRole('admin');
  if (!CU) return;
  const cached = Auth.getCachedData();
  if (cached) { D = cached; renderAll(); }
  await loadData();
  renderAll();
  startAutoRefresh();
  initScrollEffects();
});

async function loadData() {
  try {
    const data = await API.getData();
    if (data.ok !== false) { D=data; Auth.setCachedData(data); _lastUpdated=new Date(); }
  } catch(e) { console.error('[Admin]',e); }
}

function startAutoRefresh() {
  if (_arTimer) clearInterval(_arTimer);
  _arTimer = setInterval(async()=>{ await loadData(); renderAll(); },PORTAL_CONFIG.AUTO_REFRESH_MS);
}

function renderAll() {
  if (!D) return;
  const rows = D.scores?.[aPE] || [];
  renderOverview(rows); renderRanking(rows); renderCriterios(rows);
  renderMemberChips(); if (aMember) renderMemberDetail(aMember);
  renderRubrica(); renderDebug(); updateTimestamp();
}

/* ── OVERVIEW ── */
function renderOverview(rows) {
  setEl('ov-pe', aPE);
  const MAX=MAX_TOTAL(), scores=rows.map(calcScore), total=rows.length;
  const avg=total?(scores.reduce((a,b)=>a+b,0)/total).toFixed(1):'—';
  const maxS=total?Math.max(...scores):'—', topR=rows.find(r=>calcScore(r)===Math.max(...scores));
  const exc=scores.filter(s=>s>=26).length, bue=scores.filter(s=>s>=20&&s<26).length;
  const enP=scores.filter(s=>s>=11&&s<20).length, baj=scores.filter(s=>s<11).length;

  const statsEl=document.getElementById('ov-stats');
  if (statsEl) statsEl.innerHTML=[
    {lbl:'Miembros evaluados',val:total, sub:aPE,                        col:''},
    {lbl:'Promedio del equipo',val:avg,  sub:`/ ${MAX} pts`,              col:avg!=='—'?scoreColor(parseFloat(avg)):''},
    {lbl:'Puntaje máximo',     val:maxS, sub:topR?.nombre||'—',           col:'var(--sex)'},
    {lbl:'Nivel Excelente',    val:exc,  sub:`de ${total} miembros`,      col:'var(--sex)'},
  ].map(s=>`<div class="scard"><div class="sc-lbl">${s.lbl}</div><div class="sc-val"${s.col?` style="color:${s.col}"`:''}>${s.val}</div><div class="sc-sub">${s.sub}</div></div>`).join('');

  const distEl=document.getElementById('ov-dist');
  if (distEl) distEl.innerHTML=`<div class="dist-bars">${[
    {lbl:'Excelente ≥24',n:exc,col:'var(--sex)',pct:total?exc/total:0},
    {lbl:'Bueno ≥18',    n:bue,col:'var(--sbu)',pct:total?bue/total:0},
    {lbl:'En Proceso ≥10',n:enP,col:'var(--spr)',pct:total?enP/total:0},
    {lbl:'Bajo <10',     n:baj,col:'var(--sba)',pct:total?baj/total:0},
  ].map(d=>`<div class="dist-bar-row"><div class="dist-bar-lbl" style="color:${d.col}">${d.lbl}</div><div class="dist-bar-track"><div class="dist-bar-fill" style="width:${d.pct*100}%;background:${d.col}"></div></div><div class="dist-bar-count" style="color:${d.col}">${d.n}</div></div>`).join('')}</div>`;

  const critEl=document.getElementById('ov-criterios');
  if (critEl) critEl.innerHTML=`<div class="crit-summary-grid">${getCriterios().map(c=>{
    const a=total?(rows.reduce((s,r)=>s+(r[c.key]||0),0)/total).toFixed(2):0;
    return `<div class="cs-row"><div class="cs-lbl" style="color:${c.color}">${c.label}</div><div class="cs-track"><div class="cs-fill" style="width:${(a/4)*100}%;background:${c.color}"></div></div><div class="cs-val" style="color:${c.color}">${a}</div></div>`;
  }).join('')}</div>`;
}

/* ── RANKING ── */
function renderRanking(rows) {
  setEl('rk-pe', aPE);
  const tbl=document.getElementById('ranking-tbl'); if(!tbl) return;
  const criterios=getCriterios(), sorted=[...rows].sort((a,b)=>calcScore(b)-calcScore(a));
  const cols=`1fr 52px ${criterios.map(()=>'38px').join(' ')} 44px`;
  if (!sorted.length) { tbl.innerHTML='<div class="empty-box"><div class="empty-icon">🏆</div><div class="empty-txt">Sin datos</div></div>'; return; }
  tbl.innerHTML=`
    <div class="tbl-h" style="grid-template-columns:${cols};padding:8px 14px">
      <div class="tbl-th">Miembro</div>
      <div class="tbl-th" style="text-align:center">Pts</div>
      ${criterios.map(c=>`<div class="tbl-th" style="color:${c.color};text-align:center">${c.abbr}</div>`).join('')}
      <div class="tbl-th" style="color:var(--gold);text-align:center">⭐</div>
    </div>
    ${sorted.map((r,i)=>{
      const s=calcScore(r), rc=i===0?'gold':i===1?'silver':i===2?'bronze':'';
      return `<div class="tbl-r" style="grid-template-columns:${cols};animation-delay:${i*20}ms" onclick="goToMember('${esc(r.usuario)}')">
        <div class="tbl-td tbl-name-cell"><span class="rank-num ${rc}">#${i+1}</span><span>${r.nombre||r.usuario}</span></div>
        <div class="tbl-td tbl-score-cell"><span class="sbadge ${scoreClass(s)}">${s}</span></div>
        ${criterios.map(c=>`<div class="tbl-td" style="text-align:center;padding:8px 4px"><span class="cdot ${dCls(r[c.key])}">${r[c.key]||0}</span></div>`).join('')}
        <div class="tbl-td" style="text-align:center;padding:8px 4px"><span style="font-family:'Bebas Neue',sans-serif;font-size:1rem;color:${r.ext>0?'var(--gold)':'var(--muted)'}">${r.ext||0}</span></div>
      </div>`;
    }).join('')}`;
}

/* ── CRITERIOS ── */
function renderCriterios(rows) {
  setEl('cr-pe', aPE);
  const grid=document.getElementById('crit-grid'); if(!grid) return;
  const criterios=getCriterios(), total=rows.length;
  grid.innerHTML=criterios.map(c=>{
    const avg=total?(rows.reduce((s,r)=>s+(r[c.key]||0),0)/total).toFixed(2):'—';
    const sorted=[...rows].sort((a,b)=>(b[c.key]||0)-(a[c.key]||0));
    const bars=sorted.slice(0,8).map(r=>`<div class="crit-mini-row"><div class="crit-mini-name">${r.nombre||r.usuario}</div><div class="crit-mini-track"><div class="crit-mini-fill" style="width:${((r[c.key]||0)/4)*100}%;background:${c.color}"></div></div><div class="crit-mini-val">${r[c.key]||0}</div></div>`).join('');
    return `<div class="crit-detail-card"><div class="crit-detail-head"><div class="crit-detail-dot" style="background:${c.color}"></div><div class="crit-detail-name" style="color:${c.color}">${c.label}</div><div class="crit-avg-big" style="color:${c.color}">${avg}<span style="font-size:.75rem;color:var(--muted)">/4</span></div></div><div class="crit-mini-bars">${bars||'<div class="empty-txt">Sin datos</div>'}</div></div>`;
  }).join('');
}

/* ── MEMBER CHIPS ── */
function renderMemberChips() {
  const all=getAllMembers(), chips=document.getElementById('member-chips'); if(!chips) return;
  chips.innerHTML=all.map(u=>`<button class="member-chip ${u===aMember?'active':''}" onclick="selectMember('${esc(u)}')">${u}</button>`).join('');
  if (!aMember && all.length) selectMember(all[0]);
}
function selectMember(usuario) {
  aMember=usuario;
  document.querySelectorAll('.member-chip').forEach(c=>c.classList.toggle('active',c.textContent.trim()===usuario));
  renderMemberDetail(usuario);
}
function getAllMembers() {
  const s=new Set();
  PORTAL_CONFIG.PERIODOS.forEach(pe=>(D?.scores?.[pe]||[]).forEach(r=>s.add(r.usuario)));
  return [...s].sort();
}

/* ── MEMBER DETAIL ── */
function renderMemberDetail(usuario) {
  const el=document.getElementById('member-detail'); if(!el) return;
  const criterios=getCriterios(), MAX=MAX_TOTAL();
  const sRow=D?.scores?.[aPE]?.find(r=>r.usuario===usuario);
  const fRow=D?.feedback?.[aPE]?.find(r=>r.usuario===usuario);
  const nombre=sRow?.nombre||usuario, total=sRow?calcScore(sRow):null;

  const peCards=PORTAL_CONFIG.PERIODOS.map(pe=>{
    const d=D?.scores?.[pe]?.find(r=>r.usuario===usuario), s=d?calcScore(d):null;
    return `<div class="mpc-card"><div class="mpc-pe">${pe}</div><div class="mpc-score" style="color:${s!==null?scoreColor(s):'var(--muted)'}">${s!==null?s:'—'}</div><div class="mpc-label">${s!==null?`${scoreLabel(s)} / ${MAX}pts`:'Sin datos'}</div></div>`;
  }).join('');

  el.innerHTML=`
    <div class="member-detail-card">
      <div class="member-detail-head">
        <div style="display:flex;align-items:center;gap:14px">
          <div class="avatar" style="width:44px;height:44px;font-size:1rem">${initials(nombre)}</div>
          <div><div class="member-detail-name">${nombre}</div><div style="font-size:.65rem;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase">${sRow?.rol||'Miembro'}${sRow?.distrito?' · '+sRow.distrito:''}</div></div>
        </div>
        ${total!==null?`<div style="text-align:right">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:2.2rem;color:${scoreColor(total)};line-height:1">${total}</div>
          <div style="font-size:.65rem;color:var(--muted)">/ ${MAX} pts · ${scoreLabel(total)}</div>
          ${sRow?.ext>0?`<div style="margin-top:4px"><span class="bono-badge"><span class="bono-icon">⭐</span>Bono +${sRow.ext}</span></div>`:''}
        </div>`:''}
      </div>
      <div class="member-detail-body">
        <div class="section-label" style="margin-top:0">Comparativa por período</div>
        <div class="member-pe-compare">${peCards}</div>

        <div class="edit-section">
          <div class="edit-section-header"><div class="edit-section-title">✏️ &nbsp;Scores — ${aPE}</div></div>
          ${renderScoreEditor(usuario, sRow)}
          <div class="save-bar hidden" id="save-bar-scores-${esc(usuario)}">
            <span class="save-bar-msg">⚠ Cambios sin guardar</span>
            <button class="btn-cancel-changes" onclick="cancelScoreChanges('${esc(usuario)}')">Cancelar</button>
            <button class="btn-save" id="btn-save-s-${esc(usuario)}" onclick="saveScores('${esc(usuario)}')">Guardar scores</button>
          </div>
        </div>

        <div class="edit-section">
          <div class="edit-section-header"><div class="edit-section-title">💬 &nbsp;Feedback — ${aPE}</div></div>
          ${renderFeedbackEditor(usuario, fRow)}
          <div class="save-bar hidden" id="save-bar-fb-${esc(usuario)}">
            <span class="save-bar-msg">⚠ Feedback sin guardar</span>
            <button class="btn-cancel-changes" onclick="cancelFbChanges('${esc(usuario)}')">Cancelar</button>
            <button class="btn-save" id="btn-save-f-${esc(usuario)}" onclick="saveFeedback('${esc(usuario)}')">Guardar feedback</button>
          </div>
        </div>
      </div>
    </div>`;
}

function renderScoreEditor(usuario, sRow) {
  if (!sRow) return `<div class="no-data-msg"><div class="no-data-txt">Sin datos de score para ${aPE}.</div></div>`;
  const rows=getCriterios().map(c=>`
    <tr>
      <td><span style="display:inline-flex;align-items:center;gap:8px"><span style="width:8px;height:8px;border-radius:50%;background:${c.color};display:inline-block"></span><span style="color:${c.color};font-weight:700">${c.abbr}</span> <span style="color:var(--muted)">${c.label}</span></span></td>
      <td><input type="number" class="score-inp" data-usuario="${esc(usuario)}" data-criterio="${c.key}" data-original="${sRow[c.key]??0}" value="${sRow[c.key]??0}" min="0" max="4" step="1" id="si-${esc(usuario)}-${c.key}" onchange="onScoreChange(this)" oninput="onScoreChange(this)"></td>
    </tr>`).join('');
  const extVal = sRow.ext ?? 0;
  const bonoRow = `
    <tr style="background:rgba(240,192,64,.05);border-top:1px solid rgba(240,192,64,.2)">
      <td><span style="display:inline-flex;align-items:center;gap:8px"><span style="font-size:.9rem">⭐</span><span style="color:var(--gold);font-weight:700">BONO</span> <span style="color:var(--muted)">Excelencia (+2 máx.)</span></span></td>
      <td><input type="number" class="score-inp" style="border-color:rgba(240,192,64,.4);color:var(--gold)" data-usuario="${esc(usuario)}" data-criterio="ext" data-original="${extVal}" value="${extVal}" min="0" max="2" step="1" id="si-${esc(usuario)}-ext" onchange="onScoreChange(this)" oninput="onScoreChange(this)"></td>
    </tr>`;
  return `<div class="edit-table-wrap"><table class="edit-table"><thead><tr><th style="text-align:left">Criterio</th><th>Puntaje</th></tr></thead><tbody>${rows}${bonoRow}</tbody></table></div>`;
}

function renderFeedbackEditor(usuario, fRow) {
  return `<div class="fb-editor-grid">${getCriterios().map(c=>{
    const txt=fRow?.[c.key]||'';
    return `<div class="fb-editor-row">
      <div class="fb-editor-label"><span class="fb-editor-dot" style="background:${c.color}"></span><span class="fb-editor-crit-name" style="color:${c.color}">${c.abbr}</span><span class="fb-editor-abbr">— ${c.label}</span></div>
      <textarea class="fb-textarea" data-usuario="${esc(usuario)}" data-criterio="${c.key}" data-original="${esc(txt)}" id="fb-${esc(usuario)}-${c.key}" placeholder="Feedback para ${c.label}..." rows="2" onchange="onFbChange(this)" oninput="onFbChange(this)">${txt}</textarea>
    </div>`;
  }).join('')}</div>`;
}

/* ── SCORE CHANGES ── */
function onScoreChange(inp) {
  const {usuario, criterio} = inp.dataset;
  const orig  = parseFloat(inp.dataset.original)||0;
  const maxV  = criterio === 'ext' ? 2 : 4;
  const val   = Math.min(maxV, Math.max(0, parseInt(inp.value)||0));
  inp.value   = val;
  const key   = `${aPE}_${usuario}_${criterio}`;
  inp.classList.toggle('changed', val!==orig);
  if (val!==orig) _pendingScores[key]=val; else delete _pendingScores[key];
  showSaveBar(`save-bar-scores-${usuario}`, Object.keys(_pendingScores).some(k=>k.startsWith(`${aPE}_${usuario}_`)));
}
function cancelScoreChanges(usuario) {
  [...getCriterios().map(c=>c.key), 'ext'].forEach(key => {
    const inp=document.getElementById(`si-${usuario}-${key}`); if(!inp) return;
    inp.value=inp.dataset.original; inp.classList.remove('changed');
    delete _pendingScores[`${aPE}_${usuario}_${key}`];
  });
  showSaveBar(`save-bar-scores-${usuario}`,false);
}
async function saveScores(usuario) {
  const btn=document.getElementById(`btn-save-s-${usuario}`);
  if (btn) { btn.textContent='Guardando...'; btn.classList.add('saving'); }
  try {
    const changes=Object.entries(_pendingScores).filter(([k])=>k.startsWith(`${aPE}_${usuario}_`)).map(([k,v])=>({pe:aPE,usuario,criterio:k.split('_')[2],valor:v}));
    if (!changes.length) { showToast('Sin cambios','info'); return; }
    for (const v of changes) {
      if (v.valor<0||v.valor>4) { showToast(`Valor inválido: ${v.valor}`,'error'); return; }
    }
    let err=0;
    for (const c of changes) { const r=await API.updateScore(c.pe,c.usuario,c.criterio,c.valor); if(!r.ok) err++; }
    if (err) { showToast(`${err} error(s) al guardar`,'error'); }
    else {
      showToast(`✓ ${changes.length} score(s) guardados`,'ok');
      changes.forEach(c=>{ const inp=document.getElementById(`si-${usuario}-${c.criterio}`); if(inp){inp.dataset.original=c.valor;inp.classList.remove('changed');} delete _pendingScores[`${c.pe}_${c.usuario}_${c.criterio}`]; });
      showSaveBar(`save-bar-scores-${usuario}`,false);
      await loadData(); renderAll();
    }
  } catch(e){ showToast('Error al guardar','error'); console.error(e); }
  finally { if(btn){btn.textContent='Guardar scores';btn.classList.remove('saving');} }
}

/* ── FEEDBACK CHANGES ── */
function onFbChange(ta) {
  const {usuario,criterio} = ta.dataset;
  const changed = ta.value.trim()!==ta.dataset.original;
  ta.classList.toggle('changed',changed);
  const key=`${aPE}_${usuario}_${criterio}`;
  if (changed) _pendingFeedback[key]=ta.value; else delete _pendingFeedback[key];
  showSaveBar(`save-bar-fb-${usuario}`, Object.keys(_pendingFeedback).some(k=>k.startsWith(`${aPE}_${usuario}_`)));
}
function cancelFbChanges(usuario) {
  getCriterios().forEach(c=>{
    const ta=document.getElementById(`fb-${usuario}-${c.key}`); if(!ta) return;
    ta.value=ta.dataset.original; ta.classList.remove('changed');
    delete _pendingFeedback[`${aPE}_${usuario}_${c.key}`];
  });
  showSaveBar(`save-bar-fb-${usuario}`,false);
}
async function saveFeedback(usuario) {
  const btn=document.getElementById(`btn-save-f-${usuario}`);
  if (btn) { btn.textContent='Guardando...'; btn.classList.add('saving'); }
  try {
    const changes=Object.entries(_pendingFeedback).filter(([k])=>k.startsWith(`${aPE}_${usuario}_`)).map(([k,v])=>({pe:aPE,usuario,criterio:k.split('_')[2],texto:v}));
    if (!changes.length) { showToast('Sin cambios','info'); return; }
    let err=0;
    for (const c of changes) { const r=await API.updateFeedback(c.pe,c.usuario,c.criterio,c.texto); if(!r.ok) err++; }
    if (err) { showToast(`${err} error(s) al guardar`,'error'); }
    else {
      showToast(`✓ ${changes.length} feedback(s) guardados`,'ok');
      changes.forEach(c=>{ const ta=document.getElementById(`fb-${usuario}-${c.criterio}`); if(ta){ta.dataset.original=c.texto.trim();ta.classList.remove('changed');} delete _pendingFeedback[`${c.pe}_${c.usuario}_${c.criterio}`]; });
      showSaveBar(`save-bar-fb-${usuario}`,false);
      await loadData();
    }
  } catch(e){ showToast('Error al guardar','error'); console.error(e); }
  finally { if(btn){btn.textContent='Guardar feedback';btn.classList.remove('saving');} }
}

/* ── RÚBRICA ── */
function renderRubrica() {
  const el=document.getElementById('rubrica-grid'); if(!el) return;
  const rubrica=D?.rubrica||[], criterios=getCriterios();
  if (!rubrica.length) { el.innerHTML='<div class="empty-box"><div class="empty-icon">📋</div><div class="empty-txt">Sin datos</div></div>'; return; }
  const levels=[{n:4,lbl:'Excelente',col:'var(--green)'},{n:3,lbl:'Bueno',col:'var(--blue)'},{n:2,lbl:'En Proceso',col:'var(--gold)'},{n:1,lbl:'Bajo',col:'var(--red)'}];
  const lk={4:'nivel4',3:'nivel3',2:'nivel2',1:'nivel1'};
  el.innerHTML=rubrica.map((r,i)=>{
    const c=criterios[i]||{}, color=c.color||'#888';
    return `<div class="rubrica-card" id="rc-${i}"><div class="rubrica-card-head" onclick="document.getElementById('rc-${i}').classList.toggle('open')"><div class="rubrica-dot" style="background:${color}"></div><div class="rubrica-title" style="color:${color}">${r.criterio}</div><span class="rubrica-chev">▾</span></div><div class="rubrica-body"><div class="rubrica-levels">${levels.map(l=>`<div class="rlevel"><div class="rlevel-badge" style="color:${l.col}">${l.n}</div><div class="rlevel-lbl" style="color:${l.col}">${l.lbl}</div><div class="rlevel-desc">${r[lk[l.n]]||'—'}</div></div>`).join('')}</div></div></div>`;
  }).join('');
}

/* ── DEBUG ── */
function renderDebug() {
  const el=document.getElementById('debug-content'); if(!el) return;
  const criterios=getCriterios(), isDefault=!(D?.criterios?.length);
  const mk=(t,v,col)=>`<div class="debug-card" style="border-color:${col}"><div class="debug-card-label">${t}</div><div class="debug-card-val" style="color:${col}">${v}</div></div>`;
  el.innerHTML=`
    <div class="ptitle" style="color:var(--gold)">🔍 DIAGNÓSTICO</div>
    <div class="debug-grid">
      ${mk('Usuarios',`${D?.users?.length||0} registros`,D?.users?.length?'var(--sex)':'var(--sba)')}
      ${mk('Criterios',isDefault?`Default (${criterios.length})`:`Hoja (${criterios.length})`,isDefault?'var(--gold)':'var(--sex)')}
      ${mk('Scores PE1',`${D?.scores?.PE1?.length||0} miembros`,D?.scores?.PE1?.length?'var(--sex)':'var(--muted)')}
      ${mk('Scores PE2',`${D?.scores?.PE2?.length||0} miembros`,'var(--sbu)')}
      ${mk('Scores PE3',`${D?.scores?.PE3?.length||0} miembros`,'var(--sbu)')}
      ${mk('Rúbrica',`${D?.rubrica?.length||0} criterios`,D?.rubrica?.length?'var(--sex)':'var(--sba)')}
      ${mk('Calendario',`${D?.calendario?.length||0} períodos`,D?.calendario?.length?'var(--sex)':'var(--muted)')}
    </div>
    <div class="section-label">Criterios activos</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:1.5rem">${criterios.map(c=>`<span style="background:rgba(0,0,0,.3);border:1px solid ${c.color};color:${c.color};padding:3px 10px;border-radius:4px;font-family:'Barlow Condensed',sans-serif;font-size:.65rem;letter-spacing:1px">${c.abbr} — ${c.label}</span>`).join('')}</div>
    <div class="debug-mono">Última carga: ${_lastUpdated?_lastUpdated.toLocaleString('es-DO'):'Nunca'}<br>Auto-refresh: cada ${PORTAL_CONFIG.AUTO_REFRESH_MS/1000}s<br>Criterios: ${isDefault?'⚠️ Usando defaults':'✅ Desde hoja CRITERIOS'}</div>`;
}

/* ── SELECCIÓN PE ── */
function selectPE(pe, btn) {
  aPE=pe; _pendingScores={}; _pendingFeedback={};
  document.querySelectorAll('.admin-pe-bar .pb').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active'); renderAll();
}

/* ── TABS ── */
function switchTab(tab, btn) {
  document.querySelectorAll('.atab-content').forEach(t=>t.classList.remove('active'));
  document.getElementById(`tab-${tab}`)?.classList.add('active');
  document.querySelectorAll('#desktop-nav .tnav').forEach(b=>b.classList.remove('active'));
  btn?.classList.add('active');
}
function switchTabMobile(tab, btn) {
  document.querySelectorAll('.atab-content').forEach(t=>t.classList.remove('active'));
  document.getElementById(`tab-${tab}`)?.classList.add('active');
  document.querySelectorAll('.mobile-menu .mobile-nav-btn').forEach(b=>b.classList.remove('active'));
  btn?.classList.add('active'); closeMenu();
  const tabs=['overview','ranking','criterios','miembros','rubrica','debug'], idx=tabs.indexOf(tab);
  document.querySelectorAll('#desktop-nav .tnav').forEach((b,i)=>b.classList.toggle('active',i===idx));
}
function goToMember(usuario) { switchTab('miembros', document.querySelector('#desktop-nav .tnav:nth-child(4)')); selectMember(usuario); }

/* ── REFRESH ── */
async function handleRefresh() {
  const btn=document.getElementById('btn-refresh');
  if (btn) { btn.classList.add('refreshing'); btn.disabled=true; }
  showToast('Actualizando...','info');
  await loadData(); renderAll();
  if (btn) { btn.classList.remove('refreshing'); btn.disabled=false; }
  showToast(`✓ ${D?.scores?.[aPE]?.length||0} miembros en ${aPE}`,'ok');
}

/* ── HELPERS ── */
const calcScore  = row => getCriterios().reduce((s,c)=>s+(row[c.key]||0),0) + (row.ext||0);
const scoreColor = s => s>=26?'var(--sex)':s>=20?'var(--sbu)':s>=11?'var(--spr)':'var(--sba)';
const scoreLabel = s => s>=26?'Excelente':s>=20?'Bueno':s>=11?'En Proceso':'Bajo';
const scoreClass = s => s>=26?'sex':s>=20?'sbu':s>=11?'spr':'sba';
const dCls       = v => `d${Math.min(4,Math.max(0,v||0))}`;
const initials   = n => n.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
const setEl      = (id,txt) => { const el=document.getElementById(id); if(el) el.textContent=txt; };
const esc        = s => String(s).replace(/'/g,"\\'");
const pad        = n => String(n).padStart(2,'0');
const showSaveBar= (id,show) => document.getElementById(id)?.classList.toggle('hidden',!show);

/* ── MENÚ ── */
function toggleMenu() {
  _menuOpen=!_menuOpen;
  document.getElementById('hamburger')?.classList.toggle('open',_menuOpen);
  document.getElementById('mobile-menu')?.classList.toggle('open',_menuOpen);
  document.getElementById('hamburger')?.setAttribute('aria-expanded',_menuOpen);
  document.body.style.overflow=_menuOpen?'hidden':'';
}
function closeMenu() {
  _menuOpen=false;
  document.getElementById('hamburger')?.classList.remove('open');
  document.getElementById('mobile-menu')?.classList.remove('open');
  document.getElementById('hamburger')?.setAttribute('aria-expanded','false');
  document.body.style.overflow='';
}
document.addEventListener('click',e=>{ const menu=document.getElementById('mobile-menu'),ham=document.getElementById('hamburger'); if(menu?.classList.contains('open')&&!menu.contains(e.target)&&!ham?.contains(e.target)) closeMenu(); });
window.addEventListener('resize',()=>{ if(window.innerWidth>720) closeMenu(); });

/* ── TIMESTAMP / TOAST / LOGOUT ── */
function updateTimestamp() {
  if (!_lastUpdated) return;
  const t=_lastUpdated, txt=`✓ ${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`;
  ['ts-badge','ts-badge-mob'].forEach(id=>{ const el=document.getElementById(id); if(!el) return; el.textContent=txt; el.classList.add('flash'); setTimeout(()=>el.classList.remove('flash'),1000); });
}
function showToast(msg, type='') {
  const t=document.getElementById('toast'); if(!t) return;
  t.textContent=msg; t.className=`toast${type?' toast--'+type:''} show`;
  setTimeout(()=>t.classList.remove('show'),3500);
}
function logout() { if(_arTimer) clearInterval(_arTimer); Auth.logout(); window.location.replace('index.html'); }
function initScrollEffects() {
  const topbar=document.getElementById('topbar'); let ticking=false;
  window.addEventListener('scroll',()=>{ if(!ticking){ requestAnimationFrame(()=>{ topbar?.classList.toggle('scrolled',window.scrollY>10); ticking=false; }); ticking=true; }},{passive:true});
}
