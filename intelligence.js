(function(root){
  'use strict';
  const dollars=n=>'$'+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  function daysAgo(value,asOf=new Date()){
    const days=Math.floor((Date.parse(asOf.toISOString().slice(0,10))-Date.parse(value))/86400000);
    return Number.isFinite(days)&&days>=0?days:null;
  }
  function transitions(person){return person.events.filter(e=>e.classification==='EXECUTIVE_TRANSITION'&&e.source_class==='8K');}
  function score(person,asOf=new Date()){
    const sales=person.events.filter(e=>e.classification==='LIQUIDITY');
    const change=transitions(person);
    const latest=sales.map(e=>e.date).sort().at(-1);
    const latestTrigger=[...sales,...change].map(e=>e.date).sort().at(-1);
    const age=latest?daysAgo(latest,asOf):null;
    const triggerAge=latestTrigger?daysAgo(latestTrigger,asOf):null;
    const total=sales.reduce((n,e)=>n+(e.value||0),0);
    const magnitude=total>=1e7?25:total>=2e6?22:total>=5e5?18:total>=1e5?12:total>0?6:0;
    const recency=triggerAge===null?0:triggerAge<=7?20:triggerAge<=30?17:triggerAge<=90?10:triggerAge<=180?4:0;
    const planned=sales.length>0&&sales.every(e=>e.planned);
    const converged=sales.some(s=>change.some(t=>Math.abs(Date.parse(s.date)-Date.parse(t.date))<=180*86400000&&daysAgo(s.date,asOf)!==null&&daysAgo(t.date,asOf)!==null&&daysAgo(t.date,asOf)<=180));
    const parts=[
      {label:'Event magnitude',points:magnitude,max:25,reason:`Gross disclosed sales: ${dollars(total)}. Transition compensation and unvested equity excluded. Net proceeds UNKNOWN.`},
      {label:'Planning-trigger recency',points:recency,max:20,reason:triggerAge===null?'No verified sale or reviewed executive-transition trigger.':`${triggerAge} days since latest sale / transition announcement (${latestTrigger}). An announcement does not prove completion.`},
      {label:'Evidence quality',points:20,max:20,reason:'Primary SEC disclosures retained with SHA-256 fingerprints.'},
      {label:'Advisor relevance',points:sales.length?20:change.length?16:0,max:20,reason:sales.length?'Potential equity diversification and tax coordination; MODEL INFERENCE.':change.length?'Disclosed executive transition may create compensation / benefit planning needs; MODEL INFERENCE.':'No sale or reviewed transition trigger; monitor only.'},
      {label:'Identity confidence',points:10,max:10,reason:change.length?'Form 4 person / issuer identifiers plus reviewed named 8-K subject. Signatures alone do not establish a person-level event.':'Reporting-person CIK + issuer CIK; no cross-company identity inference.'},
      {label:'Distinct-signal convergence',points:converged?5:0,max:5,reason:converged?'Verified sale + reviewed executive transition within 180 days. Different disclosure classes, same issuer; not independent publishers.': 'No qualifying sale + executive-transition pair. Repeated filings or board membership alone earn no bonus.'},
      {label:'Planned-sale adjustment',points:planned?-8:0,max:8,reason:planned?'All sale events disclose 10b5-1 context; reduce suddenness / intent.':'No all-planned penalty; inspect each event context.'},
      {label:'Non-liquidity suppression',points:sales.length||change.length?0:-10,max:10,reason:sales.length?'Verified S dispositions present.':change.length?'Reviewed transition is a planning trigger, with no liquidity assumed.':'F/A/M and board context do not create ordinary sale liquidity.'}
    ];
    return {value:Math.max(0,Math.min(100,parts.reduce((n,p)=>n+p.points,0))),parts,age,triggerAge,latest,latestTrigger,total,planned,sales:sales.length,transitions:change.length,converged,version:'money-in-motion-v3'};
  }
  function brief(person,computed){
    const sales=person.events.filter(e=>e.classification==='LIQUIDITY'),change=transitions(person);
    const themes=sales.length?['Concentrated equity','Diversification','Tax coordination','Executive compensation']:change.length?['Executive compensation','Benefit coordination','Equity vesting','Tax coordination']:['Equity compensation context','Monitor for an independently verified transition'];
    if(change.length)themes.push('Career / retirement transition');
    return {
      who:`${person.person_name} · ${person.role}, ${person.company} (role as disclosed; current employment must be reconfirmed).`,
      happened:(sales.length?`${sales.length} disclosed sale transactions; latest sale ${computed.latest}.`:'No verified ordinary sale trigger in retained events.')+(change.length?' '+change.map(e=>`${e.date}: ${e.fact} ${e.status}`).join(' '):''),
      amount:(sales.length?`${dollars(computed.total)} gross, calculated from reported shares × prices. Weighted-average prices may be rounded. Net proceeds and available funds UNKNOWN.`:'No ordinary sale proceeds asserted; withholding, awards and exercises excluded.')+(change.length?' '+change.map(e=>e.amount_context).filter(Boolean).join(' '):''),
      verified:'Reporting identity, issuer and Form 4 transaction details from primary SEC filings.'+(change.length?' Reviewed named-person executive transition from retained Form 8-K; status and conditions remain attached.':''),
      inferred:sales.length||change.length?'Equity monetization and/or a disclosed career transition may make planning timely. Planning need, existing advisor relationship and willingness to engage are UNKNOWN.':'No money-in-motion inference warranted from withholding/award/exercise or board context alone.',
      planned:person.events.some(e=>e.planned)?'Planned 10b5-1 context is disclosed. It reduces inferred urgency and does not prove an immediate need.':'No planned-sale assertion is made beyond the retained filings.',
      themes,
      diligence:['Reconfirm identity, current professional role, filing amendments and professional geography.','Review transaction footnotes and whether multiple sale rows overlap.',...(change.length?['Check whether announced transitions completed; confirm severance, consulting, equity vesting, benefit terms and payment conditions.']:[]),'Do not assume total wealth, account balances, net proceeds or availability of funds.','Research lawful professional contact provenance, existing advisor relationship and firm outreach policies.'],
      next:change.length?'Review the transition agreement and subsequent disclosures, distinguish scheduled terms from received cash, and investigate compensation, benefits and equity planning through a legitimate professional channel.':sales.length?'Open primary filings, inspect planned-sale and compensation context, then assess whether a general equity-planning conversation is appropriate through a legitimate professional channel.':'Retain as monitoring context; wait for a separate, verified planning trigger.'
    };
  }
  const api={score,brief,daysAgo,transitions};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ProjectIntelligence=api;
})(typeof window!=='undefined'?window:globalThis);
