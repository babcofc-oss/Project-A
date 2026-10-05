"""Release adapter for manually reviewed new trigger sources.
No discovery result is automatically treated as an opportunity. Existing public
person identifiers, retained evidence, source anchors and precise stages are required.
Amounts stay in context; no generic trigger enters the Form 4 liquidity sum.
"""
import hashlib,json,re
from datetime import date
from urllib.parse import urlparse
from pathlib import Path
from transitions import text_content,name_tokens
ROOT=Path(__file__).resolve().parent
STAGES={'BUSINESS_EXIT':{'ANNOUNCED','COMPLETED'},'PUBLIC_OFFERING':{'REGISTERED','COMPLETED'},'OWNERSHIP_CHANGE':{'DISCLOSED'},'PROPERTY_SALE':{'COMPLETED'},'LOTTERY_AWARD':{'ANNOUNCED'},'ESTATE_DISTRIBUTION':{'BENEFICIARY_IDENTIFIED','DISTRIBUTION_DOCUMENTED'}}

def validate(entry,person,body):
    kind=entry['trigger_type'];stage=entry['stage']
    if stage not in STAGES.get(kind,set()):raise ValueError('Unsupported trigger / stage')
    if entry['person_id']!=person['id'] or int(entry['issuer_cik'])!=int(person['issuer_cik']):raise ValueError('Identity relationship mismatch')
    if not name_tokens(entry['subject_name']).issubset(name_tokens(person['person_name'])):raise ValueError('Subject mismatch')
    if hashlib.sha256(body).hexdigest()!=entry['sha256']:raise ValueError('Evidence fingerprint mismatch')
    if date.fromisoformat(entry['date'])>date.today():raise ValueError('Future event')
    if urlparse(entry['source_url']).scheme!='https' or not entry['source_authority'].strip():raise ValueError('Primary authority required')
    text=text_content(body).casefold()
    if not entry['required_terms'] or any(term.casefold() not in text for term in entry['required_terms']):raise ValueError('Missing source anchors')
    if not all(t in text for t in name_tokens(entry['subject_name'])):raise ValueError('Named subject not established in evidence')
    if not entry['relationship_evidence'].strip():raise ValueError('Ownership / beneficiary relationship review required')
    if kind=='LOTTERY_AWARD' and entry.get('named_public_winner') is not True:raise ValueError('Anonymous award excluded')
    if kind=='PROPERTY_SALE' and entry.get('property_use') not in ('COMMERCIAL','INVESTMENT'):raise ValueError('Only reviewed commercial / investment property signals')
    if kind=='ESTATE_DISTRIBUTION' and entry.get('beneficiary_evidence') is not True:raise ValueError('Estate opening / obituary alone excluded')
    return {k:v for k,v in entry.items() if k not in ('person_id','issuer_cik','required_terms')}|{'id':entry['accession']+':'+person['id']+':'+kind,'classification':kind,'reviewed_trigger':True,'assertion_class':'VERIFIED PUBLIC FACT','value':None,'value_class':'UNKNOWN','shares':None,'price':None,'code':None,'planned':False,'cash_received':'UNKNOWN','footnotes':[]}

def merge(records,root=ROOT):
    entries=json.loads((root/'reviewed-triggers.json').read_text());people={p['id']:p for p in records};errors=[];accepted=set()
    for p in records:p['events']=[e for e in p['events'] if not e.get('reviewed_trigger')]
    for entry in entries:
        try:
            person=people[entry['person_id']]
            matches=[p for p in records if p.get('issuer_cik') and int(p['issuer_cik'])==int(entry['issuer_cik']) and name_tokens(entry['subject_name']).issubset(name_tokens(p['person_name']))]
            if len(matches)!=1:raise ValueError('Ambiguous subject')
            path=(root/entry['raw_path']).resolve()
            if not path.is_relative_to(root.resolve()):raise ValueError('Evidence path outside project')
            person['events'].append(validate(entry,person,path.read_bytes()));accepted.add(entry['accession'])
        except (ValueError,KeyError,OSError) as error:errors.append({'accession':entry.get('accession','UNKNOWN'),'error':str(error),'adapter':'reviewed-trigger'})
    for p in records:
        p['events']=sorted({e['id']:e for e in p['events']}.values(),key=lambda e:(e['date'],e['id']),reverse=True)
        p['source_classes']=sorted({e.get('source_class','FORM4') for e in p['events']})
    return {'validated':len(accepted),'errors':errors}
