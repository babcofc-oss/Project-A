"""Census representative-place geometry; never personal-address geocoding."""
import json, math

def enrich(location, source_path):
    location['distance_miles'] = None
    if not source_path.exists(): return
    data = json.loads(source_path.read_text())
    if location.get('state') != data['origin']['USPS']: return
    wanted = (location.get('city') or '').upper()
    matched = next((r for r in data['places'].values() if r['NAME'].removesuffix(' city').removesuffix(' town').removesuffix(' CDP').upper() == wanted), None)
    if not matched: return
    origin = data['origin']
    lat1, lat2 = map(math.radians, [float(origin['INTPTLAT']), float(matched['INTPTLAT'])])
    lon = math.radians(float(matched['INTPTLONG'])-float(origin['INTPTLONG']))
    a = math.sin((lat2-lat1)/2)**2+math.cos(lat1)*math.cos(lat2)*math.sin(lon/2)**2
    distance = 3958.7613*2*math.atan2(math.sqrt(a),math.sqrt(1-a))
    location.update(distance_miles=round(distance,2),geo_source=data['source'],geo_class='CALCULATED FROM VERIFIED FACT',
                    geo_method='Haversine between Census place representative coordinates; mailing city only, not precise location',place_geoid=matched['GEOID'])
