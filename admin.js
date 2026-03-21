/**
 * EIGHT CREATORS LABs — Lógica Panel de Administración
 */
'use strict';

let CU=null, D=null, aPE='PE1', aMember=null, _arTimer=null, _lastUpdated=null, _menuOpen=false;
let _evalMode='creators', _pendingDistScores={};
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
  renderDistritosAdmin(rows);
  renderMemberChips(); if (aMember) renderMemberDetail(aMember);
  renderRubricaAdmin(); renderConfig(); renderCalendarioAdmin(); renderDebug(); updateTimestamp();
}

/* ── OVERVIEW ── */
function renderOverview(allRows) {
  setEl('ov-pe', aPE);

  // ── Filtrar SOLO activos para stats/overview ──────────────────
  const rows  = allRows.filter(r => (r.estado||'Activo').toLowerCase() !== 'inactivo');
  const inact = allRows.filter(r => (r.estado||'Activo').toLowerCase() === 'inactivo');

  const MAX    = MAX_TOTAL();
  const scores = rows.map(calcScore);
  const total  = rows.length;
  const avg    = total ? (scores.reduce((a,b)=>a+b,0)/total).toFixed(1) : '—';

  const maxS   = total ? Math.max(...scores) : '—';
  const minS   = total ? Math.min(...scores) : '—';
  const topR   = rows.find(r => calcScore(r) === maxS);
  const botR   = rows.find(r => calcScore(r) === minS);

  // Niveles (usando thresholds de scoreLabel)
  const exc = scores.filter(s=>s>=26).length;
  const bue = scores.filter(s=>s>=20&&s<26).length;
  const enP = scores.filter(s=>s>=11&&s<20).length;
  const baj = scores.filter(s=>s<11).length;

  // ── Stat cards ────────────────────────────────────────────────
  const statsEl = document.getElementById('ov-stats');
  if (statsEl) statsEl.innerHTML = [
    { lbl:'Miembros activos',    val:total,                         sub:`${inact.length} inactivos`,           col:'' },
    { lbl:'Promedio del equipo', val:avg,                           sub:`/ ${MAX} pts`,                         col:avg!=='—'?scoreColor(parseFloat(avg)):'' },
    { lbl:'Puntaje máximo',      val:maxS!=='—'?maxS:'—',          sub:topR?.nombre||'—',                     col:'var(--sex)' },
    { lbl:'Puntaje mínimo',      val:minS!=='—'?minS:'—',          sub:botR?.nombre||'—',                     col:'var(--sba)' },
    { lbl:'Excelente (≥26)',      val:exc,                           sub:`${total?((exc/total)*100).toFixed(0):0}% del equipo`, col:'var(--sex)' },
    { lbl:'Requieren apoyo (<11)',val:baj,                           sub:`${total?((baj/total)*100).toFixed(0):0}% del equipo`, col:baj>0?'var(--sba)':'var(--muted)' },
  ].map(s=>`<div class="scard"><div class="sc-lbl">${s.lbl}</div><div class="sc-val"${s.col?` style="color:${s.col}"`:''}>${s.val}</div><div class="sc-sub">${s.sub}</div></div>`).join('');

  // ── Top 5 performers ──────────────────────────────────────────
  const top5El = document.getElementById('ov-top5');
  if (top5El && rows.length) {
    const sorted = [...rows].sort((a,b)=>calcScore(b)-calcScore(a)).slice(0,5);
    const maxScore = calcScore(sorted[0]) || 1;
    const medals = ['🥇','🥈','🥉','',''];
    top5El.innerHTML = `
      <div class="ov-top5-panel">
        <div class="section-label" style="margin-bottom:12px">Top 5 performers — ${aPE}</div>
        <div class="ov-top5-list">
          ${sorted.map((r,i)=>{
            const s=calcScore(r), rc=i===0?'gold':i===1?'silver':i===2?'bronze':'';
            const badge = (r.estado||'Activo').toLowerCase()==='inactivo'
              ? '<span class="estado-badge inactivo">INACTIVO</span>' : '';
            return `<div class="ov-top5-row">
              <div class="ov-top5-rank ${rc}">${medals[i]||'#'+(i+1)}</div>
              <div class="ov-top5-name">${r.nombre||r.usuario}${badge}</div>
              <div class="ov-top5-dist" style="color:var(--muted);font-size:.68rem">${r.distrito||''}</div>
              <div class="ov-top5-bar-wrap">
                <div class="ov-top5-bar"><div class="ov-top5-bar-fill" style="width:${(s/MAX)*100}%;background:${scoreColor(s)}"></div></div>
              </div>
              <div class="ov-top5-score" style="color:${scoreColor(s)}">${s}<span style="font-size:.6rem;color:var(--muted)">/${MAX}</span></div>
              <span class="nivel-badge ${scoreClass(s)}" style="font-size:.55rem;padding:2px 8px">${scoreLabel(s)}</span>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  } else if (top5El) {
    top5El.innerHTML = '';
  }

  // ── Distribución de niveles ───────────────────────────────────
  const distEl = document.getElementById('ov-dist');
  if (distEl) distEl.innerHTML = `<div class="dist-bars">${[
    { lbl:'Excelente ≥26', n:exc, col:'var(--sex)', pct:total?exc/total:0 },
    { lbl:'Bueno ≥20',     n:bue, col:'var(--sbu)', pct:total?bue/total:0 },
    { lbl:'En Proceso ≥11',n:enP, col:'var(--spr)', pct:total?enP/total:0 },
    { lbl:'Bajo <11',      n:baj, col:'var(--sba)', pct:total?baj/total:0 },
  ].map(d=>`<div class="dist-bar-row">
    <div class="dist-bar-lbl" style="color:${d.col}">${d.lbl}</div>
    <div class="dist-bar-track"><div class="dist-bar-fill" style="width:${d.pct*100}%;background:${d.col}"></div></div>
    <div class="dist-bar-count" style="color:${d.col}">${d.n}</div>
  </div>`).join('')}</div>`;

  // ── Promedio por criterio ─────────────────────────────────────
  const critEl = document.getElementById('ov-criterios');
  if (critEl) critEl.innerHTML = `<div class="crit-summary-grid">${getCriterios().map(c=>{
    const a = total ? (rows.reduce((s,r)=>s+(r[c.key]||0),0)/total).toFixed(2) : 0;
    return `<div class="cs-row">
      <div class="cs-lbl" style="color:${c.color}">${c.label}</div>
      <div class="cs-track"><div class="cs-fill" style="width:${(a/4)*100}%;background:${c.color}"></div></div>
      <div class="cs-val" style="color:${c.color}">${a}</div>
    </div>`;
  }).join('')}</div>`;
}

