const assert=require('node:assert/strict'),U=require('./updates');
const c={validated_at:'2026-10-29',records:[{id:'p',events:[{id:'old',sha256:'original',date:'2026-01-01',classification:'LIQUIDITY',value:10}]}]};
assert.equal(U.diff(c,null).baseline,false);
const baseline=U.snapshot(c,new Date('2026-10-29T10:00Z'));
assert.equal(U.diff(c,baseline).people.length,0);
const updated=structuredClone(c);updated.validated_at='2026-10-30';updated.records[0].events[0].value=12;
updated.records[0].events.push({id:'new-old-filing',sha256:'new',date:'2026-01-02',classification:'PROPOSED_SALE',value:null});
let d=U.diff(updated,baseline);assert.equal(d.new_events,1);assert.equal(d.changed_events,1);assert.equal(d.people.length,1);assert.equal(d.people[0].events[1].date,'2026-01-02');
// A newly observed old filing is a catalog change, not a claim of a recent sale.
assert.equal(d.people[0].events[1].classification,'PROPOSED_SALE');
assert.equal(U.diff(updated,U.snapshot(updated)).people.length,0);
assert.equal(U.diff({...c,records:[]},baseline).removed_events,1);
assert.throws(()=>U.validate({...baseline,events:[baseline.events[0],baseline.events[0]]}));
assert.throws(()=>U.validate({...baseline,events:[['p','event',{}]]}));
const second=structuredClone(c);second.records[0].id='different-person';d=U.diff(second,baseline);assert.equal(d.new_events,1);assert.equal(d.removed_events,1);
const reordered=structuredClone(updated);reordered.records[0].events.reverse();assert.equal(U.diff(reordered,U.snapshot(updated)).people.length,0);
console.log('Evidence review baseline: exact person/event identity, changed values, old filing dates, removals, malformed imports and repeat review passed.');
