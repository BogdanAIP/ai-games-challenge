/** =========================== rag.gs ===========================
 * Мини-RAG для сайта:
 *  - ragRefresh_(): тянет HTML страниц из RagSources → парсит → пишет в RagPages
 *  - ragRetrieve_(query, k): возвращает k релевантных сниппетов по запросу
 *  - ragContextFor_(question, k, maxChars): склеивает сниппеты в короткий контекст
 * В коде нет setHeaders — чистый GAS.
 * =============================================================== */

/** Основной апдейтер RAG: читает RagSources → пишет RagPages (идемпотентно). */
function ragRefresh_(){
  try{
    var ss = SS_();

    // гарантируем листы и шапки
    var shSrc = ss.getSheetByName('RagSources') || ss.insertSheet('RagSources');
    if (shSrc.getLastRow() === 0){
      shSrc.getRange(1,1,1,1).setValues([['url']]);
    }
    var shPages = ensureRagPagesHeader_();

    // читаем список URL
    var urls = getRagUrls_(); // из config_runtime.gs
    if (!urls || !urls.length){
      return { ok:true, updated:0, note:'no sources in RagSources' };
    }

    // качаем и подготавливаем строки
    var rows = []; // [url, title, content, updated_at]
    urls.forEach(function(u){
      try{
        var resp = UrlFetchApp.fetch(u, { muteHttpExceptions:true, followRedirects:true });
        var code = resp.getResponseCode();
        if (code >= 200 && code < 300){
          var html = resp.getContentText() || '';
          var title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [,''])[1];
          if (title) title = title.replace(/\s+/g,' ').trim();
          var text = htmlToPlain_(html).slice(0, 120000); // лимит на размер
          rows.push([u, title || '', text, new Date()]);
        } else {
          rows.push([u, '', '(fetch error '+code+')', new Date()]);
        }
      }catch(e){
        rows.push([u, '', '(exception: '+String(e)+')', new Date()]);
      }
    });

    // очищаем старые данные и пишем новые (если есть)
    var last = shPages.getLastRow();
    if (last > 1){
      shPages.getRange(2,1,last-1,4).clearContent();
    }
    if (rows.length){
      shPages.getRange(2,1,rows.length,4).setValues(rows);
    }

    return { ok:true, updated: rows.length };
  }catch(err){
    logErr_('ragRefresh_', err);
    return { ok:false, error:String(err) };
  }
}

/** Возвращает лист RagPages с гарантированными заголовками. */
function ensureRagPagesHeader_(){
  var ss = SS_();
  var sh = ss.getSheetByName('RagPages') || ss.insertSheet('RagPages');
  if (sh.getLastRow() === 0){
    sh.getRange(1,1,1,4).setValues([['url','title','content','updated_at']]);
  }
  return sh;
}

/** Очень простой HTML → plain text конвертер. */
function htmlToPlain_(html){
  try{
    var txt = String(html || '');

    // убрать <script> / <style>
    txt = txt.replace(/<script[\s\S]*?<\/script>/ig, ' ')
             .replace(/<style[\s\S]*?<\/style>/ig,  ' ');

    // семантические переводы строк
    txt = txt.replace(/<(br|\/p)>/ig, '\n')
             .replace(/<\/(h[1-6]|li|div|section|article|header|footer)>/ig, '\n');

    // снести теги
    txt = txt.replace(/<[^>]+>/g, ' ');

    // простая раскодировка сущностей
    txt = txt.replace(/&nbsp;/g,' ')
             .replace(/&amp;/g,'&')
             .replace(/&lt;/g,'<')
             .replace(/&gt;/g,'>')
             .replace(/&quot;/g,'"')
             .replace(/&#39;/g,"'");

    // нормализация
    txt = txt.replace(/\s+\n/g, '\n')
             .replace(/\n{3,}/g, '\n\n')
             .replace(/[ \t]{2,}/g, ' ')
             .trim();

    return txt;
  }catch(e){
    return '';
  }
}

/**
 * Поисковая выдача по локальному корпусу (RagPages) — k сниппетов.
 * Возвращает массив строк: "[Source] Title — URL\n<snippet>"
 */
function ragRetrieve_(query, k){
  k = k || 3;
  var ss = SS_(), sh = ss.getSheetByName('RagPages');
  if (!sh || sh.getLastRow() < 2) return [];

  var rows = sh.getRange(2,1,sh.getLastRow()-1,4).getValues(); // url,title,content,updated_at
  var terms = String(query||'')
                .toLowerCase()
                .split(/[\s,.;:!?()"'«»]+/)
                .filter(function(w){ return w.length > 2; });

  function score(txt){
    var s = 0, low = (txt||'').toLowerCase();
    for (var i=0;i<terms.length;i++){
      var w = terms[i];
      if (!w) continue;
      var parts = low.split(w);
      var hits = parts.length - 1;
      s += hits * 3;
      if (hits > 0) s += 1; // небольшой бонус за присутствие терма
    }
    // лёгкий бонус за длину (но с ограничением)
    s += Math.min((txt||'').length / 5000, 5);
    return s;
  }

  return rows
    .map(function(r){ return { url:r[0], title:r[1], content:r[2], s:score(r[2]) }; })
    .sort(function(a,b){ return b.s - a.s; })
    .slice(0,k)
    .map(function(c){
      var low = (c.content||'').toLowerCase();
      var pos = -1;
      for (var i=0;i<terms.length;i++){
        var p = low.indexOf(terms[i]);
        if (p >= 0){ pos = p; break; }
      }
      if (pos < 0) pos = 0;
      var start = Math.max(0, pos - 300);
      var end   = Math.min(c.content.length, pos + 500);
      var snip  = c.content.slice(start, end).replace(/\s{2,}/g,' ');
      var header = '[Source] ' + (c.title || c.url) + ' — ' + c.url;
      return header + '\n' + snip;
    });
}

/**
 * Удобный хелпер: собрать короткий контекст для LLM из k сниппетов.
 * maxChars ограничивает общий размер (по умолчанию ~2k символов).
 */
function ragContextFor_(question, k, maxChars){
  k = k || 3;
  maxChars = maxChars || 2000;
  var chunks = ragRetrieve_(question, k);
  if (!chunks || !chunks.length) return '';
  var out = '';
  for (var i=0;i<chunks.length;i++){
    if ((out + '\n\n' + chunks[i]).length > maxChars) break;
    out += (out ? '\n\n' : '') + chunks[i];
  }
  return out;
}
