'use strict';
// Offline integration test: use cloned pinned data, never edit the supplied checkout.
const A=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const {refresh}=require('../rankings/refresh.cjs'),{PINS}=require('../rankings/dialgadex-adapter.cjs'),E=require('../rankings/embed.cjs');
const [siteArg,dataArg]=process.argv.slice(2);A(siteArg&&dataArg,'Supply pinned calculator and data checkouts');
const site=path.resolve(siteArg),data=path.resolve(dataArg),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tts-refresh-test-'));
const git=(...args)=>cp.execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});
try{
 const clone=path.join(tmp,'source'),root=path.join(tmp,'app');git('clone','--shared',data,clone);git('-C',clone,'checkout','--detach',PINS.data);
 git('-C',clone,'config','user.name','Offline refresh test');git('-C',clone,'config','user.email','test@example.invalid');
 fs.mkdirSync(path.join(root,'data'),{recursive:true});fs.copyFileSync('index.html',path.join(root,'index.html'));fs.copyFileSync('data/attacker-rankings.json',path.join(root,'data/attacker-rankings.json'));
 refresh({site,data:clone,root});
 const beforeHtml=fs.readFileSync(path.join(root,'index.html'),'utf8'),before=JSON.parse(fs.readFileSync(path.join(root,'data/attacker-rankings.json')));
 const movesPath=path.join(clone,'pogo_fm.json'),moves=JSON.parse(fs.readFileSync(movesPath)),move=moves.find(m=>m.name==='Incinerate');A(move);move.power+=1;
 fs.writeFileSync(movesPath,JSON.stringify(moves));git('-C',clone,'add','pogo_fm.json');git('-C',clone,'commit','-m','Simulate one valid move balance update');
 const report=refresh({site,data:clone,root}),afterHtml=fs.readFileSync(path.join(root,'index.html'),'utf8'),after=JSON.parse(fs.readFileSync(path.join(root,'data/attacker-rankings.json')));
 A.equal(report.changes['pogo_fm.json'],1);A.notDeepEqual(after.rankings,before.rankings,'Real scores must respond to changed move power');
 A.equal(E.strip(beforeHtml),E.strip(afterHtml),'Refresh must only replace saved ranking data');A(after.sources.some(s=>s.url.includes(report.revision)),'New data provenance must be recorded');
 cp.execFileSync(process.execPath,[path.resolve('tests/ranking_real.cjs')],{cwd:root,stdio:'pipe'});
 const saved=fs.readFileSync(path.join(root,'data/attacker-rankings.json'));
 moves.push({...move,id:99999,name:'Unknown future move'});fs.writeFileSync(movesPath,JSON.stringify(moves));git('-C',clone,'add','pogo_fm.json');git('-C',clone,'commit','-m','Simulate unreviewed new move');
 A.throws(()=>refresh({site,data:clone,root}),/require review/);
 A.equal(fs.readFileSync(path.join(root,'index.html'),'utf8'),afterHtml);A(fs.readFileSync(path.join(root,'data/attacker-rankings.json')).equals(saved));
 console.log('PASS full refresh: numeric move change recalculates rankings, preserves UI, updates provenance and compiles all groups; unknown move preserves both outputs');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
