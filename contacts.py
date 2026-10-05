"""Reviewed, fingerprinted public business routes. Never guess direct contacts.
Company channels are scoped to issuer / exact reviewed entity, independently of
financial scoring. Failed or expired evidence removes the route on refresh.
"""
import hashlib,json,re,html
from pathlib import Path
from datetime import date
from urllib.parse import urlparse
from transitions import text_content
ROOT=Path(__file__).resolve().parent
AUTHORITIES={'0001280058':{'www.blackbaud.com'},'0000918965':{'www.scansource.com'},'0000857855':{'www.ucbi.com'},'0001090009':{'ir.southernfirst.com'},'0000932781':{'www.firstcommunitybankers.com'},'0001653477':{'www.ingevity.com'},'0000910638':{'www.3dsystems.com'},'Charleston Grounds Management':{'charlestongroundsmanagement.com'},'Clear Lakes and Wetland Services':{'blandlandscaping.com'}}
NAMED_AUTHORITIES={
 'person-1243370-issuer-1090009':'https://www.southernfirst.com/contact/find-a-banker/art-seaver',
 'person-1601818-issuer-1280058':'https://www.blackbaud.com/company/executive-leadership/kevin-gregoire',
 'person-2017486-issuer-1653477':'https://www.ingevity.com/about/leadership/ryan-fisher/'
}
def published_email(body,anchor):
 # Decode only an explicitly published email link, never infer a naming pattern.
 raw=body.decode('utf8')
 for href,label in re.findall(r'<a\b[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>',raw,re.S|re.I):
  if norm(text_content(label.encode()))!=norm(anchor):continue
  href=html.unescape(href)
  if href.startswith('mailto:'):return href[7:].split('?')[0]
  if href.startswith('/cdn-cgi/l/email-protection#'):
   payload=bytes.fromhex(href.split('#',1)[1]);return bytes(b^payload[0] for b in payload[1:]).decode('utf8')
 raise ValueError('Named published email link missing')
def norm(s):return ' '.join(s.split()).casefold()
def validate(g,root=ROOT,today=None):
 today=today or date.today();age=(today-date.fromisoformat(g['reviewed_at'])).days
 if not 0<=age<=90:raise ValueError('Contact evidence expired or future dated')
 if g['scope'] not in ('COMPANY_CHANNEL','ACQUIRER_CHANNEL','NAMED_PROFESSIONAL','PROFESSIONAL_PROFILE'):raise ValueError('Unsupported direct-person assertion')
 url=urlparse(g['source_url']);key=g['issuer_cik'] or g['company']
 named=g['scope'] in ('NAMED_PROFESSIONAL','PROFESSIONAL_PROFILE')
 if named:
  if len(g.get('person_ids',[]))!=1 or NAMED_AUTHORITIES.get(g['person_ids'][0])!=g['source_url']:raise ValueError('Unapproved person / primary profile binding')
 elif url.scheme!='https' or url.username or url.hostname not in AUTHORITIES.get(key,set()):raise ValueError('Wrong contact authority')
 path=(root/g['raw_path']).resolve()
 if path.parent!=root.resolve() or not path.name.startswith('contact-source-') or path.suffix!='.txt':raise ValueError('Unsafe evidence path')
 body=path.read_bytes()
 if hashlib.sha256(body).hexdigest()!=g['sha256']:raise ValueError('Contact source fingerprint mismatch')
 content=norm(text_content(body));raw=norm(body.decode())
 if norm(g['company_anchor']) not in content:raise ValueError('Company anchor missing')
 if named and (not g.get('subject_name') or len(g.get('identity_anchors',[]))<3 or not all(norm(a) in content for a in g['identity_anchors'])):raise ValueError('Named identity / role / company anchors missing')
 for r in g['routes']:
  if g['scope']=='PROFESSIONAL_PROFILE' and r['kind']!='WEBSITE':raise ValueError('A biography does not publish a contact')
  if norm(r['anchor']) not in content and norm(r['anchor']) not in raw:raise ValueError('Published route anchor missing')
  if r['kind']=='WEBSITE':
   if r['target']!=g['source_url'] or r['value']!=r['target']:raise ValueError('Unverified website')
  elif r['kind']=='PHONE':
   if named and (g['person_ids'][0]!='person-1243370-issuer-1090009' or not norm(r['anchor']).startswith('call art ')):raise ValueError('Named phone not bound to published person label')
   if not re.fullmatch(r'\+1\d{10}',r['target']) or re.sub(r'\D','',r['value'])!=r['target'][1:]:raise ValueError('Invalid business phone')
   if re.sub(r'\D','',r['anchor'])[-10:]!=r['target'][-10:]:raise ValueError('Phone does not match evidence')
  elif r['kind']=='EMAIL':
   if named and (g['person_ids'][0]!='person-1243370-issuer-1090009' or r['anchor']!='Email Art'):raise ValueError('Named email not bound to published person label')
   if r['target']!=r['value'] or (published_email(body,r['anchor']).casefold()!=r['value'].casefold() if named else r['value'].casefold() not in content) or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',r['target']):raise ValueError('Unverified email')
  else:raise ValueError('Unsupported contact type')
  if not r['purpose']:raise ValueError('Missing contact purpose')
 return [{**r,'scope':g['scope'],'organization':g['organization'],'classification':'VERIFIED PUBLIC FACT','person_id':g['person_ids'][0] if named else None,'subject_name':g.get('subject_name'),'confidence':'HIGH — publication / identity verified; reachability UNKNOWN','reviewed_at':g['reviewed_at'],'source_url':g['source_url'],'raw_path':g['raw_path'],'sha256':g['sha256']} for r in g['routes']]
def merge(records,root=ROOT,today=None):
 errors=[];routes=0
 for p in records:p['contacts']={'direct_email':'UNKNOWN','direct_phone':'UNKNOWN','consent':'UNKNOWN','routes':[]}
 for g in json.loads((root/'reviewed-contacts.json').read_text())['groups']:
  try:
   validated=validate(g,root,today)
   matches=[p for p in records if p['company']==g['company'] and (not g.get('subject_name') or (p['id'] in g['person_ids'] and norm(p['person_name'])==norm(g['subject_name']))) and ((g['issuer_cik'] and p.get('issuer_cik')==g['issuer_cik']) or (not g['issuer_cik'] and p['id'] in g['person_ids'] and p.get('issuer_cik') is None))]
   if not matches:raise ValueError('No exact company / entity match')
   for p in matches:p['contacts']['routes'].extend(validated)
   routes+=len(validated)
  except Exception as e:errors.append({'company':g.get('company'),'error':str(e)})
 return {'version':'professional-contacts-v2','people_with_company_routes':sum(bool(p['contacts']['routes']) for p in records),'distinct_published_routes':routes,'people_with_named_contacts':sum(any(r['scope']=='NAMED_PROFESSIONAL' and r['kind'] in ('EMAIL','PHONE') for r in p['contacts']['routes']) for p in records),'people_with_named_profiles':sum(any(r['scope'] in ('NAMED_PROFESSIONAL','PROFESSIONAL_PROFILE') and r['kind']=='WEBSITE' for r in p['contacts']['routes']) for p in records),'direct_contacts':0,'refresh_window_days':90,'errors':errors}
if __name__=='__main__':
 c=json.loads((ROOT/'catalog.json').read_text());c['contact_enrichment']=merge(c['records']);c['version']='project-a-15'
 if c['contact_enrichment']['errors']:raise RuntimeError(c['contact_enrichment']['errors'])
 (ROOT/'catalog.json').write_text(json.dumps(c,indent=2));print(json.dumps(c['contact_enrichment']))
