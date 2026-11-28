const A=require('node:assert/strict'),{resolve}=require('../rankings/move_search.cjs');
const catalog=[{id:1,type:'Rock',name:'Smack Down'},{id:2,type:'Dark',name:'Brutal Swing'},{id:3,type:'Electric',name:'Thunder'},{id:4,type:'Electric',name:'Thunderbolt'},{id:5,type:'Psychic',name:'Psychic'},{id:6,type:'Normal',name:'Hidden Power Ice'},{id:7,type:'Water',name:'Liquidation+'},{id:8,type:'Grass',name:'Vine Whip'}];
const m=(i,name,type)=>({key:i+':'+type,name});
A(resolve(m(1,'Smack Down','rock'),'fast',catalog).searchVerified);
A(resolve(m(2,'Brutal Swing','dark'),'charged',catalog).searchVerified);
A.equal(resolve(m(8,'Vine Whip','grass'),'fast',catalog).searchReview.verification,'Reviewed source name using documented move search and user-tested slot syntax');
for(const [id,name,type] of [[6,'Hidden Power Ice','normal'],[7,'Liquidation+','water'],[1,'Wrong Name','rock']])A.equal(resolve(m(id,name,type),'charged',catalog).searchVerified,false);
console.log('PASS move identity and slot evidence: safe names admitted, prefix/type/source aliases blocked, observations distinguished from inference');
const R=require('../rankings/core.cjs');
const hp=resolve({key:'9:dark',name:'Hidden Power Dark',type:'dark'},'fast',[{id:9,name:'Hidden Power Dark',type:'Dark'}]);
A.equal(hp.searchType,'dark');A.equal(hp.searchName,'hidden power');A(hp.searchVerified);
const psychic=resolve(m(5,'Psychic','psychic'),'charged',catalog);
A.equal(psychic.searchName,'psychi');A.deepEqual(psychic.searchExclusions,['psychic fangs']);
const form={key:'test',name:'Test',search:{accuracy:'exact',terms:['121']}};
const pair={fast:{...hp,type:'dark'},charged:psychic};
const make=p=>R.predicate([{form:'test',movesets:[p]}],[form],{moveset:true}).ast;
const compiled=R.stringify(make(pair));
function token(t,moves){let neg=t.startsWith('!');if(neg)t=t.slice(1);if(t==='121')return !neg;const [,slot,name]=t.match(/^@(\d)(.*)$/);const move=moves[Number(slot)-1];const yes=!!move&&(move.name.startsWith(name)||move.type===name);return neg?!yes:yes;}
function query(q,moves){return q.split('&').every(c=>c.split(',').some(t=>token(t,moves)));}
const fast={name:'hidden power',type:'dark'},psych={name:'psychic',type:'psychic'},fangs={name:'psychic fangs',type:'psychic'},other={name:'aqua jet',type:'water'};
for(const [moves,expected] of [[[fast,psych],true],[[fast,other,psych],true],[[fast,fangs],false],[[fast,psych,fangs],true],[[fast,fangs,psych],true],[[{...fast,type:'ice'},psych],false],[[fast,other],false]])A.equal(query(compiled,moves),expected,JSON.stringify(moves));
A(!compiled.includes('!@psychic fangs'));
A.throws(()=>make({...pair,fast:{...pair.fast,searchType:'dark&shiny'}}),/typed move/);
A.throws(()=>make({...pair,charged:{...psychic,searchExclusions:['psychic fangs,shiny']}}),/exclusions/);
console.log('PASS Psychic either-slot matching, same-slot Fangs exclusions, single charged slot and Hidden Power actual type; unsafe metadata rejected');

