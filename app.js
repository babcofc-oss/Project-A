'use strict';
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const displayName=p=>{if(p.display_name)return p.display_name;const words=p.person_name.replaceAll(',',' ').trim().split(/\s+/);if(words.length<2)return p.person_name;const title=w=>/^(ii|iii|iv)$/i.test(w)?w.toUpperCase():w.length===1?w.toUpperCase()+'.':w[0].toUpperCase()+w.slice(1).toLowerCase();const suffixIndex=words.findIndex(w=>/^(jr\.?|sr\.?|ii|iii|iv)$/i.test(w));const suffix=suffixIndex>=0?words.splice(suffixIndex,1)[0]:null;return [...words.slice(1),words[0],...(suffix?[suffix]:[])].map(title).join(' ');};
const money=n=>n===null||n===undefined?'UNKNOWN':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
let feedback=[],reviewerId;
try{reviewerId=localStorage.getItem('project-a-reviewer-v1');if(!/^[a-zA-Z0-9_-]{8,80}$/.test(reviewerId||'')){reviewerId=crypto.randomUUID();localStorage.setItem('project-a-reviewer-v1',reviewerId);}}catch{reviewerId=crypto.randomUUID();}
try{const rawFeedback=JSON.parse(localStorage.getItem('project-a-pilot-feedback-v1')||'[]');if(Array.isArray(rawFeedback))feedback=rawFeedback.filter(x=>x&&typeof x.person_id==='string'&&['Useful','Needs evidence','Not useful'].includes(x.rating)&&typeof x.note==='string').slice(-1000);}catch{}
let territoryData=null,territoryIndex=null,territoryOrigin=null,zipRequest=0,zipController=null;
let catalog=null, people=[], selected=null, watchOnly=false, saved=new Set(), storageOK=true;
try{const raw=JSON.parse(localStorage.getItem('project-a-watchlist-v1')||'[]');if(Array.isArray(raw))saved=new Set(raw.filter(x=>typeof x==='string'));}catch{storageOK=false;}
function eventMatches(e,type){return type==='all'||(type==='Planning'?ProjectTriggers.actionable(e):type==='Transition'?e.classification==='EXECUTIVE_TRANSITION':type==='Liquidity'?e.classification==='LIQUIDITY':(e.code===type||e.trigger_type===type||e.classification===type));}
function rows(){
  const q=$('search').value.trim().toLowerCase(),territory=$('territory').value,type=$('eventType').value,min=Number($('minimumScore').value);
  return people.filter(p=>{
    const city=p.location||{};
    if(territory==='SC'&&city.state!==territoryOrigin?.state)return false;
    if(!['SC','all'].includes(territory)&&(city.distance_miles===null||city.distance_miles===undefined||city.distance_miles>Number(territory)))return false;
    if(watchOnly&&!saved.has(p.id))return false;
    if(p.computed.value<min)return false;
    if(!ProjectContacts.matches(p,$('contactAvailability').value))return false;
    if(type==='Converged'&&!p.computed.converged)return false;
    if(type!=='Converged'&&!p.events.some(e=>eventMatches(e,type)))return false;
    return !q||`${p.person_name} ${displayName(p)} ${p.company} ${p.role} ${city.city} ${p.events.map(e=>e.fact+' '+e.classification).join(' ')}`.toLowerCase().includes(q);
  }).sort((a,b)=>b.computed.value-a.computed.value||b.computed.total-a.computed.total);
}
function choose(id,scroll=false){selected=people.find(p=>p.id===id)||null;render();if(scroll&&selected&&innerWidth<850)$('selected').scrollIntoView({behavior:'smooth',block:'start'});}
function render(){
  if(!catalog)return;
  const visible=rows();
  const trigger=ProjectTriggers.byId[$('eventType').value];
  $('triggerHelp').textContent=trigger?`${trigger.label}: ${trigger.why} ${trigger.limit}`:$('eventType').value==='Planning'?'Verified planning triggers only. Proposed sales, ownership changes and registered offerings remain monitoring context until execution is evidenced.':$('eventType').value==='Transition'?ProjectTriggers.byId.EXECUTIVE_TRANSITION.why+' '+ProjectTriggers.byId.EXECUTIVE_TRANSITION.limit:'Audit / monitoring views include events that do not establish liquidity. Check each event’s evidence and stage.';
  renderTriggerGuide();
  if(!visible.some(p=>p.id===selected?.id))selected=visible[0]||null;
  $('territoryStatus').textContent=`Center: ${territoryOrigin.name}, ${territoryOrigin.state}${territoryOrigin.zip?` · ZIP ${territoryOrigin.zip}`:''}. ${visible.length} matching people in the reviewed snapshot (${catalog.issuer_count||7} SEC issuers + ${catalog.business_exits?.validated_people||0} business founders). Territory availability does not imply prospect coverage; empty markets need source discovery and validation.`;
  $('contactStatus').textContent=`In this view: ${visible.filter(p=>ProjectContacts.status(p)==='named').length} with published named business email / phone; ${visible.filter(p=>ProjectContacts.status(p)==='profile').length} with identity-research profiles; ${visible.filter(p=>ProjectContacts.status(p)==='company').length} with company channels only. Contact evidence does not change financial scores. ${catalog.contact_enrichment?.errors?.length||0} contact source(s) withheld after validation errors.`;
  $('mCount').textContent=visible.length;
  $('mValue').textContent=!visible.length?'—':!visible.some(p=>p.computed.sales)?'UNKNOWN':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2}).format(visible.reduce((n,p)=>n+p.computed.total,0));
  $('mHigh').textContent=visible.filter(p=>p.computed.value>=70).length;
  $('mFresh').textContent=visible.filter(p=>p.computed.age!==null&&p.computed.age<=30).length;
  $('visibleSummary').textContent=`${visible.length} PEOPLE · ${watchOnly?'WATCHLIST':'PUBLIC EVIDENCE'}`;
  $('allView').classList.toggle('on',!watchOnly);$('watchView').classList.toggle('on',watchOnly);
  $('leads').innerHTML=visible.map(p=>`<button class="lead ${selected?.id===p.id?'active':''}" data-person="${esc(p.id)}" aria-pressed="${selected?.id===p.id}"><div class="score">${p.computed.value}</div><div><h3>${esc(displayName(p))} ${saved.has(p.id)?'<span class="watchbadge">★</span>':''}</h3><p>${esc(p.role)} · ${esc(p.company)}<br>${p.computed.sales?`${p.computed.sales} sale rows · latest ${p.computed.latest}`:p.computed.transitions?`${p.computed.transitions} reviewed executive transition · ${p.computed.latestTrigger}`:p.computed.other?`${p.identity_kind==='REVIEWED_BUSINESS_PERSON'?'Business acquisition':'Reviewed planning event'} · reported ${p.computed.latestTrigger}`:p.events.some(e=>e.source_class==='FORM144')?'Proposed sale · monitor execution':'No planning trigger · monitor only'}<br>${esc(p.location.city||'Location UNKNOWN')}, ${esc(p.location.state||'')}${p.location.basis==='COMPANY_MARKET'?' · company market':''} · ${p.location.distance_miles==null?'Radius UNKNOWN':'~'+Math.round(p.location.distance_miles)+' city miles'}</p></div><div class="money">${p.computed.sales?money(p.computed.total):p.identity_kind==='REVIEWED_BUSINESS_PERSON'?'PROCEEDS UNKNOWN':'NO STOCK SALE VALUE'}<small>${p.computed.sales?'gross · calculated':p.computed.transitions?'Transition cash UNKNOWN':p.computed.other?'Individual proceeds UNKNOWN':'F/A/M excluded'}</small></div></button>`).join('')||'<p class="empty">No reviewed opportunities match these controls. This market may not have ingested evidence yet. Try all territories or reset controls; no prospects are invented.</p>';
  const selectedType=$('eventType').value;
  const feed=visible.flatMap(p=>p.events.filter(e=>selectedType==='Converged'?eventMatches(e,'Planning'):eventMatches(e,selectedType)).map(e=>({p,e}))).sort((a,b)=>b.e.date.localeCompare(a.e.date)).slice(0,8);
  $('signalFeed').innerHTML=feed.map(({p,e})=>`<button class="signal" data-person="${esc(p.id)}"><i class="dot"></i><div><b>${esc(displayName(p))} · ${esc(e.classification.replaceAll('_',' '))}</b><p>${esc(e.date)} · ${esc(p.company)}<br>${e.code==='S'?money(e.value)+' gross calculated':e.status?esc(e.source_class)+' · '+esc(e.status):'Code '+esc(e.code)+' · no ordinary sale value'}${e.planned?' · 10b5-1':''}</p></div></button>`).join('')||'<p class="empty">No signals in this view.</p>';
  $('detail').hidden=!selected;
  if(selected)renderDetail();
}
function renderTriggerGuide(){
  $('triggerGuide').innerHTML=ProjectTriggers.definitions.map(d=>{const count=people.filter(p=>p.events.some(e=>ProjectTriggers.definition(e)?.id===d.id)).length;return `<article class="evidence"><b>${esc(d.label)} · ${count} people</b><p>${esc(d.why)} <span class="tag">MODEL INFERENCE</span></p><p class="note">Sources: ${esc(d.sources)}. ${esc(d.limit)}</p><button class="cta secondary" data-trigger="${esc(d.id)}">${count?'Open trigger':'Check territory · no validated records'}</button></article>`;}).join('');
}
document.addEventListener('click',event=>{const button=event.target.closest('[data-trigger]');if(!button)return;setRadarPanel('prospects');watchOnly=false;$('search').value='';$('minimumScore').value='0';$('contactAvailability').value='all';const type=button.dataset.trigger;$('eventType').value=type==='LIQUIDITY'?'Liquidity':type==='EXECUTIVE_TRANSITION'?'Transition':type;render();$('prospects').scrollIntoView({behavior:'smooth'});});
function renderDetail(){
  const p=selected,c=p.computed,sales=p.events.filter(e=>e.classification==='LIQUIDITY'),changes=ProjectIntelligence.transitions(p);
  const privateIdentity=p.identity_kind==='REVIEWED_BUSINESS_PERSON';
  const context=p.events.filter(e=>e.source_class==='FORM144'||e.reviewed_trigger);
  const baseWhy=sales.length?`${sales.length} public stock-sale rows create a potential equity-planning research opportunity. ${c.planned?'The disclosed trading-plan context lowers inferred urgency. ':''}The score prioritizes investigation; it does not establish investable assets or an unmet planning need.`:changes.length?'A reviewed executive transition creates a potential compensation and benefits planning research opportunity. Completion and available funds remain UNKNOWN.':c.other?(privateIdentity?'A completed company acquisition involving its named founder may create business-transition planning decisions. Individual ownership, sale participation, proceeds and current role remain UNKNOWN.':'A reviewed public event may create a planning need. Review its status, identity relationship and amount limits.'):context.length?'A proposed stock sale is monitoring context. Execution and cash received remain UNKNOWN.':'This record is retained for monitoring and classification QA. Withholding, awards and exercise context do not establish ordinary sale liquidity.';
  const triggerDefinitions=ProjectTriggers.forPerson(p);
  const why=baseWhy+(changes.length?' '+changes.map(e=>`${e.date}: ${e.fact} ${e.status}`).join(' '):'');
  $('name').textContent=`${displayName(p)} · ${p.company}`;
  $('tags').innerHTML=[sales.length?'STOCK MONETIZATION':changes.length?'EXECUTIVE TRANSITION':c.other?(privateIdentity?'BUSINESS ACQUISITION':'REVIEWED PLANNING EVENT'):'MONITOR ONLY',c.converged?'CONVERGED SIGNALS':privateIdentity?'PRIMARY COMPANY ANNOUNCEMENTS':changes.length?'FORM 4 + FORM 8-K':p.events.some(e=>e.source_class==='FORM144')?'FORM 4 + FORM 144':'SEC FORM 4',p.events.some(e=>e.planned)?'10b5-1 CONTEXT':'RETAINED PUBLIC EVIDENCE'].map(x=>`<span class="tag">${esc(x)}</span>`).join('');
  $('why').textContent=why;$('score').textContent=c.value;
  $('saveButton').textContent=saved.has(p.id)?'Remove from Watchlist':'Save Prospect';
  $('saveStatus').textContent=storageOK?'Watchlist saved on this browser only; export/sync is not enabled.':'Browser storage unavailable; watchlist works for this session only.';
  const fields=[['Role as disclosed',p.role],['Gross stock-sale value',sales.length?money(c.total)+' · CALCULATED FROM VERIFIED FACT':'No completed stock-sale amount; business proceeds UNKNOWN'],['Latest stock sale',c.latest?`${c.latest} · ${c.age} days ago`:'UNKNOWN / no sale'],['Evidence strength','Retained primary disclosures · VERIFIED PUBLIC FACT'],...triggerDefinitions.map(d=>['Why '+d.label+' helps',d.why+' · MODEL INFERENCE']),...triggerDefinitions.map(d=>[d.label+' evidence limit',d.limit]),['Planning themes',[...new Set(triggerDefinitions.flatMap(d=>d.themes))].join(' / ')+' · MODEL INFERENCE'],[privateIdentity?'Company service market':'Mailing city',`${p.location.city||'UNKNOWN'}, ${p.location.state||''} · ${privateIdentity?'company market; founder location UNKNOWN':'source-disclosed; residence UNKNOWN'}`],['Radius estimate',p.location.distance_miles==null?'UNKNOWN':`~${Math.round(p.location.distance_miles)} miles · city reference points`],['Signal convergence',c.converged?'Sale + executive transition · distinct disclosure classes, same issuer':`${p.source_classes.length} disclosure class(es) · no convergence bonus`],...(changes.length?[['Transition status',changes.map(e=>e.status).join(' ')],['Transition amount context',changes.map(e=>e.amount_context).filter(Boolean).join(' ')]]:[]),...context.map(e=>[e.source_class+' status / amount',e.status+' '+e.amount_context]),['Available funds / wealth','UNKNOWN']];
  $('intelligence').innerHTML=fields.map(([key,value])=>`<div class="row"><span>${esc(key)}</span><b>${esc(value)}</b></div>`).join('');
  const sources=[...new Map(p.events.flatMap(e=>[{...e},...(e.evidence_sources||[]).map(source=>({...source,accession:e.accession,filed_date:e.filed_date}))]).map(e=>[e.source_url,e])).values()];
  $('sourceCount').textContent=`${sources.length} PRIMARY DISCLOSURES`;
  $('evidenceTrail').innerHTML=`<div class="evidence"><b>VERIFIED PUBLIC FACT</b><p>Disclosed identity and event facts are supported by ${sources.length} retained primary disclosure${sources.length===1?'':'s'}. Role reflects disclosure date; current role must be reconfirmed.</p></div><div class="evidence"><b>CALCULATED FROM VERIFIED FACT</b><p>${sales.length?money(c.total)+' gross sale value. Reported shares × reported prices; prices may be rounded weighted averages.':privateIdentity?'Company acquisition confirmed; price and individual proceeds UNKNOWN. No value added to completed-stock-sale totals.':'No ordinary sale value inferred from non-sale codes.'}</p></div><div class="evidence"><b>MODEL INFERENCE / UNKNOWN</b><p>${esc(why)} Current role, planning needs, existing advisor relationship, net proceeds, available funds and total wealth remain UNKNOWN.</p></div>`;
  $('evidenceDrawer').innerHTML=sources.map(e=>`<article class="evidence"><b>${esc(e.authority_domain||e.accession)} · VERIFIED PUBLIC FACT</b><p>${privateIdentity?'Published':'Filed'} ${esc(e.filed_date)} · source SHA-256 ${esc(e.sha256)}</p><a class="source" href="${esc(e.source_url)}" target="_blank" rel="noopener noreferrer">Open primary source ↗</a><button class="source retained-button" data-retained="${esc(e.raw_path)}" data-fingerprint="${esc(e.sha256)}">Inspect retained disclosure</button></article>`).join('')+`<a class="source" href="${esc(p.location.source_url)}" target="_blank" rel="noopener">Geography provenance ↗</a>${p.location.geo_source?`<a class="source" href="${esc(p.location.geo_source)}" target="_blank" rel="noopener">Census geography provenance ↗</a>`:''}`;
  $('evidenceDrawer').hidden=true;$('evidenceButton').setAttribute('aria-expanded','false');$('evidenceButton').textContent='Open evidence details';
  renderContacts(p);
  $('scoreRows').innerHTML=c.parts.map(part=>`<div><div class="row"><span>${esc(part.label)}</span><b>${part.points<0?'−'+Math.abs(part.points):part.points}${part.points<0?' adjustment':' / '+part.max}</b></div>${part.points>0?`<div class="bar"><i style="width:${100*part.points/part.max}%"></i></div>`:''}<p class="note" style="margin:6px 0 12px">${esc(part.reason)}</p></div>`).join('')+`<p class="note">Version ${esc(c.version)} · evaluated ${new Date().toISOString().slice(0,10)} · sum = ${c.value}</p>`;
  const b=ProjectIntelligence.brief(p,c);$('nextAction').textContent=b.next;
  $('eventCount').textContent=`${p.events.length} DEDUPLICATED ROWS`;
  $('eventTimeline').innerHTML=p.events.map(e=>`<article><h3>${esc(e.date)} · ${e.source_class==='8K'?'Form 8-K':e.source_class==='FORM144'?'Form 144':e.reviewed_trigger?esc(e.source_class):'Code '+esc(e.code)} · ${esc(e.classification.replaceAll('_',' '))}</h3><p><span class="tag">VERIFIED PUBLIC FACT</span> ${esc(e.fact)}</p><p>${e.classification==='LIQUIDITY'?`CALCULATED FROM VERIFIED FACT · ${money(e.value)} gross transaction value.`:e.status?esc(e.status)+' '+esc(e.amount_context||''):'Excluded from ordinary sale / liquidity total.'} ${e.planned?'Disclosed 10b5-1 context.':''}</p>${(e.footnotes||[]).map(f=>`<p class="status">Filing footnote: ${esc(f)}</p>`).join('')}<a class="source" href="${esc(e.source_url)}" target="_blank" rel="noopener noreferrer">Primary source · ${esc(e.accession)} ↗</a></article>`).join('');
  const share=new URL(location.pathname,location.origin);share.searchParams.set('person',p.id);
  $('saveStatus').innerHTML=esc($('saveStatus').textContent)+` <a class="source" href="${esc(share.href)}" target="_blank" rel="noopener">Open shareable prospect view ↗</a>`;
  $('brief').hidden=true;
}
function renderContacts(p){
  const routes=ProjectContacts.routes(p),state=ProjectContacts.status(p);
  $('contactSummary').textContent={named:'PUBLISHED NAMED BUSINESS CONTACT',profile:'PROFILE + COMPANY CHANNELS',company:'COMPANY CHANNELS ONLY',unknown:'NO CURRENT VERIFIED ROUTES'}[state];
  const groups=[...new Map(routes.map(r=>[r.source_url+'|'+r.scope,r])).values()];
  $('contactRoutes').innerHTML=routes.length?groups.map(g=>{
    const rs=routes.filter(r=>r.source_url===g.source_url&&r.scope===g.scope);
    return `<article class="evidence contact-route"><span class="tag">${esc(g.scope.replaceAll('_',' '))} · VERIFIED PUBLIC FACT</span><h3>${esc(g.organization)}</h3>${rs.map(r=>{const href=r.kind==='PHONE'?'tel:'+r.target:r.kind==='EMAIL'?'mailto:'+r.target:r.target;return `<div class="contact-item"><span class="note">${esc(r.label)}</span><a class="source contact-value" href="${esc(href)}" ${r.kind==='WEBSITE'?'target="_blank" rel="noopener noreferrer"':''}>${r.kind==='WEBSITE'?(r.scope==='PROFESSIONAL_PROFILE'||r.scope==='NAMED_PROFESSIONAL'?'Open named professional profile ↗':'Open official company page ↗'):esc(r.value)}</a></div>`;}).join('')}${[...new Set(rs.map(r=>r.purpose))].map(purpose=>`<p>${esc(purpose)}</p>`).join('')}<p class="note">Reviewed ${esc(g.reviewed_at)} · Publication verified; reachability and consent UNKNOWN. Re-review within 90 days.</p><div class="actions"><a class="source" href="${esc(g.source_url)}" target="_blank" rel="noopener noreferrer">Verify contact source ↗</a><button class="source retained-button" data-retained="${esc(g.raw_path)}" data-fingerprint="${esc(g.sha256)}">Inspect retained source</button></div></article>`;
  }).join(''):'<p class="empty">No current verified professional route. Contact evidence is missing or due for re-review; email and phone UNKNOWN.</p>';
}
function generateBrief(){
  if(!selected)return;
  const b=ProjectIntelligence.brief(selected,selected.computed);
  $('brief').innerHTML=`<h4>Advisor Brief · ${esc(displayName(selected))}</h4>`+[['Who',b.who],['What / when',b.happened],['Publicly associated amount',b.amount],['Verified',b.verified],['Inference / uncertainty',b.inferred],['Planned-sale context',b.planned],['Why these triggers help',b.triggerWhy],['Planning themes',b.themes.join(' · ')],['Professional contact routes',b.contacts],['Before outreach',b.diligence.join(' ')],['Next research action',b.next]].map(([key,value])=>`<p><b>${esc(key)}:</b> ${esc(value)}</p>`).join('');
  $('brief').innerHTML+=`<div class="actions"><button class="cta secondary" id="downloadBrief">Export Advisor Brief</button></div><h4>Pilot feedback</h4><p class="note">Does this evidence help you prioritize a legitimate planning conversation? Feedback is saved on this browser; export it to share with Project A.</p><label class="note">Usefulness<select id="feedbackRating" aria-label="Opportunity usefulness"><option>Useful</option><option>Needs evidence</option><option>Not useful</option></select></label><label class="note">What would make this more useful? Avoid private client details.<textarea id="feedbackNote" aria-label="Pilot feedback note" maxlength="1000" rows="3" placeholder="Evidence gaps, relevance or planning themes…"></textarea></label><div class="actions"><button class="cta secondary" id="saveFeedback">Save feedback</button><button class="cta secondary" id="exportFeedback">Export pilot feedback</button></div><p class="note" id="feedbackStatus" role="status"></p>`;
  $('downloadBrief').onclick=()=>downloadFile(`project-a-${selected.id}-advisor-brief.txt`,$('brief').innerText.split('Export Advisor Brief')[0]+'\nEvidence\n'+[...new Set(selected.events.flatMap(e=>[e.source_url,...(e.evidence_sources||[]).map(s=>s.source_url)]))].join('\n')+'\nScoring version: '+selected.computed.version+'\nGenerated: '+new Date().toISOString()+'\nPublic-data research; gross transaction value is not available cash, net worth or investable assets.','text/plain');
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
document.addEventListener('click',event=>{const b=event.target.closest('[data-review-person]');if(b){setRadarPanel('prospects');watchOnly=false;$('search').value='';$('territory').value='all';$('eventType').value='all';$('minimumScore').value='0';$('contactAvailability').value='all';choose(b.dataset.reviewPerson);$('selected').scrollIntoView({behavior:'smooth'});}});
function save(){if(!selected)return; saved.has(selected.id)?saved.delete(selected.id):saved.add(selected.id);try{localStorage.setItem('project-a-watchlist-v1',JSON.stringify([...saved]));}catch{storageOK=false;}render();}
function setCenter(state,placeId){
  cancelZipSearch();
  $('centerState').value=state;
  const places=territoryData.places.filter(p=>p.state===state).sort((a,b)=>a.name.localeCompare(b.name));
  $('centerPlace').innerHTML=places.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  if(places.some(p=>p.id===placeId))$('centerPlace').value=placeId;
  updateCenter();
}
function updateCenter(){
  cancelZipSearch();
  territoryOrigin=territoryIndex.ids.get($('centerPlace').value);
  applyDistances();
}
function applyDistances(){
  for(const p of people){const place=ProjectTerritory.resolve(p.location,territoryIndex);p.location.distance_miles=ProjectTerritory.distance(territoryOrigin,place);if(place){p.location.geo_source=territoryData.source;p.location.geo_class='CALCULATED FROM VERIFIED FACT';}}
}
$('centerState').onchange=()=>{if(!territoryData)return;setCenter($('centerState').value);render();};
$('centerPlace').onchange=()=>{if(!territoryData)return;updateCenter();render();};
function reset(){$('zipCode').value='';$('zipRadius').value='50';$('zipStatus').textContent='Search a U.S. ZIP code with a 1–3,000 mile radius. Only verified records in our current coverage appear.';setRadarPanel('prospects');if(territoryData)setCenter('SC','4513330');watchOnly=false;$('search').value='';$('territory').value='50';$('eventType').value='Planning';$('minimumScore').value='0';$('contactAvailability').value='all';render();}
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-person]');if(button)choose(button.dataset.person,true);
});
for(const id of ['search','territory','eventType','minimumScore','contactAvailability'])$(id).addEventListener(id==='search'?'input':'change',render);
$('allView').onclick=()=>{watchOnly=false;render();};$('watchView').onclick=()=>{watchOnly=true;render();};$('reset').onclick=reset;
$('contactButton').onclick=()=>{$('contacts').scrollIntoView({behavior:'smooth',block:'start'});};
$('briefButton').onclick=generateBrief;$('saveButton').onclick=save;$('backButton').onclick=()=>{setRadarPanel('prospects');$('prospects').scrollIntoView({behavior:'smooth'});};
$('evidenceButton').onclick=()=>{const open=$('evidenceDrawer').hidden;$('evidenceDrawer').hidden=!open;$('evidenceButton').setAttribute('aria-expanded',String(open));$('evidenceButton').textContent=open?'Close evidence details':'Open evidence details';};
document.querySelectorAll('[data-nav]').forEach(button=>button.onclick=()=>{
  document.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('active',b===button));
  let target=button.dataset.nav;
  if(target==='signals')setRadarPanel('signals');else if(['radar','prospects','territories','watchlist'].includes(target))setRadarPanel('prospects');
  if(target==='territories')$('filterDrawer').open=true;
  document.querySelector('.side').classList.remove('nav-open');$('menuToggle').setAttribute('aria-expanded','false');
  if(target==='watchlist'){watchOnly=true;render();target='prospects';}
  if(target==='evidence'&&selected){$('evidenceDrawer').hidden=false;$('evidenceButton').setAttribute('aria-expanded','true');$('evidenceButton').textContent='Close evidence details';}
  $(target)?.scrollIntoView({behavior:'smooth',block:'start'});
});
function setRadarPanel(panel){
  $('radarGrid').dataset.mobilePanel=panel;
  for(const [id,value] of [['prospectPanelButton','prospects'],['signalPanelButton','signals']]){$(id).classList.toggle('on',value===panel);$(id).setAttribute('aria-pressed',String(value===panel));}
}
$('prospectPanelButton').onclick=()=>setRadarPanel('prospects');$('signalPanelButton').onclick=()=>setRadarPanel('signals');
$('menuToggle').onclick=()=>{const open=document.querySelector('.side').classList.toggle('nav-open');$('menuToggle').setAttribute('aria-expanded',String(open));};
const mobileLayout=matchMedia('(max-width:850px)');
$('filterDrawer').open=!mobileLayout.matches;
mobileLayout.addEventListener('change',event=>{$('filterDrawer').open=!event.matches;});
async function load(){
  try{
    const catalogPath=new URLSearchParams(location.search).get('qa')==='missing-catalog'?'missing-catalog.json':'catalog.json';
    const response=await fetch(catalogPath,{cache:'no-cache'});
    if(!response.ok)throw new Error(`Evidence catalog returned HTTP ${response.status}`);
    catalog=await response.json();
    if(!Array.isArray(catalog.records))throw new Error('Evidence catalog has an invalid schema');
    const geographyResponse=await fetch('territories.json',{cache:'no-cache'});if(!geographyResponse.ok)throw new Error('Territory reference unavailable');territoryData=await geographyResponse.json();if(!Array.isArray(territoryData.places)||!territoryData.places.length)throw new Error('Territory reference has an invalid schema');territoryIndex=ProjectTerritory.index(territoryData.places);
    people=catalog.records.map(p=>({...p,computed:ProjectIntelligence.score(p)}));
    $('centerState').innerHTML=[...new Set(territoryData.places.map(p=>p.state))].sort().map(state=>`<option value="${esc(state)}">${esc(state)}</option>`).join('');$('centerState').disabled=false;$('centerPlace').disabled=false;$('zipSearch').disabled=false;setCenter('SC','4513330');
    $('systemStatus').textContent=`Validated public snapshot · ${people.length} people`;
    $('coverage').textContent=`${catalog.validated_filings} Form 4 + ${catalog.transition_filings||0} reviewed 8-K + ${catalog.form144?.validated||0} Form 144 filings · filings since ${catalog.coverage_start} · ${people.filter(p=>p.computed.sales).length} people with sale signals · ${catalog.issuer_count||3} SEC issuers + ${catalog.business_exits?.validated_people||0} business founders`;
    $('feedDate').textContent=`Validated ${new Date(catalog.validated_at).toLocaleString()}. Reviewed snapshot; not a live stream. ${catalog.errors.length+(catalog.transition_errors||[]).length+(catalog.form144?.errors||[]).length+(catalog.reviewed_triggers?.errors||[]).length+(catalog.business_exits?.errors||[]).length} filing(s) withheld after ingestion errors.`;
    try{feedback=ProjectPilot.validate({product:'Project A',feedback},people);}catch{feedback=[];$('pilotStatus').textContent='Saved reviews could not be validated against this catalog. Original browser storage is unchanged; import a valid export to recover reviews.';}
    const linkedId=new URLSearchParams(location.search).get('person');
    if(linkedId){const linked=people.find(p=>p.id===linkedId);if(linked){selected=linked;$('territory').value='all';$('eventType').value='all';}else{$('error').hidden=false;$('error').textContent='The linked prospect is unavailable in this evidence snapshot. Showing the current territory instead.';}}
    render();renderPilot();
    if(linkedId&&selected?.id===linkedId)$('selected').scrollIntoView({block:'start'});
  }catch(error){catalog=null;people=[];selected=null;$('detail').hidden=true;$('error').hidden=false;$('error').textContent=`Could not load evidence: ${error.message}. No opportunities or scores are asserted. Reload to retry.`;$('leads').innerHTML='<p class="empty">Evidence unavailable. No records released.</p>';$('coverage').textContent='Source coverage unavailable';$('systemStatus').textContent='Evidence unavailable';for(const id of ['mCount','mValue','mHigh','mFresh'])$(id).textContent='UNKNOWN';}
}
function cancelZipSearch(){zipRequest++;zipController?.abort();zipController=null;if($('zipSearch'))$('zipSearch').disabled=!catalog;}
async function searchZip(){
  if(!catalog||!territoryIndex)return;
  cancelZipSearch();
  const zip=$('zipCode').value.trim(),radius=Number($('zipRadius').value);
  if(!/^\d{5}$/.test(zip)){ $('zipStatus').textContent='Enter a five-digit U.S. ZIP code, including leading zeros. Previous results are unchanged.';return; }
  if(!Number.isInteger(radius)||radius<1||radius>3000){$('zipStatus').textContent='Enter a whole-mile radius from 1 to 3,000. Previous results are unchanged.';return;}
  const request=++zipRequest,controller=new AbortController();zipController=controller;$('zipSearch').disabled=true;
  $('zipStatus').textContent='Looking up ZIP '+zip+'… Previous results remain until the new area is resolved.';
  const timeout=setTimeout(()=>controller.abort(),10000);
  try{
    const country=/^00[679]/.test(zip)?'pr':/^008/.test(zip)?'vi':zip==='96799'?'as':/^969[123]/.test(zip)?'gu':/^9695/.test(zip)?'mp':'us';
    const response=await fetch('https://api.zippopotam.us/'+country+'/'+zip,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});
    if(response.status===404)throw new Error('ZIP code not found in the postal reference');
    if(!response.ok)throw new Error('ZIP lookup is temporarily unavailable');
    const data=await response.json(),place=data.places?.[0],lat=Number(place?.latitude),lon=Number(place?.longitude);
    if(data['post code']!==zip||!['US','PR','VI','AS','GU','MP'].includes(data['country abbreviation'])||!place||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)throw new Error('ZIP lookup returned invalid coordinates');
    if(request!==zipRequest)return;
    territoryOrigin={name:String(place['place name']),state:country==='us'?String(place['state abbreviation']):country.toUpperCase(),lat,lon,zip};
    applyDistances();
    let option=$('territory').querySelector('[data-custom-radius]');
    if(!option){option=document.createElement('option');option.dataset.customRadius='true';$('territory').appendChild(option);}
    option.value=String(radius);option.textContent=radius+' miles from ZIP '+zip;$('territory').value=String(radius);
    render();
    $('zipStatus').textContent='Searched ZIP '+zip+' within '+radius+' miles. '+rows().length+' matching verified candidates. Zero results means no matching records in our reviewed coverage, not no opportunities in this market. Distances use approximate reference coordinates, not street addresses.';
  }catch(error){if(request===zipRequest)$('zipStatus').textContent=(error.name==='AbortError'?'ZIP lookup timed out. Please retry.':error.message)+'. Previous results are unchanged.';}
  finally{clearTimeout(timeout);if(request===zipRequest){$('zipSearch').disabled=false;zipController=null;}}
}
$('zipSearch').onclick=searchZip;
for(const id of ['zipCode','zipRadius'])$(id).addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();searchZip();}});
load();

