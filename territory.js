'use strict';
(function(root){
 const normalize=name=>String(name||'').replace(/ (city|town|village|CDP|borough|municipality|zona urbana|comunidad)$/i,'').trim().toUpperCase();
 function distance(a,b){if(!a||!b)return null;const rad=x=>x*Math.PI/180,lat1=rad(a.lat),lat2=rad(b.lat),dlat=lat2-lat1,dlon=rad(b.lon-a.lon),h=Math.sin(dlat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dlon/2)**2;return 3958.7613*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));}
 function index(places){const ids=new Map(),names=new Map();for(const p of places){ids.set(p.id,p);const key=p.state+'|'+normalize(p.name);if(!names.has(key))names.set(key,[]);names.get(key).push(p);}return {ids,names};}
 function resolve(location,lookup){const byId=lookup.ids.get(location.place_geoid);if(byId&&byId.state===location.state)return byId;const found=lookup.names.get(location.state+'|'+normalize(location.city))||[];return found.length===1?found[0]:null;}
 const api={normalize,distance,index,resolve};if(typeof module==='object'&&module.exports)module.exports=api;else root.ProjectTerritory=api;
})(typeof window==='undefined'?globalThis:window);
