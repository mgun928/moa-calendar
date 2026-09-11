import {defaultHabits,defaultTimetable,minutes,clock,weekdays,validateEntry,overlaps,layoutEntries,weekDates,habitCount} from './personal-model.js';

const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function setupPersonalTools(){
 const api=window.moaPersonalData;
 const data=()=>api.read();
 const uid=prefix=>prefix+'-'+crypto.randomUUID();
 const workspace=document.querySelector('.workspace');
 const hobby=document.querySelector('.hobby-panel');
 const section=document.createElement('section');
 section.id='timetable-section';section.hidden=true;
 section.innerHTML=`<header class="tt-heading"><div><p class="eyebrow">A RHYTHM OF YOUR OWN</p><h2>나의 주간 시간표</h2><p class="subtle">매주 반복할 나만의 리듬을 계획해요.</p></div><button type="button" class="outline" id="tt-add">＋ 일정</button></header>
 <label class="tt-share"><input type="checkbox" id="tt-share"> 친구에게 시간표 공개</label><form class="tt-settings"><label>표시 시작<select name="start" aria-label="표시 시작"></select></label><button class="outline" type="submit">적용</button></form>
 <details class="tt-outside" hidden><summary></summary><div></div></details>
 <div class="tt-scroll" tabindex="0" aria-label="주간 시간표, 빈 시간 칸을 선택하세요"><div class="tt-grid"></div></div>
 <p class="tt-help">빈 칸을 선택해 등록 · 블록을 선택해 수정 · 매주 반복되는 시간표</p>`;
 workspace.insertBefore(section,workspace.querySelector('.page-footer'));
 const settings=section.querySelector('.tt-settings');
 let settingsDirty=false;
 settings.addEventListener('change',()=>{settingsDirty=true;});
 settings.elements.start.innerHTML=Array.from({length:24},(_,h)=>`<option value="${h*60}">${clock(h*60)}</option>`).join('');
 const scroller=section.querySelector('.tt-scroll'),grid=section.querySelector('.tt-grid');
 const saveNotes=[hobby,section].map(parent=>{const note=document.createElement('p');note.className='personal-save-status';note.setAttribute('role','status');parent.append(note);return note;});
 document.addEventListener('moa-save-status',event=>{saveNotes.forEach(note=>{
  note.textContent=event.detail.message;
  if(event.detail.state==='error'){const retry=document.createElement('button');retry.className='outline';retry.textContent='다시 저장';retry.onclick=()=>window.moaCalendarStore.retry();note.append(retry);}
 });});
 const dialog=document.createElement('dialog');dialog.id='tt-dialog';dialog.setAttribute('aria-labelledby','tt-dialog-title');
 dialog.innerHTML=`<form id="tt-form"><div class="section-heading"><h2 id="tt-dialog-title">시간표 일정 추가</h2><button class="icon-button" type="button" data-dismiss aria-label="시간표 창 닫기">×</button></div>
 <label>일정 이름<input name="title" required maxlength="60" placeholder="운동, 공부, 수업…"></label>
 <label>요일<select name="day">${weekdays.map((day,i)=>`<option value="${i}">${day}요일</option>`).join('')}</select></label>
 <div class="form-row"><label>시작 시각<input name="start" type="time" step="60" required></label><label>종료 시각<input name="end" type="time" step="60" required></label></div>
 <label class="tt-midnight"><input name="midnight" type="checkbox"> 자정(24:00)에 종료</label>
 <label>장소 (선택)<input name="place" maxlength="80"></label><label>메모 (선택)<textarea name="note" maxlength="500" rows="2"></textarea></label>
 <label>블록 색상<input name="color" type="color" value="#bc8158"></label>
 <p class="form-error" id="tt-error" role="alert" hidden></p><label class="tt-overlap" hidden><input name="allowOverlap" type="checkbox"> 겹치는 시간을 확인했어요. 나란히 저장할게요.</label>
 <p class="subtle">시간표에만 저장되며, 개인·그룹 캘린더에는 추가되지 않아요.</p>
 <div class="dialog-actions"><button type="button" class="delete-button" id="tt-delete" hidden>일정 삭제</button><button class="primary" type="submit">저장하기</button></div></form>`;
 document.body.append(dialog);
 const form=dialog.querySelector('form'),fields=form.elements,error=dialog.querySelector('#tt-error'),overlapLabel=dialog.querySelector('.tt-overlap');
 let editing=null,drag=null,suppressClick=0;
 const share=section.querySelector('#tt-share');
 share.addEventListener('change',()=>saveTable({...timetable(),visibility:share.checked?'friends':'private'}));
 const timetable=()=>({...defaultTimetable(),...data().timetable,end:1440,weekend:true});
 function saveTable(next){api.update({timetable:next});}
 function openEntry(id=null,day=0,start=540,end=Math.min(start+60,1440)){
  const e=timetable().entries.find(e=>e.id===id);
  editing=e?.id||null;form.reset();error.hidden=true;overlapLabel.hidden=true;
  dialog.querySelector('#tt-dialog-title').textContent=e?'시간표 일정 수정':'시간표 일정 추가';
  dialog.querySelector('#tt-delete').hidden=!e;
  fields.title.value=e?.title||'';fields.day.value=e?.day??day;fields.start.value=clock(e?.start??start);
  fields.midnight.checked=(e?.end??end)===1440;fields.end.disabled=fields.midnight.checked;fields.end.value=fields.midnight.checked?'00:00':clock(e?.end??end);
  fields.place.value=e?.place||'';fields.note.value=e?.note||'';fields.color.value=e?.color||'#bc8158';
  dialog.showModal();
 }
 section.querySelector('#tt-add').onclick=()=>openEntry();
 dialog.querySelector('[data-dismiss]').onclick=()=>dialog.close();
 fields.midnight.onchange=()=>{fields.end.disabled=fields.midnight.checked;if(fields.midnight.checked)fields.end.value='00:00';};
 form.addEventListener('input',e=>{if(e.target!==fields.allowOverlap){fields.allowOverlap.checked=false;error.hidden=true;overlapLabel.hidden=true;}});
 form.addEventListener('submit',e=>{
  e.preventDefault();
  const entry={id:editing||uid('tt'),title:fields.title.value.trim(),day:Number(fields.day.value),start:minutes(fields.start.value),end:fields.midnight.checked?1440:minutes(fields.end.value),place:fields.place.value.trim(),note:fields.note.value.trim(),color:fields.color.value};
  const issue=validateEntry(entry);
  if(issue){error.textContent=issue;error.hidden=false;return;}
  const collisions=timetable().entries.filter(other=>overlaps(entry,other));
  if(collisions.length&&!fields.allowOverlap.checked){
   error.textContent='같은 시간에 '+collisions.map(e=>e.title).join(', ')+' 일정이 있어요. 확인 후 아래 항목을 선택하면 겹쳐서 저장할 수 있어요.';
   error.hidden=false;overlapLabel.hidden=false;return;
  }
  const next=timetable();saveTable({...next,entries:[...next.entries.filter(e=>e.id!==entry.id),entry]});dialog.close();
 });
 dialog.querySelector('#tt-delete').onclick=()=>{const next=timetable();saveTable({...next,entries:next.entries.filter(e=>e.id!==editing)});dialog.close();};
 settings.addEventListener('submit',e=>{
  e.preventDefault();const start=Number(settings.elements.start.value);
  settingsDirty=false;saveTable({...timetable(),start});
 });
 grid.addEventListener('click',e=>{
  if(Date.now()<suppressClick)return;
  const block=e.target.closest('[data-entry]');if(block){openEntry(block.dataset.entry);return;}
  const slot=e.target.closest('[data-slot]');if(slot)openEntry(null,Number(slot.dataset.day),Number(slot.dataset.slot));
 });
 grid.addEventListener('pointerdown',e=>{
  const slot=e.target.closest('[data-slot]');
  if(!slot||e.pointerType!=='mouse'||e.button!==0||matchMedia('(max-width:640px)').matches)return;
  e.preventDefault();const column=slot.parentElement,index=Number(slot.dataset.index);
  drag={id:e.pointerId,column,first:index,last:index,y:e.clientY,moved:false,day:Number(slot.dataset.day)};
  const mark=document.createElement('div');mark.className='tt-selection';column.append(mark);drag.mark=mark;
  column.setPointerCapture(e.pointerId);paintSelection();
 });
 function paintSelection(){drag.mark.style.top=Math.min(drag.first,drag.last)*30+'px';drag.mark.style.height=(Math.abs(drag.first-drag.last)+1)*30+'px';}
 grid.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.id)return;
  if(Math.abs(e.clientY-drag.y)>4)drag.moved=true;
  drag.last=Math.max(0,Math.min((timetable().end-timetable().start)/30-1,Math.floor((e.clientY-drag.column.getBoundingClientRect().top)/30)));paintSelection();
 });
 function endDrag(e,cancel=false){
  if(!drag||drag.id!==e.pointerId)return;
  const d=drag;drag=null;d.mark.remove();if(d.column.hasPointerCapture(e.pointerId))d.column.releasePointerCapture(e.pointerId);
  suppressClick=Date.now()+300;
  if(!cancel){const start=timetable().start+Math.min(d.first,d.last)*30;openEntry(null,d.day,start,Math.min(1440,d.moved?timetable().start+(Math.max(d.first,d.last)+1)*30:start+60));}
 }
 grid.addEventListener('pointerup',e=>endDrag(e));grid.addEventListener('pointercancel',e=>endDrag(e,true));
 grid.addEventListener('lostpointercapture',e=>{if(drag)endDrag(e,true);});
 section.querySelector('.tt-outside').addEventListener('click',e=>{const b=e.target.closest('[data-outside]');if(b)openEntry(b.dataset.outside);});
 function renderTable(){
  const table=timetable(),days=7;share.checked=table.visibility==='friends';
  if(!settingsDirty)settings.elements.start.value=table.start;
  const slots=(table.end-table.start)/30,shown=table.entries.filter(e=>e.day<days&&e.end>table.start&&e.start<table.end);
  const placed=layoutEntries(shown),outside=table.entries.filter(e=>e.day>=days||e.start<table.start||e.end>table.end);
  const info=section.querySelector('.tt-outside');info.hidden=!outside.length;
  info.querySelector('summary').textContent='표시 범위 밖의 일정 '+outside.length+'개 보기';
  info.querySelector('div').innerHTML=outside.map(e=>`<button class="outline" data-outside="${escape(e.id)}">${weekdays[e.day]} ${clock(e.start)}–${clock(e.end)} · ${escape(e.title)}</button>`).join('');
  grid.style.setProperty('--tt-days',days);
  let html='<div class="tt-corner" aria-hidden="true"></div>'+weekdays.slice(0,days).map(d=>`<div class="tt-day-heading">${d}</div>`).join('');
  html+='<div class="tt-axis">'+Array.from({length:slots},(_,i)=>`<div>${i%2===0?clock(table.start+i*30):''}</div>`).join('')+'</div>';
  for(let day=0;day<days;day++){
   html+='<div class="tt-day-column">';
   html+=Array.from({length:slots},(_,i)=>`<button type="button" class="tt-slot" data-day="${day}" data-slot="${table.start+i*30}" data-index="${i}" aria-label="${weekdays[day]}요일 ${clock(table.start+i*30)} 일정 추가"></button>`).join('');
   html+=placed.filter(e=>e.day===day).map(e=>{
    const start=Math.max(e.start,table.start),end=Math.min(e.end,table.end),height=end-start;
    const full=`${e.title} · ${weekdays[e.day]}요일 ${clock(e.start)}–${clock(e.end)}${e.place?' · '+e.place:''}`;
    return `<button type="button" class="tt-block ${height<42?'tt-compact':''}" data-entry="${escape(e.id)}" aria-label="${escape(full)}" title="${escape(full)}" style="top:${start-table.start}px;height:${height}px;left:calc(${e.column/e.columns*100}% + 2px);width:calc(${100/e.columns}% - 4px);--block-color:${escape(e.color)}"><strong>${escape(e.title)}</strong><small>${clock(e.start)}–${clock(e.end)}</small>${height>=78&&e.place?'<span>'+escape(e.place)+'</span>':''}</button>`;
   }).join('');
   html+='</div>';
  }
  grid.innerHTML=html;
  requestAnimationFrame(fitTable);
 }
 function fitTable(){
  if(section.hidden)return;
  const siblings=[...section.children],tail=siblings.slice(siblings.indexOf(scroller)+1).reduce((sum,node)=>{
   const style=getComputedStyle(node);return style.display==='none'?sum:sum+node.getBoundingClientRect().height+(parseFloat(style.marginTop)||0)+(parseFloat(style.marginBottom)||0);
  },0);
  const safe=parseFloat(getComputedStyle(document.querySelector('.bottom-drawer-handle')||section).paddingBottom)||0;
  scroller.style.height=Math.max(80,innerHeight-scroller.getBoundingClientRect().top-tail-Math.max(12,safe))+'px';
 }
 new ResizeObserver(fitTable).observe(section.querySelector('.tt-heading'));
 new ResizeObserver(fitTable).observe(section.querySelector('.tt-settings'));
 new ResizeObserver(fitTable).observe(section.querySelector('.tt-outside'));
 new ResizeObserver(fitTable).observe(section.querySelector('.personal-save-status'));
 window.addEventListener('resize',fitTable);
 new MutationObserver(()=>{if(!section.hidden){scroller.scrollTop=0;scroller.scrollLeft=0;}fitTable();}).observe(section,{attributes:true,attributeFilter:['hidden']});

 // The same habits and legacy daily checks power desktop and the mobile sheet.
 const controls=document.createElement('div');controls.className='habit-controls';
 controls.innerHTML='<button type="button" class="outline" id="habit-add">＋ 취미 추가</button>';
 hobby.insertBefore(controls,document.querySelector('#hobbies'));
 const planned=document.createElement('details');planned.className='hobby-planned';
 planned.innerHTML='<summary>취미 캘린더 일정</summary><button type="button" class="add-inline" id="hobby-event-add">＋ 취미 일정 추가</button><div class="hobby-event-list"></div>';
 hobby.append(planned);
 const habitDialog=document.createElement('dialog');habitDialog.id='habit-dialog';habitDialog.setAttribute('aria-labelledby','habit-dialog-title');
 habitDialog.innerHTML=`<form><div class="section-heading"><h2 id="habit-dialog-title">취미 추가</h2><button class="icon-button" type="button" data-dismiss aria-label="취미 창 닫기">×</button></div>
 <label>취미 이름<input name="title" required maxlength="60"></label><label>주간 목표 (활동한 날 수)<input name="target" type="number" min="1" max="7" step="1" required value="3"></label>
 <p class="subtle">하루 한 번 기록해요. 기존 기록은 이름이나 목표를 바꿔도 유지돼요.</p><p class="form-error" role="alert" hidden></p>
 <div class="dialog-actions"><button class="delete-button" type="button" id="habit-delete" hidden>취미 삭제</button><button class="primary" type="submit">저장하기</button></div></form>`;
 document.body.append(habitDialog);const hf=habitDialog.querySelector('form');let habitId=null;
 const habits=()=>data().habits||defaultHabits();
 function openHabit(id=null){
  habitId=id;hf.reset();const habit=habits().find(h=>h.id===id);
  habitDialog.querySelector('#habit-dialog-title').textContent=habit?'취미 수정':'취미 추가';
  hf.elements.title.value=habit?.title||'';hf.elements.target.value=habit?.target||3;
  habitDialog.querySelector('#habit-delete').hidden=!habit;habitDialog.querySelector('.form-error').hidden=true;habitDialog.showModal();
 }
 controls.querySelector('button').onclick=()=>openHabit();
 habitDialog.querySelector('[data-dismiss]').onclick=()=>habitDialog.close();
 hf.onsubmit=e=>{
  e.preventDefault();const title=hf.elements.title.value.trim(),target=Number(hf.elements.target.value);
  if(!title||!Number.isInteger(target)||target<1||target>7){const message=habitDialog.querySelector('.form-error');message.textContent='이름과 1~7일 사이의 주간 목표를 입력해 주세요.';message.hidden=false;return;}
  const h={id:habitId||uid('habit'),title,target};api.update({habits:[...habits().filter(x=>x.id!==h.id),h]});habitDialog.close();
 };
 habitDialog.querySelector('#habit-delete').onclick=()=>{api.update({habits:habits().filter(h=>h.id!==habitId),checks:Object.fromEntries(Object.entries(data().checks).filter(([key])=>!key.startsWith(habitId+':')))});habitDialog.close();};
 document.querySelector('#hobbies').addEventListener('click',e=>{
  const edit=e.target.closest('[data-edit-habit]');if(edit){openHabit(edit.dataset.editHabit);return;}
  const log=e.target.closest('[data-log-habit]');
  if(log){const k=log.dataset.logHabit,checks={...data().checks};if(checks[k])delete checks[k];else checks[k]=true;api.update({checks});}
 });
 planned.querySelector('#hobby-event-add').onclick=()=>api.openHobbyEvent();
 planned.querySelector('.hobby-event-list').onclick=e=>{const b=e.target.closest('[data-hobby-event]');if(b)api.openHobbyEvent(b.dataset.hobbyEvent);};
 function renderHabits(){
  const dates=weekDates(),checks=data().checks;
  document.querySelector('#hobbies').innerHTML=habits().map(h=>{
   const count=habitCount(checks,h.id,dates);
   return `<article class="habit-card"><div class="hobby-info"><strong>${escape(h.title)}</strong><button class="outline" data-edit-habit="${escape(h.id)}" aria-label="${escape(h.title)} 수정">수정</button></div><p class="habit-progress-label">이번 주 ${count} / ${h.target}일</p><div class="progress" role="progressbar" aria-label="${escape(h.title)} 진행률" aria-valuemin="0" aria-valuemax="${h.target}" aria-valuenow="${Math.min(count,h.target)}"><i style="width:${Math.min(100,count/h.target*100)}%"></i></div><div class="habit-days">${dates.map((date,i)=>`<button type="button" data-log-habit="${escape(h.id+':'+date)}" aria-label="${escape(h.title)} ${date} 활동 기록" aria-pressed="${!!checks[h.id+':'+date]}" >${weekdays[i]}<span>${checks[h.id+':'+date]?'✓':'·'}</span></button>`).join('')}</div></article>`;
  }).join('')||'<p class="empty">즐기는 취미를 추가하고 한 주를 기록해 보세요.</p>';
  planned.querySelector('.hobby-event-list').innerHTML=data().events.filter(e=>e.type==='hobby').sort((a,b)=>b.date.localeCompare(a.date)).map(e=>`<button type="button" class="habit-event" data-hobby-event="${escape(e.id)}"><strong>${escape(e.title)}</strong><small>${escape(e.date)} · ${escape(e.time)}</small></button>`).join('')||'<p class="subtle">아직 취미 일정이 없어요.</p>';
 }
 window.renderPersonalTools=()=>{renderHabits();renderTable();};
 window.renderPersonalTools();
 return {render:window.renderPersonalTools};
}
