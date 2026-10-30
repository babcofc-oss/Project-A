"""Census representative-place geometry; never personal-address geocoding."""
import json, math
from functools import lru_cache

@lru_cache(maxsize=6)
def read_reference(path,mtime):
    return json.loads(__import__('pathlib').Path(path).read_text())

def enrich(location, source_path):
    location['distance_miles'] = None
    if not source_path.exists(): return
    data = dict(read_reference(str(source_path),source_path.stat().st_mtime_ns))
    postal_path=source_path.with_name('postal-reference.json')
    if location.get('postal_code') and postal_path.exists():
        ref=read_reference(str(postal_path),postal_path.stat().st_mtime_ns)
        point=ref['places'].get(location['postal_code'])
        if point and len(point)==5 and point[1]==location.get('state') and point[4] in ('US','PR') and -90<=point[2]<=90 and -180<=point[3]<=180:
            origin=data['origin'];lat1,lat2=map(math.radians,[float(origin['INTPTLAT']),point[2]]);dlon=math.radians(point[3]-float(origin['INTPTLONG']));a=math.sin((lat2-lat1)/2)**2+math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
            location.update(reference_lat=point[2],reference_lon=point[3],reference_zip=location['postal_code'],distance_miles=round(3958.7613*2*math.atan2(math.sqrt(a),math.sqrt(max(0,1-a))),2),geo_source=ref['source_url'],geo_class='CALCULATED FROM VERIFIED FACT',geo_method='GeoNames reference point for source-disclosed mailing ZIP; approximate area, not residence or street-address geocoding')
            return
    wanted = (location.get('city') or '').upper()
    national_path = source_path.with_name('territories.json')
    if national_path.exists():
        national=read_reference(str(national_path),national_path.stat().st_mtime_ns)
        import re
        candidates=[r for r in national['places'] if r['state']==location.get('state') and re.sub(r' (city|town|village|CDP|borough|municipality|zona urbana|comunidad)$','',r['name'],flags=re.I).upper()==wanted]
        matched=None if len(candidates)!=1 else {'INTPTLAT':candidates[0]['lat'],'INTPTLONG':candidates[0]['lon'],'GEOID':candidates[0]['id']}
        data['source']=national['source']
    else:
        if location.get('state') != data['origin']['USPS']: return
        matched = next((r for r in data['places'].values() if r['NAME'].removesuffix(' city').removesuffix(' town').removesuffix(' CDP').upper() == wanted), None)
    if not matched: return
    origin = data['origin']
    lat1, lat2 = map(math.radians, [float(origin['INTPTLAT']), float(matched['INTPTLAT'])])
    lon = math.radians(float(matched['INTPTLONG'])-float(origin['INTPTLONG']))
    a = math.sin((lat2-lat1)/2)**2+math.cos(lat1)*math.cos(lat2)*math.sin(lon/2)**2
    distance = 3958.7613*2*math.atan2(math.sqrt(a),math.sqrt(1-a))
    location.update(distance_miles=round(distance,2),geo_source=data['source'],geo_class='CALCULATED FROM VERIFIED FACT',
                    geo_method='Haversine between Census place representative coordinates; mailing city only, not precise location',place_geoid=matched['GEOID'])
