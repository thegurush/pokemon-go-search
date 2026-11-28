'use strict';
const A=require('node:assert/strict'),R=require('../rankings/core.cjs');
const forms=[{key:'a',species:1,name:'A',search:{terms:['1','!shadow'],accuracy:'exact'}},{key:'as',species:1,name:'Shadow A',search:{terms:['1','shadow'],accuracy:'exact'}},{key:'b',species:2,name:'B',search:{terms:['2','!shadow'],accuracy:'exact'}}];
const pair=(fast,charged)=>({fast:{searchName:fast,searchVerified:true},charged:{searchName:charged,searchVerified:true}});
const entries=[{form:'a',movesets:[pair('tackle','surf')]},{form:'as',movesets:[pair('bite','surf')]},{form:'b',movesets:[pair('tackle','thunder')]}];
function token(t,p){if(t.startsWith('!'))return !token(t.slice(1),p);if(/^\d+$/.test(t))return +t===p.species;if(t==='shadow')return p.shadow;const m=t.match(/^@(\d)(.*)$/);return m&&p.moves[+m[1]-1]===m[2];}
function matches(text,p){return text.split('&').every(c=>c.split(',').some(t=>token(t,p)));}
for(const exclude of [false,true]){
 const ast=R.predicate(entries,forms,{moveset:true}).ast;
 const text=R.stringify(exclude?{op:'not',arg:ast}:ast);
 A.equal(text,R.stringify(R.predicate(entries,forms,{moveset:true,exclude}).ast));
 for(const species of [1,2,3])for(const shadow of [false,true])for(const fast of ['tackle','bite','wrong'])for(const charged1 of ['surf','thunder','wrong'])for(const charged2 of [undefined,'surf','thunder']){
  const p={species,shadow,moves:[fast,charged1,charged2]},has=m=>charged1===m||charged2===m;
  const wanted=species===1&&((!shadow&&fast==='tackle')||(shadow&&fast==='bite'))&&has('surf')||species===2&&!shadow&&fast==='tackle'&&has('thunder');
  A.equal(matches(text,p),exclude?!wanted:!!wanted,JSON.stringify({exclude,p,text}));
 }
}
const many=Array.from({length:30},(_,i)=>({key:'f'+i,species:i+10,name:'F'+i,search:{terms:[String(i+10),'!shadow'],accuracy:'exact'}}));
const ranked=many.map((f,i)=>({form:f.key,movesets:[pair('fast'+i,'charged'+i)]}));
A(R.stringify(R.predicate(ranked,many,{moveset:true}).ast).length<5000);
// The generic explosion guard remains in force for expressions without species semantics.
A.throws(()=>R.stringify({op:'or',args:Array.from({length:30},(_,i)=>({op:'and',args:[{op:'atom',value:'a'+i},{op:'atom',value:'b'+i}]}))},{maxProducts:100}),/complex/);
console.log('PASS species-guard optimization truth table, same-species Shadow alternatives, either charged slot, unselected species and unchanged complexity limits');
