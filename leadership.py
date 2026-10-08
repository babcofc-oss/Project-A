"""Reviewed named leadership events from primary SEC 8-K evidence.

Company-scoped identities do not imply personal addresses, ownership or funds.
No fuzzy joins or inference from a filing signer. Refresh fails closed.
"""
import hashlib, json, re
from datetime import date
from pathlib import Path
from urllib.parse import urlparse
from transitions import text_content
from geo_enrichment import enrich

ROOT = Path(__file__).resolve().parent
KINDS = {'EXECUTIVE_TRANSITION', 'EXECUTIVE_APPOINTMENT', 'BOARD_APPOINTMENT', 'BOARD_DEPARTURE'}

def validate(entry, root=ROOT):
    if entry['classification'] not in KINDS or entry['stage'] != 'ANNOUNCED':
        raise ValueError('Unsupported leadership event/stage')
    for field in ('date', 'filed_date', 'reviewed_at'):
        if date.fromisoformat(entry[field]) > date.today():
            raise ValueError('Future publication or review')
    url = urlparse(entry['source_url'])
    cik = str(int(entry['issuer_cik']))
    accession = entry['accession']
    if url.scheme != 'https' or url.hostname != 'www.sec.gov' or not re.fullmatch(r'\d{10}-\d{2}-\d{6}', accession):
        raise ValueError('Primary SEC authority required')
    if url.path != f"/Archives/edgar/data/{cik}/{accession.replace('-', '')}/{entry['primary_document']}":
        raise ValueError('Issuer/accession provenance mismatch')
    path = (root/entry['raw_path']).resolve()
    if not path.is_relative_to(root.resolve()) or path.name != accession+'.htm':
        raise ValueError('Invalid retained path')
    body = path.read_bytes()
    if hashlib.sha256(body).hexdigest() != entry['sha256']:
        raise ValueError('Evidence fingerprint mismatch')
    text = text_content(body)
    if not re.search(r'FORM\s+8-K', text, re.I) or f'{int(cik):010d}' not in text:
        raise ValueError('Form/issuer identity missing')
    anchors = [entry['company'], entry['subject_name'], entry['relationship_anchor'], entry['location_anchor'], *entry['required_terms']]
    if not entry['required_terms'] or any(a.casefold() not in text.casefold() for a in anchors):
        raise ValueError('Named relationship or fact anchor missing')
    if entry['subject_name'].casefold() not in entry['relationship_anchor'].casefold():
        raise ValueError('Subject must be named in the reviewed event span')
    if entry['location_city'].casefold() not in entry['location_anchor'].casefold():
        raise ValueError('Company geography missing')
    key = entry['subject_name'].casefold()+'|'+cik
    identity = 'reviewed-leadership-'+hashlib.sha256(key.encode()).hexdigest()[:24]
    event = {k:v for k,v in entry.items() if k not in ('subject_name','company','issuer_cik','role','location_city','location_state','location_anchor','relationship_anchor','required_terms','ai_note')}
    event.update(id=identity+':'+accession+':'+entry['classification'], trigger_type=entry['classification'],
        source_class='8K', reviewed_leadership=True, assertion_class='VERIFIED PUBLIC FACT',
        value=None, value_class='UNKNOWN', shares=None, price=None, code=None,
        planned=False, cash_received='UNKNOWN', footnotes=[])
    location = dict(city=entry['location_city'], state=entry['location_state'],
        kind='Company headquarters; personal location UNKNOWN', basis='COMPANY_HEADQUARTERS',
        source_url=entry['source_url'], assertion_class='VERIFIED PUBLIC FACT', distance_miles=None)
    enrich(location, root/'geography.json')
    note = entry['ai_note']
    if note.get('source_accessions') != [accession] or note.get('prepared_at') != entry['reviewed_at']:
        raise ValueError('AI note provenance mismatch')
    return dict(id=identity, identity_kind='REVIEWED_LEADERSHIP_PERSON',
        identity_method='Exact named subject + SEC issuer + reviewed event span; company-scoped identity, no cross-company match',
        person_cik=None, issuer_cik=cik, person_name=entry['subject_name'], display_name=entry['subject_name'],
        role=entry['role'], company=entry['company'], location=location, events=[event],
        source_classes=['8K'], liquidity_total=0, signal_type='Planning' if entry['classification'].startswith('EXECUTIVE') else 'Monitor',
        convergence=0, ai_note=note)

def merge(records, root=ROOT):
    records[:]=[p for p in records if p.get('identity_kind')!='REVIEWED_LEADERSHIP_PERSON']
    accepted={}; errors=[]
    for entry in json.loads((root/'reviewed-leadership.json').read_text()):
        try:
            person=validate(entry,root)
            if person['id'] in accepted: raise ValueError('Duplicate leadership identity requires review')
            if any(p.get('issuer_cik')==person['issuer_cik'] and p['person_name'].casefold()==person['person_name'].casefold() for p in records):
                raise ValueError('Existing issuer/person match requires explicit merge review')
            accepted[person['id']]=person
        except (ValueError,KeyError,OSError) as error:
            errors.append(dict(accession=entry.get('accession','UNKNOWN'),error=str(error),adapter='leadership'))
    records.extend(accepted.values())
    return dict(validated_people=len(accepted), validated_filings=len({p['events'][0]['accession'] for p in accepted.values()}), reviewed_at=max((p['events'][0]['reviewed_at'] for p in accepted.values()), default=None), errors=errors)

if __name__=='__main__':
    path=ROOT/'catalog.json'; catalog=json.loads(path.read_text())
    catalog['leadership']=merge(catalog['records'])
    if catalog['leadership']['errors']: raise RuntimeError(catalog['leadership']['errors'])
    catalog['version']='project-a-leadership-research-1'
    # Preserve the original snapshot refresh date; this is a partial source addition.
    path.write_text(json.dumps(catalog,indent=2))
    print(json.dumps(catalog['leadership']))
