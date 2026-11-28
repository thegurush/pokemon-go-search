import importlib.util, unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('roster',Path(__file__).resolve().parents[1]/'rankings/candidate_roster.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class CanonicalRosterTests(unittest.TestCase):
 def sample(self):
  row={'species_id':'671','form':'White','sprite_url':''}
  profile={'types':['Fairy'],'stats':{'atk':212},'fm':['Fairy Wind'],'cm':['Moonblast'],'released':True}
  return row,{'florges':{'dex':671,'released':True}},{(671,'White'):dict(profile),(671,'Normal'):dict(profile)}
 def test_default_appearance_replaces_equal_profile(self):
  row,pv,up=self.sample();r,key,e=m.canonical_row(row,'florges_white',pv,up)
  self.assertEqual((r['form'],key),('Normal','florges'));self.assertEqual(e['representedBy'],'florges')
  self.assertEqual(row['form'],'White')
 def test_changed_move_pool_blocks_equivalence(self):
  row,pv,up=self.sample();up[(671,'White')]['cm']=['Different Move']
  with self.assertRaises(ValueError):m.canonical_row(row,'florges_white',pv,up)
 def test_unreleased_default_cannot_replace_form(self):
  row,pv,up=self.sample();up[(671,'Normal')]['released']=False
  self.assertIsNone(m.canonical_row(row,'florges_white',pv,up)[2])
 def test_wrong_species_blocks_alias(self):
  row,pv,up=self.sample();pv['florges']['dex']=670
  with self.assertRaises(ValueError):m.canonical_row(row,'florges_white',pv,up)
 def test_apex_is_never_collapsed_into_ordinary(self):
  row={'species_id':'250','form':'S'}
  self.assertEqual(m.canonical_row(row,'ho_oh_s',{},{}),(row,'ho_oh_s',None))
