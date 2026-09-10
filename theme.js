/* Apply before first paint; an explicit choice is shared by both pages. */
(() => {
  let mode = 'light';
  try { mode = localStorage.getItem('moa-theme') === 'dark' ? 'dark' : 'light'; } catch {}
  const apply = () => {
    document.documentElement.dataset.theme = mode;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', mode === 'dark' ? '#201e1b' : '#faf9f6');
    document.querySelectorAll('.theme-toggle').forEach(button => {
      button.setAttribute('aria-pressed', String(mode === 'dark'));
      button.title = mode === 'dark' ? '라이트모드로 전환' : '다크모드로 전환';
      button.querySelector('[aria-hidden]').textContent = mode === 'dark' ? '☀' : '☾';
      button.querySelector('.theme-label').textContent = mode === 'dark' ? '라이트모드' : '다크모드';
    });
  };
  apply();
  document.addEventListener('DOMContentLoaded', () => {
    apply();
    document.querySelectorAll('.theme-toggle').forEach(button => button.addEventListener('click', () => {
      mode = mode === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('moa-theme', mode); } catch {}
      apply();
    }));
  });
  window.addEventListener('storage', event => {
    if (event.key === 'moa-theme' || event.key === null) { mode = event.newValue === 'dark' ? 'dark' : 'light'; apply(); }
  });
})();
