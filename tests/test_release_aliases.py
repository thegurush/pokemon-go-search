import importlib.util, unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('releases',Path(__file__).resolve().parents[1]/'rankings/audit_releases.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class ReleaseAliasTests(unittest.TestCase):
 def run_alias(self,released=True,dex=29):
  return m.audit([{'species_id':'29','form':'Normal','pokemon_form':'Shadow Nidoran♀ [Normal]'}],{'pokemon':[{'speciesId':'nidoran_female_shadow','dex':dex,'released':released}]},{29:'nidoran-f'})[0]
 def test_alias_preserves_shadow_and_review_gate(self):
  r=self.run_alias();self.assertEqual(r['candidateSourceId'],'nidoran_female_shadow');self.assertEqual(r['sourceStatus'],'positive source flag');self.assertFalse(r['reviewed'])
 def test_unreleased_stays_blocked(self):
  self.assertEqual(self.run_alias(False)['sourceStatus'],'not confirmed released')
 def test_wrong_species_fails(self):
  with self.assertRaises(ValueError):self.run_alias(dex=32)
 def test_other_form_not_assigned_base_alias(self):
  r=m.audit([{'species_id':'877','form':'Hangry','pokemon_form':'Morpeko [Hangry]'}],{'pokemon':[{'speciesId':'morpeko_full_belly','dex':877,'released':True}]},{877:'morpeko'})[0]
  self.assertEqual(r['sourceStatus'],'unmapped')
