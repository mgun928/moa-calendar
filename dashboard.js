const $ = (selector) => document.querySelector(selector);
const today = new Date();
const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const parseDate = (key) => new Date(`${key}T12:00:00`);
const key = dateKey(today);
let selected = key, month = new Date(today.getFullYear(), today.getMonth(), 1), filter = 'all', activeGroup = '', editing = null;
const labels = {personal:'개인',group:'그룹',hobby:'취미'};
const groupPalette = {sage:'#81945f',clay:'#bc8158',lavender:'#a080b0',blue:'#638fa9'};
const validGroupColor = color => Object.hasOwn(groupPalette,color) || /^#[0-9a-f]{6}$/i.test(color);
function groupColorStyle(group){
  const hex=groupPalette[group?.color] || (validGroupColor(group?.color)?group.color:'#81945f');
  const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
  return `--group-color:${hex};--group-bg:rgb(${rgb.map(v=>Math.round(v*.14+255*.86)).join(',')});--group-ink:rgb(${rgb.map(v=>Math.round(v*.48)).join(',')})`;
}
let userGroups = [];
let groupHub = false;
let editingGroup = null, menuGroup = null, menuTrigger = null, deletingGroup = null;
const groupById = id => userGroups.find(g=>g.id===id);
const groupLabel = id => groupById(id)?.name || id || '그룹';
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let events = [], checks = {};
const initialCalendar = window.moaCalendarStore.initial;
events = initialCalendar.events;
checks = initialCalendar.checks;
userGroups = initialCalendar.groups;
let habits = initialCalendar.habits || [{id:'reading',title:'책과 가까워지기',target:3},{id:'walking',title:'가볍게 산책하기',target:4}];
let timetable = initialCalendar.timetable || {entries:[],weekend:false,start:480,end:1320};
// Normalize older name-based group references.
events=events.map(e=>e.type==='group'?{...e,group:userGroups.find(g=>g.id===e.group||g.name===e.group)?.id||e.group}:e);
events=events.map(e=>({...e,endDate:e.endDate&&e.endDate>=e.date?e.endDate:e.date,allDay:!!e.allDay}));
function save(){
  const sharedIds = new Set(userGroups.filter(g=>g.shared).map(g=>g.id));
  window.moaCalendarStore.save({...initialCalendar,events:events.filter(e=>!sharedIds.has(e.group)),checks,groups:userGroups.filter(g=>!g.shared),habits,timetable});
  // Completion is announced only after the server acknowledges the write.
  return false;
}
let toastTimer;
function notify(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,3200);}
let sharedIds = new Set();
window.applySharedGroups = function(rows){
  const incoming = new Set(rows.map(g=>g.id));
  userGroups = userGroups.filter(g=>!sharedIds.has(g.id)&&!incoming.has(g.id));
  events = events.filter(e=>!sharedIds.has(e.group)&&!incoming.has(e.group));
  for(const row of rows){
    userGroups.push({...row.info,id:row.id,invites:[],shared:true,owner:row.owner,version:row.version});
    events.push(...row.events);
  }
  sharedIds=incoming;
  if(activeGroup&&!groupById(activeGroup))setView('group');else render();
};
async function waitForPrivateSave(){
  const deadline=Date.now()+10000;
  while(window.moaCalendarStore.hasPending()&&Date.now()<deadline)await new Promise(r=>setTimeout(r,100));
  if(window.moaCalendarStore.hasPending())throw new Error('먼저 상단에서 일정 저장을 완료해주세요.');
}
async function inviteToGroup(id,emails){
  await waitForPrivateSave();
  await window.moaSharing.mutate('invite',{group_id:id,emails});
  save();
}
function visibleEvents(){return events.filter(e=>(['all','timetable'].includes(filter)||e.type===filter)&&(!activeGroup||e.group===activeGroup));}
function weekKeys(){const start=new Date(today);start.setDate(start.getDate()-((start.getDay()+6)%7));return Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);return dateKey(d);});}
function render(){
  const quickLabel=document.querySelector('.quick-add-label');
  if(quickLabel){const d=parseDate(selected);quickLabel.placeholder=`${d.getMonth()+1}월 ${d.getDate()}일 일정 추가`;}

  renderGroups();
  const matching=visibleEvents();
  $('#month-title').textContent=`${month.getMonth()+1}월`;
  $('#month-title').title=`${month.getFullYear()}년 ${month.getMonth()+1}월 · 연도와 월 선택`;
  const first=new Date(month.getFullYear(),month.getMonth(),1);first.setDate(first.getDate()-first.getDay());
  const cells=Math.ceil((new Date(month.getFullYear(),month.getMonth(),1).getDay()+new Date(month.getFullYear(),month.getMonth()+1,0).getDate())/7)*7;
  $('#calendar').style.setProperty('--week-count',cells/7);
  $('#calendar').innerHTML=renderCalendarWeeks(first,cells,matching);
  window.layoutMobileCalendar?.();
  $('#month-count').textContent=`이번 달 ${matching.filter(e=>e.date<=dateKey(new Date(month.getFullYear(),month.getMonth()+1,0))&&eventEnd(e)>=dateKey(month)).length}개의 일정`;
  const daily=matching.filter(e=>occursOn(e,selected)).sort((a,b)=>a.time.localeCompare(b.time));
  $('#agenda-title').textContent=selected===key?'오늘의 일정':'선택한 날의 일정';
  $('#selected-date').textContent=parseDate(selected).toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'long'});
  if($('#daily-sheet-date'))$('#daily-sheet-date').textContent=$('#selected-date').textContent;
  $('#agenda-count').textContent=daily.length;
  $('#agenda').innerHTML=daily.length?daily.map(e=>`<button class="agenda-item ${e.type}" ${e.type==='group'?`style="${groupColorStyle(groupById(e.group))}"`:""} data-event="${escapeHTML(e.id)}"><span class="agenda-time">${e.allDay?'종일':e.date===selected?e.time:eventEnd(e)===selected?(e.endTime||'종료'):'계속'}</span><span class="agenda-detail ${e.type}" ${e.type==='group'?`style="${groupColorStyle(groupById(e.group))}"`:""}><strong>${escapeHTML(e.title)}</strong>${eventEnd(e)>e.date?`<small>${escapeHTML(eventRange(e))}</small>`:""}${e.note?`<small class="agenda-note">${escapeHTML(e.note)}</small>`:''}</span>${e.type==='group'?`<span class="agenda-group-name">${escapeHTML(groupLabel(e.group))}</span>`:''}</button>`).join(''):'<p class="empty">아직 정해진 일정이 없어요.<br>나를 위한 시간을 모아볼까요?</p>';
  const completed=habits.map(h=>h.id).reduce((n,id)=>n+weekKeys().filter(k=>checks[`${id}:${k}`]).length,0);
  $('#summary').innerHTML=[['□','오늘의 일정',events.filter(e=>occursOn(e,key)).length,'개의 약속'],['♧','함께하는 그룹',userGroups.length,'개의 모임'],['❀','이번 주 취미 기록',completed,'번의 작은 실천']].map(s=>`<div class="summary-item"><span class="summary-icon" aria-hidden="true">${s[0]}</span><div><p>${s[1]}</p><strong>${s[2]}<small>${s[3]}</small></strong></div></div>`).join('');
  $('#groups').innerHTML=userGroups.map(g=>groupCard(g,true)).join('');
  window.refreshMemories?.();
  window.renderPersonalTools?.();
  document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('active',b.dataset.filter===filter);b.setAttribute('aria-pressed',String(b.dataset.filter===filter));});
}
let viewTransitionFrame=0,viewAnimations=[];
function animateViewChange(){
  cancelAnimationFrame(viewTransitionFrame);
  viewAnimations.forEach(animation=>animation.cancel());viewAnimations=[];
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  viewTransitionFrame=requestAnimationFrame(()=>{
    const target=groupHub?$('#group-hub'):filter==='timetable'?$('#timetable-section'):filter==='memories'?$('#memory-section'):filter==='friends'?$('#friends-section'):$('.calendar-panel');
    if(!target||target.hidden||!target.animate)return;
    viewAnimations.push(target.animate([{opacity:.3,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:220,easing:'cubic-bezier(.2,.65,.3,1)'}));
  });
}
function setView(view,group='',showHub=view==='group'&&!group){
  const changed=filter!==view||activeGroup!==group||groupHub!==showHub;
  filter=view;activeGroup=group;
  document.body.dataset.view=view;
  if($('#friends-section'))$('#friends-section').hidden=view!=='friends';
  if(view==='friends')window.moaFriends?.refresh();
  if($('#timetable-section'))$('#timetable-section').hidden=view!=='timetable';
  groupHub=showHub;
  document.body.classList.toggle('group-calendar-open',view==='group'&&!!group&&!showHub);
  $('#group-hub').hidden=!groupHub;
  $('.content-grid').hidden=groupHub||['memories','friends','timetable'].includes(view);
  $('#summary').hidden=groupHub||!!group||['memories','friends','timetable'].includes(view);
  $('.groups-section').hidden=groupHub||!!group||['memories','friends','timetable'].includes(view);
  $('#add-event').hidden=groupHub||['memories','friends','timetable'].includes(view);
  $('#group-detail-bar').hidden=!group;
  $('.calendar-filters').hidden=!!group;
  $('.hobby-panel').hidden=!!group;
  $('#group-detail-description').textContent=groupById(group)?.description||'';
  const names={all:'모아보기',personal:'개인 캘린더',group:'그룹 캘린더',hobby:'취미 관리',memories:'추억 사진',friends:'친구',timetable:'시간표'};
  const titles={all:'오늘도, 나다운 하루를 모아.',personal:'나만의 속도로 채우는 하루.',group:'함께라서 더 좋은 하루.',hobby:'좋아하는 일에, 조금 더 가까이.'};
  $('#breadcrumb').textContent=group?`그룹 캘린더 / ${groupLabel(group)}`:names[view];$('#page-title').textContent=group?groupLabel(group):titles[view];
  $('#page-description').textContent=group?'우리의 다음 약속을 달력에서 확인해요.':{all:'소중한 약속과 나를 위한 시간, 한곳에서 가볍게 정리해요.',personal:'작은 할 일부터 중요한 약속까지, 나의 시간을 정리해요.',group:'함께하는 약속을 모아 두고, 다음 만남을 준비해요.',hobby:'좋아하는 일을 계획하고, 오늘의 작은 실천을 기록해요.'}[view];
  document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-current',b.dataset.view===view?'page':'false');});render();
  if(changed)animateViewChange();
}
function openEvent(id=null){
  editing=id;const form=$('#event-form');form.reset();const event=events.find(e=>e.id===id);
  $('#event-error').hidden=true;form.elements.endDate.value=event?eventEnd(event):selected;form.elements.endTime.value=event?.endTime||event?.time||'10:00';form.elements.allDay.checked=!!event?.allDay;syncEventTimes();
  $('#dialog-title').textContent=event?'일정 수정':'새 일정';$('#delete-event').hidden=!event;
  form.elements.date.value=event?.date||selected;form.elements.time.value=event?.time||'09:00';form.elements.type.value=event?(event.type==='group'?'group':'personal'):(filter==='group'?'group':'personal');
  form.elements.group.innerHTML=userGroups.map(g=>`<option value="${escapeHTML(g.id)}">${escapeHTML(g.name)}</option>`).join('');
  form.elements.title.value=event?.title||'';form.elements.note.value=event?.note||'';form.elements.group.value=event?.group||activeGroup||userGroups[0]?.id||'';
  form.elements.visibility.value=event?.visibility==='friends'?'friends':'private';
  syncVisibility();
  $('#event-memory').hidden=!event||event.type!=='group';$('#event-memory').dataset.event=id||'';
  $('#group-field').hidden=form.elements.type.value!=='group';$('#event-dialog').showModal();
}
let lastDateClick=null;
$('#calendar').addEventListener('click',e=>{
 const eventButton=e.target.closest('[data-span-event]');
 if(eventButton){lastDateClick=null;openEvent(eventButton.dataset.spanEvent);return;}
 const b=e.target.closest('[data-date]');if(!b)return;
 const now=performance.now(),date=b.dataset.date;
 const doubleClick=lastDateClick?.date===date&&now-lastDateClick.time<350;
 lastDateClick=doubleClick?null:{date,time:now};
 selected=date;month=new Date(parseDate(selected).getFullYear(),parseDate(selected).getMonth(),1);render();
 if(doubleClick){
  const selectedDay=Array.from(document.querySelectorAll('#calendar [data-date]')).find(node=>node.dataset.date===date);
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
   selectedDay?.animate([{transform:'scale(1)'},{transform:'scale(.95)',offset:.4},{transform:'scale(1)'}],{duration:220,easing:'ease-out'});
  }
  openEvent();
 }
});
$('#agenda').addEventListener('click',e=>{const b=e.target.closest('[data-event]');if(b)openEvent(b.dataset.event);});
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.filter,'',false)));
$('#groups').addEventListener('click',e=>{const b=e.target.closest('[data-group]');if(b){setView('group',b.dataset.group);$('.calendar-panel').scrollIntoView({block:'start'});}});
$('#prev-month').addEventListener('click',()=>{month.setMonth(month.getMonth()-1);render();});
// A modal month picker keeps the calendar's layout unchanged.
const monthTitle=$('#month-title');
monthTitle.setAttribute('role','button');
monthTitle.setAttribute('tabindex','0');
monthTitle.setAttribute('aria-haspopup','dialog');
monthTitle.setAttribute('aria-label','연도와 월 선택');
const monthPicker=document.createElement('dialog');
monthPicker.className='month-picker';
monthPicker.setAttribute('aria-labelledby','month-picker-heading');
monthPicker.innerHTML='<div class="month-picker-heading"><h2 id="month-picker-heading">연도와 월 선택</h2><button type="button" class="icon-button" aria-label="닫기">×</button></div><label class="month-picker-year"><span>연도</span><input type="number" min="1900" max="9999" step="1" inputmode="numeric" aria-label="연도"></label><div class="month-picker-year"><span>월</span><div class="month-picker-wheel" tabindex="0" role="slider" aria-label="월 선택, 좌우로 드래그하거나 방향키로 변경" aria-valuemin="1" aria-valuemax="12"><span class="month-wheel-arrow left" aria-hidden="true">‹</span><div class="month-picker-track">'+Array.from({length:12},(_,i)=>`<div>${i+1}월</div>`).join('')+'</div><span class="month-wheel-arrow right" aria-hidden="true">›</span></div></div><p class="month-picker-hint">좌우로 밀어 월을 선택하세요</p><button type="button" class="primary month-picker-apply">이동하기</button>';
document.body.append(monthPicker);
const pickerYear=monthPicker.querySelector('input');
const monthWheel=monthPicker.querySelector('.month-picker-wheel'),monthTrack=monthPicker.querySelector('.month-picker-track');
let pickerMonth=0,monthDrag=null;
function paintPickerMonth(offset=0){
 monthTrack.style.transform=`translateX(calc(${-pickerMonth*100}% + ${offset}px))`;
 monthWheel.setAttribute('aria-valuenow',String(pickerMonth+1));
 monthWheel.setAttribute('aria-valuetext',`${pickerMonth+1}월`);
}
monthWheel.addEventListener('pointerdown',e=>{
 if(!e.isPrimary||e.button!==0||monthPicker.classList.contains('is-closing'))return;
 monthDrag={id:e.pointerId,x:e.clientX,dx:0};monthWheel.setPointerCapture(e.pointerId);monthWheel.classList.add('dragging');
});
monthWheel.addEventListener('pointermove',e=>{
 if(!monthDrag||monthDrag.id!==e.pointerId)return;
 monthDrag.dx=e.clientX-monthDrag.x;
 const dx=monthDrag.dx,edge=(pickerMonth===0&&dx>0)||(pickerMonth===11&&dx<0);
 paintPickerMonth(edge?dx*.2:dx);
});
function endMonthDrag(e){
 if(!monthDrag||monthDrag.id!==e.pointerId)return;
 const dx=monthDrag.dx;
 if(e.type!=='pointercancel'){
  let step=Math.abs(dx)>40?-Math.sign(dx)*Math.max(1,Math.round(Math.abs(dx)/monthWheel.clientWidth)):0;
  if(Math.abs(dx)<5){const x=e.clientX-monthWheel.getBoundingClientRect().left;if(x<36)step=-1;else if(x>monthWheel.clientWidth-36)step=1;}
  pickerMonth=Math.max(0,Math.min(11,pickerMonth+step));
 }
 monthDrag=null;monthWheel.classList.remove('dragging');paintPickerMonth();
}
monthWheel.addEventListener('pointerup',endMonthDrag);
monthWheel.addEventListener('pointercancel',endMonthDrag);
monthWheel.addEventListener('keydown',e=>{
 if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
 e.preventDefault();pickerMonth=e.key==='Home'?0:e.key==='End'?11:Math.max(0,Math.min(11,pickerMonth+(e.key==='ArrowRight'?1:-1)));paintPickerMonth();
});
function closeMonthPicker(){
 if(!monthPicker.open||monthPicker.classList.contains('is-closing'))return;
 if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){monthPicker.close();return;}
 monthPicker.classList.add('is-closing');
 setTimeout(()=>{monthPicker.close();monthPicker.classList.remove('is-closing');},180);
}
monthPicker.addEventListener('cancel',e=>{e.preventDefault();closeMonthPicker();});
let applyPickedMonth;
function openMonthPicker(initial=month,onSelect=value=>{month=value;selected=dateKey(month);render();}){
 if(monthPicker.open)return;
 applyPickedMonth=onSelect;
 pickerYear.value=initial.getFullYear();
 pickerMonth=initial.getMonth();paintPickerMonth();
 monthPicker.showModal();
 monthWheel.focus();
}
window.moaOpenMonthPicker=openMonthPicker;
monthTitle.addEventListener('click',()=>openMonthPicker());
monthTitle.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openMonthPicker();}});
monthPicker.addEventListener('click',e=>{
 if(monthPicker.classList.contains('is-closing'))return;
 const choice=e.target.closest('.month-picker-apply');
 if(choice){
  if(!pickerYear.value||!pickerYear.reportValidity())return;
  applyPickedMonth(new Date(Number(pickerYear.value),pickerMonth,1));
  closeMonthPicker();
 }else if(e.target.closest('[aria-label="닫기"]'))closeMonthPicker();
 else if(e.target===monthPicker){const r=monthPicker.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeMonthPicker();}
});
$('#next-month').addEventListener('click',()=>{month.setMonth(month.getMonth()+1);render();});
$('#add-event').addEventListener('click',()=>openEvent());$('#add-selected').addEventListener('click',()=>openEvent());
$('#close-dialog').addEventListener('click',()=>$('#event-dialog').close());
function syncVisibility(){const f=$('#event-form').elements;f.visibility.disabled=false;f.visibility.options[0].textContent=f.type.value==='group'?'나만 보기 (그룹원은 항상 표시)':'나만 보기';f.visibility.options[1].textContent=f.type.value==='group'?'보이게 하기 (친구에게 공개)':'친구에게 공개';}
$('#event-form').elements.type.addEventListener('change',e=>{$('#group-field').hidden=e.target.value!=='group';syncVisibility();});
function animateSavedEvent(item){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  // Wait for responsive calendar sizing after the input keyboard closes.
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    const blocks=Array.from(document.querySelectorAll('#calendar [data-span-event]')).filter(b=>b.dataset.spanEvent===item.id);
    const badge=Array.from(document.querySelectorAll('#calendar [data-date]')).find(b=>b.dataset.date===item.date)?.querySelector('.more-events');
    const targets=blocks.length?blocks:badge?[badge]:[];
    targets.forEach((node,index)=>node.animate([
      {opacity:.2,transform:'translateY(5px) scale(.97)'},
      {opacity:1,transform:'translateY(0) scale(1)'}
    ],{duration:280,delay:Math.min(index*30,90),easing:'cubic-bezier(.2,.7,.3,1)',fill:'backwards'}));
  }));
}
$('#event-form').addEventListener('submit',async e=>{
  e.preventDefault();const f=e.currentTarget.elements;
  if(!f.title.value.trim()){f.title.setCustomValidity('일정 이름을 입력해 주세요.');f.title.reportValidity();return;}
  if(f.type.value==='group'&&!groupById(f.group.value)){notify('먼저 그룹을 만들어 주세요.');return;}
  const range={date:f.date.value,endDate:f.endDate.value,time:f.time.value,endTime:f.endTime.value,allDay:f.allDay.checked};
  const error=validateEventRange(range);if(error){showFormError('#event-error',error);return;}
  const item={...range,visibility:f.visibility.value==='friends'?'friends':'private',id:editing||`event-${Date.now()}-${Math.random().toString(36).slice(2)}`,title:f.title.value.trim(),date:f.date.value,time:f.allDay.checked?'00:00':f.time.value,type:f.type.value,note:f.note.value.trim(),group:f.type.value==='group'?f.group.value:''};
  const old=events.find(e=>e.id===editing), target=groupById(item.group), previous=groupById(old?.group);
  if(old&&(previous?.shared||target?.shared)&&(old.group!==item.group||old.type!==item.type)){
    showFormError('#event-error','공유 일정은 다른 캘린더로 이동할 수 없어요. 새 일정으로 추가해주세요.');return;
  }
  if(target?.shared){
    const button=e.currentTarget.querySelector('[type="submit"]');if(button.disabled)return;button.disabled=true;
    try{await window.moaSharing.mutate('event_save',{group_id:target.id,version:target.version,event:item});$('#event-dialog').close();animateSavedEvent(item);notify('그룹 일정을 저장했어요.');}
    catch(error){showFormError('#event-error',error.message);}
    finally{button.disabled=false;}return;
  }
  if(editing)events=events.map(e=>e.id===editing?item:e);else events.push(item);
  selected=item.date;month=new Date(parseDate(selected).getFullYear(),parseDate(selected).getMonth(),1);
  if((filter!=='all'&&filter!==item.type)||(activeGroup&&activeGroup!==item.group)){filter='all';activeGroup='';}
  const saved=save();setView(filter,activeGroup,false);$('#event-dialog').close();animateSavedEvent(item);if(saved)notify('일정을 저장했어요.');
});
$('#event-form').elements.title.addEventListener('input',e=>e.target.setCustomValidity(''));
$('#delete-event').addEventListener('click',async e=>{
  const event=events.find(x=>x.id===editing),group=groupById(event?.group),button=e.currentTarget;
  if(!event||button.disabled)return;
  if(!await window.moaConfirmDelete(`‘${event.title}’ 일정을 삭제할까요?${group?.shared?' 그룹원에게도 삭제됩니다.':''}`))return;
  if(group?.shared){
    if(button.disabled)return;button.disabled=true;
    try{await window.moaSharing.mutate('event_delete',{group_id:group.id,version:group.version,event_id:editing});$('#event-dialog').close();notify('그룹 일정을 삭제했어요.');}
    catch(error){showFormError('#event-error',error.message);}finally{button.disabled=false;}return;
  }
  events=events.filter(e=>e.id!==editing);save();render();$('#event-dialog').close();
});
render();

