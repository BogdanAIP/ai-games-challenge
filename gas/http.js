/** =========================== http.js ===========================
 * JSONP endpoint: doGet?callback=cb&payload={...}
 * Маршрутизирует action и возвращает cb(<json>);
 * ===============================================================*/

function doGet(e) {
  try {
    var cb = (e && e.parameter && e.parameter.callback) || 'cb';
    var payloadRaw = (e && e.parameter && e.parameter.payload) || '{}';
    var data = {};
    try { data = JSON.parse(payloadRaw); } catch(_){ data = {}; }
    var action = (data.action||'').toString().trim();
    
    // Проверка доступности API
    if (typeof ScriptApp === 'undefined' || typeof ContentService === 'undefined') {
      return jsonResponse_(cb, { ok:false, error:'API services unavailable' });
    }

    switch (action) {
      case 'ping':
        return jsonResponse_(cb, { ok:true, pong: new Date().toISOString() });

      case 'faq':
        if (typeof handleFaq_ === 'function')
          return jsonResponse_(cb, handleFaq_(data));
        return jsonResponse_(cb, { ok:false, error:'faq handler missing' });

      case 'register':
        if (typeof handleRegistrationDialog_ === 'function')
          return jsonResponse_(cb, handleRegistrationDialog_(data));
        return jsonResponse_(cb, { ok:false, error:'register dialog missing' });

      case 'register_init':
        if (typeof registerInit_ === 'function')
          return jsonResponse_(cb, registerInit_(data));
        return jsonResponse_(cb, { ok:false, error:'register_init missing' });

      case 'rules_put':
        if (typeof rulesPut_ === 'function')
          return jsonResponse_(cb, rulesPut_(data));
        return jsonResponse_(cb, { ok:false, error:'rules_put missing' });

      case 'rules_commit':
        if (typeof rulesCommit_ === 'function')
          return jsonResponse_(cb, rulesCommit_(data));
        return jsonResponse_(cb, { ok:false, error:'rules_commit missing' });

      default:
        return jsonResponse_(cb, { ok:false, error:'Unknown action: ' + action });
    }
  } catch(err) {
    return jsonResponse_((e && e.parameter && e.parameter.callback) || 'cb',
      { ok:false, error:String(err && err.message || err) }
    );
  }
}

function jsonResponse_(callback, data) {
  if (!callback) callback = 'cb';
  return ContentService
    .createTextOutput(callback + '(' + JSON.stringify(data || {}) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
