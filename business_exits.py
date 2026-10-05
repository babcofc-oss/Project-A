"""Reviewed private-business identities; never invent SEC identifiers or proceeds.

An explicitly named founder + company + primary transaction authority scopes each
identity. Reviewers supply fact anchors and fingerprinted primary announcements.
No fuzzy merge into SEC people; changed evidence fails closed. Publication date
is a completion upper bound, not the undisclosed closing date.
"""
import hashlib, json, re
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from transitions import text_content
from geo_enrichment import enrich

ROOT = Path(__file__).resolve().parent

def normalize(value):
    return re.sub(r'\s+', ' ', value).strip().casefold()

def entity_id(entry):
    key = '|'.join(normalize(entry[k]) for k in ('subject_name','company','identity_authority'))
    return 'reviewed-business-' + hashlib.sha256(key.encode()).hexdigest()[:24]

def validate(entry, root=ROOT):
    if entry['relationship'] != 'FOUNDER' or entry['stage'] != 'COMPLETED':
        raise ValueError('Only reviewed named founders of completed acquisitions are supported')
    if date.fromisoformat(entry['publication_date']) > date.today():
        raise ValueError('Future publication')
    evidence = []
    for source in entry['sources']:
        host = urlparse(source['source_url']).hostname
        if urlparse(source['source_url']).scheme != 'https' or host != source['authority_domain']:
            raise ValueError('Primary source authority mismatch')
        path = (root/source['raw_path']).resolve()
        if not path.is_relative_to(root.resolve()): raise ValueError('Evidence path outside project')
        body = path.read_bytes()
        if hashlib.sha256(body).hexdigest() != source['sha256']:
            raise ValueError('Evidence fingerprint mismatch')
        text = normalize(text_content(body))
        if not source['required_terms'] or any(normalize(t) not in text for t in source['required_terms']):
            raise ValueError('Missing acquisition source anchors')
        evidence.append((source,text))
    # Require the person/company founder relationship in one exact source span.
    anchors = entry['relationship_anchor'],entry['completion_anchor'],entry['market_anchor'],date.fromisoformat(entry['publication_date']).strftime('%m.%d.%Y')
    primary = next((s for s,t in evidence if s['authority_domain']==entry['identity_authority'] and all(normalize(a) in t for a in anchors)),None)
    if not primary or normalize(entry['subject_name']) not in normalize(entry['relationship_anchor']) or normalize(entry['company']) not in normalize(entry['completion_anchor']):
        raise ValueError('Named relationship, company completion and geography not established')
    if entry['market_state']!='SC' or 'South Carolina' not in entry['completion_anchor'] or normalize(entry['market_city']) not in normalize(entry['market_anchor']):
        raise ValueError('Company market not established')
    identity=entity_id(entry)
    source_ledger=[{k:v for k,v in s.items() if k!='required_terms'} for s,_ in evidence]
    event={
        'id':identity+':acquisition:'+entry['publication_date'], 'accession':entry['source_id'],
        'date':entry['publication_date'], 'filed_date':entry['publication_date'],
        'date_kind':'Announcement publication; completion upper bound',
        'source_class':'COMPANY_ANNOUNCEMENT','trigger_type':'BUSINESS_EXIT',
        'classification':'BUSINESS_EXIT','stage':'COMPLETED','reviewed_trigger':True,
        'fact':f"{entry['buyer']} reported acquiring {entry['company']}; {entry['subject_name']} is identified as its founder.",
        'status':'Acquisition reported completed by '+entry['publication_date']+'. Exact closing date, individual sale participation and current role UNKNOWN.',
        'relationship_evidence':'Named founder relationship verified in the primary announcement; ownership percentage and individual consideration UNKNOWN.',
        'amount_context':'Deal price and individual proceeds are not disclosed in the retained announcements. Cash received, retained equity, debt and earn-out terms UNKNOWN.',
        'assertion_class':'VERIFIED PUBLIC FACT','value_class':'UNKNOWN',
        'value':None,'shares':None,'price':None,'code':None,'planned':False,
        'cash_received':'UNKNOWN','footnotes':[], 'evidence_sources':source_ledger,
        **{k:primary[k] for k in ('source_url','raw_path','sha256')}
    }
    location={'city':entry['market_city'],'state':entry['market_state'],
        'kind':'Company service market; personal location UNKNOWN','basis':'COMPANY_MARKET',
        'source_url':primary['source_url'],'assertion_class':'VERIFIED PUBLIC FACT','distance_miles':None}
    enrich(location,root/'geography.json')
    location['geo_method']='Census city reference for disclosed company service market; not founder location'
    return {'id':identity,'identity_kind':'REVIEWED_BUSINESS_PERSON',
        'identity_method':'Exact primary-source named founder + company + authority; no SEC or cross-company identity match',
        'person_cik':None,'issuer_cik':None,'person_name':entry['subject_name'],
        'display_name':entry['subject_name'],'role':'Founder as disclosed; current role UNKNOWN',
        'company':entry['company'],'location':location,'events':[event],
        'source_classes':['COMPANY_ANNOUNCEMENT'],'liquidity_total':0,'signal_type':'Planning','convergence':0}

def merge(records,root=ROOT):
    entries=json.loads((root/'reviewed-business-exits.json').read_text())
    records[:]=[p for p in records if p.get('identity_kind')!='REVIEWED_BUSINESS_PERSON']
    accepted={};errors=[]
    for entry in entries:
        try:
            person=validate(entry,root)
            if person['id'] in accepted:
                if person != accepted[person['id']]: raise ValueError('Conflicting duplicate identity')
                continue
            accepted[person['id']]=person
        except (ValueError,KeyError,OSError) as error:
            errors.append({'accession':entry.get('source_id','UNKNOWN'),'error':str(error),'adapter':'business-exit'})
    records.extend(accepted.values())
    return {'validated_people':len(accepted),'validated_transactions':len(accepted), 'errors':errors}

if __name__=='__main__':
    catalog=json.loads((ROOT/'catalog.json').read_text())
    catalog['business_exits']=merge(catalog['records'])
    from contacts import merge as merge_contacts
    catalog['contact_enrichment']=merge_contacts(catalog['records'])
    catalog.update(version='project-a-15',scoring_version='money-in-motion-v5',validated_at=datetime.now(timezone.utc).isoformat())
    if catalog['business_exits']['errors']: raise RuntimeError(catalog['business_exits']['errors'])
    (ROOT/'catalog.json').write_text(json.dumps(catalog,indent=2))
    print(json.dumps(catalog['business_exits']))