function nextGroupEvent(id){return events.filter(e=>e.type==='group'&&e.group===id&&eventEnd(e)>=key).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time))[0];}
function groupCard(g,compact=false){
  const more=`<button type="button" class="group-more" data-group-more="${escapeHTML(g.id)}" aria-label="${escapeHTML(g.name)} 관리" aria-haspopup="menu">⋯</button>`;
  const next=nextGroupEvent(g.id), symbols={sage:'♧',clay:'▤',lavender:'◇',blue:'◈'};
  const upcoming=next?`${parseDate(next.date).toLocaleDateString('ko-KR',{month:'long',day:'numeric'})} · ${next.allDay?'종일':next.time}${eventEnd(next)>next.date?` ~ ${parseDate(eventEnd(next)).toLocaleDateString('ko-KR',{month:'long',day:'numeric'})}`:''}`:'첫 번째 약속을 만들어 보세요';
  if(compact)return `<div class="group-card-wrapper"><button class="group-card" data-group="${escapeHTML(g.id)}"><span class="group-symbol" style="${groupColorStyle(g)}" aria-hidden="true">${symbols[g.color]||'♧'}</span><span><strong>${escapeHTML(g.name)}</strong><small>${upcoming}</small></span><span class="arrow" aria-hidden="true">↗</span></button>${more}</div>`;
  return `<div class="group-card-wrapper"><button class="group-list-card" data-group="${escapeHTML(g.id)}"><span class="group-symbol" style="${groupColorStyle(g)}" aria-hidden="true">${symbols[g.color]||'♧'}</span><span class="group-card-copy"><span class="group-card-title"><strong>${escapeHTML(g.name)}</strong><span class="group-tag">${g.shared&&!g.owner?'구성원':'그룹장'}</span></span><span class="group-card-description">${escapeHTML(g.description||'우리의 일상을 함께 모으는 공간.')}</span><span class="group-card-meta"><span class="mini-avatar">M</span> ${g.shared?'함께 쓰는 캘린더':'나의 그룹'}</span></span><span class="group-next"><small>${next?'다가오는 약속':'아직 일정이 없어요'}</small><strong>${next?escapeHTML(next.title):'새로운 하루를 함께 모아볼까요?'}</strong><span>${upcoming}</span></span><span class="arrow" aria-hidden="true">→</span></button>${more}</div>`;
}
function renderGroups(){
  const shown=userGroups.filter(g=>!activeGroup||g.id===activeGroup);
  $('#group-legend').hidden=groupHub || !['all','group'].includes(filter) || !shown.length;
  $('#group-legend').innerHTML=shown.map(g=>`<span class="legend-item" style="${groupColorStyle(g)}"><i aria-hidden="true"></i>${escapeHTML(g.name)}</span>`).join('');
  $('#group-total').textContent=userGroups.length;
  $('#group-list').innerHTML=userGroups.length?userGroups.map(g=>groupCard(g)).join(''):'<div class="group-empty"><span aria-hidden="true">♧</span><h2>아직 함께하는 그룹이 없어요.</h2><p>위의 그룹 만들기로 첫 모임을 시작해 보세요.</p></div>';
}
function parseInvites(value){
  const emails=value.split(/[\s,;]+/).map(s=>s.trim().toLowerCase()).filter(Boolean);
  const invalid=emails.find(email=>email.length>254||!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(email));
  if(invalid)throw new Error(`이메일 주소를 확인해 주세요: ${invalid}`);
  const unique=[...new Set(emails)];
  if(unique.length>20)throw new Error('초대 대상은 한 번에 20명까지 추가할 수 있어요.');
  return unique;
}
function showFormError(selector,message){$(selector).textContent=message;$(selector).hidden=false;}
function createGroupRecord(name,description,color,emails,id=null){
  name=name.trim();description=description.trim();
  if(!name)throw new Error('그룹 이름을 입력해 주세요.');
  if(name.length>30||description.length>100)throw new Error('그룹 이름은 30자, 소개는 100자 이내로 입력해 주세요.');
  if(userGroups.some(g=>g.id!==id&&g.name.toLowerCase()===name.toLowerCase()))throw new Error('이미 같은 이름의 그룹이 있어요. 구분할 수 있는 이름을 입력해 주세요.');
  if(!validGroupColor(color))throw new Error('그룹 색상을 선택해 주세요.');
  if(id){const existing=groupById(id);if(!existing)throw new Error('그룹을 찾을 수 없어요.');Object.assign(existing,{name,description,color});return existing;}
  const invites=parseInvites(emails);
  const group={id:`group-${Date.now()}-${Math.random().toString(36).slice(2)}`,name,description,color,invites,sample:false};
  userGroups.unshift(group);
  return group;
}
$('#create-group').addEventListener('click',()=>openGroupEditor());
$('[data-view="group"]').addEventListener('click',()=>window.scrollTo({top:0}));
$('#back-groups').addEventListener('click',()=>setView('group'));
$('#group-list').addEventListener('click',e=>{const button=e.target.closest('[data-group]');if(button)setView('group',button.dataset.group);});
$('#group-form').addEventListener('submit',async e=>{
  e.preventDefault();$('#group-error').hidden=true;const f=e.currentTarget.elements,button=$('#save-group');
  if(button.disabled)return;button.disabled=true;
  try{
    const existing=groupById(editingGroup),color=f.color.value==='custom'?f.customColor.value:f.color.value;
    if(existing?.shared){
      await window.moaSharing.mutate('update',{group_id:existing.id,version:existing.version,info:{name:f.groupName.value.trim(),description:f.description.value.trim(),color}});
    }else{
      const recipients=$('#creation-invites').hidden?[]:[...groupFriendSelection];
      const g=createGroupRecord(f.groupName.value,f.description.value,color,'',editingGroup);
      editingGroup=g.id;save();
      if(recipients.length){await waitForPrivateSave();await window.moaSharing.inviteFriends(g.id,recipients);save();}
      else await waitForPrivateSave();
    }
    $('#group-dialog').close();setView(filter,activeGroup,groupHub);notify('그룹을 저장했어요.');
  }catch(error){showFormError('#group-error',error.message);}finally{button.disabled=false;}
});
async function renderMembers(){
  const group=groupById(activeGroup);if(!group)return;
  $('#members-group-name').textContent=group.name;
  $('#invite-form').hidden=group.shared&&!group.owner;
  const list=$('#invite-list');list.textContent='불러오는 중…';
  try{
    if(!group.shared){
      $('#member-list').innerHTML='<p class="subtle">나 · 그룹장</p>';
      list.innerHTML=group.invites.length?group.invites.map(email=>`<p class="subtle">${escapeHTML(email)} · 미발송 — 아래에서 다시 초대해주세요.</p>`).join(''):'<p class="subtle">보낸 초대가 없어요.</p>';return;
    }
    const data=await window.moaSharing.call('members',{group_id:group.id});
    if(activeGroup!==group.id)return;
    $('#member-list').innerHTML=data.members.map(m=>`<div class="member-row"><strong>${escapeHTML(m.name)}</strong><span class="member-badge">${m.owner?'그룹장':'구성원'}</span></div>`).join('');
    const labels={pending:'수락 대기',accepted:'참여 완료',declined:'거절됨',cancelled:'취소됨'};
    list.innerHTML=data.invites.length?data.invites.map(i=>`<div class="invite-row"><span class="invite-email">${escapeHTML(i.email)}</span><span class="member-badge">${labels[i.status]}</span>${i.status==='pending'?`<button class="outline" data-cancel-invite="${escapeHTML(i.id)}">취소</button>`:''}</div>`).join(''):'<p class="subtle">보낸 초대가 없어요.</p>';
  }catch(error){list.textContent=error.message;}
}
$('#manage-members').addEventListener('click',()=>{$('#invite-form').reset();$('#invite-error').hidden=true;renderMembers();$('#members-dialog').showModal();});
$('#invite-form').addEventListener('submit',async e=>{
  e.preventDefault();$('#invite-error').hidden=true;const group=groupById(activeGroup);if(!group)return;
  const form=e.currentTarget,button=form.querySelector('[type="submit"]');if(button.disabled)return;button.disabled=true;
  try{
    const emails=parseInvites(form.elements.emails.value);if(!emails.length)throw new Error('이메일 주소를 입력해주세요.');
    await inviteToGroup(group.id,emails);form.reset();await renderMembers();notify('상대 계정의 받은 그룹 초대로 전달했어요.');
  }catch(error){showFormError('#invite-error',error.message);}finally{button.disabled=false;}
});
$('#invite-list').addEventListener('click',async e=>{
  const button=e.target.closest('[data-cancel-invite]');if(!button||button.disabled)return;button.disabled=true;
  try{await window.moaSharing.call('cancel',{group_id:activeGroup,id:button.dataset.cancelInvite});await renderMembers();}
  catch(error){showFormError('#invite-error',error.message);}finally{button.disabled=false;}
});
for(const button of document.querySelectorAll('[data-close]'))button.addEventListener('click',()=>document.getElementById(button.dataset.close).close());

