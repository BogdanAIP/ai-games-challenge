function handleTelegramPost_(data){
  var token = PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN');
  var chat  = PropertiesService.getScriptProperties().getProperty('TELEGRAM_CHAT_ID');
  if (!token || !chat) return {ok:false,error:'Telegram not configured'};

  var topN = Math.max(1, Number(cfg_('LB_TOP_N_FOR_TELEGRAM','10')));
  var ss = SS_(), lb = ss.getSheetByName('Leaderboard');
  if (!lb || lb.getLastRow()<2) return {ok:false,error:'Leaderboard empty'};

  var rows = lb.getRange(2,1,lb.getLastRow()-1,7).getValues();
  rows.sort(function(a,b){ return a[6]-b[6]; }); // rank asc
  rows = rows.slice(0, topN);

  var lines = ['🏆 AI Games Challenge — Leaderboard (Top '+topN+')'];
  rows.forEach(function(r){
    var team=r[1], score=r[2], views=r[3], likes=r[4], comments=r[5], rank=r[6];
    lines.push('#'+rank+' — '+team+' • Score: '+score+' • 👁 '+views+' • 👍 '+likes+' • 💬 '+comments);
  });
  var text = lines.join('\n');

  var resp = UrlFetchApp.fetch('https://api.telegram.org/bot'+token+'/sendMessage', {
    method:'post', contentType:'application/json',
    payload: JSON.stringify({ chat_id: chat, text: text, disable_web_page_preview: true })
  });
  return { ok: resp.getResponseCode()===200, code: resp.getResponseCode(), body: resp.getContentText() };
}


/** tgPost_: пост в Telegram-канал, если заданы BOT_TOKEN и CHANNEL_ID в config_runtime.js */
function tgPost_(text){
  try{
    if (typeof RUNTIME_CFG !== 'undefined' && RUNTIME_CFG && RUNTIME_CFG.TELEGRAM_BOT_TOKEN && RUNTIME_CFG.TELEGRAM_CHANNEL_ID){
      var url = 'https://api.telegram.org/bot'+RUNTIME_CFG.TELEGRAM_BOT_TOKEN+'/sendMessage';
      var payload = { chat_id: RUNTIME_CFG.TELEGRAM_CHANNEL_ID, text: String(text||''), disable_web_page_preview: true };
      UrlFetchApp.fetch(url, { method:'post', payload: payload, muteHttpExceptions:true });
    }
  }catch(_){}
}
