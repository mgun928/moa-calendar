export function validCalendar(data) {
  return data && Array.isArray(data.events) && Array.isArray(data.groups) &&
    data.checks && typeof data.checks === 'object' && !Array.isArray(data.checks) &&
    data.events.every(e => e && typeof e.id === 'string' && typeof e.title === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(e.date) && /^\d{2}:\d{2}$/.test(e.time) &&
      ['personal', 'group', 'hobby'].includes(e.type)) &&
    data.groups.every(g => g && typeof g.id === 'string' && typeof g.name === 'string' &&
      typeof g.description === 'string' &&
      (['sage','clay','lavender','blue'].includes(g.color) || /^#[0-9a-f]{6}$/i.test(g.color)) &&
      Array.isArray(g.invites) && g.invites.every(e => typeof e === 'string'));
}

export function cleanLegacy(data) {
  const result = structuredClone(data);
  result.events = result.events.filter(e => !/^sample-(?:[0-9]|10)$/.test(e.id));
  result.groups = result.groups.filter(g => !g.sample || result.events.some(e => e.group === g.id || e.group === g.name));
  return result;
}

// Compare-and-swap prevents a stale tab from overwriting another device's work.
export async function openCalendarStore(client, userId, legacy, onStatus = () => {}) {
  const table = () => client.from('calendar_accounts');
  const read = () => table().select('data,version').eq('user_id', userId).maybeSingle();
  let result = await read();
  if (result.error) throw result.error;
  if (!result.data) {
    const initial = validCalendar(legacy) ? cleanLegacy(legacy) : { events: [], groups: [], checks: {} };
    result = await table().insert({ user_id: userId, data: initial }).select('data,version').single();
    if (result.error?.code === '23505') result = await read();
    if (result.error) throw result.error;
  }
  if (!validCalendar(result.data?.data)) throw new Error('invalid_calendar_data');
  let version = result.data.version;
  let pending = null, running = false, stopped = false, conflicted = false;
  async function flush() {
    if (running || stopped || conflicted || !pending) return;
    running = true;
    onStatus('saving');
    try {
      while (pending && !stopped) {
        const snapshot = pending;
        const response = await table().update({ data: snapshot })
          .eq('user_id', userId).eq('version', version).select('version').maybeSingle();
        if (stopped) return;
        if (response.error) throw response.error;
        if (!response.data) {
          conflicted = true;
          onStatus('conflict');
          return;
        }
        version = response.data.version;
        if (pending === snapshot) pending = null;
      }
      if (!stopped) onStatus('saved');
    } catch {
      if (!stopped) onStatus('error');
    } finally { running = false; }
  }
  return {
    initial: structuredClone(result.data.data),
    save(data) {
      if (stopped) return;
      if (!validCalendar(data)) { onStatus('error'); return; }
      pending = structuredClone(data);
      void flush();
    },
    retry: flush,
    hasPending: () => Boolean(pending),
    stop() { stopped = true; pending = null; },
  };
}
