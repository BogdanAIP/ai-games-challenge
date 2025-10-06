/** =========================== leaderboard.js ===========================
 * Рефреш: зеркалит команды из "Registrations" в "Leaderboard".
 * ДОБАВЛЕНО:
 *  - ensureRegHeaders_(): жёстко правит шапку Registration до:
 *    ['ts','id','team','channel_url','playlist_url','contact','country','city','status','notes']
 *  - trimLbColumns_(): подрезает лишние колонки Leaderboard до 4.
 * ====================================================================== */

function ensureRegHeaders_(){
  var ss = SS_();
  var sh = ss.getSheetByName('Registrations');
  if (!sh){
    sh = ss.insertSheet('Registrations');
  }
  var NEED = ['ts','id','team','channel_url','playlist_url','contact','country','city','status','notes'];
  var hdrRange = sh.getRange(1,1,1,NEED.length);
  var put = false;
  try{
    var cur = sh.getRange(1,1,1,Math.max(sh.getLastColumn(), NEED.length)).getValues()[0]
      .map(function(x){ return String(x||'').toLowerCase().trim(); });
    // если разные по длине или не совпадают — перезаписываем
    if (cur.length < NEED.length) put = true;
    else {
      for (var i=0;i<NEED.length;i++){ if (cur[i] !== NEED[i]) { put = true; break; } }
    }
  }catch(_){ put = true; }
  if (put){
    hdrRange.setValues([NEED]);
  }
  // убеждаемся, что есть как минимум 10 колонок
  if (sh.getMaxColumns() < NEED.length){
    sh.insertColumnsAfter(sh.getMaxColumns(), NEED.length - sh.getMaxColumns());
  }
  return sh;
}

function trimLbColumns_(){
  var ss = SS_();
  var sh = ss.getSheetByName('Leaderboard');
  if (!sh) return;
  var needCols = 4;
  var max = sh.getMaxColumns();
  if (max > needCols){
    sh.deleteColumns(needCols+1, max-needCols);
  }
}

function ensureLbSheet_(){
  var ss = SS_();
  var sh = ss.getSheetByName('Leaderboard');
  if (!sh){
    sh = ss.insertSheet('Leaderboard');
  }
  // Всегда шапка
  sh.getRange(1,1,1,4).setValues([['team','views','likes','er']]);
  trimLbColumns_();
  try{
    sh.getRange(2,2,Math.max(1, sh.getMaxRows()-1),3).setNumberFormat('0');
  }catch(_){}
  return sh;
}

/** Читаем команды из Registrations: структура строк, которую мы пишем:
 * [ts, id, team, channel_url, playlist_url, contact, country, city, status, notes]
 * => team = index 2 (третья колонка)
 */
function readRegistrationsTeams_(){
  var sh = ensureRegHeaders_(); // авто-фикс шапки перед чтением
  var vals = sh.getDataRange().getValues();
  if (!vals || vals.length <= 1) return [];
  var out = [];
  for (var r=1; r<vals.length; r++){
    var row = vals[r] || [];
    var t = String((row.length > 2 ? row[2] : '') || '').trim();
    if (t) out.push(t);
  }
  // de-dupe
  var seen = {};
  return out.filter(function(t){
    var k = t.toLowerCase();
    if (seen[k]) return false;
    seen[k]=1; return true;
  });
}

/** Пишем список команд в Leaderboard с нулями */
function mirrorTeamsToLeaderboard_(teams){
  var sh = ensureLbSheet_();
  // очистим всё кроме шапки
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2,1,last-1,4).clearContent();
  if (!teams.length) return 0;
  var rows = teams.map(function(t){ return [t, 0, 0, 0]; });
  sh.getRange(2,1,rows.length,4).setValues(rows);
  return rows.length;
}

/** Публичный рефрешер, вызывается из http: lb_refresh */
function handleLeaderboardRefresh_(){
  try{
    var teams = readRegistrationsTeams_();
    var n = mirrorTeamsToLeaderboard_(teams);
    return { ok:true, updated:n, refreshed_at:new Date().toISOString() };
  }catch(err){
    try{ logErr_('handleLeaderboardRefresh_', err, {}); }catch(_){}
    return { ok:false, error:String(err && err.message || err) };
  }
}
