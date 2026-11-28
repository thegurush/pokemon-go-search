'use strict';
const A=require('assert/strict'),path=require('path'),fs=require('fs'),E=require('../rankings/embed.cjs');
module.exports=async function(browser){
 const p=await browser.newPage({viewport:{width:390,height:844},hasTouch:true}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 const fixturePath='test-results/ranking-fixture.html';
 fs.writeFileSync(fixturePath,E.embed(fs.readFileSync('index.html','utf8'),require('./ranking_fixture.cjs')()));
 await p.goto('file://'+path.resolve(fixturePath),{waitUntil:'domcontentloaded'});
 const search=p.locator('#search');await p.locator('#tts-start').waitFor();const ordinary=await p.locator('#grid .card').count();
 await search.fill('2bestfire,2bestwater');A.equal(await p.locator('#grid .card').count(),4);
 const same=p.locator('[data-selection-key="form:ordinary"]');A.equal(await same.count(),2);await same.first().click();
 A.equal(await same.locator('xpath=self::*[contains(@class,"selected")]').count(),2);A.equal(await p.locator('#output').inputValue(),'1&!shadow');
 const shadow=p.locator('[data-selection-key="form:shadow"]');A.equal(await shadow.locator('.ranked-shadow').count(),2);
 const source=await same.first().locator('img').getAttribute('data-sprite-url');A(source.endsWith('/1.png'));
 await same.first().click();await search.fill('');A.equal(await p.locator('#grid .card').count(),ordinary);A.equal(await p.locator('.ranked-shadow').count(),0);
 await p.locator('#tts-start').click();await p.getByRole('button',{name:'Top Attackers',exact:true}).click();
 A.equal(await p.getByRole('button',{name:'Elite',exact:true}).count(),0);
 await p.getByRole('button',{name:'Moveset',exact:true}).click();A.equal(await p.getByRole('button',{name:'Elite',exact:true}).getAttribute('aria-pressed'),'true');
 await p.getByRole('button',{name:'Elite',exact:true}).click();A.equal(await p.getByRole('button',{name:'Elite',exact:true}).getAttribute('aria-pressed'),'false');
 await p.getByRole('button',{name:'Moveset',exact:true}).click();await p.getByRole('button',{name:'Moveset',exact:true}).click();A.equal(await p.getByRole('button',{name:'Elite',exact:true}).getAttribute('aria-pressed'),'true');
 await p.getByRole('button',{name:'Moveset',exact:true}).click();await p.getByRole('button',{name:'Count',exact:true}).click();
 const slider=p.getByRole('slider');A.equal(await slider.count(),1);A.equal(await slider.getAttribute('aria-valuenow'),'10');await slider.press('ArrowRight');A.equal(await slider.getAttribute('aria-valuenow'),'11');await slider.press('Delete');A.equal(await slider.getAttribute('aria-valuenow'),'10');
 await p.getByRole('button',{name:'Back from Count',exact:true}).click();await p.getByRole('button',{name:'Overall',exact:true}).click();
 await p.getByRole('button',{name:'Types',exact:true}).click();await p.getByRole('button',{name:'Fire',exact:true}).click();await p.getByRole('button',{name:'Water',exact:true}).click();
 await p.getByRole('button',{name:'Back from Types',exact:true}).click();A.equal(await p.getByRole('button',{name:'Overall',exact:true}).getAttribute('aria-pressed'),'false');
 await p.getByRole('button',{name:'Overall',exact:true}).click();await p.getByRole('button',{name:'Types',exact:true}).click();A.equal(await p.getByRole('button',{name:'Fire',exact:true}).getAttribute('aria-pressed'),'false');
 const automatic=require('./automatic_mega_moves.cjs');
 const automaticResult=await p.evaluate(({form,pair})=>{
  const rows=TTSRankings.rank([form],[pair],{attackingType:'water',elite:false});
  return {count:rows.length,text:TTSRankings.stringify(TTSRankings.predicate(rows,[form],{moveset:true}).ast)};
 },automatic);
 A.equal(automaticResult.count,1);A(automaticResult.text.includes('@1water gun'));A(!/@[23]|megaevolve|liquidation/i.test(automaticResult.text));
 const edgeResult=await p.evaluate(()=>{
  const form={key:'edge',name:'Edge test',search:{accuracy:'exact',terms:['121']}};
  const pair={fast:{searchVerified:true,searchName:'hidden power',searchType:'dark',type:'dark'},charged:{searchVerified:true,searchName:'psychi',searchExclusions:['psychic fangs']}};
  return TTSRankings.stringify(TTSRankings.predicate([{form:'edge',movesets:[pair]}],[form],{moveset:true}).ast);
 });
 A(edgeResult.includes('@1hidden power'));A(edgeResult.includes('@1dark'));
 A(edgeResult.includes('!@2psychic fangs'));A(edgeResult.includes('!@3psychic fangs'));
 A(!edgeResult.includes('!@psychic fangs'));
 const typedResult=await p.evaluate(()=>{
  const form={key:'typed',name:'Typed move test',search:{accuracy:'exact',terms:['351']}};
  const pair={fast:{searchVerified:true,searchName:'tackle'},charged:{searchVerified:true,searchName:'weather ball',type:'fire',searchType:'fire'}};
  return TTSRankings.stringify(TTSRankings.predicate([{form:'typed',movesets:[pair]}],[form],{moveset:true}).ast);
 });
 A(typedResult.includes('@2weather ball'));A(typedResult.includes('@3weather ball'));A(typedResult.includes('@2fire'));A(typedResult.includes('@3fire'));A(!typedResult.includes('weather ball fire'));
 const plusResult=await p.evaluate(()=>{
  const form={key:'plus',name:'Plus test',search:{accuracy:'exact',terms:['250','shadow']}};
  const pair={fast:{searchVerified:true,searchName:'incinerate'},charged:{searchVerified:true,searchName:'sacred fire+',searchExclusions:['sacred fire++']}};
  return TTSRankings.stringify(TTSRankings.predicate([{form:'plus',movesets:[pair]}],[form],{moveset:true}).ast);
 });
 A(plusResult.includes('@2sacred fire+'));A(plusResult.includes('@3sacred fire+'));A(plusResult.includes('!@2sacred fire++'));A(plusResult.includes('!@3sacred fire++'));A(!plusResult.includes('!@sacred fire'));
 A.deepEqual(errors,[]);await p.screenshot({path:'test-results/ranking-filter-fixture.png'});await p.close();
 console.log('PASS browser ranking search/forms/selection/restoration and filter toggles/count, using synthetic fixture');
};
