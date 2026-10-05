"""Form 144 notices are proposed sales, never completed-sale proceeds.
Resolve only a unique, exact normalized subject name inside the same issuer.
The filing agent's CIK is deliberately not used as the reporting-person CIK.
"""
import hashlib, json, re
import xml.etree.ElementTree as ET
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path
from ingest import fetch, ROOT, INPUTS, ISSUERS, TODAY

def tokens(name):
    return sorted(re.findall(r'[a-z]+', name.casefold()))

def parse(body, accession, filed, source, records, expected_issuer):
    root=ET.fromstring(body)
    for node in root.iter(): node.tag=node.tag.rsplit('}',1)[-1]
    def text(path): return (root.findtext(path) or '').strip()
    if text('headerData/submissionType') != '144': raise ValueError('Not Form 144')
    issuer=text('formData/issuerInfo/issuerCik')
    if int(issuer)!=int(expected_issuer): raise ValueError('Issuer mismatch')
    name=text('formData/issuerInfo/nameOfPersonForWhoseAccountTheSecuritiesAreToBeSold')
    candidates=[p for p in records if p.get('issuer_cik') and int(p['issuer_cik'])==int(issuer) and tokens(p['person_name'])==tokens(name)]
    if len(candidates)!=1: raise ValueError('No unique exact subject / issuer match; hold for review')
    notice=text('formData/noticeSignature/noticeDate')
    when=date.fromisoformat(filed)
    if when>TODAY: raise ValueError('Future filing')
    rows=root.findall('formData/securitiesInformation')
    if not rows: raise ValueError('Missing proposed securities')
    events=[]
    for i,row in enumerate(rows):
        def field(key): return (row.findtext(key) or '').strip()
        units=Decimal(field('noOfUnitsSold')); amount=Decimal(field('aggregateMarketValue'))
        if not units.is_finite() or not amount.is_finite() or units<=0 or amount<0: raise ValueError('Invalid proposed amount')
        approximate=field('approxSaleDate')
        if approximate:
            from datetime import datetime
            approximate=datetime.strptime(approximate,'%m/%d/%Y').date().isoformat()
        plans=[(n.text or '').strip() for n in root.findall('formData/noticeSignature/planAdoptionDates/planAdoptionDate')]
        events.append({'id':accession+':144:'+str(i),'accession':accession,'date':filed,'filed_date':filed,'source_class':'FORM144','code':None,'classification':'PROPOSED_SALE','trigger_type':'PROPOSED_SALE','stage':'PROPOSED','value':None,'value_class':'UNKNOWN','shares':None,'price':None,'proposed_shares':float(units),'proposed_market_value':float(amount),'approximate_sale_date':approximate,'planned':bool(plans),'fact':f'Form 144 names {name} and gives notice of a proposed sale of {units:,} shares. Approximate sale date: {approximate or "UNKNOWN"}.','status':'Proposed sale notice; execution is not established by this filing.','amount_context':f'${amount:,.2f} aggregate market value reported for the proposed securities; not completed-sale proceeds or available cash. Do not add to Form 4 sale totals.','footnotes':(['Trading-plan adoption date(s): '+', '.join(plans)] if plans else []),'source_url':source,'raw_path':accession+'.xml','sha256':hashlib.sha256(body).hexdigest(),'assertion_class':'VERIFIED PUBLIC FACT','cash_received':'UNKNOWN','identity_method':'Exact normalized named account subject + issuer matched uniquely to retained Form 4 identity; filing-agent CIK ignored'})
    return candidates[0],events

def merge(records, submissions):
    for p in records: p['events']=[e for e in p['events'] if e.get('source_class')!='FORM144']
    accepted=set(); errors=[]; discovered=set()
    for cik,submission in submissions.items():
        recent=submission['filings']['recent']
        for i,form in enumerate(recent['form']):
            if form!='144' or recent['filingDate'][i]<'2026-06-01': continue
            accession=recent['accessionNumber'][i]
            if accession in discovered: continue
            discovered.add(accession)
            base=f'https://www.sec.gov/Archives/edgar/data/{int(cik)}/{accession.replace("-", "")}/'
            document=recent['primaryDocument'][i]
            try:
                body=fetch(base+document.split('/')[-1],ROOT/(accession+'.xml'))
                person,events=parse(body,accession,recent['filingDate'][i],base+document,records,cik)
                person['events'].extend(events); accepted.add(accession)
                print('FORM144',accession,person['person_name'],flush=True)
            except (ValueError,InvalidOperation,ET.ParseError,OSError) as error:
                errors.append({'accession':accession,'error':str(error),'adapter':'form144'})
                print('HELD FORM144',accession,str(error),flush=True)
    for p in records:
        p['events']=sorted({e['id']:e for e in p['events']}.values(),key=lambda e:(e['date'],e['id']),reverse=True)
        p['source_classes']=sorted({e.get('source_class','FORM4') for e in p['events']})
    return {'discovered':len(discovered),'validated':len(accepted),'errors':errors}

if __name__=='__main__':
    import sys
    cache=Path(sys.argv[1]) if len(sys.argv)>1 else INPUTS
    submissions={c:json.loads((cache/f'submissions-{c}-{TODAY.isoformat()}.json').read_text()) for c in ISSUERS}
    catalog=json.loads((ROOT/'catalog.json').read_text())
    catalog['form144']=merge(catalog['records'],submissions)
    catalog['version']='project-a-12'
    (ROOT/'catalog.json').write_text(json.dumps(catalog,indent=2))
    print(json.dumps(catalog['form144'],indent=2))
