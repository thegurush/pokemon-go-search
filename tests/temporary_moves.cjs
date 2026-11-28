const assert=require('node:assert/strict'),{classify}=require('../rankings/audit_temporary_moves.cjs');
const input={forms:[{key:'mega',species:121,upstreamForm:'Mega',shadow:false}],pairs:[{form:'mega',charged:{name:'Liquidation+',elite:true}},{form:'mega',charged:{name:'Ordinary Elite',elite:true}}]};
const source=[{id:121,form:'Mega',temp_cm:['Liquidation+']}];
const {candidate,corrected}=classify(input,source);
assert.equal(corrected,1);assert.equal(candidate.pairs[0].charged.elite,false);assert.equal(candidate.pairs[0].temporaryMegaAttack,true);assert.equal(candidate.pairs[1].charged.elite,true);assert.equal(input.pairs[0].charged.elite,true);assert.equal(input.pairs[0].temporaryMegaAttack,undefined);
const invalid=JSON.parse(JSON.stringify(input));invalid.forms[0].shadow=true;assert.throws(()=>classify(invalid,source),/Unexpected temporary/);
assert.throws(()=>classify(input,[]),/Missing source/);
console.log('PASS temporary Mega classification independent of Elite, no input mutation, invalid form and missing source rejection');
