function askLLM_(messages, opts){
  var key  = PropertiesService.getScriptProperties().getProperty('OPENROUTER_API_KEY');
  if (!key) throw new Error('OPENROUTER_API_KEY not set');
  var models = (cfg_('OPENROUTER_MODELS','deepseek/deepseek-r1:free')||'')
                .split(',').map(function(s){return s.trim();}).filter(Boolean);
  var maxTokens = Number(cfg_('MAX_TOKENS','400'));
  if (opts?.max_tokens) maxTokens = opts.max_tokens;
  var temperature = (opts && 'temperature' in opts) ? opts.temperature : 0.3;
  var site = PropertiesService.getScriptProperties().getProperty('OPENROUTER_SITE') || cfg_('BASE_URL','https://example.com');

  var lastErr=null;
  for (var i=0;i<models.length;i++){
    var payload = { model: models[i], messages: messages, max_tokens:maxTokens, temperature:temperature };
    for (var t=0;t<3;t++){
      try{
        var resp = UrlFetchApp.fetch('https://openrouter.ai/api/v1/chat/completions', {
          method:'post', contentType:'application/json', payload: JSON.stringify(payload),
          headers:{ 'Authorization':'Bearer '+key, 'HTTP-Referer': site, 'X-Title':'AI Games Challenge' },
          muteHttpExceptions:true
        });
        var code = resp.getResponseCode();
        if (code===200){
          var data = JSON.parse(resp.getContentText()||'{}');
          var txt  = data?.choices?.[0]?.message?.content || '';
          if (!txt) throw new Error('Empty completion');
          return { ok:true, model:models[i], text:txt };
        } else if (code===429 || code>=500){ Utilities.sleep(400*(t+1)); lastErr=new Error('HTTP '+code+': '+resp.getContentText()); continue; }
        else { lastErr=new Error('HTTP '+code+': '+resp.getContentText()); break; }
      }catch(e){ lastErr=e; Utilities.sleep(300*(t+1)); }
    }
  }
  throw lastErr || new Error('LLM failed');
}
