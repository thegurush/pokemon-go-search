import datetime as dt, io, json, sys, tempfile, unittest, re, shutil
from pathlib import Path
from unittest.mock import patch
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from updater import update as u
ROOT=Path(__file__).resolve().parents[1]
class Tests(unittest.TestCase):
 def fixture(self):
  return '<h2 id="List_of_Pokémon_by_date">'+''.join(f'<tr><td>Jan 01, 2020</td><td><img alt="Species {i}" src="GO{i:04d}.png"></td><td><img alt="Notes" src="GO1025.png"></td></tr>' for i in range(1,951))+'<h3 id="Unreleased_Pokémon">'
 def test_dates_forms_notes(self):
  s=self.fixture().replace('<h3','<tr><td>Nov 16, 2026</td><td><img alt="Today" src="GO0951.png"></td><td></td></tr><tr><td>Nov 17, 2026</td><td><img alt="Future" src="GO0952.png"></td><td></td></tr><tr><td>Nov 15, 2026</td><td><img alt="Form" src="GO0001Form.png"></td><td></td></tr><h3')
  r=u.parse(s,dt.date(2026,11,16));self.assertEqual(set(r),set(range(1,951)));self.assertIn(951,u.parse(s,dt.date(2026,11,17)))
 def test_changed_source(self):
  for s in ['blocked',self.fixture().replace('Jan 01, 2020','Unknown'),self.fixture().replace('<td><img alt="Notes" src="GO1025.png"></td>',''),self.fixture().replace('GO0001.png','UNKNOWN.png')]:
   with self.assertRaises(ValueError):u.parse(s,dt.date(2026,11,16))
 def test_metadata_and_retention(self):
  text=(ROOT/'index.html').read_text();deck=u.extract(text,'POKEMON');m=u.extract(text,'TTS_META');u.validate_data(deck,m)
  self.assertEqual(m['774']['types'],['rock','flying']);self.assertEqual(m['946']['types'],['grass','ghost']);self.assertEqual(m['946']['family'],m['947']['family'])
  with self.assertRaises(ValueError):u.metadata({99999},ROOT)
  for bad in [deck+[deck[-1]],[],[{'id':-1,'name':'Bad'}]]:
   with self.assertRaises(ValueError):u.validate_data(bad,m)
  del m['774']
  with self.assertRaises(ValueError):u.validate_data(deck,m)
 def test_png(self):
  b=io.BytesIO();Image.new('RGBA',(2,2),(255,0,0,255)).save(b,format='PNG');good=b.getvalue();u.validate_png(good)
  for bad in [b'not png',good[:32],good[:-1],good[:40]+b'bad'+good[43:]]:
   with self.assertRaises((ValueError,OSError)):u.validate_png(bad)
  b=io.BytesIO();Image.new('RGBA',(2,2)).save(b,format='PNG')
  with self.assertRaises(ValueError):u.validate_png(b.getvalue())
 def test_future_updater_and_failure_atomicity(self):
  original=(ROOT/'index.html').read_text();deck=u.extract(original,'POKEMON');existing={p['id'] for p in deck}
  with (ROOT/'data/pokemon_species.csv').open() as f:
   known={int(r['id']):r['identifier'].replace('-',' ').title() for r in u.csv.DictReader(f)}
  pid=next(i for i in sorted(known) if i not in existing)
  names=known
  def source(extra):
   return '<h2 id="List_of_Pokémon_by_date">'+''.join(f'<tr><td>Jan 01, 2020</td><td><img alt="{p["name"]}" src="GO{p["id"]:04d}.png"></td><td></td></tr>' for p in deck+extra)+'<h3 id="Unreleased_Pokémon">'
  png=io.BytesIO();Image.new('RGBA',(2,2),(255,0,0,255)).save(png,format='PNG')
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);shutil.copytree(ROOT/'data',root/'data');(root/'updater').mkdir();page=root/'index.html';page.write_text(original);src=root/'source.html'
   args=['update.py','--html',str(page),'--source-file',str(src),'--today','2026-11-16']
   before={f.name:f.read_bytes() for f in (root/'data').iterdir()}
   def run(extra,image):
    src.write_text(source(extra))
    with patch.object(u,'__file__',str(root/'updater/update.py')),patch.object(sys,'argv',args),patch.object(u,'urlopen',return_value=io.BytesIO(image)),patch('sys.stdout',new=io.StringIO()): u.main()
   for extra,image in [([{'id':pid,'name':names[pid]}],b'bad sprite'),([{'id':9999,'name':'Unknown'}],png.getvalue()),([{'id':pid,'name':'Wrong identity'}],png.getvalue())]:
    with self.assertRaises(ValueError):run(extra,image)
    self.assertEqual(page.read_text(),original)
    self.assertEqual(before,{f.name:f.read_bytes() for f in (root/'data').iterdir()})
   # Synthetic release eligibility only; this does not claim a new real-world release.
   run([{'id':pid,'name':names[pid]}],png.getvalue())
   updated=page.read_text();self.assertEqual(len(u.extract(updated,'POKEMON')),len(deck)+1)
   prior=u.extract(original,'TTS_META');after=u.extract(updated,'TTS_META');self.assertTrue(all(after[k]==v for k,v in prior.items()))
   (ROOT/'tests/future.html').write_text(updated)
 def test_safe_replace(self):
  with self.assertRaises(ValueError):u.replace_one('const POKEMON=[];const POKEMON=[];','POKEMON',[])
if __name__=='__main__':unittest.main()
