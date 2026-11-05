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
const numericCatalog = [["eta", "ETA", "min"], ["me", "Avg ME", "min"], ["tail", "Tail Order Rate", "%"], ["supply", "Supply/Demand Ratio", ""], ["ontime", "C-side On-time Rate", "%"], ["online", "Online Couriers", ""], ["delivered", "Delivered Orders", ""], ["completedCouriers", "Couriers w/ Completed Orders", ""], ["workload", "Courier Workload", ""], ["pushed", "Pushed Orders", ""], ["pushedTasks", "Pushed Task Orders", ""], ["completedTasks", "Completed Task Orders", ""], ["acceptRate", "Task Acceptance Rate", "%"], ["acceptPickup", "Task Accept→Pickup Rate", "%"], ["pickupDelivery", "Task Pickup→Delivery Rate", "%"], ["efficiency", "Courier Efficiency", ""], ["onDelivery", "Couriers on Delivery", ""], ["delayed", "Delayed Task Order %", "%"], ["delay15", ">15min Delay % (C-side)", "%"], ["assignRate", "D-side On-time Assign Rate", "%"], ["utilization", "Courier Utilization (RT)", "%"], ["pushedCancel", "Pushed Order Cancel Rate", "%"], ["lateVolume", "Late Order Volume (C-side)", ""], ["hold", "Avg Order Hold Time", "min"], ["acceptTime", "Avg Order Acceptance Time", "min"], ["restaurantTime", "Avg Time to Restaurant", "min"], ["pickupTime", "Avg Pickup Time", "min"], ["orders55", "Orders >55min", ""], ["onTimeCount", "On-time", ""], ["ds", "D/S Ratio", ""], ["cookMed", "Cook time med (1h)", "min"], ["cookAvg", "Cook time avg (1h)", "min"], ["newAvg", "New orders avg (1h)", ""], ["uncooked", "Uncooked orders avg (>Xmin)", ""], ["receiveCancel", "Courier-receive cancel rate (Area)", "%"], ["waitMean", "Client wait time mean (1h)", "min"], ["waitMed", "Client wait time med (1h)", "min"], ["backlog", "Backlog orders avg (>Xmin)", ""], ["ifood", "ifood Subsidy", "R$"], ["subsidy99", "99 Subsidy", "R$"]];
const chartCatalog = [["ataTrend", "Average ATA (trend)", "ata"], ["etaTrend", "Average ETA (trend)", "eta"], ["meTrend", "Average ME (trend)", "me"], ["ontimeTrend", "On-time Rate C-side (trend)", "ontime"], ["onlineTrend", "Online Couriers (trend)", "online"], ["pushedTrend", "Pushed Orders (trend)", "pushed"], ["hourlyTrend", "ATA Hourly (trend)", "ata"], ["targetTrend", "Target Trend", "target"], ["taskTrend", "Pushed Task Orders (trend)", "pushedTasks"], ["cumulativePushed", "Cumulative Pushed Orders (RT)", "pushed"], ["cumulativeCompleted", "Cumulative Completed Orders (RT)", "completedTasks"], ["holdTrend", "Avg Hold Time (trend)", "hold"], ["firstAccept", "5-min 1st Accept Rate (trend)", "acceptRate"]];
numericCatalog.forEach(([key,name,unit])=>metricDefs[key]={...metricDefs[key],name,unit,compare:true});
chartCatalog.forEach(([key,name,source])=>metricDefs[key]={name,source,chart:true,unit:metricDefs[source]?.unit??'min'});
const poolKeys = [...numericCatalog,...chartCatalog].map(item=>item[0]);
const defaults = ['eta','tail','supply','ontime','ataTrend','ontimeTrend'];
let saved = {};
try { saved = JSON.parse(localStorage.getItem('delivery-demo-v1') || '{}'); } catch { /* Fresh demo state. */ }
if(Array.isArray(saved.customMetrics))saved.customMetrics.forEach(d=>{if(d.key&&d.name){metricDefs[d.key]=d;poolKeys.push(d.key);}});
const state = {
  city:'São Paulo',area:'all',view:'card',metricsTab:'core',strategyTab:'area',tick:0,
  selected:new Set(),search:'',metrics:Array.isArray(saved.metrics) ? saved.metrics.filter(k=>metricDefs[k]) : [...defaults],
  sections:Array.isArray(saved.sections)?saved.sections.map(s=>({...s,metrics:s.metrics.filter(k=>metricDefs[k])})):[{id:'monitor',name:'Monitoring Section',metrics:['pushed','completedTasks','acceptRate','efficiency','pushedTrend','onlineTrend']}],
  customMetrics:saved.customMetrics||[],targets:saved.targets || {},history:Array.isArray(saved.history) ? saved.history.slice(0,100) : [],
  actions:saved.actions || {},rules:saved.rules || {merchantReports:2,courierReports:2,prep:25,unprepared:15,assigned:12,redCount:3}
};
if(!Array.isArray(saved.sections)&&Array.isArray(saved.metrics)){state.metrics=[...new Set([...state.metrics.filter(k=>!['target','ata','realtime','margin'].includes(k)),'ataTrend','ontimeTrend'])];}
function persist() {
  try { localStorage.setItem('delivery-demo-v1', JSON.stringify({metrics:state.metrics,sections:state.sections,customMetrics:state.customMetrics,targets:state.targets,history:state.history.slice(0,100),actions:state.actions,rules:state.rules})); }
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
  $('#modal').classList.remove('metrics-modal');
  $('#modal-content').innerHTML=`<div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-close aria-label="Close dialog">×</button></div><div class="modal-body">${body}</div>${footer?`<div class="modal-footer">${footer}</div>`:''}`;
  if(!$('#modal').open) $('#modal').showModal();
}
const cancelButton='<button class="btn" data-close>Cancel</button>';
function closeModal(){$('#modal').close();}
$('#modal').addEventListener('click',event=>{if(event.target.closest('[data-close]'))closeModal();if(event.target===$('#modal')){const r=$('#modal').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeModal();}});
function chart(title,kind='ata',legend=true){
  const definition=metricDefs[kind],source=definition?.source,unit=definition?.unit;
  const base=source?Number(metricValue(source)):30;
  const max=unit==='%'||kind==='ontime'?100:kind==='surge'?80:source?Math.max(10,Math.ceil(base*1.4/10)*10):60;
  const colors=['#6e63d8','#62ab91','#d6a05f'];
  const series=kind==='surge'?['Historical','Predicted']:['Current','DoD','WoW'];
  const line=(idx)=>Array.from({length:25},(_,i)=>{
    let v=source?(kind==='targetTrend'?target():Math.max(0,base*(.85+.12*Math.sin(i*.55+idx)+idx*.03))):kind==='ontime'?88+Math.sin(i*.8+idx)*4-idx*2:kind==='surge'?8+Math.sin((i-6)*.3)*10+Math.max(0,i-6)*2:30+Math.sin(i*.55+idx)*6+Math.sin(i*.17)*4+idx*1.7;
    if(kind==='surge')v=Math.max(2,v);
    return `${40+i*(540/24)},${155-v/max*125}`;
  });
  let lines='';
  if(kind==='surge'){
    const points=line(0);lines=`<polyline class="line" stroke="${colors[0]}" points="${points.slice(0,20).join(' ')}"/><polyline class="line" stroke="${colors[2]}" stroke-dasharray="5 4" points="${points.slice(19).join(' ')}"/><line x1="467.5" x2="467.5" y1="25" y2="155" stroke="#d9d7e9" stroke-dasharray="4 4"/><text x="470" y="20">Now</text>`;
  }else lines=series.map((_,i)=>`<polyline class="line" stroke="${colors[i]}" opacity="${i?'.65':'1'}" points="${line(i).join(' ')}"/>`).join('');
  const grid=[0,.25,.5,.75,1].map(t=>`<line class="grid" x1="40" y1="${155-t*125}" x2="580" y2="${155-t*125}"/><text x="29" y="${158-t*125}" text-anchor="end">${Math.round(max*t)}</text>`).join('');
  const labels=[0,4,8,12,16,20,24].map(h=>`<text x="${40+h*22.5}" y="177" text-anchor="middle">${String(h).padStart(2,'0')}:00</text>`).join('');
  return `<div class="chart-card"><div class="chart-header"><span class="chart-title">${esc(title)}</span><span class="muted">${kind==='surge'?'merchants':kind==='ontime'?'%':unit!==undefined?unit:'minutes'}</span></div>${legend?`<div class="chart-legend">${series.map((s,i)=>`<span style="--c:${kind==='surge'&&i===1?colors[2]:colors[i]}">${s}</span>`).join('')}</div>`:''}<svg class="chart-svg" viewBox="0 0 610 190" role="img" aria-label="${esc(title)}. Simulated hourly trend from 00:00 to 24:00.">${grid}${lines}${labels}</svg></div>`;
}
function metricCard(key,v){const d=metricDefs[key];return `<div class="metric-card"><div class="metric-top"><span class="dot"></span>${esc(d.name)}${d.info?`<span class="info" title="${esc(d.info)}" aria-label="${esc(d.info)}" tabindex="0">i</span>`:''}${key==='ata'?'<button class="hourly" id="ata-hourly">◷ ATA Hourly</button>':''}</div><div class="metric-value" ${key==='margin'&&v<0?'style="color:var(--red)"':''}>${Number(v).toLocaleString('en-US')}<small>${d.unit}</small></div>${d.custom&&d.thresholds?.some(t=>t!==null&&Number(v)>=t)?'<div class="alert-indicator">⚑ '+(['Severe','Moderate','Mild'][[2,1,0].findIndex(i=>d.thresholds[i]!==null&&Number(v)>=d.thresholds[i])]||'Alert')+'</div>':''}${d.compare?'<div class="metric-compare"><span>DoD <b>2.8% ↘</b></span><span>WoW <b>5.2% ↘</b></span></div>':''}</div>`;}
function metricValue(key,v=values()) {
  if(v[key]!==undefined)return v[key];
  const d=metricDefs[key],r=random(state.city+state.area+key);
  if(d.formula){try{return +evaluateMetricFormula(d.formula,v).toFixed(1);}catch{return '—';}}
  return d.unit==='%'?+(80+r*18).toFixed(1):d.unit==='min'?+(2+r*25).toFixed(1):d.unit==='R$'?+(3+r*8).toFixed(1):Math.round(100+r*2200);
}
function renderMetrics(){
  const tabs=$('[data-metrics-tab]').parentElement;
  tabs.innerHTML=`<button class="tab ${state.metricsTab==='core'?'active':''}" data-metrics-tab="core">Core Metrics</button>${state.sections.map(s=>`<button class="tab ${state.metricsTab===s.id?'active':''}" data-metrics-tab="${esc(s.id)}">${esc(s.name)}</button>`).join('')}`;
  const v=values(),keys=state.metricsTab==='core'?state.metrics:(state.sections.find(s=>s.id===state.metricsTab)?.metrics||[]);
  const fixed=state.metricsTab==='core'?['target','ata','realtime','margin']:[];
  const numeric=[...new Set([...fixed,...keys.filter(k=>!metricDefs[k].chart)])],charts=keys.filter(k=>metricDefs[k].chart);
  const chartsHTML=charts.length?`<div class="charts-grid">${charts.map(k=>chart(metricDefs[k].name,k)).join('')}</div>`:'';
  if(state.view==='card') $('#metrics-content').innerHTML=`<div class="metrics-grid">${numeric.map(k=>metricCard(k,metricValue(k,v))).join('')}</div>${chartsHTML}${!numeric.length&&!charts.length?'<div class="empty">No metrics in this section. Open Edit metrics to add some.</div>':''}`;
  else $('#metrics-content').innerHTML=`<div class="metrics-table-wrap table-scroll"><table class="data-table"><thead><tr><th>Metric</th><th>${esc(state.area==='all'?state.city:state.area)}</th><th>DoD</th><th>WoW</th></tr></thead><tbody>${numeric.map(k=>`<tr><td class="name">${esc(metricDefs[k].name)}</td><td>${metricValue(k,v)} ${esc(metricDefs[k].unit)}</td><td>−2.8%</td><td>−5.2%</td></tr>`).join('')}</tbody></table></div>${chartsHTML}`;
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
$('#city').addEventListener('change',e=>{state.city=e.target.value;state.area='all';state.selected.clear();// Parse arithmetic without executing user-supplied JavaScript.
function evaluateMetricFormula(formula, supplied=values()) {
  let expression=formula;
  Object.entries(metricDefs).filter(([,d])=>!d.chart&&!d.formula).sort((a,b)=>b[1].name.length-a[1].name.length).forEach(([k,d])=>{
    expression=expression.split(d.name).join(String(metricValue(k,supplied)));
  });
  const tokens=expression.match(/\d+(?:\.\d+)?|[()+*/-]/g)||[];
  if(tokens.join('')!==expression.replace(/\s/g,''))throw Error('Use metric names, numbers and + − * / ( ).');
  let i=0;
  function atom(){const token=tokens[i++];if(token==='('){const v=sum();if(tokens[i++]!==')')throw Error('Missing closing parenthesis.');return v;}if(token==='-')return -atom();if(token==='+')return atom();if(!/^\d/.test(token||''))throw Error('Incomplete formula.');return Number(token);}
  function product(){let v=atom();while(tokens[i]==='*'||tokens[i]==='/'){const op=tokens[i++],b=atom();if(op==='/'&&b===0)throw Error('Cannot divide by zero.');v=op==='*'?v*b:v/b;}return v;}
  function sum(){let v=product();while(tokens[i]==='+'||tokens[i]==='-'){const op=tokens[i++],b=product();v=op==='+'?v+b:v-b;}return v;}
  const result=sum();if(i!==tokens.length||!Number.isFinite(result))throw Error('Invalid formula.');return result;
}
function openMetricEditor(){
  let core=[...state.metrics],sections=state.sections.map(s=>({...s,metrics:[...s.metrics]})),custom=state.customMetrics.map(d=>({...d}));
  let query='',category='All',drag=null;
  const defs=()=>({...metricDefs,...Object.fromEntries(custom.map(d=>[d.key,d]))});
  const allKeys=()=>[...new Set([...poolKeys,...custom.map(d=>d.key)])];
  const zoneKeys=id=>id==='core'?core:sections.find(s=>s.id===id)?.metrics;
  const assign=(id,keys)=>{if(id==='core')core=keys;else sections.find(s=>s.id===id).metrics=keys;};
  function draw(){
    const d=defs();
    const zone=(id,name,keys)=>`<section class="editor-zone"><div class="zone-heading">${id==='core'?'<strong>Core Metrics</strong>':`<input aria-label="Click to rename this section" placeholder="Click to name this section" data-section-name="${id}" value="${esc(name)}" maxlength="60">`}<span class="zone-count">${keys.length}</span><button class="text-button clear-zone" data-clear="${id}" aria-label="Clear ${esc(name)}">♧ Clear</button>${id==='core'?'':`<button class="text-button" data-delete-section="${id}" aria-label="Remove ${esc(name)} section">× Remove section</button>`}</div><div class="metric-drop" data-zone="${id}" aria-label="${esc(name)} drop zone">${keys.map(k=>`<div class="metric-chip selected" draggable="true" data-drag-key="${k}" data-origin="${id}"><span>⠿ &nbsp; ${esc(d[k].name)}</span><span>${d[k].chart?'<small class="muted">chart</small>':''}<button data-remove-key="${k}" data-zone-id="${id}" aria-label="Remove ${esc(d[k].name)} from ${esc(name)}">×</button></span></div>`).join('')||'<div class="drop-hint">Drag metrics here</div>'}</div></section>`;
    modal('Metric Pool',`<div class="metric-context">${esc(state.city)} · ${esc(state.area==='all'?'All areas (entire city)':state.area)}</div><p class="editor-instruction">Drag from the left to add to Core Metrics · Drag within a zone to reorder</p><div class="metric-editor"><aside class="pool-sidebar"><button class="btn ai-button" id="custom-metric">✧ AI Custom Metric</button><input id="metric-search" aria-label="Search metrics" placeholder="Search metrics…" value="${esc(query)}"><div class="pool-filters">${['All','Numeric','Charts'].map(c=>`<button class="${category===c?'active':''}" data-category="${c}">${c}</button>`).join('')}<span id="pool-count"></span></div><div class="metric-pool" id="metric-pool"></div></aside><div class="editor-zones">${zone('core','Core Metrics',core)}${sections.map(s=>zone(s.id,s.name,s.metrics)).join('')}<button class="add-section" id="add-section">＋ Add Section</button></div></div>`,`<span class="editor-summary">Core: <b>${core.length}</b>${sections.map(s=>` · ${esc(s.name)}: <b>${s.metrics.length}</b>`).join('')}</span>${cancelButton}<button class="btn primary" id="save-metrics">✓ Confirm</button>`);
    $('#modal').classList.add('metrics-modal');
    drawPool();
    $('#metric-search').oninput=e=>{query=e.target.value;drawPool();};
    $$('[data-category]').forEach(b=>b.onclick=()=>{category=b.dataset.category;draw();});
    $$('[data-section-name]').forEach(input=>input.oninput=()=>{sections.find(s=>s.id===input.dataset.sectionName).name=input.value;});
    $$('[data-clear]').forEach(b=>b.onclick=()=>{assign(b.dataset.clear,[]);draw();});
    $$('[data-delete-section]').forEach(b=>b.onclick=()=>{sections=sections.filter(s=>s.id!==b.dataset.deleteSection);draw();});
    $$('[data-remove-key]').forEach(b=>b.onclick=()=>{assign(b.dataset.zoneId,zoneKeys(b.dataset.zoneId).filter(k=>k!==b.dataset.removeKey));draw();});
    $('#add-section').onclick=()=>{sections.push({id:'section-'+Date.now(),name:'Section '+(sections.length+1),metrics:[]});draw();};
    $('#custom-metric').onclick=customForm;
    $('#save-metrics').onclick=()=>{
      if(sections.some(s=>!s.name.trim())){toast('Name each section before confirming.');return;}
      state.metrics=core;state.sections=sections;state.customMetrics=custom;custom.forEach(d=>{metricDefs[d.key]=d;if(!poolKeys.includes(d.key))poolKeys.push(d.key);});
      if(state.metricsTab!=='core'&&!sections.some(s=>s.id===state.metricsTab))state.metricsTab='core';
      persist();renderMetrics();closeModal();toast('Metrics updated');
    };
    bindDrag();
  }
  function drawPool(){
    const d=defs(),visible=allKeys().filter(k=>d[k].name.toLowerCase().includes(query.toLowerCase())&&(category==='All'||(category==='Charts')===!!d[k].chart));
    $('#pool-count').textContent=visible.length;
    $('#metric-pool').innerHTML=[false,true].map(isChart=>{const keys=visible.filter(k=>!!d[k].chart===isChart);return keys.length?`<h4>${isChart?'Charts':'Numeric'} <span>(${keys.length})</span></h4>${keys.map(k=>`<div class="metric-chip" draggable="true" data-drag-key="${k}" data-origin="pool" title="${esc(d[k].logic||'Drag to a section')}"><span>⠿ &nbsp; ${esc(d[k].name)}</span><span>${core.includes(k)?'<span class="pool-tag">C</span>':''}${sections.some(s=>s.metrics.includes(k))?'<span class="pool-tag monitoring-tag">M</span>':''}${d[k].custom?'<span class="pool-tag">AI</span>':''}</span></div>`).join('')}`:'';}).join('')||'<div class="empty">No metrics found.</div>';
    bindDrag();
  }
  function commitDrop(zone,hit,y){
    if(!drag||!defs()[drag.key])return;
    const id=zone.dataset.zone,before=hit?.dataset.dragKey;
    if(before===drag.key&&drag.origin===id)return;
    let list=zoneKeys(id).filter(k=>k!==drag.key),at=before?list.indexOf(before):-1;
    if(at>=0){const rect=hit.getBoundingClientRect();if(y>rect.top+rect.height/2)at++;list.splice(at,0,drag.key);}else list.push(drag.key);
    if(drag.origin!=='pool'&&drag.origin!==id)assign(drag.origin,zoneKeys(drag.origin).filter(k=>k!==drag.key));
    assign(id,list);drag=null;draw();
  }
  function bindDrag(){
    $$('[data-zone]',$('#modal')).forEach(zone=>{zone.ondragover=e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';zone.classList.add('dragover');};zone.ondragleave=()=>zone.classList.remove('dragover');zone.ondrop=e=>{e.preventDefault();commitDrop(zone,e.target.closest('[data-drag-key]'),e.clientY);};});
    $$('[data-drag-key]',$('#modal')).forEach(el=>{
      el.draggable=true;el.style.touchAction='none';
      el.ondragstart=e=>{drag={key:el.dataset.dragKey,origin:el.dataset.origin};e.dataTransfer.setData('text/plain',drag.key);e.dataTransfer.effectAllowed='copy';};
      el.onpointerdown=e=>{
        if(e.button!==0||e.target.closest('button'))return;
        e.preventDefault();let moving=false,ghost=null,lastZone=null;
        const startX=e.clientX,startY=e.clientY;
        const move=ev=>{
          if(!moving&&Math.hypot(ev.clientX-startX,ev.clientY-startY)<5)return;
          if(!moving){moving=true;drag={key:el.dataset.dragKey,origin:el.dataset.origin};ghost=el.cloneNode(true);ghost.classList.add('drag-ghost');document.body.append(ghost);}
          ghost.style.left=ev.clientX+12+'px';ghost.style.top=ev.clientY+8+'px';
          lastZone=document.elementFromPoint(ev.clientX,ev.clientY)?.closest('[data-zone]');
          $$('[data-zone]').forEach(z=>z.classList.toggle('dragover',z===lastZone));
          const scrollBox=lastZone||document.elementFromPoint(ev.clientX,ev.clientY)?.closest('.editor-zones');
          if(scrollBox){const r=scrollBox.getBoundingClientRect();if(ev.clientY>r.bottom-24)scrollBox.scrollTop+=14;if(ev.clientY<r.top+24)scrollBox.scrollTop-=14;}
        };
        const up=ev=>{
          document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',cancel);
          ghost?.remove();$$('.dragover').forEach(z=>z.classList.remove('dragover'));
          if(moving){const target=document.elementFromPoint(ev.clientX,ev.clientY),zone=target?.closest('[data-zone]');if(zone)commitDrop(zone,target.closest('[data-drag-key]'),ev.clientY);else drag=null;}
        };
        const cancel=()=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',cancel);ghost?.remove();drag=null;$$('.dragover').forEach(z=>z.classList.remove('dragover'));};
        document.addEventListener('pointermove',move);document.addEventListener('pointerup',up);document.addEventListener('pointercancel',cancel);
      };
    });
  }
  function customForm(){
    let generated=null;
    const overlay=document.createElement('dialog');overlay.className='custom-metric-dialog';overlay.setAttribute('aria-label','AI Custom Metric');
    overlay.innerHTML=`<div class="modal-head"><h3>✧ AI Custom Metric</h3><button class="icon-btn" data-custom-close aria-label="Close custom metric">×</button></div><div class="modal-body"><p class="modal-sub">Fill in the metric definition and generate a preview; once generated, drag it into Core / a section to use it.</p><div class="notice">Standalone demo · local preview generation. No AI service is connected.</div><div class="form-group"><label class="form-label" for="custom-name">Metric Name <span class="required">*</span></label><input id="custom-name" class="full-width" maxlength="100" placeholder="e.g. Night-peak delivery timeout rate"></div><div class="form-group"><label class="form-label" for="custom-logic">Calculation Logic <span class="required">*</span></label><textarea id="custom-logic" placeholder="e.g. Between 22:00-02:00, orders whose delivery time exceeds ETA / total orders in that window"></textarea><small class="muted">For calculated demo values, use metric names and + - * / ( ).</small></div><div class="alert-heading">Alert Rule (optional) <button class="btn small" id="enable-alert">Enable</button></div><div class="alert-levels" hidden>${['Mild','Moderate','Severe'].map((n,i)=>`<label>${n}<input aria-label="${n} threshold" type="number" step="any" data-threshold="${i}"></label>`).join('')}</div><button class="btn primary full-width" id="generate-custom" disabled>✧ Generate with AI</button><div id="custom-preview"></div></div><div class="modal-footer"><button class="btn" data-custom-close>Cancel</button><button class="btn primary" id="add-custom" disabled>Add to Metric Pool</button></div>`;
    document.body.append(overlay);overlay.showModal();
    const q=s=>$(s,overlay),close=()=>{overlay.close();overlay.remove();};
    $$('[data-custom-close]',overlay).forEach(b=>b.onclick=close);overlay.oncancel=e=>{e.preventDefault();close();};
    const invalidate=()=>{generated=null;q('#custom-preview').innerHTML='';q('#add-custom').disabled=true;q('#generate-custom').disabled=!q('#custom-name').value.trim()||!q('#custom-logic').value.trim();};
    $$('input,textarea',overlay).forEach(el=>el.oninput=invalidate);
    q('#enable-alert').onclick=()=>{q('.alert-levels').hidden=!q('.alert-levels').hidden;q('#enable-alert').textContent=q('.alert-levels').hidden?'Enable':'Enabled';invalidate();};
    q('#generate-custom').onclick=()=>{
      const name=q('#custom-name').value.trim(),logic=q('#custom-logic').value.trim();let result,formula;
      try{result=evaluateMetricFormula(logic);formula=logic;}catch{/* Natural-language definitions use a clearly marked simulated preview. */}
      const unit=/rate|ratio|percent|率|%|100/i.test(name+' '+logic)?'%':/time|minute|时长|时间/i.test(name)?'min':'';
      const thresholds=q('.alert-levels').hidden?[]:$$('[data-threshold]',overlay).map(el=>el.value===''?null:Number(el.value));
      if(thresholds.filter(v=>v!==null).some((v,i,a)=>i&&v<=a[i-1])){q('#custom-preview').innerHTML='<p class="error">Thresholds must increase from Mild to Severe.</p>';return;}
      generated={key:'custom-'+Date.now(),name,logic,formula,unit,compare:true,custom:true,thresholds};
      q('#custom-preview').innerHTML=`<h4>Preview</h4><div class="notice"><strong>${esc(name)}</strong> · Numeric · ${esc(unit||'count')}<p>Calculation logic: ${esc(logic)}</p><p>${formula?'Calculated demo value: '+result.toFixed(1):'Simulated preview value: 12.5 · natural-language logic is stored as a definition.'}</p><p>${thresholds.some(v=>v!==null)?thresholds.map((v,i)=>v===null?'':['Mild','Moderate','Severe'][i]+' ≥ '+v).filter(Boolean).join(' · '):'No alert rule configured'}</p></div>`;
      q('#add-custom').disabled=false;
    };
    q('#add-custom').onclick=()=>{if(!generated)return;custom.push(generated);close();query='';category='All';draw();toast('Custom metric added to the draft pool. Drag it into a section.');};
  }
  draw();
}

updateAreas();render();});
$('#area').addEventListener('change',e=>{state.area=e.target.value;state.selected.clear();render();});
function refresh(manual=false){state.tick++;render();$('#updated').textContent=`Updated ${new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})} · every 1 min`;if(manual)toast('Simulated metrics refreshed');}
$('#refresh').addEventListener('click',()=>refresh(true));
// Pause automatic refresh while a dialog is open to keep editing stable.
setInterval(()=>{if(!$('#modal').open)refresh();},60000);
$$('[data-view]').forEach(b=>b.addEventListener('click',()=>{state.view=b.dataset.view;$$('[data-view]').forEach(x=>x.classList.toggle('active',x===b));renderMetrics();}));
$('#metrics-panel').addEventListener('click',e=>{const b=e.target.closest('[data-metrics-tab]');if(b){state.metricsTab=b.dataset.metricsTab;renderMetrics();}});
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
$('#edit-metrics').addEventListener('click',openMetricEditor);
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
// Parse arithmetic without executing user-supplied JavaScript.
function evaluateMetricFormula(formula, supplied=values()) {
  let expression=formula;
  Object.entries(metricDefs).filter(([,d])=>!d.chart&&!d.formula).sort((a,b)=>b[1].name.length-a[1].name.length).forEach(([k,d])=>{
    expression=expression.split(d.name).join(String(metricValue(k,supplied)));
  });
  const tokens=expression.match(/\d+(?:\.\d+)?|[()+*/-]/g)||[];
  if(tokens.join('')!==expression.replace(/\s/g,''))throw Error('Use metric names, numbers and + − * / ( ).');
  let i=0;
  function atom(){const token=tokens[i++];if(token==='('){const v=sum();if(tokens[i++]!==')')throw Error('Missing closing parenthesis.');return v;}if(token==='-')return -atom();if(token==='+')return atom();if(!/^\d/.test(token||''))throw Error('Incomplete formula.');return Number(token);}
  function product(){let v=atom();while(tokens[i]==='*'||tokens[i]==='/'){const op=tokens[i++],b=atom();if(op==='/'&&b===0)throw Error('Cannot divide by zero.');v=op==='*'?v*b:v/b;}return v;}
  function sum(){let v=product();while(tokens[i]==='+'||tokens[i]==='-'){const op=tokens[i++],b=product();v=op==='+'?v+b:v-b;}return v;}
  const result=sum();if(i!==tokens.length||!Number.isFinite(result))throw Error('Invalid formula.');return result;
}
function openMetricEditor(){
  let core=[...state.metrics],sections=state.sections.map(s=>({...s,metrics:[...s.metrics]})),custom=state.customMetrics.map(d=>({...d}));
  let query='',category='All',drag=null;
  const defs=()=>({...metricDefs,...Object.fromEntries(custom.map(d=>[d.key,d]))});
  const allKeys=()=>[...new Set([...poolKeys,...custom.map(d=>d.key)])];
  const zoneKeys=id=>id==='core'?core:sections.find(s=>s.id===id)?.metrics;
  const assign=(id,keys)=>{if(id==='core')core=keys;else sections.find(s=>s.id===id).metrics=keys;};
  function draw(){
    const d=defs();
    const zone=(id,name,keys)=>`<section class="editor-zone"><div class="zone-heading">${id==='core'?'<strong>Core Metrics</strong>':`<input aria-label="Click to rename this section" placeholder="Click to name this section" data-section-name="${id}" value="${esc(name)}" maxlength="60">`}<span class="zone-count">${keys.length}</span><button class="text-button clear-zone" data-clear="${id}" aria-label="Clear ${esc(name)}">♧ Clear</button>${id==='core'?'':`<button class="text-button" data-delete-section="${id}" aria-label="Remove ${esc(name)} section">× Remove section</button>`}</div><div class="metric-drop" data-zone="${id}" aria-label="${esc(name)} drop zone">${keys.map(k=>`<div class="metric-chip selected" draggable="true" data-drag-key="${k}" data-origin="${id}"><span>⠿ &nbsp; ${esc(d[k].name)}</span><span>${d[k].chart?'<small class="muted">chart</small>':''}<button data-remove-key="${k}" data-zone-id="${id}" aria-label="Remove ${esc(d[k].name)} from ${esc(name)}">×</button></span></div>`).join('')||'<div class="drop-hint">Drag metrics here</div>'}</div></section>`;
    modal('Metric Pool',`<div class="metric-context">${esc(state.city)} · ${esc(state.area==='all'?'All areas (entire city)':state.area)}</div><p class="editor-instruction">Drag from the left to add to Core Metrics · Drag within a zone to reorder</p><div class="metric-editor"><aside class="pool-sidebar"><button class="btn ai-button" id="custom-metric">✧ AI Custom Metric</button><input id="metric-search" aria-label="Search metrics" placeholder="Search metrics…" value="${esc(query)}"><div class="pool-filters">${['All','Numeric','Charts'].map(c=>`<button class="${category===c?'active':''}" data-category="${c}">${c}</button>`).join('')}<span id="pool-count"></span></div><div class="metric-pool" id="metric-pool"></div></aside><div class="editor-zones">${zone('core','Core Metrics',core)}${sections.map(s=>zone(s.id,s.name,s.metrics)).join('')}<button class="add-section" id="add-section">＋ Add Section</button></div></div>`,`<span class="editor-summary">Core: <b>${core.length}</b>${sections.map(s=>` · ${esc(s.name)}: <b>${s.metrics.length}</b>`).join('')}</span>${cancelButton}<button class="btn primary" id="save-metrics">✓ Confirm</button>`);
    $('#modal').classList.add('metrics-modal');
    drawPool();
    $('#metric-search').oninput=e=>{query=e.target.value;drawPool();};
    $$('[data-category]').forEach(b=>b.onclick=()=>{category=b.dataset.category;draw();});
    $$('[data-section-name]').forEach(input=>input.oninput=()=>{sections.find(s=>s.id===input.dataset.sectionName).name=input.value;});
    $$('[data-clear]').forEach(b=>b.onclick=()=>{assign(b.dataset.clear,[]);draw();});
    $$('[data-delete-section]').forEach(b=>b.onclick=()=>{sections=sections.filter(s=>s.id!==b.dataset.deleteSection);draw();});
    $$('[data-remove-key]').forEach(b=>b.onclick=()=>{assign(b.dataset.zoneId,zoneKeys(b.dataset.zoneId).filter(k=>k!==b.dataset.removeKey));draw();});
    $('#add-section').onclick=()=>{sections.push({id:'section-'+Date.now(),name:'Section '+(sections.length+1),metrics:[]});draw();};
    $('#custom-metric').onclick=customForm;
    $('#save-metrics').onclick=()=>{
      if(sections.some(s=>!s.name.trim())){toast('Name each section before confirming.');return;}
      state.metrics=core;state.sections=sections;state.customMetrics=custom;custom.forEach(d=>{metricDefs[d.key]=d;if(!poolKeys.includes(d.key))poolKeys.push(d.key);});
      if(state.metricsTab!=='core'&&!sections.some(s=>s.id===state.metricsTab))state.metricsTab='core';
      persist();renderMetrics();closeModal();toast('Metrics updated');
    };
    bindDrag();
  }
  function drawPool(){
    const d=defs(),visible=allKeys().filter(k=>d[k].name.toLowerCase().includes(query.toLowerCase())&&(category==='All'||(category==='Charts')===!!d[k].chart));
    $('#pool-count').textContent=visible.length;
    $('#metric-pool').innerHTML=[false,true].map(isChart=>{const keys=visible.filter(k=>!!d[k].chart===isChart);return keys.length?`<h4>${isChart?'Charts':'Numeric'} <span>(${keys.length})</span></h4>${keys.map(k=>`<div class="metric-chip" draggable="true" data-drag-key="${k}" data-origin="pool" title="${esc(d[k].logic||'Drag to a section')}"><span>⠿ &nbsp; ${esc(d[k].name)}</span><span>${core.includes(k)?'<span class="pool-tag">C</span>':''}${sections.some(s=>s.metrics.includes(k))?'<span class="pool-tag monitoring-tag">M</span>':''}${d[k].custom?'<span class="pool-tag">AI</span>':''}</span></div>`).join('')}`:'';}).join('')||'<div class="empty">No metrics found.</div>';
    bindDrag();
  }
  function bindDrag(){
    $$('[data-zone]',$('#modal')).forEach(zone=>{zone.ondragover=e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';zone.classList.add('dragover');};zone.ondragleave=()=>zone.classList.remove('dragover');zone.ondrop=e=>{e.preventDefault();commitDrop(zone,e.target.closest('[data-drag-key]'),e.clientY);};});
    $$('[data-drag-key]',$('#modal')).forEach(el=>{el.ondragstart=e=>{drag={key:el.dataset.dragKey,origin:el.dataset.origin};e.dataTransfer.setData('text/plain',drag.key);e.dataTransfer.effectAllowed='all';};el.ondragend=()=>$$('.dragover').forEach(el=>el.classList.remove('dragover'));});
    $$('[data-zone]',$('#modal')).forEach(zone=>{
      zone.ondragover=e=>{e.preventDefault();e.dataTransfer.dropEffect=drag?.origin==='pool'?'copy':'move';zone.classList.add('dragover');};
      zone.ondragleave=e=>{if(!zone.contains(e.relatedTarget))zone.classList.remove('dragover');};
      zone.ondrop=e=>{
        e.preventDefault();if(!drag||!defs()[drag.key])return;
        const id=zone.dataset.zone,hit=e.target.closest('[data-drag-key]'),before=hit?.dataset.dragKey;
        if(before===drag.key&&drag.origin===id)return;
        let list=zoneKeys(id).filter(k=>k!==drag.key),at=before?list.indexOf(before):-1;
        if(at>=0){const rect=hit.getBoundingClientRect();if(e.clientY>rect.top+rect.height/2)at++;list.splice(at,0,drag.key);}else list.push(drag.key);
        if(drag.origin!=='pool'&&drag.origin!==id)assign(drag.origin,zoneKeys(drag.origin).filter(k=>k!==drag.key));
        assign(id,list);drag=null;draw();
      };
    });
  }
  function customForm(){
    let generated=null;
    const overlay=document.createElement('dialog');overlay.className='custom-metric-dialog';overlay.setAttribute('aria-label','AI Custom Metric');
    overlay.innerHTML=`<div class="modal-head"><h3>✧ AI Custom Metric</h3><button class="icon-btn" data-custom-close aria-label="Close custom metric">×</button></div><div class="modal-body"><p class="modal-sub">Fill in the metric definition and generate a preview; once generated, drag it into Core / a section to use it.</p><div class="notice">Standalone demo · local preview generation. No AI service is connected.</div><div class="form-group"><label class="form-label" for="custom-name">Metric Name <span class="required">*</span></label><input id="custom-name" class="full-width" maxlength="100" placeholder="e.g. Night-peak delivery timeout rate"></div><div class="form-group"><label class="form-label" for="custom-logic">Calculation Logic <span class="required">*</span></label><textarea id="custom-logic" placeholder="e.g. Between 22:00-02:00, orders whose delivery time exceeds ETA / total orders in that window"></textarea><small class="muted">For calculated demo values, use metric names and + - * / ( ).</small></div><div class="alert-heading">Alert Rule (optional) <button class="btn small" id="enable-alert">Enable</button></div><div class="alert-levels" hidden>${['Mild','Moderate','Severe'].map((n,i)=>`<label>${n}<input aria-label="${n} threshold" type="number" step="any" data-threshold="${i}"></label>`).join('')}</div><button class="btn primary full-width" id="generate-custom" disabled>✧ Generate with AI</button><div id="custom-preview"></div></div><div class="modal-footer"><button class="btn" data-custom-close>Cancel</button><button class="btn primary" id="add-custom" disabled>Add to Metric Pool</button></div>`;
    document.body.append(overlay);overlay.showModal();
    const q=s=>$(s,overlay),close=()=>{overlay.close();overlay.remove();};
    $$('[data-custom-close]',overlay).forEach(b=>b.onclick=close);overlay.oncancel=e=>{e.preventDefault();close();};
    const invalidate=()=>{generated=null;q('#custom-preview').innerHTML='';q('#add-custom').disabled=true;q('#generate-custom').disabled=!q('#custom-name').value.trim()||!q('#custom-logic').value.trim();};
    $$('input,textarea',overlay).forEach(el=>el.oninput=invalidate);
    q('#enable-alert').onclick=()=>{q('.alert-levels').hidden=!q('.alert-levels').hidden;q('#enable-alert').textContent=q('.alert-levels').hidden?'Enable':'Enabled';invalidate();};
    q('#generate-custom').onclick=()=>{
      const name=q('#custom-name').value.trim(),logic=q('#custom-logic').value.trim();let result,formula;
      try{result=evaluateMetricFormula(logic);formula=logic;}catch{/* Natural-language definitions use a clearly marked simulated preview. */}
      const unit=/rate|ratio|percent|率|%|100/i.test(name+' '+logic)?'%':/time|minute|时长|时间/i.test(name)?'min':'';
      const thresholds=q('.alert-levels').hidden?[]:$$('[data-threshold]',overlay).map(el=>el.value===''?null:Number(el.value));
      if(thresholds.filter(v=>v!==null).some((v,i,a)=>i&&v<=a[i-1])){q('#custom-preview').innerHTML='<p class="error">Thresholds must increase from Mild to Severe.</p>';return;}
      generated={key:'custom-'+Date.now(),name,logic,formula,unit,compare:true,custom:true,thresholds};
      q('#custom-preview').innerHTML=`<h4>Preview</h4><div class="notice"><strong>${esc(name)}</strong> · Numeric · ${esc(unit||'count')}<p>Calculation logic: ${esc(logic)}</p><p>${formula?'Calculated demo value: '+result.toFixed(1):'Simulated preview value: 12.5 · natural-language logic is stored as a definition.'}</p><p>${thresholds.some(v=>v!==null)?thresholds.map((v,i)=>v===null?'':['Mild','Moderate','Severe'][i]+' ≥ '+v).filter(Boolean).join(' · '):'No alert rule configured'}</p></div>`;
      q('#add-custom').disabled=false;
    };
    q('#add-custom').onclick=()=>{if(!generated)return;custom.push(generated);close();query='';category='All';draw();toast('Custom metric added to the draft pool. Drag it into a section.');};
  }
  draw();
}

updateAreas();render();
