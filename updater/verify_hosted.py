"""Check published bytes without treating a successful deploy job as site verification."""
import sys, time, hashlib
from pathlib import Path
from urllib.request import urlopen, Request
expected=Path('index.html').read_bytes()
for attempt in range(12):
    try:
        actual=urlopen(Request(sys.argv[1]+'?availability-verification='+str(time.time_ns()),headers={'Cache-Control':'no-cache'}),timeout=30).read()
        if actual==expected:
            print('Hosted HTML matches validated artifact:',hashlib.sha256(actual).hexdigest());break
    except OSError as e: print(type(e).__name__)
    time.sleep(10)
else: raise SystemExit('Hosted bytes did not match; publication remains unverified')
