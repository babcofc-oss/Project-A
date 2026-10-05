import copy, json, unittest
from pathlib import Path
from business_exits import validate, merge, entity_id

ROOT=Path(__file__).resolve().parent

class BusinessExitIntegrity(unittest.TestCase):
    def setUp(self):
        self.entries=json.loads((ROOT/'reviewed-business-exits.json').read_text())

    def test_actual_primary_sources(self):
        for entry in self.entries:
            person=validate(entry)
            self.assertIsNone(person['person_cik'])
            self.assertIsNone(person['issuer_cik'])
            self.assertEqual(person['location']['basis'],'COMPANY_MARKET')
            self.assertIsNotNone(person['location'].get('place_geoid'))
            self.assertEqual(person['liquidity_total'],0)
            event=person['events'][0]
            self.assertIsNone(event['value'])
            self.assertEqual(event['cash_received'],'UNKNOWN')
            self.assertEqual(len(event['evidence_sources']),2)

    def test_tampered_fingerprint_fails(self):
        entry=copy.deepcopy(self.entries[0]);entry['sources'][0]['sha256']='0'*64
        with self.assertRaisesRegex(ValueError,'fingerprint'):validate(entry)

    def test_person_swap_fails(self):
        entry=copy.deepcopy(self.entries[0]);entry['subject_name']='Ken Robinson'
        with self.assertRaisesRegex(ValueError,'relationship'):validate(entry)

    def test_wrong_company_fails(self):
        entry=copy.deepcopy(self.entries[0]);entry['company']='Unsupported company'
        with self.assertRaisesRegex(ValueError,'relationship'):validate(entry)

    def test_invented_market_fails(self):
        entry=copy.deepcopy(self.entries[0]);entry['market_city']='Cincinnati'
        with self.assertRaisesRegex(ValueError,'market'):validate(entry)

    def test_announcement_not_completion(self):
        entry=copy.deepcopy(self.entries[0]);entry['stage']='ANNOUNCED'
        with self.assertRaisesRegex(ValueError,'completed'):validate(entry)

    def test_identity_and_refresh_idempotence(self):
        self.assertNotEqual(entity_id(self.entries[0]),entity_id(self.entries[1]))
        records=[];first=merge(records);ids=[p['id'] for p in records]
        second=merge(records)
        self.assertEqual(first,second);self.assertEqual(ids,[p['id'] for p in records])
        self.assertEqual(len(records),2)

if __name__=='__main__':unittest.main()
