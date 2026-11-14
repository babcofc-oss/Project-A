import unittest
from pathlib import Path
from geo_enrichment import enrich
ROOT=Path(__file__).parent
class GeographicReleaseTests(unittest.TestCase):
    def test_headquarters_without_postal_code_carries_searchable_census_point(self):
        loc={'city':'Cincinnati','state':'OH','basis':'COMPANY_HEADQUARTERS','kind':'Company headquarters; personal location UNKNOWN'}
        enrich(loc,ROOT/'geography.json')
        self.assertEqual(loc['place_geoid'],'3915000')
        self.assertTrue(38<loc['reference_lat']<40)
        self.assertTrue(-85<loc['reference_lon']<-83)
        self.assertIn('company headquarters',loc['geo_method'])
        self.assertIn('residence UNKNOWN',loc['geo_method'])
    def test_service_market_remains_company_scoped(self):
        loc={'city':'Charleston','state':'SC','kind':'Company service market; personal location UNKNOWN'}
        enrich(loc,ROOT/'geography.json')
        self.assertEqual(loc['place_geoid'],'4513330')
        self.assertIn('company service market',loc['geo_method'])
        self.assertIn('reference_lat',loc)
    def test_unknown_changed_location_cannot_keep_a_stale_reference_point(self):
        loc={'city':'NOT APPLICABLE','state':'DE','reference_lat':32.8,'reference_lon':-79.9,'reference_zip':'29412','place_geoid':'4513330'}
        enrich(loc,ROOT/'geography.json')
        self.assertIsNone(loc['distance_miles'])
        self.assertNotIn('reference_lat',loc)
        self.assertNotIn('reference_zip',loc)
        self.assertNotIn('place_geoid',loc)
if __name__=='__main__':unittest.main()
