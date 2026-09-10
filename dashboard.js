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
// Normalize older name-based group references.
events=events.map(e=>e.type==='group'?{...e,group:userGroups.find(g=>g.id===e.group||g.name===e.group)?.id||e.group}:e);
events=events.map(e=>({...e,endDate:e.endDate&&e.endDate>=e.date?e.endDate:e.date,allDay:!!e.allDay}));
function save(){
  const sharedIds = new Set(userGroups.filter(g=>g.shared).map(g=>g.id));
  window.moaCalendarStore.save({events:events.filter(e=>!sharedIds.has(e.group)),checks,groups:userGroups.filter(g=>!g.shared)});
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
function visibleEvents(){return events.filter(e=>(filter==='all'||e.type===filter)&&(!activeGroup||e.group===activeGroup));}
function weekKeys(){const start=new Date(today);start.setDate(start.getDate()-((start.getDay()+6)%7));return Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);return dateKey(d);});}
function render(){
  renderGroups();
  const matching=visibleEvents();
  $('#month-title').textContent=`${month.getFullYear()}.${String(month.getMonth()+1).padStart(2,'0')}`;
  const first=new Date(month.getFullYear(),month.getMonth(),1);first.setDate(first.getDate()-first.getDay());
  const cells=Math.ceil((new Date(month.getFullYear(),month.getMonth(),1).getDay()+new Date(month.getFullYear(),month.getMonth()+1,0).getDate())/7)*7;
  $('#calendar').innerHTML=renderCalendarWeeks(first,cells,matching);
  $('#month-count').textContent=`이번 달 ${matching.filter(e=>e.date<=dateKey(new Date(month.getFullYear(),month.getMonth()+1,0))&&eventEnd(e)>=dateKey(month)).length}개의 일정`;
  const daily=matching.filter(e=>occursOn(e,selected)).sort((a,b)=>a.time.localeCompare(b.time));
  $('#agenda-title').textContent=selected===key?'오늘의 일정':'선택한 날의 일정';
  $('#selected-date').textContent=parseDate(selected).toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'long'});
  $('#agenda-count').textContent=daily.length;
  $('#agenda').innerHTML=daily.length?daily.map(e=>`<button class="agenda-item" data-event="${escapeHTML(e.id)}"><span class="agenda-time">${e.allDay?'종일':e.date===selected?e.time:eventEnd(e)===selected?(e.endTime||'종료'):'계속'}</span><span class="agenda-detail ${e.type}" ${e.type==='group'?`style="${groupColorStyle(groupById(e.group))}"`:""}><strong>${escapeHTML(e.title)}</strong>${eventEnd(e)>e.date?`<small>${escapeHTML(eventRange(e))}</small>`:""}<small>${escapeHTML(e.type==='group'?groupLabel(e.group):labels[e.type])}${e.note?` · ${escapeHTML(e.note)}`:''}</small></span></button>`).join(''):'<p class="empty">아직 정해진 일정이 없어요.<br>나를 위한 시간을 모아볼까요?</p>';
  const completed=['reading','walking'].reduce((n,id)=>n+weekKeys().filter(k=>checks[`${id}:${k}`]).length,0);
  $('#summary').innerHTML=[['□','오늘의 일정',events.filter(e=>occursOn(e,key)).length,'개의 약속'],['♧','함께하는 그룹',userGroups.length,'개의 모임'],['❀','이번 주 취미 기록',completed,'번의 작은 실천']].map(s=>`<div class="summary-item"><span class="summary-icon" aria-hidden="true">${s[0]}</span><div><p>${s[1]}</p><strong>${s[2]}<small>${s[3]}</small></strong></div></div>`).join('');
  $('#hobbies').innerHTML=[['reading','책과 가까워지기',3],['walking','가볍게 산책하기',4]].map(([id,title,target])=>{const count=weekKeys().filter(k=>checks[`${id}:${k}`]).length,done=!!checks[`${id}:${key}`];return `<div class="hobby-row"><div class="hobby-info"><strong>${title}</strong><span>${count} / ${target}회</span><button data-habit="${id}" aria-pressed="${done}">${done?'✓ 오늘 완료':'＋ 기록'}</button></div><div class="progress" role="progressbar" aria-label="${title}" aria-valuemin="0" aria-valuemax="${target}" aria-valuenow="${Math.min(count,target)}"><i style="width:${Math.min(100,count/target*100)}%"></i></div></div>`;}).join('');
  $('#groups').innerHTML=userGroups.map(g=>groupCard(g,true)).join('');
  window.refreshMemories?.();
  document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('active',b.dataset.filter===filter);b.setAttribute('aria-pressed',String(b.dataset.filter===filter));});
}
function setView(view,group='',showHub=view==='group'&&!group){
  filter=view;activeGroup=group;
  groupHub=showHub;
  $('#group-hub').hidden=!groupHub;
  $('.content-grid').hidden=groupHub;
  $('#summary').hidden=groupHub||!!group;
  $('.groups-section').hidden=groupHub||!!group;
  $('#add-event').hidden=groupHub;
  $('#group-detail-bar').hidden=!group;
  $('.calendar-filters').hidden=!!group;
  $('.hobby-panel').hidden=!!group;
  $('#group-detail-description').textContent=groupById(group)?.description||'';
  const names={all:'모아보기',personal:'개인 캘린더',group:'그룹 캘린더',hobby:'취미 관리'};
  const titles={all:'오늘도, 나다운 하루를 모아.',personal:'나만의 속도로 채우는 하루.',group:'함께라서 더 좋은 하루.',hobby:'좋아하는 일에, 조금 더 가까이.'};
  $('#breadcrumb').textContent=group?`그룹 캘린더 / ${groupLabel(group)}`:names[view];$('#page-title').textContent=group?groupLabel(group):titles[view];
  $('#page-description').textContent=group?'우리의 다음 약속을 달력에서 확인해요.':{all:'소중한 약속과 나를 위한 시간, 한곳에서 가볍게 정리해요.',personal:'작은 할 일부터 중요한 약속까지, 나의 시간을 정리해요.',group:'함께하는 약속을 모아 두고, 다음 만남을 준비해요.',hobby:'좋아하는 일을 계획하고, 오늘의 작은 실천을 기록해요.'}[view];
  document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-current',b.dataset.view===view?'page':'false');});render();
}
function openEvent(id=null){
  editing=id;const form=$('#event-form');form.reset();const event=events.find(e=>e.id===id);
  $('#event-error').hidden=true;form.elements.endDate.value=event?eventEnd(event):selected;form.elements.endTime.value=event?.endTime||event?.time||'10:00';form.elements.allDay.checked=!!event?.allDay;syncEventTimes();
  $('#dialog-title').textContent=event?'일정 수정':'새 일정';$('#delete-event').hidden=!event;
  form.elements.date.value=event?.date||selected;form.elements.time.value=event?.time||'09:00';form.elements.type.value=event?.type||(filter==='all'?'personal':filter);
  form.elements.group.innerHTML=userGroups.map(g=>`<option value="${escapeHTML(g.id)}">${escapeHTML(g.name)}</option>`).join('');
  form.elements.title.value=event?.title||'';form.elements.note.value=event?.note||'';form.elements.group.value=event?.group||activeGroup||userGroups[0]?.id||'';
  $('#event-memory').hidden=!event||event.type!=='group';$('#event-memory').dataset.event=id||'';
  $('#group-field').hidden=form.elements.type.value!=='group';$('#event-dialog').showModal();
}
$('#calendar').addEventListener('click',e=>{const eventButton=e.target.closest('[data-span-event]');if(eventButton){openEvent(eventButton.dataset.spanEvent);return;}const b=e.target.closest('[data-date]');if(b){selected=b.dataset.date;month=new Date(parseDate(selected).getFullYear(),parseDate(selected).getMonth(),1);render();}});
$('#agenda').addEventListener('click',e=>{const b=e.target.closest('[data-event]');if(b)openEvent(b.dataset.event);});
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.filter,'',false)));
$('#groups').addEventListener('click',e=>{const b=e.target.closest('[data-group]');if(b){setView('group',b.dataset.group);$('.calendar-panel').scrollIntoView({block:'start'});}});
$('#hobbies').addEventListener('click',e=>{const b=e.target.closest('[data-habit]');if(b){const k=`${b.dataset.habit}:${key}`;checks[k]=!checks[k];const saved=save();render();if(saved)notify(checks[k]?'오늘의 작은 실천을 기록했어요.':'오늘 기록을 취소했어요.');}});
$('#prev-month').addEventListener('click',()=>{month.setMonth(month.getMonth()-1);render();});
$('#next-month').addEventListener('click',()=>{month.setMonth(month.getMonth()+1);render();});
$('#today').addEventListener('click',()=>{month=new Date(today.getFullYear(),today.getMonth(),1);selected=key;render();});
$('#add-event').addEventListener('click',()=>openEvent());$('#add-selected').addEventListener('click',()=>openEvent());
$('#close-dialog').addEventListener('click',()=>$('#event-dialog').close());
$('#event-form').elements.type.addEventListener('change',e=>$('#group-field').hidden=e.target.value!=='group');
$('#event-form').addEventListener('submit',async e=>{
  e.preventDefault();const f=e.currentTarget.elements;
  if(!f.title.value.trim()){f.title.setCustomValidity('일정 이름을 입력해 주세요.');f.title.reportValidity();return;}
  if(f.type.value==='group'&&!groupById(f.group.value)){notify('먼저 그룹을 만들어 주세요.');return;}
  const range={date:f.date.value,endDate:f.endDate.value,time:f.time.value,endTime:f.endTime.value,allDay:f.allDay.checked};
  const error=validateEventRange(range);if(error){showFormError('#event-error',error);return;}
  const item={...range,id:editing||`event-${Date.now()}-${Math.random().toString(36).slice(2)}`,title:f.title.value.trim(),date:f.date.value,time:f.allDay.checked?'00:00':f.time.value,type:f.type.value,note:f.note.value.trim(),group:f.type.value==='group'?f.group.value:''};
  const old=events.find(e=>e.id===editing), target=groupById(item.group), previous=groupById(old?.group);
  if(old&&(previous?.shared||target?.shared)&&(old.group!==item.group||old.type!==item.type)){
    showFormError('#event-error','공유 일정은 다른 캘린더로 이동할 수 없어요. 새 일정으로 추가해주세요.');return;
  }
  if(target?.shared){
    const button=e.currentTarget.querySelector('[type="submit"]');if(button.disabled)return;button.disabled=true;
    try{await window.moaSharing.mutate('event_save',{group_id:target.id,version:target.version,event:item});$('#event-dialog').close();notify('그룹 일정을 저장했어요.');}
    catch(error){showFormError('#event-error',error.message);}
    finally{button.disabled=false;}return;
  }
  if(editing)events=events.map(e=>e.id===editing?item:e);else events.push(item);
  selected=item.date;month=new Date(parseDate(selected).getFullYear(),parseDate(selected).getMonth(),1);
  if((filter!=='all'&&filter!==item.type)||(activeGroup&&activeGroup!==item.group)){filter='all';activeGroup='';}
  const saved=save();setView(filter,activeGroup,false);$('#event-dialog').close();if(saved)notify('일정을 저장했어요.');
});
$('#event-form').elements.title.addEventListener('input',e=>e.target.setCustomValidity(''));
$('#delete-event').addEventListener('click',async e=>{
  const event=events.find(x=>x.id===editing),group=groupById(event?.group);
  if(group?.shared){
    if(e.currentTarget.disabled)return;const button=e.currentTarget;button.disabled=true;
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
  $('#edit-group-color').disabled=!!(groupById(activeGroup)?.shared&&!groupById(activeGroup)?.owner);
  if(activeGroup)$('#edit-group-color').value=groupPalette[groupById(activeGroup)?.color]||groupById(activeGroup)?.color||'#81945f';
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
      const recipients=parseInvites(f.emails.value);
      const g=createGroupRecord(f.groupName.value,f.description.value,color,f.emails.value,editingGroup);
      editingGroup=g.id;save();
      if(recipients.length)await inviteToGroup(g.id,recipients);
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
$('#edit-group-color').addEventListener('change',async e=>{
 const group=groupById(activeGroup);if(!group||!validGroupColor(e.target.value))return;
 if(group.shared){try{await window.moaSharing.mutate('update',{group_id:group.id,version:group.version,info:{name:group.name,description:group.description,color:e.target.value}});}catch(error){notify(error.message);}return;}
 group.color=e.target.value;save();render();
});

function openGroupEditor(id=null){
  editingGroup=id;const form=$('#group-form');form.reset();$('#group-error').hidden=true;
  const g=groupById(id);$('#group-dialog-title').textContent=g?'그룹 수정':'우리의 새로운 공간';
  $('#save-group').textContent=g?'변경 사항 저장':'그룹 만들기 →';$('#creation-invites').hidden=!!g;
  if(g){form.elements.groupName.value=g.name;form.elements.description.value=g.description;form.elements.color.value=Object.hasOwn(groupPalette,g.color)?g.color:'custom';form.elements.customColor.value=groupPalette[g.color]||g.color;}
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
  let html='';
  for(let offset=0;offset<cells;offset+=7){
    const dates=Array.from({length:7},(_,i)=>{const d=new Date(first);d.setDate(d.getDate()+offset+i);return dateKey(d);});
    const segments=weekSegments(dates,matching),lanes=segments.reduce((n,s)=>Math.max(n,s.lane+1),0);
    html+=`<div class="calendar-week" style="--lanes:${lanes};grid-template-rows:32px ${lanes?`repeat(${lanes},26px) `:''}minmax(80px,auto)">`;
    html+=dates.map((k,i)=>{const d=parseDate(k),daily=matching.filter(e=>occursOn(e,k)),singles=daily.filter(e=>eventEnd(e)===e.date).sort((a,b)=>Number(b.allDay)-Number(a.allDay)||a.time.localeCompare(b.time));return `<button class="day ${d.getMonth()!==month.getMonth()?'other':''} ${k===selected?'selected':''} ${k===key?'is-today':''}" style="grid-column:${i+1};grid-row:1 / span ${lanes+2}" data-date="${k}" aria-pressed="${k===selected}" aria-label="${k}, 일정 ${daily.length}개"><span class="day-number">${d.getDate()}</span>${singles.slice(0,2).map(e=>`<span class="event-chip ${e.type}" ${e.type==='group'?`style="${groupColorStyle(groupById(e.group))}"`:''}>${e.type==='group'?`<span class="chip-group-name">${escapeHTML(groupLabel(e.group))}</span>`:''}${escapeHTML(e.title)}</span>`).join('')}${singles.length>2?`<span class="more-events">+${singles.length-2}개</span>`:''}</button>`;}).join('');
    html+=segments.map(({event:e,start,end,lane})=>`<button class="span-event ${e.type} ${e.date<dates[0]?'continues-before':''} ${eventEnd(e)>dates[6]?'continues-after':''}" data-span-event="${escapeHTML(e.id)}" style="grid-column:${start+1} / ${end+2};grid-row:${lane+2};${e.type==='group'?groupColorStyle(groupById(e.group)):''}" title="${escapeHTML(eventRange(e))}" aria-label="${escapeHTML(e.title+' · '+eventRange(e))}">${e.date<dates[0]?'‹ ':''}${e.type==='group'?escapeHTML(groupLabel(e.group))+' · ':''}${escapeHTML(e.title)}${eventEnd(e)>dates[6]?' ›':''}</button>`).join('');
    html+='</div>';
  }
  return html;
}



window.applySharedGroups(window.moaSharing.groups);
