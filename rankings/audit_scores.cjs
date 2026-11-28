// Report real-source candidate calculations without approving or publishing them.
'use strict';
const fs=require('fs'),assert=require('assert/strict'),R=require('./core.cjs'),B=require('./build.cjs');
const [scores,rosterPath,output]=process.argv.slice(2);if(!output)throw Error('Usage: node rankings/audit_scores.cjs candidate-scores.json candidate-roster.json audit.json');
const input=JSON.parse(fs.readFileSync(scores)),roster=JSON.parse(fs.readFileSync(rosterPath));
assert.throws(()=>B.build(input),/review/,'Candidate data must remain blocked from production');
const rows=[];
for(const elite of [true,false])for(const type of ['overall',...R.TYPES]){
 const ranked=R.rank(input.forms,input.pairs,{attackingType:type,elite}),top=ranked.slice(0,30);
 assert(top.length>0);assert.equal(new Set(top.map(r=>r.form)).size,top.length);
 rows.push({type,elite,totalEligible:ranked.length,mixedInTop30:type==='overall'?null:top.filter(x=>x.movesets.some(p=>p.fast.type!==type)).length,restrictedMovesInTop30:top.flatMap(x=>x.movesets.filter(p=>['Return','Frustration'].includes(p.charged.name)).map(p=>({form:x.form,move:p.charged.name}))),top3:top.slice(0,3).map(x=>({form:x.form,score:x.score,fast:x.movesets[0].fast.name,charged:x.movesets[0].charged.name}))});
}
fs.writeFileSync(output,JSON.stringify({status:'Candidate-source audit, not approved production rankings',forms:input.forms.length,pairs:input.pairs.length,held:roster.held,issues:input.issues,sources:input.sources,settings:input.settings,rankings:rows},null,2));
console.log('PASS 38 real-source candidate groups; no duplicate form positions; production publication correctly rejected');
