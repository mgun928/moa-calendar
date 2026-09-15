// Vertical panels use their handles; horizontal menus also support edge/content swipes.
export function dragProgress(start, delta, direction, height){
 return Math.max(0,Math.min(height,start+delta*direction));
}
export function shouldOpen(startOpen, distance, height){
 const threshold=Math.min(64,height*.25);
 return startOpen?distance>height-threshold:distance>=threshold;
}

export function setupEdgePanel({dialog,handle,grip,direction,axis="y",beforeOpen,onOpen,onCloseStart,edgeTarget,modal=()=>true,dragSurface,onSwipe}){
 const size=()=>dialog.getBoundingClientRect()[axis==="x"?"width":"height"];
 const coordinate=event=>axis==="x"?event.clientX:event.clientY;
 let progress=0,height=0,drag=null,timer=0,settled=false,suppressUntil=0;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 handle.setAttribute('aria-haspopup','dialog');
 handle.setAttribute('aria-controls',dialog.id);
 handle.setAttribute('aria-expanded','false');
 function paint(value){
  progress=value;
  dialog.style.transform=`translate${axis.toUpperCase()}(${direction*(value-height)}px)`;
  dialog.style.setProperty('--edge-opacity',String(height?value/height:0));
 }
 function prepare(){
  clearTimeout(timer);
  if(dialog.open)return;
  beforeOpen();
  dialog.classList.add('is-dragging');
  if(modal())dialog.showModal();else dialog.show();
  height=size();
  paint(0);
  // Commit the closed position before enabling the snap transition.
  dialog.getBoundingClientRect();
 }
 function finishClose(){
  clearTimeout(timer);drag=null;settled=false;
  if(dialog.open)dialog.close();
  handle.setAttribute('aria-expanded','false');
 }
 function snap(open){
  clearTimeout(timer);settled=open;
  handle.setAttribute('aria-expanded',String(open));
  if(open)onOpen?.();else onCloseStart?.();
  dialog.classList.remove('is-dragging');
  paint(open?height:0);
  if(!open){timer=setTimeout(finishClose,reduced.matches?0:220);}
 }
 function open(){prepare();snap(true);}
 function close(immediate=false){if(!dialog.open)return;if(immediate)finishClose();else snap(false);}
 function start(event,fromOpen,fromMove=false){
  if(!event.isPrimary||(!fromMove&&event.button!==0)||drag)return;
  event.preventDefault();
  prepare();
  height=size();
  dialog.classList.add('is-dragging');
  drag={id:event.pointerId,y:coordinate(event),start:fromOpen?height:0,fromOpen,moved:false};
  paint(drag.start);
  // Capture on the modal, since the outside edge button becomes inert.
  dialog.setPointerCapture(event.pointerId);
 }
 if(axis==='x'){
  let candidate=null;
  const remember=(event,fromOpen)=>{
   if(!event.isPrimary||event.button!==0||drag)return;
   if(fromOpen&&(grip.contains(event.target)||event.target.closest('input,textarea,select')))return;
   candidate={id:event.pointerId,x:event.clientX,y:event.clientY,fromOpen};
  };
  edgeTarget?.addEventListener('pointerdown',event=>remember(event,false));
  dialog.addEventListener('pointerdown',event=>remember(event,true));
  document.addEventListener('pointermove',event=>{
   if(!candidate||candidate.id!==event.pointerId||drag)return;
   const dx=event.clientX-candidate.x,dy=event.clientY-candidate.y;
   if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)){candidate=null;return;}
   if(Math.abs(dx)<10||Math.abs(dx)<Math.abs(dy)*1.3)return;
   const state=candidate;candidate=null;
   if(state.fromOpen?dx>=0:dx<=0)return;
   start(event,state.fromOpen,true);if(!drag)return;drag.y=state.x;drag.moved=true;
   paint(dragProgress(drag.start,dx,direction,height));
   event.stopPropagation();
  },{capture:true,passive:false});
  document.addEventListener('pointerup',()=>{candidate=null;});
  document.addEventListener('pointercancel',()=>{candidate=null;});
 }
 handle.addEventListener('pointerdown',event=>start(event,false));
 grip.addEventListener('pointerdown',event=>start(event,true));
 dragSurface?.addEventListener('pointerdown',event=>start(event,true));
 dialog.addEventListener('pointermove',event=>{
  if(!drag||event.pointerId!==drag.id)return;
  event.preventDefault();
  const delta=coordinate(event)-drag.y;
  if(Math.abs(delta)>4)drag.moved=true;
  paint(dragProgress(drag.start,delta,direction,height));
 });
 function release(event,cancelled=false){
  if(!drag||event.pointerId!==drag.id)return;
  const state=drag;drag=null;suppressUntil=Date.now()+400;
  if(dialog.hasPointerCapture(event.pointerId))dialog.releasePointerCapture(event.pointerId);
  if(!cancelled&&state.fromOpen&&state.moved&&onSwipe?.(coordinate(event)-state.y)){snap(true);return;}
  snap(cancelled?state.fromOpen:state.moved?shouldOpen(state.fromOpen,progress,height):!state.fromOpen);
 }
 dialog.addEventListener('pointerup',event=>release(event));
 dialog.addEventListener('pointercancel',event=>release(event,true));
 dialog.addEventListener('lostpointercapture',event=>{if(drag)release(event,true);});
 handle.addEventListener('click',()=>{if(Date.now()>suppressUntil)open();});
 grip.addEventListener('click',()=>{if(Date.now()>suppressUntil)close();});
 dialog.addEventListener('click',event=>{
  if(Date.now()<suppressUntil&&(axis==='x'||event.target===dialog||grip.contains(event.target))){event.preventDefault();event.stopImmediatePropagation();return;}
  if(event.target!==dialog)return;
  const rect=dialog.getBoundingClientRect();
  if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)close();
 },true);
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 dialog.addEventListener('close',()=>{settled=false;handle.setAttribute('aria-expanded','false');});
 function resize(){
  if(!dialog.open)return;
  if(Math.abs(size()-height)<1)return;
  if(drag){close(true);return;}
  height=size();paint(settled?height:0);
 }
 new ResizeObserver(resize).observe(dialog);
 return {open,close};
}
