/* Local stand-in for the game server: the whole solo game runs inside this page, so it works as a plain shared link.
   Results are NOT sent anywhere (a static page cannot reach a server); the student sees a result card to screenshot. */
(function () {
  var COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'black', 'white', 'orange', 'pink'];
  var now = function () { return Date.now(); };
  var rid = function (n) { var s = ''; for (var i = 0; i < n * 2; i++) s += Math.floor(Math.random() * 16).toString(16); return s; };
  /*__HELPERS__*/
  var GAME = sanitizeGame(window.__DEFAULT_GAME);
  function LocalSocket() {
    var me = this; me.readyState = 0; me.room = null;
    setTimeout(function () { me.readyState = 1; if (me.onopen) me.onopen(); }, 30);
  }
  LocalSocket.prototype.emit = function (m) { var me = this; setTimeout(function () { if (me.readyState === 1 && me.onmessage) me.onmessage({ data: JSON.stringify(m) }); }, 0); };
  LocalSocket.prototype.close = function () { this.readyState = 3; if (this.room) clearTimeout(this.room.timer); if (this.onclose) this.onclose(); };
  LocalSocket.prototype.send = function (raw) {
    var m; try { m = JSON.parse(raw); } catch (e) { return; } var me = this;
    if (m.t === 'ping') return me.emit({ t: 'pong', c: m.c, s: now() });
    if (m.t === 'rejoin') return me.emit({ t: 'error', code: 'gone', msg: 'gone' });
    if (m.t === 'solo') {
      if (me.room) return;
      var name = cleanName(m.name); if (!name) return me.emit({ t: 'error', code: 'name', msg: 'Please enter your name.' });
      var color = COLORS.indexOf(m.color) >= 0 ? m.color : COLORS[0];
      var p = { id: 'p' + rid(3), token: rid(12), name: name, color: color, score: 0, correct: 0, wrong: 0, times: [], fastest: null };
      var room = me.room = { qs: prepareRound(GAME), p: p, round: -1, state: 'countdown', answers: null, timer: null, title: GAME.title };
      me.emit({ t: 'joined', pid: p.id, token: p.token, code: 'LOCAL', name: p.name, color: p.color, solo: true });
      me.emit({ t: 'lobby', code: 'LOCAL', title: room.title, total: room.qs.length, state: 'lobby', locked: false, players: [{ id: p.id, name: p.name, color: p.color, ready: true, connected: true }] });
      me.emit({ t: 'countdown', startAt: now() + 3500, serverNow: now(), total: room.qs.length });
      room.timer = setTimeout(function () { me.next(); }, 3500 + 1800);
      return;
    }
    var room = me.room; if (!room) return;
    if (m.t === 'answer') {
      if (room.state !== 'question' || m.n !== room.round || room.answers) return;
      var q = room.qs[room.round], a = {};
      if (q.type === 'short') { a.text = cleanText(m.text, 100).trim(); if (!a.text) return; }
      else { var c = parseInt(m.choice, 10); if (!(c >= 0 && c < q.choices.length)) return; a.choice = c; }
      if (now() > room.endsAt + 500) return;
      a.ms = clamp(now() - room.qStart, 0, q.secs * 1000); a.ok = judge(q, a);
      a.pts = a.ok ? Math.round(q.points * (0.5 + 0.5 * clamp(1 - a.ms / (q.secs * 1000), 0, 1))) : 0;
      room.answers = a;
      me.emit({ t: 'ack', n: room.round, choice: a.choice, text: a.text, ok: a.ok, pts: a.pts });
      clearTimeout(room.timer); room.timer = setTimeout(function () { me.reveal(); }, 700);
    }
  };
  LocalSocket.prototype.next = function () {
    var me = this, room = me.room; if (!room) return;
    room.round++;
    if (room.round >= room.qs.length) return me.finish();
    var q = room.qs[room.round];
    room.state = 'question'; room.answers = null; room.qStart = now(); room.endsAt = room.qStart + q.secs * 1000;
    me.emit({ t: 'question', n: room.round, total: room.qs.length, type: q.type, q: q.q, code: q.code, choices: q.choices, secs: q.secs, points: q.points, difficulty: q.difficulty, category: q.category, endsAt: room.endsAt, serverNow: now() });
    room.timer = setTimeout(function () { me.reveal(); }, q.secs * 1000 + 700);
  };
  LocalSocket.prototype.row = function (detailed) {
    var p = this.me ? this.me : this.room.p, total = this.room.qs.length || 1, acc = p.correct + p.wrong ? Math.round(p.correct / total * 100) : 0;
    var r = { id: p.id, name: p.name, color: p.color, score: p.score, correct: p.correct, wrong: p.wrong, progress: p.correct / total, connected: true, ready: true, rank: 1 };
    if (detailed) { r.accuracy = acc; r.level = levelOf(acc); r.fastest = p.fastest; r.avgTime = p.times.length ? Math.round(p.times.reduce(function (x, y) { return x + y; }, 0) / p.times.length) : null; }
    return r;
  };
  LocalSocket.prototype.reveal = function () {
    var me = this, room = me.room; if (!room || room.state !== 'question') return;
    clearTimeout(room.timer); room.state = 'reveal';
    var q = room.qs[room.round], p = room.p, a = room.answers, per = {}, dist = q.type === 'short' ? null : q.choices.map(function () { return 0; });
    if (a) { if (dist) dist[a.choice]++; if (a.ok) { p.correct++; p.score += a.pts; } else p.wrong++; p.times.push(a.ms); if (a.ok && (p.fastest == null || a.ms < p.fastest)) p.fastest = a.ms; per[p.id] = { ok: a.ok, pts: a.pts, choice: a.choice, text: a.text }; }
    else { p.wrong++; per[p.id] = { ok: false, pts: 0, choice: -1 }; }
    var last = room.round + 1 >= room.qs.length;
    me.emit({ t: 'reveal', n: room.round, total: room.qs.length, correct: q.type === 'short' ? q.accepted[0] : q.answer, qtype: q.type, per: per, dist: dist, board: [me.row(false)], last: last });
    room.timer = setTimeout(function () { me.next(); }, last ? 4200 : 3800);
  };
  LocalSocket.prototype.finish = function () {
    var room = this.room; room.state = 'finished';
    var row = this.row(true);
    this.emit({ t: 'results', title: room.title, total: room.qs.length, board: [row], questions: room.qs.length, solo: { rank: 1, of: 1, top: [], saved: false, local: true } });
  };
  window.WebSocket = LocalSocket;
})();
