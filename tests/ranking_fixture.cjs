// Synthetic test data only. Never embed or publish as real rankings.
const R=require('../rankings/core.cjs');
const form=(key,species,shadow=false)=>({key,species,name:key,shadow,released:true,releaseEvidence:['fixture only'],sprite:`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${species}.png`,search:{terms:[String(species),shadow?'shadow':'!shadow'],accuracy:'exact'}});
const forms=[form('ordinary',1),form('shadow',1,true),form('mega',2)];forms[2].search.accuracy='partial';forms[2].search.limitation='Other forms of this species are included.';
const pairs=forms.flatMap((f,i)=>R.TYPES.map(type=>({form:f.key,fast:{key:'fast-'+type,type,elite:false,searchName:'fastmove',searchVerified:true},charged:{key:'charged-'+type,type,elite:false,searchName:'chargedmove',searchVerified:true},scores:Object.fromEntries(['overall',...R.TYPES].map(t=>[t,100-i*10+(t==='water'?1:0)]))})));
const input={schema:1,review:{releaseRoster:true,sprites:true,sourceReuse:true},settings:{level:40,metric:'edps',typeAffinity:false,mixedThreshold:.85,speculative:false},completePairs:true,sources:[{url:'https://example.com/fixture-only',sha256:'0'.repeat(64)}],forms,pairs};

module.exports=()=>require('../rankings/build.cjs').build(input);
