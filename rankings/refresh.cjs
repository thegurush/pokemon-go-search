'use strict';
// Refresh scores only within the reviewed source schema and battle identities.
// The calculator remains pinned. This script never pushes or deploys.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto'),A=require('node:assert/strict');
const Adapter=require('./dialgadex-adapter.cjs'),Review=require('./prepare_reviewed.cjs'),Build=require('./build.cjs'),Embed=require('./embed.cjs');
const FILES=['pogo_pkm.min.json','pogo_fm.json','pogo_cm.json'];
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p));
function guard(previous,next,file){
 A(Array.isArray(previous)&&Array.isArray(next),'Unexpected source container');
 const pokemon=file===FILES[0],key=x=>pokemon?x.id+'|'+x.form:x.id+'|'+x.name+'|'+x.type;
 const index=rows=>{const m=new Map();for(const r of rows){A(Number.isSafeInteger(r.id)&&r.id>0,'Invalid source identifier');A(!m.has(key(r)),'Duplicate source identifier');m.set(key(r),r);}return m;};
 const old=index(previous),fresh=index(next);A.equal(old.size,fresh.size,'New or removed source records require review');
 const numeric=pokemon?['stats']:['power','duration','damage_window_start','damage_window_end','energy_delta'];
 let changed=0;
 for(const [id,before] of old){
  const after=fresh.get(id);A(after,'Missing reviewed source record: '+id);
  const structural=r=>Object.fromEntries(Object.entries(r).filter(([k])=>!numeric.includes(k)));
  A.deepEqual(structural(after),structural(before),'Changed identity, release status, type, or move availability requires review: '+id);
  if(pokemon){
   A.deepEqual(Object.keys(after.stats).sort(),Object.keys(before.stats).sort(),'Changed stat schema');
   for(const n of Object.values(after.stats))A(Number.isFinite(n)&&n>0&&n<=1000,'Invalid base stat');
  }else{
   for(const k of numeric)A(Number.isFinite(after[k]),'Invalid move value: '+k);
   A(after.power>=0&&after.power<=10000&&after.duration>0&&after.duration<=30000,'Invalid move power/duration');
   A(after.damage_window_start>=0&&after.damage_window_start<=30000&&after.damage_window_end>=0&&after.damage_window_end<=30000,'Invalid damage window');
   A(Math.abs(after.energy_delta)<=100&&Math.sign(after.energy_delta)===Math.sign(before.energy_delta),'Invalid move energy');
  }
  if(JSON.stringify(before)!==JSON.stringify(after))changed++;
 }
 if(pokemon){
  // Equal cosmetic profiles were collapsed during roster review. A balance
  // change may not silently turn one discarded appearance into a battle form.
  const groups=new Map();
  for(const before of previous){
   const signature=JSON.stringify([before.id,before.types,before.stats,before.fm,before.cm,before.elite_fm,before.elite_cm,before.temp_cm]);
   const value=JSON.stringify(fresh.get(key(before)).stats);
   if(groups.has(signature))A.equal(value,groups.get(signature),'Formerly equal appearance profiles diverged; review required');
   else groups.set(signature,value);
  }
 }
 return changed;
}
function refresh({site,data,root=process.cwd()}){
 const revision=cp.execFileSync('git',['-C',data,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
 A(/^[a-f0-9]{40}$/.test(revision),'Invalid data commit');
 const changes={};
 for(const file of FILES){
  const original=JSON.parse(cp.execFileSync('git',['-C',data,'show',Adapter.PINS.data+':'+file],{maxBuffer:30e6}));
  const raw=fs.readFileSync(path.join(data,file));
  A(raw.equals(cp.execFileSync('git',['-C',data,'show',revision+':'+file],{maxBuffer:30e6})),'Dirty data checkout');
  changes[file]=guard(original,JSON.parse(raw),file);
 }
 const rosterPath=path.join(__dirname,'refresh-inputs/roster.json'),roster=read(rosterPath);
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'tts-rankings-'));
 try{
  const input=Adapter.calculate({site,data,roster,dataRevision:revision}),raw=JSON.stringify(input),scores=path.join(temporary,'scores.json'),audit=path.join(temporary,'restrictions.json');
  fs.writeFileSync(scores,raw);
  cp.execFileSync(process.execPath,[path.join(__dirname,'audit_restrictions.cjs'),site,data,scores,audit,revision],{stdio:'pipe'});
  const reviewed=Review.prepare(input,roster,read(path.join(__dirname,'form-identity-audit-complete.json')),read(path.join(__dirname,'sprite-audit-complete.json')),read(audit),{inputHash:hash(raw),rosterHash:hash(fs.readFileSync(rosterPath)),sourceReuseReview:read(path.join(__dirname,'source-output-review.json'))});
  const snapshot=Build.build(reviewed);snapshot.inputSha256=hash(JSON.stringify(reviewed));
  const htmlPath=path.join(root,'index.html'),html=fs.readFileSync(htmlPath,'utf8');
  const species=new Set(JSON.parse(html.match(/const POKEMON=(\[.*?\]);/s)[1]).map(p=>p.id));
  for(const f of snapshot.forms)A(species.has(f.species),'Ranking species missing from saved application: '+f.key);
  const output=Embed.embed(html,snapshot);
  // All computation/review succeeds before either application output is touched.
  fs.writeFileSync(path.join(root,'data/attacker-rankings.json'),JSON.stringify(snapshot));
  fs.writeFileSync(htmlPath,output);
  return {revision,changes,forms:snapshot.forms.length,scope:'Reviewed forms and move availability; numeric balance refresh only',publication:'Requires full regression and browser checks'};
 }finally{fs.rmSync(temporary,{recursive:true,force:true});}
}
if(require.main===module){const [site,data]=process.argv.slice(2);if(!site||!data)throw Error('Usage: node rankings/refresh.cjs pinned-calculator-checkout current-data-checkout');console.log(JSON.stringify(refresh({site,data})));}
module.exports={guard,refresh};
