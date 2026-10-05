'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const evidence=require('./evidence.js');
function response(bytes,status=200){return {ok:status===200,status,headers:{get:()=>String(bytes.length)},arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};}
(async()=>{
  const catalog=JSON.parse(fs.readFileSync('catalog.json','utf8'));
  const sources=[...new Map(catalog.records.flatMap(p=>[...p.contacts.routes,...p.events.flatMap(e=>[e,...(e.evidence_sources||[])])]).filter(s=>s.raw_path&&s.sha256).map(s=>[s.raw_path,s])).values()];
  for(const source of sources){
    const bytes=fs.readFileSync(source.raw_path);
    const result=await evidence.load({path:source.raw_path,sha256:source.sha256},async()=>response(bytes),crypto.webcrypto);
    assert.equal(result.text,bytes.toString('utf8'));
  }
  const bytes=Buffer.from('<script>never execute archived scripts</script>');
  const source={path:'contact-source-fixture.txt',sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
  assert.equal((await evidence.load(source,async()=>response(bytes),crypto.webcrypto)).text,bytes.toString());
  await assert.rejects(evidence.load(source,async()=>response(Buffer.from('tampered')),crypto.webcrypto),/fingerprint/);
  await assert.rejects(evidence.load(source,async()=>response(bytes,404),crypto.webcrypto),/HTTP 404/);
  await assert.rejects(evidence.load(source,async()=>response(Buffer.alloc(2*1024*1024+1)),crypto.webcrypto),/size limit/);
  await assert.rejects(evidence.load(source,async()=>{throw Object.assign(new Error('aborted'),{name:'AbortError'});},crypto.webcrypto),/timed out/);
  await assert.rejects(evidence.load(source,async()=>response(bytes),{}),/verification is unavailable/);
  for(const path of ['../catalog.json','https://evil.test/a.txt','archive.txt?token=secret','archive.txt#x','/archive.txt'])assert.throws(()=>evidence.validate({...source,path}),/Invalid/);
  console.log('Retained evidence verified: '+sources.length+' real sources; tampering, missing files, unsafe paths, size limits and timeout handling passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
