/** ================== llm_openrouter.js ==================
 * Глобальная обёртка для OpenRouter chat-completions.
 * Требует Script Properties:
 *  - OPENROUTER_API_KEY
 *  - OPENROUTER_MODELS (список через запятую; берём первый)
 * Дополнительно можно настроить:
 *  - OPENROUTER_SITE   (Referer)
 *  - OPENROUTER_TITLE  (X-Title)
 * ======================================================== */

function askOpenRouter_(opts){
  // opts = { messages:[{role,content}], model?, max_tokens?, temperature? }
  var key   = cfg_('OPENROUTER_API_KEY','').trim();
  if (!key) throw new Error('OPENROUTER_API_KEY is empty');

  var model = (opts && opts.model) ||
              (cfg_('OPENROUTER_MODELS','deepseek/deepseek-chat-v3-0324:free')
                .split(/\s*,\s*/)[0]);

  var maxT  = Number((opts && opts.max_tokens) ||
                     cfg_('FAQ_MAX_TOKENS', cfg_('MAX_TOKENS','600'))) || 600;

  var temp  = Number((opts && opts.temperature) ||
                     cfg_('FAQ_T', cfg_('TEMPERATURE','0.3'))) || 0.3;

  var site  = cfg_('OPENROUTER_SITE','https://bogdanaip.github.io/ai-games-challenge/');
  var title = cfg_('OPENROUTER_TITLE','AI Games Challenge');

  var payload = {
    model: model,
    messages: (opts && opts.messages) || [],
    max_tokens: maxT,
    temperature: temp
  };

  var headers = {
    'Authorization': 'Bearer ' + key,
    'Content-Type': 'application/json',
    // По гайдам OpenRouter желательно указывать:
    'HTTP-Referer': site,
    'X-Title': title
  };

  var res = UrlFetchApp.fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'post',
    contentType: 'application/json',
    headers: headers,
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var code = res.getResponseCode();
  var txt  = res.getContentText();
  if (code < 200 || code >= 300){
    throw new Error('OpenRouter HTTP '+code+': '+txt);
  }
  var json;
  try { json = JSON.parse(txt); } catch(err){
    throw new Error('OpenRouter bad JSON: '+txt);
  }
  // Стандартный формат OpenAI совместимый:
  var choice = json && json.choices && json.choices[0];
  var out = choice && choice.message && choice.message.content || '';
  return {
    model: json && json.model || model,
    text: String(out || '').trim()
  };
}
