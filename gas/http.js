/** =========================== http.js ===========================
 * JSONP endpoint: doGet?callback=cb&payload={...}
 * Маршрутизирует action и возвращает cb(<json>);
 * ===============================================================*/

function doGet(e){
  try{
    var cb = (e && e.parameter && e.parameter.callback) || 'cb';
    var payloadRaw = (e && e.parameter && e.parameter.payload) || '{}';
    var data = {};
    try{ data = JSON.parse(payloadRaw); }catch(_){ data = {}; }
    var action = (data.action||'').toString().trim();

    var resp = { ok:false, error:'Unknown action' };

    switch (action){
      case 'ping':
        resp = { ok:true, pong: new Date().toISOString() };
        break;

      // контент / лидерборд
      case 'content':
        if (typeof handleContent_ === 'function') resp = handleContent_(data);
        else resp = { ok:false, error:'content handler missing' };
        break;

      case 'lb_refresh':
        if (typeof handleLeaderboardRefresh_ === 'function') resp = handleLeaderboardRefresh_();
        else resp = { ok:false, error:'lb refresh missing' };
        break;

      // регистрация — старые пути (оставляем для совместимости)
      case 'register':
        if (typeof handleRegistrationDialog_ === 'function') resp = handleRegistrationDialog_(data);
        else resp = { ok:false, error:'register dialog missing' };
        break;

      case 'register_form':
        if (typeof handleRegistration_ === 'function') resp = handleRegistration_(data);
        else resp = { ok:false, error:'register form missing' };
        break;

      // НОВОЕ: двухфазная регистрация + чанки правил
      case 'register_init':
        if (typeof registerInit_ === 'function') resp = registerInit_(data);
        else resp = { ok:false, error:'register_init missing' };
        break;

      case 'rules_put':
        if (typeof rulesPut_ === 'function') resp = rulesPut_(data);
        else resp = { ok:false, error:'rules_put missing' };
        break;

      case 'rules_commit':
        if (typeof rulesCommit_ === 'function') resp = rulesCommit_(data);
        else resp = { ok:false, error:'rules_commit missing' };
        break;

      default:
        resp = { ok:false, error:'Unknown action: ' + action };
    }

    var out = cb + '(' + JSON.stringify(resp) + ');';
    return ContentService.createTextOutput(out)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);

  }catch(err){
    var cb = (e && e.parameter && e.parameter.callback) || 'cb';
    var out = cb + '(' + JSON.stringify({ ok:false, error:String(err && err.message || err) }) + ');';
    return ContentService.createTextOutput(out)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
}
