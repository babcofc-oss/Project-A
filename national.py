"""Nationwide SEC daily-index discovery. Release only individually parsed Form 4 XML.
A geographic bulk-data seed supplies candidates, never released facts. Joint/unsupported filings are
held explicitly; any transport failure prevents publication of the new snapshot.
"""
import concurrent.futures, csv, hashlib, io, json, re, sys, urllib.error, zipfile
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from functools import lru_cache
import ingest

ROOT=Path(__file__).resolve().parent
STATE=ROOT/'national-discovery.json'

@lru_cache(maxsize=1)
def supported_states():
    return {p['state'] for p in json.loads((ROOT/'territories.json').read_text())['places']}

def seed_from_zip(body,today):
    """Use SEC's bulk data only as a geographic discovery queue.
    Every chosen filing still has to pass full ownership-XML validation.
    """
    z=zipfile.ZipFile(io.BytesIO(body))
    def table(name):
        return csv.DictReader(io.TextIOWrapper(z.open(name),encoding='utf-8-sig'),delimiter='\t')
    submissions={r['ACCESSION_NUMBER']:r for r in table('SUBMISSION.tsv')}
    owners={}
    for r in table('REPORTINGOWNER.tsv'):owners.setdefault(r['ACCESSION_NUMBER'],[]).append(r)
    allowed=supported_states()
    cutoff=today-timedelta(days=90);cities={}
    for tx in table('NONDERIV_TRANS.tsv'):
        accession=tx['ACCESSION_NUMBER'];s=submissions[accession];who=owners.get(accession,[])
        if s['DOCUMENT_TYPE']!='4' or tx['TRANS_CODE']!='S' or tx['TRANS_ACQUIRED_DISP_CD']!='D' or len(who)!=1:continue
        p=who[0];state=p['RPTOWNER_STATE'];city=p['RPTOWNER_CITY'].strip().upper()
        if not city or state not in allowed or not any(x in p['RPTOWNER_RELATIONSHIP'] for x in ('Officer','Director')):continue
        filed=datetime.strptime(s['FILING_DATE'],'%d-%b-%Y').date()
        if not cutoff<=filed<=today:continue
        if not re.fullmatch(r'\d{10}-\d{2}-\d{6}',accession) or not s['ISSUERCIK'].isdigit():raise ValueError('Invalid SEC seed identity')
        key=(state,city);rank=(filed,accession)
        if key not in cities or rank>cities[key][0]:
            filename=f'edgar/data/{int(s["ISSUERCIK"])}/{accession}.txt'
            cities[key]=(rank,dict(accession=accession,form='4',filed_date=filed.isoformat(),filename=filename,source_url='https://www.sec.gov/Archives/'+filename,requires_sale=True,discovery_method='SEC quarterly geographic seed; individual XML required'))
    if not cities:raise ValueError('No supported geographic seed candidates')
    return [r[1] for _,r in sorted(cities.items())]

def bootstrap(today,existing=None):
    page=ingest.fetch('https://www.sec.gov/data-research/sec-markets-data/insider-transactions-data-sets',ingest.INPUTS/'national-seed-page.html',force=True)
    urls=re.findall(r'href="([^"]*/(\d{4})q([1-4])_form345\.zip)"',page.decode())
    if not urls:raise ValueError('SEC has no published ownership bulk source')
    path,year,quarter=max(urls,key=lambda x:(int(x[1]),int(x[2])))
    url='https://www.sec.gov'+path if path.startswith('/') else path
    if not url.startswith('https://www.sec.gov/files/'):raise ValueError('Untrusted SEC bulk source')
    if existing and existing.get('source_url')==url:return [],existing
    body=ingest.fetch(url,ingest.INPUTS/f'national-seed-{year}q{quarter}.zip')
    rows=seed_from_zip(body,today)
    return rows,dict(source_url=url,sha256=hashlib.sha256(body).hexdigest(),quarter=f'{year} Q{quarter}',strategy='Latest qualifying sale filing per distinct disclosed US mailing city/state; individually validate full filing before release',cities_queued=len(rows))

def parse_index(body):
    rows={}
    for line in body.decode('utf-8').splitlines():
        fields=line.split('|')
        if len(fields)!=5 or fields[2] not in ('4','4/A'):continue
        cik,company,form,when,path=fields
        if not re.fullmatch(r'edgar/data/\d+/\d{10}-\d{2}-\d{6}\.txt',path):raise ValueError('Unsafe SEC index path')
        filed=datetime.strptime(when,'%Y%m%d').date().isoformat() if '-' not in when else date.fromisoformat(when).isoformat()
        accession=path.rsplit('/',1)[1][:-4]
        row=dict(accession=accession,form=form,filed_date=filed,filename=path,source_url='https://www.sec.gov/Archives/'+path)
        if accession in rows:
            if any(rows[accession][k]!=row[k] for k in ('form','filed_date')):raise ValueError('Conflicting accession in SEC index')
            continue # One filing can appear under issuer and reporting-owner CIKs.
        rows[accession]=row
    if not rows:raise ValueError('SEC daily index has no ownership filings')
    return list(rows.values())

