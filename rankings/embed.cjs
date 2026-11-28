'use strict';
// The page receives saved data only. No visitor request to a ranking provider.
const fs=require('node:fs'),crypto=require('node:crypto'),S=require('./session.cjs');
const START='// TTS V78 saved rankings start\n',END='// TTS V78 saved rankings end\n',ANCHOR='// TTS V78 ranking modules start\n';
function block(snapshot){
 S.validateSnapshot(snapshot);
 const json=JSON.stringify(snapshot).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
 return START+'window.TTSRankingSnapshot='+json+';\n'+END;
}
function strip(html){
 const starts=html.split(START).length-1,ends=html.split(END).length-1;
 if(!starts&&!ends)return html;
 if(starts!==1||ends!==1)throw Error('Duplicate or incomplete saved ranking block');
 const begin=html.indexOf(START),end=html.indexOf(END,begin);
 if(end<begin)throw Error('Invalid saved ranking block order');
 const body=html.slice(begin+START.length,end),prefix='window.TTSRankingSnapshot=';
 if(!body.startsWith(prefix)||!body.endsWith(';\n'))throw Error('Unexpected saved ranking script');
 const snapshot=JSON.parse(body.slice(prefix.length,-2));
 if(block(snapshot)!==html.slice(begin,end+END.length))throw Error('Noncanonical ranking block');
 return html.slice(0,begin)+html.slice(end+END.length);
}
function embed(html,snapshot){
 const base=strip(html);
 if(base.split(ANCHOR).length!==2)throw Error('Application ranking anchor missing or duplicated');
 return base.replace(ANCHOR,block(snapshot)+ANCHOR);
}
function write(htmlPath,snapshotPath){
 const html=fs.readFileSync(htmlPath,'utf8'),snapshot=JSON.parse(fs.readFileSync(snapshotPath,'utf8'));
 const output=embed(html,snapshot),tmp=htmlPath+'.'+crypto.randomUUID()+'.tmp';
 try{fs.writeFileSync(tmp,output,{flag:'wx'});fs.renameSync(tmp,htmlPath);}finally{fs.rmSync(tmp,{force:true});}
}
if(require.main===module){const [html,snapshot]=process.argv.slice(2);if(!html||!snapshot)throw Error('Usage: node rankings/embed.cjs index.html reviewed-snapshot.json');write(html,snapshot);}
module.exports={embed,strip,write,block};
