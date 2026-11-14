import json,tempfile,unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError
import national

class IndexCalendarTests(unittest.TestCase):
    def test_official_listing_is_fingerprinted_and_reused_per_quarter(self):
        raw=json.dumps({'directory':{'name':'daily-index/2026/QTR4/','item':[{'name':'master.20261110.idx'},{'name':'master.20261112.idx'},{'name':'master.20261113.idx'},{'name':'../../bad'}]}}).encode()
        with patch.object(national.ingest,'fetch',return_value=raw) as fetch:
            cache={};a=national.published_index_dates(date(2026,11,14),cache);b=national.published_index_dates(date(2026,11,11),cache)
        self.assertIs(a,b);self.assertEqual(fetch.call_count,1)
        self.assertNotIn('master.20261111.idx',a['names']);self.assertEqual(len(a['sha256']),64)
    def test_wrong_directory_and_unavailable_listing_block_release(self):
        for body in (b'{"directory":{"name":"wrong","item":[]}}',b'{"directory":{"name":"daily-index/2026/QTR4/","item":[]}}'):
            with patch.object(national.ingest,'fetch',return_value=body):
                with self.assertRaises(ValueError):national.published_index_dates(date(2026,11,14),{})
        with patch.object(national.ingest,'fetch',side_effect=HTTPError('source',403,'Forbidden',{},None)):
            with self.assertRaises(HTTPError):national.published_index_dates(date(2026,11,14),{})
    def test_unpublished_catchup_day_skipped_but_published_failure_is_fatal(self):
        listing={'url':'https://www.sec.gov/Archives/edgar/daily-index/2026/QTR4/index.json','sha256':'a'*64,'names':{'master.20261112.idx','master.20261113.idx'}}
        def fetch(url,*args,**kwargs):
            self.assertNotIn('20261111.idx',url)
            day=url.split('master.')[1][:8];return f'1|QA|4|{day}|edgar/data/1/0000000001-26-{int(day[-2:]):06d}.txt'.encode()
        with tempfile.TemporaryDirectory() as d:
            state=Path(d)/'national-discovery.json';state.write_text(json.dumps({'index_date':'2026-11-10','entries':[]}))
            with patch.object(national,'STATE',state),patch.object(national,'published_index_dates',return_value=listing),patch.object(national.ingest,'fetch',side_effect=fetch),patch.object(national,'bootstrap',return_value=([],{})),patch.object(national,'inspect',side_effect=lambda r:({**r,'status':'HELD','reason':'QA'},None)):
                manifest,_=national.refresh(date(2026,11,14))
            self.assertEqual([r['date'] for r in manifest['indexes_checked']],['2026-11-12','2026-11-13'])
            self.assertEqual(manifest['unpublished_dates'][0]['date'],'2026-11-11')
            original=state.read_bytes()
            with patch.object(national,'STATE',state),patch.object(national,'published_index_dates',return_value=listing),patch.object(national.ingest,'fetch',side_effect=HTTPError('published',403,'Forbidden',{},None)):
                with self.assertRaises(HTTPError):national.refresh(date(2026,11,14))
            self.assertEqual(state.read_bytes(),original)

if __name__=='__main__':unittest.main()
