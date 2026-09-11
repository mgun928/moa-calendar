import {layoutEntries,clock,weekdays,validateEntry} from './personal-model.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function setupFriendViewer(root,client,getId,changeMonth){
 const dialog=root.querySelector('#friend-profile'),calendar=root.querySelector('#friend-calendar');
 const tabs=document.createElement('div');tabs.className='friend-view-tabs';
 tabs.innerHTML='<button type="button" data-page="calendar">캘린더</button><button type="button" data-page="timetable">시간표</button>';
 dialog.querySelector('.friend-month').before(tabs);
 const table=document.createElement('div');table.className='friend-table';dialog.append(table);
 let version=0,gesture=null,ignoreClick=0,transitioning=false,tableSnapshot=null;
 let closing=false;
 async function closeProfile(){
  if(closing||!dialog.open)return;
  closing=true;let animation;
  try{
   if(dialog.animate&&!reduced()){
    animation=dialog.animate([{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(16px)'}],{duration:180,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'});
    await animation.finished.catch(()=>{});
   }
   dialog.close();
  }finally{animation?.cancel();closing=false;}
 }
 dialog.addEventListener('cancel',event=>{event.preventDefault();void closeProfile();});
 const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 async function motion(element,from,to){
  if(!element.animate||reduced())return;
  await element.animate([from,to],{duration:160,easing:'cubic-bezier(.22,.7,.25,1)'}).finished.catch(()=>{});
 }
 function page(value){dialog.dataset.page=value;tabs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.page===value)));}
 async function switchPage(value){
  if(transitioning||dialog.dataset.page===value)return;
  transitioning=true;
  const forward=value==='timetable',old=forward?calendar:table,next=forward?table:calendar,sign=forward?-1:1;
  try{
   await motion(old,{opacity:1,transform:'translateX(0)'},{opacity:0,transform:`translateX(${sign*36}px)`});
   if(!dialog.open)return;
   page(value);
   await motion(next,{opacity:0,transform:`translateX(${-sign*36}px)`},{opacity:1,transform:'translateX(0)'});
  }finally{transitioning=false;}
 }
 tabs.addEventListener('click',e=>{if(e.target.dataset.page)void switchPage(e.target.dataset.page);});
 dialog.addEventListener('pointerdown',e=>{
  e.stopPropagation();
  if(!e.isPrimary||e.button!==0||transitioning)return;
  const onCalendar=calendar.contains(e.target),onTable=table.contains(e.target);
  if(!onCalendar&&!onTable)return;
  const bounds=dialog.getBoundingClientRect();
  gesture={id:e.pointerId,x:e.clientX,y:e.clientY,axis:null,kind:onCalendar?(e.clientX>=bounds.right-48?'page':'month'):'back'};
 });
 dialog.addEventListener('pointermove',e=>{
  e.stopPropagation();if(!gesture||gesture.id!==e.pointerId)return;
  const x=e.clientX-gesture.x,y=e.clientY-gesture.y;
  if(!gesture.axis&&Math.max(Math.abs(x),Math.abs(y))>10){gesture.axis=Math.abs(x)>Math.abs(y)*1.4?'x':'y';if(gesture.axis==='x')dialog.setPointerCapture(e.pointerId);}
 });
 dialog.addEventListener('pointerup',async e=>{
  e.stopPropagation();if(!gesture||gesture.id!==e.pointerId)return;
  const g=gesture,dx=e.clientX-g.x;gesture=null;
  if(g.axis!=='x')return;
  ignoreClick=Date.now()+400;
  if(Math.abs(dx)<48)return;
  if(g.kind==='page'){if(dx<0)void switchPage('timetable');return;}
  if(g.kind==='back'){if(dx>0)void switchPage('calendar');return;}
  if(!changeMonth||transitioning)return;
  await changeMonth(dx<0?1:-1);
 });
 dialog.addEventListener('pointercancel',()=>{gesture=null;});
 dialog.addEventListener('click',e=>{if(Date.now()<ignoreClick){e.preventDefault();e.stopImmediatePropagation();}},true);
 dialog.addEventListener('close',()=>{version++;tableSnapshot=null;table.replaceChildren();});
 return {
  isTransitioning(){return transitioning;},
  async animateMonth(commit,direction){
   if(transitioning)return;
   transitioning=true;
   const sign=direction>0?-1:1;
   try{
    await motion(calendar,{opacity:1,transform:'translateX(0)'},{opacity:0,transform:`translateX(${sign*28}px)`});
    if(!dialog.open)return;
    commit();
    await motion(calendar,{opacity:0,transform:`translateX(${-sign*28}px)`},{opacity:1,transform:'translateX(0)'});
   }finally{transitioning=false;}
  },
  open(){page('calendar');if(!dialog.open){dialog.showModal();void motion(dialog,{opacity:0,transform:'translateY(20px)'},{opacity:1,transform:'translateY(0)'});}},
  close:closeProfile,
  clear(){version++;tableSnapshot=null;table.replaceChildren();},
  async refresh(){
   if(!dialog.open)return;const request=++version,id=getId();
   const {data,error}=await client.rpc('moa_friend_timetable',{target:id});
   if(request!==version||!dialog.open||getId()!==id)return;
   if(error){tableSnapshot=null;table.textContent=error.code==='PGRST202'?'시간표 공유 DB 설정이 아직 적용되지 않았어요.':'시간표를 불러오지 못했어요.';return;}
   const snapshot=JSON.stringify(data);if(snapshot===tableSnapshot)return;tableSnapshot=snapshot;
   if(!data?.shared){table.textContent='친구가 시간표를 공개하지 않았어요.';return;}
   const entries=(data.entries||[]).filter(e=>typeof e.title==='string'&&!validateEntry(e));
   if(!entries.length){table.textContent='공개된 시간표에 등록된 일정이 없어요.';return;}
   const start=Math.floor(Math.min(...entries.map(e=>e.start))/60)*60,end=Math.min(1440,Math.ceil(Math.max(...entries.map(e=>e.end))/60)*60),slots=(end-start)/30;
   const placed=layoutEntries(entries);
   table.innerHTML='<div class="tt-grid" style="--tt-days:7"><div class="tt-corner"></div>'+weekdays.map(d=>'<div class="tt-day-heading">'+d+'</div>').join('')+'<div class="tt-axis">'+Array.from({length:slots},(_,i)=>'<div>'+(i%2?'':clock(start+i*30))+'</div>').join('')+'</div>'+weekdays.map((d,day)=>'<div class="tt-day-column">'+Array.from({length:slots},()=>'<div class="tt-slot"></div>').join('')+placed.filter(e=>e.day===day).map(e=>`<button type="button" class="tt-block" style="top:${e.start-start}px;height:${e.end-e.start}px;left:${e.column/e.columns*100}%;width:${100/e.columns}%;--block-color:${esc(e.color)}" data-detail="${esc(e.title+' · '+d+' '+clock(e.start)+'–'+clock(e.end)+(e.place?' · '+e.place:''))}"><strong>${esc(e.title)}</strong><small>${clock(e.start)}–${clock(e.end)}</small></button>`).join('')+'</div>').join('')+'</div><p class="friend-table-detail" aria-live="polite"></p>';
   table.querySelectorAll('[data-detail]').forEach(b=>b.addEventListener('click',()=>{table.querySelector('.friend-table-detail').textContent=b.dataset.detail;}));
  }
 };
}