$('#custom-group-color').addEventListener('input',()=>{$('#custom-color-radio').checked=true;});


let groupFriendSelection=new Set(),groupFriendPeople=[],groupFriendRequest=0;
function renderGroupFriends(){
 const query=$('#group-friend-search').value.trim().toLocaleLowerCase();
 const people=groupFriendPeople.filter(p=>p.nickname.toLocaleLowerCase().includes(query));
 $('#group-friend-options').innerHTML=people.map(p=>`<label class="group-friend-option"><input type="checkbox" value="${escapeHTML(p.id)}" ${groupFriendSelection.has(p.id)?'checked':''}><span>${escapeHTML(p.nickname)}</span></label>`).join('')||'<p class="subtle">'+(groupFriendPeople.length?'검색한 친구가 없어요.':'등록된 친구가 없어요. 친구를 추가한 뒤 초대할 수 있어요.')+'</p>';
}
async function loadGroupFriends(){
 const request=++groupFriendRequest;groupFriendSelection.clear();groupFriendPeople=[];
 $('#group-friend-options').textContent='친구 목록을 불러오는 중…';
 try{const people=await window.moaSharing.listFriends();if(request!==groupFriendRequest)return;groupFriendPeople=people;renderGroupFriends();}
 catch(error){if(request===groupFriendRequest)$('#group-friend-options').textContent=error.message;}
}
$('#group-friend-search').addEventListener('input',renderGroupFriends);
$('#group-friend-search').addEventListener('keydown',e=>{if(e.key==='Enter')e.preventDefault();});
$('#group-friend-options').addEventListener('change',e=>{
 if(!e.target.matches('input[type="checkbox"]'))return;
 if(e.target.checked&&groupFriendSelection.size>=20){e.target.checked=false;showFormError('#group-error','한 번에 20명까지 초대할 수 있어요.');return;}
 if(e.target.checked)groupFriendSelection.add(e.target.value);else groupFriendSelection.delete(e.target.value);
});
function openGroupEditor(id=null){
  editingGroup=id;const form=$('#group-form');form.reset();$('#group-error').hidden=true;
  const g=groupById(id);$('#group-dialog-title').textContent=g?'그룹 수정':'그룹 만들기';
  $('#save-group').textContent=g?'변경 사항 저장':'그룹 만들기 →';$('#creation-invites').hidden=!!g;
  if(g){form.elements.groupName.value=g.name;form.elements.description.value=g.description;form.elements.color.value=Array.from(form.querySelectorAll('input[name=color]')).some(input=>input.value===g.color)?g.color:'custom';form.elements.customColor.value=groupPalette[g.color]||g.color;}
  if(!g)void loadGroupFriends();
  $('#group-dialog').showModal();
}
function closeGroupMenu(restore=false){$('#group-context-menu').hidden=true;if(restore&&menuTrigger?.isConnected)menuTrigger.focus();}
function openGroupMenu(id,x,y,trigger){
  if(!groupById(id))return;if(groupById(id).shared&&!groupById(id).owner){notify('그룹장만 그룹을 관리할 수 있어요.');return;}menuGroup=id;menuTrigger=trigger;
  const menu=$('#group-context-menu');menu.hidden=false;
  menu.style.left=`${Math.max(8,Math.min(x,window.innerWidth-menu.offsetWidth-8))}px`;
  menu.style.top=`${Math.max(8,Math.min(y,window.innerHeight-menu.offsetHeight-8))}px`;
  $('#context-edit').focus();
}
for(const selector of ['#groups','#group-list']){
  const container=$(selector);
  container.addEventListener('contextmenu',e=>{const card=e.target.closest('.group-card-wrapper');if(!card)return;e.preventDefault();const trigger=card.querySelector('[data-group-more]');openGroupMenu(trigger.dataset.groupMore,e.clientX,e.clientY,trigger);});
  container.addEventListener('click',e=>{const b=e.target.closest('[data-group-more]');if(!b)return;e.preventDefault();e.stopPropagation();const r=b.getBoundingClientRect();openGroupMenu(b.dataset.groupMore,r.left,r.bottom,b);},true);
  container.addEventListener('keydown',e=>{if(e.key!=='ContextMenu'&&!(e.shiftKey&&e.key==='F10'))return;const card=e.target.closest('.group-card-wrapper');if(!card)return;e.preventDefault();const b=card.querySelector('[data-group-more]'),r=b.getBoundingClientRect();openGroupMenu(b.dataset.groupMore,r.left,r.bottom,b);});
}
$('#context-edit').addEventListener('click',()=>{closeGroupMenu();openGroupEditor(menuGroup);});
$('#context-delete').addEventListener('click',()=>{const g=groupById(menuGroup);if(!g)return;deletingGroup=g.id;closeGroupMenu();const count=events.filter(e=>e.type==='group'&&e.group===g.id).length;$('#delete-group-message').textContent=`‘${g.name}’ 그룹과 소속 일정 ${count}개, 초대 대상 목록이 함께 삭제돼요.`;$('#delete-group-dialog').showModal();});
function deleteGroupRecord(id){if(!groupById(id))return;userGroups=userGroups.filter(g=>g.id!==id);events=events.filter(e=>e.type!=='group'||e.group!==id);}
$('#confirm-delete-group').addEventListener('click',async e=>{
 const group=groupById(deletingGroup);
 if(group?.shared){const button=e.currentTarget;if(button.disabled)return;button.disabled=true;
  try{await waitForPrivateSave();await window.moaSharing.call('delete',{group_id:group.id,version:group.version});location.reload();}
  catch(error){notify(error.message);}finally{button.disabled=false;}return;
 }
 deleteGroupRecord(deletingGroup);save();$('#delete-group-dialog').close();if(activeGroup===deletingGroup)setView('group');else setView(filter,activeGroup,groupHub);
});
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#group-context-menu'))closeGroupMenu();});
document.addEventListener('keydown',e=>{if($('#group-context-menu').hidden)return;const buttons=[$('#context-edit'),$('#context-delete')];if(e.key==='Escape'){e.preventDefault();closeGroupMenu(true);}if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const i=buttons.indexOf(document.activeElement);buttons[e.key==='Home'?0:e.key==='End'?1:(i+1)%2].focus();}if(e.key==='Tab')closeGroupMenu();});
window.addEventListener('resize',()=>closeGroupMenu());
window.addEventListener('scroll',()=>closeGroupMenu(),true);

