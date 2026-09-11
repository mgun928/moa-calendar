import {friendEventColor} from './friend-colors.js';
import {setupFriendViewer} from './friend-viewer.js';
export function setupFriends(client,userId){
 const root=document.createElement('section');root.id='friends-section';root.hidden=true;
 root.innerHTML=`<h1>친구</h1><p class="friend-intro">친구와 공개한 일정만 함께 확인해요.</p>
 <div class="friend-mobile-toolbar"><label class="friend-name-search"><span aria-hidden="true">⌕</span><input id="friend-name-filter" type="search" placeholder="이름으로 친구를 검색하세요" aria-label="친구 이름 검색"></label><button type="button" id="friend-add-toggle" aria-label="친구 추가" aria-expanded="false" aria-controls="friend-add-panel"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="7" r="4"/><path d="M2 21v-2a7 7 0 0 1 14 0v2M19 8v8M15 12h8"/></svg></button></div>
 <div id="friend-add-panel"><h2 class="friend-mobile-only">친구 코드로 추가</h2><label>내 친구 코드<input id="friend-own-id" readonly placeholder="친구 추가를 열면 표시돼요"></label><button type="button" class="outline" id="friend-code-copy">코드 복사</button><p id="friend-code-status" role="status"></p>
 <form id="friend-search"><label>친구 코드<input name="id" required autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="8자리 친구 코드"></label><button class="primary">검색</button></form><div id="friend-result"></div></div>
 <p id="friend-status" role="status"></p>
 <div class="friend-request-group"><h2>받은 요청</h2><div id="friend-incoming"></div></div><div class="friend-request-group"><h2>보낸 요청</h2><div id="friend-outgoing"></div></div>
 <div class="friend-list-group"><h2>친구 목록</h2><div id="friend-list"></div></div>
 <dialog id="friend-profile"><button type="button" class="outline friend-mobile-only" id="friend-back">← 친구 목록</button><div class="friend-profile-heading"><h2 id="friend-name"></h2><button type="button" class="outline" id="friend-profile-remove" data-friend-action="remove">친구 삭제</button></div><p>친구에게 공개한 일정 · 읽기 전용</p><div class="friend-month"><button type="button" data-month="-1" aria-label="친구 이전 달">‹</button><h2 id="friend-month-title"></h2><button type="button" data-month="1" aria-label="친구 다음 달">›</button></div><div id="friend-calendar"></div></dialog><dialog id="friend-day-dialog" aria-label="친구 날짜별 일정"><header class="section-heading"><h2 id="friend-day-title"></h2><button type="button" id="friend-day-close" class="icon-button" aria-label="일정 목록 닫기">×</button></header><div id="friend-day" aria-live="polite"></div></dialog>`;
 document.querySelector('.page-footer').before(root);
 const $=s=>root.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const viewer=setupFriendViewer(root,client,()=>selected);
 let ownCode='';
 async function loadOwnCode(){
  if(ownCode)return;
  const {data,error}=await client.rpc('moa_friend_code',{action:'own'});
  if(error){$('#friend-code-status').textContent='친구 코드 DB 설정을 적용한 뒤 다시 열어주세요.';return;}
  ownCode=data?.code||'';$('#friend-own-id').value=ownCode;$('#friend-code-status').textContent='';
 }
 $('#friend-code-copy').addEventListener('click',async()=>{
  if(!ownCode){await loadOwnCode();if(!ownCode)return;}
  try{await navigator.clipboard.writeText(ownCode);$('#friend-code-status').textContent='복사했어요.';}catch{$('#friend-code-status').textContent='코드를 길게 누르거나 선택해서 복사해주세요.';}
 });
 let cachedPeople=[],nameQuery='',detailDate=null;
 for(const type of ['pointerdown','pointermove','pointerup'])$('#friend-day-dialog').addEventListener(type,e=>e.stopPropagation());
 $('#friend-day-close').addEventListener('click',()=>$('#friend-day-dialog').close());
 $('#friend-day-dialog').addEventListener('click',e=>{if(e.target===$('#friend-day-dialog'))$('#friend-day-dialog').close();});
 let selected=null,month=new Date(new Date().getFullYear(),new Date().getMonth(),1),entries=[],generation=0,busy=false,stopped=false;
 const status=message=>$('#friend-status').textContent=message;
 async function call(action,target=null){
  const {data,error}=await client.rpc('moa_friends',{action,target,month_start:`${month.getFullYear()}-${String(month.getMonth()+1).padStart(2,'0')}-01`});
  if(error)throw new Error(error.code==='PGRST202'?'친구 기능 DB 설정이 필요해요. FRIENDS-GUIDE의 SQL을 적용해주세요.':error.message);
  return data;
 }
 function clearCalendar(){viewer.clear();entries=[];$('#friend-calendar').replaceChildren();$('#friend-day').replaceChildren();}
 function row(person,buttons){return `<div class="friend-row"><span>${esc(person.nickname)}</span><div>${buttons}</div></div>`;}
 const button=(label,action,id)=>`<button type="button" class="outline" data-friend-action="${action}" data-id="${esc(id)}">${label}</button>`;
 function eventColor(e){return friendEventColor(e,window.moaSharing?.groups||[]);}
 function renderFriends(){
  const accepted=cachedPeople.filter(p=>p.status==='accepted');
  const visible=accepted.filter(p=>String(p.nickname||'').toLocaleLowerCase().includes(nameQuery));
  $('#friend-list').innerHTML=visible.map(p=>`<div class="friend-row friend-person"><span class="friend-desktop-name">${esc(p.nickname)}</span><button type="button" class="friend-open" data-friend-action="profile" data-id="${esc(p.id)}"><span class="friend-avatar" aria-hidden="true">${esc(Array.from(p.nickname||'?')[0])}</span><span><strong>${esc(p.nickname)}</strong><small>프로필 · 공개 일정 보기</small></span></button><div>${button('프로필 · 캘린더','profile',p.id)}</div></div>`).join('')||'<p class="friend-empty">'+(accepted.length?'이름이 일치하는 친구가 없어요.':'아직 등록된 친구가 없어요. 친구 추가 버튼으로 요청을 보내보세요.')+'</p>';
 }
 $('#friend-name-filter').addEventListener('input',e=>{nameQuery=e.target.value.trim().toLocaleLowerCase();renderFriends();});
 $('#friend-add-toggle').addEventListener('click',()=>{
  const open=$('#friend-add-toggle').getAttribute('aria-expanded')!=='true';
  $('#friend-add-toggle').setAttribute('aria-expanded',String(open));$('#friend-add-panel').classList.toggle('is-open',open);
  if(open){$('#friend-search input').focus();void loadOwnCode();}
 });
 $('#friend-back').addEventListener('click',()=>{selected=null;generation++;clearCalendar();$('#friend-profile').close();$('#friend-list').scrollIntoView({block:'nearest'});});
 async function refresh(){
  if(stopped)return;
  const version=++generation;clearCalendar();viewer.clear();
  try{
   const people=await call('list');if(version!==generation)return;
   $('#friend-incoming').innerHTML=people.filter(p=>p.status==='pending'&&p.incoming).map(p=>row(p,button('수락','accept',p.id)+button('거절','decline',p.id))).join('')||'<p>받은 요청이 없어요.</p>';
   $('#friend-outgoing').innerHTML=people.filter(p=>p.status==='pending'&&!p.incoming).map(p=>row(p,button('요청 취소','remove',p.id))).join('')||'<p>보낸 요청이 없어요.</p>';
   cachedPeople=people;renderFriends();
   const person=people.find(p=>p.id===selected&&p.status==='accepted');
   if(!person&&$('#friend-profile').open)$('#friend-profile').close();
   if(person){
    $('#friend-name').textContent=person.nickname;
    $('#friend-profile-remove').dataset.id=person.id;
    const data=await call('calendar',selected);if(version!==generation)return;
    entries=data;renderCalendar();if($('#friend-day-dialog').open)renderDay();await viewer.refresh();
   }else selected=null;
   status('');
  }catch(error){if(version===generation){clearCalendar();status(error.message);}}
 }
 function renderCalendar(){
  const y=month.getFullYear(),m=month.getMonth(),prefix=`${y}-${String(m+1).padStart(2,'0')}-`;
  $('#friend-month-title').textContent=`${y}.${String(m+1).padStart(2,'0')}`;
  const start=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate(),cells=Math.ceil((start+days)/7)*7;
  $('#friend-calendar').style.setProperty('--friend-weeks',cells/7);
  const dateKey=d=>`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  let html='<div class="friend-week-labels">'+['일','월','화','수','목','금','토'].map(d=>`<span>${d}</span>`).join('')+'</div>';
  for(let week=0;week<cells/7;week++){
   const first=week*7-start+1,last=first+6,lo=dateKey(Math.max(1,first)),hi=dateKey(Math.min(days,last)),occupied=[];
   const segments=entries.filter(e=>e.date<=hi&&(e.endDate||e.date)>=lo).map(e=>({e,start:e.date<lo?Math.max(0,1-first):Number(e.date.slice(-2))-first,end:(e.endDate||e.date)>hi?Math.min(6,days-first):Number((e.endDate||e.date).slice(-2))-first})).sort((a,b)=>a.start-b.start||b.end-a.end);
   segments.forEach(s=>{let lane=occupied.findIndex(row=>row.every(t=>s.end<t.start||s.start>t.end));if(lane<0){lane=occupied.length;occupied.push([]);}occupied[lane].push(s);s.lane=lane;});
   html+='<div class="friend-calendar-week">';
   for(let col=0;col<7;col++){
    const day=first+col;if(day<1||day>days){html+='<span></span>';continue;}
    const date=dateKey(day),count=segments.filter(s=>s.start<=col&&s.end>=col).length,extra=segments.filter(s=>s.start<=col&&s.end>=col&&s.lane>=2).length;
    html+=`<button type="button" class="friend-date-cell" style="grid-column:${col+1};grid-row:1 / -1" data-friend-date="${date}" aria-label="${date}, 공개 일정 ${count}개"><span>${day}</span>${extra?`<small class="friend-extra">+${extra}개</small>`:''}</button>`;
   }
   html+=segments.filter(s=>s.lane<2).map(({e,start,end,lane})=>`<button type="button" class="friend-span ${e.type==='group'?'group':''}" data-friend-date="${dateKey(Math.max(1,first+start))}" style="grid-column:${start+1} / ${end+2};grid-row:${lane+2};${eventColor(e)}" aria-label="${esc(e.title)} · ${esc(e.date)} ~ ${esc(e.endDate||e.date)}">${esc(e.title)}</button>`).join('')+'</div>';
  }
  $('#friend-calendar').innerHTML=html;
 }
 function renderDay(){
  const key=detailDate,d=new Date(key+'T12:00:00');
  $('#friend-day-title').textContent=`${d.getMonth()+1}월 ${d.getDate()}일 ${['일','월','화','수','목','금','토'][d.getDay()]}요일`;
  const daily=entries.filter(e=>e.date<=key&&(e.endDate||e.date)>=key);
  $('#friend-day').innerHTML=daily.map(e=>`<article class="friend-day-item"><span>${e.allDay?'종일':e.date<key?'계속':esc(e.time)}</span><div class="friend-day-info ${e.type==='group'?'group':''}" style="${eventColor(e)}"><strong>${esc(e.title)}</strong><p>${esc(e.date)} ${e.allDay?'':esc(e.time)} ~ ${esc(e.endDate||e.date)} ${e.allDay?'':esc(e.endTime||'')}</p><small>${e.type==='group'?'그룹 일정':'개인 일정'}</small>${e.note?`<p>${esc(e.note)}</p>`:''}</div></article>`).join('')||'<p>이 날 공개된 일정이 없어요.</p>';
 }
 $('#friend-search').addEventListener('submit',async e=>{
  e.preventDefault();const id=e.target.elements.id.value.trim();$('#friend-result').replaceChildren();
  const shortCode=/^[a-z0-9]{8}$/i.test(id);
  if(!shortCode&&!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)){status('8자리 친구 코드를 입력해주세요.');return;}
  if(id.toLowerCase()===userId){status('자기 자신에게 요청할 수 없어요.');return;}
  try{let person;
   if(shortCode){const {data,error}=await client.rpc('moa_friend_code',{action:'search',friend_code:id.toUpperCase()});if(error)throw new Error(error.code==='PGRST202'?'친구 코드 DB 설정을 먼저 적용해주세요.':error.message);person=data;}else person=await call('search',id);
   if(person?.id===userId){status('자기 자신에게 요청할 수 없어요.');return;}
 $('#friend-result').innerHTML=person?row(person,button('친구 요청','request',person.id)):'<p>사용자를 찾지 못했어요.</p>';status('');}catch(error){status(error.message);}
 });
 root.addEventListener('click',async e=>{
  const date=e.target.closest('[data-friend-date]');
  if(date){detailDate=date.dataset.friendDate;renderDay();if(!$('#friend-day-dialog').open)$('#friend-day-dialog').showModal();return;}
  const b=e.target.closest('[data-friend-action]');if(!b||busy)return;
  if(b.dataset.friendAction==='profile'){selected=b.dataset.id;month=new Date(new Date().getFullYear(),new Date().getMonth(),1);viewer.open();await refresh();return;}
  busy=true;b.disabled=true;
  if(b.dataset.friendAction==='remove'&&b.id==='friend-profile-remove'&&!await window.moaConfirmDelete('친구를 삭제할까요? 서로의 친구 목록에서 제거됩니다.')){busy=false;b.disabled=false;return;}
  clearCalendar();
  try{await call(b.dataset.friendAction,b.dataset.id);$('#friend-result').replaceChildren();await refresh();}catch(error){status(error.message);}finally{busy=false;b.disabled=false;}
 });
 root.querySelectorAll('[data-month]').forEach(b=>b.addEventListener('click',()=>{month.setMonth(month.getMonth()+Number(b.dataset.month));void refresh();}));
 document.addEventListener('visibilitychange',()=>{if(document.hidden){generation++;clearCalendar();}else if(!root.hidden)void refresh();});
 window.addEventListener('focus',()=>{if(!root.hidden)void refresh();});
 const timer=setInterval(()=>{if(!root.hidden&&!document.hidden&&!busy)void refresh();},10000);
 return {refresh,stop(){stopped=true;generation++;clearInterval(timer);clearCalendar();}};
}

