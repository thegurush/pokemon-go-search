'use strict';
const fs=require('node:fs'),A=require('node:assert/strict'),S=require('../rankings/session.cjs'),R=require('../rankings/core.cjs'),E=require('../rankings/embed.cjs');
const data=JSON.parse(fs.readFileSync('data/attacker-rankings.json')),html=fs.readFileSync('index.html','utf8');
A(html.includes(E.block(data)),'Application must embed exactly the saved real snapshot');
A(!data.sources.some(x=>x.url.includes('example.com')),'Synthetic sources cannot ship');
const deck=new Set(JSON.parse(html.match(/const POKEMON=(\[.*?\]);/s)[1]).map(x=>x.id));
for(const f of data.forms)A(deck.has(f.species),'Ranked species missing from application metadata: '+f.key);
const session=S.create(data);
for(const mode of ['elite','ordinary'])for(const type of ['overall',...R.TYPES]){
 const entries=data.rankings[mode][type];A.equal(new Set(entries.map(x=>x.form)).size,entries.length);
 const plan=session.filterPlan({count:30,overall:type==='overall',types:type==='overall'?[]:[type],moveset:true,elite:mode==='elite'});
 A(plan.valid);A.equal(plan.entries.length,entries.length);A(R.stringify(plan.ast).length>0);
}
const observed=require('./long-search-observed.json');
A.equal(observed.text.length,5357);A.equal((observed.text+observed.suffix).length,5359);
const observedAst={op:'and',args:observed.text.split('&').map(c=>({op:'or',args:c.split(',').map(value=>({op:'atom',value}))}))};
A.equal(R.stringify(observedAst),observed.text);
A.throws(()=>R.stringify(observedAst,{maxCharacters:5000}),/too long/);
A.equal(R.stringify({op:'and',args:[observedAst,{op:'atom',value:'1'}]}).endsWith('&1'),true);
console.log('PASS real snapshot, saved/embedded equality, existing species metadata, 38 ranked groups and real Moveset compilation');
module.exports=data;