function eventEnd(e){return e.endDate||e.date;}
function occursOn(e,date){return e.date<=date&&eventEnd(e)>=date;}
function eventRange(e){return `${e.date}${e.allDay?'':` ${e.time}`} ~ ${eventEnd(e)}${e.allDay?' · 종일':` ${e.endTime||e.time}`}`;}
function validateEventRange(e){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||!/^\d{4}-\d{2}-\d{2}$/.test(e.endDate)||dateKey(parseDate(e.date))!==e.date||dateKey(parseDate(e.endDate))!==e.endDate)return '시작일과 종료일을 확인해 주세요.';
  if(e.endDate<e.date)return '종료일은 시작일보다 빠를 수 없어요.';
  if(!e.allDay&&(!/^\d{2}:\d{2}$/.test(e.time)||!/^\d{2}:\d{2}$/.test(e.endTime)))return '시작 시간과 종료 시간을 입력해 주세요.';
  if(!e.allDay&&e.date===e.endDate&&e.endTime<e.time)return '종료 시간은 시작 시간보다 빠를 수 없어요.';
  return '';
}
function syncEventTimes(){const f=$('#event-form').elements;$('#event-times').hidden=f.allDay.checked;f.time.disabled=f.endTime.disabled=f.allDay.checked;}
$('#event-form').elements.allDay.addEventListener('change',syncEventTimes);
$('#event-form').elements.date.addEventListener('change',e=>{const end=$('#event-form').elements.endDate;if(!end.value||end.value<e.target.value)end.value=e.target.value;});
function weekSegments(dates,matching){
  const lanes=[];
  return matching.filter(e=>eventEnd(e)>e.date&&e.date<=dates[6]&&eventEnd(e)>=dates[0]).sort((a,b)=>a.date.localeCompare(b.date)||eventEnd(b).localeCompare(eventEnd(a))||a.id.localeCompare(b.id)).map(e=>{
    const start=Math.max(0,dates.findIndex(d=>d>=e.date));let end=dates.findLastIndex(d=>d<=eventEnd(e));
    let lane=lanes.findIndex(last=>last<start);if(lane<0)lane=lanes.length;lanes[lane]=end;
    return {event:e,start,end,lane};
  });
}
function renderCalendarWeeks(first,cells,matching){
  return renderMobileMonth(first,cells,matching);
}

