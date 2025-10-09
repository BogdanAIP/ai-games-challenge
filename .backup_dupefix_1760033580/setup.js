/** =========================== setup.gs ===========================
 * Одноразовый «засев» таблицы:
 *  - создаёт недостающие листы и шапки
 *  - добавляет базовые ключи в Config
 *  - добавляет системные промпты в Prompts
 *  - добавляет базовые RAG-источники в RagSources
 * Всё безопасно к повторным запускам.
 * =============================================================== */

function seedAll_(){
  try{
    var ss = SS_();

    // 1) Гарантируем базовые листы и шапки
    ensureSheetWithHeader_(ss, 'AppLog',       ['ts','where','error','meta','env']);
    ensureSheetWithHeader_(ss, 'Config',       ['key','value']);
    ensureSheetWithHeader_(ss, 'Prompts',      ['name','text']);
    ensureSheetWithHeader_(ss, 'RagSources',   ['url']);
    ensureSheetWithHeader_(ss, 'RagPages',     ['url','title','content','updated_at']);
    ensureSheetWithHeader_(ss, 'FaqCache',     ['key','answer','ts']);
    ensureSheetWithHeader_(ss, 'Registrations',['ts','team','country','contact','channel_url','playlist_url','issue_url','token']);
    ensureSheetWithHeader_(ss, 'Users',        ['ts','contact','team','country','channel_url','playlist_url','token']);
    ensureSheetWithHeader_(ss, 'Leaderboard',  ['ts','team','score','views','likes','comments','rank']);

    // 2) Config — добавим недостающие ключи (значения можно менять в таблице)
    var configDefaults = {
      ALLOWED_ORIGINS: 'https://bogdanaip.github.io',
      BASE_URL:        'https://bogdanaip.github.io',
      OPENROUTER_MODELS: 'deepseek/deepseek-r1:free,moonshotai/kimi-k2:free,qwen/qwen-2.5-14b-instruct:free',
      FAQ_CACHE_TTL_SEC: '86400',
      LB_MAX_VIDEOS_PER_PLAYLIST: '50',
      LB_TOP_N_FOR_TELEGRAM: '10'
    };
    var cfgAdded = upsertConfig_(ss, configDefaults);

    // 3) Prompts — аккуратно добавим, чего нет
    var prmAdded = 0;
    prmAdded += upsertPrompt_(ss, 'SYS_FAQ',
      'You are the official assistant for "AI Games Challenge". Answer clearly and concisely. ' +
      'Language: reply in the user’s language (Russian if user writes Russian). Prefer safety & fair play; ' +
      'if unsure, state what is known and point to Full Rules. ' +
      'Links: https://bogdanaip.github.io/ai-games-challenge/rules.html | ' +
      'https://bogdanaip.github.io/ai-games-challenge/rules_full.html | ' +
      'https://bogdanaip.github.io/ai-games-challenge/join.html | ' +
      'https://bogdanaip.github.io/ai-games-challenge/faq.html'
    );
    prmAdded += upsertPrompt_(ss, 'SYS_REG',
      'You are the registration assistant of "AI Games Challenge". Collect: team name; country/region; contact (email/telegram); ' +
      'YouTube channel URL (/@handle or /channel/ID); season playlist URL (/playlist?list=...). ' +
      'Validate formats politely; ask one short question per turn. Language: user’s language. Do not promise prizes (MVP).'
    );
    prmAdded += upsertPrompt_(ss, 'SYS_GAMEPACK',
      'Create a Markdown one-pager for a NEW PHYSICAL GAME created with AI. Sections: Name, Short Slogan, Players & Equipment, ' +
      'Setup, Objective, Rules (numbered), Safety, Variations, Scoring. Be concise, playable, and safe. Language = user’s language.'
    );
    prmAdded += upsertPrompt_(ss, 'SYS_CONTENT',
      'You generate concise marketing assets: slogans (≤8 words), YouTube descriptions (≤150 words + 3 hashtags), logo briefs (bullets), ' +
      'brand tone (bullets), music brief (tempo/mood/instruments). Language = user’s language.'
    );

    // 4) RagSources — добавим URL’ы сайта, если их нет
    var baseUrls = [
      'https://bogdanaip.github.io/ai-games-challenge/index.html',
      'https://bogdanaip.github.io/ai-games-challenge/rules.html',
      'https://bogdanaip.github.io/ai-games-challenge/rules_full.html',
      'https://bogdanaip.github.io/ai-games-challenge/join.html',
      'https://bogdanaip.github.io/ai-games-challenge/faq.html',
      'https://bogdanaip.github.io/ai-games-challenge/contact.html'
    ];
    var ragAdded = upsertRagSources_(ss, baseUrls);

    // 5) Можно сразу подтянуть контент (необязательно)
    var ragRes = ragRefresh_(); // вернёт {ok:true, updated:n} или ошибку

    return {
      ok: true,
      seeded: true,
      added: {
        config: cfgAdded,
        prompts: prmAdded,
        rag_sources: ragAdded
      },
      rag_updated: (ragRes && ragRes.ok) ? ragRes.updated : 0
    };

  }catch(err){
    logErr_('seedAll_', err);
    return { ok:false, error:String(err && err.message || err) };
  }
}

/* ====================== ВСПОМОГАТЕЛЬНЫЕ ====================== */

/** Создаёт лист (если нет) и ставит шапку, если таблица пуста. */
function ensureSheetWithHeader_(ss, name, header){
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0){
    sh.getRange(1,1,1,header.length).setValues([header]);
  }
  return sh;
}

/** Добавляет пары key:value в Config, только если ключа ещё нет. Возвращает сколько добавлено. */
function upsertConfig_(ss, obj){
  var sh = ensureSheetWithHeader_(ss, 'Config', ['key','value']);
  var last = sh.getLastRow();
  var existing = {};
  if (last >= 2){
    var vals = sh.getRange(2,1,last-1,2).getValues();
    for (var i=0;i<vals.length;i++){
      existing[String(vals[i][0]||'')] = String(vals[i][1]||'');
    }
  }
  var added = 0;
  for (var k in obj){
    if (!k) continue;
    if (!(k in existing)){
      sh.appendRow([k, obj[k]]);
      added++;
    }
  }
  return added;
}

/** Добавляет промпт, если отсутствует. Возвращает 1 если добавлен, 0 — если уже был. */
function upsertPrompt_(ss, name, text){
  var sh = ensureSheetWithHeader_(ss, 'Prompts', ['name','text']);
  var last = sh.getLastRow();
  if (last >= 2){
    var vals = sh.getRange(2,1,last-1,2).getValues();
    for (var i=0;i<vals.length;i++){
      if (String(vals[i][0]||'') === name) return 0;
    }
  }
  sh.appendRow([name, text]);
  return 1;
}

/** Добавляет URL’ы в RagSources, если их ещё нет. Возвращает количество добавленных. */
function upsertRagSources_(ss, urls){
  var sh = ensureSheetWithHeader_(ss, 'RagSources', ['url']);
  var last = sh.getLastRow();
  var existing = {};
  if (last >= 2){
    var vals = sh.getRange(2,1,last-1,1).getValues();
    for (var i=0;i<vals.length;i++){
      var u = String(vals[i][0]||'').trim();
      if (u) existing[u] = 1;
    }
  }
  var added = 0;
  for (var j=0;j<urls.length;j++){
    var u2 = String(urls[j]||'').trim();
    if (!u2) continue;
    if (!existing[u2]){
      sh.appendRow([u2]);
      added++;
    }
  }
  return added;
}
