'use strict';
const fs=require('fs'),A=require('assert/strict'),vm=require('vm');
const html=fs.readFileSync('index.html','utf8');
function restore(html){
 const E=require('../rankings/embed.cjs');
 if(html.includes('// TTS V78 saved rankings start')){
  const saved=JSON.parse(fs.readFileSync('data/attacker-rankings.json','utf8'));
  A(html.includes(E.block(saved)),'Embedded ranking data differs from saved snapshot');
  html=E.strip(html);
 }
 const modules='// TTS V78 ranking modules start\n'+fs.readFileSync('rankings/core.cjs','utf8')+'\n'+fs.readFileSync('rankings/session.cjs','utf8')+'\n// TTS V78 ranking modules end\n\n';
 A.equal(html.split(modules).length-1,1,'Embedded ranking modules differ from tested source');html=html.replace(modules,'');
 const css=fs.readFileSync('rankings/card-styles.html','utf8');A.equal(html.split(css).length-1,1,'Ranking card CSS differs from reviewed block');html=html.replace(css,'');
 for(const [before,after] of JSON.parse(fs.readFileSync('rankings/app-edits.json','utf8')).reverse()){
  A.equal(html.split(after).length-1,1,'Ranking app edit missing/duplicated: '+after.slice(0,60));html=html.replace(after,before);
 }
 return html;
}
restore(html);
// Execute actual application result handler with a controlled snapshot adapter.
const begin=html.indexOf('results=function(){const scope='),end=html.indexOf("let badgeKey=",begin);
const cards=[{id:1,name:'Bulbasaur'},{id:4,name:'Charmander'}],main={},scope=[];let queried=0;
const c={S:{main,mainMode:{},filterMode:{},builder:{filter:{scope}}},POKEMON:cards,TTS_META:{1:{family:1},4:{family:4}},search:{value:''},norm:s=>s.toLowerCase(),matchesDeckTerm:(p,t)=>p.name.toLowerCase().includes(t),rankingSession:{search:()=>{queried++;return [{species:1,selectionKey:'form:one',occurrenceKey:'fire:one',name:'one'}]}},rankingError:'',notify:()=>{}};vm.createContext(c);vm.runInContext(html.slice(begin,end),c);
A.deepEqual(Array.from(c.results(),x=>x.id),[1,4]);c.search.value='charmander';A.deepEqual(Array.from(c.results(),x=>x.id),[4]);A.equal(queried,0);
c.search.value='bestfire';c.S.mainMode.evo=true;A.deepEqual(Array.from(c.results(),x=>x.id),['form:one'],'Evolution does not expand ranked results');
c.S.mainMode.selected=true;A.equal(c.results().length,0);main['form:one']='include';A.equal(c.results().length,1);
c.S.visit={};A.equal(c.results().length,1);c.S.filterMode.selected=true;A.equal(c.results().length,0);scope.push('form:one');A.equal(c.results().length,1);
c.rankingSession=null;A.equal(c.results().length,0,'Missing ranking data must not generate fake results');
console.log('PASS actual deck query integration, ordinary fallback, scoped/main form selection and missing-data behavior');
module.exports=restore;
