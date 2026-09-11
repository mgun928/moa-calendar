export function setupDatePicker(){
 const dialog=document.createElement('dialog');
 dialog.className='moa-date-picker';dialog.setAttribute('aria-labelledby','moa-date-title');
 dialog.innerHTML='<header><h2 id="moa-date-title">날짜 선택</h2><button type="button" class="icon-button" data-close aria-label="날짜 선택 닫기">×</button></header><div class="date-navigation"><button type="button" class="icon-button" data-prev aria-label="이전 달">‹</button><strong aria-live="polite"></strong><button type="button" class="icon-button" data-next aria-label="다음 달">›</button></div><div class="date-weekdays">'+['일','월','화','수','목','금','토'].map(d=>'<span>'+d+'</span>').join('')+'</div><div class="date-grid"></div><footer><button type="button" class="outline" data-today>오늘</button><button type="button" class="outline" data-close>취소</button></footer>';
 document.body.append(dialog);
 let source,month;
 const key=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
 function render(){
  dialog.querySelector('.date-navigation strong').textContent=month.getFullYear()+'년 '+(month.getMonth()+1)+'월';
  const grid=dialog.querySelector('.date-grid');grid.replaceChildren();
  const start=new Date(month.getFullYear(),month.getMonth(),1);start.setDate(1-start.getDay());
  for(let i=0;i<42;i++){
   const day=new Date(start);day.setDate(start.getDate()+i);const value=key(day),button=document.createElement('button');
   button.type='button';button.textContent=day.getDate();button.className=(day.getMonth()!==month.getMonth()?'other ':'')+(i%7===0?'sunday ':i%7===6?'saturday ':'');
   button.classList.toggle('selected',value===source.value);button.classList.toggle('today',value===key(new Date()));
   button.setAttribute('aria-label',day.getFullYear()+'년 '+(day.getMonth()+1)+'월 '+day.getDate()+'일');button.setAttribute('aria-pressed',String(value===source.value));
   button.disabled=Boolean(source.min&&value<source.min||source.max&&value>source.max);
   button.onclick=()=>{source.value=value;source.dispatchEvent(new Event('input',{bubbles:true}));source.dispatchEvent(new Event('change',{bubbles:true}));dialog.close();};grid.append(button);
  }
 }
 dialog.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>dialog.close());
 dialog.querySelector('[data-prev]').onclick=()=>{month.setMonth(month.getMonth()-1);render();};
 dialog.querySelector('[data-next]').onclick=()=>{month.setMonth(month.getMonth()+1);render();};
 dialog.querySelector('[data-today]').onclick=()=>{const now=new Date();month=new Date(now.getFullYear(),now.getMonth(),1);render();};
 dialog.addEventListener('close',()=>source?.focus());
 document.querySelectorAll('input[type="date"]').forEach(input=>{
  input.type='text';input.readOnly=true;input.classList.add('moa-date-source');input.setAttribute('aria-haspopup','dialog');
  function open(){source=input;const date=/^\d{4}-\d{2}-\d{2}$/.test(input.value)?new Date(input.value+'T12:00:00'):new Date();month=new Date(date.getFullYear(),date.getMonth(),1);dialog.querySelector('h2').textContent=(input.closest('label')?.childNodes[0]?.textContent.trim()||'날짜')+' 선택';render();dialog.showModal();}
  input.addEventListener('click',open);input.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '||e.key==='ArrowDown'){e.preventDefault();open();}});
 });
}
