import { authReady } from './auth.js';
import { openCalendarStore } from './calendar-store.js';
import { setupGroupSharing } from './group-sharing.js';
import { setupProfileMenu } from './profile-menu.js';


async function loadScript(src) {
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.body.append(script);
  });
}

try {
  const client = await authReady;
  const { data, error } = await client.auth.getUser();
  if (error || !data.user?.email_confirmed_at) {
    location.replace('index.html');
  } else {
    window.moaUserId = data.user.id;
    client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (session && session.user.id !== window.moaUserId)) {
        window.moaCalendarStore?.stop();
        window.moaSharing?.stop();
        document.body.style.visibility = 'hidden';
        location.replace('index.html');
      }
    });
    const status = document.createElement('div');
    status.className = 'calendar-sync';
    const label = document.createElement('span');
    label.setAttribute('role', 'status');
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = '다시 저장';
    retry.hidden = true;
    retry.onclick = () => window.moaCalendarStore.retry();
    status.append(label, retry);
    document.querySelector('.workspace').prepend(status);
    let legacy = null;
    try { legacy = JSON.parse(localStorage.getItem('moa-dashboard-v1:' + data.user.id)); } catch {}
    window.moaCalendarStore = await openCalendarStore(client, data.user.id, legacy, state => {
      status.dataset.state = state;
      label.textContent = {
        saving: '일정을 저장하고 있어요…',
        saved: '계정에 저장됐어요.',
        error: '저장하지 못했어요. 이 화면을 유지하고 다시 저장해주세요.',
        conflict: '다른 화면에서 일정이 변경됐어요. 현재 변경은 저장되지 않았어요. 새로고침 후 다시 수정해주세요.',
      }[state];
      retry.hidden = state !== 'error';
    });
    label.textContent = '';
    window.addEventListener('beforeunload', event => {
      if (window.moaCalendarStore.hasPending()) { event.preventDefault(); event.returnValue = ''; }
    });
    window.moaSharing = await setupGroupSharing(client);
    await loadScript('dashboard.js');
    await loadScript('memories.js');


    const savedNickname = data.user.user_metadata?.nickname;
    const displayName = typeof savedNickname === 'string' && savedNickname.trim()
      ? Array.from(savedNickname.trim()).slice(0, 20).join('') : '나의 모아';
    document.querySelector('.profile strong').textContent = displayName;
    document.querySelector('.profile .avatar').textContent = Array.from(displayName)[0];
    setupProfileMenu(client);
    document.body.style.visibility = 'visible';
  }
} catch {
  document.body.replaceChildren();
  const message = document.createElement('p');
  message.textContent = '계정의 일정을 불러오지 못했어요. 인터넷 연결과 Supabase 일정 저장 설정을 확인한 후 새로고침해주세요.';
  const link = document.createElement('a');
  link.href = 'index.html';
  link.textContent = '로그인으로 돌아가기';
  document.body.append(message, link);
  document.body.style.visibility = 'visible';
}

