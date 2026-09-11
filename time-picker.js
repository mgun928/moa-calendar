export function timeParts(value){
 const match=/^(\d{2}):(\d{2})$/.exec(value||'');
 const h=match?Number(match[1]):9,m=match?Number(match[2]):0;
 if(h>23||m>59)return [0,8,0];
 return [h>=12?1:0,(h%12||12)-1,m];
}
export function timeValue([period,hour,minute]){
 return String((hour+1)%12+period*12).padStart(2,'0')+':'+String(minute).padStart(2,'0');
}
export function setupTimePicker(){
 const sources=[...document.querySelectorAll('input[type="time"]')];
 const dialog=document.createElement('dialog');dialog.className='moa-time-picker';dialog.setAttribute('aria-labelledby','time-picker-title');
 dialog.innerHTML='<header><h2 id="time-picker-title">시간 선택</h2><button type="button" class="icon-button" aria-label="시간 선택 닫기">×</button></header><label class="time-direct-label">직접 입력 · 24시간 기준<input class="time-direct" type="text" inputmode="decimal" maxlength="5" placeholder="09:30" aria-label="시간 직접 입력" pattern="([01][0-9]|2[0-3]):[0-5][0-9]" required></label><div class="time-wheels"></div><p class="time-picker-error" role="alert"></p><button type="button" class="primary time-apply">적용</button>';
 document.body.append(dialog);
 const direct=dialog.querySelector('.time-direct'),error=dialog.querySelector('.time-picker-error');
 let source=null,closing=false,parts=[0,8,0],positioning=false;
 const labels=[['오전','오후'],Array.from({length:12},(_,i)=>String(i+1).padStart(2,'0')),Array.from({length:60},(_,i)=>String(i).padStart(2,'0'))];
 const wheels=labels.map((values,column)=>{
  const wheel=document.createElement('div');wheel.className='time-wheel';wheel.setAttribute('role','group');wheel.setAttribute('aria-label',['오전 오후','시','분'][column]);
  values.forEach((value,index)=>{
   const button=document.createElement('button');button.type='button';button.textContent=value;button.setAttribute('aria-label',value+(column===1?'시':column===2?'분':''));
   button.addEventListener('click',()=>wheel.scrollTo({top:index*42,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));wheel.append(button);
  });
  wheel.addEventListener('scroll',()=>{if(positioning)return;parts[column]=Math.max(0,Math.min(values.length-1,Math.round(wheel.scrollTop/42)));direct.value=timeValue(parts);error.textContent='';paint();},{passive:true});
  // Touch scrolling is native; desktop users may also drag a wheel.
  let drag=null;
  wheel.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0)return;drag={y:e.clientY,top:wheel.scrollTop,moved:false};});
  wheel.addEventListener('pointermove',e=>{if(!drag)return;if(Math.abs(e.clientY-drag.y)>4){drag.moved=true;wheel.setPointerCapture(e.pointerId);wheel.classList.add('dragging');wheel.scrollTop=drag.top+drag.y-e.clientY;}});
  wheel.addEventListener('pointerup',()=>{if(drag?.moved){wheel.classList.remove('dragging');wheel.scrollTo({top:parts[column]*42,behavior:'smooth'});}drag=null;});
  wheel.addEventListener('pointercancel',()=>{drag=null;wheel.classList.remove('dragging');});
  dialog.querySelector('.time-wheels').append(wheel);return wheel;
 });
 function paint(){wheels.forEach((wheel,c)=>[...wheel.children].forEach((button,i)=>{button.classList.toggle('chosen',i===parts[c]);button.setAttribute('aria-pressed',String(i===parts[c]));}));}
 function position(){positioning=true;wheels.forEach((wheel,c)=>wheel.scrollTop=parts[c]*42);paint();requestAnimationFrame(()=>{positioning=false;});}
 function close(){if(closing)return;closing=true;dialog.classList.add('closing');setTimeout(()=>{dialog.close();dialog.classList.remove('closing');closing=false;source?.focus();},matchMedia('(prefers-reduced-motion: reduce)').matches?0:160);}
 dialog.querySelector('[aria-label="시간 선택 닫기"]').addEventListener('click',close);
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();});
 direct.addEventListener('change',()=>{if(direct.validity.valid){parts=timeParts(direct.value);position();error.textContent='';}});
 function apply(){if(closing)return;if(!direct.validity.valid){error.textContent='00:00부터 23:59 사이로 입력해주세요. 예: 09:30';direct.focus();return;}if(source.step==='3600'&&!direct.value.endsWith(':00')){error.textContent='표시 시작은 정각으로 선택해주세요. 예: 08:00';return;}source.value=direct.value;source.dispatchEvent(new Event('input',{bubbles:true}));source.dispatchEvent(new Event('change',{bubbles:true}));close();}
 direct.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();apply();}});
 dialog.querySelector('.time-apply').addEventListener('click',apply);
 sources.forEach(input=>{
  input.type='text';input.readOnly=true;input.classList.add('custom-time-source');input.setAttribute('aria-haspopup','dialog');
  function open(){if(input.disabled||dialog.open)return;source=input;parts=timeParts(input.value);direct.value=timeValue(parts);error.textContent='';dialog.querySelector('h2').textContent=input.closest('label')?.firstChild.textContent.trim()||'시간 선택';dialog.showModal();position();dialog.querySelector('.time-apply').focus();}
  input.addEventListener('click',open);input.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();open();}});
 });
}
