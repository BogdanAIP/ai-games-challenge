/** =========================== faq.gs ===========================
 * FAQ c мини-RAG, определением языка и кешированием по языку.
 * Зависимости: cfg_(), prompt_(), ragContextFor_(), askLLM_(), logErr_()
 * Листы: FaqCache (key, answer, ts)
 * ============================================================= */

/** Определяем язык входного вопроса грубо по алфавиту. */
function detectLang_(s){
  var t = String(s||'');
  var cyr = (t.match(/[А-Яа-яЁё]/g) || []).length;
  var lat = (t.match(/[A-Za-z]/g) || []).length;
  if (cyr === 0 && lat === 0) return 'ru'; // по умолчанию
  return (cyr >= lat) ? 'ru' : 'en';
}

/** Системный промпт для FAQ, c жёсткой установкой языка ответа. */
function faqSystemPrompt_(lang){
  var base = prompt_('SYS_FAQ',
    'You are the official assistant for "AI Games Challenge". ' +
    'Answer clearly, accurately, and concisely. Prefer safety & fair play; ' +
    'if unsure, say what is known and point to the Full Rules. ' +
    'Key links: rules: https://bogdanaip.github.io/ai-games-challenge/rules.html ; ' +
    'full: https://bogdanaip.github.io/ai-games-challenge/rules_full.html ; ' +
    'join: https://bogdanaip.github.io/ai-games-challenge/join.html ; ' +
    'FAQ: https://bogdanaip.github.io/ai-games-challenge/faq.html'
  );
  if (lang === 'en'){
    return base + ' IMPORTANT: Reply strictly in English, matching the user’s question language.';
  } else {
    return base + ' ВАЖНО: Отвечай строго по-русски, на языке вопроса пользователя.';
  }
}

/** Простой кеш в листе + ScriptCache. */
function faqCacheGet_(key){
  try{
    var c = CacheService.getScriptCache().get(key);
    if (c) return c;
  }catch(_){}
  try{
    var ss = SS_();
    var sh = ss.getSheetByName('FaqCache') || ss.insertSheet('FaqCache');
    if (sh.getLastRow()===0) sh.getRange(1,1,1,3).setValues([['key','answer','ts']]);
    var last = sh.getLastRow();
    if (last < 2) return '';
    var vals = sh.getRange(2,1,last-1,3).getValues();
    for (var i=0;i<vals.length;i++){
      if (String(vals[i][0]||'') === key) return String(vals[i][1]||'');
    }
  }catch(_){}
  return '';
}

function faqCachePut_(key, value){
  if (!key || !value) return;
  try{
    var ttl = Number(cfg_('FAQ_CACHE_TTL_SEC','86400')) || 86400;
    CacheService.getScriptCache().put(key, value, Math.min(ttl, 21600));
  }catch(_){}
  try{
    var ss = SS_();
    var sh = ss.getSheetByName('FaqCache') || ss.insertSheet('FaqCache');
    if (sh.getLastRow()===0) sh.getRange(1,1,1,3).setValues([['key','answer','ts']]);
    sh.appendRow([key, value, new Date()]);
  }catch(_){}
}

/** Основной обработчик FAQ. */
function handleFaq_(data){
  try{
    var q = String(data && data.question || '').trim();
    if (!q) return { ok:false, error:'Empty question' };

    // 1) язык вопроса
    var lang = detectLang_(q); // 'ru' | 'en'

    // 2) ключ кеша включает язык
    var cacheKey = 'faq:'+lang+':'+q.toLowerCase();
    var cached = faqCacheGet_(cacheKey);
    if (cached) return { ok:true, cached:true, answer: cached, lang: lang };

    // 3) системный промпт и контекст из RAG
    var sys = faqSystemPrompt_(lang);
    var ctx = ragContextFor_(q, 3, 2000); // до ~2k символов

    // 4) сообщения для LLM
    var msgs = [{ role:'system', content: sys }];
    if (ctx) msgs.push({ role:'system', content: 'Relevant site context:\n' + ctx });
    msgs.push({ role:'user', content: q });

    // 5) параметры генерации
    var maxT = Number(cfg_('FAQ_MAX_TOKENS','800')) || 800; // ↑ увеличили
    var temp = Number(cfg_('FAQ_TEMPERATURE','0.2'));       // чуть суше для точности

    var res = askLLM_(msgs, { max_tokens: maxT, temperature: temp });
    var answer = res && res.text || '';
    if (!answer) return { ok:false, error:'Empty completion' };

    // 6) сохранить в кеш и вернуть
    faqCachePut_(cacheKey, answer);
    return { ok:true, answer: answer, model: res.model, lang: lang, cached:false };

  }catch(err){
    logErr_('handleFaq_', err, { data: data });
    return { ok:false, error: String(err && err.message || err) };
  }
}
