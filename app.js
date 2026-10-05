'use strict';
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const displayName=p=>{const words=p.person_name.replaceAll(',',' ').trim().split(/\s+/);if(words.length<2)return p.person_name;const title=w=>/^(ii|iii|iv)$/i.test(w)?w.toUpperCase():w.length===1?w.toUpperCase()+'.':w[0].toUpperCase()+w.slice(1).toLowerCase();const suffixIndex=words.findIndex(w=>/^(jr\.?|sr\.?|ii|iii|iv)$/i.test(w));const suffix=suffixIndex>=0?words.splice(suffixIndex,1)[0]:null;return [...words.slice(1),words[0],...(suffix?[suffix]:[])].map(title).join(' ');};
const money=n=>n===null||n===undefined?'UNKNOWN':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
let feedback=[],reviewerId;
try{reviewerId=localStorage.getItem('project-a-reviewer-v1');if(!/^[a-zA-Z0-9_-]{8,80}$/.test(reviewerId||'')){reviewerId=crypto.randomUUID();localStorage.setItem('project-a-reviewer-v1',reviewerId);}}catch{reviewerId=crypto.randomUUID();}
try{const rawFeedback=JSON.parse(localStorage.getItem('project-a-pilot-feedback-v1')||'[]');if(Array.isArray(rawFeedback))feedback=rawFeedback.filter(x=>x&&typeof x.person_id==='string'&&['Useful','Needs evidence','Not useful'].includes(x.rating)&&typeof x.note==='string').slice(-1000);}catch{}
let catalog=null, people=[], selected=null, watchOnly=false, saved=new Set(), storageOK=true;
try{const raw=JSON.parse(localStorage.getItem('project-a-watchlist-v1')||'[]');if(Array.isArray(raw))saved=new Set(raw.filter(x=>typeof x==='string'));}catch{storageOK=false;}
function eventMatches(e,type){return type==='all'||(type==='Planning'?['LIQUIDITY','EXECUTIVE_TRANSITION'].includes(e.classification):type==='Transition'?e.classification==='EXECUTIVE_TRANSITION':type==='Liquidity'?e.classification==='LIQUIDITY':e.code===type);}
function rows(){
  const q=$('search').value.trim().toLowerCase(),territory=$('territory').value,type=$('eventType').value,min=Number($('minimumScore').value);
  return people.filter(p=>{
    const city=p.location||{};
    if(territory==='SC'&&city.state!=='SC')return false;
    if(!['SC','all'].includes(territory)&&(city.distance_miles===null||city.distance_miles===undefined||city.distance_miles>Number(territory)))return false;
    if(watchOnly&&!saved.has(p.id))return false;
    if(p.computed.value<min)return false;
    if(type==='Converged'&&!p.computed.converged)return false;
    if(type!=='Converged'&&!p.events.some(e=>eventMatches(e,type)))return false;
    return !q||`${p.person_name} ${displayName(p)} ${p.company} ${p.role} ${city.city} ${p.events.map(e=>e.fact+' '+e.classification).join(' ')}`.toLowerCase().includes(q);
  }).sort((a,b)=>b.computed.value-a.computed.value||b.computed.total-a.computed.total);
}
function choose(id,scroll=false){selected=people.find(p=>p.id===id)||null;render();if(scroll&&selected&&innerWidth<850)$('selected').scrollIntoView({behavior:'smooth',block:'start'});}
function render(){
  if(!catalog)return;
  const visible=rows();
  if(!visible.some(p=>p.id===selected?.id))selected=visible[0]||null;
  $('mCount').textContent=visible.length;
  $('mValue').textContent=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2}).format(visible.reduce((n,p)=>n+p.computed.total,0));
  $('mHigh').textContent=visible.filter(p=>p.computed.value>=70).length;
  $('mFresh').textContent=visible.filter(p=>p.computed.age!==null&&p.computed.age<=30).length;
  $('visibleSummary').textContent=`${visible.length} PEOPLE · ${watchOnly?'WATCHLIST':'PUBLIC EVIDENCE'}`;
  $('allView').classList.toggle('on',!watchOnly);$('watchView').classList.toggle('on',watchOnly);
  $('leads').innerHTML=visible.map(p=>`<button class="lead ${selected?.id===p.id?'active':''}" data-person="${esc(p.id)}" aria-pressed="${selected?.id===p.id}"><div class="score">${p.computed.value}</div><div><h3>${esc(displayName(p))} ${saved.has(p.id)?'<span class="watchbadge">★</span>':''}</h3><p>${esc(p.role)} · ${esc(p.company)}<br>${p.computed.sales?`${p.computed.sales} sale rows · latest ${p.computed.latest}`:p.computed.transitions?`${p.computed.transitions} reviewed executive transition · ${p.computed.latestTrigger}`:'No planning trigger · monitor only'}<br>${esc(p.location.city||'Location UNKNOWN')}, ${esc(p.location.state||'')} · ${p.location.distance_miles==null?'Radius UNKNOWN':'~'+Math.round(p.location.distance_miles)+' city miles'}</p></div><div class="money">${p.computed.sales?money(p.computed.total):'NO SALE VALUE'}<small>${p.computed.sales?'gross · calculated':p.computed.transitions?'Transition cash UNKNOWN':'F/A/M excluded'}</small></div></button>`).join('')||'<p class="empty">No people match these controls. Try all territories, all event types or reset controls.</p>';
  const selectedType=$('eventType').value;
  const feed=visible.flatMap(p=>p.events.filter(e=>selectedType==='Converged'?eventMatches(e,'Planning'):eventMatches(e,selectedType)).map(e=>({p,e}))).sort((a,b)=>b.e.date.localeCompare(a.e.date)).slice(0,8);
  $('signalFeed').innerHTML=feed.map(({p,e})=>`<button class="signal" data-person="${esc(p.id)}"><i class="dot"></i><div><b>${esc(displayName(p))} · ${esc(e.classification.replaceAll('_',' '))}</b><p>${esc(e.date)} · ${esc(p.company)}<br>${e.code==='S'?money(e.value)+' gross calculated':e.source_class==='8K'?'Form 8-K · '+esc(e.status):'Code '+esc(e.code)+' · no ordinary sale value'}${e.planned?' · 10b5-1':''}</p></div></button>`).join('')||'<p class="empty">No signals in this view.</p>';
  $('detail').hidden=!selected;
  if(selected)renderDetail();
}
function renderDetail(){
  const p=selected,c=p.computed,sales=p.events.filter(e=>e.classification==='LIQUIDITY'),changes=ProjectIntelligence.transitions(p);
  const baseWhy=sales.length?`${sales.length} public stock-sale rows create a potential equity-planning research opportunity. ${c.planned?'The disclosed trading-plan context lowers inferred urgency. ':''}The score prioritizes investigation; it does not establish investable assets or an unmet planning need.`:changes.length?'A reviewed executive transition creates a potential compensation and benefits planning research opportunity. Completion and available funds remain UNKNOWN.':'This record is retained for monitoring and classification QA. Withholding, awards and exercise context do not establish ordinary sale liquidity.';
  const why=baseWhy+(changes.length?' '+changes.map(e=>`${e.date}: ${e.fact} ${e.status}`).join(' '):'');
  $('name').textContent=`${displayName(p)} · ${p.company}`;
  $('tags').innerHTML=[sales.length?'STOCK MONETIZATION':changes.length?'EXECUTIVE TRANSITION':'MONITOR ONLY',c.converged?'CONVERGED SIGNALS':changes.length?'FORM 4 + FORM 8-K':'SEC FORM 4',p.events.some(e=>e.planned)?'10b5-1 CONTEXT':'RETAINED PUBLIC EVIDENCE'].map(x=>`<span class="tag">${esc(x)}</span>`).join('');
  $('why').textContent=why;$('score').textContent=c.value;
  $('saveButton').textContent=saved.has(p.id)?'Remove from Watchlist':'Save Prospect';
  $('saveStatus').textContent=storageOK?'Watchlist saved on this browser only; export/sync is not enabled.':'Browser storage unavailable; watchlist works for this session only.';
  const fields=[['Role as disclosed',p.role],['Gross sale value',sales.length?money(c.total)+' · CALCULATED FROM VERIFIED FACT':'No ordinary sale value asserted'],['Latest sale',c.latest?`${c.latest} · ${c.age} days ago`:'UNKNOWN / no sale'],['Evidence strength','Retained primary SEC disclosures · VERIFIED PUBLIC FACT'],['Planning themes',changes.length?'Career / compensation / equity coordination · MODEL INFERENCE':'Equity / tax coordination · MODEL INFERENCE'],['Mailing city',`${p.location.city||'UNKNOWN'}, ${p.location.state||''} · source-disclosed; residence UNKNOWN`],['Radius estimate',p.location.distance_miles==null?'UNKNOWN':`~${Math.round(p.location.distance_miles)} miles · city reference points`],['Signal convergence',c.converged?'Sale + executive transition · distinct disclosure classes, same issuer':`${p.source_classes.length} disclosure class(es) · no convergence bonus`],...(changes.length?[['Transition status',changes.map(e=>e.status).join(' ')],['Transition amount context',changes.map(e=>e.amount_context).filter(Boolean).join(' ')]]:[]),['Available funds / wealth','UNKNOWN']];
  $('intelligence').innerHTML=fields.map(([key,value])=>`<div class="row"><span>${esc(key)}</span><b>${esc(value)}</b></div>`).join('');
  const sources=[...new Map(p.events.map(e=>[e.accession,e])).values()];
  $('sourceCount').textContent=`${sources.length} DISTINCT FILINGS`;
  $('evidenceTrail').innerHTML=`<div class="evidence"><b>VERIFIED PUBLIC FACT</b><p>Form 4 identity and transaction details, plus any reviewed named-person Form 8-K facts, are supported by ${sources.length} retained primary SEC filing${sources.length===1?'':'s'}. Officer title reflects disclosure date.</p></div><div class="evidence"><b>CALCULATED FROM VERIFIED FACT</b><p>${sales.length?money(c.total)+' gross sale value. Reported shares × reported prices; prices may be rounded weighted averages.':'No ordinary sale value inferred from non-sale codes.'}</p></div><div class="evidence"><b>MODEL INFERENCE / UNKNOWN</b><p>${esc(why)} Current role, planning needs, existing advisor relationship, net proceeds, available funds and total wealth remain UNKNOWN.</p></div>`;
  $('evidenceDrawer').innerHTML=sources.map(e=>`<article class="evidence"><b>${esc(e.accession)} · VERIFIED PUBLIC FACT</b><p>Filed ${esc(e.filed_date)} · source SHA-256 ${esc(e.sha256)}</p><a class="source" href="${esc(e.source_url)}" target="_blank" rel="noopener noreferrer">Open primary SEC filing ↗</a><a class="source" href="${esc(e.raw_path)}" target="_blank" rel="noopener">Inspect retained filing ↗</a></article>`).join('')+`<a class="source" href="${esc(p.location.source_url)}" target="_blank" rel="noopener">Mailing-city provenance ↗</a>${p.location.geo_source?`<a class="source" href="${esc(p.location.geo_source)}" target="_blank" rel="noopener">Census geography provenance ↗</a>`:''}`;
  $('evidenceDrawer').hidden=true;$('evidenceButton').setAttribute('aria-expanded','false');$('evidenceButton').textContent='Open evidence details';
  $('scoreRows').innerHTML=c.parts.map(part=>`<div><div class="row"><span>${esc(part.label)}</span><b>${part.points<0?'−'+Math.abs(part.points):part.points}${part.points<0?' adjustment':' / '+part.max}</b></div>${part.points>0?`<div class="bar"><i style="width:${100*part.points/part.max}%"></i></div>`:''}<p class="note" style="margin:6px 0 12px">${esc(part.reason)}</p></div>`).join('')+`<p class="note">Version ${esc(c.version)} · evaluated ${new Date().toISOString().slice(0,10)} · sum = ${c.value}</p>`;
  const b=ProjectIntelligence.brief(p,c);$('nextAction').textContent=b.next;
  $('eventCount').textContent=`${p.events.length} DEDUPLICATED ROWS`;
  $('eventTimeline').innerHTML=p.events.map(e=>`<article><h3>${esc(e.date)} · ${e.source_class==='8K'?'Form 8-K':'Code '+esc(e.code)} · ${esc(e.classification.replaceAll('_',' '))}</h3><p><span class="tag">VERIFIED PUBLIC FACT</span> ${esc(e.fact)}</p><p>${e.classification==='LIQUIDITY'?`CALCULATED FROM VERIFIED FACT · ${money(e.value)} gross transaction value.`:e.source_class==='8K'?esc(e.status)+' '+esc(e.amount_context||''):'Excluded from ordinary sale / liquidity total.'} ${e.planned?'Disclosed 10b5-1 context.':''}</p>${(e.footnotes||[]).map(f=>`<p class="status">Filing footnote: ${esc(f)}</p>`).join('')}<a class="source" href="${esc(e.source_url)}" target="_blank" rel="noopener noreferrer">Primary source · ${esc(e.accession)} ↗</a></article>`).join('');
  const share=new URL(location.pathname,location.origin);share.searchParams.set('person',p.id);
  $('saveStatus').innerHTML=esc($('saveStatus').textContent)+` <a class="source" href="${esc(share.href)}" target="_blank" rel="noopener">Open shareable prospect view ↗</a>`;
  $('brief').hidden=true;
}
function generateBrief(){
  if(!selected)return;
  const b=ProjectIntelligence.brief(selected,selected.computed);
  $('brief').innerHTML=`<h4>Advisor Brief · ${esc(displayName(selected))}</h4>`+[['Who',b.who],['What / when',b.happened],['Publicly associated amount',b.amount],['Verified',b.verified],['Inference / uncertainty',b.inferred],['Planned-sale context',b.planned],['Planning themes',b.themes.join(' · ')],['Before outreach',b.diligence.join(' ')],['Next research action',b.next]].map(([key,value])=>`<p><b>${esc(key)}:</b> ${esc(value)}</p>`).join('');
  $('brief').innerHTML+=`<div class="actions"><button class="cta secondary" id="downloadBrief">Export Advisor Brief</button></div><h4>Pilot feedback</h4><p class="note">Does this evidence help you prioritize a legitimate planning conversation? Feedback is saved on this browser; export it to share with Project A.</p><label class="note">Usefulness<select id="feedbackRating" aria-label="Opportunity usefulness"><option>Useful</option><option>Needs evidence</option><option>Not useful</option></select></label><label class="note">What would make this more useful? Avoid private client details.<textarea id="feedbackNote" aria-label="Pilot feedback note" maxlength="1000" rows="3" placeholder="Evidence gaps, relevance or planning themes…"></textarea></label><div class="actions"><button class="cta secondary" id="saveFeedback">Save feedback</button><button class="cta secondary" id="exportFeedback">Export pilot feedback</button></div><p class="note" id="feedbackStatus" role="status"></p>`;
  $('downloadBrief').onclick=()=>downloadFile(`project-a-${selected.person_cik}-advisor-brief.txt`,$('brief').innerText.split('Export Advisor Brief')[0]+'\nEvidence\n'+[...new Map(selected.events.map(e=>[e.accession,e.source_url])).values()].join('\n')+'\nScoring version: '+selected.computed.version+'\nGenerated: '+new Date().toISOString()+'\nPublic-data research; gross transaction value is not available cash, net worth or investable assets.','text/plain');
  $('saveFeedback').onclick=saveFeedback;$('exportFeedback').onclick=()=>downloadFile('project-a-pilot-feedback.json',feedbackExport(),'application/json');
  const previous=feedback.find(r=>r.person_id===selected.id&&r.reviewer_id===reviewerId);if(previous){$('feedbackRating').value=previous.rating;$('feedbackNote').value=previous.note;$('feedbackStatus').textContent='Your saved review is loaded. Save to update it.';}
  $('brief').hidden=false;$('brief').scrollIntoView({behavior:'smooth',block:'nearest'});
}
function downloadFile(name,text,type){
  let panel=$('textExport');
  if(!panel){panel=document.createElement('div');panel.id='textExport';panel.innerHTML='<h4>Text export</h4><p class="note">Copy this export to share it. It includes evidence sources and uncertainty labels.</p><textarea id="exportText" aria-label="Exported text" readonly rows="8"></textarea><button class="cta secondary" id="copyExport">Select exported text</button><p class="note" id="exportStatus" role="status"></p>';$('brief').appendChild(panel);}
  $('exportText').value=text;
  $('copyExport').onclick=()=>{$('exportText').focus();$('exportText').select();$('exportStatus').textContent='Text selected. Use Copy or Share in your browser to send this export.';};
  panel.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function saveFeedback(){
  if(!selected)return;
  const item={reviewer_id:reviewerId,person_id:selected.id,person_name:displayName(selected),company:selected.company,rating:$('feedbackRating').value,note:$('feedbackNote').value.trim(),recorded_at:new Date().toISOString(),score:selected.computed.value,scoring_version:selected.computed.version,source_accessions:[...new Set(selected.events.map(e=>e.accession))]};
  try{feedback=ProjectPilot.merge(feedback,[item]);}catch(error){$('feedbackStatus').textContent=error.message;return;}
  renderPilot();
  try{localStorage.setItem('project-a-pilot-feedback-v1',JSON.stringify(feedback));$('feedbackStatus').textContent='Feedback saved on this browser. Export to share your review.';}catch{$('feedbackStatus').textContent='Browser storage unavailable. Feedback is held for this session; export before closing.';}
}
function feedbackExport(){return JSON.stringify({product:'Project A',schema_version:2,exported_at:new Date().toISOString(),feedback},null,2);}
function renderPilot(){
  const known=new Set(people.map(p=>p.id));
  const visible=feedback.filter(r=>known.has(r.person_id));
  $('pilotSummary').textContent=`${visible.length} reviews · ${new Set(visible.map(r=>r.reviewer_id||'legacy-unknown')).size} anonymous browser IDs · `+ProjectPilot.ratings.map(r=>`${visible.filter(x=>x.rating===r).length} ${r}`).join(' · ')+'. Browser IDs are not verified advisor identities.';
  $('pilotReviews').innerHTML=visible.map(r=>{const p=people.find(p=>p.id===r.person_id);return `<article class="evidence"><b>${esc(displayName(p))} · ${esc(r.rating)}</b><p>${esc(r.note||'No note provided.')}</p><p class="note">ADVISOR OPINION · ${esc(r.recorded_at)} · reviewer ${esc((r.reviewer_id||'legacy-unknown').slice(0,8))} · score at review ${esc(r.score)} / ${esc(r.scoring_version)}</p><button class="cta secondary" data-review-person="${esc(r.person_id)}">Open reviewed prospect</button></article>`;}).join('')||'<p class="empty">No advisor reviews on this browser yet. Generate an advisor brief to review an opportunity.</p>';
}
function importReviews(){
  try{
    const text=$('importFeedbackText').value;if(text.length>1500000)throw new Error('Export exceeds the import size limit.');
    const incoming=ProjectPilot.validate(JSON.parse(text),people),merged=ProjectPilot.merge(feedback,incoming),added=merged.length-feedback.length;
    feedback=merged;renderPilot();
    try{localStorage.setItem('project-a-pilot-feedback-v1',JSON.stringify(feedback));$('pilotStatus').textContent=`Import complete: ${incoming.length} valid reviews checked, ${added} new reviews added. Duplicate or older reviews do not overwrite newer reviews. Saved on this browser.`;}catch{$('pilotStatus').textContent='Import complete for this session. Browser storage unavailable; export before closing.';}
  }catch(error){$('pilotStatus').textContent=`Import rejected: ${error.message}`;}
}
$('importFeedback').onclick=importReviews;
$('exportAllFeedback').onclick=()=>{$('pilotExport').hidden=false;$('pilotExportText').value=feedbackExport();$('pilotStatus').textContent='Export ready. Select the text and copy it to back up or share your reviews.';};
$('selectPilotExport').onclick=()=>{$('pilotExportText').focus();$('pilotExportText').select();$('pilotStatus').textContent='Review export selected. Use Copy or Share in your browser.';};
document.addEventListener('click',event=>{const b=event.target.closest('[data-review-person]');if(b){watchOnly=false;$('search').value='';$('territory').value='all';$('eventType').value='all';$('minimumScore').value='0';choose(b.dataset.reviewPerson);$('selected').scrollIntoView({behavior:'smooth'});}});
function save(){if(!selected)return; saved.has(selected.id)?saved.delete(selected.id):saved.add(selected.id);try{localStorage.setItem('project-a-watchlist-v1',JSON.stringify([...saved]));}catch{storageOK=false;}render();}
function reset(){watchOnly=false;$('search').value='';$('territory').value='50';$('eventType').value='Planning';$('minimumScore').value='0';render();}
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
    $('coverage').textContent=`${catalog.validated_filings} Form 4 + ${catalog.transition_filings||0} reviewed 8-K filings · filings since ${catalog.coverage_start} · ${people.filter(p=>p.computed.sales).length} people with sale signals · ${catalog.issuer_count||3} issuers`;
    $('feedDate').textContent=`Validated ${new Date(catalog.validated_at).toLocaleString()}. Reviewed snapshot; not a live stream. ${catalog.errors.length+(catalog.transition_errors||[]).length} filing(s) withheld after ingestion errors.`;
    try{feedback=ProjectPilot.validate({product:'Project A',feedback},people);}catch{feedback=[];$('pilotStatus').textContent='Saved reviews could not be validated against this catalog. Original browser storage is unchanged; import a valid export to recover reviews.';}
    const linkedId=new URLSearchParams(location.search).get('person');
    if(linkedId){const linked=people.find(p=>p.id===linkedId);if(linked){selected=linked;$('territory').value='all';$('eventType').value='all';}else{$('error').hidden=false;$('error').textContent='The linked prospect is unavailable in this evidence snapshot. Showing the current territory instead.';}}
    render();renderPilot();
    if(linkedId&&selected?.id===linkedId)$('selected').scrollIntoView({block:'start'});
  }catch(error){catalog=null;people=[];selected=null;$('detail').hidden=true;$('error').hidden=false;$('error').textContent=`Could not load evidence: ${error.message}. No opportunities or scores are asserted. Reload to retry.`;$('leads').innerHTML='<p class="empty">Evidence unavailable. No records released.</p>';$('coverage').textContent='Source coverage unavailable';$('systemStatus').textContent='Evidence unavailable';for(const id of ['mCount','mValue','mHigh','mFresh'])$(id).textContent='UNKNOWN';}
}
load();