let evidenceRequest=0,evidenceReturnFocus=null,evidenceOriginal="",evidenceReading="";
document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-retained]');if(!button)return;
  const request=++evidenceRequest;evidenceReturnFocus=button;
  $('sourceViewer').showModal();$('sourceTitle').textContent='Retained evidence · '+button.dataset.retained;
  $('sourceStatus').textContent='Loading retained source and checking its SHA-256 fingerprint…';
  $('sourceText').value='';$('selectSourceText').disabled=true;$('toggleSourceView').disabled=true;$('sourceViewLabel').textContent='Original source text';
  try{
    const result=await ProjectEvidence.load({path:button.dataset.retained,sha256:button.dataset.fingerprint});
    if(request!==evidenceRequest)return;
    $('sourceStatus').textContent='FINGERPRINT MATCH · Retained bytes match the reviewed evidence ledger. This checks archive integrity, not current website content or a new verification of the underlying assertion.';
    evidenceOriginal=result.text;evidenceReading=result.text;
    if(/<(?:!doctype html|html)[\s>]/i.test(result.text)){
      const archive=document.createElement('template');archive.innerHTML=result.text;
      archive.content.querySelectorAll('script,style,noscript,template,svg,iframe,object,embed,link,meta,img,input,button,nav,header,footer').forEach(node=>node.remove());
      archive.content.querySelectorAll('p,h1,h2,h3,h4,div,li,section,article,br,tr').forEach(node=>node.appendChild(document.createTextNode('\n')));
      evidenceReading=archive.content.textContent.replace(/[ \t]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim();
    }
    $('sourceText').value=evidenceReading;$('sourceText').wrap='soft';$('selectSourceText').disabled=false;$('toggleSourceView').disabled=evidenceReading===evidenceOriginal;
    $('sourceViewLabel').textContent=evidenceReading===evidenceOriginal?'Original source text':'Reading view · extracted from fingerprint-matched archive';$('toggleSourceView').textContent='Show original markup';
  }catch(error){
    if(request!==evidenceRequest)return;
    $('sourceStatus').textContent='Evidence preview unavailable: '+error.message+' Use the official primary-source link to investigate. Unverified archive content is withheld.';
  }
});
function closeSourceViewer(){evidenceRequest++;$('sourceViewer').close();$('sourceText').value='';evidenceReturnFocus?.focus();}
$('closeSourceViewer').onclick=closeSourceViewer;
$('sourceViewer').addEventListener('cancel',event=>{event.preventDefault();closeSourceViewer();});
$('selectSourceText').onclick=()=>{$('sourceText').focus();$('sourceText').select();};

$('toggleSourceView').onclick=()=>{const raw=$('toggleSourceView').textContent==='Show original markup';$('sourceText').value=raw?evidenceOriginal:evidenceReading;$('sourceViewLabel').textContent=raw?'Original source text':'Reading view · extracted from fingerprint-matched archive';$('toggleSourceView').textContent=raw?'Show reading view':'Show original markup';};
