'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm'),E=require('../rankings/embed.cjs');
const snapshot=require('./ranking_fixture.cjs')(),html=fs.readFileSync('index.html','utf8');
const result=E.embed(html,snapshot);
A.equal(E.strip(result),E.strip(html),'Embedding must leave every application byte intact');
A.equal(E.embed(result,snapshot),result,'Repeated updates must not duplicate data');
A.throws(()=>E.embed(html+ '// TTS V78 ranking modules start\n',snapshot),/anchor/);
A.throws(()=>E.strip(result.replace('// TTS V78 saved rankings end','// damaged end')),/incomplete/);
const hostile=JSON.parse(JSON.stringify(snapshot));hostile.forms[0].name='</script><script>throw Error(1)</script>';
const block=E.block(hostile);A(!block.includes('</script>'));const ctx={window:{}};vm.runInNewContext(block,ctx);A.equal(ctx.window.TTSRankingSnapshot.forms[0].name,hostile.forms[0].name);
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'tts-embed-'));
try{
 const page=path.join(folder,'index.html'),data=path.join(folder,'snapshot.json');fs.writeFileSync(page,html);fs.writeFileSync(data,JSON.stringify(snapshot));E.write(page,data);A.equal(fs.readFileSync(page,'utf8'),result);
 fs.writeFileSync(data,'{"schema":999}');A.throws(()=>E.write(page,data));A.equal(fs.readFileSync(page,'utf8'),result,'Invalid data must preserve last page');
 A.equal(fs.readdirSync(folder).length,2);
}finally{fs.rmSync(folder,{recursive:true,force:true});}
console.log('PASS saved-data embedding, unchanged application bytes, idempotence, script escaping and failure preserves last working page');
