"""Validated SEC snapshot publisher. No serverless filesystem persistence.

Adapted from v9 live_ingestion.py: discovery, fetch, XML parsing, entity resolution.
Run locally, review data/catalog.json, then commit snapshot + evidence together.
Failures retain the last valid catalog; unvalidated inputs never become facts.
"""
import concurrent.futures, hashlib, json, os, re, threading, time, urllib.request, urllib.error
import xml.etree.ElementTree as ET
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path

ROOT = Path(__file__).resolve().parent
INPUTS = ROOT / '.ingestion-cache'
ISSUERS = list(dict.fromkeys(c.strip() for c in os.getenv('PROJECT_A_ISSUERS', '1653477,1280058,910638,918965,857855,1090009,932781,1140859,59558,1166691,890926,794170,37785').split(',')))
ISSUERS = [c.strip() for c in ISSUERS]
if not ISSUERS or any(not c.isdigit() or not 1 <= len(c) <= 10 for c in ISSUERS):
    raise ValueError('PROJECT_A_ISSUERS must be a comma-separated list of valid SEC issuer CIKs')
UA = os.getenv('PROJECT_A_USER_AGENT', 'Project A public financial disclosure research Briton Barrett')
LOCK = threading.Lock()
LAST = 0
NOT_BEFORE = 0
TODAY = date.today()

def fetch(url, dest, force=False):
    global LAST, NOT_BEFORE
    if dest.exists() and not force:
        return dest.read_bytes()
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept-Encoding': 'identity'})
    for attempt in range(3):
        # Pace starts globally; network I/O can overlap across three workers.
        # Every new attempt still honors the shared SEC cooldown.
        with LOCK:
            delay = max(LAST + .6, NOT_BEFORE) - time.monotonic()
            if delay > 0: time.sleep(delay)
            LAST = time.monotonic()
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                body = response.read()
            break
        except urllib.error.HTTPError as error:
            if error.code not in (403, 429, 500, 502, 503, 504):raise
            cooldown = 60 * (attempt + 1)
            retry_after = error.headers.get('Retry-After', '') if error.headers else ''
            if retry_after.isdigit():cooldown = max(cooldown, min(int(retry_after), 300))
            with LOCK:NOT_BEFORE = max(NOT_BEFORE,time.monotonic() + cooldown)
            if attempt == 2:raise
            print(f'SEC HTTP {error.code}; shared cooldown {cooldown}s before retry {attempt + 2}/3: {url}', flush=True)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(body)
    return body

def value(node, path):
    element = node.find(path)
    return (element.text or '').strip() if element is not None else None

def number(text):
    try:
        result = Decimal(text)
        return result if result.is_finite() and result >= 0 else None
    except (InvalidOperation, TypeError): return None

def classify(code, direction):
    if code == 'S' and direction == 'D': return 'LIQUIDITY'
    return {'F': 'TAX_WITHHOLDING', 'A': 'AWARD', 'M': 'EXERCISE_CONTEXT'}.get(code, 'OTHER_CONTEXT')

def xml_date(text):
    # xs:date permits Z or a numeric timezone after its civil date.
    match=re.fullmatch(r'(\d{4}-\d{2}-\d{2})(?:Z|([+-])(\d{2}):(\d{2}))?',text or '')
    if not match:raise ValueError('Invalid XML transaction date')
    if match[2] and (int(match[3])>14 or int(match[4])>59 or int(match[3])==14 and int(match[4])!=0):raise ValueError('Invalid XML date timezone')
    return date.fromisoformat(match[1]).isoformat()

