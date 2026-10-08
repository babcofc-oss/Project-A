"""Atomic refresh with last-good retention and explicit source coverage.

Run python refresh.py. Discovery is fetched anew; immutable archives are cached.
Manual manifests are revalidated, never assigned a new human review date.
"""
import hashlib, json, sys
from datetime import datetime, timezone
from pathlib import Path
import ingest

ROOT = Path(__file__).resolve().parent

def publish(catalog):
    pending = ROOT/'catalog.json.tmp'
    pending.write_text(json.dumps(catalog, indent=2))
    pending.replace(ROOT/'catalog.json')

def validate_archives(catalog):
    for person in catalog['records']:
        for source in [*(person.get('contacts', {}).get('routes', [])), *person['events'], *[s for e in person['events'] for s in e.get('evidence_sources', [])]]:
            path=(ROOT/source['raw_path']).resolve()
            if not path.is_relative_to(ROOT) or hashlib.sha256(path.read_bytes()).hexdigest()!=source['sha256']:
                raise ValueError('Retained evidence fingerprint mismatch')

def run():
    old=json.loads((ROOT/'catalog.json').read_text())
    attempted=datetime.now(timezone.utc).isoformat()
    try:
        ingest.run()
        current=json.loads((ROOT/'catalog.json').read_text())
        if any(e.get('kind')=='FETCH_FAILURE' for e in current.get('form144',{}).get('errors',[])):
            raise RuntimeError('Form 144 fetch incomplete; retaining last good catalog')
        validate_archives(current)
        current['feed_health']={
            'last_attempt_at':attempted, 'last_success_at':current['validated_at'],
            'status':'OK', 'freshness_target_hours':48,
            'automatic_scope':'Form 4 and Form 144 discovery for configured issuers only',
            'issuer_ciks':ingest.ISSUERS,
            'manual_review':'Executive / board events, private acquisitions and contacts require reviewed primary evidence; a successful SEC fetch does not refresh them.',
            'unconnected':['IPO / lockup','Property sales','Inheritance','Lottery awards','Ownership changes'],
            'errors':[],
            'held_form144':len(current.get('form144',{}).get('errors',[])),
            'amendments_pending':len(current.get('amendment_review',[]))}
        publish(current)
        print('REFRESH SUCCESS', current['validated_at'])
        return True
    except Exception as error:
        previous=old.get('feed_health',{})
        old['feed_health']={**previous, 'status':'FAILED', 'last_attempt_at':attempted,
            'last_success_at':previous.get('last_success_at',old['validated_at']),
            'freshness_target_hours':48, 'errors':[str(error)]}
        publish(old)
        print('REFRESH FAILED; last good evidence retained:',str(error),file=sys.stderr)
        return False

if __name__=='__main__': sys.exit(0 if run() else 1)