def ownership_xml(body):
    candidates=[]
    for content in re.findall(rb'<XML>\s*(.*?)\s*</XML>',body,re.S|re.I) or [body]:
        try:root=ET.fromstring(content)
        except ET.ParseError:continue
        if root.tag=='ownershipDocument':candidates.append(content)
    if len(candidates)!=1:raise ValueError('No unique ownership XML document in submission')
    return candidates[0]

def inspect(row):
    row=dict(row)
    if not re.fullmatch(r'\d{10}-\d{2}-\d{6}',row['accession']):raise ValueError('Invalid accession')
    if not re.fullmatch(r'edgar/data/\d+/'+re.escape(row['accession'])+r'\.txt',row['filename']) or row['source_url']!='https://www.sec.gov/Archives/'+row['filename']:raise ValueError('Invalid national source binding')
    if date.fromisoformat(row['filed_date'])>date.today():raise ValueError('Future index filing date')
    path=ROOT/(row['accession']+'.xml')
    if path.exists():
        body=path.read_bytes()
        if row.get('sha256') and hashlib.sha256(body).hexdigest()!=row['sha256']:raise ValueError('National retained source fingerprint mismatch')
    else:
        original=ingest.fetch(row['source_url'],ingest.INPUTS/('national-'+row['accession']+'.txt'))
        if row['accession'].encode() not in original:raise ValueError('Submission accession mismatch')
        try:body=ownership_xml(original)
        except ValueError as e:return {**row,'status':'HELD','reason':str(e)},None
        if row.get('sha256') and hashlib.sha256(body).hexdigest()!=row['sha256']:raise ValueError('National downloaded source fingerprint mismatch')
        path.write_bytes(body)
    row.update(raw_path=path.name,sha256=hashlib.sha256(body).hexdigest())
    root=ET.fromstring(body);issuer=root.findtext('issuer/issuerCik')
    if issuer and issuer.isdigit():row['issuer_cik']=issuer.zfill(10)
    if row['form']=='4/A':return {**row,'status':'AMENDMENT_REVIEW','reason':'Amended transactions require reconciliation; no automatic liquidity release'},None
    owners=root.findall('reportingOwner')
    if len(owners)==1 and not any(owners[0].findtext('reportingOwnerRelationship/'+flag) in ('1','true') for flag in ('isOfficer','isDirector')):
        return {**row,'status':'HELD','reason':'Officer/director person relationship not established; ownership-only entities require review'},None
    try:
        person=ingest.parse_xml(body,row['accession'],row['source_url'],row['filed_date'])
        allowed=supported_states()
        if person['location'].get('state') not in allowed:return {**row,'status':'HELD','reason':'Mailing geography outside supported US states, DC and Puerto Rico'},None
        if not person['events']:return {**row,'status':'HELD','reason':'No supported non-derivative transaction rows'},None
        if row.get('requires_sale') and not any(e['classification']=='LIQUIDITY' for e in person['events']):return {**row,'status':'HELD','reason':'Bulk discovery sale was not confirmed in primary XML'},None
        person['discovery_scope']='NATIONAL_FORM4'
        for e in person['events']:e.update(source_class='FORM4',discovery_scope='NATIONAL_FORM4')
        return {**row,'status':'VALIDATED','person_id':person['id'],'issuer_cik':person['issuer_cik']},person
    except ValueError as e:return {**row,'status':'HELD','reason':str(e)},None

