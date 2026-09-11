import {applyAccent} from './accent.js?v=dark-accent-6';
import { authReady, authMessage } from './auth.js';
import { setupDeletion } from './account-delete.js';

try {
  const client = await authReady;
  const { data, error } = await client.auth.getUser();
  if (error || !data.user?.email_confirmed_at) location.replace('index.html');
  else {
    const user = data.user;
    const accent=document.querySelector('#accent-color');
    let savedAccent=applyAccent(user.user_metadata?.accent_color);
    accent.value=savedAccent;
    function previewAccent(){applyAccent(accent.value);}
    accent.addEventListener('input',previewAccent);
    for(const [name,color] of [['주황','#be542c'],['파랑','#3977b9'],['초록','#63845c'],['보라','#8768aa'],['분홍','#b75678'],['코랄','#b94f48'],['머스터드','#947124'],['올리브','#727c36'],['청록','#328477'],['틸','#287f86'],['인디고','#585ba6'],['베리','#963f70']]){
      const button=document.createElement('button');button.type='button';button.setAttribute('aria-label',name);button.style.background=color;
      button.onclick=()=>{accent.value=color;previewAccent();};document.querySelector('.accent-presets').append(button);
    }
    const nickname = document.querySelector('#nickname');
    const email = document.querySelector('#email');
    nickname.value = typeof user.user_metadata?.nickname === 'string' ? user.user_metadata.nickname : '';
    email.value = user.email;
    document.querySelector('#loading').hidden = true;
    document.querySelector('#account').hidden = false;
    const { data: authListener } = client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (session && session.user.id !== user.id)) location.replace('index.html');
    });
    function bind(id, action) {
      const form = document.getElementById(id);
      form.onsubmit = async event => {
        event.preventDefault();
        const button = form.querySelector('button[type=submit]');
        if (button.disabled) return;
        const status = form.querySelector('[role=status]');
        button.disabled = true;
        status.textContent = '변경 중…';
        try { status.textContent = await action(); }
        catch (error) { status.textContent = error.localMessage || authMessage(error); }
        finally { button.disabled = false; }
      };
    }
    const fail = localMessage => { throw { localMessage }; };
    bind('accent-form',async()=>{
      const chosen=accent.value;
      const {error}=await client.auth.updateUser({data:{accent_color:chosen}});
      if(error){applyAccent(savedAccent);throw error;}
      savedAccent=chosen;applyAccent(chosen);return '색상을 저장했어요.';
    });
    bind('nickname-form', async () => {
      const value = nickname.value.trim();
      if (Array.from(value).length < 2 || Array.from(value).length > 20) fail('닉네임은 2~20자로 입력해 주세요.');
      const { error } = await client.auth.updateUser({ data: { nickname: value } });
      if (error) throw error;
      nickname.value = value;
      return '닉네임을 저장했어요.';
    });
    bind('email-form', async () => {
      if (email.value.trim().toLowerCase() === user.email.toLowerCase()) return '현재 사용 중인 이메일이에요.';
      const { error } = await client.auth.updateUser({ email: email.value.trim() }, { emailRedirectTo: new URL('index.html', location.href).href });
      if (error) throw error;
      return '변경 인증을 요청했어요. 기존 주소와 새 주소의 메일함을 확인해 주세요.';
    });
    bind('password-form', async () => {
      const current = document.querySelector('#current-password');
      const next = document.querySelector('#new-password');
      const confirmation = document.querySelector('#confirm-password');
      if (next.value.length < 8) fail('새 비밀번호는 8자 이상 입력해 주세요.');
      if (next.value !== confirmation.value) fail('새 비밀번호가 일치하지 않아요.');
      if (next.value === current.value) fail('현재 비밀번호와 다른 비밀번호를 입력해 주세요.');
      try {
        const verified = await client.auth.signInWithPassword({ email: user.email, password: current.value });
        if (verified.error) fail('현재 비밀번호를 확인해 주세요.');
        const { error } = await client.auth.updateUser({ password: next.value });
        if (error) throw error;
        return '비밀번호를 변경했어요.';
      } finally { current.value = next.value = confirmation.value = ''; }
    });
    document.querySelector('#logout').onclick = async () => {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) { document.querySelector('#loading').hidden = false; document.querySelector('#loading').textContent = '로그아웃에 실패했어요. 다시 시도해 주세요.'; }
    };
    setupDeletion(client, user.id, () => authListener.subscription.unsubscribe());
  }
} catch {
  document.querySelector('#loading').textContent = '계정 정보를 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.';
}
