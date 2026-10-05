"""Reviewed Form 8-K adapter. Discovery is separate from release.
Only named, manually reviewed person relationships enter the evidence ledger.
An Item 5.02 filing or a signer's name alone never becomes a planning trigger.
"""
import hashlib, html, json, re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def text_content(body):
    return ' '.join(html.unescape(re.sub(r'<[^>]+>', ' ', body.decode('utf-8'))).split())

def name_tokens(name):
    return set(re.findall(r'[a-z]+',name.casefold()))

def reviewed_event(entry, person, body):
    text = text_content(body)
    if not name_tokens(entry['subject_name']).issubset(name_tokens(person['person_name'])):
        raise ValueError('Named event subject does not match reporting person')
    if hashlib.sha256(body).hexdigest() != entry['sha256']:
        raise ValueError('Reviewed evidence fingerprint changed')
    if person['id'] != entry['person_id'] or int(person['issuer_cik']) != int(entry['issuer_cik']):
        raise ValueError('Person / issuer relationship mismatch')
    if f"{int(entry['issuer_cik']):010d}" not in text or not re.search(r'FORM\s+8-K', text, re.I):
        raise ValueError('Issuer / form identity not established')
    if any(term.casefold() not in text.casefold() for term in entry['required_terms']):
        raise ValueError('Reviewed fact anchor missing')
    if date.fromisoformat(entry['date']) > date.today():
        raise ValueError('Future announcement cannot be released')
    return {k:v for k,v in entry.items() if k not in ('person_id','issuer_cik','required_terms')} | {
        'id':entry['accession'] + ':' + person['id'] + ':transition',
        'source_class':'8K','code':None,'value':None,'value_class':'UNKNOWN',
        'shares':None,'price':None,'planned':False,'footnotes':[],
        'assertion_class':'VERIFIED PUBLIC FACT',
        'identity_method':'Reviewed named subject + same issuer + unique matching Form 4 reporting person; not a filing signatory match',
        'cash_received':'UNKNOWN'}

def merge_reviewed(records, root=ROOT):
    manifest = json.loads((root/'reviewed-transitions.json').read_text())
    people = {p['id']:p for p in records}
    # Idempotent refresh: replace only this adapter's reviewed events.
    for p in records:
        p['events'] = [e for e in p['events'] if not (e.get('source_class') == '8K' and not e.get('reviewed_trigger'))]
    errors=[]
    accepted=set()
    for entry in manifest:
        try:
            person=people[entry['person_id']]
            matches=[p for p in records if int(p['issuer_cik'])==int(entry['issuer_cik']) and name_tokens(entry['subject_name']).issubset(name_tokens(p['person_name']))]
            if len(matches)!=1: raise ValueError('Ambiguous named subject; manual resolution required')
            event=reviewed_event(entry,person,(root/entry['raw_path']).read_bytes())
            person['events'].append(event); accepted.add(entry['accession'])
        except (ValueError,KeyError,OSError) as error:
            errors.append({'accession':entry['accession'],'error':str(error),'adapter':'reviewed-8k'})
    for p in records:
        p['events']=sorted({e['id']:e for e in p['events']}.values(),key=lambda e:(e['date'],e['id']),reverse=True)
        p['source_classes']=sorted({e.get('source_class','FORM4') for e in p['events']})
        p['convergence']=int(any(e['classification']=='LIQUIDITY' for e in p['events']) and any(e['classification']=='EXECUTIVE_TRANSITION' for e in p['events']))
    return accepted,errors

def discover(root=ROOT):
    """Create a review queue; discovery never releases person-level facts."""
    from ingest import ISSUERS, INPUTS, TODAY, fetch
    rows=[]
    for cik in ISSUERS:
        submission=json.loads(fetch(f'https://data.sec.gov/submissions/CIK{int(cik):010d}.json', INPUTS/('submissions-'+cik+'-'+TODAY.isoformat()+'.json')))
        recent=submission['filings']['recent']
        for i,form in enumerate(recent['form']):
            if form=='8-K' and recent['filingDate'][i]>='2026-06-01' and '5.02' in recent['items'][i]:
                accession=recent['accessionNumber'][i]
                rows.append({'accession':accession,'issuer_cik':cik,'company':submission['name'],'filed_date':recent['filingDate'][i],'items':recent['items'][i],'source_url':f'https://www.sec.gov/Archives/edgar/data/{int(cik)}/{accession.replace("-", "")}/{recent["primaryDocument"][i]}','status':'DISCOVERED — person relationship and classification require review'})
    (root/'transition-review-queue.json').write_text(json.dumps(rows,indent=2))
    return rows

if __name__=='__main__':
    import sys
    if '--discover' in sys.argv:
        print(json.dumps({'discovered_8k_candidates':len(discover())}));sys.exit(0)
    from datetime import datetime,timezone
    path=ROOT/'catalog.json'; catalog=json.loads(path.read_text())
    accepted,errors=merge_reviewed(catalog['records'])
    catalog.update(version='project-a-11',scoring_version='money-in-motion-v3',transition_filings=len(accepted),transition_errors=errors,validated_at=datetime.now(timezone.utc).isoformat())
    path.write_text(json.dumps(catalog,indent=2))
    print(json.dumps({'reviewed_8k_filings':len(accepted),'people_with_8k':sum('8K' in p['source_classes'] for p in catalog['records']),'converged_people':sum(p['convergence'] for p in catalog['records']),'errors':errors}))
