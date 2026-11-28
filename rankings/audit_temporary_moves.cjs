'use strict';
const fs=require('fs'),R=require('./core.cjs');
function classify(input,source){
 const byForm=new Map(source.map(f=>[f.id+'|'+f.form,f]));
 const forms=new Map(input.forms.map(f=>[f.key,f]));
 const clone=JSON.parse(JSON.stringify(input));let corrected=0;
 for(const pair of clone.pairs){
  const form=forms.get(pair.form),row=byForm.get(form.species+'|'+form.upstreamForm);
  if(!row)throw Error('Missing source form');
  if((row.temp_cm||[]).includes(pair.charged.name)){
   if(form.shadow||!['Mega','MegaY','MegaZ'].includes(form.upstreamForm))throw Error('Unexpected temporary move form');
   pair.charged.elite=false;
   pair.temporaryMegaAttack=true;
   corrected++;
  }
 }
 return {candidate:clone,corrected};
}
function audit(input,source){
 const {candidate,corrected}=classify(input,source);
 const without=candidate.pairs.filter(p=>!p.temporaryMegaAttack),groups=[];
 for(const elite of [true,false])for(const type of ['overall',...R.TYPES]){
  const opts={attackingType:type,elite};
  const summarize=pairs=>R.rank(candidate.forms,pairs,opts).slice(0,30).map(x=>({form:x.form,score:x.score,moves:x.movesets.map(p=>p.charged.name)}));
  const original=summarize(input.pairs),included=summarize(candidate.pairs),excluded=summarize(without);
  groups.push({type,elite,eliteClassificationChanges:JSON.stringify(original)!==JSON.stringify(included),raidGymDifference:JSON.stringify(included)!==JSON.stringify(excluded),included,excluded});
 }
 return {status:'Scenario audit only. Production settings and source scores unchanged.',temporaryPairCount:corrected,eliteClassificationChangedGroups:groups.filter(g=>g.eliteClassificationChanges).length,raidGymDifferentGroups:groups.filter(g=>g.raidGymDifference).length,groups};
}
if(require.main===module){const [scores,source,output]=process.argv.slice(2);const result=audit(JSON.parse(fs.readFileSync(scores)),JSON.parse(fs.readFileSync(source)));fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({temporaryPairCount:result.temporaryPairCount,eliteClassificationChangedGroups:result.eliteClassificationChangedGroups,raidGymDifferentGroups:result.raidGymDifferentGroups}));}
module.exports={classify,audit};
