const assert=require('node:assert/strict');
const fs=require('node:fs');
const {score,brief,daysAgo}=require('./intelligence.js');
const records=JSON.parse(fs.readFileSync('catalog.json')).records;
const now=new Date('2026-10-05T12:00:00Z');
for(const person of records){
 const computed=score(person,now);
 assert.equal(computed.value,computed.parts.reduce((n,p)=>n+p.points,0));
 assert.equal(computed.total,person.events.filter(e=>e.classification==='LIQUIDITY').reduce((n,e)=>n+(e.value||0),0));
 assert.equal(computed.parts.find(p=>p.label==='Independent convergence').points,0);
 const older=score(person,new Date('2027-10-05T12:00:00Z'));assert.ok(older.value<=computed.value);
 const b=brief(person,computed);assert.match(b.verified,/SEC/);assert.ok(b.diligence.length>=4);
 if(!computed.sales)assert.ok(computed.value<=20);
}
const li=records.find(p=>Number(p.person_cik)===1436880);
assert.equal(score(li,now).parts.find(p=>p.label==='Planned-sale adjustment').points,-8);
assert.ok(score({...li,events:li.events.map(e=>({...e,planned:false}))},now).value>score(li,now).value);
assert.equal(daysAgo('2026-09-01',now),34);
assert.equal(daysAgo('2027-01-01',now),null);
console.log('Scoring / brief integrity passed for',records.length,'people');
