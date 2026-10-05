import unittest,json,copy,tempfile
from pathlib import Path
from datetime import date
import contacts
ROOT=Path(__file__).resolve().parent
class ContactIntegrity(unittest.TestCase):
 def setUp(self):
  self.catalog=json.loads((ROOT/'catalog.json').read_text());self.groups=json.loads((ROOT/'reviewed-contacts.json').read_text())['groups'];self.today=date(2026,10,5)
 def test_all_routes_have_retained_primary_provenance(self):
  report=contacts.merge(self.catalog['records'],today=self.today)
  self.assertEqual(report['errors'],[]);self.assertEqual(report['people_with_company_routes'],70);self.assertEqual(report['distinct_published_routes'],18);self.assertEqual(report['direct_contacts'],0)
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
   groups=copy.deepcopy(self.groups);groups[0]['company']='Unrelated firm';groups[-1]['person_ids']=['wrong-id']
   (root/'reviewed-contacts.json').write_text(json.dumps({'groups':groups}))
   report=contacts.merge(self.catalog['records'],root,self.today)
   self.assertEqual(len(report['errors']),2)
   for p in self.catalog['records']:
    if p['company'] in ['BLACKBAUD INC','Clear Lakes and Wetland Services']:self.assertEqual(p['contacts']['routes'],[])
 def test_refresh_idempotent_and_expiry_removes_old_routes(self):
  contacts.merge(self.catalog['records'],today=self.today);once=copy.deepcopy(self.catalog['records']);contacts.merge(self.catalog['records'],today=self.today);self.assertEqual(once,self.catalog['records'])
  report=contacts.merge(self.catalog['records'],today=date(2027,1,5));self.assertEqual(report['people_with_company_routes'],0)
  self.assertTrue(all(not p['contacts']['routes'] for p in self.catalog['records']))
if __name__=='__main__':unittest.main()
