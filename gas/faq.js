/** =========================== faq.js ===========================
 * FAQ с мини-RAG и ИИ. Делает краткий и полезный ответ.
 * Изменения:
 *  - detectLang_() → строгая выдача на языке вопроса
 *  - ragContextFor_(..., 5, 3500) → больше контекста
 *  - расширенный фоллбэк, если ИИ молчит
 * =============================================================== */

function detectLang_(text){
  var s = String(text||'');
  // очень простой и быстрый детектор
  if (/[А-Яа-яЁё]/.test(s)) return 'ru';
  return 'en';
}

function handleFaq_(data){
  var q = String(data && data.question || '').trim();
  if (!q) return { ok:false, error:'Empty question' };

  var lang = detectLang_(q); // 'ru' | 'en'
  var ctx  = ragContextFor_(q, 5, 3500); // было 3,1800 → стало шире

  var sys = (lang === 'ru') ? FAQ_PROMPT_RU : FAQ_PROMPT_EN;
  var user = (lang === 'ru')
    ? ("Вопрос: " + q + (ctx ? ("\n\nКонтекст из базы знаний:\n" + ctx) : ""))
    : ("Question: " + q + (ctx ? ("\n\nKnowledge base context:\n" + ctx) : ""));

  var resp;
  try{
    resp = askOpenRouter_({
      messages: [
        { role:'system', content: sys },
        { role:'user',   content: user }
      ],
      // управляется через Script Properties, но поставим адекватные дефолты
      model:  (cfg_('OPENROUTER_MODELS','deepseek/deepseek-r1:free')||'').split(/\s*,\s*/)[0],
      max_tokens: Number(cfg_('FAQ_MAX_TOKENS', cfg_('MAX_TOKENS','700'))) || 700,
      temperature: Number(cfg_('FAQ_T', cfg_('TEMPERATURE','0.3'))) || 0.3
    });

    var out = (resp && resp.text || '').trim();
    if (!out){
      // мягкий фоллбэк
      out = (lang === 'ru')
        ? "Пока не могу ответить. Попробуй переформулировать вопрос или загляни в раздел правил."
        : "I can’t answer right now. Please rephrase the question or check the Rules section.";
    }
    // кешируем на 5 минут
    cacheFaqAnswer_(q, out);
    return { ok:true, answer: out };

  }catch(err){
    logErr_('handleFaq_', err, { q:q });
    return { ok:false, error:String(err && err.message || err) };
  }
}

/* ===== Простенький кеш (опционально; можно отключить) ===== */
function cacheFaqAnswer_(q, answer){
  try{
    var sh = SS_().getSheetByName('FaqCache') || SS_().insertSheet('FaqCache');
    if (sh.getLastRow()===0) sh.getRange(1,1,1,3).setValues([['key','answer','ts']]);
    sh.appendRow([Utilities.base64Encode(q), answer, new Date()]);
  }catch(_){}
}
