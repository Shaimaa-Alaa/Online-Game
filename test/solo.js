'use strict';
/* solo mode + sheet bridge: a mock "Apps Script" web app stands in for the Google Sheet */
const http = require('http'); const assert = require('assert'); const { spawn } = require('child_process'); const path = require('path'); const os = require('os'); const fs = require('fs');
const WebSocket = require('ws');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rowsDB = []; let gameDB = null; const TOKEN = 'sekret';
const mock = http.createServer((req, res) => {
  let b = ''; req.on('data', (d) => { b += d; }); req.on('end', () => {
    const u = new URL(req.url, 'http://x'); const out = (o) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
    if (req.method === 'POST') {
      const d = JSON.parse(b); if (d.token !== TOKEN) return out({ ok: false, error: 'token' });
      if (d.action === 'result') { if (!rowsDB.some((r) => r.id === d.row.id)) rowsDB.push(d.row); return out({ ok: true }); }
      if (d.action === 'setgame') { gameDB = { game: d.game, at: d.at }; return out({ ok: true }); }
    } else {
      if (u.searchParams.get('token') !== TOKEN) return out({ ok: false, error: 'token' });
      if (u.searchParams.get('action') === 'list') return out({ ok: true, rows: rowsDB });
      if (u.searchParams.get('action') === 'getgame') return out({ ok: true, game: gameDB && gameDB.game, at: gameDB && gameDB.at });
    }
    out({ ok: false });
  });
});
function client(url) { const ws = new WebSocket(url), log = []; ws.on('message', (d) => log.push(JSON.parse(d)));
  return { ws, log, open: new Promise((r) => ws.on('open', r)), send: (m) => ws.send(JSON.stringify(m)),
    async wait(f, ms = 15000) { const t0 = Date.now(); for (;;) { const m = log.find(f); if (m) return m; if (Date.now() - t0 > ms) throw new Error('timeout'); await sleep(30); } } }; }
function startServer(env) { const p = spawn('node', ['server.js'], { cwd: path.join(__dirname, '..'), env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'inherit'] }); return new Promise((r) => p.stdout.on('data', () => r(p))); }
(async () => {
  await new Promise((r) => mock.listen(3199, r));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbq-'));
  const env = { PORT: '3198', SHEET_URL: 'http://localhost:3199/exec', SHEET_TOKEN: TOKEN, DATA_DIR: dir };
  let srv = await startServer(env); const url = 'ws://localhost:3198';
  try {
    // no game yet
    let X = client(url); await X.open; X.send({ t: 'solo', name: 'Early', color: 'red' });
    assert.strictEqual((await X.wait((m) => m.t === 'error')).code, 'nogame');
    // wrong teacher password
    const T = client(url); await T.open; T.send({ t: 'publish', pass: 'nope', game: {} });
    assert.strictEqual((await T.wait((m) => m.t === 'error')).code, 'pass');
    const qs = [0, 1, 2].map((i) => ({ type: 'mcq', q: 'Q' + i, choices: ['a', 'b', 'c', 'd'], answer: i, secs: 6, points: 100 }));
    T.send({ t: 'publish', pass: '1234', game: { title: 'T', questions: qs, settings: {} } });
    const pub = await T.wait((m) => m.t === 'published'); assert(pub.saved && pub.n === 3);
    assert(gameDB && gameDB.game.questions.length === 3, 'game stored in sheet');
    // two students play alone
    async function play(name, correctN) {
      const c = client(url); await c.open; c.send({ t: 'solo', name, color: 'blue' });
      const j = await c.wait((m) => m.t === 'joined'); assert(j.solo);
      let n = 0;
      c.ws.on('message', (d) => { const m = JSON.parse(d); if (m.t === 'question') { const a = qs[m.n]; /* answer by text match since choices are shuffled */ const idx = m.choices.indexOf(a.choices[a.answer]); const right = n++ < correctN; c.send({ t: 'answer', n: m.n, choice: right ? idx : (idx + 1) % 4 }); } });
      const res = await c.wait((m) => m.t === 'results', 40000); return res;
    }
    const [r1, r2] = await Promise.all([play('Ali', 3), play('Mona', 1)]);
    assert.strictEqual(r1.board[0].correct, 3); assert.strictEqual(r2.board[0].wrong, 2);
    await sleep(500);
    assert.strictEqual(rowsDB.length, 2, 'both results reached the sheet');
    const ali = rowsDB.find((r) => r.name === 'Ali'), mona = rowsDB.find((r) => r.name === 'Mona');
    assert(ali.score > mona.score && ali.wrong === 0 && mona.wrong === 2 && ali.total === 3);
    assert.strictEqual(r1.solo.of >= 1, true);
    // a student who quits without answering is not recorded
    const Q = client(url); await Q.open; Q.send({ t: 'solo', name: 'Ghost', color: 'red' }); await Q.wait((m) => m.t === 'joined'); Q.ws.close();
    // teacher list (read through the sheet)
    const T2 = client(url); await T2.open; T2.send({ t: 'tlist', pass: '1234' });
    const L = await T2.wait((m) => m.t === 'tlist'); assert.strictEqual(L.rows.length, 2); assert(L.sheet.configured && L.sheet.ok); assert.strictEqual(L.game.n, 3);
    // restart the server: game and results come back from the sheet
    srv.kill(); await sleep(400); srv = await startServer({ ...env, DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'sbq-')) }); await sleep(800);
    const S2 = client(url); await S2.open; S2.send({ t: 'solo', name: 'Late', color: 'green' });
    assert((await S2.wait((m) => m.t === 'joined')).solo, 'game restored from sheet after restart');
    const T3 = client(url); await T3.open; T3.send({ t: 'tlist', pass: '1234' }); assert.strictEqual((await T3.wait((m) => m.t === 'tlist')).rows.length, 2);
    console.log('SOLO OK'); 
  } finally { srv.kill(); mock.close(); }
  process.exit(0);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
