/* Tap to Search ranking policy. Pure functions: no DOM, fetch, or application state. */
(function(root){
'use strict';
const TYPES=Object.freeze(['normal','fire','water','grass','electric','ice','fighting','poison','ground','flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy']);
const PLUS_MOVE_NAMES=['aeroblast','sacred fire','discharge','zap cannon','dynamic punch','brave bird','future sight','outrage','dark pulse','moonblast','surf','mystical fire','drill peck'];
const MOVE_EXCLUSIONS=Object.freeze({psychi:['psychic fangs'],fly:['flying press'],thunder:['thunder punch','thunderbolt','thunder cage'],...Object.fromEntries(PLUS_MOVE_NAMES.map(name=>[name,[name+'+']])), 'aeroblast+':['aeroblast++'],'sacred fire+':['sacred fire++']});
const fail=message=>{throw new Error(message);};
const count=n=>Number.isInteger(n)&&n>=1&&n<=30?n:fail('Count must be an integer from 1 to 30');
const score=n=>typeof n==='number'&&Number.isFinite(n)&&n>0;
const type=t=>TYPES.includes(t);
const atom=value=>({op:'atom',value});
const and=(...args)=>({op:'and',args:args.flat()});
const or=(...args)=>({op:'or',args:args.flat()});
function parseTerm(text){
 const s=String(text).trim().toLowerCase();
 const m=s.match(/^(\d*)best([a-z]*)$/);
 if(!m)return /^(?:\d*)best/.test(s)?fail('Use best or best followed by an attacking type'):null;
 const n=count(m[1]?Number(m[1]):10),t=m[2]||'overall';
 if(t!=='overall'&&!type(t))fail('Unknown attacking type: '+t);
 // "bestoverall" is deliberately not a second undocumented spelling.
 if(m[2]==='overall')fail('Use best for Overall');
 return {type:t,count:n};
}
function parseSearch(text){
 const clauses=String(text).split('&').map(c=>c.split(',').map(s=>s.trim()).filter(Boolean)).filter(c=>c.length);
 const groups=[],ordinary=[];
 for(const clause of clauses){
  const parsed=clause.map(parseTerm),ranked=parsed.filter(Boolean);
  if(ranked.length&&ranked.length!==clause.length)fail('Keep best groups separate from ordinary search terms with &');
  if(ranked.length)groups.push(...ranked);else ordinary.push(clause);
 }
 if(groups.some(g=>g.type==='overall')&&groups.some(g=>g.type!=='overall'))fail('Search Overall separately from attacking types');
 const unique=new Map();for(const g of groups)unique.set(g.type,{type:g.type,count:Math.max(g.count,unique.get(g.type)?.count||0)});
 return {groups:[...unique.values()],ordinary};
}
function validateForms(forms){
 if(!Array.isArray(forms)||!forms.length)fail('Empty ranking forms');
 const seen=new Set();
 for(const f of forms){
  if(!f||typeof f.key!=='string'||!/^[a-z0-9:_-]+$/.test(f.key)||seen.has(f.key))fail('Invalid or duplicate form key');seen.add(f.key);
  if(!Number.isSafeInteger(f.species)||f.species<1||typeof f.name!=='string'||!f.name.trim()||typeof f.shadow!=='boolean')fail('Incomplete form metadata');
  if(f.released!==true||!Array.isArray(f.releaseEvidence)||!f.releaseEvidence.length)fail('Missing positive form release evidence: '+f.key);
  if(typeof f.sprite!=='string'||!/^https:\/\/raw\.githubusercontent\.com\/PokeAPI\/sprites\/[a-zA-Z0-9/_-]+\.png$/.test(f.sprite))fail('Invalid sprite: '+f.key);
  if(!f.search||!Array.isArray(f.search.terms)||!f.search.terms.length||!['exact','partial','unverified'].includes(f.search.accuracy))fail('Missing search mapping');
  if(!f.search.terms.includes(String(f.species))||!f.search.terms.includes(f.shadow?'shadow':'!shadow'))fail('Search must preserve species and Shadow identity');
  if(f.search.terms.some(t=>typeof t!=='string'||!t||/[,&|:;\r\n<>]/.test(t)))fail('Unsafe form search term');
  if(f.search.accuracy!=='exact'&&(typeof f.search.limitation!=='string'||!f.search.limitation.trim()))fail('Approximate search needs a limitation');
 }
 return forms;
}
function validatePairs(pairs,forms){
 const keys=new Set(forms.map(f=>f.key)),byKey=new Map(forms.map(f=>[f.key,f]));
 if(!Array.isArray(pairs)||!pairs.length)fail('Empty moveset scores');
 for(const p of pairs){
  if(p.temporaryMegaAttack!==undefined){
   const f=byKey.get(p.form);
   if(p.temporaryMegaAttack!==true||!f||f.shadow||!['Mega','MegaY','MegaZ'].includes(f.upstreamForm)||p.charged?.elite!==false||p.requiredState!==undefined||p.temporaryMoveEvidence!=='https://pokemongo.com/news/more-mega-updates-2026')fail('Invalid automatic Mega attack metadata');
  }
  if(p.requiredState!==undefined){
   if(!['purified','shadow'].includes(p.requiredState))fail('Unknown moveset state restriction');
   if(!byKey.has(p.form)||(p.requiredState==='shadow')!==byKey.get(p.form).shadow)fail('Moveset state conflicts with form');
  }
  if(!keys.has(p.form)||!p.fast||!p.charged||!type(p.fast.type)||!type(p.charged.type)||typeof p.fast.elite!=='boolean'||typeof p.charged.elite!=='boolean')fail('Invalid moveset metadata');
  if(typeof p.fast.key!=='string'||typeof p.charged.key!=='string'||!p.fast.key||!p.charged.key||!p.scores||!score(p.scores.overall)||TYPES.some(t=>!score(p.scores[t])))fail('Incomplete or invalid moveset scores');
 }
}
function rank(forms,pairs,{attackingType='overall',elite=true,threshold=.85}={}){
 validateForms(forms);validatePairs(pairs,forms);
 if(attackingType!=='overall'&&!type(attackingType))fail('Unknown ranking type');
 if(typeof elite!=='boolean'||typeof threshold!=='number'||threshold<0||threshold>1)fail('Invalid ranking settings');
 const eligible=pairs.filter(p=>elite||(!p.fast.elite&&!p.charged.elite));
 const same=eligible.filter(p=>p.fast.type===attackingType&&p.charged.type===attackingType);
 const benchmark=same.reduce((best,p)=>Math.max(best,p.scores[attackingType]),0);
 const byForm=new Map(),sameByForm=new Map();
 for(const p of eligible){if(!byForm.has(p.form))byForm.set(p.form,[]);byForm.get(p.form).push(p);}
 for(const p of same)sameByForm.set(p.form,Math.max(sameByForm.get(p.form)||0,p.scores[attackingType]));
 const output=[];
 for(const f of forms){
  const pool=byForm.get(f.key)||[];
  const sameBest=sameByForm.get(f.key)||0;
  const valid=pool.filter(p=>attackingType==='overall'||p.charged.type===attackingType&&(p.fast.type===attackingType||(benchmark>0&&p.scores[attackingType]>sameBest&&p.scores[attackingType]>=threshold*benchmark)));
  if(!valid.length)continue;
  const best=Math.max(...valid.map(p=>p.scores[attackingType]));
  const unique=new Map();for(const p of valid)if(p.scores[attackingType]===best)unique.set(p.fast.key+'|'+p.charged.key,p);
  output.push({form:f.key,type:attackingType,score:best,movesets:[...unique.values()]});
 }
 return output.sort((a,b)=>b.score-a.score||a.form.localeCompare(b.form));
}
function selectGroups(rankings,groups){
 const occurrences=new Map();
 for(const g of groups){
  count(g.count);if(!Array.isArray(rankings[g.type]))fail('Ranking unavailable: '+g.type);
  const seen=new Set();let n=0;
  for(const entry of rankings[g.type]){
   if(seen.has(entry.form))continue;seen.add(entry.form);
   const key=g.type+':'+entry.form;
   occurrences.set(key,{...entry,type:g.type,occurrenceKey:key,selectionKey:entry.form,rank:++n});
   if(n===g.count)break;
  }
 }
 return [...occurrences.values()].sort((a,b)=>b.score-a.score||a.type.localeCompare(b.type)||a.form.localeCompare(b.form));
}
function setMoveset(portion,on){
 return {...portion,moveset:!!on,elite:on?true:undefined};
}
function setType(portion,t){
 if(t==='overall')return {...portion,types:[],overall:true};
 if(!type(t))fail('Unknown attacking type');
 const types=new Set(portion.types||[]);types.has(t)?types.delete(t):types.add(t);
 return {...portion,overall:false,types:[...types]};
}
function movePredicate(move,slot){
 const name=move.searchName;
 if(!name||/[,&|:;!@<>\r\n]/.test(name))fail('Invalid move search name');
 const terms=[atom('@'+slot+name)];
 if(move.searchType!==undefined){
  const allowed=slot===1?name==='hidden power'&&!['normal','fairy'].includes(move.searchType):['weather ball','techno blast','aura wheel'].includes(name);
  if(!allowed||!type(move.searchType)||move.searchType!==move.type)fail('Invalid typed move search');
  terms.push(atom('@'+slot+move.searchType));
 }
 if(move.searchExclusions!==undefined){
  const expected=MOVE_EXCLUSIONS[name];
  if(slot===1||!expected||!Array.isArray(move.searchExclusions)||JSON.stringify(move.searchExclusions)!==JSON.stringify(expected))fail('Invalid move search exclusions');
  terms.push(...expected.map(excluded=>atom('!@'+slot+excluded)));
 }
 return and(terms);
}
function predicate(entries,forms,{moveset=false,exclude=false}={}){
 const byKey=new Map(forms.map(f=>[f.key,f])),warnings=new Set(),expressions=[],seen=new Set(),speciesGroups=new Map();
 for(const entry of entries){
  if(seen.has(entry.form))continue;
  // Same form may need a different best pair for each attacking type.
  if(!moveset)seen.add(entry.form);
  const f=byKey.get(entry.form);if(!f)fail('Unknown selected form');
  if(f.search.accuracy!=='exact')warnings.add(f.name+': '+f.search.limitation+(exclude?' Exclusion also removes these broader matches.':''));
  const identification=and(f.search.terms.map(atom));
  if(!moveset){expressions.push(identification);continue;}
  const pairs=entry.movesets.map(p=>{
   if(p.fast.searchVerified!==true||(!p.temporaryMegaAttack&&p.charged.searchVerified!==true))fail('Exact moveset search not verified for '+f.name);
   const fm=p.fast.searchName,cm=p.charged.searchName;
   if(p.temporaryMegaAttack){
    validatePairs([p],[f]);
    if(!fm||/[,&|:;!@<>\r\n]/.test(fm))fail('Invalid move search name');
    return movePredicate(p.fast,1);
   }
   if(!fm||!cm||/[,&|:;!@<>\r\n]/.test(fm+cm))fail('Invalid move search name');
   // Charged move in either slot; never require the second slot to exist.
   if(p.requiredState!==undefined&&!['purified','shadow'].includes(p.requiredState))fail('Unknown moveset state restriction');
   return and(...(p.requiredState?[atom(p.requiredState)]:[]),movePredicate(p.fast,1),or(movePredicate(p.charged,2),movePredicate(p.charged,3)));
  });
  if(!pairs.length)fail('Missing best moveset');
  expressions.push(and(identification,or(pairs)));
  if(Number.isSafeInteger(f.species)&&f.species>0&&f.search.terms.includes(String(f.species))){
   const key=String(f.species),list=speciesGroups.get(key)||[];
   list.push(and(f.search.terms.filter(t=>t!==key).map(atom),or(pairs)));
   speciesGroups.set(key,list);
  }
 }
 if(!expressions.length)fail('No eligible attackers');
 let ast=or(expressions);
 // A stored Pokemon has exactly one National Dex species. Guard each species'
 // condition independently instead of distributing unrelated movesets together.
 // Keep exclusion in its original union/negation form, and never apply this to
 // arbitrary search atoms or forms without validated numeric species identities.
 if(moveset&&!exclude&&speciesGroups.size>1&&[...speciesGroups.values()].reduce((n,x)=>n+x.length,0)===expressions.length){
  const union=ast;
  ast=and(or([...speciesGroups.keys()].map(atom)),[...speciesGroups].map(([id,conditions])=>or(atom('!'+id),or(conditions))));
  ast.negationSource=union;
 }
 return {ast:exclude?{op:'not',arg:ast}:ast,warnings:[...warnings]};
}
function stringify(ast,{maxClauses=1000,maxCharacters=20000,maxProducts=50000}={}){
 let products=0;
 const inv=s=>s.startsWith('!')?s.slice(1):'!'+s;
 function simplify(cs){
  const seen=new Set(),result=[];
  for(const c of cs){const u=[...new Set(c)].sort();if(u.some(s=>u.includes(inv(s))))continue;const k=u.join(',');if(!seen.has(k)){seen.add(k);result.push(u);}}
  if(result.length>maxClauses)fail('Search expression too complex');
  return result.filter((c,i)=>!result.some((d,j)=>i!==j&&d.length<c.length&&d.every(t=>c.includes(t))));
 }
 function cnf(n,neg=false){
  if(neg&&n.negationSource)return cnf(n.negationSource,true);
  if(n.op==='atom')return [[neg?inv(n.value):n.value]];
  if(n.op==='not')return cnf(n.arg,!neg);
  if(!['and','or'].includes(n.op)||!Array.isArray(n.args))fail('Invalid search expression');
  const parts=n.args.map(x=>cnf(x,neg));
  if((n.op==='and')!==neg)return simplify(parts.flat());
  return parts.reduce((a,b)=>{products+=a.length*b.length;if(products>maxProducts)fail('Search expression too complex');return simplify(a.flatMap(x=>b.map(y=>x.concat(y))));},[[]]);
 }
 const text=cnf(ast).map(c=>c.length?c.join(','):'0&!0').join('&');
 if(text.length>maxCharacters)fail('Search expression too long');
 return text;
}
const api={TYPES,count,parseTerm,parseSearch,validateForms,validatePairs,rank,selectGroups,setMoveset,setType,predicate,stringify};
if(typeof module!=='undefined')module.exports=api;else root.TTSRankings=api;
})(typeof window!=='undefined'?window:globalThis);
