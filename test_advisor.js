'use strict';
const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const source=fs.readFileSync('app.js','utf8');
const start=source.indexOf('const ProjectAdvisor=');
const end=source.indexOf('\n}};',start)+4;
assert.ok(start>=0&&end>start,'ProjectAdvisor implementation must exist in app.js');
const sandbox={};
vm.runInNewContext(source.slice(start,end)+'\nthis.ProjectAdvisor=ProjectAdvisor;',sandbox);
const {ProjectAdvisor}=sandbox;

const liquidity=ProjectAdvisor.guide({company:'Example Co',events:[{classification:'LIQUIDITY',date:'2026-10-20'}]});
assert.equal(liquidity.basis,'LIQUIDITY');
assert.match(liquidity.opener,/Example Co/);
assert.match(liquidity.opener,/2026-10-20/);
assert.match(liquidity.opener,/do not want to assume/i);
assert.equal(liquidity.questions.length,3);
assert.match(liquidity.guardrail,/Do not claim net proceeds/);

const proposed=ProjectAdvisor.guide({company:'Example Co',events:[{source_class:'FORM144',filed_date:'2026-10-21'}]});
assert.equal(proposed.basis,'PROPOSED_SALE');
assert.match(proposed.questions[0],/occurred, changed or expired/);

const unknown=ProjectAdvisor.guide({company:'Example Co',events:[]});
assert.equal(unknown.basis,'DEFAULT');
assert.ok(unknown.questions.every(question=>!question.includes('$')));
console.log('advisor conversation guidance checks passed');
