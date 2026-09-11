import {setupEdgePanel} from './mobile-edge-panel.js';

export function setupMobileDashboard(){
 const media=matchMedia('(max-width:640px)');
 const sidebar=document.querySelector('.sidebar'),nav=sidebar.querySelector('nav');
 const navHome=document.createComment('Desktop navigation');nav.before(navHome);
 const tools=document.createElement('div');tools.className='mobile-tools';
 function edgeHandle(className,label){
  const button=document.createElement('button');button.type='button';button.className=className;
  button.setAttribute('aria-label',label);button.innerHTML='<span aria-hidden="true"></span>';return button;
 }
 const handle=edgeHandle('mobile-drawer-handle edge-handle','메뉴 열기');
 const bottomHandle=edgeHandle('bottom-drawer-handle edge-handle','일정과 친구 열기');
 const drawer=document.createElement('dialog');drawer.className='edge-panel edge-menu';drawer.id='mobile-navigation';
 drawer.setAttribute('aria-label','메뉴');
 const menuContent=document.createElement('div');menuContent.className='edge-menu-content';
 const menuLogo=document.createElement('a');menuLogo.className='wordmark mobile-menu-logo';menuLogo.href='dashboard.html';menuLogo.setAttribute('aria-label','모아 홈');menuLogo.innerHTML='moa<span>.</span>';menuContent.prepend(menuLogo);
 const menuGrip=edgeHandle('edge-panel-grip','메뉴 닫기');drawer.append(menuContent,menuGrip);
 const movable=[document.querySelector('.group-inbox'),document.querySelector('.theme-toggle')];
 const homes=movable.map(node=>({node,parent:node.parentNode,next:node.nextSibling}));
 const summary=document.querySelector('#summary'),workspace=document.querySelector('.workspace'),grid=document.querySelector('.content-grid');
 const panel=document.querySelector('.calendar-panel'),calendar=document.querySelector('#calendar');
 const quickAdd=document.createElement('form');quickAdd.className='mobile-quick-add';
 quickAdd.innerHTML='<input class="quick-add-label" aria-label="일정 이름" maxlength="60" autocomplete="off" enterkeyhint="done"><button type="button" class="quick-add-plus" aria-label="일정 상세 설정">+</button>';
 panel.after(quickAdd);
 const quickInput=quickAdd.querySelector('input'),quickButton=quickAdd.querySelector('.quick-add-plus');
 function syncQuickButton(){
  const ready=!!quickInput.value.trim();
  quickButton.textContent=ready?'✓':'+';
  quickButton.setAttribute('aria-label',ready?'일정 저장':'일정 상세 설정');
 }
 quickInput.addEventListener('input',syncQuickButton);
 quickInput.addEventListener('compositionend',syncQuickButton);
 quickInput.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.isComposing)e.preventDefault();});
 quickButton.addEventListener('click',()=>{
  const input=quickInput,title=input.value.trim();
  if(title){quickAdd.requestSubmit();return;}
  input.blur();document.querySelector('#add-event').click();
  document.querySelector('#event-form').elements.title.value=title;
  const heading=document.querySelector('#dialog-title');heading.tabIndex=-1;heading.focus({preventScroll:true});
 });

 quickAdd.addEventListener('submit',e=>{
  e.preventDefault();const input=quickAdd.querySelector('input'),title=input.value.trim();
  if(!title){input.focus();return;}
  if(window.moaQuickAddEvent(title)){input.value='';syncQuickButton();input.blur();}
 });
 function positionQuickAdd(){
  const vp=window.visualViewport;
  const inset=vp?Math.max(0,innerHeight-vp.height-vp.offsetTop):0;
  quickAdd.style.setProperty('--keyboard-inset',inset+'px');
 }
 window.visualViewport?.addEventListener('resize',positionQuickAdd);
 window.visualViewport?.addEventListener('scroll',positionQuickAdd);
 positionQuickAdd();

 let monthSwipe=null,monthClickUntil=0,monthAnimating=false;
 calendar.style.touchAction='pan-y';
 calendar.addEventListener('pointerdown',e=>{
  if(monthAnimating||!media.matches||!e.isPrimary||e.button!==0)return;
  monthSwipe={id:e.pointerId,x:e.clientX,y:e.clientY,axis:null};
 });
 calendar.addEventListener('pointermove',e=>{
  if(!monthSwipe||monthSwipe.id!==e.pointerId)return;
  const dx=e.clientX-monthSwipe.x,dy=e.clientY-monthSwipe.y;
  if(!monthSwipe.axis&&Math.max(Math.abs(dx),Math.abs(dy))>10){
   monthSwipe.axis=Math.abs(dx)>Math.abs(dy)*1.4?'x':'y';
   if(monthSwipe.axis==='x')calendar.setPointerCapture(e.pointerId);
  }
 });
 calendar.addEventListener('pointerup',async e=>{
  if(!monthSwipe||monthSwipe.id!==e.pointerId)return;
  const dx=e.clientX-monthSwipe.x,horizontal=monthSwipe.axis==='x';monthSwipe=null;
  if(!horizontal)return;
  monthClickUntil=Date.now()+400;
  if(Math.abs(dx)<48)return;
  const button=document.querySelector(dx<0?'#next-month':'#prev-month');
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){button.click();return;}
  monthAnimating=true;
  const direction=dx<0?-1:1;
  try{
   await calendar.animate([
    {transform:'translateX(0)',opacity:1},
    {transform:`translateX(${direction*28}px)`,opacity:0}
   ],{duration:110,easing:'ease-in'}).finished;
   button.click();
   await calendar.animate([
    {transform:`translateX(${-direction*28}px)`,opacity:0},
    {transform:'translateX(0)',opacity:1}
   ],{duration:180,easing:'cubic-bezier(.2,.7,.2,1)'}).finished;
  }finally{monthAnimating=false;}
 });
 calendar.addEventListener('pointercancel',()=>{monthSwipe=null;});
 calendar.addEventListener('click',e=>{
  if(monthAnimating||Date.now()<monthClickUntil){e.preventDefault();e.stopImmediatePropagation();}
 },true);
 const friends=document.querySelector('#friends-section');
 const friendsHome=document.createComment('Desktop friends');friends.before(friendsHome);
 const friendButton=document.querySelector('.desktop-friends');
 const friendPopup=document.createElement('div');friendPopup.id='desktop-friends-popup';friendPopup.hidden=true;
 friendPopup.innerHTML='<header><strong>친구</strong><button type="button" aria-label="친구창 닫기">×</button></header>';
 document.body.append(friendPopup);
 function closeFriends(){friendPopup.hidden=true;friendButton.setAttribute('aria-expanded','false');if(!media.matches)friends.hidden=true;}
 function positionFriends(){
  const rect=document.querySelector('.right-column').getBoundingClientRect();
  const top=document.querySelector('.topbar').getBoundingClientRect().bottom+12;
  const width=Math.max(320,Math.min(380,rect.width||350));
  friendPopup.style.cssText=`top:${top}px;right:16px;width:${width}px;height:${Math.min(480,innerHeight-top-16)}px`;
 }
 friendButton.addEventListener('click',()=>{
  if(!friendPopup.hidden){closeFriends();return;}
  positionFriends();friendPopup.hidden=false;friends.hidden=false;friendButton.setAttribute('aria-expanded','true');void window.moaFriends.refresh();
 });
 friendPopup.querySelector('button').addEventListener('click',closeFriends);
 document.addEventListener('click',e=>{if(!friendPopup.hidden&&!e.target.closest('.delete-confirm')&&!friendPopup.contains(e.target)&&!friendButton.contains(e.target))closeFriends();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.querySelector('#friend-profile[open]'))closeFriends();});
 window.addEventListener('resize',()=>{if(!friendPopup.hidden)positionFriends();});

 const right=document.querySelector('.right-column');
 const agenda=right.querySelector('.agenda-panel'),hobby=right.querySelector('.hobby-panel');
 const sheet=document.createElement('dialog');sheet.className='bottom-drawer edge-panel';sheet.id='daily-tools';
 sheet.setAttribute('aria-label','일정과 친구');
 const bottomGrip=edgeHandle('edge-panel-grip','일정 닫기');
 sheet.innerHTML='<div class="bottom-drawer-tabs"><button type="button" data-tool="agenda" aria-pressed="true">오늘의 일정</button><button type="button" data-tool="friends" aria-pressed="false">친구</button><button type="button" data-sheet-close aria-label="패널 닫기">×</button></div><div class="bottom-panels"></div>';
 sheet.prepend(bottomGrip);
 document.body.append(handle,bottomHandle,drawer,sheet);
 const panels=[];
 const topPanel=setupEdgePanel({dialog:drawer,handle,grip:menuGrip,direction:1,beforeOpen:()=>panels.forEach(p=>p.close(true))});
 panels.push(topPanel);
 function selectTool(tool){
  sheet.dataset.tool=tool;friends.hidden=tool!=='friends';
  sheet.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===tool)));
  if(tool==='friends')void window.moaFriends.refresh();
 }
 sheet.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>selectTool(b.dataset.tool)));
 sheet.addEventListener('close',()=>{if(media.matches&&!sheet.open)friends.hidden=true;});

 const bottomPanel=setupEdgePanel({dialog:sheet,handle:bottomHandle,grip:bottomGrip,direction:-1,beforeOpen:()=>{
  panels.forEach(p=>p.close(true));selectTool('agenda');
 }});
 panels.push(bottomPanel);
 let navDrag=null,navClickUntil=0;
 nav.addEventListener('pointerdown',e=>{if(media.matches&&e.pointerType==='mouse'&&e.button===0)navDrag={id:e.pointerId,x:e.clientX,left:nav.scrollLeft};});
 nav.addEventListener('pointermove',e=>{if(!navDrag||navDrag.id!==e.pointerId)return;const dx=e.clientX-navDrag.x;if(Math.abs(dx)>6){nav.setPointerCapture(e.pointerId);nav.scrollLeft=navDrag.left-dx;navClickUntil=Date.now()+400;}});
 nav.addEventListener('pointerup',()=>{navDrag=null;});nav.addEventListener('pointercancel',()=>{navDrag=null;});
 drawer.addEventListener('click',event=>{
  if(Date.now()<navClickUntil&&nav.contains(event.target)){event.preventDefault();event.stopImmediatePropagation();return;}
  if(event.target.closest('[data-view]'))topPanel.close(true);
 },true);
 // Close before an existing action opens its own event dialog.
 agenda.addEventListener('click',event=>{
  if(event.target.closest('.agenda-item,#add-selected'))bottomPanel.close(true);
 },true);
 sheet.querySelector('[data-sheet-close]').addEventListener('click',()=>bottomPanel.close());
 const contents=sheet.querySelector('.bottom-panels');
 contents.tabIndex=0;contents.setAttribute('aria-label','일정 목록');
 // Lock to horizontal intent; vertical gestures remain native list scrolling.
 let swipe=null,suppressSwipeClickUntil=0;
 contents.style.touchAction='pan-y';
 contents.addEventListener('pointerdown',event=>{
  if(!media.matches||!sheet.open||!event.isPrimary||event.button!==0||event.target.closest('input,textarea,select'))return;
  swipe={id:event.pointerId,x:event.clientX,y:event.clientY,axis:null};
 });
 contents.addEventListener('pointermove',event=>{
  if(!swipe||swipe.id!==event.pointerId)return;
  const dx=event.clientX-swipe.x,dy=event.clientY-swipe.y;
  if(!swipe.axis&&Math.max(Math.abs(dx),Math.abs(dy))>10){
   swipe.axis=Math.abs(dx)>Math.abs(dy)*1.4?'x':'y';
   if(swipe.axis==='x')contents.setPointerCapture(event.pointerId);
  }
 });
 contents.addEventListener('pointerup',event=>{
  if(!swipe||swipe.id!==event.pointerId)return;
  const dx=event.clientX-swipe.x,horizontal=swipe.axis==='x';swipe=null;
  if(!horizontal)return;
  suppressSwipeClickUntil=Date.now()+400;
  if(Math.abs(dx)<48)return;
  const tool=dx<0?'friends':'agenda';
  if(sheet.dataset.tool===tool)return;
  selectTool(tool);contents.scrollTop=0;
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches)
   contents.animate([{opacity:.5,transform:`translateX(${dx<0?16:-16}px)`},{opacity:1,transform:'translateX(0)'}],{duration:160,easing:'ease-out'});
 });
 contents.addEventListener('pointercancel',()=>{swipe=null;});
 contents.addEventListener('click',event=>{
  if(Date.now()<suppressSwipeClickUntil){event.preventDefault();event.stopImmediatePropagation();}
 },true);
 let frame=0;
 function layout(){
  cancelAnimationFrame(frame);
  frame=requestAnimationFrame(()=>{
   if(panel.closest('[hidden]'))return;
   const top=panel.getBoundingClientRect().top+window.scrollY;
   const weeks=calendar.children.length||6;
   const chrome=Array.from(panel.children).filter(e=>e!==calendar).reduce((n,e)=>n+e.getBoundingClientRect().height,0);
   const safeBottom=parseFloat(getComputedStyle(bottomHandle).paddingBottom)||0;
   const viewport=window.visualViewport?.height||window.innerHeight;
   const quickHeight=media.matches?quickAdd.getBoundingClientRect().height:0;
   const available=viewport-top-(media.matches?Math.max(8,safeBottom)+quickHeight+14:12);
   const height=media.matches?Math.max(0,available):Math.max(chrome+weeks*76+2,available);
   panel.style.setProperty('--mobile-calendar-height',height+'px');
   grid.style.setProperty('--calendar-height',height+'px');
   const row=(height-chrome-2)/weeks;
   const slots=Math.max(media.matches?0:2,Math.floor((row-32)/22));
   if(window.moaMobileSlots!==slots){window.moaMobileSlots=slots;window.renderMoaCalendar();}
  });
 }
 function arrange(){
  panels.forEach(p=>p.close(true));closeFriends();
  if(media.matches){
   menuContent.append(nav,tools);
   contents.append(agenda,friends);friends.hidden=true;
   if(document.body.dataset.view==='friends')nav.querySelector('[data-view=all]').click();
   movable.forEach(node=>tools.append(node));
   panel.after(summary);
  }else{
   navHome.after(nav);right.append(agenda,hobby);friendPopup.append(friends);friends.hidden=true;
   homes.forEach(({node,parent,next})=>parent.insertBefore(node,next?.parentNode===parent?next:null));
   workspace.insertBefore(summary,grid);
   document.querySelector('.topbar-actions').prepend(document.querySelector('.group-inbox'));
  }
  window.renderMoaCalendar();layout();
 }
 window.layoutMobileCalendar=layout;
 media.addEventListener('change',arrange);
 window.addEventListener('resize',layout);
 window.visualViewport?.addEventListener('resize',layout);
 const observer=new ResizeObserver(layout);
 for(const node of [sidebar,document.querySelector('.calendar-heading'),document.querySelector('.calendar-filters'),document.querySelector('#group-legend'),document.querySelector('.topbar'),document.querySelector('.calendar-sync')])if(node)observer.observe(node);
 document.fonts?.ready.then(layout);
 arrange();
}

