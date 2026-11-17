#!/usr/bin/env python3
"""Validated, additive Bulbapedia species update. Fails closed before publication."""
import argparse, csv, datetime as dt, hashlib, html, json, math, re, unicodedata, struct, zlib
from pathlib import Path
from urllib.request import Request, urlopen
SOURCE='https://bulbapedia.bulbagarden.net/wiki/List_of_Pok%C3%A9mon_by_availability_in_Pok%C3%A9mon_GO'
def parse(source, today):
    start=source.find('id="List_of_Pokémon_by_date"')
    if start<0: start=source.find('id="List_of_Pok.C3.A9mon_by_date"')
    end=source.find('id="Unreleased_Pokémon"',start)
    if end<0: end=source.find('id="Unreleased_Pok.C3.A9mon"',start)
    if start<0 or end<start: raise ValueError('Release section changed; no update made')
    released={}; dates=0
    for row in re.findall(r'<tr\b[^>]*>(.*?)</tr>',source[start:end],re.S):
        cells=re.findall(r'<td\b[^>]*>(.*?)</td>',row,re.S)
        if not cells: continue
        if len(cells)!=3: raise ValueError('Unexpected release row; no update made')
        text=html.unescape(re.sub('<[^>]*>','',cells[0])).strip()
        try: day=dt.datetime.strptime(text,'%b %d, %Y').date()
        except ValueError: raise ValueError(f'Unrecognized release date: {text}')
        dates+=1
        tags=re.findall(r'<img\b[^>]*>',cells[1])
        if not tags: raise ValueError('Release row has no species images')
        if day>=today: continue # Date-only entries become eligible on the following UTC day.
        for tag in tags:
            match=re.search(r'GO(\d{4})(?:[^0-9]|$)',tag)
            name=re.search(r'alt="([^"]+)"',tag)
            if not match or not name: raise ValueError('Unrecognized species image in release row')
            pid=int(match[1])
            if pid<=0: raise ValueError('Invalid source species ID')
            item={'id':pid,'name':html.unescape(name[1]),'released':day.isoformat()}
            if pid not in released or day.isoformat()<released[pid]['released']: released[pid]=item
    if dates<50 or len(released)<900: raise ValueError('Incomplete release table; no update made')
    return released

def metadata(ids, root):
    def rows(name):
        with (root/'data'/f'{name}.csv').open() as f:return list(csv.DictReader(f))
    types={int(r['id']):r['identifier'] for r in rows('types')}
    meta={int(r['id']):dict(family=int(r['evolution_chain_id']),types=[],generation=int(r['generation_id']),legendary=r['is_legendary']=='1',mythical=r['is_mythical']=='1',ultrabeast=int(r['id']) in {793,794,795,796,797,798,799,803,804,805,806}) for r in rows('pokemon_species') if int(r['id']) in ids}
    defaults={int(r['id']):int(r['species_id']) for r in rows('pokemon') if r['is_default']=='1'}
    for r in rows('pokemon_types'):
        pid=defaults.get(int(r['pokemon_id']))
        if pid in meta:meta[pid]['types'].append(types[int(r['type_id'])])
    efficacy={(int(r['damage_type_id']),int(r['target_type_id'])):int(r['damage_factor'])/100 for r in rows('type_efficacy')}
    for pid,m in meta.items():
        m['region']='hisui' if 899<=pid<=905 else ['kanto','johto','hoenn','sinnoh','unova','kalos','alola','galar','paldea'][m['generation']-1]
        targets=[k for k,v in types.items() if v in m['types']]
        m['weakTo']=[name for tid,name in types.items() if tid<=18 and math.prod(efficacy.get((tid,t),1) for t in targets)>1]
    if set(meta)!=ids or not all(m['types'] for m in meta.values()):raise ValueError('Missing species metadata; manual review required')
    return meta

def replace_one(text, name, value):
    pattern=r'const '+name+r'=(?:\[.*?\]|\{.*?\});'
    result,count=re.subn(pattern,lambda _: 'const '+name+'='+json.dumps(value,separators=(',',':'))+';',text,flags=re.S)
    if count!=1:raise ValueError(f'Expected exactly one {name}, found {count}')
    return result


TYPES={'normal','fighting','flying','poison','ground','rock','bug','ghost','steel','fire','water','grass','electric','psychic','ice','dragon','dark','fairy'}
def extract(text,name):
    matches=re.findall(r'const '+name+r'=(\[.*?\]|\{.*?\});',text,re.S)
    if len(matches)!=1: raise ValueError(f'Expected exactly one {name}')
    return json.loads(matches[0])

