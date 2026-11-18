const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert/strict');
(async()=>{
 const b=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}: {})});fs.mkdirSync('test-results',{recursive:true});
 const baseline=fs.existsSync('baselines/v71.html')?fs.readFileSync('baselines/v71.html','utf8'):cp.execFileSync('git',['show','5c173a0bf25d04256a95edd50957a5114346a2ba:index.html'],{maxBuffer:20e6}).toString();
 const broken=fs.existsSync('baselines/v72.html')?fs.readFileSync('baselines/v72.html','utf8'):cp.execFileSync('git',['show','85a3d2a1b504b25d5a895fa9e7e8f8c45796c182:index.html'],{maxBuffer:20e6}).toString();
 fs.writeFileSync('test-results/v71.html',baseline);fs.writeFileSync('test-results/v72.html',broken);
 async function load(file,width=390,seeded=false){const page=await b.newPage({viewport:{width,height:844},hasTouch:true});await page.addInitScript(()=>{const observer=new MutationObserver(()=>{if(document.body){window.__ttsArtAtBody=document.documentElement.style.getPropertyValue('--tts-bg-art');observer.disconnect();}});observer.observe(document,{childList:true,subtree:true});});if(seeded)await page.addInitScript(()=>{let seed=0x74;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});let errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('file://'+path.resolve(file),{waitUntil:'domcontentloaded'});return {page,errors};}
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

 // Compare identical populations with and without only the approved background blocks.
 // V71 remains the independent preservation and functional regression baseline.
 const backgroundBlocks=[/<!-- TTS V76 early background start -->[\s\S]*?<!-- TTS V76 early background end -->\n/g,/<!-- TTS V74 approved background start -->[\s\S]*?<!-- TTS V74 approved background end -->\n/g,/<!-- TTS V74 background geometry start -->[\s\S]*?<!-- TTS V74 background geometry end -->\n/g];
 const current=fs.readFileSync('index.html','utf8');
 for(const [file,tag] of [['index.html','current'],['tests/future.html','future']]){
  const source=fs.readFileSync(file,'utf8');let control=source;
  for(const pattern of backgroundBlocks){const approved=current.match(pattern),actual=source.match(pattern);assert.equal(approved?.length,1);assert.deepEqual(actual,approved,'Updater must preserve exact background blocks');control=control.replace(pattern,'');}
  const refFile=`test-results/background-control-${tag}.html`;fs.writeFileSync(refFile,control);
  for(const [width,height] of [[390,844],[844,390],[1440,900],[320,568]]){
   const {page:p,errors}=await load(file,width,true);await p.setViewportSize({width,height});
   const {page:ref,errors:refErrors}=await load(refFile,width,true);await ref.setViewportSize({width,height});
   const expected=JSON.parse(source.match(/const POKEMON=(\[.*?\]);/s)[1]).length;
   assert.equal(await p.locator('#grid .card').count(),expected);assert.equal(await ref.locator('#grid .card').count(),expected);
   let initialArt;
   assert.equal(await p.evaluate(()=>window.__ttsArtAtBody),await p.evaluate(()=>document.documentElement.style.getPropertyValue('--tts-bg-art')),'Random artwork must be ready at body insertion');
   assert(await p.evaluate(()=>!!window.__ttsArtAtBody));
   for(const expanded of [false,true]){
    if(expanded){await p.locator('#tts-start').click();await ref.locator('#tts-start').click();}
    await Promise.all([p.evaluate(()=>document.fonts.ready.then(()=>true)),ref.evaluate(()=>document.fonts.ready.then(()=>true))]);
    await p.waitForTimeout(150);await ref.waitForTimeout(150);
    const state=page=>page.evaluate(()=>{
     const style=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {color:s.backgroundColor,image:s.backgroundImage,w:r.width,h:r.height}};
     return {body:style(document.body),main:style(document.querySelector('main')),card:style(document.querySelector('.card')),search:style(document.querySelector('#search')),header:style(document.querySelector('header')),footer:style(document.querySelector('footer')),footerHeight:parseFloat(document.documentElement.style.getPropertyValue('--tts-bg-footer'))};
    });
    const [a,c]=await Promise.all([state(p),state(ref)]);
    for(const key of ['body','main','card','search'])assert.deepEqual(a[key],c[key],key+' must retain its solid surface and geometry');
    for(const key of ['header','footer']){assert(a[key].image.startsWith('url("data:image/svg+xml;base64,'));assert.equal(c[key].image,'none');assert.equal(a[key].w,c[key].w);assert.equal(a[key].h,c[key].h);assert.equal(a[key].color,c[key].color);}
    assert.equal(a.header.image,a.footer.image,'Chrome must share one randomized background');
    if(initialArt)assert.equal(a.header.image,initialArt,'Artwork must not rerandomize when filters open');else initialArt=a.header.image;
    const svg=Buffer.from(a.header.image.match(/base64,([A-Za-z0-9+/=]+)/)[1],'base64').toString('latin1');
    const originalSvg=Buffer.from(current.match(/--tts-bg-art:url\("data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)/)[1],'base64').toString('latin1');
    const [,vw,vh]=originalSvg.match(/viewBox="0 0 ([0-9.]+) ([0-9.]+)"/);
    const transforms=[...svg.matchAll(/<g transform="translate\(([0-9.]+) ([0-9.]+)\) scale\((-?1) (-?1)\)">/g)];
    assert(transforms.length>0);for(const t of transforms){assert.equal(t[0],transforms[0][0]);assert.equal(+t[1],t[3]==='-1'?+vw:0);assert.equal(+t[2],t[4]==='-1'?+vh:0);}
    const paths=v=>[...v.matchAll(/<path\b[^>]*>/g)].map(m=>m[0]);
    const colorTokens=v=>paths(v).flatMap(t=>[...t.matchAll(/(?:fill|stroke)="(#[0-9A-Fa-f]{6})"/g)].map(m=>m[1].toUpperCase()));
    const before=colorTokens(originalSvg),after=colorTokens(svg),mapping=new Map();
    assert.equal(after.length,before.length);before.forEach((c,i)=>{if(mapping.has(c))assert.equal(mapping.get(c),after[i]);else mapping.set(c,after[i]);});
    assert.deepEqual([...new Set(after)].sort(),[...new Set(before)].sort());
    assert.deepEqual(paths(svg).map(t=>t.replace(/(fill|stroke)="#[0-9A-Fa-f]{6}"/g,'$1="COLOR"')),paths(originalSvg).map(t=>t.replace(/(fill|stroke)="#[0-9A-Fa-f]{6}"/g,'$1="COLOR"')));
    assert(Math.abs(a.footerHeight-a.footer.h)<=1);
    assert.equal(await p.locator('#background-review-controls').count(),0);
   }
   await p.screenshot({path:`test-results/background-${tag}-${width}x${height}.png`});
   assert.deepEqual(errors,[]);assert.deepEqual(refErrors,[]);await p.close();await ref.close();
  }
 }
 console.log('PASS current and simulated future background-only surfaces, preserved geometry, expanded/collapsed headers, four viewport sizes');
 await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
