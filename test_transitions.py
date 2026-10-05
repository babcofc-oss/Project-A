import copy, json, unittest
from pathlib import Path
from transitions import reviewed_event, merge_reviewed
ROOT=Path(__file__).parent
MANIFEST=json.loads((ROOT/'reviewed-transitions.json').read_text())
CATALOG=json.loads((ROOT/'catalog.json').read_text())
class ReviewedTransitionsTests(unittest.TestCase):
    def test_all_reviewed_relationships_and_no_liquidity(self):
        for entry in MANIFEST:
            person=next(p for p in CATALOG['records'] if p['id']==entry['person_id'])
            event=reviewed_event(entry,person,(ROOT/entry['raw_path']).read_bytes())
            self.assertIsNone(event['value']);self.assertEqual(event['cash_received'],'UNKNOWN')
            self.assertTrue(event['status']);self.assertTrue(event['subject_name'])
    def test_changed_evidence_fails_closed(self):
        entry=MANIFEST[0];p=next(p for p in CATALOG['records'] if p['id']==entry['person_id'])
        with self.assertRaises(ValueError):reviewed_event(entry,p,b'changed')
    def test_signer_is_not_event_subject(self):
        entry=copy.deepcopy(next(e for e in MANIFEST if e['subject_name']=='Ryan Cotterman'))
        signer=next(p for p in CATALOG['records'] if p['person_name']=='Fisher Ryan C.')
        entry['person_id']=signer['id']
        with self.assertRaises(ValueError):reviewed_event(entry,signer,(ROOT/entry['raw_path']).read_bytes())
    def test_refresh_deduplicates_and_preserves_stock_totals(self):
        records=copy.deepcopy(CATALOG['records'])
        for _ in range(2):
            accepted,errors=merge_reviewed(records,ROOT);self.assertEqual(len(accepted),5);self.assertFalse(errors)
        self.assertEqual(sum(e.get('source_class')=='8K' for p in records for e in p['events']),5)
        for p in records:
            self.assertEqual(len(p['events']),len({e['id'] for e in p['events']}))
            self.assertEqual(p['liquidity_total'],round(sum(e['value'] or 0 for e in p['events'] if e['classification']=='LIQUIDITY'),2))
if __name__=='__main__':unittest.main()
