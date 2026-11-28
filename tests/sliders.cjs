const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const source=html;const range=s=>s.slice(s.indexOf('function rangeControl('),s.indexOf('function excludeReason('));
class E{
 constructor(tag,cls='',text=''){this.tagName=tag.toUpperCase();this.className=cls;this.textContent=text;this.children=[];this.dataset={};this.attrs={};this.isConnected=true;this.style={setProperty(k,v){this[k]=v}};this.classList={toggle:(c,on)=>{let a=this.className.split(' ').filter(Boolean).filter(x=>x!==c);if(on)a.push(c);this.className=a.join(' ')}};this.clientWidth=width;this.offsetWidth=width;this.clientHeight=66.5;}
 append(...es){es.forEach(e=>{e.parent=this;this.children.push(e)})}setAttribute(k,v){this.attrs[k]=String(v)}setPointerCapture(){}remove(){this.parent.children=this.parent.children.filter(e=>e!==this)}
 querySelectorAll(sel){let out=[];for(const e of this.children){if(sel.split(',').some(s=>s.startsWith('.')?e.className.split(' ').includes(s.slice(1)):s.startsWith('[data-bubble=')?String(e.dataset.bubble)===s.match(/"(\d+)"/)[1]:e.tagName===s.toUpperCase()))out.push(e);out.push(...e.querySelectorAll(sel))}return out}querySelector(s){return this.querySelectorAll(s)[0]||null}
 getBoundingClientRect(){if(this.className==='tts-track')return {left:30,top:20.25,width:width-66,height:26};return {left:0,top:0,width:width,height:66.5}}get offsetWidth(){return this.className==='tts-track'?width-66:this._width}set offsetWidth(v){this._width=v}
}
let width=180,values={},box,paints=0;const ctx={document:{createElement:t=>t==='canvas'?{getContext:()=>({measureText:s=>({width:String(s).length*6})})}:new E(t),activeElement:null},el:(...a)=>new E(...a),val:()=>values,markFamily:()=>{},refresh:()=>{},notify:()=>{},updateFooter:()=>{},renderActive:()=>{},renderConfirm:()=>{},requestAnimationFrame:f=>f(),ResizeObserver:class{observe(){}disconnect(){}},TTSSliderPaint:{setup(){},render(){paints++}},TTSIcons:{routes:{groups:{}},route:(_,k)=>k,row:()=>({}),fill:()=>'',companionFill:()=>''}};
vm.createContext(ctx);vm.runInContext(html.slice(html.indexOf('const FAMILIES='),html.indexOf('const TTSSliderAppearance='))+range(source)+';this.build=rangeControl;this.specs=NUMERIC;',ctx);
let checks=0;
for(const k of Object.keys(ctx.specs))for(width of [110,160,240]){
 const spec=ctx.specs[k],min=spec.steps?.[0]??spec.min,max=spec.steps?.at(-1)??spec.max;
 const build=a=>{values=a===null?{}:{[k]:{values:a}};box=ctx.build(k,k==='candykm'?'buddy':k);return box};
 build(null);assert.equal(box.querySelector('.tts-bubble').textContent,'-');assert(!values[k]);
 let b=box.querySelector('.tts-knob');b.onkeydown({key:'Enter',preventDefault(){}});assert.equal(values[k].values.length,1);
 build([min,max]);let bubbles=box.querySelectorAll('.tts-bubble');let ends=bubbles.map(e=>[parseFloat(e.style.left)-parseFloat(e.style['--bubble-width'])/2,parseFloat(e.style.left)+parseFloat(e.style['--bubble-width'])/2]);assert(ends[0][0]>=2.499&&ends[1][1]<=width-2.499&&ends[0][1]+3.99<=ends[1][0]);
 b=box.querySelector('.tts-knob');b.onpointerdown({clientX:30,stopPropagation(){},preventDefault(){},pointerId:1});b.onpointermove({clientX:10000});b.onpointerup();assert(values[k].values[0]<values[k].values[1]);
 build([min,max]);b=box.querySelectorAll('.tts-knob')[1];b.onpointerdown({clientX:width-36,stopPropagation(){},preventDefault(){},pointerId:1});b.onpointermove({clientX:-10000});b.onpointerup();assert(values[k].values[0]<values[k].values[1]);
 if(!['year','candykm'].includes(k)){build([min,max]);const e=box.querySelectorAll('.tts-bubble')[0];e.value=String(max+1000);e.onchange();assert(values[k].values[0]<values[k].values[1]);build([min]);const e2=box.querySelector('.tts-bubble');e2.value='not a number';e2.onchange();assert.equal(values[k].values[0],min);}
 build([min,max]);box.querySelector('.tts-knob').onkeydown({key:'Delete',preventDefault(){}});assert.equal(values[k].values.length,1);
 build([max]);box.querySelector('.tts-knob').onkeydown({key:'Enter',preventDefault(){}});assert(!values[k]);checks++;
}
// Adjacent valid values preserve ordering and separate their value bubbles.
width=160;values={cp:{values:[9999,10000]}};box=ctx.build('cp','cp');const bs=box.querySelectorAll('.tts-bubble');assert(parseFloat(bs[1].style.left)-parseFloat(bs[0].style.left)>=34);
console.log('PASS 24 production slider handler scenarios and bubble collision checks');

// Top Attackers reuses the approved single-value adapter; End is intentionally
// not a supported command. Verify every supported increment and the boundaries.
vm.runInContext(html.slice(html.indexOf("FAMILIES.attackers="),html.indexOf(" TTSIcons.routes.groups.attackercount=")),ctx);
let attackerValue=10;
const buildAttacker=()=>ctx.build('attackercount','attackers',{get:()=>[attackerValue],set:a=>{attackerValue=a[0]??10},single:true,initial:10});
box=buildAttacker();
box.querySelector('.tts-knob').onkeydown({key:'End',preventDefault(){}});assert.equal(attackerValue,10);
for(let expected=11;expected<=30;expected++){box.querySelector('.tts-knob').onkeydown({key:'ArrowRight',preventDefault(){}});assert.equal(attackerValue,expected);box=buildAttacker();}
box.querySelector('.tts-knob').onkeydown({key:'ArrowRight',preventDefault(){}});assert.equal(attackerValue,30);
for(let expected=29;expected>=1;expected--){box.querySelector('.tts-knob').onkeydown({key:'ArrowLeft',preventDefault(){}});assert.equal(attackerValue,expected);box=buildAttacker();}
box.querySelector('.tts-knob').onkeydown({key:'ArrowLeft',preventDefault(){}});assert.equal(attackerValue,1);
box.querySelector('.tts-knob').onkeydown({key:'Delete',preventDefault(){}});assert.equal(attackerValue,10);
console.log('PASS Top Attackers Count single-value adapter: supported arrow steps 1–30, endpoint clamping and reset to10');
