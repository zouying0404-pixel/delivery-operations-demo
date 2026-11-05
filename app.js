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
  city:'São Paulo',area:'all',areas:[],view:'card',metricsTab:'core',strategyTab:'area',tick:0,
  selected:new Set(),search:'',metrics:Array.isArray(saved.metrics) ? saved.metrics.filter(k=>metricDefs[k]) : [...defaults],
  sections:Array.isArray(saved.sections)?saved.sections.map(s=>({...s,metrics:s.metrics.filter(k=>metricDefs[k])})):[{id:'monitor',name:'Monitoring Section',metrics:['pushed','completedTasks','acceptRate','efficiency','pushedTrend','onlineTrend']}],
  customMetrics:saved.customMetrics||[],targets:saved.targets || {},history:Array.isArray(saved.history) ? saved.history.slice(0,100) : [],
  actions:saved.actions || {},rules:saved.rules || {merchantReports:2,courierReports:2,prep:25,unprepared:15,assigned:12,redCount:3}
};
if(!Array.isArray(saved.sections)&&Array.isArray(saved.metrics)){state.metrics=[...new Set([...state.metrics.filter(k=>!['target','ata','realtime','margin'].includes(k)),'ataTrend','ontimeTrend'])];}
function persist() {
  try { localStorage.setItem('delivery-demo-v1', JSON.stringify({metrics:state.metrics,sections:state.sections,customMetrics:state.customMetrics,targets:state.targets,history:state.history.slice(0,100),actions:state.actions,rules:state.rules,zones:state.zones,alertRules:state.alertRules})); }
  catch { toast('Changes apply to this session. Browser storage is unavailable.'); }
}
function seed(value) { let h=0; for (const c of String(value)) h=(h*31+c.charCodeAt(0))>>>0; return h; }
function random(key) { const x=Math.sin(seed(key)*.01+state.tick*.73)*43758.5453; return x-Math.floor(x); }
function targetKey(){return `${state.city}|${state.area}`;}
function target(){return Number(zoneConfig().target);}
function valuesForArea(area=state.area) {
  const r=random(state.city+area);
  const ata=+(34+r*8).toFixed(1);
  return {target:zoneConfig(area).target,ata,realtime:+(ata+.8-r*1.3).toFixed(1),margin:+(zoneConfig(area).target-ata).toFixed(1),eta:+(ata-2.1).toFixed(1),tail:+(3.1+r*3).toFixed(1),supply:+(.9+r*.5).toFixed(1),ontime:+(94-r*10).toFixed(1),orders:Math.round(1680+r*2100),cancel:+(1.3+r*1.2).toFixed(1),prep:+(17+r*5).toFixed(1),pickup:+(3+r*4).toFixed(1)};
}
function values(){return valuesForArea();}
function merchants() {
  return cityAreas[state.city].flatMap((area,ai)=>Array.from({length:6},(_,i)=>{
    const r=random(`${state.city}/${area}/${i}`), rank=(i+ai)%6;
    const m={id:`D${Object.keys(cityAreas).indexOf(state.city)+1}-${String(ai+1).padStart(2,'0')}${String(i+1).padStart(2,'0')}`,name:`${['Olive Kitchen','Ember Pizza','Green Bowl','Sakura House','Daily Bakery','Casa Grill'][i]} ${ai+1}`,area,
      merchantReports:rank<2?2+Math.floor(r*3):Math.floor(r*2),courierReports:rank<2?2+Math.floor(r*3):Math.floor(r*2),prep:+(rank<2?27+r*8:14+r*10).toFixed(1),unprepared:Math.round(rank<2?18+r*10:3+r*10),assigned:Math.round(rank<2?13+r*7:3+r*8),orders:Math.round(40+r*120),crate:+(82+r*14).toFixed(1)};
    if(rank===2){m.courierReports=2;m.unprepared=16;}
    m.wait=+(3+r*15).toFixed(1);
    const levels=['merchantReports','courierReports','prep','unprepared','assigned','wait'].map(k=>severity(k,m[k]));
    m.level=levels.filter(l=>l==='severe').length>=2?'HIGH':levels.filter(l=>l==='severe'||l==='moderate').length>=2?'MED':'LOW';
    m.action=(state.actions[m.id]&&['Pending','Ongoing'].includes(actionStatus(state.actions[m.id]))?state.actions[m.id]:null) || (m.level==='HIGH'?{action:['Shrink delivery radius','Adjust ETA','Pause merchant'][i%3],value:['20%','5 min',''][i%3],source:'System'}:null);
    return m;
  })).filter(m=>areaMatches(m.area)).sort((a,b)=>({HIGH:0,MED:1,LOW:2}[a.level]-{HIGH:0,MED:1,LOW:2}[b.level])||b.prep-a.prep);
}
function filteredMerchants(){const q=state.search.toLowerCase();return merchants().filter(m=>!q||`${m.name} ${m.id} ${m.area}`.toLowerCase().includes(q));}
let toastTimer;
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3500);}
function modal(title,body,footer='') {
  $('#modal').classList.remove('metrics-modal','wide-modal');
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
  if(state.view==='card'&&state.areas.length<2) $('#metrics-content').innerHTML=`<div class="metrics-grid">${numeric.map(k=>metricCard(k,metricValue(k,v))).join('')}</div>${chartsHTML}${!numeric.length&&!charts.length?'<div class="empty">No metrics in this section. Open Edit metrics to add some.</div>':''}`;
  else {const rows=state.areas.length?state.areas:['all'];$('#metrics-content').innerHTML=`<div class="metrics-table-wrap table-scroll"><table class="data-table"><thead><tr><th>Delivery Area</th>${numeric.map(k=>`<th>${esc(metricDefs[k].name)}${k==='ata'?'<button class="hourly" id="ata-hourly">ATA Hourly</button>':''}</th>`).join('')}${fixed.length?'<th>ATA Trend</th>':''}</tr></thead><tbody>${rows.map(area=>{const rv=valuesForArea(area);return `<tr><td class="name">${esc(area==='all'?'All Areas (Avg)':area)}${area==='all'?'':`<div class="area-badges"><button class="tooltip-link" data-area-strategies="${esc(area)}" title="Active area strategies">⚑</button><button class="tooltip-link" data-area-surge="${esc(area)}" aria-label="Surging merchants in ${esc(area)}">${merchants().filter(m=>m.area===area&&m.action).length} surging</button><span title="Current weather: Sunny">☀</span></div>`}</td>${numeric.map(k=>`<td>${metricValue(k,rv)} ${esc(metricDefs[k].unit)}</td>`).join('')}${fixed.length?`<td><svg width="95" height="28" viewBox="0 0 95 28" aria-label="ATA trend"><polyline fill="none" stroke="#8e79d1" points="${Array.from({length:12},(_,i)=>i*8+','+(6+random(area+i)*17)).join(' ')}"/></svg></td>`:''}</tr>`;}).join('')}</tbody></table></div>${state.areas.length<2?chartsHTML:''}`;}

}
function renderMerchants(){
  const all=merchants(),rows=filteredMerchants();
  $('#merchant-count').textContent=`${all.length} merchants`;
  $('#merchant-summary').innerHTML=`<span><b>${all.length}</b> Total merchants</span>${['HIGH','MED','LOW'].map(l=>`<span><i class="summary-dot" style="background:${{HIGH:'var(--red)',MED:'var(--orange)',LOW:'var(--green)'}[l]}"></i><b>${all.filter(m=>m.level===l).length}</b> ${l==='MED'?'Medium':l[0]+l.slice(1).toLowerCase()} surge</span>`).join('')}<span><b>${all.filter(m=>m.action).length}</b> Active interventions</span>`;
  const cols=[['merchantReports','Merchant reports<br>(1h)'],['courierReports','Courier reports<br>(1h)'],['prep','Avg prep time<br>(min)'],['unprepared','Unprepared<br>&gt;15 min'],['assigned','Assigned, not<br>picked up'],['orders','New orders<br>(1h)'],['crate','C-side on-time<br>rate']];
  $('#merchant-table').innerHTML=`<thead><tr><th><input type="checkbox" id="select-all" aria-label="Select all visible merchants" ${rows.length&&rows.every(m=>state.selected.has(m.id))?'checked':''}></th><th>Merchant name</th><th>Merchant ID</th><th>Delivery area</th>${cols.map(([,label])=>`<th>${label}</th>`).join('')}<th>Surge level</th><th title="Orange: system strategy. Blue: manual strategy.">Action ⓘ</th></tr></thead><tbody>${rows.map(m=>`<tr><td><input class="select-merchant" type="checkbox" data-id="${m.id}" aria-label="Select ${esc(m.name)}" ${state.selected.has(m.id)?'checked':''}></td><td class="name">${esc(m.name)}</td><td class="id">${m.id}</td><td>${esc(m.area)}</td>${cols.map(([k])=>`<td class="${severity(k,m[k])}">${m[k]}${k==='crate'?'%':''}</td>`).join('')}<td><span class="level ${m.level.toLowerCase()}">${m.level}</span></td><td>${m.action?`<button class="action-tag ${m.action.source==='Manual'?'manual':''}" data-action-id="${m.id}" title="${m.action.source} strategy details">${esc(m.action.action)} ${esc(m.action.value)}</button>`:'—'}</td></tr>`).join('')||'<tr><td colspan="13" class="empty">No merchants match your search.</td></tr>'}</tbody>`;
  updateSelection();
  $('#history-count').textContent=state.history.length?`(${state.history.length})`:'';
  $('#edit-rules').textContent=state.area==='all'?'⚙ Edit rules':'⚙ View rules';
}
function updateSelection(){const n=state.selected.size;$('#selection-count').textContent=n?`${n} merchant${n>1?'s':''} selected`:'No merchants selected';$('#intervene').disabled=!n;}
function strategies(){return cityAreas[state.city].filter(a=>areaMatches(a)).map((area,i)=>({area,id:`AREA-${i+1}`,source:i%2?'System':'Manual',action:`Delivery range ${10+i*5}%`,period:`12:00 – ${14+i}:30`,status:i%3===0?'Ongoing':i%3===1?'Pending':'Expired',orders:310+i*139,merchants:12+i*3}));}
function renderStrategies(){
  const s=strategies(),recent=s.filter(r=>r.status!=='Pending'),active=s.filter(r=>r.status==='Ongoing');
  const sum=(rows,key)=>rows.reduce((n,r)=>n+r[key],0);
  const activeMerchants=sum(active,'merchants');
  const shrink=activeMerchants?Math.round(active.reduce((n,r)=>n+parseInt(r.action.replace('Delivery range ',''),10)*r.merchants,0)/activeMerchants):0;
  $('#strategy-cards').innerHTML=[['SURGE ORDERS (1H)',sum(recent,'orders').toLocaleString(),'Rolling 1h window'],['MERCHANT AFFECTED (1H)',sum(recent,'merchants'),'Unique merchants · 1h'],['SURGE ORDERS',sum(active,'orders').toLocaleString(),'Current interventions'],['MERCHANT AFFECTED',activeMerchants,'Currently affected merchants'],['AVG SHRINK RATIO',`${shrink}%`,'Weighted by affected merchants']].map(([label,number,sub])=>`<div class="strategy-card"><div class="label">${label}</div><div class="number">${number}</div><div class="sub">${sub}</div></div>`).join('');
  $('#strategy-chart').innerHTML=chart('Affected merchant count · historical & forecast','surge');
  const groups=merchantActionGroups();
  $('#strategy-table').innerHTML=state.strategyTab==='area'?`<thead><tr><th>Delivery area</th><th>Area ID</th><th>Surge source</th><th>Action</th><th>Effective period</th><th>Status</th><th>Surge orders</th></tr></thead><tbody>${s.map(r=>`<tr><td class="name">${esc(r.area)}</td><td>${r.id}</td><td>${r.source}</td><td>${r.action}</td><td>${r.period}</td><td><span class="status ${r.status.toLowerCase()}">${r.status}</span></td><td>${r.orders}</td></tr>`).join('')}</tbody>`:`<thead><tr><th>Surge source</th><th>Action</th><th>Status</th><th>Merchant numbers</th><th>Surge orders</th></tr></thead><tbody>${groups.map((g,i)=>`<tr><td>${esc(g.source)}</td><td>${esc(g.action)} ${esc(g.value)}</td><td><span class="status ${g.status.toLowerCase()}">${g.status}</span></td><td><button class="tooltip-link" data-affected="${i}">${g.merchants.length}</button></td><td>${g.merchants.reduce((n,m)=>n+m.orders,0)}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">No merchant strategies in this scope.</td></tr>'}</tbody>`;

}
function render(){renderMetrics();renderMerchants();renderStrategies();}
function areaMatches(area){return !state.areas.length||state.areas.includes(area);}
function areaLabel(){return !state.areas.length?'All Areas':state.areas.length===1?state.areas[0]:state.areas.length+' areas selected';}
function updateAreas(){
  let el=$('#area');if(el.tagName==='SELECT'){const wrapper=document.createElement('div');wrapper.className='area-select';el.replaceWith(wrapper);wrapper.innerHTML='<button type="button" class="btn" id="area" aria-label="Delivery Area" aria-expanded="false"></button><div class="area-menu" hidden></div>';el=$('#area');}
  el.textContent=areaLabel()+' ▾';el.onclick=()=>{const menu=$('.area-menu');menu.hidden=!menu.hidden;el.setAttribute('aria-expanded',String(!menu.hidden));};
  const menu=$('.area-menu');menu.innerHTML=`<button type="button" id="all-areas">Select All · ${cityAreas[state.city].length}</button>${cityAreas[state.city].map(a=>`<label><input type="checkbox" data-area-choice="${esc(a)}" ${state.areas.includes(a)?'checked':''}>${esc(a)}</label>`).join('')}<button type="button" id="clear-areas">Clear all</button>`;
  const change=()=>{state.area=state.areas.length===0?'all':state.areas.length===1?state.areas[0]:'multiple';state.selected.clear();el.textContent=areaLabel()+' ▾';render();};
  $$('[data-area-choice]').forEach(c=>c.onchange=()=>{state.areas=c.checked?[...state.areas,c.dataset.areaChoice]:state.areas.filter(a=>a!==c.dataset.areaChoice);change();});
  $('#all-areas').onclick=()=>{state.areas=[];$$('[data-area-choice]').forEach(c=>c.checked=false);change();};$('#clear-areas').onclick=$('#all-areas').onclick;
}
document.addEventListener('click',e=>{if(!e.target.closest('.area-select')&&$('.area-menu')){$('.area-menu').hidden=true;$('#area').setAttribute('aria-expanded','false');}});
$('#city').addEventListener('change',e=>{state.city=e.target.value;state.area='all';state.areas=[];state.selected.clear();updateAreas();render();});
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
$('#target-edit').addEventListener('click',openZones);
$('#metrics-content').addEventListener('click',e=>{if(e.target.closest('#ata-hourly'))openHourly();});
$('#edit-metrics').addEventListener('click',openMetricEditor);
$('#edit-rules').addEventListener('click',openRules);
$('#intervene').addEventListener('click',()=>openIntervention());
function recordDetails(r){return `<div class="history-item"><strong>${esc(r.action)} ${esc(r.value)}</strong><small>${esc(r.source)} · ${formatTime(r.time)} · ${esc(r.city||state.city)}</small><p>Reason: ${esc(r.reason||'Simulated system threshold')}</p>${r.notes?`<p>Notes: ${esc(r.notes)}</p>`:''}<p>Effective period: ${actionPeriod(r)}</p><p>Duration: ${r.duration||30} minutes · ${actionStatus(r)}</p>${r.next?`<p>Next step: ${esc(r.next)}</p>`:''}<p>${(r.merchants||[]).map(m=>`${esc(m.name)} (${esc(m.id)})`).join(', ')}</p></div>`;}
$('#history').addEventListener('click',openHistory);
$('#merchant-table').addEventListener('click',e=>{const b=e.target.closest('[data-action-id]');if(!b)return;const m=merchants().find(m=>m.id===b.dataset.actionId);if(m?.action)showAction({time:new Date().toISOString(),city:state.city,merchants:[m],...m.action,next:m.action.next||(m.action.action==='Pause merchant'?'Reopen restaurant automatically without merchant confirmation':'')});});
function csv(name,rows){
  // Prefix spreadsheet formula characters to keep exports as text when appropriate.
  const encode=v=>'"'+String(v??'').replace(/^[=+@\-]/,"'$&").replace(/"/g,'""')+'"';
  const blob=new Blob(['\uFEFF'+rows.map(r=>r.map(encode).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('CSV exported');
}
$('#export-metrics').addEventListener('click',()=>{const keys=state.metricsTab==='core'?['target','ata','realtime','margin',...state.metrics]:state.sections.find(s=>s.id===state.metricsTab)?.metrics||[];csv('demo-metrics.csv',[['City','Area','Metric','Value','Unit','Data source'],...keys.filter(k=>!metricDefs[k].chart).map(k=>[state.city,state.area,metricDefs[k].name,metricValue(k),metricDefs[k].unit,'Simulated'])]);});
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

// Independently authored UI flows; all data and effects stay in this demo.
const scenarios=[['weekday','Weekday','Mon–Fri (no rain)'],['rainWeekday','Rainy Weekday','Mon–Fri (rain)'],['weekend','Weekend','Sat–Sun (no rain)'],['rainWeekend','Rainy Weekend','Sat–Sun (rain)']];
const ruleSchema=[['merchantReports','Merchant stuck-meal reports (1h)','merchant self-reported stuck orders',[2,5,10]],['courierReports','Courier stuck-meal reports (1h)','courier self-reported stuck orders',[2,5,10]],['prep','Avg meal prep time (1h)','mean order cook time over last hour',[18,25,35]],['unprepared','Orders unprepared >15min (1h)','accepted orders not cooked after 15 min',[5,12,20]],['assigned','Assigned not-picked-up orders',"courier assigned but hasn't collected yet",[3,8,15]],['wait','Courier wait time (recent 20min)','avg wait time at merchant in last 20min',[5,10,15]]];
state.zones=saved.zones||{};state.alertRules=saved.alertRules||{};
function cityZone(){return state.zones[state.city]||{tiers:[],defaults:{}};}
function sceneKey(){return [0,6].includes(new Date().getDay())?'weekend':'weekday';}
function zoneConfig(area=state.area,scene=sceneKey()){
  const z=cityZone(),tier=z.tiers.find(t=>t.areas.includes(area));
  return (tier?.targets?.[scene])||z.defaults[scene]||{target:Number(state.targets[`${state.city}|${area}`]||state.targets[`${state.city}|all`]||30),warn:0,alert:1};
}
function ruleLevels(key){return state.alertRules[state.city]?.[key]||ruleSchema.find(r=>r[0]===key)?.[3];}
function severity(key,value){const t=ruleLevels(key);return !t?'':value>=t[2]?'severe':value>=t[1]?'moderate':value>=t[0]?'mild':'';}
function actionStatus(r){if(r.stopped)return 'Cancelled';const now=Date.now(),start=Date.parse(r.start||r.time);if(now<start)return 'Pending';return now>start+(r.duration||30)*60000?'Expired':'Ongoing';}
function formatTime(s){return new Date(s).toLocaleString('en-GB',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});}
function actionPeriod(r){const start=r.start||r.time;return `${formatTime(start)} ~ ${formatTime(new Date(Date.parse(start)+(r.duration||30)*60000))}`;}
function openZones(){
  const draft=JSON.parse(JSON.stringify(cityZone()));let current=draft.tiers[0]?.id,query='';
  const original=JSON.stringify(draft);
  function draw(){const tier=draft.tiers.find(t=>t.id===current),assigned=draft.tiers.flatMap(t=>t.areas);
    modal(`Edit — ${state.city}`,`<div class="zone-top"><h4>Delivery Area Grouping</h4><button class="btn" id="city-target">ATA Target · City Default</button></div><p class="modal-sub">Group delivery areas into Tiers; set the ATA Target next to each group's name.</p><div class="zone-layout"><aside class="tier-list"><div class="zone-top"><strong>Tiers</strong><button class="btn" id="add-tier" aria-label="Quick add a new tier">＋</button></div>${draft.tiers.map(t=>`<div class="tier-row ${t.id===current?'selected':''}"><button data-tier="${t.id}">${esc(t.name)}<small>${t.areas.length} area(s)</small></button><button class="text-button" data-rename="${t.id}" aria-label="Rename ${esc(t.name)}">✎</button><button class="text-button" data-delete-tier="${t.id}" aria-label="Delete ${esc(t.name)}">×</button></div>`).join('')||'<p class="empty">No Tiers yet — click + to create one.</p>'}</aside><section class="tier-members">${tier?`<div class="zone-top"><strong>${esc(tier.name)}</strong><button class="btn" id="tier-target">ATA Target</button><button class="text-button" id="clear-tier" ${tier.areas.length?'':'disabled'}>Clear</button></div>${tier.areas.map(a=>`<div class="area-row">${esc(a)}<button class="text-button" data-remove-area="${esc(a)}" aria-label="Remove ${esc(a)}">×</button></div>`).join('')||'<p class="empty">No areas assigned yet — add from the right panel.</p>'}`:'<p class="empty">Create or select a Tier to edit</p>'}</section><section class="unassigned"><strong>Unassigned</strong><input id="area-search" placeholder="Search areas..." value="${esc(query)}"><div id="unassigned-list">${cityAreas[state.city].filter(a=>!assigned.includes(a)&&a.toLowerCase().includes(query.toLowerCase())).map(a=>`<div class="area-row">${esc(a)}<button class="btn" data-add-area="${esc(a)}" ${tier?'':'disabled'} aria-label="${tier?'Add '+a+' to '+esc(tier.name):'Select a Tier first'}">＋</button></div>`).join('')||'<p class="empty">No unassigned areas match.</p>'}</div></section></div>`,`${cancelButton}<button class="btn primary" id="save-zones" ${JSON.stringify(draft)===original?'disabled':''}>Save</button>`);
    $('#modal').classList.add('wide-modal');
    $('#city-target').onclick=()=>targetsForm(null);$('#add-tier').onclick=()=>{let n=1;while(draft.tiers.some(t=>t.name==='T'+n))n++;const t={id:'tier-'+Date.now(),name:'T'+n,areas:[],targets:null};draft.tiers.push(t);current=t.id;draw();};
    $$('[data-tier]').forEach(b=>b.onclick=()=>{current=b.dataset.tier;draw();});
    $$('[data-rename]').forEach(b=>b.onclick=()=>{const t=draft.tiers.find(t=>t.id===b.dataset.rename);nestedDialog('Rename tier',`<label class="form-label" for="tier-name">Tier name</label><input id="tier-name" value="${esc(t.name)}" maxlength="40"><p class="error" id="rename-error"></p>`,()=>{const n=$('#tier-name').value.trim();if(!n||draft.tiers.some(x=>x!==t&&x.name.toLowerCase()===n.toLowerCase())){$('#rename-error').textContent='Enter a unique tier name.';return false;}t.name=n;return true;},draw);});
    $$('[data-delete-tier]').forEach(b=>b.onclick=()=>{draft.tiers=draft.tiers.filter(t=>t.id!==b.dataset.deleteTier);current=draft.tiers[0]?.id;draw();});
    $$('[data-add-area]').forEach(b=>b.onclick=()=>{tier.areas.push(b.dataset.addArea);draw();});
    $$('[data-remove-area]').forEach(b=>b.onclick=()=>{tier.areas=tier.areas.filter(a=>a!==b.dataset.removeArea);draw();});
    if(tier){$('#clear-tier').onclick=()=>{tier.areas=[];draw();};$('#tier-target').onclick=()=>targetsForm(tier);}
    $('#area-search').oninput=e=>{query=e.target.value;$$('#unassigned-list .area-row').forEach(row=>row.hidden=!row.textContent.toLowerCase().includes(query.toLowerCase()));};
    $('#save-zones').onclick=()=>{state.zones[state.city]=draft;persist();render();closeModal();toast('Delivery area grouping and targets saved');};
  }
  function targetsForm(tier){let inherit=tier&&!tier.targets;const data=JSON.parse(JSON.stringify(tier?.targets||draft.defaults));
    scenarios.forEach(([key])=>data[key]??={target:'',warn:0,alert:1});
    nestedDialog(`Set ATA Target · ${state.city} · ${tier?tier.name:'City Default'}`,`<p class="modal-sub">${tier?'Set an independent target for this Tier, or follow the city default.':'Any Tier without its own override follows the city default.'}</p>${tier?`<label class="choice"><input id="inherit-target" type="checkbox" ${inherit?'checked':''}>Follow city default ATA Target</label>`:''}<div class="scenario-grid">${scenarios.map(([k,n,d])=>`<section><h4>${n}<small>${d}</small></h4>${[['target','Target'],['warn','Warn ≥ over by'],['alert','Alert ≥ over by']].map(([field,label])=>`<label>${label} (min)<input aria-label="${n} ${label}" data-scene="${k}" data-field="${field}" type="number" min="${field==='target'?'.1':0}" step=".1" value="${esc(data[k][field])}" ${inherit?'disabled':''}></label>`).join('')}</section>`).join('')}</div><p class="error" id="scenario-error"></p>`,()=>{
      inherit=tier&&$('#inherit-target').checked;if(!inherit){const inputs=$$('[data-scene]');if(inputs.some(el=>el.value===''||!el.checkValidity())){$('#scenario-error').textContent='Target must be greater than 0; all fields are required.';return false;}inputs.forEach(el=>data[el.dataset.scene][el.dataset.field]=Number(el.value));if(Object.values(data).some(v=>v.alert<v.warn)){$('#scenario-error').textContent='Alert threshold must be ≥ Warn threshold.';return false;}}
      if(tier)tier.targets=inherit?null:data;else draft.defaults=data;return true;
    },draw);
    if(tier)$('#inherit-target').onchange=e=>$$('[data-scene]').forEach(el=>el.disabled=e.target.checked);
  }
  draw();
}
function nestedDialog(title,body,onSave,onClose){
  const d=document.createElement('dialog');d.className='nested-dialog';d.innerHTML=`<div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-nested-close aria-label="Close settings">×</button></div><div class="modal-body">${body}</div><div class="modal-footer"><button class="btn" data-nested-close>Cancel</button><button class="btn primary" id="nested-save">Save</button></div>`;document.body.append(d);d.showModal();
  const close=()=>{d.close();d.remove();onClose?.();};d.querySelectorAll('[data-nested-close]').forEach(b=>b.onclick=close);d.oncancel=e=>{e.preventDefault();close();};$('#nested-save',d).onclick=()=>{if(onSave()!==false)close();};
}
function openHourly(){let scene=sceneKey();function draw(){const z=cityZone(),assigned=z.tiers.flatMap(t=>t.areas),groups=[...z.tiers,{name:'Unassigned',areas:cityAreas[state.city].filter(a=>!assigned.includes(a))}];
  modal('ATA Hourly — by Tier / Area',`<div class="zone-top"><p class="modal-sub">Warn/Alert thresholds are per-zone — edit via Zone Management.</p><label>Scenario <select id="hour-scene">${scenarios.map(([k,n])=>`<option value="${k}" ${scene===k?'selected':''}>${n}</option>`).join('')}</select></label></div><div class="heat-legend"><span class="on-target">On target (≤ Target+Warn)</span><span class="warning">Warn~Alert vs Target</span><span class="alert">&gt;Alert vs Target</span></div><div class="heat-scroll"><table class="data-table heatmap"><thead><tr><th>Tier / Area</th>${Array.from({length:24},(_,h)=>`<th>${String(h).padStart(2,'0')}h</th>`).join('')}</tr></thead><tbody>${groups.filter(g=>g.areas.length).map(g=>{const cfg=zoneConfig(g.areas[0],scene);return `<tr class="heat-group"><td colspan="25">${esc(g.name)} · ${g.areas.length} area(s) · ATA Target ${cfg.target} min · Warn &gt;${cfg.warn} / Alert &gt;${cfg.alert} min</td></tr>${g.areas.filter(a=>areaMatches(a)).map(a=>{const c=zoneConfig(a,scene);return `<tr><th>${esc(a)}</th>${Array.from({length:24},(_,h)=>{const v=+(25+random(a+h)*13+Math.max(0,Math.sin((h-7)*.5))*8).toFixed(1);return `<td class="${v<=c.target+c.warn?'on-target':v<=c.target+c.alert?'warning':'alert'}" title="${esc(a)} · ${h}:00 · Target ${c.target} min">${v}</td>`;}).join('')}</tr>`;}).join('')}`;}).join('')}</tbody></table></div><p class="muted">Simulated hourly values · scenario selector previews all four saved target configurations.</p>`,'<button class="btn primary" data-close>Close</button>');$('#modal').classList.add('wide-modal');$('#hour-scene').onchange=e=>{scene=e.target.value;draw();};}draw();}
function openRules(){const readonly=state.area!=='all';const draft=Object.fromEntries(ruleSchema.map(([k])=>[k,[...ruleLevels(k)]]));
  modal(`${readonly?'View':'Edit'} Rules — Alert Thresholds`,`<p class="modal-sub">Customize Mild / Moderate / Severe thresholds for each metric. Recommended values apply by default.${readonly?' Select All Areas to edit city-wide rules.':''}</p><div class="table-scroll"><table class="data-table rules-table"><thead><tr><th>Metric</th><th>Mild</th><th>Moderate</th><th>Severe</th><th></th></tr></thead><tbody>${ruleSchema.map(([k,n,d])=>`<tr><td><strong>${n}</strong><small>${d}</small></td>${draft[k].map((v,i)=>`<td><input aria-label="${n} ${['Mild','Moderate','Severe'][i]}" data-rule-key="${k}" data-level="${i}" type="number" min="0" step="${k==='prep'||k==='wait'?'.1':1}" value="${v}" ${readonly?'disabled':''}></td>`).join('')}<td><button class="text-button" data-restore="${k}" aria-label="Restore ${n} system recommended value" ${readonly?'disabled':''}>↻ Restore</button></td></tr>`).join('')}</tbody></table></div><p class="modal-sub">Scope: ${esc(state.city)} (${readonly?esc(state.area)+' — view only':'All delivery areas — city-wide'})</p><p class="error" id="rule-error"></p>`,`${cancelButton}${readonly?'':'<button class="btn primary" id="save-rules">Finish Editing</button>'}`);$('#modal').classList.add('wide-modal');
  $$('[data-restore]').forEach(b=>b.onclick=()=>{const k=b.dataset.restore;$$(`[data-rule-key="${k}"]`).forEach((el,i)=>el.value=ruleSchema.find(r=>r[0]===k)[3][i]);});
  if(!readonly)$('#save-rules').onclick=()=>{const inputs=$$('[data-rule-key]');if(inputs.some(el=>el.value===''||!el.checkValidity())){$('#rule-error').textContent='Use valid nonnegative thresholds.';return;}inputs.forEach(el=>draft[el.dataset.ruleKey][+el.dataset.level]=+el.value);if(Object.values(draft).some(v=>v[0]>v[1]||v[1]>v[2])){$('#rule-error').textContent='Thresholds must follow Mild ≤ Moderate ≤ Severe.';return;}state.alertRules[state.city]=draft;persist();renderMerchants();closeModal();toast('Alert thresholds saved for this city');};
}
function openIntervention(existing=null){
  const selected=existing?merchants().filter(m=>existing.ids.includes(m.id)):merchants().filter(m=>state.selected.has(m.id));if(!selected.length)return;
  let draft={action:'Shrink delivery radius',amount:'50',reason:'',notes:'',timing:'now',start:'',duration:'20',end:'',next:'Reopen restaurant after merchant confirmation',...existing};
  if(existing){draft.amount=parseInt(existing.value)||5;draft.timing=actionStatus(existing)==='Pending'?'scheduled':'now';draft.start=localDate(existing.start||existing.time);draft.duration=String(existing.duration);}
  function draw(){const a=draft.action,pause=a==='Pause merchant',eta=a==='Adjust ETA';const amounts=eta?[5,10,15,'custom']:[80,60,50,30,10];
    modal(existing?'Edit Intervention Settings':'Intervention Settings',`<p class="modal-sub">${selected.length} merchant(s) selected · Demo actions are stored in this browser.</p><div class="choices action-choices">${['Shrink delivery radius','Adjust ETA','Pause merchant'].map(n=>`<label class="choice"><input name="intervention-action" type="radio" value="${n}" ${a===n?'checked':''}>${n}</label>`).join('')}</div>${pause?'':`<div class="form-group"><label class="form-label">${eta?'Increase ETA':'Merchant delivery area shrink ratio'}</label><div class="choices">${amounts.map(v=>`<label class="choice"><input name="amount-option" type="radio" value="${v}" ${String(draft.amount)===String(v)?'checked':''}>${v==='custom'?'Custom':v+(eta?'min':'% Area')}</label>`).join('')}</div>${eta?`<input id="custom-amount" type="number" min="1" step="1" placeholder="Positive integers only" aria-label="Custom ETA minutes" value="${draft.customAmount||''}" ${draft.amount==='custom'?'':'hidden'}>`:''}</div>`}
    <div class="form-group"><label class="form-label">Reason *</label><div class="choices">${['System malfunction','Severe weather','Traffic control','Courier capacity is insufficient in this area','Customization'].map(n=>`<label class="choice"><input name="intervention-reason" type="radio" value="${n}" ${draft.reason===n?'checked':''}>${n}</label>`).join('')}</div><textarea id="custom-reason" placeholder="The maximum number of characters allowed is 200" maxlength="200" ${draft.reason==='Customization'?'':'hidden'}>${esc(draft.customReason||'')}</textarea><div class="counter" id="reason-counter">${(draft.customReason||'').length}/200</div></div>
    <div class="form-group"><label for="operation-notes" class="form-label">Notes on operation (Optional)</label><textarea id="operation-notes" maxlength="100" placeholder="Record background information, maximum 100 characters.">${esc(draft.notes)}</textarea><div class="counter" id="notes-counter">${draft.notes.length}/100</div></div>
    <div class="form-group"><label class="form-label">Effective time</label><div class="choices">${[['now','Now'],['scheduled','Set effective time']].map(([v,n])=>`<label class="choice"><input name="timing" type="radio" value="${v}" ${draft.timing===v?'checked':''}>${n}</label>`).join('')}</div><label id="start-wrap" ${draft.timing==='scheduled'?'':'hidden'}>Start time<input id="start-time" type="datetime-local" value="${draft.start}"></label></div>
    <div class="form-group"><label class="form-label">Effective duration</label><div class="choices">${[20,30,60,90,120,'custom'].map(v=>`<label class="choice"><input name="duration-option" type="radio" value="${v}" ${String(draft.duration)===String(v)?'checked':''}>${v==='custom'?'Custom':v+'min'}</label>`).join('')}</div><label id="end-wrap" ${draft.duration==='custom'?'':'hidden'}>End time<input id="end-time" type="datetime-local" value="${draft.end}"></label></div>
    ${pause?`<div class="form-group"><label class="form-label">Next step</label><div class="choices">${['Reopen restaurant after merchant confirmation','Reopen restaurant automatically without merchant confirmation'].map(n=>`<label class="choice"><input name="next-step" type="radio" value="${n}" ${draft.next===n?'checked':''}>${n}</label>`).join('')}</div></div>`:''}<label class="form-label">Selected merchants (${selected.length})</label><div class="selected-list">${selected.map(m=>`${esc(m.name)} · ${m.id}`).join('<br>')}</div><p class="error" id="intervention-error"></p>`,`${cancelButton}<button class="btn primary" id="review-intervention">Review action</button>`);
    $$('[name="intervention-action"]').forEach(el=>el.onchange=()=>{capture();draft.action=el.value;draft.amount=el.value==='Adjust ETA'?'5':'50';draw();});
    $$('[name="amount-option"]').forEach(el=>el.onchange=()=>{draft.amount=el.value;if($('#custom-amount'))$('#custom-amount').hidden=el.value!=='custom';});
    $$('[name="intervention-reason"]').forEach(el=>el.onchange=()=>{draft.reason=el.value;$('#custom-reason').hidden=el.value!=='Customization';});
    $$('[name="timing"]').forEach(el=>el.onchange=()=>{draft.timing=el.value;$('#start-wrap').hidden=el.value!=='scheduled';});
    $$('[name="duration-option"]').forEach(el=>el.onchange=()=>{draft.duration=el.value;$('#end-wrap').hidden=el.value!=='custom';});
    $('#custom-reason').oninput=e=>$('#reason-counter').textContent=e.target.value.length+'/200';$('#operation-notes').oninput=e=>$('#notes-counter').textContent=e.target.value.length+'/100';
    $('#review-intervention').onclick=()=>{capture();const reason=draft.reason==='Customization'?draft.customReason.trim():draft.reason;const start=draft.timing==='scheduled'?new Date(draft.start):new Date();const duration=draft.duration==='custom'?(new Date(draft.end)-start)/60000:+draft.duration;const amount=draft.amount==='custom'?+draft.customAmount:+draft.amount;
      let error=!reason?'Select a reason and complete the custom reason if applicable.':!pause&&(!Number.isInteger(amount)||amount<=0)?'Enter a positive whole number for the intervention amount.':!Number.isFinite(start.getTime())||draft.timing==='scheduled'&&start.getTime()<Date.now()?'Start time must be in the future.':!Number.isFinite(duration)||duration<=0?'End time must be later than the start time.':'';
      if(error){$('#intervention-error').textContent=error;return;}
      const record={id:existing?.id||'manual-'+Date.now(),action:a,value:pause?'':amount+(eta?' min':'% Area'),reason,reasonChoice:draft.reason,customReason:draft.customReason,notes:draft.notes.trim(),start:start.toISOString(),duration,next:pause?draft.next:'',source:'Manual',time:existing?.time||new Date().toISOString(),city:state.city,merchants:selected.map(m=>({id:m.id,name:m.name,area:m.area})),ids:selected.map(m=>m.id)};
      modal('Confirm simulated intervention',`<div class="notice">This action affects only this demo.</div>${recordDetails(record)}`,`<button class="btn" id="back-intervention">Back</button><button class="btn primary" id="confirm-intervention">Confirm demo action</button>`);$('#back-intervention').onclick=draw;$('#confirm-intervention').onclick=()=>{record.ids.forEach(id=>state.actions[id]=record);if(existing){state.history=state.history.map(r=>r.id===existing.id?record:r);}else state.history.unshift(record);state.selected.clear();persist();render();closeModal();toast('Demo intervention saved');};
    };
  }
  function capture(){draft.notes=$('#operation-notes').value;draft.customReason=$('#custom-reason').value;draft.customAmount=$('#custom-amount')?.value;draft.start=$('#start-time').value;draft.end=$('#end-time').value;draft.next=$('[name="next-step"]:checked')?.value||draft.next;}
  draw();
}
function localDate(s){const d=new Date(s);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);}
function openHistory(){const rows=state.history.filter(r=>r.city===state.city);modal('History Log',`<p class="modal-sub">${esc(state.city)} · Manual intervention history saved in this browser</p>${rows.length?`<div class="table-scroll"><table class="data-table"><thead><tr><th>Operation time</th><th>Merchant(s)</th><th>Action</th><th>Reason / Notes</th><th>Effective period</th><th>Status</th><th></th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${formatTime(r.time)}</td><td>${(r.merchants||[]).map(m=>esc(m.name)).join('<br>')}</td><td>${esc(r.action)} ${esc(r.value)}</td><td>${esc(r.reason)}<small>${esc(r.notes||'')}</small></td><td>${actionPeriod(r)}</td><td>${actionStatus(r)}</td><td><button class="text-button" data-history-index="${i}">View details</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">No manual intervention history yet</div>'}`,`<button class="btn" id="download-history">Download history log</button><button class="btn primary" data-close>Close</button>`);$('#modal').classList.add('wide-modal');$$('[data-history-index]').forEach(b=>b.onclick=()=>showAction(rows[+b.dataset.historyIndex]));$('#download-history').onclick=()=>csv('demo-intervention-history.csv',[['Operation time','Action','Value','Merchant IDs','Reason','Notes','Start','Duration (min)','Next step','Status'],...rows.map(r=>[r.time,r.action,r.value,r.ids.join(' '),r.reason,r.notes,r.start||r.time,r.duration,r.next||'',actionStatus(r)])]);}
function showAction(r){const editable=r.source==='Manual'&&['Ongoing','Pending'].includes(actionStatus(r));modal('Intervention Strategy Details',`${r.source==='System'?'<div class="notice">System Auto · System intervention strategies cannot be cancelled or modified.</div>':''}${recordDetails(r)}`,`<button class="btn" id="action-history">History Log</button>${editable?'<button class="btn" id="edit-action">Edit strategy</button><button class="btn" id="stop-action">Cancel strategy</button>':''}<button class="btn primary" data-close>Close</button>`);$('#action-history').onclick=openHistory;if(editable){$('#edit-action').onclick=()=>openIntervention({...r,reason:r.reasonChoice||r.reason});$('#stop-action').onclick=()=>{modal('Cancel demo strategy',`<p>End ${esc(r.action)} for ${(r.ids||[]).length} merchant(s)?</p>`,`${cancelButton}<button class="btn primary" id="confirm-stop">Confirm cancellation</button>`);$('#confirm-stop').onclick=()=>{r.stopped=true;(r.ids||[]).forEach(id=>{if(state.actions[id]?.id===r.id)state.actions[id]={...r,stopped:true};});state.history=state.history.map(x=>x.id===r.id?{...x,stopped:true}:x);persist();render();closeModal();toast('Demo strategy cancelled');};};}}

function merchantActionGroups(){const groups=new Map();merchants().filter(m=>m.action).forEach(m=>{const a=m.action,status=actionStatus({time:new Date().toISOString(),...a}),key=[a.source,a.action,a.value,status].join('|');if(!groups.has(key))groups.set(key,{...a,status,merchants:[]});groups.get(key).merchants.push(m);});return [...groups.values()];}
function affectedTable(list){return `<div class="table-scroll"><table class="data-table"><thead><tr><th>Merchant Name</th><th>Merchant ID</th><th>Surge Source</th><th>Action</th><th>Effective Period</th><th>Status</th></tr></thead><tbody>${list.map(m=>{const r={time:new Date().toISOString(),...m.action};return `<tr><td>${esc(m.name)}</td><td>${m.id}</td><td>${esc(m.action?.source||'—')}</td><td>${esc(m.action?m.action.action+' '+m.action.value:'—')}</td><td>${m.action?actionPeriod(r):'—'}</td><td>${m.action?actionStatus(r):'—'}</td></tr>`;}).join('')}</tbody></table></div>`;}
$('#strategy-table').addEventListener('click',e=>{const b=e.target.closest('[data-affected]');if(!b)return;const g=merchantActionGroups()[+b.dataset.affected];modal('Affected Merchants',`<p class="modal-sub">${esc(g.action)} ${esc(g.value)} (by Action)</p>${affectedTable(g.merchants)}`,'<button class="btn primary" data-close>Close</button>');$('#modal').classList.add('wide-modal');});
$('#metrics-content').addEventListener('click',e=>{const b=e.target.closest('[data-area-surge],[data-area-strategies]');if(!b)return;const area=b.dataset.areaSurge||b.dataset.areaStrategies;const list=merchants().filter(m=>m.area===area&&m.action);modal(b.dataset.areaSurge?'Merchants surging in '+area:'Active strategies — '+area,affectedTable(list)||'<p>No active strategies</p>','<button class="btn primary" data-close>Close</button>');$('#modal').classList.add('wide-modal');});
// Keyboard-accessible chart point descriptions and pointer tooltip.
document.addEventListener('pointermove',e=>{const svg=e.target.closest('.chart-svg');if(!svg){$$('.chart-tip').forEach(el=>el.remove());return;}const card=svg.closest('.chart-card'),rect=svg.getBoundingClientRect(),hour=Math.max(0,Math.min(24,Math.round(((e.clientX-rect.left)/rect.width*610-40)/22.5)));let tip=$('.chart-tip',card);if(!tip){tip=document.createElement('div');tip.className='chart-tip';card.append(tip);}const lines=$$('polyline',svg);tip.textContent=String(hour).padStart(2,'0')+':00 · '+lines.map((line,i)=>{const pts=line.getAttribute('points').split(' '),xy=pts[Math.min(hour,pts.length-1)].split(',');const max=Number($$('text',svg)[4]?.textContent)||60;return ['Current','DoD','WoW'][i]+': '+Math.max(0,(155-Number(xy[1]))/125*max).toFixed(1);}).join(' · ');tip.style.left=Math.min(rect.width-260,Math.max(0,e.clientX-rect.left))+'px';tip.style.top='45px';});
let draggedPanel=null;$$('.panel').forEach(panel=>{const header=$('.panel-header',panel)||$('h2',panel)?.parentElement;if(!header)return;header.draggable=true;header.title='Drag to reorder module';header.ondragstart=e=>{if(e.target.closest('button')){e.preventDefault();return;}draggedPanel=panel;panel.classList.add('panel-dragging');};header.ondragend=()=>{panel.classList.remove('panel-dragging');draggedPanel=null;};panel.ondragover=e=>{if(draggedPanel&&draggedPanel!==panel)e.preventDefault();};panel.ondrop=e=>{if(!draggedPanel||draggedPanel===panel)return;e.preventDefault();const before=e.clientY<panel.getBoundingClientRect().top+panel.offsetHeight/2;panel.parentNode.insertBefore(draggedPanel,before?panel:panel.nextSibling);};});

updateAreas();render();
