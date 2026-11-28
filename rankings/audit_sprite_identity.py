#!/usr/bin/env python3
"""Check sprite IDs against PokeAPI species; never approve form aliases implicitly."""
import argparse,csv,hashlib,json,re
from pathlib import Path

def audit(roster_path,pokemon_path):
    roster=json.loads(Path(roster_path).read_text())
    pokemon={int(x['id']):x for x in csv.DictReader(Path(pokemon_path).open())}
    rows=[]
    for form in roster['forms']:
        match=re.search(r'/([0-9]+)\.png$',form['sprite']);record=pokemon.get(int(match[1])) if match else None
        status='species-match' if record and int(record['species_id'])==form['species'] else 'held'
        rows.append({'form':form['key'],'species':form['species'],'sprite':form['sprite'],'pokeapiIdentifier':record['identifier'] if record else None,'status':status})
    return {'status':'Species identity check only; alternate-form identity still requires review','sourceSha256':hashlib.sha256(Path(pokemon_path).read_bytes()).hexdigest(),'matched':sum(r['status']=='species-match' for r in rows),'held':sum(r['status']=='held' for r in rows),'rows':rows}
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('roster');p.add_argument('pokemon');p.add_argument('output');a=p.parse_args()
    result=audit(a.roster,a.pokemon);Path(a.output).write_text(json.dumps(result,indent=2));print(json.dumps({'matched':result['matched'],'held':result['held']}))
