'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),S=require('../rankings/session.cjs'),R=require('../rankings/core.cjs');
module.exports=async browser=>{
 const snapshot=JSON.parse(fs.readFileSync('data/attacker-rankings.json')),session=S.create(snapshot);
 const p=await browser.newPage({viewport:{width:390,height:844},hasTouch:true}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 await p.goto('file://'+path.resolve('index.html'),{waitUntil:'domcontentloaded'});
 await p.locator('#tts-start').waitFor();
 const ordinary=await p.locator('#grid .card').count(),search=p.locator('#search');
 for(const type of ['overall',...R.TYPES])for(const count of [1,10,30]){
  const query=count+'best'+(type==='overall'?'':type),expected=session.search(query);
  await search.fill(query);
  const actual=await p.locator('#grid .card').evaluateAll(cards=>cards.map(c=>({key:c.dataset.occurrenceKey,name:c.getAttribute('aria-label'),sprite:c.querySelector('img').getAttribute('data-sprite-url'),shadow:!!c.querySelector('.ranked-shadow')})));
  A.deepEqual(actual,expected.map(r=>({key:r.occurrenceKey,name:r.name,sprite:r.sprite,shadow:r.shadow})),query);
 }
 await search.fill('10bestfire,10bestwater');
 A.deepEqual(await p.locator('#grid .card').evaluateAll(cs=>cs.map(c=>c.dataset.occurrenceKey)),session.search('10bestfire,10bestwater').map(r=>r.occurrenceKey));
 const first=p.locator('#grid .card').first();const key=await first.getAttribute('data-selection-key');
 await first.click();A.equal(await first.getAttribute('aria-pressed'),'true');A((await p.locator('#output').inputValue()).length>0);
 A(await p.locator('#grid .card').evaluateAll((cs,k)=>cs.filter(c=>c.dataset.selectionKey===k).every(c=>c.classList.contains('selected')),key));
 await first.click();await search.fill('');A.equal(await p.locator('#grid .card').count(),ordinary);A.equal(await p.locator('.ranked-shadow').count(),0);
 await search.fill('30bestfire');
 // Real displayed assets must decode; request all cards, including those below the fold.
 for(const img of await p.locator('#grid .card img').all()){await img.scrollIntoViewIfNeeded();await p.waitForFunction(im=>im.complete&&im.naturalWidth>0,await img.elementHandle(),{timeout:25000});await img.evaluate(im=>im.decode());}
 for(const [width,height] of [[320,568],[390,844],[844,390],[1440,900]]){
  await p.setViewportSize({width,height});
  A(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Unexpected horizontal page overflow');
  await p.screenshot({path:`test-results/ranking-real-${width}x${height}.png`});
 }
 await p.setViewportSize({width:390,height:844});await search.fill('');
 await p.locator('#tts-start').click();await p.getByRole('button',{name:'Top Attackers',exact:true}).click();
 await p.getByRole('button',{name:'Moveset',exact:true}).click();
 A.equal(await p.getByRole('button',{name:'Elite',exact:true}).getAttribute('aria-pressed'),'true');
 await p.getByRole('button',{name:'Count',exact:true}).click();for(let value=11;value<=30;value++){await p.getByRole('slider').press('ArrowRight');A.equal(await p.getByRole('slider').getAttribute('aria-valuenow'),String(value));}
 A.equal(await p.getByRole('slider').getAttribute('aria-valuenow'),'30');
 await p.getByRole('button',{name:'Back from Count',exact:true}).click();await p.getByRole('button',{name:'Types',exact:true}).click();
 await p.getByRole('button',{name:'Normal',exact:true}).click();await p.getByRole('button',{name:'Open filter actions',exact:true}).click();
 await p.getByRole('button',{name:'Exclude',exact:true}).click();await p.getByRole('button',{name:'Create Filter',exact:true}).click();
 const expectedLong=session.compile({},[{scope:[],portions:[{values:{attackers:{count:30,types:['normal'],moveset:true,elite:true}},exclude:true}]}],{ordinaryPortion:()=>({empty:true,valid:false})}).text;
 A.equal(await p.locator('#output').inputValue(),expectedLong,'Real UI must preserve the complete exclusion expression');
 const observed=require('./long-search-observed.json');
 A.equal(await p.evaluate(text=>TTSRankings.stringify({op:'and',args:text.split('&').map(c=>({op:'or',args:c.split(',').map(value=>({op:'atom',value}))}))}),observed.text),observed.text,'Browser compiler must accept the observed long query without truncation');
 await p.screenshot({path:'test-results/ranking-real-long-search.png'});
 A.deepEqual(errors,[]);await p.close();
 console.log('PASS real saved rankings: all 19 groups at counts 1/10/30, mixed-type ordering, form names/sprites, selection, restoration, actual image decoding and four viewport sizes');
};
