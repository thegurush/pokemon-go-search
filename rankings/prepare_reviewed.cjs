'use strict';
// Assemble review evidence before the ordinary snapshot builder can run.
// This does not publish, contact sources, or alter any application file.
const fs=require('node:fs'),crypto=require('node:crypto'),A=require('node:assert/strict'),R=require('./core.cjs');
const digest=raw=>crypto.createHash('sha256').update(raw).digest('hex');
function prepare(input,roster,identity,sprites,restrictions,{inputHash,rosterHash,sourceReuseReview}){
 if(!sourceReuseReview?.approved||!sourceReuseReview.basis)throw Error('Source reuse review is required');
 A.equal(identity.rosterSha256,rosterHash,'Stale identity audit');A.equal(sprites.rosterSha256,rosterHash,'Stale asset audit');A.equal(restrictions.inputSha256,inputHash,'Stale restriction audit');
 A.equal(identity.held,0,'Unresolved sprite identities');A.equal(sprites.failed,0,'Failed sprite assets');
 A.deepEqual(input.forms,roster.forms,'Scored roster differs from reviewed roster');
 const identities=new Map(identity.rows.map(r=>[r.form,r])),assets=new Map(sprites.assets.map(r=>[r.url,r]));
 for(const form of input.forms){
  A.equal(identities.get(form.key)?.status,'matched','Missing identity evidence: '+form.key);
  A.equal(assets.get(form.sprite)?.status,'decoded','Missing sprite bytes: '+form.key);
  A(form.releaseEvidence?.length,'Missing release evidence');
 }
 const states=new Map(restrictions.rows.map(r=>[r.form+'|'+r.move,r]));
 const excludedPairs=[],excludedForms=[];
 const pairs=input.pairs.filter(pair=>{
  if(!pair.requiredState)return true;
  const evidence=states.get(pair.form+'|'+pair.charged.name);
  A(evidence,'Missing restricted-state review');A.equal(evidence.requiredState,pair.requiredState);
  if(evidence.status==='candidate-release-evidence-matched'){A.equal(evidence.evidence.length,1);return true;}
  A.equal(evidence.status,'held');excludedPairs.push({form:pair.form,move:pair.charged.name,reason:'No confirmed release evidence for the required Shadow/purified source form'});return false;
 });
 const hasPairs=new Set(pairs.map(p=>p.form));
 const forms=input.forms.filter(form=>{
  if(hasPairs.has(form.key))return true;
  // The pinned calculator has no usable Smeargle move pool. Never invent one.
  A.equal(form.species,235,'Unexpected form with no eligible scores');
  excludedForms.push({form:form.key,reason:'Calculator has no eligible Smeargle move pool'});return false;
 }).map(f=>({...f,reviewed:true}));
 for(const issue of input.issues){
  if(issue.reason.startsWith('Restricted-state release eligibility needs review: ')){A(states.has(issue.form+'|'+issue.move));continue;}
  A(excludedForms.some(x=>x.form===issue.form)&&issue.reason==='No eligible source movesets; form cannot be ranked without further review','Unreviewed calculation issue: '+JSON.stringify(issue));
 }
 R.validateForms(forms);R.validatePairs(pairs,forms);
 return {...input,forms,pairs,completePairs:true,review:{releaseRoster:true,sprites:true,sourceReuse:true},issues:[],reviewEvidence:{inputHash,rosterHash,sourceReuseReview,excludedPairs,excludedForms,heldRoster:roster.held,scope:'Complete eligible pairs for reviewed released forms. Unconfirmed forms are excluded, never assigned a speculative release.'}};
}
if(require.main===module){
 const [inputPath,rosterPath,identityPath,spritesPath,restrictionPath,reusePath,outputPath]=process.argv.slice(2);
 if(!outputPath)throw Error('Usage: prepare_reviewed.cjs scores roster identity-audit asset-audit restriction-audit source-review output');
 const read=p=>JSON.parse(fs.readFileSync(p));
 const result=prepare(read(inputPath),read(rosterPath),read(identityPath),read(spritesPath),read(restrictionPath),{inputHash:digest(fs.readFileSync(inputPath)),rosterHash:digest(fs.readFileSync(rosterPath)),sourceReuseReview:read(reusePath)});
 fs.writeFileSync(outputPath,JSON.stringify(result));console.log(JSON.stringify({forms:result.forms.length,pairs:result.pairs.length,excludedPairs:result.reviewEvidence.excludedPairs.length}));
}
module.exports={prepare};
