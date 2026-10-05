'use strict';
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const displayName=p=>{const words=p.person_name.replaceAll(',',' ').trim().split(/\s+/);if(words.length<2)return p.person_name;const title=w=>w.length===1?w.toUpperCase()+'.':w[0].toUpperCase()+w.slice(1).toLowerCase();return [...words.slice(1),words[0]].map(title).join(' ');};
const money=n=>n===null||n===undefined?'UNKNOWN':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
let catalog=null, people=[], selected=null, watchOnly=false, saved=new Set(), storageOK=true;
try{const raw=JSON.parse(localStorage.getItem('project-a-watchlist-v1')||'[]');if(Array.isArray(raw))saved=new Set(raw.filter(x=>typeof x==='string'));}catch{storageOK=false;}
function rows(){
  const q=$('search').value.trim().toLowerCase(),territory=$('territory').value,type=$('eventType').value,min=Number($('minimumScore').value);
  return people.filter(p=>{
    const city=p.location||{};
    if(territory==='SC'&&city.state!=='SC')return false;
    if(!['SC','all'].includes(territory)&&(city.distance_miles===null||city.distance_miles===undefined||city.distance_miles>Number(territory)))return false;
    if(watchOnly&&!saved.has(p.id))return false;
    if(p.computed.value<min)return false;
    if(type==='Liquidity'&&!p.computed.sales)return false;
    if(!['Liquidity','all'].includes(type)&&!p.events.some(e=>e.code===type))return false;
    return !q||`${p.person_name} ${p.company} ${p.role} ${city.city} ${p.events.map(e=>e.fact+' '+e.classification).join(' ')}`.toLowerCase().includes(q);
  }).sort((a,b)=>b.computed.value-a.computed.value||b.computed.total-a.computed.total);
}
function choose(id,scroll=false){selected=people.find(p=>p.id===id)||null;render();if(scroll&&selected&&innerWidth<850)$('selected').scrollIntoView({behavior:'smooth',block:'start'});}
function render(){
  const visible=rows();
  if(!visible.some(p=>p.id===selected?.id))selected=visible[0]||null;
  $('mCount').textContent=visible.length;
  $('mValue').textContent=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2}).format(visible.reduce((n,p)=>n+p.computed.total,0));
  $('mHigh').textContent=visible.filter(p=>p.computed.value>=70).length;
  $('mFresh').textContent=visible.filter(p=>p.computed.age!==null&&p.computed.age<=30).length;
  $('visibleSummary').textContent=`${visible.length} PEOPLE · ${watchOnly?'WATCHLIST':'PUBLIC EVIDENCE'}`;
  $('allView').classList.toggle('on',!watchOnly);$('watchView').classList.toggle('on',watchOnly);
  $('leads').innerHTML=visible.map(p=>`<button class="lead ${selected?.id===p.id?'active':''}" data-person="${esc(p.id)}" aria-pressed="${selected?.id===p.id}"><div class="score">${p.computed.value}</div><div><h3>${esc(displayName(p))} ${saved.has(p.id)?'<span class="watchbadge">★</span>':''}</h3><p>${esc(p.role)} · ${esc(p.company)}<br>${p.computed.sales?`${p.computed.sales} sale rows · latest ${p.computed.latest}`:'No sale trigger · classification audit'}<br>${esc(p.location.city||'Location UNKNOWN')}, ${esc(p.location.state||'')} · ${p.location.distance_miles==null?'Radius UNKNOWN':'~'+Math.round(p.location.distance_miles)+' city miles'}</p></div><div class="money">${p.computed.sales?money(p.computed.total):'NO SALE VALUE'}<small>${p.computed.sales?'gross · calculated':'F/A/M excluded'}</small></div></button>`).join('')||'<p class="empty">No people match these controls. Try all territories, all event types or reset controls.</p>';
  const selectedType=$('eventType').value;
  const feed=visible.flatMap(p=>p.events.filter(e=>selectedType==='all'||(selectedType==='Liquidity'?e.classification==='LIQUIDITY':e.code===selectedType)).map(e=>({p,e}))).sort((a,b)=>b.e.date.localeCompare(a.e.date)).slice(0,8);
  $('signalFeed').innerHTML=feed.map(({p,e})=>`<button class="signal" data-person="${esc(p.id)}"><i class="dot"></i><div><b>${esc(displayName(p))} · ${esc(e.classification.replaceAll('_',' '))}</b><p>${esc(e.date)} · ${esc(p.company)}<br>${e.code==='S'?money(e.value)+' gross calculated':'Code '+esc(e.code)+' · no ordinary sale value'}${e.planned?' · 10b5-1':''}</p></div></button>`).join('')||'<p class="empty">No signals in this view.</p>';
  $('detail').hidden=!selected;
  if(selected)renderDetail();
}
function renderDetail(){
  const p=selected,c=p.computed,sales=p.events.filter(e=>e.classification==='LIQUIDITY');
  const why=sales.length?`${sales.length} public stock-sale rows create a potential equity-planning research opportunity. ${c.planned?'The disclosed trading-plan context lowers inferred urgency. ':''}The score prioritizes investigation; it does not establish investable assets or an unmet planning need.`:'This record is retained for monitoring and classification QA. Withholding, awards and exercise context do not establish ordinary sale liquidity.';
  $('name').textContent=`${displayName(p)} · ${p.company}`;
  $('tags').innerHTML=[sales.length?'STOCK MONETIZATION':'MONITOR ONLY','SEC FORM 4',p.events.some(e=>e.planned)?'10b5-1 CONTEXT':'RETAINED PUBLIC EVIDENCE'].map(x=>`<span class="tag">${esc(x)}</span>`).join('');
  $('why').textContent=why;$('score').textContent=c.value;
  $('saveButton').textContent=saved.has(p.id)?'Remove from Watchlist':'Save Prospect';
  $('saveStatus').textContent=storageOK?'Watchlist saved on this browser only; export/sync is not enabled.':'Browser storage unavailable; watchlist works for this session only.';
  const fields=[['Role as disclosed',p.role],['Gross sale value',sales.length?money(c.total)+' · CALCULATED FROM VERIFIED FACT':'No ordinary sale value asserted'],['Latest sale',c.latest?`${c.latest} · ${c.age} days ago`:'UNKNOWN / no sale'],['Evidence strength','Primary SEC XML · VERIFIED PUBLIC FACT'],['Planning themes','Equity / tax coordination · MODEL INFERENCE'],['Mailing city',`${p.location.city||'UNKNOWN'}, ${p.location.state||''} · source-disclosed; residence UNKNOWN`],['Radius estimate',p.location.distance_miles==null?'UNKNOWN':`~${Math.round(p.location.distance_miles)} miles · city reference points`],['Independent sources','1 disclosure class · no convergence bonus'],['Available funds / wealth','UNKNOWN']];
  $('intelligence').innerHTML=fields.map(([key,value])=>`<div class="row"><span>${esc(key)}</span><b>${esc(value)}</b></div>`).join('');
  const sources=[...new Map(p.events.map(e=>[e.accession,e])).values()];
  $('sourceCount').textContent=`${sources.length} DISTINCT FILINGS`;
  $('evidenceTrail').innerHTML=`<div class="evidence"><b>VERIFIED PUBLIC FACT</b><p>Identity, issuer, dates, codes, shares and prices are extracted from ${sources.length} retained primary SEC filing${sources.length===1?'':'s'}. Officer title reflects disclosure date.</p></div><div class="evidence"><b>CALCULATED FROM VERIFIED FACT</b><p>${sales.length?money(c.total)+' gross sale value. Reported shares × reported prices; prices may be rounded weighted averages.':'No ordinary sale value inferred from non-sale codes.'}</p></div><div class="evidence"><b>MODEL INFERENCE / UNKNOWN</b><p>${esc(why)} Current role, planning needs, existing advisor relationship, net proceeds, available funds and total wealth remain UNKNOWN.</p></div>`;
  $('evidenceDrawer').innerHTML=sources.map(e=>`<article class="evidence"><b>${esc(e.accession)} · VERIFIED PUBLIC FACT</b><p>Filed ${esc(e.filed_date)} · source SHA-256 ${esc(e.sha256)}</p><a class="source" href="${esc(e.source_url)}" target="_blank" rel="noopener noreferrer">Open primary SEC filing ↗</a><a class="source" href="${esc(e.raw_path)}" target="_blank" rel="noopener">Inspect retained XML ↗</a></article>`).join('')+`<a class="source" href="${esc(p.location.source_url)}" target="_blank" rel="noopener">Mailing-city provenance ↗</a>${p.location.geo_source?`<a class="source" href="${esc(p.location.geo_source)}" target="_blank" rel="noopener">Census geography provenance ↗</a>`:''}`;
  $('evidenceDrawer').hidden=true;$('evidenceButton').setAttribute('aria-expanded','false');$('evidenceButton').textContent='Open evidence details';
  $('scoreRows').innerHTML=c.parts.map(part=>`<div><div class="row"><span>${esc(part.label)}</span><b>${part.points<0?'−'+Math.abs(part.points):part.points}${part.points<0?' adjustment':' / '+part.max}</b></div>${part.points>0?`<div class="bar"><i style="width:${100*part.points/part.max}%"></i></div>`:''}<p class="note" style="margin:6px 0 12px">${esc(part.reason)}</p></div>`).join('')+`<p class="note">Version ${esc(c.version)} · evaluated ${new Date().toISOString().slice(0,10)} · sum = ${c.value}</p>`;
  const b=ProjectIntelligence.brief(p,c);$('nextAction').textContent=b.next;
  $('eventCount').textContent=`${p.events.length} DEDUPLICATED ROWS`;
  $('eventTimeline').innerHTML=p.events.map(e=>`<article><h3>${esc(e.date)} · Code ${esc(e.code)} · ${esc(e.classification.replaceAll('_',' '))}</h3><p><span class="tag">VERIFIED PUBLIC FACT</span> ${esc(e.fact)}</p><p>${e.classification==='LIQUIDITY'?`CALCULATED FROM VERIFIED FACT · ${money(e.value)} gross transaction value.`:'Excluded from ordinary sale / liquidity total.'} ${e.planned?'Disclosed 10b5-1 context.':''}</p>${e.footnotes.map(f=>`<p class="status">Filing footnote: ${esc(f)}</p>`).join('')}<a class="source" href="${esc(e.source_url)}" target="_blank" rel="noopener noreferrer">Primary source · ${esc(e.accession)} ↗</a></article>`).join('');
  $('brief').hidden=true;
}
function generateBrief(){
  if(!selected)return;
  const b=ProjectIntelligence.brief(selected,selected.computed);
  $('brief').innerHTML=`<h4>Advisor Brief · ${esc(displayName(selected))}</h4>`+[['Who',b.who],['What / when',b.happened],['Publicly associated amount',b.amount],['Verified',b.verified],['Inference / uncertainty',b.inferred],['Planned-sale context',b.planned],['Planning themes',b.themes.join(' · ')],['Before outreach',b.diligence.join(' ')],['Next research action',b.next]].map(([key,value])=>`<p><b>${esc(key)}:</b> ${esc(value)}</p>`).join('');
  $('brief').hidden=false;$('brief').scrollIntoView({behavior:'smooth',block:'nearest'});
}
function save(){if(!selected)return; saved.has(selected.id)?saved.delete(selected.id):saved.add(selected.id);try{localStorage.setItem('project-a-watchlist-v1',JSON.stringify([...saved]));}catch{storageOK=false;}render();}
function reset(){watchOnly=false;$('search').value='';$('territory').value='50';$('eventType').value='Liquidity';$('minimumScore').value='0';render();}
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-person]');if(button)choose(button.dataset.person,true);
});
for(const id of ['search','territory','eventType','minimumScore'])$(id).addEventListener(id==='search'?'input':'change',render);
$('allView').onclick=()=>{watchOnly=false;render();};$('watchView').onclick=()=>{watchOnly=true;render();};$('reset').onclick=reset;
$('briefButton').onclick=generateBrief;$('saveButton').onclick=save;$('backButton').onclick=()=>$('prospects').scrollIntoView({behavior:'smooth'});
$('evidenceButton').onclick=()=>{const open=$('evidenceDrawer').hidden;$('evidenceDrawer').hidden=!open;$('evidenceButton').setAttribute('aria-expanded',String(open));$('evidenceButton').textContent=open?'Close evidence details':'Open evidence details';};
document.querySelectorAll('[data-nav]').forEach(button=>button.onclick=()=>{
  document.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('active',b===button));
  let target=button.dataset.nav;
  if(target==='watchlist'){watchOnly=true;render();target='prospects';}
  if(target==='evidence'&&selected){$('evidenceDrawer').hidden=false;$('evidenceButton').setAttribute('aria-expanded','true');$('evidenceButton').textContent='Close evidence details';}
  $(target)?.scrollIntoView({behavior:'smooth',block:'start'});
});
async function load(){
  try{
    const catalogPath=new URLSearchParams(location.search).get('qa')==='missing-catalog'?'missing-catalog.json':'catalog.json';
    const response=await fetch(catalogPath,{cache:'no-cache'});
    if(!response.ok)throw new Error(`Evidence catalog returned HTTP ${response.status}`);
    catalog=await response.json();
    if(!Array.isArray(catalog.records))throw new Error('Evidence catalog has an invalid schema');
    people=catalog.records.map(p=>({...p,computed:ProjectIntelligence.score(p)}));
    $('systemStatus').textContent=`Validated SEC snapshot · ${people.length} people`;
    $('coverage').textContent=`${catalog.validated_filings} validated filings · filings since ${catalog.coverage_start} · ${people.filter(p=>p.computed.sales).length} people with sale signals · 3 issuers`;
    $('feedDate').textContent=`Validated ${new Date(catalog.validated_at).toLocaleString()}. Reviewed snapshot; not a live stream. ${catalog.errors.length} filing(s) withheld after ingestion errors.`;
    render();
  }catch(error){people=[];selected=null;$('detail').hidden=true;$('error').hidden=false;$('error').textContent=`Could not load evidence: ${error.message}. No opportunities or scores are asserted. Reload to retry.`;$('leads').innerHTML='<p class="empty">Evidence unavailable. No records released.</p>';$('coverage').textContent='Source coverage unavailable';$('systemStatus').textContent='Evidence unavailable';for(const id of ['mCount','mValue','mHigh','mFresh'])$(id).textContent='UNKNOWN';}
}
load();
