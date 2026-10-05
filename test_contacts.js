const assert=require('node:assert/strict');const c=require('./catalog.json');const api=require('./contacts.js');const intel=require('./intelligence.js');const now=new Date('2026-10-05T12:00:00Z');const later=new Date('2027-01-05T12:00:00Z');
const find=id=>c.records.find(p=>p.id===id);const seaver=find('person-1243370-issuer-1090009'),gregoire=find('person-1601818-issuer-1280058');
assert.equal(api.status(seaver,now),'named');assert.equal(api.status(gregoire,now),'profile');
assert.equal(c.records.filter(p=>api.matches(p,'named',now)).length,1);assert.equal(c.records.filter(p=>api.matches(p,'profile',now)).length,4);assert.equal(c.records.filter(p=>api.matches(p,'company',now)).length,65);
assert.equal(api.status(seaver,later),'unknown');assert.equal(api.routes(seaver,later).length,0);assert(!api.brief(seaver,later).includes('aseaver@'));
for(const p of c.records){const detached=structuredClone(p);delete detached.contacts;assert.deepEqual(intel.score(p,now),intel.score(detached,now));}
const copy=structuredClone(seaver);copy.id='wrong-person';assert(!api.routes(copy,now).some(r=>r.scope==='NAMED_PROFESSIONAL'));
for(const patch of [{reviewed_at:'2026-10-06'},{source_url:'javascript:alert(1)'},{raw_path:'../secret.txt'},{scope:'DIRECT_PERSON'},{kind:'EMAIL',target:'a@example.com?subject=oops'}]){const r={...api.routes(seaver,now)[0],...patch};assert.equal(api.current(r,now),false);}
assert(api.brief(seaver,now).includes('aseaver@southernfirst.com'));assert(!api.brief(gregoire,now).includes('aseaver@'));
console.log('Contact availability filters, person binding, expiry, unsafe links and unchanged financial scoring passed');