window.applySharedGroups(window.moaSharing.groups);

function renderMobileMonth(first,cells,matching){
  const capacity=window.moaMobileSlots ?? 3;
  const compact=!!window.moaCompactCalendar;
  const laneHeight=compact?6:20;
  const weeks=Array.from({length:cells/7},(_,week)=>{
    const dates=Array.from({length:7},(_,i)=>{const d=new Date(first);d.setDate(d.getDate()+week*7+i);return dateKey(d);});
    return {dates,segments:weekSegments(dates,matching)};
  });
  // One shared lane count keeps every date cell the same height.
  const limit=compact?Math.max(0,...weeks.flatMap(({dates,segments})=>dates.map((k,i)=>{
    const occupied=segments.filter(s=>s.start<=i&&s.end>=i);
    const spanLanes=Math.max(0,...occupied.map(s=>s.lane+1));
    const singles=matching.filter(e=>e.date===k&&eventEnd(e)===k).length;
    return Math.max(spanLanes,occupied.length+singles);
  }))):capacity;
  let html='';
  for(const {dates,segments} of weeks){
    const shown=segments.filter(s=>s.lane<limit);
    html+=`<div class="mobile-calendar-week" style="${compact?`min-height:${24+limit*laneHeight}px;`:''}grid-template-rows:minmax(24px,${compact?24:28}px) ${limit?`repeat(${limit},${laneHeight}px) `:''}${compact?'':'16px '}minmax(0,1fr)">`;
    for(let i=0;i<7;i++){
      const k=dates[i],date=parseDate(k),daily=matching.filter(e=>occursOn(e,k));
      const occupied=new Set(shown.filter(s=>s.start<=i&&s.end>=i).map(s=>s.lane));
      const singles=daily.filter(e=>eventEnd(e)===e.date).sort((a,b)=>Number(b.allDay)-Number(a.allDay)||a.time.localeCompare(b.time));
      const free=Array.from({length:limit},(_,lane)=>lane).filter(lane=>!occupied.has(lane));
      const visible=singles.slice(0,free.length),hidden=daily.length-occupied.size-visible.length;
      html+=`<button class="day mobile-day ${i===0?'is-sunday':i===6?'is-saturday':''} ${hidden?'has-overflow':''} ${date.getMonth()!==month.getMonth()?'other':''} ${k===selected?'selected':''} ${k===key?'is-today':''}" style="grid-column:${i+1};grid-row:1 / -1" data-date="${k}" aria-pressed="${k===selected}" aria-label="${k}, 일정 ${daily.length}개"><span class="day-number">${date.getDate()}</span></button>${hidden?`<span class="more-events day-overflow" style="grid-column:${i+1};grid-row:${limit+2}" aria-hidden="true">+${hidden}개</span>`:''}`;
      html+=visible.map((e,n)=>`<button type="button" class="event-chip ${e.type} single-event-button" data-span-event="${escapeHTML(e.id)}" style="grid-column:${i+1};grid-row:${free[n]+2};${e.type==='group'?groupColorStyle(groupById(e.group)):''}" aria-label="${escapeHTML(e.title+' · '+eventRange(e))}">${escapeHTML(e.title)}</button>`).join('');
    }
    html+=shown.map(({event:e,start,end,lane})=>`<button class="span-event ${e.type} ${e.date<dates[0]?'continues-before':''} ${eventEnd(e)>dates[6]?'continues-after':''}" data-span-event="${escapeHTML(e.id)}" style="grid-column:${start+1} / ${end+2};grid-row:${lane+2};${e.type==='group'?groupColorStyle(groupById(e.group)):''}" title="${escapeHTML(e.title+' · '+eventRange(e))}" aria-label="${escapeHTML(e.title+' · '+eventRange(e))}">${escapeHTML(e.title)}</button>`).join('');
    html+='</div>';
  }
  return html;
}
function openDaySheet(){
  const sheet=document.querySelector('#mobile-day-sheet');
  sheet.querySelector('h2').textContent=$('#selected-date').textContent;
  sheet.querySelector('.day-sheet-list').innerHTML=$('#agenda').innerHTML;
  sheet.showModal();
}
window.renderMoaCalendar=render;

