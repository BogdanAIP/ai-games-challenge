/** ======================= http.gs (JSONP + POST) =======================
 * GET:  JSONP (?callback=...&payload=<JSON>) — сайт/админ-панель
 * POST: обычный JSON                          — тесты/скрипты/cron
 * Примечание: в GAS нельзя вешать свои CORS-заголовки.
 * ===================================================================== */

/* --------- helper: JSON --------- */
function httpJson_(obj){
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* --------- Preflight (OPTIONS) --------- */
function doOptions(e){
  return ContentService.createTextOutput('').setMimeType(ContentService.MimeType.TEXT);
}

/* --------- GET: JSONP роутер --------- */
function doGet(e){
  var cb = e && e.parameter && e.parameter.callback || '';
  if (!cb){
    // healthcheck без JSONP
    return httpJson_({ ok:true, service:'aigc-gas', pong:new Date().toISOString() });
  }

  var raw = e && e.parameter && e.parameter.payload || '';
  var data = {};
  try{
    data = raw ? JSON.parse(raw) : {};
  }catch(_){
    return ContentService.createTextOutput(
      cb+'('+JSON.stringify({ ok:false, error:'Bad JSONP payload' })+');'
    ).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  var resp;
  try{
    switch (data.action){
      case 'ping':
        resp = { ok:true, pong:new Date().toISOString() };
        break;

      // ---------- Публичные JSONP-действия ----------
      case 'faq':
        resp = handleFaq_(data);
        break;
      case 'register_form':
        resp = handleRegistration_(data);
        break;
      case 'mint':
        resp = { ok:true, token:newToken_() };
        break;

      // ---------- Админ JSONP-действия (по секрету) ----------
      case 'init_project': {
        var secret = PropertiesService.getScriptProperties().getProperty('SEED_SECRET') || '';
        if ((data.secret||'') !== secret) { resp = { ok:false, error:'forbidden' }; break; }
        initProject_(); // создаёт/гарантирует листы и шапки
        resp = { ok:true, msg:'initProject_ done' };
        break;
      }
      case 'seed_all': {
        var secret2 = PropertiesService.getScriptProperties().getProperty('SEED_SECRET') || '';
        if ((data.secret||'') !== secret2) { resp = { ok:false, error:'forbidden' }; break; }
        resp = seedAll_(); // твой «засев» (конфиг, промпты, источники RAG)
        break;
      }

      default:
        resp = { ok:false, error:'Unknown action' };
    }
  }catch(err){
    try{ logErr_('doGet(JSONP)', err, { data:data }); }catch(_){}
    resp = { ok:false, error:String(err && err.message || err) };
  }

  return ContentService
    .createTextOutput(cb+'('+JSON.stringify(resp)+');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

/* --------- POST: обычный JSON --------- */
function doPost(e){
  try{
    if (!e || !e.postData || !e.postData.contents){
      return httpJson_({ ok:false, error:'Empty body' });
    }
    var data;
    try{ data = JSON.parse(e.postData.contents); }
    catch(_){ return httpJson_({ ok:false, error:'Bad JSON' }); }

    switch (data.action){
      case 'ping':         return httpJson_({ ok:true, pong:new Date().toISOString() });
      case 'version':      return httpJson_({ ok:true, version:'v1.0', time:new Date().toISOString() });

      // одноразовые init/seed (по секрету)
      case 'init_project': {
        var secret = PropertiesService.getScriptProperties().getProperty('SEED_SECRET') || '';
        if ((data.secret||'') !== secret) return httpJson_({ ok:false, error:'forbidden' });
        initProject_();
        return httpJson_({ ok:true, msg:'initProject_ done' });
      }
      case 'seed_all': {
        var secret2 = PropertiesService.getScriptProperties().getProperty('SEED_SECRET') || '';
        if ((data.secret||'') !== secret2) return httpJson_({ ok:false, error:'forbidden' });
        var res = seedAll_();
        return httpJson_(res);
      }

      // публичные бизнес-эндпоинты
      case 'faq':          return httpJson_(handleFaq_(data));
      case 'register':     return httpJson_(handleRegistrationDialog_(data));
      case 'register_form':return httpJson_(handleRegistration_(data));
      case 'gamepack':     return httpJson_(handleGamePack_(data));
      case 'content':      return httpJson_(handleContent_(data));
      case 'lb_refresh':   return httpJson_(handleLeaderboardRefresh_());
      case 'tele_post':    return httpJson_(handleTelegramPost_(data));
      case 'rag_refresh':  return httpJson_(ragRefresh_());

      default:             return httpJson_({ ok:false, error:'Unknown action' });
    }
  }catch(err){
    try{ logErr_('doPost', err, { raw:e && e.postData && e.postData.contents }); }catch(_){}
    return httpJson_({ ok:false, error:String(err && err.message || err) });
  }
}

