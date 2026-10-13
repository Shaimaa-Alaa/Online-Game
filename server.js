'use strict';
/* سباق المعرفة - سيرفر المباراة الحية
   السيرفر هو المصدر الوحيد للحالة: الأسئلة، تصحيح الإجابات، النقاط، الترتيب، وبداية السباق. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.PORT) || 3000;
const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD || '1234';
const SHEET_URL = process.env.SHEET_URL || '';        /* Google Apps Script web-app URL that writes into the teacher's Google Sheet */
const SHEET_TOKEN = process.env.SHEET_TOKEN || '';    /* shared secret between this server and that script */
const SHEET_LINK = process.env.SHEET_LINK || '';      /* optional: the sheet's normal URL, shown to the teacher as a button */
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PUB = path.join(__dirname, 'public');
const MAX_PLAYERS = 200;
const COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'black', 'white', 'orange', 'pink'];
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

/* ---------------- static files ---------------- */
const server = http.createServer((req, res) => {
  let url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/healthz') { res.writeHead(200); return res.end('ok'); }
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(PUB, url));
  if (!file.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
});

/* ---------------- helpers ---------------- */
const rooms = new Map();
const now = () => Date.now();
const rid = (n) => crypto.randomBytes(n).toString('hex');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cleanText = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, max);
const cleanName = (s) => cleanText(s, 40).replace(/\s+/g, ' ').trim().slice(0, 18);
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function newCode() { let c; do { c = String(Math.floor(100000 + Math.random() * 900000)); } while (rooms.has(c)); return c; }
function send(ws, msg) { if (ws && ws.readyState === 1) { try { ws.send(JSON.stringify(msg)); } catch (e) { /* ignore */ } } }

function sanitizeGame(g) {
  g = g || {};
  const title = cleanText(g.title, 60).trim() || 'سباق المعرفة';
  const st = g.settings || {};
  const settings = { shuffleQuestions: !!st.shuffleQuestions, shuffleChoices: !!st.shuffleChoices, count: clamp(parseInt(st.count, 10) || 0, 0, 100), lang: st.lang === 'en' ? 'en' : 'ar' };
  const qs = [];
  (Array.isArray(g.questions) ? g.questions : []).slice(0, 100).forEach((q, i) => {
    if (!q) return;
    const type = q.type === 'tf' ? 'tf' : q.type === 'short' ? 'short' : 'mcq';
    const text = cleanText(q.q, 500).trim();
    if (!text) return;
    let choices, answer = parseInt(q.answer, 10), accepted = [];
    if (type === 'short') {
      accepted = q.run && !q.essay                           /* coding question: each accepted answer is a whole (maybe multi-line) printed output */
        ? (Array.isArray(q.accepted) ? q.accepted : [String(q.accepted || '')]).map((a) => cleanText(a, 300).trim()).filter(Boolean).slice(0, 4)
        : (Array.isArray(q.accepted) ? q.accepted : [String(q.accepted || q.answerText || '')]).join('|').split(/[|\n،]/).map((a) => cleanText(a, 100).trim()).filter(Boolean).slice(0, 8);
      if (!accepted.length) return;
      choices = []; answer = 0;
    } else if (type === 'tf') { choices = settings.lang === 'en' ? ['True', 'False'] : ['صح', 'غلط']; if (!(answer === 0 || answer === 1)) answer = 0; }
    else {
      choices = (Array.isArray(q.choices) ? q.choices : []).slice(0, 4).map((c) => cleanText(c, 200).trim());
      while (choices.length < 4) choices.push('');
      if (!(answer >= 0 && answer < 4)) answer = 0;
      if (choices.filter(Boolean).length < 2 || !choices[answer]) return;
    }
    qs.push({
      id: 'q' + i, type, accepted, essay: type === 'short' && !!q.essay, run: type === 'short' && !q.essay && !!q.run, model: type === 'short' ? cleanText(q.model, 500).trim() : '', q: text, code: cleanText(q.code, 800).replace(/\s+$/, ''), choices, answer,
      secs: clamp(Math.round(Number(q.secs)) || 20, 5, 180), points: clamp(Math.round(Number(q.points)) || 100, 10, 1000),
      category: cleanText(q.category, 40), difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'medium',
    });
  });
  return { title, settings, questions: qs };
}

