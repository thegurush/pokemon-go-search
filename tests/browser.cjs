const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert/strict');
(async()=>{
 const b=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}: {})});fs.mkdirSync('test-results',{recursive:true});
 const baseline=fs.existsSync('baselines/v71.html')?fs.readFileSync('baselines/v71.html','utf8'):cp.execFileSync('git',['show','5c173a0bf25d04256a95edd50957a5114346a2ba:index.html'],{maxBuffer:20e6}).toString();
 const broken=fs.existsSync('baselines/v72.html')?fs.readFileSync('baselines/v72.html','utf8'):cp.execFileSync('git',['show','85a3d2a1b504b25d5a895fa9e7e8f8c45796c182:index.html'],{maxBuffer:20e6}).toString();
 fs.writeFileSync('test-results/v71.html',baseline);fs.writeFileSync('test-results/v72.html',broken);
 async function load(file,width=390){const page=await b.newPage({viewport:{width,height:844},hasTouch:true});let errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('file://'+path.resolve(file),{waitUntil:'domcontentloaded'});return {page,errors};}
 let x=await load('test-results/v72.html');assert(x.errors.some(e=>e.includes('expected 956')));assert.equal(await x.page.locator('#grid .card').count(),0);console.log('PASS V72 failure reproduced in Chromium:',x.errors);await x.page.close();
 for(const file of ['test-results/v71.html','index.html','tests/future.html']){
  x=await load(file);const p=x.page;await p.locator('#tts-start').waitFor();const expected=JSON.parse(fs.readFileSync(file,'utf8').match(/const POKEMON=(\[.*?\]);/s)[1]).length;
  assert.equal(await p.locator('#grid .card').count(),expected);assert(await p.locator('#grid .card').first().isVisible());assert.equal(await p.locator('#tts-start').getAttribute('aria-expanded'),'false');
  await p.locator('#tts-start').click();await p.getByRole('button',{name:'CP',exact:true}).click();
  const knob=p.getByRole('slider').first();assert.equal(await knob.getAttribute('aria-valuetext'),'Unset; tap or drag to set');
  const layers=await knob.evaluate(e=>({knob:+getComputedStyle(e).zIndex,rim:+getComputedStyle(e.closest('.tts-range'),'::after').zIndex}));assert(layers.knob>layers.rim);
  await knob.press('ArrowRight');assert.equal(await p.getByRole('slider').first().getAttribute('aria-valuenow'),'5001');
  await p.getByRole('slider').first().press('Delete');assert.equal(await p.getByRole('slider').first().getAttribute('aria-valuetext'),'Unset; tap or drag to set');
  await p.getByRole('slider').first().tap();assert.equal(await p.getByRole('slider').first().getAttribute('aria-valuenow'),'5000');
  await p.getByRole('button',{name:'Open filter actions',exact:true}).click();await p.getByRole('button',{name:'Create Filter',exact:true}).click();assert((await p.locator('#output').inputValue()).includes('cp5000'));
  await p.locator('#tts-active button[data-filter-id]').first().click();await p.getByRole('button',{name:'EDIT',exact:true}).click();await p.getByRole('button',{name:'Open filter actions',exact:true}).click();await p.getByRole('button',{name:'Select Pokémon',exact:true}).click();
  await p.locator('#search').fill('Bulbasaur');await p.locator('[data-pokemon-id="1"]').click();
  await p.getByRole('switch',{name:'SELECTED',exact:true}).click();await p.getByRole('button',{name:'NONE',exact:true}).click();await p.waitForFunction(()=>!TTS.state.filterMode.selected);assert.equal(await p.locator('#grid .card').count(),1);
  await p.locator('[data-pokemon-id="1"]').click();await p.getByRole('button',{name:'Commit Pokémon selection',exact:true}).click();
  if(await p.getByRole('button',{name:'Open filter actions',exact:true}).count())await p.getByRole('button',{name:'Open filter actions',exact:true}).click();
  await p.getByRole('button',{name:'Exclude',exact:true}).click();await p.getByRole('button',{name:'Create Filter',exact:true}).click();
  assert((await p.locator('#output').inputValue()).includes('!cp5000'));assert((await p.locator('#output').inputValue()).includes('bulbasaur'));
  await p.evaluate(()=>{TTS.state.popup=null;TTS.refresh();});await p.locator('#search').fill('');
  await p.locator('[data-pokemon-id="4"]').click();assert((await p.locator('#output').inputValue()).includes('charmander'));
  if(file!=='test-results/v71.html')for(const id of [774,946,947]){await p.locator('#search').fill(String(id));const card=p.locator(`[data-pokemon-id="${id}"]`);assert.equal(await card.count(),1);await card.locator('img').evaluate(img=>{if(img.complete&&img.naturalWidth)return;return new Promise((resolve,reject)=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',()=>reject(Error('sprite failed')),{once:true});setTimeout(()=>reject(Error('sprite timeout')),20000);});});}
  await p.locator('#search').fill('');assert.deepEqual(x.errors,[]);await p.screenshot({path:'test-results/'+path.basename(file)+'.png'});console.log('PASS browser deck, controls, CP keyboard/touch, editing, scope, exclusion, selection, sprites:',file,expected);await p.close();
 }

 for(const [width,height] of [[390,844],[844,390],[1440,900],[320,568]]){
  const {page:p,errors}=await load('index.html',width);await p.setViewportSize({width,height});
  const ref=(await load('test-results/v71.html',width)).page;await ref.setViewportSize({width,height});
  for(const expanded of [false,true]){
   if(expanded){await p.locator('#tts-start').click();await ref.locator('#tts-start').click();}
   await p.waitForTimeout(150);await ref.waitForTimeout(150);
   const state=page=>page.evaluate(()=>{
    const style=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {color:s.backgroundColor,image:s.backgroundImage,w:r.width,h:r.height}};
    return {body:style(document.body),main:style(document.querySelector('main')),card:style(document.querySelector('.card')),search:style(document.querySelector('#search')),header:style(document.querySelector('header')),footer:style(document.querySelector('footer')),footerHeight:parseFloat(document.documentElement.style.getPropertyValue('--tts-bg-footer'))};
   });
   const [a,c]=await Promise.all([state(p),state(ref)]);
   for(const key of ['body','main','card','search'])assert.deepEqual(a[key],c[key],key+' must retain its solid surface and geometry');
   for(const key of ['header','footer']){assert(a[key].image.startsWith('url("data:image/svg+xml;base64,'));assert.equal(a[key].w,c[key].w);assert.equal(a[key].h,c[key].h);assert.equal(a[key].color,c[key].color);}
   assert(Math.abs(a.footerHeight-a.footer.h)<=1);
   assert.equal(await p.locator('#background-review-controls').count(),0);
  }
  await p.screenshot({path:`test-results/background-${width}x${height}.png`});
  assert.deepEqual(errors,[]);await p.close();await ref.close();
 }
 console.log('PASS background-only surfaces, preserved geometry, expanded/collapsed headers, four viewport sizes');
 await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
