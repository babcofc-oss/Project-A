import hashlib, json, unittest
from pathlib import Path
from ingest import classify, parse_xml
from geo_enrichment import enrich

ROOT=Path(__file__).parent
CATALOG=json.loads((ROOT/'catalog.json').read_text())

class IntegrityTests(unittest.TestCase):
    def test_all_primary_evidence_hashes_and_identity(self):
        for person in CATALOG['records']:
            for event in person['events']:
                raw=(ROOT/event['raw_path']).read_bytes()
                self.assertEqual(hashlib.sha256(raw).hexdigest(),event['sha256'])
                if event.get('source_class')=='8K':continue
                if event.get('source_class')=='FORM144':
                    from form144 import parse
                    parsed,events=parse(raw,event['accession'],event['filed_date'],event['source_url'],CATALOG['records'],person['issuer_cik'])
                    self.assertEqual(parsed['id'],person['id']);self.assertIn(event['id'],[e['id'] for e in events]);self.assertIsNone(event['value']);continue
                parsed=parse_xml(raw,event['accession'],event['source_url'],event['filed_date'])
                self.assertEqual(parsed['id'],person['id'])
                self.assertIn(event['id'],[e['id'] for e in parsed['events']])
    def test_non_liquidity_codes(self):
        for code in ('F','A','M','G','P'):self.assertNotEqual(classify(code,'D'),'LIQUIDITY')
        self.assertEqual(classify('S','D'),'LIQUIDITY')
        self.assertNotEqual(classify('S','A'),'LIQUIDITY')
    def test_original_li_example_not_collapsed(self):
        li=next(p for p in CATALOG['records'] if int(p['person_cik'])==1436880)
        events=[e for e in li['events'] if e['accession']=='0001436880-26-000006']
        self.assertEqual(len(events),2)
        self.assertEqual(sum(e['value'] for e in events),761750)
        self.assertTrue(all(e['planned'] for e in events))
        self.assertEqual(int(li['issuer_cik']),1653477)
    def test_anderson_cluster_and_arithmetic(self):
        rows=[p for p in CATALOG['records'] if int(p['person_cik'])==1492840]
        self.assertEqual(len(rows),1)
        june=next(e for e in rows[0]['events'] if e['date']=='2026-06-01' and e['classification']=='LIQUIDITY')
        self.assertEqual(june['value'],194278.55)
        september=next(e for e in rows[0]['events'] if e['date']=='2026-09-01' and e['classification']=='LIQUIDITY')
        self.assertTrue(september['planned'])
    def test_graves_withholding_excluded_but_sales_retained(self):
        person=next(p for p in CATALOG['records'] if int(p['person_cik'])==1251036)
        withholding=next(e for e in person['events'] if e['accession']=='0001628280-26-061401')
        self.assertEqual(withholding['classification'],'TAX_WITHHOLDING')
        self.assertEqual(person['liquidity_total'],528065.3)
        self.assertNotEqual(person['liquidity_total'],sum(e['value'] or 0 for e in person['events']))
    def test_unique_people_rows_and_true_sale_sums(self):
        self.assertEqual(len(CATALOG['records']),len({p['id'] for p in CATALOG['records']}))
        for p in CATALOG['records']:
            self.assertEqual(len(p['events']),len({e['id'] for e in p['events']}))
            self.assertEqual(p['liquidity_total'],round(sum(e['value'] or 0 for e in p['events'] if e['classification']=='LIQUIDITY'),2))
    def test_geo_unknown_not_silently_in_radius(self):
        unknown={'city':'UNRESOLVED','state':'SC'}
        enrich(unknown,ROOT/'geography.json');self.assertIsNone(unknown['distance_miles'])
        known={'city':'NORTH CHARLESTON','state':'SC'}
        enrich(known,ROOT/'geography.json');self.assertAlmostEqual(known['distance_miles'],8.19)
    def test_malformed_xml_rejected(self):
        with self.assertRaises(Exception):parse_xml(b'<html>not a filing</html>','bad','bad','bad')

if __name__=='__main__':unittest.main()
