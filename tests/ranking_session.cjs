'use strict';
const A=require('assert/strict'),fs=require('fs'),vm=require('vm'),R=require('../rankings/core.cjs'),B=require('../rankings/build.cjs'),S=require('../rankings/session.cjs');
const snapshot=require('./ranking_fixture.cjs')(),session=S.create(snapshot);
const html=fs.readFileSync('index.html','utf8');const compilerSource=html.slice(html.lastIndexOf('(function(root)',html.indexOf('root.TTSCompiler=')),html.indexOf('/* Species-only global badge attribution.'));
const ctx={};vm.createContext(ctx);vm.runInContext(compilerSource,ctx);const C=ctx.TTSCompiler;
A.equal(session.search('pikachu'),null);const found=session.search('2bestfire,2bestwater');A.equal(found.length,4);A.deepEqual(found.map(r=>r.score),[101,100,91,90]);A.equal(found[0].selectionKey,found[1].selectionKey);A.notEqual(found[0].occurrenceKey,found[1].occurrenceKey);A.notEqual(found[0].selectionKey,found[2].selectionKey);
A.deepEqual(session.search('1bestfire&shadow',r=>r.shadow),[],'No backfill after ordinary constraints');
A.equal(session.filterPlan({overall:true,count:1}).entries.length,1);A.equal(session.filterPlan({types:['fire','water'],count:2}).entries.length,4);
A.throws(()=>session.filterPlan({overall:true,types:['fire']}));A.throws(()=>session.identify('form:missing'));A.throws(()=>session.identify('NaN'));
const options={ordinaryPortion:C.portion,ordinaryToken:id=>id===1?'bulbasaur':String(id)};
A.equal(session.compile({'form:shadow':'include'},[],options).text,'1&shadow');
A.equal(session.compile({'form:ordinary':'include'},[],options).text,'1&!shadow');
const excluding=session.compile({'form:mega':'exclude'},[],options);A(excluding.warnings.some(x=>x.includes('Exclusion')));
const filter={scope:[],portions:[{values:{attackers:{types:['fire'],count:1,moveset:true}},order:['attackers'],exclude:false}]};
const text=session.compile({},[filter],options).text;A(text.includes('@1fastmove'));A(text.includes('@2chargedmove,@3chargedmove'));
const evaluate=(text,yes)=>!text||text.split('&').every(c=>c.split(',').some(t=>t.startsWith('!')?!yes.has(t.slice(1)):yes.has(t)));
// Compare real existing compiler semantics for mixed selections, exclusion and scope.
for(const main of [{},{1:'include'},{1:'include',2:'exclude'}])for(const scope of [[],[1]])for(const exclude of [false,true]){
 const f={scope,portions:[{values:{shiny:true},exclude,order:['shiny']}]};const old=C.compile(main,[f],options.ordinaryToken),next=session.compile(main,[f],options).text;
 for(let bits=0;bits<8;bits++){const yes=new Set(['bulbasaur','2','shiny'].filter((_,i)=>bits&(1<<i)));A.equal(evaluate(next,yes),evaluate(old,yes));}
}
for(const mutate of [s=>s.rankings.elite.fire.reverse(),s=>s.rankings.elite.fire.push(s.rankings.elite.fire[0]),s=>s.rankings.ordinary.fire[0].movesets[0].fast.elite=true,s=>s.rankings.elite.fire[0].score=NaN,s=>delete s.rankings.elite.water,s=>s.rankings.elite.fire[0].movesets[0].form='shadow']){const bad=structuredClone(snapshot);mutate(bad);A.throws(()=>S.create(bad));}
snapshot.forms[0].name='MUTATED';A.equal(session.search('bestfire')[0].name,'ordinary');
const facade=session.compiler(C);A.equal(facade.filter(filter).valid,true);A.deepEqual(Array.from(facade.portion(filter.portions[0]).families),['attackers']);
const badFilter={values:{attackers:{overall:true,types:['fire']}},order:[]};A.equal(facade.portion(badFilter).valid,false);
console.log('PASS snapshot validation, independent search, form identities, no backfill, moveset slots, warnings, scope/exclusion and existing compiler truth tables');