def parse_xml(body, accession, source, filed):
    root = ET.fromstring(body)
    if root.tag != 'ownershipDocument': raise ValueError('Not ownership XML')
    if value(root, 'documentType') != '4': raise ValueError('Unsupported amendment/form')
    issuer = value(root, 'issuer/issuerCik')
    owners = root.findall('reportingOwner')
    if len(owners) != 1: raise ValueError('Joint filing requires manual resolution')
    owner = owners[0]
    person_cik = value(owner, 'reportingOwnerId/rptOwnerCik')
    name = value(owner, 'reportingOwnerId/rptOwnerName')
    if not issuer or not person_cik or not name: raise ValueError('Missing identity')
    company = value(root, 'issuer/issuerName')
    role = value(owner, 'reportingOwnerRelationship/officerTitle')
    if not role: role = 'Director' if value(owner, 'reportingOwnerRelationship/isDirector') in ('1','true') else 'Reporting owner'
    footnotes = {f.attrib['id']: ''.join(f.itertext()).strip() for f in root.findall('footnotes/footnote')}
    all_notes = ' '.join(footnotes.values())
    planned = value(root, 'aff10b5One') in ('1','true') or '10b5-1' in all_notes
    city = value(owner, 'reportingOwnerAddress/rptOwnerCity')
    state = value(owner, 'reportingOwnerAddress/rptOwnerState')
    # Preserve disclosed mailing city/state/ZIP; no street addresses or residential inference.
    location = {'city': city, 'state': state, 'kind': 'Reporting-person mailing city; residence UNKNOWN', 'source_url': source,
                'assertion_class': 'VERIFIED PUBLIC FACT', 'distance_miles': None}
    postal=value(owner,'reportingOwnerAddress/rptOwnerZipCode') or ''
    if len(postal)>=5 and postal[:5].isdigit():location['postal_code']=postal[:5]
    events = []
    for i, tx in enumerate(root.findall('nonDerivativeTable/nonDerivativeTransaction')):
        code = value(tx, 'transactionCoding/transactionCode')
        direction = value(tx, 'transactionAmounts/transactionAcquiredDisposedCode/value')
        shares = number(value(tx, 'transactionAmounts/transactionShares/value'))
        price = number(value(tx, 'transactionAmounts/transactionPricePerShare/value'))
        when = xml_date(value(tx, 'transactionDate/value'))
        if not when or date.fromisoformat(when) > TODAY: raise ValueError('Invalid/future transaction date')
        classification = classify(code, direction)
        amount = round(shares * price, 2) if shares is not None and price is not None else None
        remaining = number(value(tx, 'postTransactionAmounts/sharesOwnedFollowingTransaction/value'))
        linked = [footnotes.get(f.attrib.get('id'), '') for f in tx.findall('.//footnoteId')]
        summary = f'Form 4 reports {shares:,} shares, code {code}, on {when}.' if shares is not None else f'Form 4 code {code} on {when}; shares UNKNOWN.'
        if price is not None: summary += f" Reported price ${format(price, 'f')} per share."
        event = {'id': f'{accession}:{i}', 'accession': accession, 'row': i, 'date': when, 'filed_date': filed,
                 'code': code, 'direction': direction, 'classification': classification, 'shares': float(shares) if shares is not None else None,
                 'price': float(price) if price is not None else None, 'value': float(amount) if amount is not None else None,
                 'remaining_shares': float(remaining) if remaining is not None else None,
                 'planned': planned, 'fact': summary, 'footnotes': [f for f in linked if f],
                 'source_url': source, 'raw_path': accession + '.xml',
                 'sha256': hashlib.sha256(body).hexdigest(), 'assertion_class': 'VERIFIED PUBLIC FACT',
                 'value_class': 'CALCULATED FROM VERIFIED FACT' if amount is not None else 'UNKNOWN'}
        events.append(event)
    return {'id': f'person-{int(person_cik)}-issuer-{int(issuer)}', 'person_cik': person_cik, 'issuer_cik': issuer,
            'person_name': name, 'role': role, 'company': company, 'location': location, 'events': events}

def process(row):
    cik, accession, document, filed = row
    base = f'https://www.sec.gov/Archives/edgar/data/{int(cik)}/{accession.replace("-", "")}/'
    source = base + document
    raw_url = base + document.split('/')[-1]
    body = fetch(raw_url, ROOT / (accession + '.xml'))
    return parse_xml(body, accession, source, filed)

def merge_person(people, latest_filing, person, filed, accession):
    key = person['id']
    filing = (filed, accession)
    if key not in people:
        people[key] = person
    else:
        old = people[key]
        old['events'].extend(person['events'])
        # Filing order is stable across worker completion order, including
        # derivative-only disclosures with no non-derivative transaction rows.
        if filing > latest_filing[key]:
            old['role'], old['location'] = person['role'], person['location']
    latest_filing[key] = max(filing, latest_filing.get(key, filing))