function norm(t) {
  return String(t || '').toLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776)).replace(/[.,،؛;:!؟?"'`]/g, '').replace(/\s+/g, ' ').trim();
}
function judge(q, a) {
  if (q.type === 'short' && q.essay) {                     /* essay: right when the answer mentions at least half of the teacher's key words */
    const t = norm(a.text), keys = q.accepted.map(norm).filter(Boolean);
    return !!t && keys.length > 0 && keys.filter((k) => t.includes(k)).length >= Math.ceil(keys.length / 2);
  }
  if (q.type === 'short' && q.run) { const f = (x) => String(x || '').replace(/\r/g, '').split('\n').map((l) => l.trimEnd()).join('\n').trim(); return !!f(a.text) && q.accepted.some((x) => f(x) === f(a.text)); }   /* coding question: the page runs the student's code and sends its printed output */
  if (q.type === 'short') { const t = norm(a.text); return !!t && q.accepted.some((x) => norm(x) === t); }
  return a.choice === q.answer;
}

/* the questions as they will be played: order/choices fixed once per room so every student sees the same thing */
function prepareRound(game) {
  let qs = game.questions.map((q) => ({ ...q }));
  const cnt = game.settings.count;
  if (cnt > 0 && cnt < qs.length) { const keep = new Set(shuffle(qs.map((q, i) => i)).slice(0, cnt)); qs = qs.filter((q, i) => keep.has(i)); }   /* "play N of the questions": a random N, original order kept */
  if (game.settings.shuffleQuestions) qs = shuffle(qs);
  qs = qs.map((q) => {
    if (q.type === 'short') return q;
    if (q.type === 'tf' || !game.settings.shuffleChoices) {
      if (q.type === 'mcq') { // drop empty choices but keep order
        const order = q.choices.map((t, i) => ({ t, i })).filter((o) => o.t);
        return { ...q, choices: order.map((o) => o.t), answer: order.findIndex((o) => o.i === q.answer) };
      }
      return q;
    }
    const order = shuffle(q.choices.map((t, i) => ({ t, i })).filter((o) => o.t));
    return { ...q, choices: order.map((o) => o.t), answer: order.findIndex((o) => o.i === q.answer) };
  });
  return qs;
}

function levelOf(acc) {
  if (acc >= 90) return { key: 'excellent', ar: 'ممتاز', en: 'Excellent' };
  if (acc >= 75) return { key: 'verygood', ar: 'جيد جدًا', en: 'Very Good' };
  if (acc >= 50) return { key: 'good', ar: 'جيد', en: 'Good' };
  return { key: 'practice', ar: 'يحتاج تدريب', en: 'Needs Practice' };
}

function board(room, detailed) {
  const total = room.qs.length || 1;
  const rows = [...room.players.values()].map((p) => {
    const answered = p.correct + p.wrong;
    const acc = answered ? Math.round((p.correct / total) * 100) : 0;
    const r = {
      id: p.id, name: p.name, color: p.color, score: p.score, correct: p.correct, wrong: p.wrong,
      progress: p.correct / total, connected: p.connected, ready: p.ready,
    };
    if (detailed) {
      r.accuracy = acc; r.level = levelOf(acc);
      r.fastest = p.fastest; r.avgTime = p.times.length ? Math.round(p.times.reduce((a, b) => a + b, 0) / p.times.length) : null;
    }
    r._t = p.times.reduce((a, b) => a + b, 0);
    return r;
  });
  rows.sort((a, b) => b.correct - a.correct || b.score - a.score || a._t - b._t || a.name.localeCompare(b.name));
  rows.forEach((r, i) => { r.rank = i + 1; delete r._t; });
  return rows;
}

function lobbyMsg(room) {
  return {
    t: 'lobby', code: room.code, title: room.title, total: room.qs.length, state: room.state, locked: room.state !== 'lobby',
    players: [...room.players.values()].map((p) => ({ id: p.id, name: p.name, color: p.color, ready: p.ready, connected: p.connected })),
  };
}
function broadcast(room, msg, onlyTeacher) {
  if (room.tws) send(room.tws, msg);
  if (onlyTeacher) return;
  room.players.forEach((p) => send(p.ws, msg));
}
function pushLobby(room) {
  /* coalesce bursts (e.g. 100 students scanning at once) into at most ~4 pushes per second */
  if (room.lobbyT) { room.lobbyDirty = true; return; }
  broadcast(room, lobbyMsg(room));
  room.lobbyT = setTimeout(() => { room.lobbyT = null; if (room.lobbyDirty) { room.lobbyDirty = false; pushLobby(room); } }, 250);
}

function questionMsg(room) {
  const q = room.qs[room.round];
  return { t: 'question', n: room.round, total: room.qs.length, type: q.type, essay: !!q.essay, run: !!q.run, q: q.q, code: q.code, choices: q.choices, secs: q.secs, points: q.points, difficulty: q.difficulty, category: q.category, endsAt: room.endsAt, serverNow: now() };
}


/* ---------------- published game + results store ----------------
   The Google Sheet is the permanent home (free hosts forget local files when they restart);
   a local file and memory are only a cache. */
let published = null;      /* { game, at } */
let results = [];          /* finished students */
let outbox = [];           /* results not yet confirmed by the sheet */
let sheetOk = null;        /* null = not configured / not tried, true, false */
const cmpRes = (a, b) => b.score - a.score || b.correct - a.correct || (a.timeSec || 0) - (b.timeSec || 0) || a.at - b.at;
const topList = (n) => [...results].sort(cmpRes).slice(0, n).map((r, i) => ({ rank: i + 1, name: r.name, score: r.score, correct: r.correct }));
function saveLocal() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(path.join(DATA_DIR, 'state.json'), JSON.stringify({ published, results })); } catch (e) { /* read-only disk: fine */ }
}
function loadLocal() {
  try { const j = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'state.json'), 'utf8')); if (j.published) published = j.published; if (Array.isArray(j.results)) results = j.results; } catch (e) { /* none yet */ }
}
async function sheetPost(body) {
  const r = await fetch(SHEET_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...body, token: SHEET_TOKEN }), signal: AbortSignal.timeout(20000) });
  const j = await r.json(); if (!j.ok) throw new Error(j.error || 'sheet error'); return j;
}
async function sheetGet(action) {
  const r = await fetch(SHEET_URL + (SHEET_URL.includes('?') ? '&' : '?') + 'action=' + action + '&token=' + encodeURIComponent(SHEET_TOKEN), { signal: AbortSignal.timeout(20000) });
  const j = await r.json(); if (!j.ok) throw new Error(j.error || 'sheet error'); return j;
}
function recordResult(r) {
  results.push(r); r.rankAtFinish = [...results].sort(cmpRes).indexOf(r) + 1;
  saveLocal();
  if (SHEET_URL) { outbox.push(r); flushOutbox(); }
  return r;
}
let flushing = false;
async function flushOutbox() {
  if (!SHEET_URL || flushing || !outbox.length) return;
  flushing = true;
  try {
    while (outbox.length) { const r = outbox[0]; await sheetPost({ action: 'result', row: r }); outbox.shift(); sheetOk = true; }
  } catch (e) { sheetOk = false; console.error('sheet write failed (will retry):', e.message); }
  flushing = false;
}
async function refreshFromSheet() {
  if (!SHEET_URL) return;
  try {
    const j = await sheetGet('list');
    if (Array.isArray(j.rows)) {
      const pend = outbox.filter((o) => !j.rows.some((x) => x.id === o.id));
      results = j.rows.concat(pend); sheetOk = true; saveLocal();
    }
  } catch (e) { sheetOk = false; console.error('sheet read failed:', e.message); }
}
async function loadGameFromSheet() {
  if (!SHEET_URL) return;
  try { const j = await sheetGet('getgame'); if (j.game && j.game.questions && j.game.questions.length) { published = { game: sanitizeGame(j.game), at: j.at || now() }; saveLocal(); } sheetOk = true; }
  catch (e) { sheetOk = false; console.error('sheet game load failed:', e.message); }
}
loadLocal();
if (SHEET_URL) { loadGameFromSheet().then(refreshFromSheet); setInterval(flushOutbox, 30000).unref(); }

