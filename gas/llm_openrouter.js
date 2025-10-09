/** ================== llm_openrouter.js ==================
 * Глобальная обёртка для OpenRouter chat-completions с фоллбеком.
 * Требует Script Properties:
 *  - OPENROUTER_API_KEY
 *  - OPENROUTER_MODELS (список через запятую; пробуем по очереди)
 * Дополнительно можно настроить:
 *  - OPENROUTER_SITE   (Referer)
 *  - OPENROUTER_TITLE  (X-Title)
 * ======================================================== */

function askOpenRouter_(opts){
  // opts = { messages:[{role,content}], model?, max_tokens?, temperature? }
  var key = cfg_('OPENROUTER_API_KEY','').trim();
  if (!key) throw new Error('OPENROUTER_API_KEY is empty');

  // Получаем все доступные модели
  var allModels = cfg_('OPENROUTER_MODELS',
    'deepseek/deepseek-chat-v3-0324:free,anthropic/claude-2:free,google/palm-2-chat-bison:free,meta-llama/codellama-34b-instruct:free'
  ).split(/\s*,\s*/);

  // Если указана конкретная модель в opts, ставим её первой
  if (opts && opts.model) {
    allModels = [opts.model].concat(allModels.filter(m => m !== opts.model));
  }

  var maxT = Number((opts && opts.max_tokens) ||
                   cfg_('FAQ_MAX_TOKENS', cfg_('MAX_TOKENS','600'))) || 600;

  var temp = Number((opts && opts.temperature) ||
                   cfg_('FAQ_T', cfg_('TEMPERATURE','0.3'))) || 0.3;

  var site  = cfg_('OPENROUTER_SITE','https://bogdanaip.github.io/ai-games-challenge/');
  var title = cfg_('OPENROUTER_TITLE','AI Games Challenge');

  var headers = {
    'Authorization': 'Bearer ' + key,
    'Content-Type': 'application/json',
    'HTTP-Referer': site,
    'X-Title': title
  };

  // Перебираем модели пока не получим успешный ответ
  var lastError = null;
  for (var i = 0; i < allModels.length; i++) {
    var currentModel = allModels[i];
    
    try {
      var payload = {
        model: currentModel,
        messages: (opts && opts.messages) || [],
        max_tokens: maxT,
        temperature: temp
      };

      var res = UrlFetchApp.fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'post',
        contentType: 'application/json',
        headers: headers,
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });

      var code = res.getResponseCode();
      var txt = res.getContentText();
      
      // Если ошибка HTTP - пробуем следующую модель
      if (code < 200 || code >= 300) {
        lastError = 'HTTP ' + code + ': ' + txt;
        Logger.log('Model ' + currentModel + ' failed: ' + lastError);
        continue;
      }

      // Парсим ответ
      var json = JSON.parse(txt);
      var choice = json && json.choices && json.choices[0];
      var out = choice && choice.message && choice.message.content || '';
      
      // Если есть текст - возвращаем результат
      if (out.trim()) {
        return {
          model: currentModel,
          text: out.trim(),
          was_fallback: i > 0  // флаг что использовали запасную модель
        };
      }

      // Если текста нет - пробуем следующую модель
      lastError = 'Empty response from ' + currentModel;
      Logger.log(lastError);
      
    } catch(err) {
      lastError = String(err.message || err);
      Logger.log('Model ' + currentModel + ' failed: ' + lastError);
      continue;
    }
  }

  // Если все модели отказали - выбрасываем ошибку
  throw new Error('All models failed. Last error: ' + lastError);
}
