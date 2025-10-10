(function(){
  function qs(p,sel){ return (p||document).querySelector(sel); }
  function getConfig(){
    if (window.FORM_ENDPOINT) return window.FORM_ENDPOINT;
    try{
      var el = document.getElementById('site-config');
      if (el && el.textContent){
        var cfg = JSON.parse(el.textContent);
        if (cfg && cfg.FORM_ENDPOINT) return cfg.FORM_ENDPOINT;
      }
    }catch(_){}
    return '';
  }
  function jsonpCall(payload){
    return new Promise(function(resolve,reject){
      const cb = 'cb_'+Math.random().toString(36).slice(2);
      const ep = getConfig();
      if (!ep) return reject(new Error('FORM_ENDPOINT not set'));
      const u  = new URL(ep);
      const s  = document.createElement('script');
      s.src = u.toString() + '?callback=' + cb + '&payload=' + encodeURIComponent(JSON.stringify(payload));
      window[cb] = function(data){ resolve(data); cleanup(); };
      s.onerror = function(){ reject(new Error('JSONP error')); cleanup(); };
      document.head.appendChild(s);
      function cleanup(){ try{ delete window[cb]; }catch(_){}
        try{ s.remove(); }catch(_){}
      }
    });
  }
  function chunkString(str, size){ const out=[]; for(let i=0;i<str.length;i+=size) out.push(str.slice(i,i+size)); return out; }

  function markInvalid(inputs){
    inputs.forEach(el=>{ if (el) el.classList.add('invalid'); });
    const first = inputs.find(Boolean);
    if (first) try{ first.focus(); }catch(_){}
  }
  function clearInvalid(form){
    Array.from(form.querySelectorAll('.invalid')).forEach(el=> el.classList.remove('invalid'));
  }

  async function main(){
    const form = qs(document,'form[data-join]');
    if (!form) return;

    const tokenEl = qs(form,'#token');
    const genBtn  = qs(document,'#genTokenBtn');
    const rulesTa = qs(form,'#rules_text');
    const rulesCounter = qs(document,'#rules_count');
    const msgEl   = qs(document,'#msg');
    const resultEl= qs(document,'#join-result');
    const verifyEl= qs(document,'#verify-token');
    const submitBtn = qs(document,'#submitBtn');
    const rulesSendBtn = qs(document,'#rulesSendBtn');

    if (genBtn && tokenEl){
      genBtn.addEventListener('click', async ()=>{
        try{ await jsonpCall({ action:'ping' }); }catch(_){}
        tokenEl.value = Math.random().toString(16).slice(2,10).toUpperCase();
      });
    }

    if (rulesTa && rulesCounter){
      const upd=()=>{ rulesCounter.textContent = (rulesTa.value||'').length; };
      rulesTa.addEventListener('input',upd); upd();
    }

    if (rulesSendBtn){
      rulesSendBtn.addEventListener('click', ()=>{
        try { form.requestSubmit(); } catch(_) { form.submit(); }
      });
    }

    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      clearInvalid(form);
      msgEl.textContent = '';
      resultEl.textContent = '';
      verifyEl.textContent = '';

      const fd = new FormData(form);
      const payload = {
        action: 'register_init',
        team: String(fd.get('team')||'').trim(),
        channel_url: String(fd.get('channel_url')||'').trim(),
        playlist_url:String(fd.get('playlist_url')||'').trim(),
        contact:     String(fd.get('contact')||'').trim(),
        country:     String(fd.get('country')||'').trim(),
        city:        String(fd.get('city')||'').trim(),
        accept_rules: !!fd.get('accept_rules'),
        accept_policy:!!fd.get('accept_policy'),
      };
      const rules_text = String(fd.get('rules_text')||'').trim();

      // валидация длины правил до отправки
      if (!(rules_text.length>=500 && rules_text.length<=3000)){
        msgEl.textContent = 'Rules text must be 500–3000 characters.';
        markInvalid([rulesTa]);
        return;
      }

      // блокируем кнопку на время запроса
      if (submitBtn) submitBtn.disabled = true;

      try{
        // 1) init (получаем id + verify_token), тут же ловим дубли
        const init = await jsonpCall(payload);
        if (!init || !init.ok){
          if (init && init.error === 'duplicate'){
            // Подсветим соответствующие поля
            const dups = (init.duplicates||[]);
            const map = {
              team: qs(form,'[name=team]'),
              channel_url: qs(form,'[name=channel_url]'),
              playlist_url: qs(form,'[name=playlist_url]'),
              contact: qs(form,'[name=contact]')
            };
            const bad = dups.map(k => map[k]).filter(Boolean);
            markInvalid(bad);
            msgEl.textContent = 'Already registered: ' + dups.join(', ') + '. Please change highlighted fields.';
          }else{
            msgEl.textContent = 'Registration failed: ' + String((init && init.error) || 'Unknown error');
          }
          return;
        }

        // 2) chunks for rules
        const chunks = chunkString(rules_text, 700);
        for (let i=0;i<chunks.length;i++){
          const put = await jsonpCall({ action:'rules_put', id:init.id, seq:i, chunk:chunks[i] });
          if (!put || !put.ok) throw new Error('rules_put failed at chunk '+i);
        }

        // 3) commit
        const fin = await jsonpCall({ action:'rules_commit', id:init.id });
        if (!fin || !fin.ok) throw new Error(fin && fin.error || 'rules_commit failed');

        // success
        resultEl.textContent = 'Registration submitted successfully.';
        const tok = fin.verify_token || init.verify_token || '';
        if (tok){
          verifyEl.textContent = 'Verification token: ' + tok;
          if (tokenEl) tokenEl.value = tok;
        }
        form.reset();
        rulesCounter && (rulesCounter.textContent = '0');
      }catch(err){
        msgEl.textContent = 'Network or API error: ' + String(err.message||err);
      }finally{
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }
  document.addEventListener('DOMContentLoaded', main);
})();
