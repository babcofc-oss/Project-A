import copy,hashlib,json,tempfile,unittest,io,zipfile
from pathlib import Path
from unittest.mock import patch
from datetime import date
import national

ACCESSION='0000000001-26-000001'
ROW={'accession':ACCESSION,'form':'4','filed_date':'2026-10-01','filename':f'edgar/data/2/{ACCESSION}.txt','source_url':f'https://www.sec.gov/Archives/edgar/data/2/{ACCESSION}.txt'}
XML=b'''<?xml version="1.0"?><ownershipDocument><documentType>4</documentType><issuer><issuerCik>2</issuerCik><issuerName>QA ONLY</issuerName></issuer><reportingOwner><reportingOwnerId><rptOwnerCik>1</rptOwnerCik><rptOwnerName>QA PERSON</rptOwnerName></reportingOwnerId><reportingOwnerAddress><rptOwnerCity>CHARLESTON</rptOwnerCity><rptOwnerState>SC</rptOwnerState><rptOwnerZipCode>29412</rptOwnerZipCode></reportingOwnerAddress><reportingOwnerRelationship><isOfficer>1</isOfficer></reportingOwnerRelationship></reportingOwner><nonDerivativeTable><nonDerivativeTransaction><transactionDate><value>2026-10-01</value></transactionDate><transactionCoding><transactionCode>S</transactionCode></transactionCoding><transactionAmounts><transactionShares><value>100</value></transactionShares><transactionPricePerShare><value>12.50</value></transactionPricePerShare><transactionAcquiredDisposedCode><value>D</value></transactionAcquiredDisposedCode></transactionAmounts></nonDerivativeTransaction></nonDerivativeTable></ownershipDocument>'''
class NationalTests(unittest.TestCase):
 def test_index_deduplicates_aliases_but_not_conflicting_form_dates(self):
  lines=[f'1|QA|4|20261001|edgar/data/1/{ACCESSION}.txt',f'2|QA|4|20261001|edgar/data/2/{ACCESSION}.txt']
  self.assertEqual(len(national.parse_index('\n'.join(lines).encode())),1)
  with self.assertRaises(ValueError):national.parse_index('\n'.join([lines[0],lines[1].replace('|4|','|4/A|')]).encode())
  with self.assertRaises(ValueError):national.parse_index(lines[0].replace('edgar/data/1/','../../').encode())
 def test_full_submission_xml_identity_amount_and_cached_fingerprint(self):
  with tempfile.TemporaryDirectory() as d,patch.object(national,'ROOT',Path(d)),patch.object(national,'supported_states',return_value={'SC','PA'}),patch.object(national.ingest,'fetch',return_value=ACCESSION.encode()+b'\n<XML>'+XML+b'</XML>') as fetch:
   entry,p=national.inspect(ROW);self.assertEqual(p['id'],'person-1-issuer-2');self.assertEqual(p['events'][0]['value'],1250);self.assertEqual(p['location']['postal_code'],'29412')
   self.assertEqual(entry['sha256'],hashlib.sha256(XML).hexdigest());national.inspect(entry);self.assertEqual(fetch.call_count,1)
   (Path(d)/(ACCESSION+'.xml')).unlink()
   with self.assertRaisesRegex(ValueError,'fingerprint'):national.inspect({**entry,'sha256':'0'*64})
   self.assertFalse((Path(d)/(ACCESSION+'.xml')).exists())
   national.inspect(entry)
   (Path(d)/(ACCESSION+'.xml')).write_bytes(XML.replace(b'12.50',b'99.00'))
   with self.assertRaisesRegex(ValueError,'fingerprint'):national.inspect(entry)
 def test_xml_date_timezone_preserves_disclosed_civil_date(self):
  for text in ['2026-09-28','2026-09-28Z','2026-09-28-05:00','2026-09-28+14:00']:
   self.assertEqual(national.ingest.xml_date(text),'2026-09-28')
  for text in ['2026-09-28+14:01','2026-09-28+24:00','2026-02-30','2026-09-28junk']:
   with self.assertRaises(ValueError):national.ingest.xml_date(text)
  body=(national.ROOT/'0001477932-26-005933.xml').read_bytes()
  p=national.ingest.parse_xml(body,'0001477932-26-005933','https://www.sec.gov/Archives/edgar/data/1474627/0001477932-26-005933.txt','2026-09-30')
  self.assertTrue(p['events']);self.assertTrue(all(len(e['date'])==10 for e in p['events']))
 def test_joint_owner_and_entity_only_do_not_become_released_people(self):
  for body in [XML.replace(b'<isOfficer>1</isOfficer>',b'<isOfficer>0</isOfficer>'),XML.replace(b'</ownershipDocument>',b'<reportingOwner/></ownershipDocument>')]:
   with tempfile.TemporaryDirectory() as d,patch.object(national,'ROOT',Path(d)),patch.object(national,'supported_states',return_value={'SC','PA'}),patch.object(national.ingest,'fetch',return_value=ACCESSION.encode()+b'<XML>'+body+b'</XML>'):
    entry,p=national.inspect(ROW);self.assertEqual(entry['status'],'HELD');self.assertIsNone(p)
 def test_untrusted_source_rejected_before_any_request(self):
  with patch.object(national.ingest,'fetch') as fetch:
   for change in [{'source_url':'https://evil.example/a'},{'accession':'../../secret'}]:
    with self.assertRaises(ValueError):national.inspect({**ROW,**change})
   fetch.assert_not_called()
 def test_transport_failure_keeps_previous_national_manifest(self):
  with tempfile.TemporaryDirectory() as d:
   state=Path(d)/'national-discovery.json';original={'entries':[],'geographic_seed':{'quarter':'QA'}};state.write_text(json.dumps(original))
   body=f'1|QA|4|20261001|edgar/data/1/{ACCESSION}.txt'.encode()
   with patch.object(national,'STATE',state),patch.object(national.ingest,'fetch',return_value=body),patch.object(national,'inspect',side_effect=OSError('QA transport failure')),patch.object(national,'bootstrap',return_value=([],{'quarter':'QA'})):
    with self.assertRaisesRegex(RuntimeError,'incomplete'):national.refresh(date(2026,10,2))
   self.assertEqual(json.loads(state.read_text()),original)
 def test_missed_daily_indexes_are_recovered_before_advancing_manifest(self):
  with tempfile.TemporaryDirectory() as d:
   state=Path(d)/'national-discovery.json';state.write_text(json.dumps({'index_date':'2026-10-26','entries':[]}))
   def fetch(url,*args,**kwargs):
    day=url.rsplit('master.',1)[1][:8];acc=f'0000000001-26-{int(day[-2:]):06d}'
    return f'1|QA|4|{day}|edgar/data/1/{acc}.txt'.encode()
   with patch.object(national,'STATE',state),patch.object(national.ingest,'fetch',side_effect=fetch),patch.object(national,'bootstrap',return_value=([],{})),patch.object(national,'inspect',side_effect=lambda r:({**r,'status':'HELD','reason':'QA'},None)):
    manifest,people=national.refresh(date(2026,10,30))
   self.assertEqual([i['date'] for i in manifest['indexes_checked']],['2026-10-27','2026-10-28','2026-10-29'])
   self.assertEqual(len(manifest['entries']),3)
 def test_geographic_seed_is_latest_sale_candidate_per_city(self):
  buf=io.BytesIO()
  accessions=[f'0000000001-26-{i:06d}' for i in range(1,5)]
  with zipfile.ZipFile(buf,'w') as z:
   z.writestr('SUBMISSION.tsv','ACCESSION_NUMBER\tDOCUMENT_TYPE\tFILING_DATE\tISSUERCIK\n'+''.join(f'{a}\t4\t{day}-OCT-2026\t2\n' for a,day in zip(accessions,['01','02','03','04'])))
   z.writestr('REPORTINGOWNER.tsv','ACCESSION_NUMBER\tRPTOWNER_STATE\tRPTOWNER_CITY\tRPTOWNER_RELATIONSHIP\n'+''.join(f'{a}\tSC\tCHARLESTON\tOfficer\n' for a in accessions)+f'{accessions[3]}\tSC\tCHARLESTON\tDirector\n')
   z.writestr('NONDERIV_TRANS.tsv','ACCESSION_NUMBER\tTRANS_CODE\tTRANS_ACQUIRED_DISP_CD\n'+''.join(f'{a}\t{code}\tD\n' for a,code in zip(accessions,['S','S','F','S'])))
  with patch.object(national,'supported_states',return_value={'SC'}):rows=national.seed_from_zip(buf.getvalue(),date(2026,10,30))
  self.assertEqual([r['accession'] for r in rows],[accessions[1]])
  self.assertTrue(rows[0]['requires_sale'])
 def test_postal_state_mismatch_cannot_move_a_filing(self):
  from geo_enrichment import enrich
  loc={'city':'PHILADELPHIA','state':'PA','postal_code':'94103'};enrich(loc,national.ROOT/'geography.json');self.assertNotIn('reference_zip',loc)
  loc={'city':'AN UNRESOLVED CITY','state':'PA','postal_code':'19103'};enrich(loc,national.ROOT/'geography.json');self.assertEqual(loc['reference_zip'],'19103');self.assertEqual(loc['geo_class'],'CALCULATED FROM VERIFIED FACT')
if __name__=='__main__':unittest.main()
