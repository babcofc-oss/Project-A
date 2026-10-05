const assert=require('node:assert/strict');
const fs=require('node:fs');
const {score,brief,daysAgo}=require('./intelligence.js');
const records=JSON.parse(fs.readFileSync('catalog.json')).records;
const now=new Date('2026-10-05T12:00:00Z');
for(const person of records){
 const computed=score(person,now);
 assert.equal(computed.value,computed.parts.reduce((n,p)=>n+p.points,0));
 assert.equal(computed.total,person.events.filter(e=>e.classification==='LIQUIDITY').reduce((n,e)=>n+(e.value||0),0));
 assert.equal(computed.parts.find(p=>p.label==='Distinct-signal convergence').points,computed.converged?5:0);
 const older=score(person,new Date('2027-10-05T12:00:00Z'));assert.ok(older.value<=computed.value);
 const b=brief(person,computed);assert.match(b.verified,person.identity_kind==='REVIEWED_BUSINESS_PERSON'?/Primary company/:/SEC/);assert.ok(b.diligence.length>=4);
 if(!computed.sales&&!computed.transitions&&!computed.other)assert.ok(computed.value<=20);
}
const li=records.find(p=>Number(p.person_cik)===1436880);
assert.equal(score(li,now).parts.find(p=>p.label==='Planned-sale adjustment').points,-8);
assert.ok(score({...li,events:li.events.map(e=>({...e,planned:false}))},now).value>score(li,now).value);
assert.equal(daysAgo('2026-09-01',now),34);
assert.equal(daysAgo('2027-01-01',now),null);
console.log('Scoring / brief integrity passed for',records.length,'people');

const graves=records.find(p=>Number(p.person_cik)===1251036);
assert.equal(score(graves,now).converged,true);
assert.equal(score(graves,now).total,528065.3);
assert.match(brief(graves,score(graves,now)).happened,/conditional/i);
const withholdingOnly={...graves,events:graves.events.filter(e=>e.classification!=='LIQUIDITY')};
assert.equal(score(withholdingOnly,now).converged,false);
const carande=records.find(p=>Number(p.person_cik)===2146558);
assert.equal(score(carande,now).transitions,0);
assert.equal(score(carande,now).converged,false);
const cotterman=records.find(p=>Number(p.person_cik)===2142185);
assert.equal(score(cotterman,now).total,0);
assert.equal(score(cotterman,now).transitions,1);
assert.match(brief(cotterman,score(cotterman,now)).amount,/40,000/);
console.log('Transition conditions, convergence and excluded compensation passed');

for(const p of records.filter(p=>p.identity_kind==='REVIEWED_BUSINESS_PERSON')){
 const c=score(p,now),b=brief(p,c);
 assert.equal(c.total,0);assert.equal(c.converged,false);assert.equal(c.latest,undefined);
 assert.equal(c.parts.find(x=>x.label==='Event magnitude').points,0);
 assert.equal(c.parts.find(x=>x.label==='Identity confidence').points,8);
 assert.ok(c.value>20);assert.match(b.amount,/individual proceeds.*not disclosed/);
 assert.match(b.inferred,/MODEL INFERENCE/);assert.ok(!b.verified.includes('Form 4'));
 assert.ok(!b.themes.includes('Monitor for an independently verified transition'));
}
console.log('Business founders: identity limits, unknown proceeds and planning briefs passed');
