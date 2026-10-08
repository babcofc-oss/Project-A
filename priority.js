'use strict';
(function(root){
  const age=(date,now)=>(now-new Date(date))/86400000;
  function health(catalog,now=new Date()){
    const h=catalog.feed_health;
    const hours=h?age(h.last_success_at,now)*24:Infinity;
    return {current:!!h&&h.status==='OK'&&hours>=0&&hours<=48,
      status:!h?'UNMONITORED':h.status==='FAILED'?'FAILED':hours<0||!Number.isFinite(hours)?'UNKNOWN':hours>48?'STALE':'CURRENT',hours};
  }
  function evaluate(person,catalog,now=new Date()){
    const events=person.events||[], pairs=[],blocks=[];
    const recent=e=>age(e.date,now)>=0&&age(e.date,now)<=30;
    const sales=events.filter(e=>e.classification==='LIQUIDITY'&&e.code==='S'&&e.direction==='D'&&recent(e)&&Number.isFinite(e.value)&&e.value>0);
    const gross=sales.reduce((n,e)=>n+e.value,0);
    const triggers=events.filter(e=>e.source_class==='8K'&&['EXECUTIVE_TRANSITION','EXECUTIVE_APPOINTMENT','BOARD_APPOINTMENT','BOARD_DEPARTURE'].includes(e.trigger_type||e.classification)&&age(e.date,now)>=0&&age(e.date,now)<=90);
    for(const trigger of triggers){
      const qualifying=sales.filter(s=>s.accession!==trigger.accession&&Math.abs(age(s.date,now)-age(trigger.date,now))<=90&&!s.planned);
      if(qualifying.length&&qualifying.reduce((n,e)=>n+e.value,0)>=100000)pairs.push({rule:'SALE_PLUS_LEADERSHIP',label:'Recent completed stock sale + reviewed '+(trigger.trigger_type||trigger.classification).toLowerCase().replaceAll('_',' '),
        eventIds:[trigger.id,...qualifying.map(e=>e.id)],accessions:[...new Set([trigger.accession,...qualifying.map(e=>e.accession)])],gross:qualifying.reduce((n,e)=>n+e.value,0),
        reason:'Same retained person and issuer; ≥$100,000 unplanned gross sale value in 30 days and a leadership disclosure within 90 days. Planning relevance is an inference.'});
    }
    if(!health(catalog,now).current)blocks.push('SEC refresh is failed, stale or unmonitored');
    if(!person.person_cik||!person.issuer_cik)blocks.push('Exact reporting-person CIK + issuer identity required');
    if((catalog.amendment_review||[]).some(e=>String(Number(e.issuer_cik))===String(Number(person.issuer_cik))))blocks.push('Issuer has unreconciled Form 4 amendments');
    if((catalog.transition_errors||[]).length||(catalog.leadership?.errors||[]).length)blocks.push('Leadership validation has unresolved errors');
    if(sales.length&&sales.every(e=>e.planned))blocks.push('All recent sales disclose planned-trade context');
    const hot=!!pairs.length&&!blocks.length;
    return {hot,pairs,blocks,gross,label:hot?'HOT RESEARCH PRIORITY':pairs.length?'COMBINATION — VERIFY FIRST':'NO QUALIFYING COMBINATION',
      limit:'Research priority, not a qualified client. Net proceeds, available funds, planning needs and willingness to engage remain UNKNOWN. Proposed sales and repeated rows do not count as distinct triggers.'};
  }
  const api={health,evaluate};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ProjectPriority=api;
})(typeof window!=='undefined'?window:globalThis);
