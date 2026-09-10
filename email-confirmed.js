import { authReady } from './auth.js';

const params = new URLSearchParams(location.hash.slice(1));
const query = new URLSearchParams(location.search);
const message = document.querySelector('#message');

try {
  if (params.has('error') || query.has('error')) {
    message.textContent = '인증 링크가 만료되었거나 유효하지 않습니다. 인증 메일을 다시 요청해주세요.';
  } else {
    // Let Supabase finish consuming the callback before removing its URL tokens.
    const client = await authReady;
    const { error } = await client.auth.getSession();
    if (error) throw error;
  }
} catch {
  message.textContent = '인증 상태를 확인하지 못했습니다. 로그인 화면에서 다시 확인해주세요.';
} finally {
  history.replaceState(null, '', location.pathname);
}
