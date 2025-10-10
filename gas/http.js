// http.js — маршрутизация JSONP/POST для всех действий
function _parsePayload_(e){
  try{
    if (e && e.parameter && e.parameter.payload){
      return JSON.parse(e.parameter.payload);
    }
  }catch(_){}
  try{
    if (e && e.postData && e.postData.contents){
      return JSON.parse(e.postData.contents);
    }
  }catch(_){}
  return {};
}
function _wrapJSONP_(e, obj){
  var cb = (e && e.parameter && e.parameter.callback) ? String(e.parameter.callback) : 'cb';
  var out = cb + '(' + JSON.stringify(obj || {}) + ')';
  return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JAVASCRIPT);
}
function doGet(e){
  try{
    var data = _parsePayload_(e);
    var resp = route_(data, true);
    return _wrapJSONP_(e, resp);
  }catch(err){
    return _wrapJSONP_(e, { ok:false, error:String(err && err.message || err) });
  }
}
function doPost(e){
  try{
    var data = _parsePayload_(e);
    var resp = route_(data, false);
    return ContentService.createTextOutput(JSON.stringify(resp||{}))
      .setMimeType(ContentService.MimeType.JSON);
  }catch(err){
    return ContentService.createTextOutput(JSON.stringify({ ok:false, error:String(err && err.message || err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
function route_(data, isJsonp){
  data = data || {};
  switch(String(data.action||'')){
    case 'ping': return { ok:true, pong:(new Date()).toISOString() };

    // регистрация (бот-диалог)
    case 'register':              return handleRegistrationDialog_(data);

    // двухфазная регистрация (ручная/бот: init + rules chunks + commit)
    case 'register_init':         return registerInit_(data);
    case 'rules_put':             return rulesPut_(data);
    case 'rules_commit':          return rulesCommit_(data);

    // мгновенная проверка дублей на фронте
    case 'check_unique':          return checkUnique_(data);

    // рейтинг/контент
    case 'lb_refresh':            return handleLeaderboardRefresh_();
    case 'content':               return handleContent_(data);

    default:
      return { ok:false, error:'Unknown action: '+String(data.action||'') };
  }
}
