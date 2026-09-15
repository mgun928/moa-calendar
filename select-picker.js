export function setupSelectPicker(){
 const dialog=document.createElement('dialog');dialog.className='moa-select-picker';dialog.setAttribute('aria-labelledby','moa-select-title');
 dialog.innerHTML='<header><h2 id="moa-select-title">선택</h2><button type="button" class="icon-button" aria-label="선택 창 닫기">×</button></header><div class="moa-select-options"></div>';
 document.body.append(dialog);let source=null;
 dialog.querySelector('header button').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>source?.focus());
 function open(select){
  if(select.disabled||dialog.open)return;source=select;
  dialog.querySelector('h2').textContent=select.getAttribute('aria-label')||select.closest('label')?.firstChild.textContent.trim()||'선택';
  const list=dialog.querySelector('.moa-select-options');list.replaceChildren();
  [...select.options].forEach(option=>{
   if(option.hidden)return;
   const button=document.createElement('button');button.type='button';button.textContent=option.textContent;button.disabled=option.disabled||option.parentElement.disabled;
   button.setAttribute('aria-pressed',String(option.selected));
   button.onclick=async()=>{list.querySelectorAll('button').forEach(b=>b.disabled=true);await dialog.close();select.value=option.value;select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));};list.append(button);
  });dialog.showModal();(list.querySelector('[aria-pressed="true"]')||list.querySelector('button'))?.focus();
 }
 // Keep native select values and validation, replacing only their popup interaction.
 document.querySelectorAll('select').forEach(select=>{
  select.classList.add('moa-select-source');select.setAttribute('aria-haspopup','dialog');
  let press=null,suppressClick=false;
  // Never open under a held finger: the ensuing release can hit an option.
  select.addEventListener('pointerdown',event=>{
   if(event.button!==0||!event.isPrimary)return;
   event.preventDefault();
   press={id:event.pointerId,x:event.clientX,y:event.clientY};suppressClick=false;
  });
  select.addEventListener('pointermove',event=>{
   if(press?.id!==event.pointerId)return;
   if(Math.hypot(event.clientX-press.x,event.clientY-press.y)>10)suppressClick=true;
  });
  select.addEventListener('pointercancel',()=>{press=null;suppressClick=true;});
  select.addEventListener('pointerup',event=>{
   if(press?.id!==event.pointerId)return;
   if(Math.hypot(event.clientX-press.x,event.clientY-press.y)>10)suppressClick=true;
   press=null;
  });
  select.addEventListener('click',event=>{
   event.preventDefault();
   if(suppressClick&&event.detail!==0){suppressClick=false;return;}
   open(select);
  });
  select.addEventListener('keydown',event=>{if(['Enter',' ','ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();open(select);}});
 });
}