def refresh(today=None):
    today=today or date.today();prior=json.loads(STATE.read_text()) if STATE.exists() else {'entries':[]}
    last=today-timedelta(days=1)
    while last.weekday()>4:last-=timedelta(days=1)
    last_error=None
    for offset in range(7):
        day=last-timedelta(days=offset)
        if day.weekday()>4:continue
        url=f'https://www.sec.gov/Archives/edgar/daily-index/{day.year}/QTR{(day.month-1)//3+1}/master.{day:%Y%m%d}.idx'
        try:
            body=ingest.fetch(url,ingest.INPUTS/f'national-index-{day}.txt',force=True);rows=parse_index(body);break
        except urllib.error.HTTPError as e:
            if e.code!=404:raise
            last_error=e
    else:raise RuntimeError('No published SEC daily index in the latest seven calendar days') from last_error
    # Catch up missed scheduled days within the retained discovery window.
    # Holidays have no published index; other failures still block publication.
    indexes=[dict(date=day.isoformat(),url=url,sha256=hashlib.sha256(body).hexdigest())]
    previous=prior.get('index_date')
    if previous:
        cursor=max(date.fromisoformat(previous)+timedelta(days=1),today-timedelta(days=90))
        while cursor<day:
            if cursor.weekday()<5:
                catch_url=f'https://www.sec.gov/Archives/edgar/daily-index/{cursor.year}/QTR{(cursor.month-1)//3+1}/master.{cursor:%Y%m%d}.idx'
                try:
                    catch_body=ingest.fetch(catch_url,ingest.INPUTS/f'national-index-{cursor}.txt')
                    rows.extend(parse_index(catch_body))
                    indexes.append(dict(date=cursor.isoformat(),url=catch_url,sha256=hashlib.sha256(catch_body).hexdigest()))
                except urllib.error.HTTPError as e:
                    if e.code!=404:raise
            cursor+=timedelta(days=1)
    cutoff=(today-timedelta(days=90)).isoformat()
    entries={r['accession']:r for r in prior['entries'] if r['filed_date']>=cutoff}
    for r in rows:
        if r['accession'] not in entries:entries[r['accession']]=r
    seed_rows,seed=bootstrap(today,prior.get('geographic_seed'))
    for r in seed_rows:
        if r['accession'] not in entries:entries[r['accession']]=r
    if seed_rows:
        print('NATIONAL GEOGRAPHIC SEED',seed['cities_queued'],'mailing cities queued for primary validation',flush=True)
    people,latest,checked,failures={},{},[],[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        futures={pool.submit(inspect,r):r for r in entries.values()}
        for i,future in enumerate(concurrent.futures.as_completed(futures),1):
            row=futures[future]
            try:
                entry,person=future.result();checked.append(entry)
                if person:ingest.merge_person(people,latest,person,row['filed_date'],row['accession'])
            except Exception as e:failures.append({'accession':row['accession'],'error':str(e)})
            if i%25==0 or i==len(entries):print('NATIONAL',i,'/',len(entries),'checked;',len(people),'identities;',len(failures),'failures',flush=True)
    if failures:raise RuntimeError('National SEC refresh incomplete; last good catalog retained: '+json.dumps(failures))
    manifest={'version':'mocean-national-form4-v1','index_date':day.isoformat(),'index_url':url,'index_sha256':hashlib.sha256(body).hexdigest(),'indexes_checked':sorted(indexes,key=lambda r:r['date']),'checked_at':datetime.now(timezone.utc).isoformat(),'retention_days':90,'geographic_seed':seed,'entries':sorted(checked,key=lambda r:r['accession'])}
    tmp=STATE.with_suffix('.json.tmp');tmp.write_text(json.dumps(manifest,indent=2));tmp.replace(STATE)
    return manifest,list(people.values())

def merge(records):
    manifest,new=refresh();by_id={p['id']:p for p in records}
    from geo_enrichment import enrich
    for p in new:
        if p['id'] in by_id:
            old=by_id[p['id']];known={e['id'] for e in old['events']};previous=max((e['filed_date'] for e in old['events']),default='')
            old['events'].extend(e for e in p['events'] if e['id'] not in known)
            if max(e['filed_date'] for e in p['events'])>previous:
                enrich(p['location'],ROOT/'geography.json');old['role'],old['location']=p['role'],p['location']
        else:
            enrich(p['location'],ROOT/'geography.json');p.update(source_classes=['FORM4'],convergence=0);records.append(p);by_id[p['id']]=p
    for p in records:
        p['events']=sorted({e['id']:e for e in p['events']}.values(),key=lambda e:(e['date'],e['id']),reverse=True)
        p['liquidity_total']=round(sum(e['value'] or 0 for e in p['events'] if e['classification']=='LIQUIDITY'),2)
        p['signal_type']='Liquidity' if any(e['classification']=='LIQUIDITY' for e in p['events']) else 'Monitor'
    return dict(index_date=manifest['index_date'],index_url=manifest['index_url'],checked_at=manifest['checked_at'],scope='All Form 4 / 4-A accessions in the latest published SEC daily index, plus a primary-validated geographic seed and 90-day discovery retention; not exhaustive historical or non-SEC coverage',geographic_seed=manifest['geographic_seed'],discovered_filings=len(manifest['entries']),validated_filings=sum(r['status']=='VALIDATED' for r in manifest['entries']),held_filings=[r for r in manifest['entries'] if r['status']=='HELD'],amendments=[dict(issuer_cik=r.get('issuer_cik'),accession=r['accession'],filed_date=r['filed_date'],status=r['reason']) for r in manifest['entries'] if r['status']=='AMENDMENT_REVIEW'])

if __name__=='__main__':
    manifest,people=refresh();print(json.dumps({'index_date':manifest['index_date'],'filings':len(manifest['entries']),'people':len(people)},indent=2))
