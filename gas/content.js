/** =========================== content.js ===========================
 * JSON/JSONP контент-эндпоинт.
 * Принимает: data.task ИЛИ data.type ИЛИ data.topic.
 * По умолчанию без указания — task='leaderboard'.
 * ------------------------------------------------------------------ */

function handleContent_(data){
  try{
    data = data || {};
    // Нормализуем алиасы
    var task = (data.task || data.type || data.topic || '').toString().trim();
    if (!task) task = 'leaderboard'; // дефолт для JSONP-виджета

    switch (task) {
      case 'leaderboard':
        return contentLeaderboard_(data);

      default:
        return { ok:false, error:'Unknown content task: ' + task };
    }
  }catch(err){
    try{ logErr_('handleContent_', err, { data:data }); }catch(_){}
    return { ok:false, error:String(err && err.message || err) };
  }
}

/** Выдача лидерборда из листа "Leaderboard".
 * Пытаемся «лениво» обновить через handleLeaderboardRefresh_(), если листа нет.
 * Возвращаем аккуратные поля: team, views, likes, er (если колонок нет — ставим пусто).
 */
function contentLeaderboard_(data){
  var ss = SS_();
  var sh = ss.getSheetByName('Leaderboard');

  if (!sh && typeof handleLeaderboardRefresh_ === 'function'){
    try{ handleLeaderboardRefresh_(); }catch(_){}
    sh = ss.getSheetByName('Leaderboard');
  }

  if (!sh){
    // нет данных — это не фатальная ошибка, фронт отобразит "No data yet"
    return { ok:true, leaderboard: [] };
  }

  var vals = sh.getDataRange().getValues();
  if (!vals || vals.length <= 1){
    return { ok:true, leaderboard: [] };
  }

  var headers = (vals[0] || []).map(function(h){ return String(h||'').toLowerCase().trim(); });

  function idx(nameArr){
    for (var k=0;k<nameArr.length;k++){
      var i = headers.indexOf(nameArr[k]);
      if (i >= 0) return i;
    }
    return -1;
  }

  var iTeam  = idx(['team','name','команда','название','team name']);
  var iViews = idx(['views','v','просмотры']);
  var iLikes = idx(['likes','l','лайки']);
  var iER    = idx(['er','engagement','engagement rate']);

  // --- безопасный фолбэк по позициям, если заголовки странные ---
  if (iTeam < 0) iTeam = 0;
  if (iViews < 0) iViews = 1;
  if (iLikes < 0) iLikes = 2;
  if (iER < 0) iER = 3;

  var out = [];
  for (var r=1; r<vals.length; r++){
    var row = vals[r] || [];
    out.push({
      team:  iTeam  >= 0 ? row[iTeam]  : '',
      views: iViews >= 0 ? row[iViews] : '',
      likes: iLikes >= 0 ? row[iLikes] : '',
      er:    iER    >= 0 ? row[iER]    : ''
    });
  }

  // необязательный лимит
  var limit = Number(data && data.limit) || 0;
  if (limit > 0 && out.length > limit) out = out.slice(0, limit);

  return { ok:true, leaderboard: out };
}
