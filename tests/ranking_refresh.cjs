'use strict';
const A=require('node:assert/strict'),{guard}=require('../rankings/refresh.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
const pokemon=[{id:1,form:'Normal',name:'Bulbasaur',types:['Grass','Poison'],released:true,shadow:true,stats:{baseAttack:118,baseDefense:111,baseStamina:128},fm:['Vine Whip'],cm:['Power Whip']}];
A.equal(guard(pokemon,pokemon,'pogo_pkm.min.json'),0);
let changed=clone(pokemon);changed[0].stats.baseAttack=120;A.equal(guard(pokemon,changed,'pogo_pkm.min.json'),1);
for(const mutate of [x=>x.push({...x[0],id:2}),x=>x.push(x[0]),x=>x.pop(),x=>x[0].released=false,x=>x[0].shadow=false,x=>x[0].types=['Fire'],x=>x[0].fm.push('Tackle'),x=>x[0].elite_cm=['Power Whip'],x=>x[0].stats.baseAttack=NaN,x=>x[0].stats.baseAttack=1001]){
 changed=clone(pokemon);mutate(changed);A.throws(()=>guard(pokemon,changed,'pogo_pkm.min.json'));
}
const moves=[{id:281,name:'Hidden Power Fire',type:'Fire',power:15,duration:1500,damage_window_start:1100,damage_window_end:1400,energy_delta:15},{id:281,name:'Hidden Power Water',type:'Water',power:15,duration:1500,damage_window_start:1100,damage_window_end:1400,energy_delta:15}];
A.equal(guard(moves,moves,'pogo_fm.json'),0);changed=clone(moves);changed[0].power=16;A.equal(guard(moves,changed,'pogo_fm.json'),1);
for(const mutate of [x=>x[0].name='Other',x=>x[0].type='Water',x=>x[0].power=-1,x=>x[0].duration=0,x=>x[0].energy_delta=-15,x=>x[0].energy_delta=101,x=>x[0].damage_window_end=Infinity,x=>x.push({...x[0]})]){
 changed=clone(moves);mutate(changed);A.throws(()=>guard(moves,changed,'pogo_fm.json'));
}
console.log('PASS refresh accepts numeric balance changes and typed Hidden Power; rejects new/duplicate/missing records, release/type/pool changes and invalid values');

const cosmetics=[pokemon[0],{...clone(pokemon[0]),form:'Cosmetic'}];
changed=clone(cosmetics);changed[0].stats.baseAttack=120;A.throws(()=>guard(cosmetics,changed,'pogo_pkm.min.json'),/profiles diverged/);
changed[1].stats.baseAttack=120;A.equal(guard(cosmetics,changed,'pogo_pkm.min.json'),2);
console.log('PASS cosmetic profile equivalence remains valid across balance updates');
