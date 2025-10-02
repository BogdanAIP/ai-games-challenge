(function(){
  const ENDPOINT = String(
    window.FORM_ENDPOINT ||
    "https://script.google.com/macros/s/AKfycbyv25wZctxwL36v1Fs8w6NCKL4pAzGq7iZ8XPmptmqx3FD_u_fUZy4wnVO5MumdrtuB/exec"
  ).replace(/^'+|'+$/g,'');

  function jsonpCall(payload, timeoutMs){
    return new Promise(function(resolve, reject){
      const cb = 'cb_' + Math.random().toString(36).slice(2);
      const s  = document.createElement('script');
      const u  = new URL(ENDPOINT);
      u.searchParams.set('callback', cb);
      u.searchParams.set('payload', JSON.stringify(payload));
      let done=false;
      window[cb] = function(resp){ if (done) return; done=true; resolve(resp); cleanup(); };
      function cleanup(){ try{ delete window[cb]; }catch(_){ window[cb]=undefined; } if (s && s.parentNode) s.parentNode.removeChild(s); }
      s.onerror = function(){ if (done) return; done=true; reject(new Error('JSONP load error')); cleanup(); };
      document.head.appendChild(s);
      const to = setTimeout(function(){ if (done) return; done=true; reject(new Error('JSONP timeout')); cleanup(); }, timeoutMs || 20000);
      const old = window[cb]; window[cb] = x => { clearTimeout(to); return old(x); };
      s.src = u.toString();
    });
  }

  function $(sel){ return document.querySelector(sel); }
  function add(text, who){
    const d = document.createElement('div');
    d.className = who==='bot' ? 'faq-a' : 'faq-q';
    d.textContent = (who==='bot' ? '🤖 ' : '🧑 ') + text;
    const box = $('#faq-box'); box.appendChild(d); box.scrollTop = box.scrollHeight;
  }

  async function ask(){
    const inp = $('#faq-input'); if (!inp) return;
    const q = (inp.value||'').trim();
    if (!q){ inp.focus(); return; }
    add(q, 'user'); inp.value='';
    try{
      const res = await jsonpCall({ action:'faq', question: q });
      if (!res || res.ok !== true){ add('Ошибка: ' + (res && res.error || 'server error'), 'bot'); return; }
      add(res.answer || '[нет ответа]', 'bot');
    }catch(e){
      add('Сбой запроса: ' + e.message, 'bot');
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    const btn = $('#faq-send'); const inp = $('#faq-input');
    if (btn) btn.addEventListener('click', ask);
    if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); ask(); } });
    // приветствие
    add('Привет! Я помощник AI Games Challenge. Спроси про правила, регистрацию, сезон, баллы и т.п. Отвечу языком вопроса.', 'bot');
  });
})();
