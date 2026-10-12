// End-to-end protocol test: one teacher, three students, full game.
const { server } = require('../server.js');
const WebSocket = require('ws');
const assert = require('assert');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function client(url) {
  const ws = new WebSocket(url); const log = []; const waiters = [];
  ws.on('message', (d) => { const m = JSON.parse(d); log.push(m); waiters.slice().forEach((w) => { if (w.f(m)) { waiters.splice(waiters.indexOf(w), 1); w.r(m); } }); });
  const wait = (f, ms = 15000) => new Promise((res, rej) => { const old = log.find(f); if (old) return res(old); const w = { f, r: res }; waiters.push(w); setTimeout(() => rej(new Error('timeout waiting')), ms); });
  const open = new Promise((r) => ws.on('open', r));
  return { ws, log, wait, open, send: (m) => ws.send(JSON.stringify(m)) };
}
(async () => {
  await new Promise((r) => server.listen(0, r));
  const url = 'ws://localhost:' + server.address().port;
  const T = client(url); await T.open;
  const qs = [
    { type: 'mcq', q: 'Q1', choices: ['a', 'b', 'c', 'd'], answer: 2, secs: 5, points: 100 },
    { type: 'tf', q: 'Q2', answer: 1, secs: 5 },
  ];
  T.send({ t: 'create', game: { title: 'Test', questions: qs, settings: {} } });
  const created = await T.wait((m) => m.t === 'created'); assert(/^\d{6}$/.test(created.code));
  const S = [client(url), client(url), client(url)]; await Promise.all(S.map((s) => s.open));
  const names = ['أحمد', 'سارة', 'محمد'];
  S.forEach((s, i) => s.send({ t: 'join', code: created.code, name: names[i], color: ['red', 'blue', 'white'][i] }));
  const joined = await Promise.all(S.map((s) => s.wait((m) => m.t === 'joined')));
  await sleep(500);
  const lob = T.log.filter((m) => m.t === 'lobby').pop(); assert.strictEqual(lob.players.length, 3);
  const X = client(url); await X.open; X.send({ t: 'join', code: '000000', name: 'x' }); assert((await X.wait((m) => m.t === 'error')).code === 'nocode');
  const t0 = Date.now(); T.send({ t: 'start' });
  const cds = await Promise.all(S.map((s) => s.wait((m) => m.t === 'countdown')));
  assert(cds.every((c) => c.startAt === cds[0].startAt), 'same startAt for everyone');
  const L = client(url); await L.open; L.send({ t: 'join', code: created.code, name: 'late' }); assert((await L.wait((m) => m.t === 'error')).code === 'locked');
  const q1 = await Promise.all(S.map((s) => s.wait((m) => m.t === 'question' && m.n === 0)));
  assert(q1[0].answer === undefined && q1[0].correct === undefined, 'no answer leaked');
  S[0].send({ t: 'answer', n: 0, choice: 2 }); S[1].send({ t: 'answer', n: 0, choice: 0 }); S[2].send({ t: 'answer', n: 0, choice: 2 });
  S[2].send({ t: 'answer', n: 0, choice: 1 });
  const rv = await S[0].wait((m) => m.t === 'reveal' && m.n === 0);
  assert.strictEqual(rv.correct, 2); assert(rv.per[joined[0].pid].ok && !rv.per[joined[1].pid].ok && rv.per[joined[2].pid].ok);
  await S[1].wait((m) => m.t === 'question' && m.n === 1);
  S[1].ws.close(); await sleep(150);
  const R = client(url); await R.open; R.send({ t: 'rejoin', code: created.code, token: joined[1].token });
  const rj = await R.wait((m) => m.t === 'joined'); assert.strictEqual(rj.pid, joined[1].pid);
  await R.wait((m) => m.t === 'question' && m.n === 1);
  R.send({ t: 'answer', n: 1, choice: 1 }); S[0].send({ t: 'answer', n: 1, choice: 0 }); S[2].send({ t: 'answer', n: 1, choice: 1 });
  const res = await T.wait((m) => m.t === 'results', 20000);
  assert.strictEqual(res.board.length, 3); assert.strictEqual(res.board[0].correct, 2); assert(res.board[0].accuracy === 100);
  assert.strictEqual(res.board[2].correct, 1);
  console.log('results:', res.board.map((b) => b.rank + ' ' + b.name + ' ' + b.score + ' ' + b.level.en).join(' | '));
  console.log('total time', Date.now() - t0, 'ms');
  console.log('ALL PROTOCOL TESTS PASSED');
  process.exit(0);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
