/** =========================== content.js ===========================
 * JSON/JSONP контент-эндпоинт.
 * Принимает: data.task ИЛИ data.type ИЛИ data.topic.
 * По умолчанию — task='leaderboard'.
 * ------------------------------------------------------------------ */

function handleContent_(data){
  try{
    data = data || {};
    var task = (data.task || data.type || data.topic || '').toString().trim();
    if (!task) task = 'leaderboard';

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

/** Лидерборд:
 *  - Читает команды из "Registrations": team, verify_token, country, city.
 *  - Пытается подмержить метрики из "Leaderboard" (по team): views, likes, er.
 *  - Возвращает массив объектов для фронта.
 */
function contentLeaderboard_(data){
  var ss = SS_();

  // --- 1) Registrations (источник участников и токенов)
  var shR = ss.getSheetByName('Registrations');
  var regs = [];
  if (shR){
    var vR = shR.getDataRange().getValues();
    if (vR && vR.length > 1){
      // ожидаемую шапку выравнивали в handleRegistration_
      // индексы: [ts(0), id(1), team(2), channel(3), playlist(4), contact(5), country(6), city(7), verify_token(8), status(9), notes(10)]
      for (var r=1; r<vR.length; r++){
        var row = vR[r] || [];
        var team = String((row.length>2?row[2]:'')||'').trim();
        if (!team) continue;
        regs.push({
          team: team,
          verify_token: String((row.length>8?row[8]:'')||'').trim(),
          country: String((row.length>6?row[6]:'')||'').trim(),
          city: String((row.length>7?row[7]:'')||'').trim()
        });
      }
    }
  }

  // --- 2) Leaderboard (метрики, если есть)
  var metricsByTeam = {};
  var shL = ss.getSheetByName('Leaderboard');
  if (shL){
    var vL = shL.getDataRange().getValues();
    if (vL && vL.length > 1){
      // ожидаемую шапку форсируем в handleLeaderboardRefresh_
      // колонки: team, views, likes, er
      for (var i=1; i<vL.length; i++){
        var lr = vL[i] || [];
        var t  = String((lr.length>0?lr[0]:'')||'').trim();
        if (!t) continue;
        metricsByTeam[t.toLowerCase()] = {
          views: Number((lr.length>1?lr[1]:0))||0,
          likes: Number((lr.length>2?lr[2]:0))||0,
          er:    Number((lr.length>3?lr[3]:0))||0
        };
      }
    }
  }

  // --- 3) Сборка выходного массива
  var out = regs.map(function(r){
    var m = metricsByTeam[r.team.toLowerCase()] || {views:0,likes:0,er:0};
    return {
      team: r.team,
      verify_token: r.verify_token,
      country: r.country,
      city: r.city,
      views: m.views,
      likes: m.likes,
      er: m.er
    };
  });

  // опционально: сортировка по имени
  out.sort(function(a,b){ return a.team.localeCompare(b.team, 'ru'); });

  // лимит, если передали
  var limit = Number(data && data.limit) || 0;
  if (limit>0 && out.length>limit) out = out.slice(0, limit);

  return { ok:true, leaderboard: out };
}
