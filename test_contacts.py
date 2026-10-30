import unittest,json,copy,tempfile
from pathlib import Path
from datetime import date
import contacts
ROOT=Path(__file__).resolve().parent
class ContactIntegrity(unittest.TestCase):
 def setUp(self):
  self.catalog=json.loads((ROOT/'fixture-catalog.json').read_text());self.today=date(2026,10,5)
  self.groups=[g for g in json.loads((ROOT/'reviewed-contacts.json').read_text())['groups'] if date.fromisoformat(g['reviewed_at'])<=self.today]
  self.fixture=tempfile.TemporaryDirectory();self.addCleanup(self.fixture.cleanup);self.root=Path(self.fixture.name)
  (self.root/'reviewed-contacts.json').write_text(json.dumps({'groups':self.groups}))
  for g in self.groups:(self.root/g['raw_path']).write_bytes((ROOT/g['raw_path']).read_bytes())
 def test_all_routes_have_retained_primary_provenance(self):
  report=contacts.merge(self.catalog['records'],root=self.root,today=self.today)
  self.assertEqual(report['errors'],[]);self.assertEqual(report['people_with_company_routes'],70);self.assertEqual(report['distinct_published_routes'],25);self.assertEqual(report['direct_contacts'],0)
  for p in self.catalog['records']:
   self.assertEqual(p['contacts']['direct_email'],'UNKNOWN')
   self.assertEqual(p['contacts']['direct_phone'],'UNKNOWN')
   for r in p['contacts']['routes']:self.assertTrue((ROOT/r['raw_path']).is_file())
 def test_expiry_future_wrong_authority_direct_and_unpublished_fail_closed(self):
  for change in [{'reviewed_at':'2026-06-01'},{'reviewed_at':'2026-10-06'},{'source_url':'https://wrong.example/contact'},{'scope':'DIRECT_PERSON'}]:
   g=copy.deepcopy(self.groups[0]);g.update(change)
   with self.assertRaises(ValueError):contacts.validate(g,today=self.today)
  g=copy.deepcopy(self.groups[0]);g['routes'][1]['target']='+18005551212'
  with self.assertRaises(ValueError):contacts.validate(g,today=self.today)
  g=copy.deepcopy(self.groups[0]);g['routes'][1]['anchor']='UNPUBLISHED fabricated email'
  with self.assertRaises(ValueError):contacts.validate(g,today=self.today)
 def test_fingerprint_and_unsafe_path_rejected(self):
  for patch in [{'sha256':'0'*64},{'raw_path':'../contact-source-secret.txt'}]:
   g=copy.deepcopy(self.groups[0]);g.update(patch)
   with self.assertRaises(ValueError):contacts.validate(g,today=self.today)
 def test_exact_company_cik_and_founder_id_binding(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d)
   for g in self.groups:(root/g['raw_path']).write_bytes((ROOT/g['raw_path']).read_bytes())
   groups=copy.deepcopy(self.groups);groups[0]['company']='Unrelated firm';groups[8]['person_ids']=['wrong-id']
   (root/'reviewed-contacts.json').write_text(json.dumps({'groups':groups}))
   report=contacts.merge(self.catalog['records'],root,self.today)
   self.assertEqual(len(report['errors']),2)
   for p in self.catalog['records']:
    if p['company']=='BLACKBAUD INC':self.assertFalse(any(r['scope']=='COMPANY_CHANNEL' for r in p['contacts']['routes']))
    if p['company']=='Clear Lakes and Wetland Services':self.assertEqual(p['contacts']['routes'],[])
 def test_named_routes_cannot_leak_to_colleagues_or_wrong_identity(self):
  report=contacts.merge(self.catalog['records'],root=self.root,today=self.today)
  self.assertEqual(report['people_with_named_contacts'],1)
  named=[p for p in self.catalog['records'] if any(r['scope']=='NAMED_PROFESSIONAL' for r in p['contacts']['routes'])]
  self.assertEqual([p['id'] for p in named],['person-1243370-issuer-1090009'])
  emails=[r['target'] for r in named[0]['contacts']['routes'] if r['scope']=='NAMED_PROFESSIONAL' and r['kind']=='EMAIL']
  self.assertEqual(emails,['aseaver@southernfirst.com'])
  g=copy.deepcopy(self.groups[9]);g['person_ids']=['person-1243366-issuer-1090009']
  with self.assertRaises(ValueError):contacts.validate(g,today=self.today)
  g=copy.deepcopy(self.groups[9]);g['routes'][2]['target']=g['routes'][2]['value']='guessed@southernfirst.com'
  with self.assertRaises(ValueError):contacts.validate(g,today=self.today)
  g=copy.deepcopy(self.groups[9]);g['routes'][1].update(target='+18776799646',value='+1 877 679 9646',anchor='877-679-9646')
  with self.assertRaises(ValueError):contacts.validate(g,today=self.today)
  g=copy.deepcopy(self.groups[10]);g['routes'].append(copy.deepcopy(self.groups[0]['routes'][1]))
  with self.assertRaises(ValueError):contacts.validate(g,today=self.today)
 def test_refresh_idempotent_and_expiry_removes_old_routes(self):
  contacts.merge(self.catalog['records'],root=self.root,today=self.today);once=copy.deepcopy(self.catalog['records']);contacts.merge(self.catalog['records'],root=self.root,today=self.today);self.assertEqual(once,self.catalog['records'])
  report=contacts.merge(self.catalog['records'],root=self.root,today=date(2027,1,5));self.assertEqual(report['people_with_company_routes'],0)
  self.assertTrue(all(not p['contacts']['routes'] for p in self.catalog['records']))
 def test_new_market_routes_keep_exact_issuer_scope_and_no_named_contact_claim(self):
  current=json.loads((ROOT/'catalog.json').read_text());before=copy.deepcopy(current['records'])
  report=contacts.merge(current['records'],today=date(2026,10,30));self.assertEqual(report['errors'],[])
  issuers={'0001140859','0000890926','0000037785','0001166691','0000794170','0000059558'}
  added=[p for p in current['records'] if p.get('issuer_cik') in issuers];self.assertGreater(len(added),0)
  for p in added:
   self.assertTrue(p['contacts']['routes']);self.assertTrue(all(r['scope']=='COMPANY_CHANNEL' and r['person_id'] is None for r in p['contacts']['routes']))
   self.assertEqual(p['contacts']['direct_email'],'UNKNOWN');self.assertEqual(p['contacts']['direct_phone'],'UNKNOWN')
  for old,new in zip(before,current['records']):
   self.assertEqual(old['events'],new['events']);self.assertEqual(old['liquidity_total'],new['liquidity_total'])
  sec=next(g for g in json.loads((ROOT/'reviewed-contacts.json').read_text())['groups'] if g['issuer_cik']=='0000059558')
  sec['source_url']=sec['source_url'].replace('/59558/','/1140859/')
  with self.assertRaisesRegex(ValueError,'issuer mismatch'):contacts.validate(sec,today=date(2026,10,30))
if __name__=='__main__':unittest.main()