def validate_data(deck,meta):
    if not isinstance(deck,list) or not deck: raise ValueError('Empty manifest')
    ids=[]
    for p in deck:
        if type(p.get('id')) is not int or not 0<p['id']<2**53: raise ValueError('Invalid species ID')
        if not isinstance(p.get('name'),str) or not p['name'].strip() or p['name']!=p['name'].strip() or re.search(r'[<>&\\\r\n]',p['name']): raise ValueError('Invalid species name')
        ids.append(p['id'])
    if len(set(ids))!=len(ids) or ids!=sorted(ids): raise ValueError('Duplicate or unsorted IDs')
    if set(meta)!=set(map(str,ids)): raise ValueError('Metadata coverage mismatch')
    for m in meta.values():
        if any(type(m.get(k)) is not int or m[k]<=0 for k in ('family','generation')): raise ValueError('Missing evolution/generation metadata')
        if not isinstance(m.get('region'),str) or not m['region'].strip(): raise ValueError('Missing region')
        for k in ('types','weakTo'):
            v=m.get(k)
            if not isinstance(v,list) or len(v)!=len(set(v)) or not set(v)<=TYPES: raise ValueError('Invalid type metadata')
        if not 1<=len(m['types'])<=2 or any(type(m.get(k)) is not bool for k in ('legendary','mythical','ultrabeast')): raise ValueError('Incomplete metadata')

def validate_png(data):
    # Validate chunk CRCs and the decompressed RGBA scanline payload, not just a PNG signature.
    if not data.startswith(b'\x89PNG\r\n\x1a\n'): raise ValueError('Missing PNG sprite')
    pos=8; payload=b''; header=None; ended=False
    while pos<len(data):
        if pos+12>len(data): raise ValueError('Truncated sprite')
        n=struct.unpack('>I',data[pos:pos+4])[0]; kind=data[pos+4:pos+8]; chunk=data[pos+8:pos+8+n]
        if pos+12+n>len(data) or zlib.crc32(kind+chunk)&0xffffffff!=struct.unpack('>I',data[pos+8+n:pos+12+n])[0]: raise ValueError('Corrupt sprite')
        if header is None:
            if kind!=b'IHDR' or n!=13: raise ValueError('Invalid PNG header')
            header=struct.unpack('>IIBBBBB',chunk)
        if kind==b'IDAT': payload+=chunk
        pos+=n+12
        if kind==b'IEND': ended=True; break
    if not ended or pos!=len(data) or not header: raise ValueError('Incomplete PNG')
    from PIL import Image
    from io import BytesIO
    with Image.open(BytesIO(data)) as img:
        if img.format!='PNG' or not 1<=img.width<=1024 or not 1<=img.height<=1024: raise ValueError('Invalid sprite dimensions')
        img.verify()
    with Image.open(BytesIO(data)) as img:
        img.load()
        if img.convert('RGBA').getchannel('A').getbbox() is None: raise ValueError('Empty sprite')


def main():
    p=argparse.ArgumentParser();p.add_argument('--html',required=True,type=Path);p.add_argument('--source-file',type=Path);p.add_argument('--today',default=dt.datetime.now(dt.timezone.utc).date().isoformat());args=p.parse_args()
    root=Path(__file__).resolve().parent.parent
    source=args.source_file.read_text() if args.source_file else urlopen(Request(SOURCE,headers={'User-Agent':'TapToSearchAvailabilityUpdater/1.0 (daily species availability check)'}),timeout=60).read().decode('utf-8')
    released=parse(source,dt.date.fromisoformat(args.today));text=args.html.read_text()
    current=json.loads(re.search(r'const POKEMON=(\[.*?\]);',text,re.S)[1]); ids={p['id'] for p in current}
    validate_data(current, extract(text,'TTS_META'))
    if len(set(released)&ids)<len(ids)*0.98:raise ValueError('Release table lost substantial baseline coverage')
    new=[released[i] for i in sorted(set(released)-ids)]
    with (root/'data/pokemon_species.csv').open() as f:
        known={int(r['id']):r['identifier'] for r in csv.DictReader(f)}
    def normalized(name):return re.sub('[^a-z0-9]','',unicodedata.normalize('NFKD',name).encode('ascii','ignore').decode().lower())
    for item in new:
        if item['id'] not in known or normalized(item['name'])!=normalized(known[item['id']]) or any(c in item['name'] for c in '<>&\\\n\r'):
            raise ValueError(f'Unrecognized species identity: {item}; manual review required')
    if len(new)>30:raise ValueError('Unexpectedly large change; manual review required')
    # Verify every new sprite before publishing a card; cached sprites remain untouched.
    for item in new:
        url=f'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{item["id"]}.png'
        image=urlopen(url,timeout=30).read()
        validate_png(image)
    combined=sorted(current+[{'id':x['id'],'name':x['name']} for x in new],key=lambda x:x['id'])
    meta=extract(text,'TTS_META')
    meta.update({str(k):v for k,v in metadata({x['id'] for x in new},root).items()})
    validate_data(combined,meta)
    output=replace_one(replace_one(text,'POKEMON',combined),'TTS_META',meta)
    report={'source':SOURCE,'checkedUTC':dt.datetime.now(dt.timezone.utc).isoformat(),'releaseCutoffExclusive':args.today,'sourceSHA256':hashlib.sha256(source.encode()).hexdigest(),'count':len(combined),'added':new,'retainedWithoutSourceDate':sorted(ids-set(released)),'policy':'Additive species only; release dates strictly before cutoff; no inferred evolutions or new form cards.'}
    # All validation has passed before any output is replaced.
    tmp=args.html.with_suffix('.tmp');tmp.write_text(output);tmp.replace(args.html)
    (root/'data/pokemon_available.json').write_text(json.dumps(combined,indent=2)+'\n')
    (root/'data/availability-check.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))
if __name__=='__main__':main()
