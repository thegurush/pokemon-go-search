'use strict';
// Evidence for syntax is separate from per-move identity and ambiguity review.
const R=require('./core.cjs');
const EVIDENCE='user-tyranitar-slot-tests-2026-11-26';
const OBSERVED=new Set(['smack down','stone edge','brutal swing']);
function resolve(move,slot,catalog,nativeNames={}){
 const name=String(move.name||'').toLowerCase();
 const rows=catalog.filter(x=>String(x.id)+':'+String(x.type).toLowerCase()===move.key);
 const blocked=reason=>({searchName:name,searchVerified:false,searchReview:{reason}});
 if(!['fast','charged'].includes(slot)||!name||/[,&|:;!@<>\r\n]/.test(name))return blocked('Invalid move search metadata');
 if(!rows.some(x=>x.name.toLowerCase()===name))return blocked('Move ID/type/name does not match source catalog');
 const nativeName=String(nativeNames[move.key.split(':')[0]]||'').toLowerCase();
 const typedCharged={'292':'weather ball','293':'weather ball','294':'weather ball','295':'weather ball','352':'weather ball','336':'techno blast','337':'techno blast','338':'techno blast','339':'techno blast','340':'techno blast','406':'aura wheel','407':'aura wheel'};
 const mapped=typedCharged[move.key.split(':')[0]];
 if(slot==='charged'&&mapped){
  if(nativeName!==mapped||!R.TYPES.includes(move.type))return blocked('Typed charged move needs matching native name and type');
  return {searchName:mapped,searchType:move.type,searchVerified:true,searchReview:{identity:'Pinned English move-name mapping and source ID/type',verification:'Native move plus same-slot type conjunction; composed from documented slot/type syntax and user-tested conjunction'}};
 }
 // Official names plus tested native grammar; positive ++ is not directly observed.
 const apexDouble={'361':'aeroblast++','363':'sacred fire++'};
 const doubleName=apexDouble[move.key.split(':')[0]];
 if(slot==='charged'&&doubleName){
  if(nativeName!==doubleName)return blocked('Apex ++ requires its reviewed native label');
  if(catalog.some(x=>{const n=String(nativeNames[String(x.id)]||x.name).toLowerCase();return n!==doubleName&&n.startsWith(doubleName);}))return blocked('Unreviewed Apex ++ prefix collision');
  return {searchName:doubleName,searchVerified:true,searchReview:{identityEvidence:'https://pokemongo.com/news/apex-reveal',syntaxEvidence:'user-apex-plus-tests-2026-11-26',verification:'Inferred from user-tested literal plus/prefix and numbered-slot grammar. Positive ++ matching has not been tested on a purified specimen.'}};
 }
 const plusBases=['aeroblast','sacred fire','discharge','zap cannon','dynamic punch','brave bird','future sight','outrage','dark pulse','moonblast','surf','mystical fire','drill peck'];
 const apexPlus={'360':'aeroblast+','362':'sacred fire+'};
 const plusName=apexPlus[move.key.split(':')[0]];
 if(slot==='charged'&&(plusBases.includes(name)||plusName)){
  const target=plusName||name;
  if(nativeName!==target)return blocked('Plus-family mapping requires pinned native name');
  const exclusions=[target+'+'];
  const unknown=catalog.some(x=>{const n=String(nativeNames[String(x.id)]||x.name).toLowerCase();return n!==target&&n.startsWith(target)&&![target+'+',target+'++'].includes(n);});
  if(unknown)return blocked('Unreviewed plus-family prefix collision');
  return {searchName:target,searchExclusions:exclusions,searchVerified:true,searchReview:{syntaxEvidence:'user-apex-plus-tests-2026-11-26',verification:'User-tested base/+ matching, ++ rejection on + specimens, and + exclusion. Other move families use the same grammar by inference; positive ++ matching remains untested.'}};
 }
 if(nativeName&&nativeName!==name&&!name.startsWith('hidden power '))return blocked('Source label differs from native move name; explicit mapping required');
 if(slot==='fast'&&name.startsWith('hidden power ')){
  const t=name.slice('hidden power '.length);
  if(!R.TYPES.includes(t)||t!==String(move.type).toLowerCase()||['normal','fairy'].includes(t))return blocked('Invalid Hidden Power type mapping');
  return {searchName:'hidden power',searchType:t,searchVerified:true,searchReview:{syntaxEvidence:'user-starmie-hidden-power-tests-2026-11-26',verification:t==='dark'?'User-tested name and actual type':'Typed mapping inferred from user-tested Dark Hidden Power syntax'}};
 }
 if(slot==='charged'&&name==='psychic')return {searchName:'psychi',searchExclusions:['psychic fangs'],searchVerified:true,searchReview:{syntaxEvidence:'user-butterfree-psychic-tests-2026-11-26',verification:'Psychi and either-slot syntax user-tested; same-slot exclusion grammar user-tested on Tyranitar; Psychic Fangs name not individually in-game tested'}};
 const reviewed={fly:['flying press'],thunder:['thunder punch','thunderbolt','thunder cage']};
 if(slot==='charged'&&reviewed[name]){
  const exclusions=reviewed[name];
  const unknown=catalog.some(x=>x.name.toLowerCase()!==name&&x.name.toLowerCase().startsWith(name)&&!exclusions.includes(x.name.toLowerCase()));
  if(unknown)return blocked('New unreviewed move-name prefix collision');
  return {searchName:name,searchExclusions:exclusions,searchVerified:true,searchReview:{syntaxEvidence:'user-tyranitar-slot-exclusion-tests-2026-11-26',verification:'Reviewed source names using user-tested numbered-slot exclusion grammar; individual names not directly in-game tested'}};
 }
 if(R.TYPES.includes(name))return blocked('Move name is also a type keyword');
 if(name.startsWith('hidden power ')||/plus|\+|blastoise|pink|green/.test(name))return blocked('Source-specific name requires explicit native mapping');
 // Compare displayed names: a second internal ID with the same native label is not a prefix collision.
 if(catalog.some(x=>{const displayed=String(nativeNames[String(x.id)]||x.name).toLowerCase();return displayed!==name&&displayed.startsWith(name);}))return blocked('Same-slot move-name prefix collision');
 return {searchName:name,searchVerified:true,searchReview:{syntaxEvidence:EVIDENCE,identity:'Source catalog ID, type and name match; no same-slot prefix/type collision',verification:OBSERVED.has(name)?'User-tested name and slot syntax':'Reviewed source name using documented move search and user-tested slot syntax'}};
}
module.exports={resolve,EVIDENCE};
