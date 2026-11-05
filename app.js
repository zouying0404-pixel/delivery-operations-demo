'use strict';
// Standalone product demo. Every record is generated locally; no production API is used.
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const cityAreas = {
  'São Paulo': ['Pinheiros', 'Vila Mariana', 'Moema', 'Bela Vista', 'Santana', 'Ipiranga'],
  'Rio de Janeiro': ['Botafogo', 'Copacabana', 'Tijuca', 'Ipanema', 'Barra da Tijuca'],
  'Belo Horizonte': ['Savassi', 'Centro', 'Lourdes', 'Pampulha', 'Santa Efigênia']
};
const metricDefs = {
  target: {name:'Target',unit:'min',info:'ATA target configured for the selected city or delivery area.'},
  ata: {name:'ATA (1h)',unit:'min',info:'Simulated average delivery time for the past hour.'},
  realtime: {name:'ATA (Real-time)',unit:'min'},
  margin: {name:'Safety Margin',unit:'min',info:'Safety margin = Target − ATA (1h).'},
  eta: {name:'ETA',unit:'min',compare:true},
  tail: {name:'Tail Order Rate',unit:'%',compare:true},
  supply: {name:'Supply/Demand Ratio',unit:'',compare:true},
  ontime: {name:'C-side On-time Rate',unit:'%',compare:true},
  orders: {name:'New orders (1h)',unit:'',compare:true},
  cancel: {name:'Cancellation Rate',unit:'%',compare:true},
  prep: {name:'Avg meal prep time',unit:'min',compare:true},
  pickup: {name:'Avg pickup wait',unit:'min',compare:true}
};
const defaults = ['target','ata','realtime','margin','eta','tail','supply','ontime'];
let saved = {};
try { saved = JSON.parse(localStorage.getItem('delivery-demo-v1') || '{}'); } catch { /* Fresh demo state. */ }
const state = {
  city:'São Paulo',area:'all',view:'card',metricsTab:'core',strategyTab:'area',tick:0,
  selected:new Set(),search:'',metrics:Array.isArray(saved.metrics) ? saved.metrics.filter(k=>metricDefs[k]) : [...defaults],
  targets:saved.targets || {},history:Array.isArray(saved.history) ? saved.history.slice(0,100) : [],
  actions:saved.actions || {},rules:saved.rules || {merchantReports:2,courierReports:2,prep:25,unprepared:15,assigned:12,redCount:3}
};
function persist() {
  try { localStorage.setItem('delivery-demo-v1', JSON.stringify({metrics:state.metrics,targets:state.targets,history:state.history.slice(0,100),actions:state.actions,rules:state.rules})); }
  catch { toast('Changes apply to this session. Browser storage is unavailable.'); }
}
function seed(value) { let h=0; for (const c of String(value)) h=(h*31+c.charCodeAt(0))>>>0; return h; }
function random(key) { const x=Math.sin(seed(key)*.01+state.tick*.73)*43758.5453; return x-Math.floor(x); }
function targetKey(){return `${state.city}|${state.area}`;}
function target(){return Number(state.targets[targetKey()] || state.targets[`${state.city}|all`] || 40);}
function values() {
  const r=random(state.city+state.area);
  const ata=+(34+r*8).toFixed(1);
  return {target:target(),ata,realtime:+(ata+.8-r*1.3).toFixed(1),margin:+(target()-ata).toFixed(1),eta:+(ata-2.1).toFixed(1),tail:+(3.1+r*3).toFixed(1),supply:+(.9+r*.5).toFixed(1),ontime:+(94-r*10).toFixed(1),orders:Math.round(1680+r*2100),cancel:+(1.3+r*1.2).toFixed(1),prep:+(17+r*5).toFixed(1),pickup:+(3+r*4).toFixed(1)};
}
function merchants() {
  return cityAreas[state.city].flatMap((area,ai)=>Array.from({length:6},(_,i)=>{
    const r=random(`${state.city}/${area}/${i}`), rank=(i+ai)%6;
    const m={id:`D${Object.keys(cityAreas).indexOf(state.city)+1}-${String(ai+1).padStart(2,'0')}${String(i+1).padStart(2,'0')}`,name:`${['Olive Kitchen','Ember Pizza','Green Bowl','Sakura House','Daily Bakery','Casa Grill'][i]} ${ai+1}`,area,
      merchantReports:rank<2?2+Math.floor(r*3):Math.floor(r*2),courierReports:rank<2?2+Math.floor(r*3):Math.floor(r*2),prep:+(rank<2?27+r*8:14+r*10).toFixed(1),unprepared:Math.round(rank<2?18+r*10:3+r*10),assigned:Math.round(rank<2?13+r*7:3+r*8),orders:Math.round(40+r*120),crate:+(82+r*14).toFixed(1)};
    if(rank===2){m.courierReports=2;m.unprepared=16;}
    const red=['merchantReports','courierReports','prep','unprepared','assigned'].filter(k=>m[k]>=state.rules[k]).length;
    m.level=red>=state.rules.redCount?'HIGH':red>=2?'MED':'LOW';
    m.action=state.actions[m.id] || (m.level==='HIGH'?{action:['Shrink delivery radius','Adjust ETA','Pause merchant'][i%3],value:['20%','5 min',''][i%3],source:'System'}:null);
    return m;
  })).filter(m=>state.area==='all'||m.area===state.area).sort((a,b)=>({HIGH:0,MED:1,LOW:2}[a.level]-{HIGH:0,MED:1,LOW:2}[b.level])||b.prep-a.prep);
}
function filteredMerchants(){const q=state.search.toLowerCase();return merchants().filter(m=>!q||`${m.name} ${m.id} ${m.area}`.toLowerCase().includes(q));}
let toastTimer;
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3500);}
function modal(title,body,footer='') {
  $('#modal-content').innerHTML=`<div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-close aria-label="Close dialog">×</button></div><div class="modal-body">${body}</div>${footer?`<div class="modal-footer">${footer}</div>`:''}`;
  if(!$('#modal').open) $('#modal').showModal();
}
const cancelButton='<button class="btn" data-close>Cancel</button>';
function closeModal(){$('#modal').close();}
$('#modal').addEventListener('click',event=>{if(event.target.closest('[data-close]'))closeModal();if(event.target===$('#modal')){const r=$('#modal').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeModal();}});
function chart(title,kind='ata',legend=true){
  const max=kind==='ontime'?100:kind==='surge'?80:60;
  const colors=['#6e63d8','#62ab91','#d6a05f'];
  const series=kind==='surge'?['Historical','Predicted']:['Current','DoD','WoW'];
  const line=(idx)=>Array.from({length:25},(_,i)=>{
    let v=kind==='ontime'?88+Math.sin(i*.8+idx)*4-idx*2:kind==='surge'?8+Math.sin((i-6)*.3)*10+Math.max(0,i-6)*2:30+Math.sin(i*.55+idx)*6+Math.sin(i*.17)*4+idx*1.7;
    if(kind==='surge')v=Math.max(2,v);
    return `${40+i*(540/24)},${155-v/max*125}`;
  });
  let lines='';
  if(kind==='surge'){
    const points=line(0);lines=`<polyline class="line" stroke="${colors[0]}" points="${points.slice(0,20).join(' ')}"/><polyline class="line" stroke="${colors[2]}" stroke-dasharray="5 4" points="${points.slice(19).join(' ')}"/><line x1="467.5" x2="467.5" y1="25" y2="155" stroke="#d9d7e9" stroke-dasharray="4 4"/><text x="470" y="20">Now</text>`;
  }else lines=series.map((_,i)=>`<polyline class="line" stroke="${colors[i]}" opacity="${i?'.65':'1'}" points="${line(i).join(' ')}"/>`).join('');
  const grid=[0,.25,.5,.75,1].map(t=>`<line class="grid" x1="40" y1="${155-t*125}" x2="580" y2="${155-t*125}"/><text x="29" y="${158-t*125}" text-anchor="end">${Math.round(max*t)}</text>`).join('');
  const labels=[0,4,8,12,16,20,24].map(h=>`<text x="${40+h*22.5}" y="177" text-anchor="middle">${String(h).padStart(2,'0')}:00</text>`).join('');
  return `<div class="chart-card"><div class="chart-header"><span class="chart-title">${esc(title)}</span><span class="muted">${kind==='surge'?'merchants':kind==='ontime'?'%':'minutes'}</span></div>${legend?`<div class="chart-legend">${series.map((s,i)=>`<span style="--c:${kind==='surge'&&i===1?colors[2]:colors[i]}">${s}</span>`).join('')}</div>`:''}<svg class="chart-svg" viewBox="0 0 610 190" role="img" aria-label="${esc(title)}. Simulated hourly trend from 00:00 to 24:00.">${grid}${lines}${labels}</svg></div>`;
}
function metricCard(key,v){const d=metricDefs[key];return `<div class="metric-card"><div class="metric-top"><span class="dot"></span>${d.name}${d.info?`<span class="info" title="${esc(d.info)}" aria-label="${esc(d.info)}" tabindex="0">i</span>`:''}${key==='ata'?'<button class="hourly" id="ata-hourly">◷ ATA Hourly</button>':''}</div><div class="metric-value" ${key==='margin'&&v<0?'style="color:var(--red)"':''}>${Number(v).toLocaleString('en-US')}<small>${d.unit}</small></div>${d.compare?'<div class="metric-compare"><span>DoD <b>2.8% ↘</b></span><span>WoW <b>5.2% ↘</b></span></div>':''}</div>`;}
function renderMetrics(){
  const v=values(),keys=state.metricsTab==='core'?state.metrics:['orders','prep','pickup','cancel'];
  if(state.view==='card') $('#metrics-content').innerHTML=`<div class="metrics-grid">${keys.map(k=>metricCard(k,v[k])).join('')}</div><div class="charts-grid">${chart('Average ATA (trend)')}${chart('On-time Rate C-side (trend)','ontime')}</div>`;
  else $('#metrics-content').innerHTML=`<div class="metrics-table-wrap table-scroll"><table class="data-table"><thead><tr><th>Metric</th><th>${esc(state.area==='all'?state.city:state.area)}</th><th>DoD</th><th>WoW</th></tr></thead><tbody>${keys.map(k=>`<tr><td class="name">${metricDefs[k].name}</td><td>${v[k]} ${metricDefs[k].unit}</td><td>−2.8%</td><td>−5.2%</td></tr>`).join('')}</tbody></table></div>`;
}
function renderMerchants(){
  const all=merchants(),rows=filteredMerchants();
  $('#merchant-count').textContent=`${all.length} merchants`;
  $('#merchant-summary').innerHTML=`<span><b>${all.length}</b> Total merchants</span>${['HIGH','MED','LOW'].map(l=>`<span><i class="summary-dot" style="background:${{HIGH:'var(--red)',MED:'var(--orange)',LOW:'var(--green)'}[l]}"></i><b>${all.filter(m=>m.level===l).length}</b> ${l==='MED'?'Medium':l[0]+l.slice(1).toLowerCase()} surge</span>`).join('')}<span><b>${all.filter(m=>m.action).length}</b> Active interventions</span>`;
  const cols=[['merchantReports','Merchant reports<br>(1h)'],['courierReports','Courier reports<br>(1h)'],['prep','Avg prep time<br>(min)'],['unprepared','Unprepared<br>&gt;15 min'],['assigned','Assigned, not<br>picked up'],['orders','New orders<br>(1h)'],['crate','C-side on-time<br>rate']];
  $('#merchant-table').innerHTML=`<thead><tr><th><input type="checkbox" id="select-all" aria-label="Select all visible merchants" ${rows.length&&rows.every(m=>state.selected.has(m.id))?'checked':''}></th><th>Merchant name</th><th>Merchant ID</th><th>Delivery area</th>${cols.map(([,label])=>`<th>${label}</th>`).join('')}<th>Surge level</th><th title="Orange: system strategy. Blue: manual strategy.">Action ⓘ</th></tr></thead><tbody>${rows.map(m=>`<tr><td><input class="select-merchant" type="checkbox" data-id="${m.id}" aria-label="Select ${esc(m.name)}" ${state.selected.has(m.id)?'checked':''}></td><td class="name">${esc(m.name)}</td><td class="id">${m.id}</td><td>${esc(m.area)}</td>${cols.map(([k])=>`<td class="${state.rules[k]&&m[k]>=state.rules[k]?'bad':''}">${m[k]}${k==='crate'?'%':''}</td>`).join('')}<td><span class="level ${m.level.toLowerCase()}">${m.level}</span></td><td>${m.action?`<button class="action-tag ${m.action.source==='Manual'?'manual':''}" data-action-id="${m.id}" title="${m.action.source} strategy details">${esc(m.action.action)} ${esc(m.action.value)}</button>`:'—'}</td></tr>`).join('')||'<tr><td colspan="13" class="empty">No merchants match your search.</td></tr>'}</tbody>`;
  updateSelection();
  $('#history-count').textContent=state.history.length?`(${state.history.length})`:'';
  $('#edit-rules').textContent=state.area==='all'?'⚙ Edit rules':'⚙ View rules';
}
function updateSelection(){const n=state.selected.size;$('#selection-count').textContent=n?`${n} merchant${n>1?'s':''} selected`:'No merchants selected';$('#intervene').disabled=!n;}
function strategies(){return cityAreas[state.city].filter(a=>state.area==='all'||state.area===a).map((area,i)=>({area,id:`AREA-${i+1}`,source:i%2?'System':'Manual',action:`Delivery range ${10+i*5}%`,period:`12:00 – ${14+i}:30`,status:i%3===0?'Ongoing':i%3===1?'Pending':'Expired',orders:310+i*139,merchants:12+i*3}));}
function renderStrategies(){
  const s=strategies(),recent=s.filter(r=>r.status!=='Pending'),active=s.filter(r=>r.status==='Ongoing');
  const sum=(rows,key)=>rows.reduce((n,r)=>n+r[key],0);
  const activeMerchants=sum(active,'merchants');
  const shrink=activeMerchants?Math.round(active.reduce((n,r)=>n+parseInt(r.action.replace('Delivery range ',''),10)*r.merchants,0)/activeMerchants):0;
  $('#strategy-cards').innerHTML=[['SURGE ORDERS (1H)',sum(recent,'orders').toLocaleString(),'Rolling 1h window'],['MERCHANT AFFECTED (1H)',sum(recent,'merchants'),'Unique merchants · 1h'],['SURGE ORDERS',sum(active,'orders').toLocaleString(),'Current interventions'],['MERCHANT AFFECTED',activeMerchants,'Currently affected merchants'],['AVG SHRINK RATIO',`${shrink}%`,'Weighted by affected merchants']].map(([label,number,sub])=>`<div class="strategy-card"><div class="label">${label}</div><div class="number">${number}</div><div class="sub">${sub}</div></div>`).join('');
  $('#strategy-chart').innerHTML=chart('Affected merchant count · historical & forecast','surge');
  $('#strategy-table').innerHTML=state.strategyTab==='area'?`<thead><tr><th>Delivery area</th><th>Area ID</th><th>Surge source</th><th>Action</th><th>Effective period</th><th>Status</th><th>Surge orders</th></tr></thead><tbody>${s.map(r=>`<tr><td class="name">${esc(r.area)}</td><td>${r.id}</td><td>${r.source}</td><td>${r.action}</td><td>${r.period}</td><td><span class="status ${r.status.toLowerCase()}">${r.status}</span></td><td>${r.orders}</td></tr>`).join('')}</tbody>`:`<thead><tr><th>Surge source</th><th>Action</th><th>Status</th><th>Merchant numbers</th><th>Surge orders</th></tr></thead><tbody>${s.map(r=>`<tr><td>${r.source}</td><td>${r.action}</td><td><span class="status ${r.status.toLowerCase()}">${r.status}</span></td><td>${r.merchants}</td><td>${r.orders}</td></tr>`).join('')}</tbody>`;
}
function render(){renderMetrics();renderMerchants();renderStrategies();}
function updateAreas(){$('#area').innerHTML='<option value="all">All Areas</option>'+cityAreas[state.city].map(a=>`<option>${esc(a)}</option>`).join('');}
$('#city').addEventListener('change',e=>{state.city=e.target.value;state.area='all';state.selected.clear();updateAreas();render();});
$('#area').addEventListener('change',e=>{state.area=e.target.value;state.selected.clear();render();});
function refresh(manual=false){state.tick++;render();$('#updated').textContent=`Updated ${new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})} · every 1 min`;if(manual)toast('Simulated metrics refreshed');}
$('#refresh').addEventListener('click',()=>refresh(true));
// Pause automatic refresh while a dialog is open to keep editing stable.
setInterval(()=>{if(!$('#modal').open)refresh();},60000);
$$('[data-view]').forEach(b=>b.addEventListener('click',()=>{state.view=b.dataset.view;$$('[data-view]').forEach(x=>x.classList.toggle('active',x===b));renderMetrics();}));
$$('[data-metrics-tab]').forEach(b=>b.addEventListener('click',()=>{state.metricsTab=b.dataset.metricsTab;$$('[data-metrics-tab]').forEach(x=>x.classList.toggle('active',x===b));renderMetrics();}));
$$('[data-strategy]').forEach(b=>b.addEventListener('click',()=>{state.strategyTab=b.dataset.strategy;$$('[data-strategy]').forEach(x=>x.classList.toggle('active',x===b));renderStrategies();}));
$$('.collapse').forEach(b=>b.addEventListener('click',()=>{const collapsed=$(`#${b.dataset.panel}`).classList.toggle('collapsed');b.textContent=collapsed?'⌄':'⌃';b.setAttribute('aria-expanded',String(!collapsed));}));
$$('.fullscreen').forEach(b=>b.addEventListener('click',()=>{const panel=$(`#${b.dataset.panel}`);panel.classList.toggle('expanded');panel.classList.remove('collapsed');}));
document.addEventListener('keydown',e=>{if(e.key==='Escape')$$('.panel.expanded').forEach(p=>p.classList.remove('expanded'));});
$('#merchant-search').addEventListener('input',e=>{state.search=e.target.value;renderMerchants();});
$('#merchant-table').addEventListener('change',e=>{
  if(e.target.id==='select-all')filteredMerchants().forEach(m=>e.target.checked?state.selected.add(m.id):state.selected.delete(m.id));
  else if(e.target.classList.contains('select-merchant'))e.target.checked?state.selected.add(e.target.dataset.id):state.selected.delete(e.target.dataset.id);
  renderMerchants();
});
$('#clear-selection').addEventListener('click',()=>{state.selected.clear();renderMerchants();});
$('#target-edit').addEventListener('click',()=>{
  modal('Edit delivery target',`<p class="modal-sub">Set the ATA target for ${esc(state.area==='all'?state.city:state.area)}. This updates the safety margin in this browser.</p><div class="form-group"><label class="form-label" for="target-value">Target (minutes)</label><input id="target-value" type="number" min="10" max="120" step="1" value="${target()}"></div><p class="error" id="target-error"></p>`,`${cancelButton}<button class="btn primary" id="save-target">Save target</button>`);
  $('#save-target').onclick=()=>{const v=Number($('#target-value').value);if(!Number.isFinite(v)||v<10||v>120){$('#target-error').textContent='Enter a target between 10 and 120 minutes.';return;}state.targets[targetKey()]=v;persist();renderMetrics();closeModal();toast('Target updated');};
});
$('#metrics-content').addEventListener('click',e=>{if(e.target.closest('#ata-hourly'))modal('ATA hourly overview',`<p class="modal-sub">${esc(state.city)} · ${esc(state.area==='all'?'All Areas':state.area)} · simulated hourly averages</p>${chart('Average delivery time by hour')}<div class="notice">Each point is a simulated hourly average. The chart does not represent live delivery performance.</div>`,'<button class="btn primary" data-close>Done</button>');});
$('#edit-metrics').addEventListener('click',()=>{
  let draft=[...state.metrics];
  const draw=()=>{
    modal('Edit metrics',`<p class="modal-sub">Drag a metric from the pool to Core Metrics. Drag selected metrics to reorder. On touch devices, focus a metric and press Enter to select it.</p><div class="metric-editor"><div><label class="form-label">Metric pool</label><div class="metric-pool">${Object.entries(metricDefs).map(([k,d])=>`<div class="metric-chip" draggable="true" tabindex="0" data-metric="${k}" role="button" aria-label="Add ${d.name}"><span>⠿ &nbsp; ${d.name}</span>${draft.includes(k)?'<span class="pool-tag">C</span>':''}</div>`).join('')}</div></div><div><label class="form-label">Core Metrics <span class="muted">${draft.length} selected</span></label><div class="metric-drop" id="metric-drop">${draft.map(k=>`<div class="metric-chip selected" draggable="true" data-selected="${k}"><span>⠿ &nbsp; ${metricDefs[k].name}</span><button data-remove="${k}" aria-label="Remove ${metricDefs[k].name}">×</button></div>`).join('')||'<p class="empty">Drop metrics here</p>'}</div></div></div>`,`${cancelButton}<button class="btn" id="restore-metrics">Reset</button><button class="btn primary" id="save-metrics">Save metrics</button>`);
    $$('[draggable]', $('#modal')).forEach(el=>el.ondragstart=e=>{e.dataTransfer.setData('text/plain',el.dataset.metric||el.dataset.selected);e.dataTransfer.effectAllowed='move';});
    $('#metric-drop').ondragover=e=>{e.preventDefault();$('#metric-drop').classList.add('dragover');};
    $('#metric-drop').ondragleave=()=>$('#metric-drop').classList.remove('dragover');
    $('#metric-drop').ondrop=e=>{e.preventDefault();const k=e.dataTransfer.getData('text/plain');if(!metricDefs[k])return;const before=e.target.closest('[data-selected]')?.dataset.selected;draft=draft.filter(x=>x!==k);const i=before?draft.indexOf(before):-1;if(i>=0)draft.splice(i,0,k);else draft.push(k);draw();};
    $$('[data-remove]', $('#modal')).forEach(b=>b.onclick=()=>{draft=draft.filter(k=>k!==b.dataset.remove);draw();});
    $$('[data-metric]', $('#modal')).forEach(b=>b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(!draft.includes(b.dataset.metric)){draft.push(b.dataset.metric);draw();}}});
    $('#restore-metrics').onclick=()=>{draft=[...defaults];draw();};
    $('#save-metrics').onclick=()=>{if(!draft.length){toast('Select at least one metric');return;}state.metrics=draft;persist();renderMetrics();closeModal();toast('Metrics updated');};
  };draw();
});
$('#edit-rules').addEventListener('click',()=>{
  const readonly=state.area!=='all';
  const names={merchantReports:'Merchant stuck-meal reports (1h)',courierReports:'Courier stuck-meal reports (1h)',prep:'Average meal prep time (min)',unprepared:'Orders unprepared >15 min',assigned:'Assigned, not-picked-up orders',redCount:'Red signals required for HIGH surge'};
  modal(readonly?'View surge rules':'Edit surge rules',`<p class="modal-sub">${readonly?'Rules are read-only in a delivery-area view. Select All Areas to edit city-level rules.':'Demo-only thresholds. HIGH surge requires the configured number of red signals; MED requires at least two.'}</p><div class="field-row">${Object.entries(names).map(([k,n])=>`<div class="form-group"><label class="form-label" for="rule-${k}">${n}</label><input id="rule-${k}" data-rule="${k}" type="number" min="1" max="${k==='redCount'?5:120}" step="1" value="${state.rules[k]}" ${readonly?'disabled':''}></div>`).join('')}</div><p id="rule-error" class="error"></p>`,`${cancelButton}${readonly?'':'<button class="btn primary" id="save-rules">Save rules</button>'}`);
  if(!readonly)$('#save-rules').onclick=()=>{
    const inputs=$$('[data-rule]');if(inputs.some(el=>!el.checkValidity())){$('#rule-error').textContent='Use positive whole numbers within the allowed range.';return;}
    inputs.forEach(el=>state.rules[el.dataset.rule]=Number(el.value));persist();renderMerchants();closeModal();toast('City surge rules updated');
  };
});
$('#intervene').addEventListener('click',()=>{
  const selected=merchants().filter(m=>state.selected.has(m.id));if(!selected.length)return;
  modal('Intervene on selected merchants',`<p class="modal-sub">Create a simulated intervention for ${selected.length} selected merchant${selected.length>1?'s':''}. Changes are stored in this browser only.</p>
  <div class="form-group"><label class="form-label">Intervention action <span class="required">*</span></label><div class="choices">${['Shrink delivery radius','Adjust ETA','Pause merchant'].map((a,i)=>`<label class="choice"><input name="action" type="radio" value="${a}" ${i===0?'checked':''}>${a}</label>`).join('')}</div></div>
  <div class="field-row"><div class="form-group" id="action-amount-wrap"><label class="form-label" id="action-amount-label" for="action-amount">Shrink ratio (%)</label><input id="action-amount" type="number" min="5" max="80" step="5" value="20"></div><div class="form-group"><label class="form-label" for="duration">Duration (minutes)</label><select id="duration" class="full-width"><option>15</option><option selected>30</option><option>60</option><option>120</option></select></div></div>
  <div class="form-group"><label class="form-label">Reason <span class="required">*</span></label><div class="choices">${['System malfunction','Severe weather','Traffic control','Courier capacity is insufficient in this area','Customization'].map(a=>`<label class="choice"><input name="reason" type="radio" value="${a}">${a}</label>`).join('')}</div><div id="custom-reason-wrap" hidden><textarea id="custom-reason" maxlength="200" placeholder="The maximum number of characters allowed is 200"></textarea><div class="counter" id="reason-counter">0 / 200</div></div></div>
  <div class="form-group"><label class="form-label" for="operation-notes">Notes on operation <span class="muted">Optional</span></label><textarea id="operation-notes" maxlength="100" placeholder="Record background information for this demo action (maximum 100 characters)."></textarea><div class="counter" id="notes-counter">0 / 100</div></div>
  <div class="form-group"><label class="form-label">Selected merchants</label><div class="selected-list">${selected.map(m=>`${esc(m.name)} <span class="muted">${m.id}</span>`).join('<br>')}</div></div><p id="intervention-error" class="error"></p>`,`${cancelButton}<button class="btn primary" id="review-intervention">Review action</button>`);
  $$('input[name=action]').forEach(el=>el.onchange=()=>{
    const a=el.value;$('#action-amount-wrap').hidden=a==='Pause merchant';$('#action-amount-label').textContent=a==='Adjust ETA'?'Additional ETA (minutes)':'Shrink ratio (%)';$('#action-amount').value=a==='Adjust ETA'?5:20;$('#action-amount').max=a==='Adjust ETA'?30:80;
  });
  $$('input[name=reason]').forEach(el=>el.onchange=()=>$('#custom-reason-wrap').hidden=el.value!=='Customization');
  $('#custom-reason').oninput=e=>$('#reason-counter').textContent=`${e.target.value.length} / 200`;
  $('#operation-notes').oninput=e=>$('#notes-counter').textContent=`${e.target.value.length} / 100`;
  $('#review-intervention').onclick=()=>{
    const action=$('input[name=action]:checked').value,chosen=$('input[name=reason]:checked')?.value;
    const reason=chosen==='Customization'?$('#custom-reason').value.trim():chosen;
    if(!reason){$('#intervention-error').textContent='Select a reason and complete the custom reason if applicable.';return;}
    if(action!=='Pause merchant'&&!$('#action-amount').checkValidity()){$('#intervention-error').textContent='Enter a valid intervention amount.';return;}
    const value=action==='Pause merchant'?'':$('#action-amount').value+(action==='Adjust ETA'?' min':'%');
    const record={action,value,reason,notes:$('#operation-notes').value.trim(),duration:Number($('#duration').value),source:'Manual',time:new Date().toISOString(),city:state.city,merchants:selected.map(m=>({id:m.id,name:m.name})),ids:selected.map(m=>m.id)};
    modal('Confirm simulated intervention',`<div class="notice">This changes the demo only. No merchant or live delivery operation will be affected.</div><div class="history-item"><strong>${esc(action)} ${esc(value)}</strong><p>Duration: ${record.duration} minutes</p><p>Reason: ${esc(reason)}</p>${record.notes?`<p>Notes: ${esc(record.notes)}</p>`:''}</div><div class="form-group"><label class="form-label">${selected.length} selected merchants</label><div class="selected-list">${selected.map(m=>`${esc(m.name)} · ${m.id}`).join('<br>')}</div></div>`,`${cancelButton}<button class="btn primary" id="confirm-intervention">Confirm demo action</button>`);
    $('#confirm-intervention').onclick=()=>{record.ids.forEach(id=>state.actions[id]=record);state.history.unshift(record);state.history=state.history.slice(0,100);state.selected.clear();persist();renderMerchants();closeModal();toast(`Demo intervention applied to ${selected.length} merchants`);};
  };
});
function recordDetails(r){return `<div class="history-item"><strong>${esc(r.action)} ${esc(r.value)}</strong><small>${esc(r.source)} · ${new Date(r.time).toLocaleString()} · ${esc(r.city||state.city)}</small><p>Reason: ${esc(r.reason||'Simulated system threshold')}</p>${r.notes?`<p>Notes: ${esc(r.notes)}</p>`:''}<p>Duration: ${r.duration||30} minutes</p><p>${(r.merchants||[]).map(m=>`${esc(m.name)} (${esc(m.id)})`).join(', ')}</p></div>`;}
$('#history').addEventListener('click',()=>modal('Intervention history',`<p class="modal-sub">Manual demo actions saved in this browser. Auto-generated strategies are shown in Strategy Details.</p>${state.history.length?state.history.map(recordDetails).join(''):'<div class="empty">No manual interventions yet. Select merchants and create a demo action.</div>'}`,'<button class="btn primary" data-close>Done</button>'));
$('#merchant-table').addEventListener('click',e=>{const b=e.target.closest('[data-action-id]');if(!b)return;const m=merchants().find(m=>m.id===b.dataset.actionId);if(!m?.action)return;const r={time:new Date().toISOString(),city:state.city,merchants:[m],...m.action};modal(`${r.source} strategy`,recordDetails(r),'<button class="btn primary" data-close>Done</button>');});
function csv(name,rows){
  // Prefix spreadsheet formula characters to keep exports as text when appropriate.
  const encode=v=>'"'+String(v??'').replace(/^[=+@\-]/,"'$&").replace(/"/g,'""')+'"';
  const blob=new Blob(['\uFEFF'+rows.map(r=>r.map(encode).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('CSV exported');
}
$('#export-metrics').addEventListener('click',()=>{const v=values();csv('demo-metrics.csv',[['City','Area','Metric','Value','Unit','Data source'],...Object.entries(v).map(([k,n])=>[state.city,state.area,metricDefs[k].name,n,metricDefs[k].unit,'Simulated'])]);});
$('#export-strategies').addEventListener('click',()=>csv('demo-strategies.csv',[['Area','Source','Action','Status','Surge orders','Data source'],...strategies().map(s=>[s.area,s.source,s.action,s.status,s.orders,'Simulated'])]));
updateAreas();render();
