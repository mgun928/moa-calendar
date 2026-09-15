import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {test} from 'node:test';
import assert from 'node:assert/strict';

const source=readFileSync(new URL('../dashboard.js',import.meta.url),'utf8');
const segments=source.slice(source.indexOf('function weekSegments('),source.indexOf('function renderCalendarWeeks('));
const renderer=segments+source.slice(source.indexOf('function renderMobileMonth('),source.indexOf('function openDaySheet('));
function render(slots,events,cells=42,compact=false){
  const context={
    window:{moaMobileSlots:slots,moaCompactCalendar:compact},month:new Date(2026,7,1),selected:'2026-08-01',key:'2026-08-01',
    groupById:id=>({id}),groupColorStyle:()=> '--group-color:#b398bf;',
    dateKey:d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
    parseDate:k=>new Date(`${k}T12:00:00`),eventEnd:e=>e.endDate||e.date,eventRange:e=>`${e.date} ~ ${e.endDate||e.date}`,
    occursOn:(e,date)=>e.date<=date&&(e.endDate||e.date)>=date,
    escapeHTML:s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'),
    events,cells,
  };
  return runInNewContext(`${renderer}\nrenderMobileMonth(new Date(2026,6,26),cells,events)`,context);
}
const events=Array.from({length:8},(_,i)=>({id:String(i),title:`일정 ${i}`,date:'2026-08-01',time:'09:00',type:'personal'}));

test('compact month reserves room for overlapping personal and group spans',()=>{
 const html=render(1,[{...events[0],endDate:'2026-08-03'},{...events[1],endDate:'2026-08-02',type:'group',group:'gym'}],42,true);
 assert.equal((html.match(/data-span-event=/g)||[]).length,4);
 assert.match(html,/min-height:36px;grid-template-rows:minmax\(24px,24px\) repeat\(2,6px\)/);
 assert.doesNotMatch(html,/class="more-events/);
});

test('compact month renders every event even above normal mobile capacity',()=>{
 const html=render(2,[...events,{...events[0],id:'span',endDate:'2026-08-03'}],42,true);
 assert.equal((html.match(/class="event-chip/g)||[]).length,8);
 assert.equal((html.match(/class="span-event/g)||[]).length,2);
 assert.match(html,/min-height:78px;/);
 assert.doesNotMatch(html,/class="more-events/);
});
test('minimum mobile capacity shows two events before the overflow count',()=>{
  const html=render(2,events);
  assert.equal((html.match(/class="event-chip/g)||[]).length,2);
  assert.match(html,/\+6개/);
});
test('six-week month keeps all 42 dates and reports every hidden event',()=>{
  const html=render(2,events);
  assert.equal((html.match(/class="mobile-calendar-week"/g)||[]).length,6);
  assert.equal((html.match(/data-date=/g)||[]).length,42);
  assert.match(html,/data-date="2026-09-05"/);
  assert.equal((html.match(/class="event-chip/g)||[]).length,2);
  assert.match(html,/\+6개/);
  assert.match(html,/2026-08-01, 일정 8개/);
});
test('overflow badge does not consume an event line',()=>{
  const html=render(1,events);
  assert.match(html,/\+7개/);
  assert.equal((html.match(/class="event-chip/g)||[]).length,1);
});
test('events that fit stay visible; multi-day events form one bar per week',()=>{
  const html=render(2,[{...events[0],title:'<모임>',endDate:'2026-08-03'}]);
  assert.equal((html.match(/>&lt;모임&gt;<\/button>/g)||[]).length,2);
  assert.equal((html.match(/data-span-event=/g)||[]).length,2);
  assert.match(html,/grid-column:1 \/ 3/);
  assert.doesNotMatch(html,/class="more-events/);
});


test('a single event uses the first lane when the long event is on other dates',()=>{
 const html=render(2,[{...events[0],date:'2026-08-02',endDate:'2026-08-04'},{...events[1],title:'헬스',date:'2026-08-05'}]);
 assert.match(html,/grid-row:2;[^>]*>헬스<\/button>/);
 assert.doesNotMatch(html,/class="more-events/);
});

 test('single-day personal events are separate edit buttons rather than date content',()=>{
  const html=render(2,[events[0]]);
  assert.match(html,/<button type="button" class="event-chip personal single-event-button" data-span-event="0"/);
  assert.doesNotMatch(html,/<span class="event-chip/);
 });

test('compact weeks keep equal date heights even when only one week is busy',()=>{
 const html=render(2,events,42,true);
 const heights=[...html.matchAll(/min-height:(\d+)px;grid-template-rows/g)].map(m=>Number(m[1]));
 assert.equal(heights.length,6);
 assert.equal(new Set(heights).size,1);
 assert.equal(heights[0],72);
});

test('overflow count gets a separate row below date and event rows',()=>{
 const html=render(2,events);
 assert.match(html,/repeat\(2,20px\) 16px minmax\(0,1fr\)/);
 assert.match(html,/<span class="more-events day-overflow" style="grid-column:7;grid-row:4" aria-hidden="true">\+6개<\/span>/);
 assert.doesNotMatch(html,/<span class="day-number">1<\/span><span class="more-events/);
});
