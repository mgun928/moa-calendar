export function setupDeletion(client, userId, onDeleted = () => {}) {
  const trigger = document.querySelector('#delete-account') || document.createElement('button');
  trigger.type = 'button';
  trigger.textContent = '계정 탈퇴';
  trigger.className = 'outline';
  if (!trigger.isConnected) document.querySelector('.profile').after(trigger);
  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-labelledby', 'delete-title');
  dialog.style.cssText = 'width:min(420px,90vw);padding:28px;border:1px solid #ddd;border-radius:12px;';
  dialog.innerHTML = `<form><h2 id="delete-title">계정을 탈퇴하시겠어요?</h2>
    <p>계정은 영구 삭제되어 복구할 수 없어요. 이 브라우저의 일정도 정리됩니다. 다른 기기에 남은 로컬 기록은 해당 기기에서 별도로 지워야 해요.</p>
    <label>현재 비밀번호<input name="password" type="password" autocomplete="current-password" required></label>
    <p role="status"></p><button type="button" class="outline" data-cancel>취소</button> <button type="submit" class="primary">영구 탈퇴</button></form>`;
  document.body.append(dialog);
  const form = dialog.querySelector('form');
  const status = dialog.querySelector('[role="status"]');
  let busy = false;
  trigger.onclick = () => { form.reset(); status.textContent = ''; dialog.showModal(); };
  dialog.querySelector('[data-cancel]').onclick = () => { if (!busy) dialog.close(); };
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  dialog.addEventListener('close', () => form.reset());
  form.onsubmit = async event => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    status.textContent = '계정을 확인하고 있어요…';
    try {
      const { data, error } = await client.functions.invoke('delete-account', { body: {
        password: form.elements.password.value
      } });
      if (error || !data?.deleted) {
        let detail;
        try { detail = await error?.context?.json(); } catch {}
        status.textContent = detail?.error === 'password_invalid' ? '현재 비밀번호가 올바르지 않아요.' : '탈퇴를 완료하지 못했어요. 서버 함수 연결 상태를 확인하거나 잠시 후 다시 시도해 주세요.';
        return;
      }
      onDeleted();
      try { localStorage.removeItem('moa-dashboard-v1:' + userId); } catch {}
      window.closeMoaMemories?.();
      try { indexedDB.deleteDatabase('moa-memories-v1:' + userId); } catch {}
      // Deletion has succeeded; a sign-out network error must not show a failure to delete.
      try { await client.auth.signOut({ scope: 'local' }); } catch {}
      const completion = document.createElement('main');
      completion.style.cssText = 'min-height:100svh;max-width:none;margin:0;padding:32px 24px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;';
      completion.innerHTML = `<p class="wordmark" style="margin:0 0 32px;">moa<span>.</span></p>
        <h1 tabindex="-1" style="font-size:clamp(22px,4vw,30px);line-height:1.5;margin:0 0 12px;">모아를 이용해주셔서 감사합니다</h1>
        <p style="color:var(--muted);font-size:14px;margin:0 0 32px;">계정 탈퇴가 완료되었습니다.</p>
        <button type="button" class="primary" style="width:240px;max-width:100%;height:48px;font-size:14px;">탈퇴완료</button>`;
      completion.querySelector('button').onclick = () => location.replace('index.html');
      dialog.close();
      document.body.replaceChildren(completion);
      document.title = '모아 — 탈퇴 완료';
      completion.querySelector('h1').focus();
    } catch { status.textContent = '연결에 실패했어요. 잠시 후 다시 시도해 주세요.'; }
    finally { busy = false; button.disabled = false; form.elements.password.value = ''; }
  };
}
