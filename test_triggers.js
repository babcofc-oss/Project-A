const assert=require('node:assert/strict'),fs=require('node:fs');
const T=require('./triggers.js'),I=require('./intelligence.js');
const people=JSON.parse(fs.readFileSync('catalog.json')).records;
assert.equal(T.definitions.length,9);
for(const d of T.definitions){assert.ok(d.why&&d.limit&&d.sources&&d.themes.length);}
const now=new Date('2026-10-05T12:00:00Z');
let notices=0;
for(const p of people){
 const proposals=p.events.filter(e=>e.source_class==='FORM144');notices+=proposals.length;
 if(!proposals.length)continue;
 const before=I.score({...p,events:p.events.filter(e=>e.source_class!=='FORM144')},now),after=I.score(p,now);
 assert.equal(before.total,after.total);assert.equal(before.value,after.value);assert.equal(before.converged,after.converged);assert.equal(before.latestTrigger,after.latestTrigger);
 for(const e of proposals){assert.equal(e.value,null);assert.equal(T.actionable(e),false);assert.match(e.amount_context,/not completed-sale/);}
 assert.match(I.brief(p,after).triggerWhy,/Proposed stock sale/);
 assert.match(I.brief(p,after).amount,/not completed-sale proceeds/);
}
assert.ok(notices>0);
for(const [type,stage,result] of [['BUSINESS_EXIT','ANNOUNCED',false],['BUSINESS_EXIT','COMPLETED',true],['PUBLIC_OFFERING','REGISTERED',false],['ESTATE_DISTRIBUTION','BENEFICIARY_IDENTIFIED',false],['ESTATE_DISTRIBUTION','DISTRIBUTION_DOCUMENTED',true],['OWNERSHIP_CHANGE','DISCLOSED',false]]){
 assert.equal(T.actionable({reviewed_trigger:true,trigger_type:type,stage}),result);
 assert.equal(T.actionable({trigger_type:type,stage}),false);
}
console.log('Trigger stages, explanations and no-double-count checks passed:',notices,'notices');
