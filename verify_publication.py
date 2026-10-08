"""Require production catalog to match this validated refresh; fail on stale deployment."""
import hashlib, time, urllib.request
from pathlib import Path
expected=hashlib.sha256(Path('catalog.json').read_bytes()).hexdigest()
for attempt in range(18):
    try:
        request=urllib.request.Request('https://project-a-jet.vercel.app/catalog.json',headers={'Cache-Control':'no-cache','User-Agent':'Project A deployment verifier'})
        with urllib.request.urlopen(request,timeout=20) as response:
            actual=hashlib.sha256(response.read()).hexdigest()
        if actual==expected:
            print('Production catalog matches validated refresh');break
    except OSError as error:
        print('Publication not verified yet:',type(error).__name__)
    time.sleep(15)
else:
    raise SystemExit('Production did not publish the refreshed catalog within the verification window. Check Vercel deployment status; current site may retain the previous snapshot.')
