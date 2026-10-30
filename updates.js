(function(root){
  'use strict';
  const PRODUCT='mocean-evidence-review',MAX_EVENTS=10000;
  function signature(e){return JSON.stringify([e.sha256,e.date,e.filed_date,e.classification,e.stage,e.code,e.direction,e.shares,e.price,e.value,e.planned]);}
  function snapshot(catalog,at=new Date()){
    if(!Array.isArray(catalog.records))throw new Error('Invalid catalog');
    const events=catalog.records.flatMap(p=>p.events.map(e=>[p.id,e.id,signature(e)]));
    if(events.length>MAX_EVENTS)throw new Error('Evidence baseline too large');
    return {product:PRODUCT,schema_version:1,reviewed_at:at.toISOString(),catalog_validated_at:catalog.validated_at,events};
  }
  function validate(value){
    if(!value||value.product!==PRODUCT||value.schema_version!==1||!Number.isFinite(Date.parse(value.reviewed_at))||!Array.isArray(value.events)||value.events.length>MAX_EVENTS)throw new Error('Invalid review baseline');
    const keys=new Set();
    for(const row of value.events){
      if(!Array.isArray(row)||row.length!==3||row.some(x=>typeof x!=='string'||x.length>2000))throw new Error('Invalid baseline event');
      const key=JSON.stringify(row.slice(0,2));if(keys.has(key))throw new Error('Duplicate baseline event');keys.add(key);
    }
    return value;
  }
  function diff(catalog,baseline){
    if(!baseline)return {baseline:false,people:[],new_events:0,changed_events:0,removed_events:0};
    validate(baseline);
    const before=new Map(baseline.events.map(r=>[JSON.stringify(r.slice(0,2)),r[2]]));
    const result={baseline:true,reviewed_at:baseline.reviewed_at,people:[],new_events:0,changed_events:0,removed_events:0};
    for(const p of catalog.records){
      const events=[];
      for(const e of p.events){
        const key=JSON.stringify([p.id,e.id]),old=before.get(key),kind=old===undefined?'new':old!==signature(e)?'changed':null;
        before.delete(key);
        if(kind){events.push({id:e.id,kind,date:e.date,classification:e.classification});result[kind+'_events']++;}
      }
      if(events.length)result.people.push({person_id:p.id,events});
    }
    result.removed_events=before.size;
    return result;
  }
  const api={snapshot,validate,diff};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MoceanUpdates=api;
})(typeof window!=='undefined'?window:globalThis);
