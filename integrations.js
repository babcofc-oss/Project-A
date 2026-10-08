'use strict';
(function(root){
  const priority=typeof module==='object'&&module.exports?require('./priority.js'):root.ProjectPriority;
  const limit='Public-data research, not a qualified client. Net proceeds, available funds, planning needs, existing advisor relationship and willingness to engage remain UNKNOWN.';
  function record(person,catalog,now){
    const p=priority.evaluate(person,catalog,now),events=[...new Map(person.events.map(e=>[e.id,e])).values()];
    return {person_id:person.id,person_name:person.person_name,company:person.company,reporting_person_cik:person.person_cik||null,issuer_cik:person.issuer_cik||null,identity_kind:person.identity_kind||(person.person_cik?'SEC_REPORTING_PERSON':'REVIEWED_NAMED_PERSON'),role_as_disclosed:person.role,geography:{city:person.location?.city||null,state:person.location?.state||null,basis:person.location?.kind||person.location?.basis||'UNKNOWN',residence:'UNKNOWN'},research_priority:{label:p.label,hot:p.hot,blocks:p.blocks,matched_combinations:p.pairs,unplanned_recent_gross_sales:p.pairs.length?Math.max(...p.pairs.map(x=>x.gross)):null,amount_class:'CALCULATED FROM VERIFIED FACT',net_proceeds:'UNKNOWN',available_funds:'UNKNOWN',planning_needs:'UNKNOWN'},source_events:events.map(e=>({event_id:e.id,accession:e.accession,date:e.date,filed_date:e.filed_date||null,reviewed_at:e.reviewed_at||null,effective_date:e.effective_date||null,stage:e.stage||null,amount_context:e.amount_context||null,cash_received:e.cash_received||'UNKNOWN',classification:e.classification,trigger_type:e.trigger_type||null,source_class:e.source_class||'FORM4',transaction_code:e.code||null,planned_trade:e.planned===true,reported_gross_value:e.classification==='LIQUIDITY'?e.value:null,value_class:e.value_class||'UNKNOWN',fact:e.fact,status:e.status||null,source_url:e.source_url,retained_path:e.raw_path,sha256:e.sha256,additional_evidence:e.evidence_sources||[]})),limitations:limit,prospect_url:'https://project-a-jet.vercel.app/?person='+encodeURIComponent(person.id)};
  }
  function packet(ids,catalog,now=new Date()){
    if(!Array.isArray(ids)||ids.length>1000||ids.some(id=>typeof id!=='string'))throw new Error('Export requires at most 1,000 saved prospect IDs.');
    const known=new Map(catalog.records.map(p=>[p.id,p])),unique=[...new Set(ids)],available=unique.filter(id=>known.has(id));
    return {product:'Project A',schema:'project-a-research-handoff',schema_version:1,exported_at:now.toISOString(),catalog_version:catalog.version,scoring_version:catalog.scoring_version,evidence_validated_at:catalog.validated_at,feed_health:{...catalog.feed_health,evaluated_freshness:priority.health(catalog,now).status},manual_sources:catalog.feed_health?.manual_review||'Manual source freshness must be reviewed separately',unconnected_categories:catalog.feed_health?.unconnected||[],skipped_unavailable_ids:unique.filter(id=>!known.has(id)),records:available.map(id=>record(known.get(id),catalog,now)),limits:limit+' Manual handoff only; no CRM connection, automated outreach or ongoing sync. Public source availability does not establish unrestricted commercial reuse rights.'};
  }
  function cell(value){
    let s=String(value??'');if(/^[\s\u0000-\u001f]*[=+@-]/.test(s))s="'"+s;
    return '"'+s.replaceAll('"','""')+'"';
  }
  function csv(p){
    const columns=['Person ID','Name as disclosed','Company','Role as disclosed','Reporting person CIK','Issuer CIK','City','State','Geography basis','Research priority','Priority blocks','Recent unplanned matched gross sales USD','Net proceeds','Available funds','Planning needs','Evidence dates','Primary source URLs','Source accessions','Prospect URL','Exported at','Last successful SEC discovery','Feed freshness','Evidence limits'];
    const rows=p.records.map(r=>[r.person_id,r.person_name,r.company,r.role_as_disclosed,r.reporting_person_cik,r.issuer_cik,r.geography.city,r.geography.state,r.geography.basis,r.research_priority.label,r.research_priority.blocks.join(' | '),r.research_priority.unplanned_recent_gross_sales??'UNKNOWN',r.research_priority.net_proceeds,r.research_priority.available_funds,r.research_priority.planning_needs,[...new Set(r.source_events.map(e=>e.date))].join(' | '),[...new Set(r.source_events.flatMap(e=>[e.source_url,...e.additional_evidence.map(a=>a.source_url)]).filter(Boolean))].join(' | '),[...new Set(r.source_events.map(e=>e.accession))].join(' | '),r.prospect_url,p.exported_at,p.feed_health.last_success_at||'UNKNOWN',p.feed_health.evaluated_freshness,r.limitations]);
    return [columns,...rows].map(row=>row.map(cell).join(',')).join('\r\n');
  }
  const api={packet,csv,cell};if(typeof module==='object'&&module.exports)module.exports=api;else root.ProjectIntegrations=api;
})(typeof window==='undefined'?globalThis:window);
