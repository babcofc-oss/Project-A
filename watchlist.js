"use strict";
(function(root){
  function validate(payload,people){
    if(!payload||payload.product!=="Project A"||payload.kind!=="watchlist"||payload.schema_version!==1||!Array.isArray(payload.person_ids)||payload.person_ids.length>1000)throw new Error("Expected a Project A watchlist backup with at most 1,000 saved people.");
    if(payload.person_ids.some(id=>typeof id!=="string"||!/^[-a-zA-Z0-9_.:]{1,200}$/.test(id)))throw new Error("Invalid prospect ID. No saved prospects changed.");
    const available=new Set(people.map(p=>p.id)),ids=[...new Set(payload.person_ids)];
    return {matched:ids.filter(id=>available.has(id)),unavailable:ids.filter(id=>!available.has(id))};
  }
  function backup(ids){return JSON.stringify({product:"Project A",kind:"watchlist",schema_version:1,exported_at:new Date().toISOString(),person_ids:[...new Set(ids)]},null,2);}
  const api={validate,backup};if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.ProjectWatchlist=api;
})(typeof window!=="undefined"?window:globalThis);
