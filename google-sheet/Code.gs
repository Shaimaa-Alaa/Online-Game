/* Quiz Race -> Google Sheets bridge.
   Paste this whole file into Extensions > Apps Script of your Google Sheet, change TOKEN, then Deploy > New deployment > Web app
   (Execute as: Me, Who has access: Anyone). Copy the Web app URL into the server as SHEET_URL, and TOKEN as SHEET_TOKEN. */
var TOKEN = 'CHANGE-THIS-TO-A-LONG-RANDOM-TEXT';
var HEAD = ['Time', 'Name', 'Score', 'Correct', 'Wrong', 'Questions', 'Accuracy %', 'Level', 'Fastest (s)', 'Total time (s)', 'Rank at finish', 'Game', 'Current rank', 'ID'];

function sheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), s = ss.getSheetByName(name);
  if (!s) { s = ss.insertSheet(name); if (headers) { s.appendRow(headers); s.setFrozenRows(1); s.getRange(1, 1, 1, headers.length).setFontWeight('bold'); } }
  return s;
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function doPost(e) {
  var d; try { d = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: 'bad json' }); }
  if (d.token !== TOKEN) return out_({ ok: false, error: 'token' });
  var lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    if (d.action === 'result') {
      var s = sheet_('Results', HEAD), r = d.row;
      if (s.getLastRow() > 1 && s.getRange(2, 14, s.getLastRow() - 1, 1).createTextFinder(String(r.id)).matchEntireCell(true).findNext()) return out_({ ok: true, dup: true });
      s.appendRow([new Date(r.at), r.name, r.score, r.correct, r.wrong, r.total, r.accuracy, r.level, r.fastest, r.timeSec, r.rankAtFinish, r.title, '', r.id]);
      var row = s.getLastRow();
      s.getRange(row, 1).setNumberFormat('yyyy-mm-dd hh:mm');
      s.getRange(row, 13).setFormula('=RANK(C' + row + ',$C$2:$C)');
      return out_({ ok: true });
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
  if (!e || !e.parameter || e.parameter.token !== TOKEN) return out_({ ok: false, error: 'token' });
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