/* ---------------- game flow ---------------- */
function startGame(room, cd) {
  cd = cd || 5000;
  if (room.state !== 'lobby') return;
  const connected = [...room.players.values()].filter((p) => p.connected);
  if (!connected.length) return;
  room.qs = prepareRound(room.game);
  if (!room.qs.length) return;
  room.state = 'countdown'; room.startAt = now() + cd; room.round = -1;
  room.players.forEach((p) => { p.score = 0; p.correct = 0; p.wrong = 0; p.times = []; p.fastest = null; });
  broadcast(room, { t: 'countdown', startAt: room.startAt, serverNow: now(), total: room.qs.length, lang: room.game.settings.lang });
  pushLobby(room);
  room.timer = setTimeout(() => nextQuestion(room), cd + 1800);
}

function nextQuestion(room) {
  clearTimeout(room.timer);
  room.round++;
  if (room.round >= room.qs.length) return finish(room);
  const q = room.qs[room.round];
  room.state = 'question'; room.answers = new Map(); room.qStart = now(); room.endsAt = room.qStart + q.secs * 1000; room.revealed = false;
  broadcast(room, questionMsg(room));
  broadcast(room, { t: 'answered', n: room.round, count: 0, of: [...room.players.values()].filter((p) => p.connected).length }, true);
  room.timer = setTimeout(() => reveal(room), q.secs * 1000 + 700);
}