for(const [name,exclusions] of [['Thunder',['thunder punch','thunderbolt','thunder cage']],['Fly',['flying press']]]){
 const move=resolve({name,key:'10:flying'},'charged',[{id:10,type:'Flying',name},...exclusions.map((name,i)=>({id:20+i,type:'Flying',name}))]);
 A(move.searchVerified);A.deepEqual(move.searchExclusions,exclusions);
 const output=R.stringify(make({...pair,charged:move}));
 for(const excluded of exclusions){
  A.equal(query(output,[fast,{name:excluded,type:'flying'}]),false);
  A.equal(query(output,[fast,{name:name.toLowerCase(),type:'flying'},{name:excluded,type:'flying'}]),true);
  A.equal(query(output,[fast,{name:excluded,type:'flying'},{name:name.toLowerCase(),type:'flying'}]),true);
 }
 A.equal(resolve({name,key:'10:flying'},'charged',[{id:10,type:'Flying',name},{id:99,type:'Flying',name:name+' Unknown'}]).searchVerified,false);
}
console.log('PASS reviewed Fly/Thunder exclusions in either slot; new prefix variants fail closed');
for(const [id,source,name,type] of [[292,'Weather Ball Fire','weather ball','fire'],[337,'Techno Blast Burn','techno blast','fire'],[407,'Aura Wheel Dark','aura wheel','dark']]){
 const catalog=[{id,name:source,type}],data={key:id+':'+type,name:source,type};
 const mapped=resolve(data,'charged',catalog,{[id]:name});A(mapped.searchVerified);A.equal(mapped.searchType,type);
 const expression=R.stringify(make({...pair,charged:{...data,...mapped}}));
 A(query(expression,[fast,{name,type}]));
 A(!query(expression,[fast,{name,type:'water'}]));
 A(!query(expression,[fast,{name,type:'water'},{name:'other',type}]));
 A(query(expression,[fast,{name:'other',type:'water'},{name,type}]));
 A.equal(resolve(data,'charged',catalog,{[id]:'Wrong Name'}).searchVerified,false);
}
A.equal(resolve({key:'390:fairy',name:"Nature's Madness",type:'fairy'},'charged',[{id:390,name:"Nature's Madness",type:'Fairy'}],{'390':'Nature’s Madness'}).searchVerified,false);
console.log('PASS typed Weather Ball, Techno Blast and Aura Wheel; move and type must match the same charged slot; unmapped display aliases held');

const hydroCatalog=[{id:107,name:'Hydro Pump',type:'Water'},{id:135,name:'Hydro Pump Blastoise',type:'Water'}];
A(resolve({key:'107:water',name:'Hydro Pump',type:'water'},'charged',hydroCatalog,{'107':'Hydro Pump','135':'Hydro Pump'}).searchVerified);
A.equal(resolve({key:'135:water',name:'Hydro Pump Blastoise',type:'water'},'charged',hydroCatalog,{'107':'Hydro Pump','135':'Hydro Pump'}).searchVerified,false);
console.log('PASS internal duplicate labels do not create false native prefix collisions; unreviewed alias records remain blocked');
const plusCatalog=[{id:358,name:'Sacred Fire',type:'Fire'},{id:362,name:'Sacred Fire Plus',type:'Fire'},{id:363,name:'Sacred Fire Plus Plus',type:'Fire'}];
const nativePlus={'358':'Sacred Fire','362':'Sacred Fire+','363':'Sacred Fire++'};
for(const [id,source,display] of [[358,'Sacred Fire','sacred fire'],[362,'Sacred Fire Plus','sacred fire+']]){
 const data={key:id+':fire',name:source,type:'fire'},mapped=resolve(data,'charged',plusCatalog,nativePlus);
 A(mapped.searchVerified);A.equal(mapped.searchName,display);
 const output=R.stringify(make({...pair,charged:{...data,...mapped}}));
 A(query(output,[fast,{name:display,type:'fire'}]));
 A(!query(output,[fast,{name:display+'+',type:'fire'}]));
 A(query(output,[fast,{name:display,type:'fire'},{name:display+'+',type:'fire'}]));
 A(query(output,[fast,{name:display+'+',type:'fire'},{name:display,type:'fire'}]));
}
const double=resolve({key:'363:fire',name:'Sacred Fire Plus Plus',type:'fire'},'charged',plusCatalog,nativePlus);
A(double.searchVerified);A.equal(double.searchName,'sacred fire++');A(double.searchReview.verification.includes('has not been tested'));
const doubleOutput=R.stringify(make({...pair,charged:double}));
A(query(doubleOutput,[fast,{name:'sacred fire++',type:'fire'}]));
A(query(doubleOutput,[fast,other,{name:'sacred fire++',type:'fire'}]));
A(!query(doubleOutput,[fast,{name:'sacred fire+',type:'fire'}]));
A(!query(doubleOutput,[fast,{name:'sacred fire',type:'fire'}]));
A.equal(resolve({key:'363:fire',name:'Sacred Fire Plus Plus',type:'fire'},'charged',plusCatalog,{'363':'Sacred Fire+'}).searchVerified,false);
A.equal(resolve({key:'363:fire',name:'Sacred Fire Plus Plus',type:'fire'},'charged',[...plusCatalog,{id:999,name:'Sacred Fire+++',type:'Fire'}],nativePlus).searchVerified,false);
A.equal(resolve({key:'358:fire',name:'Sacred Fire',type:'fire'},'charged',[...plusCatalog,{id:999,name:'Sacred Fire Extra',type:'Fire'}],nativePlus).searchVerified,false);
console.log('PASS ordinary/+ distinction, either charged slot, other-slot preservation, unknown suffix rejection and explicitly inferred ++ mapping');
