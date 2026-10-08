const assert=require('node:assert/strict'),fs=require('node:fs'),T=require('./territory.js');
const data=JSON.parse(fs.readFileSync('territories.json')),lookup=T.index(data.places);
const find=(state,city)=>T.resolve({state,city},lookup);
const charleston=find('SC','CHARLESTON'),north=find('SC','NORTH CHARLESTON'),cincinnati=find('OH','CINCINNATI'),philadelphia=find('PA','PHILADELPHIA');
assert.equal(new Set(data.places.map(p=>p.state)).size,52);assert.equal(T.distance(charleston,charleston),0);assert(T.distance(charleston,north)>7&&T.distance(charleston,north)<10);assert(T.distance(cincinnati,philadelphia)>400);assert.equal(T.distance(cincinnati,philadelphia),T.distance(philadelphia,cincinnati));assert.equal(find('OH','UNKNOWN QA CITY'),null);assert.equal(T.distance(charleston,null),null);
assert.equal(T.resolve({state:'OH',city:'CINCINNATI',place_geoid:charleston.id},lookup).id,cincinnati.id);
const ambiguous=T.index([{id:'a',state:'QA',name:'Same city',lat:1,lon:2},{id:'b',state:'QA',name:'Same town',lat:2,lon:3}]);assert.equal(T.resolve({state:'QA',city:'SAME'},ambiguous),null);
console.log('National territory checks passed: 52 state/territory codes, known distances, cross-state resolution, unknown and ambiguous city exclusion.');
// Exercise the entire national reference and representative pilot markets.
for(const place of data.places){assert(Number.isFinite(place.lat)&&Number.isFinite(place.lon));assert.equal(T.distance(place,place),0);assert.equal(T.resolve({state:place.state,place_geoid:place.id},lookup).id,place.id);}
for(const [state,city] of [['NY','NEW YORK'],['CA','LOS ANGELES'],['TX','DALLAS'],['WA','SEATTLE'],['FL','MIAMI'],['AK','ANCHORAGE'],['HI','HONOLULU'],['PR','SAN JUAN']])assert.ok(find(state,city),`${city} resolves`);
assert.equal(T.distance({lat:NaN,lon:1},charleston),null);assert.equal(T.distance({lat:91,lon:1},charleston),null);
assert(T.distance({lat:0,lon:179},{lat:0,lon:-179})<140);assert(T.distance({lat:0,lon:0},{lat:0,lon:180})>12000);
const c=JSON.parse(fs.readFileSync('catalog.json')),triggers=require('./triggers.js');
const sc=T.coverage(c.records,charleston,'SC',lookup,triggers.actionable),oh=T.coverage(c.records,cincinnati,'SC',lookup,triggers.actionable),ca=T.coverage(c.records,find('CA','LOS ANGELES'),'50',lookup,triggers.actionable);
assert(sc.people>0);assert(oh.people>0);assert.equal(ca.people,0);assert.equal(ca.planning,0);assert.equal(sc.states.reduce((n,s)=>n+s.people,0),c.records.length);
assert.equal(T.coverage(c.records,charleston,'all',lookup,triggers.actionable).people,c.records.length);
const unknown={location:{state:'SC',city:'Unknown'},events:[]};assert.equal(T.inMarket(unknown,charleston,'50',lookup),false);assert.equal(T.inMarket(unknown,charleston,'SC',lookup),true);
for(const [zip,country] of [['10001','US'],['00601','PR'],['00701','PR'],['00901','PR'],['00802','VI'],['96799','AS'],['96910','GU'],['96950','MP']])assert.equal(T.zipCountry(zip),country);
const postal={'post code':'02108','country abbreviation':'US',places:[{'place name':'Boston','state abbreviation':'MA',latitude:'42.35',longitude:'-71.06'}]},origin=T.zipOrigin('02108',postal);
assert.equal(origin.zip,'02108');assert.throws(()=>T.zipOrigin('02108',{...postal,'country abbreviation':'PR'}));assert.throws(()=>T.zipOrigin('02108',{...postal,places:[{...postal.places[0],latitude:''}]}));assert.throws(()=>T.zipOrigin('02108',{...postal,'post code':'2108'}));
for(const [o,mode] of [[origin,'75'],[cincinnati,'SC'],[charleston,'all']]){const restored=T.restorePreference(T.preference(o,mode),lookup);assert.deepEqual(restored.origin,o);assert.equal(restored.mode,mode);}
assert.equal(T.restorePreference({product:'Other',schema:1,origin,mode:'50'},lookup),null);assert.equal(T.restorePreference(T.preference(origin,'3001'),lookup),null);assert.equal(T.restorePreference(T.preference({...origin,lat:91},'50'),lookup),null);
console.log(`Full-reference geographic QA: ${data.places.length} places; 52 codes; mainland, Alaska, Hawaii, Puerto Rico; empty-market honesty, cached preferences, malformed postal response rejection.`);
