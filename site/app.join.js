(function(){
  // ЕДИНСТВЕННЫЙ источник: меняй URL ТОЛЬКО тут
  window.FORM_ENDPOINT = 'https://script.google.com/macros/s/AKfycbx81KK5qfSzIpRHLyemRPfafF3f-zCsHlaQVMh3Z0p68CTHcjp8RWz-9WG2OtsbYQX0/exec';

  function $(s){ return document.querySelector(s); }

  // JSONP: передаем payload (base64) + callback
  function jsonpCall(obj, timeoutMs){
    return new Promise(function(resolve,reject){
      const cb = 'cb_' + Math.random().toString(36).slice(2);
      const t  = setTimeout(function(){
        cleanup(); reject(new Error('JSONP timeout'));
      }, timeoutMs || 20000);

      function cleanup(){
        try { delete window[cb]; } catch(e){}
        if (script && script.parentNode) script.parentNode.removeChild(script);
        clearTimeout(t);
      }

      window[cb] = function(data){ cleanup(); resolve(data); };

      // NB: payload может быть крупным → для MVP: без rules_file в JSONP
      const payload = btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
      const src = `${window.FORM_ENDPOINT}?callback=${encodeURIComponent(cb)}&payload=${encodeURIComponent(payload)}`;

      const script = document.createElement('script');
      script.src = src;
      script.onerror = function(){ cleanup(); reject(new Error('JSONP load error')); };
      document.head.appendChild(script);
    });
  }

  function genToken(){
    const rnd = Math.random().toString(36).slice(2,8).toUpperCase();
    const ts  = Date.now().toString(36).toUpperCase();
    return `AIGC-${rnd}-${ts}`;
  }

  function setMsg(text, cls){
    const el = $('#msg');
    if(!el) return;
    el.className = 'note' + (cls ? ' ' + cls : '');
    el.textContent = text;
  }

  // Mint токена через JSONP
  async function mintToken(){
    try{
      setMsg('Minting token…');
      const data = await jsonpCall({ action:'mint' }, 15000);
      if(!data || !data.ok){ throw new Error(data && data.error || 'mint failed'); }
      const t = $('#token'); if(t) t.value = data.token || '';
      setMsg('Token generated.', 'ok');
    }catch(e){
      setMsg('Mint error: ' + e.message, 'err');
    }
  }

  // Сабмит формы (JSONP, без файла для избежания лимитов URL)
  async function handleSubmit(ev){
    ev.preventDefault();
    setMsg('Submitting…');

    const fd = new FormData(ev.target);
    const payload = {
      team:         (fd.get('team')||'').trim(),
      country:      (fd.get('country')||'').trim(),
      contact:      (fd.get('contact')||'').trim(),
      channel_url:  (fd.get('channel_url')||'').trim(),
      playlist_url: (fd.get('playlist_url')||'').trim(),
      notes:        (fd.get('notes')||'').trim()
      // token сейчас сервер генерирует сам; поле на форме носит информ. характер
    };

    // файл ПОКА НЕ ШЛЁМ через JSONP (слишком длинный URL) — предложим отправить позже в Issue
    const fileEl = $('#rules_file');
    if (fileEl && fileEl.files && fileEl.files[0]) {
      setMsg('For now, please submit without file. You can attach the rules file directly in the created GitHub issue.', 'err');
      return;
    }

    for(const k of ['team','country','contact','channel_url','playlist_url']){
      if(!payload[k]){ setMsg(`Missing field: ${k}`,'err'); return; }
    }

    try{
      const data = await jsonpCall(payload, 20000);
      if(!data || !data.ok){ throw new Error((data && data.error) || 'submission failed'); }
      setMsg(`✅ Submitted. Registration #${data.issue_number}. We'll review it soon.`, 'ok');
      ev.target.reset();
      const tokenEl = $('#token'); if(tokenEl) tokenEl.value = genToken();
    }catch(e){
      setMsg('Submission error: ' + e.message, 'err');
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    // авто-токен + кнопка Generate
    const tokenEl = $('#token');
    if (tokenEl && !tokenEl.value) tokenEl.value = genToken();
    const btn = $('#genTokenBtn'); if(btn) btn.addEventListener('click', function(){ tokenEl.value = genToken(); tokenEl.select(); });

    const form = document.getElementById('joinForm');
    if (form) form.addEventListener('submit', handleSubmit);
  });
})();
