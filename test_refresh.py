import json, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
import refresh

class RefreshTests(unittest.TestCase):
    def test_failed_attempt_retains_evidence_and_success_date(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            original={'validated_at':'2026-10-01T12:00:00Z','records':[{'id':'last-good'}]}
            (root/'catalog.json').write_text(json.dumps(original))
            with patch.object(refresh,'ROOT',root),patch.object(refresh.ingest,'run',side_effect=TimeoutError('SEC unavailable')):
                self.assertFalse(refresh.run())
            result=json.loads((root/'catalog.json').read_text())
            self.assertEqual(result['records'],original['records'])
            self.assertEqual(result['feed_health']['status'],'FAILED')
            self.assertEqual(result['feed_health']['last_success_at'],original['validated_at'])
    def test_revalidation_failure_rolls_back_new_catalog(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder); original={'validated_at':'2026-10-01','records':[]}
            (root/'catalog.json').write_text(json.dumps(original))
            def overwrite(): (root/'catalog.json').write_text(json.dumps({'validated_at':'2026-10-08','records':[{'events':[]}]}))
            with patch.object(refresh,'ROOT',root),patch.object(refresh.ingest,'run',side_effect=overwrite),patch.object(refresh,'validate_archives',side_effect=ValueError('changed source')):
                self.assertFalse(refresh.run())
            result=json.loads((root/'catalog.json').read_text())
            self.assertEqual(result['records'],[])
            self.assertEqual(result['validated_at'],original['validated_at'])

if __name__=='__main__': unittest.main()
