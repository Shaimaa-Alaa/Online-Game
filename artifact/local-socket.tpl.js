/* Local stand-in for the game server: the whole game runs inside this page, so it works as a plain shared link.
   The other cars are computer-controlled racers; nothing is sent anywhere (a static page cannot reach a server). */
(function () {
  var COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'black', 'white', 'orange', 'pink'];
  var TEACHER_PASS = '1234';
  var now = function () { return Date.now(); };
  var rid = function (n) { var s = ''; for (var i = 0; i < n * 2; i++) s += Math.floor(Math.random() * 16).toString(16); return s; };
  /*__HELPERS__*/
  var GAME = sanitizeGame(window.__DEFAULT_GAME);
  window.__LOCAL = { base: '__BASE__', sanitize: sanitizeGame, getGame: function () { return GAME; }, setGame: function (g) { GAME = g; } };

  var BOT_NAMES = ['Omar', 'Lina', 'Youssef', 'Mariam', 'Adam', 'Salma', 'Karim', 'Nour', 'Hassan', 'Jana', 'Ziad', 'Rana', 'Sara', 'Malak', 'Tamer'];
  function makeBots(playerColor) {
    var cols = shuffle(COLORS.filter(function (c) { return c !== playerColor; })), names = shuffle(BOT_NAMES), n = cols.length;
    var acc = shuffle(cols.map(function (c, i) { return 0.45 + 0.47 * (i / Math.max(1, n - 1)); })), spd = shuffle(cols.map(function (c, i) { return 0.2 + 0.5 * (i / Math.max(1, n - 1)); }));
    return cols.map(function (c, i) { return { id: 'b' + i + rid(2), name: names[i], color: c, acc: acc[i], speed: spd[i], score: 0, correct: 0, wrong: 0, times: [], fastest: null, bot: true }; });
  }
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
    if (m.t === 'tauth') return me.emit({ t: 'tauth', ok: m.pass === TEACHER_PASS, needpass: true });
    if (m.t === 'solo') {
      if (me.room) { if (me.room.state !== 'finished') return; clearTimeout(me.room.timer); me.room = null; }
      var name = cleanName(m.name); if (!name) return me.emit({ t: 'error', code: 'name', msg: 'Please enter your name.' });
      var color = COLORS.indexOf(m.color) >= 0 ? m.color : COLORS[0];
      var p = { id: 'p' + rid(3), token: rid(12), name: name, color: color, score: 0, correct: 0, wrong: 0, times: [], fastest: null };
      var qs = prepareRound(GAME);
      var room = me.room = { qs: qs, p: p, bots: makeBots(color), round: -1, state: 'countdown', answers: null, timer: null, title: GAME.title, lang: GAME.settings.lang };
      me.emit({ t: 'joined', pid: p.id, token: p.token, code: 'LOCAL', name: p.name, color: p.color, solo: true });
      me.emit({ t: 'lobby', code: 'LOCAL', title: room.title, total: qs.length, state: 'lobby', locked: false, players: [p].concat(room.bots).map(function (x) { return { id: x.id, name: x.name, color: x.color, ready: true, connected: true }; }) });
      me.emit({ t: 'countdown', startAt: now() + 3500, serverNow: now(), total: qs.length, lang: room.lang });
      room.timer = setTimeout(function () { me.next(); }, 3500 + 1800);
      return;
    }
    var room = me.room; if (!room) return;
    if (m.t === 'answer') {
      if (room.state !== 'question' || m.n !== room.round || room.answers) return;
      var q = room.qs[room.round], a = {};
      if (q.type === 'short') { a.text = cleanText(m.text, 300).trim(); if (!a.text) return; }
      else { var c = parseInt(m.choice, 10); if (!(c >= 0 && c < q.choices.length)) return; a.choice = c; }
      if (now() > room.endsAt + 500) return;
      a.ms = clamp(now() - room.qStart, 0, q.secs * 1000); a.ok = judge(q, a);
      a.pts = a.ok ? Math.round(q.points * (0.5 + 0.5 * clamp(1 - a.ms / (q.secs * 1000), 0, 1))) : 0;
      room.answers = a;
      me.emit({ t: 'ack', n: room.round, choice: a.choice, text: a.text, ok: a.ok, pts: a.pts });
      clearTimeout(room.timer); room.timer = setTimeout(function () { me.reveal(); }, 450);
    }
  };
  LocalSocket.prototype.next = function () {
    var me = this, room = me.room; if (!room) return;
    room.round++;
    if (room.round >= room.qs.length) return me.finish();
    var q = room.qs[room.round];
    room.state = 'question'; room.answers = null; room.qStart = now(); room.endsAt = room.qStart + q.secs * 1000;
    me.emit({ t: 'question', n: room.round, total: room.qs.length, type: q.type, essay: !!q.essay, run: !!q.run, q: q.q, code: q.code, choices: q.choices, secs: q.secs, points: q.points, difficulty: q.difficulty, category: q.category, endsAt: room.endsAt, serverNow: now() });
    room.timer = setTimeout(function () { me.reveal(); }, q.secs * 1000 + 700);
  };
  /* everyone sorted like the real server: more correct answers first, then more points (= faster answers), then less total time */
  LocalSocket.prototype.board = function (detailed) {
    var room = this.room, total = room.qs.length || 1;
    var rows = [room.p].concat(room.bots).map(function (p) {
      var acc = Math.round(p.correct / total * 100), r = { id: p.id, name: p.name, color: p.color, score: p.score, correct: p.correct, wrong: p.wrong, progress: p.correct / total, connected: true, ready: true };
      if (detailed) { r.accuracy = acc; r.level = levelOf(acc); r.fastest = p.fastest; r.avgTime = p.times.length ? Math.round(p.times.reduce(function (x, y) { return x + y; }, 0) / p.times.length) : null; }
      r._t = p.times.reduce(function (x, y) { return x + y; }, 0); return r;
    });
    var pid = room.p.id;
    rows.sort(function (a, b) { return b.correct - a.correct || b.score - a.score || (b.id === pid) - (a.id === pid) || a._t - b._t || a.name.localeCompare(b.name); });
    rows.forEach(function (r, i) { r.rank = i + 1; delete r._t; });
    return rows;
  };
  LocalSocket.prototype.reveal = function () {
    var me = this, room = me.room; if (!room || room.state !== 'question') return;
    clearTimeout(room.timer); room.state = 'reveal';
    var q = room.qs[room.round], p = room.p, a = room.answers, per = {}, dist = q.type === 'short' ? null : q.choices.map(function () { return 0; });
    if (a) { if (dist) dist[a.choice]++; if (a.ok) { p.correct++; p.score += a.pts; } else p.wrong++; p.times.push(a.ms); if (a.ok && (p.fastest == null || a.ms < p.fastest)) p.fastest = a.ms; per[p.id] = { ok: a.ok, pts: a.pts, choice: a.choice, text: a.text }; }
    else { p.wrong++; p.times.push(q.secs * 1000); per[p.id] = { ok: false, pts: 0, choice: -1 }; }
    room.bots.forEach(function (b) {                         /* the computer racers answer now, with their own accuracy and speed */
      var secs = q.secs, timeout = Math.random() < 0.04;
      var ok = !timeout && Math.random() < b.acc * (q.type === 'short' ? 0.8 : 1);
      var frac = timeout ? 1 : clamp(b.speed + (Math.random() + Math.random() + Math.random() - 1.5) * 0.18, 0.08, 0.97), ms = Math.round(frac * secs * 1000);
      if (ok) { b.correct++; b.score += Math.round(q.points * (0.5 + 0.5 * clamp(1 - frac, 0, 1))); if (b.fastest == null || ms < b.fastest) b.fastest = ms; } else b.wrong++;
      b.times.push(ms);
    });
    /* finishing place: a perfect run always wins; with mistakes the child can still take 1st or 2nd; 3rd only when most answers were wrong.
       Rivals are computer racers, so we shape how many of them may be ahead (never more than the place allows). */
    var last = room.round + 1 >= room.qs.length, total = room.qs.length || 1;
    var ahead = p.wrong === 0 ? 0 : 2;                                   /* during the race: nobody may beat a clean run */
    if (last) {
      var acc = p.correct / total;
      ahead = p.wrong === 0 ? 0 : acc >= 0.75 ? (Math.random() < 0.45 ? 0 : 1) : acc >= 0.4 ? 1 : 2;
    }
    var lead = room.bots.slice().sort(function (x, y) { return y.acc - x.acc; }).slice(0, ahead);
    room.bots.forEach(function (b) {
      if (lead.indexOf(b) >= 0) {                                         /* a leader must really be ahead on the final board */
        if (last && (b.correct < p.correct || (b.correct === p.correct && b.score <= p.score))) { b.correct = Math.max(b.correct, p.correct); b.score = Math.max(b.score, p.score + 25 + Math.floor(Math.random() * 40)); }
        return;
      }
      if (b.correct > p.correct) { b.wrong += b.correct - p.correct; b.correct = p.correct; b.score = Math.min(b.score, Math.max(0, p.score - 1)); }
      else if (b.correct === p.correct && b.score >= p.score) b.score = Math.max(0, p.score - 1);
    });
    me.emit({ t: 'reveal', n: room.round, total: room.qs.length, correct: q.type === 'short' ? (q.essay && q.model ? q.model : q.essay ? q.accepted.join('، ') : q.accepted[0]) : q.answer, qtype: q.type, per: per, dist: dist, board: me.board(false), last: last });
    room.timer = setTimeout(function () { me.next(); }, last ? 2600 : 1200);
  };
  LocalSocket.prototype.finish = function () {
    var room = this.room; room.state = 'finished';
    this.emit({ t: 'results', title: room.title, total: room.qs.length, board: this.board(true), questions: room.qs.length, solo: { local: true, rivals: true, saved: false } });
  };
  window.WebSocket = LocalSocket;
})();
