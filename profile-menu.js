export function setupProfileMenu(client) {
  const wrapper = document.querySelector('.profile-menu');
  const toggle = document.querySelector('#profile-toggle');
  const options = document.querySelector('#profile-options');
  const logout = document.querySelector('#profile-logout');
  const error = document.querySelector('#profile-menu-error');
  let expanded=false,animation=null;
  function show(open) {
    if(expanded===open)return;
    expanded=open;toggle.setAttribute('aria-expanded',String(open));
    const style=getComputedStyle(options);
    const from=animation?{opacity:style.opacity,transform:style.transform}:open?{opacity:0,transform:'translateY(-6px) scale(.98)'}:{opacity:1,transform:'translateY(0) scale(1)'};
    animation?.cancel();options.hidden=false;
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){options.hidden=!open;animation=null;return;}
    const current=options.animate([from,open?{opacity:1,transform:'translateY(0) scale(1)'}:{opacity:0,transform:'translateY(-6px) scale(.98)'}],{duration:160,easing:'cubic-bezier(.2,.7,.25,1)',fill:'forwards'});
    animation=current;
    current.onfinish=()=>{if(animation!==current)return;options.hidden=!open;current.cancel();animation=null;};
  }
  toggle.addEventListener('click', () => show(!expanded));
  toggle.addEventListener('keydown', event => {
    if(event.key === 'ArrowDown') { event.preventDefault(); show(true); options.querySelector('a').focus(); }
  });
  wrapper.addEventListener('keydown', event => {
    if(event.key === 'Escape') { event.preventDefault(); show(false); toggle.focus(); }
  });
  wrapper.addEventListener('focusout', event => { if(!wrapper.contains(event.relatedTarget)) show(false); });
  document.addEventListener('pointerdown', event => { if(!wrapper.contains(event.target)) show(false); });
  logout.addEventListener('click', async () => {
    if(logout.disabled) return;
    error.hidden = true;
    if(window.moaCalendarStore?.hasPending()) {
      error.textContent = '아직 저장되지 않은 변경이 있어요. 저장을 완료한 뒤 로그아웃해주세요.';
      error.hidden = false; return;
    }
    logout.disabled = true; logout.textContent = '로그아웃 중…';
    try {
      const result = await client.auth.signOut({ scope: 'local' });
      if(result.error) throw result.error;
      location.replace('index.html');
    } catch {
      error.textContent = '로그아웃하지 못했어요. 다시 시도해주세요.'; error.hidden = false;
    } finally { logout.disabled = false; logout.textContent = '로그아웃'; }
  });
}
