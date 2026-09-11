import {test} from 'node:test';
import assert from 'node:assert/strict';
import {minutes,clock,validateEntry,overlaps,layoutEntries,defaultHabits,habitCount,weekDates} from '../personal-model.js';
const entry=(id,start,end,day=0)=>({id,title:id,day,start,end,color:'#bc8158',note:'',place:''});
test('minute precision and invalid intervals',()=>{
 assert.equal(minutes('09:30'),570);assert.equal(clock(661),'11:01');
 assert.equal(validateEntry(entry('exercise',570,660)),'');
 assert.match(validateEntry(entry('same',570,570)),/종료/);
 assert.match(validateEntry(entry('reverse',570,540)),/종료/);
 assert.match(validateEntry(entry('invalid',NaN,660)),/올바른/);
 assert.ok(Number.isNaN(minutes('25:00')));
});
test('overlap detection excludes same entry, other days and adjacent boundaries',()=>{
 const a=entry('a',570,660);
 assert.equal(overlaps(a,entry('b',660,720)),false);
 assert.equal(overlaps(a,entry('b',600,720,1)),false);
 assert.equal(overlaps(a,{...a}),false);
 assert.equal(overlaps(a,entry('b',600,720)),true);
});
test('connected overlapping blocks use separate lanes without intersections',()=>{
 const input=[entry('a',540,600),entry('b',570,630),entry('c',610,670),entry('d',700,760),entry('e',580,620)];
 const result=layoutEntries(input);
 assert.equal(result.find(e=>e.id==='d').columns,1);
 for(const a of result)for(const b of result)if(overlaps(a,b))assert.notEqual(a.column,b.column);
 assert.equal(result.find(e=>e.id==='a').columns,3);
 assert.equal(result.find(e=>e.id==='a').end-result.find(e=>e.id==='a').start,60);
});
test('legacy habit IDs and daily records survive renamed goals and cross-month weeks',()=>{
 const dates=weekDates(new Date(2026,8,1));assert.equal(dates[0],'2026-08-31');
 const habit={...defaultHabits()[0],title:'새 독서 목표',target:5};
 assert.equal(habitCount({'reading:2026-08-31':true,'reading:2026-09-01':true,'reading:2026-08-25':true},habit.id,dates),2);
});