function checkAllAnswered(room) {
  const conn = [...room.players.values()].filter((p) => p.connected);
  const done = conn.filter((p) => room.answers.has(p.id)).length;
  broadcast(room, { t: 'answered', n: room.round, count: done, of: conn.length }, true);
  if (conn.length && done >= conn.length) {
    clearTimeout(room.timer);
    room.timer = setTimeout(() => reveal(room), room.solo ? 450 : 700);
  }
}

function reveal(room) {
  if (room.state !== 'question' || room.revealed) return;
  clearTimeout(room.timer);
  room.revealed = true; room.state = 'reveal';
  const q = room.qs[room.round];
  const per = {}; const dist = q.type === 'short' ? null : q.choices.map(() => 0);
  room.players.forEach((p) => {
    const a = room.answers.get(p.id);
    if (a) {
      const ok = a.ok, pts = a.pts;
      if (dist) dist[a.choice]++;
      if (ok) { p.correct++; p.score += pts; } else p.wrong++;
      p.times.push(a.ms);
      if (ok && (p.fastest == null || a.ms < p.fastest)) p.fastest = a.ms;
      per[p.id] = { ok, pts, choice: a.choice, text: a.text };
    } else { p.wrong++; per[p.id] = { ok: false, pts: 0, choice: -1 }; }
  });
  room.lastReveal = { t: 'reveal', n: room.round, total: room.qs.length, correct: q.type === 'short' ? (q.essay && q.model ? q.model : q.essay ? q.accepted.join('، ') : q.accepted[0]) : q.answer, qtype: q.type, per, dist, board: board(room), last: room.round + 1 >= room.qs.length };
  broadcast(room, room.lastReveal);
  room.timer = setTimeout(() => nextQuestion(room), room.lastReveal.last ? (room.solo ? 2600 : 4200) : (room.solo ? 1200 : 3800));
}

function finish(room) {
  clearTimeout(room.timer);
  room.state = 'finished';
  const rows = board(room, true);
  room.results = { t: 'results', title: room.title, total: room.qs.length, board: rows, questions: room.qs.length };
  if (room.solo) {
    const p = [...room.players.values()][0], me = rows[0];
    if (p && me && p.times.length && !room.recorded) {            /* a student who never answered anything is not recorded */
      room.recorded = true;
      const rec = recordResult({
        id: rid(6), at: now(), name: p.name, score: p.score, correct: p.correct, wrong: p.wrong, total: room.qs.length,
        accuracy: me.accuracy, level: me.level.en, fastest: me.fastest != null ? Math.round(me.fastest / 100) / 10 : '',
        timeSec: Math.round(p.times.reduce((a, b) => a + b, 0) / 100) / 10, title: room.title,
      });
      room.results.solo = { rank: rec.rankAtFinish, of: results.length, top: topList(5), saved: true };
    } else room.results.solo = { rank: null, of: results.length, top: topList(5), saved: false };
  }
  broadcast(room, room.results);
}

