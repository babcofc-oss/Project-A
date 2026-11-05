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
            self.assertEqual(len(event['evidence_sources']),len(entry['sources']))

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

    def test_separate_relationship_requires_company_in_anchor(self):
        entry=copy.deepcopy(self.entries[0])
        entry['relationship_source_url']=entry['sources'][0]['source_url']
        with self.assertRaisesRegex(ValueError,'relationship'):validate(entry)

    def test_separate_relationship_requires_retained_source(self):
        entry=copy.deepcopy(self.entries[-1])
        entry['relationship_source_url']='https://example.com/missing'
        with self.assertRaisesRegex(ValueError,'relationship'):validate(entry)

    def test_explicit_relationship_source_preserves_existing_record(self):
        entry=copy.deepcopy(self.entries[-1])
        expected=validate(entry)
        entry['relationship_source_url']=entry['sources'][0]['source_url']
        self.assertEqual(validate(entry),expected)

    def test_person_mention_alone_does_not_establish_founder(self):
        entry=copy.deepcopy(self.entries[-1])
        entry['relationship_anchor']='Erik Soiferman'
        with self.assertRaisesRegex(ValueError,'Founder relationship'):validate(entry)

    def test_identity_and_refresh_idempotence(self):
        self.assertNotEqual(entity_id(self.entries[0]),entity_id(self.entries[1]))
        records=[];first=merge(records);ids=[p['id'] for p in records]
        second=merge(records)
        self.assertEqual(first,second);self.assertEqual(ids,[p['id'] for p in records])
        self.assertEqual(len(records),len({entity_id(entry) for entry in self.entries}))

if __name__=='__main__':unittest.main()
