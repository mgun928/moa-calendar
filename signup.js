import { authReady, authMessage } from './auth.js';
const form = document.querySelector('#signup-form');
const nickname = document.querySelector('#nickname');
const email = document.querySelector('#email');
const password = document.querySelector('#password');
const confirmation = document.querySelector('#confirm-password');
const notice = document.querySelector('#notice');
let submitted = false;
let pendingSignup = null;

function showVerification() {
  const panel = document.querySelector('.login-panel');
  Array.from(panel.children).forEach(child => { child.hidden = true; });
  const section = document.createElement('section');
  section.className = 'verification-step';
  section.innerHTML = `<h2 id="verification-title" tabindex="-1">이메일 인증을 해주세요!</h2>
    <button class="primary" type="button">인증 완료</button>
    <p class="field-error" role="alert" hidden></p>`;
  panel.append(section);
  document.querySelector('.login-side').setAttribute('aria-labelledby', 'verification-title');
  section.querySelector('h2').focus();
  const button = section.querySelector('button');
  const warning = section.querySelector('[role="alert"]');
  button.onclick = async () => {
    if (button.disabled || !pendingSignup) return;
    button.disabled = true;
    button.textContent = '확인 중…';
    warning.hidden = true;
    try {
      const client = await authReady;
      // Signing in also works when the email link was opened in another browser.
      // The password is held only in this page's memory, never browser storage.
      const { data, error } = await client.auth.signInWithPassword(pendingSignup);
      if (error) {
        warning.textContent = error.code === 'email_not_confirmed'
          ? '이메일 인증이 완료되지 않았습니다.' : authMessage(error);
        warning.hidden = false;
        return;
      }
      const verified = await client.auth.getUser();
      if (verified.error) throw verified.error;
      if (!verified.data.user?.email_confirmed_at || verified.data.user.id !== data.user?.id) {
        warning.textContent = '이메일 인증이 완료되지 않았습니다.';
        warning.hidden = false;
        return;
      }
      pendingSignup = null;
      location.assign('dashboard.html');
    } catch (error) {
      warning.textContent = authMessage(error);
      warning.hidden = false;
    } finally { button.disabled = false; button.textContent = '인증 완료'; }
  };
}

function validate(input) {
  let message = '';
  if (!input.value) message = '이 항목을 입력해 주세요.';
  else if (input === nickname && (Array.from(input.value.trim()).length < 2 || Array.from(input.value.trim()).length > 20)) message = '닉네임은 앞뒤 공백을 제외하고 2~20자로 입력해 주세요.';
  else if (input === email && input.validity.typeMismatch) message = '올바른 이메일 주소를 입력해 주세요.';
  else if (input === password && input.value.length < 8) message = '비밀번호는 8자 이상 입력해 주세요.';
  else if (input === confirmation && input.value !== password.value) message = '비밀번호가 일치하지 않아요.';
  const error = document.getElementById(`${input.id}-error`);
  error.textContent = message;
  error.hidden = !message;
  input.setAttribute('aria-invalid', String(Boolean(message)));
  return !message;
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  submitted = true;
  notice.hidden = true;
  const invalid = [nickname, email, password, confirmation].filter(input => !validate(input));
  if (invalid.length) { invalid[0].focus(); return; }
  const button = form.querySelector('[type="submit"]');
  if (button.disabled) return;
  button.disabled = true;
  button.textContent = '인증 메일 요청 중…';
  try {
    const client = await authReady;
    const { data, error } = await client.auth.signUp({
      email: email.value.trim(), password: password.value,
      options: {
        emailRedirectTo: new URL('email-confirmed.html', location.href).href,
        data: { nickname: nickname.value.trim() }
      }
    });
    if (error) throw error;
    if (Array.isArray(data.user?.identities) && data.user.identities.length === 0) {
      const message = '해당 이메일로 가입된 계정이 있어요. 로그인해 주세요.';
      document.querySelector('#email-error').textContent = message;
      document.querySelector('#email-error').hidden = false;
      email.setAttribute('aria-invalid', 'true');
      email.focus();
      notice.textContent = message;
      return;
    }
    pendingSignup = { email: email.value.trim(), password: password.value };
    password.value = confirmation.value = '';
    submitted = false;
    showVerification();
  } catch (error) { notice.textContent = authMessage(error); }
  finally { button.disabled = false; button.textContent = '회원가입'; notice.hidden = Boolean(pendingSignup); }
});

[nickname, email, password, confirmation].forEach(input => {
  input.addEventListener('input', () => {
    notice.hidden = true;
    if (submitted) {
      validate(input);
      if (input === password && confirmation.value) validate(confirmation);
    }
  });
});

document.querySelectorAll('[data-target]').forEach(button => {
  button.addEventListener('click', () => {
    const input = document.getElementById(button.dataset.target);
    const visible = input.type === 'password';
    input.type = visible ? 'text' : 'password';
    button.textContent = visible ? '숨김' : '보기';
    button.setAttribute('aria-pressed', String(visible));
    const label = input === confirmation ? '비밀번호 확인' : '비밀번호';
    button.setAttribute('aria-label', `${label} ${visible ? '숨기기' : '표시'}`);
  });
});