/* ---------------- sockets ---------------- */
function snapshotFor(room, ws, isTeacher, player) {
  send(ws, lobbyMsg(room));
  if (room.state === 'countdown') send(ws, { t: 'countdown', startAt: room.startAt, serverNow: now(), total: room.qs.length, lang: room.game.settings.lang });
  if (room.state === 'question') {
    send(ws, questionMsg(room));
    if (player && room.answers.has(player.id)) { const a = room.answers.get(player.id); send(ws, { t: 'ack', n: room.round, choice: a.choice, text: a.text, ok: a.ok, pts: a.pts }); }
    if (isTeacher) checkAllAnsweredSilent(room);
  }
  if (room.state === 'reveal' && room.lastReveal) { send(ws, questionMsg(room)); send(ws, room.lastReveal); }
  if (room.state === 'finished' && room.results) send(ws, room.results);
  if (room.lastReveal && room.state !== 'finished') send(ws, { t: 'board', board: room.lastReveal.board });
}
function checkAllAnsweredSilent(room) {
  const conn = [...room.players.values()].filter((p) => p.connected);
  send(room.tws, { t: 'answered', n: room.round, count: conn.filter((p) => room.answers.has(p.id)).length, of: conn.length });
}

const wss = new WebSocketServer({ server, maxPayload: 256 * 1024 });
wss.on('connection', (ws) => {
  ws.isAlive = true; ws.room = null; ws.role = null; ws.pid = null; ws.msgs = 0;
  ws.on('pong', () => { ws.isAlive = true; });
  const rl = setInterval(() => { ws.msgs = 0; }, 2000);
  ws.on('close', () => {
    clearInterval(rl);
    const room = ws.room; if (!room) return;
    if (ws.role === 'teacher' && room.tws === ws) { room.tws = null; }
    if (ws.role === 'student') {
      const p = room.players.get(ws.pid);
      if (p && p.ws === ws) {
        p.ws = null; p.connected = false;
        if (room.state === 'lobby') { /* keep the seat so a refresh doesn't lose the player */ }
        pushLobby(room);
        if (room.state === 'question') checkAllAnswered(room);
      }
    }
  });
  ws.on('message', (raw) => {
    if (++ws.msgs > 40) return;
    let m; try { m = JSON.parse(String(raw)); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    try { handle(ws, m); } catch (e) { console.error('handler error', e); send(ws, { t: 'error', msg: 'حصل خطأ في السيرفر.' }); }
  });
});

function handle(ws, m) {
  if (m.t === 'ping') return send(ws, { t: 'pong', c: m.c, s: now() });


  /* ----- solo mode: one student plays the published game alone; the result goes to the sheet ----- */
  if (m.t === 'solo') {
    if (!published) {
      if (SHEET_URL) { return loadGameFromSheet().then(() => { if (published) handle(ws, m); else send(ws, { t: 'error', code: 'nogame', msg: 'No game is published yet. Please ask your teacher.' }); }); }
      return send(ws, { t: 'error', code: 'nogame', msg: 'No game is published yet. Please ask your teacher.' });
    }
    if (ws.room) return;                                   /* one game per connection */
    const name = cleanName(m.name); if (!name) return send(ws, { t: 'error', code: 'name', msg: 'Please enter your name.' });
    const game = published.game;
    const room = {
      code: newCode(), tkey: rid(12), solo: true, title: game.title, game, qs: game.questions, players: new Map(), state: 'lobby', round: -1,
      tws: null, created: now(), last: now(), timer: null, answers: new Map(), revealed: false, lastReveal: null, results: null,
    };
    const color = COLORS.includes(m.color) ? m.color : COLORS[0];
    const p = { id: 'p' + rid(3), token: rid(12), name, color, ready: true, ws, connected: true, score: 0, correct: 0, wrong: 0, times: [], fastest: null };
    room.players.set(p.id, p); rooms.set(room.code, room);
    ws.room = room; ws.role = 'student'; ws.pid = p.id;
    send(ws, { t: 'joined', pid: p.id, token: p.token, code: room.code, name: p.name, color: p.color, solo: true });
    pushLobby(room);                                      /* the race scene is built from the lobby's player list, so it must arrive before the countdown */
    return startGame(room, 3500);
  }
  if (m.t === 'publish' || m.t === 'tlist') {
    if (m.pass !== TEACHER_PASSWORD) return send(ws, { t: 'error', code: 'pass', msg: 'كلمة سر المعلمة غير صحيحة.' });
    if (m.t === 'publish') {
      const game = sanitizeGame(m.game);
      if (!game.questions.length) return send(ws, { t: 'error', msg: 'اختاري سؤالًا واحدًا على الأقل (وتأكدي إنه مكتمل).' });
      published = { game, at: now() }; saveLocal();
      const done = (saved, err) => send(ws, { t: 'published', title: game.title, n: game.questions.length, saved, err: err || '' });
      if (!SHEET_URL) return done(false, 'nosheet');
      return sheetPost({ action: 'setgame', game, at: published.at }).then(() => { sheetOk = true; done(true); }).catch((e) => { sheetOk = false; done(false, e.message); });
    }
    const reply = () => send(ws, {
      t: 'tlist', rows: results, game: published ? { title: published.game.title, n: published.game.questions.length, at: published.at } : null,
      sheet: { configured: !!SHEET_URL, ok: sheetOk, link: SHEET_LINK, pending: outbox.length },
    });
    if (!SHEET_URL) return reply();
    return refreshFromSheet().then(reply);
  }

  /* ----- teacher ----- */
  if (m.t === 'tauth') return send(ws, { t: 'tauth', ok: !TEACHER_PASSWORD || m.pass === TEACHER_PASSWORD, needpass: !!TEACHER_PASSWORD });
  if (m.t === 'create') {
    if (TEACHER_PASSWORD && m.pass !== TEACHER_PASSWORD) return send(ws, { t: 'error', code: 'pass', msg: 'كلمة سر المعلمة غير صحيحة.' });
    const game = sanitizeGame(m.game);
    if (!game.questions.length) return send(ws, { t: 'error', msg: 'اختاري سؤالًا واحدًا على الأقل (وتأكدي إنه مكتمل).' });
    const room = {
      code: newCode(), tkey: rid(12), title: game.title, game, qs: game.questions, players: new Map(), state: 'lobby', round: -1,
      tws: ws, created: now(), last: now(), timer: null, answers: new Map(), revealed: false, lastReveal: null, results: null,
    };
    rooms.set(room.code, room);
    ws.room = room; ws.role = 'teacher';
    send(ws, { t: 'created', code: room.code, tkey: room.tkey });
    return pushLobby(room);
  }
  if (m.t === 'tjoin') {
    const room = rooms.get(String(m.code));
    if (!room || room.tkey !== m.tkey) return send(ws, { t: 'error', code: 'gone', msg: 'الغرفة دي مش موجودة أو انتهت.' });
    room.tws = ws; ws.room = room; ws.role = 'teacher'; room.last = now();
    send(ws, { t: 'created', code: room.code, tkey: room.tkey, resumed: true });
    return snapshotFor(room, ws, true, null);
  }
  if (ws.role === 'teacher' && ws.room) {
    const room = ws.room; room.last = now();
    if (m.t === 'start') return startGame(room);
    if (m.t === 'kick') {
      const p = room.players.get(m.pid); if (!p) return;
      send(p.ws, { t: 'kicked' }); if (p.ws) p.ws.close();
      room.players.delete(p.id); return pushLobby(room);
    }
    if (m.t === 'skip' && room.state === 'question') return reveal(room);
    if (m.t === 'close') {
      clearTimeout(room.timer); broadcast(room, { t: 'closed' }); rooms.delete(room.code); return;
    }
    return;
  }

  /* ----- student ----- */
  if (m.t === 'join') {
    const room = rooms.get(String(m.code || '').trim());
    if (!room) return send(ws, { t: 'error', code: 'nocode', msg: 'الكود ده مش صح. اسألي معلمتك عن الكود الجديد.' });
    if (room.state !== 'lobby') return send(ws, { t: 'error', code: 'locked', msg: 'السباق بدأ بالفعل، مش ممكن الدخول دلوقتي.' });
    if (room.players.size >= MAX_PLAYERS) return send(ws, { t: 'error', msg: 'الغرفة اتملت.' });
    let name = cleanName(m.name); if (!name) return send(ws, { t: 'error', code: 'name', msg: 'اكتب اسمك الأول.' });
    const names = new Set([...room.players.values()].map((p) => p.name));
    if (names.has(name)) { let k = 2; while (names.has(name + ' ' + k)) k++; name = name + ' ' + k; }
    const color = COLORS.includes(m.color) ? m.color : COLORS[0];   /* with 100+ players colours repeat; names tell cars apart */
    const p = { id: 'p' + rid(3), token: rid(12), name, color, ready: true, ws, connected: true, score: 0, correct: 0, wrong: 0, times: [], fastest: null };
    room.players.set(p.id, p); ws.room = room; ws.role = 'student'; ws.pid = p.id; room.last = now();
    send(ws, { t: 'joined', pid: p.id, token: p.token, code: room.code, name: p.name, color: p.color });
    return pushLobby(room);
  }
  if (m.t === 'rejoin') {
    const room = rooms.get(String(m.code || ''));
    const p = room && [...room.players.values()].find((x) => x.token === m.token);
    if (!p) return send(ws, { t: 'error', code: 'gone', msg: 'مقدرناش نرجّعك للسباق.' });
    if (p.ws && p.ws !== ws) { try { p.ws.close(); } catch (e) { /* ignore */ } }
    p.ws = ws; p.connected = true; ws.room = room; ws.role = 'student'; ws.pid = p.id; room.last = now();
    send(ws, { t: 'joined', pid: p.id, token: p.token, code: room.code, name: p.name, color: p.color, resumed: true, solo: !!room.solo });
    pushLobby(room);
    return snapshotFor(room, ws, false, p);
  }
  const room = ws.room; if (!room || ws.role !== 'student') return;
  const p = room.players.get(ws.pid); if (!p) return;
  room.last = now();
  if (m.t === 'ready' && room.state === 'lobby') { p.ready = !!m.v; return pushLobby(room); }
  if (m.t === 'color' && room.state === 'lobby' && COLORS.includes(m.color)) { p.color = m.color; return pushLobby(room); }
  if (m.t === 'answer') {
    if (room.state !== 'question' || m.n !== room.round || room.answers.has(p.id)) return;
    const q = room.qs[room.round]; const a = { choice: -1, text: '' };
    if (q.type === 'short') { a.text = cleanText(m.text, 300).trim(); if (!a.text) return; }
    else { const c = parseInt(m.choice, 10); if (!(c >= 0 && c < q.choices.length)) return; a.choice = c; }
    if (now() > room.endsAt + 500) return;
    a.ms = clamp(now() - room.qStart, 0, q.secs * 1000);
    a.ok = judge(q, a);
    a.pts = a.ok ? Math.round(q.points * (0.5 + 0.5 * clamp(1 - a.ms / (q.secs * 1000), 0, 1))) : 0;
    room.answers.set(p.id, a);
    send(ws, { t: 'ack', n: room.round, choice: a.choice, text: a.text, ok: a.ok, pts: a.pts });
    return checkAllAnswered(room);
  }
}

/* keep-alive and cleanup */
setInterval(() => {
  wss.clients.forEach((ws) => { if (!ws.isAlive) return ws.terminate(); ws.isAlive = false; try { ws.ping(); } catch (e) { /* ignore */ } });
  const t = now();
  rooms.forEach((r, code) => { if (t - r.last > (r.solo ? 40 * 60 * 1000 : 6 * 3600 * 1000)) { clearTimeout(r.timer); rooms.delete(code); } });
}, 25000).unref();

if (require.main === module) {
  server.listen(PORT, () => console.log('Quiz Race server on http://localhost:' + PORT + (TEACHER_PASSWORD ? ' (teacher password on)' : '')));
}
module.exports = { server, rooms, sanitizeGame, board, levelOf, getState: () => ({ published, results, outbox }) };
