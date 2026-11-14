"""Regression: reviewable joint filings must not freeze unrelated source refreshes."""
import hashlib
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import ingest

class ReleaseGateTests(unittest.TestCase):
    def test_real_joint_filing_is_reviewable_not_released(self):
        body=(ingest.ROOT/'0001140361-26-043461.xml').read_bytes()
        with self.assertRaises(ingest.ManualReviewRequired):
            ingest.parse_xml(body,'0001140361-26-043461','https://www.sec.gov/source','2026-11-12')

    def test_review_hold_keeps_evidence_and_other_people(self):
        rows=[('2','0000000001-26-000001','joint.xml','2026-11-12'),('2','0000000001-26-000002','valid.xml','2026-11-12')]
        person={'id':'person-1-issuer-2','person_name':'QA','role':'Director','location':{},'events':[{'id':'qa'}]}
        def process(row):
            if row==rows[0]:raise ingest.ManualReviewRequired('Joint filing requires manual resolution')
            return person
        with tempfile.TemporaryDirectory() as d,patch.object(ingest,'ROOT',Path(d)),patch.object(ingest,'process',side_effect=process):
            raw=Path(d)/(rows[0][1]+'.xml');raw.write_bytes(b'QA retained evidence')
            people,held=ingest.collect_filings(rows)
        self.assertEqual(list(people),[person['id']])
        self.assertEqual(len(held),1)
        self.assertEqual(held[0]['sha256'],hashlib.sha256(b'QA retained evidence').hexdigest())
        self.assertEqual(held[0]['kind'],'MANUAL_IDENTITY_REVIEW')
        self.assertEqual(held[0]['status'],'HELD')

    def test_transport_or_unexpected_validation_still_blocks_release(self):
        row=('2','0000000001-26-000001','source.xml','2026-11-12')
        for error in (TimeoutError('network down'),ValueError('Configured issuer identity mismatch')):
            with patch.object(ingest,'process',side_effect=error):
                with self.assertRaisesRegex(RuntimeError,'last good catalog'):
                    ingest.collect_filings([row])

    def test_held_source_fingerprints_are_validated_before_publication(self):
        import refresh
        with tempfile.TemporaryDirectory() as d,patch.object(refresh,'ROOT',Path(d)):
            raw=Path(d)/'held.xml';raw.write_bytes(b'original')
            catalog={'records':[], 'configured_held_filings':[{'raw_path':raw.name,'sha256':hashlib.sha256(raw.read_bytes()).hexdigest()}]}
            refresh.validate_archives(catalog)
            raw.write_bytes(b'changed')
            with self.assertRaisesRegex(ValueError,'Held evidence fingerprint'):refresh.validate_archives(catalog)

    def test_missing_hold_evidence_cannot_silently_publish(self):
        row=('2','0000000001-26-000001','source.xml','2026-11-12')
        with tempfile.TemporaryDirectory() as d,patch.object(ingest,'ROOT',Path(d)),patch.object(ingest,'process',side_effect=ingest.ManualReviewRequired('review')):
            with self.assertRaises(FileNotFoundError):ingest.collect_filings([row])

if __name__=='__main__':unittest.main()
