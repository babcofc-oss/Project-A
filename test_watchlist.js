const assert=require('node:assert/strict'),W=require('./watchlist.js');
const people=[{id:'person-1-issuer-2'},{id:'person-3-issuer-2'}];
const raw=JSON.parse(W.backup(['person-1-issuer-2','person-1-issuer-2','person-gone']));
assert.deepEqual(W.validate(raw,people),{matched:['person-1-issuer-2'],unavailable:['person-gone']});
for(const p of [{...raw,kind:'feedback'},{...raw,schema_version:2},{...raw,person_ids:['<script>']},{...raw,person_ids:[null]},{...raw,person_ids:Array(1001).fill('x')}])assert.throws(()=>W.validate(p,people));
assert.deepEqual(W.validate(JSON.parse(W.backup([])),people),{matched:[],unavailable:[]});
console.log('Watchlist backup: round trip, deduplication, unavailable records and malformed/oversized import gates passed.');
