import {layoutEntries,clock,weekdays,validateEntry} from './personal-model.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function setupFriendViewer(root,client,getId){
 const dialog=root.querySelector('#friend-profile'),calendar=root.querySelector('#friend-calendar');
 const tabs=document.createElement('div');tabs.className='friend-view-tabs';
 tabs.innerHTML='<button type="button" data-page="calendar">캘린더</button><button type="button" data-page="timetable">시간표</button>';
 dialog.querySelector('.friend-month').before(tabs);
 const table=document.createElement('div');table.className='friend-table';dialog.append(table);
 let version=0,gesture=null,ignoreClick=0;
 function page(value){dialog.dataset.page=value;tabs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.page===value)));}
 tabs.addEventListener('click',e=>{if(e.target.dataset.page)page(e.target.dataset.page);});
 // Keep profile gestures separate from the agenda/friends drawer underneath.
 dialog.addEventListener('pointerdown',e=>{e.stopPropagation();if(e.isPrimary&&e.button===0)gesture={id:e.pointerId,x:e.clientX,y:e.clientY,axis:null};});
 dialog.addEventListener('pointermove',e=>{
  e.stopPropagation();if(!gesture||gesture.id!==e.pointerId)return;
  const x=e.clientX-gesture.x,y=e.clientY-gesture.y;
  if(!gesture.axis&&Math.max(Math.abs(x),Math.abs(y))>10){gesture.axis=Math.abs(x)>Math.abs(y)*1.4?'x':'y';if(gesture.axis==='x')dialog.setPointerCapture(e.pointerId);}
 });
 dialog.addEventListener('pointerup',e=>{e.stopPropagation();if(!gesture)return;const dx=e.clientX-gesture.x;if(gesture.axis==='x'){ignoreClick=Date.now()+400;if(Math.abs(dx)>48)page(dx<0?'timetable':'calendar');}gesture=null;});
 dialog.addEventListener('pointercancel',()=>{gesture=null;});
 dialog.addEventListener('click',e=>{if(Date.now()<ignoreClick){e.preventDefault();e.stopImmediatePropagation();}},true);
 dialog.addEventListener('close',()=>{version++;table.replaceChildren();});
 return {
  open(){page('calendar');if(!dialog.open)dialog.showModal();},
  clear(){version++;table.replaceChildren();},
  async refresh(){
   if(!dialog.open)return;const request=++version,id=getId();
   const {data,error}=await client.rpc('moa_friend_timetable',{target:id});
   if(request!==version||!dialog.open||getId()!==id)return;
   if(error){table.textContent=error.code==='PGRST202'?'시간표 공유 DB 설정이 아직 적용되지 않았어요.':'시간표를 불러오지 못했어요.';return;}
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
