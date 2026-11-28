#!/usr/bin/env python3
"""Verify candidate sprite form identifiers, separately from release/search approval."""
import argparse, csv, hashlib, json, re
from pathlib import Path

# Explicit differences between the source's form names and PokeAPI identifiers.
ALIASES = {
    'pikachu_libre': ('Vs_2019', 'pikachu-libre'),
    'pikachu_phd': ('Doctor', 'pikachu-phd'),
    'toxtricity': ('Amped', 'toxtricity-amped'),
    'squawkabilly': ('Green', 'squawkabilly-green-plumage'),
    'basculin': ('Normal', 'basculin-red-striped'),
    'frillish': ('Normal', 'frillish-male'),
    'jellicent': ('Normal', 'jellicent-male'),
    'pyroar': ('Normal', 'pyroar-male'),
    'maushold': ('Normal', 'maushold-family-of-four'),
    'oricorio_pom_pom': ('Pompom', 'oricorio-pom-pom'),
    'cherrim_sunny': ('Sunny', 'cherrim-sunshine'),
    'nidoran_female': ('Normal', 'nidoran-f'),
    'nidoran_male': ('Normal', 'nidoran-m'),
    'tauros_combat': ('Paldea_combat', 'tauros-paldea-combat-breed'),
    'tauros_aqua': ('Paldea_aqua', 'tauros-paldea-aqua-breed'),
    'tauros_blaze': ('Paldea_blaze', 'tauros-paldea-blaze-breed'),
    'cherrim_overcast': ('Overcast', 'cherrim'),
    'deoxys': ('Normal', 'deoxys-normal'),
    'meowstic': ('Normal', 'meowstic-male'),
    'zygarde': ('Fifty_percent', 'zygarde-50'),
    'necrozma_dawn_wings': ('Dawn_wings', 'necrozma-dawn'),
    'necrozma_dusk_mane': ('Dusk_mane', 'necrozma-dusk'),
    'zacian_hero': ('Hero', 'zacian'),
    'zacian_crowned_sword': ('Crowned_sword', 'zacian-crowned'),
    'zamazenta_hero': ('Hero', 'zamazenta'),
    'zamazenta_crowned_shield': ('Crowned_shield', 'zamazenta-crowned'),
    'oinkologne': ('Normal', 'oinkologne-male'),
}

def expected_identifier(form):
    key = form['key']
    if form['shadow']:
        if not key.endswith('_shadow'):
            raise ValueError('Shadow key missing state suffix')
        key = key[:-7]
    elif key.endswith('_shadow'):
        raise ValueError('Shadow suffix conflicts with state')
    if key in ALIASES:
        label, identifier = ALIASES[key]
        if form['upstreamForm'] != label:
            raise ValueError('Alias form label changed')
        return identifier, 'explicit form alias'
    tokens = key.split('_')
    regions = {'alolan':'alola','galarian':'galar','hisuian':'hisui','paldean':'paldea'}
    return '-'.join(regions.get(t,t) for t in tokens), 'matching form identifier'

# These are form assets, not Pokemon-ID assets. Verify their form records too.
REVIEWED_FALLBACKS = {'pikachu_flying':(25,'Flying_01'), 'mewtwo_armored':(150,'A'), 'pikachu_horizons':(25,'Horizons'), 'lugia_s':(249,'S'), 'lugia_s_shadow':(249,'S'), 'ho_oh_s':(250,'S'), 'ho_oh_s_shadow':(250,'S')}
FORM_FILES = {
    '412-trash': (412, 'burmy-trash'),
    '421-sunshine': (421, 'cherrim-sunshine'),
    **{'649-'+drive: (649, 'genesect-'+drive) for drive in ('burn','chill','douse','shock')},
}
def audit(roster_path, pokemon_path, forms_path=None):
    roster = json.loads(Path(roster_path).read_text())
    with Path(pokemon_path).open() as stream:
        pokemon = {int(r['id']):r for r in csv.DictReader(stream)}
    form_records = {}
    if forms_path:
        with Path(forms_path).open() as stream:
            form_records = {r['identifier']:r for r in csv.DictReader(stream)}
    rows = []
    for form in roster['forms']:
        match = re.search(r'/([0-9]+)\.png$', form['sprite'])
        record = pokemon.get(int(match[1])) if match else None
        filename = form['sprite'].rsplit('/',1)[-1].removesuffix('.png')
        form_asset = FORM_FILES.get(filename)
        if form_asset:
            species, identifier = form_asset
            fr = form_records.get(identifier)
            parent = pokemon.get(int(fr['pokemon_id'])) if fr else None
            record = {'identifier':identifier,'species_id':str(species)} if parent and int(parent['species_id']) == species else None
        try:
            fallback=REVIEWED_FALLBACKS.get(form['key'])
            if form.get('spriteFallback'):
                if fallback != (form['species'],form['upstreamForm']) or form['spriteFallback'].get('representedSpecies')!=form['species'] or not form['spriteFallback'].get('reason'):
                    raise ValueError('Unreviewed base-art fallback')
                expected=pokemon[form['species']]['identifier'];method='documented base-art fallback (not exact alternate-form art)'
                if filename != str(form['species']):raise ValueError('Fallback must use the base species image')
            else:
                expected, method = expected_identifier(form)
            ok = bool(record and int(record['species_id']) == form['species'] and record['identifier'] == expected)
            reason = '' if ok else 'Sprite species or exact form identifier mismatch'
        except ValueError as error:
            expected, method, ok, reason = None, 'held', False, str(error)
        rows.append({'form':form['key'], 'upstreamForm':form['upstreamForm'], 'expectedIdentifier':expected,
                     'actualIdentifier':record['identifier'] if record else None, 'method':method,
                     'status':'matched' if ok else 'held', 'reason':reason})
    return {'scope':'Sprite identity only. Does not approve release eligibility, native searches, cosmetic deduplication or data reuse.',
            'rosterSha256':hashlib.sha256(Path(roster_path).read_bytes()).hexdigest(),
            'pokemonSha256':hashlib.sha256(Path(pokemon_path).read_bytes()).hexdigest(),
            'documentedFallbacks':sum(r['status']=='matched' and r['method'].startswith('documented') for r in rows),
            'matched':sum(r['status']=='matched' for r in rows), 'held':sum(r['status']=='held' for r in rows), 'rows':rows}

if __name__ == '__main__':
    parser=argparse.ArgumentParser();parser.add_argument('roster');parser.add_argument('pokemon');parser.add_argument('output');parser.add_argument('--forms');args=parser.parse_args()
    result=audit(args.roster,args.pokemon,args.forms);Path(args.output).write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({k:result[k] for k in ['matched','held']}))
