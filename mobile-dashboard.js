import {setupEdgePanel} from './mobile-edge-panel.js?v=sync-close-1';

export function setupMobileDashboard(){
 const media=matchMedia('(max-width:640px)');
 const sidebar=document.querySelector('.sidebar'),nav=sidebar.querySelector('nav');
 const navHome=document.createComment('Desktop navigation');nav.before(navHome);
 const account=document.querySelector('.profile-menu');
 const accountHome=document.createComment('Desktop account');account.before(accountHome);
 const tools=document.createElement('div');tools.className='mobile-tools';
 function edgeHandle(className,label){
  const button=document.createElement('button');button.type='button';button.className=className;
  button.setAttribute('aria-label',label);button.innerHTML='<span aria-hidden="true"></span>';return button;
 }
 const handle=edgeHandle('mobile-drawer-handle edge-handle','메뉴 열기');
 const menuEdge=document.createElement('div');menuEdge.className='mobile-menu-swipe-edge';menuEdge.setAttribute('aria-hidden','true');document.body.append(menuEdge);
 const bottomHandle=edgeHandle('bottom-drawer-handle edge-handle','상세 일정 열기');
 handle.innerHTML='<span class="edge-label"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 5h10M3 8h10M3 11h10"/></svg></span>';
 bottomHandle.innerHTML='';
 function edgeTip(button,key,message){
  const tip=document.createElement('span');tip.className='edge-tip';tip.textContent=message;tip.hidden=true;button.append(tip);
  let timer;
  const dismiss=()=>{clearTimeout(timer);tip.hidden=true;try{localStorage.setItem(key,'1');}catch{}};
  const show=()=>{
   if(!media.matches)return;
   try{if(localStorage.getItem(key))return;}catch{}
   tip.hidden=false;timer=setTimeout(dismiss,6500);
  };
  // Only teach the gesture when that handle is actually available on screen.
  const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){show();observer.disconnect();}});
  observer.observe(button);
  return dismiss;
 }
 const dismissMenuTip=edgeTip(handle,'moa-menu-tip-v1','누르거나 오른쪽으로 밀어 메뉴를 열어보세요');
 const dismissFriendsTip=()=>{};
 const drawer=document.createElement('dialog');drawer.className='edge-panel edge-menu';drawer.id='mobile-navigation';
 drawer.setAttribute('aria-label','메뉴');
 const menuContent=document.createElement('div');menuContent.className='edge-menu-content';
 const menuLogo=document.createElement('a');menuLogo.className='wordmark mobile-menu-logo';menuLogo.href='dashboard.html';menuLogo.setAttribute('aria-label','모아 홈');menuLogo.innerHTML='moa<span>.</span>';menuContent.prepend(menuLogo);
 const menuGrip=edgeHandle('edge-panel-grip','메뉴 닫기');menuGrip.textContent='×';drawer.append(menuContent,menuGrip);
 const menuFooter=document.createElement('div');menuFooter.className='mobile-menu-footer';drawer.append(menuFooter);
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

 let quickSaving=false;
 quickAdd.addEventListener('submit',async e=>{
  e.preventDefault();const input=quickAdd.querySelector('input'),title=input.value.trim();
  if(!title){input.focus();return;}
  if(quickSaving)return;quickSaving=true;quickButton.disabled=true;input.readOnly=true;
  try{if(await window.moaQuickAddEvent(title)){input.value='';syncQuickButton();input.blur();}}
  finally{quickSaving=false;quickButton.disabled=false;input.readOnly=false;}
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
  const dx=e.clientX-monthSwipe.x,dy=e.clientY-monthSwipe.y,horizontal=monthSwipe.axis==='x';monthSwipe=null;
  if(!horizontal){if(dy< -48){monthClickUntil=Date.now()+400;bottomPanel.open();}return;}
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
 let calendarTouch=null;
 calendar.addEventListener('touchstart',e=>{if(e.touches.length===1){const t=e.touches[0];calendarTouch={x:t.clientX,y:t.clientY};}else calendarTouch=null;},{passive:true});
 calendar.addEventListener('touchend',e=>{if(!calendarTouch)return;const t=e.changedTouches[0],dx=t.clientX-calendarTouch.x,dy=t.clientY-calendarTouch.y;calendarTouch=null;if(media.matches&&dy< -48&&Math.abs(dy)>Math.abs(dx)*1.4){monthClickUntil=Date.now()+400;bottomPanel.open();}},{passive:true});
 calendar.addEventListener('touchcancel',()=>{calendarTouch=null;},{passive:true});
 calendar.addEventListener('pointercancel',()=>{monthSwipe=null;});
 calendar.addEventListener('click',e=>{
  if(monthAnimating||Date.now()<monthClickUntil){e.preventDefault();e.stopImmediatePropagation();}
 },true);
 const friends=document.querySelector('#friends-section');
 const friendsHome=document.createComment('Desktop friends');friends.before(friendsHome);
 const friendButton=document.querySelector('.desktop-friends');
 const friendButtonHome=document.createComment('Desktop friends button');friendButton.before(friendButtonHome);
 const friendPopup=document.createElement('div');friendPopup.id='desktop-friends-popup';friendPopup.hidden=true;
 friendPopup.innerHTML='<header><strong>친구</strong><button type="button" aria-label="친구창 닫기">×</button></header>';
 document.body.append(friendPopup);
 let friendMotion=null,friendExpanded=false;
 function showFriends(open,immediate=false){
  if(friendExpanded===open&&!immediate)return;
  friendExpanded=open;friendButton.setAttribute('aria-expanded',String(open));
  const current=getComputedStyle(friendPopup);
  const from=friendMotion?{opacity:current.opacity,transform:current.transform}:open?{opacity:0,transform:'translateY(-8px) scale(.98)'}:{opacity:1,transform:'translateY(0) scale(1)'};
  friendMotion?.cancel();friendMotion=null;
  if(immediate||matchMedia('(prefers-reduced-motion: reduce)').matches){friendPopup.hidden=!open;friends.hidden=!open;return;}
  friendPopup.hidden=false;friends.hidden=false;
  const animation=friendPopup.animate([from,open?{opacity:1,transform:'translateY(0) scale(1)'}:{opacity:0,transform:'translateY(-8px) scale(.98)'}],{duration:open?220:180,easing:'cubic-bezier(.2,.7,.25,1)',fill:'forwards'});
  friendMotion=animation;
  animation.onfinish=()=>{if(friendMotion!==animation)return;friendPopup.hidden=!open;friends.hidden=!open;animation.cancel();friendMotion=null;};
 }
 function closeFriends(immediate=false){showFriends(false,immediate);}
 function positionFriends(){
  if(media.matches){friendPopup.style.cssText=`top:54px;right:10px;width:${innerWidth-20}px;height:${Math.min(620,innerHeight-74)}px`;return;}
  const rect=document.querySelector('.right-column').getBoundingClientRect();
  const top=document.querySelector('.topbar').getBoundingClientRect().bottom+12;
  const width=Math.max(320,Math.min(380,rect.width||350));
  friendPopup.style.cssText=`top:${top}px;right:16px;width:${width}px;height:${Math.min(480,innerHeight-top-16)}px`;
 }
 friendButton.addEventListener('click',()=>{
  if(friendExpanded){closeFriends();return;}
  if(media.matches)panels.forEach(p=>p.close(true));
  positionFriends();showFriends(true);void window.moaFriends.refresh();
 });
 friendPopup.querySelector('button').addEventListener('click',()=>closeFriends());
 document.addEventListener('click',e=>{if(!friendPopup.hidden&&!e.target.closest('.delete-confirm')&&!friendPopup.contains(e.target)&&!friendButton.contains(e.target))closeFriends();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.querySelector('#friend-profile[open]'))closeFriends();});
 window.addEventListener('resize',()=>{if(!friendPopup.hidden)positionFriends();});

 const right=document.querySelector('.right-column');
 const agenda=right.querySelector('.agenda-panel'),hobby=right.querySelector('.hobby-panel');
 const sheet=document.createElement('dialog');sheet.className='bottom-drawer edge-panel';sheet.id='daily-tools';
 sheet.setAttribute('aria-label','상세 일정');
 const bottomGrip=edgeHandle('edge-panel-grip','일정 닫기');
 sheet.innerHTML='<div class="bottom-drawer-tabs"><h2 id="daily-sheet-date"></h2></div><div class="bottom-panels"></div>';
 sheet.prepend(bottomGrip);
 sheet.querySelector('#daily-sheet-date').textContent=document.querySelector('#selected-date').textContent;
 document.body.append(handle,bottomHandle,drawer,sheet);
 const navStrip=document.createElement('div');navStrip.className='mobile-nav-strip';
 const navPrev=document.createElement('button'),navNext=document.createElement('button');
 for(const [button,direction,label] of [[navPrev,-1,'이전 메뉴 보기'],[navNext,1,'다음 메뉴 보기']]){
  button.type='button';button.className='nav-scroll-arrow '+(direction<0?'prev':'next');
  button.setAttribute('aria-label',label);button.innerHTML=`<svg viewBox="0 0 20 20" aria-hidden="true"><path d="${direction<0?'m12 5-5 5 5 5':'m8 5 5 5-5 5'}"/></svg>`;
  button.hidden=true;
  button.addEventListener('click',()=>nav.scrollBy({left:direction*Math.max(130,nav.clientWidth*.7),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));
 }
 navStrip.append(navPrev,navNext);
 function updateNavArrows(){
  const max=nav.scrollWidth-nav.clientWidth;
  const hasPrev=media.matches&&nav.scrollLeft>2,hasNext=media.matches&&max-nav.scrollLeft>2;
  navPrev.hidden=!hasPrev;navNext.hidden=!hasNext;
  navStrip.classList.toggle('has-prev',hasPrev);navStrip.classList.toggle('has-next',hasNext);
 }
 nav.addEventListener('scroll',updateNavArrows,{passive:true});
 new ResizeObserver(updateNavArrows).observe(nav);
 document.fonts?.ready.then(updateNavArrows);
 const panels=[];
 const topPanel=setupEdgePanel({dialog:drawer,handle,grip:menuGrip,direction:1,axis:"x",edgeTarget:menuEdge,onOpen:()=>{dismissMenuTip();requestAnimationFrame(updateNavArrows);},beforeOpen:()=>panels.forEach(p=>p.close(true))});
 panels.push(topPanel);
 function selectTool(tool){
  sheet.dataset.tool=tool;friends.hidden=tool!=='friends';
  sheet.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===tool)));
  if(tool==='friends')void window.moaFriends.refresh();
 }
 sheet.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>selectTool(b.dataset.tool)));
 sheet.addEventListener('close',()=>{if(sheet.open)return;document.body.classList.remove('calendar-details-open','calendar-details-closing');layout();});

 const bottomPanel=setupEdgePanel({dialog:sheet,handle:bottomHandle,grip:bottomGrip,dragSurface:sheet.querySelector('.bottom-drawer-tabs'),direction:-1,modal:()=>!document.body.classList.contains('calendar-details-open'),onOpen:()=>{dismissFriendsTip();document.body.classList.remove('calendar-details-closing');layout();},onCloseStart:()=>{document.body.classList.add('calendar-details-closing');layout();},beforeOpen:()=>{
  panels.forEach(p=>p.close(true));selectTool('agenda');
  document.body.classList.toggle('calendar-details-open',media.matches&&panel.getClientRects().length>0);layout();
 }});
 panels.push(bottomPanel);
 let navDrag=null,navClickUntil=0;
 nav.addEventListener('pointerdown',e=>{if(media.matches&&e.pointerType==='mouse'&&e.button===0)navDrag={id:e.pointerId,x:e.clientX,left:nav.scrollLeft};});
 nav.addEventListener('pointermove',e=>{if(!navDrag||navDrag.id!==e.pointerId)return;const dx=e.clientX-navDrag.x;if(Math.abs(dx)>6){nav.setPointerCapture(e.pointerId);nav.scrollLeft=navDrag.left-dx;navClickUntil=Date.now()+400;}});
 nav.addEventListener('pointerup',()=>{navDrag=null;});nav.addEventListener('pointercancel',()=>{navDrag=null;});
 drawer.addEventListener('click',event=>{
  if(Date.now()<navClickUntil&&nav.contains(event.target)){event.preventDefault();event.stopImmediatePropagation();return;}
  const menuItem=event.target.closest('.nav-item[data-view]');
  if(menuItem&&nav.contains(menuItem))topPanel.close();
 },true);
 // Close before an existing action opens its own event dialog.
 agenda.addEventListener('click',event=>{
  if(event.target.closest('.agenda-item,#add-selected'))bottomPanel.close(true);
 },true);
 const contents=sheet.querySelector('.bottom-panels');
 contents.tabIndex=0;contents.setAttribute('aria-label','일정 목록');
 contents.style.touchAction='pan-y';
 // Dismiss from either the calendar or the detail list, including native touch scrolling.
 let dismissPointer=null,dismissTouch=null,dismissClickUntil=0;
 const canDismiss=target=>media.matches&&sheet.open&&!document.body.classList.contains('calendar-details-closing')
  &&(panel.contains(target)||sheet.contains(target))&&!target.closest('input,textarea,select')
  &&!target.closest('.edge-panel-grip,.bottom-drawer-tabs');
 function finishDismiss(start,x,y){
  if(!start||!sheet.open)return false;
  const dx=x-start.x,dy=y-start.y;
  if(dy<48||dy<Math.abs(dx)*1.4)return false;
  dismissClickUntil=monthClickUntil=Date.now()+450;monthSwipe=null;calendarTouch=null;
  bottomPanel.close();return true;
 }
 document.addEventListener('pointerdown',e=>{
  dismissPointer=e.isPrimary&&e.button===0&&canDismiss(e.target)?{id:e.pointerId,x:e.clientX,y:e.clientY}:null;
 },true);
 document.addEventListener('pointerup',e=>{
  const start=dismissPointer;dismissPointer=null;
  if(start?.id===e.pointerId&&finishDismiss(start,e.clientX,e.clientY)){e.preventDefault();e.stopPropagation();}
 },true);
 document.addEventListener('pointercancel',()=>{dismissPointer=null;},true);
 document.addEventListener('touchstart',e=>{
  const touch=e.touches[0];dismissTouch=e.touches.length===1&&canDismiss(e.target)?{x:touch.clientX,y:touch.clientY}:null;
 },{capture:true,passive:true});
 document.addEventListener('touchend',e=>{
  const start=dismissTouch;dismissTouch=null;const touch=e.changedTouches[0];
  if(touch&&finishDismiss(start,touch.clientX,touch.clientY)){if(e.cancelable)e.preventDefault();e.stopPropagation();}
 },{capture:true,passive:false});
 document.addEventListener('touchcancel',()=>{dismissTouch=null;},{capture:true,passive:true});
 document.addEventListener('click',e=>{
  if(Date.now()<dismissClickUntil&&(panel.contains(e.target)||sheet.contains(e.target))){e.preventDefault();e.stopImmediatePropagation();}
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
   const compact=document.body.classList.contains('calendar-details-open')&&!document.body.classList.contains('calendar-details-closing');
   const available=viewport-top-(compact?viewport*.42:media.matches?Math.max(8,safeBottom)+quickHeight+12:12);
   const height=media.matches?Math.max(0,available):Math.max(chrome+weeks*76+2,available);
   panel.style.setProperty('--mobile-calendar-height',height+'px');
   grid.style.setProperty('--calendar-height',height+'px');
   const row=(height-chrome-2)/weeks;
   const slots=Math.max(compact?2:media.matches?0:2,Math.floor((row-(compact?24:44))/(compact?6:20)));
   if(window.moaMobileSlots!==slots||window.moaCompactCalendar!==compact){window.moaCompactCalendar=compact;window.moaMobileSlots=slots;window.renderMoaCalendar();}
  });
 }
 function arrange(){
  panels.forEach(p=>p.close(true));closeFriends(true);
  if(media.matches){
   navStrip.prepend(nav);menuContent.append(navStrip);menuFooter.append(account);
   contents.append(agenda);friendPopup.append(friends);friends.hidden=true;document.body.append(friendButton);
   if(document.body.dataset.view==='friends')nav.querySelector('[data-view=all]').click();
   friends.querySelector('.friend-mobile-toolbar').after(movable[0]);
   menuFooter.append(movable[1]);
   panel.after(summary);
  }else{
   friendButtonHome.after(friendButton);accountHome.after(account);navHome.after(nav);right.append(agenda,hobby);friendPopup.append(friends);friends.hidden=true;
   homes.forEach(({node,parent,next})=>parent.insertBefore(node,next?.parentNode===parent?next:null));
   workspace.insertBefore(summary,grid);
   document.querySelector('.topbar-actions').prepend(document.querySelector('.group-inbox'));
  }
  window.renderMoaCalendar();layout();requestAnimationFrame(updateNavArrows);
 }
 window.layoutMobileCalendar=layout;
 media.addEventListener('change',arrange);
 window.addEventListener('resize',layout);
 window.visualViewport?.addEventListener('resize',layout);
 const observer=new ResizeObserver(layout);
 for(const node of [sidebar,document.querySelector('.calendar-toolbar'),document.querySelector('.calendar-heading'),document.querySelector('.calendar-filters'),document.querySelector('#group-legend'),document.querySelector('.topbar'),document.querySelector('.calendar-sync')])if(node)observer.observe(node);
 document.fonts?.ready.then(layout);
 arrange();
}

