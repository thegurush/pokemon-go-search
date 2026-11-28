'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),A=require('node:assert/strict'),R=require('../rankings/core.cjs'),B=require('../rankings/build.cjs');
const form={key:'fixture',species:1,name:'Fixture',shadow:false,released:true,releaseEvidence:['synthetic test'],sprite:'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png',search:{terms:['1','!shadow'],accuracy:'exact'}};
const input={schema:1,review:{releaseRoster:true,sprites:true,sourceReuse:true},settings:{level:40,metric:'edps',typeAffinity:false,mixedThreshold:.85,speculative:false},completePairs:true,sources:[{url:'https://example.com/fixture',sha256:'0'.repeat(64)}],forms:[form],pairs:R.TYPES.map(t=>({form:'fixture',fast:{key:t,type:t,elite:false},charged:{key:t,type:t,elite:false},scores:Object.fromEntries(['overall',...R.TYPES].map(k=>[k,10]))}))};
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tts-ranking-'));
try{
 const source=path.join(dir,'input.json'),target=path.join(dir,'saved.json');fs.writeFileSync(source,JSON.stringify(input));const result=B.writeSnapshot(source,target);A.equal(Object.keys(result.rankings.elite).length,19);A.equal(Object.keys(result.rankings.ordinary).length,19);
 const good=fs.readFileSync(target);
 for(const bad of [{...input,review:{...input.review,releaseRoster:false}},{...input,completePairs:false},{...input,sources:[]},{...input,settings:{...input.settings,speculative:true}},{...input,pairs:input.pairs.slice(1)}]){
  fs.writeFileSync(source,JSON.stringify(bad));A.throws(()=>B.writeSnapshot(source,target));A.deepEqual(fs.readFileSync(target),good);
 }
 A.equal(fs.readdirSync(dir).length,2);console.log('PASS 38 ranking groups; incomplete/unreviewed data preserves last good snapshot; atomic write cleanup');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
