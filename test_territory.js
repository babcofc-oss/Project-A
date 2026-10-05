const assert=require('node:assert/strict'),fs=require('node:fs'),T=require('./territory.js');
const data=JSON.parse(fs.readFileSync('territories.json')),lookup=T.index(data.places);
const find=(state,city)=>T.resolve({state,city},lookup);
const charleston=find('SC','CHARLESTON'),north=find('SC','NORTH CHARLESTON'),cincinnati=find('OH','CINCINNATI'),philadelphia=find('PA','PHILADELPHIA');
assert.equal(new Set(data.places.map(p=>p.state)).size,52);assert.equal(T.distance(charleston,charleston),0);assert(T.distance(charleston,north)>7&&T.distance(charleston,north)<10);assert(T.distance(cincinnati,philadelphia)>400);assert.equal(T.distance(cincinnati,philadelphia),T.distance(philadelphia,cincinnati));assert.equal(find('OH','UNKNOWN QA CITY'),null);assert.equal(T.distance(charleston,null),null);
assert.equal(T.resolve({state:'OH',city:'CINCINNATI',place_geoid:charleston.id},lookup).id,cincinnati.id);
const ambiguous=T.index([{id:'a',state:'QA',name:'Same city',lat:1,lon:2},{id:'b',state:'QA',name:'Same town',lat:2,lon:3}]);assert.equal(T.resolve({state:'QA',city:'SAME'},ambiguous),null);
console.log('National territory checks passed: 52 state/territory codes, known distances, cross-state resolution, unknown and ambiguous city exclusion.');
