/* Saved-data bridge shared by search, Advanced Filters and card selection.
   No fetches, live calculations, DOM state, or synthetic production data. */
(function(root){
'use strict';
const R=typeof module!=='undefined'?require('./core.cjs'):root.TTSRankings;
const fail=m=>{throw Error(m);},clone=x=>JSON.parse(JSON.stringify(x));
function validateSnapshot(s){
 if(s?.schema!==1||s.settings?.level!==40||s.settings?.metric!=='edps'||s.settings?.typeAffinity!==false||s.settings?.mixedThreshold!==.85||s.settings?.speculative!==false)fail('Unsupported saved ranking settings');
 if(!Array.isArray(s.sources)||!s.sources.length||s.sources.some(x=>!/^https:\/\//.test(x.url)||!/^[a-f0-9]{64}$/.test(x.sha256)))fail('Missing ranking provenance');
 R.validateForms(s.forms);const known=new Set(s.forms.map(f=>f.key));
 for(const mode of ['elite','ordinary'])for(const type of ['overall',...R.TYPES]){
  const rows=s.rankings?.[mode]?.[type];if(!Array.isArray(rows)||!rows.length||rows.length>30)fail('Missing or oversized saved ranking: '+mode+'/'+type);
  let previous=Infinity;const seen=new Set();
  for(const row of rows){
   if(!known.has(row.form)||seen.has(row.form)||row.type!==type||!Number.isFinite(row.score)||row.score<=0||row.score>previous)fail('Invalid saved ranking order or form');
   seen.add(row.form);previous=row.score;
   R.validatePairs(row.movesets,s.forms);
   for(const p of row.movesets){
    if(p.form!==row.form||p.scores[type]!==row.score)fail('Best moveset score/form mismatch');
    if(type!=='overall'&&p.charged.type!==type)fail('Off-type charged move in saved ranking');
    if(mode==='ordinary'&&(p.fast.elite||p.charged.elite))fail('Elite move in ordinary ranking');
   }
  }
 }
 return s;
}
function create(snapshot){
 const data=validateSnapshot(clone(snapshot)); // Caller mutation must not change a running session.
 const forms=new Map(data.forms.map(f=>[f.key,f]));
 const targetKey=form=>'form:'+form;
 function formForTarget(key){
  if(typeof key!=='string'||!key.startsWith('form:'))return null;
  const f=forms.get(key.slice(5));if(!f)fail('Unknown ranked selection: '+key);return f;
 }
 function rows(groups,elite=true){return R.selectGroups(data.rankings[elite?'elite':'ordinary'],groups).map(row=>{
  const f=forms.get(row.form);
  return {...row,selectionKey:targetKey(row.form),species:f.species,name:f.name,sprite:f.sprite,shadow:f.shadow,accuracy:f.search.accuracy,limitation:f.search.limitation||''};
 });}
 function search(text,matches=()=>true){
  const parsed=R.parseSearch(text);if(!parsed.groups.length)return null;
  // Ranking precedes additional deck constraints; never backfill a removed rank.
  return rows(parsed.groups).filter(row=>parsed.ordinary.every(group=>group.some(term=>matches(row,term))));
 }
 function filterPlan(value,{exclude=false,scope=[]}={}){
  if(!value||(!value.overall&&!value.types?.length))return {empty:true,valid:false,entries:[],warnings:[]};
  const n=R.count(value.count??10),types=value.overall?['overall']:[...new Set(value.types)];
  if(value.overall&&value.types?.length)fail('Overall and types are mutually exclusive');
  if(types.some(t=>t!=='overall'&&!R.TYPES.includes(t)))fail('Unknown attacking type');
  const entries=rows(types.map(type=>({type,count:n})),!value.moveset||value.elite!==false);
  // A scope is a separate implication at compile time, not a ranking recalculation.
  const result=R.predicate(entries,data.forms,{moveset:!!value.moveset,exclude});
  return {...result,entries,empty:false,valid:true,scope:[...scope]};
 }
 function identify(key){
  const f=formForTarget(key);
  if(f)return R.predicate([{form:f.key}],data.forms);
  if(!/^\d+$/.test(String(key))||Number(key)<1)fail('Unknown species selection');
  return {ast:{op:'atom',value:String(key)},warnings:[]};
 }
 function compile(main,filters,{ordinaryPortion,ordinaryToken=id=>String(id)}={}){
  if(typeof ordinaryPortion!=='function')fail('Existing portion compiler required');
  const warnings=new Set(),and=args=>({op:'and',args}),or=args=>({op:'or',args}),not=arg=>({op:'not',arg});
  const collect=p=>{p.warnings?.forEach(w=>warnings.add(w));return p.ast;};
  function target(key){
   if(formForTarget(key))return collect(identify(key));
   if(!/^\d+$/.test(String(key))||Number(key)<1)fail('Unknown species selection');
   return {op:'atom',value:ordinaryToken(Number(key))};
  }
  const valid=[];
  for(const f of filters){
   const parts=[];
   for(const p of f.portions||[]){
    const normal=clone(p);delete normal.values?.attackers;normal.exclude=false;
    const ordinary=ordinaryPortion(normal),ranking=filterPlan(p.values?.attackers);
    if(!ordinary.empty&&!ordinary.valid)fail('Incomplete ordinary filter portion');
    if(ordinary.empty&&ranking.empty)continue;
    const ast=and([...(ordinary.empty?[]:[ordinary.ast]),...(ranking.empty?[]:[collect(ranking)])]);
    // Exclusion negates the complete portion, just as in the existing compiler.
    if(p.exclude&& !ranking.empty)filterPlan(p.values.attackers,{exclude:true}).warnings.forEach(w=>warnings.add(w));
    parts.push(p.exclude?not(ast):ast);
   }
   if(parts.length)valid.push({scope:f.scope||[],ast:and(parts)});
  }
  const domain=new Set(Object.keys(main).filter(k=>main[k]==='include'));for(const f of valid)for(const k of f.scope)domain.add(String(k));
  const terms=[];if(domain.size)terms.push(or([...domain].map(target)));
  for(const key of Object.keys(main).filter(k=>main[k]==='exclude')){
   const f=formForTarget(key);if(f&&f.search.accuracy!=='exact')warnings.add(f.name+': '+f.search.limitation+' Exclusion also removes these broader matches.');
   terms.push(not(target(key)));
  }
  for(const f of valid)terms.push(f.scope.length?or([not(or(f.scope.map(target))),f.ast]):f.ast);
  return {text:R.stringify(and(terms)),warnings:[...warnings]};
 }
 function compiler(existing){
  function portion(p){
   if(!p.values?.attackers)return existing.portion(p);
   const ordinary=clone(p);delete ordinary.values.attackers;ordinary.exclude=false;
   const normal=existing.portion(ordinary);
   try{
    const plan=filterPlan(p.values.attackers);
    const families=[...new Set([...(normal.families||[]),...(plan.empty?[]:['attackers'])])];
    const ast=existing.and([...(normal.empty?[]:[normal.ast]),...(plan.empty?[]:[plan.ast])]);
    return {valid:(!normal.empty||!plan.empty)&&(normal.empty||normal.valid),empty:normal.empty&&plan.empty,ast:p.exclude?existing.not(ast):ast,families,warnings:plan.warnings};
   }catch(error){return {valid:false,empty:false,ast:existing.and([]),families:['attackers'],error:error.message};}
  }
  function filter(f){const pp=f.portions.map(portion),nonempty=pp.filter(p=>!p.empty);return {valid:nonempty.length>0&&nonempty.every(p=>p.valid),ast:existing.and(nonempty.map(p=>p.ast)),family:nonempty.flatMap(p=>p.families)[0],purple:pp.some((p,i)=>p.valid&&!f.portions[i].exclude),red:pp.some((p,i)=>p.valid&&f.portions[i].exclude)};}
  return {...existing,portion,filter};
 }
 return Object.freeze({search,rows,filterPlan,identify,compile,compiler,formForTarget,hasForm:key=>forms.has(key)});
}
const api={validateSnapshot,create};if(typeof module!=='undefined')module.exports=api;else root.TTSRankingSession=api;
})(typeof window!=='undefined'?window:globalThis);
