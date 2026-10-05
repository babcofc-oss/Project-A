'use strict';
(function(root){
  const MAX_BYTES=2*1024*1024;
  function validate(source){
    if(!source||!/^[a-zA-Z0-9][a-zA-Z0-9_-]*\.(?:xml|htm|html|txt)$/.test(source.path)||!/^[a-f0-9]{64}$/.test(source.sha256))throw new Error('Invalid retained evidence reference.');
  }
  async function load(source,fetcher=root.fetch,cryptoProvider=root.crypto){
    validate(source);
    if(!cryptoProvider?.subtle)throw new Error('Fingerprint verification is unavailable.');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try{
      const response=await fetcher(source.path,{signal:controller.signal,credentials:'omit',cache:'no-cache',redirect:'error'});
      if(!response.ok)throw new Error('Source could not be loaded (HTTP '+response.status+').');
      if(Number(response.headers.get('content-length'))>MAX_BYTES)throw new Error('Source exceeds the preview size limit.');
      const bytes=await response.arrayBuffer();
      if(bytes.byteLength>MAX_BYTES)throw new Error('Source exceeds the preview size limit.');
      const hash=[...new Uint8Array(await cryptoProvider.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
      if(hash!==source.sha256)throw new Error('Source fingerprint does not match the reviewed ledger.');
      return {text:new TextDecoder('utf-8',{fatal:true}).decode(bytes),sha256:hash};
    }catch(error){
      if(error.name==='AbortError')throw new Error('Source request timed out.');
      throw error;
    }finally{clearTimeout(timer);}
  }
  const api={load,validate};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.ProjectEvidence=api;
})(typeof globalThis!=='undefined'?globalThis:this);
