(function(root){
  'use strict';
  const recipient='britonabarrett@gmail.com';
  const cases=['Equity-sale planning research','Executive-transition research','Business-exit research','Firm integration evaluation'];
  function compose(input){
    const limits={name:100,firm:140,email:180,market:120,goal:1000};
    const data={};
    for(const [field,max] of Object.entries(limits)){
      const value=String(input[field]||'').trim();
      if(value.length>max||field!=='goal'&&!value)throw new Error('Complete the required professional details within the field limits.');
      data[field]=value.replace(/[\r\n]+/g,' ');
    }
    if(!/^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(data.email)||/[\r\n]/.test(String(input.email)))throw new Error('Enter a valid work email.');
    if(!cases.includes(input.useCase))throw new Error('Choose an available research use case.');
    const subject='MOCEAN paid-pilot inquiry';
    const body=`Hello Briton,\n\nI would like to discuss a focused MOCEAN paid pilot.\n\nName: ${data.name}\nFirm: ${data.firm}\nWork email: ${data.email}\nTarget market: ${data.market}\nUse case: ${input.useCase}\nSuccess measure / research problem: ${data.goal||'To be discussed'}\n\nPlease confirm current evidence coverage, evaluation scope, delivery method, pricing and commercial terms. I understand this inquiry does not create a subscription or payment obligation.\n`;
    return {recipient,subject,body,mailto:`mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`};
  }
  if(typeof module!=='undefined'&&module.exports){module.exports={compose};return;}
  const $=id=>document.getElementById(id);
  $('pilotRequest').addEventListener('submit',event=>{
    event.preventDefault();
    try{
      const draft=compose({name:$('pilotName').value,firm:$('pilotFirm').value,email:$('pilotEmail').value,market:$('pilotMarket').value,useCase:$('pilotUseCase').value,goal:$('pilotGoal').value});
      $('pilotDraft').value=draft.body;$('pilotEmailLink').href=draft.mailto;$('pilotDraftPanel').hidden=false;
      $('pilotRequestStatus').textContent='Draft prepared. Review it and send from your email app. No request has been submitted.';
    }catch(error){$('pilotRequestStatus').textContent=error.message;$('pilotDraftPanel').hidden=true;}
  });
  fetch('catalog.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('Catalog unavailable');return r.json();}).then(c=>{
    if(!Array.isArray(c.records)||!c.records.length||!Number.isInteger(c.issuer_count))throw new Error('Invalid catalog');
    const routes=c.records.filter(p=>p.contacts?.routes?.some(r=>{const days=(Date.now()-Date.parse(r.reviewed_at))/86400000;return days>=0&&days<=90;})).length;
    $('pilotCoverage').textContent=`${c.records.length} research records · ${c.issuer_count} configured stock-filing issuers · ${routes} records with published business routes.`;
    const states={};for(const p of c.records){const s=p.location?.state;if(s)states[s]=(states[s]||0)+1;}
    for(const [state,count] of Object.entries(states).sort()) {const chip=document.createElement('span');chip.textContent=`${state} · ${count} records`;$('pilotMarkets').appendChild(chip);}
    const health=root.ProjectPriority.health(c);
    $('pilotFreshness').textContent=`SEC discovery: ${health.status}. Last success: ${c.feed_health?.last_success_at||c.validated_at}. Filing/company geography is not personal residence. Coverage counts include monitoring records, not qualified prospects.`;
  }).catch(()=>{$('pilotCoverage').textContent='Current coverage could not be loaded. Open the terminal to check the published evidence before requesting a market-specific pilot.';});
})(typeof window!=='undefined'?window:globalThis);
