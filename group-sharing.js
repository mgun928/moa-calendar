const messages = {
  recipient_not_found: '가입과 이메일 인증을 완료한 모아 계정인지 확인해주세요.',
  cannot_invite_self: '본인 계정은 초대할 수 없어요.',
  already_member: '이미 참여한 구성원이 포함돼 있어요.',
  owner_only: '그룹장만 할 수 있어요.',
  group_conflict: '다른 구성원이 변경했어요. 그룹을 새로고침한 뒤 다시 시도해주세요.',
  group_not_saved: '그룹 저장을 완료한 뒤 다시 초대해주세요.',
  invite_closed: '이미 처리되거나 취소된 초대예요.',
  forbidden: '이 그룹에 접근할 권한이 없어요.',
};
export async function setupGroupSharing(client) {
  let groups = [], stopped = false, loading = false;
  const panel = document.createElement('details');
  panel.className = 'group-inbox';
  panel.innerHTML = '<summary>받은 그룹 초대 <span class="inbox-count">0</span><svg class="inbox-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg></summary><div class="inbox-popover"><div class="section-heading"><h2>받은 그룹 초대</h2><button type="button" class="outline">새로고침</button></div><p class="inbox-status" role="status"></p><div class="inbox-items"></div></div>';
  document.querySelector('.calendar-sync').append(panel);
  const status = panel.querySelector('.inbox-status');
  const items = panel.querySelector('.inbox-items');
  async function call(action, payload = {}) {
    const { data, error } = await client.rpc('moa_groups', { action, payload });
    if (error) {
      const key = Object.keys(messages).find(key => error.message?.includes(key));
      throw new Error(messages[key] || '그룹 연결을 확인해주세요. Supabase 그룹 설정 SQL이 적용되어 있어야 해요.');
    }
    return data;
  }
  function paint(invitations) {
    items.replaceChildren();
    panel.querySelector('.inbox-count').textContent = invitations.length;
    status.textContent = invitations.length ? '수락하면 함께 일정을 관리할 수 있어요.' : '새로운 초대가 없어요.';
    for (const invitation of invitations) {
      const row = document.createElement('div'); row.className = 'inbox-item';
      const text = document.createElement('p');
      text.textContent = `${invitation.sender}님이 ‘${invitation.name}’ 그룹에 초대했어요.`;
      row.append(text);
      for (const [answer, title] of [['accepted', '수락'], ['declined', '거절']]) {
        const button = document.createElement('button'); button.type = 'button';
        button.className = answer === 'accepted' ? 'primary' : 'outline'; button.textContent = title;
        button.onclick = async () => {
          row.querySelectorAll('button').forEach(b => b.disabled = true);
          try {
            await call('respond', { id: invitation.id, answer });
            await refresh();
          } catch (error) { status.textContent = error.message; }
          finally { row.querySelectorAll('button').forEach(b => b.disabled = false); }
        };
        row.append(button);
      }
      items.append(row);
    }
  }
  async function refresh(force = false) {
    if (stopped) return;
    if (loading) {
      if (!force) return;
      while(loading && !stopped) await new Promise(resolve => setTimeout(resolve, 50));
      if(stopped) return;
    }
    loading = true;
    try {
      const [next, inbox] = await Promise.all([call('list'), call('inbox')]);
      if (stopped) return;
      groups = next;
      window.applySharedGroups?.(groups);
      paint(inbox);
    } catch (error) { if (!stopped) status.textContent = error.message; }
    finally { loading = false; }
  }
  panel.querySelector('button').onclick = () => refresh();
  const timer = setInterval(() => {
    if (!document.hidden && !document.querySelector('dialog[open]') && !window.moaCalendarStore?.hasPending()) void refresh();
  }, 15000);
  const onFocus = () => { if (!document.querySelector('dialog[open]')) void refresh(); };
  window.addEventListener('focus', onFocus);
  await refresh();
  return {
    get groups() { return groups; }, call, refresh,
    async listFriends(){
      const {data,error}=await client.rpc('moa_friends',{action:'list'});
      if(error)throw new Error('친구 목록을 불러오지 못했어요. 다시 열어주세요.');
      return (data||[]).filter(person=>person.status==='accepted');
    },
    async inviteFriends(groupId,friendIds){
      const {error}=await client.rpc('moa_invite_group_friends',{group_id:groupId,friend_ids:friendIds});
      if(error)throw new Error(error.code==='PGRST202'?'친구 초대 DB 설정이 필요해요. GROUP-FRIEND-INVITES-GUIDE.md를 확인해주세요.':error.message);
      await refresh(true);
    },
    async mutate(action, payload) { await call(action, payload); await refresh(true); },
    stop() { stopped = true; clearInterval(timer); window.removeEventListener('focus', onFocus); },
  };
}
