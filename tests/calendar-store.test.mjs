import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';
const source = await readFile(new URL('../calendar-store.js', import.meta.url), 'utf8');
const { openCalendarStore } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const empty = () => ({ events: [], groups: [], checks: {} });
const event = id => ({ id, title: id, date: '2026-09-08', time: '09:00', type: 'personal' });
const tick = () => new Promise(resolve => setImmediate(resolve));

function database() {
  const rows = new Map();
  let fail = false;
  return {
    rows,
    failNext() { fail = true; },
    from() {
      let action = 'read', payload, filters = {};
      const query = {
        select() { return query; },
        eq(key, value) { filters[key] = value; return query; },
        insert(value) { action = 'insert'; payload = value; return query; },
        update(value) { action = 'update'; payload = value; return query; },
        single() { return query.maybeSingle(); },
        async maybeSingle() {
          await tick();
          if (fail) { fail = false; return { error: { code: 'offline' } }; }
          const id = payload?.user_id || filters.user_id;
          let row = rows.get(id);
          if (action === 'insert') {
            if (row) return { error: { code: '23505' } };
            row = { data: structuredClone(payload.data), version: 0 };
            rows.set(id, row);
          }
          if (action === 'update') {
            if (!row || row.version !== filters.version) return { data: null };
            row = { data: structuredClone(payload.data), version: row.version + 1 };
            rows.set(id, row);
          }
          return { data: row ? structuredClone(row) : null };
        },
      };
      return query;
    },
  };
}

test('new accounts start empty; legacy import removes demos and happens only once', async () => {
  const db = database();
  const first = await openCalendarStore(db, 'a', { ...empty(), events: [event('sample-0'), event('mine')] });
  assert.deepEqual(first.initial.events.map(e => e.id), ['mine']);
  assert.deepEqual((await openCalendarStore(db, 'a', empty())).initial.events.map(e => e.id), ['mine']);
  assert.deepEqual((await openCalendarStore(db, 'b', null)).initial, empty());
});

test('rapid saves serialize and persist the latest snapshot including deletion', async () => {
  const db = database(), states = [];
  const store = await openCalendarStore(db, 'a', null, state => states.push(state));
  store.save({ ...empty(), events: [event('one')] });
  store.save({ ...empty(), events: [event('two')] });
  for (let i = 0; i < 5; i++) await tick();
  assert.equal(db.rows.get('a').data.events[0].id, 'two');
  assert.equal(states.at(-1), 'saved');
  store.save(empty());
  await tick(); await tick();
  assert.deepEqual(db.rows.get('a').data.events, []);
});

test('failed save stays pending and retry persists it', async () => {
  const db = database(), states = [];
  const store = await openCalendarStore(db, 'a', null, state => states.push(state));
  db.failNext();
  store.save({ ...empty(), checks: { reading: true } });
  await tick(); await tick();
  assert.equal(states.at(-1), 'error');
  assert.equal(store.hasPending(), true);
  await store.retry();
  assert.equal(db.rows.get('a').data.checks.reading, true);
  assert.equal(store.hasPending(), false);
});

test('stale device cannot overwrite a newer save', async () => {
  const db = database(), states = [];
  const a = await openCalendarStore(db, 'a', null);
  const b = await openCalendarStore(db, 'a', null, state => states.push(state));
  a.save({ ...empty(), events: [event('new')] });
  await tick(); await tick();
  b.save({ ...empty(), events: [event('stale')] });
  await tick(); await tick();
  assert.equal(states.at(-1), 'conflict');
  await b.retry();
  assert.equal(db.rows.get('a').data.events[0].id, 'new');
});

test('load failure never creates or overwrites data, stopped store does not save', async () => {
  const db = database();
  db.failNext();
  await assert.rejects(openCalendarStore(db, 'a', null));
  assert.equal(db.rows.size, 0);
  const store = await openCalendarStore(db, 'a', null);
  store.stop(); store.save({ ...empty(), events: [event('no')] });
  await tick();
  assert.deepEqual(db.rows.get('a').data.events, []);
});

test('private timetable and legacy hobby records persist across reopened accounts', async () => {
 const db=database();
 const store=await openCalendarStore(db,'owner',null);
 const saved={...empty(),checks:{'reading:2026-09-11':true},habits:[{id:'reading',title:'독서',target:5}],timetable:{entries:[{id:'tt',title:'운동',day:0,start:570,end:660,color:'#bc8158'}],start:480,end:1320,weekend:false}};
 store.save(saved);await tick();await tick();
 store.stop();
 const reopened=await openCalendarStore(db,'owner',null);
 assert.deepEqual(reopened.initial,saved);
 assert.equal((await openCalendarStore(db,'other',null)).initial.timetable,undefined);
 const next={...reopened.initial,events:[event('calendar-event')]};
 reopened.save(next);await tick();await tick();
 assert.deepEqual(db.rows.get('owner').data.timetable,saved.timetable);
 assert.equal(db.rows.get('owner').data.checks['reading:2026-09-11'],true);
});
