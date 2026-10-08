import json, unittest
from pathlib import Path
from form144 import parse
from reviewed_triggers import validate
ROOT=Path(__file__).resolve().parent
class Notices(unittest.TestCase):
 def setUp(self):
  self.records=json.loads((ROOT/'fixture-catalog.json').read_text())['records']
  self.body=(ROOT/'0001950047-26-008035.xml').read_bytes()
 def parse(self,body=None,records=None):return parse(body or self.body,'0001950047-26-008035','2026-08-12','https://www.sec.gov/source',records or self.records,'1653477')
 def test_notice(self):
  p,events=self.parse();self.assertEqual(int(p['person_cik']),1436880)
  self.assertEqual(events[0]['proposed_market_value'],1562956.68);self.assertIsNone(events[0]['value']);self.assertTrue(events[0]['planned'])
 def test_ambiguous(self):
  p,_=self.parse()
  with self.assertRaises(ValueError):self.parse(records=[p,p])
 def test_subject(self):
  with self.assertRaises(ValueError):self.parse(body=self.body.replace(b'DAVID H LI ',b'UNKNOWN SUBJECT'))
 def test_bad_amount(self):
  with self.assertRaises(ValueError):self.parse(body=self.body.replace(b'1562956.68',b'NaN'))
 def test_issuer(self):
  with self.assertRaises(ValueError):self.parse(body=self.body.replace(b'<issuerCik>0001653477',b'<issuerCik>0001280058'))
 def test_anonymous_lottery(self):
  import hashlib
  p=self.records[0];name=p['person_name'];body=('<p>'+name+' Award</p>').encode()
  entry={'trigger_type':'LOTTERY_AWARD','stage':'ANNOUNCED','person_id':p['id'],'issuer_cik':p['issuer_cik'],'subject_name':name,'sha256':hashlib.sha256(body).hexdigest(),'date':'2026-09-01','source_url':'https://official.example/award','source_authority':'QA fixture only','required_terms':['Award'],'relationship_evidence':'QA fixture','named_public_winner':False}
  with self.assertRaisesRegex(ValueError,'Anonymous'):validate(entry,p,body)
if __name__=='__main__':unittest.main()
