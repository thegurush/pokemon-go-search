import importlib.util, json, tempfile, unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('form_identity', Path(__file__).resolve().parents[1]/'rankings/audit_form_identity.py')
audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)
class FormIdentityTests(unittest.TestCase):
    def test_wrong_form_same_species_is_held(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);roster=root/'roster.json';pokemon=root/'pokemon.csv'
            form={'key':'kyurem_black','species':646,'shadow':False,'upstreamForm':'Black','sprite':'https://example.test/10023.png'}
            roster.write_text(json.dumps({'forms':[form]}));pokemon.write_text('id,identifier,species_id\n10023,kyurem-white,646\n')
            self.assertEqual(audit.audit(roster,pokemon)['held'],1)
    def test_alias_requires_matching_source_form(self):
        with self.assertRaises(ValueError):
            audit.expected_identifier({'key':'necrozma_dawn_wings','shadow':False,'upstreamForm':'Dusk_mane'})
    def test_shadow_uses_same_form_art(self):
        self.assertEqual(audit.expected_identifier({'key':'rattata_alolan_shadow','shadow':True,'upstreamForm':'Alola'})[0],'rattata-alola')
    def test_conflicting_shadow_state_is_held(self):
        with self.assertRaises(ValueError):
            audit.expected_identifier({'key':'rattata_shadow','shadow':False,'upstreamForm':'Normal'})

    def test_new_source_aliases_preserve_exact_forms(self):
        for key,label,expected in [
            ('nidoran_female','Normal','nidoran-f'),
            ('nidoran_male','Normal','nidoran-m'),
            ('tauros_combat','Paldea_combat','tauros-paldea-combat-breed'),
            ('tauros_aqua','Paldea_aqua','tauros-paldea-aqua-breed'),
            ('tauros_blaze','Paldea_blaze','tauros-paldea-blaze-breed'),
            ('cherrim_overcast','Overcast','cherrim')]:
            with self.subTest(key=key):
                self.assertEqual(audit.expected_identifier({'key':key,'upstreamForm':label,'shadow':False})[0],expected)

    def test_form_file_requires_form_metadata_and_correct_drive(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);roster=root/'roster.json';pokemon=root/'pokemon.csv';forms=root/'forms.csv'
            form={'key':'genesect_douse','species':649,'shadow':False,'upstreamForm':'Douse','sprite':'https://example.test/649-douse.png'}
            roster.write_text(json.dumps({'forms':[form]}));pokemon.write_text('id,identifier,species_id\n649,genesect,649\n')
            forms.write_text('identifier,pokemon_id\ngenesect-douse,649\ngenesect-shock,649\n')
            self.assertEqual(audit.audit(roster,pokemon)['held'],1)
            self.assertEqual(audit.audit(roster,pokemon,forms)['matched'],1)
            form['sprite']='https://example.test/649-shock.png';roster.write_text(json.dumps({'forms':[form]}))
            self.assertEqual(audit.audit(roster,pokemon,forms)['held'],1)

    def test_fallback_cannot_conceal_wrong_species_or_arbitrary_form(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);roster=root/'roster.json';pokemon=root/'pokemon.csv'
            pokemon.write_text('id,identifier,species_id\n150,mewtwo,150\n249,lugia,249\n')
            form={'key':'mewtwo_armored','species':150,'shadow':False,'upstreamForm':'A','sprite':'https://example.test/150.png','spriteFallback':{'representedSpecies':150,'reason':'No separate asset'}}
            roster.write_text(json.dumps({'forms':[form]}));self.assertEqual(audit.audit(roster,pokemon)['documentedFallbacks'],1)
            form['sprite']='https://example.test/249.png';roster.write_text(json.dumps({'forms':[form]}));self.assertEqual(audit.audit(roster,pokemon)['held'],1)
            form['sprite']='https://example.test/150.png';form['key']='unreviewed';roster.write_text(json.dumps({'forms':[form]}));self.assertEqual(audit.audit(roster,pokemon)['held'],1)
