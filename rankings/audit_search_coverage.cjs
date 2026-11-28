'use strict';
const fs=require('fs'),R=require('./core.cjs');
function audit(input){
 let pass=0,held=0;const reasons=new Map();
 for(const elite of [true,false])for(const type of ['overall',...R.TYPES]){
  for(const row of R.rank(input.forms,input.pairs,{attackingType:type,elite}).slice(0,30)){
   try{R.stringify(R.predicate([row],input.forms,{moveset:true}).ast);pass++;}
   catch(e){held++;for(const pair of row.movesets)for(const slot of ['fast','charged']){
    if(!pair[slot].searchVerified&&!(slot==='charged'&&pair.temporaryMegaAttack))reasons.set(pair[slot].name,pair[slot].searchReview?.reason||e.message);
   }}
  }
 }
 return {scope:'Top-30 occurrences across 38 groups, not unique Pokemon. Source-name review is not individual in-game verification.',pass,held,reasons:[...reasons]};
}
if(require.main===module){const [input,output]=process.argv.slice(2),result=audit(JSON.parse(fs.readFileSync(input)));fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));}
module.exports={audit};
