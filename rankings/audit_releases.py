#!/usr/bin/env python3
"""Read-only candidate mapping. Never promotes candidates to reviewed release data."""
import argparse,csv,json,hashlib
from pathlib import Path
ALIASES={'Alola':'alolan','Galarian':'galarian','Hisuian':'hisuian','Paldea':'paldean','A':'armored','Fifty_percent':'','Ten_percent':'10','Dawn_wings':'dawn_wings','Dusk_mane':'dusk_mane','MegaY':'mega_y','MegaZ':'mega_z'}
# Explicit source-name equivalences, keyed by species and upstream form.
FORM_SOURCE_IDS={(25,'Flying_01'):'pikachu_flying',(25,'Vs_2019'):'pikachu_libre',(29,'Normal'):'nidoran_female',(32,'Normal'):'nidoran_male',
 (128,'Paldea_combat'):'tauros_combat',(128,'Paldea_aqua'):'tauros_aqua',(128,'Paldea_blaze'):'tauros_blaze',
 (421,'Overcast'):'cherrim_overcast',(492,'Land'):'shaymin_land',(648,'Aria'):'meloetta_aria',
 (741,'Pompom'):'oricorio_pom_pom',(876,'Male'):'indeedee_male',(877,'Full_belly'):'morpeko_full_belly'}
DEFAULTS={'Normal','Confined','Aria','Land','Overcast','Male','Full_belly','Disguised','Phony','Unremarkable','Counterfeit','Family_of_four'}
def audit(rows,pvpoke,species):
    entries={p['speciesId']:p for p in pvpoke['pokemon']}
    if len(entries)!=len(pvpoke['pokemon']):raise ValueError('Duplicate source form ID')
    out=[]
    for row in rows:
        dex=int(row['species_id']);f=row['form'];base=species.get(dex,'').replace('-','_')
        if not base:raise ValueError('Unknown species metadata')
        suffix='' if f in DEFAULTS else ALIASES.get(f,f.lower())
        if f=='Mega':suffix='primal' if dex in (382,383) else 'mega_x' if dex in (6,26,150) else 'mega'
        key=FORM_SOURCE_IDS.get((dex,f),base+('_'+suffix if suffix else ''))+('_shadow' if row['pokemon_form'].startswith('Shadow ') else '')
        match=entries.get(key)
        if match and match['dex']!=dex:raise ValueError('Species/form mapping mismatch')
        status='unmapped' if match is None else 'positive source flag' if match.get('released') is True else 'not confirmed released'
        out.append({'form':row['pokemon_form'],'species':dex,'candidateSourceId':key,'sourceStatus':status,'reviewed':False,'note':'Candidate alias requires review; positive source flag is retained as evidence, not silently applied to app data.'})
    return out
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--audit',required=True);p.add_argument('--pvpoke',required=True);p.add_argument('--species',required=True);p.add_argument('--output',required=True);a=p.parse_args()
    raw=Path(a.pvpoke).read_bytes();rows=list(csv.DictReader(open(a.audit)));species={int(x['id']):x['identifier'] for x in csv.DictReader(open(a.species))}
    results=audit(rows,json.loads(raw),species)
    Path(a.output).write_text(json.dumps({'source':'https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/gamemaster.json','sha256':hashlib.sha256(raw).hexdigest(),'rows':results},indent=2))
    from collections import Counter
    print(dict(Counter(x['sourceStatus'] for x in results)))
