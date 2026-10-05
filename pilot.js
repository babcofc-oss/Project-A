'use strict';
(function(root){
  const ratings=['Useful','Needs evidence','Not useful'];
  const reviewerPattern=/^[a-zA-Z0-9_-]{8,80}$/;
  function validate(payload,people,now=Date.now()){
    if(!payload||payload.product!=='Project A'||![1,2].includes(payload.schema_version??1)||!Array.isArray(payload.feedback)||payload.feedback.length>1000)throw new Error('Expected a Project A feedback export with at most 1,000 reviews.');
    const known=new Map(people.map(p=>[p.id,p]));
    return payload.feedback.map((r,i)=>{
      const p=known.get(r?.person_id),reviewer=r?.reviewer_id??'legacy-unknown';
      if(!p||!ratings.includes(r.rating)||typeof r.note!=='string'||r.note.length>1000||!reviewerPattern.test(reviewer)||typeof r.recorded_at!=='string'||!Number.isFinite(Date.parse(r.recorded_at))||Date.parse(r.recorded_at)>now+300000||!Number.isFinite(r.score)||r.score<0||r.score>100||typeof r.scoring_version!=='string'||r.scoring_version.length>80||!Array.isArray(r.source_accessions)||r.source_accessions.length>500||r.source_accessions.some(a=>typeof a!=='string'||!/^[-a-zA-Z0-9_.:]{1,160}$/.test(a)))throw new Error(`Review ${i+1} is invalid or references a person outside this evidence catalog. No reviews imported.`);
      const accessions=new Set(p.events.map(e=>e.accession));
      if(r.source_accessions.some(a=>!accessions.has(a)))throw new Error(`Review ${i+1} references unavailable source evidence. No reviews imported.`);
      return {person_id:p.id,person_name:p.person_name,company:p.company,reviewer_id:reviewer,rating:r.rating,note:r.note,recorded_at:new Date(r.recorded_at).toISOString(),score:r.score,scoring_version:r.scoring_version,source_accessions:[...new Set(r.source_accessions)]};
    });
  }
  function merge(existing,incoming){
    const rows=new Map();
    for(const r of [...existing,...incoming]){
      const key=r.person_id+'|'+(r.reviewer_id||'legacy-unknown');
      if(!rows.has(key)||Date.parse(r.recorded_at)>Date.parse(rows.get(key).recorded_at))rows.set(key,r);
    }
    if(rows.size>1000)throw new Error('Review limit reached. Export existing reviews before importing more.');
    return [...rows.values()].sort((a,b)=>b.recorded_at.localeCompare(a.recorded_at));
  }
  const api={ratings,validate,merge};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.ProjectPilot=api;
})(typeof window==='undefined'?globalThis:window);
