(function(root){
 'use strict';
 const scopes=new Set(['COMPANY_CHANNEL','ACQUIRER_CHANNEL','NAMED_PROFESSIONAL','PROFESSIONAL_PROFILE']);
 function safeHttps(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}}
 function current(r,asOf=new Date()){
  if(!r||!/^\d{4}-\d{2}-\d{2}$/.test(r.reviewed_at||''))return false;
  const age=Math.floor((Date.parse(asOf.toISOString().slice(0,10))-Date.parse(r.reviewed_at))/86400000);
  return age>=0&&age<=90&&r.classification==='VERIFIED PUBLIC FACT'&&scopes.has(r.scope)&&safeHttps(r.source_url)&&/^contact-source-[a-z0-9-]+\.txt$/.test(r.raw_path||'')&&((r.kind==='WEBSITE'&&r.target===r.source_url)||(r.kind==='PHONE'&&/^\+1\d{10}$/.test(r.target))||(r.kind==='EMAIL'&&/^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(r.target)))&&(!['NAMED_PROFESSIONAL','PROFESSIONAL_PROFILE'].includes(r.scope)||typeof r.person_id==='string');
 }
 function routes(person,asOf=new Date()){
  return (person.contacts?.routes||[]).filter(r=>current(r,asOf)&&(!r.person_id||r.person_id===person.id)).sort((a,b)=>Number(['NAMED_PROFESSIONAL','PROFESSIONAL_PROFILE'].includes(b.scope))-Number(['NAMED_PROFESSIONAL','PROFESSIONAL_PROFILE'].includes(a.scope)));
 }
 function status(person,asOf=new Date()){
  const rs=routes(person,asOf);
  return rs.some(r=>r.scope==='NAMED_PROFESSIONAL'&&['PHONE','EMAIL'].includes(r.kind))?'named':rs.some(r=>r.scope==='PROFESSIONAL_PROFILE')?'profile':rs.length?'company':'unknown';
 }
 function matches(person,filter,asOf=new Date()){return filter==='all'||status(person,asOf)===filter;}
 function brief(person,asOf=new Date()){
  const rs=routes(person,asOf);
  return (rs.length?rs.map(r=>`${r.organization} — ${r.label}: ${r.value}. ${r.scope}. ${r.purpose} Reviewed ${r.reviewed_at}; source ${r.source_url}.`).join(' '):'No current verified professional contact evidence.')+' Publication is verified; deliverability, reachability and consent UNKNOWN. Company channels and biographies do not establish direct person contact. No private email or phone is asserted.';
 }
 const api={current,routes,status,matches,brief};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ProjectContacts=api;
})(typeof window!=='undefined'?window:globalThis);
