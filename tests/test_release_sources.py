import datetime as dt
import io
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from PIL import Image
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from updater import update as u
ROOT = Path(__file__).resolve().parents[1]
TODAY = dt.date(2026, 11, 17)

class SourceTests(unittest.TestCase):
    def payloads(self):
        deck = u.extract((ROOT/'index.html').read_text(), 'POKEMON')
        p = {'pokemon': [{'dex': r['id'], 'speciesName': r['name'], 'speciesId': str(r['id']), 'released': True} for r in deck]}
        d = {'date': '2026-11-01', 'items': [{'id': r['id'], 'name': r['name'], 'releaseDate': '2020-01-01'} for r in deck]}
        return deck, p, d

    def collect(self, p, d, ids):
        def fetch(url):
            value = p if url == u.SOURCES['pvpoke'] else d
            if isinstance(value, Exception): raise value
            return json.dumps(value).encode()
        return u.collect_releases(TODAY, ids, fetch)

    def test_either_source_wins_and_disagreements_recorded(self):
        deck,p,d = self.payloads();ids={r['id'] for r in deck}
        p['pokemon'] += [{'dex': 489, 'speciesName': 'Phione', 'speciesId':'phione', 'released':True}, {'dex':490,'speciesName':'Manaphy','speciesId':'manaphy','released':False}]
        d['items'] += [{'id':489,'name':'Phione','releaseDate':'9999-12-31'}, {'id':490,'name':'Manaphy','releaseDate':'2026-11-16'}]
        released,audit = self.collect(p,d,ids)
        self.assertEqual(set(released)-ids,{489,490})
        self.assertEqual({r['id'] for r in audit['disagreements']},{489,490})

    def test_forms_deduplicate_and_duplicate_ids_rejected(self):
        _,p,d=self.payloads()
        p['pokemon'].append({'dex':1,'speciesName':'Bulbasaur (Other)','speciesId':'bulbasaur_other','released':False})
        self.assertTrue(u.parse_release_source('pvpoke',p,TODAY)[1]['eligible'])
        p['pokemon'].append(p['pokemon'][0])
        with self.assertRaises(ValueError):u.parse_release_source('pvpoke',p,TODAY)
        d['items'].append(d['items'][0])
        with self.assertRaises(ValueError):u.parse_release_source('dated',d,TODAY)

    def test_dates_and_bad_flags(self):
        _,p,d=self.payloads()
        for date,expected in [('2026-11-16',True),('2026-11-17',False),('2026-11-18',False),('9999-12-31',False)]:
            d['items'][0]['releaseDate']=date
            self.assertEqual(u.parse_release_source('dated',d,TODAY)[1]['eligible'],expected)
        p['pokemon'][0]['released']='true'
        with self.assertRaises(ValueError):u.parse_release_source('pvpoke',p,TODAY)

    def test_outage_or_bad_source_does_not_block_healthy_source(self):
        deck,p,d=self.payloads();ids={r['id'] for r in deck}
        for a,b in [(OSError('403'),d),(p,OSError('timeout')),({},d),(p,{'items':[]})]:
            released,audit=self.collect(a,b,ids)
            self.assertEqual(set(released),ids)
            self.assertEqual(sum(x['status']=='unavailable' for x in audit['sources']),1)
        with self.assertRaises(ValueError):self.collect({}, {}, ids)

    def test_small_or_empty_source_rejected(self):
        deck,p,d=self.payloads();ids={r['id'] for r in deck}
        p['pokemon']=p['pokemon'][:1]
        _,audit=self.collect(p,d,ids)
        self.assertEqual(audit['sources'][0]['status'],'unavailable')

    def test_real_main_future_addition_retention_and_failure_atomicity(self):
        deck,p,d=self.payloads();original=(ROOT/'index.html').read_bytes()
        # Remove one existing entry from both sources: it must still be retained.
        p['pokemon']=p['pokemon'][1:];d['items']=d['items'][1:]
        p['pokemon'].append({'dex':489,'speciesId':'phione','speciesName':'Phione','released':True})
        d['items'].append({'id':489,'name':'Phione','releaseDate':'9999-12-31'})
        image=io.BytesIO();Image.new('RGBA',(2,2),(255,0,0,255)).save(image,format='PNG')
        real_collect=u.collect_releases
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);shutil.copytree(ROOT/'data',root/'data');(root/'updater').mkdir();page=root/'index.html';page.write_bytes(original)
            before={f.name:f.read_bytes() for f in (root/'data').iterdir()}
            def run(broken=False):
                def fetch(url):
                    if broken: raise OSError('Both sources down')
                    return json.dumps(p if url==u.SOURCES['pvpoke'] else d).encode()
                with patch.object(u,'__file__',str(root/'updater/update.py')),patch.object(sys,'argv',['update.py','--html',str(page),'--today',TODAY.isoformat()]),patch.object(u,'collect_releases',side_effect=lambda today,ids:real_collect(today,ids,fetch)),patch.object(u,'urlopen',return_value=io.BytesIO(image.getvalue())),patch('sys.stdout',new=io.StringIO()):u.main()
            with self.assertRaises(ValueError):run(True)
            self.assertEqual(page.read_bytes(),original)
            self.assertEqual(before,{f.name:f.read_bytes() for f in (root/'data').iterdir()})
            run()
            after=u.extract(page.read_text(),'POKEMON')
            self.assertEqual(len(after),len(deck)+1)
            self.assertTrue({x['id'] for x in deck}<={x['id'] for x in after})
            self.assertEqual(sum(x['id']==489 for x in after),1)
            prior=u.extract(original.decode(),'TTS_META');meta=u.extract(page.read_text(),'TTS_META')
            self.assertTrue(all(meta[k]==v for k,v in prior.items()))
            (ROOT/'tests/future.html').write_bytes(page.read_bytes())

if __name__=='__main__':unittest.main()