/* ── RANKING ── */
function renderRanking(rows) {
  setEl('rk-pe', aPE);
  const tbl=document.getElementById('ranking-tbl'); if(!tbl) return;
  const criterios=getCriterios(), sorted=[...rows].sort((a,b)=>calcScore(b)-calcScore(a));
  const cols=`1fr 52px ${criterios.map(()=>'38px').join(' ')} 44px 72px`;
  if (!sorted.length) { tbl.innerHTML='<div class="empty-box"><div class="empty-icon">🏆</div><div class="empty-txt">Sin datos</div></div>'; return; }
  tbl.innerHTML=`
    <div class="tbl-h" style="grid-template-columns:${cols};padding:8px 14px">
      <div class="tbl-th">Miembro</div>
      <div class="tbl-th" style="text-align:center">Pts</div>
      ${criterios.map(c=>`<div class="tbl-th" style="color:${c.color};text-align:center">${c.abbr}</div>`).join('')}
      <div class="tbl-th" style="color:var(--gold);text-align:center">⭐</div>
      <div class="tbl-th" style="text-align:center">Estado</div>
    </div>
    ${sorted.map((r,i)=>{
      const s=calcScore(r), rc=i===0?'gold':i===1?'silver':i===2?'bronze':'';
      const inactive=(r.estado||'Activo').toLowerCase()==='inactivo';
      return `<div class="tbl-r${inactive?' tbl-r--inact':''}" style="grid-template-columns:${cols};animation-delay:${i*20}ms" onclick="goToMember('${esc(r.usuario)}')">
        <div class="tbl-td tbl-name-cell"><span class="rank-num ${rc}">#${i+1}</span><span>${r.nombre||r.usuario}</span></div>
        <div class="tbl-td tbl-score-cell"><span class="sbadge ${scoreClass(s)}">${s}</span></div>
        ${criterios.map(c=>`<div class="tbl-td" style="text-align:center;padding:8px 4px"><span class="cdot ${dCls(r[c.key])}">${r[c.key]||0}</span></div>`).join('')}
        <div class="tbl-td" style="text-align:center;padding:8px 4px"><span style="font-family:'Bebas Neue',sans-serif;font-size:1rem;color:${r.ext>0?'var(--gold)':'var(--muted)'}">${r.ext||0}</span></div>
        <div class="tbl-td" style="text-align:center;padding:8px 4px"><span class="estado-badge ${inactive?'inactivo':'activo'}">${inactive?'INACTIVO':'ACTIVO'}</span></div>
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
  syncEvalPEButtons();
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

/* ══════════════════════════════════════════════════════════════
   RÚBRICA EDITABLE — Admin
   ══════════════════════════════════════════════════════════════ */

let _rubricaAdminMode = 'creators';
let _rubricaCreators  = [];  // copia editable
let _rubricaDistritos = [];
let _rubricaDirty     = { creators:false, distritos:false };

function setRubricaAdminMode(mode, btn) {
  _rubricaAdminMode = mode;
  document.querySelectorAll('.cfg-toggle-btn').forEach(b => b.classList.remove('active'));
  btn?.classList.add('active');
  document.getElementById('rubrica-admin-creators').style.display  = mode === 'creators'  ? '' : 'none';
  document.getElementById('rubrica-admin-distritos').style.display = mode === 'distritos' ? '' : 'none';
}

function renderRubricaAdmin() {
  // Sincronizar copias editables desde D solo si no hay cambios pendientes
  if (!_rubricaDirty.creators)  _rubricaCreators  = (D?.rubrica          || []).map(r => ({...r}));
  if (!_rubricaDirty.distritos) _rubricaDistritos = (D?.rubricaDistritos  || []).map(r => ({...r}));
  renderRubricaEditor('creators');
  renderRubricaEditor('distritos');
}

function renderRubricaEditor(mode) {
  const el = document.getElementById(`rubrica-editor-${mode}`); if (!el) return;
  const data = mode === 'creators' ? _rubricaCreators : _rubricaDistritos;
  const levels = [
    { key:'nivel4', lbl:'Nivel 4 — Excelente', col:'var(--green)' },
    { key:'nivel3', lbl:'Nivel 3 — Bueno',      col:'var(--blue)' },
    { key:'nivel2', lbl:'Nivel 2 — En Proceso',  col:'var(--gold)' },
    { key:'nivel1', lbl:'Nivel 1 — Bajo',         col:'var(--red)' },
  ];

  if (!data.length) {
    el.innerHTML = `<div class="empty-box"><div class="empty-icon">📋</div><div class="empty-txt">Sin datos. Agrega criterios con el botón de arriba.</div></div>`;
    return;
  }

  el.innerHTML = data.map((r, i) => `
    <div class="cfg-rubrica-card" id="rbc-${mode}-${i}">
      <div class="cfg-rubrica-head">
        <div class="cfg-rubrica-num">${i + 1}</div>
        <input class="cfg-inp cfg-inp--name" value="${esc(r.criterio||'')}"
          placeholder="Nombre del criterio..."
          oninput="updateRubricaRow('${mode}',${i},'criterio',this.value)">
        <button class="cfg-btn-del" onclick="deleteRubricaRow('${mode}',${i})" title="Eliminar">✕</button>
      </div>
      <div class="cfg-rubrica-levels">
        ${levels.map(l => `
          <div class="cfg-rubrica-level">
            <div class="cfg-level-lbl" style="color:${l.col}">${l.lbl}</div>
            <textarea class="cfg-textarea" rows="2"
              oninput="updateRubricaRow('${mode}',${i},'${l.key}',this.value)"
              placeholder="Descripción del nivel...">${esc(r[l.key]||'')}</textarea>
          </div>`).join('')}
      </div>
    </div>`).join('');
}

function updateRubricaRow(mode, idx, field, value) {
  const data = mode === 'creators' ? _rubricaCreators : _rubricaDistritos;
  if (data[idx]) { data[idx][field] = value; markRubricaDirty(mode); }
}

function addRubricaRow(mode) {
  const data = mode === 'creators' ? _rubricaCreators : _rubricaDistritos;
  data.push({ criterio:'', nivel4:'', nivel3:'', nivel2:'', nivel1:'' });
  markRubricaDirty(mode);
  renderRubricaEditor(mode);
  setTimeout(() => document.querySelector(`#rubrica-editor-${mode} .cfg-rubrica-card:last-child .cfg-inp--name`)?.focus(), 80);
}

function deleteRubricaRow(mode, idx) {
  const data = mode === 'creators' ? _rubricaCreators : _rubricaDistritos;
  data.splice(idx, 1);
  markRubricaDirty(mode);
  renderRubricaEditor(mode);
}

function markRubricaDirty(mode) {
  _rubricaDirty[mode] = true;
  document.getElementById(`btn-save-rubrica-${mode}`)?.classList.remove('hidden');
}

async function saveRubricaAdmin(mode) {
  const btnId = `btn-save-rubrica-${mode}`;
  const btn   = document.getElementById(btnId);
  if (btn) { btn.textContent = 'Guardando...'; btn.classList.add('saving'); }
  try {
    const data = mode === 'creators' ? _rubricaCreators : _rubricaDistritos;
    const r    = mode === 'creators'
      ? await API.saveRubrica(data)
      : await API.saveRubricaDistritos(data);
    if (!r.ok) { showToast(`Error: ${r.error||''}`, 'error'); }
    else {
      showToast(`✓ Rúbrica de ${mode === 'creators' ? 'Creators' : 'Distritos'} guardada`, 'ok');
      _rubricaDirty[mode] = false;
      document.getElementById(btnId)?.classList.add('hidden');
      await loadData();
    }
  } catch(e) { showToast('Error al guardar', 'error'); console.error(e); }
  finally {
    if (btn) {
      btn.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none"><path d="M13.5 4.5L6 12 2.5 8.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Guardar rúbrica';
      btn.classList.remove('saving');
    }
  }
}

/* ══════════════════════════════════════════════════════════════
   CONFIGURACIÓN — Criterios + Usuarios
   ══════════════════════════════════════════════════════════════ */

let _configTab       = 'criterios';
let _criteriosEdit   = [];
let _usuariosEdit    = [];
let _critDirty       = false;
let _userDirty       = false;

function switchConfigTab(tab, btn) {
  _configTab = tab;
  document.querySelectorAll('.cfg-subtab').forEach(b => b.classList.remove('active'));
  btn?.classList.add('active');
  document.getElementById('cfg-panel-criterios').style.display = tab === 'criterios' ? '' : 'none';
  document.getElementById('cfg-panel-usuarios').style.display  = tab === 'usuarios'  ? '' : 'none';
}

function renderConfig() {
  if (!_critDirty) _criteriosEdit = (D?.criterios || getCriterios()).map(c => ({...c}));
  if (!_userDirty) _usuariosEdit  = (D?.users     || []).map(u => ({...u}));
  renderCriteriosEditor();
  renderUsuariosEditor();
}

/* ── Criterios Editor ───────────────────────────────────────── */
const PRESET_COLORS = ['#E05A6A','#38BDF8','#2ECC71','#5B7FFF','#C084FC','#F0C040','#FB923C','#F472B6','#94A3B8'];

function renderCriteriosEditor() {
  const el = document.getElementById('criterios-editor'); if (!el) return;
  if (!_criteriosEdit.length) {
    el.innerHTML = `<div class="empty-box"><div class="empty-icon">📐</div><div class="empty-txt">Sin criterios. Agrega el primero.</div></div>`;
    return;
  }
  el.innerHTML = _criteriosEdit.map((c, i) => `
    <div class="cfg-crit-card" id="ccc-${i}">
      <div class="cfg-crit-num">${i + 1}</div>
      <div class="cfg-crit-preview" style="background:${c.color||'#888'}" title="Color"></div>
      <input class="cfg-inp cfg-inp--label" value="${esc(c.label||'')}"
        placeholder="Nombre del criterio..."
        oninput="updateCriterio(${i},'label',this.value)">
      <input class="cfg-inp cfg-inp--abbr" value="${esc(c.abbr||'')}" maxlength="4"
        placeholder="ABR"
        oninput="updateCriterio(${i},'abbr',this.value.toUpperCase());this.value=this.value.toUpperCase()">
      <input class="cfg-inp cfg-inp--key" value="${esc(c.key||'')}" maxlength="6"
        placeholder="clave"
        oninput="updateCriterio(${i},'key',this.value.toLowerCase());this.value=this.value.toLowerCase()">
      <div class="cfg-color-swatches">
        ${PRESET_COLORS.map(col => `<button class="cfg-swatch${c.color===col?' active':''}" style="background:${col}" onclick="updateCriterio(${i},'color','${col}')" title="${col}"></button>`).join('')}
        <input type="color" class="cfg-color-pick" value="${c.color||'#888888'}"
          oninput="updateCriterio(${i},'color',this.value)">
      </div>
      <button class="cfg-btn-del" onclick="deleteCriterio(${i})" title="Eliminar">✕</button>
    </div>`).join('');
}

function updateCriterio(idx, field, value) {
  if (_criteriosEdit[idx]) {
    _criteriosEdit[idx][field] = value;
    if (field === 'color') {
      const preview = document.querySelector(`#ccc-${idx} .cfg-crit-preview`);
      if (preview) preview.style.background = value;
      document.querySelectorAll(`#ccc-${idx} .cfg-swatch`).forEach(s => s.classList.toggle('active', s.style.background === value || s.title === value));
    }
    markCritDirty();
  }
}

function addCriterioRow() {
  const idx = _criteriosEdit.length;
  _criteriosEdit.push({ key:`c${idx+1}`, label:'', abbr:'', color: PRESET_COLORS[idx % PRESET_COLORS.length] });
  markCritDirty();
  renderCriteriosEditor();
  setTimeout(() => document.querySelector(`#ccc-${idx} .cfg-inp--label`)?.focus(), 80);
}

function deleteCriterio(idx) {
  _criteriosEdit.splice(idx, 1);
  markCritDirty();
  renderCriteriosEditor();
}

function markCritDirty() {
  _critDirty = true;
  document.getElementById('btn-save-criterios')?.classList.remove('hidden');
}

async function saveCriteriosAdmin() {
  const btn = document.getElementById('btn-save-criterios');
  if (btn) { btn.textContent = 'Guardando...'; btn.classList.add('saving'); }
  try {
    const r = await API.saveCriterios(_criteriosEdit);
    if (!r.ok) { showToast(`Error: ${r.error||''}`, 'error'); }
    else {
      showToast(`✓ ${r.saved} criterios guardados`, 'ok');
      _critDirty = false;
      document.getElementById('btn-save-criterios')?.classList.add('hidden');
      await loadData(); renderAll();
    }
  } catch(e) { showToast('Error al guardar', 'error'); console.error(e); }
  finally {
    if (btn) {
      btn.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none"><path d="M13.5 4.5L6 12 2.5 8.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Guardar criterios';
      btn.classList.remove('saving');
    }
  }
}

/* ── Usuarios Editor ─────────────────────────────────────────── */
const ROLES_OPTS = ['admin','secretario','miembro'];

function renderUsuariosEditor() {
  const el = document.getElementById('usuarios-editor'); if (!el) return;
  if (!_usuariosEdit.length) {
    el.innerHTML = `<div class="empty-box"><div class="empty-icon">👥</div><div class="empty-txt">Sin usuarios. Agrega el primero.</div></div>`;
    return;
  }

  // Agrupar por rol para visualización
  const rolOrder = { admin:0, secretario:1, miembro:2 };
  const sorted   = [..._usuariosEdit].map((u,i) => ({...u, _idx:i}))
    .sort((a,b) => (rolOrder[a.rol]||3)-(rolOrder[b.rol]||3));

  const rolColors = { admin:'var(--gold)', secretario:'var(--blue)', miembro:'var(--red)' };

  el.innerHTML = sorted.map(u => {
    const i = u._idx;
    return `
    <div class="cfg-user-card" id="ucc-${i}">
      <div class="cfg-user-head">
        <div class="cfg-user-avatar" style="background:${rolColors[u.rol]||'var(--muted)'}">
          ${(u.name||u.user||'?').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()||'?'}
        </div>
        <div class="cfg-user-info">
          <div class="cfg-user-role-badge" style="color:${rolColors[u.rol]||'var(--muted)'}">
            ${u.rol?.toUpperCase()||'MIEMBRO'}
          </div>
          <div class="cfg-user-fullname">${u.name||u.user||'—'}</div>
        </div>
        <button class="cfg-btn-del" onclick="deleteUsuario(${i})" title="Eliminar usuario">✕</button>
      </div>
      <div class="cfg-user-fields">
        <div class="cfg-field-group">
          <label class="cfg-field-lbl">Nombre completo</label>
          <input class="cfg-inp" value="${esc(u.name||'')}" placeholder="Nombre..."
            oninput="updateUsuario(${i},'name',this.value)">
        </div>
        <div class="cfg-field-group">
          <label class="cfg-field-lbl">Usuario</label>
          <input class="cfg-inp" value="${esc(u.user||'')}" placeholder="usuario123"
            oninput="updateUsuario(${i},'user',this.value)">
        </div>
        <div class="cfg-field-group">
          <label class="cfg-field-lbl">Contraseña</label>
          <input class="cfg-inp" type="text" value="${esc(u.pass||'')}" placeholder="contraseña"
            oninput="updateUsuario(${i},'pass',this.value)">
        </div>
        <div class="cfg-field-group">
          <label class="cfg-field-lbl">Rol</label>
          <select class="cfg-inp cfg-select" onchange="updateUsuario(${i},'rol',this.value)">
            ${ROLES_OPTS.map(r => `<option value="${r}" ${u.rol===r?'selected':''}>${r.charAt(0).toUpperCase()+r.slice(1)}</option>`).join('')}
          </select>
        </div>
        <div class="cfg-field-group">
          <label class="cfg-field-lbl">Distrito <span style="color:var(--muted)">(secretario)</span></label>
          <input class="cfg-inp" value="${esc(u.distrito||'')}" placeholder="ej: 08-01"
            oninput="updateUsuario(${i},'distrito',this.value)">
        </div>
      </div>
    </div>`;
  }).join('');
}

function updateUsuario(idx, field, value) {
  if (_usuariosEdit[idx]) {
    _usuariosEdit[idx][field] = value;
    if (field === 'name' || field === 'rol') {
      // Actualizar avatar y badge sin re-render completo
      const card    = document.getElementById(`ucc-${idx}`);
      const rolColors = { admin:'var(--gold)', secretario:'var(--blue)', miembro:'var(--red)' };
      if (field === 'name') {
        const av = card?.querySelector('.cfg-user-avatar');
        if (av) av.textContent = (value||'?').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()||'?';
        const fn = card?.querySelector('.cfg-user-fullname');
        if (fn) fn.textContent = value || '—';
      }
      if (field === 'rol') {
        const color = rolColors[value]||'var(--muted)';
        const av    = card?.querySelector('.cfg-user-avatar');
        const rb    = card?.querySelector('.cfg-user-role-badge');
        if (av) av.style.background = color;
        if (rb) { rb.textContent = value.toUpperCase(); rb.style.color = color; }
      }
    }
    markUserDirty();
  }
}

function addUsuarioRow() {
  const idx = _usuariosEdit.length;
  _usuariosEdit.push({ user:'', pass:'', name:'', rol:'miembro', distrito:'' });
  markUserDirty();
  renderUsuariosEditor();
  setTimeout(() => document.querySelector(`#ucc-${idx} .cfg-inp`)?.focus(), 80);
}

function deleteUsuario(idx) {
  const u = _usuariosEdit[idx];
  if (u?.user === CU?.user) { showToast('No puedes eliminar tu propio usuario', 'error'); return; }
  _usuariosEdit.splice(idx, 1);
  markUserDirty();
  renderUsuariosEditor();
}

function markUserDirty() {
  _userDirty = true;
  document.getElementById('btn-save-usuarios')?.classList.remove('hidden');
}

async function saveUsuariosAdmin() {
  const btn = document.getElementById('btn-save-usuarios');
  if (btn) { btn.textContent = 'Guardando...'; btn.classList.add('saving'); }
  // Validación básica
  const invalid = _usuariosEdit.filter(u => !u.user?.trim() || !u.pass?.trim());
  if (invalid.length) {
    showToast(`${invalid.length} usuario(s) sin usuario o contraseña`, 'error');
    if (btn) { btn.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none"><path d="M13.5 4.5L6 12 2.5 8.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Guardar usuarios'; btn.classList.remove('saving'); }
    return;
  }
  // Detectar duplicados
  const keys = _usuariosEdit.map(u => u.user?.trim().toLowerCase());
  const dups  = keys.filter((k,i) => keys.indexOf(k) !== i);
  if (dups.length) {
    showToast(`Usuario duplicado: ${[...new Set(dups)].join(', ')}`, 'error');
    if (btn) { btn.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none"><path d="M13.5 4.5L6 12 2.5 8.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Guardar usuarios'; btn.classList.remove('saving'); }
    return;
  }
  try {
    const r = await API.saveUsuarios(_usuariosEdit);
    if (!r.ok) { showToast(`Error: ${r.error||''}`, 'error'); }
    else {
      showToast(`✓ ${r.saved} usuarios guardados`, 'ok');
      _userDirty = false;
      document.getElementById('btn-save-usuarios')?.classList.add('hidden');
      await loadData(); renderConfig();
    }
  } catch(e) { showToast('Error al guardar', 'error'); console.error(e); }
  finally {
    if (btn) {
      btn.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none"><path d="M13.5 4.5L6 12 2.5 8.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Guardar usuarios';
      btn.classList.remove('saving');
    }
  }
}

/* ── DISTRITOS ADMIN ── */
function renderDistritosAdmin(rows) {
  setEl('dist-admin-pe', aPE);

  // Usar los puntajes de distrito directamente del Sheet (filas 23+)
  const distScores = D?.districtScores?.[aPE] || [];

  // ── Mapa universal de miembros: base en todos los PEs ──────────
  // Garantiza que en PE2/PE3 se vean todos los miembros aunque no
  // tengan scores aún en ese período.
  const universalMap = {}; // { distrito: { usuario: rowInfo } }
  PORTAL_CONFIG.PERIODOS.forEach(pe => {
    (D?.scores?.[pe] || []).forEach(r => {
      const dist = String(r.distrito || '').trim();
      if (!dist) return;
      if (!universalMap[dist]) universalMap[dist] = {};
      // Solo registra info base si todavía no existe (no sobreescribir con datos de otro PE)
      if (!universalMap[dist][r.usuario]) {
        universalMap[dist][r.usuario] = {
          usuario: r.usuario, nombre: r.nombre, rol: r.rol, area: r.area, distrito: dist,
          pla:0, rev:0, edi:0, dis:0, flu:0, nar:0, eje:0, ext:0, _sinDatos: true,
        };
      }
    });
  });
  // Sobreescribir con datos del PE actual (scores reales)
  rows.forEach(r => {
    const dist = String(r.distrito || '').trim();
    if (!dist) return;
    if (!universalMap[dist]) universalMap[dist] = {};
    universalMap[dist][r.usuario] = { ...r, _sinDatos: false };
  });

  const memberMap = {};
  Object.entries(universalMap).forEach(([dist, usersObj]) => {
    memberMap[dist] = Object.values(usersObj);
  });
  // ──────────────────────────────────────────────────────────────

  // Construir lista usando los puntajes oficiales del sheet
  const districts = distScores.map(d => ({
    dist:    d.distrito,
    members: memberMap[d.distrito] || [],
    avg:     d.total,
    totalScore: d.total,
    distData: d,
  }));

  // Stat cards resumen de distritos
  const statsEl = document.getElementById('dist-admin-stats');
  if (statsEl && districts.length) {
    const topDist     = districts[0];
    const totalMembers = districts.reduce((s,d)=>s+d.members.length,0);
    const globalAvg    = districts.length ? (districts.reduce((s,d)=>s+d.avg,0)/districts.length).toFixed(1) : '—';
    statsEl.innerHTML = [
      {lbl:'Distritos activos',  val:districts.length,      sub:`${aPE}`,                  col:''},
      {lbl:'Total miembros',     val:totalMembers,           sub:'todos los distritos',     col:''},
      {lbl:'Promedio global',    val:globalAvg,              sub:`/ ${MAX_TOTAL()} pts`,    col:scoreColor(parseFloat(globalAvg))},
      {lbl:'Distrito líder',     val:`#1`,                   sub:topDist?.dist||'—',        col:'var(--sex)'},
    ].map(s=>`<div class="scard"><div class="sc-lbl">${s.lbl}</div><div class="sc-val"${s.col?` style="color:${s.col}"`:''}>${s.val}</div><div class="sc-sub">${s.sub}</div></div>`).join('');
  }

  // Lista de distritos
  const listEl = document.getElementById('dist-admin-list');
  if (!listEl) return;

  if (!districts.length) {
    listEl.innerHTML = '<div class="empty-box"><div class="empty-icon">🗺️</div><div class="empty-txt">Sin datos de distritos para este período.</div></div>';
    return;
  }

  const criterios = getCriterios();
  listEl.innerHTML = districts.map((d, i) => {
    const pos   = i + 1;
    const posRc = pos===1?'gold':pos===2?'silver':pos===3?'bronze':'';
    const distId = esc(d.dist);

    // Barras de puntaje por criterio (desde datos oficiales del sheet)
    const critBars = criterios.map(c => {
      const cAvg = d.distData ? (d.distData[c.key] ?? 0) :
        (d.members.length ? (d.members.reduce((s,r)=>s+(r[c.key]||0),0)/d.members.length).toFixed(2) : 0);
      return `<div class="cs-row">
        <div class="cs-lbl" style="color:${c.color}">${c.abbr}</div>
        <div class="cs-track"><div class="cs-fill" style="width:${(cAvg/4)*100}%;background:${c.color}"></div></div>
        <div class="cs-val" style="color:${c.color}">${cAvg}</div>
      </div>`;
    }).join('');

    // Lista de miembros del distrito
    const membersSorted = [...d.members].sort((a,b)=>calcScore(b)-calcScore(a));
    const memberRows = membersSorted.map((m, mi) => {
      const s   = calcScore(m);
      const mRc = mi===0?'gold':mi===1?'silver':mi===2?'bronze':'';
      const sinDatos = m._sinDatos;
      return `<div class="admin-dist-member-row">
        <span class="rank-num ${mRc}" style="font-family:'Bebas Neue',sans-serif;font-size:.9rem;width:22px;flex-shrink:0">#${mi+1}</span>
        <div style="flex:1;min-width:90px">
          <div style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:.82rem">${m.nombre||m.usuario}</div>
          <div style="font-size:.6rem;color:var(--muted)">${m.rol||''}${m.area?' · '+m.area:''}</div>
        </div>
        ${sinDatos
          ? `<span style="font-family:'Barlow Condensed',sans-serif;font-size:.58rem;font-weight:700;letter-spacing:1.5px;color:var(--muted);border:1px solid var(--faint);border-radius:4px;padding:3px 8px;text-transform:uppercase">Sin evaluar</span>`
          : `<span class="sbadge ${scoreClass(s)}">${s}</span>`
        }
        <button class="admin-dist-edit-btn" onclick="goToMemberFromDistrict('${esc(m.usuario)}')">✏️ Editar</button>
      </div>`;
    }).join('');

    return `<div class="admin-dist-card" id="adc-${distId}">
      <div class="admin-dist-head" onclick="toggleDistAdmin('${distId}')">
        <div class="dist-rk-pos-admin ${posRc}">#${pos}</div>
        <div style="flex:1;min-width:100px">
          <div style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:1.05rem;letter-spacing:1px">${d.dist}</div>
          <div style="font-size:.65rem;color:var(--muted)">${d.members.length} miembros</div>
        </div>
        <div style="text-align:right;margin-right:14px">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:1.9rem;line-height:1;color:${scoreColor(d.avg)}">${d.avg.toFixed(1)}</div>
          <div style="font-size:.6rem;color:var(--muted)">promedio / ${MAX_TOTAL()}</div>
          <span class="nivel-badge ${scoreClass(Math.round(d.avg))}" style="font-size:.5rem;padding:2px 6px">${scoreLabel(Math.round(d.avg))}</span>
        </div>
        <span class="admin-dist-chev" id="chev-${distId}">▾</span>
      </div>
      <div class="admin-dist-body" id="adb-${distId}" style="display:none">
        <div class="admin-dist-expand-grid">
          <div>
            <div class="section-label" style="margin-bottom:10px">Promedio por criterio</div>
            <div class="crit-summary-grid">${critBars}</div>
          </div>
          <div>
            <div class="section-label" style="margin-bottom:10px">
              Miembros del distrito
              <span style="font-size:.6rem;color:var(--muted);font-family:'Barlow',sans-serif;letter-spacing:0;text-transform:none;font-weight:400;margin-left:6px">Haz clic en ✏️ Editar para modificar scores</span>
            </div>
            <div class="admin-dist-members-list">${memberRows}</div>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function toggleDistAdmin(distId) {
  const body = document.getElementById(`adb-${distId}`);
  const chev = document.getElementById(`chev-${distId}`);
  if (!body) return;
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  if (chev) chev.style.transform = isOpen ? '' : 'rotate(180deg)';
}

function goToMemberFromDistrict(usuario) {
  // Navegar a la pestaña Miembros y seleccionar este miembro
  const miembrosBtn = document.querySelector('#desktop-nav .tnav:nth-child(5)');
  switchTab('miembros', miembrosBtn);
  selectMember(usuario);
}


/* ── MODO EVALUACIÓN: CREATORS / DISTRITOS ── */
function setEvalMode(mode) {
  _evalMode = mode;
  _pendingDistScores = {};
  document.getElementById('etb-creators')?.classList.toggle('active', mode==='creators');
  document.getElementById('etb-distritos')?.classList.toggle('active', mode==='distritos');
  document.getElementById('eval-creators-panel').style.display = mode==='creators' ? '' : 'none';
  document.getElementById('eval-distritos-panel').style.display = mode==='distritos' ? '' : 'none';
  if (mode==='distritos') renderDistrictEditor();
}

function renderDistrictEditor() {
  const el = document.getElementById('district-editor'); if (!el) return;
  const COMP = D?.distCompetencias || [
    { key:'cgo', label:'Gestión y Organización "CGO"', abbr:'CGO', color:'#38BDF8', max:4 },
    { key:'cct', label:'Creativa y Técnica "CCT"',     abbr:'CCT', color:'#2ECC71', max:4 },
    { key:'com', label:'Comunicativa "COM"',            abbr:'COM', color:'#C084FC', max:4 },
    { key:'cee', label:'Ejecución Estratégica "CEE"',  abbr:'CEE', color:'#F0C040', max:4 },
  ];
  const distScores = D?.districtScores?.[aPE] || [];

  if (!distScores.length) {
    el.innerHTML = `<div class="empty-box"><div class="empty-icon">🗺️</div><div class="empty-txt">Sin datos para ${aPE}.<br>Verifica que exista la hoja "CREATORS DISTRITOS - ${aPE}".</div></div>`;
    return;
  }

  const cards = distScores.map(d => {
    const distId = esc(d.distrito);
    const compRows = COMP.map(c => {
      const val = d[c.key] ?? 0;
      const id  = `dci-${distId}-${c.key}`;
      return `<div class="dist-comp-row">
        <div class="dist-comp-info">
          <div class="dist-comp-name" style="color:${c.color}">${c.abbr}</div>
          <div class="dist-comp-abbr">${c.label}</div>
        </div>
        <div class="dist-comp-track"><div class="dist-comp-fill" id="df-${distId}-${c.key}" style="width:${(val/c.max)*100}%;background:${c.color}"></div></div>
        <input type="number" class="dist-comp-inp" id="${id}"
          data-distrito="${esc(d.distrito)}" data-competencia="${c.key}"
          data-original="${val}" value="${val}"
          min="0" max="${c.max}" step="1"
          onchange="onDistScoreChange(this)" oninput="onDistScoreChange(this)">
      </div>`;
    }).join('');

    return `<div class="dist-editor-card" id="dec-${distId}">
      <div class="dist-editor-head">
        <div class="dist-editor-name">${d.distrito}</div>
        <div style="text-align:right">
          <div class="dist-editor-total" id="det-${distId}">${d.total}</div>
          <div class="dist-editor-total-lbl">Total</div>
        </div>
      </div>
      <div class="dist-editor-body">${compRows}</div>
      <div class="save-bar hidden" id="dsb-${distId}" style="margin:0 0 4px">
        <span class="save-bar-msg">⚠ Cambios sin guardar</span>
        <button class="btn-cancel-changes" onclick="cancelDistChanges('${esc(d.distrito)}')">Cancelar</button>
        <button class="btn-save" id="dsave-${distId}" onclick="saveDistScores('${esc(d.distrito)}')">Guardar</button>
      </div>
    </div>`;
  }).join('');

  el.innerHTML = `<div class="dist-editor-grid">${cards}</div>`;
}

function onDistScoreChange(inp) {
  const { distrito, competencia } = inp.dataset;
  const distId = esc(distrito);
  const COMP = D?.distCompetencias || [{key:'cgo',max:4},{key:'cct',max:4},{key:'com',max:4},{key:'cee',max:4}];
  const maxV = (COMP.find(c=>c.key===competencia)||{max:4}).max;
  const val  = Math.min(maxV, Math.max(0, parseInt(inp.value)||0));
  inp.value  = val;
  const orig = parseFloat(inp.dataset.original)||0;
  const key  = `${aPE}_${distrito}_${competencia}`;
  inp.classList.toggle('changed', val!==orig);
  const fill = document.getElementById(`df-${distId}-${competencia}`);
  if (fill) fill.style.width = `${(val/maxV)*100}%`;
  if (val!==orig) _pendingDistScores[key]=val; else delete _pendingDistScores[key];
  // Recalcular total en vivo
  let total = 0;
  COMP.forEach(c => { const e = document.getElementById(`dci-${distId}-${c.key}`); if(e) total += parseInt(e.value)||0; });
  const totEl = document.getElementById(`det-${distId}`);
  if (totEl) totEl.textContent = total;
  showSaveBar(`dsb-${distId}`, Object.keys(_pendingDistScores).some(k=>k.startsWith(`${aPE}_${distrito}_`)));
}

function cancelDistChanges(distrito) {
  const distId = esc(distrito);
  const COMP = D?.distCompetencias || [{key:'cgo',max:4},{key:'cct',max:4},{key:'com',max:4},{key:'cee',max:4}];
  COMP.forEach(c => {
    const inp = document.getElementById(`dci-${distId}-${c.key}`); if(!inp) return;
    inp.value = inp.dataset.original; inp.classList.remove('changed');
    const fill = document.getElementById(`df-${distId}-${c.key}`);
    if (fill) fill.style.width = `${((parseFloat(inp.dataset.original)||0)/c.max)*100}%`;
    delete _pendingDistScores[`${aPE}_${distrito}_${c.key}`];
  });
  const d = D?.districtScores?.[aPE]?.find(x=>x.distrito===distrito);
  const totEl = document.getElementById(`det-${distId}`);
  if (totEl && d) totEl.textContent = d.total;
  showSaveBar(`dsb-${distId}`, false);
}

async function saveDistScores(distrito) {
  const distId = esc(distrito);
  const btn    = document.getElementById(`dsave-${distId}`);
  if (btn) { btn.textContent='Guardando...'; btn.classList.add('saving'); }
  try {
    const changes = Object.entries(_pendingDistScores)
      .filter(([k])=>k.startsWith(`${aPE}_${distrito}_`))
      .map(([k,v])=>({ pe:aPE, distrito, competencia:k.split('_')[2], valor:v }));
    if (!changes.length) { showToast('Sin cambios','info'); return; }
    const r = await API.updateBulkDistrictScores(changes);
    if (!r.ok) { showToast(`Error: ${r.failed?.length||0} fallaron`,'error'); }
    else {
      showToast(`✓ Distrito ${distrito} guardado`,'ok');
      changes.forEach(c => {
        const inp = document.getElementById(`dci-${distId}-${c.competencia}`);
        if (inp) { inp.dataset.original = c.valor; inp.classList.remove('changed'); }
        delete _pendingDistScores[`${c.pe}_${distrito}_${c.competencia}`];
      });
      showSaveBar(`dsb-${distId}`, false);
      await loadData(); renderDistrictEditor();
    }
  } catch(e){ showToast('Error al guardar','error'); console.error(e); }
  finally { if(btn){btn.textContent='Guardar';btn.classList.remove('saving');} }
}

/* ─────────────────────────────────────────────────────────────
   CALENDARIO EDITABLE — Admin
   ───────────────────────────────────────────────────────────── */

// 8 colores disponibles para etiquetas
const CAL_COLORS = [
  { key:'rojo',      label:'Rojo',      hex:'#E05A6A' },
  { key:'verde',     label:'Verde',     hex:'#2ECC71' },
  { key:'azul',      label:'Azul',      hex:'#38BDF8' },
  { key:'amarillo',  label:'Amarillo',  hex:'#F0C040' },
  { key:'morado',    label:'Morado',    hex:'#C084FC' },
  { key:'naranja',   label:'Naranja',   hex:'#FB923C' },
  { key:'rosa',      label:'Rosa',      hex:'#F472B6' },
  { key:'gris',      label:'Gris',      hex:'#94A3B8' },
];

const CAL_ESTADOS = ['Pendiente','En curso','Próximo','Completado'];

let _calEventos = [];  // copia editable de los eventos
let _calDirty   = false;

function renderCalendarioAdmin() {
  // Clonar datos del servidor para editar localmente
  _calEventos = (D?.calendario || []).map(e => Object.assign({}, e));
  _calDirty   = false;
  updateCalSaveBtn();
  renderCalEditorList();
}

function renderCalEditorList() {
  const el = document.getElementById('cal-editor-list'); if (!el) return;
  if (!_calEventos.length) {
    el.innerHTML = '<div class="empty-box"><div class="empty-icon">📅</div><div class="empty-txt">Sin actividades. Haz clic en "+ Agregar actividad" para crear la primera.</div></div>';
    return;
  }

  el.innerHTML = _calEventos.map((ev, i) => {
    const col = CAL_COLORS.find(c => c.key === ev.color) || CAL_COLORS[0];
    const colorOpts = CAL_COLORS.map(c =>
      `<option value="${c.key}" ${c.key===ev.color?'selected':''}>${c.label}</option>`
    ).join('');
    const estadoOpts = CAL_ESTADOS.map(s =>
      `<option value="${s}" ${s===ev.estado?'selected':''}>${s}</option>`
    ).join('');

    return `<div class="cal-ev-card" id="cev-${i}" style="border-left:3px solid ${col.hex}">
      <div class="cal-ev-head">
        <div class="cal-ev-num">
          <span style="font-family:'Barlow Condensed',sans-serif;font-size:.58rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--muted)">N°</span>
          <input type="number" class="cal-inp cal-inp--num" value="${ev.numero||i+1}" min="1"
            onchange="updateCalEvento(${i},'numero',this.value)" oninput="markCalDirty()">
        </div>
        <div class="cal-ev-color-dot" style="background:${col.hex};width:10px;height:10px;border-radius:50%;flex-shrink:0"></div>
        <input type="text" class="cal-inp cal-inp--title" value="${esc(ev.titulo||'')}" placeholder="Título del período..."
          onchange="updateCalEvento(${i},'titulo',this.value)" oninput="markCalDirty()">
        <select class="cal-inp cal-inp--color" onchange="updateCalColor(${i},this.value)" style="border-color:${col.hex}">
          ${colorOpts}
        </select>
        <select class="cal-inp cal-inp--estado" onchange="updateCalEvento(${i},'estado',this.value)">
          ${estadoOpts}
        </select>
        <button class="cal-ev-delete" onclick="deleteCalEvento(${i})" title="Eliminar">✕</button>
      </div>
      <div class="cal-ev-dates">
        ${[['inicio','Inicio'],['finTrabajo','Fin de trabajo'],['entrega','Entrega scores'],['jornada','Jornada']].map(([field,lbl])=>`
          <div class="cal-date-field">
            <label class="cal-date-lbl">${lbl}</label>
            <input type="text" class="cal-inp cal-inp--date" value="${esc(ev[field]||'')}" placeholder="d/m/aaaa"
              onchange="updateCalEvento(${i},'${field}',this.value)" oninput="markCalDirty()">
          </div>`).join('')}
      </div>
    </div>`;
  }).join('');
}

function updateCalEvento(idx, field, value) {
  if (_calEventos[idx]) { _calEventos[idx][field] = value; markCalDirty(); }
}

function updateCalColor(idx, colorKey) {
  updateCalEvento(idx, 'color', colorKey);
  // Actualizar visualmente el dot y el borde sin re-render completo
  const col = CAL_COLORS.find(c=>c.key===colorKey)||CAL_COLORS[0];
  const card = document.getElementById(`cev-${idx}`);
  if (card) {
    card.style.borderLeftColor = col.hex;
    const dot = card.querySelector('.cal-ev-color-dot');
    if (dot) dot.style.background = col.hex;
    const sel = card.querySelector('.cal-inp--color');
    if (sel) sel.style.borderColor = col.hex;
  }
}

function markCalDirty() {
  _calDirty = true;
  updateCalSaveBtn();
}

function updateCalSaveBtn() {
  const btn = document.getElementById('btn-save-cal');
  if (btn) btn.classList.toggle('hidden', !_calDirty);
}

function addCalEvento() {
  _calEventos.push({ numero:_calEventos.length+1, titulo:'', color:'rojo', inicio:'', finTrabajo:'', entrega:'', jornada:'', estado:'Pendiente' });
  markCalDirty();
  renderCalEditorList();
  // Scroll al final
  setTimeout(()=>{ const l=document.getElementById('cal-editor-list'); if(l) l.lastElementChild?.scrollIntoView({behavior:'smooth',block:'nearest'}); },100);
}

function deleteCalEvento(idx) {
  _calEventos.splice(idx, 1);
  markCalDirty();
  renderCalEditorList();
}

async function saveCalendarioAdmin() {
  const btn = document.getElementById('btn-save-cal');
  if (btn) { btn.textContent='Guardando...'; btn.classList.add('saving'); }
  try {
    const r = await API.saveCalendario(_calEventos);
    if (!r.ok) { showToast('Error al guardar: '+(r.error||''),'error'); }
    else {
      showToast(`✓ Calendario guardado (${r.saved} eventos)`,'ok');
      _calDirty = false;
      updateCalSaveBtn();
      await loadData();
      renderCalendarioAdmin();
    }
  } catch(e) { showToast('Error al guardar','error'); console.error(e); }
  finally { if(btn){ btn.innerHTML='<svg viewBox="0 0 16 16" width="14" height="14" fill="none"><path d="M13.5 4.5L6 12 2.5 8.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Guardar calendario'; btn.classList.remove('saving'); } }
}

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
  btn.classList.add('active');
  // Sync the in-tab PE selector
  syncEvalPEButtons();
  renderAll();
}

/* Selector de PE dentro del tab Miembros */
function selectEvalPE(pe, btn) {
  aPE = pe;
  _pendingScores = {}; _pendingFeedback = {}; _pendingDistScores = {};
  // Sync the top PE bar
  const topBtns = document.querySelectorAll('.admin-pe-bar .pb');
  PORTAL_CONFIG.PERIODOS.forEach((p, i) => topBtns[i]?.classList.toggle('active', p === pe));
  // Update eval PE buttons
  document.querySelectorAll('#eval-pe-btns .pb').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  // Re-render eval content only
  if (_evalMode === 'creators') {
    renderMemberChips();
    if (aMember) renderMemberDetail(aMember);
  } else {
    renderDistrictEditor();
  }
}

function syncEvalPEButtons() {
  const btns = document.querySelectorAll('#eval-pe-btns .pb');
  PORTAL_CONFIG.PERIODOS.forEach((p, i) => btns[i]?.classList.toggle('active', p === aPE));
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
  const tabs=['overview','ranking','criterios','distritos','miembros','rubrica','calendario','config','debug'], idx=tabs.indexOf(tab);
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