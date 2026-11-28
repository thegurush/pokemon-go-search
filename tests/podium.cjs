'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const html=fs.readFileSync('index.html','utf8'),register=JSON.parse(fs.readFileSync('assets/podium/register.json','utf8'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.equal(hash(fs.readFileSync('assets/podium/Podium_Shared_Master_Cream.png')),register.source_sha256);
assert.equal(hash(fs.readFileSync('assets/podium/Podium_Shared_Master_Cream_Tight.png')),register.mask_sha256);
const block=html.match(/\/\/ TTS V78 approved podium start[\s\S]*?\/\/ TTS V78 approved podium end\n\n/)[0];
const css=html.match(/<!-- TTS V78 podium sizing start -->[\s\S]*?<!-- TTS V78 podium sizing end -->\n/)[0];
const expected=JSON.parse(fs.readFileSync('assets/podium/integration-hashes.json','utf8'));
assert.equal(hash(block),expected.registration);assert.equal(hash(css),expected.sizing);
class Element{constructor(tag,ns){this.tag=tag;this.namespaceURI=ns;this.children=[];this.style={};this.dataset={};this.attrs={};this.className='';this.classList={add:s=>{this.className+=' '+s;}};}append(...x){this.children.push(...x);}setAttribute(k,v){this.attrs[k]=v;}}
const context={document:{createElement:t=>new Element(t),createElementNS:(ns,t)=>new Element(t,ns)}};vm.createContext(context);
const original=JSON.parse(html.match(/const TTSApprovedIconData=(.*?);\n/)[1]);context.input=JSON.parse(JSON.stringify(original));
vm.runInContext('const TTSApprovedIconData=input;'+block+html.slice(html.indexOf('const TTSIcons='),html.indexOf('const TYPES=',html.indexOf('const TTSIcons=')))+';globalThis.icons=TTSIcons;',context);
const data=context.input,icons=context.icons;
for(const k of ['assets','placements'])for(const [id,value] of Object.entries(original[k]))assert.deepEqual(data[k][id],value,'Existing '+k+' altered');
for(const [table,rows] of Object.entries(original.routes))for(const [key,value] of Object.entries(rows))assert.equal(data.routes[table][key],value);
assert.equal(data.palette.cream,'#F6E4C5');assert.equal(data.placements[264].colors[0],'#48A38C');assert.equal(data.placements[266].colors[0],'#927D9E');
assert.deepEqual(JSON.parse(JSON.stringify(register.placements)),[264,265,266,267].map(id=>JSON.parse(JSON.stringify(data.placements[id]))));
assert.equal(hash(Buffer.from(data.assets['POD-01'].split(',')[1],'base64')),register.mask_sha256);
for(const id of [264,266])for(const state of ['normal','selected','parent','disabled']){
 const c=icons.create(id,state),face=c.children[0],art=face.children[1];assert.equal(art.dataset.master,'POD-01');assert.equal(art.style.backgroundColor,'#F6E4C5');assert.equal(face.style.background,id===264?'#48A38C':'#927D9E');assert.equal(face.children[0].style.background,id===264?'#33433E':'#3D3B42');
 assert.equal(face.style.filter,state==='normal'?undefined:'brightness(.65)');
 const checks=c.children.filter(e=>e.dataset.master==='M097');assert.equal(checks.length,state==='selected'?1:0);assert.equal(c.children.filter(e=>e.tag==='svg').length,['selected','parent'].includes(state)?1:0);
}
for(const id of [265,267]){const c=icons.create(id);assert.equal(c.children[0].children[1].dataset.master,'POD-01');assert.equal(c.children.at(-1).dataset.master,'M002');}
for(const diameter of [56.5,39,27.25,17]){
 const width=(diameter-5)*register.normalization.square_fit_ratio;
 const scaledRadius=register.normalization.alpha_radius_px*width/952;
 assert(Math.abs(diameter/2-scaledRadius-2.5)<1e-8);
}
console.log('PASS shared approved podium bytes, palette, register, existing assets/routes, circle inset and inherited icon states');
