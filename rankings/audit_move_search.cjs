'use strict';
const fs=require('fs'),R=require('./core.cjs');
function audit(input,fastCatalog,chargedCatalog){
 const catalog=[...fastCatalog.map(x=>({...x,slot:'fast'})),...chargedCatalog.map(x=>({...x,slot:'charged'}))];
 const used=new Map();
 for(const elite of [true,false])for(const type of ['overall',...R.TYPES]){
  for(const row of R.rank(input.forms,input.pairs,{attackingType:type,elite}).slice(0,30))for(const pair of row.movesets){
   for(const slot of ['fast','charged']){
    const move=pair[slot],key=slot+'|'+move.key;
    if(!used.has(key)){
     const name=move.searchName.toLowerCase(),sameSlot=catalog.filter(x=>x.slot===slot),otherSlot=catalog.filter(x=>x.slot!==slot);
     used.set(key,{key,slot,name:move.name,searchName:name,type:move.type,issues:[],contexts:[]});
     const item=used.get(key);
     if(R.TYPES.includes(name))item.issues.push('Name is also a type search keyword');
     const prefixes=sameSlot.filter(x=>x.name.toLowerCase()!==name&&x.name.toLowerCase().startsWith(name));
     if(prefixes.length)item.issues.push('Potential prefix matches: '+[...new Set(prefixes.map(x=>x.name))].join(', '));
     if(otherSlot.some(x=>x.name.toLowerCase().startsWith(name)))item.issues.push('Unnumbered search may match the other slot');
     if(name.startsWith('hidden power '))item.issues.push('Typed source name may not be the displayed move name');
     if(/plus|\+|blastoise|pink|green/.test(name))item.issues.push('Source-specific naming needs in-game alias verification');
    }
    used.get(key).contexts.push({form:row.form,type,elite});
   }
  }
 }
 const rows=[...used.values()];
 return {status:'Review queue, not native-search approval. Prefix behavior and aliases require verification.',uniqueMoves:rows.length,flaggedMoves:rows.filter(x=>x.issues.length).length,rows};
}
if(require.main===module){
 const [input,fm,cm,out]=process.argv.slice(2);const result=audit(JSON.parse(fs.readFileSync(input)),JSON.parse(fs.readFileSync(fm)),JSON.parse(fs.readFileSync(cm)));fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({uniqueMoves:result.uniqueMoves,flaggedMoves:result.flaggedMoves}));
}
module.exports={audit};
