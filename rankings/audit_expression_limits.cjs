'use strict';
const fs=require('node:fs'),S=require('./session.cjs'),R=require('./core.cjs');
const session=S.create(JSON.parse(fs.readFileSync('data/attacker-rankings.json'))),results=[];
for(const types of [['overall'],...R.TYPES.map(t=>[t]),['fire','water'],R.TYPES])for(const count of [10,30])for(const elite of [true,false])for(const moveset of [false,true])for(const exclude of [false,true]){
 const value={count,moveset,elite,overall:types[0]==='overall',types:types[0]==='overall'?[]:types};
 try{const result=session.compile({},[{scope:[],portions:[{values:{attackers:value},exclude}]}],{ordinaryPortion:()=>({empty:true,valid:false})});results.push({types,count,elite,moveset,exclude,status:'compiled',characters:result.text.length});}
 catch(e){results.push({types,count,elite,moveset,exclude,status:'blocked',reason:e.message});}
}
fs.writeFileSync('rankings/expression-limit-audit.json',JSON.stringify({scope:'Actual session compiler with the 20000-character engineering bound and unchanged complexity limits (not a claimed game limit); no truncation or relaxation',results},null,2)+'\n');
console.log(JSON.stringify({cases:results.length,blocked:results.filter(r=>r.status==='blocked')}));
