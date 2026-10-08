const assert=require('node:assert/strict'),fs=require('node:fs');
const R=require('./research.js'),I=require('./intelligence.js'),T=require('./triggers.js');
const catalog=JSON.parse(fs.readFileSync('fixture-catalog.json'));
const now=new Date('2026-10-08T12:00:00Z');
for(const p of catalog.records){
 const r=R.build(p,I.score(p,now),catalog,now);
 for(const f of r.facts)assert.ok(r.sources.some(s=>s.id===f.source&&s.url===p.events.find(e=>e.id===f.eventId).source_url));
 for(const task of Object.keys(R.tasks)){
  const prompt=R.prompt(r,task);assert.match(prompt,/untrusted data/);assert.match(prompt,/UNKNOWN/);
  assert.match(prompt,/Announcement dates passing do not prove completion/);
  assert.ok(prompt.includes(r.sources[0].url));
 }
 assert.match(R.markdown(r),/transparent rules/);
 assert.ok(r.unknowns.includes('Existing advisor relationship and willingness to engage'));
}
const leaders=catalog.records.filter(p=>p.identity_kind==='REVIEWED_LEADERSHIP_PERSON');
assert.equal(leaders.length,2);
for(const p of leaders){
 const c=I.score(p,now),r=R.build(p,c,catalog,now);
 assert.equal(c.total,0);assert.equal(c.converged,false);assert.ok(r.note);
 assert.ok(r.milestones.every(m=>m.status.includes('completion must be verified')));
 assert.match(I.brief(p,c).verified,/no Form 4 identity/);
 if(p.person_name.startsWith('Shailesh')){
  assert.match(r.verdict,/monitor/);assert.equal(T.actionable(p.events[0]),false);
  assert.equal(c.transitions,0);assert.equal(c.latestTrigger,undefined);
 }else{assert.match(r.verdict,/Career event/);assert.equal(c.transitions,1);}
}
assert.throws(()=>R.prompt({},'invent-wealth'));
console.log('Research packets, citation mapping, no inferred liquidity and announced dates passed for',catalog.records.length,'people');
