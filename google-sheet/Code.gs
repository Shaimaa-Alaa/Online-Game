/* Quiz Race -> Google Sheets bridge.
   Paste this whole file into Extensions > Apps Script of your Google Sheet, change TOKEN, then Deploy > New deployment > Web app
   (Execute as: Me, Who has access: Anyone). Copy the Web app URL into the server as SHEET_URL, and TOKEN as SHEET_TOKEN. */
var TOKEN = 'CHANGE-THIS-TO-A-LONG-RANDOM-TEXT';   // secret: teacher only (read / delete)
var KEY = 'CHANGE-THIS-TO-ANOTHER-RANDOM-TEXT';      // goes inside the students' link: can only ADD a result
var HEAD = ['Time', 'Name', 'Score', 'Correct', 'Wrong', 'Questions', 'Accuracy %', 'Level', 'Fastest (s)', 'Total time (s)', 'Rank at finish', 'Game', 'Current rank', 'ID'];

function sheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), s = ss.getSheetByName(name);
  if (!s) { s = ss.insertSheet(name); if (headers) { s.appendRow(headers); s.setFrozenRows(1); s.getRange(1, 1, 1, headers.length).setFontWeight('bold'); } }
  return s;
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function addResult_(r) {
  var s = sheet_('Results', HEAD);
  if (s.getLastRow() > 1 && s.getRange(2, 14, s.getLastRow() - 1, 1).createTextFinder(String(r.id)).matchEntireCell(true).findNext()) return { ok: true, dup: true };
  s.appendRow([new Date(r.at), String(r.name).slice(0, 40), Number(r.score) || 0, Number(r.correct) || 0, Number(r.wrong) || 0, Number(r.total) || 0, Number(r.accuracy) || 0, String(r.level || ''), r.fastest, Number(r.timeSec) || 0, r.rankAtFinish, String(r.title || '').slice(0, 60), '', String(r.id)]);
  var row = s.getLastRow();
  s.getRange(row, 1).setNumberFormat('yyyy-mm-dd hh:mm');
  s.getRange(row, 13).setFormula('=RANK(C' + row + ',$C$2:$C)');
  return { ok: true };
}

function doPost(e) {
  var d; try { d = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: 'bad json' }); }
  if (d.token !== TOKEN) return out_({ ok: false, error: 'token' });
  var lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    if (d.action === 'result') {
      return out_(addResult_(d.row));
    }
    if (d.action === 'setgame') {
      var g = sheet_('Game'); g.clear();
      var txt = JSON.stringify({ game: d.game, at: d.at }), rows = [];
      for (var i = 0; i < txt.length; i += 40000) rows.push([txt.substr(i, 40000)]);
      g.getRange(1, 1, rows.length, 1).setValues(rows);
      return out_({ ok: true });
    }
    return out_({ ok: false, error: 'unknown action' });
  } finally { lock.releaseLock(); }
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === 'submit') {            // a student's finished game (sent by the game page itself)
    if (p.key !== KEY && p.token !== TOKEN) return out_({ ok: false, error: 'key' });
    var r; try { r = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(p.d)).getDataAsString('UTF-8')); } catch (err) { return out_({ ok: false, error: 'bad data' }); }
    if (!r || !r.id || !r.name) return out_({ ok: false, error: 'bad data' });
    var lk = LockService.getScriptLock(); lk.waitLock(25000);
    try { return out_(addResult_(r)); } finally { lk.releaseLock(); }
  }
  if (p.action === 'get') {               // short link: a student's page fetches the exam by its short id (KEY is enough)
    if (p.key !== KEY && p.token !== TOKEN) return out_({ ok: false, error: 'key' });
    var gs = sheet_('Links', ['ID', 'Part', 'Data']), gl = gs.getLastRow(), parts = [];
    if (gl > 1) gs.getRange(2, 1, gl - 1, 3).getValues().forEach(function (v) { if (String(v[0]) === String(p.gid)) parts.push([Number(v[1]), String(v[2])]); });
    if (!parts.length) return out_({ ok: false, error: 'notfound' });
    parts.sort(function (a, b) { return a[0] - b[0]; });
    return out_({ ok: true, token: parts.map(function (x) { return x[1]; }).join('') });
  }
  if (p.token !== TOKEN) return out_({ ok: false, error: 'token' });
  if (p.action === 'put') {               // teacher saves one chunk of an exam under a short id (chunks keep the URL short enough for GET)
    if (!/^[A-Za-z0-9]{4,12}$/.test(String(p.gid)) || !(Number(p.i) >= 0) || !(Number(p.n) >= 1) || Number(p.n) > 60 || String(p.d).length > 3000) return out_({ ok: false, error: 'bad data' });
    var lk3 = LockService.getScriptLock(); lk3.waitLock(25000);
    try {
      var ls = sheet_('Links', ['ID', 'Part', 'Data']);
      if (Number(p.i) === 0 && ls.getLastRow() > 1) {          // first chunk: drop an older version of the same id
        var all = ls.getRange(2, 1, ls.getLastRow() - 1, 1).getValues();
        for (var r = all.length - 1; r >= 0; r--) if (String(all[r][0]) === String(p.gid)) ls.deleteRow(r + 2);
      }
      var nr = ls.getLastRow() + 1;
      ls.getRange(nr, 1, 1, 3).setNumberFormat('@').setValues([[String(p.gid), String(p.i), String(p.d)]]);
      return out_({ ok: true });
    } finally { lk3.releaseLock(); }
  }
  if (p.action === 'delete') {
    var lk2 = LockService.getScriptLock(); lk2.waitLock(25000);
    try {
      var s2 = sheet_('Results', HEAD);
      if (s2.getLastRow() > 1) { var f = s2.getRange(2, 14, s2.getLastRow() - 1, 1).createTextFinder(String(p.id)).matchEntireCell(true).findNext(); if (f) s2.deleteRow(f.getRow()); }
      return out_({ ok: true });
    } finally { lk2.releaseLock(); }
  }
  if (e.parameter.action === 'list') {
    var s = sheet_('Results', HEAD), n = s.getLastRow(), rows = [];
    if (n > 1) {
      s.getRange(2, 1, n - 1, 14).getValues().forEach(function (v) {
        if (!v[1] && v[1] !== 0) return;
        rows.push({ at: v[0] instanceof Date ? v[0].getTime() : v[0], name: String(v[1]), score: Number(v[2]), correct: Number(v[3]), wrong: Number(v[4]), total: Number(v[5]),
          accuracy: Number(v[6]), level: String(v[7]), fastest: v[8], timeSec: Number(v[9]), rankAtFinish: Number(v[10]), title: String(v[11]), id: String(v[13]) });
      });
    }
    return out_({ ok: true, rows: rows });
  }
  if (e.parameter.action === 'getgame') {
    var g = sheet_('Game'), gn = g.getLastRow();
    if (!gn) return out_({ ok: true, game: null });
    var txt = g.getRange(1, 1, gn, 1).getValues().map(function (x) { return x[0]; }).join('');
    try { var j = JSON.parse(txt); return out_({ ok: true, game: j.game, at: j.at }); } catch (err) { return out_({ ok: true, game: null }); }
  }
  return out_({ ok: false, error: 'unknown action' });
}
