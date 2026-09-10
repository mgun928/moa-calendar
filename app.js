import { authReady, authMessage } from './auth.js';
const notice = document.querySelector('#notice');
function showNotice(message) {
  notice.textContent = message;
  notice.hidden = false;
}
document.querySelector('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('[type="submit"]');
  if (button.disabled) return;
  button.disabled = true;
  button.textContent = '로그인 중…';
  try {
    const client = await authReady;
    const { error } = await client.auth.signInWithPassword({
      email: document.querySelector('#email').value.trim(),
      password: document.querySelector('#password').value
    });
    if (error) throw error;
    location.assign('dashboard.html');
  } catch (error) { showNotice(authMessage(error)); }
  finally { button.disabled = false; button.textContent = '로그인'; }
});

const callback = new URLSearchParams(location.hash.slice(1));
if (callback.has('error')) {
  history.replaceState(null, '', location.pathname);
  showNotice('인증 링크가 만료되었거나 유효하지 않아요. 다시 가입을 요청하거나 로그인해 주세요.');
} else {
  authReady.then(async client => {
    const { data, error } = await client.auth.getUser();
    if (!error && data.user?.email_confirmed_at) location.replace('dashboard.html');
  }).catch(() => showNotice('인증 서비스를 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.'));
}
document.querySelectorAll('[data-notice]').forEach((button) => {
  button.addEventListener('click', () => showNotice(button.dataset.notice));
});
document.querySelector('.visibility').addEventListener('click', (event) => {
  const button = event.currentTarget;
  const password = document.querySelector('#password');
  const visible = password.type === 'password';
  password.type = visible ? 'text' : 'password';
  button.setAttribute('aria-pressed', String(visible));
  button.setAttribute('aria-label', visible ? '비밀번호 숨기기' : '비밀번호 표시');
});
