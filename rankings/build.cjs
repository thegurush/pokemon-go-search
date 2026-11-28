/* Build saved rankings from reviewed, normalized score input. No network calls.
   Source-specific calculators must supply every eligible pair, not only top N. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),R=require('./core.cjs');
function build(input){
 if(input?.schema!==1||input.review?.releaseRoster!==true||input.review?.sprites!==true||input.review?.sourceReuse!==true)throw Error('Ranking input has not passed release, sprite and source-reuse review');
 if(input.settings?.level!==40||input.settings?.metric!=='edps'||input.settings?.typeAffinity!==false||input.settings?.mixedThreshold!==.85||input.settings?.speculative!==false)throw Error('Unapproved ranking settings');
 if(input.completePairs!==true)throw Error('Complete eligible movesets required; truncated rankings cannot be reranked');
 if(!Array.isArray(input.sources)||!input.sources.length||input.sources.some(s=>!/^https:\/\//.test(s.url)||!/^[a-f0-9]{64}$/.test(s.sha256)))throw Error('Missing source provenance');
 const forms=R.validateForms(input.forms);R.validatePairs(input.pairs,forms);
 const rankings={elite:{},ordinary:{}};
 for(const [mode,elite] of [['elite',true],['ordinary',false]])for(const attackingType of ['overall',...R.TYPES]){
  const list=R.rank(forms,input.pairs,{attackingType,elite});
  if(!list.length)throw Error('Empty ranking: '+mode+'/'+attackingType);
  rankings[mode][attackingType]=list.slice(0,30);
 }
 const used=new Set(Object.values(rankings).flatMap(m=>Object.values(m).flatMap(rows=>rows.map(x=>x.form))));
 return {schema:1,settings:input.settings,sources:input.sources,forms:forms.filter(f=>used.has(f.key)),rankings};
}
function writeSnapshot(inputPath,outputPath){
 const raw=fs.readFileSync(inputPath),input=JSON.parse(raw),snapshot=build(input);
 snapshot.inputSha256=crypto.createHash('sha256').update(raw).digest('hex');
 const output=JSON.stringify(snapshot);const target=path.resolve(outputPath);fs.mkdirSync(path.dirname(target),{recursive:true});
 const temporary=target+'.'+crypto.randomUUID()+'.tmp';
 try{fs.writeFileSync(temporary,output,{flag:'wx'});fs.renameSync(temporary,target);}finally{fs.rmSync(temporary,{force:true});}
 return snapshot;
}
if(require.main===module){
 if(process.argv.length!==4){console.error('Usage: node rankings/build.cjs reviewed-input.json saved-rankings.json');process.exitCode=1;}
 else try{const result=writeSnapshot(process.argv[2],process.argv[3]);console.log('Saved validated rankings for '+result.forms.length+' forms');}catch(e){console.error('No publication: '+e.message);process.exitCode=1;}
}
module.exports={build,writeSnapshot};
