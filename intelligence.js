(function(root){
  'use strict';
  function daysAgo(value, asOf=new Date()) {
    const days=Math.floor((Date.parse(asOf.toISOString().slice(0,10))-Date.parse(value))/86400000);
    return Number.isFinite(days)&&days>=0?days:null;
  }
  function score(person, asOf=new Date()) {
    const sales=person.events.filter(e=>e.classification==='LIQUIDITY');
    const latest=sales.map(e=>e.date).sort().at(-1);
    const age=latest?daysAgo(latest,asOf):null;
    const total=sales.reduce((n,e)=>n+(e.value||0),0);
    const magnitude=total>=1e7?25:total>=2e6?22:total>=5e5?18:total>=1e5?12:total>0?6:0;
    const recency=age===null?0:age<=7?20:age<=30?17:age<=90?10:age<=180?4:0;
    const planned=sales.length>0&&sales.every(e=>e.planned);
    const parts=[
      {label:'Event magnitude',points:magnitude,max:25,reason:`Gross disclosed sales: $${total.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}. Net proceeds UNKNOWN.`},
      {label:'Sale recency',points:recency,max:20,reason:age===null?'No verified sale event.':`${age} days since latest sale (${latest}).`},
      {label:'Evidence quality',points:20,max:20,reason:'Parsed primary SEC XML retained with SHA-256 fingerprints.'},
      {label:'Advisor relevance',points:sales.length?20:0,max:20,reason:sales.length?'Potential equity diversification and tax coordination; MODEL INFERENCE.':'No sale trigger; monitor only.'},
      {label:'Identity confidence',points:10,max:10,reason:'Reporting-person CIK + issuer CIK; no cross-company identity inference.'},
      {label:'Independent convergence',points:0,max:5,reason:'Single disclosure class (Form 4). Repeated filings are not independent corroboration.'},
      {label:'Planned-sale adjustment',points:planned?-8:0,max:8,reason:planned?'All sale events disclose 10b5-1 context; reduce suddenness / intent.':'No all-planned penalty; inspect each event context.'},
      {label:'Non-liquidity suppression',points:sales.length?0:-10,max:10,reason:sales.length?'Verified S dispositions present.':'F/A/M and other context do not create ordinary sale liquidity.'}
    ];
    return {value:Math.max(0,Math.min(100,parts.reduce((n,p)=>n+p.points,0))),parts,age,latest,total,planned,sales:sales.length,version:'money-in-motion-v2'};
  }
  function brief(person, computed) {
    const sales=person.events.filter(e=>e.classification==='LIQUIDITY');
    const themes=sales.length?['Concentrated equity','Diversification','Tax coordination','Executive compensation']:['Equity compensation context','Monitor for an independently verified transition'];
    return {
      who:`${person.person_name} · ${person.role}, ${person.company} (role as disclosed; current employment must be reconfirmed).`,
      happened:sales.length?`${sales.length} disclosed sale transactions within ${person.events.length} retained events; latest sale ${computed.latest}.`:'No verified ordinary sale trigger in retained events.',
      amount:sales.length?`$${computed.total.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})} gross, calculated from reported shares × prices. Weighted-average prices may be rounded. Net proceeds and available funds UNKNOWN.`:'No ordinary sale proceeds asserted; withholding, awards and exercises excluded.',
      verified:'Reporting identity, issuer, transaction dates, codes, share quantities and disclosed prices from primary SEC filings.',
      inferred:sales.length?'Equity monetization may make diversification and tax coordination timely. Planning need, existing advisor relationship and willingness to engage are UNKNOWN.':'No money-in-motion inference warranted from withholding/award/exercise alone.',
      planned:person.events.some(e=>e.planned)?'Planned 10b5-1 context is disclosed. It reduces inferred urgency and does not prove an immediate need.':'No planned-sale assertion is made beyond the retained filings.',
      themes,
      diligence:['Reconfirm identity, current professional role, filing amendments and professional geography.','Review transaction footnotes and whether multiple sale rows overlap.','Do not assume total wealth, account balances, net proceeds or availability of funds.','Research lawful professional contact provenance, existing advisor relationship and firm outreach policies.'],
      next:sales.length?'Open primary filings, inspect planned-sale and compensation context, then assess whether a general equity-planning conversation is appropriate through a legitimate professional channel.':'Retain as a classification audit example; wait for a separate, verified planning trigger.'
    };
  }
  const api={score,brief,daysAgo};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.ProjectIntelligence=api;
})(typeof window!=='undefined'?window:globalThis);
