'use strict';
// Independently match special-move candidates to a released Shadow source record.
// This reports evidence, without approving identities or mutating ranking data.
const fs=require('fs'),vm=require('vm'),{loadCalculator}=require('./dialgadex-adapter.cjs');
const [site,data,inputPath,output,dataRevision]=process.argv.slice(2);
if(!output)throw Error('Usage: node rankings/audit_restrictions.cjs calculator data candidate-scores.json output.json');
const input=JSON.parse(fs.readFileSync(inputPath)),{ctx}=loadCalculator(site,data,dataRevision),seen=new Set(),rows=[];
for(const p of input.pairs){
 if(!p.requiredState)continue;
 const key=p.form+'|'+p.charged.key;if(seen.has(key))continue;seen.add(key);
 const form=input.forms.find(f=>f.key===p.form);let base=form.upstreamForm;
 if(['Mega','MegaY','MegaZ'].includes(base)){ctx.dex=form.species;base=vm.runInContext('GetPokemonForms(dex)[0]',ctx);}
 const evidence=input.forms.filter(f=>f.species===form.species&&f.upstreamForm===base&&f.shadow&&f.released&&f.releaseEvidence.length);
 rows.push({form:p.form,move:p.charged.name,requiredState:p.requiredState,sourceForm:base,status:evidence.length===1?'candidate-release-evidence-matched':'held',evidence:evidence.map(f=>({key:f.key,releaseEvidence:f.releaseEvidence})),limitation:'Source aliases and form identity remain unreviewed; this is not final release approval.'});
}
const report={inputSha256:require('crypto').createHash('sha256').update(fs.readFileSync(inputPath)).digest('hex'),schema:1,status:'Cross-source evidence audit only',matched:rows.filter(x=>x.status==='candidate-release-evidence-matched').length,held:rows.filter(x=>x.status==='held').length,rows};
fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify({matched:report.matched,held:report.held}));
