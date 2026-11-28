#!/usr/bin/env python3
"""Cross-check candidate identities. This does not approve or publish a roster."""
import argparse,csv,hashlib,json
from pathlib import Path

# Explicit assets whose filenames differ from the numeric Pokemon endpoint.
SPRITE_FILES = {
    'pikachu_libre':'10084', 'raichu_mega_x':'10304', 'oricorio_pom_pom':'10123',
    'genesect_burn':'649-burn', 'genesect_chill':'649-chill',
    'genesect_douse':'649-douse', 'genesect_shock':'649-shock',
    'cherrim_sunny':'421-sunshine', 'burmy_trash':'412-trash',
}
SPRITE_FALLBACKS = {'mewtwo_armored':150, 'pikachu_horizons':25, 'pikachu_flying':25}
# One default appearance represents these equal battle profiles. This list is
# deliberately explicit: identical raw stats alone do not prove equivalence
# for forms such as Apex, which the calculator handles specially.
CANONICAL_PROFILES = {
    'unown_question_mark':'unown', 'shellos_east_sea':'shellos',
    'gastrodon_east_sea':'gastrodon', 'basculin_white_striped':'basculin',
    'deerling_winter':'deerling', 'sawsbuck_winter':'sawsbuck',
    'frillish_female':'frillish', 'jellicent_female':'jellicent',
    'vivillon_tundra':'vivillon', 'pyroar_female':'pyroar',
    'flabebe_white':'flabebe', 'floette_white':'floette',
    'florges_white':'florges', 'furfrou_pharaoh':'furfrou',
    'sinistea_antique':'sinistea', 'polteageist_antique':'polteageist',
    'maushold_family_of_three':'maushold',
    'poltchageist_artisan':'poltchageist', 'sinistcha_masterpiece':'sinistcha',
}
PROFILE_FIELDS = ('types','stats','fm','cm','elite_fm','elite_cm','temp_cm')
def canonical_row(row, key, pv, upstream):
    target = CANONICAL_PROFILES.get(key)
    if not target:
        return row, key, None
    dex = int(row['species_id'])
    original = upstream.get((dex, row['form']))
    normal = upstream.get((dex, 'Normal'))
    release = pv.get(target)
    if not original or not normal or not release or release.get('released') is not True or normal.get('released') is not True:
        return row, key, None
    if release['dex'] != dex or any(original.get(f) != normal.get(f) for f in PROFILE_FIELDS):
        raise ValueError('Canonical battle profile changed: '+key)
    result = dict(row, form='Normal', sprite_url=f'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{dex}.png')
    return result, target, {'sourceId':key,'representedBy':target,'method':'Explicit appearance alias; equal battle profile and independently released default form'}

def create(audit_path,release_path,pvpoke_path,source_path, supplemental_path=None):
    raw=Path(pvpoke_path).read_bytes();digest=hashlib.sha256(raw).hexdigest()
    pv={p['speciesId']:p for p in json.loads(raw)['pokemon']}
    mappings={r['form']:r for r in json.loads(Path(release_path).read_text())['rows']}
    upstream={(p['id'],p['form']):p for p in json.loads(Path(source_path).read_text())}
    forms=[];held=[];seen=set();represented=[]
    for row in csv.DictReader(open(audit_path)):
        m=mappings[row['pokemon_form']];dex=int(row['species_id']);key=m['candidateSourceId']
        row,key,alias=canonical_row(row,key,pv,upstream)
        if alias:represented.append(alias)
        p=pv.get(key);u=upstream.get((dex,row['form']))
        fallback = SPRITE_FALLBACKS.get(key)
        if fallback:
            row=dict(row,sprite_url=f'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{fallback}.png')
        if key in SPRITE_FILES:
            row=dict(row,sprite_url='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/'+SPRITE_FILES[key]+'.png')
        reason=None
        if (not alias and m['sourceStatus']!='positive source flag') or not p or p.get('released') is not True:reason='No positive independent form-release match'
        elif p['dex']!=dex:reason='Species identifier mismatch'
        elif not u or u.get('released') is not True:reason='Upstream form unavailable'
        elif not row['sprite_url']:reason='Missing sprite mapping'
        elif sorted(t for t in p['types'] if t!='none')!=sorted(t.lower() for t in u['types']):reason='Cross-source typing mismatch'
        elif key in seen:reason='Duplicate candidate identity'
        if reason:
            held.append({'form':row['pokemon_form'],'sourceId':key,'reason':reason});continue
        seen.add(key);shadow=row['pokemon_form'].startswith('Shadow ')
        forms.append({'key':key,'species':dex,'name':p['speciesName'],'shadow':shadow,'released':True,'releaseEvidence':[{'source':'PvPoke','id':key,'released':True,'sha256':digest}],'sprite':row['sprite_url'],'search':{'terms':[str(dex),'shadow' if shadow else '!shadow'],'accuracy':'partial','limitation':'Species and Shadow status only; other forms may also match.'},'upstreamForm':row['form'],'sourceTypes':p['types'],'reviewed':False})
        if fallback:
            forms[-1]['spriteFallback']={'reason':'No corresponding asset in the inspected PokeAPI form metadata; use base species art without changing the ranked name.', 'representedSpecies':dex}
    if supplemental_path:
        supplemental=json.loads(Path(supplemental_path).read_text())
        if supplemental.get('schema')!=1:raise ValueError('Unknown supplemental release schema')
        for entry in supplemental['forms']:
            key=entry['key'];u=upstream.get((entry['species'],entry['upstreamForm']))
            if key in seen:raise ValueError('Duplicate supplemental form')
            if not u or u.get('released') is not True or (entry['shadow'] and u.get('shadow') is not True):raise ValueError('Supplemental form conflicts with upstream release')
            if sorted(entry['sourceTypes'])!=sorted(t.lower() for t in u['types']):raise ValueError('Supplemental form typing mismatch')
            if not entry.get('releaseEvidence') or entry.get('released') is not True:raise ValueError('Missing supplemental release evidence')
            for alias in entry.get('equivalentAppearances',[]):
                alternative=upstream.get((entry['species'],alias['upstreamForm']))
                if not alternative or any(alternative.get(f)!=u.get(f) for f in PROFILE_FIELDS):raise ValueError('Supplemental appearance profile changed')
                represented.append({'sourceId':alias['sourceId'],'representedBy':key,'method':'Explicit supplementary appearance equivalence; equal battle profile'})
            forms.append(entry);seen.add(key)
        held=[r for r in held if r['sourceId'] not in seen and r['sourceId'] not in {a['sourceId'] for a in represented}]
    return {'schema':1,'sources':[{'url':'https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/gamemaster.json','sha256':digest}],'forms':forms,'held':held,'representedAppearances':represented,'status':'Candidate mappings only; held forms and all asset/search mappings require review'}
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('audit');p.add_argument('releases');p.add_argument('pvpoke');p.add_argument('source');p.add_argument('output');p.add_argument('--supplemental');a=p.parse_args()
    result=create(a.audit,a.releases,a.pvpoke,a.source,a.supplemental);Path(a.output).write_text(json.dumps(result,indent=2));print(json.dumps({'candidates':len(result['forms']),'held':len(result['held'])}))
