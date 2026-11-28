#!/usr/bin/env python3
"""Validate candidate sprite bytes; does not approve semantic form mappings."""
import argparse, concurrent.futures, hashlib, io, json, urllib.request
from pathlib import Path
from PIL import Image

def inspect_sprite(url):
    if not url.startswith('https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/'):
        return {'url':url,'status':'failed','error':'Unexpected sprite source'}
    try:
        with urllib.request.urlopen(url,timeout=20) as r:
            raw=r.read(2_000_001)
            if r.status!=200 or len(raw)>2_000_000:raise ValueError('Invalid sprite response')
        with Image.open(io.BytesIO(raw)) as im:
            im.load()
            if im.format!='PNG' or min(im.size)<=0 or max(im.size)>2048:raise ValueError('Unexpected sprite format/dimensions')
            if im.convert('RGBA').getchannel('A').getbbox() is None:raise ValueError('Fully transparent sprite')
            return {'url':url,'status':'decoded','width':im.width,'height':im.height,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
    except Exception as e:return {'url':url,'status':'failed','error':str(e)}

def audit(roster,output):
    urls=sorted(set(f['sprite'] for f in roster['forms']))
    results=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        pending={pool.submit(inspect_sprite,url):url for url in urls}
        for future in concurrent.futures.as_completed(pending):
            results.append(future.result())
            if len(results)%50==0:
                Path(output).write_text(json.dumps({'status':'INCOMPLETE asset audit','completed':len(results),'expected':len(urls),'assets':results},indent=2))
                print(f'Sprite responses: {len(results)}/{len(urls)}',flush=True)
    by_url={r['url']:r for r in results}
    return {'schema':1,'status':'Asset transport/decode audit only; names and form mapping still need verification','forms':len(roster['forms']),'uniqueAssets':len(urls),'decoded':sum(r['status']=='decoded' for r in results),'failed':sum(r['status']=='failed' for r in results),'assets':results,'failedForms':[f['key'] for f in roster['forms'] if by_url[f['sprite']]['status']!='decoded']}
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('roster');p.add_argument('output');a=p.parse_args()
    result=audit(json.loads(Path(a.roster).read_text()),a.output);Path(a.output).write_text(json.dumps(result,indent=2));print(json.dumps({k:v for k,v in result.items() if k not in ('assets','failedForms')}))
