'use strict';
// Quantify unresolved restricted moves without publishing or changing their eligibility.
const fs=require('fs'),assert=require('assert/strict'),R=require('./core.cjs');
const [scoresPath,auditPath,output]=process.argv.slice(2);
if(!output)throw Error('Usage: node audit_restriction_impact.cjs scores restriction-audit output');
const data=JSON.parse(fs.readFileSync(scoresPath)),audit=JSON.parse(fs.readFileSync(auditPath));
const held=new Set(audit.rows.filter(x=>x.status==='held').map(x=>x.form+'|'+x.move));
const removed=data.pairs.filter(p=>p.requiredState&&held.has(p.form+'|'+p.charged.name));
const eligible=data.pairs.filter(p=>!removed.includes(p));
const groups=[];
for(const elite of [true,false])for(const type of ['overall',...R.TYPES]){
 const options={attackingType:type,elite};
 const summarize=pairs=>R.rank(data.forms,pairs,options).slice(0,30).map(x=>({form:x.form,score:x.score}));
 const before=summarize(data.pairs),after=summarize(eligible);
 assert(after.every(x=>Number.isFinite(x.score)&&x.score>0));
 groups.push({type,elite,changed:JSON.stringify(before)!==JSON.stringify(after),before,after});
}
const report={status:'Sensitivity audit only; does not approve or change production data',heldFormMoves:[...held],removedPairs:removed.length,changedGroups:groups.filter(x=>x.changed).length,groups};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({removedPairs:report.removedPairs,changedGroups:report.changedGroups}));
