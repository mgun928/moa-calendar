/* Photos live in IndexedDB as blobs; calendar records remain small. */
(() => {
  const records = new Map();
  let db, ready = false, unavailable = false, currentId = null, draft = [], generation = 0, busy = false;
  window.closeMoaMemories = () => { db?.close(); };
  const urls = {cards: [], photos: []};
  const el = selector => document.querySelector(selector);
  const clearUrls = scope => { urls[scope].forEach(URL.revokeObjectURL); urls[scope] = []; };
  const photoUrl = (blob, scope) => { const url = URL.createObjectURL(blob); urls[scope].push(url); return url; };
  const lookup = id => events.find(e => e.id === id && e.type === 'group');
  function ended(event) {
    const end = eventEnd(event);
    if (end !== dateKey(new Date())) return end < dateKey(new Date());
    if (event.allDay) return false;
    return new Date(`${end}T${event.endTime || event.time}:00`) < new Date();
  }
  function transaction(mode, action) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('memories', mode);
      let request;
      try { request = action(tx.objectStore('memories')); } catch (error) { reject(error); return; }
      tx.oncomplete = () => resolve(request?.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('저장을 완료하지 못했어요.'));
    });
  }
  function refresh() {
    clearUrls('cards');
    const relevant = events.filter(e => e.type === 'group' && (!activeGroup || e.group === activeGroup) && (ended(e) || e.date <= dateKey(new Date()) || records.has(e.id)))
      .sort((a,b) => eventEnd(b).localeCompare(eventEnd(a)));
    el('#memory-section').hidden = groupHub || !['all', 'group'].includes(filter) || !relevant.length;
    el('#memory-count').textContent = `${relevant.filter(e => records.get(e.id)?.photos.length).length}개의 추억`;
    el('#memory-status').textContent = unavailable ? '사진 저장소를 열지 못했어요. 브라우저의 저장 허용 여부를 확인한 뒤 새로고침해 주세요.' : ready ? '' : '추억을 불러오고 있어요…';
    el('#memory-cards').innerHTML = relevant.map(e => {
      const memory = records.get(e.id), photos = memory?.photos || [];
      return `<button type="button" class="memory-card ${photos.length ? 'has-photos' : ''}" data-memory="${escapeHTML(e.id)}" ${!ready ? 'disabled' : ''}>
        <span class="memory-cover">${photos.length ? `<img src="${photoUrl(photos[0].blob, 'cards')}" alt="${escapeHTML(e.title)} 대표 사진"><span class="photo-count">사진 ${photos.length}장</span>` : `<span class="memory-placeholder" aria-hidden="true">${ended(e) ? '▧' : '＋'}</span><span>${ended(e) ? '함께한 순간을 남겨볼까요?' : '지금의 순간을 담아보세요'}</span>`}</span>
        <span class="memory-copy"><small>${escapeHTML(groupLabel(e.group))} · ${photos.length ? '추억 카드' : ended(e) ? '일정 완료' : '진행 중'}</small><strong>${escapeHTML(e.title)}</strong><span class="memory-period">${escapeHTML(e.date)}${eventEnd(e) !== e.date ? ` ~ ${escapeHTML(eventEnd(e))}` : ''}</span>${memory?.note ? `<span class="memory-caption">${escapeHTML(memory.note)}</span>` : ''}<span class="memory-action">${photos.length ? '추억 펼쳐보기' : '사진과 추억 남기기'} ↗</span></span></button>`;
    }).join('');
    // Remove images belonging to deleted events, including deleted groups.
    if (ready) for (const id of records.keys()) {
      if (!events.some(e => e.id === id)) {
        records.delete(id);
        transaction('readwrite', store => store.delete(id)).catch(() => {});
      }
    }
  }
  window.refreshMemories = refresh;
  function setBusy(value) {
    busy = value;
    el('#save-memory').disabled = value || !ready;
    el('#memory-files').disabled = value || !ready;
    el('#memory-note').disabled = value;
    el('#save-memory').textContent = value ? '처리 중…' : '추억 저장하기';
  }
  function renderPhotos() {
    clearUrls('photos');
    el('#photo-status').textContent = `${draft.length} / 12장 · 첫 번째 사진이 추억 카드의 대표 사진이에요.`;
    el('#memory-photos').innerHTML = draft.map((photo, i) => `<div class="memory-photo"><button type="button" data-view-photo="${i}" aria-label="사진 ${i + 1} 크게 보기"><img src="${photoUrl(photo.blob, 'photos')}" alt="추억 사진 ${i + 1}"></button><button type="button" class="remove-photo" data-remove-photo="${i}" aria-label="사진 ${i + 1} 제거">×</button>${i ? `<button type="button" class="set-cover" data-cover="${i}">대표로</button>` : '<span class="cover-label">대표 사진</span>'}</div>`).join('');
  }
  function openMemory(id) {
    if (!ready) { notify('사진 저장소가 준비되지 않았어요. 새로고침 후 다시 시도해 주세요.'); return; }
    const event = lookup(id); if (!event) return;
    currentId = id; generation++; draft = [...(records.get(id)?.photos || [])];
    el('#memory-title').textContent = event.title;
    el('#memory-date').textContent = `${groupLabel(event.group)} · ${eventRange(event)}`;
    el('#memory-note').value = records.get(id)?.note || '';
    el('#memory-error').hidden = true;
    el('#memory-files').value = '';
    setBusy(false); renderPhotos(); el('#memory-dialog').showModal();
  }
  el('#memory-cards').addEventListener('click', e => { const button = e.target.closest('[data-memory]'); if (button) openMemory(button.dataset.memory); });
  el('#event-memory').addEventListener('click', e => { if (!ready) { notify('사진 저장소를 사용할 수 없어요. 새로고침 후 다시 시도해 주세요.'); return; } el('#event-dialog').close(); openMemory(e.currentTarget.dataset.event); });
  el('#memory-files').addEventListener('change', async e => {
    const files = [...e.target.files], token = generation;
    el('#memory-error').hidden = true;
    if (files.length + draft.length > 12) { showFormError('#memory-error', '사진은 일정당 최대 12장까지 저장할 수 있어요.'); e.target.value = ''; return; }
    setBusy(true);
    try {
      const added = [];
      for (const file of files) {
        if (!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type) || file.size > 8 * 1024 * 1024) throw new Error('JPG, PNG, WebP, GIF 사진을 8MB 이하로 선택해 주세요.');
        const url = URL.createObjectURL(file);
        try { const image = new Image(); image.src = url; await image.decode(); } catch { throw new Error('읽을 수 없는 사진이 포함되어 있어요. 다른 파일을 선택해 주세요.'); } finally { URL.revokeObjectURL(url); }
        added.push({blob: file});
      }
      if (token !== generation) return;
      draft.push(...added); renderPhotos();
    } catch (error) { if (token === generation) showFormError('#memory-error', error.message); }
    finally { if (token === generation) { setBusy(false); e.target.value = ''; } }
  });
  el('#memory-photos').addEventListener('click', e => {
    if (busy) return;
    const remove = e.target.closest('[data-remove-photo]'), cover = e.target.closest('[data-cover]'), view = e.target.closest('[data-view-photo]');
    if (remove) draft.splice(Number(remove.dataset.removePhoto), 1);
    else if (cover) draft.unshift(...draft.splice(Number(cover.dataset.cover), 1));
    else if (view) { el('#full-memory-photo').src = view.querySelector('img').src; el('#photo-viewer').showModal(); return; }
    else return;
    renderPhotos();
  });
  el('#memory-form').addEventListener('submit', async e => {
    e.preventDefault(); if (busy || !lookup(currentId)) return;
    const token = generation, id = currentId, record = {id, photos: [...draft], note: el('#memory-note').value.trim()};
    setBusy(true); el('#memory-error').hidden = true;
    try {
      await transaction('readwrite', store => record.photos.length || record.note ? store.put(record) : store.delete(id));
      if (record.photos.length || record.note) records.set(id, record); else records.delete(id);
      if (token === generation) el('#memory-dialog').close(); refresh(); notify('사진과 기록을 이 브라우저에 저장했어요.');
    } catch { if (token === generation) showFormError('#memory-error', '저장하지 못했어요. 브라우저 저장 공간을 확인하거나 사진 수를 줄인 뒤 다시 시도해 주세요.'); }
    finally { if (token === generation || !el('#memory-dialog').open) setBusy(false); }
  });
  el('#memory-dialog').addEventListener('close', () => { generation++; clearUrls('photos'); draft = []; });
  let request;
  try { request = indexedDB.open(('moa-memories-v1:' + window.moaUserId), 1); } catch { unavailable = true; refresh(); return; }
  request.onupgradeneeded = () => request.result.createObjectStore('memories', {keyPath: 'id'});
  request.onerror = request.onblocked = () => { unavailable = true; refresh(); };
  request.onsuccess = async () => {
    db = request.result;
    db.onversionchange = () => { db.close(); ready = false; unavailable = true; refresh(); };
    try {
      const saved = await transaction('readonly', store => store.getAll());
      saved.forEach(record => records.set(record.id, record)); ready = true; unavailable = false; refresh();
    } catch { unavailable = true; refresh(); }
  };
  refresh();
})();

