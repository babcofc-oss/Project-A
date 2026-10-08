import copy, json, tempfile, unittest
from pathlib import Path
from leadership import validate, merge, ROOT

ENTRIES=json.loads((ROOT/'reviewed-leadership.json').read_text())

class LeadershipTests(unittest.TestCase):
    def test_named_events_preserve_uncertainty(self):
        for entry in ENTRIES:
            person=validate(entry)
            self.assertIsNone(person['person_cik'])
            self.assertEqual(person['location']['basis'],'COMPANY_HEADQUARTERS')
            self.assertIsNone(person['events'][0]['value'])
            self.assertEqual(person['events'][0]['cash_received'],'UNKNOWN')
            self.assertIn('UNKNOWN',person['location']['kind'])
            self.assertTrue(person['ai_note']['source_accessions'])

    def test_wrong_subject_issuer_and_unreviewed_stage_rejected(self):
        for changes in ({'subject_name':'Sandra T. Lane'}, {'issuer_cik':'56873'}, {'stage':'COMPLETED'}, {'date':'2099-01-01'}, {'sha256':'0'*64}, {'location_city':'Charleston'}, {'source_url':'https://example.com/source'}):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                validate(ENTRIES[0]|changes)

    def test_refresh_idempotent_and_changed_source_withheld(self):
        records=[]
        for _ in range(2):
            result=merge(records)
            self.assertFalse(result['errors']);self.assertEqual(len(records),2)
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            (root/'reviewed-leadership.json').write_text(json.dumps(ENTRIES))
            (root/ENTRIES[0]['raw_path']).write_bytes(b'changed source')
            result=merge(records,root)
            self.assertEqual(records,[]);self.assertEqual(len(result['errors']),2)

    def test_signatory_not_discovered_as_prospect(self):
        names={validate(e)['person_name'] for e in ENTRIES}
        self.assertNotIn('Sandra T. Lane',names)

if __name__=='__main__':unittest.main()