$('#mobile-day-sheet').addEventListener('click',e=>{
 const item=e.target.closest('[data-event]');if(item){$('#mobile-day-sheet').close();openEvent(item.dataset.event);}
});
$('#day-sheet-add').addEventListener('click',()=>{$('#mobile-day-sheet').close();openEvent();});

window.moaPersonalData={
 read:()=>({habits,timetable,checks,events}),
 update:patch=>{
  if(patch.habits)habits=patch.habits;
  if(patch.timetable)timetable=patch.timetable;
  if(patch.checks)checks=patch.checks;
  save();render();
 },
 openHobbyEvent:id=>{
  openEvent(id||null);
  if(!id){$('#event-form').elements.type.value='hobby';$('#group-field').hidden=true;syncVisibility();}
 }
};

window.moaQuickAddEvent=async title=>{
 title=String(title||'').trim();if(!title)return false;
 const target=filter==='group'&&!groupHub?groupById(activeGroup):null;
 if(filter==='group'&&!target){notify('일정을 추가할 그룹을 선택해주세요.');return false;}
 const item={id:'event-'+crypto.randomUUID(),title:title.slice(0,60),date:selected,endDate:selected,time:'00:00',endTime:'00:00',allDay:true,type:target?'group':'personal',visibility:'private',note:'',group:target?.id||''};
 if(target?.shared){
  try{await window.moaSharing.mutate('event_save',{group_id:target.id,version:target.version,event:item});animateSavedEvent(item);return true;}
  catch(error){notify(error.message);return false;}
 }
 events.push(item);
 month=new Date(parseDate(selected).getFullYear(),parseDate(selected).getMonth(),1);
 if(!target&&filter!=='all'&&filter!=='personal'){filter='all';activeGroup='';}
 save();setView(filter,activeGroup,false);animateSavedEvent(item);return true;
};

document.querySelector('#cancel-event').addEventListener('click',()=>document.querySelector('#event-dialog').close());