def run():
    rows = []; submissions = {}; amendments = []
    for cik in ISSUERS:
        submission = json.loads(fetch(f'https://data.sec.gov/submissions/CIK{int(cik):010d}.json', INPUTS / ('submissions-' + cik + '-' + TODAY.isoformat() + '.json'), force=True))
        submissions[cik]=submission
        recent = submission['filings']['recent']
        for i, form in enumerate(recent['form']):
            if form == '4/A' and recent['filingDate'][i] >= '2026-06-01':
                amendments.append(dict(issuer_cik=cik, accession=recent['accessionNumber'][i], filed_date=recent['filingDate'][i], status='REVIEW REQUIRED; amended transactions not automatically reconciled'))
            if form == '4' and recent['filingDate'][i] >= '2026-06-01':
                rows.append((cik, recent['accessionNumber'][i], recent['primaryDocument'][i], recent['filingDate'][i]))
    people, latest_filing, errors = {}, {}, []
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        futures = {executor.submit(process, row): row for row in rows}
        for future in concurrent.futures.as_completed(futures):
            row = futures[future]
            try:
                person = future.result()
                merge_person(people, latest_filing, person, row[3], row[1])
                print(row[1], person['person_name'], len(person['events']), flush=True)
            except Exception as error:
                errors.append({'accession': row[1], 'error': str(error)})
                print('REJECTED', row[1], str(error), flush=True)
    if errors: raise RuntimeError("Form 4 refresh incomplete; retaining last good catalog: "+json.dumps(errors))
    records = []
    for person in people.values():
        # This adapter releases non-derivative rows only. Do not publish an
        # empty dossier or imply that derivative-only filings establish sales.
        if not person['events']: continue
        person['events'] = sorted({e['id']: e for e in person['events']}.values(), key=lambda e:(e['date'],e['id']), reverse=True)
        person['liquidity_total'] = round(sum(e['value'] or 0 for e in person['events'] if e['classification'] == 'LIQUIDITY'), 2)
        person['signal_type'] = 'Liquidity' if any(e['classification'] == 'LIQUIDITY' for e in person['events']) else 'Monitor'
        person['source_classes'] = ['FORM4']
        person['convergence'] = 0
        records.append(person)
    from geo_enrichment import enrich
    for person in records: enrich(person['location'], ROOT / 'geography.json')
    from transitions import merge_reviewed
    reviewed, transition_errors = merge_reviewed(records)
    from form144 import merge as merge_form144
    from reviewed_triggers import merge as merge_other
    proposed=merge_form144(records,submissions); other=merge_other(records)
    from leadership import merge as merge_leadership
    leadership=merge_leadership(records)
    from business_exits import merge as merge_business
    business=merge_business(records)
    from national import merge as merge_national
    national=merge_national(records)
    amendments=list({(str(int(e['issuer_cik'])),e['accession']):e for e in amendments+national['amendments'] if e.get('issuer_cik')}.values())
    from contacts import merge as merge_contacts
    contact_enrichment=merge_contacts(records)
    records.sort(key=lambda r:r['liquidity_total'], reverse=True)
    result = {'version':'project-a-feed-priority-1', 'validated_at':datetime.now(timezone.utc).isoformat(), 'coverage_start':'2026-06-01',
              'source':'SEC EDGAR', 'issuer_count':len({int(p['issuer_cik']) for p in records if p.get('issuer_cik') and any(e.get('source_class','FORM4')=='FORM4' for e in p['events'])}), 'configured_issuer_count':len(ISSUERS), 'refresh':'Primary-source validated snapshot; not a live stream', 'scoring_version':'money-in-motion-v6', 'amendment_review':amendments,
              'discovered_filings':len(set(r[1] for r in rows)|{r['accession'] for r in json.loads((ROOT/'national-discovery.json').read_text())['entries'] if r['form']=='4'}), 'validated_filings':len({e['accession'] for p in records for e in p['events'] if e.get('source_class','FORM4')=='FORM4'}), 'errors':errors, 'national_discovery':national,
              'leadership':leadership, 'contact_enrichment':contact_enrichment, 'business_exits':business, 'form144':proposed, 'reviewed_triggers':other, 'transition_filings':len(reviewed), 'transition_errors':transition_errors, 'records':records}
    if not records: raise RuntimeError('No validated records; retaining previous catalog')
    temporary=ROOT/'catalog.json.tmp'
    temporary.write_text(json.dumps(result, indent=2)); temporary.replace(ROOT/'catalog.json')
    print(json.dumps({'people':len(records),'liquidity_opportunities':sum(r['signal_type']=='Liquidity' for r in records),'errors':errors},indent=2))

if __name__ == '__main__': run()
