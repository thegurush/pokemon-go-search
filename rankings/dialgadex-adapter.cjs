/* Offline source adapter. Executes a pinned upstream checkout; no calculator
   source is copied into the application. Output remains candidate data until
   form/sprite/move and source-reuse reviews are complete. */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),cp=require('child_process');
const R=require('./core.cjs');
const MoveSearch=require('./move_search.cjs');
const PINS={calculator:'eef2ddbb822bae0c0f4f5060115aef39dbea091a',data:'e88e23950e58968f2283625a6fdd65506195796d'};
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
function readPinned(root,revision,file){
 const head=cp.execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim();if(head!==revision)throw Error('Upstream revision changed; review adapter before recalculating');
 const committed=cp.execFileSync('git',['-C',root,'show',revision+':'+file],{maxBuffer:30e6});
 const working=fs.readFileSync(path.join(root,file));if(!working.equals(committed))throw Error('Modified upstream input: '+file);
 return working;
}
function loadCalculator(site,data,dataRevision=PINS.data){
 if(!/^[a-f0-9]{40}$/.test(dataRevision))throw Error('Invalid data revision');
 const sources=[],ctx=vm.createContext({console,Math,Set,Map,performance,setTimeout,tryYieldToMain:async()=>{}});
 for(const name of ['settings','pokemon_enums','pokemon_utils','calc']){
  const file='scripts/'+name+'.js',raw=readPinned(site,PINS.calculator,file);let code=raw.toString();
  sources.push({url:'https://github.com/mgrann03/dialgadex/blob/'+PINS.calculator+'/'+file,sha256:sha(raw)});
  if(name==='calc'){
   const marker='search_params.suboptimal ? 50 : 1';if(code.split(marker).length!==2)throw Error('Moveset-cap implementation changed');
   code=code.replace(marker,'search_params.suboptimal ? Infinity : 1');
  }
  vm.runInContext(code,ctx,{timeout:10000});
 }
 for(const [variable,file] of [['inputPokemon','pogo_pkm.min.json'],['inputFast','pogo_fm.json'],['inputCharged','pogo_cm.json']]){
  const raw=readPinned(data,dataRevision,file);ctx[variable]=JSON.parse(raw);
  sources.push({url:'https://github.com/mgrann03/pokemon-resources/blob/'+dataRevision+'/'+file,sha256:sha(raw)});
 }
 vm.runInContext(`var jb_pkm=inputPokemon,jb_max_id=Math.max(...inputPokemon.map(p=>p.id)),jb_fm=inputFast,jb_cm=inputCharged;
 settings_speculative=false;settings_metric='eDPS';settings_default_level=[40];settings_xl_budget=false;settings_party_size=1;settings_relobbytime=10;settings_team_size_normal=6;settings_team_size_mega=6;settings_type_affinity=false;settings_pve_turns=true;settings_supermega_level=1;`,ctx);
 return {ctx,sources};
}
function normalizeRestriction(pair,{purified=[],shadow=[]},isShadow){
 const name=pair.charged.name;
 if(purified.includes(name)||shadow.includes(name)){
  const requiredState=purified.includes(name)?'purified':'shadow';
  if((requiredState==='shadow')!==isShadow)throw Error('Restricted move conflicts with ranked form: '+name);
  pair.charged.elite=false;
  pair.requiredState=requiredState;
 }
 return pair;
}
function normalizeTemporaryMove(pair,pokemon,row){
 if((pokemon.temp_cm||[]).includes(pair.charged.name)){
  if(row.shadow||!['Mega','MegaY','MegaZ'].includes(row.upstreamForm))throw Error('Unexpected automatic Mega attack form');
  pair.charged.elite=false;
  pair.temporaryMegaAttack=true;
  pair.temporaryMoveEvidence='https://pokemongo.com/news/more-mega-updates-2026';
 }
 return pair;
}
function calculate({site,data,roster,dataRevision=PINS.data}){
 const {ctx,sources}=loadCalculator(site,data,dataRevision),forms=[],pairs=[],issues=[];
 const nativeRaw=readPinned(site,PINS.calculator,'locales/pokedata/en.json');
 const nativeNames=JSON.parse(nativeRaw).moves;
 sources.push({url:'https://github.com/mgrann03/dialgadex/blob/'+PINS.calculator+'/locales/pokedata/en.json',sha256:sha(nativeRaw)});
 if(roster.schema!==1||!Array.isArray(roster.forms)||!roster.forms.length)throw Error('Missing candidate form roster');
 const keys=new Set();
 for(const row of roster.forms){
  if(keys.has(row.key))throw Error('Duplicate candidate form');keys.add(row.key);
  const matches=ctx.inputPokemon.filter(p=>p.id===row.species&&p.form===row.upstreamForm);
  if(matches.length!==1)throw Error('Ambiguous upstream form: '+row.key);
  const pokemon=matches[0];
  if(row.released!==true||pokemon.released!==true)throw Error('Release gate rejected '+row.key);
  if(row.shadow&&pokemon.shadow!==true)throw Error('Missing upstream Shadow metadata: '+row.key);
  if(!row.sourceTypes||row.sourceTypes.filter(t=>t!=='none').sort().join()!==pokemon.types.map(t=>t.toLowerCase()).sort().join())throw Error('Cross-source typing mismatch: '+row.key);
  forms.push(row);ctx.subject=pokemon;ctx.isShadow=row.shadow;
  const movePools=vm.runInContext('GetPokemonMoves(subject)',ctx);
  if(movePools.length!==0&&movePools.length!==6)throw Error('Unexpected source move pools');
  const restrictions={purified:Array.from(movePools[4]||[]),shadow:Array.from(movePools[5]||[])};
  const scores=new Map();
  for(const type of ['overall',...R.TYPES]){
   ctx.attackType=type;
   const result=vm.runInContext(`GetStrongestAgainstSpecificEnemy(subject,isShadow,40,{weakness:GetTypesEffectivenessSingleBoost(attackType==='overall'?'Any':attackType[0].toUpperCase()+attackType.slice(1)),enemy_ys:[{Any:{y_num:null,cm_num:null}}],stats:{atk:null,def:180,hp:1e9}},{type:'Any',mixed:true,offtype:true,elite:true,suboptimal:true})`,ctx,{timeout:30000});
   for(const m of result){
    // Hidden Power's base record is a placeholder, not a Normal-type option.
    if(m.fm==='Hidden Power')continue;
    const key=m.fm_id+':'+m.fm_type+'|'+m.cm_id+':'+m.cm_type;
    if(!R.TYPES.includes(m.fm_type.toLowerCase())||!R.TYPES.includes(m.cm_type.toLowerCase())){issues.push({form:row.key,move:m.fm,reason:'Unresolved variable/unknown move type'});continue;}
    if(!Number.isFinite(m.rat)||m.rat<=0)throw Error('Invalid score for '+row.key+'/'+key);
    if(!scores.has(key))scores.set(key,{form:row.key,fast:{key:String(m.fm_id)+':'+m.fm_type.toLowerCase(),name:m.fm,type:m.fm_type.toLowerCase(),elite:!!m.fm_is_elite,searchName:m.fm.toLowerCase(),searchVerified:false},charged:{key:String(m.cm_id)+':'+m.cm_type.toLowerCase(),name:m.cm,type:m.cm_type.toLowerCase(),elite:!!m.cm_is_elite,searchName:m.cm.toLowerCase(),searchVerified:false},scores:{}});
    scores.get(key).scores[type]=m.rat;
   }
  }
  if(!scores.size)issues.push({form:row.key,reason:'No eligible source movesets; form cannot be ranked without further review'});
  for(const p of scores.values()){
   normalizeRestriction(p,restrictions,row.shadow);
   normalizeTemporaryMove(p,pokemon,row);
   Object.assign(p.fast,MoveSearch.resolve(p.fast,'fast',ctx.inputFast,nativeNames));
   Object.assign(p.charged,MoveSearch.resolve(p.charged,'charged',ctx.inputCharged,nativeNames));
   if(p.requiredState)issues.push({form:row.key,move:p.charged.name,reason:'Restricted-state release eligibility needs review: '+p.requiredState});
   pairs.push(p);
  }
 }
 R.validateForms(forms);R.validatePairs(pairs,forms);
 return {schema:1,review:{releaseRoster:false,sprites:false,sourceReuse:false},settings:{level:40,metric:'edps',typeAffinity:false,mixedThreshold:.85,speculative:false},completePairs:issues.length===0,sources:[...sources,...(roster.sources||[])],forms,pairs,issues:[...new Map(issues.map(x=>[JSON.stringify(x),x])).values()],adapter:{pins:{...PINS,data:dataRevision},patch:'Retain every eligible moveset instead of the upstream 50-result cap',status:'candidate; not approved for publication'}};
}
if(require.main===module){
 const [site,data,rosterFile,output]=process.argv.slice(2);if(!output)throw Error('Usage: node rankings/dialgadex-adapter.cjs calculator-checkout data-checkout candidate-roster.json candidate-output.json');
 const result=calculate({site,data,roster:JSON.parse(fs.readFileSync(rosterFile))});fs.writeFileSync(output,JSON.stringify(result));console.log(JSON.stringify({forms:result.forms.length,pairs:result.pairs.length,issues:result.issues.length,publication:'blocked pending review'}));
}
module.exports={calculate,loadCalculator,normalizeRestriction,normalizeTemporaryMove,PINS};
