(function(root){
  'use strict';
  const triggers=typeof module!=='undefined'&&module.exports?require('./triggers.js'):root.ProjectTriggers;
  const dollars=n=>'$'+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  function daysAgo(value,asOf=new Date()){
    const days=Math.floor((Date.parse(asOf.toISOString().slice(0,10))-Date.parse(value))/86400000);
    return Number.isFinite(days)&&days>=0?days:null;
  }
  function transitions(person){return person.events.filter(e=>e.classification==='EXECUTIVE_TRANSITION'&&e.source_class==='8K');}
  function score(person,asOf=new Date()){
    const privateIdentity=person.identity_kind==='REVIEWED_BUSINESS_PERSON';
    const sales=person.events.filter(e=>e.classification==='LIQUIDITY');
    const change=transitions(person);
    const other=person.events.filter(e=>e.reviewed_trigger&&triggers.actionable(e));
    const latest=sales.map(e=>e.date).sort().at(-1);
    const latestTrigger=[...sales,...change,...other].map(e=>e.date).sort().at(-1);
    const age=latest?daysAgo(latest,asOf):null;
    const triggerAge=latestTrigger?daysAgo(latestTrigger,asOf):null;
    const total=sales.reduce((n,e)=>n+(e.value||0),0);
    const magnitude=total>=1e7?25:total>=2e6?22:total>=5e5?18:total>=1e5?12:total>0?6:0;
    const recency=triggerAge===null?0:triggerAge<=7?20:triggerAge<=30?17:triggerAge<=90?10:triggerAge<=180?4:0;
    const planned=sales.length>0&&sales.every(e=>e.planned);
    const converged=sales.some(s=>change.some(t=>Math.abs(Date.parse(s.date)-Date.parse(t.date))<=180*86400000&&daysAgo(s.date,asOf)!==null&&daysAgo(t.date,asOf)!==null&&daysAgo(t.date,asOf)<=180));
    const parts=[
      {label:'Event magnitude',points:magnitude,max:25,reason:`Gross disclosed sales: ${dollars(total)}. Proposed sales, deal / estate values, compensation and unvested equity excluded. Net proceeds UNKNOWN.`},
      {label:'Planning-trigger recency',points:recency,max:20,reason:triggerAge===null?'No verified completed-sale / actionable reviewed planning trigger.':`${triggerAge} days since latest actionable planning disclosure (${latestTrigger}). An announcement does not prove completion.`},
      {label:'Evidence quality',points:privateIdentity?18:20,max:20,reason:privateIdentity?'Primary company / investor announcements retained with SHA-256 fingerprints; reported completion, no audited individual consideration.':'Primary disclosures retained with SHA-256 fingerprints.'},
      {label:'Advisor relevance',points:sales.length?20:change.length||other.length?16:0,max:20,reason:sales.length?'Potential equity diversification and tax coordination; MODEL INFERENCE.':other.length?'Reviewed completed event / public award may create planning needs; MODEL INFERENCE.':change.length?'Disclosed executive transition may create compensation / benefit planning needs; MODEL INFERENCE.':'No sale or reviewed transition trigger; monitor only.'},
      {label:'Identity confidence',points:privateIdentity?8:10,max:10,reason:privateIdentity?'Named founder + company + primary authority; no SEC person identifier or cross-company identity resolution. Current stake UNKNOWN.':change.length?'Form 4 person / issuer identifiers plus reviewed named 8-K subject. Signatures alone do not establish a person-level event.':'Reporting-person CIK + issuer CIK; no cross-company identity inference.'},
      {label:'Distinct-signal convergence',points:converged?5:0,max:5,reason:converged?'Verified sale + reviewed executive transition within 180 days. Different disclosure classes, same issuer; not independent publishers.': 'No qualifying sale + executive-transition pair. Repeated filings or board membership alone earn no bonus.'},
      {label:'Planned-sale adjustment',points:planned?-8:0,max:8,reason:planned?'All sale events disclose 10b5-1 context; reduce suddenness / intent.':'No all-planned penalty; inspect each event context.'},
      {label:'Non-liquidity suppression',points:sales.length||change.length||other.length?0:-10,max:10,reason:sales.length?'Verified S dispositions present.':other.length?'Reviewed event is a planning trigger; no cash received assumed.':change.length?'Reviewed transition is a planning trigger, with no liquidity assumed.':'F/A/M and board context do not create ordinary sale liquidity.'}
    ];
    return {value:Math.max(0,Math.min(100,parts.reduce((n,p)=>n+p.points,0))),parts,age,triggerAge,latest,latestTrigger,total,planned,sales:sales.length,transitions:change.length,converged,other:other.length,version:'money-in-motion-v5'};
  }
  function brief(person,computed){
    const privateIdentity=person.identity_kind==='REVIEWED_BUSINESS_PERSON';
    const sales=person.events.filter(e=>e.classification==='LIQUIDITY'),change=transitions(person);
    const themes=sales.length?['Concentrated equity','Diversification','Tax coordination','Executive compensation']:change.length?['Executive compensation','Benefit coordination','Equity vesting','Tax coordination']:person.events.some(e=>e.reviewed_trigger&&triggers.actionable(e))?[]:['Equity compensation context','Monitor for an independently verified transition'];
    if(change.length)themes.push('Career / retirement transition');
    const definitions=triggers.forPerson(person),context=person.events.filter(e=>e.source_class==='FORM144'||e.reviewed_trigger);
    themes.push(...definitions.flatMap(d=>d.themes));
    const proposed=context.filter(e=>e.source_class==='FORM144');
    return {
      triggerWhy:definitions.map(d=>`${d.label}: ${d.why} Evidence limit: ${d.limit}`).join(' ')||'No verified money-in-motion trigger; monitoring only.',
      who:`${person.person_name} · ${person.role}, ${person.company} (role as disclosed; current employment must be reconfirmed).`,
      happened:context.map(e=>`${e.date}: ${e.fact} ${e.status}`).join(' ')+(context.length?' ':'')+(sales.length?`${sales.length} disclosed sale transactions; latest sale ${computed.latest}.`:'No verified ordinary sale trigger in retained events.')+(change.length?' '+change.map(e=>`${e.date}: ${e.fact} ${e.status}`).join(' '):''),
      amount:context.map(e=>e.amount_context).filter(Boolean).join(' ')+(context.length?' ':'')+(sales.length?`${dollars(computed.total)} gross, calculated from reported shares × prices. Weighted-average prices may be rounded. Net proceeds and available funds UNKNOWN.`:'No ordinary sale proceeds asserted; withholding, awards and exercises excluded.')+(change.length?' '+change.map(e=>e.amount_context).filter(Boolean).join(' '):''),
      verified:(proposed.length?'Form 144 does not verify execution. ':'')+(privateIdentity?'Primary company / investor announcements identify the named founder and report the company acquisition completed. Individual ownership and payment are not established.':'Reporting identity, issuer and Form 4 transaction details from primary SEC filings.')+(change.length?' Reviewed named-person executive transition from retained Form 8-K; status and conditions remain attached.':''),
      inferred:sales.length||change.length||context.some(triggers.actionable)?(privateIdentity?'A founder’s business transition may create diversification, tax, succession and estate-planning decisions. This is MODEL INFERENCE; individual financial impact, planning need and advisor relationship UNKNOWN.':'Equity monetization and/or a disclosed career transition may make planning timely. Planning need, existing advisor relationship and willingness to engage are UNKNOWN.'):'No money-in-motion inference warranted from withholding/award/exercise or board context alone.',
      planned:person.events.some(e=>e.planned)?'Planned 10b5-1 context is disclosed. It reduces inferred urgency and does not prove an immediate need.':'No planned-sale assertion is made beyond the retained filings.',
      themes:[...new Set(themes)],
      diligence:['Reconfirm identity, current professional role, filing amendments and professional geography.',privateIdentity?'Verify ownership at closing, consideration structure, retained equity, earn-outs, exact close date and current role before inferring personal monetization.':'Review transaction footnotes and whether multiple sale rows overlap.',...(proposed.length?['Match any Form 144 proposal to later Form 4 evidence; do not double count proposed market value or infer execution.']:[]),...(change.length?['Check whether announced transitions completed; confirm severance, consulting, equity vesting, benefit terms and payment conditions.']:[]),'Do not assume total wealth, account balances, net proceeds or availability of funds.','Research lawful professional contact provenance, existing advisor relationship and firm outreach policies.'],
      next:privateIdentity?'Verify the founder’s ownership at closing and whether consideration was paid, rolled over or contingent. Research diversification, tax, succession and estate themes through a legitimate professional channel; founder status does not prove liquidity.':context.some(e=>e.reviewed_trigger&&triggers.actionable(e))?'Review named ownership / beneficiary evidence and completion or distribution status; assess the relevant planning themes without assuming cash received.':change.length?'Review the transition agreement and subsequent disclosures, distinguish scheduled terms from received cash, and investigate compensation, benefits and equity planning through a legitimate professional channel.':sales.length?'Open primary filings, inspect planned-sale and compensation context, then assess whether a general equity-planning conversation is appropriate through a legitimate professional channel.':proposed.length?'Monitor subsequent Form 4 filings for execution. A proposed sale alone is not an outreach or liquidity trigger.':'Retain as monitoring context; wait for a separate, verified planning trigger.'
    };
  }
  const api={score,brief,daysAgo,transitions};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ProjectIntelligence=api;
})(typeof window!=='undefined'?window:globalThis);
