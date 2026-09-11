let active=false;
export function confirmDelete(message){
 if(active)return Promise.resolve(false);
 active=true;
 return new Promise(resolve=>{
  const dialog=document.createElement('dialog');dialog.className='delete-confirm';
  dialog.setAttribute('aria-labelledby','delete-confirm-title');dialog.setAttribute('aria-describedby','delete-confirm-message');
  dialog.innerHTML='<h2 id="delete-confirm-title">삭제할까요?</h2><p id="delete-confirm-message"></p><div class="delete-confirm-actions"><button type="button" class="primary" data-delete>삭제하기</button><button type="button" class="outline" data-cancel>취소하기</button></div>';
  dialog.querySelector('p').textContent=message;
  let confirmed=false;
  dialog.querySelector('[data-delete]').addEventListener('click',()=>{confirmed=true;dialog.close();});
  dialog.querySelector('[data-cancel]').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  dialog.addEventListener('close',()=>{dialog.remove();active=false;resolve(confirmed);},{once:true});
  document.body.append(dialog);dialog.showModal();dialog.querySelector('[data-cancel]').focus();
 });
}
