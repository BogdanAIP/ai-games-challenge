/** =========================== leaderboard.js ===========================
 * Рефрешер: зеркалит команды из "Registrations" в "Leaderboard".
 * Шапку ('team','views','likes','er') всегда перезаписываем.
 * ВАЖНО: имя команды читаем ИЗ 3-Й КОЛОНКИ (index 2), как мы и пишем при регистрации,
 * чтобы не зависеть от того, что кто-то мог подвигать заголовки руками.
 * ====================================================================== */

function ensureLbSheet_(){
  var ss = SS_();
  var sh = ss.getSheetByName('Leaderboard');
  if (!sh){
    sh = ss.insertSheet('Leaderboard');
  }
  // Всегда жёстко переписываем шапку
  sh.getRange(1,1,1,4).setValues([['team','views','likes','er']]);
  // Числовой формат для метрик
  try{
    sh.getRange(2,2,Math.max(1, sh.getMaxRows()-1),3).setNumberFormat('0');
  }catch(_){}
  return sh;
}

/** Читаем список команд из листа Registrations.
 * Структура строк регистрации строго: [ts, id, team, channel_url, playlist_url, contact, country, city, status, notes]
 * => колонка team = индекс 2. Не полагаемся на заголовки.
 */
function readRegistrationsTeams_(){
  var ss = SS_();
  var sh = ss.getSheetByName('Registrations');
  if (!sh) return [];
  var vals = sh.getDataRange().getValues();
  if (!vals || vals.length <= 1) return [];
  var out = [];
  for (var r=1; r<vals.length; r++){
    var row = vals[r] || [];
    var t = String((row.length > 2 ? row[2] : '') || '').trim(); // <-- фикс: index 2
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
