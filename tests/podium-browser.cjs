'use strict';
const assert=require('assert/strict');
// Use the application's actual renderer/CSS. This fixture is removed before
// ordinary application regression checks and is never shipped in the page.
module.exports=async function verifyPodium(page){
 await page.evaluate(()=>{
  const tray=document.createElement('section');tray.id='podium-browser-review';
  tray.style.cssText='position:relative;z-index:1000;background:#293630;padding:16px;display:flex;flex-wrap:wrap;gap:18px;color:#F6E4C5';
  for(const size of [56.5,39,27.25,17])for(const id of [264,266])for(const state of ['normal','selected','parent','disabled']){
   const cell=document.createElement('div');cell.style.cssText='display:flex;flex-direction:column;align-items:center;gap:6px';
   const icon=TTSIcons.create(id,state);icon.style.width=size+'px';icon.style.height=size+'px';icon.style.flexShrink='0';
   icon.dataset.reviewSize=size;icon.dataset.reviewPlacement=id;icon.dataset.reviewState=state;
   cell.append(icon,document.createTextNode((id===264?'Top Attackers':'Overall')+' '+state+' '+size));tray.append(cell);
  }
  document.body.prepend(tray);
 });
 try{
  const observations=await page.locator('#podium-browser-review .icon07').evaluateAll(icons=>icons.map(icon=>{
   const face=icon.querySelector('.i07-face'),art=icon.querySelector('[data-master="POD-01"]'),r=icon.getBoundingClientRect(),a=art.getBoundingClientRect(),s=getComputedStyle(art);
   return {size:+icon.dataset.reviewSize,id:+icon.dataset.reviewPlacement,state:icon.dataset.reviewState,width:r.width,height:r.height,artWidth:a.width,centerX:a.x+a.width/2-r.x-r.width/2,centerY:a.y+a.height/2-r.y-r.height/2,mask:s.maskImage,cream:s.backgroundColor,face:getComputedStyle(face).backgroundColor,filter:getComputedStyle(face).filter,checks:icon.querySelectorAll('[data-master="M097"]').length};
  }));
  assert.equal(observations.length,32);
  for(const o of observations){
   assert(Math.abs(o.width-o.size)<.1&&Math.abs(o.height-o.size)<.1);
   assert(Math.abs(o.centerX)<.1&&Math.abs(o.centerY)<.1);
   assert(Math.abs(o.artWidth-(o.size-5)*0.8681673223310075)<.1);
   assert(o.mask.includes('data:image/png;base64,'));assert.equal(o.cream,'rgb(246, 228, 197)');
   assert.equal(o.face,o.id===264?'rgb(72, 163, 140)':'rgb(146, 125, 158)');
   assert.equal(o.filter,o.state==='normal'?'none':'brightness(0.65)');assert.equal(o.checks,o.state==='selected'?1:0);
  }
  await page.locator('#podium-browser-review').screenshot({path:'test-results/podium-renderer-states.png'});
 }finally{await page.locator('#podium-browser-review').evaluate(e=>e.remove());}
 console.log('PASS podium actual browser renderer, 32 size/state/color combinations');
};
