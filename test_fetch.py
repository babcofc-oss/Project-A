import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError
import ingest
from copy import deepcopy


class FetchTests(unittest.TestCase):
    def test_empty_transaction_filing_and_worker_order_preserve_latest_metadata(self):
        old = {'id': 'same-owner', 'role': 'Old role', 'location': {'city': 'Old city'}, 'events': [{'id': 'sale', 'value': 100}]}
        latest = {'id': 'same-owner', 'role': 'New role', 'location': {'city': 'New city'}, 'events': []}
        rows = [(old, '2026-10-01', 'older'), (latest, '2026-10-29', 'newer')]
        for ordered in (rows, rows[::-1]):
            people, filings = {}, {}
            for person, filed, accession in ordered:
                ingest.merge_person(people, filings, deepcopy(person), filed, accession)
            self.assertEqual(people['same-owner']['role'], 'New role')
            self.assertEqual(people['same-owner']['location'], latest['location'])
            self.assertEqual(people['same-owner']['events'], old['events'])

    def test_temporary_sec_denial_recovers_after_shared_cooldown(self):
        response = MagicMock()
        response.__enter__.return_value.read.return_value = b'verified-source'
        denied = HTTPError('https://www.sec.gov/test', 403, 'Forbidden', {}, None)
        with tempfile.TemporaryDirectory() as folder:
            dest = Path(folder) / 'source.xml'
            with patch.object(ingest, 'LAST', 0), patch.object(ingest, 'NOT_BEFORE', 0), patch.object(ingest.time, 'monotonic', return_value=1000), patch.object(ingest.time, 'sleep') as sleep, patch.object(ingest.urllib.request, 'urlopen', side_effect=[denied, response]) as request:
                self.assertEqual(ingest.fetch(denied.url, dest), b'verified-source')
                self.assertEqual(request.call_count, 2)
                sleep.assert_called_once_with(60)
            self.assertEqual(dest.read_bytes(), b'verified-source')

    def test_persistent_denial_is_bounded_and_never_cached(self):
        denied = HTTPError('https://www.sec.gov/test', 403, 'Forbidden', {}, None)
        with tempfile.TemporaryDirectory() as folder:
            dest = Path(folder) / 'source.xml'
            with patch.object(ingest, 'LAST', 0), patch.object(ingest, 'NOT_BEFORE', 0), patch.object(ingest.time, 'sleep'), patch.object(ingest.urllib.request, 'urlopen', side_effect=denied) as request:
                with self.assertRaises(HTTPError): ingest.fetch(denied.url, dest)
                self.assertEqual(request.call_count, 3)
            self.assertFalse(dest.exists())

    def test_non_retryable_error_fails_immediately(self):
        missing = HTTPError('https://www.sec.gov/test', 404, 'Not Found', {}, None)
        with tempfile.TemporaryDirectory() as folder, patch.object(ingest, 'LAST', 0), patch.object(ingest, 'NOT_BEFORE', 0), patch.object(ingest.urllib.request, 'urlopen', side_effect=missing) as request:
            with self.assertRaises(HTTPError): ingest.fetch(missing.url, Path(folder) / 'missing')
            self.assertEqual(request.call_count, 1)

    def test_retry_after_is_shared_and_bounded(self):
        limited = HTTPError('https://www.sec.gov/test', 429, 'Rate limited', {'Retry-After': '9999'}, None)
        response = MagicMock()
        response.__enter__.return_value.read.return_value = b'source'
        with tempfile.TemporaryDirectory() as folder, patch.object(ingest, 'LAST', 0), patch.object(ingest, 'NOT_BEFORE', 0), patch.object(ingest.time, 'monotonic', return_value=1000), patch.object(ingest.time, 'sleep') as sleep, patch.object(ingest.urllib.request, 'urlopen', side_effect=[limited, response]):
            ingest.fetch(limited.url, Path(folder) / 'source')
            sleep.assert_called_once_with(300)

    def test_retained_archive_needs_no_request(self):
        with tempfile.TemporaryDirectory() as folder:
            dest = Path(folder) / 'source.xml'
            dest.write_bytes(b'retained')
            with patch.object(ingest.urllib.request, 'urlopen') as request:
                self.assertEqual(ingest.fetch('https://www.sec.gov/test', dest), b'retained')
                request.assert_not_called()


if __name__ == '__main__': unittest.main()
