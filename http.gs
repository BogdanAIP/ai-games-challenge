/** ======================= http.gs (JSONP + POST) =======================
 * GAS не умеет произвольные CORS-заголовки. Для фронта используем JSONP:
 *   GET .../exec?callback=cb123&payload=<JSON | base64(JSON)>
 * Поддерживаются действия: mint, faq, register, register_form, gamepack,
 * content, lb_refresh, tele_post, rag_refresh.
 * ===================================================================== */

/* --------- helpers: JSON / JSONP --------- */
function httpJson_(obj){
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
function httpJs_(callbackName, obj){
  var cb = String(callbackName || 'callback').replace(/[^\w.$]/g,'cb');
  var body = cb + '(' + JSON.stringify(obj) + ');';
  return ContentService
    .createTextOutput(body)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
function tryParseJson_(s){
  try { return JSON.parse(String(s)); } catch(e){ return null; }
}
function tryParseBase64Json_(s){
  try{
    var bytes = Utilities.base64Decode(String(s));
    var txt = Utilities.newBlob(bytes).getDataAsString('UTF-8');
    return JSON.parse(txt);
  }catch(e){ return null; }
}

/* --------- Preflight (OPTIONS) --------- */
function doOptions(e){
  // В GAS нельзя навесить кастомные CORS — просто 200 OK пустое тело
  return ContentService.createTextOutput('').setMimeType(ContentService.MimeType.TEXT);
}

/* --------- GET: healthcheck + JSONP-роутер --------- */
function doGet(e){
  // Если это JSONP-вызов: ?callback=...&payload=...
  var cb  = e && e.parameter && e.parameter.callback;
  var pl  = e && e.parameter && e.parameter.payload;
  if (cb && typeof pl !== 'undefined'){
    // payload может быть raw JSON или base64(JSON)
    var data = tryParseJson_(pl);
    if (!data) data = tryParseBase64Json_(pl);
    if (!data) return httpJs_(cb, { ok:false, error:'Bad payload (not JSON / base64 JSON)' });

    // Допускаем ping/mint без action для обратной совместимости
    if (data && data.action === 'ping')      return httpJs_(cb, { ok:true, pong:new Date().toISOString() });
    if (data && data.action === 'mint')      return httpJs_(cb, { ok:true, token:newToken_() });
    if (!data.action && data.mint)           return httpJs_(cb, { ok:true, token:newToken_() });

    try{
      switch (data.action){
        case 'faq':           return httpJs_(cb, handleFaq_(data));
        case 'register':      return httpJs_(cb, handleRegistrationDialog_(data));
        case 'register_form': return httpJs_(cb, handleRegistration_(data));
        case 'gamepack':      return httpJs_(cb, handleGamePack_(data));
        case 'content':       return httpJs_(cb, handleContent_(data));
        case 'lb_refresh':    return httpJs_(cb, handleLeaderboardRefresh_());
        case 'tele_post':     return httpJs_(cb, handleTelegramPost_(data));
        case 'rag_refresh':   return httpJs_(cb, ragRefresh_());
        default:              return httpJs_(cb, { ok:false, error:'Unknown action' });
      }
    }catch(err){
      try{ logErr_('doGet.jsonp', err, {raw:data}); }catch(_){}
      return httpJs_(cb, { ok:false, error:String(err && err.message || err) });
    }
  }

  // Обычный GET — healthcheck
  var body = { ok:true, service:'aigc-gas', pong:new Date().toISOString() };
  return httpJson_(body);
}

/* --------- POST: основной роутер (для админских кнопок/серверов) --------- */
function doPost(e){
  try{
    if (!e || !e.postData || !e.postData.contents){
      return httpJson_({ ok:false, error:'Empty body' });
    }
    var data = tryParseJson_((e.postData && e.postData.contents) || '');
    if (!data) return httpJson_({ ok:false, error:'Bad JSON' });

    // Служебные
    if (data.action === 'ping')    return httpJson_({ ok:true, pong:new Date().toISOString() });
    if (data.action === 'version') return httpJson_({ ok:true, version:'v1.0', time:new Date().toISOString() });

    // Одноразовые init/seed — защищены секретом
    if (data.action === 'init_project'){
      var secret = PropertiesService.getScriptProperties().getProperty('SEED_SECRET') || '';
      if ((data.secret||'') !== secret) return httpJson_({ ok:false, error:'forbidden' });
      initProject_();
      return httpJson_({ ok:true, msg:'initProject_ done' });
    }
    if (data.action === 'seed_all'){
      var secret2 = PropertiesService.getScriptProperties().getProperty('SEED_SECRET') || '';
      if ((data.secret||'') !== secret2) return httpJson_({ ok:false, error:'forbidden' });
      var res = seedAll_();
      return httpJson_(res);
    }

    // Публичные
    switch (data.action){
      case 'faq':           return httpJson_(handleFaq_(data));
      case 'register':      return httpJson_(handleRegistrationDialog_(data));
      case 'register_form': return httpJson_(handleRegistration_(data));
      case 'gamepack':      return httpJson_(handleGamePack_(data));
      case 'content':       return httpJson_(handleContent_(data));
      case 'lb_refresh':    return httpJson_(handleLeaderboardRefresh_());
      case 'tele_post':     return httpJson_(handleTelegramPost_(data));
      case 'rag_refresh':   return httpJson_(ragRefresh_());
      default:              return httpJson_({ ok:false, error:'Unknown action' });
    }
  }catch(err){
    try{ logErr_('doPost', err, { raw: e && e.postData && e.postData.contents }); }catch(_){}
    return httpJson_({ ok:false, error:String(err && err.message || err) });
  }
}
