const fs=require('fs'),assert=require('assert/strict'),cp=require('child_process'),vm=require('vm');
const original=fs.existsSync('baselines/v71.html')?fs.readFileSync('baselines/v71.html','utf8'):cp.execFileSync('git',['show','5c173a0bf25d04256a95edd50957a5114346a2ba:index.html'],{maxBuffer:20e6}).toString();
const current=fs.readFileSync('index.html','utf8');
function strip(s){return s.replace(/const (POKEMON|TTS_META)=(\[.*?\]|\{.*?\});/gs,'DATA;').replace(/\/\/ Exact September 29, 2026 cutoff validation\.[\s\S]*?(?=const SPRITE_BASE=)/,'').replace(/\/\/ Availability is validated[\s\S]*?(?=const SPRITE_BASE=)/,'').replace(/\nfunction validateSpeciesMetadata[\s\S]*?validateSpeciesMetadata\(POKEMON,TTS_META\);\n/,'');}
assert.equal(strip(current),strip(original),'V71 UI and production behavior must be byte-identical');
const manifest=current.slice(current.indexOf('function validateSpeciesManifest'),current.indexOf('const SPRITE_BASE='));
const meta=current.slice(current.indexOf('function validateSpeciesMetadata'),current.indexOf('validateSpeciesMetadata(POKEMON,TTS_META);'));
const deck=JSON.parse(current.match(/const POKEMON=(\[.*?\]);/s)[1]);const metadata=JSON.parse(current.match(/const TTS_META=(\{.*?\});/s)[1]);
const ctx={POKEMON:deck};vm.createContext(ctx);vm.runInContext(manifest+meta,ctx);ctx.validateSpeciesMetadata(deck,metadata);
assert.throws(()=>ctx.validateSpeciesManifest([...deck,deck[0]]));assert.throws(()=>ctx.validateSpeciesMetadata(deck,{}));
console.log('PASS V71 preservation and dynamic startup validation');

const future=fs.readFileSync('tests/future.html','utf8');const fd=JSON.parse(future.match(/const POKEMON=(\[.*?\]);/s)[1]);const fm=JSON.parse(future.match(/const TTS_META=(\{.*?\});/s)[1]);ctx.validateSpeciesManifest(fd);ctx.validateSpeciesMetadata(fd,fm);assert.equal(fd.length,deck.length+1);console.log('PASS later addition through updater and JavaScript startup validators');
for(const match of current.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
